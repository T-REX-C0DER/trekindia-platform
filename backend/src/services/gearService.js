/**
 * TrekIndia — Gear Service
 * Parameterized queries for gear products from PostgreSQL database.
 */

import { query } from '../config/database.js';

/**
 * GET /api/gear
 * Query products with optional category, search query, limit, and pagination.
 */
export async function getAllGearProducts(params = {}) {
  const {
    category,
    search,
    limit = 40,
    page = 1,
    sort = 'id',
    order = 'asc'
  } = params;

  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 40));
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const offset = (safePage - 1) * safeLimit;

  const conditions = [];
  const queryParams = [];

  if (category && category.toLowerCase() !== 'all') {
    queryParams.push(category);
    conditions.push(`LOWER(category) = LOWER($${queryParams.length})`);
  }

  if (search && search.trim().length > 0) {
    queryParams.push(`%${search.trim()}%`);
    const idx = queryParams.length;
    conditions.push(`(product_name ILIKE $${idx} OR brand ILIKE $${idx} OR category ILIKE $${idx})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Allowed sort columns
  const ALLOWED_SORT = {
    id: 'id',
    name: 'product_name',
    brand: 'brand',
    category: 'category'
  };
  const sortCol = ALLOWED_SORT[sort] || 'id';
  const sortDir = ['asc', 'desc'].includes(order?.toLowerCase()) ? order.toLowerCase() : 'asc';

  // Count total
  const countResult = await query(
    `SELECT COUNT(*) FROM trek_gear_products ${whereClause}`,
    queryParams
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Fetch paginated data
  const dataParams = [...queryParams, safeLimit, offset];
  const limitIdx = queryParams.length + 1;
  const offsetIdx = queryParams.length + 2;

  const sql = `
    SELECT
      id,
      product_name,
      brand,
      category,
      description,
      image_url,
      amazon_url,
      flipkart_url,
      brand_url
    FROM trek_gear_products
    ${whereClause}
    ORDER BY ${sortCol} ${sortDir}
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const result = await query(sql, dataParams);

  return {
    data: result.rows,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit)
  };
}

/**
 * GET /api/gear/categories
 * Returns all distinct categories with product counts.
 */
export async function getGearCategories() {
  const result = await query(`
    SELECT
      category,
      COUNT(*) AS count
    FROM trek_gear_products
    WHERE category IS NOT NULL AND TRIM(category) != ''
    GROUP BY category
    ORDER BY count DESC, category ASC
  `);

  return result.rows.map(r => ({
    name: r.category,
    count: parseInt(r.count, 10)
  }));
}

/**
 * GET /api/gear/:id
 * Returns single product by ID.
 */
export async function getGearById(id) {
  const result = await query(
    `SELECT
      id,
      product_name,
      brand,
      category,
      description,
      image_url,
      amazon_url,
      flipkart_url,
      brand_url
     FROM trek_gear_products
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] || null;
}
