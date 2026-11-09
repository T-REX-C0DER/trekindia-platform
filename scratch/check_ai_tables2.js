import pool from '../backend/src/config/db.js';

const r = await pool.query(`
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema='public' 
  AND table_name IN ('ai_image_analysis','trek_visual_embeddings','sos_incidents','nutrition_plans','trek_cost_estimates','trek_memories','offline_downloads','sos_contacts')
  ORDER BY table_name
`);
console.log('Existing AI tables:', r.rows.map(x => x.table_name));

const fn = await pool.query(`
  SELECT routine_name FROM information_schema.routines 
  WHERE routine_schema='public' AND routine_name='cosine_similarity'
`);
console.log('cosine_similarity function:', fn.rows.length > 0 ? 'EXISTS' : 'MISSING');

await pool.end();

