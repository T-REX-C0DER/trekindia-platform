/**
 * TrekIndia — AI Ecosystem API Routes
 * Endpoints for TrekVision, Altitude Guardian, Cost Intelligence, Photo Discovery, and Nutrition
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as aiController from '../controllers/aiController.js';
import { authMiddleware, requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Dedicated rate limiter for computationally intensive AI tasks
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    success: false,
    message: 'AI request limit reached for this minute. Please pause for a few seconds.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 1. AI TrekVision
router.post('/trekvision/analyze', aiLimiter, authMiddleware, aiController.analyzeTrekVision);

// 2. AI Altitude Guardian
router.post('/safety/assess', aiLimiter, authMiddleware, aiController.assessSafety);

// 3. AI Trek Cost Intelligence
router.post('/cost/estimate', aiLimiter, authMiddleware, aiController.estimateCost);

// 7. AI Photo-to-Trek Discovery & Shared Visual Intelligence Engine
router.post('/photo-discovery/search', aiLimiter, authMiddleware, aiController.searchPhotoDiscovery);
router.post('/visual/analyze', aiLimiter, authMiddleware, aiController.analyzeVisual);
router.post('/visual/feedback', aiLimiter, authMiddleware, aiController.submitVisualFeedback);
router.get('/visual/treks/:trekId/knowledge', authMiddleware, aiController.getTrekVisualKnowledge);
router.post('/visual/posts/:postId/process', authMiddleware, aiController.processPostVisuals);
router.post('/visual/admin/backfill', authMiddleware, aiController.runBackfill);
router.get('/visual/admin/metrics', authMiddleware, aiController.getVisualMetrics);

// 8. AI Trek Nutrition Planner
router.post('/nutrition/plan', aiLimiter, authMiddleware, aiController.generateNutritionPlan);
router.get('/nutrition/plans/:id', authMiddleware, aiController.getNutritionPlan);
router.get('/nutrition/my-plans', requireAuth, aiController.getUserNutritionPlans);

export default router;

