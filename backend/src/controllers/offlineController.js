/**
 * TrekIndia — Offline Trek Companion Controller
 * Serves versioned, self-contained offline packages
 */

import * as offlineCompanionService from '../services/offlineCompanionService.js';

/**
 * GET /api/offline/treks/:trekId/package
 */
export async function getOfflinePackage(req, res, next) {
  try {
    const { trekId } = req.params;
    const userId = req.user?.user_id || null;

    const result = await offlineCompanionService.generateOfflinePackage(trekId, userId);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/offline/treks/:trekId/package
 */
export async function deleteOfflinePackage(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    const result = await offlineCompanionService.removeOfflineDownload(req.user.user_id, req.params.trekId);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

