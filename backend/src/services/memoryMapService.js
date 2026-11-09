/**
 * TrekIndia — Feature 4: AI Trek Memory Map Service
 * Personalized Adventure History, Completed Summits, Leaflet Geographic Map & Badges
 */

import { query, getClient } from '../config/database.js';
import { completeTrek } from './profileService.js';
import { generateAIText } from '../ai/aiProvider.js';

/**
 * Retrieve User Adventure Map Data
 * Returns completed treks with coordinates, verified summit elevations, distance, photos & badges
 */
export async function getUserAdventureMap(userId) {
  // 1. Fetch all completed treks with geo coordinates and territorial data
  const completedTreksRes = await query(
    `SELECT 
       ut.id AS completion_id,
       ut.trek_id,
       ut.completed_at,
       ut.personal_rating,
       ut.notes,
       t.trek_name,
       t.slug,
       t.difficulty,
       t.distance_km,
       t.duration_hours,
       t.elevation_m,
       t.highest_point_m,
       s.state_name,
       s.slug AS state_slug,
       d.district_name,
       tl.latitude,
       tl.longitude,
       tl.location_name,
       tl.address
     FROM user_treks ut
     JOIN treks t ON ut.trek_id = t.trek_id
     LEFT JOIN states s ON t.state_id = s.state_id
     LEFT JOIN districts d ON t.district_id = d.district_id
     LEFT JOIN trek_locations tl ON t.trek_id = tl.trek_id
     WHERE ut.user_id = $1 AND ut.status = 'completed'
     ORDER BY ut.completed_at DESC NULLS LAST, ut.id DESC`,
    [userId]
  );

  const completedTreks = completedTreksRes.rows;

  // 2. Fetch associated trek memories (photos, personal notes, highlights)
  const memoriesRes = await query(
    `SELECT 
       memory_id, trek_id, title, notes, photo_url, altitude_m, visibility, ai_summary, completed_at, created_at
     FROM trek_memories
     WHERE user_id = $1
     ORDER BY completed_at DESC, created_at DESC`,
    [userId]
  );

  // Group memories by trek_id
  const memoriesByTrek = {};
  memoriesRes.rows.forEach(m => {
    if (!memoriesByTrek[m.trek_id]) memoriesByTrek[m.trek_id] = [];
    memoriesByTrek[m.trek_id].push(m);
  });

  // Attach memories to completed treks
  completedTreks.forEach(t => {
    t.memories = memoriesByTrek[t.trek_id] || [];
  });

  // 3. Compute Verified Aggregated Metrics
  let totalDistanceKm = 0;
  let highestSummitM = 0;
  const statesSet = new Set();
  const districtsSet = new Set();

  completedTreks.forEach(t => {
    if (t.distance_km) totalDistanceKm += parseFloat(t.distance_km);
    const summit = Math.max(Number(t.elevation_m) || 0, Number(t.highest_point_m) || 0);
    if (summit > highestSummitM) highestSummitM = summit;
    if (t.state_name) statesSet.add(t.state_name);
    if (t.district_name) districtsSet.add(t.district_name);
  });

  // 4. Fetch Unlocked Badges
  const badgesRes = await query(
    `SELECT b.badge_id, b.slug, b.name, b.description, b.category, b.icon, b.rarity, ub.earned_at
     FROM user_badges ub
     JOIN badges b ON ub.badge_id = b.badge_id
     WHERE ub.user_id = $1
     ORDER BY ub.earned_at DESC`,
    [userId]
  );

  // 5. Generate GeoJSON features for Leaflet map
  const geojsonFeatures = completedTreks
    .filter(t => t.latitude && t.longitude)
    .map(t => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [parseFloat(t.longitude), parseFloat(t.latitude)]
      },
      properties: {
        trek_id: t.trek_id,
        name: t.trek_name,
        slug: t.slug,
        state: t.state_name,
        district: t.district_name,
        summit_m: Math.max(Number(t.elevation_m) || 0, Number(t.highest_point_m) || 0),
        distance_km: t.distance_km,
        difficulty: t.difficulty,
        completed_at: t.completed_at,
        rating: t.personal_rating,
        notes: t.notes,
        photos_count: t.memories.filter(m => m.photo_url).length,
        memories: t.memories
      }
    }));

  return {
    success: true,
    statistics: {
      treks_completed: completedTreks.length,
      total_distance_km: Math.round(totalDistanceKm * 10) / 10,
      highest_summit_m: highestSummitM,
      states_explored: statesSet.size,
      districts_explored: districtsSet.size,
      badges_unlocked: badgesRes.rows.length,
      memories_recorded: memoriesRes.rows.length
    },
    completed_treks: completedTreks,
    badges: badgesRes.rows,
    geojson: {
      type: 'FeatureCollection',
      features: geojsonFeatures
    }
  };
}

/**
 * Record a trek completion and trigger deterministic badge awards
 */
export async function recordTrekCompletion(userId, trekId, payload) {
  // Leverage authoritative server-side completion in profileService
  return completeTrek(userId, trekId, payload);
}

/**
 * Add a personal memory to a trek
 */
export async function addTrekMemory(userId, trekId, data) {
  const { title, notes, photo_url, altitude_m, visibility = 'public', completed_at } = data;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    throw new Error('Memory title is required.');
  }

  // Verify trek exists
  const trekRes = await query(`SELECT trek_name, slug FROM treks WHERE trek_id = $1`, [trekId]);
  if (trekRes.rows.length === 0) {
    throw new Error('Trek not found.');
  }

  const trek = trekRes.rows[0];

  // Optional AI adventure summary if notes are provided
  let aiSummary = null;
  if (notes && notes.length > 20) {
    const prompt = `Write a short 1-sentence poetic mountain journal caption summarizing this trekker's experience on ${trek.trek_name}: "${notes}"`;
    try {
      const aiRes = await generateAIText(prompt, 'You are an inspiring Himalayan mountain journal narrator.');
      if (aiRes.success && aiRes.content) {
        aiSummary = aiRes.content.replace(/^"|"$/g, '').trim();
      }
    } catch (_) {}
  }

  const res = await query(
    `INSERT INTO trek_memories (user_id, trek_id, title, notes, photo_url, altitude_m, visibility, ai_summary, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      userId,
      trekId,
      title.trim(),
      notes || null,
      photo_url || null,
      altitude_m ? parseInt(altitude_m, 10) : null,
      visibility === 'private' ? 'private' : 'public',
      aiSummary,
      completed_at ? new Date(completed_at) : new Date()
    ]
  );

  return res.rows[0];
}

/**
 * Retrieve memories for a trek
 */
export async function getTrekMemories(trekId, currentUserId = null) {
  const res = await query(
    `SELECT m.*, u.username, u.full_name, u.profile_image
     FROM trek_memories m
     JOIN users u ON m.user_id = u.user_id
     WHERE m.trek_id = $1 AND (m.visibility = 'public' OR m.user_id = $2)
     ORDER BY m.completed_at DESC NULLS LAST, m.created_at DESC`,
    [trekId, currentUserId]
  );
  return res.rows;
}

/**
 * Delete a user's memory with strict ownership check
 */
export async function deleteTrekMemory(userId, memoryId) {
  const res = await query(
    `DELETE FROM trek_memories WHERE memory_id = $1 AND user_id = $2 RETURNING memory_id`,
    [memoryId, userId]
  );
  if (res.rows.length === 0) {
    throw new Error('Memory not found or you are not authorized to delete it.');
  }
  return true;
}

