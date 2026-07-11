jest.mock('../../../models', () => ({
  AutomationRule: {},
  AutomationRun: {},
  Customer: { findAll: jest.fn() },
  Invoice: {},
  Job: {},
  Lead: {},
  Prescription: {},
  PrescriptionItem: {},
  Product: {},
  Quote: {},
  Sale: { findAll: jest.fn() },
  SaleItem: {},
  Tenant: {},
  User: {},
  UserTask: {},
}));

jest.mock('../../../services/emailService', () => ({ sendPlatformMessage: jest.fn() }));
jest.mock('../../../services/smsService', () => ({ sendMessage: jest.fn() }));
jest.mock('../../../services/whatsappService', () => ({ sendMessage: jest.fn(), formatCurrency: (n) => `GHS ${n}` }));
jest.mock('../../../services/emailTemplates', () => ({ marketingPlainMessageEmail: jest.fn((body) => body) }));
jest.mock('../../../utils/resolveBusinessNameForContext', () => ({
  resolveBusinessNameForContext: jest.fn(),
}));

const { Customer, Sale } = require('../../../models');
const { resolveBusinessNameForContext } = require('../../../utils/resolveBusinessNameForContext');
const {
  conditionsAllowRun,
  getTriggerContextsForRule,
} = require('../../../services/automationEngineService');

describe('automationEngineService customer_birthday', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Sale.findAll.mockResolvedValue([]);
    resolveBusinessNameForContext.mockResolvedValue({ businessName: 'Test Biz', branchName: '' });
  });

  describe('conditionsAllowRun birthdayMatch', () => {
    const now = new Date(2026, 2, 15); // Mar 15 local

    it('allows today match for legacy full DOB and fixed-year birthday', () => {
      const rule = { conditionConfig: { birthdayMatch: 'today' } };
      expect(conditionsAllowRun(rule, { dateOfBirth: '1990-03-15' }, now).allowed).toBe(true);
      expect(conditionsAllowRun(rule, { dateOfBirth: '2000-03-15' }, now).allowed).toBe(true);
      expect(conditionsAllowRun(rule, { customer: { dateOfBirth: '2000-03-15' } }, now).allowed).toBe(true);
    });

    it('rejects today when day or month differs', () => {
      const rule = { conditionConfig: { birthdayMatch: 'today' } };
      expect(conditionsAllowRun(rule, { dateOfBirth: '1990-03-14' }, now).allowed).toBe(false);
      expect(conditionsAllowRun(rule, { dateOfBirth: '1990-04-15' }, now).allowed).toBe(false);
    });

    it('allows this_month when month matches regardless of day or year', () => {
      const rule = { conditionConfig: { birthdayMatch: 'this_month' } };
      expect(conditionsAllowRun(rule, { dateOfBirth: '1988-03-01' }, now).allowed).toBe(true);
      expect(conditionsAllowRun(rule, { dateOfBirth: '2000-03-31' }, now).allowed).toBe(true);
      expect(conditionsAllowRun(rule, { dateOfBirth: '2000-04-01' }, now).allowed).toBe(false);
    });

    it('rejects when dateOfBirth is missing', () => {
      const rule = { conditionConfig: { birthdayMatch: 'today' } };
      expect(conditionsAllowRun(rule, {}, now).allowed).toBe(false);
      expect(conditionsAllowRun(rule, { dateOfBirth: null }, now).reason).toBe('birthday_condition');
    });
  });

  describe('getTriggerContextsForRule customer_birthday', () => {
    it('returns birthday contexts for customers matched by month-day', async () => {
      Customer.findAll.mockResolvedValue([
        { id: 'c1', name: 'Ada', dateOfBirth: '1991-07-11', phone: '+2331' },
      ]);

      const now = new Date(2026, 6, 11); // Jul 11
      const contexts = await getTriggerContextsForRule({
        id: 'r1',
        tenantId: 't1',
        triggerType: 'customer_birthday',
        conditionConfig: {},
      }, now);

      expect(Customer.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 't1',
            isActive: true,
          }),
        })
      );
      expect(contexts).toHaveLength(1);
      expect(contexts[0].subjectKey).toBe('customer_birthday:c1:2026');
      expect(contexts[0].dateOfBirth).toBe('1991-07-11');
      expect(contexts[0].customerName).toBe('Ada');
    });
  });
});
