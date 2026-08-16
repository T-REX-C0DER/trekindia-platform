-- TrekIndia Community System Migration
-- Migration 002: Community Posts, Comments, Likes, Saves, Follows, Stories, Messaging, and Notifications

-- 1. Community Posts Table
CREATE TABLE IF NOT EXISTS community_posts (
    post_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    post_type VARCHAR(30) NOT NULL DEFAULT 'experience' CHECK (post_type IN ('experience', 'photo', 'achievement', 'route', 'question')),
    caption TEXT NOT NULL,
    trek_id INT REFERENCES treks(trek_id) ON DELETE SET NULL,
    location VARCHAR(200),
    difficulty VARCHAR(30),
    distance_km NUMERIC(5, 1),
    elevation_m INT,
    duration_days INT,
    hashtags TEXT[] DEFAULT '{}',
    images JSONB DEFAULT '[]'::jsonb,
    likes_count INT NOT NULL DEFAULT 0,
    comments_count INT NOT NULL DEFAULT 0,
    shares_count INT NOT NULL DEFAULT 0,
    saves_count INT NOT NULL DEFAULT 0,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_community_posts_user ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_trek ON community_posts(trek_id);

-- 2. Post Likes Junction Table
CREATE TABLE IF NOT EXISTS community_post_likes (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES community_posts(post_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_post_like UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post ON community_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON community_post_likes(user_id);

-- 3. Post Saves (Bookmarks) Table
CREATE TABLE IF NOT EXISTS community_post_saves (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES community_posts(post_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_post_save UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_saves_user ON community_post_saves(user_id);

-- 4. Post Comments Table
CREATE TABLE IF NOT EXISTS community_comments (
    comment_id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES community_posts(post_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES community_comments(comment_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    likes_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_community_comments_post ON community_comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_community_comments_parent ON community_comments(parent_id);

-- 5. Comment Likes Junction Table
CREATE TABLE IF NOT EXISTS community_comment_likes (
    id BIGSERIAL PRIMARY KEY,
    comment_id BIGINT NOT NULL REFERENCES community_comments(comment_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_comment_like UNIQUE (comment_id, user_id)
);

-- 6. Community User Follows Junction Table
CREATE TABLE IF NOT EXISTS community_follows (
    id BIGSERIAL PRIMARY KEY,
    follower_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    following_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_follow UNIQUE (follower_id, following_id),
    CONSTRAINT check_cannot_follow_self CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_community_follows_follower ON community_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_community_follows_following ON community_follows(following_id);

-- 7. Community Stories Table
CREATE TABLE IF NOT EXISTS community_stories (
    story_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type VARCHAR(20) NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
    caption VARCHAR(200),
    trek_id INT REFERENCES treks(trek_id) ON DELETE SET NULL,
    location VARCHAR(150),
    likes_count INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_community_stories_user ON community_stories(user_id, created_at DESC);

-- 8. Messaging Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
    conversation_id BIGSERIAL PRIMARY KEY,
    is_group BOOLEAN NOT NULL DEFAULT FALSE,
    group_name VARCHAR(100),
    group_avatar TEXT,
    last_message_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. Conversation Participants Junction Table
CREATE TABLE IF NOT EXISTS conversation_participants (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted', 'pending', 'declined')),
    last_read_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_conv_user UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_conv ON conversation_participants(conversation_id);

-- 10. Messages Table
CREATE TABLE IF NOT EXISTS messages (
    message_id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
    sender_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    message_type VARCHAR(30) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'trek_card', 'image', 'route', 'location')),
    content TEXT,
    trek_data JSONB,
    attachment_url TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at ASC);

-- 11. Community Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    notification_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    actor_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    type VARCHAR(40) NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'message', 'trek_share', 'mention', 'badge_earned')),
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    reference_id BIGINT,
    reference_type VARCHAR(40),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
