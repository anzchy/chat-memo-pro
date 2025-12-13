# Data Model: Cloud Sync

## Cloud Entities (Supabase Postgres)

### conversations

- Identity: `(user_id, platform, platform_conversation_id)` (unique)
- Core fields: `title`, `created_at`, `updated_at`, `synced_at`, `deleted_at`
- `metadata` (JSON): conversation-level platform-specific data (no messages)

### messages

- Identity: `(user_id, message_key)` (unique)
- Location fields: `platform`, `platform_conversation_id`, `message_index`
- Content: `role`, `content_text`
- Lifecycle: `created_at`, `updated_at`, `deleted_at`
- `metadata` (JSON): message-level platform-specific data

#### message_key

Stable across devices:

- If platform provides a stable message id: `platform|platform_conversation_id|message_index|<platform_message_id>`
- Otherwise (deterministic fallback): `platform|platform_conversation_id|message_index|sha256(role + "\\n" + normalized_content_text)`

`message_index` is used for ordering; deduplication is based on `message_key`.

#### normalized_content_text (Hash Input Normalization)

To make the fallback hash deterministic across devices and browsers, `normalized_content_text` MUST be computed as:

1. Convert `content_text` to a string (`null`/`undefined` → `""`).
2. Normalize Unicode using `NFKC` (`text = text.normalize("NFKC")`).
3. Normalize line endings: replace `\r\n` and `\r` with `\n`.
4. Remove trailing whitespace at end-of-line: replace `/[ \t]+(?=\n)/g` with `""`.
5. Trim trailing whitespace at end-of-text: replace `/[ \t]+$/` with `""`.

Hashing requirements:

- Algorithm: SHA-256
- Input bytes: UTF-8 encoding of `role + "\n" + normalized_content_text`
- Output: lowercase hex string

This normalization intentionally does **not** collapse interior whitespace, so content differences remain distinguishable.

## Conflict Detection (Before Resolution)

### Message-Level Conflicts

Given the merge strategy is key-based:

- If the same `message_key` exists on both sides but `content_text` differs after normalization, treat as a conflict and keep the version with the newer `updated_at` (record a warning).
- If `deleted_at` differs, keep the newer `deleted_at` (tombstone wins if newer).

### Conversation Metadata Conflicts

- If both local and cloud conversation metadata changed since the last successful cursor and the field values differ (e.g., `title`), resolve per-field via newer `updated_at` (record a warning).

## Local Entities (Extension)

Local capture remains the source of truth for raw extraction. Sync adds:

- Sync cursors (server watermarks): last successful `updated_at` for `conversations` and `messages`
- Per-message linkage: local message records store/derive `message_key` for idempotent upserts
- Tombstones: local deletions map to `deleted_at` in cloud, and cloud tombstones are applied locally

## Cursors & Incremental Sync

- Cursor type: server `updated_at` watermark per table
- Cursor persistence: stored in `chrome.storage.local` (or IndexedDB metadata store)
- Cursor advancement: only after the corresponding batch is successfully merged into local storage
