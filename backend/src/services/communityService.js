/**
 * TrekIndia — Community Service
 * Manages all community business logic: posts, stories, comments, likes, saves,
 * followers, direct messaging, trek sharing in chat, notifications, and discovery.
 * 
 * STRICT PRODUCTION ARCHITECTURE:
 * - 100% genuine PostgreSQL database operations.
 * - Zero in-memory mock stores or artificial seed users/conversations.
 * - Strict participant-level isolation for direct messages.
 * - Single source of truth for user profiles, avatars, and engagement metrics.
 */

import { query, getClient } from '../config/database.js';
import messageProducer from '../kafka/producer.js';
import { createMessageSentEvent, createMessageReadEvent, createNotificationEvent } from '../kafka/schemas.js';
import wsManager from '../websocket/wsServer.js';

// Fallback avatar generator for users without a custom profile image
function getAuthorAvatar(profileImage, fullName, username) {
  if (profileImage && typeof profileImage === 'string' && profileImage.trim().length > 0) {
    return profileImage.trim();
  }
  const name = fullName || username || 'Trekker';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=285D2A&color=fff&size=150`;
}

// Relative time formatting helper
function formatRelativeTime(dateInput) {
  if (!dateInput) return 'Recently';
  const now = new Date();
  const past = new Date(dateInput);
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 45) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return past.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNITY POSTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get Community Feed Posts with Database Filtering & Pagination
 */
export async function getPosts({ tab = 'feed', tag, trek_id, search, limit = 20, offset = 0, currentUser }) {
  const currentUserId = currentUser?.user_id ? parseInt(currentUser.user_id, 10) : null;
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const whereConditions = [];
  const params = [];

  // Filter: Tab views
  if (tab === 'following' && currentUserId) {
    params.push(currentUserId);
    whereConditions.push(`(p.user_id IN (SELECT following_id FROM community_follows WHERE follower_id = $${params.length}) OR p.user_id = $${params.length})`);
  } else if (tab === 'saved' && currentUserId) {
    params.push(currentUserId);
    whereConditions.push(`p.post_id IN (SELECT post_id FROM community_post_saves WHERE user_id = $${params.length})`);
  } else if (tab === 'my-treks' && currentUserId) {
    params.push(currentUserId);
    whereConditions.push(`p.user_id = $${params.length}`);
  }

  // Filter: Tag (#kedarkantha)
  if (tag) {
    const cleanTag = tag.replace(/^#/, '').trim().toLowerCase();
    params.push(cleanTag);
    whereConditions.push(`EXISTS (
      SELECT 1 FROM unnest(p.hashtags) elem 
      WHERE LOWER(elem) = $${params.length}
    )`);
  }

  // Filter: Trek ID
  if (trek_id) {
    params.push(parseInt(trek_id, 10));
    whereConditions.push(`p.trek_id = $${params.length}`);
  }

  // Filter: Free text search
  if (search && search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    params.push(q);
    whereConditions.push(`(
      LOWER(p.caption) LIKE $${params.length} OR
      LOWER(COALESCE(p.location, '')) LIKE $${params.length} OR
      LOWER(COALESCE(t.trek_name, '')) LIKE $${params.length} OR
      LOWER(COALESCE(u.full_name, '')) LIKE $${params.length} OR
      LOWER(u.username) LIKE $${params.length}
    )`);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // Ordering
  let orderClause = 'ORDER BY p.created_at DESC';
  if (tab === 'trending') {
    orderClause = 'ORDER BY (p.likes_count * 2 + p.comments_count * 3 + p.saves_count * 4) DESC, p.created_at DESC';
  }

  // Total count query
  const countSql = `
    SELECT COUNT(*) AS total
    FROM community_posts p
    JOIN users u ON p.user_id = u.user_id
    LEFT JOIN treks t ON p.trek_id = t.trek_id
    ${whereClause}
  `;
  const countRes = await query(countSql, params);
  const total = parseInt(countRes.rows[0]?.total || 0, 10);

  // Main posts query with user engagement subqueries
  const currentUserIdParamIdx = currentUserId ? params.length + 1 : null;
  const limitParamIdx = currentUserId ? params.length + 2 : params.length + 1;
  const offsetParamIdx = currentUserId ? params.length + 3 : params.length + 2;

  const queryParams = [...params];
  if (currentUserId) queryParams.push(currentUserId);
  queryParams.push(safeLimit, safeOffset);

  const postsSql = `
    SELECT 
      p.post_id,
      p.user_id,
      p.post_type,
      p.caption,
      p.trek_id,
      p.location,
      p.difficulty,
      p.distance_km,
      p.elevation_m,
      p.duration_days,
      p.hashtags,
      p.images,
      p.likes_count,
      p.comments_count,
      p.shares_count,
      p.saves_count,
      p.is_pinned,
      p.created_at,
      u.username,
      u.full_name,
      u.profile_image,
      u.is_verified,
      t.trek_name,
      t.slug AS trek_slug,
      s.state_name,
      ${currentUserId ? `EXISTS(SELECT 1 FROM community_post_likes cpl WHERE cpl.post_id = p.post_id AND cpl.user_id = $${currentUserIdParamIdx}) AS is_liked,` : 'FALSE AS is_liked,'}
      ${currentUserId ? `EXISTS(SELECT 1 FROM community_post_saves cps WHERE cps.post_id = p.post_id AND cps.user_id = $${currentUserIdParamIdx}) AS is_saved` : 'FALSE AS is_saved'}
    FROM community_posts p
    JOIN users u ON p.user_id = u.user_id
    LEFT JOIN treks t ON p.trek_id = t.trek_id
    LEFT JOIN states s ON t.state_id = s.state_id
    ${whereClause}
    ${orderClause}
    LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
  `;

  const postsRes = await query(postsSql, queryParams);

  const posts = postsRes.rows.map(row => {
    let imagesArr = [];
    if (Array.isArray(row.images)) {
      imagesArr = row.images;
    } else if (row.images && typeof row.images === 'object') {
      imagesArr = Array.isArray(row.images) ? row.images : [row.images];
    } else if (typeof row.images === 'string') {
      try {
        const parsed = JSON.parse(row.images);
        imagesArr = Array.isArray(parsed) ? parsed : [parsed];
      } catch (_) {
        if (row.images.trim()) imagesArr = [row.images.trim()];
      }
    }

    const routeBadge = (row.difficulty || row.elevation_m || row.duration_days) ? {
      difficulty: row.difficulty || 'Moderate',
      elevation: row.elevation_m ? `${row.elevation_m}m` : null,
      duration: row.duration_days ? `${row.duration_days} Days` : null,
      state: row.state_name || row.location || 'India'
    } : null;

    return {
      post_id: parseInt(row.post_id, 10),
      user_id: parseInt(row.user_id, 10),
      user: {
        user_id: parseInt(row.user_id, 10),
        username: row.username,
        full_name: row.full_name || row.username,
        avatar: getAuthorAvatar(row.profile_image, row.full_name, row.username),
        is_verified: Boolean(row.is_verified)
      },
      post_type: row.post_type || 'experience',
      caption: row.caption || '',
      trek_name: row.trek_name || null,
      trek_slug: row.trek_slug || null,
      trek_id: row.trek_id ? parseInt(row.trek_id, 10) : null,
      location: row.location || 'India',
      difficulty: row.difficulty || 'Moderate',
      elevation_m: row.elevation_m ? parseInt(row.elevation_m, 10) : null,
      duration_days: row.duration_days ? parseInt(row.duration_days, 10) : null,
      distance_km: row.distance_km ? parseFloat(row.distance_km) : null,
      hashtags: Array.isArray(row.hashtags) ? row.hashtags : [],
      images: imagesArr,
      route_badge: routeBadge,
      likes_count: parseInt(row.likes_count || 0, 10),
      comments_count: parseInt(row.comments_count || 0, 10),
      shares_count: parseInt(row.shares_count || 0, 10),
      saves_count: parseInt(row.saves_count || 0, 10),
      is_liked: Boolean(row.is_liked),
      is_saved: Boolean(row.is_saved),
      created_at: row.created_at,
      formatted_time: formatRelativeTime(row.created_at)
    };
  });

  return {
    posts,
    total,
    has_more: safeOffset + safeLimit < total
  };
}

/**
 * Create a new Community Post
 */
export async function createPost({ user, post_type = 'experience', caption, trek_name, trek_id, location, difficulty, distance_km, elevation_m, duration_days, hashtags = [], images = [] }) {
  if (!user?.user_id) {
    const err = new Error('Authentication required to create a post.');
    err.statusCode = 401;
    throw err;
  }

  // Format hashtags
  let formattedHashtags = [];
  if (Array.isArray(hashtags)) {
    formattedHashtags = hashtags.map(h => String(h).replace(/^#/, '').trim()).filter(Boolean);
  } else if (typeof hashtags === 'string') {
    formattedHashtags = hashtags.split(/[\s,]+/).map(h => h.replace(/^#/, '').trim()).filter(Boolean);
  }

  // Extract hashtags from caption if not provided explicitly
  if (formattedHashtags.length === 0 && caption) {
    const matches = caption.match(/#[a-zA-Z0-9_-]+/g);
    if (matches) {
      formattedHashtags = matches.map(m => m.replace(/^#/, '').trim());
    }
  }

  // Format images
  let formattedImages = [];
  if (Array.isArray(images) && images.length > 0) {
    formattedImages = images;
  } else if (typeof images === 'string' && images.trim()) {
    try {
      formattedImages = JSON.parse(images);
    } catch (_) {
      formattedImages = [images.trim()];
    }
  }

  // Resolve trek_id if trek_name is given but no trek_id
  let resolvedTrekId = trek_id ? parseInt(trek_id, 10) : null;
  let resolvedTrekName = trek_name || null;
  let resolvedLocation = location || 'India';

  if (!resolvedTrekId && trek_name) {
    try {
      const trekRes = await query(
        `SELECT trek_id, trek_name, location FROM treks WHERE trek_name ILIKE $1 OR slug ILIKE $1 LIMIT 1`,
        [`%${trek_name.trim()}%`]
      );
      if (trekRes.rows.length > 0) {
        resolvedTrekId = trekRes.rows[0].trek_id;
        resolvedTrekName = trekRes.rows[0].trek_name;
        if (!location && trekRes.rows[0].location) {
          resolvedLocation = trekRes.rows[0].location;
        }
      }
    } catch (_) {}
  }

  const dbRes = await query(
    `INSERT INTO community_posts (
       user_id, post_type, caption, trek_id, location, difficulty, distance_km, elevation_m, duration_days, hashtags, images
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      user.user_id,
      post_type,
      caption || '',
      resolvedTrekId,
      resolvedLocation,
      difficulty || 'Moderate',
      distance_km ? parseFloat(distance_km) : null,
      elevation_m ? parseInt(elevation_m, 10) : null,
      duration_days ? parseInt(duration_days, 10) : null,
      formattedHashtags,
      JSON.stringify(formattedImages)
    ]
  );

  const row = dbRes.rows[0];
  const newPostId = parseInt(row.post_id, 10);

  // Trigger asynchronous visual learning if post has images
  if (formattedImages.length > 0) {
    import('./visualIntelligenceService.js').then(v => {
      v.ingestPostForVisualLearning(newPostId).catch(err => {
        console.warn(`[VisualEngine] Async post learning notice for post ${newPostId}:`, err.message);
      });
    }).catch(() => {});
  }

  return {
    post_id: newPostId,
    user_id: parseInt(user.user_id, 10),
    user: {
      user_id: parseInt(user.user_id, 10),
      username: user.username,
      full_name: user.full_name || user.username,
      avatar: getAuthorAvatar(user.profile_image, user.full_name, user.username),
      is_verified: Boolean(user.is_verified)
    },
    post_type: row.post_type,
    caption: row.caption,
    trek_name: resolvedTrekName,
    trek_id: resolvedTrekId,
    location: row.location,
    difficulty: row.difficulty,
    elevation_m: row.elevation_m,
    duration_days: row.duration_days,
    distance_km: row.distance_km ? parseFloat(row.distance_km) : null,
    hashtags: formattedHashtags,
    images: formattedImages,
    likes_count: 0,
    comments_count: 0,
    shares_count: 0,
    saves_count: 0,
    is_liked: false,
    is_saved: false,
    created_at: row.created_at,
    formatted_time: 'Just now'
  };
}

/**
 * Toggle Like on Post
 */
export async function toggleLikePost(postId, user) {
  if (!user?.user_id) {
    const err = new Error('Authentication required');
    err.statusCode = 401;
    throw err;
  }

  const pid = parseInt(postId, 10);
  const uid = parseInt(user.user_id, 10);

  const postCheck = await query(`SELECT user_id, likes_count FROM community_posts WHERE post_id = $1`, [pid]);
  if (postCheck.rows.length === 0) {
    const err = new Error('Post not found');
    err.statusCode = 404;
    throw err;
  }

  const postOwnerId = parseInt(postCheck.rows[0].user_id, 10);
  const existingLike = await query(
    `SELECT id FROM community_post_likes WHERE post_id = $1 AND user_id = $2`,
    [pid, uid]
  );

  let isLiked = false;
  let newLikesCount = parseInt(postCheck.rows[0].likes_count || 0, 10);

  if (existingLike.rows.length > 0) {
    // Unlike
    await query(`DELETE FROM community_post_likes WHERE post_id = $1 AND user_id = $2`, [pid, uid]);
    const updateRes = await query(
      `UPDATE community_posts SET likes_count = GREATEST(0, likes_count - 1), updated_at = CURRENT_TIMESTAMP WHERE post_id = $1 RETURNING likes_count`,
      [pid]
    );
    newLikesCount = parseInt(updateRes.rows[0].likes_count, 10);
    isLiked = false;
  } else {
    // Like
    await query(
      `INSERT INTO community_post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [pid, uid]
    );
    const updateRes = await query(
      `UPDATE community_posts SET likes_count = likes_count + 1, updated_at = CURRENT_TIMESTAMP WHERE post_id = $1 RETURNING likes_count`,
      [pid]
    );
    newLikesCount = parseInt(updateRes.rows[0].likes_count, 10);
    isLiked = true;

    // Send notification if not liking own post
    if (postOwnerId !== uid) {
      try {
        await query(
          `INSERT INTO notifications (user_id, actor_id, type, title, message, reference_id, reference_type)
           VALUES ($1, $2, 'like', 'New Like', $3, $4, 'post')`,
          [
            postOwnerId,
            uid,
            `${user.full_name || user.username} liked your trek post.`,
            pid
          ]
        );
      } catch (_) {}
    }
  }

  return {
    liked: isLiked,
    likes_count: newLikesCount
  };
}

/**
 * Toggle Save (Bookmark) on Post
 */
export async function toggleSavePost(postId, user) {
  if (!user?.user_id) {
    const err = new Error('Authentication required');
    err.statusCode = 401;
    throw err;
  }

  const pid = parseInt(postId, 10);
  const uid = parseInt(user.user_id, 10);

  const postCheck = await query(`SELECT saves_count FROM community_posts WHERE post_id = $1`, [pid]);
  if (postCheck.rows.length === 0) {
    const err = new Error('Post not found');
    err.statusCode = 404;
    throw err;
  }

  const existingSave = await query(
    `SELECT id FROM community_post_saves WHERE post_id = $1 AND user_id = $2`,
    [pid, uid]
  );

  let isSaved = false;
  let newSavesCount = parseInt(postCheck.rows[0].saves_count || 0, 10);

  if (existingSave.rows.length > 0) {
    // Unsave
    await query(`DELETE FROM community_post_saves WHERE post_id = $1 AND user_id = $2`, [pid, uid]);
    const updateRes = await query(
      `UPDATE community_posts SET saves_count = GREATEST(0, saves_count - 1), updated_at = CURRENT_TIMESTAMP WHERE post_id = $1 RETURNING saves_count`,
      [pid]
    );
    newSavesCount = parseInt(updateRes.rows[0].saves_count, 10);
    isSaved = false;
  } else {
    // Save
    await query(
      `INSERT INTO community_post_saves (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [pid, uid]
    );
    const updateRes = await query(
      `UPDATE community_posts SET saves_count = saves_count + 1, updated_at = CURRENT_TIMESTAMP WHERE post_id = $1 RETURNING saves_count`,
      [pid]
    );
    newSavesCount = parseInt(updateRes.rows[0].saves_count, 10);
    isSaved = true;
  }

  return {
    saved: isSaved,
    saves_count: newSavesCount
  };
}

/**
 * Delete a Post (with cascade cleanup)
 */
export async function deletePost(postId, userId) {
  const pid = parseInt(postId, 10);
  const uid = parseInt(userId, 10);

  const check = await query(`SELECT user_id FROM community_posts WHERE post_id = $1`, [pid]);
  if (check.rows.length === 0) {
    const err = new Error('Post not found');
    err.statusCode = 404;
    throw err;
  }

  if (parseInt(check.rows[0].user_id, 10) !== uid) {
    // Verify if admin
    const userRole = await query(`SELECT role FROM users WHERE user_id = $1`, [uid]);
    if (userRole.rows[0]?.role !== 'admin') {
      const err = new Error('You are not authorized to delete this post.');
      err.statusCode = 403;
      throw err;
    }
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE trek_image_embeddings SET is_active = FALSE WHERE post_id = $1`, [pid]);
    await client.query(`DELETE FROM community_comment_likes WHERE comment_id IN (SELECT comment_id FROM community_comments WHERE post_id = $1)`, [pid]);
    await client.query(`DELETE FROM community_comments WHERE post_id = $1`, [pid]);
    await client.query(`DELETE FROM community_post_likes WHERE post_id = $1`, [pid]);
    await client.query(`DELETE FROM community_post_saves WHERE post_id = $1`, [pid]);
    await client.query(`DELETE FROM community_posts WHERE post_id = $1`, [pid]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { success: true, message: 'Post deleted successfully.' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get Comments for a Post
 */
export async function getPostComments(postId, currentUser) {
  const pid = parseInt(postId, 10);
  const uid = currentUser?.user_id ? parseInt(currentUser.user_id, 10) : null;

  const res = await query(
    `SELECT 
       c.comment_id,
       c.post_id,
       c.parent_id,
       c.user_id,
       c.content,
       c.likes_count,
       c.created_at,
       u.username,
       u.full_name,
       u.profile_image,
       u.is_verified,
       ${uid ? `EXISTS(SELECT 1 FROM community_comment_likes ccl WHERE ccl.comment_id = c.comment_id AND ccl.user_id = $2) AS is_liked` : 'FALSE AS is_liked'}
     FROM community_comments c
     JOIN users u ON c.user_id = u.user_id
     WHERE c.post_id = $1
     ORDER BY c.created_at ASC`,
    uid ? [pid, uid] : [pid]
  );

  const rawList = res.rows.map(r => ({
    comment_id: parseInt(r.comment_id, 10),
    post_id: parseInt(r.post_id, 10),
    parent_id: r.parent_id ? parseInt(r.parent_id, 10) : null,
    content: r.content,
    likes_count: parseInt(r.likes_count || 0, 10),
    is_liked: Boolean(r.is_liked),
    created_at: formatRelativeTime(r.created_at),
    raw_created_at: r.created_at,
    user: {
      user_id: parseInt(r.user_id, 10),
      username: r.username,
      full_name: r.full_name || r.username,
      avatar: getAuthorAvatar(r.profile_image, r.full_name, r.username),
      is_verified: Boolean(r.is_verified)
    },
    replies: []
  }));

  // Build tree: top-level comments and their replies
  const commentMap = new Map();
  const rootComments = [];

  for (const c of rawList) {
    commentMap.set(c.comment_id, c);
  }

  for (const c of rawList) {
    if (c.parent_id && commentMap.has(c.parent_id)) {
      commentMap.get(c.parent_id).replies.push(c);
    } else {
      rootComments.push(c);
    }
  }

  return rootComments;
}

/**
 * Add Comment to a Post
 */
export async function addPostComment(postId, { user, content, parent_id }) {
  if (!user?.user_id) {
    const err = new Error('Authentication required');
    err.statusCode = 401;
    throw err;
  }
  if (!content || !content.trim()) {
    const err = new Error('Comment content is required');
    err.statusCode = 400;
    throw err;
  }

  const pid = parseInt(postId, 10);
  const uid = parseInt(user.user_id, 10);
  const parentId = parent_id ? parseInt(parent_id, 10) : null;

  const postCheck = await query(`SELECT user_id FROM community_posts WHERE post_id = $1`, [pid]);
  if (postCheck.rows.length === 0) {
    const err = new Error('Post not found');
    err.statusCode = 404;
    throw err;
  }
  const postOwnerId = parseInt(postCheck.rows[0].user_id, 10);

  const insRes = await query(
    `INSERT INTO community_comments (post_id, user_id, parent_id, content)
     VALUES ($1, $2, $3, $4)
     RETURNING comment_id, created_at`,
    [pid, uid, parentId, content.trim()]
  );

  const newCommentId = parseInt(insRes.rows[0].comment_id, 10);

  // Increment comments count on post
  await query(
    `UPDATE community_posts SET comments_count = comments_count + 1, updated_at = CURRENT_TIMESTAMP WHERE post_id = $1`,
    [pid]
  );

  // Notification for post author
  if (postOwnerId !== uid) {
    try {
      await query(
        `INSERT INTO notifications (user_id, actor_id, type, title, message, reference_id, reference_type)
         VALUES ($1, $2, 'comment', 'New Comment', $3, $4, 'post')`,
        [
          postOwnerId,
          uid,
          `${user.full_name || user.username} commented: "${content.trim().slice(0, 60)}"`,
          pid
        ]
      );
    } catch (_) {}
  }

  return {
    comment_id: newCommentId,
    post_id: pid,
    parent_id: parentId,
    user: {
      user_id: uid,
      username: user.username,
      full_name: user.full_name || user.username,
      avatar: getAuthorAvatar(user.profile_image, user.full_name, user.username)
    },
    content: content.trim(),
    likes_count: 0,
    is_liked: false,
    created_at: 'Just now',
    replies: []
  };
}

/**
 * Toggle Like on Comment
 */
export async function toggleLikeComment(commentId, postId, user) {
  const cid = parseInt(commentId, 10);
  const uid = user?.user_id ? parseInt(user.user_id, 10) : null;

  if (!uid) {
    const err = new Error('Authentication required');
    err.statusCode = 401;
    throw err;
  }

  const commentCheck = await query(`SELECT likes_count FROM community_comments WHERE comment_id = $1`, [cid]);
  if (commentCheck.rows.length === 0) {
    const err = new Error('Comment not found');
    err.statusCode = 404;
    throw err;
  }

  const existing = await query(
    `SELECT id FROM community_comment_likes WHERE comment_id = $1 AND user_id = $2`,
    [cid, uid]
  );

  let liked = false;
  let likesCount = parseInt(commentCheck.rows[0].likes_count || 0, 10);

  if (existing.rows.length > 0) {
    await query(`DELETE FROM community_comment_likes WHERE comment_id = $1 AND user_id = $2`, [cid, uid]);
    const upRes = await query(
      `UPDATE community_comments SET likes_count = GREATEST(0, likes_count - 1), updated_at = CURRENT_TIMESTAMP WHERE comment_id = $1 RETURNING likes_count`,
      [cid]
    );
    likesCount = parseInt(upRes.rows[0].likes_count, 10);
    liked = false;
  } else {
    await query(
      `INSERT INTO community_comment_likes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [cid, uid]
    );
    const upRes = await query(
      `UPDATE community_comments SET likes_count = likes_count + 1, updated_at = CURRENT_TIMESTAMP WHERE comment_id = $1 RETURNING likes_count`,
      [cid]
    );
    likesCount = parseInt(upRes.rows[0].likes_count, 10);
    liked = true;
  }

  return { liked, likes_count: likesCount };
}

/**
 * Delete Comment
 */
export async function deleteComment(commentId, postId, userId) {
  const cid = parseInt(commentId, 10);
  const pid = parseInt(postId, 10);
  const uid = parseInt(userId, 10);

  const check = await query(
    `SELECT c.user_id, p.user_id AS post_author_id 
     FROM community_comments c
     JOIN community_posts p ON c.post_id = p.post_id
     WHERE c.comment_id = $1`,
    [cid]
  );

  if (check.rows.length === 0) {
    const err = new Error('Comment not found');
    err.statusCode = 404;
    throw err;
  }

  const isAuthor = parseInt(check.rows[0].user_id, 10) === uid;
  const isPostOwner = parseInt(check.rows[0].post_author_id, 10) === uid;

  if (!isAuthor && !isPostOwner) {
    const err = new Error('Unauthorized to delete this comment');
    err.statusCode = 403;
    throw err;
  }

  await query(`DELETE FROM community_comment_likes WHERE comment_id = $1`, [cid]);
  await query(`DELETE FROM community_comments WHERE comment_id = $1 OR parent_id = $1`, [cid]);
  await query(
    `UPDATE community_posts SET comments_count = GREATEST(0, comments_count - 1), updated_at = CURRENT_TIMESTAMP WHERE post_id = $1`,
    [pid]
  );

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get Active Stories (expires_at > NOW())
 */
export async function getStories(currentUser) {
  const currentUserId = currentUser?.user_id ? parseInt(currentUser.user_id, 10) : null;

  const res = await query(
    `SELECT 
       s.story_id,
       s.user_id,
       s.media_url,
       s.media_type,
       s.caption,
       s.location,
       s.trek_id,
       s.likes_count,
       s.created_at,
       s.expires_at,
       u.username,
       u.full_name,
       u.profile_image,
       t.trek_name
     FROM community_stories s
     JOIN users u ON s.user_id = u.user_id
     LEFT JOIN treks t ON s.trek_id = t.trek_id
     WHERE s.expires_at > CURRENT_TIMESTAMP
     ORDER BY s.created_at ASC`
  );

  // Group stories by user
  const userMap = new Map();

  for (const row of res.rows) {
    const uid = parseInt(row.user_id, 10);
    const slide = {
      id: `s-${row.story_id}`,
      story_id: parseInt(row.story_id, 10),
      media_url: row.media_url,
      caption: row.caption || '',
      location: row.location || 'Himalayas',
      trek_name: row.trek_name || 'Trekking Trail',
      created_at: formatRelativeTime(row.created_at)
    };

    if (!userMap.has(uid)) {
      userMap.set(uid, {
        story_id: parseInt(row.story_id, 10),
        user_id: uid,
        user: {
          user_id: uid,
          username: row.username,
          full_name: row.full_name || row.username,
          avatar: getAuthorAvatar(row.profile_image, row.full_name, row.username)
        },
        slides: [slide],
        has_unseen: true
      });
    } else {
      userMap.get(uid).slides.push(slide);
    }
  }

  return Array.from(userMap.values());
}

/**
 * Add Story (24 hour expiration)
 */
export async function addStory({ user, media_url, caption, location, trek_name, trek_id }) {
  if (!user?.user_id) {
    const err = new Error('Authentication required');
    err.statusCode = 401;
    throw err;
  }
  if (!media_url) {
    const err = new Error('Story image or media URL is required');
    err.statusCode = 400;
    throw err;
  }

  let resolvedTrekId = trek_id ? parseInt(trek_id, 10) : null;
  if (!resolvedTrekId && trek_name) {
    const tr = await query(`SELECT trek_id FROM treks WHERE trek_name ILIKE $1 LIMIT 1`, [`%${trek_name}%`]);
    if (tr.rows.length > 0) resolvedTrekId = tr.rows[0].trek_id;
  }

  const res = await query(
    `INSERT INTO community_stories (
       user_id, media_url, media_type, caption, trek_id, location, expires_at
     ) VALUES ($1, $2, 'image', $3, $4, $5, CURRENT_TIMESTAMP + INTERVAL '24 hours')
     RETURNING *`,
    [
      user.user_id,
      media_url,
      caption ? caption.slice(0, 200) : '',
      resolvedTrekId,
      location || 'India'
    ]
  );

  const row = res.rows[0];

  return {
    story_id: parseInt(row.story_id, 10),
    user_id: parseInt(user.user_id, 10),
    user: {
      user_id: parseInt(user.user_id, 10),
      username: user.username,
      full_name: user.full_name || user.username,
      avatar: getAuthorAvatar(user.profile_image, user.full_name, user.username)
    },
    slides: [
      {
        id: `s-${row.story_id}`,
        media_url: row.media_url,
        caption: row.caption || '',
        location: row.location || 'India',
        trek_name: trek_name || 'Trail',
        created_at: 'Just now'
      }
    ],
    has_unseen: true
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TREKKERS DIRECTORY & PROFILES (DATABASE-FIRST)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Search Genuine Registered Users from Database
 */
export async function searchUsers({ searchQuery, location, experience, difficulty, limit = 30, offset = 0, currentUser }) {
  const safeLimit = Math.min(parseInt(limit, 10) || 30, 50);
  const safeOffset = parseInt(offset, 10) || 0;
  const currentUserId = currentUser?.user_id ? parseInt(currentUser.user_id, 10) : null;
  const q = searchQuery ? searchQuery.trim().toLowerCase() : '';

  const conditions = ['u.role != $1'];
  const params = ['admin'];

  if (q) {
    params.push(`%${q}%`);
    const pIdx = params.length;
    conditions.push(`(
      LOWER(u.full_name) LIKE $${pIdx} OR
      LOWER(u.username) LIKE $${pIdx} OR
      LOWER(COALESCE(u.bio, '')) LIKE $${pIdx} OR
      LOWER(COALESCE(u.city, '')) LIKE $${pIdx} OR
      LOWER(COALESCE(u.state, '')) LIKE $${pIdx}
    )`);
  }

  if (location && location !== 'all') {
    params.push(`%${location.toLowerCase()}%`);
    const pIdx = params.length;
    conditions.push(`(
      LOWER(COALESCE(u.city, '')) LIKE $${pIdx} OR
      LOWER(COALESCE(u.state, '')) LIKE $${pIdx}
    )`);
  }

  // Filter out self
  if (currentUserId) {
    params.push(currentUserId);
    conditions.push(`u.user_id != $${params.length}`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const sql = `
    SELECT
      u.user_id,
      u.username,
      u.full_name,
      u.profile_image,
      u.bio,
      u.city,
      u.state,
      u.is_verified,
      u.online_status,
      u.created_at,
      up.cover_image,
      COALESCE((SELECT COUNT(*) FROM user_treks ut WHERE ut.user_id = u.user_id AND ut.status = 'completed'), 0) AS treks_completed,
      COALESCE((SELECT COUNT(*) FROM community_follows cf WHERE cf.following_id = u.user_id), 0) AS followers_count,
      COALESCE((SELECT COUNT(*) FROM community_follows cf WHERE cf.follower_id = u.user_id), 0) AS following_count,
      COALESCE((SELECT COUNT(*) FROM community_posts cp WHERE cp.user_id = u.user_id), 0) AS posts_count,
      ${currentUserId ? `EXISTS(SELECT 1 FROM community_follows cf WHERE cf.follower_id = $${params.length} AND cf.following_id = u.user_id) AS is_following` : 'FALSE AS is_following'}
    FROM users u
    LEFT JOIN user_profiles up ON u.user_id = up.user_id
    ${whereClause}
    ORDER BY 
      CASE WHEN u.is_verified THEN 0 ELSE 1 END,
      u.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  params.push(safeLimit, safeOffset);

  const res = await query(sql, params);

  return res.rows.map(row => {
    const isOnline = wsManager.isUserOnline(row.user_id);
    return {
      user_id: parseInt(row.user_id, 10),
      username: row.username,
      full_name: row.full_name || row.username,
      avatar: getAuthorAvatar(row.profile_image, row.full_name, row.username),
      cover_image: row.cover_image || null,
      bio: row.bio || '',
      location: [row.city, row.state].filter(Boolean).join(', ') || 'India',
      experience_level: 'Explorer',
      difficulty_preference: 'Moderate',
      treks_completed: parseInt(row.treks_completed || 0, 10),
      highest_altitude: null,
      states_explored: null,
      followers_count: parseInt(row.followers_count || 0, 10),
      following_count: parseInt(row.following_count || 0, 10),
      posts_count: parseInt(row.posts_count || 0, 10),
      is_verified: Boolean(row.is_verified),
      is_following: Boolean(row.is_following),
      active_trek: null,
      online_status: isOnline ? 'online' : (row.online_status || 'offline'),
      last_active: isOnline ? 'Active now' : 'Offline'
    };
  });
}

/**
 * Get Trekkers Directory
 */
export async function getTrekkers({ query: searchQuery, location, experience, difficulty, limit = 30 }) {
  return searchUsers({ searchQuery, location, experience, difficulty, limit });
}

/**
 * Get Trekker Full Profile by ID or Username (100% Database Driven)
 */
export async function getTrekkerProfile(identifier, currentUser) {
  if (!identifier) {
    const err = new Error('Trekker identifier is required');
    err.statusCode = 400;
    throw err;
  }

  const isNumeric = /^\d+$/.test(String(identifier).trim());
  const currentUserId = currentUser?.user_id ? parseInt(currentUser.user_id, 10) : null;

  const sql = isNumeric
    ? `SELECT 
         u.user_id, u.username, u.full_name, u.profile_image, u.bio, u.city, u.state,
         u.is_verified, u.online_status, u.created_at,
         up.cover_image, up.location AS profile_location,
         COALESCE((SELECT COUNT(*) FROM user_treks ut WHERE ut.user_id = u.user_id AND ut.status = 'completed'), 0) AS treks_completed,
         COALESCE((SELECT COUNT(*) FROM community_follows cf WHERE cf.following_id = u.user_id), 0) AS followers_count,
         COALESCE((SELECT COUNT(*) FROM community_follows cf WHERE cf.follower_id = u.user_id), 0) AS following_count,
         COALESCE((SELECT COUNT(*) FROM community_posts cp WHERE cp.user_id = u.user_id), 0) AS posts_count,
         ${currentUserId ? `EXISTS(SELECT 1 FROM community_follows cf WHERE cf.follower_id = $2 AND cf.following_id = u.user_id) AS is_following` : 'FALSE AS is_following'}
       FROM users u
       LEFT JOIN user_profiles up ON u.user_id = up.user_id
       WHERE u.user_id = $1 LIMIT 1`
    : `SELECT 
         u.user_id, u.username, u.full_name, u.profile_image, u.bio, u.city, u.state,
         u.is_verified, u.online_status, u.created_at,
         up.cover_image, up.location AS profile_location,
         COALESCE((SELECT COUNT(*) FROM user_treks ut WHERE ut.user_id = u.user_id AND ut.status = 'completed'), 0) AS treks_completed,
         COALESCE((SELECT COUNT(*) FROM community_follows cf WHERE cf.following_id = u.user_id), 0) AS followers_count,
         COALESCE((SELECT COUNT(*) FROM community_follows cf WHERE cf.follower_id = u.user_id), 0) AS following_count,
         COALESCE((SELECT COUNT(*) FROM community_posts cp WHERE cp.user_id = u.user_id), 0) AS posts_count,
         ${currentUserId ? `EXISTS(SELECT 1 FROM community_follows cf WHERE cf.follower_id = $2 AND cf.following_id = u.user_id) AS is_following` : 'FALSE AS is_following'}
       FROM users u
       LEFT JOIN user_profiles up ON u.user_id = up.user_id
       WHERE LOWER(u.username) = LOWER($1) LIMIT 1`;

  const params = currentUserId
    ? [isNumeric ? parseInt(identifier, 10) : String(identifier).trim(), currentUserId]
    : [isNumeric ? parseInt(identifier, 10) : String(identifier).trim()];

  const res = await query(sql, params);

  if (res.rows.length === 0) {
    const err = new Error('Trekker not found.');
    err.statusCode = 404;
    throw err;
  }

  const row = res.rows[0];
  const uid = parseInt(row.user_id, 10);
  const isOnline = wsManager.isUserOnline(uid);

  // Fetch real posts by this trekker
  const postsResult = await getPosts({
    currentUser,
    tab: 'all',
    search: null,
    limit: 10,
    offset: 0
  });
  const userPosts = postsResult.posts.filter(p => p.user_id === uid);

  // Fetch completed treks
  const completedTreksRes = await query(
    `SELECT t.trek_name AS name, t.elevation_m, t.difficulty, s.state_name AS state
     FROM user_treks ut
     JOIN treks t ON ut.trek_id = t.trek_id
     LEFT JOIN states s ON t.state_id = s.state_id
     WHERE ut.user_id = $1 AND ut.status = 'completed'
     ORDER BY ut.completed_at DESC LIMIT 5`,
    [uid]
  );

  const completedTreksList = completedTreksRes.rows.map(t => ({
    name: t.name,
    altitude: t.elevation_m ? `${t.elevation_m}m` : 'Himalayan Ridge',
    difficulty: t.difficulty || 'Moderate',
    state: t.state || 'India'
  }));

  return {
    user_id: uid,
    username: row.username,
    full_name: row.full_name || row.username,
    avatar: getAuthorAvatar(row.profile_image, row.full_name, row.username),
    cover_image: row.cover_image || null,
    bio: row.bio || 'TrekIndia Explorer.',
    location: [row.city, row.state].filter(Boolean).join(', ') || 'India',
    experience_level: 'Explorer',
    difficulty_preference: 'Moderate',
    treks_completed: parseInt(row.treks_completed || 0, 10),
    followers_count: parseInt(row.followers_count || 0, 10),
    following_count: parseInt(row.following_count || 0, 10),
    posts_count: userPosts.length,
    is_verified: Boolean(row.is_verified),
    is_following: Boolean(row.is_following),
    online_status: isOnline ? 'online' : (row.online_status || 'offline'),
    last_active: isOnline ? 'Active now' : 'Offline',
    posts: userPosts,
    completed_treks_list: completedTreksList
  };
}

/**
 * Toggle Follow User
 */
export async function toggleFollow(targetUserId, currentUser) {
  const currentId = currentUser?.user_id ? parseInt(currentUser.user_id, 10) : null;
  const targetId = parseInt(targetUserId, 10);

  if (!currentId) {
    const err = new Error('Authentication required');
    err.statusCode = 401;
    throw err;
  }

  if (currentId === targetId) {
    const err = new Error('You cannot follow yourself');
    err.statusCode = 400;
    throw err;
  }

  const targetCheck = await query(`SELECT user_id, full_name, username FROM users WHERE user_id = $1`, [targetId]);
  if (targetCheck.rows.length === 0) {
    const err = new Error('Target user not found');
    err.statusCode = 404;
    throw err;
  }

  const existingFollow = await query(
    `SELECT id FROM community_follows WHERE follower_id = $1 AND following_id = $2`,
    [currentId, targetId]
  );

  let isFollowing = false;

  if (existingFollow.rows.length > 0) {
    // Unfollow
    await query(`DELETE FROM community_follows WHERE follower_id = $1 AND following_id = $2`, [currentId, targetId]);
    isFollowing = false;
  } else {
    // Follow
    await query(
      `INSERT INTO community_follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [currentId, targetId]
    );
    isFollowing = true;

    // Send notification
    try {
      await query(
        `INSERT INTO notifications (user_id, actor_id, type, title, message)
         VALUES ($1, $2, 'follow', 'New Follower', $3)`,
        [targetId, currentId, `${currentUser.full_name || currentUser.username} started following your trek journal.`]
      );
    } catch (_) {}
  }

  const countRes = await query(
    `SELECT COUNT(*) FROM community_follows WHERE following_id = $1`,
    [targetId]
  );
  const followersCount = parseInt(countRes.rows[0].count, 10);

  return {
    is_following: isFollowing,
    followers_count: followersCount
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIRECT MESSAGING & CONVERSATIONS (ZERO LEAKAGE ARCHITECTURE)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get Conversations for Current User
 * Strictly returns only conversations where currentUser is an active participant.
 * No starter mock conversations. Clean empty list for new users.
 */
export async function getConversations(currentUser) {
  if (!currentUser?.user_id) return [];

  const userId = parseInt(currentUser.user_id, 10);

  const convSql = `
    SELECT
      c.conversation_id,
      c.is_group,
      c.group_name,
      c.group_avatar,
      c.last_message_at,
      c.last_message_text,
      cp.last_read_at,
      cp.status AS membership_status,
      -- Other participant details (for 1-on-1 direct conversations)
      other_u.user_id AS participant_id,
      other_u.full_name AS participant_name,
      other_u.username AS participant_username,
      other_u.profile_image AS participant_avatar,
      other_u.online_status AS participant_db_online,
      other_u.last_seen_at AS participant_last_seen,
      -- Calculate unread messages count
      COALESCE(
        (SELECT COUNT(*) FROM messages m
         WHERE m.conversation_id = c.conversation_id
           AND m.sender_id != $1
           AND m.created_at > cp.last_read_at
           AND m.is_deleted = FALSE), 0
      ) AS unread_count,
      -- Get latest message details
      latest_m.content AS latest_message_content,
      latest_m.message_type AS latest_message_type,
      latest_m.trek_data AS latest_message_trek_data,
      latest_m.created_at AS latest_message_created_at
    FROM conversation_participants cp
    JOIN conversations c ON cp.conversation_id = c.conversation_id
    -- Join to find other participant in direct conversation
    LEFT JOIN conversation_participants other_cp
      ON other_cp.conversation_id = c.conversation_id AND other_cp.user_id != $1
    LEFT JOIN users other_u
      ON other_cp.user_id = other_u.user_id
    -- Join latest message
    LEFT JOIN LATERAL (
      SELECT content, message_type, trek_data, created_at
      FROM messages
      WHERE conversation_id = c.conversation_id AND is_deleted = FALSE
      ORDER BY created_at DESC LIMIT 1
    ) latest_m ON TRUE
    WHERE cp.user_id = $1
      AND (cp.hidden_at IS NULL)
    ORDER BY COALESCE(latest_m.created_at, c.last_message_at, c.created_at) DESC;
  `;

  const res = await query(convSql, [userId]);

  return res.rows.map(row => {
    const otherUid = row.participant_id ? parseInt(row.participant_id, 10) : null;
    const isOnline = otherUid ? wsManager.isUserOnline(otherUid) : false;

    let lastMessagePreview = row.latest_message_content || row.last_message_text || '';
    if (!lastMessagePreview && row.latest_message_type === 'trek_card') {
      lastMessagePreview = `Shared Trek: ${row.latest_message_trek_data?.name || 'Trek'}`;
    } else if (!lastMessagePreview && row.latest_message_type === 'image') {
      lastMessagePreview = '📷 Photo';
    }

    // Format last message time
    let lastMsgTime = '';
    const msgDate = row.latest_message_created_at || row.last_message_at;
    if (msgDate) {
      lastMsgTime = formatRelativeTime(msgDate);
    }

    return {
      conversation_id: parseInt(row.conversation_id, 10),
      is_group: row.is_group,
      is_request: row.membership_status === 'pending',
      unread_count: parseInt(row.unread_count, 10),
      last_message: lastMessagePreview,
      last_message_time: lastMsgTime,
      last_message_at: msgDate,
      participant: {
        user_id: otherUid,
        full_name: row.participant_name || 'Trekker',
        username: row.participant_username || 'trekker',
        avatar: getAuthorAvatar(row.participant_avatar, row.participant_name, row.participant_username),
        online_status: isOnline ? 'online' : (row.participant_db_online || 'offline'),
        last_active: isOnline ? 'Active now' : 'Offline'
      }
    };
  });
}

/**
 * Get Conversation by ID with Full Message History
 * Strictly checks that currentUser is a participant in this conversation.
 * If not, returns 404 immediately. No IDOR fallback.
 */
export async function getConversation(conversationId, currentUser) {
  const convId = parseInt(conversationId, 10);
  const userId = currentUser?.user_id ? parseInt(currentUser.user_id, 10) : null;

  if (!userId) {
    const err = new Error('Authentication required');
    err.statusCode = 401;
    throw err;
  }

  // 1. Participant check: must exist and not be hidden
  const partRes = await query(
    `SELECT cp.status, cp.last_read_at, cp.hidden_at
     FROM conversation_participants cp
     WHERE cp.conversation_id = $1 AND cp.user_id = $2`,
    [convId, userId]
  );

  if (partRes.rows.length === 0 || partRes.rows[0].hidden_at) {
    const err = new Error('Conversation not found or unauthorized');
    err.statusCode = 404;
    throw err;
  }

  // 2. Fetch other participant details
  const otherUserRes = await query(
    `SELECT u.user_id, u.full_name, u.username, u.profile_image, u.online_status, u.last_seen_at
     FROM conversation_participants cp
     JOIN users u ON cp.user_id = u.user_id
     WHERE cp.conversation_id = $1 AND cp.user_id != $2
     LIMIT 1`,
    [convId, userId]
  );

  const otherUser = otherUserRes.rows[0] || {};
  const otherUid = otherUser.user_id ? parseInt(otherUser.user_id, 10) : null;
  const isOnline = otherUid ? wsManager.isUserOnline(otherUid) : false;

  // 3. Fetch messages
  const msgRes = await query(
    `SELECT m.message_id, m.conversation_id, m.sender_id, m.message_type,
            m.content, m.trek_data, m.attachment_url, m.status, m.client_message_id,
            m.created_at, u.full_name AS sender_name, u.profile_image AS sender_avatar, u.username AS sender_username
     FROM messages m
     JOIN users u ON m.sender_id = u.user_id
     WHERE m.conversation_id = $1 AND m.is_deleted = FALSE
     ORDER BY m.created_at ASC`,
    [convId]
  );

  const messages = msgRes.rows.map(m => {
    const isSelf = parseInt(m.sender_id, 10) === userId;
    const createdDate = new Date(m.created_at);
    return {
      message_id: parseInt(m.message_id, 10),
      conversation_id: convId,
      sender_id: parseInt(m.sender_id, 10),
      sender_name: m.sender_name,
      avatar: getAuthorAvatar(m.sender_avatar, m.sender_name, m.sender_username),
      message_type: m.message_type,
      content: m.content,
      trek_data: m.trek_data,
      attachment_url: m.attachment_url,
      status: m.status || 'sent',
      created_at: createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      raw_created_at: m.created_at,
      is_self: isSelf,
      client_message_id: m.client_message_id
    };
  });

  // 4. Mark unread messages as read
  const unreadMessageIds = messages
    .filter(m => !m.is_self && m.status !== 'read')
    .map(m => m.message_id);

  if (unreadMessageIds.length > 0) {
    await query(
      `UPDATE messages SET status = 'read', read_at = CURRENT_TIMESTAMP
       WHERE conversation_id = $1 AND sender_id != $2 AND status != 'read'`,
      [convId, userId]
    );

    await query(
      `UPDATE conversation_participants SET last_read_at = CURRENT_TIMESTAMP
       WHERE conversation_id = $1 AND user_id = $2 AND hidden_at IS NULL`,
      [convId, userId]
    );

    const readEvent = createMessageReadEvent({
      conversation_id: convId,
      reader_id: userId,
      message_ids: unreadMessageIds
    });
    const published = await messageProducer.publishMessageEvent(readEvent);
    if (!published) {
      wsManager.broadcastToConversationParticipants(
        convId,
        {
          type: 'message.read_receipt',
          conversation_id: convId,
          reader_id: userId,
          message_ids: unreadMessageIds,
          read_at: new Date().toISOString()
        },
        userId
      );
    }
  }

  return {
    conversation_id: convId,
    unread_count: 0,
    is_request: partRes.rows[0].status === 'pending',
    participant: {
      user_id: otherUid,
      full_name: otherUser.full_name || 'Trekker',
      username: otherUser.username || 'trekker',
      avatar: getAuthorAvatar(otherUser.profile_image, otherUser.full_name, otherUser.username),
      online_status: isOnline ? 'online' : (otherUser.online_status || 'offline'),
      last_active: isOnline ? 'Active now' : 'Offline'
    },
    messages
  };
}

/**
 * Get or Create a 1-on-1 Direct Conversation Between Two Genuine Users
 */
export async function getOrCreateDirectConversation(userIdA, userIdB) {
  const uidA = parseInt(userIdA, 10);
  const uidB = parseInt(userIdB, 10);

  if (!uidA || !uidB) {
    const err = new Error('Both participant IDs are required');
    err.statusCode = 400;
    throw err;
  }

  if (uidA === uidB) {
    const err = new Error('Cannot start conversation with yourself');
    err.statusCode = 400;
    throw err;
  }

  // Verify target user exists
  const targetCheck = await query(`SELECT user_id FROM users WHERE user_id = $1`, [uidB]);
  if (targetCheck.rows.length === 0) {
    const err = new Error('Target user does not exist');
    err.statusCode = 404;
    throw err;
  }

  // Find existing 1-on-1 conversation
  const existingSql = `
    SELECT cp1.conversation_id
    FROM conversation_participants cp1
    JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
    JOIN conversations c ON cp1.conversation_id = c.conversation_id
    WHERE cp1.user_id = $1 AND cp2.user_id = $2 AND c.is_group = FALSE
    LIMIT 1;
  `;

  const existingRes = await query(existingSql, [uidA, uidB]);
  if (existingRes.rows.length > 0) {
    const convId = parseInt(existingRes.rows[0].conversation_id, 10);
    // Un-hide if previously hidden
    await query(
      `UPDATE conversation_participants SET hidden_at = NULL
       WHERE conversation_id = $1 AND user_id IN ($2, $3) AND hidden_at IS NOT NULL`,
      [convId, uidA, uidB]
    ).catch(() => {});
    return { conversation_id: convId };
  }

  // Create new conversation
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const convRes = await client.query(
      `INSERT INTO conversations (is_group, last_message_at)
       VALUES (FALSE, CURRENT_TIMESTAMP)
       RETURNING conversation_id`
    );
    const newConvId = parseInt(convRes.rows[0].conversation_id, 10);

    await client.query(
      `INSERT INTO conversation_participants (conversation_id, user_id, status)
       VALUES ($1, $2, 'accepted'), ($1, $3, 'accepted')`,
      [newConvId, uidA, uidB]
    );
    await client.query('COMMIT');
    return { conversation_id: newConvId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Send Message in Conversation
 */
export async function sendMessage(conversationId, { user, content, message_type = 'text', trek_data, attachment_url, client_message_id }) {
  const convId = parseInt(conversationId, 10);
  const userId = user?.user_id ? parseInt(user.user_id, 10) : null;

  if (!userId) {
    const err = new Error('Authentication required');
    err.statusCode = 401;
    throw err;
  }

  // Verify participant
  const partRes = await query(
    `SELECT conversation_id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
    [convId, userId]
  );

  if (partRes.rows.length === 0) {
    const err = new Error('You are not a participant in this conversation.');
    err.statusCode = 403;
    throw err;
  }

  // Check duplicate / idempotent submission
  if (client_message_id) {
    const dupRes = await query(
      `SELECT message_id, conversation_id, sender_id, message_type, content, trek_data, attachment_url, status, created_at
       FROM messages
       WHERE client_message_id = $1 AND conversation_id = $2 AND sender_id = $3
       LIMIT 1`,
      [client_message_id, convId, userId]
    );
    if (dupRes.rows.length > 0) {
      return {
        message: dupRes.rows[0],
        conversation_id: convId
      };
    }
  }

  // Insert message into database
  const insertSql = `
    INSERT INTO messages (
      conversation_id, sender_id, message_type, content,
      trek_data, attachment_url, client_message_id, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'sent')
    RETURNING message_id, conversation_id, sender_id, message_type,
              content, trek_data, attachment_url, status, client_message_id, created_at;
  `;

  const msgRes = await query(insertSql, [
    convId,
    userId,
    message_type,
    content || null,
    trek_data ? JSON.stringify(trek_data) : null,
    attachment_url || null,
    client_message_id || null
  ]);

  const insertedMessage = msgRes.rows[0];

  // Update conversation snippet
  const snippet = content || (trek_data ? `Shared Trek: ${trek_data.name}` : 'Sent an attachment');
  await query(
    `UPDATE conversations
     SET last_message_at = CURRENT_TIMESTAMP, last_message_text = $1, last_message_sender_id = $2
     WHERE conversation_id = $3`,
    [snippet, userId, convId]
  );

  // Find receiver ID
  const receiverRes = await query(
    `SELECT user_id FROM conversation_participants WHERE conversation_id = $1 AND user_id != $2 LIMIT 1`,
    [convId, userId]
  );
  const receiverId = receiverRes.rows[0]?.user_id ? parseInt(receiverRes.rows[0].user_id, 10) : null;

  // Publish Kafka event or WebSocket fallback
  const kafkaEvent = createMessageSentEvent({
    message_id: insertedMessage.message_id,
    conversation_id: convId,
    sender_id: userId,
    receiver_id: receiverId,
    sender_name: user.full_name || user.username || 'You',
    sender_avatar: getAuthorAvatar(user.profile_image, user.full_name, user.username),
    content: insertedMessage.content,
    message_type: insertedMessage.message_type,
    trek_data: insertedMessage.trek_data,
    attachment_url: insertedMessage.attachment_url,
    client_message_id: insertedMessage.client_message_id,
    created_at: insertedMessage.created_at
  });

  const published = await messageProducer.publishMessageEvent(kafkaEvent);
  if (!published) {
    await dispatchDirectMessageFallback(kafkaEvent);
  }

  const formattedCreated = new Date(insertedMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return {
    message: {
      ...insertedMessage,
      message_id: parseInt(insertedMessage.message_id, 10),
      conversation_id: convId,
      sender_id: parseInt(insertedMessage.sender_id, 10),
      sender_name: user.full_name || 'You',
      avatar: getAuthorAvatar(user.profile_image, user.full_name, user.username),
      created_at: formattedCreated,
      raw_created_at: insertedMessage.created_at,
      is_self: true,
      read: true
    },
    conversation_id: convId
  };
}

/**
 * Mark Conversation as Read
 */
export async function markConversationRead(conversationId, currentUser) {
  const convId = parseInt(conversationId, 10);
  const userId = currentUser?.user_id ? parseInt(currentUser.user_id, 10) : null;
  if (!userId) {
    const err = new Error('Authentication required');
    err.statusCode = 401;
    throw err;
  }

  const participant = await query(
    `SELECT 1 FROM conversation_participants
     WHERE conversation_id = $1 AND user_id = $2 AND hidden_at IS NULL`,
    [convId, userId]
  );
  if (participant.rows.length === 0) {
    const err = new Error('Conversation not found or unauthorized');
    err.statusCode = 404;
    throw err;
  }

  await query(
    `UPDATE messages SET status = 'read', read_at = CURRENT_TIMESTAMP
     WHERE conversation_id = $1 AND sender_id != $2 AND status != 'read'`,
    [convId, userId]
  );

  await query(
    `UPDATE conversation_participants SET last_read_at = CURRENT_TIMESTAMP
     WHERE conversation_id = $1 AND user_id = $2 AND hidden_at IS NULL`,
    [convId, userId]
  );

  const readEvent = createMessageReadEvent({
    conversation_id: convId,
    reader_id: userId
  });
  const published = await messageProducer.publishMessageEvent(readEvent);
  if (!published) {
    wsManager.broadcastToConversationParticipants(
      convId,
      {
        type: 'message.read_receipt',
        conversation_id: convId,
        reader_id: userId,
        message_ids: [],
        read_at: new Date().toISOString()
      },
      userId
    );
  }

  return { success: true, conversation_id: convId };
}

/**
 * Delete Message (soft delete)
 */
export async function deleteMessage(conversationId, messageId, currentUser) {
  const convId = parseInt(conversationId, 10);
  const msgId = parseInt(messageId, 10);
  const userId = currentUser?.user_id ? parseInt(currentUser.user_id, 10) : null;

  if (!userId) {
    const err = new Error('Authentication required');
    err.statusCode = 401;
    throw err;
  }

  const result = await query(
    `UPDATE messages SET is_deleted = TRUE
     WHERE message_id = $1 AND conversation_id = $2 AND sender_id = $3
     RETURNING message_id`,
    [msgId, convId, userId]
  );

  if (result.rows.length === 0) {
    const err = new Error('Message not found or you are not authorized to delete it');
    err.statusCode = 403;
    throw err;
  }

  wsManager.broadcastToConversationParticipants(
    convId,
    {
      type: 'message.deleted',
      conversation_id: convId,
      message_id: msgId,
      deleted_by: userId
    },
    null
  );

  return { success: true, message_id: msgId };
}

/**
 * Delete / Hide Conversation For Current User Only
 */
export async function deleteConversationForMe(conversationId, currentUser) {
  const convId = parseInt(conversationId, 10);
  const userId = currentUser?.user_id ? parseInt(currentUser.user_id, 10) : null;

  if (!userId) {
    const err = new Error('Authentication required');
    err.statusCode = 401;
    throw err;
  }

  const partRes = await query(
    `SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
    [convId, userId]
  );

  if (partRes.rows.length === 0) {
    const err = new Error('Conversation not found or unauthorized');
    err.statusCode = 403;
    throw err;
  }

  await query(
    `UPDATE conversation_participants SET hidden_at = CURRENT_TIMESTAMP
     WHERE conversation_id = $1 AND user_id = $2`,
    [convId, userId]
  );

  return { success: true, conversation_id: convId };
}

/**
 * Accept / Decline Message Request
 */
export async function handleMessageRequest(conversationId, action, currentUser) {
  const convId = parseInt(conversationId, 10);
  const userId = currentUser?.user_id ? parseInt(currentUser.user_id, 10) : null;

  if (!userId) {
    const err = new Error('Authentication required');
    err.statusCode = 401;
    throw err;
  }

  if (action !== 'accept' && action !== 'decline') {
    const err = new Error('Action must be accept or decline.');
    err.statusCode = 400;
    throw err;
  }

  const result = await query(
    `UPDATE conversation_participants SET status = $1
     WHERE conversation_id = $2 AND user_id = $3
       AND status = 'pending' AND hidden_at IS NULL
     RETURNING id`,
    [action === 'accept' ? 'accepted' : 'declined', convId, userId]
  );
  if (result.rows.length === 0) {
    const err = new Error('Message request not found or already handled.');
    err.statusCode = 404;
    throw err;
  }

  return { success: true, conversation_id: convId };
}

/**
 * Get Total Unread Messages Count
 */
export async function getUnreadMessagesCount(currentUser) {
  const userId = currentUser?.user_id ? parseInt(currentUser.user_id, 10) : null;
  if (!userId) return { count: 0 };

  const res = await query(
    `SELECT COUNT(m.message_id) AS unread_count
     FROM messages m
     JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
     WHERE cp.user_id = $1
       AND cp.hidden_at IS NULL
       AND m.sender_id != $1
       AND m.created_at > cp.last_read_at
       AND m.is_deleted = FALSE`,
    [userId]
  );
  return { count: parseInt(res.rows[0]?.unread_count || 0, 10) };
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get Notifications from DB
 */
export async function getNotifications(currentUser) {
  const userId = currentUser?.user_id ? parseInt(currentUser.user_id, 10) : null;
  if (!userId) return { notifications: [], unread_count: 0 };

  try {
    const res = await query(
      `SELECT n.notification_id, n.type, n.title, n.message, n.reference_id,
              n.reference_type, n.is_read, n.created_at,
              u.full_name AS actor_name, u.profile_image AS actor_avatar, u.username AS actor_username
       FROM notifications n
       LEFT JOIN users u ON n.actor_id = u.user_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 30`,
      [userId]
    );

    const notifications = res.rows.map(n => ({
      notification_id: parseInt(n.notification_id, 10),
      type: n.type,
      title: n.title,
      message: n.message,
      reference_id: n.reference_id ? parseInt(n.reference_id, 10) : null,
      reference_type: n.reference_type,
      is_read: Boolean(n.is_read),
      time: formatRelativeTime(n.created_at),
      actor: {
        name: n.actor_name || 'Trekker',
        avatar: getAuthorAvatar(n.actor_avatar, n.actor_name, n.actor_username)
      }
    }));

    const unreadCount = notifications.filter(n => !n.is_read).length;
    return { notifications, unread_count: unreadCount };
  } catch (err) {
    console.warn('[Community Service] getNotifications notice:', err.message);
    return { notifications: [], unread_count: 0 };
  }
}

/**
 * Mark Notifications as Read
 */
export async function markNotificationsRead(notificationId, currentUser) {
  const userId = currentUser?.user_id ? parseInt(currentUser.user_id, 10) : null;
  if (!userId) return { success: false };

  try {
    if (notificationId === 'all') {
      await query(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1`, [userId]);
    } else if (notificationId) {
      await query(`UPDATE notifications SET is_read = TRUE WHERE notification_id = $1 AND user_id = $2`, [parseInt(notificationId, 10), userId]);
    }
    return { success: true };
  } catch (err) {
    return { success: false };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNITY SEARCH
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Universal Community Search across Treks, Trekkers, Posts, and Hashtags
 * 100% Genuine Database Query Execution
 */
export async function searchCommunity(q) {
  if (!q || !q.trim()) {
    return { treks: [], trekkers: [], posts: [], hashtags: [] };
  }

  const queryStr = q.trim();
  const pattern = `%${queryStr.toLowerCase()}%`;

  // 1. Search Treks
  const trekRes = await query(
    `SELECT t.trek_id, t.trek_name AS name, t.slug, t.elevation_m, t.difficulty, s.state_name AS state
     FROM treks t
     LEFT JOIN states s ON t.state_id = s.state_id
     WHERE LOWER(t.trek_name) LIKE $1 OR LOWER(t.slug) LIKE $1
     ORDER BY t.rating DESC NULLS LAST
     LIMIT 5`,
    [pattern]
  );

  // 2. Search Trekkers
  const matchedTrekkers = await searchUsers({ searchQuery: queryStr, limit: 5 });

  // 3. Search Posts
  const postRes = await query(
    `SELECT p.post_id, p.caption, p.location, p.images, p.created_at, u.username, u.full_name, u.profile_image
     FROM community_posts p
     JOIN users u ON p.user_id = u.user_id
     WHERE LOWER(p.caption) LIKE $1 OR LOWER(COALESCE(p.location, '')) LIKE $1
     ORDER BY p.likes_count DESC, p.created_at DESC
     LIMIT 5`,
    [pattern]
  );

  // 4. Search Hashtags from real posts
  const tagsRes = await query(
    `SELECT DISTINCT unnest(hashtags) AS tag
     FROM community_posts
     WHERE hashtags IS NOT NULL
     LIMIT 50`
  );
  const matchedHashtags = tagsRes.rows
    .map(r => r.tag)
    .filter(tag => tag && tag.toLowerCase().includes(queryStr.replace(/^#/, '').toLowerCase()))
    .slice(0, 8);

  return {
    query: queryStr,
    treks: trekRes.rows.map(t => ({
      trek_id: t.trek_id,
      name: t.name,
      slug: t.slug,
      altitude: t.elevation_m ? `${t.elevation_m}m` : null,
      difficulty: t.difficulty || 'Moderate',
      state: t.state || 'India'
    })),
    trekkers: matchedTrekkers,
    posts: postRes.rows.map(p => ({
      post_id: parseInt(p.post_id, 10),
      caption: p.caption,
      location: p.location,
      user: {
        username: p.username,
        full_name: p.full_name,
        avatar: getAuthorAvatar(p.profile_image, p.full_name, p.username)
      }
    })),
    hashtags: matchedHashtags
  };
}

/**
 * Direct WebSocket and notification fallback when Kafka KRaft broker is offline
 */
async function dispatchDirectMessageFallback(kafkaEvent) {
  try {
    const { payload } = kafkaEvent;
    const {
      message_id,
      conversation_id,
      sender_id,
      receiver_id,
      sender_name,
      sender_avatar,
      content,
      message_type,
      trek_data,
      attachment_url,
      created_at,
      client_message_id
    } = payload;

    const res = await query(
      `SELECT cp.user_id, u.full_name, u.profile_image
       FROM conversation_participants cp
       JOIN users u ON cp.user_id = u.user_id
       WHERE cp.conversation_id = $1`,
      [conversation_id]
    ).catch(() => ({ rows: [] }));

    const participants = res.rows && res.rows.length > 0 ? res.rows : [
      { user_id: sender_id, full_name: sender_name, profile_image: sender_avatar },
      ...(receiver_id ? [{ user_id: receiver_id, full_name: '', profile_image: null }] : [])
    ];

    let deliveredToAnyReceiver = false;

    for (const participant of participants) {
      const participantId = String(participant.user_id);
      const isSender = participantId === String(sender_id);

      const wsPayload = {
        type: 'message.new',
        message: {
          message_id: parseInt(message_id, 10),
          conversation_id: parseInt(conversation_id, 10),
          sender_id: parseInt(sender_id, 10),
          sender_name,
          sender_avatar,
          content,
          message_type,
          trek_data,
          attachment_url,
          status: isSender ? 'sent' : 'delivered',
          created_at,
          is_self: isSender,
          client_message_id
        }
      };

      const wasDelivered = wsManager.sendToUser(participantId, wsPayload);

      if (!isSender) {
        if (wasDelivered) {
          deliveredToAnyReceiver = true;
        } else {
          try {
            const title = `New message from ${sender_name}`;
            const snippet = content && content.length > 80 ? content.substring(0, 77) + '...' : (content || (trek_data ? `Shared Trek: ${trek_data.name}` : 'Sent an attachment'));
            await query(
              `INSERT INTO notifications (user_id, actor_id, type, title, message, reference_id, reference_type)
               VALUES ($1, $2, 'message', $3, $4, $5, 'conversation')`,
              [participantId, sender_id, title, snippet, conversation_id]
            ).catch(() => {});
          } catch (_) {}
        }
      }
    }

    if (deliveredToAnyReceiver) {
      await query(
        `UPDATE messages SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP
         WHERE message_id = $1 AND status = 'sent'`,
        [message_id]
      ).catch(() => {});

      wsManager.sendToUser(String(sender_id), {
        type: 'message.status_update',
        conversation_id: parseInt(conversation_id, 10),
        message_id: parseInt(message_id, 10),
        status: 'delivered',
        client_message_id
      });
    }
  } catch (err) {
    console.warn('[Direct Fallback] Dispatch notice:', err.message);
  }
}

export default {
  getPosts,
  createPost,
  toggleLikePost,
  toggleSavePost,
  deletePost,
  getPostComments,
  addPostComment,
  toggleLikeComment,
  deleteComment,
  getStories,
  addStory,
  searchUsers,
  getTrekkers,
  getTrekkerProfile,
  toggleFollow,
  getConversations,
  getConversation,
  getOrCreateDirectConversation,
  sendMessage,
  markConversationRead,
  deleteMessage,
  deleteConversationForMe,
  handleMessageRequest,
  getUnreadMessagesCount,
  getNotifications,
  markNotificationsRead,
  searchCommunity
};
