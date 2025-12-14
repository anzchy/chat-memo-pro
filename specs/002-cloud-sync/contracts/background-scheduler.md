# Background Scheduler Contract (Auto-Sync)

This defines how auto-sync runs in a Manifest V3 service worker.

## Triggers

- **Manual**: UI sends a runtime message → background calls `SyncEngine.syncNow({ reason: "manual" })`.
- **Auto**: `chrome.alarms` fires → background calls `SyncEngine.syncNow({ reason: "auto" })`.

## Alarm Model

- Alarm name: `cloudSync.autoSync`
- Schedule:
  - Enabled when `autoSyncEnabled === true` and user is signed in.
  - Period is `syncIntervalMinutes` (min 5, max 1440).
  - Interval changes take effect after the current run completes.

## Idle/Active Gating

- Before starting an auto-sync run, background checks `chrome.idle.queryState()`.
- If state is not `active`, auto-sync is skipped (no retry storm) and will run on the next alarm when active.

## Single-Flight Lock (FR-028)

- Background owns the sync lock.
- If a run is in progress:
  - Auto trigger: skip.
  - Manual trigger: respond with "Sync already in progress" (or queue one follow-up run; choose one behavior and keep it consistent).

## Service Worker Lifecycle

- Background work is best-effort; the service worker may be suspended between events.
- Sync MUST persist:
  - cursors (server `updated_at` watermarks)
  - last known sync state
  - history entry for in-progress runs (so it can be marked failed/aborted on next startup if needed)

## Progress Propagation

- Background publishes progress events via a `chrome.runtime.Port` channel:
  - Port name: `cloudSync.progress`
  - Messages: `SyncProgressEvent` (see `contracts/sync-api.md`)

## Pause States

- `Paused (Auth Required)`: set when token refresh fails; auto-sync remains disabled until re-auth.
- `Paused (Cloud Limit)`: set when quota/limit errors are detected; auto-sync remains disabled until user retries successfully or resets state.

