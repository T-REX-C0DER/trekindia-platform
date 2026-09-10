-- Migration 006: Enhance Badges and Seed Trek Badges
-- 1. Add trek_id column to badges table if it doesn't exist
ALTER TABLE badges ADD COLUMN IF NOT EXISTS trek_id INT REFERENCES treks(trek_id) ON DELETE CASCADE;

-- 2. Add partial unique index to ensure at most one badge per trek
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_badge_trek ON badges(trek_id) WHERE trek_id IS NOT NULL;

-- 3. Ensure user_treks has proper index and constraint
CREATE INDEX IF NOT EXISTS idx_user_treks_user_status ON user_treks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_treks_completed_at ON user_treks(completed_at);

-- 4. Seed individual badges for all existing treks
INSERT INTO badges (trek_id, slug, name, description, category, requirement_type, requirement_value, icon, rarity)
SELECT 
    t.trek_id,
    'trek-' || t.slug AS slug,
    t.trek_name || ' Explorer' AS name,
    'Completed the ' || t.trek_name || ' in ' || COALESCE(s.state_name, 'India') || '.' AS description,
    'Trek Badges' AS category,
    'trek_completion' AS requirement_type,
    1 AS requirement_value,
    CASE 
        WHEN t.best_time ILIKE '%winter%' OR t.best_time ILIKE '%snow%' OR t.best_time ILIKE '%december%' OR t.best_time ILIKE '%january%' THEN 'snowflake'
        WHEN GREATEST(t.elevation_m, t.highest_point_m) >= 3000 THEN 'mountain'
        WHEN GREATEST(t.elevation_m, t.highest_point_m) >= 2000 THEN 'flag'
        WHEN t.difficulty = 'Difficult' OR t.difficulty = 'Extreme' THEN 'shield'
        ELSE 'compass'
    END AS icon,
    CASE 
        WHEN GREATEST(t.elevation_m, t.highest_point_m) >= 4500 OR t.difficulty = 'Extreme' THEN 'Legendary'
        WHEN GREATEST(t.elevation_m, t.highest_point_m) >= 3000 OR t.difficulty = 'Difficult' THEN 'Epic'
        WHEN GREATEST(t.elevation_m, t.highest_point_m) >= 1500 OR t.difficulty = 'Moderate' THEN 'Rare'
        WHEN t.difficulty = 'Easy' AND GREATEST(t.elevation_m, t.highest_point_m) < 1000 THEN 'Common'
        ELSE 'Uncommon'
    END AS rarity
FROM treks t
LEFT JOIN states s ON t.state_id = s.state_id
ON CONFLICT (slug) DO UPDATE SET
    trek_id = EXCLUDED.trek_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    requirement_type = EXCLUDED.requirement_type,
    requirement_value = EXCLUDED.requirement_value,
    icon = EXCLUDED.icon,
    rarity = EXCLUDED.rarity;
