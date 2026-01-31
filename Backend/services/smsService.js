const axios = require('axios');
const { formatToE164, isValidPhoneNumber } = require('../utils/phoneUtils');
const { Setting } = require('../models');

class SMSService {
  constructor() {
    this.rateLimitCache = new Map();
    this.maxMessagesPerDay = 1000;
  }

  /**
   * Get SMS configuration for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object|null>} - SMS configuration or null
   */
  async getConfig(tenantId) {
    try {
      const setting = await Setting.findOne({
        where: { tenantId, key: 'sms' }
      });

      if (!setting || !setting.value?.enabled) {
        return null;
      }

      return setting.value;
    } catch (error) {
      console.error('[SMS] Error getting config:', error);
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
    
    if (count >= this.maxMessagesPerDay) {
      return false;
    }
    
    this.rateLimitCache.set(key, count + 1);
    return true;
  }

  /**
   * Send SMS message
   * @param {string} tenantId - Tenant ID
   * @param {string} phoneNumber - Recipient phone number (E.164 format)
   * @param {string} message - Message text
   * @param {string} fromNumber - Sender phone number (optional)
   * @returns {Promise<Object>} - API response
   */
  async sendMessage(tenantId, phoneNumber, message, fromNumber = null) {
    try {
      const config = await this.getConfig(tenantId);
      if (!config) {
        return {
          success: false,
          error: 'SMS not configured for this tenant'
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
          error: 'Rate limit exceeded (1000 messages per day)'
        };
      }

      // Use provider-specific implementation
      const provider = config.provider || 'twilio';
      
      switch (provider) {
        case 'twilio':
          return await this.sendViaTwilio(config, formattedPhone, message, fromNumber);
        case 'africas_talking':
          return await this.sendViaAfricasTalking(config, formattedPhone, message, fromNumber);
        default:
          return {
            success: false,
            error: `Unsupported SMS provider: ${provider}`
          };
      }
    } catch (error) {
      console.error('[SMS] Error sending message:', {
        error: error.response?.data || error.message,
        tenantId
      });

      return {
        success: false,
        error: error.message || 'Failed to send SMS message'
      };
    }
  }

  /**
   * Send SMS via Twilio
   * @param {Object} config - SMS configuration
   * @param {string} to - Recipient phone number
   * @param {string} message - Message text
   * @param {string} from - Sender phone number
   * @returns {Promise<Object>} - API response
   */
  async sendViaTwilio(config, to, message, from) {
    try {
      const accountSid = config.accountSid;
      const authToken = config.authToken;
      const fromNumber = from || config.fromNumber;

      if (!accountSid || !authToken || !fromNumber) {
        return {
          success: false,
          error: 'Twilio credentials not configured'
        };
      }

      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      
      const formData = new URLSearchParams();
      formData.append('To', to);
      formData.append('From', fromNumber);
      formData.append('Body', message);

      const response = await axios.post(url, formData, {
        auth: {
          username: accountSid,
          password: authToken
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      });

      console.log('[SMS] Message sent successfully via Twilio:', {
        phoneNumber: to.substring(0, 7) + '***',
        messageId: response.data?.sid
      });

      return {
        success: true,
        messageId: response.data?.sid,
        data: response.data
      };
    } catch (error) {
      console.error('[SMS] Twilio error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Send SMS via Africa's Talking
   * @param {Object} config - SMS configuration
   * @param {string} to - Recipient phone number
   * @param {string} message - Message text
   * @param {string} from - Sender phone number
   * @returns {Promise<Object>} - API response
   */
  async sendViaAfricasTalking(config, to, message, from) {
    try {
      const apiKey = config.apiKey;
      const username = config.username;
      const fromNumber = from || config.fromNumber;

      if (!apiKey || !username || !fromNumber) {
        return {
          success: false,
          error: 'Africa\'s Talking credentials not configured'
        };
      }

      const url = 'https://api.africastalking.com/version1/messaging';
      
      const response = await axios.post(url, {
        username,
        to,
        message,
        from: fromNumber
      }, {
        headers: {
          'ApiKey': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      console.log('[SMS] Message sent successfully via Africa\'s Talking:', {
        phoneNumber: to.substring(0, 7) + '***',
        messageId: response.data?.SMSMessageData?.Recipients?.[0]?.messageId
      });

      return {
        success: true,
        messageId: response.data?.SMSMessageData?.Recipients?.[0]?.messageId,
        data: response.data
      };
    } catch (error) {
      console.error('[SMS] Africa\'s Talking error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errorMessage || error.message
      };
    }
  }

  /**
   * Test SMS connection
   * @param {Object} config - SMS configuration to test
   * @returns {Promise<Object>} - Test result
   */
  async testConnection(config) {
    try {
      const provider = config.provider || 'twilio';
      
      switch (provider) {
        case 'twilio':
          if (!config.accountSid || !config.authToken) {
            return {
              success: false,
              error: 'Twilio Account SID and Auth Token are required'
            };
          }
          
          // Test by fetching account info
          const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}.json`;
          const response = await axios.get(url, {
            auth: {
              username: config.accountSid,
              password: config.authToken
            },
            timeout: 10000
          });

          return {
            success: true,
            data: {
              accountName: response.data?.friendly_name,
              status: response.data?.status
            }
          };

        case 'africas_talking':
          if (!config.apiKey || !config.username) {
            return {
              success: false,
              error: 'Africa\'s Talking API Key and Username are required'
            };
          }
          
          // Test by checking user info
          const atUrl = `https://api.africastalking.com/version1/user`;
          const atResponse = await axios.get(atUrl, {
            headers: {
              'ApiKey': config.apiKey,
              'Accept': 'application/json'
            },
            params: {
              username: config.username
            },
            timeout: 10000
          });

          return {
            success: true,
            data: atResponse.data
          };

        default:
          return {
            success: false,
            error: `Unsupported SMS provider: ${provider}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.response?.data?.errorMessage || error.message
      };
    }
  }
}

module.exports = new SMSService();
