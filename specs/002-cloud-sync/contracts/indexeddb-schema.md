# IndexedDB / Local Data Extensions (Non-Migrating)

This project stores conversations in IndexedDB via existing storage code. For MVP, we avoid hard schema migrations and only add optional fields to stored objects.

## Conversation Object (existing) additions

Recommended optional fields:

- `cloudSync` (object)
  - `syncedAt` (string, ISO timestamp, optional)
  - `deletedAt` (string, ISO timestamp, optional) — local tombstone mirror of `deleted_at`

## Message Object (existing) additions

Recommended optional fields:

- `messageKey` (string, optional) — computed stable key used for idempotent upserts
- `deletedAt` (string, ISO timestamp, optional)

## Field Mapping (Local → Cloud)

- `platform` → `platform`
- local conversation id/url key → `platform_conversation_id`
- local message order/position → `message_index`
- local sender (`user`/`assistant`) → `role`
- local message text → `content_text`

## Cursor Storage

Sync cursors (server `updated_at` watermarks) are stored in `chrome.storage.local` per `contracts/chrome-storage-schema.md`. IndexedDB does not need new object stores for MVP.

