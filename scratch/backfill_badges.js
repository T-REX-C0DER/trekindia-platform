/**
 * Backfill user_badges and user_activities for existing user_treks completions
 * that happened before the trek badge migration (006).
 */
import { query, getClient } from '../backend/src/config/database.js';

async function backfillCompletionBadges() {
  // Find all completions that don't have a corresponding user_badge
  const unbackfilledRes = await query(`
    SELECT DISTINCT ut.user_id, ut.trek_id, ut.completed_at
    FROM user_treks ut
    JOIN treks t ON ut.trek_id = t.trek_id
    JOIN badges b ON b.trek_id = t.trek_id
    WHERE ut.status = 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM user_badges ub
        WHERE ub.user_id = ut.user_id AND ub.badge_id = b.badge_id
      )
    ORDER BY ut.completed_at
  `);

  console.log(`Found ${unbackfilledRes.rows.length} completions missing badges to backfill.`);

  for (const row of unbackfilledRes.rows) {
    const { user_id, trek_id, completed_at } = row;
    
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Get the trek badge
      const badgeRes = await client.query(`SELECT * FROM badges WHERE trek_id = $1`, [trek_id]);
      if (badgeRes.rows.length === 0) {
        console.log(`No badge found for trek_id ${trek_id}, skipping.`);
        await client.query('COMMIT');
        client.release();
        continue;
      }
      const trekBadge = badgeRes.rows[0];
      const trekRes = await client.query(`SELECT trek_name FROM treks WHERE trek_id = $1`, [trek_id]);
      const trekName = trekRes.rows.length > 0 ? trekRes.rows[0].trek_name : 'Trek';

      // Award the trek badge
      const awardRes = await client.query(
        `INSERT INTO user_badges (user_id, badge_id, earned_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, badge_id) DO NOTHING
         RETURNING *`,
        [user_id, trekBadge.badge_id, completed_at]
      );

      if (awardRes.rows.length > 0) {
        // Also ensure a TREK_COMPLETED activity exists
        const existingAct = await client.query(
          `SELECT activity_id FROM user_activities WHERE user_id = $1 AND type = 'TREK_COMPLETED' AND trek_id = $2`,
          [user_id, trek_id]
        );

        if (existingAct.rows.length === 0) {
          await client.query(
            `INSERT INTO user_activities (user_id, type, title, description, trek_id, metadata, created_at)
             VALUES ($1, 'TREK_COMPLETED', $2, $3, $4, $5, $6)`,
            [user_id, `Completed ${trekName}`, 'Backfilled completion record.', trek_id, '{}', completed_at]
          );
        }

        // And BADGE_EARNED activity
        const existingBadgeAct = await client.query(
          `SELECT activity_id FROM user_activities WHERE user_id = $1 AND type = 'BADGE_EARNED' AND badge_id = $2`,
          [user_id, trekBadge.badge_id]
        );
        if (existingBadgeAct.rows.length === 0) {
          await client.query(
            `INSERT INTO user_activities (user_id, type, title, description, trek_id, badge_id, metadata, created_at)
             VALUES ($1, 'BADGE_EARNED', $2, $3, $4, $5, $6, $7)`,
            [user_id, `Earned ${trekBadge.name}`, trekBadge.description, trek_id, trekBadge.badge_id,
             JSON.stringify({ rarity: trekBadge.rarity, is_trek_badge: true, backfilled: true }), completed_at]
          );
        }

        console.log(`✓ Backfilled badge "${trekBadge.name}" for user ${user_id}, trek ${trek_id}`);
      } else {
        console.log(`  Badge already existed for user ${user_id}, trek ${trek_id}`);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`✗ Error backfilling user ${user_id}, trek ${trek_id}:`, err.message);
    } finally {
      client.release();
    }
  }

  // Now evaluate milestone badges for all affected users
  const usersToEvaluate = [...new Set(unbackfilledRes.rows.map(r => r.user_id))];
  console.log(`\nEvaluating milestone badges for ${usersToEvaluate.length} user(s)...`);

  for (const userId of usersToEvaluate) {
    // Get their current stats
    const statsRes = await query(`
      SELECT
        COUNT(DISTINCT ut.trek_id) FILTER (WHERE ut.status = 'completed') AS treks_completed,
        COALESCE(SUM(t.distance_km) FILTER (WHERE ut.status = 'completed'), 0) AS total_distance_km,
        COUNT(DISTINCT t.state_id) FILTER (WHERE ut.status = 'completed') AS states_explored,
        COUNT(*) FILTER (WHERE ut.status = 'completed' AND (t.best_time ILIKE '%winter%' OR t.best_time ILIKE '%snow%' OR t.best_time ILIKE '%december%' OR t.best_time ILIKE '%january%')) AS winter_treks,
        COUNT(*) FILTER (WHERE ut.status = 'completed' AND GREATEST(t.elevation_m, t.highest_point_m) >= 3000) AS summits_3000m,
        COUNT(*) FILTER (WHERE ut.status = 'completed' AND GREATEST(t.elevation_m, t.highest_point_m) >= 4500) AS summits_4500m
      FROM user_treks ut
      JOIN treks t ON ut.trek_id = t.trek_id
      WHERE ut.user_id = $1
    `, [userId]);
    const calcStats = statsRes.rows[0];
    const treksCompleted = parseInt(calcStats.treks_completed || 0, 10);
    const totalDistanceKm = parseFloat(calcStats.total_distance_km || 0);
    const statesExplored = parseInt(calcStats.states_explored || 0, 10);
    const winterTreks = parseInt(calcStats.winter_treks || 0, 10);
    const summits3000m = parseInt(calcStats.summits_3000m || 0, 10);
    const summits4500m = parseInt(calcStats.summits_4500m || 0, 10);

    const allMilestones = await query(`SELECT * FROM badges WHERE trek_id IS NULL`);
    const earnedRes = await query(`SELECT badge_id FROM user_badges WHERE user_id = $1`, [userId]);
    const earnedIds = new Set(earnedRes.rows.map(r => parseInt(r.badge_id, 10)));

    for (const badge of allMilestones.rows) {
      if (earnedIds.has(badge.badge_id)) continue;
      let qualifies = false;
      switch (badge.requirement_type) {
        case 'treks_completed': qualifies = treksCompleted >= badge.requirement_value; break;
        case 'distance_km': qualifies = totalDistanceKm >= badge.requirement_value; break;
        case 'states_explored': qualifies = statesExplored >= badge.requirement_value; break;
        case 'winter_trek': qualifies = winterTreks >= badge.requirement_value; break;
        case 'summit_3000m': qualifies = summits3000m >= badge.requirement_value; break;
        case 'summit_4500m': qualifies = summits4500m >= badge.requirement_value; break;
      }
      if (qualifies) {
        await query(
          `INSERT INTO user_badges (user_id, badge_id, earned_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING`,
          [userId, badge.badge_id]
        );
        console.log(`  ✓ Milestone badge "${badge.name}" awarded to user ${userId}`);
      }
    }
  }

  // Final counts
  const finalCounts = await query(`
    SELECT COUNT(*) FILTER (WHERE b.trek_id IS NOT NULL) AS trek_badges,
           COUNT(*) FILTER (WHERE b.trek_id IS NULL) AS milestone_badges
    FROM user_badges ub JOIN badges b ON ub.badge_id = b.badge_id
  `);
  console.log('\nFinal user_badges counts:', finalCounts.rows[0]);
  process.exit(0);
}

backfillCompletionBadges().catch(e => { console.error(e); process.exit(1); });
