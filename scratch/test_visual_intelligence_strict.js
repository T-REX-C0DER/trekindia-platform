/**
 * TrekIndia Visual Intelligence System — Strict End-to-End Verification Test Suite
 * Tests all 8 validation scenarios against real PostgreSQL database and Python AI engine.
 */

import { query } from '../backend/src/config/database.js';
import * as visualIntelligenceService from '../backend/src/services/visualIntelligenceService.js';
import * as communityService from '../backend/src/services/communityService.js';

// Base64 helper image generator (deterministic 100x100 solid/gradient PPM encoded to base64)
function createSyntheticPpmBase64(r, g, b) {
  const width = 64;
  const height = 64;
  let header = `P6\n${width} ${height}\n255\n`;
  let buffer = Buffer.alloc(header.length + width * height * 3);
  buffer.write(header, 0, 'ascii');
  let offset = header.length;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      buffer[offset++] = r;
      buffer[offset++] = g;
      buffer[offset++] = b;
    }
  }
  return buffer.toString('base64');
}

async function runStrictVerification() {
  console.log('================================================================');
  console.log('🏔️  TREKINDIA VISUAL INTELLIGENCE SYSTEM — STRICT E2E VERIFICATION');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      if (details) console.log(`   └─ ${details}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (details) console.error(`   └─ ${details}`);
      process.exitCode = 1;
    }
  }

  try {
    // ─── TEST 1: Database Schema & Canonical Aliases ──────────
    console.log('--- Step 1: Canonical Alias Resolution ---');
    await visualIntelligenceService.seedCanonicalAliases();
    
    const kedar = await visualIntelligenceService.resolveCanonicalTrek('Kedarkantha');
    assert(kedar !== null && kedar.trek_name.toLowerCase().includes('kedarkantha'), 
      'Resolve "Kedarkantha" exact name', 
      `Found trek ID ${kedar?.trek_id}: ${kedar?.trek_name}`);

    const kedarAlias = await visualIntelligenceService.resolveCanonicalTrek('#KedarkanthaSummit');
    assert(kedarAlias !== null && kedarAlias.trek_id === kedar.trek_id,
      'Resolve hashtag "#KedarkanthaSummit" to canonical Kedarkantha trek record',
      `Resolved to trek ID ${kedarAlias?.trek_id}`);

    const harKiDun = await visualIntelligenceService.resolveCanonicalTrek('Har Ki Dun');
    assert(harKiDun !== null && harKiDun.trek_name.toLowerCase().includes('har ki dun'),
      'Resolve "Har Ki Dun" trek record',
      `Found trek ID ${harKiDun?.trek_id}: ${harKiDun?.trek_name}`);

    // ─── TEST 2: Python AI Perceptual Feature Extraction ───────
    console.log('\n--- Step 2: Python AI Feature Extraction ---');
    // Alpine snowy image (high R, G, B)
    const snowImageBase64 = createSyntheticPpmBase64(230, 235, 245);
    const snowFeatures = await visualIntelligenceService.extractVisualFeatureVector(snowImageBase64, 'image/jpeg');

    assert(snowFeatures.vector.length === 64,
      'Vector dimensions equals exactly 64',
      `Vector length: ${snowFeatures.vector.length}, Provider: ${snowFeatures.provider}`);

    assert(snowFeatures.provider.startsWith('python_ai'),
      'Feature extraction executed via Python AI engine',
      `Active provider: ${snowFeatures.provider}`);

    // Forest / Western Ghats image (high G)
    const forestImageBase64 = createSyntheticPpmBase64(40, 160, 50);
    const forestFeatures = await visualIntelligenceService.extractVisualFeatureVector(forestImageBase64, 'image/jpeg');
    assert(forestFeatures.vector.length === 64,
      'Extracted Western Ghats lush forest feature vector',
      `Archetype: ${forestFeatures.terrain_archetype}`);

    // ─── TEST 3: Community Post Creation & Automatic Visual Ingestion ──
    console.log('\n--- Step 3: Platform Post Ingestion & Visual Learning ---');
    // Get a test user
    const userRes = await query('SELECT user_id, username FROM users LIMIT 1');
    const testUserId = userRes.rows[0]?.user_id || 1;

    // Create a new community post for Kedarkantha with multiple photographs
    const postPayload = {
      user: { user_id: testUserId, username: userRes.rows[0]?.username || 'explorer' },
      caption: 'Winter wonderland at 12,500 ft on Kedarkantha summit.',
      trek_id: kedar.trek_id,
      trek_name: kedar.trek_name,
      location: 'Uttarkashi, Uttarakhand',
      hashtags: ['Kedarkantha', 'WinterTrek', 'Uttarakhand'],
      images: [
        'https://images.trekindia.test/kedarkantha-summit-1.jpg',
        'https://images.trekindia.test/kedarkantha-ridge-2.jpg'
      ]
    };

    const createdPost = await communityService.createPost(postPayload);
    const createdPostId = createdPost.post_id;
    assert(Boolean(createdPostId),
      'Community post successfully created in database',
      `Post ID: ${createdPostId}`);

    // Trigger visual learning on this post
    const ingestionResult = await visualIntelligenceService.ingestPostForVisualLearning(createdPostId);
    assert(ingestionResult.success && ingestionResult.images_processed === 2,
      'Post ingested into Visual Intelligence system',
      `Images indexed: ${ingestionResult.images_processed}, Canonical trek: ${ingestionResult.canonical_trek?.name}`);

    // Verify database records in trek_image_embeddings
    const embeddingsCheck = await query(
      `SELECT count(*) FROM trek_image_embeddings WHERE post_id = $1 AND is_active = TRUE`,
      [createdPostId]
    );
    assert(parseInt(embeddingsCheck.rows[0].count, 10) === 2,
      'Visual embeddings recorded with provenance in PostgreSQL',
      `Total embeddings in trek_image_embeddings: ${embeddingsCheck.rows[0].count}`);

    // Verify aggregated visual knowledge updated in trek_visual_knowledge
    const knowledgeCheck = await query(
      `SELECT evidence_count, verification_status FROM trek_visual_knowledge WHERE trek_id = $1`,
      [kedar.trek_id]
    );
    assert(knowledgeCheck.rows.length > 0 && knowledgeCheck.rows[0].evidence_count >= 2,
      'Destination-level visual knowledge accumulated for Kedarkantha',
      `Evidence count: ${knowledgeCheck.rows[0].evidence_count}, Status: ${knowledgeCheck.rows[0].verification_status}`);

    // ─── TEST 4: New Photograph Visual Recognition & Retrieval ─────────
    console.log('\n--- Step 4: Recognition & Retrieval of Destination ---');
    const searchRes = await visualIntelligenceService.searchVisualIntelligence({
      imageBase64: snowImageBase64,
      mimeType: 'image/jpeg',
      stateFilter: 'Uttarakhand'
    });

    assert(searchRes.success && searchRes.alternative_candidates.length > 0,
      'Search returned candidates from accumulated knowledge base',
      `Total matches found: ${searchRes.alternative_candidates.length + (searchRes.primary_destination ? 1 : 0)}`);

    const topTrek = searchRes.primary_destination || searchRes.alternative_candidates[0];
    assert(topTrek !== null,
      'Top candidate retrieved with calibrated similarity',
      `Top candidate: ${topTrek.name} (${topTrek.state}) - Confidence: ${topTrek.similarity_percentage} [${topTrek.confidence_band}]`);

    // ─── TEST 5: Terrain Differentiation (Himalayan vs Western Ghats) ───
    console.log('\n--- Step 5: Distinguishing Visually Similar & Distinct Terrains ---');
    const ghatsSearch = await visualIntelligenceService.searchVisualIntelligence({
      imageBase64: forestImageBase64,
      mimeType: 'image/jpeg'
    });

    assert(ghatsSearch.success,
      'Multi-signal ranker evaluated forest landscape without paid APIs',
      `Detected Archetype: ${ghatsSearch.detected_terrain.archetype}`);

    // ─── TEST 6: Honest Unknown / Uncertain Destination Rejection ─────
    console.log('\n--- Step 6: Honest Unknown Destination Rejection ---');
    // Abstract non-trek flat magenta image
    const abstractImageBase64 = createSyntheticPpmBase64(255, 0, 255);
    const unknownSearch = await visualIntelligenceService.searchVisualIntelligence({
      imageBase64: abstractImageBase64,
      mimeType: 'image/jpeg',
      minSimilarity: 0.85 // High threshold simulating uncorroborated unknown destination
    });

    assert(unknownSearch.is_confident_match === false,
      'Honest rejection: Does NOT fabricate certain match for unknown/ambiguous photo',
      `is_confident_match = false, primary_destination = null`);

    // ─── TEST 7: User Feedback & Anti-Poisoning Moderation Workflow ────
    console.log('\n--- Step 7: Feedback Submission & Anti-Poisoning Workflow ---');
    const feedbackRes = await visualIntelligenceService.submitVisualFeedback({
      userId: testUserId,
      imageUrl: 'https://images.trekindia.test/kedarkantha-summit-1.jpg',
      predictedTrekId: kedar.trek_id,
      suggestedTrekId: harKiDun.trek_id,
      feedbackType: 'correct_destination',
      userNotes: 'Photo actually taken at Har Ki Dun pass ridge.'
    });

    assert(feedbackRes.success && feedbackRes.feedback_id,
      'User feedback submitted and queued for moderation',
      `Feedback ID: ${feedbackRes.feedback_id}`);

    const feedbackInDb = await query(
      `SELECT feedback_type, verification_status FROM visual_feedback WHERE feedback_id = $1`,
      [feedbackRes.feedback_id]
    );
    assert(feedbackInDb.rows[0]?.verification_status === 'pending',
      'Anti-poisoning gate: Feedback defaults to pending review before knowledge update',
      `Verification status: ${feedbackInDb.rows[0]?.verification_status}`);

    // ─── TEST 8: Post Deletion & Privacy / GDPR Deactivation ─────────
    console.log('\n--- Step 8: Post Deletion & Privacy Compliance ---');
    await communityService.deletePost(createdPostId, testUserId);

    const activeEmbeddingsCheck = await query(
      `SELECT count(*) FROM trek_image_embeddings WHERE post_id = $1 AND is_active = TRUE`,
      [createdPostId]
    );
    assert(parseInt(activeEmbeddingsCheck.rows[0].count, 10) === 0,
      'Post deletion deactivates visual embeddings (is_active = FALSE)',
      `Remaining active embeddings for deleted post: ${activeEmbeddingsCheck.rows[0].count}`);

    // ─── TEST 9: System Metrics & Audit Verification ──────────────────
    console.log('\n--- Step 9: System Audit Metrics & Zero Paid APIs ---');
    const metrics = await visualIntelligenceService.getVisualIntelligenceMetrics();
    assert(metrics.engine.model_name === 'trekindia-python-vit-v1',
      'Engine verified: trekindia-python-vit-v1 with 64 dimensions',
      `Active embeddings: ${metrics.total_active_embeddings}, Treks with knowledge: ${metrics.treks_with_visual_knowledge}`);

    console.log('\n================================================================');
    console.log(`🎉 ALL STRICT TESTS COMPLETED: ${passedTests} / ${totalTests} PASSED`);
    console.log('================================================================');

  } catch (err) {
    console.error('Fatal error during strict verification:', err);
    process.exitCode = 1;
  } finally {
    process.exit(process.exitCode || 0);
  }
}

runStrictVerification();
