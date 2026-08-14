/**
 * TrekIndia — State / District Routes
 */

import { Router } from 'express';
import * as stateController from '../controllers/stateController.js';

const router = Router();

// All states with trek counts
router.get('/',                       stateController.listStates);

// Treks for a specific state
router.get('/:state/treks',           stateController.stateTreks);

// Districts for a specific state
router.get('/:state/districts',       stateController.stateDistricts);

export default router;
