import { query } from '../backend/src/config/database.js';

async function main() {
  // Check user's completion data
  const completions = await query(`
    SELECT ut.user_id, ut.trek_id, ut.status, ut.completed_at, 
           t.trek_name, t.distance_km, t.elevation_m, t.duration_label
    FROM user_treks ut 
    JOIN treks t ON ut.trek_id = t.trek_id
    WHERE ut.status = 'completed'
  `);
  console.log('Completed treks:');
  console.table(completions.rows);

  // Check if badges exist for those treks
  if (completions.rows.length > 0) {
    for (const row of completions.rows) {
      const badge = await query('SELECT * FROM badges WHERE trek_id = $1', [row.trek_id]);
      console.log(`Badge for trek ${row.trek_id} (${row.trek_name}): ${badge.rows.length > 0 ? badge.rows[0].name : 'NONE'}`);
      
      const userBadge = await query('SELECT * FROM user_badges WHERE user_id = $1 AND badge_id IN (SELECT badge_id FROM badges WHERE trek_id = $2)', [row.user_id, row.trek_id]);
      console.log(`User badge earned: ${userBadge.rows.length > 0 ? 'YES' : 'NO'}`);
    }
  }

  // Stats from profileService
  const stats = await query(`
    SELECT
      COUNT(DISTINCT ut.trek_id) FILTER (WHERE ut.status = 'completed') AS treks_completed,
      COALESCE(SUM(t.distance_km) FILTER (WHERE ut.status = 'completed'), 0) AS total_distance_km,
      COALESCE(MAX(GREATEST(t.elevation_m, t.highest_point_m)) FILTER (WHERE ut.status = 'completed'), 0) AS highest_summit_m,
      COUNT(DISTINCT t.state_id) FILTER (WHERE ut.status = 'completed') AS states_explored,
      COALESCE(SUM(
        CASE 
          WHEN t.duration_label ~* '(\\d+)\\s*Day' THEN (SUBSTRING(t.duration_label FROM '(\\d+)')::INT)
          WHEN t.duration_hours IS NOT NULL THEN GREATEST(1, CEIL(t.duration_hours / 8.0)::INT)
          ELSE 1
        END
      ) FILTER (WHERE ut.status = 'completed'), 0) AS days_on_trail
    FROM user_treks ut
    JOIN treks t ON ut.trek_id = t.trek_id
  `);
  console.log('\nAggregated stats (all users):');
  console.table(stats.rows);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
