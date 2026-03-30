const axios = require('axios');
const os = require('os');

const LOG_PREFIX = '[Paystack]';

/**
 * sk_live / sk_test / missing — never log full keys.
 * @param {string|undefined} secretKey
 * @returns {'missing'|'sk_live'|'sk_test'|'sk_unknown'}
 */
function resolvePaystackKeyMode(secretKey) {
  if (!secretKey || typeof secretKey !== 'string') return 'missing';
  if (secretKey.startsWith('sk_live')) return 'sk_live';
  if (secretKey.startsWith('sk_test')) return 'sk_test';
  return 'sk_unknown';
}

/**
 * Rich, safe diagnostics when a Paystack HTTP call fails (pinpoints network vs auth vs WAF/HTML).
 * @param {string} operation
 * @param {import('axios').AxiosError} error
 * @param {PaystackService|null} instance - PaystackService singleton
 * @param {Record<string, unknown>} [extra] - e.g. { logId }
 */
function collectPaystackFailureDiagnostics(operation, error, instance, extra = {}) {
  const res = error?.response;
  const body = res?.data;
  const h = res?.headers || {};
  const pick = (name) => h[name] ?? h[String(name).toLowerCase()];
  const contentType = pick('content-type');
  const cfRay = pick('cf-ray');
  const serverHdr = pick('server');
  const cacheStatus = pick('cf-cache-status');

  let responseBodyInfo;
  if (paystackResponseIsUnusableHtml(body)) {
    const len = typeof body === 'string' ? body.length : typeof body === 'object' && body?.message ? String(body.message).length : 0;
    responseBodyInfo = {
      shape: 'html_or_cloudflare_challenge',
      approximateLength: len || (typeof body === 'string' ? body.length : undefined)
    };
  } else if (typeof body === 'string') {
    responseBodyInfo = {
      shape: 'text',
      length: body.length,
      preview: body.trim().slice(0, 120)
    };
  } else if (body && typeof body === 'object') {
    responseBodyInfo = {
      shape: 'json',
      keys: Object.keys(body).slice(0, 15),
      message: typeof body.message === 'string' ? body.message.slice(0, 200) : undefined
    };
  } else {
    responseBodyInfo = { shape: body == null ? 'empty' : typeof body };
  }

  let paystackApiHost = 'unknown';
  try {
    paystackApiHost = new URL(instance?.baseURL || 'https://api.paystack.co').host;
  } catch {
    paystackApiHost = 'parse_error';
  }

  let requestHostPath;
  try {
    const u = new URL(error?.config?.url || '', instance?.baseURL || 'https://api.paystack.co');
    requestHostPath = `${u.host}${u.pathname}${u.search ? u.search.slice(0, 100) : ''}`;
  } catch {
    requestHostPath = error?.config?.url ? String(error.config.url).slice(0, 160) : undefined;
  }

  return {
    ...extra,
    operation,
    where: 'backend_outbound_axios_to_paystack',
    paystackApiHost,
    baseURLConfigured: instance?.baseURL,
    keyMode: resolvePaystackKeyMode(instance?.secretKey),
    nodeEnv: process.env.NODE_ENV,
    processHostname: process.env.HOSTNAME || os.hostname(),
    axiosMessage: error?.message,
    axiosCode: error?.code,
    axiosErrno: error?.errno,
    syscall: error?.syscall,
    connectAddress: error?.address,
    connectPort: error?.port,
    dnsLookupHost: error?.hostname,
    httpStatus: res?.status,
    httpStatusText: res?.statusText,
    responseContentType: contentType ? String(contentType).slice(0, 120) : undefined,
    cfRay: cfRay ? String(cfRay) : undefined,
    cfCacheStatus: cacheStatus ? String(cacheStatus) : undefined,
    responseServerHeader: serverHdr ? String(serverHdr).slice(0, 100) : undefined,
    requestMethod: (error?.config?.method || 'get').toUpperCase(),
    requestHostPath,
    responseBody: responseBodyInfo,
    likelyCloudflareChallengeHtml: paystackResponseIsUnusableHtml(body)
  };
}

/**
 * Single structured error line for all Paystack API failures.
 * @param {string} operation
 * @param {import('axios').AxiosError} error
 * @param {PaystackService|null} instance
 * @param {{ logId?: string }} [opts]
 */
function logPaystackRequestFailure(operation, error, instance, opts = {}) {
  const summary = paystackErrorSummary(operation, error);
  const diagnostics = collectPaystackFailureDiagnostics(operation, error, instance, opts);
  console.error(LOG_PREFIX, 'REQUEST_FAILED', {
    ...summary,
    diagnostics
  });
}

/**
 * Safe summary of error.response.data for logs (avoid dumping HTML or huge bodies)
 */
function paystackErrorSummary(operation, error) {
  const status = error?.response?.status;
  const body = error?.response?.data;
  const isHtml = typeof body === 'string' && (body && (body.includes('<html') || body.includes('Just a moment')));
  const summary = {
    operation,
    status,
    message: error?.message,
    code: error?.code,
    url: error?.config?.url || error?.config?.baseURL
  };
  if (isHtml) {
    summary.responseBody = '(Cloudflare/challenge HTML – server request blocked)';
  } else if (body != null) {
    summary.responseBody = typeof body === 'object' && body.message ? body.message : (typeof body === 'string' ? body.slice(0, 200) : body);
  }
  return summary;
}

/**
 * True if Paystack/axios response body is a Cloudflare challenge or other HTML (must not be sent to browsers as JSON message).
 * @param {unknown} body - error.response.data
 * @returns {boolean}
 */
function paystackResponseIsUnusableHtml(body) {
  if (body == null) return false;
  if (typeof body === 'string') {
    const t = body.trim();
    return (
      /<!DOCTYPE\s+html/i.test(t) ||
      /<html[\s>]/i.test(t) ||
      /Just a moment/i.test(t) ||
      (t.startsWith('<') && t.length > 200)
    );
  }
  if (typeof body === 'object' && typeof body.message === 'string') {
    return paystackResponseIsUnusableHtml(body.message);
  }
  return false;
}

/**
 * Safe string for JSON `message` fields — never HTML challenge pages.
 * @param {import('axios').AxiosError} error
 * @param {{ blocked?: string }} [fallbacks]
 * @returns {string|null}
 */
function userFacingPaystackErrorMessage(error, fallbacks = {}) {
  const status = error?.response?.status;
  const body = error?.response?.data;

  if (paystackResponseIsUnusableHtml(body)) {
    return (
      fallbacks.blocked ||
      'Payment provider could not be reached from our servers (temporary network block). Please try again in a few minutes or contact support if this continues.'
    );
  }

  if (typeof body === 'object' && body && typeof body.message === 'string') {
    const m = body.message.trim();
    if (m && !paystackResponseIsUnusableHtml(m)) return m;
  }

  if (typeof body === 'string') {
    const t = body.trim();
    if (t && !paystackResponseIsUnusableHtml(t) && t.length <= 400) return t;
  }

  if (status === 401) return fallbacks.unauthorized || null;
  return null;
}

/**
 * Paystack Service
 * Handles all Paystack API interactions
 */
class PaystackService {
  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
    this.publicKey = process.env.PAYSTACK_PUBLIC_KEY;
    let baseURL = (process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co').trim().replace(/\/$/, '');
    // Dashboard/docs links use paystack.com; the REST API host is api.paystack.co. Using .com often returns Cloudflare challenge HTML to servers (403), not JSON.
    if (/^https?:\/\/api\.paystack\.com\b/i.test(baseURL)) {
      const corrected = baseURL.replace(/api\.paystack\.com/gi, 'api.paystack.co');
      console.warn(
        `${LOG_PREFIX} PAYSTACK_BASE_URL was set to api.paystack.com — Paystack’s API is at api.paystack.co. Using:`,
        corrected
      );
      baseURL = corrected;
    }
    this.baseURL = baseURL;
    /** Optional subaccount code for split payments (e.g. ACCT_xxxxx) */
    this.subaccountCode = process.env.PAYSTACK_SUBACCOUNT_CODE || null;

    if (!this.secretKey) {
      console.warn('[Paystack] PAYSTACK_SECRET_KEY not set. Paystack features will be disabled.');
    }

    let paystackHost = 'unknown';
    try {
      paystackHost = new URL(this.baseURL).host;
    } catch {
      paystackHost = 'invalid_base_url';
    }
    console.log(`${LOG_PREFIX} client ready`, {
      paystackApiHost: paystackHost,
      baseURL: this.baseURL,
      keyMode: resolvePaystackKeyMode(this.secretKey),
      hasPublicKey: Boolean(this.publicKey),
      nodeEnv: process.env.NODE_ENV,
      processHostname: process.env.HOSTNAME || os.hostname()
    });
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
      logPaystackRequestFailure('createCustomer', error, this);
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
        // Default: card only; use direct MoMo APIs for mobile money elsewhere
        channels: params.channels || ['card']
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
      logPaystackRequestFailure('initializeTransaction', error, this);
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
      logPaystackRequestFailure('createSubscription', error, this);
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
      logPaystackRequestFailure('getSubscription', error, this);
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
      logPaystackRequestFailure('disableSubscription', error, this);
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
      logPaystackRequestFailure('enableSubscription', error, this);
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
      logPaystackRequestFailure('verifyTransaction', error, this);
      throw error;
    }
  }

  /**
   * List transactions (platform secret sees whole integration; filter by tenant in app code).
   * @param {{ page?: number, perPage?: number, from?: string, to?: string, status?: string }} params - ISO datetimes for from/to per Paystack docs
   * @returns {Promise<object>} Paystack envelope { status, data, meta }
   */
  async listTransactions(params = {}) {
    if (!this.secretKey) {
      const err = new Error('Paystack is not configured');
      err.code = 'PAYSTACK_NOT_CONFIGURED';
      throw err;
    }
    const qs = new URLSearchParams();
    const perPage = Math.min(100, Math.max(1, Number(params.perPage) || 50));
    const page = Math.max(1, Number(params.page) || 1);
    qs.set('perPage', String(perPage));
    qs.set('page', String(page));
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.status) qs.set('status', params.status);
    const query = qs.toString();
    const url = `${this.baseURL}/transaction?${query}`;
    try {
      const response = await axios.get(url, { headers: this.getHeaders() });
      return response.data;
    } catch (error) {
      logPaystackRequestFailure('listTransactions', error, this);
      throw error;
    }
  }

  /**
   * Charge a customer via Mobile Money (POS)
   * @param {Object} params
   * @param {String} params.email - Customer email
   * @param {Number} params.amount - Amount in main units (e.g. 14.0 for ₵14.00)
   * @param {String} params.reference - Unique transaction reference
   * @param {String} params.phoneNumber - Customer MoMo phone (233XXXXXXXXX or local formats)
   * @param {String} params.provider - Logical provider (MTN, AIRTEL, TELECEL/VODAFONE)
   * @param {Object} params.metadata - Additional metadata to send to Paystack
   * @param {String} [params.subaccount] - Paystack subaccount code (ACCT_xxx) for split at charge; when set, tenant share goes to their bank
   * @param {Number} [params.transaction_charge] - Optional transaction charge for split (Paystack docs)
   * @param {String} [params.bearer] - Optional bearer for split (account | subaccount)
   * @returns {Promise<Object>} Paystack charge result
   */
  async chargeMobileMoney({ email, amount, reference, phoneNumber, provider, metadata, subaccount, transaction_charge, bearer }) {
    if (!this.secretKey) {
      console.warn('[Paystack] chargeMobileMoney called without PAYSTACK_SECRET_KEY');
      return {
        status: false,
        message: 'Paystack is not configured'
      };
    }

    try {
      const normalizedAmount = Math.round(Number(amount || 0) * 100);
      const cleanedPhone = String(phoneNumber || '').replace(/\\s+/g, '');
      const providerCode = (() => {
        const upper = String(provider || '').toUpperCase();
        if (upper === 'MTN') return 'mtn';
        if (upper === 'AIRTEL' || upper === 'ATL') return 'atl';
        // Telecel is ex-Vodafone in GH – map to vod where supported
        if (upper === 'TELECEL' || upper === 'VODAFONE' || upper === 'VOD') return 'vod';
        return 'mtn';
      })();

      const payload = {
        email,
        amount: String(normalizedAmount),
        currency: 'GHS',
        reference,
        mobile_money: {
          phone: cleanedPhone,
          provider: providerCode
        },
        metadata: metadata || {}
      };
      if (subaccount) payload.subaccount = subaccount;
      if (transaction_charge != null) payload.transaction_charge = transaction_charge;
      if (bearer) payload.bearer = bearer;

      const response = await axios.post(
        `${this.baseURL}/charge`,
        payload,
        { headers: this.getHeaders() }
      );

      const data = response.data;
      console.log('[MoMo] Paystack /charge response:', {
        status: data?.status,
        message: data?.message,
        dataStatus: data?.data?.status,
        hasData: !!data?.data
      });
      return data;
    } catch (error) {
      logPaystackRequestFailure('chargeMobileMoney', error, this);
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
      logPaystackRequestFailure('getPlan', error, this);
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
      logPaystackRequestFailure('listPlans', error, this);
      throw error;
    }
  }

  /**
   * Create a subaccount for split payments (POS collections to tenant bank)
   * @param {Object} params - { business_name, bank_code, account_number, percentage_charge, primary_contact_email?, primary_contact_name?, description? }
   * @returns {Promise<Object>} { subaccount_code, ... }
   */
  async createSubaccount(params) {
    const url = `${this.baseURL}/subaccount`;
    const logId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(`${LOG_PREFIX} [${logId}] createSubaccount REQUEST:`, {
      url,
      hasSecretKey: Boolean(this.secretKey),
      business_name: params.business_name ? `${String(params.business_name).slice(0, 30)}...` : undefined,
      bank_code: params.bank_code ? `${String(params.bank_code).slice(0, 6)}...` : undefined,
      account_number_length: params.account_number ? String(params.account_number).length : 0
    });
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

      const response = await axios.post(url, payload, { headers: this.getHeaders() });
      const data = response?.data;
      const subaccountCode = data?.data?.subaccount_code || data?.subaccount_code;
      console.log(`${LOG_PREFIX} [${logId}] createSubaccount SUCCESS:`, {
        status: response?.status,
        hasSubaccountCode: Boolean(subaccountCode),
        subaccountCodePrefix: subaccountCode ? String(subaccountCode).slice(0, 12) + '...' : null
      });
      return data;
    } catch (error) {
      const summary = paystackErrorSummary('createSubaccount', error);
      console.error(`${LOG_PREFIX} [${logId}] createSubaccount ERROR:`, summary);
      throw error;
    }
  }

  /**
   * List banks (for subaccount setup - Ghana GHS uses ghipps type)
   * @param {Object} params - { country?, currency?, type? }
   * @returns {Promise<Object>} Banks list { data: [{ code, name, ... }] }
   */
  async listBanks(params = {}) {
    const logId = `banks-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const qs = new URLSearchParams();
    if (params.country) qs.set('country', params.country);
    if (params.currency) qs.set('currency', params.currency);
    if (params.type) qs.set('type', params.type);
    const query = qs.toString();
    const url = `${this.baseURL}/bank${query ? `?${query}` : ''}`;
    console.log(`${LOG_PREFIX} [${logId}] listBanks REQUEST:`, { params, url, hasSecretKey: Boolean(this.secretKey) });
    try {
      const response = await axios.get(url, { headers: this.getHeaders() });
      const data = response?.data;
      const list = Array.isArray(data) ? data : (data?.data ?? []);
      console.log(`${LOG_PREFIX} [${logId}] listBanks SUCCESS:`, {
        status: response?.status,
        listLength: list?.length ?? 0,
        firstItem: list?.[0] ? { code: list[0].code, name: (list[0].name || '').slice(0, 30), type: list[0].type } : null
      });
      return data;
    } catch (error) {
      logPaystackRequestFailure('listBanks', error, this, { logId, listBanksParams: params, listBanksUrl: url });
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
      logPaystackRequestFailure('createPlan', error, this);
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
      logPaystackRequestFailure('createTransferRecipient', error, this);
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
      logPaystackRequestFailure('initiateTransfer', error, this);
      throw error;
    }
  }

  /**
   * Map MoMo provider to Paystack bank_code (Ghana)
   */
  getMoMoBankCode(provider) {
    const map = {
      MTN: 'MTN',
      AIRTEL: 'ATL',
      ATL: 'ATL',
      TELECEL: 'VOD',
      VODAFONE: 'VOD',
      VOD: 'VOD'
    };
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

const paystackServiceSingleton = new PaystackService();
module.exports = paystackServiceSingleton;
module.exports.paystackResponseIsUnusableHtml = paystackResponseIsUnusableHtml;
module.exports.userFacingPaystackErrorMessage = userFacingPaystackErrorMessage;

