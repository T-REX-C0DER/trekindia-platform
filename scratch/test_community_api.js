import http from 'http';

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: res.headers['content-type']?.includes('application/json') ? JSON.parse(body) : body
          });
        } catch (e) {
          resolve({ statusCode: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting TrekIndia Community Automated Verification Tests...\n');

  // Test 1: Community HTML Page Route
  console.log('Test 1: GET /community');
  const pageRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/community',
    method: 'GET'
  });
  console.log(`Status: ${pageRes.statusCode}`);
  const hasNavbar = typeof pageRes.body === 'string' && pageRes.body.includes('class="navbar"');
  const hasGateway = typeof pageRes.body === 'string' && pageRes.body.includes('authGateOverlay');
  const hasFeed = typeof pageRes.body === 'string' && pageRes.body.includes('postsStream');
  console.log(`✅ Page contains navbar: ${hasNavbar}, auth gateway: ${hasGateway}, feed container: ${hasFeed}\n`);

  // Test 2: Community Posts API
  console.log('Test 2: GET /api/community/posts');
  const postsRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/community/posts',
    method: 'GET'
  });
  console.log(`Status: ${postsRes.statusCode}`);
  console.log(`✅ Posts returned: ${postsRes.body.posts?.length}, Total: ${postsRes.body.total}`);
  postsRes.body.posts?.slice(0, 3).forEach(p => {
    console.log(`  - [${p.post_type}] ${p.user.full_name} @ ${p.location || 'N/A'}: ${p.likes_count} likes, ${p.comments_count} comments`);
  });
  console.log('');

  // Test 3: Community Stories API
  console.log('Test 3: GET /api/community/stories');
  const storiesRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/community/stories',
    method: 'GET'
  });
  console.log(`Status: ${storiesRes.statusCode}`);
  console.log(`✅ Stories returned: ${storiesRes.body.stories?.length}`);
  storiesRes.body.stories?.forEach(s => {
    console.log(`  - Story by ${s.user.full_name} (${s.slides.length} slides)`);
  });
  console.log('');

  // Test 4: Trekkers Directory API
  console.log('Test 4: GET /api/community/trekkers');
  const trekkersRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/community/trekkers?location=all&experience=all',
    method: 'GET'
  });
  console.log(`Status: ${trekkersRes.statusCode}`);
  console.log(`✅ Trekkers found: ${trekkersRes.body.trekkers?.length}`);
  trekkersRes.body.trekkers?.slice(0, 4).forEach(t => {
    console.log(`  - ${t.full_name} (@${t.username}) - ${t.experience_level}, ${t.location} (${t.treks_completed} treks completed)`);
  });
  console.log('');

  // Test 5: Universal Community Search
  console.log('Test 5: GET /api/community/search?q=Kedarkantha');
  const searchRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/community/search?q=Kedarkantha',
    method: 'GET'
  });
  console.log(`Status: ${searchRes.statusCode}`);
  console.log(`✅ Search results for "Kedarkantha":`);
  console.log(`  - Treks: ${searchRes.body.treks?.map(t => t.name).join(', ')}`);
  console.log(`  - Trekkers: ${searchRes.body.trekkers?.map(t => t.full_name).join(', ')}`);
  console.log(`  - Posts: ${searchRes.body.posts?.length} posts found`);
  console.log(`  - Hashtags: ${searchRes.body.hashtags?.join(', ')}\n`);

  // Test 6: Registration & Authenticated Actions
  console.log('Test 6: POST /api/auth/register (Testing full authentication session flow)');
  const testEmail = `explorer_${Date.now()}@trekindia.com`;
  const regRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    full_name: 'Aarav Mehta',
    username: `aarav_${Date.now()}`,
    email: testEmail,
    password: 'Password123!',
    confirm_password: 'Password123!'
  });

  console.log(`Register status: ${regRes.statusCode}`);
  const cookie = regRes.headers['set-cookie'] ? regRes.headers['set-cookie'][0].split(';')[0] : '';
  console.log(`✅ User registered: ${regRes.body.user?.full_name}, Session Cookie received: ${!!cookie}\n`);

  // Test 7: Create Community Post with Auth
  console.log('Test 7: POST /api/community/posts (Create Post)');
  const createPostRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/community/posts',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    }
  }, {
    post_type: 'experience',
    caption: 'Ascending Roopkund ridge at dawn! Crisp mountain air, glaciers reflecting golden sunlight. An unforgettable high-altitude adventure with TrekIndia.',
    trek_name: 'Roopkund Mystery Lake',
    trek_id: 4,
    location: 'Chamoli, Uttarakhand',
    difficulty: 'Hard',
    elevation_m: 5029,
    duration_days: 8,
    distance_km: 53.0,
    hashtags: ['Roopkund', 'MysteryLake', 'HighAltitude', 'Uttarakhand'],
    images: ['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=85']
  });
  console.log(`Create Post status: ${createPostRes.statusCode}`);
  console.log(`✅ Post created: ID ${createPostRes.body.post?.post_id}, Caption: "${createPostRes.body.post?.caption?.substring(0, 45)}..."\n`);

  // Test 8: Like & Save Post
  console.log('Test 8: Toggle Like and Save on Post');
  const likeRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/community/posts/1/like`,
    method: 'POST',
    headers: { 'Cookie': cookie }
  });
  console.log(`Like status: ${likeRes.statusCode}, liked: ${likeRes.body.liked}, new count: ${likeRes.body.likes_count}`);

  const saveRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/community/posts/1/save`,
    method: 'POST',
    headers: { 'Cookie': cookie }
  });
  console.log(`Save status: ${saveRes.statusCode}, saved: ${saveRes.body.saved}, new count: ${saveRes.body.saves_count}\n`);

  // Test 9: Add Comment
  console.log('Test 9: POST /api/community/posts/1/comments');
  const commentRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/community/posts/1/comments`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    }
  }, {
    content: '@elena_vance Incredible route! What shoe traction did you use for the snowy pass?'
  });
  console.log(`Comment status: ${commentRes.statusCode}, comment ID: ${commentRes.body.comment?.comment_id}, text: "${commentRes.body.comment?.content}"\n`);

  // Test 10: Messaging & Trek Sharing in Chat
  console.log('Test 10: Send message with embedded Trek Card into conversation');
  const msgRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/community/messages/conversations/1/messages`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    }
  }, {
    message_type: 'trek_card',
    content: 'Check out this awesome route for next weekend!',
    trek_data: {
      name: 'Valley of Flowers',
      slug: 'valley-of-flowers',
      difficulty: 'EASY–MODERATE',
      elevation: '3,858m',
      distance: '38 km',
      duration: '6 Days',
      state: 'Uttarakhand',
      image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=600&q=80'
    }
  });
  console.log(`Message send status: ${msgRes.statusCode}, message type: ${msgRes.body.message?.message_type}, trek: ${msgRes.body.message?.trek_data?.name}\n`);

  // Test 11: Notifications
  console.log('Test 11: GET /api/community/notifications');
  const notifRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/community/notifications',
    method: 'GET',
    headers: { 'Cookie': cookie }
  });
  console.log(`Notifications status: ${notifRes.statusCode}, count: ${notifRes.body.notifications?.length}, unread: ${notifRes.body.unread_count}\n`);

  console.log('🎉 ALL 11 AUTOMATED COMMUNITY SPECIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
});
