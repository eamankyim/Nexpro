/**
 * @jest-environment node
 */

jest.mock('../../../models', () => ({
  PartnerReferral: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
  },
  Partnership: {
    findOne: jest.fn(),
  },
  Customer: {
    findOne: jest.fn(),
  },
  PartnerProgramSettings: {},
  Tenant: {},
}));

jest.mock('../../../utils/customerUniquenessUtils', () => ({
  normalizePhoneForLookup: jest.fn((phone) => {
    if (!phone) return null;
    const digits = String(phone).replace(/\D/g, '');
    if (digits.startsWith('233')) return `+${digits}`;
    if (digits.startsWith('0') && digits.length === 10) return `+233${digits.slice(1)}`;
    return digits ? `+${digits}` : null;
  }),
}));

const { PartnerReferral, Partnership, Customer } = require('../../../models');
const {
  createReferral,
  matchPendingReferralsForCustomer,
} = require('../../../services/partnerReferralService');

describe('partnerReferralService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createReferral matches existing customer by phone and attributes (first-touch)', async () => {
    Partnership.findOne.mockResolvedValue({
      id: 'p1',
      tenantId: 't1',
      marketerId: 'm1',
      status: 'active',
    });
    PartnerReferral.findOne.mockResolvedValue(null);

    const customer = {
      id: 'c1',
      tenantId: 't1',
      partnershipId: null,
      partnerMarketerId: null,
      howDidYouHear: null,
      referralName: null,
      update: jest.fn().mockResolvedValue(undefined),
    };
    Customer.findOne.mockResolvedValue(customer);

    const referral = {
      id: 'r1',
      tenantId: 't1',
      marketerId: 'm1',
      partnershipId: 'p1',
      status: 'pending',
      emailNormalized: 'a@b.com',
      phoneNormalized: '+233241234567',
      clientName: 'Ada',
      metadata: {},
      update: jest.fn().mockImplementation(async (vals) => Object.assign(referral, vals)),
      reload: jest.fn().mockResolvedValue(undefined),
    };
    PartnerReferral.create.mockResolvedValue(referral);

    const result = await createReferral({
      marketerId: 'm1',
      partnershipId: 'p1',
      clientName: 'Ada',
      clientEmail: 'a@b.com',
      clientPhone: '0241234567',
    });

    expect(customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        partnershipId: 'p1',
        partnerMarketerId: 'm1',
      })
    );
    expect(referral.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'matched', customerId: 'c1', matchedBy: 'create' })
    );
    expect(result.status).toBe('matched');
  });

  test('createReferral marks conflict when customer already attributed to another marketer', async () => {
    Partnership.findOne.mockResolvedValue({
      id: 'p1',
      tenantId: 't1',
      marketerId: 'm1',
      status: 'active',
    });
    PartnerReferral.findOne.mockResolvedValue(null);

    const customer = {
      id: 'c1',
      tenantId: 't1',
      partnershipId: 'p-other',
      partnerMarketerId: 'm-other',
      update: jest.fn(),
    };
    Customer.findOne.mockResolvedValue(customer);

    const referral = {
      id: 'r1',
      tenantId: 't1',
      marketerId: 'm1',
      partnershipId: 'p1',
      status: 'pending',
      emailNormalized: 'a@b.com',
      phoneNormalized: null,
      clientName: 'Ada',
      metadata: {},
      update: jest.fn().mockImplementation(async (vals) => Object.assign(referral, vals)),
      reload: jest.fn().mockResolvedValue(undefined),
    };
    PartnerReferral.create.mockResolvedValue(referral);

    const result = await createReferral({
      marketerId: 'm1',
      partnershipId: 'p1',
      clientName: 'Ada',
      clientEmail: 'a@b.com',
      clientPhone: null,
    });

    expect(customer.update).not.toHaveBeenCalled();
    expect(result.status).toBe('conflict');
  });

  test('matchPendingReferralsForCustomer attributes pending referrals on customer create', async () => {
    const customer = {
      id: 'c1',
      tenantId: 't1',
      email: 'late@example.com',
      phone: null,
      partnershipId: null,
      partnerMarketerId: null,
      howDidYouHear: null,
      referralName: null,
      update: jest.fn().mockResolvedValue(undefined),
      reload: jest.fn().mockResolvedValue(undefined),
    };

    const referral = {
      id: 'r1',
      tenantId: 't1',
      marketerId: 'm1',
      partnershipId: 'p1',
      status: 'pending',
      clientName: 'Late',
      metadata: {},
      update: jest.fn().mockImplementation(async (vals) => Object.assign(referral, vals)),
    };
    PartnerReferral.findAll.mockResolvedValue([referral]);

    const results = await matchPendingReferralsForCustomer(customer);
    expect(results[0].outcome).toBe('matched');
    expect(customer.update).toHaveBeenCalled();
  });
});
