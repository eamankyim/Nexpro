jest.mock('../../../models', () => ({
  AutomationRule: { findAll: jest.fn() },
  AutomationRun: { findOne: jest.fn(), create: jest.fn() },
  Customer: {},
  Invoice: {},
  Job: {},
  Lead: {},
  Prescription: {},
  PrescriptionItem: {},
  Product: {},
  Quote: {},
  Sale: {},
  Tenant: {},
  UserTask: { create: jest.fn() },
}));

jest.mock('../../../services/emailService', () => ({ sendPlatformMessage: jest.fn() }));
jest.mock('../../../services/smsService', () => ({ sendMessage: jest.fn() }));
jest.mock('../../../services/whatsappService', () => ({ sendMessage: jest.fn() }));
jest.mock('../../../services/emailTemplates', () => ({ marketingPlainMessageEmail: jest.fn((body) => body) }));
jest.mock('../../../utils/resolveBusinessNameForContext', () => ({
  resolveBusinessNameForContext: jest.fn(),
}));

const { resolveBusinessNameForContext } = require('../../../utils/resolveBusinessNameForContext');
const {
  buildLeadTriggerContext,
  executeMatchingRules,
  runNewLeadAutomations,
} = require('../../../services/automationEngineService');
const { AutomationRule, AutomationRun } = require('../../../models');

describe('automationEngineService new_lead', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveBusinessNameForContext.mockResolvedValue({ businessName: 'Test Shop', branchName: '' });
    AutomationRun.findOne.mockResolvedValue(null);
    AutomationRun.create.mockResolvedValue({ id: 'run-1' });
  });

  it('builds lead context with contact fields', () => {
    const context = buildLeadTriggerContext({
      id: 'lead-1',
      name: 'Kofi Asante',
      company: 'Asante Co',
      source: 'website',
      email: 'kofi@example.com',
      phone: '+233201234567',
    });
    expect(context).toMatchObject({
      subjectKey: 'new_lead:lead-1',
      leadName: 'Kofi Asante',
      leadCompany: 'Asante Co',
      leadSource: 'website',
      email: 'kofi@example.com',
      phone: '+233201234567',
    });
  });

  it('runs matching new_lead rules', async () => {
    AutomationRule.findAll.mockResolvedValue([{ id: 'rule-1', enabled: true, triggerType: 'new_lead', actionConfig: { actions: [] }, scheduleConfig: {}, conditionConfig: {} }]);
    const summary = await runNewLeadAutomations({
      tenantId: 'tenant-1',
      lead: { id: 'lead-1', name: 'Ama', source: 'referral' },
      actorUserId: 'user-1',
    });
    expect(summary.rulesChecked).toBe(1);
    expect(AutomationRule.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ triggerType: 'new_lead' }) }));
  });

  it('skips when lead is missing', async () => {
    const result = await runNewLeadAutomations({ tenantId: 'tenant-1', lead: null });
    expect(result).toEqual({ skipped: true, reason: 'missing_lead' });
    expect(executeMatchingRules).toBeDefined();
  });
});
