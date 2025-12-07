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
   * Initialize a subscription transaction
   * @param {Object} subscriptionData - { email, plan, amount, callback_url, metadata }
   * @returns {Promise<Object>} Authorization URL and reference
   */
  async initializeSubscription(subscriptionData) {
    try {
      const response = await axios.post(
        `${this.baseURL}/transaction/initialize`,
        subscriptionData,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('[Paystack] Error initializing subscription:', error.response?.data || error.message);
      throw error;
    }
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
   * Verify webhook signature
   * @param {String} signature - Webhook signature from headers
   * @param {String} body - Raw request body
   * @returns {Boolean} True if signature is valid
   */
  verifyWebhookSignature(signature, body) {
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(JSON.stringify(body))
      .digest('hex');
    return hash === signature;
  }
}

module.exports = new PaystackService();

