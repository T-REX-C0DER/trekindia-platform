/**
 * TrekIndia — Trek Routes
 * IMPORTANT: /map, /search, /slug/:slug MUST come before /:id
 * to avoid Express treating them as :id params.
 */

import { Router } from 'express';
import * as trekController from '../controllers/trekController.js';

const router = Router();

// Lightweight map endpoint (must be first)
router.get('/map',                          trekController.mapTreks);

// Search
router.get('/search',                       trekController.searchTreks);

// Slug-based lookup (must be before /:id)
router.get('/slug/:slug',                   trekController.getTrekBySlug);

// Trek companies by slug (must be before /:id)
router.get('/slug/:slug/companies',         trekController.getTrekCompanies);

// List all treks (paginated, filterable, sortable)
router.get('/',                             trekController.listTreks);

// Single trek by numeric ID
router.get('/:id',                          trekController.getTrekById);

// Trek companies by numeric ID
router.get('/:id/companies',                trekController.getTrekCompanies);

export default router;
