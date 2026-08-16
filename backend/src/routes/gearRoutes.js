/**
 * TrekIndia — Gear Routes
 */

import { Router } from 'express';
import * as gearController from '../controllers/gearController.js';

const router = Router();

// Distinct categories with counts (must come before /:id)
router.get('/categories', gearController.listCategories);

// List/filter gear products
router.get('/', gearController.listGear);

// Single product by ID
router.get('/:id', gearController.getGearById);

export default router;
