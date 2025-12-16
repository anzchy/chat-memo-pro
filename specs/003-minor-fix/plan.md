# Implementation Plan: Persistent Cloud Sync Sign-In

**Branch**: `003-minor-fix` | **Date**: 2025-12-15 | **Spec**: [spec.md](./spec.md)
**Input**: Bug report + UX requirement from `/specs/003-minor-fix/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Improve Cloud Sync authentication persistence so users stay signed in until they explicitly click `Sign Out`. The system should refresh Supabase sessions reliably (including refresh token rotation) and should not incorrectly invalidate sign-in due to transient network failures. The Sync Settings UI should show a stable signed-in state based on presence of a refresh token, and should attempt a best-effort silent refresh when opened.

## Technical Context

**Language/Version**: JavaScript ES6+ (Vanilla JS; no build step)
**Target Platform**: Chrome extension (Manifest V3)

**Current Modules**:
- Auth + API wrapper: `chat-memo-pro/js/sync/supabase-client.js`
- Background handlers + auto-sync startup: `chat-memo-pro/js/background.js`
- Sync operations: `chat-memo-pro/js/sync/sync-engine.js`
- UI controller: `chat-memo-pro/js/sync/sync-ui-controller.js`

**Storage**:
- `chrome.storage.local.cloudSync.auth`: stores Supabase session fields (`accessToken`, `refreshToken`, `expiresAt`, `userId`)

## Root Cause Hypotheses (to validate)

1. **Refresh token rotation race**: concurrent refresh calls may rotate refresh token and cause “last write wins” to persist a stale token; later refresh fails and triggers `AuthRequired`.
2. **Incorrect error mapping**: network failures or non-auth failures might be incorrectly treated as `AuthRequired`, causing premature `Paused (Auth Required)` and forcing re-login.
3. **Signed-in detection too strict**: UI/background may require `accessToken` to exist even though it’s recoverable via refresh.

## Primary Technical Approach

1. **Single-flight refresh** in `supabase-client.js`
   - Gate concurrent refresh calls so only one refresh can be in-flight at a time.
   - Ensure the latest returned session (rotated refresh token) is persisted deterministically.

2. **Correct error mapping**
   - Only treat `400/401/403` (or explicit invalid refresh token responses) as `AuthRequired`.
   - Treat timeouts/offline/5xx as `NetworkError/Timeout` and do not force sign-out.

3. **Stable signed-in detection**
   - Define “signed in” as “has refresh token” (and not `Paused (Auth Required)`).
   - Allow access token to be missing and recover it via refresh.

4. **UI refresh-on-open**
   - When Sync Settings UI opens, send a `refreshSession` message to background as best-effort.
   - Refresh should be silent and not block rendering; failures should not automatically flip UI to signed-out unless truly `AuthRequired`.

## Files To Change

- `chat-memo-pro/js/sync/supabase-client.js`
  - Add single-flight refresh
  - Export helper to obtain a valid access token
  - Fix refresh error mapping and pause-state recovery

- `chat-memo-pro/js/background.js`
  - Add `refreshSession` message handler
  - On startup refresh, only disable auto-sync for true `AuthRequired`
  - Adjust “signed-in” predicate to use refresh token

- `chat-memo-pro/js/sync/sync-engine.js`
  - Replace unconditional refresh calls with “ensure valid token” helper

- `chat-memo-pro/js/sync/sync-ui-controller.js`
  - On UI load, trigger best-effort refresh
  - Adjust signed-in checks to use refresh token

## Manual Testing Plan

Follow `TESTING_CHECKLIST.md` Cloud Sync sections plus:

1. **Persistence**: Sign in → close Chrome → reopen next day → open Sync Settings → should still show “Signed in as …”.
2. **Transient network**: While signed in, simulate offline/timeout → “Test Connection” should show network error but keep signed-in UI.
3. **True expiry**: Revoke refresh token or change password → open Sync Settings / attempt sync → should show `Paused (Auth Required)` and require sign-in.
4. **Concurrency**: Trigger multiple token-requiring actions quickly (e.g., open Sync Settings + sync) → no refresh token rotation race / no rapid session invalidation.

