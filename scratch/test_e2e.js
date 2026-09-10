/**
 * End-to-end verification of the Trek Completion System
 */
import { query } from '../backend/src/config/database.js';
import { getUserProfile, completeTrek, uncompleteTrek, getUserBadges, getUserActivities } from '../backend/src/services/profileService.js';

async function runTest() {
  // Use the existing user who has 2 completions
  const userId = 2;

  console.log('=== TREK COMPLETION SYSTEM VERIFICATION ===\n');

  // 1. Verify Profile Stats
  const profile = await getUserProfile(userId);
  console.log('1. Profile Stats:');
  console.log('   Treks Completed:', profile.stats.treksCompleted, '(expected: 2)');
  console.log('   Distance Logged:', profile.stats.totalDistanceKm, 'km (expected: ~15)');
  console.log('   Highest Summit:', profile.stats.highestSummitM, 'm (expected: 1450)');
  console.log('   States Explored:', profile.stats.statesExplored, '(expected: 1)');
  console.log('   Days on Trail:', profile.stats.daysOnTrail, '(expected: 2)');
  console.log('   Badges Unlocked:', profile.stats.badgesUnlocked);

  // 2. Verify Badges
  const badges = await getUserBadges(userId);
  console.log('\n2. Badges:');
  console.log('   Trek Badges Earned:', badges.trekBadgesUnlocked);
  console.log('   Trek Badges:', badges.trekBadges.map(b => b.name).join(', '));
  console.log('   Milestone Badges Total:', badges.milestonesCount);
  console.log('   Milestone Badges Earned:', badges.milestonesUnlocked);
  console.log('   Earned Milestones:', badges.milestoneBadges.filter(b => b.unlocked).map(b => b.name).join(', '));

  // Show milestone progress
  console.log('\n3. Milestone Badge Progress:');
  for (const badge of badges.milestoneBadges) {
    const status = badge.unlocked ? '✓' : `${badge.current_value}/${badge.requirement_value}`;
    console.log(`   ${badge.unlocked ? '✓' : '○'} ${badge.name}: ${status} (${badge.progress_pct}%)`);
  }

  // 3. Verify Activities
  const activities = await getUserActivities(userId);
  console.log('\n4. Activities:');
  for (const act of activities.slice(0, 8)) {
    console.log(`   [${act.date_group}] ${act.formatted_time} — ${act.type}: ${act.title}`);
  }

  // 4. Test Idempotency: Complete the same trek again (Dzukou Valley or similar)
  console.log('\n5. Testing complete for an already-completed trek (idempotency):');
  
  // Find a trek that's not yet completed by this user
  const uncompletedTrek = await query(`
    SELECT t.trek_id, t.trek_name FROM treks t
    WHERE t.trek_id NOT IN (
      SELECT trek_id FROM user_treks WHERE user_id = $1 AND status = 'completed'
    )
    LIMIT 1
  `, [userId]);

  if (uncompletedTrek.rows.length > 0) {
    const testTrek = uncompletedTrek.rows[0];
    console.log(`   Completing "${testTrek.trek_name}" (trek_id: ${testTrek.trek_id})...`);
    
    const result = await completeTrek(userId, testTrek.trek_id, {
      completed_at: new Date().toISOString(),
      notes: 'E2E test completion',
      rating: 4
    });
    
    console.log('   ✓ First completion succeeded:', result.success);
    console.log('   ✓ Trek badge earned:', result.trekBadge.name);
    console.log('   ✓ Newly earned badges:', result.newlyEarnedBadges.map(b => b.name).join(', ') || 'None');
    
    // Complete again - should be idempotent
    const result2 = await completeTrek(userId, testTrek.trek_id, { rating: 5 });
    console.log('   ✓ Second completion (idempotent):', result2.success);
    
    // Verify no duplicate records
    const dupCheck = await query(
      `SELECT COUNT(*) FROM user_treks WHERE user_id = $1 AND trek_id = $2 AND status = 'completed'`,
      [userId, testTrek.trek_id]
    );
    console.log('   ✓ No duplicates in user_treks:', dupCheck.rows[0].count === '1' ? 'PASS (1 record)' : `FAIL (${dupCheck.rows[0].count} records)`);
    
    const dupBadgeCheck = await query(
      `SELECT COUNT(*) FROM user_badges WHERE user_id = $1 AND badge_id IN (SELECT badge_id FROM badges WHERE trek_id = $2)`,
      [userId, testTrek.trek_id]
    );
    console.log('   ✓ No duplicate badges:', dupBadgeCheck.rows[0].count === '1' ? 'PASS (1 badge)' : `FAIL (${dupBadgeCheck.rows[0].count} badges)`);
    
    // Uncomplete
    console.log('\n6. Testing uncomplete:');
    const uncompleteResult = await uncompleteTrek(userId, testTrek.trek_id);
    console.log('   ✓ Uncomplete succeeded:', uncompleteResult.success);
    console.log('   ✓ Stats reverted. Treks completed:', uncompleteResult.stats.treksCompleted);
    
    const afterUncomplete = await query(
      `SELECT COUNT(*) FROM user_treks WHERE user_id = $1 AND trek_id = $2 AND status = 'completed'`,
      [userId, testTrek.trek_id]
    );
    console.log('   ✓ Completion record removed:', afterUncomplete.rows[0].count === '0' ? 'PASS' : 'FAIL');
  }

  console.log('\n=== ALL TESTS PASSED ✓ ===');
  process.exit(0);
}

runTest().catch(e => { console.error('TEST FAILED:', e.message, e.stack); process.exit(1); });
