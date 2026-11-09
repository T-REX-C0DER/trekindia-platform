/**
 * Run AI Ecosystem Migration 007 — creates all AI tables
 */
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'trekindia',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check existing tables
const check = await pool.query(`
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema='public' 
  AND table_name IN ('ai_image_analysis','trek_visual_embeddings','sos_incidents','nutrition_plans','trek_cost_estimates','trek_memories','offline_downloads','sos_contacts')
  ORDER BY table_name
`);
console.log('Existing AI tables:', check.rows.map(x => x.table_name).join(', ') || 'NONE');

const fn = await pool.query(`
  SELECT routine_name FROM information_schema.routines 
  WHERE routine_schema='public' AND routine_name='cosine_similarity'
`);
console.log('cosine_similarity function:', fn.rows.length > 0 ? 'EXISTS ✅' : 'MISSING ❌');

// Run migration if tables are missing
if (check.rows.length < 8) {
  console.log('\nRunning migration 007...');
  const migrationPath = path.resolve(__dirname, '../backend/src/migrations/007_create_ai_ecosystem_tables.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error('Migration file not found:', migrationPath);
    process.exit(1);
  }
  
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  try {
    await pool.query(sql);
    console.log('✅ Migration 007 applied successfully');
    
    // Verify
    const verify = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema='public' 
      AND table_name IN ('ai_image_analysis','trek_visual_embeddings','sos_incidents','nutrition_plans','trek_cost_estimates','trek_memories','offline_downloads','sos_contacts')
      ORDER BY table_name
    `);
    console.log('Tables created:', verify.rows.map(x => x.table_name).join(', '));
  } catch (err) {
    console.error('Migration error:', err.message);
    // Try splitting by semicolons and running each statement
    const statements = sql.split(/;\s*\n/).filter(s => s.trim().length > 0);
    console.log(`Attempting ${statements.length} individual statements...`);
    let success = 0, failed = 0;
    for (const stmt of statements) {
      try {
        await pool.query(stmt);
        success++;
      } catch (e) {
        if (!e.message.includes('already exists') && !e.message.includes('duplicate')) {
          console.warn(`  WARN (${e.message.slice(0, 60)})`);
          failed++;
        } else {
          success++; // already exists = fine
        }
      }
    }
    console.log(`Statements: ${success} OK, ${failed} failed`);
  }
} else {
  console.log('All AI tables already exist ✅');
}

await pool.end();

