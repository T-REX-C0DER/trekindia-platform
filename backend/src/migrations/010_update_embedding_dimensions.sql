-- TrekIndia Migration 010: Update Visual Intelligence Embeddings to 576 Dimensions (PyTorch MobileNetV3)
-- Replaces previous 64-dim / 32-dim mock heuristic vectors with genuine deep visual embeddings.

-- 1. Ensure dimensions default is 576
ALTER TABLE trek_image_embeddings ALTER COLUMN dimensions SET DEFAULT 576;
ALTER TABLE trek_image_embeddings ALTER COLUMN model_name SET DEFAULT 'trekindia-vision-mobilenet-v3';
ALTER TABLE trek_image_embeddings ALTER COLUMN model_version SET DEFAULT '2.0.0';

-- 2. Clean out any legacy or inactive embeddings with mismatched dimensions
DELETE FROM trek_image_embeddings WHERE dimensions != 576;
DELETE FROM trek_visual_embeddings WHERE array_length(embedding, 1) != 576;

-- 3. Document update in processing jobs
INSERT INTO visual_processing_jobs (job_type, status, metadata, completed_at)
VALUES (
  'dimension_upgrade_576',
  'completed',
  '{"engine": "trekindia-vision-mobilenet-v3", "dimensions": 576, "framework": "PyTorch 2.15 CPU"}',
  CURRENT_TIMESTAMP
);
