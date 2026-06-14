const DEFAULT_SLOW_HOT_PATH_MS = Math.max(
  100,
  Number.parseInt(process.env.SLOW_HOT_PATH_MS || process.env.SLOW_REQUEST_MS || '750', 10) || 750
);

const hotPathLoggingEnabled = process.env.DISABLE_HOT_PATH_LOGS !== 'true';

const getRequestPath = (req) => req?.originalUrl || req?.url || req?.path || '';

const startHotPathTimer = (label, req = null, thresholdMs = DEFAULT_SLOW_HOT_PATH_MS) => {
  if (!hotPathLoggingEnabled) {
    return () => {};
  }

  const start = process.hrtime.bigint();
  return (details = {}) => {
    const durationMs = Number((process.hrtime.bigint() - start) / 1000000n);
    if (durationMs < thresholdMs) return durationMs;

    console.warn('[Perf] slow_hot_path', {
      label,
      durationMs,
      method: req?.method || null,
      path: getRequestPath(req),
      tenantId: req?.tenantId || null,
      userId: req?.user?.id || null,
      ...details,
    });
    return durationMs;
  };
};

module.exports = {
  DEFAULT_SLOW_HOT_PATH_MS,
  startHotPathTimer,
};
