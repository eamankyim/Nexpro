const nodemailer = require('nodemailer');
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
        fromName: process.env.PLATFORM_EMAIL_FROM_NAME || process.env.APP_NAME || 'ShopWISE'
      };
    }
    if (provider === 'sendgrid') {
      const key = process.env.PLATFORM_SENDGRID_API_KEY;
      if (!key) return null;
      return {
        provider: 'sendgrid',
        sendgridApiKey: key,
        fromEmail: process.env.PLATFORM_EMAIL_FROM,
        fromName: process.env.PLATFORM_EMAIL_FROM_NAME || process.env.APP_NAME || 'ShopWISE'
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
        fromName: process.env.PLATFORM_EMAIL_FROM_NAME || process.env.APP_NAME || 'ShopWISE'
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
   * @returns {Promise<Object>} - { success, messageId?, error? }
   */
  async sendPlatformMessage(to, subject, html, text = null, attachments = []) {
    try {
      const config = this.getPlatformConfig();
      if (!config) {
        return { success: false, error: 'Platform email not configured' };
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to)) {
        return { success: false, error: 'Invalid email address format' };
      }
      const transporter = await this.createTransporter(config);
      const fromEmail = config.fromEmail || config.smtpUser;
      if (!fromEmail) {
        return { success: false, error: 'Platform sender email not configured' };
      }
      const mailOptions = {
        from: config.fromName ? `${config.fromName} <${fromEmail}>` : fromEmail,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
        attachments
      };
      const info = await transporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId, data: info };
    } catch (error) {
      console.error('[Email] Platform message failed:', error.message);
      return { success: false, error: error.message || 'Failed to send email' };
    }
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
    
    switch (provider) {
      case 'smtp':
        return nodemailer.createTransport({
          host: config.smtpHost,
          port: config.smtpPort || 587,
          secure: config.smtpPort === 465, // true for 465, false for other ports
          auth: {
            user: config.smtpUser,
            pass: config.smtpPassword
          },
          tls: {
            rejectUnauthorized: config.smtpRejectUnauthorized !== false
          }
        });

      case 'sendgrid':
        // SendGrid uses SMTP with specific settings
        return nodemailer.createTransport({
          host: 'smtp.sendgrid.net',
          port: 587,
          secure: false,
          auth: {
            user: 'apikey',
            pass: config.sendgridApiKey
          }
        });

      case 'ses':
        // AWS SES uses SMTP
        return nodemailer.createTransport({
          host: config.sesHost || `email-smtp.${config.sesRegion || 'us-east-1'}.amazonaws.com`,
          port: 587,
          secure: false,
          auth: {
            user: config.sesAccessKeyId,
            pass: config.sesSecretAccessKey
          }
        });

      default:
        throw new Error(`Unsupported email provider: ${provider}`);
    }
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
    try {
      const config = await this.getConfig(tenantId);
      if (!config) {
        return {
          success: false,
          error: 'Email not configured for this tenant'
        };
      }

      // Validate email address
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to)) {
        return {
          success: false,
          error: 'Invalid email address format'
        };
      }

      // Check rate limit
      if (!this.checkRateLimit(tenantId)) {
        return {
          success: false,
          error: 'Rate limit exceeded (1000 emails per day)'
        };
      }

      const transporter = await this.createTransporter(config);
      const fromEmail = from || config.fromEmail || config.smtpUser;

      if (!fromEmail) {
        return {
          success: false,
          error: 'Sender email address not configured'
        };
      }

      const mailOptions = {
        from: config.fromName ? `${config.fromName} <${fromEmail}>` : fromEmail,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML if no text provided
        attachments
      };

      const info = await transporter.sendMail(mailOptions);

      console.log('[Email] Message sent successfully:', {
        tenantId,
        to: to.substring(0, 5) + '***', // Partial email for privacy
        subject,
        messageId: info.messageId
      });

      return {
        success: true,
        messageId: info.messageId,
        data: info
      };

    } catch (error) {
      console.error('[Email] Error sending message:', {
        error: error.message,
        tenantId
      });

      return {
        success: false,
        error: error.message || 'Failed to send email message'
      };
    }
  }

  /**
   * Test email connection
   * @param {Object} config - Email configuration to test
   * @returns {Promise<Object>} - Test result
   */
  async testConnection(config) {
    try {
      const provider = config.provider || 'smtp';
      
      // Validate required fields based on provider
      switch (provider) {
        case 'smtp':
          if (!config.smtpHost || !config.smtpUser || !config.smtpPassword) {
            return {
              success: false,
              error: 'SMTP Host, User, and Password are required'
            };
          }
          break;

        case 'sendgrid':
          if (!config.sendgridApiKey) {
            return {
              success: false,
              error: 'SendGrid API Key is required'
            };
          }
          break;

        case 'ses':
          if (!config.sesAccessKeyId || !config.sesSecretAccessKey) {
            return {
              success: false,
              error: 'AWS SES Access Key ID and Secret Access Key are required'
            };
          }
          break;

        default:
          return {
            success: false,
            error: `Unsupported email provider: ${provider}`
          };
      }

      // Test connection by creating transporter and verifying
      const transporter = await this.createTransporter(config);
      await transporter.verify();

      return {
        success: true,
        message: 'Email connection verified successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to verify email connection'
      };
    }
  }
}

module.exports = new EmailService();
