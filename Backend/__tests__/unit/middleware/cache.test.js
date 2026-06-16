describe('cache middleware hot-path behavior', () => {
  let cacheModule;
  let infoSpy;

  beforeEach(() => {
    jest.resetModules();
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    cacheModule = require('../../../middleware/cache');
    cacheModule.clearAllCache();
  });

  afterEach(() => {
    cacheModule.clearAllCache();
    jest.restoreAllMocks();
  });

  it('strips conditional request headers before a cache miss reaches the controller', async () => {
    const { cacheMiddleware } = cacheModule;
    const req = {
      method: 'GET',
      tenantId: 'tenant-1',
      path: '/organization',
      query: {},
      headers: {
        'if-none-match': '"etag"',
        'if-modified-since': 'Mon, 01 Jan 2024 00:00:00 GMT',
      },
    };
    const res = {
      set: jest.fn(),
      json: jest.fn(),
      once: jest.fn(),
      statusCode: 200,
    };
    const next = jest.fn();

    await cacheMiddleware(30, () => 'settings:tenant-1:/organization')(req, res, next);

    expect(req.headers).not.toHaveProperty('if-none-match');
    expect(req.headers).not.toHaveProperty('if-modified-since');
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(next).toHaveBeenCalled();
  });

  it('logs a lightweight timing entry for route-level cache hits', async () => {
    const { cacheMiddleware, setCacheValue } = cacheModule;
    const cacheKey = 'settings:tenant-1:/organization';
    const cachedResponse = { success: true, data: { name: 'Tenant One' } };
    setCacheValue(cacheKey, cachedResponse, 30, 'tenant-1');
    const req = {
      method: 'GET',
      originalUrl: '/api/settings/organization',
      tenantId: 'tenant-1',
      path: '/organization',
      query: {},
      headers: {},
      user: { id: 'user-1' },
    };
    const res = {
      set: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      once: jest.fn(),
      statusCode: 200,
    };
    const next = jest.fn();

    await cacheMiddleware(30, () => cacheKey)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(cachedResponse);
    expect(infoSpy).toHaveBeenCalledWith('[Perf] timed_operation', expect.objectContaining({
      event: 'cache_hit',
      label: 'settings.organization',
      method: 'GET',
      path: '/api/settings/organization',
      statusCode: 200,
      tenantId: 'tenant-1',
      userId: 'user-1',
      cacheHit: true,
      cacheKey,
      durationSeconds: expect.any(Number),
    }));
  });

  it('lets existing CRUD timing own cache hits when it is already registered', async () => {
    const { cacheMiddleware, setCacheValue } = cacheModule;
    const cacheKey = 'products:list:tenant-1:';
    setCacheValue(cacheKey, { success: true, data: [] }, 30, 'tenant-1');
    const req = {
      __hasCrudTiming: true,
      method: 'GET',
      originalUrl: '/api/products',
      tenantId: 'tenant-1',
      path: '/',
      query: {},
      headers: {},
    };
    const res = {
      set: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      once: jest.fn(),
      statusCode: 200,
    };

    await cacheMiddleware(30, () => cacheKey)(req, res, jest.fn());

    expect(infoSpy).not.toHaveBeenCalledWith('[Perf] timed_operation', expect.objectContaining({
      event: 'cache_hit',
      cacheKey,
    }));
  });

  it('logs cache miss timing when no downstream timer owns the request', async () => {
    const { cacheMiddleware, getCacheValue } = cacheModule;
    const cacheKey = 'notifications:summary:tenant-1:user-1';
    let finishHandler;
    const req = {
      method: 'GET',
      originalUrl: '/api/notifications/summary',
      tenantId: 'tenant-1',
      path: '/summary',
      query: {},
      headers: {},
      user: { id: 'user-1' },
    };
    const res = {
      set: jest.fn(),
      json: jest.fn(),
      once: jest.fn((event, handler) => {
        if (event === 'finish') finishHandler = handler;
      }),
      statusCode: 200,
    };
    const next = jest.fn();

    await cacheMiddleware(30, () => cacheKey)(req, res, next);
    res.json({ success: true, data: { unread: 1 } });
    finishHandler();

    expect(next).toHaveBeenCalled();
    expect(getCacheValue(cacheKey)).toEqual({ success: true, data: { unread: 1 } });
    expect(infoSpy).toHaveBeenCalledWith('[Perf] timed_operation', expect.objectContaining({
      event: 'timed_operation',
      label: 'notifications.summary',
      method: 'GET',
      path: '/api/notifications/summary',
      statusCode: 200,
      tenantId: 'tenant-1',
      userId: 'user-1',
      cacheHit: false,
      cacheStored: true,
      cacheKey,
      durationSeconds: expect.any(Number),
    }));
  });

  it('invalidates default bootstrap cache entries registered under a tenant', () => {
    const {
      getAuthBootstrapCacheKey,
      getCacheValue,
      invalidateAuthBootstrapCache,
      setCacheValue,
    } = cacheModule;
    const key = getAuthBootstrapCacheKey('user-1', 'default');
    setCacheValue(key, { activeTenantId: 'tenant-1' }, 30, 'tenant-1');

    expect(getCacheValue(key)).toEqual({ activeTenantId: 'tenant-1' });

    invalidateAuthBootstrapCache({ tenantId: 'tenant-1' });

    expect(getCacheValue(key)).toBeUndefined();
  });
});
