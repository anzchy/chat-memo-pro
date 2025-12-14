# Supabase Row-Level Security (RLS) Best Practices & Performance Guide

**Feature**: Cloud Sync for Chat Memo Pro
**Date**: 2025-12-13
**Purpose**: Production-ready RLS patterns, rationale, and performance optimization

---

## Executive Summary

### Decision: Complete SQL Migration with RLS

We use Supabase Row-Level Security (RLS) with `auth.uid()` for multi-user data isolation because:

1. **Database-Enforced Security**: RLS runs at the PostgreSQL level, making it impossible to bypass through application bugs or API misconfigurations
2. **Zero Trust Architecture**: Even if the client code is compromised, users cannot access other users' data
3. **Automatic Policy Enforcement**: Every query automatically filters data by authenticated user - no manual filtering needed
4. **Performance at Scale**: Properly indexed RLS policies add minimal overhead (<5ms per query)

### Rationale: Why RLS Ensures User Isolation

**Traditional Application-Level Security (Vulnerable)**:
```javascript
// DANGEROUS - Easy to forget this check in some API endpoints
function getConversations(userId) {
  return db.query('SELECT * FROM conversations WHERE user_id = ?', [userId]);
}
```

**RLS Database-Level Security (Secure)**:
```sql
-- ENFORCED - PostgreSQL automatically adds WHERE auth.uid() = user_id to EVERY query
CREATE POLICY "Users can view their own conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = user_id);
```

Even if application code has a bug like this:
```javascript
// BUG - No user_id filter in query
const { data } = await supabase.from('conversations').select('*');
```

RLS automatically transforms it to:
```sql
-- RLS adds this filter automatically
SELECT * FROM conversations WHERE auth.uid() = user_id;
```

**Result**: User A can NEVER see User B's data, regardless of application bugs.

---

## RLS Core Concepts

### 1. Policy Types and When to Use Each

| Operation | Policy Clause | Purpose | Example Use Case |
|-----------|---------------|---------|------------------|
| **SELECT** | `USING` | Filter which existing rows user can read | View own conversations |
| **INSERT** | `WITH CHECK` | Validate new rows being created | Prevent creating conversations for other users |
| **UPDATE** | `USING` + `WITH CHECK` | Filter rows user can modify + validate changes | Update own conversation title |
| **DELETE** | `USING` | Filter which rows user can delete | Delete own conversations |

### 2. USING vs. WITH CHECK

**USING Clause**:
- Filters **existing rows** in the table
- Used for: SELECT, UPDATE, DELETE
- Applied BEFORE operation executes

```sql
-- "Show me only rows where I'm the owner"
USING (auth.uid() = user_id)
```

**WITH CHECK Clause**:
- Validates **new or modified rows**
- Used for: INSERT, UPDATE
- Applied AFTER operation executes

```sql
-- "Ensure the new row belongs to me"
WITH CHECK (auth.uid() = user_id)
```

**UPDATE Needs Both**:
```sql
CREATE POLICY "update_policy" ON conversations FOR UPDATE
  USING (auth.uid() = user_id)      -- Can only update my own rows
  WITH CHECK (auth.uid() = user_id); -- Cannot change user_id to someone else
```

### 3. Policy Evaluation Logic

PostgreSQL evaluates policies with **OR logic** (permissive by default):

```sql
-- Two policies on same table
CREATE POLICY "policy_1" ON conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "policy_2" ON conversations FOR SELECT USING (role = 'admin');

-- User passes if EITHER policy allows access
-- Regular users see their own data
-- Admins see all data
```

**Key Insight**: You can have multiple policies per operation - they are combined with OR.

---

## Production-Ready RLS Patterns

### Pattern 1: Standard User Isolation (Our Implementation)

**Use Case**: Multi-tenant application where users should only see their own data.

```sql
-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Four separate policies for clarity and maintainability
CREATE POLICY "conversations_select" ON conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "conversations_insert" ON conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "conversations_update" ON conversations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "conversations_delete" ON conversations FOR DELETE
  USING (auth.uid() = user_id);
```

**Why Separate Policies?**
- **Clarity**: Each operation's logic is explicit
- **Debugging**: Easy to identify which operation is failing
- **Flexibility**: Can modify SELECT without affecting INSERT
- **Maintainability**: Simpler for future developers

**Alternative (Combined Policy)**:
```sql
-- Single policy for all operations (less recommended)
CREATE POLICY "conversations_all" ON conversations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Pattern 2: Soft Deletes with RLS

**Use Case**: Mark rows as deleted without actually removing them (for recovery/audit).

```sql
-- Add deleted_at column
ALTER TABLE conversations ADD COLUMN deleted_at TIMESTAMPTZ;

-- Policy shows only non-deleted rows
CREATE POLICY "conversations_select_active" ON conversations FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Soft delete via UPDATE
CREATE POLICY "conversations_soft_delete" ON conversations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id); -- Allows setting deleted_at
```

**Client Usage**:
```javascript
// Soft delete (UPDATE deleted_at)
await supabase
  .from('conversations')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', conversationId);

// Restore (UPDATE deleted_at to null)
await supabase
  .from('conversations')
  .update({ deleted_at: null })
  .eq('id', conversationId);

// Hard delete (admin only, requires separate policy)
await supabase
  .from('conversations')
  .delete()
  .eq('id', conversationId);
```

### Pattern 3: Composite Keys with RLS

**Use Case**: Prevent duplicate conversations per user + platform combination.

```sql
-- Composite unique constraint
ALTER TABLE conversations
  ADD CONSTRAINT unique_conversation_per_user
  UNIQUE(user_id, platform, platform_conversation_id);

-- RLS policy
CREATE POLICY "conversations_select" ON conversations FOR SELECT
  USING (auth.uid() = user_id);
```

**Why This Works**:
- RLS filters by `user_id`
- Unique constraint prevents duplicates within the filtered set
- User A and User B can have same `platform_conversation_id` (different `user_id`)

### Pattern 4: Related Tables with Cascading RLS

**Use Case**: Messages belong to conversations - ensure consistency.

```sql
-- Foreign key with CASCADE
CREATE TABLE messages (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- ... other columns
);

-- RLS on messages mirrors conversations
CREATE POLICY "messages_select" ON messages FOR SELECT
  USING (auth.uid() = user_id);
```

**Benefits**:
- When user is deleted, all their conversations AND messages are deleted
- RLS on both tables ensures consistent access control
- Queries joining tables automatically respect both RLS policies

---

## Performance Optimization

### Critical Indexes for RLS

**Problem**: RLS policies add `WHERE auth.uid() = user_id` to every query. Without an index, this causes a full table scan.

**Solution**: Always index RLS filter columns.

```sql
-- CRITICAL - Index user_id for RLS performance
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
```

**Performance Impact**:
| Rows | Without Index | With Index |
|------|---------------|------------|
| 1,000 | 50ms | 2ms |
| 10,000 | 500ms | 5ms |
| 100,000 | 5,000ms | 10ms |
| 1,000,000 | 50,000ms | 15ms |

### Composite Indexes for Common Queries

**Pattern**: Combine RLS filter column with frequently queried columns.

```sql
-- Query: "Get user's ChatGPT conversations"
-- Optimized index includes both filter columns
CREATE INDEX idx_conversations_user_platform
  ON conversations(user_id, platform);

-- Query: "Get conversations updated since timestamp"
CREATE INDEX idx_conversations_user_updated
  ON conversations(user_id, updated_at DESC);
```

**Index Selection Strategy**:
1. Always include `user_id` as first column (RLS filter)
2. Add frequently filtered columns (e.g., `platform`)
3. Add sort columns (e.g., `updated_at DESC`)

**Example Query Optimization**:
```sql
-- Query
SELECT * FROM conversations
WHERE platform = 'chatgpt'
ORDER BY updated_at DESC
LIMIT 100;

-- RLS transforms to
SELECT * FROM conversations
WHERE auth.uid() = user_id          -- Filter 1 (RLS)
  AND platform = 'chatgpt'           -- Filter 2 (app)
ORDER BY updated_at DESC
LIMIT 100;

-- Best index
CREATE INDEX idx_conversations_optimized
  ON conversations(user_id, platform, updated_at DESC);
```

### Partial Indexes for Filtered Queries

**Use Case**: Queries that frequently filter by a specific condition (e.g., non-deleted rows).

```sql
-- Partial index for active conversations only
CREATE INDEX idx_conversations_active
  ON conversations(user_id, updated_at DESC)
  WHERE deleted_at IS NULL;
```

**Benefits**:
- Smaller index size (excludes deleted rows)
- Faster queries for active data
- Automatic use when query includes `WHERE deleted_at IS NULL`

**Query**:
```sql
-- Automatically uses partial index
SELECT * FROM conversations
WHERE deleted_at IS NULL
ORDER BY updated_at DESC;
```

### Incremental Sync Query Optimization

**Use Case**: "Get all conversations updated since last sync timestamp."

```sql
-- Query pattern
SELECT * FROM conversations
WHERE updated_at > ?
ORDER BY updated_at ASC;

-- Optimized index
CREATE INDEX idx_conversations_updated_sync
  ON conversations(user_id, updated_at ASC);
```

**Why ASC (not DESC)?**
- Sync queries use `updated_at > last_sync_time`
- ASC index is more efficient for range scans starting from a timestamp

**Performance**:
- 100 conversations updated in last hour: <5ms
- 10,000 conversations total: Still <10ms (thanks to index)

### Monitoring RLS Performance

**Query 1: Check if indexes are being used**
```sql
EXPLAIN ANALYZE
SELECT * FROM conversations
WHERE platform = 'chatgpt'
ORDER BY updated_at DESC;

-- Look for:
-- ✓ "Index Scan using idx_conversations_user_platform"
-- ✗ "Seq Scan on conversations" (BAD - add index)
```

**Query 2: Identify slow queries**
```sql
-- Enable slow query logging in Supabase
-- Dashboard → Settings → Database → Performance

-- Query slow query log
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query LIKE '%conversations%'
ORDER BY mean_time DESC
LIMIT 10;
```

**Query 3: Index usage statistics**
```sql
-- Check which indexes are actually used
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('conversations', 'messages')
ORDER BY idx_scan DESC;

-- Low idx_scan = index not being used (consider dropping)
```

---

## Common RLS Pitfalls and Solutions

### Pitfall 1: Forgetting to Enable RLS

**Problem**:
```sql
CREATE TABLE conversations (...);
-- RLS NOT enabled - table is wide open!
```

**Solution**:
```sql
CREATE TABLE conversations (...);
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
```

**Verification**:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'conversations';

-- rowsecurity MUST be 't' (true)
```

### Pitfall 2: Missing Policies for Some Operations

**Problem**:
```sql
-- Only SELECT policy exists
CREATE POLICY "select_only" ON conversations FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT will FAIL because no INSERT policy exists
```

**Solution**:
```sql
-- Create policies for ALL operations
CREATE POLICY "select" ON conversations FOR SELECT USING (...);
CREATE POLICY "insert" ON conversations FOR INSERT WITH CHECK (...);
CREATE POLICY "update" ON conversations FOR UPDATE USING (...) WITH CHECK (...);
CREATE POLICY "delete" ON conversations FOR DELETE USING (...);
```

**Quick Check**:
```sql
-- Should return 4 rows (one per operation)
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'conversations';
```

### Pitfall 3: Using USING in INSERT Policy

**Problem**:
```sql
-- WRONG - USING doesn't validate inserts
CREATE POLICY "insert_wrong" ON conversations FOR INSERT
  USING (auth.uid() = user_id);
```

**Why It Fails**: `USING` filters existing rows (there are none for INSERT).

**Solution**:
```sql
-- CORRECT - WITH CHECK validates new rows
CREATE POLICY "insert_correct" ON conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### Pitfall 4: Null auth.uid() Breaks Policies

**Problem**:
```sql
-- When user not authenticated, auth.uid() returns NULL
-- NULL = user_id evaluates to NULL (falsy)
-- Result: Query returns 0 rows (silent failure)
```

**Solution**: This is actually CORRECT behavior - unauthenticated users should see nothing.

**Debugging**:
```javascript
// Check authentication status
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  console.error('User not authenticated!');
}
```

### Pitfall 5: Ignoring Policy Cache

**Problem**: RLS policies are cached by PostgreSQL. Changes may not take effect immediately.

**Solution**:
```sql
-- Force policy cache refresh (after modifying policies)
DISCARD PLANS;

-- Or reconnect to database
```

**In Supabase**: Policy changes take effect immediately in SQL Editor but may cache in client connections.

### Pitfall 6: Over-Complex Policies

**Problem**:
```sql
-- COMPLEX - Hard to debug
CREATE POLICY "complex" ON conversations FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM team_members WHERE team_members.user_id = auth.uid() AND team_members.team_id = conversations.team_id)
    OR auth.jwt() ->> 'role' = 'admin'
  );
```

**Solution**: Break into multiple policies.
```sql
-- SIMPLE - Easy to debug
CREATE POLICY "own_conversations" ON conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "team_conversations" ON conversations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.user_id = auth.uid()
      AND team_members.team_id = conversations.team_id
  ));

CREATE POLICY "admin_all_conversations" ON conversations FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');
```

**Benefits**:
- Each policy is independently testable
- Can enable/disable policies individually
- Clearer intent for future developers

---

## Testing Strategy

### Unit Tests (SQL Level)

**Test 1: Verify RLS Enabled**
```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('conversations', 'messages')
  AND rowsecurity = true;
-- Should return 2 rows
```

**Test 2: Verify All Policies Exist**
```sql
SELECT tablename, COUNT(*) FROM pg_policies
WHERE tablename IN ('conversations', 'messages')
GROUP BY tablename;
-- Should return: conversations=4, messages=4
```

**Test 3: Simulate User A**
```sql
SET request.jwt.claim.sub = 'user-a-uuid';
SELECT COUNT(*) FROM conversations;
-- Should return only User A's count
```

**Test 4: Verify Cross-User Isolation**
```sql
-- As User A, try to see User B's data
SET request.jwt.claim.sub = 'user-a-uuid';
SELECT COUNT(*) FROM conversations WHERE user_id = 'user-b-uuid';
-- Should return 0
```

### Integration Tests (JavaScript Level)

**Test 1: Authenticated User Sees Own Data**
```javascript
const { data: session } = await supabase.auth.signIn({
  email: 'usera@test.com',
  password: 'password123'
});

const { data, error } = await supabase
  .from('conversations')
  .select('*');

expect(data.every(c => c.user_id === session.user.id)).toBe(true);
```

**Test 2: Cannot Insert for Another User**
```javascript
const { data, error } = await supabase
  .from('conversations')
  .insert({
    user_id: 'another-user-uuid', // Not current user
    platform: 'chatgpt',
    platform_conversation_id: 'test'
  });

expect(error).toBeTruthy();
expect(error.message).toContain('row-level security policy');
```

### Load Tests

**Test 1: Performance with 100k Conversations**
```sql
-- Insert 100k test rows
INSERT INTO conversations (user_id, platform, platform_conversation_id, title)
SELECT
  'test-user-uuid',
  'chatgpt',
  'conv-' || i,
  'Test ' || i
FROM generate_series(1, 100000) AS i;

-- Query should still be fast
\timing on
SET request.jwt.claim.sub = 'test-user-uuid';
SELECT COUNT(*) FROM conversations WHERE platform = 'chatgpt';
\timing off

-- Target: <100ms
```

---

## Migration Checklist

Before running the migration in production:

### Pre-Migration

- [ ] Review SQL script for typos
- [ ] Verify table structure matches application schema
- [ ] Ensure all indexes are defined
- [ ] Confirm RLS policies match security requirements
- [ ] Test script in development environment first

### Migration Execution

- [ ] Backup existing database (if migrating from existing schema)
- [ ] Run migration during low-traffic period
- [ ] Monitor for errors during execution
- [ ] Verify all tables created successfully
- [ ] Verify all indexes created successfully
- [ ] Verify RLS enabled on all tables

### Post-Migration Verification

- [ ] Run verification queries (see script)
- [ ] Check RLS policy count (8 total: 4 per table)
- [ ] Test authentication flow
- [ ] Test user isolation (User A cannot see User B's data)
- [ ] Verify index usage in EXPLAIN plans
- [ ] Monitor query performance (should be <100ms)
- [ ] Test incremental sync query
- [ ] Verify soft delete behavior

### Production Monitoring

- [ ] Enable slow query logging
- [ ] Set up alerts for RLS policy violations
- [ ] Monitor index usage statistics
- [ ] Track average query execution time
- [ ] Review policy cache hit rate

---

## Performance Benchmarks

Based on Supabase free tier (shared CPU, 500MB DB):

| Operation | Rows | Expected Time | With Index | Without Index |
|-----------|------|---------------|------------|---------------|
| SELECT (single user) | 100 | <5ms | ✓ | 20ms |
| SELECT (single user) | 10,000 | <20ms | ✓ | 500ms |
| INSERT | 1 | <5ms | N/A | N/A |
| INSERT (batch 100) | 100 | <50ms | N/A | N/A |
| UPDATE (single) | 1 | <5ms | ✓ | 10ms |
| Incremental sync query | 100 updated | <10ms | ✓ | 100ms |
| Join conversations + messages | 100 conversations | <30ms | ✓ | 500ms |

**Scaling Considerations**:
- Up to 100k conversations per user: Excellent performance
- 100k-1M conversations: Good performance (may need query optimization)
- 1M+ conversations: Consider partitioning by date/platform

---

## Resources

### Official Documentation
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase Performance Guide](https://supabase.com/docs/guides/database/query-performance)

### Community Resources
- [RLS Patterns Repository](https://github.com/supabase/supabase/discussions/categories/database)
- [Supabase Discord - #database channel](https://discord.supabase.com)

### Tools
- [Supabase SQL Editor](https://app.supabase.com/project/_/sql)
- [EXPLAIN Visualizer](https://explain.dalibo.com/)
- [PostgreSQL Index Advisor](https://github.com/ankane/dexter)

---

**Document Version**: 1.0.0
**Last Updated**: 2025-12-13
**Maintained By**: Chat Memo Pro Development Team
