-- ============================================================================
-- Chat Memo Pro - Supabase Database Schema Migration
-- ============================================================================
-- Purpose: Create conversations and messages tables with Row-Level Security
-- Author: Generated for Chat Memo Pro Cloud Sync Feature
-- Date: 2025-12-13
-- Version: 1.0.0
--
-- INSTRUCTIONS:
-- 1. Open your Supabase Dashboard → SQL Editor
-- 2. Copy and paste this entire script
-- 3. Click "Run" to execute
-- 4. Verify tables appear in Database → Tables
-- 5. Test connection from Chat Memo Pro extension
--
-- IMPORTANT: This script is idempotent - safe to run multiple times
-- ============================================================================

-- ============================================================================
-- PART 1: ENABLE REQUIRED EXTENSIONS
-- ============================================================================

-- Enable UUID generation (required for primary keys)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for faster text search (optional but recommended)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";


-- ============================================================================
-- PART 2: CREATE TABLES
-- ============================================================================

-- ============================================================================
-- Table: conversations
-- Purpose: Store conversation metadata with platform-specific data
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
  -- Primary identifier (UUID for Supabase compatibility)
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- User isolation field (CRITICAL for RLS)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Platform identification
  platform TEXT NOT NULL,
  platform_conversation_id TEXT NOT NULL,

  -- Conversation metadata
  title TEXT,

  -- Timestamps (all use TIMESTAMPTZ for timezone awareness)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  -- Platform-specific metadata (JSON for flexibility)
  -- Examples: conversation settings, tags, custom platform fields
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Composite unique constraint for conversation identity
  -- This prevents duplicate conversations per user+platform+platform_id
  CONSTRAINT unique_conversation_per_user
    UNIQUE(user_id, platform, platform_conversation_id)
);

-- ============================================================================
-- Table: messages
-- Purpose: Store individual messages with stable composite keys
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
  -- Primary identifier (UUID for Supabase compatibility)
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- User isolation field (CRITICAL for RLS)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Message location identifiers
  platform TEXT NOT NULL,
  platform_conversation_id TEXT NOT NULL,

  -- Stable composite key for conflict-free merging
  -- Format: "platform|platform_conversation_id|message_index|platform_message_id"
  -- This ensures messages can be uniquely identified across devices
  message_key TEXT NOT NULL,

  -- Message content
  role TEXT NOT NULL, -- 'user', 'assistant', 'system'
  content_text TEXT,

  -- Message position for ordering (critical for conversation flow)
  message_index INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- Platform-specific metadata (JSON for flexibility)
  -- Examples: attachments, formatting, platform message IDs, etc.
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Foreign key to conversations (optional but recommended for data integrity)
  -- Note: This is a soft reference - we use platform+platform_conversation_id
  -- conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,

  -- Composite unique constraint for message identity
  -- This prevents duplicate messages per user+message_key
  CONSTRAINT unique_message_per_user
    UNIQUE(user_id, message_key)
);


-- ============================================================================
-- PART 3: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- ============================================================================
-- Indexes for conversations table
-- ============================================================================

-- Index for user_id (RLS policy optimization - CRITICAL)
-- This dramatically speeds up RLS checks: WHERE auth.uid() = user_id
CREATE INDEX IF NOT EXISTS idx_conversations_user_id
  ON conversations(user_id);

-- Composite index for conversation lookups by platform
-- Speeds up queries: WHERE user_id = X AND platform = Y
CREATE INDEX IF NOT EXISTS idx_conversations_user_platform
  ON conversations(user_id, platform);

-- Index for platform_conversation_id (used in joins and lookups)
CREATE INDEX IF NOT EXISTS idx_conversations_platform_conv_id
  ON conversations(platform, platform_conversation_id);

-- Index for updated_at (critical for incremental sync)
-- Speeds up queries: WHERE updated_at > last_sync_time ORDER BY updated_at
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
  ON conversations(updated_at DESC);

-- Index for synced_at (track sync status)
CREATE INDEX IF NOT EXISTS idx_conversations_synced_at
  ON conversations(synced_at DESC NULLS LAST);

-- Partial index for active (non-deleted) conversations
-- Speeds up queries that exclude deleted conversations
CREATE INDEX IF NOT EXISTS idx_conversations_active
  ON conversations(user_id, updated_at)
  WHERE deleted_at IS NULL;

-- GIN index for JSONB metadata searching (optional but useful)
CREATE INDEX IF NOT EXISTS idx_conversations_metadata
  ON conversations USING GIN(metadata);


-- ============================================================================
-- Indexes for messages table
-- ============================================================================

-- Index for user_id (RLS policy optimization - CRITICAL)
CREATE INDEX IF NOT EXISTS idx_messages_user_id
  ON messages(user_id);

-- Composite index for message lookups by conversation
-- Speeds up queries: WHERE user_id = X AND platform = Y AND platform_conversation_id = Z
CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages(user_id, platform, platform_conversation_id, message_index);

-- Index for message_key (unique identifier for conflict resolution)
CREATE INDEX IF NOT EXISTS idx_messages_message_key
  ON messages(message_key);

-- Index for updated_at (critical for incremental sync)
CREATE INDEX IF NOT EXISTS idx_messages_updated_at
  ON messages(updated_at DESC);

-- Index for message_index (ordering messages within conversations)
CREATE INDEX IF NOT EXISTS idx_messages_index
  ON messages(platform, platform_conversation_id, message_index);

-- Partial index for active (non-deleted) messages
CREATE INDEX IF NOT EXISTS idx_messages_active
  ON messages(user_id, platform, platform_conversation_id, message_index)
  WHERE deleted_at IS NULL;

-- GIN index for JSONB metadata searching (optional but useful)
CREATE INDEX IF NOT EXISTS idx_messages_metadata
  ON messages USING GIN(metadata);

-- Text search index for content_text (enables fast full-text search)
CREATE INDEX IF NOT EXISTS idx_messages_content_search
  ON messages USING GIN(to_tsvector('english', content_text));


-- ============================================================================
-- PART 4: ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- ============================================================================
-- Enable RLS on both tables (CRITICAL for security)
-- ============================================================================
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies for conversations table
-- ============================================================================

-- Policy: Users can SELECT their own conversations
CREATE POLICY "Users can view their own conversations"
  ON conversations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can INSERT their own conversations
CREATE POLICY "Users can insert their own conversations"
  ON conversations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can UPDATE their own conversations
CREATE POLICY "Users can update their own conversations"
  ON conversations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can DELETE their own conversations (soft delete via deleted_at)
CREATE POLICY "Users can delete their own conversations"
  ON conversations
  FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================================
-- RLS Policies for messages table
-- ============================================================================

-- Policy: Users can SELECT their own messages
CREATE POLICY "Users can view their own messages"
  ON messages
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can INSERT their own messages
CREATE POLICY "Users can insert their own messages"
  ON messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can UPDATE their own messages
CREATE POLICY "Users can update their own messages"
  ON messages
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can DELETE their own messages
CREATE POLICY "Users can delete their own messages"
  ON messages
  FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================================
-- PART 5: HELPER FUNCTIONS (Optional but Recommended)
-- ============================================================================

-- ============================================================================
-- Function: update_updated_at_column()
-- Purpose: Automatically update updated_at on row modification
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for conversations table
DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for messages table
DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- Function: generate_message_key()
-- Purpose: Helper function to generate stable message keys
-- Usage: SELECT generate_message_key('chatgpt', 'conv-123', 5, 'msg-abc');
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_message_key(
  p_platform TEXT,
  p_conversation_id TEXT,
  p_message_index INTEGER,
  p_platform_message_id TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
BEGIN
  IF p_platform_message_id IS NOT NULL THEN
    RETURN p_platform || '|' || p_conversation_id || '|' || p_message_index || '|' || p_platform_message_id;
  ELSE
    RETURN p_platform || '|' || p_conversation_id || '|' || p_message_index;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ============================================================================
-- PART 6: VERIFICATION QUERIES
-- ============================================================================

-- Run these queries to verify the migration was successful:

-- Check if tables exist
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversations') THEN
    RAISE NOTICE '✓ Table "conversations" created successfully';
  ELSE
    RAISE WARNING '✗ Table "conversations" NOT found';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
    RAISE NOTICE '✓ Table "messages" created successfully';
  ELSE
    RAISE WARNING '✗ Table "messages" NOT found';
  END IF;
END $$;

-- Check if RLS is enabled
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversations' AND rowsecurity = true) THEN
    RAISE NOTICE '✓ RLS enabled on "conversations"';
  ELSE
    RAISE WARNING '✗ RLS NOT enabled on "conversations"';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages' AND rowsecurity = true) THEN
    RAISE NOTICE '✓ RLS enabled on "messages"';
  ELSE
    RAISE WARNING '✗ RLS NOT enabled on "messages"';
  END IF;
END $$;

-- Count policies (should be 4 per table = 8 total)
SELECT
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('conversations', 'messages')
GROUP BY schemaname, tablename;


-- ============================================================================
-- MIGRATION COMPLETE!
-- ============================================================================
-- Next Steps:
-- 1. Verify output shows "✓" for all checks
-- 2. Check Database → Tables in Supabase Dashboard
-- 3. Create a test user in Authentication → Users
-- 4. Test connection from Chat Memo Pro extension
-- 5. Verify RLS by trying to query data from different user contexts
-- ============================================================================
