/**
 * TrekIndia — Offline Trek Companion API Routes
 */

import { Router } from 'express';
import * as offlineController from '../controllers/offlineController.js';
import { authMiddleware, requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/treks/:trekId/package', authMiddleware, offlineController.getOfflinePackage);
router.delete('/treks/:trekId/package', requireAuth, offlineController.deleteOfflinePackage);

export default router;

