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

const ORIGINAL_ENV = process.env;

describe('emailService diagnostics', () => {
  let errorSpy;
  let logSpy;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.clearAllMocks();
    Setting.findOne.mockResolvedValue(null);
    emailService.rateLimitCache.clear();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    logSpy.mockRestore();
    process.env = ORIGINAL_ENV;
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

  it('builds platform Gmail config from app-password env vars', () => {
    process.env.PLATFORM_EMAIL_PROVIDER = 'gmail';
    process.env.PLATFORM_GMAIL_USER = 'platform@gmail.com';
    process.env.PLATFORM_GMAIL_APP_PASSWORD = 'app-password';
    process.env.APP_NAME = 'ABS';

    const config = emailService.getPlatformConfig();

    expect(config).toMatchObject({
      provider: 'gmail',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      smtpUser: 'platform@gmail.com',
      smtpPassword: 'app-password',
      fromEmail: 'platform@gmail.com',
      fromName: 'ABS',
    });
  });

  it('uses persisted platform provider before env provider for system emails', async () => {
    Setting.findOne.mockResolvedValue({
      value: {
        provider: 'gmail',
        gmail: {
          user: 'saved-platform@gmail.com',
          password: 'saved-app-password',
          fromEmail: 'sender@gmail.com',
          fromName: 'Saved ABS',
        },
      },
    });
    process.env.PLATFORM_EMAIL_PROVIDER = 'sendgrid';
    process.env.PLATFORM_SENDGRID_API_KEY = 'sendgrid-key';
    process.env.PLATFORM_GMAIL_USER = 'platform@gmail.com';
    process.env.PLATFORM_GMAIL_APP_PASSWORD = 'app-password';

    const config = await emailService.resolvePlatformConfig();

    expect(config).toMatchObject({
      provider: 'gmail',
      smtpHost: 'smtp.gmail.com',
      smtpUser: 'saved-platform@gmail.com',
      smtpPassword: 'saved-app-password',
      fromEmail: 'sender@gmail.com',
      fromName: 'Saved ABS',
    });
  });

  it('sends platform Gmail messages through nodemailer SMTP', async () => {
    const sendMail = jest.fn().mockResolvedValue({
      messageId: 'gmail-message-1',
      responseCode: 250,
      response: '250 OK',
    });
    nodemailer.createTransport.mockReturnValue({ sendMail });
    process.env.PLATFORM_EMAIL_PROVIDER = 'gmail';
    process.env.PLATFORM_GMAIL_USER = 'platform@gmail.com';
    process.env.PLATFORM_GMAIL_APP_PASSWORD = 'app-password';
    process.env.PLATFORM_EMAIL_FROM_NAME = 'ABS';

    const result = await emailService.sendPlatformMessage(
      'user@example.com',
      'Verify your email',
      '<p>Hello</p>',
      'Hello'
    );

    expect(result).toMatchObject({ success: true, messageId: 'gmail-message-1' });
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: 'platform@gmail.com',
        pass: 'app-password',
      },
    }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: 'ABS <platform@gmail.com>',
      to: 'user@example.com',
      subject: 'Verify your email',
    }));
  });

  it('fails tenant sends without falling back when workspace email is missing', async () => {
    Setting.findOne.mockResolvedValue(null);

    const result = await emailService.sendMessage(
      'tenant-1',
      'invitee@example.com',
      'Invite',
      '<p>Invite</p>',
      'Invite',
      [],
      null,
      { context: { inviteId: 'invite-1', source: 'tenant_invite_email' } }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Workspace email is not configured');
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it('fails tenant sends when workspace email is disabled', async () => {
    Setting.findOne.mockResolvedValue({
      value: {
        enabled: false,
        provider: 'smtp',
        smtpHost: 'smtp.example.com',
        smtpUser: 'sender@example.com',
        smtpPassword: 'secret',
      },
    });

    const result = await emailService.sendMessage(
      'tenant-1',
      'invitee@example.com',
      'Invite',
      '<p>Invite</p>',
      'Invite'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Workspace email is disabled');
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it('fails tenant SendGrid sends with actionable missing field details', async () => {
    Setting.findOne.mockResolvedValue({
      value: {
        enabled: true,
        provider: 'sendgrid',
      },
    });

    const result = await emailService.sendMessage(
      'tenant-1',
      'invitee@example.com',
      'Invite',
      '<p>Invite</p>',
      'Invite'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Workspace email settings are incomplete for sendgrid');
    expect(result.error).toContain('sendgridApiKey');
    expect(result.error).toContain('fromEmail');
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
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

  it('verifies Gmail SMTP connections (platform provider)', async () => {
    const verify = jest.fn().mockResolvedValue(true);
    const close = jest.fn();
    nodemailer.createTransport.mockReturnValue({ verify, close });

    const result = await emailService.testConnection({
      provider: 'gmail',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      smtpUser: 'owner@gmail.com',
      smtpPassword: 'app-password',
      fromEmail: 'owner@gmail.com',
    });

    expect(result.success).toBe(true);
    expect(verify).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.gmail.com',
      port: 465,
      auth: expect.objectContaining({
        user: 'owner@gmail.com',
        pass: 'app-password',
      }),
    }));
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
