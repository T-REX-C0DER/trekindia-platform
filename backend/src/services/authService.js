import argon2 from 'argon2';
import { query, getClient } from '../config/database.js';

/**
 * Register a new user using PostgreSQL Transaction
 */
export async function registerUser({ full_name, username, email, password }) {
  // Check duplicates
  const existingCheck = await query(
    `SELECT email, username FROM users WHERE email = $1 OR username = $2 LIMIT 1`,
    [email, username]
  );

  if (existingCheck.rows.length > 0) {
    const existing = existingCheck.rows[0];
    if (existing.email.toLowerCase() === email.toLowerCase()) {
      const err = new Error('An account with this email already exists.');
      err.statusCode = 409;
      throw err;
    }
    if (existing.username.toLowerCase() === username.toLowerCase()) {
      const err = new Error('An account with this username already exists.');
      err.statusCode = 409;
      throw err;
    }
  }

  // Hash password with Argon2id
  // Recommended parameters for standard web security: Argon2id algorithm, 64MB memory, 3 iterations
  const password_hash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64 MB
    timeCost: 3,
    parallelism: 1
  });

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 1. Insert into users
    const userInsertResult = await client.query(
      `INSERT INTO users (full_name, username, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'user')
       RETURNING user_id, username, email, full_name, profile_image, bio, state, city, is_verified, role, created_at`,
      [full_name, username, email, password_hash]
    );

    const newUser = userInsertResult.rows[0];

    // 2. Insert into user_profiles
    await client.query(
      `INSERT INTO user_profiles (user_id) VALUES ($1)`,
      [newUser.user_id]
    );

    // 3. Insert into user_settings
    await client.query(
      `INSERT INTO user_settings (user_id) VALUES ($1)`,
      [newUser.user_id]
    );

    await client.query('COMMIT');
    return newUser;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Authenticate user by email & password
 */
export async function loginUser({ email, password }) {
  const result = await query(
    `SELECT user_id, username, email, password_hash, full_name, profile_image, bio, state, city, is_verified, role, created_at
     FROM users WHERE email = $1`,
    [email]
  );

  if (result.rows.length === 0) {
    const err = new Error('Invalid email or password.');
    err.statusCode = 401;
    throw err;
  }

  const user = result.rows[0];

  // Verify Argon2id password hash
  const isValidPassword = await argon2.verify(user.password_hash, password);
  if (!isValidPassword) {
    const err = new Error('Invalid email or password.');
    err.statusCode = 401;
    throw err;
  }

  // Update last_login timestamp
  await query(
    `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1`,
    [user.user_id]
  );

  // Exclude password_hash from return payload
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

/**
 * Fetch safe user details by ID
 */
export async function getUserById(userId) {
  const result = await query(
    `SELECT user_id, username, email, full_name, profile_image, bio, state, city, is_verified, role, created_at, last_login
     FROM users WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}
