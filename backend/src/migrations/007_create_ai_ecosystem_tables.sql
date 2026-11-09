-- Migration 007: Comprehensive TrekIndia AI Ecosystem Schema
-- Integrates all 8 production AI features with strict relational integrity and PostGIS compatibility.

-- 1. Helper function for vector cosine similarity (pure PostgreSQL, no external binary dependencies)
CREATE OR REPLACE FUNCTION cosine_similarity(a float[], b float[])
RETURNS float AS $$
DECLARE
    dot_product float := 0;
    norm_a float := 0;
    norm_b float := 0;
    len int;
    i int;
BEGIN
    IF a IS NULL OR b IS NULL THEN
        RETURN 0;
    END IF;
    len := array_length(a, 1);
    IF len IS NULL OR len != array_length(b, 1) THEN
        RETURN 0;
    END IF;
    FOR i IN 1..len LOOP
        dot_product := dot_product + (a[i] * b[i]);
        norm_a := norm_a + (a[i] * a[i]);
        norm_b := norm_b + (b[i] * b[i]);
    END LOOP;
    IF norm_a = 0 OR norm_b = 0 THEN
        RETURN 0;
    END IF;
    RETURN dot_product / (sqrt(norm_a) * sqrt(norm_b));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. AI TrekVision: Image analysis logs & mountain feature detection
CREATE TABLE IF NOT EXISTS ai_image_analysis (
    analysis_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    trek_id INT REFERENCES treks(trek_id) ON DELETE SET NULL,
    image_hash VARCHAR(64),
    detected_features JSONB NOT NULL DEFAULT '{}'::jsonb,
    confidence_score NUMERIC(4,3) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    suggested_trek_ids INT[] DEFAULT '{}',
    user_consent_retained BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_vision_user ON ai_image_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_vision_trek ON ai_image_analysis(trek_id);

-- 3. AI Trek Cost Intelligence: Estimates & Components
CREATE TABLE IF NOT EXISTS trek_cost_estimates (
    estimate_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    trek_id INT NOT NULL REFERENCES treks(trek_id) ON DELETE CASCADE,
    starting_city VARCHAR(100) NOT NULL,
    group_size INT NOT NULL CHECK (group_size > 0),
    duration_days INT NOT NULL CHECK (duration_days > 0),
    season VARCHAR(50),
    tier VARCHAR(20) NOT NULL CHECK (tier IN ('budget', 'standard', 'comfortable')),
    total_cost_inr NUMERIC(10,2) NOT NULL CHECK (total_cost_inr >= 0),
    per_person_inr NUMERIC(10,2) NOT NULL CHECK (per_person_inr >= 0),
    assumptions JSONB DEFAULT '{}'::jsonb,
    currency VARCHAR(10) DEFAULT 'INR',
    effective_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_trek_cost_trek ON trek_cost_estimates(trek_id);
CREATE INDEX IF NOT EXISTS idx_trek_cost_user ON trek_cost_estimates(user_id);

CREATE TABLE IF NOT EXISTS trek_cost_components (
    component_id BIGSERIAL PRIMARY KEY,
    estimate_id BIGINT NOT NULL REFERENCES trek_cost_estimates(estimate_id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    amount_inr NUMERIC(10,2) NOT NULL CHECK (amount_inr >= 0),
    is_shared BOOLEAN DEFAULT false,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_cost_components_estimate ON trek_cost_components(estimate_id);

-- 4. AI Trek Memory Map: Memories & Completed Trek Trail Logs
CREATE TABLE IF NOT EXISTS trek_memories (
    memory_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    trek_id INT NOT NULL REFERENCES treks(trek_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    notes TEXT,
    photo_url TEXT,
    altitude_m INT,
    completed_at TIMESTAMPTZ,
    visibility VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    ai_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_trek_memories_user ON trek_memories(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_trek_memories_trek ON trek_memories(trek_id);

-- 5. AI Offline Trek Companion: Package Registry & Sync
CREATE TABLE IF NOT EXISTS offline_downloads (
    download_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
    trek_id INT NOT NULL REFERENCES treks(trek_id) ON DELETE CASCADE,
    package_version VARCHAR(20) NOT NULL,
    size_bytes BIGINT NOT NULL,
    checksum VARCHAR(64),
    package_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_offline_trek UNIQUE (user_id, trek_id)
);
CREATE INDEX IF NOT EXISTS idx_offline_downloads_user ON offline_downloads(user_id);

-- 6. AI Emergency SOS Intelligence: Trusted Contacts & Incidents
CREATE TABLE IF NOT EXISTS sos_contacts (
    contact_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(200),
    relationship VARCHAR(50),
    is_verified BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sos_contacts_user ON sos_contacts(user_id);

CREATE TABLE IF NOT EXISTS sos_incidents (
    incident_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    trek_id INT REFERENCES treks(trek_id) ON DELETE SET NULL,
    incident_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'high' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location_accuracy_m NUMERIC(6,2),
    location_timestamp TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'acknowledged', 'resolving', 'resolved', 'cancelled')),
    ai_summary TEXT,
    first_aid_guidance JSONB DEFAULT '{}'::jsonb,
    notifications_sent JSONB DEFAULT '[]'::jsonb,
    audit_log JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sos_incidents_user ON sos_incidents(user_id);
CREATE INDEX IF NOT EXISTS idx_sos_incidents_status ON sos_incidents(status);

-- 7. AI Photo-to-Trek Discovery: Destination Visual Embeddings
CREATE TABLE IF NOT EXISTS trek_visual_embeddings (
    embedding_id BIGSERIAL PRIMARY KEY,
    trek_id INT NOT NULL REFERENCES treks(trek_id) ON DELETE CASCADE,
    image_id INT REFERENCES trek_images(image_id) ON DELETE SET NULL,
    image_url TEXT NOT NULL,
    embedding FLOAT[] NOT NULL,
    feature_tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_trek_embeddings_trek ON trek_visual_embeddings(trek_id);

-- 8. AI Trek Nutrition Planner: Practical Trail Meal Plans
CREATE TABLE IF NOT EXISTS nutrition_plans (
    plan_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    trek_id INT NOT NULL REFERENCES treks(trek_id) ON DELETE CASCADE,
    duration_days INT NOT NULL CHECK (duration_days > 0),
    diet_type VARCHAR(50) NOT NULL,
    activity_intensity VARCHAR(30) DEFAULT 'Moderate',
    allergies TEXT[] DEFAULT '{}',
    facilities VARCHAR(50),
    food_carrying_style VARCHAR(50),
    daily_meals JSONB NOT NULL DEFAULT '[]'::jsonb,
    shopping_list JSONB NOT NULL DEFAULT '[]'::jsonb,
    packing_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
    estimated_food_cost_inr NUMERIC(10,2),
    hydration_guideline TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_trek ON nutrition_plans(trek_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_user ON nutrition_plans(user_id);

