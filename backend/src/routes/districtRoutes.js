/**
 * TrekIndia — District Routes
 */

import { Router } from 'express';
import * as stateController from '../controllers/stateController.js';

const router = Router();

// GET /api/districts?state=Maharashtra
router.get('/', stateController.listDistricts);

export default router;
