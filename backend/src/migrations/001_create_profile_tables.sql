-- TrekIndia User Profile System Migration

-- 1. Extend user_profiles table if needed
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS location VARCHAR(150);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{"difficulty":[], "terrains":[], "seasons":[]}'::jsonb;

-- 2. User Treks Table (Completed, Saved, Wishlist)
CREATE TABLE IF NOT EXISTS user_treks (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    trek_id INT NOT NULL REFERENCES treks(trek_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('completed', 'saved', 'wishlist')),
    completed_at TIMESTAMPTZ,
    personal_rating NUMERIC(3, 1),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_trek_status UNIQUE (user_id, trek_id, status)
);

CREATE INDEX IF NOT EXISTS idx_user_treks_user_status ON user_treks(user_id, status);

-- 3. Badges Catalog Table
CREATE TABLE IF NOT EXISTS badges (
    badge_id SERIAL PRIMARY KEY,
    slug VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(40) NOT NULL DEFAULT 'Milestones',
    requirement_type VARCHAR(50) NOT NULL,
    requirement_value INT NOT NULL DEFAULT 1,
    icon VARCHAR(50) NOT NULL DEFAULT 'award',
    rarity VARCHAR(20) NOT NULL DEFAULT 'Common',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. User Badges Junction Table
CREATE TABLE IF NOT EXISTS user_badges (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    badge_id INT NOT NULL REFERENCES badges(badge_id) ON DELETE CASCADE,
    earned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_badge UNIQUE (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);

-- 5. User Activities Feed Table
CREATE TABLE IF NOT EXISTS user_activities (
    activity_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    trek_id INT REFERENCES treks(trek_id) ON DELETE SET NULL,
    badge_id INT REFERENCES badges(badge_id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_activities_user ON user_activities(user_id, created_at DESC);

-- 6. Trek Reviews Table
CREATE TABLE IF NOT EXISTS trek_reviews (
    review_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    trek_id INT NOT NULL REFERENCES treks(trek_id) ON DELETE CASCADE,
    rating NUMERIC(2, 1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(150),
    review_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_trek_review UNIQUE (user_id, trek_id)
);

CREATE INDEX IF NOT EXISTS idx_trek_reviews_user ON trek_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_trek_reviews_trek ON trek_reviews(trek_id);

-- 7. Seed Initial Badge Catalog
INSERT INTO badges (slug, name, description, category, requirement_type, requirement_value, icon, rarity)
VALUES
    ('first-step', 'First Step', 'Completed your first official trek.', 'Milestones', 'treks_completed', 1, 'footprints', 'Common'),
    ('trail-explorer', 'Trail Explorer', 'Hiked 50km across diverse terrains.', 'Distance', 'distance_km', 50, 'compass', 'Rare'),
    ('frost-walker', 'Frost Walker', 'Completed a high-altitude winter or snow trek.', 'Seasonal', 'winter_trek', 1, 'snowflake', 'Epic'),
    ('mountain-hunter', 'Mountain Hunter', 'Complete 10 distinct mountain treks.', 'Milestones', 'treks_completed', 10, 'mountain', 'Rare'),
    ('summit-seeker', 'Summit Seeker', 'Reach 5 peaks above 3000 meters elevation.', 'Elevation', 'summit_3000m', 5, 'flag', 'Epic'),
    ('himalayan-legend', 'Himalayan Legend', 'Complete a high altitude trek above 4500m.', 'Elevation', 'summit_4500m', 1, 'gem', 'Legendary'),
    ('state-explorer', 'State Explorer', 'Explore treks across 3 or more Indian states.', 'Exploration', 'states_explored', 3, 'map-pin', 'Rare'),
    ('distance-crusher', 'Distance Crusher', 'Log over 200 km of total trekking distance.', 'Distance', 'distance_km', 200, 'zap', 'Epic'),
    ('trail-veteran', 'Trail Veteran', 'Complete 25 official treks.', 'Milestones', 'treks_completed', 25, 'shield', 'Legendary')
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    requirement_type = EXCLUDED.requirement_type,
    requirement_value = EXCLUDED.requirement_value,
    icon = EXCLUDED.icon,
    rarity = EXCLUDED.rarity;
