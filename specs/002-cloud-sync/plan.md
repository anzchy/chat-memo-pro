# Implementation Plan: Cloud Sync with Supabase

**Branch**: `002-cloud-sync` | **Date**: 2025-12-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-cloud-sync/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable cross-device conversation synchronization using Supabase as the cloud backend. Users configure their own Supabase project (Project URL + anon/public API key), sign in via Supabase Auth (email + password), run a provided SQL migration to create required tables (`conversations` and `messages`) with RLS, and enable manual and automatic sync. The system implements incremental two-way sync using server `updated_at` watermarks as cursors, merges messages by stable message keys (no message loss), and resolves conversation-level metadata conflicts (e.g., title) via `updated_at` last-write-wins. The system uses tombstone deletes (`deleted_at`) with restore support, supports “Replace Local with Cloud”, and records sync history and status.

**Primary Technical Approach**:
- Chrome extension with Manifest V3 service worker background script handling sync operations
- Supabase Auth + PostgREST API calls using `fetch` (no build step required); SDK is optional and not required for MVP
- IndexedDB for local conversation storage with sync cursor tracking
- User-provided SQL migration for schema setup (no service role key required)
- Stable message keys: `(platform, platform_conversation_id, message_index, platform_message_id_if_available)` for conflict-free message merging (plus deterministic fallback when platform_message_id is unavailable)

## Technical Context

**Language/Version**: JavaScript ES6+ (Vanilla JS per constitution - NO TypeScript/frameworks)
**Primary Dependencies**:
- JSZip 3.10.1 (existing dependency, reused for export)
- IndexedDB (browser native, existing storage)
- `fetch` (browser native) for Supabase Auth/PostgREST requests

**Storage**:
- Local: IndexedDB (conversations, messages, sync metadata)
- Configuration: chrome.storage.local (Supabase config, auth session including refresh token, sync settings, last sync cursors)
- Cloud: Supabase PostgreSQL (user-managed project with `conversations` and `messages` tables)

**Testing**:
- Manual testing (per constitution - Chrome extension standard practice)
- Manual sync verification across 2+ devices
- Network interruption simulation (DevTools offline mode)
- Limit/quota error simulation (rate limits, payload too large, storage limit) by forcing failed requests

**Target Platform**: Chrome extension (Manifest V3), minimum Chrome 88+

**Project Type**: Chrome extension (single-project structure with content scripts, popup, background)

**Performance Goals**:
- Sync 100 conversations in <10 seconds (10 Mbps+ connection)
- Incremental sync adds <2% CPU overhead during idle
- Initial sync of 10,000 conversations in <60 seconds with pagination

**Constraints**:
- Chrome extension memory target: <150MB total (per constitution)
- Supabase free tier: 500MB storage, 50k monthly active users
- chrome.storage.local for configuration + auth session; MUST NOT log secrets (FR-006)
- No service role key required (users run SQL migration manually)
- Must work with anon key + Row-Level Security for all operations

**Scale/Scope**:
- Support 10,000+ conversations per user
- Batch sync in chunks of 100 conversations (pagination)
- Sync history: last 20 operations stored locally
- Auto-sync intervals: 5min, 15min, 30min, 1hr, custom

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Progressive Enhancement & Minimal Disruption

✅ **PASS** - Cloud sync is additive, standalone feature
- ✅ NO framework migrations (stays Vanilla JS)
- ✅ NO breaking changes to existing 9,442 lines
- ✅ New sync module isolated in js/sync/ directory
- ✅ Existing export remains independent (cloud sync is additive)
- ⚠️ Local storage will be extended/used for sync (download/merge + sync metadata)
- ✅ Feature flag approach: users opt-in via Settings

### II. Chrome Extension Best Practices

✅ **PASS** - Follows Manifest V3 standards
- ✅ Service worker for background sync (js/background.js extended)
- ✅ chrome.storage.local for config + auth session (within limits)
- ✅ IndexedDB for large conversation data (existing pattern)
- ✅ CSP-compliant: NO inline scripts, NO eval()
- ✅ Efficient sync with debouncing (auto-sync intervals: 5-60min)
- ✅ Memory target: <150MB (fetch-based Supabase API calls; no required SDK bundle)
- ✅ Permission request: host_permissions for Supabase project URL (user-provided)

### III. Platform Adapter Robustness

✅ **PASS** - No impact to existing adapters
- ✅ Sync operates on already-captured conversations
- ✅ Adapters continue saving to IndexedDB unchanged
- ✅ Sync layer is orthogonal to capture logic (reads/writes local storage only for sync/merge)
- ✅ No adapter modifications required

### IV. User Experience & Accessibility

✅ **PASS** - Maintains UX standards
- ✅ Real-time sync feedback: progress indicator, status badges
- ✅ Responsive design: Settings modal adapts to popup width
- ✅ Keyboard navigation: modal, buttons, toggles accessible
- ✅ Clear error messages: "Tables not found - please run SQL migration first"
- ✅ Loading states: "Syncing... 45/100 conversations (45%)"
- ✅ Accessible via Settings panel + right-click context menu

### V. Data Integrity & Export Flexibility

✅ **PASS** - Export remains independent
- ✅ Cloud sync does NOT replace export (complementary features)
- ✅ Markdown export continues to work from IndexedDB
- ✅ Sync ensures conversations backed up to cloud
- ✅ Export provides static snapshots (Markdown/JSON/TXT)
- ✅ Both features coexist without conflict

**Gate Result**: ✅ ALL GATES PASSED - Proceed to Phase 0

## Project Structure

### Documentation (this feature)

```text
specs/002-cloud-sync/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── supabase-schema.sql     # Database migration SQL
│   ├── sync-api.md             # Sync service API contract
│   └── storage-interface.md    # Local/cloud storage contracts
├── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
└── ui-mockups.html      # UI visualizations (already created)
```

### Source Code (repository root)

```text
chat-memo-pro/
├── js/
│   ├── sync/                          # NEW: Cloud sync module
│   │   ├── supabase-client.js         # Supabase Auth + PostgREST wrapper (fetch-based)
│   │   ├── sync-engine.js             # Core sync logic (incremental, two-way)
│   │   ├── sync-storage.js            # Local/cloud storage abstraction
│   │   ├── sync-ui-controller.js      # Settings modal controller
│   │   └── sync-config.js             # Configuration constants
│   ├── background.js                  # MODIFIED: Add sync interval timers
│   ├── popup.js                       # MODIFIED: Add Cloud Sync Settings UI
│   └── core/
│       └── storage-manager.js         # EXISTING: IndexedDB (extended/used for sync merge + cursors)
├── html/
│   └── popup.html                     # MODIFIED: Add sync settings section
├── lib/                               # NOTE: No new runtime deps required for MVP
└── manifest.json                      # MODIFIED: Add optional Supabase host permissions
```

**Structure Decision**: Single-project Chrome extension structure (Option 1). New sync module isolated in `js/sync/` directory following existing patterns (`js/core/`, `js/adapters/`). Background script extended for sync scheduling, popup UI extended for sync settings. No framework changes, stays Vanilla JS per constitution.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations - table omitted.*

---

## Phase 0: Outline & Research

### Research Questions

The following unknowns must be resolved before implementation:

1. **Supabase API Access From Manifest V3**
   - **Question**: What is the cleanest approach for Supabase Auth + PostgREST in a MV3 service worker (fetch-based vs SDK), and what CSP/permission constraints apply?
   - **Why**: MVP should work with no build step and remain CSP-compliant

2. **Message Stable Key Implementation Strategy**
   - **Question**: How to generate composite message keys `(platform, platform_conversation_id, message_index, platform_message_id_if_available)` and a deterministic fallback when platform_message_id is missing?
   - **Why**: Critical for conflict-free message merging across devices

3. **IndexedDB Sync Cursor Tracking**
   - **Question**: How to track last successful sync cursors (server `updated_at` watermarks) for conversations and messages?
   - **Why**: Reliable incremental two-way sync without scanning the full dataset

4. **Supabase Auth Session Persistence in chrome.storage.local**
   - **Question**: What auth session data must be stored? How to handle refresh token rotation?
   - **Why**: Ensure persistent sessions across browser restarts per FR-006a/FR-006c

5. **Conflict Resolution Algorithm for Concurrent Edits**
   - **Question**: How to implement message merging by stable key + conversation metadata last-write-wins?
   - **Why**: Core requirement (FR-022) for cross-device sync without message loss

6. **SQL Migration Script Structure & RLS Policies**
   - **Question**: What exact SQL creates conversations + messages tables with proper RLS?
   - **Why**: Users run this manually - must be complete and correct

7. **Network Retry & Exponential Backoff Implementation**
   - **Question**: How to implement 3 retries with 2s, 4s, 8s delays for failed sync operations?
   - **Why**: Per FR-020 for network interruption handling

8. **Quota Detection & Monitoring**
   - **Question**: What error signatures indicate quota/limit issues (rate limits, payload too large, storage limit) and when should auto-sync be paused?
   - **Why**: Per FR-023 must pause auto-sync until the issue is resolved (no precise quota measurement in MVP)

### Research Dispatch

**Task 1**: Research Supabase Auth + PostgREST in Chrome extensions
- Validate `fetch` patterns for Supabase Auth (sign-in, refresh) and PostgREST (CRUD + pagination)
- Confirm required host permissions and headers for MV3 service worker
- Decide whether a vendored SDK adds value beyond fetch for MVP

**Task 2**: Research IndexedDB cursor-based incremental sync patterns
- Find patterns for tracking server `updated_at` watermarks (conversations + messages)
- Identify efficient query strategies for "changed since watermark"
- Evaluate transaction strategies for atomic sync operations

**Task 3**: Research Supabase Auth session storage
- Document session object structure (access token, refresh token, expiry)
- Find patterns for automatic token refresh in background scripts
- Identify session invalidation detection strategies

**Task 4**: Research conflict resolution for two-way sync
- Confirm message merge rules using stable message keys (same key = same message, different keys = both kept)
- Confirm conversation metadata LWW rules using `updated_at`
- Identify edge cases (message edits, deletions, reordered messages)

**Task 5**: Research Supabase RLS policies for user isolation
- Find examples of auth.uid()-based RLS policies
- Study best practices for multi-table RLS (conversations + messages)
- Identify common pitfalls in user data isolation

**Task 6**: Research Chrome extension network error handling
- Find exponential backoff implementation patterns for fetch()
- Study retry strategies for failed Supabase operations
- Identify browser API quirks for network state detection

**Output**: research.md with all decisions, rationales, and code patterns

---

## Phase 1: Design & Contracts

*Prerequisites*: research.md complete

### Deliverables

1. **data-model.md**: Entity definitions for:
   - Cloud Conversation Record (per spec “Key Entities”)
   - Cloud Message Record (per spec “Key Entities”)
   - Sync Operation Log (per spec “Key Entities”)
   - Sync Configuration (per spec “Key Entities”)
   - Sync cursor tracking in IndexedDB

2. **contracts/supabase-schema.sql**: Complete SQL migration
   - CREATE TABLE conversations (with all columns from spec)
   - CREATE TABLE messages (with message_key as composite)
   - RLS policies for user isolation (auth.uid() = user_id)
   - Indexes for performance (platform, platform_conversation_id, updated_at)

3. **contracts/sync-api.md**: Sync service interface
   - `SyncEngine.syncNow()`: Manual sync trigger
   - `SyncEngine.downloadFromCloud()`: Full download
   - `SyncEngine.uploadToCloud()`: Upload local changes
   - `SyncEngine.twoWaySync()`: Bidirectional sync
   - `SyncEngine.detectConflicts()`: Conflict detection logic

4. **contracts/storage-interface.md**: Storage abstraction
   - `SyncStorage.getLocalChanges(cursors)`: Incremental query using server `updated_at` watermarks
   - `SyncStorage.updateSyncCursors(cursors)`: Track last successful sync watermarks
   - `SyncStorage.mergeConversations(local, remote)`: Conflict resolution
   - `SupabaseClient.upsertConversations(batch)`: Batch upload
   - `SupabaseClient.queryConversations(filter)`: Paginated download
   - `SyncStorage.replaceLocalWithCloud()`: Replace-local workflow (confirmation required)
   - `SyncStorage.restoreTombstonedConversation(id)`: Restore deleted conversation

5. **quickstart.md**: Developer onboarding
   - How to test sync locally (2 Chrome profiles)
   - Supabase project setup steps
   - Running SQL migration
   - Testing sync scenarios (upload, download, conflict)
   - Testing tombstone delete + restore
   - Testing session expiry + re-auth

### Agent Context Update

Run `.specify/scripts/bash/update-agent-context.sh claude` to add:
- Supabase Auth + PostgREST fetch patterns
- IndexedDB cursor tracking
- Chrome storage API for credentials
- Background script sync scheduling

---

## Phase 2: Task Generation (NOT PART OF THIS COMMAND)

*This phase is executed by `/speckit.tasks` command, NOT by `/speckit.plan`.*

The tasks.md file will break down implementation into:
- Task 1: Setup Supabase client wrapper (js/sync/supabase-client.js)
- Task 2: Implement sync storage abstraction (js/sync/sync-storage.js)
- Task 3: Build sync engine core (js/sync/sync-engine.js)
- Task 4: Create sync UI controller (js/sync/sync-ui-controller.js)
- Task 5: Integrate with background script (auto-sync scheduling)
- Task 6: Add Settings panel UI (Cloud Sync Settings button + modal, Copy SQL, Sign in/out)
- Task 7: Implement connection testing & validation (incl. required tables check)
- Task 8: Add sync history logging
- Task 9: Implement Replace Local with Cloud flow (confirmation + wipe + download)
- Task 10: Manual testing across 2 devices
- Task 11: Edge case testing (network failures, quota/limit errors, session expiry, delete/restore)

---

**Planning Phase Complete**: Branch `002-cloud-sync`, Plan: `/specs/002-cloud-sync/plan.md`

**Next Steps**:
1. Review this plan for accuracy and completeness
2. Execute Phase 0 research (automated agent dispatch)
3. Execute Phase 1 design artifacts generation
4. Run `/speckit.tasks` to generate implementation tasks
