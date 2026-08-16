/**
 * TrekIndia — Gear Controller
 * Handles HTTP requests for gear marketplace endpoints.
 */

import * as gearService from '../services/gearService.js';

/**
 * GET /api/gear
 * Query params: category, search, limit, page, sort, order
 */
export async function listGear(req, res, next) {
  try {
    const result = await gearService.getAllGearProducts(req.query);
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/gear/categories
 */
export async function listCategories(req, res, next) {
  try {
    const categories = await gearService.getGearCategories();
    return res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/gear/:id
 */
export async function getGearById(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID.' });
    }
    const product = await gearService.getGearById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    return res.status(200).json({
      success: true,
      data: product
    });
  } catch (err) {
    next(err);
  }
}
