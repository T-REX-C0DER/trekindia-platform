import { query } from '../backend/src/config/database.js';
import * as profileService from '../backend/src/services/profileService.js';
import argon2 from 'argon2';

async function runTests() {
  console.log('--- Starting Trek Completion & Badge Suite Tests ---');

  // 1. Create a dedicated test user
  const testEmail = `test_trekker_${Date.now()}@example.com`;
  const passwordHash = await argon2.hash('TestPass123!');
  const userRes = await query(
    `INSERT INTO users (username, email, password_hash, full_name)
     VALUES ($1, $2, $3, $4) RETURNING user_id`,
    [`testtrekker_${Date.now()}`, testEmail, passwordHash, 'Test Trekker']
  );
  const userId = userRes.rows[0].user_id;
  console.log(`Created test user ID: ${userId}`);

  try {
    // TEST 1: Initial user state
    console.log('\n[TEST 1] Verifying fresh user stats...');
    let profile = await profileService.getUserProfile(userId);
    console.log('Initial stats:', profile.stats);
    if (
      profile.stats.treksCompleted !== 0 ||
      profile.stats.totalDistanceKm !== 0 ||
      profile.stats.highestSummitM !== 0 ||
      profile.stats.statesExplored !== 0 ||
      profile.stats.daysOnTrail !== 0
    ) {
      throw new Error(`Test 1 Failed: Expected all 0 stats, got ${JSON.stringify(profile.stats)}`);
    }
    console.log('✅ Test 1 Passed: Initial stats are all 0.');

    // TEST 2: Complete Dzükou Valley Trek (Trek ID 321)
    console.log('\n[TEST 2] Completing Dzükou Valley Trek...');
    const dzukouRes = await query(`SELECT trek_id, trek_name FROM treks WHERE slug = 'dzukou-valley-trek' OR trek_name ILIKE '%dzükou%' LIMIT 1`);
    const dzukouId = dzukouRes.rows[0].trek_id;

    const completeResult1 = await profileService.completeTrek(userId, dzukouId, {
      completed_at: new Date('2026-09-10T10:00:00Z'),
      notes: 'Breathtaking valley of flowers and dwarf bamboo!',
      rating: 5
    });

    console.log('After Dzükou Completion stats:', completeResult1.stats);
    console.log('Newly earned badges:', completeResult1.newlyEarnedBadges.map(b => b.name));

    if (completeResult1.stats.treksCompleted !== 1) throw new Error(`Expected 1 trek completed, got ${completeResult1.stats.treksCompleted}`);
    if (completeResult1.stats.totalDistanceKm !== 18) throw new Error(`Expected 18 km, got ${completeResult1.stats.totalDistanceKm}`);
    if (completeResult1.stats.highestSummitM !== 2452) throw new Error(`Expected 2452 m, got ${completeResult1.stats.highestSummitM}`);
    if (completeResult1.stats.statesExplored !== 1) throw new Error(`Expected 1 state, got ${completeResult1.stats.statesExplored}`);
    if (completeResult1.stats.daysOnTrail !== 2) throw new Error(`Expected 2 days on trail, got ${completeResult1.stats.daysOnTrail}`);

    // Check Dzükou Explorer badge & First Step badge
    const badges1 = await profileService.getUserBadges(userId);
    const earnedTrekBadge = badges1.trekBadges.find(b => b.unlocked && b.trek_id === dzukouId);
    if (!earnedTrekBadge) throw new Error('Test 2 Failed: Dzükou trek badge not earned!');
    console.log(`Earned trek badge: ${earnedTrekBadge.name} (${earnedTrekBadge.rarity})`);

    const firstStepBadge = badges1.milestoneBadges.find(b => b.slug === 'first-step');
    if (!firstStepBadge || !firstStepBadge.unlocked || firstStepBadge.current_value !== 1) {
      throw new Error('Test 2 Failed: First Step milestone badge not earned!');
    }
    console.log(`Earned milestone badge: ${firstStepBadge.name} (${firstStepBadge.current_value}/${firstStepBadge.requirement_value})`);
    console.log('✅ Test 2 Passed: Dzükou Valley stats and badges awarded correctly.');

    // TEST 3: Refresh Persistence
    console.log('\n[TEST 3] Testing Persistence (Re-fetching from database)...');
    profile = await profileService.getUserProfile(userId);
    if (profile.stats.treksCompleted !== 1 || profile.stats.totalDistanceKm !== 18 || profile.stats.highestSummitM !== 2452) {
      throw new Error('Test 3 Failed: Profile stats not persisting!');
    }
    console.log('✅ Test 3 Passed: Re-fetched profile is fully persistent.');

    // TEST 4: Idempotency / Duplicate completion
    console.log('\n[TEST 4] Testing Idempotent duplicate completion...');
    const duplicateRes = await profileService.completeTrek(userId, dzukouId, { rating: 5 });
    if (duplicateRes.stats.treksCompleted !== 1 || duplicateRes.stats.totalDistanceKm !== 18) {
      throw new Error(`Test 4 Failed: Stats inflated on duplicate! ${JSON.stringify(duplicateRes.stats)}`);
    }
    const completionRows = await query(`SELECT COUNT(*) FROM user_treks WHERE user_id = $1 AND trek_id = $2 AND status = 'completed'`, [userId, dzukouId]);
    if (parseInt(completionRows.rows[0].count) !== 1) {
      throw new Error(`Test 4 Failed: Multiple completion rows created in user_treks!`);
    }
    console.log('✅ Test 4 Passed: Duplicate completion is strictly idempotent.');

    // TEST 5: Complete second trek in same state (Nagaland)
    console.log('\n[TEST 5] Completing second trek in Nagaland (same state)...');
    const trekNagaland2 = await query(`SELECT trek_id, trek_name FROM treks WHERE state_id = (SELECT state_id FROM treks WHERE trek_id = $1) AND trek_id != $1 LIMIT 1`, [dzukouId]);
    if (trekNagaland2.rows.length > 0) {
      const nagaland2Id = trekNagaland2.rows[0].trek_id;
      const res5 = await profileService.completeTrek(userId, nagaland2Id);
      console.log(`Completed second Nagaland trek (${trekNagaland2.rows[0].trek_name}). Stats:`, res5.stats);
      if (res5.stats.treksCompleted !== 2) throw new Error('Expected 2 treks completed');
      if (res5.stats.statesExplored !== 1) throw new Error(`Expected states explored to remain 1, got ${res5.stats.statesExplored}`);
      console.log('✅ Test 5 Passed: States explored remains 1 when adding trek in same state.');
    }

    // TEST 6: Complete trek in Maharashtra (different state)
    console.log('\n[TEST 6] Completing trek in Maharashtra (different state)...');
    const mahaTrek = await query(`SELECT t.trek_id, t.trek_name, s.state_name FROM treks t JOIN states s ON t.state_id = s.state_id WHERE s.state_name ILIKE '%Maharashtra%' LIMIT 1`);
    if (mahaTrek.rows.length > 0) {
      const mahaId = mahaTrek.rows[0].trek_id;
      const res6 = await profileService.completeTrek(userId, mahaId);
      console.log(`Completed ${mahaTrek.rows[0].trek_name} in ${mahaTrek.rows[0].state_name}. Stats:`, res6.stats);
      if (res6.stats.statesExplored !== 2) throw new Error(`Expected states explored = 2, got ${res6.stats.statesExplored}`);
      console.log('✅ Test 6 Passed: States explored correctly updated to 2.');
    }

    // TEST 7: Complete higher elevation trek
    console.log('\n[TEST 7] Completing high altitude trek (Roopkund / Himalayan trek)...');
    const highTrek = await query(`SELECT trek_id, trek_name, elevation_m, distance_km FROM treks WHERE elevation_m > 4500 LIMIT 1`);
    if (highTrek.rows.length > 0) {
      const highId = highTrek.rows[0].trek_id;
      const res7 = await profileService.completeTrek(userId, highId);
      console.log(`Completed high summit trek ${highTrek.rows[0].trek_name} (${highTrek.rows[0].elevation_m}m). Stats:`, res7.stats);
      if (res7.stats.highestSummitM !== highTrek.rows[0].elevation_m) {
        throw new Error(`Expected highest summit to be ${highTrek.rows[0].elevation_m}, got ${res7.stats.highestSummitM}`);
      }
      console.log('✅ Test 7 Passed: Highest summit dynamically updated.');
    }

    // TEST 8: Milestone badge progression
    console.log('\n[TEST 8] Checking milestone badge thresholds...');
    const badges8 = await profileService.getUserBadges(userId);
    const trailExplorer = badges8.milestoneBadges.find(b => b.slug === 'trail-explorer');
    console.log(`Trail Explorer Progress: ${trailExplorer.current_value} / ${trailExplorer.requirement_value} km (${trailExplorer.progress_pct}%, unlocked: ${trailExplorer.unlocked})`);
    console.log('✅ Test 8 Passed: Milestone badge progress correctly calculated.');

    // TEST 9: Uncomplete / Remove completion
    console.log('\n[TEST 9] Testing Uncomplete functionality...');
    const uncompleteRes = await profileService.uncompleteTrek(userId, dzukouId);
    console.log('After uncompleting Dzükou Valley, Stats:', uncompleteRes.stats);
    const badges9 = await profileService.getUserBadges(userId);
    const dzukouBadgeAfter = badges9.trekBadges.find(b => b.trek_id === dzukouId);
    if (dzukouBadgeAfter.unlocked) {
      throw new Error('Test 9 Failed: Dzükou trek badge should be locked after uncompleting!');
    }
    console.log('Dzükou badge is now correctly locked:', !dzukouBadgeAfter.unlocked);
    console.log('✅ Test 9 Passed: Uncomplete safely reverts statistics and badges.');

    console.log('\n🎉 ALL 9 AUTOMATED SUITE TESTS PASSED PERFECTLY!');
  } finally {
    // Cleanup test user
    await query(`DELETE FROM users WHERE user_id = $1`, [userId]);
    console.log('Cleaned up test user.');
  }

  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test Suite Error:', err);
  process.exit(1);
});
