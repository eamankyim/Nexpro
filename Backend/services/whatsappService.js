const axios = require('axios');
const crypto = require('crypto');
const { formatToE164, isValidPhoneNumber } = require('../utils/phoneUtils');
const { Setting } = require('../models');

/**
 * Mask E.164 for logs (no full number).
 * @param {string} e164
 * @returns {string}
 */
function maskPhoneForLog(e164) {
  if (!e164 || typeof e164 !== 'string') return '***';
  if (e164.length <= 6) return `${e164.slice(0, 2)}***`;
  return `${e164.slice(0, 4)}***${e164.slice(-2)}`;
}

/**
 * Non-reversible fingerprint of token for correlating logs (never log raw token).
 * @param {string} token
 * @returns {string}
 */
function accessTokenFingerprint(token) {
  if (!token || typeof token !== 'string') return 'none';
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex').slice(0, 12);
}

/**
 * Normalize Meta Graph API error from axios response.
 * @param {import('axios').AxiosError} error
 * @returns {{ httpStatus: number|null, metaMessage: string, metaType?: string, metaCode?: number, metaSubcode?: number, fbtraceId?: string, errorBodyPreview?: string }}
 */
function extractMetaGraphError(error) {
  const status = error.response?.status ?? null;
  const data = error.response?.data;
  const meta = data?.error && typeof data.error === 'object' ? data.error : null;
  const message =
    meta?.message ||
    meta?.error_user_msg ||
    data?.message ||
    error.message ||
    'Unknown error';
  let preview = '';
  try {
    const s = typeof data === 'object' ? JSON.stringify(data) : String(data);
    preview = s.length > 800 ? `${s.slice(0, 800)}…` : s;
  } catch {
    preview = String(error.message);
  }
  return {
    httpStatus: status,
    metaMessage: message,
    metaType: meta?.type,
    metaCode: typeof meta?.code === 'number' ? meta.code : undefined,
    metaSubcode: meta?.error_subcode ?? meta?.subcode,
    fbtraceId: meta?.fbtrace_id,
    errorBodyPreview: preview
  };
}

/**
 * Build WhatsApp template body parameter payload.
 * Supports both positional values ("text only") and named values
 * for templates that use placeholders like {{customer_name}}.
 *
 * Accepted input examples:
 * - "Eric"
 * - { text: "Eric" }
 * - { name: "customer_name", text: "Eric" }
 * - { parameterName: "customer_name", value: "Eric" }
 *
 * @param {unknown} param
 * @returns {{ type: 'text', text: string, parameter_name?: string }}
 */
function toTemplateParameter(param) {
  if (param && typeof param === 'object' && !Array.isArray(param)) {
    const p = /** @type {{ text?: unknown, value?: unknown, name?: unknown, parameterName?: unknown }} */ (param);
    const textValue = p.text ?? p.value ?? '';
    const parameterName = p.parameterName ?? p.name;
    const payload = {
      type: 'text',
      text: String(textValue)
    };
    if (typeof parameterName === 'string' && parameterName.trim()) {
      payload.parameter_name = parameterName.trim();
    }
    return payload;
  }
  return {
    type: 'text',
    text: String(param ?? '')
  };
}

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
   * @param {Array} parameters - Template body parameters
   * @param {string} language - Template language (default: 'en')
   * @param {{ buttonParameters?: Array<string>, buttonIndex?: number }} [options] - Optional template button URL params
   * @returns {Promise<Object>} - API response
   */
  async sendMessage(tenantId, phoneNumber, templateName, parameters = [], language = 'en', options = {}) {
    /** @type {null | { phoneNumberId: string, accessToken: string }} */
    let config = null;
    /** @type {string|null} */
    let formattedPhone = null;
    try {
      config = await this.getConfig(tenantId);
      if (!config) {
        return {
          success: false,
          error: 'WhatsApp not configured for this tenant'
        };
      }

      // Validate phone number
      formattedPhone = this.validatePhoneNumber(phoneNumber);
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
      const components = [
        {
          type: 'body',
          parameters: parameters.map(toTemplateParameter)
        }
      ];

      if (Array.isArray(options.buttonParameters) && options.buttonParameters.length > 0) {
        components.push({
          type: 'button',
          sub_type: 'url',
          index: String(typeof options.buttonIndex === 'number' ? options.buttonIndex : 0),
          parameters: options.buttonParameters.map((value) => ({
            type: 'text',
            text: String(value ?? '')
          }))
        });
      }

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
          components
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
      const meta = extractMetaGraphError(error);
      let recipientMasked = formattedPhone ? maskPhoneForLog(formattedPhone) : '***';
      if (recipientMasked === '***' && error.config?.data) {
        try {
          const body = JSON.parse(error.config.data);
          recipientMasked = maskPhoneForLog(body?.to);
        } catch {
          /* keep *** */
        }
      }

      console.error('[WhatsApp] Send failed', {
        tenantId,
        templateName,
        language,
        phoneNumberId: config?.phoneNumberId ?? 'unknown',
        recipientMasked,
        tokenFingerprint: config?.accessToken ? accessTokenFingerprint(config.accessToken) : 'none',
        paramCount: parameters.length,
        buttonParamCount: Array.isArray(options?.buttonParameters) ? options.buttonParameters.length : 0,
        httpStatus: meta.httpStatus,
        metaCode: meta.metaCode,
        metaSubcode: meta.metaSubcode,
        metaType: meta.metaType,
        metaMessage: meta.metaMessage,
        fbtraceId: meta.fbtraceId,
        errorBodyPreview: meta.errorBodyPreview
      });

      // Handle specific error cases
      if (error.response?.status === 429) {
        return {
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: error.response.headers['retry-after'],
          meta
        };
      }

      if (error.response?.status === 400) {
        return {
          success: false,
          error: meta.metaMessage || 'Invalid request',
          details: error.response.data?.error,
          meta
        };
      }

      if (error.response?.status === 401 || error.response?.status === 403) {
        return {
          success: false,
          error: meta.metaMessage || `WhatsApp API ${error.response.status}`,
          meta
        };
      }

      return {
        success: false,
        error: meta.metaMessage || error.message || 'Failed to send WhatsApp message',
        meta
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
    let config = null;
    let formattedPhone = null;
    try {
      config = await this.getConfig(tenantId);
      if (!config) {
        return {
          success: false,
          error: 'WhatsApp not configured for this tenant'
        };
      }

      formattedPhone = this.validatePhoneNumber(phoneNumber);
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
      const meta = extractMetaGraphError(error);
      console.error('[WhatsApp] Text send failed', {
        tenantId,
        phoneNumberId: config?.phoneNumberId ?? 'unknown',
        recipientMasked: formattedPhone ? maskPhoneForLog(formattedPhone) : '***',
        tokenFingerprint: config?.accessToken ? accessTokenFingerprint(config.accessToken) : 'none',
        httpStatus: meta.httpStatus,
        metaCode: meta.metaCode,
        metaSubcode: meta.metaSubcode,
        metaType: meta.metaType,
        metaMessage: meta.metaMessage,
        fbtraceId: meta.fbtraceId,
        errorBodyPreview: meta.errorBodyPreview
      });
      return {
        success: false,
        error: meta.metaMessage || error.message,
        meta
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
      const meta = extractMetaGraphError(error);
      console.error('[WhatsApp] testConnection failed', {
        phoneNumberId,
        tokenFingerprint: accessTokenFingerprint(accessToken),
        httpStatus: meta.httpStatus,
        metaCode: meta.metaCode,
        metaSubcode: meta.metaSubcode,
        metaType: meta.metaType,
        metaMessage: meta.metaMessage,
        fbtraceId: meta.fbtraceId,
        errorBodyPreview: meta.errorBodyPreview
      });
      return {
        success: false,
        error: meta.metaMessage || error.message,
        meta
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
    if (!signature || !appSecret || typeof payload !== 'string') return false;

    try {
      const hash = crypto
        .createHmac('sha256', appSecret)
        .update(payload, 'utf8')
        .digest('hex');

      const expectedSignature = `sha256=${hash}`;
      const sigBuf = Buffer.from(String(signature).trim(), 'utf8');
      const expBuf = Buffer.from(expectedSignature, 'utf8');
      if (sigBuf.length !== expBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
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
