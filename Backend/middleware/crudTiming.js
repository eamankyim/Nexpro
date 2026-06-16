const { DEFAULT_SLOW_HOT_PATH_MS, logTimedOperation } = require('../utils/performanceLogger');

const DEFAULT_EVENT = 'crud_action';

/**
 * Times a controller action without logging request bodies or sensitive payloads.
 * Slow actions are recorded by performanceLogger and surfaced in admin health.
 */
const timeCrudAction = (label, options = {}) => {
  const {
    event = DEFAULT_EVENT,
    thresholdMs = DEFAULT_SLOW_HOT_PATH_MS,
    details = {},
  } = options;

  return (req, res, next) => {
    req.__hasCrudTiming = true;
    const start = process.hrtime.bigint();

    res.once('finish', () => {
      const durationMs = Number((process.hrtime.bigint() - start) / 1000000n);
      const cacheDetails = req.__cacheKey
        ? {
          cacheHit: req.__cacheHit === true,
          cacheKey: req.__cacheKey,
          cacheLabel: req.__cacheLabel || null,
        }
        : {};
      logTimedOperation(label, {
        req,
        durationMs,
        thresholdMs,
        statusCode: res.statusCode,
        event,
        details: {
          ...cacheDetails,
          ...details,
        },
      });
    });

    next();
  };
};

module.exports = {
  timeCrudAction,
};
