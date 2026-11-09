/**
 * TrekIndia — Centralized AI Controller
 * Manages HTTP endpoints for TrekVision, Altitude Guardian, Cost Intelligence, Photo Discovery, and Nutrition Planner
 */

import * as visionService from '../services/visionService.js';
import * as altitudeGuardianService from '../services/altitudeGuardianService.js';
import * as costIntelligenceService from '../services/costIntelligenceService.js';
import * as photoDiscoveryService from '../services/photoDiscoveryService.js';
import * as nutritionPlannerService from '../services/nutritionPlannerService.js';
import * as visualIntelligenceService from '../services/visualIntelligenceService.js';

/**
 * 1. AI TrekVision: Analyze mountain photograph
 * POST /api/ai/trekvision/analyze
 */
export async function analyzeTrekVision(req, res, next) {
  try {
    const { image, mimeType, consent_retained, geographic_context } = req.body;
    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Image data (Base64) is required for TrekVision analysis.'
      });
    }

    const userId = req.user?.user_id || null;
    const result = await visionService.analyzeMountainImage({
      imageBase64: image,
      mimeType: mimeType || 'image/jpeg',
      userId,
      consentRetained: Boolean(consent_retained),
      geographicContext: geographic_context || null
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * 2. AI Altitude Guardian: Safety Assessment
 * POST /api/ai/safety/assess
 */
export async function assessSafety(req, res, next) {
  try {
    const { trek_id, trek_slug, current_altitude, symptoms, acclimatization_days } = req.body;
    if (!trek_id && !trek_slug) {
      return res.status(400).json({
        success: false,
        message: 'Either trek_id or trek_slug is required for safety assessment.'
      });
    }

    const result = await altitudeGuardianService.assessTrekSafety({
      trekId: trek_id,
      trekSlug: trek_slug,
      userCurrentAltitude: current_altitude || 0,
      reportedSymptoms: Array.isArray(symptoms) ? symptoms : [],
      acclimatizationDays: acclimatization_days || 0
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * 3. AI Trek Cost Intelligence: Estimate Trek Expenses
 * POST /api/ai/cost/estimate
 */
export async function estimateCost(req, res, next) {
  try {
    const { trek_id, trek_slug, starting_city, group_size, duration_days, tier, gear_needed } = req.body;
    if (!trek_id && !trek_slug) {
      return res.status(400).json({
        success: false,
        message: 'Either trek_id or trek_slug is required for cost estimation.'
      });
    }

    const userId = req.user?.user_id || null;
    const result = await costIntelligenceService.estimateTrekCost({
      trekId: trek_id,
      trekSlug: trek_slug,
      startingCity: starting_city || 'Delhi',
      groupSize: group_size || 2,
      durationDays: duration_days,
      tier: tier || 'standard',
      gearNeeded: gear_needed || 'basic',
      userId
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * 7. AI Photo-to-Trek Discovery: Search treks by photo
 * POST /api/ai/photo-discovery/search
 */
export async function searchPhotoDiscovery(req, res, next) {
  try {
    const { image, mimeType, state, difficulty, max_duration_hours, min_similarity } = req.body;
    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Image data is required for visual discovery search.'
      });
    }

    const result = await photoDiscoveryService.searchTreksByPhoto({
      imageBase64: image,
      mimeType: mimeType || 'image/jpeg',
      stateFilter: state || null,
      difficultyFilter: difficulty || null,
      maxDurationHours: max_duration_hours || null,
      minSimilarity: min_similarity ? parseFloat(min_similarity) : 0.45
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * 8. AI Trek Nutrition Planner: Generate Trail Meal Plan
 * POST /api/ai/nutrition/plan
 */
export async function generateNutritionPlan(req, res, next) {
  try {
    const {
      trek_id, trek_slug, duration_days, diet_type,
      activity_intensity, allergies, facilities, food_carrying_style
    } = req.body;

    if (!trek_id && !trek_slug) {
      return res.status(400).json({
        success: false,
        message: 'Either trek_id or trek_slug is required for nutrition planning.'
      });
    }

    const userId = req.user?.user_id || null;
    const result = await nutritionPlannerService.generateNutritionPlan({
      trekId: trek_id,
      trekSlug: trek_slug,
      durationDays: duration_days,
      dietType: diet_type || 'Vegetarian',
      activityIntensity: activity_intensity || 'Moderate',
      allergies: allergies || [],
      facilities: facilities || 'campsite_kitchen',
      foodCarryingStyle: food_carrying_style || 'lightweight_pack',
      userId
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/ai/nutrition/plans/:id
 */
export async function getNutritionPlan(req, res, next) {
  try {
    const plan = await nutritionPlannerService.getNutritionPlanById(req.params.id, req.user?.user_id);
    return res.status(200).json({ success: true, plan });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/users/me/nutrition-plans
 */
export async function getUserNutritionPlans(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    const plans = await nutritionPlannerService.getUserNutritionPlans(req.user.user_id);
    return res.status(200).json({ success: true, plans });
  } catch (err) {
    next(err);
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SHARED VISUAL INTELLIGENCE ENGINE ENDPOINTS
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Common Visual Recognition: Multimodal Image Analysis & Search
 * POST /api/ai/visual/analyze
 */
export async function analyzeVisual(req, res, next) {
  try {
    const { image, mimeType, state, difficulty, geographic_context } = req.body;
    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Image data (Base64) is required for visual analysis.'
      });
    }

    const result = await visualIntelligenceService.searchVisualIntelligence({
      imageBase64: image,
      mimeType: mimeType || 'image/jpeg',
      stateFilter: state || null,
      difficultyFilter: difficulty || null,
      geographicContext: geographic_context || null
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Submit User Feedback or Correction
 * POST /api/ai/visual/feedback
 */
export async function submitVisualFeedback(req, res, next) {
  try {
    const { image_url, image_hash, predicted_trek_id, suggested_trek_id, feedback_type, user_notes } = req.body;
    if (!image_url) {
      return res.status(400).json({
        success: false,
        message: 'image_url is required to submit feedback.'
      });
    }

    const result = await visualIntelligenceService.submitVisualFeedback({
      userId: req.user?.user_id || null,
      imageUrl: image_url,
      imageHash: image_hash || null,
      predictedTrekId: predicted_trek_id,
      suggestedTrekId: suggested_trek_id,
      feedbackType: feedback_type || 'correct_destination',
      userNotes: user_notes || ''
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Get Destination Visual Knowledge
 * GET /api/ai/visual/treks/:trekId/knowledge
 */
export async function getTrekVisualKnowledge(req, res, next) {
  try {
    const { trekId } = req.params;
    const trek = await visualIntelligenceService.resolveCanonicalTrek(trekId);
    if (!trek) {
      return res.status(404).json({ success: false, message: 'Trek not found.' });
    }

    const knowledgeRes = await visualIntelligenceService.query(
      `SELECT * FROM trek_visual_knowledge WHERE trek_id = $1`,
      [trek.trek_id]
    );

    return res.status(200).json({
      success: true,
      trek: { trek_id: trek.trek_id, name: trek.trek_name, slug: trek.slug },
      knowledge: knowledgeRes.rows[0] || null
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Ingest or Reprocess a Specific Post
 * POST /api/internal/visual/posts/:postId/process
 */
export async function processPostVisuals(req, res, next) {
  try {
    const { postId } = req.params;
    const result = await visualIntelligenceService.ingestPostForVisualLearning(postId);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Trigger Historical Posts Backfill Batch (Admin Protected)
 * POST /api/ai/visual/admin/backfill
 */
export async function runBackfill(req, res, next) {
  try {
    const batchSize = parseInt(req.body.batch_size || 25, 10);
    const result = await visualIntelligenceService.runHistoricalPostsBackfill(batchSize);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Get Visual Intelligence Engine System Metrics & Audit Status
 * GET /api/ai/visual/admin/metrics
 */
export async function getVisualMetrics(req, res, next) {
  try {
    const metrics = await visualIntelligenceService.getVisualIntelligenceMetrics();
    return res.status(200).json({ success: true, metrics });
  } catch (err) {
    next(err);
  }
}

