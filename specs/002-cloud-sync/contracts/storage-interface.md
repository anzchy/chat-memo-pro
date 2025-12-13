# Storage Interface Contract

The sync layer treats local storage and cloud storage as separate concerns. Local writes must be transactional; cloud writes must be idempotent.

## Local Storage (SyncStorage)

- `getLocalCounts(): Promise<{ conversations: number, messages: number }>`
- `getCursors(): Promise<{ conversationsUpdatedAt?: string, messagesUpdatedAt?: string }>`
- `setCursors(cursors): Promise<void>`
  - Must only be called after successful merge.

- `exportLocalChanges(cursors): Promise<{ conversations: ConversationRow[], messages: MessageRow[] }>`
  - Returns rows changed since cursor watermarks.

- `mergeFromCloud(payload): Promise<{ merged: number, skippedInvalid: number }>`
  - Must be idempotent.
  - Invalid rows are skipped and counted.

- `applyTombstones(payload): Promise<void>`
  - Applies `deleted_at` tombstones for conversations/messages.

- `replaceLocalWithCloud(payload): Promise<void>`
  - Wipes local conversations/messages then merges all cloud data.

## Cloud Storage (SupabaseClient)

- `selectConversationsSince(updatedAt, limit): Promise<ConversationRow[]>`
- `selectMessagesSince(updatedAt, limit): Promise<MessageRow[]>`
- `upsertConversations(rows): Promise<void>`
- `upsertMessages(rows): Promise<void>`

## Error Handling Contract

Local/cloud operations MUST surface typed errors so the UI can map them to user-facing messages and state transitions.

### Error Types (Minimum)

- `NetworkError`: offline/DNS/connection failure
- `Timeout`: request exceeded timeout budget
- `AuthRequired`: session expired / refresh failed
- `InvalidCredentials`: sign-in failed
- `MissingTables`: required tables do not exist
- `RlsDenied`: authenticated but access denied under RLS
- `SchemaMismatch`: schema version mismatch (pause until resolved)
- `CloudLimit`: quota/limit reached (pause auto-sync until resolved)
- `LocalQuotaExceeded`: IndexedDB quota exceeded / write failed
- `CorruptedState`: cursor/state corruption requiring reset

### Required Behaviors

- `LocalQuotaExceeded` MUST surface an actionable error so the UI can show "Sync paused — local storage is full".
- `AuthRequired` MUST surface so the UI can show "Session expired — please sign in again" and keep auto-sync disabled until re-authenticated.
- `CloudLimit` MUST pause auto-sync until the user resolves the limit and retries.
