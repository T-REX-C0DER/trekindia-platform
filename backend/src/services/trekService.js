/**
 * TrekIndia — Trek Service
 * All parameterized PostgreSQL queries for trek data.
 * No raw user input is ever directly interpolated into SQL.
 */

import { query } from '../config/database.js';

// ─── Allowed sort fields whitelist (prevents SQL injection in ORDER BY) ───────
const ALLOWED_SORT_FIELDS = {
  name:      't.trek_name',
  rating:    't.rating',
  distance:  't.distance_km',
  elevation: 't.elevation_m',
  duration:  't.duration_hours',
};

const ALLOWED_ORDERS = ['asc', 'desc'];

/**
 * Build safe ORDER BY clause from user input
 */
function buildOrderBy(sort, order) {
  const field = ALLOWED_SORT_FIELDS[sort] || 't.trek_name';
  const dir   = ALLOWED_ORDERS.includes((order || '').toLowerCase()) ? order.toLowerCase() : 'asc';
  // Nulls last keeps treks with missing values at the bottom
  return `${field} ${dir} NULLS LAST`;
}

/**
 * Base SELECT fragment joining all needed tables
 */
const BASE_SELECT = `
  SELECT
    t.trek_id,
    t.trek_name         AS name,
    t.slug,
    s.state_name        AS state,
    d.district_name     AS district,
    t.difficulty,
    t.trek_type,
    t.distance_km,
    t.duration_hours,
    t.duration_label,
    t.elevation_m,
    t.highest_point_m,
    t.altitude_gain_m,
    t.starting_point,
    t.ending_point,
    t.best_time,
    t.entry_fee,
    t.permit_required,
    t.is_featured,
    t.is_verified,
    t.status,
    t.rating,
    t.short_description,
    t.description,
    t.created_at,
    t.updated_at,
    tl.latitude,
    tl.longitude,
    ST_AsGeoJSON(tl.location)::jsonb AS geometry,
    tl.location_name,
    tl.village
  FROM treks t
  JOIN states s      ON t.state_id     = s.state_id
  LEFT JOIN districts d ON t.district_id  = d.district_id
  LEFT JOIN trek_locations tl ON t.trek_id  = tl.trek_id
`;

/**
 * GET /api/treks
 * Supports: page, limit, state, difficulty, minRating, maxDuration, minDuration,
 *           minElevation, maxElevation, minDistance, maxDistance, season, sort, order
 */
export async function getAllTreks(params = {}) {
  const {
    page         = 1,
    limit        = 24,
    state,
    district,
    difficulty,
    minRating,
    maxDuration,
    minDuration,
    minElevation,
    maxElevation,
    minDistance,
    maxDistance,
    season,
    sort         = 'name',
    order        = 'asc',
    status       = 'active',
  } = params;

  const conditions = [];
  const values     = [];
  let   idx        = 1;

  if (status)       { conditions.push(`t.status = $${idx++}`);           values.push(status); }
  if (state)        { conditions.push(`s.state_name ILIKE $${idx++}`);   values.push(state); }
  if (district)     { conditions.push(`d.district_name ILIKE $${idx++}`);values.push(district); }
  if (difficulty)   { conditions.push(`t.difficulty = $${idx++}`);       values.push(difficulty); }
  if (minRating)    { conditions.push(`t.rating >= $${idx++}`);          values.push(parseFloat(minRating)); }
  if (minDuration)  { conditions.push(`t.duration_hours >= $${idx++}`);  values.push(parseFloat(minDuration)); }
  if (maxDuration)  { conditions.push(`t.duration_hours <= $${idx++}`);  values.push(parseFloat(maxDuration)); }
  if (minElevation) { conditions.push(`t.elevation_m >= $${idx++}`);     values.push(parseInt(minElevation)); }
  if (maxElevation) { conditions.push(`t.elevation_m <= $${idx++}`);     values.push(parseInt(maxElevation)); }
  if (minDistance)  { conditions.push(`t.distance_km >= $${idx++}`);     values.push(parseFloat(minDistance)); }
  if (maxDistance)  { conditions.push(`t.distance_km <= $${idx++}`);     values.push(parseFloat(maxDistance)); }
  if (season)       { conditions.push(`t.best_time ILIKE $${idx++}`);    values.push(`%${season}%`); }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderBy     = buildOrderBy(sort, order);

  // Count query
  const countResult = await query(
    `SELECT COUNT(*) FROM treks t
     JOIN states s ON t.state_id = s.state_id
     LEFT JOIN districts d ON t.district_id = d.district_id
     ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Pagination
  const safePage  = Math.max(1, parseInt(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit) || 24));
  const offset    = (safePage - 1) * safeLimit;

  const dataResult = await query(
    `${BASE_SELECT}
     ${whereClause}
     ORDER BY ${orderBy}
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...values, safeLimit, offset]
  );

  return {
    data: dataResult.rows,
    pagination: {
      page:       safePage,
      limit:      safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

/**
 * GET /api/treks/map
 * Lightweight endpoint — only fields needed for map markers.
 */
export async function getMapTreks() {
  const result = await query(`
    SELECT
      t.trek_id,
      t.trek_name     AS name,
      t.slug,
      s.state_name    AS state,
      d.district_name AS district,
      t.difficulty,
      t.rating,
      t.elevation_m,
      t.distance_km,
      t.best_time,
      t.duration_label,
      tl.latitude,
      tl.longitude
    FROM treks t
    JOIN states s          ON t.state_id    = s.state_id
    LEFT JOIN districts d  ON t.district_id = d.district_id
    JOIN trek_locations tl ON t.trek_id     = tl.trek_id
    WHERE tl.latitude  IS NOT NULL
      AND tl.longitude IS NOT NULL
      AND t.status = 'active'
    ORDER BY t.trek_name ASC
  `);
  return result.rows;
}

/**
 * GET /api/treks/search?q=
 * Full-text search on name, district, state, description.
 */
export async function searchTreks(q, limit = 20) {
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit) || 20));
  const result = await query(
    `${BASE_SELECT}
     WHERE t.status = 'active'
       AND (
         t.trek_name        ILIKE $1 OR
         t.short_description ILIKE $1 OR
         t.starting_point   ILIKE $1 OR
         s.state_name       ILIKE $1 OR
         d.district_name    ILIKE $1
       )
     ORDER BY
       CASE WHEN t.trek_name ILIKE $1 THEN 0 ELSE 1 END,
       t.rating DESC NULLS LAST
     LIMIT $2`,
    [`%${q}%`, safeLimit]
  );
  return result.rows;
}

/**
 * GET /api/treks/:id
 */
export async function getTrekById(id) {
  const result = await query(
    `${BASE_SELECT} WHERE t.trek_id = $1`,
    [parseInt(id)]
  );
  return result.rows[0] || null;
}

/**
 * GET /api/treks/slug/:slug
 */
export async function getTrekBySlug(slug) {
  const result = await query(
    `${BASE_SELECT} WHERE t.slug = $1`,
    [slug]
  );
  return result.rows[0] || null;
}

/**
 * Query trekking companies associated with a specific trek name
 * Uses PostgreSQL JSONB array elements matching with normalized fallbacks
 */
export async function getCompaniesForTrek(trekName) {
  if (!trekName) return [];
  const sql = `
    SELECT
      company_id,
      company_name,
      website_url,
      created_at
    FROM trek_companies
    WHERE EXISTS (
      SELECT 1
      FROM jsonb_array_elements(treks) AS t(elem)
      WHERE
        LOWER(TRIM(elem->>'trek_name')) = LOWER(TRIM($1))
        OR (
          LENGTH(REGEXP_REPLACE(LOWER(TRIM(elem->>'trek_name')), '[^a-z0-9]', '', 'g')) > 3 AND
          REGEXP_REPLACE(REGEXP_REPLACE(LOWER(TRIM(elem->>'trek_name')), '\\s*(trek|peak|trail|hikes|hills)s?\\b', '', 'g'), '[^a-z0-9]', '', 'g') =
          REGEXP_REPLACE(REGEXP_REPLACE(LOWER(TRIM($1)), '\\s*(trek|peak|trail|hikes|hills)s?\\b', '', 'g'), '[^a-z0-9]', '', 'g')
        )
    )
    ORDER BY company_name ASC;
  `;
  const result = await query(sql, [trekName]);
  return result.rows;
}

