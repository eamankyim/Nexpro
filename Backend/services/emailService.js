const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const { Setting } = require('../models');

class EmailService {
  constructor() {
    this.rateLimitCache = new Map();
    this.maxEmailsPerDay = 1000;
  }

  /**
   * Get platform email configuration from environment (for system emails: password reset, welcome, etc.).
   * Platform pays for these; businesses do not configure this.
   * @returns {Object|null} - Config object or null if not configured
   */
  getPlatformConfig() {
    const provider = (process.env.PLATFORM_EMAIL_PROVIDER || 'smtp').toLowerCase();
    if (provider === 'smtp') {
      const host = process.env.PLATFORM_SMTP_HOST || process.env.PLATFORM_EMAIL_SMTP_HOST;
      const user = process.env.PLATFORM_SMTP_USER || process.env.PLATFORM_EMAIL_SMTP_USER;
      const pass = process.env.PLATFORM_SMTP_PASSWORD || process.env.PLATFORM_EMAIL_SMTP_PASSWORD;
      if (!host || !user || !pass) return null;
      return {
        provider: 'smtp',
        smtpHost: host,
        smtpPort: parseInt(process.env.PLATFORM_SMTP_PORT || process.env.PLATFORM_EMAIL_SMTP_PORT || '587', 10),
        smtpUser: user,
        smtpPassword: pass,
        smtpRejectUnauthorized: process.env.PLATFORM_SMTP_REJECT_UNAUTHORIZED !== 'false',
        fromEmail: process.env.PLATFORM_EMAIL_FROM || user,
        fromName: process.env.PLATFORM_EMAIL_FROM_NAME || process.env.APP_NAME || 'African Business Suite'
      };
    }
    if (provider === 'sendgrid') {
      const key = process.env.PLATFORM_SENDGRID_API_KEY;
      if (!key) return null;
      return {
        provider: 'sendgrid',
        sendgridApiKey: key,
        fromEmail: process.env.PLATFORM_EMAIL_FROM,
        fromName: process.env.PLATFORM_EMAIL_FROM_NAME || process.env.APP_NAME || 'African Business Suite'
      };
    }
    if (provider === 'ses') {
      const id = process.env.PLATFORM_SES_ACCESS_KEY_ID;
      const secret = process.env.PLATFORM_SES_SECRET_ACCESS_KEY;
      if (!id || !secret) return null;
      return {
        provider: 'ses',
        sesAccessKeyId: id,
        sesSecretAccessKey: secret,
        sesRegion: process.env.PLATFORM_SES_REGION || 'us-east-1',
        sesHost: process.env.PLATFORM_SES_HOST,
        fromEmail: process.env.PLATFORM_EMAIL_FROM,
        fromName: process.env.PLATFORM_EMAIL_FROM_NAME || process.env.APP_NAME || 'African Business Suite'
      };
    }
    if (provider === 'mailjet') {
      const apiKey = process.env.PLATFORM_MAILJET_API_KEY;
      const secretKey = process.env.PLATFORM_MAILJET_SECRET_KEY;
      if (!apiKey || !secretKey) return null;
      return {
        provider: 'mailjet',
        smtpHost: process.env.PLATFORM_MAILJET_SMTP_HOST || 'in.mailjet.com',
        smtpPort: parseInt(process.env.PLATFORM_MAILJET_SMTP_PORT || '587', 10),
        smtpUser: apiKey,
        smtpPassword: secretKey,
        fromEmail: process.env.PLATFORM_EMAIL_FROM,
        fromName: process.env.PLATFORM_EMAIL_FROM_NAME || process.env.APP_NAME || 'African Business Suite'
      };
    }
    return null;
  }

  /**
   * Send system email using platform config (password reset, welcome, etc.). Platform pays; no tenant config used.
   * @param {string} to - Recipient email
   * @param {string} subject - Subject
   * @param {string} html - HTML body
   * @param {string} [text] - Plain text body (optional)
   * @param {Array} [attachments] - Attachments (optional)
   * @param {Object} [options] - Optional: { categories } for SendGrid (e.g. ['transactional','signup']) to improve deliverability
   * @returns {Promise<Object>} - { success, messageId?, error? }
   */
  async sendPlatformMessage(to, subject, html, text = null, attachments = [], options = {}) {
    const logPrefix = '[Email]';
    const toMask = to ? `${to.substring(0, 6)}***` : '?';
    const subjectShort = subject ? subject.substring(0, 50) : '';

    try {
      const config = this.getPlatformConfig();
      if (!config) {
        console.warn(`${logPrefix} SKIP platform to=${toMask} subject="${subjectShort}" reason=platform_not_configured`);
        return { success: false, error: 'Platform email not configured' };
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to)) {
        console.warn(`${logPrefix} SKIP platform to=${to} subject="${subjectShort}" reason=invalid_recipient`);
        return { success: false, error: 'Invalid email address format' };
      }
      const fromEmail = config.fromEmail || config.smtpUser;
      if (!fromEmail) {
        console.warn(`${logPrefix} SKIP platform to=${toMask} subject="${subjectShort}" reason=sender_not_configured`);
        return { success: false, error: 'Platform sender email not configured' };
      }

      console.log(`${logPrefix} Sending platform email to=${toMask} subject="${subjectShort}"`);

      // SendGrid: use HTTP API (port 443) instead of SMTP to avoid firewall/port 587 issues
      if (config.provider === 'sendgrid' && config.sendgridApiKey) {
        sgMail.setApiKey(config.sendgridApiKey);
        const msg = {
          to,
          from: { email: fromEmail, name: config.fromName || undefined },
          subject,
          html,
          text: text || html.replace(/<[^>]*>/g, ''),
          ...(attachments.length ? { attachments: attachments.map(a => ({ content: (a.content || a.buffer || '').toString('base64'), filename: a.filename || 'file', type: a.contentType || 'application/octet-stream' })) } : {}),
          ...(options.categories && options.categories.length ? { categories: options.categories } : {})
        };
        const [res] = await sgMail.send(msg);
        const messageId = res?.headers?.['x-message-id'];
        console.log(`${logPrefix} SENT platform to=${toMask} subject="${subjectShort}" messageId=${messageId || 'n/a'}`);
        return { success: true, messageId: messageId || res?.messageId, data: res };
      }

      const transporter = await this.createTransporter(config);
      const mailOptions = {
        from: config.fromName ? `${config.fromName} <${fromEmail}>` : fromEmail,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
        attachments
      };
      const info = await transporter.sendMail(mailOptions);
      console.log(`${logPrefix} SENT platform to=${toMask} subject="${subjectShort}" messageId=${info.messageId || 'n/a'}`);
      return { success: true, messageId: info.messageId, data: info };
    } catch (error) {
      console.error(`${logPrefix} FAILED platform to=${toMask} subject="${subjectShort}" error=${error.message} code=${error.code || 'n/a'}`);
      return { success: false, error: error.message || 'Failed to send email' };
    }
  }

  /**
   * One-line audit for server logs: tenant email integration state (no secrets).
   * Use when loading/saving Settings → Email or resolving marketing capabilities.
   * @param {string} tenantId
   * @param {Object} [value] - Raw or merged `settings.email` value
   * @returns {string}
   */
  formatTenantEmailAudit(tenantId, value) {
    const v = value && typeof value === 'object' ? value : {};
    const enabled = v.enabled === true;
    const provider = (v.provider || 'smtp').toString();
    const hasHost = !!(v.smtpHost && String(v.smtpHost).trim());
    const hasSg = !!(v.sendgridApiKey && String(v.sendgridApiKey).trim());
    const hasSes = !!(v.sesAccessKeyId && String(v.sesAccessKeyId).trim());
    const outboundReady = enabled && (hasHost || hasSg || hasSes);
    const smtpUserSet = !!(v.smtpUser && String(v.smtpUser).trim());
    const smtpPasswordSet = !!(v.smtpPassword && String(v.smtpPassword).trim());
    const fromEmail = (v.fromEmail && String(v.fromEmail).trim()) || '(empty)';
    const fromName = (v.fromName && String(v.fromName).trim()) || '(empty)';
    return (
      `tenantId=${tenantId} enabled=${enabled} provider=${provider} ` +
      `outboundReady=${outboundReady} smtpHostSet=${hasHost} smtpUserSet=${smtpUserSet} ` +
      `smtpPasswordSet=${smtpPasswordSet} sendgridSet=${hasSg} sesSet=${hasSes} ` +
      `fromEmail=${fromEmail} fromName=${fromName}`
    );
  }

  /**
   * Get Email configuration for a tenant (for business-to-customer emails: invoices, receipts). Business configures and pays.
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object|null>} - Email configuration or null
   */
  async getConfig(tenantId) {
    try {
      const setting = await Setting.findOne({
        where: { tenantId, key: 'email' }
      });

      if (!setting || !setting.value?.enabled) {
        return null;
      }

      return setting.value;
    } catch (error) {
      console.error('[Email] Error getting config:', error);
      return null;
    }
  }

  /**
   * Check rate limit
   * @param {string} tenantId - Tenant ID
   * @returns {boolean} - True if within rate limit
   */
  checkRateLimit(tenantId) {
    const today = new Date().toISOString().split('T')[0];
    const key = `${tenantId}_${today}`;
    const count = this.rateLimitCache.get(key) || 0;
    
    if (count >= this.maxEmailsPerDay) {
      return false;
    }
    
    this.rateLimitCache.set(key, count + 1);
    return true;
  }

  /**
   * Create email transporter based on provider
   * @param {Object} config - Email configuration
   * @returns {Promise<Object>} - Nodemailer transporter
   */
  async createTransporter(config) {
    const provider = config.provider || 'smtp';
    // Slightly longer timeouts for real sends; pooled transport reuses one TCP session (fewer Gmail “socket close” drops)
    const socketTimeout = 30000;
    const greetingTimeout = 15000;
    const poolOpts = { pool: true, maxConnections: 1, maxMessages: 1000 };

    switch (provider) {
      case 'smtp':
        return nodemailer.createTransport({
          ...poolOpts,
          host: config.smtpHost,
          port: config.smtpPort || 587,
          secure: config.smtpPort === 465,
          auth: {
            user: config.smtpUser,
            pass: config.smtpPassword
          },
          tls: {
            rejectUnauthorized: config.smtpRejectUnauthorized !== false
          },
          connectionTimeout: socketTimeout,
          greetingTimeout
        });

      case 'sendgrid':
        return nodemailer.createTransport({
          ...poolOpts,
          host: 'smtp.sendgrid.net',
          port: 587,
          secure: false,
          auth: {
            user: 'apikey',
            pass: config.sendgridApiKey
          },
          connectionTimeout: socketTimeout,
          greetingTimeout
        });

      case 'ses':
        return nodemailer.createTransport({
          ...poolOpts,
          host: config.sesHost || `email-smtp.${config.sesRegion || 'us-east-1'}.amazonaws.com`,
          port: 587,
          secure: false,
          auth: {
            user: config.sesAccessKeyId,
            pass: config.sesSecretAccessKey
          },
          connectionTimeout: socketTimeout,
          greetingTimeout
        });

      case 'mailjet':
        // Mailjet SMTP: in.mailjet.com, port 587 STARTTLS; username = API Key, password = Secret Key
        return nodemailer.createTransport({
          ...poolOpts,
          host: config.smtpHost || 'in.mailjet.com',
          port: config.smtpPort || 587,
          secure: config.smtpPort === 465,
          auth: {
            user: config.smtpUser,
            pass: config.smtpPassword
          },
          connectionTimeout: socketTimeout,
          greetingTimeout
        });

      default:
        throw new Error(`Unsupported email provider: ${provider}`);
    }
  }

  /**
   * Map SMTP / nodemailer errors to a short user-facing string.
   * @param {Error} error
   * @returns {string}
   */
  formatTenantSmtpError(error) {
    const code = error.code || '';
    const rawMessage = error.message || 'Failed to send email message';
    const isConnectionError =
      code === 'ETIMEDOUT' ||
      code === 'ECONNREFUSED' ||
      code === 'ECONNRESET' ||
      (rawMessage && /Greeting never received|socket close|Connection closed/i.test(rawMessage));
    if (isConnectionError) {
      return (
        'Could not complete send to the mail server (connection closed or blocked). ' +
        'Broadcasts reuse one mail connection; if this persists from your machine, try SMTP port 465 (SSL) in Settings → Email, or deploy where outbound SMTP is allowed.'
      );
    }
    return rawMessage;
  }

  /**
   * Send several tenant emails over one pooled SMTP connection (marketing broadcasts).
   * Avoids opening a new TCP+TLS session per recipient, which often triggers “Unexpected socket close” on Gmail.
   *
   * @param {string} tenantId
   * @param {Array<{ to: string, subject: string, html: string, text?: string, attachments?: Array }>} mailJobs
   * @returns {Promise<Array<{ success: boolean, messageId?: string, error?: string }>>}
   */
  async sendBulkTenantEmails(tenantId, mailJobs) {
    const logPrefix = '[Email]';
    if (!Array.isArray(mailJobs) || mailJobs.length === 0) {
      return [];
    }

    const config = await this.getConfig(tenantId);
    if (!config) {
      return mailJobs.map(() => ({ success: false, error: 'Email not configured for this tenant' }));
    }

    const fromEmail = config.fromEmail || config.smtpUser;
    if (!fromEmail) {
      return mailJobs.map(() => ({ success: false, error: 'Sender email address not configured' }));
    }

    const fromHeader = config.fromName ? `${config.fromName} <${fromEmail}>` : fromEmail;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    let transporter = await this.createTransporter(config);

    const isRetryableTransportError = (err) => {
      const msg = (err && err.message) || '';
      const c = err && err.code;
      return (
        c === 'ECONNRESET' ||
        c === 'ETIMEDOUT' ||
        c === 'ECONNREFUSED' ||
        /socket close|Greeting never received|Connection closed/i.test(msg)
      );
    };

    const recreateTransporter = async () => {
      try {
        transporter.close();
      } catch (_) {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 500));
      transporter = await this.createTransporter(config);
    };

    const results = [];

    try {
      for (const job of mailJobs) {
        const to = job.to;
        const subject = job.subject;
        const html = job.html;
        const text =
          job.text != null ? job.text : html ? String(html).replace(/<[^>]*>/g, '') : '';
        const toMask = to ? `${String(to).substring(0, 6)}***` : '?';

        if (!to || !emailRegex.test(String(to).trim())) {
          results.push({ success: false, error: 'Invalid email address format' });
          continue;
        }

        if (!this.checkRateLimit(tenantId)) {
          results.push({ success: false, error: 'Rate limit exceeded (1000 emails per day)' });
          continue;
        }

        let settled = false;
        for (let attempt = 0; attempt < 2 && !settled; attempt += 1) {
          try {
            const info = await transporter.sendMail({
              from: fromHeader,
              to: String(to).trim(),
              subject,
              html,
              text,
              attachments: job.attachments || [],
            });
            console.log(
              `${logPrefix} SENT tenant tenantId=${tenantId} to=${toMask} subject="${(subject || '').substring(0, 50)}" messageId=${info.messageId || 'n/a'}`
            );
            results.push({ success: true, messageId: info.messageId });
            settled = true;
          } catch (err) {
            console.error(
              `${logPrefix} FAILED bulk tenantId=${tenantId} to=${toMask} attempt=${attempt + 1} error=${err.message}`
            );
            if (attempt === 0 && isRetryableTransportError(err)) {
              await recreateTransporter();
              continue;
            }
            results.push({ success: false, error: this.formatTenantSmtpError(err) });
            settled = true;
          }
        }
      }
    } finally {
      try {
        transporter.close();
      } catch (_) {
        /* ignore */
      }
    }

    return results;
  }

  /**
   * Send email message
   * @param {string} tenantId - Tenant ID
   * @param {string} to - Recipient email address
   * @param {string} subject - Email subject
   * @param {string} html - Email HTML content
   * @param {string} text - Email plain text content (optional)
   * @param {Array} attachments - Email attachments (optional)
   * @param {string} from - Sender email address (optional, uses config default)
   * @returns {Promise<Object>} - API response
   */
  async sendMessage(tenantId, to, subject, html, text = null, attachments = [], from = null) {
    const logPrefix = '[Email]';
    const toMask = to ? `${to.substring(0, 6)}***` : '?';
    const subjectShort = subject ? subject.substring(0, 50) : '';

    try {
      const config = await this.getConfig(tenantId);
      if (!config) {
        console.warn(`${logPrefix} SKIP tenant tenantId=${tenantId} to=${toMask} subject="${subjectShort}" reason=email_not_configured`);
        return {
          success: false,
          error: 'Email not configured for this tenant'
        };
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to)) {
        console.warn(`${logPrefix} SKIP tenant tenantId=${tenantId} to=${to} subject="${subjectShort}" reason=invalid_recipient`);
        return {
          success: false,
          error: 'Invalid email address format'
        };
      }

      if (!this.checkRateLimit(tenantId)) {
        console.warn(`${logPrefix} SKIP tenant tenantId=${tenantId} to=${toMask} subject="${subjectShort}" reason=rate_limit_exceeded`);
        return {
          success: false,
          error: 'Rate limit exceeded (1000 emails per day)'
        };
      }

      const transporter = await this.createTransporter(config);
      const fromEmail = from || config.fromEmail || config.smtpUser;

      if (!fromEmail) {
        console.warn(`${logPrefix} SKIP tenant tenantId=${tenantId} to=${toMask} subject="${subjectShort}" reason=sender_not_configured`);
        try {
          transporter.close();
        } catch (_) {
          /* ignore */
        }
        return {
          success: false,
          error: 'Sender email address not configured'
        };
      }

      const fn = (config.fromName && String(config.fromName).trim()) || '(none)';
      console.log(
        `${logPrefix} Sending tenant email tenantId=${tenantId} to=${toMask} subject="${subjectShort}" ` +
          `fromEmail=${fromEmail} fromName=${fn}`
      );
      const mailOptions = {
        from: config.fromName ? `${config.fromName} <${fromEmail}>` : fromEmail,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
        attachments
      };

      try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`${logPrefix} SENT tenant tenantId=${tenantId} to=${toMask} subject="${subjectShort}" messageId=${info.messageId || 'n/a'}`);
        return {
          success: true,
          messageId: info.messageId,
          data: info
        };
      } finally {
        try {
          transporter.close();
        } catch (_) {
          /* ignore */
        }
      }

    } catch (error) {
      const rawMessage = error.message || 'Failed to send email message';
      console.error(`${logPrefix} FAILED tenant tenantId=${tenantId} to=${toMask} subject="${subjectShort}" error=${rawMessage}`);
      return {
        success: false,
        error: this.formatTenantSmtpError(error)
      };
    }
  }

  /**
   * Test email connection
   * @param {Object} config - Email configuration to test
   * @returns {Promise<Object>} - Test result
   */
  async testConnection(config) {
    const provider = config.provider || 'smtp';
    const logPrefix = '[Email Test]';
    try {
      console.log(`${logPrefix} Starting: provider=${provider}`);

      // Validate required fields based on provider
      switch (provider) {
        case 'smtp':
          if (!config.smtpHost || !config.smtpUser || !config.smtpPassword) {
            const missing = []; if (!config.smtpHost) missing.push('smtpHost'); if (!config.smtpUser) missing.push('smtpUser'); if (!config.smtpPassword) missing.push('smtpPassword');
            console.log(`${logPrefix} Validation failed: missing ${missing.join(', ')}`);
            return {
              success: false,
              error: 'SMTP Host, User, and Password are required'
            };
          }
          break;

        case 'sendgrid':
          if (!config.sendgridApiKey) {
            console.log(`${logPrefix} Validation failed: SendGrid API Key missing`);
            return {
              success: false,
              error: 'SendGrid API Key is required'
            };
          }
          break;

        case 'ses':
          if (!config.sesAccessKeyId || !config.sesSecretAccessKey) {
            console.log(`${logPrefix} Validation failed: SES credentials missing`);
            return {
              success: false,
              error: 'AWS SES Access Key ID and Secret Access Key are required'
            };
          }
          break;

        case 'mailjet':
          if (!config.smtpUser || !config.smtpPassword) {
            console.log(`${logPrefix} Validation failed: Mailjet credentials missing`);
            return {
              success: false,
              error: 'Mailjet API Key and Secret Key are required'
            };
          }
          break;

        default:
          console.log(`${logPrefix} Unsupported provider: ${provider}`);
          return {
            success: false,
            error: `Unsupported email provider: ${provider}`
          };
      }

      console.log(`${logPrefix} Validation passed. Creating transporter: host=${config.smtpHost || config.sesHost || 'n/a'}, user=${config.smtpUser || config.sesAccessKeyId || 'n/a'}`);
      const transporter = await this.createTransporter(config);
      try {
        console.log(`${logPrefix} Calling transporter.verify()...`);
        await transporter.verify();
        console.log(`${logPrefix} transporter.verify() succeeded`);
        return {
          success: true,
          message: 'Email connection verified successfully'
        };
      } finally {
        try {
          transporter.close();
        } catch (_) {
          /* ignore */
        }
      }
    } catch (error) {
      const code = error.code || '';
      const response = error.response ? String(error.response).slice(0, 300) : '';
      const command = error.command || '';
      console.error(`${logPrefix} Error: message=${error.message} code=${code} command=${command} response=${response}`);
      if (error.stack) console.error(`${logPrefix} Stack:`, error.stack);
      let userMessage = error.message || 'Failed to verify email connection';
      if (code === 'ETIMEDOUT' || (code === 'ECONNREFUSED') || (error.message && error.message.includes('Greeting never received'))) {
        userMessage = 'Could not reach the mail server (connection timed out or blocked). If you\'re on a local network, outbound SMTP is often blocked—try from a deployed server, or use port 465 (SSL) if your provider supports it.';
      }
      return {
        success: false,
        error: userMessage
      };
    }
  }
}

module.exports = new EmailService();
