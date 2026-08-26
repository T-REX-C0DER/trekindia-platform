-- Migration 003: Upgrade Messaging Schema for Kafka KRaft & Realtime WebSocket Delivery

-- 1. Extend Users with Realtime Presence tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS online_status VARCHAR(20) DEFAULT 'offline' CHECK (online_status IN ('online', 'offline', 'away'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- 2. Extend Conversations for quick snippet indexing
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_text TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_sender_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL;

-- 3. Extend Conversation Participants
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS last_delivered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT FALSE;

-- 4. Extend Messages with status, idempotency key and delivery/read timestamps
ALTER TABLE messages ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read'));
ALTER TABLE messages ADD COLUMN IF NOT EXISTS client_message_id VARCHAR(100);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 5. Indexes for fast retrieval and conversation queries
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_client_id ON messages(client_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_status ON messages(sender_id, status);
CREATE INDEX IF NOT EXISTS idx_conv_last_message ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_online ON users(online_status);
