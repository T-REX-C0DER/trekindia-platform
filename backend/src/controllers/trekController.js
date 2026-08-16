/**
 * TrekIndia — Trek Controller
 * Handles HTTP request/response for all trek endpoints.
 */

import * as trekService from '../services/trekService.js';

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


