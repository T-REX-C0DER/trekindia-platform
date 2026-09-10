import { query } from '../backend/src/config/database.js';

async function main() {
  const sample = await query(`
    SELECT DISTINCT duration_label, duration_hours 
    FROM treks 
    ORDER BY duration_label 
    LIMIT 30
  `);
  console.table(sample.rows);

  const nullLabels = await query(`
    SELECT COUNT(*) 
    FROM treks 
    WHERE duration_label IS NULL OR duration_label = ''
  `);
  console.log('Treks with null/empty duration_label:', nullLabels.rows[0].count);

  const allTreks = await query(`
    SELECT trek_id, trek_name, duration_hours, duration_label 
    FROM treks 
    WHERE duration_label IS NOT NULL 
    LIMIT 20
  `);
  console.table(allTreks.rows);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
