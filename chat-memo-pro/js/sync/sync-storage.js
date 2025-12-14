/**
 * Sync Storage
 *
 * Maps local IndexedDB conversations ↔ cloud (conversations + messages) rows.
 * Keeps the extension's existing local data model intact:
 * - Conversation: { conversationId, platform, title, link, createdAt, updatedAt, externalId?, messages: [] }
 * - Message: { sender: 'user'|'AI', content, timestamp, thinking?, id? }
 *
 * Cloud identity is stable across devices:
 * - Conversation identity: (platform, platform_conversation_id)
 * - Message identity: message_key (see generateMessageKey)
 */

import { SYNC_CONFIG, SYNC_ERROR_CODE } from './sync-config.js';

// ============================================================================
// INDEXEDDB HELPERS
// ============================================================================

const DB_NAME = 'KeepAIMemoryDB';
const DB_VERSION = 1;
const CONVERSATION_STORE = 'conversations';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function mapIdbError(error) {
  if (error && error.name === 'QuotaExceededError') {
    const quotaError = new Error('Local storage full');
    quotaError.code = SYNC_ERROR_CODE.LOCAL_QUOTA_EXCEEDED;
    return quotaError;
  }
  return error;
}

async function withStore(mode, fn) {
  const db = await openDB();

  return await new Promise((resolve, reject) => {
    const transaction = db.transaction([CONVERSATION_STORE], mode);
    const store = transaction.objectStore(CONVERSATION_STORE);
    let result;

    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(mapIdbError(transaction.error || new Error('Transaction aborted')));
    transaction.onerror = () => reject(mapIdbError(transaction.error || new Error('Transaction error')));

    Promise.resolve()
      .then(() => fn(store, transaction))
      .then((r) => {
        result = r;
      })
      .catch((error) => {
        try {
          transaction.abort();
        } catch {
          // ignore
        }
        reject(mapIdbError(error));
      });
  });
}

async function getAllLocalConversations() {
  return await withStore('readonly', (store) => requestToPromise(store.getAll()));
}

async function putLocalConversations(conversations) {
  return await withStore('readwrite', async (store) => {
    for (const conv of conversations) {
      await requestToPromise(store.put(conv));
    }
  });
}

async function clearLocalConversations() {
  return await withStore('readwrite', (store) => requestToPromise(store.clear()));
}

// ============================================================================
// STABLE IDs (per specs/002-cloud-sync/spec.md)
// ============================================================================

function getStablePlatformConversationId(localConv) {
  return localConv.syncConversationId || localConv.externalId || localConv.link || localConv.conversationId;
}

function generateLocalConversationId() {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeContentText(contentText) {
  if (!contentText) return '';

  let text = String(contentText);
  text = text.normalize('NFKC');
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  text = text.replace(/[ \t]+(?=\n)/g, '');
  text = text.replace(/[ \t]+$/, '');
  return text;
}

async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function generateMessageKey(platform, platformConversationId, messageIndex, role, contentText, platformMessageId = null) {
  const baseKey = `${platform}|${platformConversationId}|${messageIndex}`;

  if (platformMessageId) {
    return `${baseKey}|${platformMessageId}`;
  }

  const normalized = normalizeContentText(contentText);
  const hash = await sha256(`${role}\n${normalized}`);
  return `${baseKey}|${hash}`;
}

function senderToRole(sender) {
  const s = String(sender || '').toLowerCase();
  return s === 'user' ? 'user' : 'assistant';
}

function roleToSender(role) {
  return role === 'user' ? 'user' : 'AI';
}

function getLocalMessageTime(localMsg, fallbackIso) {
  const time = localMsg.updatedAt || localMsg.timestamp || localMsg.createdAt || fallbackIso;
  // Convert Unix timestamp in milliseconds to ISO string
  if (typeof time === 'number') {
    return new Date(time).toISOString();
  }
  // If it's a string that looks like a Unix timestamp in milliseconds
  if (typeof time === 'string' && /^\d{13,}$/.test(time)) {
    return new Date(parseInt(time, 10)).toISOString();
  }
  return time;
}

function getCloudMessageTime(cloudMsg) {
  return cloudMsg.updated_at || cloudMsg.created_at || new Date().toISOString();
}

function isNewerIso(a, b) {
  try {
    return new Date(a) > new Date(b);
  } catch {
    return false;
  }
}

function extractMessageIndexFromKey(messageKey) {
  const parts = String(messageKey || '').split('|');
  const idx = parseInt(parts[2], 10);
  return Number.isFinite(idx) ? idx : 0;
}

// ============================================================================
// PUBLIC API
// ============================================================================

export async function getLocalCounts() {
  const conversations = await getAllLocalConversations();
  const messages = conversations.reduce((sum, conv) => sum + (conv.messages ? conv.messages.length : 0), 0);
  return { conversations: conversations.length, messages };
}

export async function exportLocalChanges(cursors = {}) {
  const { conversationsUpdatedAt, messagesUpdatedAt } = cursors;
  const allConversations = await getAllLocalConversations();

  const exportedConversations = [];
  const exportedMessages = [];

  for (const conv of allConversations) {
    const convUpdatedAt = conv.updatedAt || conv.createdAt;
    const convChanged = !conversationsUpdatedAt || isNewerIso(convUpdatedAt, conversationsUpdatedAt);

    if (convChanged || conv.deletedAt) {
      exportedConversations.push(await mapLocalConversationToCloud(conv));
    }

    const stableConvId = getStablePlatformConversationId(conv);
    const platform = conv.platform || 'unknown';

    if (Array.isArray(conv.messages)) {
      for (let i = 0; i < conv.messages.length; i++) {
        const msg = conv.messages[i];
        const msgTime = getLocalMessageTime(msg, convUpdatedAt);
        const msgChanged = !messagesUpdatedAt || isNewerIso(msgTime, messagesUpdatedAt);

        if (msgChanged || msg.deletedAt) {
          exportedMessages.push(await mapLocalMessageToCloud(platform, stableConvId, conv, msg, i));
        }
      }
    }
  }

  return { conversations: exportedConversations, messages: exportedMessages };
}

/**
 * Export specific items for retry based on pending.failedItemKeys.
 * Keys:
 * - `conv:${platform}|${platform_conversation_id}`
 * - `msg:${message_key}`
 * @param {Array<string>} failedItemKeys
 * @returns {Promise<Object>} { conversations: Array, messages: Array }
 */
export async function exportLocalItemsByKeys(failedItemKeys = []) {
  const keySet = new Set(Array.isArray(failedItemKeys) ? failedItemKeys : []);
  const allConversations = await getAllLocalConversations();

  const conversations = [];
  const messages = [];

  for (const conv of allConversations) {
    const platform = conv.platform || 'unknown';
    const stableConvId = getStablePlatformConversationId(conv);

    const convKey = `conv:${platform}|${stableConvId}`;
    if (keySet.has(convKey)) {
      conversations.push(await mapLocalConversationToCloud(conv));
    }

    if (!Array.isArray(conv.messages)) continue;

    for (let i = 0; i < conv.messages.length; i++) {
      const msg = conv.messages[i];
      const sender = msg.sender || roleToSender(msg.role);
      const role = senderToRole(sender);
      const contentText = msg.content || '';
      const platformMessageId = msg.id || null;

      const messageKey = msg.syncKey || msg.messageKey || await generateMessageKey(
        platform,
        stableConvId,
        i,
        role,
        contentText,
        platformMessageId
      );

      const msgKey = `msg:${messageKey}`;
      if (keySet.has(msgKey)) {
        messages.push(await mapLocalMessageToCloud(platform, stableConvId, conv, msg, i));
      }
    }
  }

  return { conversations, messages };
}

export async function mergeFromCloud(payload) {
  const { conversations = [], messages = [] } = payload || {};
  let merged = 0;
  let skippedInvalid = 0;
  let conflicts = 0;

  // Group cloud messages by (platform, platform_conversation_id)
  const messagesByConversationKey = new Map();
  for (const msg of messages) {
    if (!msg?.platform || !msg?.platform_conversation_id) {
      skippedInvalid++;
      continue;
    }
    const key = `${msg.platform}|${msg.platform_conversation_id}`;
    if (!messagesByConversationKey.has(key)) messagesByConversationKey.set(key, []);
    messagesByConversationKey.get(key).push(msg);
  }

  // Index local conversations by stable cloud identity
  const localConversations = await getAllLocalConversations();
  const localByKey = new Map(); // key -> conversation object

  for (const conv of localConversations) {
    if (!conv) continue;
    const platform = conv.platform || 'unknown';
    const stableId = getStablePlatformConversationId(conv);
    if (!stableId) continue;
    localByKey.set(`${platform}|${stableId}`, conv);
  }

  const toUpsert = [];

  for (const cloudConv of conversations) {
    if (!cloudConv?.platform || !cloudConv?.platform_conversation_id) {
      skippedInvalid++;
      continue;
    }

    const key = `${cloudConv.platform}|${cloudConv.platform_conversation_id}`;
    const cloudMessages = messagesByConversationKey.get(key) || [];

    try {
      const existing = localByKey.get(key);
      const result = await mergeConversation(existing, cloudConv, cloudMessages);
      toUpsert.push(result.conversation);
      conflicts += result.conflicts;
      merged++;
    } catch (error) {
      console.warn('Sync: Failed to merge conversation', key, error);
      skippedInvalid++;
    }
  }

  if (toUpsert.length > 0) {
    await putLocalConversations(toUpsert);
  }

  return { merged, skippedInvalid, conflicts };
}

export async function replaceLocalWithCloud(payload) {
  await clearLocalConversations();
  await mergeFromCloud(payload);
}

export async function applyTombstones(payload) {
  const { conversations = [], messages = [] } = payload || {};
  const localConversations = await getAllLocalConversations();

  const localByKey = new Map();
  for (const conv of localConversations) {
    const platform = conv.platform || 'unknown';
    const stableId = getStablePlatformConversationId(conv);
    if (!stableId) continue;
    localByKey.set(`${platform}|${stableId}`, conv);
  }

  let changed = false;

  for (const cloudConv of conversations) {
    if (!cloudConv?.platform || !cloudConv?.platform_conversation_id) continue;
    if (!cloudConv.deleted_at) continue;

    const key = `${cloudConv.platform}|${cloudConv.platform_conversation_id}`;
    const localConv = localByKey.get(key);
    if (!localConv) continue;

    if (!localConv.deletedAt || isNewerIso(cloudConv.deleted_at, localConv.deletedAt)) {
      localConv.deletedAt = cloudConv.deleted_at;
      localConv.syncConversationId = cloudConv.platform_conversation_id;
      changed = true;
    }
  }

  if (messages.length > 0) {
    const messagesByKey = new Map();
    for (const cloudMsg of messages) {
      if (!cloudMsg?.platform || !cloudMsg?.platform_conversation_id) continue;
      const key = `${cloudMsg.platform}|${cloudMsg.platform_conversation_id}`;
      if (!messagesByKey.has(key)) messagesByKey.set(key, []);
      messagesByKey.get(key).push(cloudMsg);
    }

    for (const [key, cloudMsgs] of messagesByKey.entries()) {
      const localConv = localByKey.get(key);
      if (!localConv || !Array.isArray(localConv.messages)) continue;

      // Apply message tombstones by message_key if present, otherwise by index.
      const localMsgs = localConv.messages;
      const localByMsgKey = new Map();
      for (let i = 0; i < localMsgs.length; i++) {
        const msg = localMsgs[i];
        const idx = typeof msg.index === 'number' ? msg.index : i;
        const stableConvId = getStablePlatformConversationId(localConv);
        const role = senderToRole(msg.sender);
        const localKey = msg.syncKey || msg.messageKey || await generateMessageKey(localConv.platform || 'unknown', stableConvId, idx, role, msg.content || '', msg.id || null);
        localByMsgKey.set(localKey, { msg, idx });
      }

      for (const cloudMsg of cloudMsgs) {
        if (!cloudMsg?.deleted_at) continue;
        const cloudKey = cloudMsg.message_key;

        if (cloudKey && localByMsgKey.has(cloudKey)) {
          const { msg } = localByMsgKey.get(cloudKey);
          msg.deletedAt = cloudMsg.deleted_at;
          msg.syncKey = cloudKey;
          changed = true;
          continue;
        }

        // Fallback by index
        const idx = cloudMsg.message_index;
        const localIndex = localMsgs.findIndex((m, i) => (typeof m.index === 'number' ? m.index : i) === idx);
        if (localIndex !== -1) {
          localMsgs[localIndex].deletedAt = cloudMsg.deleted_at;
          changed = true;
        }
      }
    }
  }

  if (changed) {
    await putLocalConversations(localConversations);
  }
}

// ============================================================================
// MAPPING HELPERS
// ============================================================================

async function mapLocalConversationToCloud(localConv) {
  const platform = localConv.platform || 'unknown';
  const stableId = getStablePlatformConversationId(localConv);

  return {
    platform,
    platform_conversation_id: stableId,
    title: localConv.title || 'Untitled',
    created_at: localConv.createdAt,
    updated_at: localConv.updatedAt || localConv.createdAt,
    synced_at: new Date().toISOString(),
    deleted_at: localConv.deletedAt || null,
    metadata: {
      link: localConv.link,
      source_url: localConv.link,
      local_conversation_id: localConv.conversationId,
      external_id: localConv.externalId || null,
      schema_version: SYNC_CONFIG.SCHEMA_VERSION,
      extractor_version: chrome.runtime.getManifest().version,
    },
  };
}

async function mapLocalMessageToCloud(platform, stableConvId, localConv, localMsg, messageIndex) {
  const sender = localMsg.sender || roleToSender(localMsg.role);
  const role = senderToRole(sender);
  const contentText = localMsg.content || '';
  const platformMessageId = localMsg.id || null;

  const messageKey = localMsg.syncKey || localMsg.messageKey || await generateMessageKey(
    platform,
    stableConvId,
    messageIndex,
    role,
    contentText,
    platformMessageId
  );

  return {
    platform,
    platform_conversation_id: stableConvId,
    message_key: messageKey,
    message_index: messageIndex,
    role,
    content_text: contentText,
    created_at: getLocalMessageTime(localMsg, localConv.createdAt),
    updated_at: getLocalMessageTime(localMsg, localConv.updatedAt || localConv.createdAt),
    deleted_at: localMsg.deletedAt || null,
    metadata: {
      platform_message_id: platformMessageId,
      sender,
      thinking: localMsg.thinking || null,
      schema_version: SYNC_CONFIG.SCHEMA_VERSION,
    },
  };
}

function mapCloudConversationToLocal(cloudConv) {
  const conversationId = generateLocalConversationId();

  return {
    conversationId,
    platform: cloudConv.platform,
    title: cloudConv.title || 'Untitled',
    link: cloudConv.metadata?.link || cloudConv.metadata?.source_url || '',
    createdAt: cloudConv.created_at,
    updatedAt: cloudConv.updated_at,
    deletedAt: cloudConv.deleted_at || undefined,
    externalId: cloudConv.platform_conversation_id,
    syncConversationId: cloudConv.platform_conversation_id,
    messages: [],
  };
}

function mapCloudMessageToLocal(cloudMsg) {
  const sender = cloudMsg.metadata?.sender || roleToSender(cloudMsg.role);

  const localMsg = {
    sender,
    content: cloudMsg.content_text || '',
    timestamp: cloudMsg.created_at || cloudMsg.updated_at,
    thinking: cloudMsg.metadata?.thinking || undefined,
    id: cloudMsg.metadata?.platform_message_id || null,
    index: cloudMsg.message_index,
    deletedAt: cloudMsg.deleted_at || undefined,
    syncKey: cloudMsg.message_key,
  };

  // Keep the extension's existing message shape (no undefined fields if possible)
  if (!localMsg.thinking) delete localMsg.thinking;
  if (!localMsg.id) delete localMsg.id;
  if (!localMsg.deletedAt) delete localMsg.deletedAt;
  if (!localMsg.syncKey) delete localMsg.syncKey;

  return localMsg;
}

// ============================================================================
// MERGE HELPERS
// ============================================================================

async function mergeConversation(existingLocalConv, cloudConv, cloudMessages) {
  let localConv = existingLocalConv;
  let conflicts = 0;

  if (!localConv) {
    localConv = mapCloudConversationToLocal(cloudConv);
  } else {
    // Ensure stable cloud id is persisted locally for future matching
    localConv.syncConversationId = cloudConv.platform_conversation_id;
    if (!localConv.externalId) {
      localConv.externalId = cloudConv.platform_conversation_id;
    }

    // Merge metadata (LWW based on conversation updated_at)
    const cloudUpdatedAt = cloudConv.updated_at;
    const localUpdatedAt = localConv.updatedAt || localConv.createdAt;

    if (cloudUpdatedAt && (!localUpdatedAt || isNewerIso(cloudUpdatedAt, localUpdatedAt))) {
      localConv.title = cloudConv.title || localConv.title;
      localConv.updatedAt = cloudUpdatedAt;
      if (!localConv.link) {
        localConv.link = cloudConv.metadata?.link || cloudConv.metadata?.source_url || localConv.link || '';
      }
    }

    if (cloudConv.deleted_at) {
      if (!localConv.deletedAt || isNewerIso(cloudConv.deleted_at, localConv.deletedAt)) {
        localConv.deletedAt = cloudConv.deleted_at;
      }
    }
  }

  const stableConvId = cloudConv.platform_conversation_id;
  const mergedMessagesResult = await mergeMessages(localConv.platform || 'unknown', stableConvId, localConv.messages || [], cloudMessages || []);
  localConv.messages = mergedMessagesResult.messages;
  conflicts += mergedMessagesResult.conflicts;

  // Keep updatedAt in sync with latest message timestamp if local has none
  if (!localConv.updatedAt && Array.isArray(localConv.messages) && localConv.messages.length > 0) {
    const last = localConv.messages[localConv.messages.length - 1];
    localConv.updatedAt = last.timestamp || localConv.createdAt;
  }

  return { conversation: localConv, conflicts };
}

async function mergeMessages(platform, stableConvId, localMessages, cloudMessages) {
  let conflicts = 0;

  // Cloud messages by key
  const cloudByKey = new Map();
  for (const cloudMsg of cloudMessages) {
    if (!cloudMsg?.message_key) continue;
    cloudByKey.set(cloudMsg.message_key, cloudMsg);
  }

  // Local messages by computed key
  const localByKey = new Map();
  for (let i = 0; i < localMessages.length; i++) {
    const msg = localMessages[i];
    const idx = typeof msg.index === 'number' ? msg.index : i;
    const sender = msg.sender || roleToSender(msg.role);
    const role = senderToRole(sender);
    const contentText = msg.content || '';
    const platformMessageId = msg.id || null;

    const key = msg.syncKey || msg.messageKey || await generateMessageKey(platform, stableConvId, idx, role, contentText, platformMessageId);
    msg.syncKey = key;
    msg.index = idx;
    localByKey.set(key, msg);
  }

  const allKeys = new Set([...cloudByKey.keys(), ...localByKey.keys()]);
  const merged = [];

  for (const key of allKeys) {
    const cloudMsg = cloudByKey.get(key);
    const localMsg = localByKey.get(key);

    if (cloudMsg && localMsg) {
      const cloudTime = getCloudMessageTime(cloudMsg);
      const localTime = getLocalMessageTime(localMsg, cloudTime);

      const cloudNorm = normalizeContentText(cloudMsg.content_text || '');
      const localNorm = normalizeContentText(localMsg.content || '');

      if (cloudNorm !== localNorm) {
        conflicts++;
      }

      const localIsNewer = cloudTime && localTime ? isNewerIso(localTime, cloudTime) : false;
      const pickCloud = !localIsNewer;

      if (pickCloud) {
        merged.push(mapCloudMessageToLocal(cloudMsg));
      } else {
        // Ensure local message has the same stable key stored
        localMsg.syncKey = key;
        merged.push(sanitizeLocalMessage(localMsg));
      }

      continue;
    }

    if (cloudMsg) {
      merged.push(mapCloudMessageToLocal(cloudMsg));
      continue;
    }

    if (localMsg) {
      localMsg.syncKey = key;
      merged.push(sanitizeLocalMessage(localMsg));
    }
  }

  merged.sort((a, b) => {
    const ai = typeof a.index === 'number' ? a.index : extractMessageIndexFromKey(a.syncKey || '');
    const bi = typeof b.index === 'number' ? b.index : extractMessageIndexFromKey(b.syncKey || '');
    return ai - bi;
  });

  return { messages: merged, conflicts };
}

function sanitizeLocalMessage(localMsg) {
  const sender = localMsg.sender || roleToSender(localMsg.role);
  const msg = {
    sender,
    content: localMsg.content || '',
    timestamp: localMsg.timestamp || localMsg.createdAt || new Date().toISOString(),
    thinking: localMsg.thinking || undefined,
    id: localMsg.id || null,
    index: typeof localMsg.index === 'number' ? localMsg.index : 0,
    deletedAt: localMsg.deletedAt || undefined,
    syncKey: localMsg.syncKey || undefined,
  };

  if (!msg.thinking) delete msg.thinking;
  if (!msg.id) delete msg.id;
  if (!msg.deletedAt) delete msg.deletedAt;
  if (!msg.syncKey) delete msg.syncKey;

  return msg;
}
