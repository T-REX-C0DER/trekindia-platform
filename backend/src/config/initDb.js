import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  try {
    const migrationPath = path.resolve(__dirname, '../migrations/001_create_profile_tables.sql');
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await query(sql);
      console.log('✅ PostgreSQL migrations executed successfully.');
    }
  } catch (err) {
    console.error('❌ Migration Error:', err.message);
  }
}
