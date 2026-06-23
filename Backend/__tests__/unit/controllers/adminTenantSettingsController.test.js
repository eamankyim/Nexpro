jest.mock('../../../services/tenantSettingsAdminService', () => ({
  getTenantAdminSettings: jest.fn(),
  updateTenantAdminSettings: jest.fn(),
}));

const {
  getTenantAdminSettings,
  updateTenantAdminSettings,
} = require('../../../services/tenantSettingsAdminService');
const adminTenantSettingsController = require('../../../controllers/adminTenantSettingsController');

const createResponse = () => {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
  };
  return res;
};

describe('adminTenantSettingsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 404 when tenant settings are missing', async () => {
    getTenantAdminSettings.mockResolvedValue(null);
    const req = { params: { id: 'missing' } };
    const res = createResponse();
    const next = jest.fn();

    await adminTenantSettingsController.getTenantSettings(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Tenant not found' });
  });

  it('returns tenant settings payload', async () => {
    getTenantAdminSettings.mockResolvedValue({ tenant: { id: 'tenant-1' } });
    const req = { params: { id: 'tenant-1' } };
    const res = createResponse();
    const next = jest.fn();

    await adminTenantSettingsController.getTenantSettings(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { tenant: { id: 'tenant-1' } },
    });
  });

  it('updates tenant settings on behalf of tenant', async () => {
    updateTenantAdminSettings.mockResolvedValue({ tenant: { id: 'tenant-1' } });
    const req = {
      params: { id: 'tenant-1' },
      user: { id: 'admin-1' },
      body: {
        reason: 'Setup invoice defaults',
        organization: { invoiceFooter: 'Thank you' },
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await adminTenantSettingsController.updateTenantSettings(req, res, next);

    expect(updateTenantAdminSettings).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      actorUserId: 'admin-1',
      payload: { organization: { invoiceFooter: 'Thank you' } },
      reason: 'Setup invoice defaults',
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 400 for invalid update payload', async () => {
    const error = new Error('No valid settings provided');
    error.statusCode = 400;
    updateTenantAdminSettings.mockRejectedValue(error);
    const req = {
      params: { id: 'tenant-1' },
      user: { id: 'admin-1' },
      body: {},
    };
    const res = createResponse();
    const next = jest.fn();

    await adminTenantSettingsController.updateTenantSettings(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});
