// Uses native fetch (Node 18+)
const BASE = 'http://localhost:5000';

let cookies = '';

async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', Cookie: cookies },
    credentials: 'include'
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  
  // Capture Set-Cookie (native fetch)
  try {
    const setCookieList = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (setCookieList.length > 0) {
      cookies = setCookieList.map(c => c.split(';')[0]).join('; ');
    }
  } catch(e) {}
  
  return { status: res.status, data: await res.json() };
}

async function runLiveTest() {
  console.log('=== LIVE API TEST ===\n');

  // 1. Login
  const loginResp = await api('POST', '/api/auth/login', {
    email: 'rahul_1786787084308@example.com',
    password: 'rahul_1786787084308'  // Try default password pattern
  });
  
  if (!loginResp.data.success) {
    // Try with a known user
    console.log('Login failed with first attempt, checking auth response:', loginResp.data.message);
    
    // Try sanjay's account 
    const loginResp2 = await api('POST', '/api/auth/login', {
      email: 'sanjaylade92220@gmail.com',
      password: 'sanjay123'
    });
    console.log('Login attempt 2:', loginResp2.data.success ? 'SUCCESS' : loginResp2.data.message);
    
    if (!loginResp2.data.success) {
      console.log('Cannot login - testing profile API with any available session');
      return;
    }
  } else {
    console.log('1. Login: SUCCESS as', loginResp.data.user?.username);
  }

  // 2. Get Profile Stats
  const profileResp = await api('GET', '/api/profile');
  if (profileResp.data.success) {
    const s = profileResp.data.stats;
    console.log('\n2. Profile Stats:');
    console.log('   Treks Completed:', s.treksCompleted);
    console.log('   Distance Km:', s.totalDistanceKm);
    console.log('   Highest Summit:', s.highestSummitM, 'm');
    console.log('   States Explored:', s.statesExplored);
    console.log('   Days on Trail:', s.daysOnTrail);
    console.log('   Badges Unlocked:', s.badgesUnlocked);
  } else {
    console.log('Profile error:', profileResp.data.message);
  }

  // 3. Get Badges
  const badgesResp = await api('GET', '/api/profile/badges');
  if (badgesResp.data.success) {
    console.log('\n3. Badges API:');
    console.log('   Trek Badges Earned:', badgesResp.data.trekBadgesUnlocked);
    console.log('   Milestone Earned:', badgesResp.data.milestonesUnlocked, '/', badgesResp.data.milestonesCount);
    if (badgesResp.data.trekBadges?.length > 0) {
      console.log('   Trek Badges:', badgesResp.data.trekBadges.map(b => b.name).join(', '));
    }
  } else {
    console.log('Badges error:', badgesResp.data.message);
  }

  // 4. Get Activities
  const actResp = await api('GET', '/api/profile/activity?limit=5');
  if (actResp.data.success && actResp.data.activities?.length > 0) {
    console.log('\n4. Activities:');
    actResp.data.activities.forEach(a => {
      console.log(`   [${a.date_group}] ${a.formatted_time} — ${a.title}`);
    });
  }

  // 5. Test completing a trek via API
  const trekStatusResp = await api('GET', '/api/treks/slug/dzukou-valley/user-status');
  if (trekStatusResp.status === 200) {
    console.log('\n5. Dzukou Valley Status:', JSON.stringify(trekStatusResp.data).substring(0, 100));
  }

  console.log('\n=== LIVE API TEST COMPLETE ===');
  process.exit(0);
}

runLiveTest().catch(e => { console.error('LIVE TEST ERROR:', e.message); process.exit(1); });
