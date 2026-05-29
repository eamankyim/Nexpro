jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn(),
}));

jest.mock('../../../models', () => ({
  Setting: {
    findOne: jest.fn(),
  },
}));

const nodemailer = require('nodemailer');
const { Setting } = require('../../../models');
const emailService = require('../../../services/emailService');

describe('emailService diagnostics', () => {
  let errorSpy;
  let logSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    emailService.rateLimitCache.clear();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('masks email addresses in tenant audit output', () => {
    const audit = emailService.formatTenantEmailAudit('tenant-1', {
      enabled: true,
      provider: 'smtp',
      smtpHost: 'smtp.example.com',
      smtpUser: 'sender@example.com',
      smtpPassword: 'secret',
      fromEmail: 'billing@example.com',
      fromName: 'Billing',
    });

    expect(audit).toContain('fromEmail=bi***g@e***.com');
    expect(audit).toContain('fromNameSet=true');
    expect(audit).toContain('fromMatchesSmtpUser=false');
    expect(audit).not.toContain('billing@example.com');
    expect(audit).not.toContain('sender@example.com');
    expect(audit).not.toContain('secret');
  });

  it('does not expose non-email SMTP usernames that may be provider keys', () => {
    const diag = emailService.getConfigDiagnostic({
      provider: 'mailjet',
      smtpUser: 'mj_api_key_123',
      smtpPassword: 'secret',
    });

    expect(diag.smtpUserMasked).toBe('***');
    expect(JSON.stringify(diag)).not.toContain('mj_api_key_123');
  });

  it('logs provider response details without full email addresses on tenant send failure', async () => {
    Setting.findOne.mockResolvedValue({
      value: {
        enabled: true,
        provider: 'smtp',
        smtpHost: 'smtp.example.com',
        smtpPort: 587,
        smtpUser: 'sender@example.com',
        smtpPassword: 'secret',
        fromEmail: 'billing@example.com',
      },
    });
    nodemailer.createTransport.mockReturnValue({
      sendMail: jest.fn().mockRejectedValue(Object.assign(new Error('Invalid login for jane.customer@example.com'), {
        code: 'EAUTH',
        responseCode: 535,
        command: 'AUTH PLAIN',
        response: '535 5.7.8 Username and Password not accepted for jane.customer@example.com',
      })),
      close: jest.fn(),
    });

    const result = await emailService.sendMessage(
      'tenant-1',
      'jane.customer@example.com',
      'Invoice',
      '<p>Hello</p>',
      'Hello',
      [],
      null,
      { context: { requestId: 'req-1', inviteId: 'invite-1', userId: 'user-1' } }
    );

    expect(result.success).toBe(false);
    const output = errorSpy.mock.calls.flat().join(' ');
    expect(output).toContain('[Email][tenant_send_failure]');
    expect(output).toContain('requestId=req-1');
    expect(output).toContain('tenantId=tenant-1');
    expect(output).toContain('inviteId=invite-1');
    expect(output).toContain('responseCode=535');
    expect(output).toContain('command=AUTH PLAIN');
    expect(output).toContain('ja***r@e***.com');
    expect(output).not.toContain('jane.customer@example.com');
    expect(output).not.toContain('sender@example.com');
    expect(output).not.toContain('billing@example.com');
    expect(output).not.toContain('secret');
  });

  it('logs verify failures with request-body source context and masked provider message', async () => {
    nodemailer.createTransport.mockReturnValue({
      verify: jest.fn().mockRejectedValue(Object.assign(new Error('Unauthorized for owner@example.com'), {
        code: 'EAUTH',
        responseCode: 401,
        command: 'AUTH LOGIN',
        response: '401 Unauthorized owner@example.com',
      })),
      close: jest.fn(),
    });

    const result = await emailService.testConnection({
      provider: 'smtp',
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      smtpUser: 'owner@example.com',
      smtpPassword: 'secret',
      fromEmail: 'sales@example.com',
    }, {
      context: {
        requestId: 'req-2',
        tenantId: 'tenant-2',
        userId: 'user-2',
        source: 'settings_email_request_body_test',
        mode: 'verify',
      },
    });

    expect(result.success).toBe(false);
    const output = errorSpy.mock.calls.flat().join(' ');
    expect(output).toContain('[Email Test][connection_verify_failure]');
    expect(output).toContain('source=settings_email_request_body_test');
    expect(output).toContain('mode=verify');
    expect(output).toContain('responseCode=401');
    expect(output).toContain('ow***r@e***.com');
    expect(output).not.toContain('owner@example.com');
    expect(output).not.toContain('sales@example.com');
    expect(output).not.toContain('secret');
  });
});
