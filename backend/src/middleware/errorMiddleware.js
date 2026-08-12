/**
 * Centralized Error Middleware for TrekIndia API
 */
export function errorMiddleware(err, req, res, next) {
  // Safe server side logging
  console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err.message);

  const isProduction = process.env.NODE_ENV === 'production';
  const statusCode = err.statusCode || err.status || 500;

  let message = err.message || 'An internal server error occurred.';

  // Mask database / connection errors in production
  if (isProduction && statusCode === 500) {
    message = 'An unexpected server error occurred. Please try again later.';
  }

  return res.status(statusCode).json({
    success: false,
    message,
    ...(isProduction ? {} : { stack: err.stack })
  });
}
