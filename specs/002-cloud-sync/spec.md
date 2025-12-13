# Feature Specification: Cloud Sync with Supabase

**Feature Branch**: `002-cloud-sync`
**Created**: 2025-12-13
**Status**: Draft
**Input**: User description: "在/specs 下方新增第二个 feature: 002-add-cloud-sync，选择用 SUPABASE 来同步所有的 chat message，支持增量同步和定期同步，统一用"表格（数据库）+ JSON 元数据"做主存储，Markdown 作为导出视图。我希望在 Settings中 Export Data下方增加同步相关的配置，譬如增加一个 button，之后弹出如何配置 SUPABASE 的一些选项。或者 右键点击 chat memo Pro的插件图标，有单独的页面做配置。看看你用什么方式比较好。其次，关于 SUPABASE的一些设置，有哪些需要我确认，给出问题清单"

## Clarifications

### Session 2025-12-13

- Q: Who creates the Supabase database schema (conversations and messages tables)? → A: Setup process provides schema migration SQL that users run manually in Supabase Dashboard during first-time configuration, with verification afterward
- Q: What is the format/composition of message stable keys for conflict-free merging? → A: Composite key: (platform, platform_conversation_id, message_index, platform_message_id_if_available)
- Q: How long do authentication sessions persist, and when do users need to re-authenticate? → A: Persistent session with refresh token - users stay signed in across browser restarts, session refreshes automatically until explicitly signed out

## Definitions & Limits

### Definitions (Unambiguous Terms)

- **Changed conversations**: Any conversation that has (a) a new message, (b) a message updated/deleted, (c) conversation metadata changed (e.g., title), or (d) `deleted_at` changed, where the corresponding cloud row(s) would have `updated_at > last_successful_cursor`.
- **Sync cursor / watermark**: The last successfully processed **server-side** `updated_at` value for each synced table (`conversations`, `messages`). Cursors are stored locally and only advanced after a successful merge into local storage.
- **Browser idle / active**: Uses `chrome.idle` state. Sync runs only when state is `active`. If state becomes `idle` or `locked`, auto-sync pauses and resumes on next `active`.
- **Network interruption**: Any fetch failure due to (a) timeout, (b) DNS/connection failure, (c) offline, or (d) transient 5xx. Detected by fetch rejection, `AbortController` timeout, or HTTP status codes.
- **Quota/limit errors**: Errors indicating the project cannot accept requests due to limits, including (at minimum) HTTP `413`, `429`, `503`, or Supabase/PostgREST error bodies that explicitly indicate quota/rate/payload limits.
- **Extension closed**: The extension UI (side panel) may be closed and the MV3 service worker may be suspended; auto-sync is best-effort and resumes on next scheduled wake (alarm) when the browser is active.

### Limits (MVP Defaults)

- **Batch sizes**:
  - Conversations: 100 rows per page (matches FR-019).
  - Messages: 500 rows per page (to avoid oversized payloads).
- **"Large" sync operation**: any run involving >1,000 conversations or >10,000 messages (UI should prefer summarized progress).
- **Timeouts**:
  - Per HTTP request: 30 seconds.
  - Per sync run (manual/auto): 10 minutes; then fail with a timeout error and allow retry.
- **Normal network conditions (for SC-004 measurement)**: ≥10 Mbps down/up, latency ≤200ms, no forced throttling in DevTools.
- **Progress updates**: UI updates at least once per batch (not per message).
- **Auto-sync interval**: minimum 5 minutes, maximum 24 hours, default 15 minutes.
- **Size limits** (to avoid quota/413 issues):
  - `messages.content_text`: max 200KB per message (truncate with warning in verbose logs).
  - `messages.metadata`: max 32KB JSON per message (drop oversized optional fields such as raw HTML; keep a warning).
  - `conversations.metadata`: max 64KB JSON per conversation.

### Retry Policy (Retryable vs Non-Retryable)

- **Retryable** (subject to FR-020 backoff): network failures, request timeouts, HTTP `408`, `429`, and `5xx`.
- **Non-retryable**: invalid sign-in credentials, HTTP `401/403` auth/RLS failures, missing tables/schema errors, and schema version mismatch.

### Platform-Specific Metadata (JSON Structure)

`metadata` MUST be a JSON object. Reserved keys (if present):

- `source_url` (string): canonical conversation URL
- `platform_message_id` (string|null): raw platform message id when available
- `capture_method` (string): `selector` | `heuristic` | `fallback`
- `extractor_version` (string): extension version that captured the data
- `raw_html` (string, optional): only if within size limits (may be dropped)

### Required Cloud Schema

- The required schema migration SQL lives at `specs/002-cloud-sync/contracts/supabase-schema.sql`.
- Supporting docs live at `specs/002-cloud-sync/contracts/rls-best-practices.md` and `specs/002-cloud-sync/contracts/rls-testing-guide.md`.
- Required tables (exact names): `conversations`, `messages`.
- Required columns (minimum):
  - `conversations`: `user_id`, `platform`, `platform_conversation_id`, `title`, `created_at`, `updated_at`, `synced_at`, `deleted_at`, `metadata`
  - `messages`: `user_id`, `platform`, `platform_conversation_id`, `message_key`, `message_index`, `role`, `content_text`, `created_at`, `updated_at`, `deleted_at`, `metadata`

### Configuration Validation Rules

- **Project URL**: must be HTTPS and match `https://*.supabase.co` (or a valid custom Supabase domain).
- **API key (anon/public)**: must be non-empty; stored as-is; never logged.
- **Email**: must contain `@` and a domain part.
- **Password**: must be non-empty (Supabase enforces its own policy).

### Connection Test (Exact Steps)

When user clicks "Test Connection", the system MUST:

1. Validate Project URL/API key format locally (no network call if invalid).
2. Validate Auth session by calling an authenticated endpoint (or refreshing token).
3. Verify required tables exist and are accessible under RLS by issuing a lightweight select against each table (e.g., `select=id&limit=1`), and returning:
   - Success if both tables respond `200` and RLS filters correctly.
   - "Tables not found — please run the SQL migration in Supabase first." if a table is missing.
   - "Session expired — please sign in again." on auth failures.
   - "Network error — check your connection and retry." on network failures/timeouts.

## Sync Model (Behavioral Contract)

### Sync State Machine

The system MUST expose these user-visible states in the Settings UI and transition deterministically:

- `Not Configured`: no project URL/key or not signed in
- `Connected (Idle)`: configured + signed in, no sync running
- `Syncing (Manual)` / `Syncing (Auto)`: a sync operation is running
- `Paused (Auth Required)`: session refresh failed; user must sign in again
- `Paused (Cloud Limit)`: quota/limit error detected; user must resolve and then retry
- `Error`: non-recoverable error (schema mismatch, corrupted state) until user takes recovery action

The system MUST prevent concurrent sync operations (single-flight lock). If manual sync is triggered while a sync is running, it MUST show "Sync already in progress" and not start a second run.

### Sync Priority (Manual vs Auto)

- Manual sync always has priority: auto-sync MUST NOT start if a manual sync is running.
- If manual sync is requested during auto-sync, the request MUST be queued as a single follow-up run (or show "Sync already in progress" and require user retry); the behavior MUST be consistent and documented in UI.

## Non-Goals (MVP)

- No real-time sync (no realtime subscriptions).
- No sync cancellation mid-run (user can close the UI; sync continues best-effort in background).
- No syncing of binary attachments (images/files). Only text + JSON metadata are synced.
- No precise Supabase quota percentage reporting; only error-based detection (FR-023).
- No platform/date-range selective sync in MVP (sync scope is "all conversations"); optional filters may be added later.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Initial Sync Setup (Priority: P1)

As a user who wants to access my AI conversations across multiple devices, I want to configure cloud sync with my credentials, so that my conversation history can be securely synchronized to cloud storage.

**Why this priority**: This is the foundation for all cloud sync functionality. Without configuration, no sync can occur. This establishes the secure connection between the extension and cloud storage.

**Independent Test**: Can be fully tested by opening sync configuration (via Settings panel or right-click context menu), entering valid credentials, testing connection, and verifying that the configuration is saved and connection status is displayed correctly.

**Acceptance Scenarios**:

1. **Given** user opens the extension Settings panel, **When** user scrolls to the "Export Data" section, **Then** a "Cloud Sync Settings" button appears directly below the export options
2. **Given** user clicks "Cloud Sync Settings", **When** the configuration modal opens, **Then** the modal displays: setup instructions with "Copy SQL" button for database schema migration script, fields for Project URL, API Key (anon/public), and a "Sign in" section (Supabase Auth email + password)
3. **Given** user has not yet run the migration SQL, **When** user clicks "Copy SQL" button, **Then** the complete schema migration SQL (CREATE TABLE statements for conversations and messages with RLS policies) is copied to clipboard with success feedback
4. **Given** user enters valid Supabase configuration and signs in successfully, **When** user clicks "Test Connection", **Then** the system verifies API access and checks that required tables (conversations, messages) exist, and displays either "Connection Successful" with green indicator or specific error message (e.g., "Tables not found - please run the SQL migration first")
5. **Given** connection test succeeds, **When** user saves configuration, **Then** configuration and auth session (including refresh token) are stored in `chrome.storage.local` and sync status changes from "Not Configured" to "Connected"
6. **Given** user has configured sync and closes browser, **When** user reopens browser and opens extension, **Then** user remains signed in (session persists) and sync status shows "Connected" without requiring re-authentication
7. **Given** user wants to revoke sync access, **When** user clicks "Sign Out" in sync settings, **Then** auth session is cleared, sync status changes to "Not Configured", and auto-sync is disabled
8. **Given** user right-clicks the extension icon, **When** the context menu appears, **Then** a "Sync Settings" option is available as an alternative access method to the configuration interface
9. **Given** user has not configured sync, **When** viewing sync status in Settings, **Then** status shows "Not Configured" with a prompt to set up sync

---

### User Story 2 - Manual Sync Trigger (Priority: P1)

As a user who has just completed important conversations, I want to manually trigger a sync to cloud storage, so that my latest conversations are immediately backed up without waiting for automatic sync.

**Why this priority**: This provides immediate value to users who want control over when their data syncs. It allows users to verify sync functionality works correctly before trusting automatic sync.

**Independent Test**: Can be fully tested by creating/modifying conversations locally, clicking the manual sync button, and verifying that new/modified conversations appear in the cloud database with correct timestamps and metadata.

**Acceptance Scenarios**:

1. **Given** sync is configured and user is on the Settings panel, **When** user clicks "Sync Now" button, **Then** a sync operation initiates immediately showing progress indicator
2. **Given** user has 5 new conversations since last sync, **When** manual sync completes, **Then** status shows "Synced 5 conversations" with timestamp of last sync
3. **Given** sync is in progress, **When** user views the sync status area, **Then** a progress indicator displays "Syncing... X of Y conversations"
4. **Given** sync completes successfully, **When** user checks cloud database, **Then** conversations exist in a `conversations` table and messages exist in a `messages` table, with platform-specific fields stored as JSON metadata where needed
5. **Given** sync encounters an error (network issue, auth failure), **When** sync fails, **Then** error message displays with specific reason and retry option
6. **Given** user has made no changes since last sync, **When** manual sync runs, **Then** status shows "Already up to date - no changes to sync"
7. **Given** a quota/limit error occurs during manual sync, **When** sync stops, **Then** status shows "Auto-sync paused — cloud limit reached" and the user is prompted to resolve the limit and retry
8. **Given** sync is interrupted (browser restart/extension reload/network loss), **When** user clicks "Sync Now" again, **Then** sync resumes from the last successful cursor without restarting from zero
9. **Given** some batches succeed and some fail, **When** manual sync completes with partial failures, **Then** the UI shows "Synced X, failed Y" and provides a "Retry Failed Items" action
10. **Given** user clicks "Sync Now" repeatedly while a sync is running, **When** the second click occurs, **Then** the system shows "Sync already in progress" and does not start a concurrent run

---

### User Story 3 - Automatic Incremental Sync (Priority: P2)

As a regular user of the extension, I want conversations to sync automatically at regular intervals, so that I don't have to remember to manually sync and my data is always backed up.

**Why this priority**: After manual sync works (P1), automatic sync provides hands-off experience. Incremental sync ensures efficiency by only syncing changes rather than all data every time.

**Independent Test**: Can be fully tested by configuring auto-sync interval, creating new conversations or modifying existing ones, waiting for the sync interval to elapse, and verifying that only changed conversations are synced to the cloud.

**Acceptance Scenarios**:

1. **Given** user enables auto-sync in settings, **When** user selects sync interval (5min, 15min, 30min, 1hr, or custom), **Then** automatic sync triggers at the specified interval while browser is active
2. **Given** last sync occurred 10 minutes ago, **When** user modifies an existing conversation, **Then** next auto-sync detects the change and syncs only the modified conversation (incremental)
3. **Given** user creates 3 new conversations, **When** auto-sync runs, **Then** only the 3 new conversations are uploaded, not the entire conversation database
4. **Given** auto-sync is enabled with 15-minute interval, **When** browser goes idle or extension is closed, **Then** sync pauses and resumes when browser becomes active again
5. **Given** incremental sync detects concurrent changes on two devices, **When** conflict occurs, **Then** the system merges messages by stable message key (no message loss) and resolves conversation-level metadata (e.g., title) using `updated_at` last-write-wins
6. **Given** user disables auto-sync, **When** sync interval elapses, **Then** no automatic sync occurs and only manual sync is available
7. **Given** auto-sync encounters a retryable network failure, **When** it retries 3 times and still fails, **Then** the failure is recorded in sync history and the next interval will attempt again (unless paused)
8. **Given** auto-sync encounters a non-retryable auth error (session refresh fails), **When** auto-sync stops, **Then** status becomes "Paused (Auth Required)" and auto-sync remains disabled until the user signs in again
9. **Given** user changes sync interval while an auto-sync run is active, **When** the run completes, **Then** the new interval applies starting from the next scheduled run (no mid-run restart)

---

### User Story 4 - Cross-Device Data Retrieval (Priority: P2)

As a user working across multiple devices, I want to retrieve my synced conversations from the cloud, so that I can access my conversation history from any device with the extension installed.

**Why this priority**: This completes the sync loop - after uploading (P1-P2), users need to download to realize cross-device benefits. This makes cloud sync truly useful.

**Independent Test**: Can be fully tested by syncing conversations from Device A, installing extension on Device B with same sync credentials, triggering download, and verifying that all conversations appear with correct content and metadata.

**Acceptance Scenarios**:

1. **Given** user installs extension on a new device, **When** user configures sync with existing credentials, **Then** a "Download from Cloud" button appears in sync settings
2. **Given** user clicks "Download from Cloud", **When** cloud has 100 conversations, **Then** all conversations download and populate local storage with progress indicator showing download status
3. **Given** both local and cloud have conversations, **When** user triggers sync, **Then** system performs two-way sync: uploads local changes and downloads remote changes
4. **Given** user has 50 conversations locally and 75 in cloud, **When** two-way sync completes, **Then** user has all conversations locally merged without duplicates based on `(platform, platform_conversation_id)` and message stable keys
5. **Given** download is interrupted (network failure), **When** user retries download, **Then** system resumes from last successful download point (not restart from beginning)
6. **Given** user wants to reset local data, **When** user selects "Replace Local with Cloud", **Then** system warns about data loss, requires confirmation, then wipes local storage and downloads fresh copy from cloud
7. **Given** local storage is full during download, **When** IndexedDB write fails, **Then** download pauses with "Sync paused — local storage is full" and auto-sync remains disabled until the user resolves it
8. **Given** cloud returns an invalid/corrupted row, **When** download merges data, **Then** the invalid row is skipped, counted as a warning in the operation log, and the sync continues

---

### User Story 5 - Sync Status Visibility (Priority: P3)

As a user relying on cloud sync, I want clear visibility into sync status and history, so that I know my data is safely backed up and can troubleshoot sync issues when they occur.

**Why this priority**: This is a quality-of-life enhancement that builds trust and provides transparency. While not blocking core functionality, it significantly improves user confidence in the sync system.

**Independent Test**: Can be fully tested by performing various sync operations (manual, auto, failed, successful) and verifying that sync history log shows accurate records with timestamps, operation types, and results.

**Acceptance Scenarios**:

1. **Given** user opens sync settings, **When** viewing the sync status section, **Then** current status displays: "Last synced: [timestamp]", "Next auto-sync: [timestamp or 'Disabled']", "Total conversations: X local / Y cloud"
2. **Given** user expands sync history, **When** history log appears, **Then** it shows last 20 sync operations with: timestamp, type (manual/auto), direction (upload/download/two-way), result (success/failed), and conversation count
3. **Given** sync failed due to auth error, **When** user views failed operation in history, **Then** error details expand showing specific error message and suggested action (e.g., "Session expired - please sign in again")
4. **Given** sync is currently running, **When** user views status, **Then** real-time progress shows: "Syncing... 45/100 conversations (45%)"
5. **Given** user has sync warnings (e.g., large data size, quota/limit reached), **When** viewing sync status, **Then** warning badges appear with actionable details like "Auto-sync paused: cloud limit reached"
6. **Given** user wants detailed sync logs for debugging, **When** user enables "Verbose Logging" in advanced settings, **Then** console logs include detailed sync operations with conversation IDs and timestamps

---

### Edge Cases

- **What happens when cloud database schema changes?** The sync system includes a schema version field in metadata. If local version mismatches cloud version, sync pauses and notifies user to update extension or run migration script.

- **How does the system handle very large conversation volumes (10,000+ conversations)?** Initial sync uses pagination with batches of 100 conversations. Progress indicator shows batch progress. IndexedDB locally handles unlimited storage, while cloud uses Supabase's pagination and connection pooling.

- **How does the system handle very large individual conversations (1000+ messages)?** Messages are paginated (500 per page). Progress is shown per batch. Oversized optional metadata fields (e.g., raw HTML) may be dropped with a warning to stay within size limits.

- **What if user exceeds Supabase free tier limits?** Sync detects quota/limit errors during upload/download (e.g., request rejected, rate limited, payload too large), shows a clear warning, and pauses auto-sync until the user resolves it (upgrade tier, delete data, or adjust sync scope).

- **What happens when same conversation is modified on two devices simultaneously?** Messages are merged by stable message keys (composite: platform + platform_conversation_id + message_index + platform_message_id if available) to avoid loss - same key means same message, different keys mean both messages are kept. Conversation-level metadata (e.g., title) uses `updated_at` last-write-wins when both sides changed the same field.

- **How does the system handle network interruptions during sync?** Sync operations use exponential backoff retry (3 attempts: 2s, 4s, 8s delay) for retryable failures. Failed operations log errors and allow manual retry. Cursor advancement is atomic (cursors only advance after successful merge), so re-running sync is safe and idempotent.

- **What happens if some conversations sync successfully and others fail?** The operation completes with partial failures, records the failure list in history (details only in verbose logs), and offers "Retry Failed Items" without re-uploading unchanged items.

- **What happens if user triggers manual sync during auto-sync (or rapidly clicks Sync Now)?** The single-flight lock prevents concurrent runs; the UI shows "Sync already in progress" and the system does not start a second run.

- **What happens if user changes credentials or signs out during an active sync?** The active run stops at the next safe checkpoint, clears auth session (if signed out), and transitions to `Not Configured` or `Paused (Auth Required)` until re-authenticated.

- **What happens if the browser closes / extension updates during sync?** The system persists cursors and resumes from the last successful cursor on the next run.

- **What if user wants to sync only specific conversations, not all?** Not supported in MVP (sync scope is "all conversations"). Future enhancement may add filters by platform/date/tags.

- **How are credentials secured?** Configuration and the Supabase Auth session (including refresh token) are stored in `chrome.storage.local` and transmitted only over HTTPS. This feature does not provide end-to-end encryption; users should treat their Supabase project as the security boundary.

- **What happens when the auth session expires or becomes invalid?** The system automatically attempts to refresh the session using the stored refresh token. If refresh fails (e.g., token revoked, password changed), sync pauses and displays "Session expired - please sign in again" with a prompt to re-authenticate. Auto-sync remains disabled until user signs in again.

- **What happens when user deletes a conversation locally after it's synced?** Deletion is synced as a tombstone (`deleted_at`), allowing recovery. Permanent deletion from cloud is an explicit advanced action and is not part of MVP.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to configure cloud sync via Settings panel with "Cloud Sync Settings" button located below "Export Data" section
- **FR-002**: System MUST provide alternative access to sync configuration via right-click context menu on extension icon with "Sync Settings" option
- **FR-003**: Configuration modal MUST provide the complete database schema migration SQL (from `specs/002-cloud-sync/contracts/supabase-schema.sql`) with a "Copy SQL" button for users to run in Supabase Dashboard
- **FR-004**: Configuration interface MUST collect: Supabase Project URL, API Key (anon/public), and Supabase Auth sign-in (email + password)
- **FR-005**: System MUST validate credentials by testing connection AND verifying required tables exist (conversations, messages) before allowing save, displaying specific success or error messages (e.g., "Tables not found - please run the SQL migration first")
- **FR-006**: System MUST store configuration and auth session (including refresh token) in `chrome.storage.local` and MUST NOT log secrets to the console
  - **Note**: Sub-IDs (FR-006a/b/c) are used to group semantically related requirements under a common concept (authentication session management)
- **FR-006a**: System MUST maintain persistent authentication sessions that survive browser restarts by automatically refreshing tokens using stored refresh token until user explicitly signs out
- **FR-006b**: System MUST provide "Sign Out" functionality that clears auth session, changes sync status to "Not Configured", and disables auto-sync
- **FR-006c**: System MUST handle session refresh failures by pausing sync, displaying "Session expired - please sign in again", and keeping auto-sync disabled until user re-authenticates
- **FR-007**: System MUST support manual sync triggered by "Sync Now" button, syncing all changed conversations immediately
- **FR-008**: System MUST support automatic incremental sync at user-configured intervals: 5min, 15min, 30min, 1hr, or custom value
- **FR-009**: Incremental sync MUST detect and sync only changed conversations (new, modified, deleted) since last sync, not entire database
- **FR-010**: System MUST track last successful sync cursor (server `updated_at` watermark) and record `synced_at` for conversations
- **FR-011**: System MUST store data in cloud using `conversations` and `messages` tables; platform-specific metadata MUST be stored in JSON columns, not Markdown files
- **FR-012**: Markdown export MUST remain as export-only view format, not primary storage format
- **FR-013**: System MUST support two-way sync: upload local changes and download remote changes in single operation
- **FR-014**: System MUST provide "Download from Cloud" function to retrieve all conversations from cloud to local storage
- **FR-015**: System MUST display sync status showing: last sync time, next auto-sync time, local conversation count, cloud conversation count
- **FR-016**: System MUST maintain sync history log with last 20 operations including: timestamp, type, direction, result, conversation count
- **FR-016a**: Sync history MUST also record security-sensitive actions: sign-in, sign-out, reset sync state, force full re-sync, and replace-local operations
- **FR-017**: System MUST show real-time progress during sync operations: "Syncing... X of Y conversations (Z%)"
- **FR-018**: System MUST handle sync failures with specific error messages and retry options
- **FR-019**: System MUST use pagination with batch size of 100 conversations for large sync operations
- **FR-020**: System MUST implement exponential backoff retry for failed sync operations (3 attempts: 2s, 4s, 8s delays)
- **FR-021**: System MUST generate stable message keys using composite format: (platform, platform_conversation_id, message_index, platform_message_id_if_available) to enable conflict-free message merging across devices
- **FR-022**: System MUST handle concurrent changes by merging messages using stable keys (same key = same message, different keys = both kept) and applying `updated_at` last-write-wins for conversation-level metadata fields
- **FR-023**: System MUST detect quota/limit errors during sync, show a warning, and pause auto-sync until the issue is resolved
- **FR-024**: System MUST implement tombstone deletes for conversations using `deleted_at` and MUST support restore; permanent deletion from cloud is an advanced non-MVP action
- **FR-025**: System MUST pause auto-sync when browser is idle or extension closed, resuming when browser becomes active
- **FR-026**: System MUST allow users to enable/disable auto-sync independently of manual sync functionality
- **FR-027**: System MUST provide optional verbose logging mode for debugging sync operations
- **FR-028**: System MUST implement a single-flight sync lock to prevent concurrent operations (manual vs auto, repeated clicks), and MUST surface "Sync already in progress" in UI
- **FR-029**: System MUST classify sync errors into retryable vs non-retryable and MUST NOT retry non-retryable errors (e.g., invalid credentials, missing tables, RLS forbidden, schema mismatch)
- **FR-030**: System MUST enforce timeouts (30s per request, 10min per sync run) and report a specific timeout error with retry guidance
- **FR-031**: System MUST support partial sync failure handling: continue processing other batches where possible, record per-batch failures, and present a summary (succeeded/failed) with a "Retry Failed Items" option
- **FR-032**: System MUST be idempotent: repeated uploads/downloads MUST NOT create duplicate messages due to stable message keys and upsert semantics
- **FR-033**: System MUST persist sync checkpoints (current cursors + in-progress direction) so that after browser crash/extension reload it can resume from the last successful cursor (no full restart required)
- **FR-034**: System MUST provide user recovery actions in Sync Settings: "Reset Sync State" (clears cursors/history), "Force Full Re-sync" (sets cursors to epoch), and "Replace Local with Cloud" (wipe local conversations/messages then download)
- **FR-035**: System MUST validate downloaded cloud data; invalid rows MUST be skipped (not crash the sync) and counted in the operation log, with details only visible in verbose logs
- **FR-036**: System MUST handle local storage failures (including IndexedDB QuotaExceeded) by pausing downloads, surfacing an actionable error ("Local storage full"), and keeping auto-sync disabled until user intervenes
- **FR-037**: System MUST define deterministic stable message key fallback when `platform_message_id` is unavailable: `message_key = platform|platform_conversation_id|message_index|sha256(role + \"\\n\" + normalized_content_text)`
- **FR-038**: System MUST define error message wording guidelines: messages MUST be non-technical, actionable, and MUST NOT leak secrets
- **FR-039**: System MUST define and enforce a cloud schema version check (stored in `metadata.schema_version`). On mismatch, sync MUST pause with "Sync paused — cloud schema version mismatch."

### Non-Functional Requirements

- **NFR-001 (Security)**: All cloud requests MUST use HTTPS. Data at rest is protected by Supabase/Postgres defaults in the user's project. The extension MUST NOT log API keys, access tokens, or refresh tokens.
- **NFR-002 (Privacy)**: This feature does not provide end-to-end encryption; users treat their Supabase project as the security boundary (explicitly stated in UI).
- **NFR-003 (Accessibility)**: Sync settings modal MUST be keyboard navigable (focus trap, Esc to close), and status indicators MUST not rely on color alone.
- **NFR-004 (Performance)**: Auto-sync MUST throttle work: maximum one sync run per configured interval, and background work MUST yield between batches to avoid blocking the UI.
- **NFR-005 (Graceful Degradation)**: When Supabase is unreachable, sync MUST pause without affecting local capture and MUST clearly show "Cloud unavailable" with retry guidance.
- **NFR-006 (Resource Limits)**: Sync SHOULD keep extension memory usage below 150MB. If repeated OOM/slowdown symptoms are detected, auto-sync SHOULD be disabled and the user notified to reduce dataset size.
  - **Note**: This is aspirational guidance. Memory profiling uses Chrome Task Manager per constitution standards. No automated monitoring is required for MVP.

### Error Messages (Minimum Catalog)

The system MUST display these exact user-facing messages (localized later):

- **Missing tables**: "Tables not found — please run the SQL migration in Supabase first."
- **Invalid credentials**: "Sign-in failed — please check your email/password and try again."
- **Session expired**: "Session expired — please sign in again."
- **Network error**: "Network error — check your connection and retry."
- **Timeout**: "Sync timed out — please retry."
- **Cloud limit**: "Auto-sync paused — cloud limit reached. Resolve the limit and retry."
- **Local storage full**: "Sync paused — local storage is full. Free space and retry."
- **Schema mismatch**: "Sync paused — cloud schema version mismatch. Update schema or extension."

**Note**: Additional error messages and UI text are defined in `specs/002-cloud-sync/contracts/ui-contract.md` and will be implemented via i18n keys.

### Key Entities

- **Cloud Conversation Record**: Represents a synced conversation in cloud database
  - Core attributes: user_id, platform, platform_conversation_id, title, created_at, updated_at, synced_at, deleted_at
  - JSON metadata field containing: conversation-level metadata and platform-specific data (messages are stored separately)
  - Relationship: One-to-many mapping with cloud message records

- **Cloud Message Record**: Represents a single message in a synced conversation
  - Core attributes: user_id, platform, platform_conversation_id, message_key (stable composite: platform + platform_conversation_id + message_index + platform_message_id if available), role, content_text, created_at, updated_at, deleted_at
  - JSON metadata field containing: platform-specific fields (attachments, raw platform message IDs, etc.)
  - message_key ensures: (1) stable identity across devices, (2) ordering preservation via message_index, (3) exact matching when platform provides message IDs

- **Sync Operation Log**: Represents a record of sync activity
  - Attributes: operation_id, timestamp, operation_type (manual/auto), direction (upload/download/two-way), status (success/failed/in-progress), conversation_count, error_message
  - Relationship: Many sync operations per user account

- **Sync Configuration**: Represents user's cloud sync settings
  - Attributes: project_url, api_key, auth_session, auto_sync_enabled (boolean), sync_interval_minutes, last_sync_timestamp, quota_warning_shown (boolean)
  - Relationship: One per extension installation

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete initial sync setup (enter credentials, test connection, save) in under 2 minutes
- **SC-002**: Manual sync of 100 conversations completes in under 10 seconds on typical broadband connection (10 Mbps+)
- **SC-003**: Incremental auto-sync adds less than 2% CPU overhead during idle browser state (measured via Chrome Task Manager)
- **SC-004**: 95% of sync operations complete successfully on first attempt under normal network conditions (no retries needed)
- **SC-005**: Cross-device sync (upload from Device A, download to Device B) maintains 100% data integrity with no message loss
- **SC-006**: Users can identify sync failures within 5 seconds via clear error messages in sync status area
- **SC-007**: System handles 10,000+ conversation sync without performance degradation using pagination (measured: initial sync <60 seconds)
- **SC-008**: Conflict resolution (when enabled) prevents data loss in 100% of simultaneous edit scenarios
- **SC-009**: In an internal usability test (10 independent runs following only in-modal instructions), ≥9/10 runs complete initial setup and first sync without external documentation
- **SC-010**: In an internal dogfooding survey (n=10), ≥8/10 report sync status and errors are "clear and actionable" without needing developer assistance

## Assumptions

- **Storage Strategy**: Cloud schema uses `conversations` and `messages` tables for reliable incremental sync and conflict-free merging, with JSON columns for platform-specific metadata.

- **Network Availability**: Auto-sync assumes users have intermittent or continuous internet connectivity. Offline-first scenarios (no internet for extended periods) will queue changes locally and sync when connection resumes.

- **Supabase Tier**: Specification assumes users will primarily use Supabase free tier; precise quota measurement may not be available in MVP.

- **Authentication Method**: Supabase Auth is used for user identity with persistent sessions (refresh tokens stored in chrome.storage.local). Row-Level Security (RLS) enforces per-user isolation using `auth.uid()`. Sessions persist across browser restarts until user explicitly signs out.

- **Conversation Identity**: Conversations are uniquely identified by `(user_id, platform, platform_conversation_id)`; platforms without stable IDs will require a deterministic fallback key.

- **Browser Support**: Sync functionality assumes Chrome extension environment with access to chrome.storage API for secure credential storage.

- **Data Privacy**: Users understand that conversations are stored in their own Supabase project (they control the database), not in a shared multi-tenant database. This ensures data privacy.

- **Markdown Export Decoupling**: Markdown export feature (from Feature 001) remains independent. Cloud sync does not replace export functionality; it complements it by providing live backup rather than static exports.

- **Schema Versioning**: Initial version uses simple schema. Future migrations (if schema changes) will use version field in metadata to trigger migration workflows.

- **Sync Scope Default**: By default, all conversations sync. Optional filtering (by platform, date, tags) is a nice-to-have enhancement, not MVP requirement.

## Dependencies

- **Supabase services used**: Auth (email/password), PostgREST API, PostgreSQL (with RLS).
- **Browser APIs required**: `chrome.storage.local`, `chrome.idle`, `chrome.alarms`, `chrome.runtime` messaging, and IndexedDB (existing local storage).
- **Minimum browser**: Chrome supporting Manifest V3 and the APIs above (Chrome 88+ recommended by plan).
