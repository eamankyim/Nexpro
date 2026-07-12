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
  User: {},
  UserTask: { create: jest.fn() },
}));

jest.mock('../../../services/emailService', () => ({ sendPlatformMessage: jest.fn() }));
jest.mock('../../../services/smsService', () => ({ sendMessage: jest.fn() }));
jest.mock('../../../services/whatsappService', () => ({
  sendMessage: jest.fn(),
  formatCurrency: (n) => `GHS ${Number(n).toFixed(2)}`,
}));
jest.mock('../../../services/whatsappTemplates', () => ({
  formatCurrency: (n) => `GHS ${Number(n).toFixed(2)}`,
}));
jest.mock('../../../services/emailTemplates', () => ({ marketingPlainMessageEmail: jest.fn((body) => body) }));
jest.mock('../../../utils/resolveBusinessNameForContext', () => ({
  resolveBusinessNameForContext: jest.fn(),
}));
jest.mock('../../../services/automationRecipientService', () => ({
  isInternalAudience: jest.fn(() => false),
  resolveStaffRecipients: jest.fn(async () => []),
  getActionRecipientConfig: jest.fn(() => null),
}));

const {
  buildJobAssignedStaffTriggerContext,
  buildQuoteAcceptedStaffTriggerContext,
  buildOrderStatusStaffTriggerContext,
  buildLeadTriggerContext,
  getTemplateByKey,
} = require('../../../services/automationEngineService');

describe('staff automation context builders', () => {
  it('builds job_assigned_staff context with assignee and without customer contacts as recipients', () => {
    const context = buildJobAssignedStaffTriggerContext({
      job: {
        id: 'job-1',
        jobNumber: 'JOB-100',
        title: 'Banner print',
        assignedTo: 'user-9',
        dueDate: '2026-07-15',
        shopId: null,
      },
      assignee: { id: 'user-9', name: 'Ama', email: 'ama@staff.com' },
      customer: { id: 'cust-1', name: 'Client Co', email: 'client@example.com', phone: '+233200000000' },
    });

    expect(context).toMatchObject({
      subjectKey: 'job_assigned_staff:job-1:user-9',
      jobNumber: 'JOB-100',
      assigneeId: 'user-9',
      assigneeName: 'Ama',
      customerName: 'Client Co',
      email: null,
      phone: null,
    });
  });

  it('builds quote_accepted_staff context', () => {
    const context = buildQuoteAcceptedStaffTriggerContext(
      { id: 'q-1', quoteNumber: 'Q-55', title: 'Signage', totalAmount: 1200 },
      { id: 'c-1', name: 'Kojo', company: 'Kojo Ltd' }
    );
    expect(context).toMatchObject({
      subjectKey: 'quote_accepted_staff:q-1',
      quoteNumber: 'Q-55',
      customerName: 'Kojo',
      email: null,
      phone: null,
    });
    expect(context.totalAmountFormatted).toContain('1200');
  });

  it('builds order_status_staff context especially for ready', () => {
    const context = buildOrderStatusStaffTriggerContext({
      sale: { id: 'sale-1', saleNumber: 'ORD-9', total: 85, orderStatus: 'ready' },
      customer: { name: 'Walk-in' },
      orderStatus: 'ready',
      previousStatus: 'preparing',
    });
    expect(context).toMatchObject({
      subjectKey: 'order_status_staff:sale-1:ready',
      orderNumber: 'ORD-9',
      orderStatus: 'ready',
      previousStatus: 'preparing',
      email: null,
      phone: null,
    });
  });

  it('stores lead contacts as leadEmail/leadPhone and clears messaging email/phone', () => {
    const context = buildLeadTriggerContext({
      id: 'lead-1',
      name: 'Kofi',
      company: 'Kofi Co',
      source: 'walk-in',
      email: 'kofi@lead.com',
      phone: '+233201234567',
    });
    expect(context).toMatchObject({
      leadEmail: 'kofi@lead.com',
      leadPhone: '+233201234567',
      email: null,
      phone: null,
    });
  });

  it('marks staff templates with audience internal and recipient model', () => {
    const jobAssigned = getTemplateByKey('job_assigned_staff');
    expect(jobAssigned.audience).toBe('internal');
    expect(jobAssigned.actionConfig.actions[0].recipient).toEqual({ type: 'assignee' });

    const paymentStaff = getTemplateByKey('payment_received_staff');
    expect(paymentStaff.actionConfig.defaultRecipient).toEqual({
      type: 'role',
      roles: ['owner', 'manager'],
    });
  });
});
