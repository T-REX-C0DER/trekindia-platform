-- TrekIndia Migration 008: Trek Visual Intelligence System
-- Powers the shared Visual Intelligence Engine across TrekVision, Photo-to-Trek Discovery, and Community Post Learning

-- 1. Trek Name Aliases Table (for canonical entity normalization)
CREATE TABLE IF NOT EXISTS trek_name_aliases (
    alias_id BIGSERIAL PRIMARY KEY,
    trek_id INT NOT NULL REFERENCES treks(trek_id) ON DELETE CASCADE,
    alias_name VARCHAR(250) NOT NULL,
    clean_alias VARCHAR(250) NOT NULL,
    is_canonical BOOLEAN NOT NULL DEFAULT FALSE,
    source VARCHAR(50) DEFAULT 'system',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_clean_alias UNIQUE (clean_alias)
);
CREATE INDEX IF NOT EXISTS idx_trek_aliases_trek ON trek_name_aliases(trek_id);
CREATE INDEX IF NOT EXISTS idx_trek_aliases_clean ON trek_name_aliases(clean_alias);

-- 2. Trek Visual Knowledge Table (Aggregated destination-level visual intelligence)
CREATE TABLE IF NOT EXISTS trek_visual_knowledge (
    knowledge_id BIGSERIAL PRIMARY KEY,
    trek_id INT NOT NULL REFERENCES treks(trek_id) ON DELETE CASCADE,
    visual_description TEXT,
    visual_attributes JSONB DEFAULT '{}'::jsonb,
    seasonal_attributes JSONB DEFAULT '{}'::jsonb,
    landmark_information JSONB DEFAULT '[]'::jsonb,
    terrain_archetypes TEXT[] DEFAULT '{}',
    prototype_embeddings JSONB DEFAULT '[]'::jsonb,
    evidence_count INT NOT NULL DEFAULT 0,
    verified_evidence_count INT NOT NULL DEFAULT 0,
    verification_status VARCHAR(30) NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'community_verified', 'curator_verified', 'official_ground_truth')),
    last_updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_trek_knowledge UNIQUE (trek_id)
);
CREATE INDEX IF NOT EXISTS idx_trek_knowledge_trek ON trek_visual_knowledge(trek_id);

-- 3. Unified Trek Image Embeddings Table (Image-level representations with provenance & model versioning)
CREATE TABLE IF NOT EXISTS trek_image_embeddings (
    embedding_id BIGSERIAL PRIMARY KEY,
    trek_id INT REFERENCES treks(trek_id) ON DELETE SET NULL,
    post_id BIGINT REFERENCES community_posts(post_id) ON DELETE CASCADE,
    image_id INT REFERENCES trek_images(image_id) ON DELETE SET NULL,
    image_url TEXT NOT NULL,
    image_hash VARCHAR(64) NOT NULL,
    embedding FLOAT[] NOT NULL,
    dimensions INT NOT NULL DEFAULT 64,
    model_name VARCHAR(100) NOT NULL DEFAULT 'trekindia-python-vit-v1',
    model_version VARCHAR(30) NOT NULL DEFAULT 'v1.0.0',
    preprocessing_version VARCHAR(30) NOT NULL DEFAULT 'v1.0.0',
    confidence_score NUMERIC(5, 4) DEFAULT 0.5000,
    source_type VARCHAR(50) NOT NULL DEFAULT 'community_post' CHECK (source_type IN ('community_post', 'trekvision_upload', 'official_catalog', 'user_memory', 'curated_seed')),
    source_reliability NUMERIC(4, 2) DEFAULT 0.60,
    verification_status VARCHAR(30) NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified', 'disputed', 'rejected')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_img_embeddings_trek ON trek_image_embeddings(trek_id);
CREATE INDEX IF NOT EXISTS idx_img_embeddings_post ON trek_image_embeddings(post_id);
CREATE INDEX IF NOT EXISTS idx_img_embeddings_hash ON trek_image_embeddings(image_hash);
CREATE INDEX IF NOT EXISTS idx_img_embeddings_active ON trek_image_embeddings(is_active) WHERE is_active = TRUE;

-- 4. Visual Processing Jobs Table (Asynchronous post ingestion queue & tracking)
CREATE TABLE IF NOT EXISTS visual_processing_jobs (
    job_id BIGSERIAL PRIMARY KEY,
    post_id BIGINT REFERENCES community_posts(post_id) ON DELETE CASCADE,
    image_url TEXT,
    job_type VARCHAR(50) NOT NULL DEFAULT 'post_ingestion' CHECK (job_type IN ('post_ingestion', 'image_reembed', 'backfill_batch', 'knowledge_rebuild')),
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped', 'retrying')),
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vjobs_status ON visual_processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_vjobs_post ON visual_processing_jobs(post_id);

-- 5. Visual Feedback Table (User feedback, corrections, moderation & continuous learning)
CREATE TABLE IF NOT EXISTS visual_feedback (
    feedback_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    image_url TEXT NOT NULL,
    image_hash VARCHAR(64),
    predicted_trek_id INT REFERENCES treks(trek_id) ON DELETE SET NULL,
    suggested_trek_id INT REFERENCES treks(trek_id) ON DELETE SET NULL,
    feedback_type VARCHAR(50) NOT NULL CHECK (feedback_type IN ('correct_destination', 'incorrect_destination', 'wrong_landmark', 'similar_different_trek', 'not_sure', 'inappropriate_image')),
    user_notes TEXT,
    verification_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected', 'disputed')),
    reviewed_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vfeedback_status ON visual_feedback(verification_status);
CREATE INDEX IF NOT EXISTS idx_vfeedback_pred_trek ON visual_feedback(predicted_trek_id);
CREATE INDEX IF NOT EXISTS idx_vfeedback_sugg_trek ON visual_feedback(suggested_trek_id);

