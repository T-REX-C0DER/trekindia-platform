import argon2 from 'argon2';
import { query, getClient } from '../config/database.js';

/**
 * Fetch full dynamic user profile & trekking statistics
 * Authoritative source of truth derived directly from completion records in database
 */
export async function getUserProfile(userId) {
  // 1. Core User & Profile Information
  const userRes = await query(
    `SELECT 
       u.user_id, u.username, u.email, u.full_name, u.profile_image, u.bio, 
       u.state, u.city, u.is_verified, u.role, u.created_at, u.last_login,
       up.cover_image, up.website, up.location, up.preferences,
       us.email_notifications, us.push_notifications, us.dark_mode, us.language, us.privacy_level
     FROM users u
     LEFT JOIN user_profiles up ON u.user_id = up.user_id
     LEFT JOIN user_settings us ON u.user_id = us.user_id
     WHERE u.user_id = $1`,
    [userId]
  );

  if (userRes.rows.length === 0) {
    return null;
  }

  const user = userRes.rows[0];

  // 2. Dynamic Trekking Statistics calculation
  const statsRes = await query(
    `SELECT
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
       ) FILTER (WHERE ut.status = 'completed'), 0) AS days_on_trail,
       COUNT(DISTINCT ut.trek_id) FILTER (WHERE ut.status = 'saved') AS saved_count,
       COUNT(DISTINCT ut.trek_id) FILTER (WHERE ut.status = 'wishlist') AS wishlist_count
     FROM user_treks ut
     JOIN treks t ON ut.trek_id = t.trek_id
     WHERE ut.user_id = $1`,
    [userId]
  );

  const stats = statsRes.rows[0];

  // 3. Favorite Difficulty & Favorite Season
  const favDiffRes = await query(
    `SELECT t.difficulty, COUNT(*) as count
     FROM user_treks ut
     JOIN treks t ON ut.trek_id = t.trek_id
     WHERE ut.user_id = $1 AND ut.status = 'completed' AND t.difficulty IS NOT NULL
     GROUP BY t.difficulty
     ORDER BY count DESC, t.difficulty ASC
     LIMIT 1`,
    [userId]
  );

  const favSeasonRes = await query(
    `SELECT 
       CASE 
         WHEN t.best_time ILIKE '%monsoon%' OR t.best_time ILIKE '%july%' OR t.best_time ILIKE '%august%' THEN 'Monsoon'
         WHEN t.best_time ILIKE '%winter%' OR t.best_time ILIKE '%december%' OR t.best_time ILIKE '%january%' THEN 'Winter'
         WHEN t.best_time ILIKE '%summer%' OR t.best_time ILIKE '%may%' OR t.best_time ILIKE '%june%' THEN 'Summer'
         WHEN t.best_time ILIKE '%autumn%' OR t.best_time ILIKE '%october%' THEN 'Autumn'
         ELSE 'Spring'
       END as season_group,
       COUNT(*) as count
     FROM user_treks ut
     JOIN treks t ON ut.trek_id = t.trek_id
     WHERE ut.user_id = $1 AND ut.status = 'completed' AND t.best_time IS NOT NULL
     GROUP BY season_group
     ORDER BY count DESC
     LIMIT 1`,
    [userId]
  );

  // 4. Badges Summary Count
  const badgeCountRes = await query(
    `SELECT COUNT(*) FROM user_badges WHERE user_id = $1`,
    [userId]
  );

  // 5. Reviews Count
  const reviewCountRes = await query(
    `SELECT COUNT(*) FROM trek_reviews WHERE user_id = $1`,
    [userId]
  );

  const treksCompleted = parseInt(stats.treks_completed || 0, 10);
  const totalDistanceKm = parseFloat(stats.total_distance_km || 0);
  const highestSummitM = parseInt(stats.highest_summit_m || 0, 10);
  const statesExplored = parseInt(stats.states_explored || 0, 10);
  const daysOnTrail = parseInt(stats.days_on_trail || 0, 10);

  const favoriteDifficulty = favDiffRes.rows.length > 0 ? favDiffRes.rows[0].difficulty : (treksCompleted > 0 ? 'Moderate' : 'N/A');
  const favoriteSeason = favSeasonRes.rows.length > 0 ? favSeasonRes.rows[0].season_group : (treksCompleted > 0 ? 'Monsoon' : 'N/A');

  // Format response payload
  return {
    user: {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      profile_image: user.profile_image,
      bio: user.bio,
      location: user.location || [user.city, user.state].filter(Boolean).join(', '),
      website: user.website,
      cover_image: user.cover_image,
      preferences: user.preferences || { difficulty: [], terrains: [], seasons: [] },
      is_verified: user.is_verified,
      role: user.role,
      created_at: user.created_at,
      last_login: user.last_login,
      settings: {
        email_notifications: user.email_notifications ?? true,
        push_notifications: user.push_notifications ?? true,
        dark_mode: user.dark_mode ?? false,
        language: user.language || 'en',
        privacy_level: user.privacy_level || 'public'
      }
    },
    stats: {
      treksCompleted,
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
      highestSummitM,
      statesExplored,
      daysOnTrail,
      savedCount: parseInt(stats.saved_count || 0, 10),
      wishlistCount: parseInt(stats.wishlist_count || 0, 10),
      reviewsCount: parseInt(reviewCountRes.rows[0].count || 0, 10),
      badgesUnlocked: parseInt(badgeCountRes.rows[0].count || 0, 10)
    },
    journey: {
      favoriteDifficulty,
      favoriteDifficultyCount: favDiffRes.rows.length > 0 ? parseInt(favDiffRes.rows[0].count, 10) : 0,
      favoriteSeason,
      favoriteSeasonCount: favSeasonRes.rows.length > 0 ? parseInt(favSeasonRes.rows[0].count, 10) : 0
    }
  };
}

/**
 * Update User Profile Information
 */
export async function updateUserProfile(userId, data) {
  const { full_name, username, bio, location, website, profile_image, preferences } = data;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Username check if changed
    if (username) {
      const existingUser = await client.query(
        `SELECT user_id FROM users WHERE LOWER(username) = LOWER($1) AND user_id != $2`,
        [username.trim(), userId]
      );
      if (existingUser.rows.length > 0) {
        const err = new Error('Username is already taken.');
        err.statusCode = 400;
        throw err;
      }
    }

    // Update users table
    await client.query(
      `UPDATE users 
       SET full_name = COALESCE($1, full_name),
           username = COALESCE($2, username),
           bio = COALESCE($3, bio),
           profile_image = COALESCE($4, profile_image),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $5`,
      [full_name ? full_name.trim() : null, username ? username.trim() : null, bio, profile_image, userId]
    );

    // Update user_profiles table
    await client.query(
      `INSERT INTO user_profiles (user_id, location, website, preferences, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         location = COALESCE(EXCLUDED.location, user_profiles.location),
         website = COALESCE(EXCLUDED.website, user_profiles.website),
         preferences = COALESCE(EXCLUDED.preferences, user_profiles.preferences),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, location, website, preferences ? JSON.stringify(preferences) : null]
    );

    await client.query('COMMIT');
    return getUserProfile(userId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get User Treks (Completed, Saved, Wishlist) with filtering and sorting
 */
export async function getUserTreks(userId, { status = 'completed', difficulty, sort = 'recent' }) {
  let sortClause = 'ut.created_at DESC';
  if (sort === 'elevation') sortClause = 't.elevation_m DESC NULLS LAST';
  else if (sort === 'distance') sortClause = 't.distance_km DESC NULLS LAST';
  else if (sort === 'rating') sortClause = 't.rating DESC NULLS LAST';
  else if (sort === 'completed') sortClause = 'ut.completed_at DESC NULLS LAST';

  const params = [userId, status];
  let difficultyClause = '';

  if (difficulty && difficulty !== 'All') {
    params.push(difficulty);
    difficultyClause = `AND t.difficulty = $${params.length}`;
  }

  const queryText = `
    SELECT
      ut.id AS user_trek_id,
      ut.status,
      ut.completed_at,
      ut.personal_rating,
      ut.notes,
      ut.created_at AS added_at,
      t.trek_id,
      t.trek_name AS name,
      t.slug,
      t.difficulty,
      t.distance_km,
      t.elevation_m,
      t.duration_hours,
      t.duration_label,
      t.best_time,
      t.rating,
      s.state_name AS state,
      d.district_name AS district,
      ti.image_url
    FROM user_treks ut
    JOIN treks t ON ut.trek_id = t.trek_id
    JOIN states s ON t.state_id = s.state_id
    LEFT JOIN districts d ON t.district_id = d.district_id
    LEFT JOIN LATERAL (
      SELECT image_url FROM trek_images 
      WHERE trek_id = t.trek_id 
      ORDER BY is_primary DESC, display_order ASC 
      LIMIT 1
    ) ti ON true
    WHERE ut.user_id = $1 AND ut.status = $2 ${difficultyClause}
    ORDER BY ${sortClause}
  `;

  const res = await query(queryText, params);
  return res.rows;
}

/**
 * Fetch a user's specific status on a trek (Completed, Saved, Wishlist)
 */
export async function getUserTrekStatus(userId, trekId) {
  const res = await query(
    `SELECT status, completed_at, personal_rating, notes, created_at 
     FROM user_treks 
     WHERE user_id = $1 AND trek_id = $2`,
    [userId, trekId]
  );

  const statuses = {
    completed: false,
    saved: false,
    wishlist: false,
    completed_at: null,
    personal_rating: null,
    notes: null
  };

  for (const row of res.rows) {
    if (row.status === 'completed') {
      statuses.completed = true;
      statuses.completed_at = row.completed_at;
      statuses.personal_rating = row.personal_rating;
      statuses.notes = row.notes;
    } else if (row.status === 'saved') {
      statuses.saved = true;
    } else if (row.status === 'wishlist') {
      statuses.wishlist = true;
    }
  }

  return statuses;
}

/**
 * Complete a Trek — Atomic Transaction Workflow
 * 1. Upsert completion record in user_treks (idempotent)
 * 2. Award individual trek badge
 * 3. Evaluate and award global milestone badges
 * 4. Create activity stream log
 * 5. Return updated profile, newly earned badges, and trek badge
 */
export async function completeTrek(userId, trekId, { completed_at, notes, rating } = {}) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Verify Trek Exists
    const trekRes = await client.query(
      `SELECT t.*, s.state_name 
       FROM treks t 
       LEFT JOIN states s ON t.state_id = s.state_id 
       WHERE t.trek_id = $1`,
      [trekId]
    );

    if (trekRes.rows.length === 0) {
      const err = new Error('Trek not found.');
      err.statusCode = 404;
      throw err;
    }

    const trek = trekRes.rows[0];
    const completionTimestamp = completed_at ? new Date(completed_at) : new Date();

    // 2. Insert or update completion in user_treks (idempotent, single record per user/trek)
    const completionRes = await client.query(
      `INSERT INTO user_treks (user_id, trek_id, status, personal_rating, completed_at, notes, created_at, updated_at)
       VALUES ($1, $2, 'completed', $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, trek_id, status) DO UPDATE SET
         personal_rating = COALESCE(EXCLUDED.personal_rating, user_treks.personal_rating),
         completed_at = COALESCE(EXCLUDED.completed_at, user_treks.completed_at),
         notes = COALESCE(EXCLUDED.notes, user_treks.notes),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, trekId, rating ? parseFloat(rating) : null, completionTimestamp, notes || null]
    );

    // 3. Ensure individual trek badge exists for this trek
    let badgeRes = await client.query(`SELECT * FROM badges WHERE trek_id = $1`, [trekId]);
    let trekBadge;

    if (badgeRes.rows.length > 0) {
      trekBadge = badgeRes.rows[0];
    } else {
      // Auto-create trek badge if missing
      const badgeSlug = `trek-${trek.slug || trek.trek_id}`;
      const badgeName = `${trek.trek_name} Explorer`;
      const badgeDesc = `Completed the ${trek.trek_name} in ${trek.state_name || 'India'}.`;
      const rarity = (trek.elevation_m >= 4500 || trek.difficulty === 'Extreme') ? 'Legendary' :
                     (trek.elevation_m >= 3000 || trek.difficulty === 'Difficult') ? 'Epic' :
                     (trek.elevation_m >= 1500 || trek.difficulty === 'Moderate') ? 'Rare' :
                     (trek.difficulty === 'Easy' && trek.elevation_m < 1000) ? 'Common' : 'Uncommon';
      const icon = (trek.best_time && (trek.best_time.toLowerCase().includes('winter') || trek.best_time.toLowerCase().includes('snow'))) ? 'snowflake' :
                   (trek.elevation_m >= 3000) ? 'mountain' :
                   (trek.elevation_m >= 2000) ? 'flag' : 'compass';

      const createBadgeRes = await client.query(
        `INSERT INTO badges (trek_id, slug, name, description, category, requirement_type, requirement_value, icon, rarity)
         VALUES ($1, $2, $3, $4, 'Trek Badges', 'trek_completion', 1, $5, $6)
         ON CONFLICT (slug) DO UPDATE SET trek_id = EXCLUDED.trek_id
         RETURNING *`,
        [trekId, badgeSlug, badgeName, badgeDesc, icon, rarity]
      );
      trekBadge = createBadgeRes.rows[0];
    }

    // 4. Award Trek Badge to User (idempotent)
    const awardTrekBadgeRes = await client.query(
      `INSERT INTO user_badges (user_id, badge_id, earned_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, badge_id) DO NOTHING
       RETURNING *`,
      [userId, trekBadge.badge_id, completionTimestamp]
    );

    const newlyEarnedBadges = [];
    const isNewTrekBadge = awardTrekBadgeRes.rows.length > 0;
    if (isNewTrekBadge) {
      newlyEarnedBadges.push({ ...trekBadge, is_trek_badge: true });
    }

    // 5. Evaluate Global Milestone Badges (inside transaction)
    const milestoneBadgesRes = await client.query(`SELECT * FROM badges WHERE trek_id IS NULL`);
    const allMilestones = milestoneBadgesRes.rows;

    const userEarnedMilestonesRes = await client.query(
      `SELECT badge_id FROM user_badges WHERE user_id = $1`,
      [userId]
    );
    const existingEarnedIds = new Set(userEarnedMilestonesRes.rows.map(r => parseInt(r.badge_id, 10)));

    // Calculate current stats for milestone badge evaluation
    const statsCalcRes = await client.query(
      `SELECT
         COUNT(DISTINCT ut.trek_id) FILTER (WHERE ut.status = 'completed') AS treks_completed,
         COALESCE(SUM(t.distance_km) FILTER (WHERE ut.status = 'completed'), 0) AS total_distance_km,
         COALESCE(MAX(GREATEST(t.elevation_m, t.highest_point_m)) FILTER (WHERE ut.status = 'completed'), 0) AS highest_summit_m,
         COUNT(DISTINCT t.state_id) FILTER (WHERE ut.status = 'completed') AS states_explored,
         COUNT(*) FILTER (WHERE ut.status = 'completed' AND (t.best_time ILIKE '%winter%' OR t.best_time ILIKE '%snow%' OR t.best_time ILIKE '%december%' OR t.best_time ILIKE '%january%')) AS winter_treks,
         COUNT(*) FILTER (WHERE ut.status = 'completed' AND GREATEST(t.elevation_m, t.highest_point_m) >= 3000) AS summits_3000m,
         COUNT(*) FILTER (WHERE ut.status = 'completed' AND GREATEST(t.elevation_m, t.highest_point_m) >= 4500) AS summits_4500m
       FROM user_treks ut
       JOIN treks t ON ut.trek_id = t.trek_id
       WHERE ut.user_id = $1`,
      [userId]
    );

    const calcStats = statsCalcRes.rows[0];
    const treksCompleted = parseInt(calcStats.treks_completed || 0, 10);
    const totalDistanceKm = parseFloat(calcStats.total_distance_km || 0);
    const statesExplored = parseInt(calcStats.states_explored || 0, 10);
    const winterTreks = parseInt(calcStats.winter_treks || 0, 10);
    const summits3000m = parseInt(calcStats.summits_3000m || 0, 10);
    const summits4500m = parseInt(calcStats.summits_4500m || 0, 10);

    for (const badge of allMilestones) {
      if (existingEarnedIds.has(badge.badge_id)) continue;

      let qualifies = false;
      switch (badge.requirement_type) {
        case 'treks_completed':
          qualifies = treksCompleted >= badge.requirement_value;
          break;
        case 'distance_km':
          qualifies = totalDistanceKm >= badge.requirement_value;
          break;
        case 'states_explored':
          qualifies = statesExplored >= badge.requirement_value;
          break;
        case 'winter_trek':
          qualifies = winterTreks >= badge.requirement_value;
          break;
        case 'summit_3000m':
          qualifies = summits3000m >= badge.requirement_value;
          break;
        case 'summit_4500m':
          qualifies = summits4500m >= badge.requirement_value;
          break;
      }

      if (qualifies) {
        await client.query(
          `INSERT INTO user_badges (user_id, badge_id, earned_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id, badge_id) DO NOTHING`,
          [userId, badge.badge_id]
        );

        // Activity for newly earned milestone badge
        await client.query(
          `INSERT INTO user_activities (user_id, type, title, description, badge_id, metadata, created_at)
           VALUES ($1, 'BADGE_EARNED', $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
          [
            userId,
            `Earned ${badge.name}`,
            `Unlocked milestone: ${badge.description}`,
            badge.badge_id,
            JSON.stringify({ rarity: badge.rarity, category: badge.category })
          ]
        );

        newlyEarnedBadges.push({ ...badge, is_trek_badge: false });
      }
    }

    // 6. Log Activities (Avoid duplicates if completing same trek again)
    const existingActivityRes = await client.query(
      `SELECT activity_id FROM user_activities WHERE user_id = $1 AND type = 'TREK_COMPLETED' AND trek_id = $2`,
      [userId, trekId]
    );

    if (existingActivityRes.rows.length === 0) {
      const durationDesc = trek.duration_label || (trek.duration_hours ? `${trek.duration_hours}h` : '1 Day');
      const distDesc = trek.distance_km ? `${trek.distance_km} km` : 'Trail';
      const locDesc = trek.state_name || 'India';
      const descText = `${distDesc} • ${durationDesc} • ${locDesc}`;

      await client.query(
        `INSERT INTO user_activities (user_id, type, title, description, trek_id, metadata, created_at)
         VALUES ($1, 'TREK_COMPLETED', $2, $3, $4, $5, $6)`,
        [
          userId,
          `Completed ${trek.trek_name}`,
          descText,
          trekId,
          JSON.stringify({
            distance_km: trek.distance_km,
            elevation_m: trek.elevation_m,
            duration: durationDesc,
            state: locDesc
          }),
          completionTimestamp
        ]
      );
    }

    if (isNewTrekBadge) {
      const existingBadgeAct = await client.query(
        `SELECT activity_id FROM user_activities WHERE user_id = $1 AND type = 'BADGE_EARNED' AND badge_id = $2`,
        [userId, trekBadge.badge_id]
      );
      if (existingBadgeAct.rows.length === 0) {
        await client.query(
          `INSERT INTO user_activities (user_id, type, title, description, trek_id, badge_id, metadata, created_at)
           VALUES ($1, 'BADGE_EARNED', $2, $3, $4, $5, $6, $7)`,
          [
            userId,
            `Earned ${trekBadge.name}`,
            trekBadge.description,
            trekId,
            trekBadge.badge_id,
            JSON.stringify({ rarity: trekBadge.rarity, is_trek_badge: true }),
            completionTimestamp
          ]
        );
      }
    }

    await client.query('COMMIT');

    // 7. Fetch authoritative profile stats to return
    const profile = await getUserProfile(userId);

    return {
      success: true,
      completed: true,
      trek: {
        trek_id: trek.trek_id,
        name: trek.trek_name,
        slug: trek.slug,
        distance_km: trek.distance_km,
        elevation_m: trek.elevation_m,
        duration_label: trek.duration_label,
        state: trek.state_name
      },
      trekBadge: {
        ...trekBadge,
        earned_at: completionTimestamp
      },
      newlyEarnedBadges,
      stats: profile.stats,
      profile
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Uncomplete / Remove Trek Completion — Atomic Transaction
 * 1. Remove completion row from user_treks
 * 2. Remove individual trek badge
 * 3. Re-evaluate milestone badges and revoke unearned ones
 * 4. Return recalculated profile stats
 */
export async function uncompleteTrek(userId, trekId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Remove completion record
    await client.query(
      `DELETE FROM user_treks WHERE user_id = $1 AND trek_id = $2 AND status = 'completed'`,
      [userId, trekId]
    );

    // 2. Remove individual trek badge from user_badges
    await client.query(
      `DELETE FROM user_badges 
       WHERE user_id = $1 AND badge_id IN (
         SELECT badge_id FROM badges WHERE trek_id = $2
       )`,
      [userId, trekId]
    );

    // 3. Remove activities associated with this completion
    await client.query(
      `DELETE FROM user_activities WHERE user_id = $1 AND trek_id = $2 AND type = 'TREK_COMPLETED'`,
      [userId, trekId]
    );
    await client.query(
      `DELETE FROM user_activities 
       WHERE user_id = $1 AND type = 'BADGE_EARNED' AND badge_id IN (
         SELECT badge_id FROM badges WHERE trek_id = $2
       )`,
      [userId, trekId]
    );

    // 4. Re-calculate current stats to verify milestone badges
    const statsCalcRes = await client.query(
      `SELECT
         COUNT(DISTINCT ut.trek_id) FILTER (WHERE ut.status = 'completed') AS treks_completed,
         COALESCE(SUM(t.distance_km) FILTER (WHERE ut.status = 'completed'), 0) AS total_distance_km,
         COALESCE(MAX(GREATEST(t.elevation_m, t.highest_point_m)) FILTER (WHERE ut.status = 'completed'), 0) AS highest_summit_m,
         COUNT(DISTINCT t.state_id) FILTER (WHERE ut.status = 'completed') AS states_explored,
         COUNT(*) FILTER (WHERE ut.status = 'completed' AND (t.best_time ILIKE '%winter%' OR t.best_time ILIKE '%snow%' OR t.best_time ILIKE '%december%' OR t.best_time ILIKE '%january%')) AS winter_treks,
         COUNT(*) FILTER (WHERE ut.status = 'completed' AND GREATEST(t.elevation_m, t.highest_point_m) >= 3000) AS summits_3000m,
         COUNT(*) FILTER (WHERE ut.status = 'completed' AND GREATEST(t.elevation_m, t.highest_point_m) >= 4500) AS summits_4500m
       FROM user_treks ut
       JOIN treks t ON ut.trek_id = t.trek_id
       WHERE ut.user_id = $1`,
      [userId]
    );

    const calcStats = statsCalcRes.rows[0];
    const treksCompleted = parseInt(calcStats.treks_completed || 0, 10);
    const totalDistanceKm = parseFloat(calcStats.total_distance_km || 0);
    const statesExplored = parseInt(calcStats.states_explored || 0, 10);
    const winterTreks = parseInt(calcStats.winter_treks || 0, 10);
    const summits3000m = parseInt(calcStats.summits_3000m || 0, 10);
    const summits4500m = parseInt(calcStats.summits_4500m || 0, 10);

    // Fetch all milestone badges the user currently holds
    const userMilestonesRes = await client.query(
      `SELECT b.* 
       FROM user_badges ub
       JOIN badges b ON ub.badge_id = b.badge_id
       WHERE ub.user_id = $1 AND b.trek_id IS NULL`,
      [userId]
    );

    for (const badge of userMilestonesRes.rows) {
      let stillQualifies = false;
      switch (badge.requirement_type) {
        case 'treks_completed':
          stillQualifies = treksCompleted >= badge.requirement_value;
          break;
        case 'distance_km':
          stillQualifies = totalDistanceKm >= badge.requirement_value;
          break;
        case 'states_explored':
          stillQualifies = statesExplored >= badge.requirement_value;
          break;
        case 'winter_trek':
          stillQualifies = winterTreks >= badge.requirement_value;
          break;
        case 'summit_3000m':
          stillQualifies = summits3000m >= badge.requirement_value;
          break;
        case 'summit_4500m':
          stillQualifies = summits4500m >= badge.requirement_value;
          break;
      }

      if (!stillQualifies) {
        await client.query(
          `DELETE FROM user_badges WHERE user_id = $1 AND badge_id = $2`,
          [userId, badge.badge_id]
        );
        await client.query(
          `DELETE FROM user_activities WHERE user_id = $1 AND badge_id = $2`,
          [userId, badge.badge_id]
        );
      }
    }

    await client.query('COMMIT');

    const profile = await getUserProfile(userId);
    return {
      success: true,
      completed: false,
      message: 'Trek completion removed.',
      stats: profile.stats,
      profile
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Add / Update / Toggle Trek Status for user (Completed, Saved, Wishlist, or Remove)
 */
export async function setUserTrekStatus(userId, trekId, { status, rating, completed_at, notes }) {
  const validStatuses = ['completed', 'saved', 'wishlist', 'none'];
  if (!validStatuses.includes(status)) {
    const err = new Error('Invalid status.');
    err.statusCode = 400;
    throw err;
  }

  // Fetch trek info for activity log
  const trekRes = await query(`SELECT t.trek_name, s.state_name FROM treks t LEFT JOIN states s ON t.state_id = s.state_id WHERE t.trek_id = $1`, [trekId]);
  if (trekRes.rows.length === 0) {
    const err = new Error('Trek not found.');
    err.statusCode = 404;
    throw err;
  }
  const trekName = trekRes.rows[0].trek_name;

  if (status === 'completed') {
    return completeTrek(userId, trekId, { completed_at, notes, rating });
  }

  if (status === 'none') {
    // Delete all user trek statuses for this trek (both saved & wishlist)
    await query(`DELETE FROM user_treks WHERE user_id = $1 AND trek_id = $2`, [userId, trekId]);
    return getUserProfile(userId);
  }

  // Upsert trek status (saved or wishlist)
  await query(
    `INSERT INTO user_treks (user_id, trek_id, status, personal_rating, completed_at, notes, updated_at)
     VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_TIMESTAMP), $6, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, trek_id, status) DO UPDATE SET
       personal_rating = COALESCE(EXCLUDED.personal_rating, user_treks.personal_rating),
       completed_at = COALESCE(EXCLUDED.completed_at, user_treks.completed_at),
       notes = COALESCE(EXCLUDED.notes, user_treks.notes),
       updated_at = CURRENT_TIMESTAMP`,
    [userId, trekId, status, rating || null, completed_at || null, notes || null]
  );

  // Log user activity
  let actType = 'TREK_SAVED';
  let actTitle = `Saved ${trekName}`;
  if (status === 'wishlist') {
    actType = 'WISHLIST_ADDED';
    actTitle = `Added ${trekName} to Wishlist`;
  }

  await logUserActivity(userId, actType, actTitle, null, trekId);
  return getUserProfile(userId);
}

/**
 * Automatically Evaluate and Award Badges based on User Activity (standalone helper)
 */
export async function evaluateBadges(userId) {
  const profileData = await getUserProfile(userId);
  if (!profileData) return [];

  const { stats } = profileData;

  const seasonalStatsRes = await query(
    `SELECT 
       COUNT(*) FILTER (WHERE t.best_time ILIKE '%winter%' OR t.best_time ILIKE '%snow%' OR t.best_time ILIKE '%december%' OR t.best_time ILIKE '%january%') AS winter_treks,
       COUNT(*) FILTER (WHERE GREATEST(t.elevation_m, t.highest_point_m) >= 3000) AS summits_3000m,
       COUNT(*) FILTER (WHERE GREATEST(t.elevation_m, t.highest_point_m) >= 4500) AS summits_4500m
     FROM user_treks ut
     JOIN treks t ON ut.trek_id = t.trek_id
     WHERE ut.user_id = $1 AND ut.status = 'completed'`,
    [userId]
  );

  const extraStats = seasonalStatsRes.rows[0];
  const winterTreks = parseInt(extraStats.winter_treks || 0, 10);
  const summits3000m = parseInt(extraStats.summits_3000m || 0, 10);
  const summits4500m = parseInt(extraStats.summits_4500m || 0, 10);

  const allBadgesRes = await query(`SELECT * FROM badges WHERE trek_id IS NULL`);
  const allBadges = allBadgesRes.rows;

  const earnedRes = await query(`SELECT badge_id FROM user_badges WHERE user_id = $1`, [userId]);
  const earnedBadgeIds = new Set(earnedRes.rows.map(r => parseInt(r.badge_id, 10)));

  const newlyEarned = [];

  for (const badge of allBadges) {
    if (earnedBadgeIds.has(badge.badge_id)) continue;

    let qualifies = false;
    switch (badge.requirement_type) {
      case 'treks_completed':
        qualifies = stats.treksCompleted >= badge.requirement_value;
        break;
      case 'distance_km':
        qualifies = stats.totalDistanceKm >= badge.requirement_value;
        break;
      case 'states_explored':
        qualifies = stats.statesExplored >= badge.requirement_value;
        break;
      case 'winter_trek':
        qualifies = winterTreks >= badge.requirement_value;
        break;
      case 'summit_3000m':
        qualifies = summits3000m >= badge.requirement_value;
        break;
      case 'summit_4500m':
        qualifies = summits4500m >= badge.requirement_value;
        break;
    }

    if (qualifies) {
      await query(
        `INSERT INTO user_badges (user_id, badge_id, earned_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, badge_id) DO NOTHING`,
        [userId, badge.badge_id]
      );

      await logUserActivity(userId, 'BADGE_EARNED', `Earned ${badge.name}`, `Unlocked milestone: ${badge.description}`, null, badge.badge_id);
      newlyEarned.push(badge);
    }
  }

  return newlyEarned;
}

/**
 * Get all badges with unlock state & progress, partitioned into Trek Badges & Milestone Badges
 */
export async function getUserBadges(userId) {
  const profileData = await getUserProfile(userId);
  const stats = profileData ? profileData.stats : { treksCompleted: 0, totalDistanceKm: 0, statesExplored: 0 };

  const extraStatsRes = await query(
    `SELECT 
       COUNT(*) FILTER (WHERE t.best_time ILIKE '%winter%' OR t.best_time ILIKE '%snow%' OR t.best_time ILIKE '%december%' OR t.best_time ILIKE '%january%') AS winter_treks,
       COUNT(*) FILTER (WHERE GREATEST(t.elevation_m, t.highest_point_m) >= 3000) AS summits_3000m,
       COUNT(*) FILTER (WHERE GREATEST(t.elevation_m, t.highest_point_m) >= 4500) AS summits_4500m
     FROM user_treks ut
     JOIN treks t ON ut.trek_id = t.trek_id
     WHERE ut.user_id = $1 AND ut.status = 'completed'`,
    [userId]
  );
  const extraStats = extraStatsRes.rows[0];

  // 1. Fetch Milestone Badges (where trek_id IS NULL)
  const milestoneRes = await query(
    `SELECT 
       b.*,
       ub.earned_at
     FROM badges b
     LEFT JOIN user_badges ub ON b.badge_id = ub.badge_id AND ub.user_id = $1
     WHERE b.trek_id IS NULL
     ORDER BY (ub.earned_at IS NOT NULL) DESC, b.badge_id ASC`,
    [userId]
  );

  const milestoneBadges = milestoneRes.rows.map(b => {
    let current = 0;
    switch (b.requirement_type) {
      case 'treks_completed': current = stats.treksCompleted; break;
      case 'distance_km': current = Math.round(stats.totalDistanceKm); break;
      case 'states_explored': current = stats.statesExplored; break;
      case 'winter_trek': current = parseInt(extraStats.winter_treks || 0, 10); break;
      case 'summit_3000m': current = parseInt(extraStats.summits_3000m || 0, 10); break;
      case 'summit_4500m': current = parseInt(extraStats.summits_4500m || 0, 10); break;
    }

    const unlocked = !!b.earned_at;
    const progress = Math.min(100, Math.round((current / b.requirement_value) * 100));

    return {
      badge_id: b.badge_id,
      slug: b.slug,
      name: b.name,
      description: b.description,
      category: b.category,
      icon: b.icon,
      rarity: b.rarity,
      unlocked,
      earned_at: b.earned_at,
      requirement_type: b.requirement_type,
      requirement_value: b.requirement_value,
      current_value: current,
      progress_pct: progress
    };
  });

  // 2. Fetch User Trek Badges (both earned and featured/available)
  const trekBadgesRes = await query(
    `SELECT 
       b.*,
       ub.earned_at,
       t.trek_name,
       t.slug AS trek_slug,
       t.distance_km,
       t.elevation_m,
       t.duration_label,
       s.state_name
     FROM user_badges ub
     JOIN badges b ON ub.badge_id = b.badge_id
     JOIN treks t ON b.trek_id = t.trek_id
     LEFT JOIN states s ON t.state_id = s.state_id
     WHERE ub.user_id = $1 AND b.trek_id IS NOT NULL
     ORDER BY ub.earned_at DESC`,
    [userId]
  );

  const trekBadges = trekBadgesRes.rows.map(b => {
    return {
      badge_id: b.badge_id,
      trek_id: b.trek_id,
      slug: b.slug,
      name: b.name,
      description: b.description,
      category: 'Trek Badges',
      icon: b.icon,
      rarity: b.rarity,
      unlocked: true,
      earned_at: b.earned_at,
      trek_name: b.trek_name,
      trek_slug: b.trek_slug,
      distance_km: b.distance_km,
      elevation_m: b.elevation_m,
      duration_label: b.duration_label,
      state_name: b.state_name
    };
  });

  const earnedMilestonesCount = milestoneBadges.filter(b => b.unlocked).length;
  const earnedTrekBadgesCount = trekBadges.length;

  return {
    totalUnlocked: earnedMilestonesCount + earnedTrekBadgesCount,
    milestonesCount: milestoneBadges.length,
    milestonesUnlocked: earnedMilestonesCount,
    trekBadgesCount: earnedTrekBadgesCount,
    trekBadgesUnlocked: earnedTrekBadgesCount,
    milestoneBadges,
    trekBadges
  };
}

/**
 * Log user activity into activity stream
 */
export async function logUserActivity(userId, type, title, description = null, trekId = null, badgeId = null, metadata = {}) {
  await query(
    `INSERT INTO user_activities (user_id, type, title, description, trek_id, badge_id, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
    [userId, type, title, description, trekId, badgeId, JSON.stringify(metadata)]
  );
}

/**
 * Get User Activity Feed with smart date grouping
 */
export async function getUserActivities(userId, limit = 30) {
  const res = await query(
    `SELECT 
       ua.*,
       t.trek_name,
       t.slug AS trek_slug,
       b.name AS badge_name,
       b.icon AS badge_icon,
       b.rarity AS badge_rarity
     FROM user_activities ua
     LEFT JOIN treks t ON ua.trek_id = t.trek_id
     LEFT JOIN badges b ON ua.badge_id = b.badge_id
     WHERE ua.user_id = $1
     ORDER BY ua.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return res.rows.map(item => {
    const actDate = new Date(item.created_at);
    const now = new Date();
    
    // Check if Today
    const isToday = actDate.toDateString() === now.toDateString();
    
    // Check if Yesterday
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = actDate.toDateString() === yesterday.toDateString();

    let dateGroup = actDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
    if (isToday) dateGroup = 'TODAY';
    else if (isYesterday) dateGroup = 'YESTERDAY';

    const formattedTime = actDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    return {
      ...item,
      date_group: dateGroup,
      formatted_time: formattedTime
    };
  });
}

/**
 * Get User Reviews
 */
export async function getUserReviews(userId) {
  const res = await query(
    `SELECT 
       tr.*,
       t.trek_name,
       t.slug AS trek_slug,
       s.state_name AS state,
       ti.image_url
     FROM trek_reviews tr
     JOIN treks t ON tr.trek_id = t.trek_id
     JOIN states s ON t.state_id = s.state_id
     LEFT JOIN LATERAL (
       SELECT image_url FROM trek_images 
       WHERE trek_id = t.trek_id 
       ORDER BY is_primary DESC, display_order ASC 
       LIMIT 1
     ) ti ON true
     WHERE tr.user_id = $1
     ORDER BY tr.created_at DESC`,
    [userId]
  );
  return res.rows;
}

/**
 * Add or Edit Trek Review
 */
export async function createOrUpdateReview(userId, { trek_id, rating, title, review_text }) {
  if (!trek_id || !rating || !review_text) {
    const err = new Error('Trek ID, rating and review text are required.');
    err.statusCode = 400;
    throw err;
  }

  const res = await query(
    `INSERT INTO trek_reviews (user_id, trek_id, rating, title, review_text, updated_at)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, trek_id) DO UPDATE SET
       rating = EXCLUDED.rating,
       title = EXCLUDED.title,
       review_text = EXCLUDED.review_text,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [userId, trek_id, parseFloat(rating), title || null, review_text.trim()]
  );

  const trekRes = await query(`SELECT trek_name FROM treks WHERE trek_id = $1`, [trek_id]);
  const trekName = trekRes.rows.length > 0 ? trekRes.rows[0].trek_name : 'Trek';

  await logUserActivity(userId, 'REVIEW_CREATED', `Reviewed ${trekName}`, `${rating} ★ review submitted`, trek_id);

  return res.rows[0];
}

/**
 * Update User Settings & Notifications
 */
export async function updateUserSettings(userId, settings) {
  const { email_notifications, push_notifications, dark_mode, privacy_level } = settings;

  await query(
    `INSERT INTO user_settings (user_id, email_notifications, push_notifications, dark_mode, privacy_level, updated_at)
     VALUES ($1, COALESCE($2, true), COALESCE($3, true), COALESCE($4, false), COALESCE($5, 'public'), CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO UPDATE SET
       email_notifications = COALESCE(EXCLUDED.email_notifications, user_settings.email_notifications),
       push_notifications = COALESCE(EXCLUDED.push_notifications, user_settings.push_notifications),
       dark_mode = COALESCE(EXCLUDED.dark_mode, user_settings.dark_mode),
       privacy_level = COALESCE(EXCLUDED.privacy_level, user_settings.privacy_level),
       updated_at = CURRENT_TIMESTAMP`,
    [userId, email_notifications, push_notifications, dark_mode, privacy_level]
  );

  return getUserProfile(userId);
}

/**
 * Safely Delete Account (with Argon2 password validation)
 */
export async function deleteUserAccount(userId, password) {
  const userRes = await query(`SELECT password_hash FROM users WHERE user_id = $1`, [userId]);
  if (userRes.rows.length === 0) {
    const err = new Error('User account not found.');
    err.statusCode = 404;
    throw err;
  }

  const isValidPassword = await argon2.verify(userRes.rows[0].password_hash, password);
  if (!isValidPassword) {
    const err = new Error('Incorrect password. Account deletion cancelled.');
    err.statusCode = 401;
    throw err;
  }

  await query(`DELETE FROM users WHERE user_id = $1`, [userId]);
  return true;
}

/**
 * Get User's Smart Packing Checklist
 */
export async function getUserChecklist(userId) {
  try {
    const res = await query(
      `SELECT items, updated_at FROM user_checklists WHERE user_id = $1`,
      [userId]
    );
    if (res.rows.length === 0) {
      return { items: [], updated_at: null };
    }
    return {
      items: Array.isArray(res.rows[0].items) ? res.rows[0].items : [],
      updated_at: res.rows[0].updated_at
    };
  } catch (err) {
    console.warn('Checklist query error:', err.message);
    return { items: [], updated_at: null };
  }
}

/**
 * Save User's Smart Packing Checklist
 */
export async function saveUserChecklist(userId, items) {
  const sanitizedItems = Array.isArray(items) ? items : [];
  try {
    await query(
      `INSERT INTO user_checklists (user_id, items, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         items = EXCLUDED.items,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, JSON.stringify(sanitizedItems)]
    );
  } catch (err) {
    if (err.message.includes('relation "user_checklists" does not exist')) {
      await query(`
        CREATE TABLE IF NOT EXISTS user_checklists (
          user_id BIGINT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
          items JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await query(
        `INSERT INTO user_checklists (user_id, items, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE SET
           items = EXCLUDED.items,
           updated_at = CURRENT_TIMESTAMP`,
        [userId, JSON.stringify(sanitizedItems)]
      );
    } else {
      throw err;
    }
  }

  return getUserChecklist(userId);
}


