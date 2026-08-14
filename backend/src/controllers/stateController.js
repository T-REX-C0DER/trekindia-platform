/**
 * TrekIndia — State Controller
 */

import * as stateService from '../services/stateService.js';

/**
 * GET /api/states
 */
export async function listStates(req, res, next) {
  try {
    const data = await stateService.getAllStates();
    return res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/states/:state/treks
 */
export async function stateTreks(req, res, next) {
  try {
    const stateName = decodeURIComponent(req.params.state);
    const result    = await stateService.getTreksByState(stateName, req.query);
    return res.status(200).json({ success: true, state: stateName, ...result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/states/:state/districts
 */
export async function stateDistricts(req, res, next) {
  try {
    const stateName = decodeURIComponent(req.params.state);
    const data      = await stateService.getDistrictsByState(stateName);
    return res.status(200).json({ success: true, state: stateName, count: data.length, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/districts?state=
 */
export async function listDistricts(req, res, next) {
  try {
    const { state } = req.query;
    const data      = await stateService.getDistricts(state);
    return res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
}
