import { runMigrations } from '../backend/src/config/initDb.js';
import { query } from '../backend/src/config/database.js';

async function test() {
  console.log('Running migrations...');
  await runMigrations();

  const trekBadgeCount = await query(`SELECT COUNT(*) FROM badges WHERE trek_id IS NOT NULL`);
  console.log(`Trek badges in database: ${trekBadgeCount.rows[0].count}`);

  const dzukouBadge = await query(`
    SELECT b.*, t.trek_name 
    FROM badges b 
    JOIN treks t ON b.trek_id = t.trek_id 
    WHERE t.slug = 'dzukou-valley-trek'
  `);
  console.log('Dzükou Valley Trek Badge:');
  console.table(dzukouBadge.rows);

  process.exit(0);
}

test().catch(e => {
  console.error(e);
  process.exit(1);
});
