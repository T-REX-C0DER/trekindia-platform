import { query } from '../backend/src/config/database.js';

async function main() {
  const slugs = ["roopkund", "valley-of-flowers", "pin-parvati", "kedarkantha", "kalsubai", "kudremukh", "hampta-pass", "har-ki-dun", "sandakphu-phalut"];
  for (const s of slugs) {
    const res = await query("SELECT trek_id, slug, trek_name FROM treks WHERE slug ILIKE $1 OR trek_name ILIKE $1 LIMIT 1", [`%${s}%`]);
    if (res.rows.length > 0) {
      console.log(`${s} => id: ${res.rows[0].trek_id}, name: ${res.rows[0].trek_name}, slug: ${res.rows[0].slug}`);
    } else {
      console.log(`${s} => NOT FOUND`);
    }
  }
  process.exit(0);
}

main().catch(console.error);
