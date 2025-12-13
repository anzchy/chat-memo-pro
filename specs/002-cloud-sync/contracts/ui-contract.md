# UI Contract: Cloud Sync Settings & Status

This defines UI behavior for the Cloud Sync feature inside the extension.

## Entry Points

- Settings panel → Export Data → **Cloud Sync Settings**
- Extension icon right-click menu → **Sync Settings**

## Modal: Cloud Sync Settings

### Setup Section

- Shows a short explanation + **Copy SQL** button.
- Copy SQL content must match `specs/002-cloud-sync/contracts/supabase-schema.sql`.

### Configuration Inputs

- Project URL (required)
- Anon/Public API Key (required)
- Email + Password sign-in (required)

Validation rules and connection test steps must match `specs/002-cloud-sync/spec.md` (“Configuration Validation Rules” and “Connection Test”).

### Actions

- **Test Connection**
- **Save**
- **Sign Out**
- **Sync Now**
- **Download from Cloud**
- **Replace Local with Cloud** (requires destructive confirmation)
- **Reset Sync State**
- **Force Full Re-sync**

### Auto-Sync Controls

- Toggle: enable/disable auto-sync
- Interval selector: 5m, 15m, 30m, 1h, custom (min 5m, max 24h)

## Status Panel (FR-015 / Sync State Machine)

Must render:

- Current state (one of the states defined in `specs/002-cloud-sync/spec.md`)
- Last synced timestamp (or “Never”)
- Next auto-sync timestamp (or “Disabled”)
- Local count: conversations/messages
- Cloud count: conversations/messages (best-effort; may be “Unknown” if unavailable)

## Progress Indicator (FR-017)

- When syncing, show `"Syncing... X of Y conversations (Z%)"`.
- Update at least once per batch (see spec limits).

## Sync History (FR-016)

- Show last 20 operations.
- Each entry displays:
  - timestamp, type (manual/auto), direction, result, synced/failed counts
  - expandable details (error message, warnings) without leaking secrets

### History Storage Shape

Persisted in `chrome.storage.local` as `cloudSync.history[]`:

`SyncHistoryEntry`: `{ id: string, startedAt: string, finishedAt?: string, type: "manual"|"auto", direction: "upload"|"download"|"two-way", status: "success"|"failed"|"partial", synced: number, failed: number, warnings: number, errorCode?: string, message?: string }`

