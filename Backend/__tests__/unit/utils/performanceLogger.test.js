describe('performanceLogger', () => {
  let performanceLogger;

  beforeEach(() => {
    jest.resetModules();
    performanceLogger = require('../../../utils/performanceLogger');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds a sanitized timed operation entry with seconds and request context', () => {
    const entry = performanceLogger.buildOperationEntry({
      label: 'products.create',
      durationMs: 1234,
      thresholdMs: 750,
      statusCode: 201,
      event: 'crud_action',
      req: {
        method: 'POST',
        originalUrl: '/api/products',
        tenantId: 'tenant-1',
        user: { id: 'user-1' },
        body: { password: 'do-not-log' },
      },
    });

    expect(entry).toMatchObject({
      event: 'crud_action',
      label: 'products.create',
      classification: 'slow',
      durationMs: 1234,
      durationSeconds: 1.234,
      thresholdMs: 750,
      method: 'POST',
      path: '/api/products',
      statusCode: 201,
      tenantId: 'tenant-1',
      userId: 'user-1',
    });
    expect(entry).not.toHaveProperty('body');
    expect(entry).not.toHaveProperty('password');
  });

  it('logs normal timed operations without adding them to the slow operations buffer', () => {
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const entry = performanceLogger.logTimedOperation('customers.list', {
      durationMs: 25,
      thresholdMs: 100,
      statusCode: 200,
      req: { method: 'GET', originalUrl: '/api/customers' },
      event: 'crud_action',
    });

    expect(entry.classification).toBe('normal');
    expect(infoSpy).toHaveBeenCalledWith('[Perf] timed_operation', expect.objectContaining({
      label: 'customers.list',
      durationSeconds: 0.025,
      classification: 'normal',
    }));
    expect(warnSpy).not.toHaveBeenCalled();
    expect(performanceLogger.getRecentSlowOperations().operations).toHaveLength(0);
  });

  it('records slow timed operations for the admin health performance view', () => {
    jest.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const entry = performanceLogger.logTimedOperation('sales.create', {
      durationMs: 1500,
      thresholdMs: 100,
      statusCode: 201,
      req: {
        method: 'POST',
        originalUrl: '/api/sales',
        tenant: { id: 'tenant-2' },
        user: { id: 'user-2' },
      },
      event: 'crud_action',
    });

    expect(entry.classification).toBe('slow');
    expect(warnSpy).toHaveBeenCalledWith('[Perf] slow_timed_operation', expect.objectContaining({
      label: 'sales.create',
      durationSeconds: 1.5,
      classification: 'slow',
      tenantId: 'tenant-2',
      userId: 'user-2',
    }));
    expect(performanceLogger.getRecentSlowOperations().operations[0]).toMatchObject({
      event: 'crud_action',
      label: 'sales.create',
      durationMs: 1500,
      durationSeconds: 1.5,
      classification: 'slow',
    });
  });
});
