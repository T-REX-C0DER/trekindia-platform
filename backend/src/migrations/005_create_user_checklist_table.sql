-- Migration 005: Create User Checklist Table for TrekIndia Smart Packing Checklist

CREATE TABLE IF NOT EXISTS user_checklists (
    user_id BIGINT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_checklists_user ON user_checklists(user_id);
