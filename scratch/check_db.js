import { query } from '../backend/src/config/database.js';

async function main() {
  const tables = ['treks', 'user_treks', 'badges', 'user_badges', 'user_activities', 'user_profiles', 'users'];
  for (const table of tables) {
    const res = await query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `, [table]);
    console.log(`\n=== Table: ${table} ===`);
    console.table(res.rows);
  }

  const sampleTreks = await query(`SELECT trek_id, trek_name, slug, distance_km, elevation_m, duration_hours, duration_label, state_id FROM treks LIMIT 5`);
  console.log('\n=== Sample Treks ===');
  console.table(sampleTreks.rows);

  const sampleBadges = await query(`SELECT * FROM badges`);
  console.log('\n=== Existing Badges ===');
  console.table(sampleBadges.rows);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
