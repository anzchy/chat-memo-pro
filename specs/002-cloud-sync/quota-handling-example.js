/**
 * Complete Quota Handling Example for Chat Memo Pro
 *
 * This file demonstrates the full integration of quota detection
 * and handling in the sync engine.
 *
 * Features:
 * - Proactive quota checking before auto-sync
 * - Error-based detection for 429/507/413
 * - Graceful degradation (pause, reduce frequency)
 * - User notifications
 * - Manual sync override
 */

// ============================================================================
// 1. QUOTA DETECTOR MODULE
// ============================================================================

class SupabaseQuotaDetector {
  constructor(supabaseClient) {
    this.client = supabaseClient;
    this.FREE_TIER_STORAGE_LIMIT = 500 * 1024 * 1024; // 500MB
    this.CRITICAL_THRESHOLD = 0.95; // 95% - pause auto-sync
    this.WARNING_THRESHOLD = 0.80; // 80% - reduce frequency
    this.rateLimiter = new RateLimiter(50); // 50 req/min
    this.recentErrors = [];
  }

  /**
   * Main quota check - call before each auto-sync
   */
  async checkQuota() {
    const storage = await this.checkStorageQuota();
    const rateLimit = this.checkRateLimitStatus();

    return {
      storage,
      rateLimit,
      shouldPauseAutoSync: storage.percentage >= this.CRITICAL_THRESHOLD * 100,
      shouldReduceFrequency: storage.percentage >= this.WARNING_THRESHOLD * 100,
      timestamp: Date.now()
    };
  }

  /**
   * Check storage quota using PostgreSQL query
   */
  async checkStorageQuota() {
    try {
      // Try PostgreSQL query first (most accurate)
      const { data, error } = await this.client.rpc('get_database_size');

      if (error) throw error;

      const percentage = (data / this.FREE_TIER_STORAGE_LIMIT) * 100;

      return {
        method: 'postgresql',
        bytes: data,
        percentage: parseFloat(percentage.toFixed(2)),
        readable: this.formatBytes(data),
        status: this.getStorageStatus(percentage)
      };
    } catch (err) {
      console.warn('PostgreSQL quota check failed, using estimate:', err);
      return this.fallbackStorageEstimate();
    }
  }

  /**
   * Fallback: Client-side storage estimate
   */
  async fallbackStorageEstimate() {
    const result = await chrome.storage.local.get('sync_quota_estimate');
    const estimate = result.sync_quota_estimate || 0;
    const percentage = (estimate / this.FREE_TIER_STORAGE_LIMIT) * 100;

    return {
      method: 'estimate',
      bytes: estimate,
      percentage: parseFloat(percentage.toFixed(2)),
      readable: this.formatBytes(estimate),
      status: this.getStorageStatus(percentage),
      warning: 'Estimated only - may be inaccurate'
    };
  }

  /**
   * Check rate limit status
   */
  checkRateLimitStatus() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = this.rateLimiter.requests.filter(t => t > oneMinuteAgo).length;

    return {
      requestsLastMinute: recentRequests,
      limit: this.rateLimiter.maxRequests,
      throttled: recentRequests >= this.rateLimiter.maxRequests,
      warning: recentRequests >= this.rateLimiter.maxRequests * 0.8
    };
  }

  /**
   * Handle Supabase error - detect quota issues
   */
  handleSupabaseError(error) {
    const classification = {
      isQuotaError: false,
      type: null,
      shouldPauseSync: false,
      retryable: true,
      retryAfterSeconds: null
    };

    // HTTP 429 - Rate Limit Exceeded
    if (error.status === 429) {
      classification.isQuotaError = true;
      classification.type = 'rate_limit';
      classification.shouldPauseSync = true;
      classification.retryAfterSeconds = this.extractRetryAfter(error);
      this.logQuotaError('rate_limit', error);
    }

    // HTTP 507 - Storage Quota Exceeded
    else if (error.status === 507 || error.code === 'INSUFFICIENT_STORAGE') {
      classification.isQuotaError = true;
      classification.type = 'storage_quota';
      classification.shouldPauseSync = true;
      classification.retryable = false;
      this.logQuotaError('storage', error);
    }

    // HTTP 413 - Payload Too Large
    else if (error.status === 413) {
      classification.isQuotaError = true;
      classification.type = 'payload_size';
      classification.shouldPauseSync = false;
      classification.retryable = true;
      this.logQuotaError('payload', error);
    }

    // PostgreSQL disk quota error
    else if (error.message?.includes('disk quota exceeded')) {
      classification.isQuotaError = true;
      classification.type = 'storage_quota';
      classification.shouldPauseSync = true;
      classification.retryable = false;
    }

    return classification;
  }

  extractRetryAfter(error) {
    if (error.headers?.['retry-after']) {
      return parseInt(error.headers['retry-after'], 10);
    }
    if (error.headers?.['x-ratelimit-reset']) {
      const resetTime = parseInt(error.headers['x-ratelimit-reset'], 10);
      const now = Math.floor(Date.now() / 1000);
      return Math.max(0, resetTime - now);
    }
    return 60; // Default
  }

  async trackUploadSize(data) {
    const jsonSize = new Blob([JSON.stringify(data)]).size;
    const result = await chrome.storage.local.get('sync_quota_estimate');
    const currentEstimate = result.sync_quota_estimate || 0;

    await chrome.storage.local.set({
      sync_quota_estimate: currentEstimate + jsonSize
    });
  }

  getStorageStatus(percentage) {
    if (percentage >= this.CRITICAL_THRESHOLD * 100) return 'critical';
    if (percentage >= this.WARNING_THRESHOLD * 100) return 'warning';
    return 'healthy';
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  logQuotaError(type, error) {
    this.recentErrors.push({
      type,
      timestamp: Date.now(),
      message: error.message,
      status: error.status
    });

    if (this.recentErrors.length > 20) {
      this.recentErrors.shift();
    }
  }
}

// ============================================================================
// 2. RATE LIMITER
// ============================================================================

class RateLimiter {
  constructor(maxRequestsPerMinute = 50) {
    this.maxRequests = maxRequestsPerMinute;
    this.requests = [];
  }

  async throttle() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    this.requests = this.requests.filter(time => time > oneMinuteAgo);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = 60000 - (now - oldestRequest) + 100;

      console.log(`Rate limit throttle: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));

      this.requests = this.requests.filter(time => time > (Date.now() - 60000));
    }

    this.requests.push(Date.now());
  }
}

// ============================================================================
// 3. SYNC ENGINE WITH QUOTA HANDLING
// ============================================================================

class SyncEngine {
  constructor(supabaseClient) {
    this.client = supabaseClient;
    this.quotaDetector = new SupabaseQuotaDetector(supabaseClient);
    this.autoSyncPaused = false;
    this.frequencyReduced = false;
  }

  /**
   * Auto-sync with proactive quota checking
   */
  async performAutoSync() {
    console.log('[Sync] Starting auto-sync with quota check...');

    // STEP 1: Check quota BEFORE syncing
    const quotaStatus = await this.quotaDetector.checkQuota();

    console.log('[Sync] Quota status:', {
      storage: `${quotaStatus.storage.percentage}% (${quotaStatus.storage.readable})`,
      rateLimit: `${quotaStatus.rateLimit.requestsLastMinute}/${quotaStatus.rateLimit.limit} req/min`
    });

    // STEP 2: Pause if quota critical (95%+)
    if (quotaStatus.shouldPauseAutoSync) {
      this.autoSyncPaused = true;
      await this.handleQuotaCritical(quotaStatus);
      return {
        success: false,
        reason: 'quota_critical',
        quotaStatus
      };
    }

    // STEP 3: Reduce frequency if quota warning (80%+)
    if (quotaStatus.shouldReduceFrequency && !this.frequencyReduced) {
      await this.reduceAutoSyncFrequency();
      this.frequencyReduced = true;
    }

    // STEP 4: Proceed with sync
    try {
      // Throttle to avoid rate limits
      await this.quotaDetector.rateLimiter.throttle();

      const result = await this.syncConversations();

      // Track upload size for estimate
      if (result.uploaded) {
        await this.quotaDetector.trackUploadSize(result.uploaded);
      }

      return {
        success: true,
        ...result
      };

    } catch (error) {
      // STEP 5: Handle quota errors during sync
      const errorInfo = this.quotaDetector.handleSupabaseError(error);

      if (errorInfo.isQuotaError) {
        await this.handleQuotaError(errorInfo);
        return {
          success: false,
          reason: errorInfo.type,
          retryAfter: errorInfo.retryAfterSeconds,
          error: error.message
        };
      }

      // Re-throw non-quota errors
      throw error;
    }
  }

  /**
   * Manual sync (allows override even when auto-sync paused)
   */
  async performManualSync({ force = false } = {}) {
    console.log('[Sync] Manual sync requested');

    // Check quota unless forced
    if (!force) {
      const quotaStatus = await this.quotaDetector.checkQuota();

      if (quotaStatus.shouldPauseAutoSync) {
        // Warn but allow continuation
        const userConfirmed = await this.confirmManualSyncDespiteQuota(quotaStatus);
        if (!userConfirmed) {
          return { success: false, reason: 'user_cancelled' };
        }
      }
    }

    // Proceed with sync (same logic as auto-sync)
    try {
      await this.quotaDetector.rateLimiter.throttle();
      const result = await this.syncConversations();

      if (result.uploaded) {
        await this.quotaDetector.trackUploadSize(result.uploaded);
      }

      return { success: true, ...result };

    } catch (error) {
      const errorInfo = this.quotaDetector.handleSupabaseError(error);

      if (errorInfo.isQuotaError) {
        await this.handleQuotaError(errorInfo);
        return {
          success: false,
          reason: errorInfo.type,
          error: error.message
        };
      }

      throw error;
    }
  }

  /**
   * Core sync logic (placeholder - implement actual sync)
   */
  async syncConversations() {
    // This is where actual sync logic goes
    // For this example, we'll simulate
    console.log('[Sync] Syncing conversations...');

    // Simulate sync operation
    const conversations = await this.getLocalChangedConversations();

    if (conversations.length === 0) {
      return { uploaded: null, count: 0 };
    }

    // Upload to Supabase
    const { data, error } = await this.client
      .from('conversations')
      .upsert(conversations);

    if (error) throw error;

    return {
      uploaded: conversations,
      count: conversations.length
    };
  }

  async getLocalChangedConversations() {
    // Placeholder - get conversations from IndexedDB
    return [];
  }

  /**
   * Handle quota critical (95%+ storage)
   */
  async handleQuotaCritical(quotaStatus) {
    console.error('[Sync] QUOTA CRITICAL - Auto-sync PAUSED');

    // Update config
    const config = await chrome.storage.local.get('sync_config');
    config.sync_config = config.sync_config || {};
    config.sync_config.auto_sync_enabled = false;
    config.sync_config.auto_sync_paused_reason = 'quota_critical';
    config.sync_config.quota_critical_timestamp = Date.now();
    await chrome.storage.local.set(config);

    // Clear auto-sync alarm
    await chrome.alarms.clear('auto-sync');

    // Notify user
    await this.notifyUser({
      type: 'critical',
      title: 'Chat Memo Pro - Sync Paused',
      message: `Storage quota reached (${quotaStatus.storage.percentage}%). Auto-sync paused. Please upgrade your Supabase plan or delete old conversations to resume.`
    });

    // Update extension badge
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ff0000' });
  }

  /**
   * Handle quota error during sync
   */
  async handleQuotaError(errorInfo) {
    console.warn('[Sync] Quota error:', errorInfo.type);

    if (errorInfo.shouldPauseSync) {
      this.autoSyncPaused = true;

      const messages = {
        rate_limit: `API rate limit exceeded. Auto-sync paused for ${errorInfo.retryAfterSeconds || 60} seconds.`,
        storage_quota: 'Cloud storage quota exceeded. Auto-sync paused. Please upgrade or delete data.',
        payload_size: 'Sync payload too large. Reducing batch size and retrying.'
      };

      await this.notifyUser({
        type: errorInfo.type === 'payload_size' ? 'warning' : 'critical',
        title: 'Chat Memo Pro - Sync Error',
        message: messages[errorInfo.type] || 'Quota limit reached'
      });

      // For rate limits, schedule retry
      if (errorInfo.type === 'rate_limit' && errorInfo.retryAfterSeconds) {
        setTimeout(() => {
          this.autoSyncPaused = false;
          console.log('[Sync] Rate limit expired, resuming auto-sync');
        }, errorInfo.retryAfterSeconds * 1000);
      }

      // For storage quota, disable auto-sync permanently
      if (errorInfo.type === 'storage_quota') {
        const config = await chrome.storage.local.get('sync_config');
        config.sync_config = config.sync_config || {};
        config.sync_config.auto_sync_enabled = false;
        config.sync_config.auto_sync_paused_reason = 'storage_quota_exceeded';
        await chrome.storage.local.set(config);
        await chrome.alarms.clear('auto-sync');
      }
    }
  }

  /**
   * Reduce auto-sync frequency (80% quota warning)
   */
  async reduceAutoSyncFrequency() {
    console.warn('[Sync] Quota warning - reducing auto-sync frequency');

    const config = await chrome.storage.local.get('sync_config');
    const currentInterval = config.sync_config?.sync_interval_minutes || 15;
    const newInterval = Math.min(currentInterval * 2, 60); // Double interval, max 60min

    config.sync_config = config.sync_config || {};
    config.sync_config.sync_interval_minutes = newInterval;
    config.sync_config.frequency_reduced = true;
    await chrome.storage.local.set(config);

    // Update alarm
    chrome.alarms.create('auto-sync', { periodInMinutes: newInterval });

    await this.notifyUser({
      type: 'warning',
      title: 'Chat Memo Pro - Sync Frequency Reduced',
      message: `Approaching storage quota (80%+). Auto-sync frequency reduced to ${newInterval} minutes to conserve quota.`
    });

    chrome.action.setBadgeText({ text: '⚠' });
    chrome.action.setBadgeBackgroundColor({ color: '#ff9800' });
  }

  /**
   * Confirm manual sync despite quota warning
   */
  async confirmManualSyncDespiteQuota(quotaStatus) {
    // In real implementation, show modal in popup
    // For this example, we'll use browser confirm (not available in service worker)
    // In production, send message to popup for user confirmation
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'CONFIRM_MANUAL_SYNC',
        quotaStatus
      }, (response) => {
        resolve(response?.confirmed || false);
      });
    });
  }

  /**
   * Notify user via Chrome notifications
   */
  async notifyUser({ type, title, message }) {
    const priorities = {
      critical: 2,
      warning: 1,
      info: 0
    };

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/logo.svg',
      title,
      message,
      priority: priorities[type] || 0
    });
  }
}

// ============================================================================
// 4. USAGE EXAMPLE IN BACKGROUND SCRIPT
// ============================================================================

/*
// In background.js (service worker)

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const config = await chrome.storage.local.get('sync_config');
const supabase = createClient(
  config.sync_config.project_url,
  config.sync_config.api_key
);

// Create sync engine
const syncEngine = new SyncEngine(supabase);

// Auto-sync alarm listener
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'auto-sync') {
    console.log('[Background] Auto-sync alarm triggered');

    const result = await syncEngine.performAutoSync();

    if (result.success) {
      console.log(`[Background] Auto-sync completed: ${result.count} conversations synced`);
    } else {
      console.warn(`[Background] Auto-sync failed: ${result.reason}`);
    }
  }
});

// Manual sync message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'MANUAL_SYNC') {
    syncEngine.performManualSync({ force: message.force })
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));

    return true; // Keep message channel open for async response
  }

  if (message.type === 'GET_QUOTA_STATUS') {
    syncEngine.quotaDetector.checkQuota()
      .then(status => sendResponse(status))
      .catch(error => sendResponse({ error: error.message }));

    return true;
  }
});
*/

// ============================================================================
// 5. UI INTEGRATION EXAMPLE (POPUP)
// ============================================================================

/*
// In popup.js or sync-ui-controller.js

async function renderQuotaStatus() {
  // Get quota status from background
  const quotaStatus = await chrome.runtime.sendMessage({ type: 'GET_QUOTA_STATUS' });

  const statusHTML = `
    <div class="quota-status ${quotaStatus.storage.status}">
      <h4>Cloud Storage Quota</h4>

      <div class="progress-bar">
        <div class="progress-fill ${quotaStatus.storage.status}"
             style="width: ${quotaStatus.storage.percentage}%">
        </div>
      </div>

      <p class="quota-text">
        ${quotaStatus.storage.percentage}% used
        (${quotaStatus.storage.readable} / 500 MB)
        ${quotaStatus.storage.method === 'estimate' ? '(estimated)' : ''}
      </p>

      ${quotaStatus.storage.status === 'critical' ? `
        <div class="alert alert-danger">
          <strong>⚠️ Auto-sync paused</strong>: Storage quota exceeded (95%+)
          <br><br>
          <strong>Actions:</strong>
          <ul>
            <li><a href="https://supabase.com/dashboard" target="_blank">Upgrade Supabase plan</a></li>
            <li>Delete old conversations from cloud</li>
            <li>Manual sync still available (with confirmation)</li>
          </ul>
        </div>
      ` : ''}

      ${quotaStatus.storage.status === 'warning' ? `
        <div class="alert alert-warning">
          <strong>⚠️ Warning</strong>: Approaching storage limit (${quotaStatus.storage.percentage}%)
          <br>
          Auto-sync frequency has been reduced to conserve quota.
        </div>
      ` : ''}

      ${quotaStatus.rateLimit.warning ? `
        <div class="alert alert-info">
          <strong>ℹ️ Rate limiting active</strong>:
          ${quotaStatus.rateLimit.requestsLastMinute}/${quotaStatus.rateLimit.limit} API requests/min
        </div>
      ` : ''}
    </div>
  `;

  document.getElementById('quota-status-container').innerHTML = statusHTML;
}

// Manual sync with quota check
document.getElementById('manual-sync-btn').addEventListener('click', async () => {
  const result = await chrome.runtime.sendMessage({
    type: 'MANUAL_SYNC',
    force: false // Will show confirmation if quota critical
  });

  if (result.success) {
    alert(`Sync successful! ${result.count} conversations synced.`);
  } else {
    alert(`Sync failed: ${result.reason}`);
  }
});

// Initialize quota display
renderQuotaStatus();

// Refresh every 30 seconds
setInterval(renderQuotaStatus, 30000);
*/

// ============================================================================
// END OF EXAMPLE
// ============================================================================
