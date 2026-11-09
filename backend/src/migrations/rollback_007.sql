-- Rollback for Migration 007
DROP TABLE IF EXISTS nutrition_plans CASCADE;
DROP TABLE IF EXISTS trek_visual_embeddings CASCADE;
DROP TABLE IF EXISTS sos_incidents CASCADE;
DROP TABLE IF EXISTS sos_contacts CASCADE;
DROP TABLE IF EXISTS offline_downloads CASCADE;
DROP TABLE IF EXISTS trek_memories CASCADE;
DROP TABLE IF EXISTS trek_cost_components CASCADE;
DROP TABLE IF EXISTS trek_cost_estimates CASCADE;
DROP TABLE IF EXISTS ai_image_analysis CASCADE;
DROP FUNCTION IF EXISTS cosine_similarity(float[], float[]);

