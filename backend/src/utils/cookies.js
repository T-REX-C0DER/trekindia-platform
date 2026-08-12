import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'trekindia_session';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Generate a signed JWT token for user session
 */
export function generateToken(user) {
  const secret = process.env.SESSION_SECRET || 'fallback_secret_key';
  return jwt.sign(
    {
      user_id: user.user_id,
      email: user.email,
      role: user.role
    },
    secret,
    { expiresIn: '7d' }
  );
}

/**
 * Verify JWT token
 */
export function verifyToken(token) {
  const secret = process.env.SESSION_SECRET || 'fallback_secret_key';
  try {
    return jwt.verify(token, secret);
  } catch (err) {
    return null;
  }
}

/**
 * Set secure HttpOnly cookie on response
 */
export function setAuthCookie(res, token) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: SEVEN_DAYS_MS,
    path: '/'
  });
}

/**
 * Clear authentication cookie
 */
export function clearAuthCookie(res) {
  const isProduction = process.env.NODE_ENV === 'production';

  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/'
  });
}

export { COOKIE_NAME };
