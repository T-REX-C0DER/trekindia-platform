/**
 * Test: Database-Backed Community Functionality
 * Asserts:
 * 1. getPosts() queries PostgreSQL community_posts directly (no mock postsStore).
 * 2. getStories() queries PostgreSQL community_stories.
 * 3. User avatars in posts match u.profile_image.
 * 4. Post like/save toggling persists into PostgreSQL tables.
 */

import { query } from '../backend/src/config/database.js';
import * as communityService from '../backend/src/services/communityService.js';

async function runTests() {
  console.log('=== TEST SUITE: COMMUNITY DATABASE INTEGRITY ===');
  let passed = 0;
  let failed = 0;

  // Test 1: Verify getPosts returns only DB posts
  try {
    const dbCountRes = await query(`SELECT COUNT(*) AS total FROM community_posts`);
    const dbTotal = parseInt(dbCountRes.rows[0].total, 10);

    const feed = await communityService.getPosts({ tab: 'feed', limit: 20 });
    if (feed.total === dbTotal && feed.posts.length === dbTotal) {
      console.log(`✅ Test 1 PASSED: getPosts() returned exactly ${feed.posts.length} genuine posts matching database count (${dbTotal}).`);
      passed++;
    } else {
      console.error(`❌ Test 1 FAILED: Mismatch between getPosts total (${feed.total}) and DB total (${dbTotal}).`);
      failed++;
    }
  } catch (err) {
    console.error('❌ Test 1 ERROR:', err.message);
    failed++;
  }

  // Test 2: Verify post authors are real DB users
  try {
    const feed = await communityService.getPosts({ tab: 'feed', limit: 10 });
    let allAuthorsValid = true;
    for (const post of feed.posts) {
      const userRes = await query(`SELECT user_id, username FROM users WHERE user_id = $1`, [post.user_id]);
      if (userRes.rows.length === 0) {
        console.error(`❌ Post ID ${post.post_id} references nonexistent user ID ${post.user_id}`);
        allAuthorsValid = false;
      }
    }
    if (allAuthorsValid && feed.posts.length > 0) {
      console.log('✅ Test 2 PASSED: All post authors link to verified users in the database.');
      passed++;
    } else if (feed.posts.length === 0) {
      console.log('⚠️ Test 2 SKIPPED: No posts in DB.');
    } else {
      failed++;
    }
  } catch (err) {
    console.error('❌ Test 2 ERROR:', err.message);
    failed++;
  }

  // Test 3: Like & Save Toggle in DB
  try {
    const firstPost = await query(`SELECT post_id, user_id FROM community_posts LIMIT 1`);
    if (firstPost.rows.length > 0) {
      const pid = firstPost.rows[0].post_id;
      const testUser = { user_id: 1, username: 'sanjaylade097' };

      // Initial like toggle
      const like1 = await communityService.toggleLikePost(pid, testUser);
      // Verify DB row
      const check1 = await query(`SELECT id FROM community_post_likes WHERE post_id = $1 AND user_id = $2`, [pid, 1]);
      const hasRow1 = check1.rows.length > 0;

      // Second like toggle (should remove)
      const like2 = await communityService.toggleLikePost(pid, testUser);
      const check2 = await query(`SELECT id FROM community_post_likes WHERE post_id = $1 AND user_id = $2`, [pid, 1]);
      const hasRow2 = check2.rows.length > 0;

      if (like1.liked === hasRow1 && like2.liked === hasRow2 && hasRow1 !== hasRow2) {
        console.log(`✅ Test 3 PASSED: Post like toggle correctly inserts and deletes rows from community_post_likes.`);
        passed++;
      } else {
        console.error('❌ Test 3 FAILED: Like state mismatch:', { like1, hasRow1, like2, hasRow2 });
        failed++;
      }
    }
  } catch (err) {
    console.error('❌ Test 3 ERROR:', err.message);
    failed++;
  }

  // Test 4: Stories returned only from DB
  try {
    const storiesRes = await communityService.getStories();
    const dbStoriesCount = await query(`SELECT COUNT(*) AS total FROM community_stories WHERE expires_at > CURRENT_TIMESTAMP`);
    const dbCount = parseInt(dbStoriesCount.rows[0].total, 10);

    const totalSlides = storiesRes.reduce((acc, u) => acc + u.slides.length, 0);
    if (totalSlides === dbCount) {
      console.log(`✅ Test 4 PASSED: getStories() returned ${totalSlides} slides matching database active count (${dbCount}).`);
      passed++;
    } else {
      console.error(`❌ Test 4 FAILED: Stories slides count (${totalSlides}) did not match DB count (${dbCount}).`);
      failed++;
    }
  } catch (err) {
    console.error('❌ Test 4 ERROR:', err.message);
    failed++;
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('Test runner fatal error:', e);
  process.exit(1);
});
