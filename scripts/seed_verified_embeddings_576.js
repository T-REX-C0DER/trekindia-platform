import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { query, getClient } from '../backend/src/config/database.js';
import { updateTrekVisualKnowledge } from '../backend/src/services/visualIntelligenceService.js';

const REFERENCE_MAPPINGS = [
  {
    trekId: 204, // Roopkund
    imageFile: 'trek_roopkund_1784286741949.png',
    tags: ['Glacial Alpine Lake', 'Snow Ridge', 'High Himalayan Pass', 'Mystery Lake']
  },
  {
    trekId: 205, // Valley of Flowers
    imageFile: 'trek_valley_flowers_1784286752079.png',
    tags: ['Alpine Wildflower Meadow', 'UNESCO Biosphere', 'Pushpawati River Basin', 'Monsoon Bloom']
  },
  {
    trekId: 175, // Pin Parvati Pass
    imageFile: 'trek_pin_parvati_1784286774167.png',
    tags: ['Trans-Himalayan Pass', 'Glacial Moraine', 'Spiti Cold Desert', 'High Scree']
  },
  {
    trekId: 199, // Kedarkantha
    imageFile: 'Nature.jpg',
    tags: ['Snow Summit', 'Pine Forest', 'Juda Ka Talab', 'Garhwal Himalayas']
  },
  {
    trekId: 650, // Kalsubai
    imageFile: 'why_trekindia_1784286784839.png',
    tags: ['Sahyadri Basalt Peak', 'Everest of Maharashtra', 'Monsoon Mist', 'Rocky Ladders']
  },
  {
    trekId: 4, // Kudremukh
    imageFile: 'community_gallery_1_1784286796919.png',
    tags: ['Western Ghats', 'Rolling Green Grasslands', 'Shola Forest', 'Horse Face Peak']
  },
  {
    trekId: 177, // Hampta Pass
    imageFile: 'auth_bg.jpg',
    tags: ['Crossover Trek', 'Lush Kullu Valley', 'Barren Spiti Moonscape', 'Glacial Stream']
  }
];

function extractVectorWithPython(imagePath) {
  const fileBytes = fs.readFileSync(imagePath);
  const base64 = fileBytes.toString('base64');
  
  const pyProcess = spawnSync('python', ['-m', 'backend.python_ai.cli'], {
    input: base64,
    encoding: 'utf-8',
    timeout: 30000,
    maxBuffer: 20 * 1024 * 1024
  });

  if (pyProcess.status !== 0 || !pyProcess.stdout) {
    throw new Error(`Python CLI failed: ${pyProcess.stderr || 'No output'}`);
  }

  const stdoutText = (pyProcess.stdout || '').trim();
  const jsonStart = stdoutText.indexOf('{');
  if (jsonStart === -1) {
    throw new Error(`No JSON found in Python output: ${stdoutText}`);
  }
  const cleanJson = stdoutText.slice(jsonStart);
  const result = JSON.parse(cleanJson);
  if (!result.success || !Array.isArray(result.vector)) {
    throw new Error(`Invalid output from Python CLI: ${JSON.stringify(result)}`);
  }

  return result;
}

async function run() {
  console.log('--- Step 1: Cleaning obsolete 32-dim/64-dim embeddings from DB ---');
  await query('DELETE FROM trek_visual_embeddings');
  await query('DELETE FROM trek_image_embeddings');
  await query('DELETE FROM trek_visual_knowledge');
  console.log('✅ DB tables cleared.');

  console.log('--- Step 2: Extracting real 576-dim PyTorch embeddings for verified references ---');
  for (const ref of REFERENCE_MAPPINGS) {
    const fullPath = path.resolve(ref.imageFile);
    if (!fs.existsSync(fullPath)) {
      console.warn(`File not found: ${ref.imageFile}, skipping.`);
      continue;
    }

    console.log(`Processing ${ref.imageFile} for trek ID ${ref.trekId}...`);
    const feat = extractVectorWithPython(fullPath);
    console.log(`  Extracted ${feat.dimensions}-dim vector (${feat.dominant_features.join(', ')})`);

    // Insert into trek_image_embeddings
    await query(
      `INSERT INTO trek_image_embeddings (
         trek_id, image_url, image_hash, embedding, dimensions,
         model_name, model_version, confidence_score, source_type, source_reliability, verification_status, is_active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0.95, 'official_catalog', 0.95, 'verified', TRUE)`,
      [
        ref.trekId,
        ref.imageFile,
        feat.hash,
        feat.vector,
        feat.dimensions,
        feat.model_name,
        feat.model_version
      ]
    );

    // Insert into trek_visual_embeddings for backwards compatibility
    await query(
      `INSERT INTO trek_visual_embeddings (trek_id, image_url, embedding, feature_tags)
       VALUES ($1, $2, $3, $4)`,
      [
        ref.trekId,
        ref.imageFile,
        feat.vector,
        feat.dominant_features
      ]
    );

    // Update trek visual knowledge
    await updateTrekVisualKnowledge(ref.trekId);
    console.log(`  Updated trek visual knowledge for trek ID ${ref.trekId}.`);
  }

  const check = await query('SELECT count(*) AS total_embeddings, count(DISTINCT trek_id) AS distinct_treks FROM trek_image_embeddings');
  console.log(`✅ Success! Seeded ${check.rows[0].total_embeddings} verified 576-dim embeddings across ${check.rows[0].distinct_treks} treks.`);
  process.exit(0);
}

run().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
