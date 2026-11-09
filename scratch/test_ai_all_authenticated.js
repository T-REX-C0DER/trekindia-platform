import { generateToken } from '../backend/src/utils/cookies.js';
import dotenv from 'dotenv';
dotenv.config();

const BASE = 'http://localhost:5000';

// Generate session cookie for user 1
const token = generateToken({
  user_id: 1,
  email: 'sanjaylade92220@gmail.com',
  role: 'user'
});
const cookie = `trekindia_session=${token}`;

async function req(method, path, body) {
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': cookie
  };
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, raw: text };
  }
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function run() {
  console.log('Testing all 8 AI Ecosystem features end-to-end...\n');

  // 1. TrekVision
  console.log('--- 1. AI TrekVision ---');
  const dummyImg = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const tv = await req('POST', '/api/ai/trekvision/analyze', {
    image: dummyImg,
    mimeType: 'image/png'
  });
  assert(tv.status === 200, `TrekVision returns 200 (Got ${tv.status})`);
  assert(tv.data.success === true, 'TrekVision success flag');
  assert(tv.data.analysis && (tv.data.analysis.identified_peaks || tv.data.analysis.terrain), 'TrekVision contains identified peaks/terrain');
  assert(Array.isArray(tv.data.suggested_treks), 'TrekVision returns suggested treks');

  // 2. Altitude Guardian
  console.log('\n--- 2. AI Altitude Guardian ---');
  const ag = await req('POST', '/api/ai/safety/assess', {
    trek_slug: 'kedarkantha',
    current_altitude: 3800,
    symptoms: ['Mild Headache'],
    acclimatization_days: 1
  });
  assert(ag.status === 200, `Altitude Guardian returns 200 (Got ${ag.status})`);
  assert(ag.data.success === true, 'Altitude Guardian success');
  assert(ag.data.safety_assessment && ag.data.safety_assessment.altitude_zone, `Altitude Guardian zone evaluated: ${ag.data.safety_assessment.altitude_zone}`);
  assert(Array.isArray(ag.data.checklist), 'Altitude Guardian returns preparation checklist');

  // 3. Cost Intelligence
  console.log('\n--- 3. AI Trek Cost Intelligence ---');
  const cost = await req('POST', '/api/ai/cost/estimate', {
    trek_slug: 'kedarkantha',
    starting_city: 'Delhi',
    group_size: 2,
    tier: 'standard'
  });
  assert(cost.status === 200, `Cost Intelligence returns 200 (Got ${cost.status})`);
  assert(cost.data.success === true, 'Cost Intelligence success');
  assert(cost.data.tier_comparison && cost.data.tier_comparison.standard, 'Cost Intelligence returns tier_comparison');
  assert(cost.data.tier_comparison.standard.per_person_inr > 0, `Standard per person cost is non-zero (₹${cost.data.tier_comparison.standard.per_person_inr})`);
  assert(cost.data.active_plan && cost.data.active_plan.components.length > 0, `Cost breakdown has ${cost.data.active_plan.components.length} category items`);

  // 4. Memory Map
  console.log('\n--- 4. AI Trek Memory Map ---');
  const memMapBefore = await req('GET', '/api/users/me/adventure-map');
  assert(memMapBefore.status === 200, `Adventure map returns 200 (Got ${memMapBefore.status})`);
  assert(memMapBefore.data.success === true, 'Adventure map success');
  assert(memMapBefore.data.statistics !== undefined, 'Adventure map returns statistics');

  // Add memory
  const addMem = await req('POST', '/api/treks/slug/kedarkantha/memories', {
    title: 'Kedarkantha Winter Summit',
    completed_at: '2026-05-15',
    notes: 'Incredible sunrise at Kedarkantha summit in fresh snow!',
    altitude_m: 3800,
    visibility: 'public'
  });
  assert(addMem.status === 201, `Add memory returns 201 (Got ${addMem.status})`);
  const createdMemoryId = addMem.data.memory.memory_id;
  assert(createdMemoryId, `Memory created with ID: ${createdMemoryId}`);

  // Fetch memories for trek
  const getMems = await req('GET', '/api/treks/slug/kedarkantha/memories');
  assert(getMems.status === 200, 'Get memories returns 200');
  assert(getMems.data.memories.some(m => m.memory_id == createdMemoryId), 'Newly created memory is present');

  // Delete test memory
  const delMem = await req('DELETE', `/api/treks/slug/kedarkantha/memories/${createdMemoryId}`);
  assert(delMem.status === 200, 'Delete memory returns 200');

  // 5. Offline Companion
  console.log('\n--- 5. AI Offline Trek Companion ---');
  const pkg = await req('GET', '/api/offline/treks/kedarkantha/package');
  assert(pkg.status === 200, `Get offline package returns 200 (Got ${pkg.status})`);
  assert(pkg.data.success === true, 'Offline package success');
  assert(pkg.data.package && pkg.data.package.trek, 'Offline package contains trek information');
  assert(pkg.data.checksum, `Offline package contains SHA-256 checksum (${pkg.data.checksum.slice(0, 10)}...)`);

  // 6. Emergency SOS Intelligence
  console.log('\n--- 6. AI Emergency SOS Intelligence ---');
  // Add trusted contact
  const addContact = await req('POST', '/api/sos/contacts', {
    name: 'Emergency Contact Test',
    phone: '+919876543210',
    email: 'contact@example.com',
    relationship: 'Family'
  });
  assert(addContact.status === 201, `Add SOS contact returns 201 (Got ${addContact.status})`);
  const contactId = addContact.data.contact.contact_id;

  // Report incident
  const sos = await req('POST', '/api/sos/incidents', {
    trek_slug: 'kedarkantha',
    incident_type: 'medical',
    severity: 'high',
    description: 'Trekker feeling altitude fatigue and hypothermia warning signs',
    latitude: 31.025,
    longitude: 78.172,
    location_accuracy_m: 10
  });
  assert(sos.status === 201, `Report SOS returns 201 (Got ${sos.status})`);
  assert(sos.data.incident_id, `Incident created with ID: ${sos.data.incident_id}`);
  assert(sos.data.first_aid_guidance, 'First aid protocol returned');

  // Clean up contact
  const delContact = await req('DELETE', `/api/sos/contacts/${contactId}`);
  assert(delContact.status === 200, 'Delete SOS contact returns 200');

  // 7. Photo-to-Trek Discovery
  console.log('\n--- 7. AI Photo-to-Trek Discovery ---');
  const pd = await req('POST', '/api/ai/photo-discovery/search', {
    image: dummyImg,
    mimeType: 'image/png',
    min_similarity: 0.1
  });
  assert(pd.status === 200, `Photo Discovery returns 200 (Got ${pd.status})`);
  assert(pd.data.success === true, 'Photo Discovery success');
  assert(Array.isArray(pd.data.treks), 'Photo Discovery returns treks array');
  assert(pd.data.treks.length > 0, `Photo Discovery returned ${pd.data.treks.length} visually matched treks`);

  // 8. Nutrition Planner
  console.log('\n--- 8. AI Trek Nutrition Planner ---');
  const nut = await req('POST', '/api/ai/nutrition/plan', {
    trek_slug: 'kedarkantha',
    duration_days: 4,
    diet_type: 'Vegetarian',
    activity_intensity: 'High',
    facilities: 'campsite_kitchen',
    food_carrying_style: 'lightweight_pack'
  });
  assert(nut.status === 200, `Nutrition plan returns 200 (Got ${nut.status})`);
  assert(nut.data.success === true, 'Nutrition plan success');
  assert(nut.data.nutrition_plan && Array.isArray(nut.data.nutrition_plan.daily_meals), 'Nutrition plan returns daily_meals');
  assert(nut.data.nutrition_plan.daily_meals.length > 0, `Returned ${nut.data.nutrition_plan.daily_meals.length} day meal plan`);

  // Get user plans
  const myPlans = await req('GET', '/api/ai/nutrition/my-plans');
  assert(myPlans.status === 200, 'Get my plans returns 200');
  assert(Array.isArray(myPlans.data.plans), 'My plans returns plans array');
  assert(myPlans.data.plans.length > 0, `User has ${myPlans.data.plans.length} saved plans`);

  console.log('\n======================================================');
  console.log('🎉 ALL 8 AI ECOSYSTEM FEATURES VERIFIED END-TO-END! 🎉');
  console.log('======================================================\n');
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
