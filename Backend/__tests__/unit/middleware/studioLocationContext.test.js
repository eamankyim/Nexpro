jest.mock('../../../config/businessTypes', () => ({
  resolveBusinessType: jest.fn(),
}));

jest.mock('../../../utils/studioLocationUtils', () => ({
  hasWorkspaceWideStudioAccess: jest.fn(),
  getUserStudioLocationIds: jest.fn(),
  ensureDefaultStudioLocation: jest.fn(),
}));

const { resolveBusinessType } = require('../../../config/businessTypes');
const {
  hasWorkspaceWideStudioAccess,
  getUserStudioLocationIds,
  ensureDefaultStudioLocation,
} = require('../../../utils/studioLocationUtils');
const { studioLocationContext } = require('../../../middleware/studioLocationContext');

const runMiddleware = (req) =>
  new Promise((resolve, reject) => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation((body) => resolve({ status: res.status.mock.calls[0]?.[0], body })),
    };
    studioLocationContext(req, res, (err) => (err ? reject(err) : resolve({ next: true, req })));
  });

describe('studioLocationContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveBusinessType.mockReturnValue('studio');
    hasWorkspaceWideStudioAccess.mockReturnValue(true);
    getUserStudioLocationIds.mockResolvedValue(['loc-valid']);
    ensureDefaultStudioLocation.mockResolvedValue({ id: 'loc-default' });
  });

  it('ignores stale x-studio-location-id for workspace-wide users', async () => {
    const req = {
      tenant: { businessType: 'printing_press', name: 'Studio' },
      tenantId: 'tenant-1',
      user: { id: 'user-1' },
      tenantRole: 'admin',
      headers: { 'x-studio-location-id': 'loc-deleted' },
    };

    const result = await runMiddleware(req);

    expect(result.next).toBe(true);
    expect(req.studioLocationFilterId).toBeUndefined();
    expect(req.defaultStudioLocationId).toBe('loc-default');
  });

  it('sets studioLocationFilterId when header matches an allowed location', async () => {
    const req = {
      tenant: { businessType: 'printing_press', name: 'Studio' },
      tenantId: 'tenant-1',
      user: { id: 'user-1' },
      tenantRole: 'admin',
      headers: { 'x-studio-location-id': 'loc-valid' },
    };

    await runMiddleware(req);

    expect(req.studioLocationFilterId).toBe('loc-valid');
  });

  it('returns 403 when a restricted user sends an unknown location id', async () => {
    hasWorkspaceWideStudioAccess.mockReturnValue(false);
    getUserStudioLocationIds.mockResolvedValue(['loc-valid']);

    const req = {
      tenant: { businessType: 'printing_press', name: 'Studio' },
      tenantId: 'tenant-1',
      user: { id: 'user-1' },
      tenantRole: 'staff',
      headers: { 'x-studio-location-id': 'loc-other' },
    };

    const result = await runMiddleware(req);

    expect(result.status).toBe(403);
    expect(result.body.message).toMatch(/do not have access/i);
  });
});
