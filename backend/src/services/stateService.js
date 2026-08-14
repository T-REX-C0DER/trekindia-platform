/**
 * TrekIndia — State Service
 * Parameterized queries for states and districts.
 */

import { query } from '../config/database.js';

/**
 * GET /api/states
 * Returns all states with their trek count (from live DB).
 */
export async function getAllStates() {
  const result = await query(`
    SELECT
      s.state_id,
      s.state_name  AS name,
      s.state_code  AS code,
      s.slug,
      COUNT(t.trek_id) AS trek_count
    FROM states s
    LEFT JOIN treks t ON s.state_id = t.state_id AND t.status = 'active'
    GROUP BY s.state_id, s.state_name, s.state_code, s.slug
    ORDER BY trek_count DESC, s.state_name ASC
  `);
  return result.rows;
}

/**
 * GET /api/states/:state/treks
 * Returns paginated treks for a given state name.
 */
export async function getTreksByState(stateName, params = {}) {
  const {
    page   = 1,
    limit  = 24,
    sort   = 'name',
    order  = 'asc',
  } = params;

  const ALLOWED_SORT = {
    name:      't.trek_name',
    rating:    't.rating',
    distance:  't.distance_km',
    elevation: 't.elevation_m',
  };
  const field   = ALLOWED_SORT[sort] || 't.trek_name';
  const dir     = ['asc','desc'].includes(order.toLowerCase()) ? order.toLowerCase() : 'asc';
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit) || 24));
  const safePage  = Math.max(1, parseInt(page) || 1);
  const offset    = (safePage - 1) * safeLimit;

  const countResult = await query(
    `SELECT COUNT(*) FROM treks t
     JOIN states s ON t.state_id = s.state_id
     WHERE s.state_name ILIKE $1 AND t.status = 'active'`,
    [stateName]
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await query(
    `SELECT
       t.trek_id, t.trek_name AS name, t.slug,
       s.state_name AS state,
       d.district_name AS district,
       t.difficulty, t.rating, t.distance_km,
       t.elevation_m, t.best_time, t.duration_label,
       t.short_description,
       tl.latitude, tl.longitude
     FROM treks t
     JOIN states s ON t.state_id = s.state_id
     LEFT JOIN districts d ON t.district_id = d.district_id
     LEFT JOIN trek_locations tl ON t.trek_id = tl.trek_id
     WHERE s.state_name ILIKE $1 AND t.status = 'active'
     ORDER BY ${field} ${dir} NULLS LAST
     LIMIT $2 OFFSET $3`,
    [stateName, safeLimit, offset]
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
 * GET /api/states/:state/districts
 * Returns districts for a state, with trek counts.
 */
export async function getDistrictsByState(stateName) {
  const result = await query(
    `SELECT
       d.district_id,
       d.district_name AS name,
       d.slug,
       COUNT(t.trek_id) AS trek_count
     FROM districts d
     JOIN states s ON d.state_id = s.state_id
     LEFT JOIN treks t ON t.district_id = d.district_id AND t.status = 'active'
     WHERE s.state_name ILIKE $1
     GROUP BY d.district_id, d.district_name, d.slug
     ORDER BY trek_count DESC, d.district_name ASC`,
    [stateName]
  );
  return result.rows;
}

/**
 * GET /api/districts?state=
 */
export async function getDistricts(stateName) {
  if (stateName) {
    return getDistrictsByState(stateName);
  }
  const result = await query(`
    SELECT
      d.district_id,
      d.district_name AS name,
      s.state_name    AS state,
      d.slug,
      COUNT(t.trek_id) AS trek_count
    FROM districts d
    JOIN states s ON d.state_id = s.state_id
    LEFT JOIN treks t ON t.district_id = d.district_id AND t.status = 'active'
    GROUP BY d.district_id, d.district_name, s.state_name, d.slug
    ORDER BY s.state_name ASC, trek_count DESC
  `);
  return result.rows;
}
