-- ============================================================================
-- Supabase Quota Detection SQL Functions
-- ============================================================================
-- Purpose: Enable programmatic quota checking for Chat Memo Pro sync feature
-- Context: Free tier has 500MB storage limit, no direct API to check usage
-- Usage: Run this in Supabase Dashboard > SQL Editor after main migration
-- ============================================================================

-- Function: Get current database size in bytes
-- Returns: bigint (total database size including all tables, indexes, overhead)
-- Used by: quota-detector.js to calculate storage quota percentage
CREATE OR REPLACE FUNCTION get_database_size()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_database_size(current_database());
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_database_size() TO authenticated;

-- Optional: Grant to anon role if you want quota checking without auth
-- (Not recommended for security, but useful for testing)
-- GRANT EXECUTE ON FUNCTION get_database_size() TO anon;

-- ============================================================================
-- Function: Get conversations table size (more precise)
-- Returns: bigint (size of conversations table only)
-- Used by: Optional - for more accurate quota tracking of just this extension
-- ============================================================================
CREATE OR REPLACE FUNCTION get_conversations_table_size()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_total_relation_size('conversations');
$$;

GRANT EXECUTE ON FUNCTION get_conversations_table_size() TO authenticated;

-- ============================================================================
-- Function: Get messages table size
-- Returns: bigint (size of messages table only)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_messages_table_size()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_total_relation_size('messages');
$$;

GRANT EXECUTE ON FUNCTION get_messages_table_size() TO authenticated;

-- ============================================================================
-- Function: Get combined Chat Memo Pro storage usage
-- Returns: JSON with breakdown of storage by table
-- Example: { "conversations_bytes": 1048576, "messages_bytes": 2097152, "total_bytes": 3145728 }
-- ============================================================================
CREATE OR REPLACE FUNCTION get_chat_memo_storage_usage()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'conversations_bytes', pg_total_relation_size('conversations'),
    'messages_bytes', pg_total_relation_size('messages'),
    'total_bytes', pg_total_relation_size('conversations') + pg_total_relation_size('messages'),
    'database_total_bytes', pg_database_size(current_database())
  );
$$;

GRANT EXECUTE ON FUNCTION get_chat_memo_storage_usage() TO authenticated;

-- ============================================================================
-- Usage Examples (for testing in SQL Editor)
-- ============================================================================

-- Get database size (what free tier quota counts)
-- SELECT get_database_size();

-- Get storage usage breakdown
-- SELECT get_chat_memo_storage_usage();

-- Calculate percentage of 500MB free tier limit
-- SELECT
--   (get_database_size()::float / (500 * 1024 * 1024)::float * 100)::numeric(5,2) as percentage_used;

-- Get human-readable sizes
-- SELECT
--   pg_size_pretty(get_database_size()) as total_db_size,
--   pg_size_pretty((get_chat_memo_storage_usage()->>'conversations_bytes')::bigint) as conversations_size,
--   pg_size_pretty((get_chat_memo_storage_usage()->>'messages_bytes')::bigint) as messages_size;

-- ============================================================================
-- Notes:
-- ============================================================================
-- 1. SECURITY DEFINER means these functions run with creator's permissions,
--    not the caller's. This allows authenticated users to query system tables
--    they normally couldn't access.
--
-- 2. pg_database_size() returns TOTAL database size (all apps using this project)
--    If you have other apps/tables, this will include them.
--
-- 3. pg_total_relation_size() includes table + indexes + TOAST
--    This is accurate for per-table storage tracking.
--
-- 4. Free tier quota (500MB) applies to database size, not API requests.
--    These functions do NOT count against storage quota significantly
--    (they only add metadata, ~few KB per function definition).
--
-- 5. Calling these functions DOES count toward API request quota.
--    Recommendation: Call at most once per auto-sync cycle (e.g., every 15min).
--
-- 6. For client-side usage in quota-detector.js:
--    const { data, error } = await supabaseClient.rpc('get_database_size');
--    const sizeBytes = data; // Returns bigint
-- ============================================================================
