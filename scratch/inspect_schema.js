import { query } from '../backend/src/config/database.js';

async function inspect() {
  const tables = ['treks', 'users', 'user_profiles', 'trek_locations', 'trek_images', 'states', 'districts', 'user_treks', 'badges', 'user_badges'];
  for (const t of tables) {
    const res = await query(
      "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position",
      [t]
    );
    console.log(`\n== Table: ${t} (${res.rows.length} columns) ==`);
    console.log(res.rows.map(r => `${r.column_name}: ${r.data_type}`).join('\n'));
  }

  // Also check trek counts and image counts
  const trekCount = await query("SELECT count(*) FROM treks");
  const imgCount = await query("SELECT count(*) FROM trek_images");
  const userCount = await query("SELECT count(*) FROM users");
  console.log(`\nCounts: treks=${trekCount.rows[0].count}, trek_images=${imgCount.rows[0].count}, users=${userCount.rows[0].count}`);

  // Sample trek record
  const sampleTrek = await query("SELECT * FROM treks LIMIT 1");
  console.log('\nSample Trek columns:', Object.keys(sampleTrek.rows[0] || {}));
  console.log('Sample Trek:', JSON.stringify(sampleTrek.rows[0], null, 2));

  // Check PostGIS extensions
  const extRes = await query("SELECT extname, extversion FROM pg_extension WHERE extname IN ('postgis', 'vector')");
  console.log('\nExtensions:', extRes.rows);

  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});

