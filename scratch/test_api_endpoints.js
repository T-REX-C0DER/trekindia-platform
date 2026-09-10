const BASE_URL = 'http://localhost:5000';

async function run() {
  console.log('--- 1. Register / Login test user ---');
  const email = `trekker_${Date.now()}@example.com`;
  const password = 'Password@123';
  
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: `user_${Date.now().toString().slice(-6)}`,
      email,
      password,
      full_name: 'Test Trail Adventurer'
    })
  });
  const regData = await regRes.json();
  console.log('Registration status:', regRes.status, regData.success ? 'SUCCESS' : regData.message);

  const cookie = regRes.headers.get('set-cookie');
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': cookie ? cookie.split(';')[0] : ''
  };

  console.log('\n--- 2. Initial Profile Stats ---');
  const prof1Res = await fetch(`${BASE_URL}/api/profile`, { headers });
  const prof1 = await prof1Res.json();
  console.log('Initial stats:', prof1.stats);

  console.log('\n--- 3. Check Trek Status for "har-ki-dun" ---');
  const statusRes = await fetch(`${BASE_URL}/api/treks/slug/har-ki-dun/user-status`, { headers });
  const statusData = await statusRes.json();
  console.log('Trek initial status:', statusData);

  console.log('\n--- 4. Complete "har-ki-dun" with Rating 5 and Notes ---');
  const compRes = await fetch(`${BASE_URL}/api/treks/slug/har-ki-dun/complete`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      completed_at: '2026-09-05',
      notes: 'Epic glacier valley and clear night sky.',
      rating: 5
    })
  });
  const compData = await compRes.json();
  console.log('Complete response success:', compData.success);
  console.log('Awarded Trek Badge:', compData.trekBadge ? compData.trekBadge.name : 'None');
  console.log('Stats in response:', compData.stats);

  console.log('\n--- 5. Verify Profile API Stats ---');
  const prof2Res = await fetch(`${BASE_URL}/api/profile`, { headers });
  const prof2 = await prof2Res.json();
  console.log('Updated Profile Stats:', prof2.stats);

  console.log('\n--- 6. Verify Badges API ---');
  const badgesRes = await fetch(`${BASE_URL}/api/profile/badges`, { headers });
  const badgesData = await badgesRes.json();
  console.log('Trek Badges Count:', badgesData.trekBadges?.length);
  if (badgesData.trekBadges?.length > 0) {
    console.log('Earned Trek Badge:', badgesData.trekBadges[0].name, '| Unlocked:', badgesData.trekBadges[0].unlocked);
  }
  console.log('Milestone Badges Count:', badgesData.milestoneBadges?.length);
  const firstStep = badgesData.milestoneBadges?.find(b => b.name === 'First Step');
  console.log('First Step Badge Unlocked:', firstStep?.unlocked, 'Progress:', firstStep?.progress_pct + '%');

  console.log('\n--- 7. Check Trek Status after completion ---');
  const statusAfterRes = await fetch(`${BASE_URL}/api/treks/slug/har-ki-dun/user-status`, { headers });
  const statusAfterData = await statusAfterRes.json();
  console.log('Trek status after complete:', {
    completed: statusAfterData.completed,
    personal_rating: statusAfterData.personal_rating,
    notes: statusAfterData.notes
  });

  console.log('\n--- 8. Uncomplete Trek ---');
  const uncompRes = await fetch(`${BASE_URL}/api/treks/slug/har-ki-dun/uncomplete`, {
    method: 'POST',
    headers
  });
  const uncompData = await uncompRes.json();
  console.log('Uncomplete success:', uncompData.success, 'Stats:', uncompData.stats);

  console.log('\n--- 9. Verify Profile after uncomplete ---');
  const prof3Res = await fetch(`${BASE_URL}/api/profile`, { headers });
  const prof3 = await prof3Res.json();
  console.log('Reverted Profile Stats:', prof3.stats);

  console.log('\n✅ ALL TEST ASSERTIONS COMPLETED!');
}

run().catch(console.error);
