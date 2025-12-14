# Chat Memo Pro - Cloud Sync Troubleshooting Manual

**Version**: 1.3.0
**Last Updated**: December 14, 2025

---

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Common Issues](#common-issues)
3. [Account & Project Switching](#account--project-switching)
4. [Debugging Tools](#debugging-tools)
5. [Error Codes Reference](#error-codes-reference)
6. [Data Recovery](#data-recovery)
7. [Performance Optimization](#performance-optimization)
8. [FAQ](#faq)

---

## Quick Diagnostics

### Check Sync Status

1. Open the extension sidebar
2. Scroll to "Sync Status" section
3. Look for:
   - **Status**: Should be "Connected (Idle)" when ready
   - **Pending**: Should show "0 failed, 0 deletes" after successful sync
   - **Last sync**: Shows timestamp of last successful sync
   - **Total conversations**: "X local / Y cloud" counts

### View Detailed Logs

**Method 1: Service Worker Console (Recommended)**
1. Go to `chrome://extensions/`
2. Find "Chat Memo Pro"
3. Click "Service worker" (under "Inspect views")
4. Look for logs starting with `Sync:`

**Method 2: Sidebar Console**
1. Right-click on the extension sidebar
2. Select "Inspect"
3. Go to Console tab
4. Check for sync-related messages

---

## Common Issues

### Issue 1: "No changes to sync" but conversations not in cloud

**Symptoms:**
- Local shows 17 conversations
- Cloud shows 0 conversations
- Sync says "Already up to date"

**Cause:** Sync cursors remember what was already synced. If you switched Supabase accounts/projects, cursors weren't reset.

**Solution:**
```javascript
// In Service Worker Console:
// 1. Clear cursors manually
await chrome.storage.local.get('cloudSync', (result) => {
  const cloudSync = result.cloudSync || {};
  cloudSync.cursors = {};
  chrome.storage.local.set({ cloudSync }, () => {
    console.log('Cursors cleared. Click Sync Now.');
  });
});
```

**Prevention:** v1.3.0+ automatically detects account switches and resets cursors.

---

### Issue 2: Message timestamp error (HTTP 400)

**Symptoms:**
```
Error: date/time field value out of range: "1765298468942"
```

**Cause:** Messages stored timestamp as Unix milliseconds instead of ISO string.

**Solution:** Already fixed in v1.3.0. The `getLocalMessageTime()` function now automatically converts:
- Numeric timestamps → ISO strings
- String timestamps that look like milliseconds → ISO strings

**If still occurring:**
1. Check extension version (should be 1.3.0+)
2. Reload extension at `chrome://extensions/`
3. Try sync again

---

### Issue 3: Conversation upsert conflict (HTTP 500)

**Symptoms:**
```
Error: ON CONFLICT DO UPDATE command cannot affect row a second time
```

**Cause:** Multiple local conversations have identical `(platform, platform_conversation_id)` in a single batch.

**Solution:** Already fixed in v1.3.0. The `upsertConversations()` function now deduplicates before sending.

**If still occurring:**
```javascript
// In Service Worker Console:
// Check for duplicate conversation IDs
const db = await indexedDB.open('KeepAIMemoryDB', 1);
const tx = db.transaction('conversations', 'readonly');
const store = tx.objectStore('conversations');
const all = await store.getAll();

// Group by platform + externalId/link
const groups = new Map();
all.forEach(conv => {
  const key = `${conv.platform}|${conv.externalId || conv.link}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(conv);
});

// Find duplicates
for (const [key, convs] of groups) {
  if (convs.length > 1) {
    console.log(`Duplicate: ${key}`, convs);
  }
}
```

---

### Issue 4: Sync stuck in "Syncing" state

**Symptoms:**
- Status shows "Syncing (Manual)" or "Syncing (Auto)" for >5 minutes
- No progress in logs
- Can't trigger new sync

**Cause:** Previous sync crashed without releasing lock.

**Solution:**
```javascript
// In Service Worker Console:
// Force reload the extension
chrome.runtime.reload();
```

Or restart Chrome completely.

---

### Issue 5: Auto-sync not working

**Symptoms:**
- Auto-sync enabled but never runs
- "Next sync" time keeps updating but no sync happens

**Possible Causes & Solutions:**

**A. Chrome idle detection:**
```javascript
// Check idle state
chrome.idle.queryState(60, (state) => {
  console.log('Idle state:', state);
  // Should be 'active' for auto-sync to work
});
```

**B. Auto-sync disabled by error:**
```javascript
// Check auto-sync setting
await chrome.storage.local.get('cloudSync', (result) => {
  console.log('Auto-sync enabled:', result.cloudSync?.settings?.autoSyncEnabled);
  console.log('Last error:', result.cloudSync?.state?.lastErrorCode);
});
```

**C. Alarm not scheduled:**
```javascript
// Check if alarm exists
chrome.alarms.get('cloudSync-auto', (alarm) => {
  if (alarm) {
    console.log('Alarm scheduled for:', new Date(alarm.scheduledTime));
  } else {
    console.log('No alarm found. Try disabling and re-enabling auto-sync.');
  }
});
```

---

## Account & Project Switching

### Switching Supabase Accounts

**Scenario:** You want to sync to a different Supabase account (different user).

**Steps:**
1. **Sign out** from current account (in extension settings)
2. **Sign in** with new credentials
3. **First sync** will:
   - Detect user change (different userId)
   - Automatically reset cursors
   - Upload all local conversations to new account

**What happens to old cloud data?**
- Data in old account remains untouched
- Only accessible if you sign back in

---

### Switching Supabase Projects

**Scenario:** You want to use a different Supabase project (same or different account).

**Steps:**
1. **Update configuration**:
   - Enter new Project URL
   - Enter new API Key (anon/public)
2. **Test connection** (click "Test Connection")
3. **Sign in** to the new project
4. **First sync** will:
   - Detect project change (different projectUrl)
   - Automatically reset cursors
   - Upload all local conversations to new project

---

### Merging Data from Multiple Sources

**Scenario:** You have conversations in two different Supabase projects and want to merge them.

**Option 1: Export & Import (Recommended)**
1. **From old project**:
   - Use "Replace Local with Cloud" to download all cloud data
   - Export using Export Wizard → JSON format
2. **Switch to new project**:
   - Configure new Supabase settings
   - Import JSON (feature to be added) OR manually re-save conversations

**Option 2: Database-level merge**
1. Use Supabase SQL Editor
2. Export from old project: `COPY conversations TO ...`
3. Import to new project: `COPY conversations FROM ...`
4. Handle user_id conflicts manually

---

## Debugging Tools

### View Full Sync State

```javascript
// In Service Worker Console:
chrome.storage.local.get('cloudSync', (result) => {
  console.log('Full cloudSync state:', JSON.stringify(result.cloudSync, null, 2));
});
```

### Monitor Sync in Real-Time

```javascript
// In Service Worker Console:
// Add listener for storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.cloudSync) {
    console.log('Sync state changed:', changes.cloudSync.newValue?.state);
  }
});
```

### Check Local Conversation Count

```javascript
// In Sidebar Console:
const request = indexedDB.open('KeepAIMemoryDB', 1);
request.onsuccess = (event) => {
  const db = event.target.result;
  const tx = db.transaction('conversations', 'readonly');
  const store = tx.objectStore('conversations');
  const countRequest = store.count();
  countRequest.onsuccess = () => {
    console.log('Local conversations:', countRequest.result);
  };
};
```

### Check Cloud Conversation Count

```javascript
// In Service Worker Console:
// Assuming you have auth set up
const config = await chrome.storage.local.get('cloudSync');
const auth = config.cloudSync.auth;
const projectUrl = config.cloudSync.config.projectUrl;
const anonKey = config.cloudSync.config.anonKey;

const response = await fetch(
  `${projectUrl}/rest/v1/conversations?select=id&limit=1`,
  {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${auth.accessToken}`,
      'Prefer': 'count=exact'
    }
  }
);

const contentRange = response.headers.get('content-range');
console.log('Cloud conversations:', contentRange.split('/')[1]);
```

### Force Full Re-sync

```javascript
// In Service Worker Console:
// This sets cursors to epoch, forcing all data to sync again
await chrome.storage.local.get('cloudSync', (result) => {
  const cloudSync = result.cloudSync || {};
  cloudSync.cursors = {
    conversationsUpdatedAt: '1970-01-01T00:00:00.000Z',
    messagesUpdatedAt: '1970-01-01T00:00:00.000Z',
    lastSyncedUserId: cloudSync.cursors?.lastSyncedUserId,
    lastSyncedProjectUrl: cloudSync.cursors?.lastSyncedProjectUrl
  };
  chrome.storage.local.set({ cloudSync }, () => {
    console.log('Cursors reset to epoch. Click Sync Now for full re-sync.');
  });
});
```

---

## Error Codes Reference

### TEST_ERROR_CODE (Connection Testing)

| Code | Meaning | Common Causes | Solutions |
|------|---------|---------------|-----------|
| `InvalidConfig` | Project URL or API Key missing/invalid | Empty fields, wrong format | Check config, ensure URL starts with `https://` and includes `.supabase.co` |
| `InvalidCredentials` | Email/password incorrect | Wrong credentials, user not created | Double-check email/password, create user in Supabase Auth |
| `AuthRequired` | Session expired | Token expired, logged out | Sign in again |
| `MissingTables` | Database tables not created | Migration not run | Run migration.sql in Supabase SQL Editor |
| `RlsDenied` | Row-Level Security blocking access | RLS policies incorrect | Check RLS policies in Supabase |
| `NetworkError` | Network connectivity issue | No internet, firewall | Check internet connection |
| `Timeout` | Request took too long | Slow connection, large data | Retry, check connection speed |

### SYNC_ERROR_CODE (During Sync)

| Code | Meaning | Auto-Sync Behavior | User Action |
|------|---------|-------------------|-------------|
| `AuthRequired` | Session expired during sync | Disabled | Sign in again |
| `CloudLimit` | Supabase rate limit or quota exceeded | Disabled | Wait, upgrade Supabase plan, or reduce sync frequency |
| `NetworkError` | Network issue during sync | Continues (retries on next cycle) | Check internet |
| `Timeout` | Sync request timeout | Continues (retries on next cycle) | Check connection, reduce batch size |
| `SchemaMismatch` | Cloud schema version incompatible | Disabled | Update extension or run new migration |
| `LocalQuotaExceeded` | Chrome storage quota full | Disabled | Delete old conversations, increase quota |
| `Unknown` | Unexpected error | Continues but may keep failing | Check logs, report bug |

---

## Data Recovery

### Scenario 1: Accidentally deleted conversations locally

**If you have cloud sync enabled:**
1. **Option A: Replace Local with Cloud**
   - Go to Cloud Sync settings
   - Click "Replace Local with Cloud"
   - Confirms that local data will be erased
   - Downloads all cloud data

2. **Option B: Force re-download**
   ```javascript
   // In Service Worker Console:
   // Clear local database
   const deleteRequest = indexedDB.deleteDatabase('KeepAIMemoryDB');
   deleteRequest.onsuccess = () => {
     console.log('Database deleted. Reload extension and sync.');
     chrome.runtime.reload();
   };
   ```

**If you don't have cloud sync:**
- Check Export Wizard backups
- Check browser cache (may have old data)
- Data likely unrecoverable

---

### Scenario 2: Cloud data corrupted or lost

**If you have local data:**
1. **Force full upload**
   ```javascript
   // Reset cursors to force upload all local data
   await chrome.storage.local.get('cloudSync', (result) => {
     const cloudSync = result.cloudSync || {};
     cloudSync.cursors = {
       lastSyncedUserId: cloudSync.cursors?.lastSyncedUserId,
       lastSyncedProjectUrl: cloudSync.cursors?.lastSyncedProjectUrl
     };
     chrome.storage.local.set({ cloudSync });
   });
   ```
2. Click "Sync Now"

**If both local and cloud lost:**
- Check Export Wizard backups (downloaded files)
- Check Supabase daily backups (if enabled in Supabase project settings)

---

### Scenario 3: Sync conflicts

**How conflicts are handled:**
- **Last-Write-Wins (LWW)**: Compares `updated_at` timestamps
- Newer timestamp wins
- Conflict counted in "Warnings" but data not lost

**View conflict warnings:**
```javascript
// In Service Worker Console after sync:
chrome.storage.local.get('cloudSync', (result) => {
  const history = result.cloudSync.history || [];
  const latestSync = history[0];
  console.log('Latest sync warnings:', latestSync?.warnings);
});
```

**Manually resolve conflicts:**
1. Export both local and cloud data
2. Compare manually
3. Decide which to keep
4. Use "Replace Local with Cloud" or force upload

---

## Performance Optimization

### Large Conversation Collections (>1000 conversations)

**Symptoms:**
- Sync takes >5 minutes
- Browser becomes slow during sync
- Timeouts occur

**Optimizations:**

1. **Reduce batch sizes** (for advanced users):
   ```javascript
   // In sync-config.js (requires editing source code):
   CONVERSATION_BATCH_SIZE: 50,  // Default: 100
   MESSAGE_BATCH_SIZE: 200,      // Default: 500
   ```

2. **Increase timeout**:
   ```javascript
   // In sync-config.js:
   REQUEST_TIMEOUT_MS: 60000,    // Default: 30000 (30s)
   ```

3. **Sync less frequently**:
   - Disable auto-sync during active work
   - Enable only when idle
   - Use manual sync instead

4. **Archive old conversations**:
   - Export old conversations
   - Delete from local/cloud
   - Reduces sync payload

---

### Network Optimization

**For slow connections:**

1. **Sync during off-peak hours**:
   - Schedule auto-sync for night time
   - Use manual sync when connection is good

2. **Compress data** (future feature):
   - Enable gzip compression
   - Reduces bandwidth usage by ~70%

3. **Incremental sync only**:
   - Avoid "Force Full Re-sync"
   - Only sync changed conversations

---

### Database Optimization

**Supabase side:**

1. **Add indexes** (if not already present):
   ```sql
   -- In Supabase SQL Editor:
   CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
     ON conversations(user_id, updated_at);

   CREATE INDEX IF NOT EXISTS idx_messages_updated_at
     ON messages(user_id, updated_at);
   ```

2. **Vacuum database** (for PostgreSQL health):
   ```sql
   VACUUM ANALYZE conversations;
   VACUUM ANALYZE messages;
   ```

**Extension side:**

1. **Compact IndexedDB**:
   ```javascript
   // No direct API, but Chrome auto-compacts
   // Workaround: Export → Delete DB → Import
   ```

---

## FAQ

### Q1: Can I use the same Supabase project on multiple devices?

**A:** Yes! That's the main purpose of cloud sync. Install the extension on each device, configure with the same Supabase project, and sign in with the same account.

---

### Q2: What happens if two devices sync at the same time?

**A:**
- Each device syncs independently
- Last-Write-Wins (LWW) resolves conflicts
- Both devices eventually converge to same state
- May see warnings in sync history

---

### Q3: How much does Supabase cost?

**A:**
- **Free tier**: 500MB database, 2GB bandwidth/month
- **Pro tier**: $25/month for 8GB database, 50GB bandwidth
- For typical usage (100 conversations, ~10MB total), free tier is sufficient

---

### Q4: Can I backup my Supabase database?

**A:** Yes, multiple options:

1. **Supabase built-in backups** (Pro plan):
   - Daily backups retained for 7 days
   - Point-in-time recovery

2. **Manual export**:
   ```sql
   -- In Supabase SQL Editor:
   COPY (SELECT * FROM conversations WHERE user_id = 'your-user-id')
   TO '/path/to/backup.csv' CSV HEADER;
   ```

3. **Extension Export Wizard**:
   - Export all conversations to JSON/Markdown
   - Store locally or in cloud storage (Dropbox, Google Drive)

---

### Q5: Is my data encrypted?

**A:**
- **In transit**: Yes, HTTPS/TLS encryption
- **At rest**: Depends on Supabase plan
  - Free tier: Not encrypted
  - Pro tier: Optional encryption at rest
- **Row-Level Security (RLS)**: Yes, your data only visible to you

**For extra security:**
- Use strong Supabase password
- Enable 2FA on Supabase account
- Don't share API keys

---

### Q6: Can I self-host instead of using Supabase?

**A:** Yes, with modifications:

1. **Use Supabase self-hosted**:
   - Follow [Supabase self-hosting guide](https://supabase.com/docs/guides/self-hosting)
   - Point extension to your self-hosted URL

2. **Use alternative backend** (requires code changes):
   - Implement same API as `supabase-client.js`
   - Replace PostgreSQL with your preferred database
   - Maintain same data schema

---

### Q7: What happens if I uninstall the extension?

**Local data:**
- IndexedDB is deleted automatically by Chrome
- Unrecoverable unless you have exports

**Cloud data:**
- Remains in Supabase
- Accessible by re-installing extension and signing in
- Or query directly via Supabase dashboard

**Recommendation:** Export data before uninstalling!

---

### Q8: Can I migrate from old version without cloud sync?

**A:** Yes:

1. Update to v1.3.0
2. All local data is preserved
3. Configure cloud sync (optional)
4. First sync uploads all existing conversations
5. No data loss

---

### Q9: Why does sync show "0 failed" but some conversations missing in cloud?

**Possible causes:**

1. **Cursors issue**: Conversations synced before, cursors not reset
   - Solution: Clear cursors (see [Issue 1](#issue-1-no-changes-to-sync-but-conversations-not-in-cloud))

2. **RLS policy blocking**: User doesn't have permission
   - Check Supabase logs for RLS denials

3. **Conversations deleted in cloud**: Someone/something deleted them
   - Check `deleted_at` field in Supabase

4. **Different account**: Viewing wrong Supabase account/project
   - Verify userId matches in logs

---

### Q10: How do I completely reset cloud sync?

**Full reset (nuclear option):**

```javascript
// 1. Sign out
// (via UI or console)

// 2. Clear all cloud sync data
chrome.storage.local.remove('cloudSync', () => {
  console.log('Cloud sync data cleared');
});

// 3. (Optional) Delete cloud data in Supabase:
// Go to Supabase dashboard → Table Editor → conversations
// Delete all rows for your user_id

// 4. Reload extension
chrome.runtime.reload();

// 5. Reconfigure and sign in again
```

---

## Getting Help

If you're still experiencing issues after trying the solutions above:

1. **Check Service Worker logs** for detailed error messages
2. **Check Supabase logs** in your project dashboard
3. **Export your data** before trying advanced fixes
4. **Report bugs** with:
   - Extension version
   - Error message from logs
   - Steps to reproduce
   - Sync status screenshot

---

**End of Troubleshooting Manual**

For feature requests and technical specifications, see:
- [specs/002-cloud-sync/spec.md](./specs/002-cloud-sync/spec.md)
- [specs/002-cloud-sync/contracts/](./specs/002-cloud-sync/contracts/)
