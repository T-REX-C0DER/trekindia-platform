/**
 * TrekIndia — Feature 7: AI Photo-to-Trek Discovery Service
 * Visual Feature Extraction & Vector Cosine Similarity Search Against Real Trek Destinations
 * Powered by Deep Vision Engine (PyTorch MobileNetV3 + 576-dim L2 embeddings)
 */

import { validateImageInput } from './visionService.js';
import {
  extractVisualFeatureVector,
  searchVisualIntelligence,
  ENGINE_METADATA
} from './visualIntelligenceService.js';

export { ENGINE_METADATA };

/**
 * Search treks by uploaded image
 */
export async function searchTreksByPhoto({
  imageBase64,
  mimeType = 'image/jpeg',
  stateFilter = null,
  difficultyFilter = null,
  maxDurationHours = null,
  minSimilarity = 0.40,
  limit = 8
}) {
  const { cleanBase64, hash, mimeType: validMime } = validateImageInput(imageBase64, mimeType);

  const searchResult = await searchVisualIntelligence({
    imageBase64: cleanBase64,
    mimeType: validMime,
    stateFilter,
    difficultyFilter,
    maxDurationHours,
    minSimilarity,
    limit
  });

  const allCandidates = [
    ...(searchResult.primary_destination ? [searchResult.primary_destination] : []),
    ...(searchResult.alternative_candidates || [])
  ];

  // Map to the shape expected by frontend ai-ecosystem.js
  const treks = allCandidates.map(c => ({
    trek_id: c.trek_id,
    name: c.name,
    slug: c.slug,
    state: c.state,
    district: c.district,
    difficulty: c.difficulty,
    elevation_m: c.elevation_m,
    duration: c.duration,
    rating: c.rating,
    matched_image_url: c.matched_image_url || 'Nature.jpg',
    similarity_score: Math.round(c.calibrated_score * 100),
    similarity_percentage: c.similarity_percentage,
    match_confidence: c.confidence_band,
    calibrated_score: c.calibrated_score,
    raw_similarity: c.raw_similarity,
    evidence_images_count: c.evidence_images_count,
    knowledge_verification: c.knowledge_verification
  }));

  return {
    success: true,
    is_confident_match: searchResult.is_confident_match,
    detected_archetype: searchResult.detected_terrain.archetype,
    dominant_features: searchResult.detected_terrain.dominant_features,
    image_hash: hash,
    total_matches_found: treks.length,
    treks,
    message: searchResult.message,
    disclaimer: searchResult.disclaimer
  };
}

export default {
  searchTreksByPhoto,
  ENGINE_METADATA
};
