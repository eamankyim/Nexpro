/**
 * Logs slow API requests in development to help identify bottlenecks.
 * Only logs when request takes longer than threshold (default 1s).
 */
const SLOW_MS = parseInt(process.env.SLOW_REQUEST_MS, 10) || 1000;
const isDev = process.env.NODE_ENV === 'development';

module.exports = function requestTiming(req, res, next) {
  if (!isDev) return next();
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration >= SLOW_MS) {
      console.log(`[Timing] ${duration}ms ${req.method} ${req.originalUrl || req.url}`);
    }
  });
  next();
};
