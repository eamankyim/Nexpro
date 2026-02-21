const axios = require('axios');

/**
 * Paystack Service
 * Handles all Paystack API interactions
 */
class PaystackService {
  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
    this.publicKey = process.env.PAYSTACK_PUBLIC_KEY;
    this.baseURL = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';
    /** Optional subaccount code for split payments (e.g. ACCT_xxxxx) */
    this.subaccountCode = process.env.PAYSTACK_SUBACCOUNT_CODE || null;

    if (!this.secretKey) {
      console.warn('[Paystack] PAYSTACK_SECRET_KEY not set. Paystack features will be disabled.');
    }
  }

  /**
   * Get authorization headers
   */
  getHeaders() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Create a customer in Paystack
   * @param {Object} customerData - { email, first_name, last_name, phone }
   * @returns {Promise<Object>} Paystack customer object
   */
  async createCustomer(customerData) {
    try {
      const response = await axios.post(
        `${this.baseURL}/customer`,
        customerData,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('[Paystack] Error creating customer:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Initialize a one-time or subscription transaction
   * @param {Object} params - { email, amount, callback_url, reference, metadata, plan?, subaccount?, transaction_charge?, bearer? }
   * @returns {Promise<Object>} { authorization_url, access_code, reference }
   */
  async initializeTransaction(params) {
    try {
      const payload = {
        email: params.email,
        currency: params.currency || 'GHS',
        callback_url: params.callback_url,
        reference: params.reference,
        metadata: params.metadata,
        channels: params.channels || ['card', 'bank', 'mobile_money', 'bank_transfer']
      };
      if (params.plan) {
        payload.plan = params.plan;
      } else if (params.amount != null) {
        payload.amount = String(params.amount);
      }
      if (params.subaccount) payload.subaccount = params.subaccount;
      if (params.transaction_charge != null) payload.transaction_charge = params.transaction_charge;
      if (params.bearer) payload.bearer = params.bearer;

      const response = await axios.post(
        `${this.baseURL}/transaction/initialize`,
        payload,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('[Paystack] Error initializing transaction:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Initialize a subscription transaction (alias for initializeTransaction)
   * @param {Object} subscriptionData - { email, plan, amount, callback_url, metadata }
   * @returns {Promise<Object>} Authorization URL and reference
   */
  async initializeSubscription(subscriptionData) {
    return this.initializeTransaction(subscriptionData);
  }

  /**
   * Create a subscription
   * @param {Object} subscriptionData - { customer, plan, authorization }
   * @returns {Promise<Object>} Subscription object
   */
  async createSubscription(subscriptionData) {
    try {
      const response = await axios.post(
        `${this.baseURL}/subscription`,
        subscriptionData,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('[Paystack] Error creating subscription:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get subscription details
   * @param {String} subscriptionCode - Paystack subscription code
   * @returns {Promise<Object>} Subscription object
   */
  async getSubscription(subscriptionCode) {
    try {
      const response = await axios.get(
        `${this.baseURL}/subscription/${subscriptionCode}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('[Paystack] Error getting subscription:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Disable a subscription
   * @param {String} subscriptionCode - Paystack subscription code
   * @param {String} token - Subscription token
   * @returns {Promise<Object>} Response object
   */
  async disableSubscription(subscriptionCode, token) {
    try {
      const response = await axios.post(
        `${this.baseURL}/subscription/disable`,
        { code: subscriptionCode, token },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('[Paystack] Error disabling subscription:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Enable a subscription
   * @param {String} subscriptionCode - Paystack subscription code
   * @param {String} token - Subscription token
   * @returns {Promise<Object>} Response object
   */
  async enableSubscription(subscriptionCode, token) {
    try {
      const response = await axios.post(
        `${this.baseURL}/subscription/enable`,
        { code: subscriptionCode, token },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('[Paystack] Error enabling subscription:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Verify a transaction
   * @param {String} reference - Transaction reference
   * @returns {Promise<Object>} Transaction object
   */
  async verifyTransaction(reference) {
    try {
      const response = await axios.get(
        `${this.baseURL}/transaction/verify/${reference}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('[Paystack] Error verifying transaction:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get plan details
   * @param {String} planCode - Paystack plan code
   * @returns {Promise<Object>} Plan object
   */
  async getPlan(planCode) {
    try {
      const response = await axios.get(
        `${this.baseURL}/plan/${planCode}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('[Paystack] Error getting plan:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * List all plans
   * @returns {Promise<Object>} Plans list
   */
  async listPlans() {
    try {
      const response = await axios.get(
        `${this.baseURL}/plan`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('[Paystack] Error listing plans:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Create a subaccount for split payments (POS collections to tenant bank)
   * @param {Object} params - { business_name, bank_code, account_number, percentage_charge, primary_contact_email?, primary_contact_name?, description? }
   * @returns {Promise<Object>} { subaccount_code, ... }
   */
  async createSubaccount(params) {
    try {
      const payload = {
        business_name: params.business_name,
        settlement_bank: params.bank_code,
        account_number: params.account_number,
        percentage_charge: params.percentage_charge ?? parseFloat(process.env.PAYSTACK_PLATFORM_FEE_PERCENT || '2')
      };
      if (params.primary_contact_email) payload.primary_contact_email = params.primary_contact_email;
      if (params.primary_contact_name) payload.primary_contact_name = params.primary_contact_name;
      if (params.description) payload.description = params.description;
      if (params.currency) payload.currency = params.currency;

      const response = await axios.post(
        `${this.baseURL}/subaccount`,
        payload,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('[Paystack] Error creating subaccount:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * List banks (for subaccount setup - Ghana GHS uses ghipps type)
   * @param {Object} params - { country?, currency?, type? }
   * @returns {Promise<Object>} Banks list { data: [{ code, name, ... }] }
   */
  async listBanks(params = {}) {
    try {
      const qs = new URLSearchParams();
      if (params.country) qs.set('country', params.country);
      if (params.currency) qs.set('currency', params.currency);
      // For Ghana bank accounts: type=ghipps (bank channels, not mobile_money)
      if (params.type) qs.set('type', params.type);
      const query = qs.toString();
      const url = `${this.baseURL}/bank${query ? `?${query}` : ''}`;
      const response = await axios.get(url, { headers: this.getHeaders() });
      return response.data;
    } catch (error) {
      console.error('[Paystack] Error listing banks:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Create a plan in Paystack
   * @param {Object} params - { name, amount, interval, description?, currency? }
   * @returns {Promise<Object>} { plan_code, ... }
   */
  async createPlan(params) {
    try {
      const payload = {
        name: params.name,
        amount: params.amount,
        interval: params.interval,
        currency: params.currency || 'GHS',
        description: params.description || '',
        send_invoices: params.send_invoices !== false,
        send_sms: params.send_sms !== false
      };
      const response = await axios.post(
        `${this.baseURL}/plan`,
        payload,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('[Paystack] Error creating plan:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Map internal plan to Paystack plan code
   * @param {String} plan - Internal plan (starter, professional, enterprise)
   * @param {String} billingPeriod - monthly or yearly
   * @returns {String} Paystack plan code
   */
  getPaystackPlanCode(plan, billingPeriod) {
    const planMap = {
      starter: {
        monthly: 'starter_monthly',
        yearly: 'starter_yearly'
      },
      professional: {
        monthly: 'professional_monthly',
        yearly: 'professional_yearly'
      },
      enterprise: {
        monthly: 'enterprise_monthly',
        yearly: 'enterprise_yearly'
      }
    };

    return planMap[plan]?.[billingPeriod] || null;
  }

  /**
   * Create transfer recipient (mobile_money for Ghana MoMo)
   * @param {Object} params - { type: 'mobile_money', name, account_number (phone), bank_code (MTN/ATL/VOD), currency }
   * @returns {Promise<Object>} { recipient_code, ... }
   */
  async createTransferRecipient(params) {
    try {
      const response = await axios.post(
        `${this.baseURL}/transferrecipient`,
        {
          type: params.type || 'mobile_money',
          name: params.name,
          account_number: params.account_number,
          bank_code: params.bank_code,
          currency: params.currency || 'GHS'
        },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('[Paystack] Error creating transfer recipient:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Initiate transfer to recipient
   * @param {Object} params - { amount (pesewas), recipient (recipient_code), reference, reason }
   * @returns {Promise<Object>} Transfer result
   */
  async initiateTransfer(params) {
    try {
      const response = await axios.post(
        `${this.baseURL}/transfer`,
        {
          source: 'balance',
          amount: params.amount,
          recipient: params.recipient,
          reference: params.reference,
          reason: params.reason || 'POS sale payout'
        },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('[Paystack] Error initiating transfer:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Map MoMo provider to Paystack bank_code (Ghana)
   */
  getMoMoBankCode(provider) {
    const map = { MTN: 'MTN', AIRTEL: 'ATL' };
    return map[(provider || '').toUpperCase()] || 'MTN';
  }

  /**
   * Verify webhook signature
   * @param {String} signature - Webhook signature from headers
   * @param {String} body - Raw request body
   * @returns {Boolean} True if signature is valid
   */
  verifyWebhookSignature(signature, body) {
    const crypto = require('crypto');
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(payload)
      .digest('hex');
    return hash === signature;
  }
}

module.exports = new PaystackService();

