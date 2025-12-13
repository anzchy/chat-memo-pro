# Quickstart: Cloud Sync (Supabase)

This feature uses **your own Supabase project** (Auth + Postgres + RLS). No service role key is used.

## 1) Create a Supabase project

1. Create a new project in Supabase.
2. In **Authentication → Providers**, ensure **Email** sign-in is enabled.
3. Create a test user (email + password) you will use in the extension.

## 2) Create required tables (SQL migration)

1. Open Supabase Dashboard → **SQL Editor**
2. Open `specs/002-cloud-sync/contracts/supabase-schema.sql`
3. Copy/paste the full script and click **Run**
4. Verify tables exist: **Database → Tables** → `conversations`, `messages`

## 3) Configure the extension

1. Load the extension unpacked: Chrome → `chrome://extensions` → Developer mode → Load unpacked → select `chat-memo-pro/`
2. Open the side panel → **Settings** → **Export Data** → **Cloud Sync Settings**
3. Fill:
   - Project URL (e.g. `https://lgnisbcqkfjyfrwywudd.supabase.co`)
   - Anon/Public API Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnbmlzYmNxa2ZqeWZyd3l3dWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MzczOTUsImV4cCI6MjA4MTIxMzM5NX0.VK6tHE1zWs2C0G-eUB16gv7-TlXg_Cu-eQgFjvwRKbI`
   - Email + Password (Supabase Auth)
4. Click **Test Connection** and confirm it reports success.



How to find the following parameters in Supabase.

• - **Project URL**

   \- Supabase Dashboard → 选中你的项目 → **Project Settings** → **API**

   \- 找 **Project URL**（形如 https://xxxx.supabase.co）

 \- **Anon/Public API Key**

   \- 同一页面（**Project Settings → API**）

   \- 找 **Project API keys** → **anon / public**（不是 service_role）

   \- 复制这个 key（通常是很长的 JWT 字符串）

 \- **Email + Password（Supabase Auth）**

   \- Supabase Dashboard → **Authentication** → **Users**

   \- 方式 A：在 **Users** 里点 **Add user**，设置 email/password

   \- 方式 B：在 **Authentication → Providers** 确保 **Email** 开启，然后用你的 App/扩展去注册/登录（看你是否实现了 Sign Up；目前 UI 只有 Sign In）

 \- **Anon key 是否所有项目都一样？**

   \- **不是。** Anon/public key 是**每个 Supabase 项目独立**的一对 API key 之一（项目级别），不同项目的 anon key 不相同。

   \- 同一个项目里 anon key 通常长期不变，但你可以在 Dashboard 里轮换/重置密钥（重置后旧 key 会失效）。

## 4) Smoke test (single device)

1. Create a few conversations locally (any supported platform).
2. Click **Sync Now** and confirm:
   - Status shows progress
   - Status ends with a timestamp and “up to date”
3. In Supabase Table Editor, confirm rows appear in `conversations` and `messages`.

## 5) Cross-device test (two Chrome profiles)

1. Chrome Profile A: create data, run **Sync Now**
2. Chrome Profile B: configure the same Supabase project + user, then click **Download from Cloud**
3. Confirm conversations appear locally and no duplicates occur.

## 6) RLS isolation test (security)

This verifies that **User A cannot read User B’s rows** under RLS policies.

1. Create two Supabase Auth users: **User A** and **User B**
2. Configure the extension with **User A**, run **Sync Now** (creates some rows)
3. Sign out, then sign in as **User B**
4. Click **Download from Cloud**
5. Expected: User B sees **0 conversations/messages** (or only User B’s own data if you created any)

For deeper validation, follow `specs/002-cloud-sync/contracts/rls-testing-guide.md`.

## 7) Incremental sync verification

1. Run **Sync Now** once (baseline)
2. Create exactly 1 new message in an existing conversation
3. Run **Sync Now** again
4. Expected: sync result indicates only the changed conversation/messages were uploaded (not a full re-upload), and `updated_at` changes only for affected rows in Supabase.

## Failure simulations

- Network: DevTools → Network → Offline → run **Sync Now** → expect “Network error — check your connection and retry.”
- Auth expiry: sign out in the UI → expect “Not Configured”; or revoke user/session in Supabase → expect “Session expired — please sign in again.”
- Cloud limits: artificially exceed payload/limits → expect “Auto-sync paused — cloud limit reached. Resolve the limit and retry.”
