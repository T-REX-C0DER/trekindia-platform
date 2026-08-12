import { verifyToken, COOKIE_NAME } from '../utils/cookies.js';

/**
 * Authentication middleware that extracts & validates session token from HttpOnly cookie
 */
export function authMiddleware(req, res, next) {
  const token = req.cookies ? req.cookies[COOKIE_NAME] : null;

  if (!token) {
    req.user = null;
    return next();
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    req.user = null;
    return next();
  }

  req.user = decoded;
  next();
}

/**
 * Middleware requiring active authentication
 */
export function requireAuth(req, res, next) {
  authMiddleware(req, res, () => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        message: 'Unauthorized access. Please log in to continue.'
      });
    }
    next();
  });
}

/**
 * Role authorization middleware builder
 * Usage: requireRole('admin') or requireRole('admin', 'guide')
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden. You do not have permission to perform this action.'
        });
      }
      next();
    });
  };
}
