const axios = require('axios');
const crypto = require('crypto');
const { formatToE164, isValidPhoneNumber } = require('../utils/phoneUtils');
const { Setting } = require('../models');

class WhatsAppService {
  constructor() {
    this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
    this.rateLimitCache = new Map(); // Simple in-memory rate limiting
    this.maxConversationsPerDay = 1000;
  }

  /**
   * Get WhatsApp configuration for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object|null>} - WhatsApp configuration or null
   */
  async getConfig(tenantId) {
    try {
      const setting = await Setting.findOne({
        where: { tenantId, key: 'whatsapp' }
      });

      if (!setting || !setting.value?.enabled) {
        return null;
      }

      return setting.value;
    } catch (error) {
      console.error('[WhatsApp] Error getting config:', error);
      return null;
    }
  }

  /**
   * Validate phone number format
   * @param {string} phone - Phone number
   * @returns {string|null} - Formatted E.164 phone number or null
   */
  validatePhoneNumber(phone) {
    if (!phone) return null;
    const formatted = formatToE164(phone);
    return formatted && isValidPhoneNumber(formatted) ? formatted : null;
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
    
    if (count >= this.maxConversationsPerDay) {
      return false;
    }
    
    this.rateLimitCache.set(key, count + 1);
    return true;
  }

  /**
   * Send template message via WhatsApp Business API
   * @param {string} tenantId - Tenant ID
   * @param {string} phoneNumber - Recipient phone number (E.164 format)
   * @param {string} templateName - Template name (must be pre-approved in Meta)
   * @param {Array} parameters - Template parameters
   * @param {string} language - Template language (default: 'en')
   * @returns {Promise<Object>} - API response
   */
  async sendMessage(tenantId, phoneNumber, templateName, parameters = [], language = 'en') {
    try {
      const config = await this.getConfig(tenantId);
      if (!config) {
        return {
          success: false,
          error: 'WhatsApp not configured for this tenant'
        };
      }

      // Validate phone number
      const formattedPhone = this.validatePhoneNumber(phoneNumber);
      if (!formattedPhone) {
        return {
          success: false,
          error: 'Invalid phone number format'
        };
      }

      // Check rate limit
      if (!this.checkRateLimit(tenantId)) {
        return {
          success: false,
          error: 'Rate limit exceeded (1000 conversations per day)'
        };
      }

      const url = `${this.baseUrl}/${config.phoneNumberId}/messages`;
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: language
          },
          components: [
            {
              type: 'body',
              parameters: parameters.map(param => ({
                type: 'text',
                text: String(param)
              }))
            }
          ]
        }
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('[WhatsApp] Message sent successfully:', {
        tenantId,
        phoneNumber: formattedPhone.substring(0, 7) + '***', // Partial phone for privacy
        templateName,
        messageId: response.data?.messages?.[0]?.id
      });

      return {
        success: true,
        messageId: response.data?.messages?.[0]?.id,
        data: response.data
      };

    } catch (error) {
      console.error('[WhatsApp] Error sending message:', {
        error: error.response?.data || error.message,
        tenantId,
        templateName
      });

      // Handle specific error cases
      if (error.response?.status === 429) {
        return {
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: error.response.headers['retry-after']
        };
      }

      if (error.response?.status === 400) {
        return {
          success: false,
          error: error.response.data?.error?.message || 'Invalid request',
          details: error.response.data?.error
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to send WhatsApp message'
      };
    }
  }

  /**
   * Send free-form text message (only for approved 24-hour window conversations)
   * @param {string} tenantId - Tenant ID
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} message - Message text
   * @returns {Promise<Object>} - API response
   */
  async sendTextMessage(tenantId, phoneNumber, message) {
    try {
      const config = await this.getConfig(tenantId);
      if (!config) {
        return {
          success: false,
          error: 'WhatsApp not configured for this tenant'
        };
      }

      const formattedPhone = this.validatePhoneNumber(phoneNumber);
      if (!formattedPhone) {
        return {
          success: false,
          error: 'Invalid phone number format'
        };
      }

      if (!this.checkRateLimit(tenantId)) {
        return {
          success: false,
          error: 'Rate limit exceeded'
        };
      }

      const url = `${this.baseUrl}/${config.phoneNumberId}/messages`;
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'text',
        text: {
          body: message
        }
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return {
        success: true,
        messageId: response.data?.messages?.[0]?.id,
        data: response.data
      };

    } catch (error) {
      console.error('[WhatsApp] Error sending text message:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  /**
   * Test WhatsApp connection
   * @param {string} accessToken - Access token to test
   * @param {string} phoneNumberId - Phone number ID to test
   * @returns {Promise<Object>} - Test result
   */
  async testConnection(accessToken, phoneNumberId) {
    try {
      const url = `${this.baseUrl}/${phoneNumberId}`;
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: {
          fields: 'verified_name,display_phone_number,quality_rating'
        },
        timeout: 10000
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  /**
   * Verify webhook signature
   * @param {string} signature - X-Hub-Signature-256 header value
   * @param {string} payload - Raw request body
   * @param {string} appSecret - WhatsApp App Secret
   * @returns {boolean} - True if signature is valid
   */
  verifyWebhookSignature(signature, payload, appSecret) {
    if (!signature || !appSecret) return false;

    const hash = crypto
      .createHmac('sha256', appSecret)
      .update(payload)
      .digest('hex');

    const expectedSignature = `sha256=${hash}`;
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Handle webhook data from Meta
   * @param {Object} webhookData - Webhook payload from Meta
   * @returns {Object} - Processed webhook data
   */
  handleWebhook(webhookData) {
    const entries = webhookData.entry || [];
    const results = [];

    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field === 'messages') {
          const value = change.value;
          
          // Handle message status updates
          if (value.statuses) {
            for (const status of value.statuses) {
              results.push({
                type: 'status',
                messageId: status.id,
                status: status.status, // sent, delivered, read, failed
                timestamp: status.timestamp,
                recipientId: status.recipient_id
              });
            }
          }

          // Handle incoming messages (for future two-way messaging)
          if (value.messages) {
            for (const message of value.messages) {
              results.push({
                type: 'message',
                messageId: message.id,
                from: message.from,
                timestamp: message.timestamp,
                messageType: message.type,
                text: message.text?.body
              });
            }
          }
        }
      }
    }

    return results;
  }
}

module.exports = new WhatsAppService();
