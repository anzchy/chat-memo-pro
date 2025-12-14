# chrome.storage.local Schema (Cloud Sync)

All keys are stored under a single root object to avoid key sprawl:

`cloudSync` (object)

## cloudSync.config

- `projectUrl` (string)
- `anonKey` (string)
- `email` (string, optional)

Notes:
- Password is never stored.
- Secrets (anonKey, tokens) must not be logged.

## cloudSync.auth

- `accessToken` (string)
- `refreshToken` (string)
- `expiresAt` (string, ISO timestamp)
- `userId` (string, Supabase auth user id)

## cloudSync.settings

- `autoSyncEnabled` (boolean)
- `syncIntervalMinutes` (number)
- `verboseLogging` (boolean)

## cloudSync.cursors

Server `updated_at` watermarks:

- `conversationsUpdatedAt` (string, ISO timestamp)
- `messagesUpdatedAt` (string, ISO timestamp)

## cloudSync.state

- `status` (string; sync state machine label)
- `pausedReason` (string, optional)
- `lastErrorCode` (string, optional)
- `lastErrorAt` (string, ISO timestamp, optional)

## cloudSync.history

Array of up to 20 `SyncHistoryEntry` objects (see `contracts/ui-contract.md`).

## cloudSync.pending

Optional checkpoint for resume:

- `inProgress` (boolean)
- `direction` (string)
- `lastProgress` (object; last `SyncProgressEvent`)
- `failedItemKeys` (array of strings, optional)

