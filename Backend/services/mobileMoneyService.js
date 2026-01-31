const axios = require('axios');
const crypto = require('crypto');

/**
 * Mobile Money Service
 * Integrates with MTN Mobile Money and Airtel Money APIs
 * for payment collection in African markets
 */

// MTN MoMo API Configuration
const MTN_CONFIG = {
  baseUrl: process.env.MTN_MOMO_BASE_URL || 'https://sandbox.momodeveloper.mtn.com',
  collectionApiUrl: process.env.MTN_MOMO_COLLECTION_URL || 'https://sandbox.momodeveloper.mtn.com/collection',
  subscriptionKey: process.env.MTN_MOMO_SUBSCRIPTION_KEY,
  apiUser: process.env.MTN_MOMO_API_USER,
  apiKey: process.env.MTN_MOMO_API_KEY,
  environment: process.env.MTN_MOMO_ENVIRONMENT || 'sandbox',
  callbackUrl: process.env.MTN_MOMO_CALLBACK_URL
};

// Airtel Money API Configuration
const AIRTEL_CONFIG = {
  baseUrl: process.env.AIRTEL_MONEY_BASE_URL || 'https://openapi.airtel.africa',
  clientId: process.env.AIRTEL_MONEY_CLIENT_ID,
  clientSecret: process.env.AIRTEL_MONEY_CLIENT_SECRET,
  environment: process.env.AIRTEL_MONEY_ENVIRONMENT || 'sandbox',
  callbackUrl: process.env.AIRTEL_MONEY_CALLBACK_URL
};

/**
 * Generate UUID v4 for transaction references
 */
const generateUUID = () => {
  return crypto.randomUUID();
};

/**
 * MTN Mobile Money Service
 */
const mtnMoMo = {
  /**
   * Get OAuth access token for MTN MoMo API
   */
  getAccessToken: async () => {
    try {
      const credentials = Buffer.from(`${MTN_CONFIG.apiUser}:${MTN_CONFIG.apiKey}`).toString('base64');
      
      const response = await axios.post(
        `${MTN_CONFIG.collectionApiUrl}/token/`,
        null,
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Ocp-Apim-Subscription-Key': MTN_CONFIG.subscriptionKey,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      return response.data.access_token;
    } catch (error) {
      console.error('[MTN MoMo] Error getting access token:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with MTN MoMo API');
    }
  },

  /**
   * Request payment from customer (Collection)
   * @param {Object} params - Payment parameters
   * @param {string} params.phoneNumber - Customer phone number (format: 233XXXXXXXXX)
   * @param {number} params.amount - Amount to collect
   * @param {string} params.currency - Currency code (e.g., GHS, UGX)
   * @param {string} params.externalId - Your reference ID
   * @param {string} params.payerMessage - Message to show payer
   * @param {string} params.payeeNote - Note for your records
   */
  requestPayment: async ({ phoneNumber, amount, currency = 'GHS', externalId, payerMessage, payeeNote }) => {
    try {
      const accessToken = await mtnMoMo.getAccessToken();
      const referenceId = generateUUID();
      
      const payload = {
        amount: amount.toString(),
        currency,
        externalId: externalId || referenceId,
        payer: {
          partyIdType: 'MSISDN',
          partyId: phoneNumber.replace(/^\+/, '') // Remove + if present
        },
        payerMessage: payerMessage || 'Payment for purchase',
        payeeNote: payeeNote || 'Shop payment'
      };

      await axios.post(
        `${MTN_CONFIG.collectionApiUrl}/v1_0/requesttopay`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Reference-Id': referenceId,
            'X-Target-Environment': MTN_CONFIG.environment,
            'Ocp-Apim-Subscription-Key': MTN_CONFIG.subscriptionKey,
            'Content-Type': 'application/json',
            ...(MTN_CONFIG.callbackUrl && { 'X-Callback-Url': MTN_CONFIG.callbackUrl })
          }
        }
      );

      return {
        success: true,
        referenceId,
        externalId: payload.externalId,
        status: 'PENDING',
        provider: 'MTN',
        message: 'Payment request sent. Customer will receive a prompt on their phone.'
      };
    } catch (error) {
      console.error('[MTN MoMo] Payment request error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to initiate payment',
        provider: 'MTN'
      };
    }
  },

  /**
   * Check payment status
   * @param {string} referenceId - The X-Reference-Id from the payment request
   */
  checkPaymentStatus: async (referenceId) => {
    try {
      const accessToken = await mtnMoMo.getAccessToken();
      
      const response = await axios.get(
        `${MTN_CONFIG.collectionApiUrl}/v1_0/requesttopay/${referenceId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Target-Environment': MTN_CONFIG.environment,
            'Ocp-Apim-Subscription-Key': MTN_CONFIG.subscriptionKey
          }
        }
      );

      const data = response.data;
      
      return {
        success: true,
        referenceId,
        status: data.status, // PENDING, SUCCESSFUL, FAILED
        amount: data.amount,
        currency: data.currency,
        payerPhone: data.payer?.partyId,
        financialTransactionId: data.financialTransactionId,
        reason: data.reason,
        provider: 'MTN'
      };
    } catch (error) {
      console.error('[MTN MoMo] Status check error:', error.response?.data || error.message);
      return {
        success: false,
        referenceId,
        status: 'UNKNOWN',
        error: error.response?.data?.message || 'Failed to check payment status',
        provider: 'MTN'
      };
    }
  },

  /**
   * Validate account holder (check if phone number is valid)
   */
  validateAccount: async (phoneNumber) => {
    try {
      const accessToken = await mtnMoMo.getAccessToken();
      
      const response = await axios.get(
        `${MTN_CONFIG.collectionApiUrl}/v1_0/accountholder/msisdn/${phoneNumber.replace(/^\+/, '')}/basicuserinfo`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Target-Environment': MTN_CONFIG.environment,
            'Ocp-Apim-Subscription-Key': MTN_CONFIG.subscriptionKey
          }
        }
      );

      return {
        success: true,
        valid: true,
        name: response.data.name,
        provider: 'MTN'
      };
    } catch (error) {
      return {
        success: false,
        valid: false,
        error: 'Account not found or invalid',
        provider: 'MTN'
      };
    }
  }
};

/**
 * Airtel Money Service
 */
const airtelMoney = {
  /**
   * Get OAuth access token for Airtel Money API
   */
  getAccessToken: async () => {
    try {
      const response = await axios.post(
        `${AIRTEL_CONFIG.baseUrl}/auth/oauth2/token`,
        {
          client_id: AIRTEL_CONFIG.clientId,
          client_secret: AIRTEL_CONFIG.clientSecret,
          grant_type: 'client_credentials'
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data.access_token;
    } catch (error) {
      console.error('[Airtel Money] Error getting access token:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Airtel Money API');
    }
  },

  /**
   * Request payment from customer (Collection)
   * @param {Object} params - Payment parameters
   * @param {string} params.phoneNumber - Customer phone number (format: 233XXXXXXXXX)
   * @param {number} params.amount - Amount to collect
   * @param {string} params.currency - Currency code (e.g., GHS, UGX, KES)
   * @param {string} params.country - Country code (e.g., GH, UG, KE)
   * @param {string} params.reference - Your transaction reference
   */
  requestPayment: async ({ phoneNumber, amount, currency = 'GHS', country = 'GH', reference }) => {
    try {
      const accessToken = await airtelMoney.getAccessToken();
      const transactionId = reference || generateUUID();
      
      const payload = {
        reference: transactionId,
        subscriber: {
          country,
          currency,
          msisdn: phoneNumber.replace(/^\+/, '').replace(/^233/, '').replace(/^256/, '').replace(/^254/, '')
        },
        transaction: {
          amount,
          country,
          currency,
          id: transactionId
        }
      };

      const response = await axios.post(
        `${AIRTEL_CONFIG.baseUrl}/merchant/v1/payments/`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Country': country,
            'X-Currency': currency
          }
        }
      );

      const data = response.data?.data;
      
      return {
        success: data?.transaction?.status === 'TS' || data?.transaction?.status === 'TIP',
        referenceId: transactionId,
        airtelTransactionId: data?.transaction?.id,
        status: data?.transaction?.status === 'TS' ? 'SUCCESSFUL' : 'PENDING',
        provider: 'AIRTEL',
        message: data?.transaction?.message || 'Payment request sent'
      };
    } catch (error) {
      console.error('[Airtel Money] Payment request error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.status?.message || 'Failed to initiate payment',
        provider: 'AIRTEL'
      };
    }
  },

  /**
   * Check payment status
   * @param {string} transactionId - The transaction ID
   */
  checkPaymentStatus: async (transactionId) => {
    try {
      const accessToken = await airtelMoney.getAccessToken();
      
      const response = await axios.get(
        `${AIRTEL_CONFIG.baseUrl}/standard/v1/payments/${transactionId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = response.data?.data;
      const statusMap = {
        'TS': 'SUCCESSFUL',
        'TF': 'FAILED',
        'TA': 'AMBIGUOUS',
        'TIP': 'PENDING'
      };
      
      return {
        success: true,
        referenceId: transactionId,
        status: statusMap[data?.transaction?.status] || 'UNKNOWN',
        message: data?.transaction?.message,
        provider: 'AIRTEL'
      };
    } catch (error) {
      console.error('[Airtel Money] Status check error:', error.response?.data || error.message);
      return {
        success: false,
        referenceId: transactionId,
        status: 'UNKNOWN',
        error: error.response?.data?.status?.message || 'Failed to check payment status',
        provider: 'AIRTEL'
      };
    }
  }
};

/**
 * Unified Mobile Money Interface
 * Automatically routes to the appropriate provider based on phone number
 */
const mobileMoneyService = {
  /**
   * Detect provider from phone number
   * @param {string} phoneNumber - Phone number to check
   * @returns {string} Provider name (MTN, AIRTEL, UNKNOWN)
   */
  detectProvider: (phoneNumber) => {
    // Remove + and country code, get network prefix
    const cleaned = phoneNumber.replace(/^\+/, '').replace(/\s/g, '');
    
    // Ghana prefixes
    if (cleaned.startsWith('233')) {
      const prefix = cleaned.substring(3, 5);
      // MTN Ghana: 24, 54, 55, 59
      if (['24', '54', '55', '59'].includes(prefix)) return 'MTN';
      // Airtel/Tigo Ghana: 26, 27, 57
      if (['26', '27', '57'].includes(prefix)) return 'AIRTEL';
    }
    
    // Uganda prefixes
    if (cleaned.startsWith('256')) {
      const prefix = cleaned.substring(3, 5);
      // MTN Uganda: 77, 78, 76
      if (['77', '78', '76'].includes(prefix)) return 'MTN';
      // Airtel Uganda: 70, 75
      if (['70', '75'].includes(prefix)) return 'AIRTEL';
    }
    
    // Kenya prefixes
    if (cleaned.startsWith('254')) {
      const prefix = cleaned.substring(3, 5);
      // Safaricom/M-Pesa: 70, 71, 72, 79
      // Airtel Kenya: 73, 78
      if (['73', '78'].includes(prefix)) return 'AIRTEL';
    }
    
    return 'UNKNOWN';
  },

  /**
   * Request payment (auto-routes to correct provider)
   */
  requestPayment: async (params) => {
    const provider = params.provider || mobileMoneyService.detectProvider(params.phoneNumber);
    
    if (provider === 'MTN') {
      return mtnMoMo.requestPayment(params);
    } else if (provider === 'AIRTEL') {
      return airtelMoney.requestPayment(params);
    }
    
    return {
      success: false,
      error: 'Unable to detect mobile money provider. Please specify provider.',
      provider: 'UNKNOWN'
    };
  },

  /**
   * Check payment status (requires knowing the provider)
   */
  checkPaymentStatus: async (referenceId, provider) => {
    if (provider === 'MTN') {
      return mtnMoMo.checkPaymentStatus(referenceId);
    } else if (provider === 'AIRTEL') {
      return airtelMoney.checkPaymentStatus(referenceId);
    }
    
    return {
      success: false,
      error: 'Provider not specified',
      provider: 'UNKNOWN'
    };
  },

  /**
   * Validate phone number for mobile money
   */
  validateAccount: async (phoneNumber, provider) => {
    const detectedProvider = provider || mobileMoneyService.detectProvider(phoneNumber);
    
    if (detectedProvider === 'MTN') {
      return mtnMoMo.validateAccount(phoneNumber);
    }
    
    // Airtel doesn't have a validation endpoint in same way
    return {
      success: true,
      valid: true,
      provider: detectedProvider,
      message: 'Phone number format is valid'
    };
  },

  // Expose individual provider APIs
  mtn: mtnMoMo,
  airtel: airtelMoney
};

module.exports = mobileMoneyService;
