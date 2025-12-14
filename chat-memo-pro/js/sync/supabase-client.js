/**
 * Supabase Client
 *
 * Fetch-based wrapper for Supabase Auth + PostgREST API
 * Per specs/002-cloud-sync/contracts/sync-api.md and storage-interface.md
 *
 * IMPORTANT: This client must NEVER log secrets (anonKey, access tokens, refresh tokens)
 */

import { SYNC_CONFIG, TEST_ERROR_CODE, SYNC_ERROR_CODE } from './sync-config.js';
import { getConfig, getAuth, setAuth, getState, setState } from './sync-config.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function decodeBase64Url(base64Url) {
  const padded = String(base64Url).replace(/-/g, '+').replace(/_/g, '/')
    .padEnd(Math.ceil(String(base64Url).length / 4) * 4, '=');
  return atob(padded);
}

function getUserIdFromJwt(accessToken) {
  try {
    const parts = String(accessToken || '').split('.');
    if (parts.length < 2) return null;
    const payloadJson = decodeBase64Url(parts[1]);
    const payload = JSON.parse(payloadJson);
    return payload.sub || payload.user_id || payload.userId || null;
  } catch {
    return null;
  }
}

async function buildHttpError(prefix, response) {
  let message = '';
  try {
    const contentType = response.headers?.get?.('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await response.json();
      message = body?.message || body?.error || body?.details || JSON.stringify(body);
    } else {
      message = await response.text();
    }
  } catch {
    // ignore
  }

  const status = response.status;
  const statusText = response.statusText || '';
  const suffix = message ? ` ${message}` : statusText ? ` ${statusText}` : '';
  return new Error(`${prefix} (HTTP ${status})${suffix}`);
}

/**
 * Create fetch headers for Supabase API requests
 * @param {string} anonKey - Supabase anon/public key
 * @param {string} accessToken - Optional access token for authenticated requests
 * @returns {Object} Headers object
 */
function createHeaders(anonKey, accessToken = null) {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': anonKey,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return headers;
}

/**
 * Make a fetch request with timeout
 * @param {string} url
 * @param {Object} options
 * @param {number} timeoutMs
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options, timeoutMs = SYNC_CONFIG.REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'TIMEOUT';
      throw timeoutError;
    }
    throw error;
  }
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<any>}
 */
async function retryWithBackoff(fn, maxRetries = SYNC_CONFIG.MAX_RETRIES) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry non-retryable errors
      if (error.code && [
        'INVALID_CREDENTIALS',
        'AUTH_REQUIRED',
        'MISSING_TABLES',
        'RLS_DENIED',
        'SCHEMA_MISMATCH',
      ].includes(error.code)) {
        throw error;
      }

      // If this was the last attempt, throw
      if (attempt === maxRetries) {
        throw error;
      }

      // Wait before retrying
      const delay = SYNC_CONFIG.RETRY_DELAYS_MS[attempt] || SYNC_CONFIG.RETRY_DELAYS_MS[SYNC_CONFIG.RETRY_DELAYS_MS.length - 1];
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Sign in with email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>} Auth session
 */
export async function signIn(email, password) {
  const config = await getConfig();
  const { projectUrl, anonKey } = config;

  if (!projectUrl || !anonKey) {
    const error = new Error('Invalid config');
    error.code = TEST_ERROR_CODE.INVALID_CONFIG;
    throw error;
  }

  const authUrl = `${projectUrl}/auth/v1/token?grant_type=password`;

  try {
    const response = await fetchWithTimeout(authUrl, {
      method: 'POST',
      headers: createHeaders(anonKey),
      body: JSON.stringify({
        email,
        password,
      }),
    });

    if (!response.ok) {
      if (response.status === 400 || response.status === 401) {
        const error = new Error('Invalid credentials');
        error.code = TEST_ERROR_CODE.INVALID_CREDENTIALS;
        throw error;
      }

      const error = new Error(`Sign in failed: ${response.statusText}`);
      error.code = TEST_ERROR_CODE.NETWORK_ERROR;
      throw error;
    }

    const data = await response.json();

    // Store auth session
    const auth = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      userId: data.user?.id || getUserIdFromJwt(data.access_token),
    };

    await setAuth(auth);

    // Transition to Connected (Idle) on successful sign-in
    await setState({
      status: 'Connected (Idle)',
      pausedReason: undefined,
      lastErrorCode: undefined,
      lastErrorAt: undefined,
    });

    return auth;
  } catch (error) {
    if (error.code === 'TIMEOUT') {
      error.code = TEST_ERROR_CODE.TIMEOUT;
    } else if (!error.code) {
      error.code = TEST_ERROR_CODE.NETWORK_ERROR;
    }
    throw error;
  }
}

/**
 * Refresh the access token using the refresh token
 * @returns {Promise<Object>} New auth session
 */
export async function refreshToken() {
  const config = await getConfig();
  const auth = await getAuth();
  const { projectUrl, anonKey } = config;
  const { refreshToken: token } = auth;

  if (!projectUrl || !anonKey || !token) {
    const error = new Error('Auth required');
    error.code = TEST_ERROR_CODE.AUTH_REQUIRED;
    throw error;
  }

  const authUrl = `${projectUrl}/auth/v1/token?grant_type=refresh_token`;

  try {
    const response = await fetchWithTimeout(authUrl, {
      method: 'POST',
      headers: createHeaders(anonKey),
      body: JSON.stringify({
        refresh_token: token,
      }),
    });

    if (!response.ok) {
      const error = new Error('Session expired');
      error.code = TEST_ERROR_CODE.AUTH_REQUIRED;

      // Transition to Paused (Auth Required)
      await setState({
        status: 'Paused (Auth Required)',
        pausedReason: 'Session expired — please sign in again',
        lastErrorCode: TEST_ERROR_CODE.AUTH_REQUIRED,
        lastErrorAt: new Date().toISOString(),
      });

      throw error;
    }

    const data = await response.json();

    // Update auth session
    const newAuth = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      userId: data.user?.id || getUserIdFromJwt(data.access_token) || auth.userId,
    };

    await setAuth(newAuth);

    return newAuth;
  } catch (error) {
    if (error.code === 'TIMEOUT') {
      error.code = TEST_ERROR_CODE.TIMEOUT;
    } else if (!error.code) {
      error.code = TEST_ERROR_CODE.AUTH_REQUIRED;
    }
    throw error;
  }
}

/**
 * Sign out and clear auth session
 * @returns {Promise<void>}
 */
export async function signOut() {
  const config = await getConfig();
  const auth = await getAuth();
  const { projectUrl, anonKey } = config;
  const { accessToken } = auth;

  // Clear local auth state first
  await setAuth({});

  // Transition to Not Configured
  await setState({
    status: 'Not Configured',
  });

  // Attempt to revoke token on server (best effort)
  if (projectUrl && anonKey && accessToken) {
    try {
      await fetchWithTimeout(`${projectUrl}/auth/v1/logout`, {
        method: 'POST',
        headers: createHeaders(anonKey, accessToken),
      });
    } catch (error) {
      // Ignore errors - local state already cleared
      console.warn('Sign out: server revocation failed (ignored)');
    }
  }
}

/**
 * Ensure we have a valid access token (refresh if needed)
 * @returns {Promise<string>} Valid access token
 */
async function ensureValidToken() {
  const auth = await getAuth();

  if (!auth.accessToken || !auth.expiresAt) {
    const error = new Error('Auth required');
    error.code = TEST_ERROR_CODE.AUTH_REQUIRED;
    throw error;
  }

  // Check if token is expired or will expire in next 60 seconds
  const expiresAt = new Date(auth.expiresAt);
  const now = new Date();
  const bufferMs = 60000; // 60 seconds

  if (expiresAt.getTime() - now.getTime() < bufferMs) {
    // Token expired or expiring soon - refresh
    const newAuth = await refreshToken();
    return newAuth.accessToken;
  }

  return auth.accessToken;
}

// ============================================================================
// CONNECTION TESTING
// ============================================================================

/**
 * Test connection to Supabase and verify required tables exist
 * @returns {Promise<Object>} Test result { ok: boolean, errorCode?: string, message?: string }
 */
export async function testConnection() {
  const config = await getConfig();
  const { projectUrl, anonKey } = config;

  // Step 1: Validate config format
  if (!projectUrl || !anonKey) {
    return {
      ok: false,
      errorCode: TEST_ERROR_CODE.INVALID_CONFIG,
      message: 'Project URL and API key are required',
    };
  }

  // Validate Project URL format
  if (!projectUrl.startsWith('https://') || !projectUrl.includes('.supabase.co')) {
    return {
      ok: false,
      errorCode: TEST_ERROR_CODE.INVALID_CONFIG,
      message: 'Project URL must be a valid Supabase URL (https://*.supabase.co)',
    };
  }

  // Step 2: Validate auth session
  try {
    const accessToken = await ensureValidToken();

    // Step 3: Verify required tables exist and are accessible
    const restUrl = `${projectUrl}/rest/v1`;

    // Test conversations table
    try {
      const convResponse = await fetchWithTimeout(`${restUrl}/conversations?select=id&limit=1`, {
        method: 'GET',
        headers: createHeaders(anonKey, accessToken),
      });

      if (!convResponse.ok) {
        if (convResponse.status === 404) {
          return {
            ok: false,
            errorCode: TEST_ERROR_CODE.MISSING_TABLES,
            message: 'Tables not found — please run the SQL migration in Supabase first.',
          };
        }

        if (convResponse.status === 401 || convResponse.status === 403) {
          return {
            ok: false,
            errorCode: TEST_ERROR_CODE.RLS_DENIED,
            message: 'Access denied — check RLS policies',
          };
        }
      }
    } catch (error) {
      if (error.code === 'TIMEOUT') {
        return {
          ok: false,
          errorCode: TEST_ERROR_CODE.TIMEOUT,
          message: 'Connection timeout — please retry',
        };
      }

      return {
        ok: false,
        errorCode: TEST_ERROR_CODE.NETWORK_ERROR,
        message: 'Network error — check your connection and retry',
      };
    }

    // Test messages table
    try {
      const msgResponse = await fetchWithTimeout(`${restUrl}/messages?select=id&limit=1`, {
        method: 'GET',
        headers: createHeaders(anonKey, accessToken),
      });

      if (!msgResponse.ok) {
        if (msgResponse.status === 404) {
          return {
            ok: false,
            errorCode: TEST_ERROR_CODE.MISSING_TABLES,
            message: 'Tables not found — please run the SQL migration in Supabase first.',
          };
        }

        if (msgResponse.status === 401 || msgResponse.status === 403) {
          return {
            ok: false,
            errorCode: TEST_ERROR_CODE.RLS_DENIED,
            message: 'Access denied — check RLS policies',
          };
        }
      }
    } catch (error) {
      if (error.code === 'TIMEOUT') {
        return {
          ok: false,
          errorCode: TEST_ERROR_CODE.TIMEOUT,
          message: 'Connection timeout — please retry',
        };
      }

      return {
        ok: false,
        errorCode: TEST_ERROR_CODE.NETWORK_ERROR,
        message: 'Network error — check your connection and retry',
      };
    }

    return {
      ok: true,
      message: 'Connection successful',
    };
  } catch (error) {
    if (error.code === TEST_ERROR_CODE.AUTH_REQUIRED) {
      return {
        ok: false,
        errorCode: TEST_ERROR_CODE.AUTH_REQUIRED,
        message: 'Session expired — please sign in again',
      };
    }

    return {
      ok: false,
      errorCode: TEST_ERROR_CODE.UNKNOWN,
      message: error.message || 'Unknown error',
    };
  }
}

// ============================================================================
// POSTGREST API
// ============================================================================

function parseContentRangeTotal(contentRange) {
  // Example: "0-0/123" or "*/0"
  const value = String(contentRange || '');
  const match = value.match(/\/(\d+)\s*$/);
  if (!match) return null;
  const total = parseInt(match[1], 10);
  return Number.isFinite(total) ? total : null;
}

async function countTable(table) {
  const config = await getConfig();
  const { projectUrl, anonKey } = config;
  const accessToken = await ensureValidToken();

  const restUrl = `${projectUrl}/rest/v1`;
  const url = `${restUrl}/${table}?select=id&limit=1`;

  return await retryWithBackoff(async () => {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        ...createHeaders(anonKey, accessToken),
        'Prefer': 'count=exact',
      },
    });

    if (!response.ok) {
      const error = await buildHttpError(`Failed to count ${table}`, response);
      error.code = mapHttpErrorToCode(response.status);
      throw error;
    }

    const contentRange = response.headers.get('content-range');
    const total = parseContentRangeTotal(contentRange);
    if (total === null) {
      const error = new Error(`Failed to count ${table}: missing content-range`);
      error.code = SYNC_ERROR_CODE.UNKNOWN;
      throw error;
    }
    return total;
  });
}

export async function countConversations() {
  return await countTable('conversations');
}

export async function countMessages() {
  return await countTable('messages');
}

/**
 * Select conversations from cloud (with pagination and cursor)
 * @param {string} updatedAtCursor - Optional: only fetch conversations updated after this timestamp
 * @param {number} limit - Page size
 * @returns {Promise<Array>} Conversation rows
 */
export async function selectConversationsSince(updatedAtCursor = null, limit = SYNC_CONFIG.CONVERSATION_BATCH_SIZE) {
  const config = await getConfig();
  const { projectUrl, anonKey } = config;
  const accessToken = await ensureValidToken();

  const restUrl = `${projectUrl}/rest/v1`;
  let url = `${restUrl}/conversations?select=*&order=updated_at.asc&limit=${limit}`;

  if (updatedAtCursor) {
    url += `&updated_at=gt.${encodeURIComponent(updatedAtCursor)}`;
  }

  return await retryWithBackoff(async () => {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: createHeaders(anonKey, accessToken),
    });

    if (!response.ok) {
      const error = await buildHttpError('Failed to fetch conversations', response);
      error.code = mapHttpErrorToCode(response.status);
      throw error;
    }

    return await response.json();
  });
}

/**
 * Select messages from cloud (with pagination and cursor)
 * @param {string} updatedAtCursor - Optional: only fetch messages updated after this timestamp
 * @param {number} limit - Page size
 * @returns {Promise<Array>} Message rows
 */
export async function selectMessagesSince(updatedAtCursor = null, limit = SYNC_CONFIG.MESSAGE_BATCH_SIZE) {
  const config = await getConfig();
  const { projectUrl, anonKey } = config;
  const accessToken = await ensureValidToken();

  const restUrl = `${projectUrl}/rest/v1`;
  let url = `${restUrl}/messages?select=*&order=updated_at.asc&limit=${limit}`;

  if (updatedAtCursor) {
    url += `&updated_at=gt.${encodeURIComponent(updatedAtCursor)}`;
  }

  return await retryWithBackoff(async () => {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: createHeaders(anonKey, accessToken),
    });

    if (!response.ok) {
      const error = await buildHttpError('Failed to fetch messages', response);
      error.code = mapHttpErrorToCode(response.status);
      throw error;
    }

    return await response.json();
  });
}

/**
 * Upsert conversations to cloud (idempotent)
 * @param {Array} conversations - Conversation rows to upsert
 * @returns {Promise<void>}
 */
export async function upsertConversations(conversations) {
  if (!conversations || conversations.length === 0) {
    return;
  }

  const config = await getConfig();
  const { projectUrl, anonKey } = config;
  const accessToken = await ensureValidToken();
  const auth = await getAuth();

  if (!auth.userId) {
    const error = new Error('Missing user id in session');
    error.code = TEST_ERROR_CODE.AUTH_REQUIRED;
    throw error;
  }

  const restUrl = `${projectUrl}/rest/v1`;
  const url = `${restUrl}/conversations?on_conflict=user_id,platform,platform_conversation_id`;

  // Add user_id and schema_version to all conversations
  const payload = conversations.map(conv => ({
    ...conv,
    user_id: auth.userId,
    metadata: {
      ...conv.metadata,
      schema_version: SYNC_CONFIG.SCHEMA_VERSION,
    },
  }));

  return await retryWithBackoff(async () => {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        ...createHeaders(anonKey, accessToken),
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await buildHttpError('Failed to upsert conversations', response);
      error.code = mapHttpErrorToCode(response.status);
      throw error;
    }
  });
}

/**
 * Upsert messages to cloud (idempotent)
 * @param {Array} messages - Message rows to upsert
 * @returns {Promise<void>}
 */
export async function upsertMessages(messages) {
  if (!messages || messages.length === 0) {
    return;
  }

  const config = await getConfig();
  const { projectUrl, anonKey } = config;
  const accessToken = await ensureValidToken();
  const auth = await getAuth();

  if (!auth.userId) {
    const error = new Error('Missing user id in session');
    error.code = TEST_ERROR_CODE.AUTH_REQUIRED;
    throw error;
  }

  const restUrl = `${projectUrl}/rest/v1`;
  const url = `${restUrl}/messages?on_conflict=user_id,message_key`;

  // Add user_id and schema_version to all messages
  const payload = messages.map(msg => ({
    ...msg,
    user_id: auth.userId,
    metadata: {
      ...msg.metadata,
      schema_version: SYNC_CONFIG.SCHEMA_VERSION,
    },
  }));

  return await retryWithBackoff(async () => {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        ...createHeaders(anonKey, accessToken),
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await buildHttpError('Failed to upsert messages', response);
      error.code = mapHttpErrorToCode(response.status);
      throw error;
    }
  });
}

/**
 * Restore all deleted conversations by clearing deleted_at for the current user.
 * Note: RLS ensures users can only affect their own rows.
 * @returns {Promise<void>}
 */
export async function restoreDeletedConversations() {
  const config = await getConfig();
  const { projectUrl, anonKey } = config;
  const accessToken = await ensureValidToken();

  const restUrl = `${projectUrl}/rest/v1`;
  const url = `${restUrl}/conversations?deleted_at=not.is.null`;
  const now = new Date().toISOString();

  return await retryWithBackoff(async () => {
    const response = await fetchWithTimeout(url, {
      method: 'PATCH',
      headers: {
        ...createHeaders(anonKey, accessToken),
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        deleted_at: null,
        updated_at: now,
        synced_at: now,
      }),
    });

    if (!response.ok) {
      const error = new Error(`Failed to restore deleted conversations: ${response.statusText}`);
      error.code = mapHttpErrorToCode(response.status);
      throw error;
    }
  });
}

// ============================================================================
// ERROR MAPPING
// ============================================================================

/**
 * Map HTTP status code to error code
 * @param {number} status
 * @returns {string}
 */
function mapHttpErrorToCode(status) {
  if (status === 401 || status === 403) {
    return SYNC_ERROR_CODE.AUTH_REQUIRED;
  }

  if (status === 413 || status === 429 || status === 503) {
    return SYNC_ERROR_CODE.CLOUD_LIMIT;
  }

  if (status === 408) {
    return SYNC_ERROR_CODE.TIMEOUT;
  }

  if (status >= 500) {
    return SYNC_ERROR_CODE.NETWORK_ERROR;
  }

  return SYNC_ERROR_CODE.UNKNOWN;
}
