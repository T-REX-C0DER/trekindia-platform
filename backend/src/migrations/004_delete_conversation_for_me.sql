-- Migration 004: Per-User Conversation Hiding + Gender Field for Avatar System

-- 1. Add hidden_at to conversation_participants for soft-delete "Delete Chat For Me"
--    When set, this conversation will be hidden only for this participant.
--    The other participant's view is unaffected.
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

-- 2. Add gender field to users for avatar category organization
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'prefer_not_to_say'));

-- 3. Add avatar_id field to users for tracking selected preset avatar
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_id VARCHAR(100);

-- 4. Index for filtering hidden conversations efficiently
CREATE INDEX IF NOT EXISTS idx_conv_participants_hidden ON conversation_participants(user_id, hidden_at)
  WHERE hidden_at IS NULL;

-- 5. Note: To restore a hidden conversation (if user starts a new chat with same person),
--    the system should set hidden_at = NULL for that participant row.
