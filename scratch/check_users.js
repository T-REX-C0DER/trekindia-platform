import { query } from '../backend/src/config/database.js';
const r = await query('SELECT user_id, username, email FROM users LIMIT 5');
console.table(r.rows);
process.exit(0);
