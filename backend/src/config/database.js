import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'trekindia',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 20, // Maximum pool connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

const pool = new Pool(poolConfig);

// Log unexpected pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

/**
 * Execute a single query using the pool
 * @param {string} text - SQL Query String (parameterized)
 * @param {Array} params - Query Parameters
 */
export const query = (text, params) => pool.query(text, params);

/**
 * Acquire a client from pool for transactions (BEGIN, COMMIT, ROLLBACK)
 * Must release client when done via client.release()
 */
export const getClient = () => pool.connect();

export default pool;
