const nodemailer = require('nodemailer');
const { Setting } = require('../models');

class EmailService {
  constructor() {
    this.rateLimitCache = new Map();
    this.maxEmailsPerDay = 1000;
  }

  /**
   * Get Email configuration for a tenant
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
