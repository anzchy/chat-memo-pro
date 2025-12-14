/**
 * Cloud Sync Configuration
 *
 * Constants, batch sizes, timeouts, retry schedules, and chrome.storage helpers
 * Per specs/002-cloud-sync/spec.md and specs/002-cloud-sync/contracts/chrome-storage-schema.md
 */

// ============================================================================
// CONSTANTS
// ============================================================================

export const SYNC_CONFIG = {
  // Batch sizes (per spec FR-013)
  CONVERSATION_BATCH_SIZE: 100,
  MESSAGE_BATCH_SIZE: 500,

  // Timeouts (per spec FR-021)
  REQUEST_TIMEOUT_MS: 30000, // 30 seconds

  // Retry schedule (per spec FR-020)
  RETRY_DELAYS_MS: [2000, 4000, 8000], // 2s, 4s, 8s
  MAX_RETRIES: 3,

  // Auto-sync intervals (per spec FR-028)
  MIN_SYNC_INTERVAL_MINUTES: 5,
  MAX_SYNC_INTERVAL_MINUTES: 1440, // 24 hours
  DEFAULT_SYNC_INTERVAL_MINUTES: 15,

  // Sync history (per spec FR-016)
  MAX_HISTORY_ENTRIES: 20,

  // Schema version (per spec FR-039)
  SCHEMA_VERSION: 1,
};

// ============================================================================
// SYNC STATE LABELS (per spec FR-015)
// ============================================================================

export const SYNC_STATE = {
  NOT_CONFIGURED: 'Not Configured',
  CONNECTED_IDLE: 'Connected (Idle)',
  SYNCING_MANUAL: 'Syncing (Manual)',
  SYNCING_AUTO: 'Syncing (Auto)',
  PAUSED_AUTH_REQUIRED: 'Paused (Auth Required)',
  PAUSED_CLOUD_LIMIT: 'Paused (Cloud Limit)',
  PAUSED_LOCAL_QUOTA: 'Paused (Local Storage Full)',
  PAUSED_SCHEMA_MISMATCH: 'Paused (Schema Mismatch)',
  ERROR: 'Error',
};

// ============================================================================
// ERROR CODES (per specs/002-cloud-sync/contracts/sync-api.md)
// ============================================================================

export const TEST_ERROR_CODE = {
  INVALID_CONFIG: 'InvalidConfig',
  INVALID_CREDENTIALS: 'InvalidCredentials',
  AUTH_REQUIRED: 'AuthRequired',
  MISSING_TABLES: 'MissingTables',
  RLS_DENIED: 'RlsDenied',
  NETWORK_ERROR: 'NetworkError',
  TIMEOUT: 'Timeout',
  UNKNOWN: 'Unknown',
};

export const SYNC_ERROR_CODE = {
  AUTH_REQUIRED: 'AuthRequired',
  CLOUD_LIMIT: 'CloudLimit',
  NETWORK_ERROR: 'NetworkError',
  TIMEOUT: 'Timeout',
  SCHEMA_MISMATCH: 'SchemaMismatch',
  LOCAL_QUOTA_EXCEEDED: 'LocalQuotaExceeded',
  UNKNOWN: 'Unknown',
};

// ============================================================================
// CHROME STORAGE HELPERS
// ============================================================================

function storageLocalGet(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
}

function storageLocalSet(items) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

/**
 * Get the entire cloudSync object from chrome.storage.local
 * @returns {Promise<Object>}
 */
export async function getCloudSyncStorage() {
  const result = await storageLocalGet('cloudSync');
  return (result && result.cloudSync) ? result.cloudSync : {};
}

/**
 * Set the entire cloudSync object
 * @param {Object} cloudSync
 * @returns {Promise<void>}
 */
export async function setCloudSyncStorage(cloudSync) {
  await storageLocalSet({ cloudSync });
}

/**
 * Update specific fields in cloudSync (shallow merge)
 * @param {Object} updates
 * @returns {Promise<void>}
 */
export async function updateCloudSyncStorage(updates) {
  const cloudSync = await getCloudSyncStorage();
  const merged = { ...cloudSync, ...updates };
  await setCloudSyncStorage(merged);
}

/**
 * Get cloudSync.config
 * @returns {Promise<Object>}
 */
export async function getConfig() {
  const cloudSync = await getCloudSyncStorage();
  return cloudSync.config || {};
}

/**
 * Set cloudSync.config
 * @param {Object} config
 * @returns {Promise<void>}
 */
export async function setConfig(config) {
  await updateCloudSyncStorage({ config });
}

/**
 * Get cloudSync.auth
 * @returns {Promise<Object>}
 */
export async function getAuth() {
  const cloudSync = await getCloudSyncStorage();
  return cloudSync.auth || {};
}

/**
 * Set cloudSync.auth
 * @param {Object} auth
 * @returns {Promise<void>}
 */
export async function setAuth(auth) {
  await updateCloudSyncStorage({ auth });
}

/**
 * Get cloudSync.settings
 * @returns {Promise<Object>}
 */
export async function getSettings() {
  const cloudSync = await getCloudSyncStorage();
  return cloudSync.settings || {
    autoSyncEnabled: false,
    syncIntervalMinutes: SYNC_CONFIG.DEFAULT_SYNC_INTERVAL_MINUTES,
    verboseLogging: false,
    preventCloudDeletion: false, // Prevent deleting cloud data from extension
  };
}

/**
 * Set cloudSync.settings
 * @param {Object} settings
 * @returns {Promise<void>}
 */
export async function setSettings(settings) {
  await updateCloudSyncStorage({ settings });
}

/**
 * Get cloudSync.cursors
 * @returns {Promise<Object>}
 */
export async function getCursors() {
  const cloudSync = await getCloudSyncStorage();
  return cloudSync.cursors || {};
}

/**
 * Set cloudSync.cursors
 * @param {Object} cursors
 * @returns {Promise<void>}
 */
export async function setCursors(cursors) {
  await updateCloudSyncStorage({ cursors });
}

/**
 * Get cloudSync.state
 * @returns {Promise<Object>}
 */
export async function getState() {
  const cloudSync = await getCloudSyncStorage();
  return cloudSync.state || {
    status: SYNC_STATE.NOT_CONFIGURED,
  };
}

/**
 * Set cloudSync.state
 * @param {Object} state
 * @returns {Promise<void>}
 */
export async function setState(state) {
  await updateCloudSyncStorage({ state });
}

/**
 * Get cloudSync.history
 * @returns {Promise<Array>}
 */
export async function getHistory() {
  const cloudSync = await getCloudSyncStorage();
  return cloudSync.history || [];
}

/**
 * Set cloudSync.history
 * @param {Array} history
 * @returns {Promise<void>}
 */
export async function setHistory(history) {
  await updateCloudSyncStorage({ history });
}

/**
 * Add entry to sync history (max 20 entries)
 * @param {Object} entry
 * @returns {Promise<void>}
 */
export async function addHistoryEntry(entry) {
  const history = await getHistory();
  history.unshift(entry);
  if (history.length > SYNC_CONFIG.MAX_HISTORY_ENTRIES) {
    history.length = SYNC_CONFIG.MAX_HISTORY_ENTRIES;
  }
  await setHistory(history);
}

/**
 * Get cloudSync.pending
 * @returns {Promise<Object>}
 */
export async function getPending() {
  const cloudSync = await getCloudSyncStorage();
  return cloudSync.pending || {};
}

/**
 * Set cloudSync.pending
 * @param {Object} pending
 * @returns {Promise<void>}
 */
export async function setPending(pending) {
  await updateCloudSyncStorage({ pending });
}

/**
 * Clear cloudSync.pending
 * @returns {Promise<void>}
 */
export async function clearPending() {
  await updateCloudSyncStorage({ pending: {} });
}
