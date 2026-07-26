/**
 * @jest-environment node
 */

jest.mock('../../../models', () => ({
  PartnerProgramSettings: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  },
  PartnerProgramService: {},
  PartnershipApplication: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  Partnership: {
    count: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
  Marketer: {},
  Tenant: { findByPk: jest.fn() },
  Product: {},
  PricingTemplate: {},
  OnlineServiceListing: {},
}));

const {
  PartnerProgramSettings,
  Partnership,
  PartnershipApplication,
  Tenant,
} = require('../../../models');
const {
  applyToPartner,
  approveApplication,
  listPublicPartners,
} = require('../../../services/partnerProgramService');

describe('partnerProgramService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('listPublicPartners returns empty when none listed', async () => {
    PartnerProgramSettings.findAll.mockResolvedValue([]);
    const rows = await listPublicPartners();
    expect(rows).toEqual([]);
  });

  test('applyToPartner blocks when slots full', async () => {
    PartnerProgramSettings.findOne.mockResolvedValue({
      tenantId: 't1',
      enabled: true,
      listed: true,
      maxMarketers: 1,
    });
    Partnership.count.mockResolvedValue(1);
    await expect(
      applyToPartner({ marketerId: 'm1', tenantId: 't1', pitch: 'hi' })
    ).rejects.toMatchObject({ statusCode: 409, errorCode: 'PARTNER_SLOTS_FULL' });
  });

  test('approveApplication creates partnership with referral code', async () => {
    PartnershipApplication.findOne.mockResolvedValue({
      id: 'app1',
      tenantId: 't1',
      marketerId: 'm1',
      status: 'pending',
      update: jest.fn(),
    });
    Tenant.findByPk.mockResolvedValue({ id: 't1', name: 'Biz' });
    PartnerProgramSettings.findOne.mockResolvedValueOnce({
      id: 'set1',
      tenantId: 't1',
      firstClientRatePercent: 10,
      returningClientRatePercent: 5,
      attributionMonths: 12,
      maxMarketers: 5,
    });
    Partnership.count.mockResolvedValue(0);
    Partnership.findOne.mockResolvedValue(null);
    Partnership.create.mockResolvedValue({
      id: 'part1',
      referralCode: 'SP-ABCD1234',
    });

    const result = await approveApplication({
      tenantId: 't1',
      applicationId: 'app1',
      reviewedBy: 'u1',
    });

    expect(Partnership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        marketerId: 'm1',
        status: 'active',
        firstClientRatePercent: 10,
        returningClientRatePercent: 5,
      })
    );
    expect(result.partnership).toBeTruthy();
  });
});
