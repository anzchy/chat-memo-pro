# Supabase Row-Level Security (RLS) Testing Guide

**Feature**: Cloud Sync for Chat Memo Pro
**Date**: 2025-12-13
**Purpose**: Comprehensive guide to verify RLS policies ensure proper user data isolation

---

## Table of Contents

1. [Understanding RLS](#understanding-rls)
2. [Testing Strategy](#testing-strategy)
3. [Pre-Test Setup](#pre-test-setup)
4. [Test Scenarios](#test-scenarios)
5. [Common RLS Pitfalls](#common-rls-pitfalls)
6. [Performance Verification](#performance-verification)
7. [Production Checklist](#production-checklist)

---

## Understanding RLS

### What is Row-Level Security?

Row-Level Security (RLS) is PostgreSQL's built-in mechanism to control which rows users can access in a table. In Supabase, RLS policies use `auth.uid()` to automatically filter data based on the authenticated user.

### Why RLS Matters

**Without RLS**: Any authenticated user could potentially access ALL conversations from ALL users.

**With RLS**: Each user can ONLY access their own data, enforced at the database level.

### How Our RLS Works

```sql
-- This policy ensures users only see rows where user_id matches their auth.uid()
CREATE POLICY "Users can view their own conversations"
  ON conversations
  FOR SELECT
  USING (auth.uid() = user_id);
```

**Key Points**:
- `auth.uid()` returns the UUID of the currently authenticated user
- `USING` clause filters which rows the user can see
- `WITH CHECK` clause validates data being inserted/updated
- Policies are checked on EVERY query automatically

---

## Testing Strategy

### Three-Layer Testing Approach

1. **Database-Level Tests**: Direct SQL queries in Supabase SQL Editor
2. **API-Level Tests**: JavaScript client library calls (Supabase client)
3. **Integration Tests**: Full sync workflow from Chrome extension

### Test Users Required

Create 3 test users in Supabase Authentication:

- **User A** (Primary): `usera@test.com` / `password123`
- **User B** (Secondary): `userb@test.com` / `password123`
- **Anon User** (Unauthenticated): No login

---

## Pre-Test Setup

### Step 1: Create Test Users

```sql
-- Run in Supabase SQL Editor with service role privileges
-- (Or create via Dashboard → Authentication → Users → Add User)

-- Note: Normally users are created via Supabase Auth signup flow
-- This is for testing only
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'usera@test.com', crypt('password123', gen_salt('bf')), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'userb@test.com', crypt('password123', gen_salt('bf')), NOW());
```

**Alternative (Recommended)**: Use Supabase Dashboard → Authentication → Add User

### Step 2: Insert Test Data

```sql
-- Insert test conversations for User A
INSERT INTO conversations (user_id, platform, platform_conversation_id, title, metadata)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'chatgpt', 'conv-a1', 'User A Conversation 1', '{"test": true}'),
  ('11111111-1111-1111-1111-111111111111', 'claude', 'conv-a2', 'User A Conversation 2', '{"test": true}');

-- Insert test conversations for User B
INSERT INTO conversations (user_id, platform, platform_conversation_id, title, metadata)
VALUES
  ('22222222-2222-2222-2222-222222222222', 'chatgpt', 'conv-b1', 'User B Conversation 1', '{"test": true}'),
  ('22222222-2222-2222-2222-222222222222', 'gemini', 'conv-b2', 'User B Conversation 2', '{"test": true}');

-- Insert test messages for User A's first conversation
INSERT INTO messages (user_id, platform, platform_conversation_id, message_key, role, content_text, message_index)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'chatgpt', 'conv-a1', 'chatgpt|conv-a1|0', 'user', 'Hello from User A', 0),
  ('11111111-1111-1111-1111-111111111111', 'chatgpt', 'conv-a1', 'chatgpt|conv-a1|1', 'assistant', 'Response to User A', 1);

-- Insert test messages for User B's first conversation
INSERT INTO messages (user_id, platform, platform_conversation_id, message_key, role, content_text, message_index)
VALUES
  ('22222222-2222-2222-2222-222222222222', 'chatgpt', 'conv-b1', 'chatgpt|conv-b1|0', 'user', 'Hello from User B', 0),
  ('22222222-2222-2222-2222-222222222222', 'chatgpt', 'conv-b1', 'chatgpt|conv-b1|1', 'assistant', 'Response to User B', 1);
```

### Step 3: Verify Data Inserted

```sql
-- This query bypasses RLS (requires service role)
SELECT
  user_id,
  platform,
  platform_conversation_id,
  title
FROM conversations
ORDER BY user_id, created_at;

-- Should show 4 conversations: 2 for User A, 2 for User B
```

---

## Test Scenarios

### Test 1: User A Can Only See Their Own Conversations

**Purpose**: Verify SELECT policy isolates user data

```sql
-- Simulate User A's session
-- In Supabase SQL Editor, use "Run as User A" or set auth context:
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

-- Query conversations (RLS automatically filters)
SELECT id, user_id, title FROM conversations;

-- EXPECTED RESULT: 2 rows (User A's conversations only)
-- FAIL CONDITION: If you see User B's conversations
```

**Verification**:
```sql
-- Count should be 2
SELECT COUNT(*) FROM conversations;
```

### Test 2: User B Can Only See Their Own Conversations

```sql
-- Simulate User B's session
SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

SELECT id, user_id, title FROM conversations;

-- EXPECTED RESULT: 2 rows (User B's conversations only)
-- FAIL CONDITION: If you see User A's conversations
```

### Test 3: User A Cannot INSERT Data for User B

**Purpose**: Verify INSERT policy prevents impersonation

```sql
-- As User A, try to insert conversation for User B
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

INSERT INTO conversations (user_id, platform, platform_conversation_id, title)
VALUES ('22222222-2222-2222-2222-222222222222', 'chatgpt', 'malicious-conv', 'Hacked!');

-- EXPECTED RESULT: ERROR - new row violates row-level security policy
-- FAIL CONDITION: If insert succeeds
```

### Test 4: User A Can INSERT Data for Themselves

```sql
-- As User A, insert their own conversation
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

INSERT INTO conversations (user_id, platform, platform_conversation_id, title)
VALUES ('11111111-1111-1111-1111-111111111111', 'gemini', 'conv-a3', 'User A New Conversation')
RETURNING id, user_id, title;

-- EXPECTED RESULT: Success, returns inserted row
-- FAIL CONDITION: If insert fails
```

### Test 5: User A Cannot UPDATE User B's Data

```sql
-- As User A, try to update User B's conversation
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

UPDATE conversations
SET title = 'Hacked by User A'
WHERE platform = 'chatgpt' AND platform_conversation_id = 'conv-b1';

-- EXPECTED RESULT: UPDATE 0 (no rows affected, RLS filtered them out)
-- FAIL CONDITION: If update affects User B's data
```

### Test 6: User A Can UPDATE Their Own Data

```sql
-- As User A, update their own conversation
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

UPDATE conversations
SET title = 'Updated by User A'
WHERE platform = 'chatgpt' AND platform_conversation_id = 'conv-a1'
RETURNING title;

-- EXPECTED RESULT: Success, returns updated row
-- FAIL CONDITION: If update fails or affects wrong rows
```

### Test 7: User A Cannot DELETE User B's Data

```sql
-- As User A, try to delete User B's conversation
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

DELETE FROM conversations
WHERE platform = 'chatgpt' AND platform_conversation_id = 'conv-b1';

-- EXPECTED RESULT: DELETE 0 (no rows affected)
-- FAIL CONDITION: If delete affects User B's data
```

### Test 8: Unauthenticated Access is Denied

```sql
-- Simulate unauthenticated user (no auth.uid())
RESET request.jwt.claim.sub;

SELECT * FROM conversations;

-- EXPECTED RESULT: 0 rows (auth.uid() = NULL fails all policies)
-- FAIL CONDITION: If any rows are returned
```

### Test 9: Messages RLS Isolation

```sql
-- As User A, query messages
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

SELECT user_id, message_key, content_text FROM messages;

-- EXPECTED RESULT: 2 rows (User A's messages only)
-- FAIL CONDITION: If you see User B's messages
```

### Test 10: Cross-Table Join Respects RLS

```sql
-- As User A, join conversations and messages
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

SELECT
  c.title,
  m.content_text
FROM conversations c
JOIN messages m ON (
  c.user_id = m.user_id AND
  c.platform = m.platform AND
  c.platform_conversation_id = m.platform_conversation_id
);

-- EXPECTED RESULT: Only User A's data in both tables
-- FAIL CONDITION: If User B's data appears in results
```

---

## Common RLS Pitfalls

### Pitfall 1: Forgetting to Enable RLS

**Problem**: Tables created without RLS enabled are wide open.

```sql
-- DANGEROUS - No RLS
CREATE TABLE conversations (...);

-- SAFE - RLS enabled
CREATE TABLE conversations (...);
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
```

**Test**:
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('conversations', 'messages');

-- rowsecurity should be TRUE for both tables
```

### Pitfall 2: Policy Ordering Confusion

**Misconception**: Policy order matters.
**Reality**: PostgreSQL evaluates ALL policies with OR logic.

```sql
-- These are equivalent (order doesn't matter)
CREATE POLICY "policy_a" ON conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "policy_b" ON conversations FOR SELECT USING (role = 'admin');

-- User passes if EITHER policy allows access
```

**Best Practice**: Create separate policies for different operations (SELECT, INSERT, UPDATE, DELETE).

### Pitfall 3: Missing INSERT vs. SELECT Policies

**Problem**: Forgetting to create policies for each operation type.

```sql
-- INCOMPLETE - Only SELECT allowed
CREATE POLICY "select_policy" ON conversations FOR SELECT USING (auth.uid() = user_id);

-- COMPLETE - All operations covered
CREATE POLICY "select_policy" ON conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_policy" ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_policy" ON conversations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_policy" ON conversations FOR DELETE USING (auth.uid() = user_id);
```

**Test**:
```sql
-- Verify all 4 operations have policies
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'conversations'
ORDER BY cmd;

-- Should see: DELETE, INSERT, SELECT, UPDATE (or ALL)
```

### Pitfall 4: Using USING Without WITH CHECK on INSERT

**Problem**: INSERT policies need `WITH CHECK`, not `USING`.

```sql
-- WRONG - USING doesn't validate inserts
CREATE POLICY "insert_policy" ON conversations FOR INSERT USING (auth.uid() = user_id);

-- CORRECT - WITH CHECK validates new rows
CREATE POLICY "insert_policy" ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
```

**Why**: `USING` filters existing rows (for SELECT/UPDATE/DELETE). `WITH CHECK` validates new/modified rows.

### Pitfall 5: Forgetting Cascading Deletes

**Problem**: When user is deleted, their data should be cleaned up.

```sql
-- SAFE - Data is deleted when user is deleted
user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
```

**Test**:
```sql
-- Verify foreign key has CASCADE
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('conversations', 'messages')
  AND kcu.column_name = 'user_id';

-- delete_rule should be 'CASCADE'
```

### Pitfall 6: Performance - Missing user_id Index

**Problem**: RLS policy `WHERE auth.uid() = user_id` does table scan without index.

```sql
-- CRITICAL - Always index the RLS filter column
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
```

**Test**:
```sql
-- Check if user_id is indexed
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('conversations', 'messages')
  AND indexdef LIKE '%user_id%';

-- Should see indexes on user_id
```

### Pitfall 7: auth.uid() Returns NULL When Not Authenticated

**Problem**: Unauthenticated requests have `auth.uid() = NULL`, which fails all comparisons.

```sql
-- This policy ALLOWS unauthenticated access (DANGEROUS)
CREATE POLICY "bad_policy" ON conversations FOR SELECT USING (true);

-- This policy DENIES unauthenticated access (SAFE)
CREATE POLICY "good_policy" ON conversations FOR SELECT USING (auth.uid() = user_id);
-- When auth.uid() is NULL, NULL = user_id evaluates to NULL (falsy), denying access
```

**Test**:
```sql
-- Verify unauthenticated access is denied
RESET request.jwt.claim.sub;

SELECT COUNT(*) FROM conversations; -- Should return 0
```

---

## Performance Verification

### Test 1: Explain Plan Shows Index Usage

```sql
-- As User A, explain a query
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

EXPLAIN ANALYZE
SELECT * FROM conversations
WHERE platform = 'chatgpt';

-- EXPECTED RESULT: Should show "Index Scan using idx_conversations_user_id"
-- FAIL CONDITION: If it shows "Seq Scan" (table scan)
```

### Test 2: Large Dataset Performance

```sql
-- Insert 10,000 test conversations for User A
INSERT INTO conversations (user_id, platform, platform_conversation_id, title)
SELECT
  '11111111-1111-1111-1111-111111111111',
  'chatgpt',
  'conv-' || i,
  'Test Conversation ' || i
FROM generate_series(1, 10000) AS i;

-- Query should still be fast (<100ms)
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

\timing on
SELECT COUNT(*) FROM conversations WHERE platform = 'chatgpt';
\timing off

-- EXPECTED RESULT: <100ms execution time
-- FAIL CONDITION: >500ms (indicates missing index or seq scan)
```

### Test 3: Incremental Sync Query Performance

```sql
-- Simulate incremental sync: "Get conversations updated since timestamp"
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

EXPLAIN ANALYZE
SELECT id, platform, platform_conversation_id, updated_at
FROM conversations
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC;

-- EXPECTED RESULT: Should use idx_conversations_updated_at + idx_conversations_user_id
-- FAIL CONDITION: Full table scan
```

---

## Production Checklist

Before deploying RLS to production, verify ALL items:

### Security Checklist

- [ ] RLS is enabled on `conversations` table
- [ ] RLS is enabled on `messages` table
- [ ] All 4 operation policies exist for `conversations` (SELECT, INSERT, UPDATE, DELETE)
- [ ] All 4 operation policies exist for `messages`
- [ ] INSERT policies use `WITH CHECK`, not `USING`
- [ ] UPDATE policies use both `USING` and `WITH CHECK`
- [ ] Foreign key to `auth.users` has `ON DELETE CASCADE`
- [ ] Unauthenticated queries return 0 rows
- [ ] User A cannot see User B's data
- [ ] User A cannot insert/update/delete User B's data

### Performance Checklist

- [ ] Index exists on `conversations.user_id`
- [ ] Index exists on `messages.user_id`
- [ ] Index exists on `conversations.updated_at`
- [ ] Index exists on `messages.updated_at`
- [ ] Index exists on `conversations(user_id, platform)`
- [ ] Index exists on `messages(user_id, platform, platform_conversation_id, message_index)`
- [ ] Explain plans show index scans, not seq scans
- [ ] Query with 10k+ rows completes in <100ms

### Functional Checklist

- [ ] User can SELECT their own conversations
- [ ] User can INSERT their own conversations
- [ ] User can UPDATE their own conversations
- [ ] User can DELETE their own conversations (soft delete via `deleted_at`)
- [ ] Incremental sync query (updated_at filter) works correctly
- [ ] Message stable keys prevent duplicates across devices
- [ ] Composite unique constraints prevent duplicate conversations/messages

### Monitoring Checklist

- [ ] Enable slow query logging in Supabase (Settings → Database → Performance)
- [ ] Monitor RLS policy cache hit rate
- [ ] Set up alerts for failed INSERT/UPDATE due to RLS violations
- [ ] Track average query execution time in production

---

## Troubleshooting

### Issue: "new row violates row-level security policy"

**Cause**: Trying to INSERT/UPDATE a row where `user_id` doesn't match `auth.uid()`.

**Solution**:
```javascript
// WRONG - Hard-coded user_id
const { data, error } = await supabase
  .from('conversations')
  .insert({ user_id: 'some-uuid', platform: 'chatgpt', ... });

// CORRECT - Let RLS use auth.uid() automatically
const { data: { user } } = await supabase.auth.getUser();
const { data, error } = await supabase
  .from('conversations')
  .insert({ user_id: user.id, platform: 'chatgpt', ... });
```

### Issue: Query returns 0 rows but data exists

**Cause**: User is not authenticated or RLS is filtering data.

**Solution**:
```javascript
// Check if user is authenticated
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session); // Should not be null

// Verify user_id matches
const { data, error } = await supabase
  .from('conversations')
  .select('user_id')
  .limit(1);
console.log('User ID:', data?.[0]?.user_id);
```

### Issue: Performance degradation with many users

**Cause**: Missing indexes on RLS filter columns.

**Solution**:
```sql
-- Add/verify indexes
CREATE INDEX CONCURRENTLY idx_conversations_user_id ON conversations(user_id);
CREATE INDEX CONCURRENTLY idx_messages_user_id ON messages(user_id);

-- Use CONCURRENTLY to avoid locking tables in production
```

---

## Additional Resources

- **Supabase RLS Documentation**: https://supabase.com/docs/guides/auth/row-level-security
- **PostgreSQL RLS Policies**: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- **Supabase Auth Helpers**: https://supabase.com/docs/guides/auth/auth-helpers
- **Performance Tuning**: https://supabase.com/docs/guides/database/query-performance

---

**Last Updated**: 2025-12-13
**Next Review**: Before production deployment
