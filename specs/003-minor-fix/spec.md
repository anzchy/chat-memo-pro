# Feature Specification: Persistent Cloud Sync Sign-In

**Feature Branch**: `003-minor-fix`
**Created**: 2025-12-15
**Status**: Draft
**Input**: User description: "在 chat-memo-pro 插件中 cloud sync settings 中 Sign in，目前 email 和 pwd 很快就失效了，我需要持久化登录状态，只要用户没有点击 logout，就持续登录，而不是过了不到 1 天就要重复登录"

## Clarifications

### Session 2025-12-15

- Q: “持久化登录状态”定义是什么？→ A: 只要用户不点 `Sign Out`，就保持登录；即使浏览器重启/服务 worker 休眠/过了一天，也应自动恢复会话并保持 UI 显示为已登录
- Q: 什么情况下才要求重新登录？→ A: 只有在 refresh token 失效/被撤销/密码变更导致 refresh 失败（明确的 AuthRequired）时才提示重新登录；网络错误/超时不应把用户踢出登录态
- Q: UI 的“是否已登录”依据是什么？→ A: 以持久化的 Supabase session（至少包含 `refresh_token`）为准；access token 可能过期或缺失，应可通过 refresh 恢复

## Definitions & Limits

### Definitions (Unambiguous Terms)

- **Signed-in (Cloud Sync)**: 本地已持久化一个可用于获取新 access token 的 `refresh_token`，并且 sync state 不是 `Paused (Auth Required)`
- **Session refresh**: 使用 `refresh_token` 调用 Supabase `/auth/v1/token?grant_type=refresh_token` 获取新的 access token（可能伴随 refresh token rotation）
- **AuthRequired**: 明确的鉴权失败（如 HTTP `400/401/403` 或 Supabase 返回表示 refresh token 无效/过期），需要用户重新登录
- **Transient network failure**: 超时/离线/DNS/临时 5xx 等，允许重试，不应强制用户重新登录
- **Single-flight refresh**: 同一时刻只允许一个 refresh 请求在飞，避免并发 refresh 导致 refresh token 轮换后互相覆盖从而“快速失效”

### Limits (MVP Defaults)

- **Refresh buffer**: access token 距离过期 <60 秒时触发 refresh
- **Retries**: refresh 失败仅对网络类错误按现有 backoff 机制处理；对 AuthRequired 不重试，直接进入暂停态

## Behavioral Contract

### State Machine Interactions

- 如果 refresh 成功且之前处于 `Paused (Auth Required)`，系统 MUST 自动恢复到 `Connected (Idle)` 并清除 `pausedReason/lastError*`
- 如果 refresh 失败且为 `AuthRequired`，系统 MUST 进入 `Paused (Auth Required)` 并要求用户重新登录；auto-sync MUST 被禁用
- 如果 refresh 失败为网络类错误（超时/离线/5xx），系统 MUST 保持已登录（不清空 session），并允许后续重试/再次打开 UI 时再尝试 refresh

### UI Contract (Sync Settings)

- Sync Settings 打开时 SHOULD 进行一次 best-effort 的 session refresh（静默，不阻塞 UI）
- UI 的“Signed in / Signed out”展示 MUST 以 `refresh_token` 是否存在为主，而不是以 access token 是否存在为主
- 用户点击 `Sign Out` MUST 清除本地 auth session（包括 refresh token）并回到未登录状态

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Persistent Sign-In (Priority: P1)

As a user who enabled Cloud Sync, I want to stay signed in until I explicitly sign out, so that I don’t have to re-enter credentials frequently.

**SC-001**: Given user has signed in successfully, When user reopens Chrome the next day and opens Sync Settings, Then UI still shows signed-in state and sync actions are available without re-entering password.

### User Story 2 - Network Flakiness Should Not Log Out (Priority: P1)

As a user with unstable network, I want transient network failures to not invalidate my sign-in status, so that I can retry later without re-authentication.

**SC-002**: Given user is signed in, When connection test or sync encounters a timeout/offline, Then system reports network error but does not force sign-out or require re-login.

### User Story 3 - Real Session Expiry Requires Re-Auth (Priority: P1)

As a user, I want the system to clearly tell me when my session is truly expired/revoked, so I know when re-login is required.

**SC-003**: Given refresh token is revoked/invalid, When the extension attempts to refresh, Then sync enters `Paused (Auth Required)` and UI prompts user to sign in again.

## Functional Requirements

- **FR-001 (Persistence)**: 系统 MUST 在 `chrome.storage.local` 持久化 Supabase auth session（至少 `refresh_token`），并在需要时自动 refresh
- **FR-002 (Single-flight refresh)**: 系统 MUST 对 refresh 操作进行 single-flight，避免并发 refresh 导致 token rotation 互相覆盖
- **FR-003 (Error mapping)**: 系统 MUST 区分 AuthRequired 与 network/timeout，并且仅在 AuthRequired 时进入 `Paused (Auth Required)` 并要求重新登录
- **FR-004 (UI signed-in logic)**: UI MUST 以 `refresh_token` 是否存在判断登录态；access token 可缺失/过期但应可通过 refresh 恢复
- **FR-005 (Recovery)**: 若后续 refresh 成功，系统 MUST 从 `Paused (Auth Required)` 自动恢复到 `Connected (Idle)` 并清除暂停原因
- **FR-006 (Sign out)**: 用户点击 `Sign Out` MUST 清除本地 auth session 并禁用 auto-sync

## Non-Functional Requirements

- **NFR-001 (Security)**: 扩展 MUST NOT log API keys、passwords、access tokens、refresh tokens
- **NFR-002 (Offline-first UX)**: 网络错误 MUST 以可重试方式展示，且不破坏已登录状态

