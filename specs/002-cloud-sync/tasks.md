# Tasks: Cloud Sync with Supabase

**Input**: `specs/002-cloud-sync/plan.md`, `specs/002-cloud-sync/spec.md`, `specs/002-cloud-sync/data-model.md`, `specs/002-cloud-sync/contracts/*`, `specs/002-cloud-sync/quickstart.md`
**Scope**: Implement Cloud Sync in the existing MV3 Chrome extension under `chat-memo-pro/`
**Tech Stack**: Vanilla JS (no build step), MV3 service worker, Supabase Auth + PostgREST via `fetch`
**Test Strategy**: Manual verification via `specs/002-cloud-sync/quickstart.md`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, low conflict)
- **[Story]**: US1..US5 (see `specs/002-cloud-sync/spec.md`)
- All file paths are workspace-relative.

---

## Phase 0: Pre-Implementation Verification

**Purpose**: Validate all design artifacts exist before coding begins

- [X] T000 Verify all contract files exist in `specs/002-cloud-sync/contracts/`: `sync-api.md`, `storage-interface.md`, `supabase-schema.sql`, `background-scheduler.md`, `ui-contract.md`, `chrome-storage-schema.md`, `indexeddb-schema.md`, `rls-best-practices.md`, `rls-testing-guide.md`

**Checkpoint**: All design documents confirmed present - safe to proceed with implementation

---

## Phase 1: Wiring & Skeleton (Shared)

- [X] T001 Create sync module files under `chat-memo-pro/js/sync/`: `sync-config.js`, `schema-sql.js`, `supabase-client.js`, `sync-storage.js`, `sync-engine.js`, `sync-ui-controller.js`
- [X] T002 [P] Update `chat-memo-pro/manifest.json`: add permissions `alarms`, `idle`, `contextMenus`; add `host_permissions` for `https://*.supabase.co/*`
- [X] T003 [P] Load sync code in background: add `importScripts('sync/*.js')` wiring in `chat-memo-pro/js/background.js` (converted to ES6 module and added imports)
- [X] T004 [P] Load sync UI scripts in `chat-memo-pro/html/popup.html` (add `<script src="../js/sync/sync-ui-controller.js"></script>` and any dependencies)
- [X] T005 [P] Add Cloud Sync Settings modal markup to `chat-memo-pro/html/popup.html` per `specs/002-cloud-sync/contracts/ui-contract.md`
- [X] T006 Integrate UI controller into existing UI flow in `chat-memo-pro/js/popup.js` (initialize controller, open modal, handle button clicks, bind toggles, render status/history)
- [X] T007 [P] Add i18n keys for new UI + error messages to `chat-memo-pro/_locales/en/messages.json` and `chat-memo-pro/_locales/zh_CN/messages.json` (align with spec "Error Messages" catalog)

---

## Phase 2: Shared Foundations (Blocking)

- [X] T008 Implement `chat-memo-pro/js/sync/sync-config.js` constants (batch sizes, timeouts, retry schedule, schema version, state labels) per `specs/002-cloud-sync/spec.md`
- [X] T009 Implement chrome storage helpers in `chat-memo-pro/js/sync/sync-config.js` matching `specs/002-cloud-sync/contracts/chrome-storage-schema.md` (config/auth/settings/cursors/state/history/pending)
- [X] T010 Implement `chat-memo-pro/js/sync/schema-sql.js` exporting the SQL string used by "Copy SQL"; keep it aligned with `specs/002-cloud-sync/contracts/supabase-schema.sql`
- [X] T011 Implement `chat-memo-pro/js/sync/supabase-client.js` (fetch-based): sign-in, refresh, sign-out, PostgREST select/upsert, and `testConnection()` returning enumerated `TestErrorCode` per `specs/002-cloud-sync/contracts/sync-api.md`
- [X] T012 Implement `chat-memo-pro/js/sync/sync-storage.js` mapping local IndexedDB conversations ↔ cloud `conversations`/`messages` rows using existing functions in `chat-memo-pro/js/background.js`
- [X] T013 Implement deterministic message hashing + `message_key` generation in `chat-memo-pro/js/sync/sync-storage.js` per `specs/002-cloud-sync/data-model.md` normalization rules
- [X] T014 Implement core sync state machine + single-flight lock in `chat-memo-pro/js/sync/sync-engine.js` (status transitions, cursor advancement rules, resume checkpoint via `cloudSync.pending`)

---

## Phase 3: US1 – Initial Sync Setup (P1)

- [X] T015 [US1] Add entry points: Settings → Export section button in `chat-memo-pro/html/popup.html` and right-click menu in `chat-memo-pro/js/background.js` (opens `chat-memo-pro/html/popup.html#sync`)
- [X] T016 [US1] Implement UI field validation + "Copy SQL" in `chat-memo-pro/js/sync/sync-ui-controller.js`
- [X] T017 [US1] Implement sign-in/sign-out flows end-to-end (UI → background → Supabase Auth) and persist auth session per `specs/002-cloud-sync/contracts/chrome-storage-schema.md`
- [X] T018 [US1] Implement "Test Connection" end-to-end and render exact user messages (missing tables/auth required/network/timeout/RLS denied)
- [X] T019 [US1] Implement session refresh on startup; on refresh failure transition to `Paused (Auth Required)` and disable auto-sync
- [X] T020 [US1] Add quickstart-aligned help text into the modal (steps + links to explain RLS/no E2EE boundary)

**Checkpoint**: Run quickstart steps 1–3 in `specs/002-cloud-sync/quickstart.md`

---

## Phase 4: US2 – Manual Two-Way Sync (P1)

- [X] T021 [US2] Add runtime message APIs in `chat-memo-pro/js/background.js` for: testConnection, signIn, signOut, syncNow, download, replaceLocal, reset, forceFullResync, retryFailed
- [X] T022 [US2] Implement `syncNow()` in `chat-memo-pro/js/sync/sync-engine.js`: refresh → upload local changes → download remote changes → merge → advance cursors → write history
- [X] T023 [US2] Implement progress events per `specs/002-cloud-sync/contracts/sync-api.md`: background emits `SyncProgressEvent` via `chrome.runtime.Port` (`cloudSync.progress`) and UI renders `"Syncing... X of Y conversations (Z%)"`
- [X] T024 [US2] Implement incremental change export in `chat-memo-pro/js/sync/sync-storage.js` using cursor watermarks and local timestamps; ensure "Already up to date" behavior
- [X] T025 [US2] Implement partial failure handling (continue batches, collect failed item keys, surface summary "Synced X, failed Y" and a retry action)
- [X] T026 [US2] Implement typed error mapping to pause states: `CloudLimit`, `AuthRequired`, `NetworkError`, `Timeout`, `SchemaMismatch`, `LocalQuotaExceeded`
- [X] T027 [US2] Implement sync history recording (max 20) and store it in `chrome.storage.local` per `specs/002-cloud-sync/contracts/ui-contract.md`
- [X] T028 [US2] Implement schema version tagging on upserts and schema mismatch detection (pause + correct message) per `specs/002-cloud-sync/spec.md` FR-039

**Checkpoint**: Quickstart smoke test §4 in `specs/002-cloud-sync/quickstart.md`

---

## Phase 5: US3 – Auto-Sync Scheduler (P2)

- [X] T029 [US3] Implement auto-sync toggle + interval UI (min 5m, max 24h, default 15m) in `chat-memo-pro/html/popup.html` + `chat-memo-pro/js/sync/sync-ui-controller.js`
- [X] T030 [US3] Implement background scheduler in `chat-memo-pro/js/background.js` per `specs/002-cloud-sync/contracts/background-scheduler.md` (chrome.alarms, chrome.idle gating, interval change rules)
- [X] T031 [US3] Ensure auto-sync is single-flight and never starts while manual sync is running; record history entries with `type=auto`
- [X] T032 [US3] Ensure auto-sync pauses on `AuthRequired`/`CloudLimit`/`LocalQuotaExceeded` until user resolves and retries successfully

---

## Phase 6: US4 – Cross-Device Download + Replace Local (P2)

- [X] T033 [US4] Implement `downloadFromCloud()` in `chat-memo-pro/js/sync/sync-engine.js` with pagination + resume via cursors; merge without duplicates based on stable keys
- [X] T034 [US4] Implement `replaceLocalWithCloud()` in `chat-memo-pro/js/sync/sync-engine.js` (destructive confirm, wipe local conversations/messages, then download)
- [X] T035 [US4] Implement local quota exceeded handling during merges (pause with “Sync paused — local storage is full”, keep auto-sync disabled)
- [X] T036 [US4] Implement invalid/corrupted row handling: skip, count warnings, continue; verbose logs include details without secrets

**Checkpoint**: Quickstart cross-device test §5 in `specs/002-cloud-sync/quickstart.md`

---

## Phase 7: US5 – Status + History + Verbose Logging (P3)

- [X] T037 [US5] Implement status panel rendering per `specs/002-cloud-sync/contracts/ui-contract.md` (state, last/next sync, local/cloud counts best-effort)
- [X] T038 [US5] Implement sync history UI rendering (last 20 entries, expandable error details, no secret leakage)
- [X] T039 [US5] Implement verbose logging toggle and ensure all logs redact secrets (apikey/tokens)
- [X] T040 [US5] Implement warning badges mapping: cloud limit, auth required, local storage full, schema mismatch, cloud unavailable

---

## Phase 8: Deletes & Restore (Release-Blocking)

- [X] T041 Implement tombstone delete propagation: when local delete occurs in `chat-memo-pro/js/background.js`, persist a tombstone record in `cloudSync.pending` so deletion can be uploaded even after local row removal (FR-024)
- [X] T042 Implement minimal restore: add “Restore Deleted (Cloud)” action in sync settings that clears `deleted_at` for tombstoned conversations in cloud and then downloads (FR-024)

---

## Phase 9: Recovery Actions (Release-Blocking)

- [X] T043 Implement “Reset Sync State” (clear cursors/history/pending, keep auth/config) per `specs/002-cloud-sync/contracts/sync-api.md` and `specs/002-cloud-sync/spec.md` FR-034
- [X] T044 Implement “Force Full Re-sync” (set cursors to epoch) per FR-034
- [X] T045 Implement “Retry Failed Items” (re-run only failed keys/batches) per FR-031

---

## Phase 10: Post-Release Bug Fixes & Improvements

**Purpose**: Address bugs and usability issues discovered after initial release

- [X] T046-BF1 Add auto-saving indicator support for Manus and Genspark platforms in `chat-memo-pro/js/content_common.js`
  - **Issue**: Auto-saving float tag only appeared on original supported platforms, not on Manus (https://manus.im) or Genspark (https://www.genspark.ai)
  - **Fix**: Added both platforms to `supportedPlatforms` array in `shouldShowFloatTag()` function
  - **Impact**: Users on Manus and Genspark now see the auto-saving indicator when conversations are being saved

- [X] T046-BF2 Fix Download from Cloud and Replace Local buttons not refreshing conversation list in `chat-memo-pro/js/background.js`
  - **Issue**: After clicking "Download from Cloud" or "Replace Local with Cloud", the conversation list in sidebar did not refresh automatically, requiring manual page reload
  - **Fix**: Added `notifySidebarRefresh()` calls to `downloadFromCloud` (line 432), `replaceLocal` (line 448), `syncNow` (lines 404-405), and `syncNowAuto` (lines 421-422) handlers
  - **Impact**: Conversation list now automatically refreshes after successful cloud sync operations, providing immediate visual feedback

- [X] T046-BF3 Fix auto-sync status display showing "Disabled" when actually enabled in `chat-memo-pro/js/sync/sync-ui-controller.js`
  - **Issue**: Status panel showed "Auto-sync: Disabled" and "Next sync: —" even when auto-sync was enabled and running in background (confirmed by console logs showing auto-sync executing)
  - **Root Cause**: `handleAutoSyncToggle()` and `handleSyncIntervalChange()` functions updated settings but didn't refresh the status panel
  - **Fix**: Added `await renderSyncStatus()` calls at the end of both handler functions (lines 667, 696) to immediately refresh status panel after settings change
  - **Impact**: Status panel now accurately reflects current auto-sync state and displays correct "Next sync" time

---

## Phase 11: Manual QA (Quickstart)

**Purpose**: Validate all success criteria (SC-001 through SC-010) are met

- [ ] T046 Run `specs/002-cloud-sync/quickstart.md` end-to-end (smoke + cross-device)
  - **Success Criteria Validated**: SC-001 (setup <2min), SC-002 (100 convs <10s), SC-005 (100% data integrity), SC-007 (10k convs <60s), SC-009 (9/10 setup usability)
- [ ] T047 Run RLS isolation test §6 in `specs/002-cloud-sync/quickstart.md`
  - **Success Criteria Validated**: SC-005 (100% data integrity via RLS isolation)
- [ ] T048 Run incremental sync verification §7 in `specs/002-cloud-sync/quickstart.md`
  - **Success Criteria Validated**: SC-003 (<2% CPU overhead), SC-008 (100% conflict resolution)
- [ ] T049 Run failure simulations in `specs/002-cloud-sync/quickstart.md` (offline, session expired, cloud limit)
  - **Success Criteria Validated**: SC-004 (95% first-attempt success), SC-006 (error identification <5s), SC-010 (8/10 clarity rating)
