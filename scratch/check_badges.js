import { query } from '../backend/src/config/database.js';

async function main() {
  const trekBadges = await query('SELECT COUNT(*) FROM badges WHERE trek_id IS NOT NULL');
  const milestoneBadges = await query('SELECT COUNT(*) FROM badges WHERE trek_id IS NULL');
  const cols = await query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'badges' ORDER BY ordinal_position`);
  
  console.log('Trek badges in DB:', trekBadges.rows[0].count);
  console.log('Milestone badges in DB:', milestoneBadges.rows[0].count);
  console.log('Badge columns:', cols.rows.map(c => c.column_name).join(', '));

  // Check user_treks status
  const userTreks = await query(`SELECT status, COUNT(*) FROM user_treks GROUP BY status`);
  console.log('\nuser_treks status counts:');
  console.table(userTreks.rows);

  // Check user_badges
  const userBadges = await query(`SELECT COUNT(*) FROM user_badges`);
  console.log('\nTotal user_badges:', userBadges.rows[0].count);

  // Check user_activities
  const userActs = await query(`SELECT type, COUNT(*) FROM user_activities GROUP BY type`);
  console.log('\nuser_activities types:');
  console.table(userActs.rows);
  
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
