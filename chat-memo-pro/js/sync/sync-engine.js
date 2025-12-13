/**
 * Sync Engine
 *
 * Core sync logic implementing two-way incremental sync with single-flight lock
 * Per specs/002-cloud-sync/contracts/sync-api.md
 *
 * This file implements all sync operations:
 * - Manual sync (syncNow)
 * - Auto sync (background scheduler integration)
 * - Download from cloud
 * - Upload to cloud
 * - Replace local with cloud
 * - Reset sync state
 * - Force full resync
 * - Retry failed items
 */

import { SYNC_CONFIG, SYNC_STATE, SYNC_ERROR_CODE } from './sync-config.js';
import {
  getSettings,
  getCursors,
  setCursors,
  getState,
  setState,
  addHistoryEntry,
  setHistory,
  getPending,
  setPending,
  clearPending,
} from './sync-config.js';
import * as SupabaseClient from './supabase-client.js';
import * as SyncStorage from './sync-storage.js';

// ============================================================================
// SYNC LOCK (Single-flight enforcement per FR-028)
// ============================================================================

let syncLock = false;

/**
 * Check if sync is currently running
 * @returns {boolean}
 */
export function isSyncRunning() {
  return syncLock;
}

/**
 * Acquire sync lock
 * @returns {boolean} True if lock acquired, false if already locked
 */
function acquireLock() {
  if (syncLock) {
    return false;
  }
  syncLock = true;
  return true;
}

/**
 * Release sync lock
 */
function releaseLock() {
  syncLock = false;
}

// ============================================================================
// MAIN SYNC OPERATIONS
// ============================================================================

/**
 * Sync now (two-way incremental sync)
 * @param {Object} options - { reason: 'manual'|'auto', onProgress?: Function }
 * @returns {Promise<Object>} SyncResult
 */
export async function syncNow(options = {}) {
  const { reason = 'manual', onProgress } = options;

  // Enforce single-flight lock
  if (!acquireLock()) {
    return {
      ok: false,
      direction: 'two-way',
      synced: 0,
      failed: 0,
      warnings: 0,
      errorCode: SYNC_ERROR_CODE.UNKNOWN,
      message: 'Sync already in progress',
    };
  }

  const startedAt = new Date().toISOString();
  let result;

  try {
    // Update state
    const syncingState = reason === 'manual' ? SYNC_STATE.SYNCING_MANUAL : SYNC_STATE.SYNCING_AUTO;
    await setState({ status: syncingState });

    // Step 1: Refresh token if needed
    await SupabaseClient.refreshToken();

    // Step 2: Upload local changes
    const uploadResult = await uploadToCloud({ onProgress });
    if (!uploadResult.ok) {
      const error = new Error(uploadResult.message || `Upload failed: ${uploadResult.errorCode}`);
      error.code = uploadResult.errorCode || SYNC_ERROR_CODE.UNKNOWN;
      throw error;
    }

    // Step 3: Download remote changes
    const downloadResult = await downloadFromCloud({ onProgress });
    if (!downloadResult.ok) {
      const error = new Error(downloadResult.message || `Download failed: ${downloadResult.errorCode}`);
      error.code = downloadResult.errorCode || SYNC_ERROR_CODE.UNKNOWN;
      throw error;
    }

    // Step 4: Clear pending state only if no failures remain
    const pending = await getPending();
    const hasFailed = Array.isArray(pending.failedItemKeys) && pending.failedItemKeys.length > 0;
    const hasTombstones = Array.isArray(pending.tombstones) && pending.tombstones.length > 0;
    if (!hasFailed && !hasTombstones) {
      await clearPending();
    }

    // Step 5: Update state to Connected (Idle)
    await setState({ status: SYNC_STATE.CONNECTED_IDLE });

    // Build result
    result = {
      ok: true,
      direction: 'two-way',
      synced: uploadResult.synced + downloadResult.synced,
      failed: uploadResult.failed + downloadResult.failed,
      warnings: uploadResult.warnings + downloadResult.warnings,
      startedAt,
      finishedAt: new Date().toISOString(),
    };

    // Record history
    await addHistoryEntry({
      id: generateHistoryId(),
      startedAt,
      finishedAt: result.finishedAt,
      type: reason,
      direction: 'two-way',
      status: result.failed > 0 ? 'partial' : 'success',
      synced: result.synced,
      failed: result.failed,
      warnings: result.warnings,
    });

    return result;
  } catch (error) {
    console.error('Sync: syncNow failed', error);

    // Map error to sync error code
    const errorCode = error.code || SYNC_ERROR_CODE.UNKNOWN;

    // Update state based on error
    await handleSyncError(errorCode);

    result = {
      ok: false,
      direction: 'two-way',
      synced: 0,
      failed: 1,
      warnings: 0,
      startedAt,
      finishedAt: new Date().toISOString(),
      errorCode,
      message: error.message,
    };

    // Record history
    await addHistoryEntry({
      id: generateHistoryId(),
      startedAt,
      finishedAt: result.finishedAt,
      type: reason,
      direction: 'two-way',
      status: 'failed',
      synced: 0,
      failed: 1,
      warnings: 0,
      errorCode,
      message: error.message,
    });

    return result;
  } finally {
    releaseLock();
  }
}

/**
 * Upload local changes to cloud
 * @param {Object} options - { onProgress?: Function }
 * @returns {Promise<Object>} SyncResult
 */
export async function uploadToCloud(options = {}) {
  const { onProgress } = options;

  try {
    const existingPending = await getPending();
    let tombstones = Array.isArray(existingPending.tombstones) ? existingPending.tombstones : [];

    // Get cursors
    const cursors = await getCursors();

    // Export local changes
    const changes = await SyncStorage.exportLocalChanges(cursors);
    let { conversations, messages } = changes;

    if (conversations.length === 0 && messages.length === 0 && tombstones.length === 0) {
      return {
        ok: true,
        direction: 'upload',
        synced: 0,
        failed: 0,
        warnings: 0,
        message: 'Already up to date - no changes to sync',
      };
    }

    let syncedConvs = 0;
    let syncedMsgs = 0;
    let failed = 0;
    const failedItemKeys = [];

    await setPending({
      ...existingPending,
      inProgress: true,
      direction: 'upload',
      lastProgress: null,
      failedItemKeys: [],
    });

    // Step 0: Upload tombstone deletes first (so deletes can sync even after local hard-delete)
    if (tombstones.length > 0) {
      const tombstoneRows = tombstones.map((t) => ({
        platform: t.platform,
        platform_conversation_id: t.platformConversationId,
        title: t.title || 'Untitled',
        created_at: t.createdAt || t.deletedAt,
        updated_at: t.deletedAt,
        synced_at: new Date().toISOString(),
        deleted_at: t.deletedAt,
        metadata: {
          link: t.link || '',
          schema_version: SYNC_CONFIG.SCHEMA_VERSION,
        },
      }));

      try {
        await SupabaseClient.upsertConversations(tombstoneRows);
        tombstones = [];
      } catch (error) {
        console.error('Sync: Failed to upload tombstone deletes', error);
        failed += tombstoneRows.length;
        for (const row of tombstoneRows) {
          failedItemKeys.push(`conv:${row.platform}|${row.platform_conversation_id}`);
        }
      }
    }

    // Merge any remaining tombstones into pending state early
    await setPending({
      ...existingPending,
      inProgress: true,
      direction: 'upload',
      lastProgress: null,
      failedItemKeys,
      tombstones,
    });

    // Upload conversations in batches
    for (let i = 0; i < conversations.length; i += SYNC_CONFIG.CONVERSATION_BATCH_SIZE) {
      const batch = conversations.slice(i, i + SYNC_CONFIG.CONVERSATION_BATCH_SIZE);

      if (onProgress) {
        const event = {
          phase: 'upload',
          scope: 'conversations',
          done: Math.min(i + batch.length, conversations.length),
          total: conversations.length,
          direction: 'upload',
        };
        onProgress(event);
        await setPending({
          ...existingPending,
          inProgress: true,
          direction: 'upload',
          lastProgress: event,
          failedItemKeys,
          tombstones,
        });
      }

      try {
        await SupabaseClient.upsertConversations(batch);
        syncedConvs += batch.length;
      } catch (error) {
        console.error('Sync: Failed to upload conversation batch', error);
        failed += batch.length;
        for (const row of batch) {
          failedItemKeys.push(`conv:${row.platform}|${row.platform_conversation_id}`);
        }
      }
    }

    // Upload messages in batches
    for (let i = 0; i < messages.length; i += SYNC_CONFIG.MESSAGE_BATCH_SIZE) {
      const batch = messages.slice(i, i + SYNC_CONFIG.MESSAGE_BATCH_SIZE);

      if (onProgress) {
        const event = {
          phase: 'upload',
          scope: 'messages',
          done: Math.min(i + batch.length, messages.length),
          total: messages.length,
          direction: 'upload',
        };
        onProgress(event);
        await setPending({
          ...existingPending,
          inProgress: true,
          direction: 'upload',
          lastProgress: event,
          failedItemKeys,
          tombstones,
        });
      }

      try {
        await SupabaseClient.upsertMessages(batch);
        syncedMsgs += batch.length;
      } catch (error) {
        console.error('Sync: Failed to upload message batch', error);
        failed += batch.length;
        for (const row of batch) {
          failedItemKeys.push(`msg:${row.message_key}`);
        }
      }
    }

    await setPending({
      ...existingPending,
      inProgress: false,
      direction: 'upload',
      lastProgress: null,
      failedItemKeys,
      tombstones,
    });

    return {
      ok: true,
      direction: 'upload',
      synced: syncedConvs + syncedMsgs,
      failed,
      warnings: 0,
    };
  } catch (error) {
    console.error('Sync: uploadToCloud failed', error);

    const pending = await getPending();
    await setPending({
      ...pending,
      inProgress: false,
      direction: 'upload',
      lastProgress: null,
      failedItemKeys: [],
    });

    return {
      ok: false,
      direction: 'upload',
      synced: 0,
      failed: 1,
      warnings: 0,
      errorCode: error.code || SYNC_ERROR_CODE.UNKNOWN,
      message: error.message,
    };
  }
}

/**
 * Download remote changes from cloud
 * @param {Object} options - { onProgress?: Function }
 * @returns {Promise<Object>} SyncResult
 */
export async function downloadFromCloud(options = {}) {
  const { onProgress } = options;

  try {
    // Get cursors
    const cursors = await getCursors();

    let allConversations = [];
    let allMessages = [];
    let hasMore = true;
    let lastUpdatedAt = cursors.conversationsUpdatedAt || null;

    // Fetch conversations
    while (hasMore) {
      const batch = await SupabaseClient.selectConversationsSince(lastUpdatedAt, SYNC_CONFIG.CONVERSATION_BATCH_SIZE);

      if (batch.length === 0) {
        hasMore = false;
      } else {
        allConversations.push(...batch);
        lastUpdatedAt = batch[batch.length - 1].updated_at;

        if (onProgress) {
          onProgress({
            phase: 'download',
            scope: 'conversations',
            done: allConversations.length,
            total: 0, // Unknown total
            direction: 'download',
          });
        }

        if (batch.length < SYNC_CONFIG.CONVERSATION_BATCH_SIZE) {
          hasMore = false;
        }
      }
    }

    // Fetch messages
    hasMore = true;
    lastUpdatedAt = cursors.messagesUpdatedAt || null;

    while (hasMore) {
      const batch = await SupabaseClient.selectMessagesSince(lastUpdatedAt, SYNC_CONFIG.MESSAGE_BATCH_SIZE);

      if (batch.length === 0) {
        hasMore = false;
      } else {
        allMessages.push(...batch);
        lastUpdatedAt = batch[batch.length - 1].updated_at;

        if (onProgress) {
          onProgress({
            phase: 'download',
            scope: 'messages',
            done: allMessages.length,
            total: 0, // Unknown total
            direction: 'download',
          });
        }

        if (batch.length < SYNC_CONFIG.MESSAGE_BATCH_SIZE) {
          hasMore = false;
        }
      }
    }

    // Merge into local storage
    const mergeResult = await SyncStorage.mergeFromCloud({
      conversations: allConversations,
      messages: allMessages,
    });

    // Update cursors
    if (allConversations.length > 0) {
      const latestConvUpdatedAt = allConversations[allConversations.length - 1].updated_at;
      cursors.conversationsUpdatedAt = latestConvUpdatedAt;
    }

    if (allMessages.length > 0) {
      const latestMsgUpdatedAt = allMessages[allMessages.length - 1].updated_at;
      cursors.messagesUpdatedAt = latestMsgUpdatedAt;
    }

    await setCursors(cursors);

    return {
      ok: true,
      direction: 'download',
      synced: mergeResult.merged,
      failed: 0,
      warnings: mergeResult.skippedInvalid + (mergeResult.conflicts || 0),
    };
  } catch (error) {
    console.error('Sync: downloadFromCloud failed', error);

    return {
      ok: false,
      direction: 'download',
      synced: 0,
      failed: 1,
      warnings: 0,
      errorCode: error.code || SYNC_ERROR_CODE.UNKNOWN,
      message: error.message,
    };
  }
}

/**
 * Replace local with cloud (destructive)
 * @returns {Promise<Object>} SyncResult
 */
export async function replaceLocalWithCloud(options = {}) {
  const { onProgress } = options;
  if (!acquireLock()) {
    return {
      ok: false,
      direction: 'download',
      synced: 0,
      failed: 0,
      warnings: 0,
      errorCode: SYNC_ERROR_CODE.UNKNOWN,
      message: 'Sync already in progress',
    };
  }

  const startedAt = new Date().toISOString();

  try {
    if (onProgress) {
      onProgress({ phase: 'download', scope: 'conversations', done: 0, total: 0, direction: 'download' });
    }

    // Fetch all conversations and messages from cloud
    const allConversations = [];
    const allMessages = [];
    let hasMore = true;
    let lastUpdatedAt = null;

    // Fetch all conversations
    while (hasMore) {
      const batch = await SupabaseClient.selectConversationsSince(lastUpdatedAt, SYNC_CONFIG.CONVERSATION_BATCH_SIZE);

      if (batch.length === 0) {
        hasMore = false;
      } else {
        allConversations.push(...batch);
        lastUpdatedAt = batch[batch.length - 1].updated_at;

        if (onProgress) {
          onProgress({ phase: 'download', scope: 'conversations', done: allConversations.length, total: 0, direction: 'download' });
        }

        if (batch.length < SYNC_CONFIG.CONVERSATION_BATCH_SIZE) {
          hasMore = false;
        }
      }
    }

    // Fetch all messages
    hasMore = true;
    lastUpdatedAt = null;

    while (hasMore) {
      const batch = await SupabaseClient.selectMessagesSince(lastUpdatedAt, SYNC_CONFIG.MESSAGE_BATCH_SIZE);

      if (batch.length === 0) {
        hasMore = false;
      } else {
        allMessages.push(...batch);
        lastUpdatedAt = batch[batch.length - 1].updated_at;

        if (onProgress) {
          onProgress({ phase: 'download', scope: 'messages', done: allMessages.length, total: 0, direction: 'download' });
        }

        if (batch.length < SYNC_CONFIG.MESSAGE_BATCH_SIZE) {
          hasMore = false;
        }
      }
    }

    // Replace local storage
    await SyncStorage.replaceLocalWithCloud({
      conversations: allConversations,
      messages: allMessages,
    });

    // Reset cursors
    await setCursors({});

    // Record history
    const result = {
      ok: true,
      direction: 'download',
      synced: allConversations.length,
      failed: 0,
      warnings: 0,
      startedAt,
      finishedAt: new Date().toISOString(),
    };

    await addHistoryEntry({
      id: generateHistoryId(),
      startedAt,
      finishedAt: result.finishedAt,
      type: 'manual',
      direction: 'download',
      status: 'success',
      synced: result.synced,
      failed: 0,
      warnings: 0,
      message: 'Replace local with cloud',
    });

    return result;
  } catch (error) {
    console.error('Sync: replaceLocalWithCloud failed', error);

    const errorCode = error.code || SYNC_ERROR_CODE.UNKNOWN;

    await addHistoryEntry({
      id: generateHistoryId(),
      startedAt,
      finishedAt: new Date().toISOString(),
      type: 'manual',
      direction: 'download',
      status: 'failed',
      synced: 0,
      failed: 1,
      warnings: 0,
      errorCode,
      message: error.message,
    });

    return {
      ok: false,
      direction: 'download',
      synced: 0,
      failed: 1,
      warnings: 0,
      errorCode,
      message: error.message,
    };
  } finally {
    releaseLock();
  }
}

/**
 * Reset sync state (clear cursors and history, keep auth/config)
 * @returns {Promise<void>}
 */
export async function resetSyncState() {
  await setCursors({});
  await clearPending();
  await setHistory([]);

  // Record history entry for this action
  await addHistoryEntry({
    id: generateHistoryId(),
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    type: 'manual',
    direction: 'two-way',
    status: 'success',
    synced: 0,
    failed: 0,
    warnings: 0,
    message: 'Reset sync state',
  });
}

/**
 * Force full re-sync (set cursors to epoch)
 * @returns {Promise<void>}
 */
export async function forceFullResync() {
  const epoch = '1970-01-01T00:00:00.000Z';

  await setCursors({
    conversationsUpdatedAt: epoch,
    messagesUpdatedAt: epoch,
  });

  await clearPending();

  // Record history entry
  await addHistoryEntry({
    id: generateHistoryId(),
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    type: 'manual',
    direction: 'two-way',
    status: 'success',
    synced: 0,
    failed: 0,
    warnings: 0,
    message: 'Force full re-sync',
  });
}

/**
 * Retry failed items from cloudSync.pending.failedItemKeys
 * @returns {Promise<Object>} SyncResult
 */
export async function retryFailed(options = {}) {
  const { onProgress } = options;

  if (!acquireLock()) {
    return {
      ok: false,
      direction: 'upload',
      synced: 0,
      failed: 0,
      warnings: 0,
      errorCode: SYNC_ERROR_CODE.UNKNOWN,
      message: 'Sync already in progress',
    };
  }

  const startedAt = new Date().toISOString();

  try {
    const pending = await getPending();
    const failedItemKeys = Array.isArray(pending.failedItemKeys) ? pending.failedItemKeys : [];

    if (failedItemKeys.length === 0) {
      return { ok: true, direction: 'upload', synced: 0, failed: 0, warnings: 0 };
    }

    await SupabaseClient.refreshToken();

    const items = await SyncStorage.exportLocalItemsByKeys(failedItemKeys);
    const stillFailed = [];
    let synced = 0;
    let failed = 0;

    // Retry conversations
    if (items.conversations.length > 0) {
      for (let i = 0; i < items.conversations.length; i += SYNC_CONFIG.CONVERSATION_BATCH_SIZE) {
        const batch = items.conversations.slice(i, i + SYNC_CONFIG.CONVERSATION_BATCH_SIZE);

        if (onProgress) {
          onProgress({
            phase: 'upload',
            scope: 'conversations',
            done: Math.min(i + batch.length, items.conversations.length),
            total: items.conversations.length,
            direction: 'upload',
          });
        }

        try {
          await SupabaseClient.upsertConversations(batch);
          synced += batch.length;
        } catch (error) {
          failed += batch.length;
          for (const row of batch) {
            stillFailed.push(`conv:${row.platform}|${row.platform_conversation_id}`);
          }
        }
      }
    }

    // Retry messages
    if (items.messages.length > 0) {
      for (let i = 0; i < items.messages.length; i += SYNC_CONFIG.MESSAGE_BATCH_SIZE) {
        const batch = items.messages.slice(i, i + SYNC_CONFIG.MESSAGE_BATCH_SIZE);

        if (onProgress) {
          onProgress({
            phase: 'upload',
            scope: 'messages',
            done: Math.min(i + batch.length, items.messages.length),
            total: items.messages.length,
            direction: 'upload',
          });
        }

        try {
          await SupabaseClient.upsertMessages(batch);
          synced += batch.length;
        } catch (error) {
          failed += batch.length;
          for (const row of batch) {
            stillFailed.push(`msg:${row.message_key}`);
          }
        }
      }
    }

    const latestPending = await getPending();
    await setPending({
      ...latestPending,
      inProgress: false,
      direction: 'upload',
      lastProgress: null,
      failedItemKeys: stillFailed,
    });

    if (stillFailed.length === 0) {
      await clearPending();
    }

    const result = {
      ok: failed === 0,
      direction: 'upload',
      synced,
      failed,
      warnings: 0,
      startedAt,
      finishedAt: new Date().toISOString(),
    };

    await addHistoryEntry({
      id: generateHistoryId(),
      startedAt,
      finishedAt: result.finishedAt,
      type: 'manual',
      direction: 'upload',
      status: failed > 0 ? 'partial' : 'success',
      synced: result.synced,
      failed: result.failed,
      warnings: 0,
      message: 'Retry failed items',
    });

    return result;
  } catch (error) {
    const errorCode = error.code || SYNC_ERROR_CODE.UNKNOWN;
    await handleSyncError(errorCode);

    await addHistoryEntry({
      id: generateHistoryId(),
      startedAt,
      finishedAt: new Date().toISOString(),
      type: 'manual',
      direction: 'upload',
      status: 'failed',
      synced: 0,
      failed: 1,
      warnings: 0,
      errorCode,
      message: error.message,
    });

    return {
      ok: false,
      direction: 'upload',
      synced: 0,
      failed: 1,
      warnings: 0,
      errorCode,
      message: error.message,
    };
  } finally {
    releaseLock();
  }
}

/**
 * Restore deleted conversations in cloud (clear deleted_at) and re-download data.
 * @returns {Promise<Object>} SyncResult
 */
export async function restoreDeletedFromCloud(options = {}) {
  const { onProgress } = options;

  if (!acquireLock()) {
    return {
      ok: false,
      direction: 'download',
      synced: 0,
      failed: 0,
      warnings: 0,
      errorCode: SYNC_ERROR_CODE.UNKNOWN,
      message: 'Sync already in progress',
    };
  }

  const startedAt = new Date().toISOString();

  try {
    await setState({ status: SYNC_STATE.SYNCING_MANUAL });
    await SupabaseClient.refreshToken();

    await SupabaseClient.restoreDeletedConversations();

    // Force a full re-download so restored conversations include messages
    const epoch = '1970-01-01T00:00:00.000Z';
    await setCursors({
      conversationsUpdatedAt: epoch,
      messagesUpdatedAt: epoch,
    });

    const downloadResult = await downloadFromCloud({ onProgress });
    if (!downloadResult.ok) {
      const error = new Error(downloadResult.message || `Download failed: ${downloadResult.errorCode}`);
      error.code = downloadResult.errorCode || SYNC_ERROR_CODE.UNKNOWN;
      throw error;
    }

    await setState({ status: SYNC_STATE.CONNECTED_IDLE });

    const result = {
      ok: true,
      direction: 'download',
      synced: downloadResult.synced,
      failed: downloadResult.failed,
      warnings: downloadResult.warnings,
      startedAt,
      finishedAt: new Date().toISOString(),
    };

    await addHistoryEntry({
      id: generateHistoryId(),
      startedAt,
      finishedAt: result.finishedAt,
      type: 'manual',
      direction: 'download',
      status: 'success',
      synced: result.synced,
      failed: result.failed,
      warnings: result.warnings,
      message: 'Restore deleted conversations',
    });

    return result;
  } catch (error) {
    const errorCode = error.code || SYNC_ERROR_CODE.UNKNOWN;
    await handleSyncError(errorCode);

    await addHistoryEntry({
      id: generateHistoryId(),
      startedAt,
      finishedAt: new Date().toISOString(),
      type: 'manual',
      direction: 'download',
      status: 'failed',
      synced: 0,
      failed: 1,
      warnings: 0,
      errorCode,
      message: error.message,
    });

    return {
      ok: false,
      direction: 'download',
      synced: 0,
      failed: 1,
      warnings: 0,
      errorCode,
      message: error.message,
    };
  } finally {
    releaseLock();
  }
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Handle sync error and update state accordingly
 * @param {string} errorCode
 * @returns {Promise<void>}
 */
async function handleSyncError(errorCode) {
  switch (errorCode) {
    case SYNC_ERROR_CODE.AUTH_REQUIRED:
      await setState({
        status: SYNC_STATE.PAUSED_AUTH_REQUIRED,
        pausedReason: 'Session expired — please sign in again',
        lastErrorCode: errorCode,
        lastErrorAt: new Date().toISOString(),
      });
      break;

    case SYNC_ERROR_CODE.CLOUD_LIMIT:
      await setState({
        status: SYNC_STATE.PAUSED_CLOUD_LIMIT,
        pausedReason: 'Auto-sync paused — cloud limit reached',
        lastErrorCode: errorCode,
        lastErrorAt: new Date().toISOString(),
      });
      break;

    case SYNC_ERROR_CODE.LOCAL_QUOTA_EXCEEDED:
      await setState({
        status: SYNC_STATE.PAUSED_LOCAL_QUOTA,
        pausedReason: 'Sync paused — local storage is full',
        lastErrorCode: errorCode,
        lastErrorAt: new Date().toISOString(),
      });
      break;

    case SYNC_ERROR_CODE.SCHEMA_MISMATCH:
      await setState({
        status: SYNC_STATE.PAUSED_SCHEMA_MISMATCH,
        pausedReason: 'Sync paused — cloud schema version mismatch',
        lastErrorCode: errorCode,
        lastErrorAt: new Date().toISOString(),
      });
      break;

    default:
      await setState({
        status: SYNC_STATE.ERROR,
        pausedReason: 'Sync failed — see error details',
        lastErrorCode: errorCode,
        lastErrorAt: new Date().toISOString(),
      });
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate a unique history entry ID
 * @returns {string}
 */
function generateHistoryId() {
  return `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
