/**
 * Sync UI Controller
 *
 * Manages the Cloud Sync Settings modal and status display
 * Per specs/002-cloud-sync/contracts/ui-contract.md
 *
 * This controller handles:
 * - Modal open/close
 * - Configuration input validation
 * - Copy SQL button
 * - Sign in/out flows
 * - Test connection
 * - Sync actions (manual, download, replace local, etc.)
 * - Status panel rendering
 * - Sync history rendering
 * - Auto-sync controls
 * - Progress indicator updates
 */

import { SYNC_CONFIG, SYNC_STATE, TEST_ERROR_CODE, SYNC_ERROR_CODE } from './sync-config.js';
import {
  getConfig,
  setConfig,
  getAuth,
  getSettings,
  setSettings,
  getState,
  getCursors,
  getHistory,
  getPending,
} from './sync-config.js';
import { SUPABASE_SCHEMA_SQL } from './schema-sql.js';
import * as SyncStorage from './sync-storage.js';

// ============================================================================
// STATE
// ============================================================================

let progressPort = null; // chrome.runtime.Port for progress updates

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the sync UI controller
 * Called from popup.js when the popup loads
 */
export async function initialize() {
  // Set up event listeners
  setupEventListeners();

  // Populate fields on load (page-based UI)
  await populateFieldsFromStorage();

  // Render current state
  await renderSyncStatus();
  await renderSyncHistory();

  // Set up progress listener
  setupProgressListener();
}

async function populateFieldsFromStorage() {
  const config = await getConfig();
  const settings = await getSettings();
  const state = await getState();
  const auth = await getAuth();
  const signedIn = isSignedInState(state, auth);

  const projectUrlInput = document.getElementById('project-url-input');
  const anonKeyInput = document.getElementById('anon-key-input');
  const emailInput = document.getElementById('email-input');
  const autoSyncToggle = document.getElementById('auto-sync-toggle');
  const syncIntervalSelect = document.getElementById('sync-interval-select');
  const verboseLoggingToggle = document.getElementById('verbose-logging-toggle');
  const preventCloudDeletionToggle = document.getElementById('prevent-cloud-deletion-toggle');

  if (projectUrlInput) projectUrlInput.value = config.projectUrl || '';
  if (anonKeyInput) anonKeyInput.value = config.anonKey || '';
  if (emailInput) emailInput.value = config.email || '';
  if (autoSyncToggle) autoSyncToggle.checked = !!(settings.autoSyncEnabled && signedIn);
  if (syncIntervalSelect) syncIntervalSelect.value = settings.syncIntervalMinutes || SYNC_CONFIG.DEFAULT_SYNC_INTERVAL_MINUTES;
  if (verboseLoggingToggle) verboseLoggingToggle.checked = settings.verboseLogging || false;
  if (preventCloudDeletionToggle) preventCloudDeletionToggle.checked = settings.preventCloudDeletion || false;

  await updateAuthUI(state, auth);
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
  // Copy SQL button
  const copySqlBtn = document.getElementById('copy-sql-btn');
  if (copySqlBtn) {
    copySqlBtn.addEventListener('click', handleCopySql);
  }

  // Test connection button
  const testConnectionBtn = document.getElementById('test-connection-btn');
  if (testConnectionBtn) {
    testConnectionBtn.addEventListener('click', handleTestConnection);
  }

  // Sign in/out buttons
  const signInBtn = document.getElementById('sign-in-btn');
  if (signInBtn) {
    signInBtn.addEventListener('click', handleSignIn);
  }

  const signOutBtn = document.getElementById('sign-out-btn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', handleSignOut);
  }

  // Save configuration button
  const saveConfigBtn = document.getElementById('save-config-btn');
  if (saveConfigBtn) {
    saveConfigBtn.addEventListener('click', handleSaveConfig);
  }

  // Sync actions
  const syncNowBtn = document.getElementById('sync-now-btn');
  if (syncNowBtn) {
    syncNowBtn.addEventListener('click', handleSyncNow);
  }

  const downloadBtn = document.getElementById('download-from-cloud-btn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', handleDownloadFromCloud);
  }

  const replaceLocalBtn = document.getElementById('replace-local-btn');
  if (replaceLocalBtn) {
    replaceLocalBtn.addEventListener('click', handleReplaceLocalWithCloud);
  }

  const resetSyncBtn = document.getElementById('reset-sync-btn');
  if (resetSyncBtn) {
    resetSyncBtn.addEventListener('click', handleResetSyncState);
  }

  const forceResyncBtn = document.getElementById('force-resync-btn');
  if (forceResyncBtn) {
    forceResyncBtn.addEventListener('click', handleForceFullResync);
  }

  const retryFailedBtn = document.getElementById('retry-failed-btn');
  if (retryFailedBtn) {
    retryFailedBtn.addEventListener('click', handleRetryFailed);
  }

  const restoreDeletedBtn = document.getElementById('restore-deleted-btn');
  if (restoreDeletedBtn) {
    restoreDeletedBtn.addEventListener('click', handleRestoreDeletedFromCloud);
  }

  // Auto-sync toggle
  const autoSyncToggle = document.getElementById('auto-sync-toggle');
  if (autoSyncToggle) {
    autoSyncToggle.addEventListener('change', handleAutoSyncToggle);
  }

  // Sync interval selector
  const syncIntervalSelect = document.getElementById('sync-interval-select');
  if (syncIntervalSelect) {
    syncIntervalSelect.addEventListener('change', handleSyncIntervalChange);
  }

  // Verbose logging toggle
  const verboseLoggingToggle = document.getElementById('verbose-logging-toggle');
  if (verboseLoggingToggle) {
    verboseLoggingToggle.addEventListener('change', handleVerboseLoggingToggle);
  }

  // Prevent cloud deletion toggle
  const preventCloudDeletionToggle = document.getElementById('prevent-cloud-deletion-toggle');
  if (preventCloudDeletionToggle) {
    preventCloudDeletionToggle.addEventListener('change', handlePreventCloudDeletionToggle);
  }
}

function isSignedInState(state, auth) {
  if (!auth || !auth.accessToken || !auth.refreshToken) return false;
  if (state && state.status === SYNC_STATE.PAUSED_AUTH_REQUIRED) return false;
  return true;
}

async function updateAuthUI(state, auth) {
  const signInSection = document.getElementById('sign-in-section');
  const signOutSection = document.getElementById('sign-out-section');
  const syncActionsSection = document.getElementById('sync-actions-section');
  const signedInEmailEl = document.getElementById('signed-in-email');

  const isSignedIn = isSignedInState(state, auth);

  if (signInSection) {
    signInSection.classList.toggle('hidden', isSignedIn);
  }

  if (signOutSection) {
    signOutSection.classList.toggle('hidden', !isSignedIn);
  }

  if (syncActionsSection) {
    syncActionsSection.classList.toggle('hidden', !isSignedIn);
  }

  if (signedInEmailEl) {
    if (isSignedIn) {
      const config = await getConfig();
      signedInEmailEl.textContent = config.email || '—';
    } else {
      signedInEmailEl.textContent = '';
    }
  }

  // Disable auto-sync related controls until signed in
  const autoSyncToggle = document.getElementById('auto-sync-toggle');
  const syncIntervalSelect = document.getElementById('sync-interval-select');
  const verboseLoggingToggle = document.getElementById('verbose-logging-toggle');

  const isPaused = !!(state && String(state.status).startsWith('Paused'));

  if (autoSyncToggle) {
    const disabled = !isSignedIn || isPaused;
    autoSyncToggle.disabled = disabled;
    autoSyncToggle.classList.toggle('opacity-50', disabled);
    autoSyncToggle.classList.toggle('cursor-not-allowed', disabled);
  }

  if (syncIntervalSelect) {
    const disabled = !isSignedIn || isPaused;
    syncIntervalSelect.disabled = disabled;
    syncIntervalSelect.classList.toggle('opacity-50', disabled);
    syncIntervalSelect.classList.toggle('cursor-not-allowed', disabled);
  }

  if (verboseLoggingToggle) {
    const disabled = !isSignedIn;
    verboseLoggingToggle.disabled = disabled;
    verboseLoggingToggle.classList.toggle('opacity-50', disabled);
    verboseLoggingToggle.classList.toggle('cursor-not-allowed', disabled);
  }
}

// ============================================================================
// HANDLER FUNCTIONS
// ============================================================================

async function handleCopySql() {
  try {
    await navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    showToast('SQL copied to clipboard!', 'success');
  } catch (error) {
    console.error('Failed to copy SQL:', error);
    showToast('Failed to copy SQL', 'error');
  }
}

async function handleTestConnection() {
  const btn = document.getElementById('test-connection-btn');
  if (!btn) return;

  // Show loading state
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Testing...';

  try {
    // Send message to background
    const response = await chrome.runtime.sendMessage({
      type: 'testConnection',
    });

    // Update UI based on result
    const resultEl = document.getElementById('test-connection-result');
    if (resultEl) {
      if (response.ok) {
        resultEl.innerHTML = `<span class="text-green-600"><i class="fas fa-check-circle mr-1"></i>Connection successful!</span>`;
      } else {
        const errorMessage = getErrorMessage(response.errorCode, response.message);
        resultEl.innerHTML = `<span class="text-red-600"><i class="fas fa-exclamation-circle mr-1"></i>${errorMessage}</span>`;
      }
    }
  } catch (error) {
    console.error('Test connection failed:', error);
    showToast('Test connection failed', 'error');
  } finally {
    // Restore button state
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function handleSignIn() {
  const emailInput = document.getElementById('email-input');
  const passwordInput = document.getElementById('password-input');

  if (!emailInput || !passwordInput) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  // Validate inputs
  if (!email || !password) {
    showToast('Please enter email and password', 'error');
    return;
  }

  if (!validateEmail(email)) {
    showToast('Please enter a valid email address', 'error');
    return;
  }

  // Persist email for "Logged in as" display
  try {
    const currentConfig = await getConfig();
    await setConfig({ ...currentConfig, email });
  } catch {
    // Best-effort only
  }

  const btn = document.getElementById('sign-in-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Signing in...';
  }

  try {
    // Send message to background
    const response = await chrome.runtime.sendMessage({
      type: 'signIn',
      email,
      password,
    });

    if (response.ok) {
      showToast('Signed in successfully!', 'success');

      // Clear password field
      passwordInput.value = '';

      // Update UI
      await populateFieldsFromStorage();
      await renderSyncStatus();
      await renderSyncHistory();
    } else {
      const errorMessage = getErrorMessage(response.errorCode, response.message);
      showToast(errorMessage, 'error');
    }
  } catch (error) {
    console.error('Sign in failed:', error);
    showToast('Sign in failed', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>Sign In';
    }
  }
}

async function handleSignOut() {
  if (!confirm('Are you sure you want to sign out? Auto-sync will be disabled.')) {
    return;
  }

  const btn = document.getElementById('sign-out-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Signing out...';
  }

  try {
    // Send message to background
    const response = await chrome.runtime.sendMessage({
      type: 'signOut',
    });

    if (response.ok) {
      showToast('Signed out successfully', 'success');

      // Update UI
      await populateFieldsFromStorage();
      await renderSyncStatus();
    } else {
      showToast('Sign out failed', 'error');
    }
  } catch (error) {
    console.error('Sign out failed:', error);
    showToast('Sign out failed', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-sign-out-alt mr-2"></i>Sign Out';
    }
  }
}

async function handleSaveConfig() {
  const projectUrlInput = document.getElementById('project-url-input');
  const anonKeyInput = document.getElementById('anon-key-input');
  const emailInput = document.getElementById('email-input');

  if (!projectUrlInput || !anonKeyInput || !emailInput) return;

  const projectUrl = projectUrlInput.value.trim();
  const anonKey = anonKeyInput.value.trim();
  const email = emailInput.value.trim();

  // Validate inputs
  if (!projectUrl || !anonKey) {
    showToast('Please enter Project URL and API Key', 'error');
    return;
  }

  if (!validateProjectUrl(projectUrl)) {
    showToast('Invalid Project URL. Must be HTTPS and match *.supabase.co', 'error');
    return;
  }

  if (email && !validateEmail(email)) {
    showToast('Invalid email address', 'error');
    return;
  }

  try {
    await setConfig({ projectUrl, anonKey, email });
    showToast('Configuration saved!', 'success');
  } catch (error) {
    console.error('Failed to save config:', error);
    showToast('Failed to save configuration', 'error');
  }
}

async function handleSyncNow() {
  const btn = document.getElementById('sync-now-btn');
  if (!btn) return;

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Syncing...';

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'syncNow',
    });

    if (response.ok) {
      showToast(`Synced ${response.synced} items successfully!`, 'success');
      await renderSyncStatus();
      await renderSyncHistory();
    } else {
      const errorMessage = getErrorMessage(response.errorCode, response.message);
      showToast(errorMessage, 'error');
    }
  } catch (error) {
    console.error('Sync failed:', error);
    showToast('Sync failed', 'error');
  } finally {
    hideProgressIndicator();
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sync mr-2"></i>Sync Now';
  }
}

async function handleDownloadFromCloud() {
  const btn = document.getElementById('download-from-cloud-btn');
  if (!btn) return;

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Downloading...';

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'downloadFromCloud',
    });

    if (response.ok) {
      showToast(`Downloaded ${response.synced} items successfully!`, 'success');
      await renderSyncStatus();
      await renderSyncHistory();
    } else {
      const errorMessage = getErrorMessage(response.errorCode, response.message);
      showToast(errorMessage, 'error');
    }
  } catch (error) {
    console.error('Download failed:', error);
    showToast('Download failed', 'error');
  } finally {
    hideProgressIndicator();
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-cloud-download-alt mr-2"></i>Download from Cloud';
  }
}

async function handleReplaceLocalWithCloud() {
  const confirmed = confirm(
    'WARNING: This will permanently delete all local conversations and replace them with data from the cloud. This action cannot be undone. Are you sure?'
  );

  if (!confirmed) return;

  const btn = document.getElementById('replace-local-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Replacing...';
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'replaceLocal',
    });

    if (response.ok) {
      showToast('Local data replaced with cloud data successfully!', 'success');
      await renderSyncStatus();
      await renderSyncHistory();
    } else {
      const errorMessage = getErrorMessage(response.errorCode, response.message);
      showToast(errorMessage, 'error');
    }
  } catch (error) {
    console.error('Replace local failed:', error);
    showToast('Replace local failed', 'error');
  } finally {
    hideProgressIndicator();
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-cloud-upload-alt mr-2"></i>Replace Local with Cloud';
    }
  }
}

async function handleResetSyncState() {
  const confirmed = confirm(
    'This will clear sync cursors and history (but keep auth and configuration). Are you sure?'
  );

  if (!confirmed) return;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'resetSyncState',
    });

    if (response.ok) {
      showToast('Sync state reset successfully!', 'success');
      await renderSyncStatus();
      await renderSyncHistory();
    } else {
      showToast('Reset failed', 'error');
    }
  } catch (error) {
    console.error('Reset sync state failed:', error);
    showToast('Reset failed', 'error');
  }
}

async function handleForceFullResync() {
  const confirmed = confirm(
    'This will force a full re-sync on the next sync operation. Are you sure?'
  );

  if (!confirmed) return;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'forceFullResync',
    });

    if (response.ok) {
      showToast('Full resync will occur on next sync', 'success');
    } else {
      showToast('Force resync failed', 'error');
    }
  } catch (error) {
    console.error('Force resync failed:', error);
    showToast('Force resync failed', 'error');
  }
}

async function handleRetryFailed() {
  const btn = document.getElementById('retry-failed-btn');
  if (!btn) return;

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Retrying...';

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'retryFailed',
    });

    if (response.ok && (response.failed || 0) === 0) {
      showToast('Retry completed successfully!', 'success');
      await renderSyncStatus();
      await renderSyncHistory();
    } else if ((response.failed || 0) > 0) {
      showToast(`Retry completed with ${response.failed} failures`, 'error');
      await renderSyncStatus();
      await renderSyncHistory();
    } else {
      const errorMessage = getErrorMessage(response.errorCode, response.message);
      showToast(errorMessage, 'error');
    }
  } catch (error) {
    console.error('Retry failed:', error);
    showToast('Retry failed', 'error');
  } finally {
    hideProgressIndicator();
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-redo mr-2"></i>Retry Failed Items';
  }
}

async function handleRestoreDeletedFromCloud() {
  const btn = document.getElementById('restore-deleted-btn');
  if (!btn) return;

  const confirmed = confirm('Restore deleted conversations from cloud? This may re-download all data.');
  if (!confirmed) return;

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Restoring...';

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'restoreDeletedFromCloud',
    });

    if (response.ok) {
      showToast('Restore completed', 'success');
      await renderSyncStatus();
      await renderSyncHistory();
    } else {
      showToast(getErrorMessage(response.errorCode, response.message), 'error');
    }
  } catch (error) {
    console.error('Restore deleted failed:', error);
    showToast('Restore failed', 'error');
  } finally {
    hideProgressIndicator();
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-undo mr-2"></i>Restore Deleted (Cloud)';
  }
}

async function handleAutoSyncToggle(event) {
  const enabled = event.target.checked;

  try {
    const [state, auth] = await Promise.all([getState(), getAuth()]);
    const isSignedIn = isSignedInState(state, auth);
    if (!isSignedIn) {
      event.target.checked = false;
      showToast('Please sign in first', 'error');
      return;
    }

    const settings = await getSettings();
    settings.autoSyncEnabled = enabled;
    await setSettings(settings);

    // Notify background to update alarm
    await chrome.runtime.sendMessage({
      type: 'updateAutoSync',
      enabled,
    });

    showToast(enabled ? 'Auto-sync enabled' : 'Auto-sync disabled', 'success');

    // Refresh status panel to show updated state
    await renderSyncStatus();
  } catch (error) {
    console.error('Failed to toggle auto-sync:', error);
    showToast('Failed to update auto-sync', 'error');
  }
}

async function handleSyncIntervalChange(event) {
  const minutes = parseInt(event.target.value, 10);

  if (minutes < SYNC_CONFIG.MIN_SYNC_INTERVAL_MINUTES || minutes > SYNC_CONFIG.MAX_SYNC_INTERVAL_MINUTES) {
    showToast(`Interval must be between ${SYNC_CONFIG.MIN_SYNC_INTERVAL_MINUTES} and ${SYNC_CONFIG.MAX_SYNC_INTERVAL_MINUTES} minutes`, 'error');
    return;
  }

  try {
    const settings = await getSettings();
    settings.syncIntervalMinutes = minutes;
    await setSettings(settings);

    // Notify background to update alarm
    await chrome.runtime.sendMessage({
      type: 'updateSyncInterval',
      minutes,
    });

    showToast('Sync interval updated', 'success');

    // Refresh status panel to show updated next sync time
    await renderSyncStatus();
  } catch (error) {
    console.error('Failed to update sync interval:', error);
    showToast('Failed to update interval', 'error');
  }
}

async function handleVerboseLoggingToggle(event) {
  const enabled = event.target.checked;

  try {
    const settings = await getSettings();
    settings.verboseLogging = enabled;
    await setSettings(settings);

    showToast(enabled ? 'Verbose logging enabled' : 'Verbose logging disabled', 'success');
  } catch (error) {
    console.error('Failed to toggle verbose logging:', error);
    showToast('Failed to update logging', 'error');
  }
}

async function handlePreventCloudDeletionToggle(event) {
  const enabled = event.target.checked;

  try {
    const settings = await getSettings();
    settings.preventCloudDeletion = enabled;
    await setSettings(settings);

    showToast(
      enabled
        ? 'Cloud deletion prevented - cloud data will only increase'
        : 'Cloud deletion allowed - deleted items will sync to cloud',
      'success'
    );
  } catch (error) {
    console.error('Failed to toggle prevent cloud deletion:', error);
    showToast('Failed to update setting', 'error');
  }
}

// ============================================================================
// STATUS & HISTORY RENDERING
// ============================================================================

async function renderSyncStatus() {
  const statusEl = document.getElementById('sync-status-panel');
  if (!statusEl) return;

  const [state, settings, cursors, pending, history] = await Promise.all([
    getState(),
    getSettings(),
    getCursors(),
    getPending(),
    getHistory(),
  ]);

  const last = history[0] || null;
  const failedCount = Array.isArray(pending.failedItemKeys) ? pending.failedItemKeys.length : 0;
  const tombstoneCount = Array.isArray(pending.tombstones) ? pending.tombstones.length : 0;

  let nextSyncText = '—';
  if (settings.autoSyncEnabled) {
    try {
      const alarmInfo = await chrome.runtime.sendMessage({ type: 'getAutoSyncInfo' });
      if (alarmInfo?.ok && alarmInfo.alarmScheduledTime) {
        nextSyncText = new Date(alarmInfo.alarmScheduledTime).toLocaleString();
      }
    } catch {
      // ignore
    }
  }

  let localConversationCount = '—';
  try {
    const localCounts = await SyncStorage.getLocalCounts();
    localConversationCount = String(localCounts.conversations ?? '—');
  } catch {
    // ignore
  }

  let cloudConversationCount = '—';
  try {
    const cloudCounts = await chrome.runtime.sendMessage({ type: 'getCloudCounts' });
    if (cloudCounts?.ok && Number.isFinite(cloudCounts.conversations)) {
      cloudConversationCount = String(cloudCounts.conversations);
    }
  } catch {
    // ignore
  }

  const lastSyncedText = last?.finishedAt ? formatTimestamp(last.finishedAt) : '—';

  // Render status
  const statusHtml = `
    <div class="flex items-center justify-between mb-2">
      <span class="text-sm font-medium">Status:</span>
      <span class="text-sm ${getStatusColor(state.status)}">${state.status}</span>
    </div>
    ${state.pausedReason ? `
      <div class="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2 mb-2">
        ${state.pausedReason}
      </div>
    ` : ''}
    <div class="flex items-center justify-between mb-2">
      <span class="text-sm">Last sync:</span>
      <span class="text-sm">${lastSyncedText}</span>
    </div>
    <div class="flex items-center justify-between mb-2">
      <span class="text-sm">Auto-sync:</span>
      <span class="text-sm">${settings.autoSyncEnabled ? 'Enabled' : 'Disabled'}</span>
    </div>
    <div class="flex items-center justify-between mb-2">
      <span class="text-sm">Next sync:</span>
      <span class="text-sm">${settings.autoSyncEnabled ? nextSyncText : '—'}</span>
    </div>
    <div class="flex items-center justify-between mb-2">
      <span class="text-sm">Total conversations:</span>
      <span class="text-sm">${localConversationCount} local / ${cloudConversationCount} cloud</span>
    </div>
    <div class="flex items-center justify-between mb-2">
      <span class="text-sm">Pending:</span>
      <span class="text-sm">${failedCount} failed, ${tombstoneCount} deletes</span>
    </div>
    <div class="flex items-center justify-between">
      <span class="text-xs text-gray-500">Cursors:</span>
      <span class="text-xs text-gray-500">${cursors.conversationsUpdatedAt ? 'conv' : '—'} / ${cursors.messagesUpdatedAt ? 'msg' : '—'}</span>
    </div>
  `;

  statusEl.innerHTML = statusHtml;
}

async function renderSyncHistory() {
  const historyEl = document.getElementById('sync-history-list');
  if (!historyEl) return;

  const history = await getHistory();

  if (history.length === 0) {
    historyEl.innerHTML = '<p class="text-sm text-gray-500">No sync history yet</p>';
    return;
  }

  const historyHtml = history.map(entry => {
    const statusIcon = entry.status === 'success' ? 'fa-check-circle text-green-600' : 'fa-exclamation-circle text-red-600';
    return `
      <div class="border-b pb-2 mb-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium">
            <i class="fas ${statusIcon} mr-1"></i>
            ${entry.type} - ${entry.direction}
          </span>
          <span class="text-xs text-gray-500">${formatTimestamp(entry.startedAt)}</span>
        </div>
        <div class="text-xs text-gray-600 mt-1">
          Synced: ${entry.synced} | Failed: ${entry.failed} | Warnings: ${entry.warnings}
        </div>
        ${entry.message ? `<div class="text-xs text-gray-500 mt-1">${entry.message}</div>` : ''}
      </div>
    `;
  }).join('');

  historyEl.innerHTML = historyHtml;
}

// ============================================================================
// PROGRESS LISTENER
// ============================================================================

function setupProgressListener() {
  // Connect to background port
  progressPort = chrome.runtime.connect({ name: 'cloudSync.progress' });

  progressPort.onMessage.addListener((message) => {
    if (message.type === 'progress') {
      updateProgressIndicator(message.event);
    }
  });

  progressPort.onDisconnect.addListener(() => {
    console.log('Progress port disconnected');
    progressPort = null;
  });
}

function updateProgressIndicator(event) {
  const progressEl = document.getElementById('sync-progress-indicator');
  if (!progressEl) return;

  const hasTotal = event.total > 0;
  const percentage = hasTotal ? Math.round((event.done / event.total) * 100) : null;
  const progressHtml = `
    <div class="flex items-center justify-between text-sm">
      <span>
        Syncing... ${event.phase || ''} ${event.scope || ''}
        ${hasTotal ? `— ${event.done} / ${event.total} (${percentage}%)` : `— ${event.done}`}
      </span>
      <i class="fas fa-spinner fa-spin"></i>
    </div>
  `;

  progressEl.innerHTML = progressHtml;
  progressEl.classList.remove('hidden');
}

function hideProgressIndicator() {
  const progressEl = document.getElementById('sync-progress-indicator');
  if (!progressEl) return;
  progressEl.classList.add('hidden');
  progressEl.innerHTML = '';
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function validateProjectUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && (parsed.hostname.endsWith('.supabase.co') || parsed.hostname.includes('supabase'));
  } catch {
    return false;
  }
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ============================================================================
// UI HELPERS
// ============================================================================

function showToast(message, type = 'info') {
  // Simple toast implementation
  console.log(`[${type.toUpperCase()}] ${message}`);

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg text-white ${
    type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600'
  } z-50`;
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function getStatusColor(status) {
  if (status.includes('Connected')) return 'text-green-600';
  if (status.includes('Syncing')) return 'text-blue-600';
  if (status.includes('Paused')) return 'text-yellow-600';
  if (status.includes('Error')) return 'text-red-600';
  return 'text-gray-600';
}

function getErrorMessage(errorCode, defaultMessage) {
  const messages = {
    [TEST_ERROR_CODE.INVALID_CONFIG]: 'Invalid configuration - check Project URL and API Key',
    [TEST_ERROR_CODE.INVALID_CREDENTIALS]: 'Invalid credentials - check your email and password',
    [TEST_ERROR_CODE.AUTH_REQUIRED]: 'Session expired - please sign in again',
    [TEST_ERROR_CODE.MISSING_TABLES]: 'Tables not found - please run the SQL migration in Supabase first',
    [TEST_ERROR_CODE.RLS_DENIED]: 'Access denied - check RLS policies',
    [TEST_ERROR_CODE.NETWORK_ERROR]: 'Network error - check your connection and retry',
    [TEST_ERROR_CODE.TIMEOUT]: 'Request timed out - please retry',
    [SYNC_ERROR_CODE.AUTH_REQUIRED]: 'Session expired - please sign in again',
    [SYNC_ERROR_CODE.CLOUD_LIMIT]: 'Cloud limit reached - try again later',
    [SYNC_ERROR_CODE.NETWORK_ERROR]: 'Network error - check your connection and retry',
    [SYNC_ERROR_CODE.TIMEOUT]: 'Request timed out - please retry',
    [SYNC_ERROR_CODE.SCHEMA_MISMATCH]: 'Cloud schema mismatch - re-run SQL schema or update extension',
    [SYNC_ERROR_CODE.LOCAL_QUOTA_EXCEEDED]: 'Local storage is full - free up space and retry',
  };

  return messages[errorCode] || defaultMessage || 'An unknown error occurred';
}

function formatTimestamp(isoString) {
  try {
    const date = new Date(isoString);
    return date.toLocaleString();
  } catch {
    return isoString;
  }
}
