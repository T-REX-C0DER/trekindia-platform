/**
 * TrekIndia — Trek Controller
 * Handles HTTP request/response for all trek endpoints.
 */

import * as trekService from '../services/trekService.js';
import * as profileService from '../services/profileService.js';
import { query } from '../config/database.js';

/**
 * GET /api/treks
 * Supports: page, limit, state, district, difficulty,
 *           minRating, minDuration, maxDuration, minElevation, maxElevation,
 *           minDistance, maxDistance, season, sort, order
 */
export async function listTreks(req, res, next) {
  try {
    const result = await trekService.getAllTreks(req.query);
    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/treks/map
 * Lightweight endpoint for map markers (no description, no geometry blob).
 */
export async function mapTreks(req, res, next) {
  try {
    const data = await trekService.getMapTreks();
    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/treks/search?q=
 */
export async function searchTreks(req, res, next) {
  try {
    const { q, limit } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter "q" must be at least 2 characters.',
      });
    }
    const data = await trekService.searchTreks(q.trim(), limit);
    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/treks/:id  (numeric ID)
 */
export async function getTrekById(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid trek ID.' });
    }
    const trek = await trekService.getTrekById(id);
    if (!trek) {
      return res.status(404).json({ success: false, message: 'Trek not found.' });
    }
    return res.status(200).json({ success: true, data: trek });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/treks/slug/:slug
 */
export async function getTrekBySlug(req, res, next) {
  try {
    const { slug } = req.params;
    if (!slug) {
      return res.status(400).json({ success: false, message: 'Slug is required.' });
    }
    const trek = await trekService.getTrekBySlug(slug);
    if (!trek) {
      return res.status(404).json({ success: false, message: 'Trek not found.' });
    }
    return res.status(200).json({ success: true, data: trek });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/treks/slug/:slug/companies  — or —
 * GET /api/treks/:id/companies
 *
 * Resolves the trek by slug or numeric ID, then returns
 * every trekking company associated with that trek's name.
 */
export async function getTrekCompanies(req, res, next) {
  try {
    // Works for both /slug/:slug/companies and /:id/companies
    const identifier = req.params.slug || req.params.id;
    if (!identifier) {
      return res.status(400).json({ success: false, message: 'Trek identifier (ID or slug) is required.' });
    }

    let trek;
    const numericId = parseInt(identifier, 10);
    if (!isNaN(numericId) && String(numericId) === identifier) {
      trek = await trekService.getTrekById(numericId);
    } else {
      trek = await trekService.getTrekBySlug(identifier);
    }

    if (!trek) {
      return res.status(404).json({ success: false, message: 'Trek not found.' });
    }

    const companies = await trekService.getCompaniesForTrek(trek.name);
    return res.status(200).json({
      success: true,
      trek: {
        id: trek.trek_id,
        name: trek.name,
        slug: trek.slug
      },
      count: companies.length,
      companies
    });
  } catch (err) {
    next(err);
  }
}
/**
 * Helper to resolve numeric trek_id from slug or numeric id parameter
 */
async function resolveTrekId(identifier) {
  if (!identifier) return null;
  const num = parseInt(identifier, 10);
  if (!isNaN(num) && String(num) === String(identifier).trim()) {
    const res = await query('SELECT trek_id FROM treks WHERE trek_id = $1', [num]);
    if (res.rows.length > 0) return res.rows[0].trek_id;
  }
  const res = await query('SELECT trek_id FROM treks WHERE slug = $1', [identifier]);
  if (res.rows.length > 0) return res.rows[0].trek_id;
  return null;
}

/**
 * POST /api/treks/:id/complete or /api/treks/slug/:slug/complete
 */
export async function completeTrek(req, res, next) {
  try {
    const identifier = req.params.slug || req.params.id;
    const trekId = await resolveTrekId(identifier);
    if (!trekId) {
      return res.status(404).json({ success: false, message: 'Trek not found.' });
    }
    const { completed_at, notes, rating } = req.body;
    const result = await profileService.completeTrek(req.user.user_id, trekId, {
      completed_at,
      notes,
      rating
    });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/treks/:id/uncomplete or /api/treks/slug/:slug/uncomplete
 */
export async function uncompleteTrek(req, res, next) {
  try {
    const identifier = req.params.slug || req.params.id;
    const trekId = await resolveTrekId(identifier);
    if (!trekId) {
      return res.status(404).json({ success: false, message: 'Trek not found.' });
    }
    const result = await profileService.uncompleteTrek(req.user.user_id, trekId);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/treks/:id/user-status or /api/treks/slug/:slug/user-status
 */
export async function getTrekUserStatus(req, res, next) {
  try {
    const identifier = req.params.slug || req.params.id;
    const trekId = await resolveTrekId(identifier);
    if (!trekId) {
      return res.status(404).json({ success: false, message: 'Trek not found.' });
    }
    const statuses = await profileService.getUserTrekStatus(req.user.user_id, trekId);
    return res.status(200).json({ success: true, trek_id: trekId, ...statuses });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/treks/:id/save or /api/treks/slug/:slug/save
 */
export async function toggleSaveTrek(req, res, next) {
  try {
    const identifier = req.params.slug || req.params.id;
    const trekId = await resolveTrekId(identifier);
    if (!trekId) {
      return res.status(404).json({ success: false, message: 'Trek not found.' });
    }
    const { saved } = req.body;
    const currentStatus = await profileService.getUserTrekStatus(req.user.user_id, trekId);
    const targetSaved = saved !== undefined ? !!saved : !currentStatus.saved;

    if (targetSaved) {
      await profileService.setUserTrekStatus(req.user.user_id, trekId, { status: 'saved' });
    } else {
      await query(
        `DELETE FROM user_treks WHERE user_id = $1 AND trek_id = $2 AND status = 'saved'`,
        [req.user.user_id, trekId]
      );
    }

    const updated = await profileService.getUserTrekStatus(req.user.user_id, trekId);
    return res.status(200).json({
      success: true,
      saved: updated.saved,
      message: updated.saved ? 'Trek saved.' : 'Trek removed from saved.'
    });
  } catch (err) {
    next(err);
  }
}
