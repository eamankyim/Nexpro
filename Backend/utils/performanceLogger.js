const DEFAULT_SLOW_HOT_PATH_MS = Math.max(
  100,
  Number.parseInt(process.env.SLOW_HOT_PATH_MS || process.env.SLOW_REQUEST_MS || '750', 10) || 750
);

const hotPathLoggingEnabled = process.env.DISABLE_HOT_PATH_LOGS !== 'true';
const MAX_RECENT_SLOW_OPERATIONS = Math.max(
  10,
  Number.parseInt(process.env.RECENT_SLOW_OPERATIONS_LIMIT || '100', 10) || 100
);

const recentSlowOperations = [];

const getRequestPath = (req) => req?.originalUrl || req?.url || req?.path || '';

const recordSlowOperation = (entry) => {
  recentSlowOperations.unshift({
    ...entry,
    recordedAt: new Date().toISOString(),
  });
  if (recentSlowOperations.length > MAX_RECENT_SLOW_OPERATIONS) {
    recentSlowOperations.length = MAX_RECENT_SLOW_OPERATIONS;
  }
};

const getRecentSlowOperations = (limit = 50) => {
  const safeLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 50, MAX_RECENT_SLOW_OPERATIONS));
  const operations = recentSlowOperations.slice(0, safeLimit);
  const hotPaths = Array.from(
    operations.reduce((acc, operation) => {
      const key = [
        operation.label || 'unknown',
        operation.method || 'ANY',
        operation.path || '',
      ].join('|');
      const current = acc.get(key) || {
        label: operation.label || 'unknown',
        method: operation.method || null,
        path: operation.path || '',
        count: 0,
        totalDurationMs: 0,
        maxDurationMs: 0,
        lastSeenAt: operation.recordedAt,
      };
      current.count += 1;
      current.totalDurationMs += operation.durationMs || 0;
      current.maxDurationMs = Math.max(current.maxDurationMs, operation.durationMs || 0);
      current.lastSeenAt = current.lastSeenAt > operation.recordedAt ? current.lastSeenAt : operation.recordedAt;
      acc.set(key, current);
      return acc;
    }, new Map()).values()
  )
    .map((item) => ({
      ...item,
      avgDurationMs: Math.round(item.totalDurationMs / item.count),
    }))
    .sort((a, b) => b.maxDurationMs - a.maxDurationMs)
    .slice(0, 10);

  return {
    thresholdMs: DEFAULT_SLOW_HOT_PATH_MS,
    limit: safeLimit,
    operations,
    hotPaths,
  };
};

const startHotPathTimer = (label, req = null, thresholdMs = DEFAULT_SLOW_HOT_PATH_MS) => {
  if (!hotPathLoggingEnabled) {
    return () => {};
  }

  const start = process.hrtime.bigint();
  return (details = {}) => {
    const durationMs = Number((process.hrtime.bigint() - start) / 1000000n);
    if (durationMs < thresholdMs) return durationMs;

    const entry = {
      label,
      durationMs,
      method: req?.method || null,
      path: getRequestPath(req),
      tenantId: req?.tenantId || null,
      userId: req?.user?.id || null,
      ...details,
    };
    recordSlowOperation(entry);
    console.warn('[Perf] slow_hot_path', entry);
    return durationMs;
  };
};

module.exports = {
  DEFAULT_SLOW_HOT_PATH_MS,
  getRecentSlowOperations,
  startHotPathTimer,
};
