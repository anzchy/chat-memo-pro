# Sync API Contract

This describes the expected interface between UI/background and the sync engine. Names are illustrative; implementations may vary.

## SyncEngine

- `testConnection(config): Promise<TestResult>`
  - Validates URL/key format, validates auth session, verifies required tables exist and are accessible under RLS.
- `signIn(email, password): Promise<void>`
- `signOut(): Promise<void>`
  - Clears auth session, disables auto-sync, transitions to `Not Configured`.

- `syncNow(options?): Promise<SyncResult>`
  - Runs a two-way incremental sync using stored cursors.
  - Enforces single-flight lock.
  - Emits progress updates via `options.onProgress` (if provided) and/or a runtime event channel.

- `downloadFromCloud(options?): Promise<SyncResult>`
  - Downloads and merges remote data into local storage.

- `uploadToCloud(options?): Promise<SyncResult>`
  - Uploads local changes to cloud (idempotent upsert).

- `replaceLocalWithCloud(): Promise<SyncResult>`
  - Requires explicit confirmation in UI; wipes local conversations/messages and then downloads.

- `resetSyncState(): Promise<void>`
  - Clears cursors and sync history (does not delete conversations).

- `forceFullResync(): Promise<void>`
  - Sets cursors to epoch to force a full reconcile on next run.

## Result Shapes

### TestResult

`TestResult`: `{ ok: boolean, errorCode?: TestErrorCode, message?: string }`

`TestErrorCode` (enumerated):
- `InvalidConfig` (invalid URL/key format)
- `InvalidCredentials` (sign-in failed)
- `AuthRequired` (session expired / refresh failed)
- `MissingTables` (schema migration not applied)
- `RlsDenied` (authenticated but RLS blocks access unexpectedly)
- `NetworkError` (offline/DNS/connection failure)
- `Timeout`
- `Unknown`

### SyncResult

`SyncResult`: `{ ok: boolean, direction: "upload"|"download"|"two-way", synced: number, failed: number, warnings: number, startedAt: string, finishedAt?: string, errorCode?: SyncErrorCode }`

`SyncErrorCode` (top-level failures):
- `AuthRequired`
- `CloudLimit`
- `NetworkError`
- `Timeout`
- `SchemaMismatch`
- `LocalQuotaExceeded`
- `Unknown`

## Progress Events (FR-017)

To support real-time status like `"Syncing... X of Y conversations (Z%)"`, sync operations MUST expose progress events.

### Callback Mode

`options.onProgress?: (event: SyncProgressEvent) => void`

### Event Channel Mode (UI ↔ Background)

When sync runs in the background service worker, progress MAY also be broadcast to the UI over a long-lived `chrome.runtime.Port` (recommended) or via `chrome.runtime.sendMessage` events.

### SyncProgressEvent

Minimal required shape (implementations may add fields):

`SyncProgressEvent`: `{ phase: "prepare"|"upload"|"download"|"merge"|"finalize", scope: "conversations"|"messages", done: number, total: number, direction: "upload"|"download"|"two-way" }`

