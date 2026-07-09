const axios = require('axios');
const { formatToE164, isValidPhoneNumber } = require('../utils/phoneUtils');
const { Setting } = require('../models');
const { getSavedPlatformSmsConfig } = require('./platformSmsSettingsService');
const {
  checkPlatformSmsLimit,
  incrementPlatformSmsUsage,
} = require('./platformSmsUsageService');

const ARKESEL_BASE_URL = 'https://sms.arkesel.com';
const SMS_PROVIDER_TIMEOUT_MS = 10000;

/**
 * Normalize provider errors, including axios timeouts.
 * @param {Error} error
 * @returns {string}
 */
function formatSmsProviderError(error) {
  const code = error?.code;
  const message = String(error?.message || '');
  if (code === 'ECONNABORTED' || /timeout/i.test(message)) {
    return 'SMS provider timed out - check credentials and network connectivity';
  }
  return error?.response?.data?.message
    || error?.response?.data?.Message
    || error?.response?.data?.errorMessage
    || error?.response?.data?.error
    || message
    || 'Failed to send SMS message';
}

/**
 * Format E.164 phone for Arkesel recipients array (digits only, no +).
 * @param {string} e164Phone
 * @returns {string}
 */
function toArkeselRecipient(e164Phone) {
  return String(e164Phone || '').replace(/^\+/, '');
}

/**
 * Whether tenant SMS config has valid credentials for its provider.
 * @param {Object} config
 * @returns {boolean}
 */
function hasValidTenantSmsCredentials(config) {
  if (!config?.enabled) return false;
  const provider = (config.provider || 'termii').toLowerCase();

  if (provider === 'termii') {
    return Boolean(config.apiKey && String(config.senderId || '').trim());
  }
  if (provider === 'arkesel') {
    return Boolean(config.apiKey && String(config.senderId || '').trim());
  }
  if (provider === 'twilio') {
    return Boolean(config.accountSid && config.authToken && config.fromNumber);
  }
  if (provider === 'africas_talking') {
    return Boolean(config.apiKey && config.username && config.fromNumber);
  }
  return false;
}

class SMSService {
  /**
   * Get SMS configuration for a tenant (tenant-only, no platform fallback)
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object|null>} - SMS configuration or null
   */
  async getConfig(tenantId) {
    try {
      const setting = await Setting.findOne({
        where: { tenantId, key: 'sms' },
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
   * Whether platform SMS is configured in admin settings.
   * @returns {Promise<boolean>}
   */
  async isPlatformSmsEnabled() {
    const config = await getSavedPlatformSmsConfig();
    return config !== null;
  }

  /**
   * Synchronous helper for legacy callers; prefer isPlatformSmsEnabled().
   * @returns {boolean}
   */
  isPlatformSmsEnabledSync() {
    return false;
  }

  /**
   * Resolve SMS config:
   * 1. Tenant own SMS (enabled + valid creds) → source tenant, limited false
   * 2. Platform SMS (enabled + Arkesel creds) → source platform, limited true
   * 3. null
   * @param {string} tenantId
   * @returns {Promise<Object|null>}
   */
  async getResolvedConfig(tenantId) {
    const tenantConfig = await this.getConfig(tenantId);
    if (hasValidTenantSmsCredentials(tenantConfig)) {
      return {
        ...tenantConfig,
        source: 'tenant',
        limited: false,
      };
    }

    const platformConfig = await getSavedPlatformSmsConfig();
    if (platformConfig) {
      return platformConfig;
    }

    return null;
  }

  /**
   * @param {string} tenantId
   * @returns {Promise<'own'|'platform'|'none'>}
   */
  async getSmsMode(tenantId) {
    const resolved = await this.getResolvedConfig(tenantId);
    if (!resolved) return 'none';
    return resolved.source === 'tenant' ? 'own' : 'platform';
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
   * Legacy rate-limit check — platform monthly limits are enforced in sendMessage.
   * @deprecated
   * @param {string} tenantId
   * @returns {boolean}
   */
  checkRateLimit(tenantId) {
    void tenantId;
    return true;
  }

  /**
   * Send SMS via resolved tenant or platform config.
   * @param {string} tenantId
   * @param {string} phoneNumber
   * @param {string} message
   * @param {string|null} fromNumber
   * @param {object} [options]
   * @param {number} [options.usageCount=1] - Recipients to count against platform quota
   * @returns {Promise<Object>}
   */
  async sendMessage(tenantId, phoneNumber, message, fromNumber = null, options = {}) {
    try {
      const config = await this.getResolvedConfig(tenantId);
      if (!config) {
        return {
          success: false,
          error: 'SMS not configured for this tenant',
          errorCode: 'SMS_NOT_CONFIGURED',
        };
      }

      const formattedPhone = this.validatePhoneNumber(phoneNumber);
      if (!formattedPhone) {
        return {
          success: false,
          error: 'Invalid phone number format',
          errorCode: 'INVALID_PHONE',
        };
      }

      const usageCount = Math.max(1, parseInt(options.usageCount, 10) || 1);
      if (config.limited) {
        const limitCheck = await checkPlatformSmsLimit(tenantId, usageCount);
        if (!limitCheck.allowed) {
          return {
            success: false,
            error: limitCheck.error,
            errorCode: limitCheck.errorCode,
            usage: limitCheck.summary,
          };
        }
      }

      const provider = (config.provider || 'termii').toLowerCase();
      let result;

      switch (provider) {
        case 'termii':
          result = await this.sendViaTermii(config, formattedPhone, message, fromNumber);
          break;
        case 'arkesel':
          result = await this.sendViaArkesel(config, formattedPhone, message, fromNumber);
          break;
        case 'twilio':
          result = await this.sendViaTwilio(config, formattedPhone, message, fromNumber);
          break;
        case 'africas_talking':
          result = await this.sendViaAfricasTalking(config, formattedPhone, message, fromNumber);
          break;
        default:
          return {
            success: false,
            error: `Unsupported SMS provider: ${provider}`,
            errorCode: 'UNSUPPORTED_PROVIDER',
          };
      }

      if (result.success && config.limited) {
        try {
          await incrementPlatformSmsUsage(tenantId, usageCount);
        } catch (usageError) {
          console.error('[SMS] Failed to increment platform usage counter:', usageError?.message);
        }
      }

      return {
        ...result,
        source: config.source,
        limited: config.limited,
      };
    } catch (error) {
      console.error('[SMS] Error sending message:', {
        error: error.response?.data || error.message,
        tenantId,
      });

      return {
        success: false,
        error: error.message || 'Failed to send SMS message',
      };
    }
  }

  async sendViaTwilio(config, to, message, from) {
    try {
      const accountSid = config.accountSid;
      const authToken = config.authToken;
      const fromNumber = from || config.fromNumber;

      if (!accountSid || !authToken || !fromNumber) {
        return {
          success: false,
          error: 'Twilio credentials not configured',
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
          password: authToken,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: SMS_PROVIDER_TIMEOUT_MS,
      });

      console.log('[SMS] Message sent successfully via Twilio:', {
        phoneNumber: to.substring(0, 7) + '***',
        messageId: response.data?.sid,
      });

      return {
        success: true,
        messageId: response.data?.sid,
        data: response.data,
      };
    } catch (error) {
      console.error('[SMS] Twilio error:', error.response?.data || error.message);
      return {
        success: false,
        error: formatSmsProviderError(error),
      };
    }
  }

  async sendViaTermii(config, to, message, from) {
    try {
      const apiKey = config.apiKey;
      const senderId = from || config.senderId || config.fromNumber || '';

      if (!apiKey || !senderId) {
        return {
          success: false,
          error: 'Termii API Key and Sender ID are required',
        };
      }

      const baseUrl = process.env.TERMII_BASE_URL || 'https://api.termii.com';
      const url = `${baseUrl}/api/sms/send`;
      const toTermii = to.replace(/^\+/, '');

      const payload = {
        api_key: apiKey,
        to: toTermii,
        from: senderId.substring(0, 11),
        sms: message,
        type: 'plain',
        channel: 'dnd',
      };

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: SMS_PROVIDER_TIMEOUT_MS,
      });

      const messageId = response.data?.message_id || response.data?.messageId;
      console.log('[SMS] Message sent successfully via Termii:', {
        phoneNumber: to.substring(0, 7) + '***',
        messageId,
      });

      return {
        success: true,
        messageId: messageId || response.data?.message_id,
        data: response.data,
      };
    } catch (error) {
      console.error('[SMS] Termii error:', error.response?.data || error.message);
      return {
        success: false,
        error: formatSmsProviderError(error),
      };
    }
  }

  async sendViaArkesel(config, to, message, from) {
    try {
      const apiKey = config.apiKey;
      const senderId = (from || config.senderId || '').substring(0, 11);

      if (!apiKey || !senderId) {
        return {
          success: false,
          error: 'Arkesel API key and Sender ID are required',
        };
      }

      const url = `${ARKESEL_BASE_URL}/api/v2/sms/send`;
      const response = await axios.post(
        url,
        {
          sender: senderId,
          message,
          recipients: [toArkeselRecipient(to)],
        },
        {
          headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
          },
          timeout: SMS_PROVIDER_TIMEOUT_MS,
        }
      );

      const messageId = response.data?.data?.[0]?.id
        || response.data?.data?.[0]?.message_id
        || response.data?.message_id;

      console.log('[SMS] Message sent successfully via Arkesel:', {
        phoneNumber: to.substring(0, 7) + '***',
        messageId,
      });

      return {
        success: true,
        messageId,
        data: response.data,
      };
    } catch (error) {
      console.error('[SMS] Arkesel error:', error.response?.data || error.message);
      return {
        success: false,
        error: formatSmsProviderError(error),
      };
    }
  }

  async sendViaAfricasTalking(config, to, message, from) {
    try {
      const apiKey = config.apiKey;
      const username = config.username;
      const fromNumber = from || config.fromNumber;

      if (!apiKey || !username || !fromNumber) {
        return {
          success: false,
          error: 'Africa\'s Talking credentials not configured',
        };
      }

      const url = 'https://api.africastalking.com/version1/messaging';

      const response = await axios.post(
        url,
        {
          username,
          to,
          message,
          from: fromNumber,
        },
        {
          headers: {
            ApiKey: apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout: SMS_PROVIDER_TIMEOUT_MS,
        }
      );

      console.log('[SMS] Message sent successfully via Africa\'s Talking:', {
        phoneNumber: to.substring(0, 7) + '***',
        messageId: response.data?.SMSMessageData?.Recipients?.[0]?.messageId,
      });

      return {
        success: true,
        messageId: response.data?.SMSMessageData?.Recipients?.[0]?.messageId,
        data: response.data,
      };
    } catch (error) {
      console.error('[SMS] Africa\'s Talking error:', error.response?.data || error.message);
      return {
        success: false,
        error: formatSmsProviderError(error),
      };
    }
  }

  /**
   * Test SMS connection
   * @param {Object} config
   * @param {object} [meta]
   * @returns {Promise<Object>}
   */
  async testConnection(config, meta = {}) {
    void meta;
    try {
      const provider = (config.provider || 'termii').toLowerCase();

      switch (provider) {
        case 'termii': {
          if (!config.apiKey) {
            return { success: false, error: 'Termii API Key is required' };
          }
          const termiiBaseUrl = process.env.TERMII_BASE_URL || 'https://api.termii.com';
          const balanceUrl = `${termiiBaseUrl}/api/get-balance`;
          const termiiResponse = await axios.get(balanceUrl, {
            params: { api_key: config.apiKey },
            timeout: SMS_PROVIDER_TIMEOUT_MS,
          });
          return {
            success: true,
            message: 'Termii connection verified',
            data: {
              balance: termiiResponse.data?.balance,
              currency: termiiResponse.data?.currency || 'NGN',
              user: termiiResponse.data?.user,
            },
          };
        }

        case 'arkesel': {
          if (!config.apiKey) {
            return { success: false, error: 'Arkesel API key is required' };
          }
          const balanceUrl = `${ARKESEL_BASE_URL}/api/v2/clients/balance-details`;
          const arkeselResponse = await axios.get(balanceUrl, {
            headers: { 'api-key': config.apiKey },
            timeout: SMS_PROVIDER_TIMEOUT_MS,
          });
          return {
            success: true,
            message: 'Arkesel connection verified',
            data: arkeselResponse.data,
          };
        }

        case 'twilio': {
          if (!config.accountSid || !config.authToken) {
            return { success: false, error: 'Twilio Account SID and Auth Token are required' };
          }
          const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}.json`;
          const response = await axios.get(url, {
            auth: {
              username: config.accountSid,
              password: config.authToken,
            },
            timeout: SMS_PROVIDER_TIMEOUT_MS,
          });
          return {
            success: true,
            message: 'Twilio connection verified',
            data: {
              accountName: response.data?.friendly_name,
              status: response.data?.status,
            },
          };
        }

        case 'africas_talking': {
          if (!config.apiKey || !config.username) {
            return { success: false, error: 'Africa\'s Talking API Key and Username are required' };
          }
          const atUrl = 'https://api.africastalking.com/version1/user';
          const atResponse = await axios.get(atUrl, {
            headers: {
              ApiKey: config.apiKey,
              Accept: 'application/json',
            },
            params: { username: config.username },
            timeout: SMS_PROVIDER_TIMEOUT_MS,
          });
          return {
            success: true,
            message: 'Africa\'s Talking connection verified',
            data: atResponse.data,
          };
        }

        default:
          return {
            success: false,
            error: `Unsupported SMS provider: ${provider}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: formatSmsProviderError(error),
      };
    }
  }
}

module.exports = new SMSService();
module.exports.hasValidTenantSmsCredentials = hasValidTenantSmsCredentials;
module.exports.toArkeselRecipient = toArkeselRecipient;
module.exports.formatSmsProviderError = formatSmsProviderError;
