jest.mock('../../../models', () => ({
  Setting: {
    findOne: jest.fn(),
    findOrCreate: jest.fn(),
  },
  Tenant: {
    findByPk: jest.fn(),
  },
  TenantAccessAudit: {
    create: jest.fn(),
  },
}));

jest.mock('../../../middleware/cache', () => ({
  invalidateCache: jest.fn(),
  invalidateAuthBootstrapCache: jest.fn(),
}));

const { Setting, Tenant, TenantAccessAudit } = require('../../../models');
const {
  getTenantAdminSettings,
  updateTenantAdminSettings,
} = require('../../../services/tenantSettingsAdminService');

describe('tenantSettingsAdminService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockTenant = {
    id: 'tenant-1',
    name: 'Acme Shop',
    slug: 'acme-shop',
    businessType: 'shop',
    metadata: { defaultHiddenSidebarKeys: ['/leads'] },
    save: jest.fn().mockResolvedValue(undefined),
  };

  it('returns null when tenant does not exist', async () => {
    Tenant.findByPk.mockResolvedValue(null);
    const result = await getTenantAdminSettings('missing');
    expect(result).toBeNull();
  });

  it('loads grouped tenant settings for platform admin', async () => {
    Tenant.findByPk.mockResolvedValue(mockTenant);
    Setting.findOne
      .mockResolvedValueOnce({ value: { invoiceFooter: 'Thanks' } })
      .mockResolvedValueOnce({
        value: {
          autoSendInvoiceOnJobCreation: true,
          autoCreateExpenseFromProductCost: true,
        },
      })
      .mockResolvedValueOnce({ value: { autoSendInvoiceToCustomer: false } });

    const result = await getTenantAdminSettings('tenant-1');

    expect(result.tenant.slug).toBe('acme-shop');
    expect(result.organization.invoiceFooter).toBe('Thanks');
    expect(result.jobInvoice.autoSendInvoiceOnJobCreation).toBe(true);
    // Legacy product-cost expense flag is hard-disabled (COGS handles cost).
    expect(result.jobInvoice.autoCreateExpenseFromProductCost).toBe(false);
    expect(result.customerNotifications.autoSendInvoiceToCustomer).toBe(false);
    expect(result.sidebarDefaults.hiddenSidebarKeys).toEqual(['/leads']);
  });

  it('clears autoCreateExpenseFromProductCost even when patch requests true', async () => {
    const settingRow = { value: {}, save: jest.fn().mockResolvedValue(undefined) };
    Tenant.findByPk
      .mockResolvedValueOnce(mockTenant)
      .mockResolvedValueOnce(mockTenant);
    Setting.findOne.mockResolvedValue({
      value: { autoCreateExpenseFromProductCost: true },
    });
    Setting.findOrCreate.mockResolvedValue([settingRow, false]);

    const result = await updateTenantAdminSettings({
      tenantId: 'tenant-1',
      actorUserId: 'admin-1',
      payload: {
        jobInvoice: { autoCreateExpenseFromProductCost: true },
      },
      reason: 'Attempt to re-enable removed setting',
    });

    expect(settingRow.save).toHaveBeenCalled();
    expect(settingRow.value.autoCreateExpenseFromProductCost).toBe(false);
    expect(result.jobInvoice.autoCreateExpenseFromProductCost).toBe(false);
  });

  it('updates settings and writes audit log', async () => {
    Tenant.findByPk
      .mockResolvedValueOnce(mockTenant)
      .mockResolvedValueOnce(mockTenant);
    Setting.findOne.mockResolvedValue({ value: {} });
    Setting.findOrCreate.mockResolvedValue([{ value: {}, save: jest.fn() }, false]);

    const result = await updateTenantAdminSettings({
      tenantId: 'tenant-1',
      actorUserId: 'admin-1',
      payload: {
        organization: { invoiceFooter: 'New footer' },
        sidebarDefaults: { hiddenSidebarKeys: ['/marketing'] },
      },
      reason: 'Customer requested invoice footer update',
    });

    expect(TenantAccessAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        actorUserId: 'admin-1',
        action: 'tenant_settings_updated',
        reason: 'Customer requested invoice footer update',
      })
    );
    expect(mockTenant.save).toHaveBeenCalled();
    expect(result.sidebarDefaults.hiddenSidebarKeys).toEqual(['/marketing']);
  });

  it('rejects empty payload', async () => {
    Tenant.findByPk.mockResolvedValue(mockTenant);
    Setting.findOne.mockResolvedValue({ value: {} });

    await expect(
      updateTenantAdminSettings({
        tenantId: 'tenant-1',
        actorUserId: 'admin-1',
        payload: {},
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
