/**
 * TrekIndia — VisionService
 * Thin adapter: wraps visualIntelligenceService.searchVisualIntelligence()
 * and maps its output to the TrekVision API response shape expected by
 * aiController.analyzeTrekVision and the frontend ai-ecosystem.js.
 *
 * Response shape (analyzeMountainImage):
 * {
 *   success: boolean,
 *   analysis: {
 *     summary: string,
 *     mountain_range: string,
 *     confidence_score: number,          // 0–1
 *     identified_peaks: string[],
 *     terrain: { type: string, trail_condition: string },
 *     snow_and_ice: { presence: boolean, coverage_percentage: number },
 *     safety_observations: string[],
 *   },
 *   suggested_treks: Array<{ trek_name, slug, state_name }>,
 *   is_confident_match: boolean,
 *   message: string,
 *   disclaimer: string,
 * }
 */

import crypto from 'crypto';
import {
  searchVisualIntelligence
} from './visualIntelligenceService.js';

// ─── Shared image utility ────────────────────────────────────────────────────

/**
 * Validate and normalise a Base64-encoded image string.
 * Strips data-URL prefixes, verifies the payload is non-empty,
 * computes a SHA-256 hash and returns a cleaned result.
 *
 * Used by photoDiscoveryService and visionService.
 *
 * @param {string} base64Input  Raw or data-URL-prefixed Base64 string
 * @param {string} mimeType     MIME type (default: 'image/jpeg')
 * @returns {{ cleanBase64: string, hash: string, mimeType: string }}
 */
export function validateImageInput(base64Input, mimeType = 'image/jpeg') {
  if (!base64Input || typeof base64Input !== 'string') {
    throw new Error('validateImageInput: base64Input must be a non-empty string.');
  }

  // Strip data-URL prefix if present  (e.g. "data:image/png;base64,...")
  let clean = base64Input;
  const dataUrlMatch = base64Input.match(/^data:([a-z0-9+/]+\/[a-z0-9+/]+);base64,/i);
  if (dataUrlMatch) {
    // Infer mimeType from data-URL if caller passed the default
    if (mimeType === 'image/jpeg') mimeType = dataUrlMatch[1];
    clean = base64Input.slice(dataUrlMatch[0].length);
  }

  // Remove any whitespace that could break atob
  clean = clean.replace(/\s/g, '');

  if (!clean) {
    throw new Error('validateImageInput: Base64 payload is empty after stripping prefix.');
  }

  // Compute SHA-256 of the raw bytes for de-duplication / caching
  const rawBuffer = Buffer.from(clean, 'base64');
  const hash = crypto.createHash('sha256').update(rawBuffer).digest('hex');

  // Normalise common aliases
  const mimeNorm = mimeType.toLowerCase().trim();
  const finalMime = (['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(mimeNorm))
    ? mimeNorm
    : 'image/jpeg';

  return { cleanBase64: clean, hash, mimeType: finalMime };
}

// ─── Safety tips returned for every analysis ────────────────────────────────
const SAFETY_BASE = [
  'Check weather forecast 48 hours before departure.',
  'Carry adequate hydration and high-energy snacks.',
  'Acclimatise progressively — do not rush altitude gain.',
  'Inform someone of your itinerary and expected return.',
];

// Extra tips for snowy / high-altitude terrain
const SNOW_SAFETY = [
  'Carry crampons and trekking poles for icy sections.',
  'Watch for avalanche risk on steep open slopes.',
];

// ─── Terrain → trail-condition descriptions ──────────────────────────────────
const TRAIL_CONDITION_MAP = {
  'Alpine Snow': 'Snow-covered alpine trail — crampons recommended.',
  'Glacial': 'Glacial terrain — advanced mountaineering skills required.',
  'High Altitude Meadow': 'Well-defined meadow path with moderate incline.',
  'Dense Forest': 'Forest trail — muddy after rain, watch for leeches.',
  'Rocky Ridge': 'Exposed rocky ridge — sure footing essential.',
  'Riverside Valley': 'Riverside path — stream crossings possible.',
  'Arid Mountain': 'Dry, stony trail — sun protection critical.',
};

// ─── Main exported function ──────────────────────────────────────────────────

/**
 * Analyse a mountain / trek photograph using the TrekIndia Visual Intelligence
 * pipeline and return a TrekVision-formatted result.
 *
 * @param {object} params
 * @param {string} params.imageBase64       - Base64-encoded image data
 * @param {string} [params.mimeType]        - MIME type (default: 'image/jpeg')
 * @param {string|null} [params.stateHint]  - Optional state filter hint
 * @param {boolean} [params.consentRetained]
 * @param {object|null} [params.geographicContext]
 * @returns {Promise<object>}  TrekVision response object
 */
export async function analyzeMountainImage({
  imageBase64,
  mimeType = 'image/jpeg',
  stateHint = null,
  consentRetained = false,
  geographicContext = null,
}) {
  // ── 1. Run the visual intelligence search ───────────────────────────────
  const viResult = await searchVisualIntelligence({
    imageBase64,
    mimeType,
    stateFilter: stateHint || geographicContext?.state || null,
    geographicContext,
    limit: 5,
  });

  // ── 2. Extract top match and terrain data ────────────────────────────────
  const topTrek = viResult.primary_destination
    || (viResult.alternative_candidates?.length ? viResult.alternative_candidates[0] : null);

  const archetype = viResult.detected_terrain?.archetype || 'Mountain Terrain';
  const dominantFeatures = Array.isArray(viResult.detected_terrain?.dominant_features)
    ? viResult.detected_terrain.dominant_features
    : [];

  // Confidence (0–1)
  const confidenceScore = topTrek
    ? Math.min(1, Math.max(0, topTrek.calibrated_score ?? 0.5))
    : 0.35;

  // ── 3. Determine terrain traits ──────────────────────────────────────────
  const archetypeLower = archetype.toLowerCase();
  const hasSnow = archetypeLower.includes('snow')
    || archetypeLower.includes('glacial')
    || archetypeLower.includes('alpine');

  const trailCondition = TRAIL_CONDITION_MAP[archetype]
    || (hasSnow
      ? 'High-altitude snow terrain — experience required.'
      : 'Natural mountain trail — trekking gear recommended.');

  // ── 4. Build the analysis block ──────────────────────────────────────────
  const summary = topTrek
    ? `Visual characteristics match ${topTrek.name} (${topTrek.state || 'India'}). `
      + `Terrain shows ${archetypeLower} features with `
      + (dominantFeatures.length
        ? dominantFeatures.slice(0, 3).join(', ') + '.'
        : 'typical mountain landscape.')
    : `${archetype} detected. No confident destination match found — `
      + 'showing the most visually comparable trails.';

  const mountainRange = topTrek
    ? `${topTrek.state || 'Indian'} Himalayan Region`
    : 'Indian Mountain Range';

  const identifiedPeaks = dominantFeatures.slice(0, 4);
  if (topTrek && !identifiedPeaks.includes(topTrek.name)) {
    identifiedPeaks.unshift(topTrek.name);
  }

  const safetyObservations = hasSnow
    ? [...SNOW_SAFETY, ...SAFETY_BASE]
    : [...SAFETY_BASE];

  // ── 5. Build suggested_treks list ─────────────────────────────────────────
  const allCandidates = [
    ...(viResult.primary_destination ? [viResult.primary_destination] : []),
    ...(Array.isArray(viResult.alternative_candidates) ? viResult.alternative_candidates : []),
  ];

  const suggestedTreks = allCandidates.slice(0, 5).map(t => ({
    trek_name: t.name,
    slug: t.slug || null,
    state_name: t.state || null,
    district: t.district || null,
    difficulty: t.difficulty || null,
    similarity_percentage: t.similarity_percentage || null,
    calibrated_score: t.calibrated_score ?? null,
  }));

  // ── 6. Return TrekVision-formatted response ──────────────────────────────
  return {
    success: true,
    is_confident_match: viResult.is_confident_match,
    analysis: {
      summary,
      mountain_range: mountainRange,
      confidence_score: confidenceScore,
      identified_peaks: identifiedPeaks.slice(0, 4),
      terrain: {
        type: archetype,
        trail_condition: trailCondition,
      },
      snow_and_ice: {
        presence: hasSnow,
        coverage_percentage: hasSnow ? 60 : 0,
      },
      safety_observations: safetyObservations.slice(0, 5),
    },
    suggested_treks: suggestedTreks,
    message: viResult.message || (topTrek
      ? `Identified ${topTrek.name} with ${Math.round(confidenceScore * 100)}% confidence.`
      : 'Could not confidently identify the destination from this image.'),
    disclaimer: viResult.disclaimer
      || 'TrekIndia Visual Intelligence uses multimodal landscape retrieval. '
      + 'Visual similarity indicates comparable terrain and does not constitute certified GPS provenance.',
    retrieval_metadata: viResult.retrieval_metadata || null,
  };
}
