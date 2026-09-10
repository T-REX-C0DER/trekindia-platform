/**
 * TrekIndia — Trek Routes
 * IMPORTANT: /map, /search, /slug/:slug MUST come before /:id
 * to avoid Express treating them as :id params.
 */

import { Router } from 'express';
import * as trekController from '../controllers/trekController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Lightweight map endpoint (must be first)
router.get('/map',                          trekController.mapTreks);

// Search
router.get('/search',                       trekController.searchTreks);

// Slug-based user actions & lookup (must be before /:id)
router.get('/slug/:slug/user-status',       requireAuth, trekController.getTrekUserStatus);
router.post('/slug/:slug/complete',         requireAuth, trekController.completeTrek);
router.post('/slug/:slug/uncomplete',       requireAuth, trekController.uncompleteTrek);
router.post('/slug/:slug/save',             requireAuth, trekController.toggleSaveTrek);
router.get('/slug/:slug/companies',         trekController.getTrekCompanies);
router.get('/slug/:slug',                   trekController.getTrekBySlug);

// ID-based user actions
router.get('/:id/user-status',              requireAuth, trekController.getTrekUserStatus);
router.post('/:id/complete',                requireAuth, trekController.completeTrek);
router.post('/:id/uncomplete',              requireAuth, trekController.uncompleteTrek);
router.post('/:id/save',                    requireAuth, trekController.toggleSaveTrek);

// Trek companies by numeric ID
router.get('/:id/companies',                trekController.getTrekCompanies);

// List all treks (paginated, filterable, sortable)
router.get('/',                             trekController.listTreks);

// Single trek by numeric ID
router.get('/:id',                          trekController.getTrekById);

export default router;

