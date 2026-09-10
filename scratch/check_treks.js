import { query } from '../backend/src/config/database.js';

async function main() {
  const treksCols = await query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'treks' 
    ORDER BY ordinal_position
  `);
  console.log('=== treks columns ===');
  console.table(treksCols.rows);

  const userTreksCols = await query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'user_treks' 
    ORDER BY ordinal_position
  `);
  console.log('=== user_treks columns ===');
  console.table(userTreksCols.rows);

  const dzukou = await query(`
    SELECT t.trek_id, t.trek_name, t.slug, t.distance_km, t.elevation_m, t.highest_point_m, t.duration_hours, t.duration_label, s.state_name
    FROM treks t
    LEFT JOIN states s ON t.state_id = s.state_id
    WHERE t.trek_name ILIKE '%dzukou%' OR t.slug ILIKE '%dzukou%'
  `);
  console.log('=== Dzukou trek info ===');
  console.table(dzukou.rows);

  const totalTreks = await query(`SELECT COUNT(*) FROM treks`);
  console.log('Total treks in DB:', totalTreks.rows[0].count);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
