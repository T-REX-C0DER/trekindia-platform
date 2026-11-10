/**
 * Test: Messaging Privacy & Participant Isolation Verification
 * Asserts:
 * 1. Rahul Sharma seed conversations (ID 101) do NOT exist in the database.
 * 2. An arbitrary user cannot access conversations they are not a participant in (IDOR check).
 * 3. Fresh user accounts have zero conversations.
 */

import { query } from '../backend/src/config/database.js';
import * as communityService from '../backend/src/services/communityService.js';

async function runTests() {
  console.log('=== TEST SUITE: MESSAGING PRIVACY & ISOLATION ===');
  let passed = 0;
  let failed = 0;

  // Test 1: Verify seed user Rahul Sharma (ID 101) is deleted
  try {
    const rahulCheck = await query(`SELECT user_id, username FROM users WHERE user_id = 101 OR username = 'rahul_sharma'`);
    if (rahulCheck.rows.length === 0) {
      console.log('✅ Test 1 PASSED: Seed user Rahul Sharma (101) does NOT exist in users table.');
      passed++;
    } else {
      console.error('❌ Test 1 FAILED: Rahul Sharma still exists:', rahulCheck.rows);
      failed++;
    }
  } catch (err) {
    console.error('❌ Test 1 ERROR:', err.message);
    failed++;
  }

  // Test 2: Verify no seed conversations (IDs 1, 7, 10, 18, 19) exist
  try {
    const seedConvs = await query(`SELECT conversation_id FROM conversations WHERE conversation_id IN (1, 7, 10, 18, 19)`);
    if (seedConvs.rows.length === 0) {
      console.log('✅ Test 2 PASSED: Seed conversations (1, 7, 10, 18, 19) completely eradicated.');
      passed++;
    } else {
      console.error('❌ Test 2 FAILED: Seed conversations still found:', seedConvs.rows);
      failed++;
    }
  } catch (err) {
    console.error('❌ Test 2 ERROR:', err.message);
    failed++;
  }

  // Test 3: New or unassociated user gets zero conversations
  try {
    const fakeNewUser = { user_id: 99999, username: 'fresh_trekker' };
    const convs = await communityService.getConversations(fakeNewUser);
    if (Array.isArray(convs) && convs.length === 0) {
      console.log('✅ Test 3 PASSED: New user gets empty conversation list (no artificial starter chats).');
      passed++;
    } else {
      console.error('❌ Test 3 FAILED: New user received unexpected conversations:', convs);
      failed++;
    }
  } catch (err) {
    console.error('❌ Test 3 ERROR:', err.message);
    failed++;
  }

  // Test 4: IDOR Protection: User cannot access another user's conversation
  try {
    // Find an existing legitimate conversation
    const activeConvRes = await query(`SELECT conversation_id FROM conversations ORDER BY conversation_id ASC LIMIT 1`);
    if (activeConvRes.rows.length > 0) {
      const convId = activeConvRes.rows[0].conversation_id;
      // An outsider user not in that conversation
      const outsider = { user_id: 88888, username: 'outsider' };
      try {
        await communityService.getConversation(convId, outsider);
        console.error('❌ Test 4 FAILED: Unauthorized outsider was able to access conversation ' + convId);
        failed++;
      } catch (authErr) {
        if (authErr.statusCode === 404 || authErr.message.includes('unauthorized') || authErr.message.includes('not found')) {
          console.log(`✅ Test 4 PASSED: IDOR protection verified. Unauthorized access to conversation ${convId} correctly blocked.`);
          passed++;
        } else {
          console.error('❌ Test 4 FAILED with unexpected error:', authErr);
          failed++;
        }
      }
    } else {
      console.log('⚠️ Test 4 SKIPPED: No conversations in DB to test against.');
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
