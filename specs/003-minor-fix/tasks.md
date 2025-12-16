# Tasks: Persistent Cloud Sync Sign-In

**Input**: `specs/003-minor-fix/plan.md`, `specs/003-minor-fix/spec.md`, `specs/002-cloud-sync/spec.md`, `TESTING_CHECKLIST.md`
**Scope**: Fix Cloud Sync login persistence so users stay signed in until explicit sign-out
**Tech Stack**: Vanilla JS (no build step), MV3 service worker, Supabase Auth via `fetch`
**Test Strategy**: Manual verification per `TESTING_CHECKLIST.md` + scenarios in `specs/003-minor-fix/spec.md`

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, low conflict)
- All file paths are workspace-relative.

---

## Phase 0: Pre-Implementation Verification

- [X] T000 Verify existing Cloud Sync auth/session code paths exist
  - `chat-memo-pro/js/sync/supabase-client.js` (signIn/refresh/signOut)
  - `chat-memo-pro/js/background.js` (startup refresh + message handlers)
  - `chat-memo-pro/js/sync/sync-engine.js` (token usage during sync)
  - `chat-memo-pro/js/sync/sync-ui-controller.js` (sign-in/out UI)

---

## Phase 1: Auth Refresh Reliability (Blocking)

- [X] T001 Implement single-flight refresh to avoid refresh token rotation races
  - **File**: `chat-memo-pro/js/sync/supabase-client.js`
  - **Acceptance**: Multiple concurrent refresh callers reuse the same in-flight promise; stored refresh token remains the latest returned by server

- [X] T002 Fix refresh error mapping: only AuthRequired triggers `Paused (Auth Required)`
  - **File**: `chat-memo-pro/js/sync/supabase-client.js`
  - **Acceptance**: Network/timeout/5xx does not flip to AuthRequired; 400/401/403 leads to AuthRequired pause + user prompt

- [X] T003 Add “ensure valid token” helper and make it recover from missing access token metadata
  - **File**: `chat-memo-pro/js/sync/supabase-client.js`
  - **Acceptance**: If refresh token exists but access token missing/expired, system can recover by refreshing

- [X] T004 Clear stale auth pause after a successful refresh
  - **File**: `chat-memo-pro/js/sync/supabase-client.js`
  - **Acceptance**: If state was `Paused (Auth Required)` but refresh succeeds, state returns to `Connected (Idle)`

---

## Phase 2: Background + UI Persistence Wiring

- [X] T005 [P] Add background message handler for `refreshSession`
  - **File**: `chat-memo-pro/js/background.js`
  - **Acceptance**: UI can trigger a best-effort refresh without direct token handling in UI

- [X] T006 Tighten startup behavior: only disable auto-sync on true AuthRequired
  - **File**: `chat-memo-pro/js/background.js`
  - **Acceptance**: Transient refresh failures do not disable auto-sync permanently; AuthRequired does

- [X] T007 Update “signed-in” predicates to use refresh token presence
  - **Files**:
    - `chat-memo-pro/js/background.js`
    - `chat-memo-pro/js/sync/sync-ui-controller.js`
  - **Acceptance**: Access token may be absent/expired but UI/background still considers user signed in (unless paused auth required)

- [X] T008 Trigger best-effort session refresh when opening Sync Settings UI
  - **File**: `chat-memo-pro/js/sync/sync-ui-controller.js`
  - **Acceptance**: Opening the Sync Settings page attempts silent refresh, improving session continuity over time

---

## Phase 3: Sync Engine Token Usage

- [X] T009 Replace unconditional refresh calls with “ensure valid token”
  - **File**: `chat-memo-pro/js/sync/sync-engine.js`
  - **Acceptance**: Sync operations rely on a valid access token but do not force refresh if not needed

---

## Phase 4: Manual QA

- [ ] T010 Verify SC-001 (next-day persistence)
  - Sign in → close Chrome → reopen later → open Sync Settings → should still show signed-in state

- [ ] T011 Verify SC-002 (network flakiness)
  - Go offline/timeout → Test Connection/Sync → should report network error but keep signed-in state

- [ ] T012 Verify SC-003 (true expiry)
  - Revoke refresh token or change password → refresh should fail with AuthRequired → prompt re-login

- [ ] T013 Verify concurrency safety
  - Trigger multiple token-requiring actions quickly → no rapid session invalidation; no console errors

