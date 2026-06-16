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
const REQUEST_TIMING_LOGGED_KEY = '__perfTimingLogged';
const REQUEST_HAS_HOT_PATH_TIMER_KEY = '__hasHotPathTiming';

const getRequestPath = (req) => req?.originalUrl || req?.url || req?.path || '';
const toDurationSeconds = (durationMs) => Number((durationMs / 1000).toFixed(3));

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

const buildOperationEntry = ({
  label,
  req = null,
  durationMs,
  thresholdMs = DEFAULT_SLOW_HOT_PATH_MS,
  statusCode = null,
  event = 'timed_operation',
  details = {},
}) => {
  const safeDurationMs = Math.max(0, Number(durationMs) || 0);
  const classification = safeDurationMs >= thresholdMs ? 'slow' : 'normal';

  return {
    event,
    label,
    classification,
    durationMs: safeDurationMs,
    durationSeconds: toDurationSeconds(safeDurationMs),
    thresholdMs,
    method: req?.method || null,
    path: getRequestPath(req),
    statusCode,
    tenantId: req?.tenantId || req?.tenant?.id || null,
    userId: req?.user?.id || null,
    ...details,
  };
};

const logTimedOperation = (label, {
  req = null,
  durationMs,
  thresholdMs = DEFAULT_SLOW_HOT_PATH_MS,
  statusCode = null,
  event = 'timed_operation',
  details = {},
  skipIfRequestLogged = false,
} = {}) => {
  if (!hotPathLoggingEnabled) return null;
  if (skipIfRequestLogged && req?.[REQUEST_TIMING_LOGGED_KEY]) return null;

  const entry = buildOperationEntry({
    label,
    req,
    durationMs,
    thresholdMs,
    statusCode,
    event,
    details,
  });

  if (req) {
    req[REQUEST_TIMING_LOGGED_KEY] = true;
  }

  if (entry.classification === 'slow') {
    recordSlowOperation(entry);
    console.warn('[Perf] slow_timed_operation', entry);
    return entry;
  }

  console.info('[Perf] timed_operation', entry);
  return entry;
};

const startHotPathTimer = (label, req = null, thresholdMs = DEFAULT_SLOW_HOT_PATH_MS) => {
  if (!hotPathLoggingEnabled) {
    return () => {};
  }

  if (req) {
    req[REQUEST_HAS_HOT_PATH_TIMER_KEY] = true;
  }

  const start = process.hrtime.bigint();
  return (details = {}) => {
    const durationMs = Number((process.hrtime.bigint() - start) / 1000000n);
    const safeDetails = details && typeof details === 'object' ? details : {};
    const normalizedDetails = {
      ...safeDetails,
      ...(typeof safeDetails.cached === 'boolean' && safeDetails.cacheHit == null
        ? { cacheHit: safeDetails.cached }
        : {}),
    };
    logTimedOperation(label, {
      req,
      durationMs,
      thresholdMs,
      event: normalizedDetails.event || 'timed_operation',
      details: normalizedDetails,
      skipIfRequestLogged: true,
    });
    return durationMs;
  };
};

module.exports = {
  DEFAULT_SLOW_HOT_PATH_MS,
  buildOperationEntry,
  getRecentSlowOperations,
  logTimedOperation,
  REQUEST_HAS_HOT_PATH_TIMER_KEY,
  REQUEST_TIMING_LOGGED_KEY,
  startHotPathTimer,
  toDurationSeconds,
};
