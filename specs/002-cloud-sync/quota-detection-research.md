# Supabase Quota/Limit Error Detection Research

**Created**: 2025-12-13
**Purpose**: Research quota detection strategy for Supabase free tier to implement auto-sync pause at 95% quota
**Context**: [Cloud Sync Spec](./spec.md) - FR-023 requirement

## Executive Summary

### Decision: Multi-Signal Quota Detection Strategy

**Approach**: Implement a defensive multi-layer detection system that combines:
1. HTTP error code monitoring (429, 413, 507)
2. PostgreSQL error message pattern matching
3. Proactive storage quota estimation via database queries
4. Rate limit header tracking (X-RateLimit-* headers)
5. Fallback to local quota tracking when API limits prevent checking

**Rationale**: Supabase free tier does not provide a direct "get current quota usage" API endpoint. Detection must rely on error signals, PostgreSQL statistics queries, and client-side estimation.

---

## 1. HTTP Error Codes for Quota Exceeded

### Primary Error Codes

| HTTP Code | Meaning | Supabase Context | Detection Priority |
|-----------|---------|------------------|-------------------|
| **429** | Too Many Requests | Rate limit exceeded (API requests/hour) | **HIGH** - Primary rate limit signal |
| **413** | Payload Too Large | Single request exceeds size limit | **MEDIUM** - Rare for typical sync |
| **507** | Insufficient Storage | Database storage quota exceeded (500MB free tier) | **HIGH** - Primary storage signal |
| **401** | Unauthorized | Auth session expired (not quota, but stops sync) | **HIGH** - Must handle |
| **403** | Forbidden | RLS policy denial or API key invalid | **MEDIUM** - Config issue |

### Error Response Examples

#### Rate Limit Exceeded (429)
```javascript
// Supabase JS Client Error Object
{
  error: {
    message: "Too many requests",
    status: 429,
    code: "RATE_LIMIT_EXCEEDED"
  },
  data: null,
  status: 429,
  statusText: "Too Many Requests"
}

// HTTP Response Headers
{
  "X-RateLimit-Limit": "100",        // Max requests per window
  "X-RateLimit-Remaining": "0",      // Requests left
  "X-RateLimit-Reset": "1702500000", // Unix timestamp when limit resets
  "Retry-After": "60"                // Seconds to wait before retry
}
```

#### Storage Quota Exceeded (507)
```javascript
// PostgreSQL Error via Supabase
{
  error: {
    message: "disk quota exceeded",
    status: 507,
    code: "INSUFFICIENT_STORAGE",
    details: "Database storage limit reached",
    hint: "Upgrade to Pro plan or delete data"
  },
  data: null
}
```

#### Payload Too Large (413)
```javascript
{
  error: {
    message: "Request entity too large",
    status: 413,
    code: "PAYLOAD_TOO_LARGE"
  },
  data: null
}
```

---

## 2. Detecting Storage Quota (500MB Free Tier Limit)

### Problem: No Direct API Endpoint

Supabase **does not provide** a REST API endpoint like `/quota/usage` for free tier users. Storage quota must be detected via:

### Method 1: PostgreSQL Statistics Query (Recommended)

**Approach**: Query `pg_database_size()` to get current database size

```javascript
// Query database size in bytes
const { data, error } = await supabaseClient
  .rpc('get_database_size'); // Custom function (see SQL below)

// SQL Function to create (users run in Supabase Dashboard)
CREATE OR REPLACE FUNCTION get_database_size()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pg_database_size(current_database());
$$;
```

**Calculation**:
```javascript
const FREE_TIER_LIMIT_BYTES = 500 * 1024 * 1024; // 500MB
const currentSizeBytes = data; // From query above
const usagePercentage = (currentSizeBytes / FREE_TIER_LIMIT_BYTES) * 100;

if (usagePercentage >= 95) {
  // PAUSE AUTO-SYNC
  console.warn(`Storage quota at ${usagePercentage.toFixed(1)}% - pausing auto-sync`);
}
```

**Pros**:
- Accurate real-time measurement
- Detects quota before hitting 100%
- Works with anon key (if RPC is public)

**Cons**:
- Requires users to create custom SQL function
- Counts entire database (not just this extension's data)
- Query itself consumes API request quota

### Method 2: Client-Side Estimation (Fallback)

**Approach**: Track sync upload sizes locally and estimate cloud usage

```javascript
class QuotaTracker {
  constructor() {
    this.estimatedCloudSizeBytes = 0;
    this.FREE_TIER_LIMIT = 500 * 1024 * 1024; // 500MB
  }

  async trackUpload(conversations) {
    // Estimate JSON size (rough approximation)
    const jsonSize = new Blob([JSON.stringify(conversations)]).size;
    this.estimatedCloudSizeBytes += jsonSize;

    // Persist estimate to chrome.storage.local
    await chrome.storage.local.set({
      'sync_quota_estimate': this.estimatedCloudSizeBytes
    });
  }

  getUsagePercentage() {
    return (this.estimatedCloudSizeBytes / this.FREE_TIER_LIMIT) * 100;
  }

  isNearQuota(threshold = 95) {
    return this.getUsagePercentage() >= threshold;
  }
}
```

**Pros**:
- No extra API calls
- Works offline
- Simple to implement

**Cons**:
- Inaccurate (doesn't account for PostgreSQL overhead, indexes, other apps)
- Diverges over time (no sync with actual cloud state)
- Resets if extension reinstalled

### Method 3: Error-Based Detection (Last Resort)

**Approach**: Catch 507 errors when writes fail

```javascript
async function uploadConversations(conversations) {
  try {
    const { data, error } = await supabaseClient
      .from('conversations')
      .upsert(conversations);

    if (error) {
      if (error.status === 507 || error.code === 'INSUFFICIENT_STORAGE') {
        // Quota exceeded - already at 100%
        await handleStorageQuotaExceeded();
        return { success: false, reason: 'quota_exceeded' };
      }
    }
    return { success: true, data };
  } catch (err) {
    // Network errors, etc.
    return { success: false, reason: 'network_error' };
  }
}
```

**Pros**:
- No setup required
- Definitive signal (quota actually exceeded)

**Cons**:
- Reactive, not proactive (only detects at 100%, not 95%)
- Sync already failed by this point
- No warning before quota hit

---

## 3. Detecting Rate Limiting Errors

### Rate Limit Thresholds (Free Tier)

Supabase free tier has multiple rate limits:
- **API Requests**: ~500-1000 requests/hour (varies by endpoint)
- **Database Connections**: 60 simultaneous connections
- **Storage API**: 50 requests/second per project

### Detection Strategy

**Check Response Headers + Error Codes**:

```javascript
async function makeSupabaseRequest(operation) {
  try {
    const response = await operation();

    // Check rate limit headers (available on HTTP responses)
    const rateLimitRemaining = response.headers?.['x-ratelimit-remaining'];
    const rateLimitReset = response.headers?.['x-ratelimit-reset'];

    if (rateLimitRemaining !== undefined) {
      const remaining = parseInt(rateLimitRemaining, 10);

      // Warn if approaching limit (< 10 requests left)
      if (remaining < 10) {
        console.warn(`Rate limit approaching: ${remaining} requests remaining`);
        // Consider slowing down sync operations
      }
    }

    return response;
  } catch (error) {
    // HTTP 429 - Rate limit exceeded
    if (error.status === 429) {
      const retryAfter = error.headers?.['retry-after']; // Seconds to wait
      const resetTime = error.headers?.['x-ratelimit-reset']; // Unix timestamp

      return {
        rateLimited: true,
        retryAfterSeconds: retryAfter ? parseInt(retryAfter, 10) : 60,
        resetTimestamp: resetTime ? parseInt(resetTime, 10) : null
      };
    }
    throw error;
  }
}
```

### Proactive Rate Limit Avoidance

**Implement Request Throttling**:

```javascript
class RateLimiter {
  constructor(maxRequestsPerMinute = 50) {
    this.maxRequests = maxRequestsPerMinute;
    this.requests = []; // Array of timestamps
  }

  async throttle() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove requests older than 1 minute
    this.requests = this.requests.filter(time => time > oneMinuteAgo);

    // Check if at limit
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = 60000 - (now - oldestRequest);

      console.log(`Rate limit throttle: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Record this request
    this.requests.push(now);
  }
}

// Usage
const rateLimiter = new RateLimiter(50); // 50 req/min
await rateLimiter.throttle(); // Call before each Supabase operation
```

---

## 4. Programmatic Quota Usage API

### Verdict: No Public API for Free Tier

**Finding**: Supabase does **NOT** provide a public API endpoint to check quota usage for free tier projects.

**Available Alternatives**:

1. **Supabase Dashboard (Manual Only)**:
   - Users can view quota in Dashboard under "Project Settings" > "Billing"
   - Shows: Database size, Bandwidth, Storage API requests
   - Not accessible programmatically via anon/public API key

2. **Service Role Key (Not Recommended for Extensions)**:
   - Management API exists (`https://api.supabase.com/v1/projects/{ref}/stats`)
   - Requires **service role key** (secret, should not be in client-side code)
   - Not suitable for Chrome extensions (security risk)

3. **PostgreSQL Queries (Partial Solution)**:
   - `pg_database_size()` for database storage (see Method 1 above)
   - `pg_stat_database` for connection counts
   - Cannot detect API request quota usage

### Recommendation: Hybrid Approach

**Strategy**:
```javascript
class QuotaMonitor {
  async checkQuotaStatus() {
    const status = {
      storage: await this.checkStorageQuota(),
      rateLimit: this.checkRateLimitStatus(),
      overallHealth: 'healthy'
    };

    // Determine overall health
    if (status.storage.percentage >= 95 || status.rateLimit.throttled) {
      status.overallHealth = 'critical';
    } else if (status.storage.percentage >= 80 || status.rateLimit.warning) {
      status.overallHealth = 'warning';
    }

    return status;
  }

  async checkStorageQuota() {
    try {
      // Try PostgreSQL query first
      const { data, error } = await supabaseClient.rpc('get_database_size');

      if (!error && data) {
        const percentage = (data / (500 * 1024 * 1024)) * 100;
        return {
          method: 'postgresql_query',
          bytes: data,
          percentage: percentage.toFixed(2),
          nearLimit: percentage >= 95
        };
      }
    } catch (err) {
      console.warn('PostgreSQL quota check failed, falling back to estimate');
    }

    // Fallback to client-side estimate
    const estimate = await this.getLocalQuotaEstimate();
    return {
      method: 'client_estimate',
      bytes: estimate,
      percentage: ((estimate / (500 * 1024 * 1024)) * 100).toFixed(2),
      nearLimit: estimate >= (475 * 1024 * 1024) // 95% of 500MB
    };
  }

  checkRateLimitStatus() {
    // Based on recent request tracking
    const recentRequests = this.rateLimiter.requests.length;
    return {
      requestsInLastMinute: recentRequests,
      throttled: recentRequests >= 50,
      warning: recentRequests >= 40
    };
  }
}
```

---

## 5. Best Practices for Graceful Degradation

### Strategy 1: Progressive Sync Disablement

**Approach**: Disable features progressively as quota limits approach

```javascript
class SyncManager {
  async handleQuotaStatus(quotaStatus) {
    if (quotaStatus.overallHealth === 'critical') {
      // PAUSE AUTO-SYNC
      await this.pauseAutoSync();
      await this.showQuotaWarning('critical');

      // Disable background sync
      chrome.alarms.clear('auto-sync');

    } else if (quotaStatus.overallHealth === 'warning') {
      // REDUCE SYNC FREQUENCY
      await this.reduceAutoSyncFrequency();
      await this.showQuotaWarning('warning');

      // Change from 15min to 60min
      chrome.alarms.create('auto-sync', { periodInMinutes: 60 });
    }
  }

  async pauseAutoSync() {
    const config = await chrome.storage.local.get('sync_config');
    config.sync_config.auto_sync_enabled = false;
    config.sync_config.auto_sync_paused_reason = 'quota_limit';
    await chrome.storage.local.set(config);

    console.warn('Auto-sync PAUSED due to quota limit');
  }

  async showQuotaWarning(severity) {
    const message = severity === 'critical'
      ? 'Cloud storage quota reached (95%+). Auto-sync paused. Please upgrade Supabase plan or delete old conversations.'
      : 'Cloud storage quota warning (80%+). Auto-sync frequency reduced. Consider managing data.';

    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/logo.svg',
      title: 'Chat Memo Pro - Sync Quota Warning',
      message: message,
      priority: severity === 'critical' ? 2 : 1
    });

    // Update UI badge
    chrome.action.setBadgeText({ text: severity === 'critical' ? '!' : '⚠' });
    chrome.action.setBadgeBackgroundColor({ color: severity === 'critical' ? '#ff0000' : '#ff9800' });
  }
}
```

### Strategy 2: User-Facing Warnings in Settings UI

**Approach**: Show quota status prominently in sync settings

```javascript
// UI Component (in sync-ui-controller.js)
function renderQuotaStatus(quotaStatus) {
  const statusHTML = `
    <div class="quota-status ${quotaStatus.overallHealth}">
      <h4>Storage Quota</h4>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${quotaStatus.storage.percentage}%"></div>
      </div>
      <p class="quota-text">
        ${quotaStatus.storage.percentage}% used
        (${formatBytes(quotaStatus.storage.bytes)} / 500 MB)
      </p>

      ${quotaStatus.overallHealth === 'critical' ? `
        <div class="alert alert-danger">
          <strong>Auto-sync paused</strong>: Storage quota exceeded (95%+)
          <br>
          <a href="https://supabase.com/dashboard/project/_/settings/billing" target="_blank">
            Upgrade to Pro plan
          </a> or delete old conversations to resume sync.
        </div>
      ` : ''}

      ${quotaStatus.overallHealth === 'warning' ? `
        <div class="alert alert-warning">
          <strong>Warning</strong>: Approaching storage limit (80%+)
          <br>
          Auto-sync frequency reduced to conserve quota.
        </div>
      ` : ''}
    </div>
  `;

  document.getElementById('quota-status-container').innerHTML = statusHTML;
}
```

### Strategy 3: Manual Sync Override

**Approach**: Allow manual sync even when auto-sync paused

```javascript
async function handleManualSyncClick() {
  const quotaStatus = await quotaMonitor.checkQuotaStatus();

  if (quotaStatus.overallHealth === 'critical') {
    // Warn but allow override
    const confirmed = confirm(
      'Storage quota exceeded (95%+). Manual sync may fail. Continue anyway?'
    );

    if (!confirmed) return;
  }

  // Proceed with manual sync
  await syncEngine.syncNow({ force: true });
}
```

### Strategy 4: Selective Sync (Advanced)

**Approach**: Allow users to sync only recent conversations when quota limited

```javascript
async function enableSelectiveSync() {
  const config = await chrome.storage.local.get('sync_config');

  // When quota critical, offer to sync only last 30 days
  config.sync_config.selective_sync_enabled = true;
  config.sync_config.sync_filter = {
    date_range: 'last_30_days' // Only sync conversations from last 30 days
  };

  await chrome.storage.local.set(config);

  console.log('Selective sync enabled: last 30 days only');
}
```

---

## 6. Code Pattern: Complete Quota Detection Module

### Implementation: quota-detector.js

```javascript
/**
 * Supabase Quota Detection Module
 * Detects storage and rate limit quota issues for free tier
 */

class SupabaseQuotaDetector {
  constructor(supabaseClient) {
    this.client = supabaseClient;
    this.FREE_TIER_STORAGE_LIMIT = 500 * 1024 * 1024; // 500MB
    this.CRITICAL_THRESHOLD = 0.95; // 95%
    this.WARNING_THRESHOLD = 0.80; // 80%

    // Rate limiting
    this.rateLimiter = new RateLimiter(50); // 50 req/min conservative limit
    this.recentErrors = [];
  }

  /**
   * Main quota check - call before each auto-sync
   * @returns {Object} Quota status with recommendations
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
      console.warn('PostgreSQL quota check failed:', err);
      return this.fallbackStorageEstimate();
    }
  }

  /**
   * Fallback: Client-side storage estimate
   */
  async fallbackStorageEstimate() {
    const { sync_quota_estimate = 0 } = await chrome.storage.local.get('sync_quota_estimate');
    const percentage = (sync_quota_estimate / this.FREE_TIER_STORAGE_LIMIT) * 100;

    return {
      method: 'estimate',
      bytes: sync_quota_estimate,
      percentage: parseFloat(percentage.toFixed(2)),
      readable: this.formatBytes(sync_quota_estimate),
      status: this.getStorageStatus(percentage),
      warning: 'Estimated only - may be inaccurate'
    };
  }

  /**
   * Check rate limit status based on recent activity
   */
  checkRateLimitStatus() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Count requests in last minute
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
   * @param {Error} error - Supabase error object
   * @returns {Object} Error classification
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
      classification.retryable = false; // Won't succeed until user frees space

      this.logQuotaError('storage', error);
    }

    // HTTP 413 - Payload Too Large
    else if (error.status === 413) {
      classification.isQuotaError = true;
      classification.type = 'payload_size';
      classification.shouldPauseSync = false; // Can retry with smaller batches
      classification.retryable = true;

      this.logQuotaError('payload', error);
    }

    // PostgreSQL errors
    else if (error.message?.includes('disk quota exceeded')) {
      classification.isQuotaError = true;
      classification.type = 'storage_quota';
      classification.shouldPauseSync = true;
      classification.retryable = false;
    }

    return classification;
  }

  /**
   * Extract retry-after header from error
   */
  extractRetryAfter(error) {
    // Check Retry-After header
    if (error.headers?.['retry-after']) {
      return parseInt(error.headers['retry-after'], 10);
    }

    // Check X-RateLimit-Reset
    if (error.headers?.['x-ratelimit-reset']) {
      const resetTime = parseInt(error.headers['x-ratelimit-reset'], 10);
      const now = Math.floor(Date.now() / 1000);
      return Math.max(0, resetTime - now);
    }

    // Default to 60 seconds
    return 60;
  }

  /**
   * Track upload size for client-side estimate
   */
  async trackUploadSize(data) {
    const jsonSize = new Blob([JSON.stringify(data)]).size;
    const { sync_quota_estimate = 0 } = await chrome.storage.local.get('sync_quota_estimate');

    await chrome.storage.local.set({
      'sync_quota_estimate': sync_quota_estimate + jsonSize
    });
  }

  /**
   * Get storage status level
   */
  getStorageStatus(percentage) {
    if (percentage >= this.CRITICAL_THRESHOLD * 100) return 'critical';
    if (percentage >= this.WARNING_THRESHOLD * 100) return 'warning';
    return 'healthy';
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Log quota errors for debugging
   */
  logQuotaError(type, error) {
    this.recentErrors.push({
      type,
      timestamp: Date.now(),
      message: error.message,
      status: error.status
    });

    // Keep only last 20 errors
    if (this.recentErrors.length > 20) {
      this.recentErrors.shift();
    }
  }

  /**
   * Get recent quota errors
   */
  getRecentQuotaErrors() {
    return this.recentErrors;
  }
}

/**
 * Rate Limiter - Prevent hitting API limits
 */
class RateLimiter {
  constructor(maxRequestsPerMinute = 50) {
    this.maxRequests = maxRequestsPerMinute;
    this.requests = [];
  }

  async throttle() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean old requests
    this.requests = this.requests.filter(time => time > oneMinuteAgo);

    // Wait if at limit
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = 60000 - (now - oldestRequest) + 100; // +100ms buffer

      console.log(`Rate limit throttle: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));

      // Re-clean after wait
      this.requests = this.requests.filter(time => time > (Date.now() - 60000));
    }

    // Record this request
    this.requests.push(Date.now());
  }
}

// Export for use in sync engine
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SupabaseQuotaDetector, RateLimiter };
}
```

### Usage Example: Integration with Sync Engine

```javascript
// In sync-engine.js

class SyncEngine {
  constructor(supabaseClient) {
    this.quotaDetector = new SupabaseQuotaDetector(supabaseClient);
    this.autoSyncPaused = false;
  }

  /**
   * Auto-sync with quota checking
   */
  async performAutoSync() {
    // Check quota before sync
    const quotaStatus = await this.quotaDetector.checkQuota();

    // Pause auto-sync if quota critical
    if (quotaStatus.shouldPauseAutoSync) {
      this.autoSyncPaused = true;
      await this.notifyQuotaExceeded(quotaStatus);
      return { success: false, reason: 'quota_exceeded' };
    }

    // Reduce frequency if quota warning
    if (quotaStatus.shouldReduceFrequency && !this.frequencyReduced) {
      await this.reduceAutoSyncFrequency();
    }

    // Proceed with sync
    try {
      // Throttle rate limits
      await this.quotaDetector.rateLimiter.throttle();

      const result = await this.syncConversations();

      // Track upload size
      if (result.uploaded) {
        await this.quotaDetector.trackUploadSize(result.uploaded);
      }

      return result;
    } catch (error) {
      // Classify error
      const errorInfo = this.quotaDetector.handleSupabaseError(error);

      if (errorInfo.isQuotaError) {
        if (errorInfo.shouldPauseSync) {
          this.autoSyncPaused = true;
          await this.notifyQuotaExceeded({
            type: errorInfo.type,
            retryAfter: errorInfo.retryAfterSeconds
          });
        }

        return {
          success: false,
          reason: errorInfo.type,
          retryAfter: errorInfo.retryAfterSeconds
        };
      }

      throw error; // Non-quota error
    }
  }

  /**
   * Notify user about quota issues
   */
  async notifyQuotaExceeded(quotaInfo) {
    const messages = {
      storage_quota: 'Cloud storage quota reached (95%+). Auto-sync paused. Please upgrade your Supabase plan or delete old conversations.',
      rate_limit: `API rate limit exceeded. Auto-sync paused for ${quotaInfo.retryAfter || 60} seconds.`,
      payload_size: 'Sync payload too large. Trying smaller batches.'
    };

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/logo.svg',
      title: 'Chat Memo Pro - Sync Quota Warning',
      message: messages[quotaInfo.type] || 'Quota limit reached',
      priority: 2
    });

    // Update badge
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ff0000' });
  }
}
```

---

## 7. Summary & Recommendations

### Detection Strategy Decision Matrix

| Quota Type | Detection Method | Trigger Point | Action |
|------------|------------------|---------------|--------|
| **Storage** | PostgreSQL query (`pg_database_size()`) | ≥95% of 500MB | Pause auto-sync |
| **Storage (fallback)** | Client-side estimate | ≥95% of 500MB | Pause auto-sync + show warning |
| **Rate Limit** | HTTP 429 + headers | Rate limit exceeded | Pause for retry-after duration |
| **Rate Limit (proactive)** | Request throttling | 80% of limit/min | Slow down requests |
| **Payload Size** | HTTP 413 | Single request too large | Reduce batch size |

### Implementation Checklist

- [ ] Create `quota-detector.js` module with `SupabaseQuotaDetector` class
- [ ] Add `get_database_size()` SQL function to migration script
- [ ] Implement rate limiter for proactive throttling
- [ ] Add quota checking before each auto-sync operation
- [ ] Handle HTTP 429, 413, 507 error codes in sync engine
- [ ] Track upload sizes for client-side quota estimation
- [ ] Show quota status in sync settings UI (progress bar)
- [ ] Display quota warnings/errors via Chrome notifications
- [ ] Add manual sync override when auto-sync paused
- [ ] Implement selective sync (date range filter) for quota management
- [ ] Log quota errors for debugging
- [ ] Test quota detection with simulated limits

### Key Insights

1. **No Direct API**: Supabase free tier has no `/quota/usage` endpoint - must rely on PostgreSQL queries + error signals
2. **Multi-Layer Defense**: Combine proactive checks (PostgreSQL query), reactive detection (error codes), and rate limiting
3. **95% Threshold**: Pause auto-sync at 95% to give users time to act before hitting hard 100% limit
4. **User Communication**: Clear warnings + actionable guidance (upgrade, delete data, manual sync)
5. **Graceful Degradation**: Reduce frequency at 80%, pause at 95%, allow manual override
6. **Rate Limiting**: Proactive throttling (50 req/min) prevents hitting rate limits before they trigger

### Next Steps

1. Implement `quota-detector.js` module
2. Add SQL function to migration script for database size query
3. Integrate quota checking into sync engine auto-sync flow
4. Create UI components to display quota status
5. Test with simulated quota scenarios (mock 429/507 responses)
6. Document quota management for users in quickstart guide

---

**End of Research Document**
