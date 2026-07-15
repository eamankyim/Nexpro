const axios = require('axios');
const Tenant = require('../models/Tenant');
const { decryptJson, maskSecret, isEncryptionConfigured, encryptJson } = require('../utils/momoCredentialsCrypto');

const HUBTEL_TXN_STATUS_BASE =
  process.env.HUBTEL_TXN_STATUS_URL || 'https://api-txnstatus.hubtel.com/transactions';
const HUBTEL_RECEIVE_BASE =
  process.env.HUBTEL_RECEIVE_MONEY_URL ||
  'https://rmp.hubtel.com/merchantaccount/merchants';

/** Map ABS provider labels to Hubtel Channel codes. */
const HUBTEL_CHANNEL_BY_PROVIDER = {
  MTN: 'mtn-gh',
  AIRTEL: 'tigo-gh',
  AIRTELTIGO: 'tigo-gh',
  TIGO: 'tigo-gh',
  VODAFONE: 'vodafone-gh',
  TELECEL: 'vodafone-gh'
};

/**
 * @param {string} provider
 * @returns {string|null}
 */
function mapProviderToHubtelChannel(provider) {
  const key = String(provider || '').toUpperCase().trim();
  return HUBTEL_CHANNEL_BY_PROVIDER[key] || null;
}

/**
 * @param {{ clientId: string, clientSecret: string }} credentials
 */
function hubtelBasicAuthHeader(credentials) {
  const auth = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64');
  return `Basic ${auth}`;
}

/**
 * POS Sales ID / merchant account used in Hubtel URL path.
 * @param {{ posSalesId?: string, merchantAccountNumber?: string }} config
 */
function resolveHubtelAccountRef(config) {
  return String(config?.posSalesId || config?.merchantAccountNumber || '').trim();
}

/**
 * Normalize Hubtel status codes / Status strings into ABS MoMo statuses.
 * @param {object} data - Hubtel response body
 * @returns {'SUCCESSFUL'|'PENDING'|'FAILED'|'UNKNOWN'}
 */
function normalizeHubtelPaymentStatus(data) {
  if (!data || typeof data !== 'object') return 'UNKNOWN';
  const code = String(data.ResponseCode ?? data.responseCode ?? data.Code ?? '').trim();
  const statusRaw = String(
    data.Status ?? data.status ?? data.Data?.Status ?? data.data?.Status ?? ''
  )
    .toUpperCase()
    .trim();

  if (
    code === '0000' ||
    statusRaw === 'SUCCESS' ||
    statusRaw === 'SUCCESSFUL' ||
    statusRaw === 'PAID' ||
    statusRaw === 'COMPLETED'
  ) {
    return 'SUCCESSFUL';
  }
  if (
    code === '0001' ||
    statusRaw === 'PENDING' ||
    statusRaw === 'PROCESSING' ||
    statusRaw === 'INPROGRESS' ||
    statusRaw === 'IN PROGRESS' ||
    statusRaw === 'AWAITING'
  ) {
    return 'PENDING';
  }
  if (
    code === '2001' ||
    statusRaw === 'FAILED' ||
    statusRaw === 'FAILURE' ||
    statusRaw === 'CANCELLED' ||
    statusRaw === 'CANCELED' ||
    statusRaw === 'DECLINED'
  ) {
    return 'FAILED';
  }
  // Unknown reference often returns non-zero; treat ambiguous as pending when soft-pending codes.
  if (code && code !== '0000' && !statusRaw) return 'UNKNOWN';
  return statusRaw ? 'UNKNOWN' : 'UNKNOWN';
}

/**
 * Public callback URL Hubtel posts to after Receive Money.
 * Prefer HUBTEL_CALLBACK_URL; else derive from API_PUBLIC_URL / APP_URL.
 * @returns {string|undefined}
 */
function getHubtelCallbackUrl() {
  const explicit = process.env.HUBTEL_CALLBACK_URL && String(process.env.HUBTEL_CALLBACK_URL).trim();
  if (explicit) return explicit;
  const base =
    (process.env.API_PUBLIC_URL && String(process.env.API_PUBLIC_URL).trim()) ||
    (process.env.BACKEND_PUBLIC_URL && String(process.env.BACKEND_PUBLIC_URL).trim()) ||
    (process.env.APP_URL && String(process.env.APP_URL).trim()) ||
    '';
  if (!base) return undefined;
  return `${base.replace(/\/$/, '')}/api/webhooks/hubtel`;
}

/**
 * Decrypt and resolve Hubtel credentials for a tenant.
 * @param {object} tenant - Sequelize Tenant instance
 * @returns {{ clientId: string, clientSecret: string, merchantAccountNumber?: string, posSalesId?: string }|null}
 */
function getResolvedHubtelConfigForTenant(tenant) {
  const stored = tenant?.metadata?.hubtelCollectionCredentials;
  if (!stored?.secretsEnc) return null;

  try {
    const secrets = decryptJson(stored.secretsEnc);
    const clientId = secrets.clientId && String(secrets.clientId).trim();
    const clientSecret = secrets.clientSecret && String(secrets.clientSecret).trim();
    if (!clientId || !clientSecret) return null;

    const merchantAccountNumber =
      (stored.merchantAccountNumber && String(stored.merchantAccountNumber).trim()) ||
      (secrets.merchantAccountNumber && String(secrets.merchantAccountNumber).trim()) ||
      undefined;
    const posSalesId =
      (stored.posSalesId && String(stored.posSalesId).trim()) ||
      (secrets.posSalesId && String(secrets.posSalesId).trim()) ||
      merchantAccountNumber ||
      undefined;

    return {
      clientId,
      clientSecret,
      merchantAccountNumber,
      posSalesId
    };
  } catch (e) {
    console.error('[tenantHubtelCollection] Decrypt failed for tenant', tenant?.id, e.message);
    return null;
  }
}

/**
 * Safe summary for GET settings (no secrets).
 * @param {object} tenant
 * @returns {{
 *   configured: boolean,
 *   clientIdMasked: string,
 *   merchantAccountNumber: string,
 *   posSalesId: string,
 *   encryptionConfigured: boolean
 * }}
 */
function getHubtelCollectionPublicSummary(tenant) {
  const stored = tenant?.metadata?.hubtelCollectionCredentials;
  const hasTenantSecrets = Boolean(stored?.secretsEnc);
  let clientIdMasked = '';
  if (hasTenantSecrets && isEncryptionConfigured()) {
    try {
      const secrets = decryptJson(stored.secretsEnc);
      clientIdMasked = maskSecret(secrets.clientId);
    } catch {
      clientIdMasked = '****';
    }
  }

  return {
    configured: hasTenantSecrets,
    clientIdMasked,
    merchantAccountNumber: stored?.merchantAccountNumber || '',
    posSalesId: stored?.posSalesId || '',
    encryptionConfigured: isEncryptionConfigured()
  };
}

/**
 * Persist tenant Hubtel collection credentials (caller must verify OTP/password).
 * @param {string} tenantId
 * @param {{
 *   clientId: string,
 *   clientSecret: string,
 *   merchantAccountNumber?: string,
 *   posSalesId?: string
 * }} payload
 */
async function saveTenantHubtelCollectionCredentials(tenantId, payload) {
  if (!isEncryptionConfigured()) {
    throw new Error('Server encryption key for payment credentials is not configured');
  }
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant) throw new Error('Tenant not found');

  const secretsEnc = encryptJson({
    clientId: String(payload.clientId).trim(),
    clientSecret: String(payload.clientSecret).trim()
  });

  const hubtelCollectionCredentials = {
    secretsEnc,
    updatedAt: new Date().toISOString()
  };
  if (payload.merchantAccountNumber && String(payload.merchantAccountNumber).trim()) {
    hubtelCollectionCredentials.merchantAccountNumber = String(payload.merchantAccountNumber).trim();
  }
  if (payload.posSalesId && String(payload.posSalesId).trim()) {
    hubtelCollectionCredentials.posSalesId = String(payload.posSalesId).trim();
  }

  tenant.metadata = {
    ...(tenant.metadata || {}),
    hubtelCollectionCredentials
  };
  await tenant.save({ fields: ['metadata'] });
  return getHubtelCollectionPublicSummary(tenant);
}

/**
 * Remove Hubtel credentials from tenant metadata.
 * @param {string} tenantId
 */
async function clearTenantHubtelCollectionCredentials(tenantId) {
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant) throw new Error('Tenant not found');
  const meta = { ...(tenant.metadata || {}) };
  delete meta.hubtelCollectionCredentials;
  tenant.metadata = meta;
  await tenant.save({ fields: ['metadata'] });
}

/**
 * Probe Hubtel with Basic auth. Success means credentials are accepted
 * (status lookup for a dummy reference may 404 — that still proves auth).
 * @param {{ clientId: string, clientSecret: string, merchantAccountNumber?: string, posSalesId?: string }} credentials
 * @returns {Promise<{ ok: true }>}
 */
async function testHubtelCredentials(credentials) {
  const clientId = String(credentials.clientId || '').trim();
  const clientSecret = String(credentials.clientSecret || '').trim();
  if (!clientId || !clientSecret) {
    throw new Error('Client ID and Client Secret are required');
  }

  const accountRef =
    String(credentials.posSalesId || credentials.merchantAccountNumber || '0').trim() || '0';
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const url = `${HUBTEL_TXN_STATUS_BASE.replace(/\/$/, '')}/${encodeURIComponent(accountRef)}/status`;

  let response;
  try {
    response = await axios.get(url, {
      params: { clientReference: 'abs-hubtel-connection-test' },
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json'
      },
      timeout: 15000,
      validateStatus: () => true
    });
  } catch (err) {
    const msg = err?.message || 'Could not reach Hubtel';
    throw new Error(msg.includes('timeout') ? 'Hubtel connection timed out. Try again.' : `Hubtel test failed: ${msg}`);
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error('Hubtel authentication failed. Check Client ID and Client Secret.');
  }

  // 200 / 400 / 404 (unknown reference) all indicate auth was accepted.
  return { ok: true };
}

/**
 * Initiate Hubtel Direct Receive Money (customer MoMo prompt).
 * @param {{
 *   config: { clientId: string, clientSecret: string, merchantAccountNumber?: string, posSalesId?: string },
 *   phoneNumber: string,
 *   amount: number,
 *   provider: string,
 *   clientReference: string,
 *   customerName?: string,
 *   customerEmail?: string,
 *   description?: string,
 *   callbackUrl?: string
 * }} params
 * @returns {Promise<{
 *   success: boolean,
 *   referenceId?: string,
 *   clientReference?: string,
 *   hubtelTransactionId?: string,
 *   status?: string,
 *   provider?: string,
 *   message?: string,
 *   error?: string,
 *   channel?: string
 * }>}
 */
async function initiateReceiveMoney(params) {
  const config = params?.config;
  if (!config?.clientId || !config?.clientSecret) {
    return {
      success: false,
      error: 'Hubtel is not configured for this workspace',
      provider: 'HUBTEL'
    };
  }

  const accountRef = resolveHubtelAccountRef(config);
  if (!accountRef) {
    return {
      success: false,
      error:
        'Hubtel POS Sales ID (or Merchant Account Number) is required. Add it under Settings → Payments → Hubtel.',
      provider: 'HUBTEL'
    };
  }

  const channel = mapProviderToHubtelChannel(params.provider);
  if (!channel) {
    return {
      success: false,
      error: 'Unsupported mobile money network for Hubtel. Use MTN, AirtelTigo, or Vodafone/Telecel.',
      provider: 'HUBTEL'
    };
  }

  const amount = Number(params.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: 'Invalid payment amount', provider: 'HUBTEL' };
  }

  const clientReference = String(params.clientReference || '').trim().slice(0, 64);
  if (!clientReference) {
    return { success: false, error: 'Payment reference is required', provider: 'HUBTEL' };
  }

  const msisdn = String(params.phoneNumber || '')
    .replace(/[\s-]/g, '')
    .replace(/^\+/, '');
  if (!msisdn || msisdn.length < 9) {
    return { success: false, error: 'Enter a valid mobile money number', provider: 'HUBTEL' };
  }

  const callbackUrl = params.callbackUrl || getHubtelCallbackUrl();
  const url = `${HUBTEL_RECEIVE_BASE.replace(/\/$/, '')}/${encodeURIComponent(accountRef)}/receive/mobilemoney`;

  const body = {
    CustomerName: String(params.customerName || 'Customer').trim().slice(0, 100) || 'Customer',
    CustomerMsisdn: msisdn,
    CustomerEmail: params.customerEmail ? String(params.customerEmail).trim() : undefined,
    Channel: channel,
    Amount: Math.round(amount * 100) / 100,
    PrimaryCallbackUrl: callbackUrl,
    Description: String(params.description || 'Payment').trim().slice(0, 250) || 'Payment',
    ClientReference: clientReference
  };
  if (!body.CustomerEmail) delete body.CustomerEmail;
  if (!body.PrimaryCallbackUrl) delete body.PrimaryCallbackUrl;

  let response;
  try {
    response = await axios.post(url, body, {
      headers: {
        Authorization: hubtelBasicAuthHeader(config),
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 30000,
      validateStatus: () => true
    });
  } catch (err) {
    const msg = err?.message || 'Could not reach Hubtel';
    console.error('[Hubtel] Receive Money network error:', msg);
    return {
      success: false,
      error: msg.includes('timeout') ? 'Hubtel connection timed out. Try again.' : 'Failed to initiate Hubtel payment',
      provider: 'HUBTEL'
    };
  }

  const data = response.data || {};
  const responseCode = String(data.ResponseCode ?? data.responseCode ?? '').trim();
  const httpOk = response.status >= 200 && response.status < 300;
  const accepted = httpOk && (responseCode === '0000' || responseCode === '0001' || !responseCode);

  if (!accepted) {
    const providerMsg =
      data.Message ||
      data.message ||
      data.ResponseMessage ||
      (typeof data === 'string' ? data : null);
    console.error('[Hubtel] Receive Money rejected:', {
      status: response.status,
      responseCode: responseCode || undefined,
      // Never log ClientSecret; message is safe.
      message: providerMsg ? String(providerMsg).slice(0, 200) : undefined
    });
    return {
      success: false,
      error: providerMsg
        ? String(providerMsg).slice(0, 200)
        : 'Hubtel could not start the mobile money prompt',
      provider: 'HUBTEL'
    };
  }

  const hubtelTransactionId =
    data.Data?.TransactionId ||
    data.Data?.transactionId ||
    data.data?.TransactionId ||
    data.TransactionId ||
    undefined;

  return {
    success: true,
    referenceId: clientReference,
    clientReference,
    hubtelTransactionId: hubtelTransactionId ? String(hubtelTransactionId) : undefined,
    status: responseCode === '0000' ? 'SUCCESSFUL' : 'PENDING',
    provider: 'HUBTEL',
    channel,
    message: data.Message || data.message || 'Approve the mobile money prompt on the customer phone.'
  };
}

/**
 * Poll Hubtel transaction status by clientReference.
 * @param {{
 *   config: { clientId: string, clientSecret: string, merchantAccountNumber?: string, posSalesId?: string },
 *   clientReference: string
 * }} params
 */
async function checkReceiveMoneyStatus(params) {
  const config = params?.config;
  const clientReference = String(params?.clientReference || '').trim();
  if (!config?.clientId || !config?.clientSecret) {
    return {
      success: false,
      referenceId: clientReference,
      status: 'UNKNOWN',
      error: 'Hubtel is not configured',
      provider: 'HUBTEL'
    };
  }
  if (!clientReference) {
    return {
      success: false,
      referenceId: '',
      status: 'UNKNOWN',
      error: 'clientReference is required',
      provider: 'HUBTEL'
    };
  }

  const accountRef = resolveHubtelAccountRef(config) || '0';
  const url = `${HUBTEL_TXN_STATUS_BASE.replace(/\/$/, '')}/${encodeURIComponent(accountRef)}/status`;

  let response;
  try {
    response = await axios.get(url, {
      params: { clientReference },
      headers: {
        Authorization: hubtelBasicAuthHeader(config),
        Accept: 'application/json'
      },
      timeout: 15000,
      validateStatus: () => true
    });
  } catch (err) {
    console.error('[Hubtel] Status check network error:', err?.message);
    return {
      success: false,
      referenceId: clientReference,
      status: 'UNKNOWN',
      error: 'Failed to check Hubtel payment status',
      provider: 'HUBTEL'
    };
  }

  const data = response.data || {};
  const status = normalizeHubtelPaymentStatus(data);
  const transactionId =
    data.Data?.TransactionId ||
    data.Data?.transactionId ||
    data.data?.TransactionId ||
    data.TransactionId ||
    undefined;

  return {
    success: response.status >= 200 && response.status < 300,
    referenceId: clientReference,
    status,
    financialTransactionId: transactionId ? String(transactionId) : undefined,
    amount: data.Data?.Amount ?? data.data?.Amount,
    reason: data.Message || data.message,
    provider: 'HUBTEL',
    rawResponseCode: String(data.ResponseCode ?? data.responseCode ?? '')
  };
}

/**
 * Parse Hubtel Receive Money callback body into a stable shape.
 * @param {object} body
 * @returns {{
 *   clientReference: string|null,
 *   status: 'SUCCESSFUL'|'PENDING'|'FAILED'|'UNKNOWN',
 *   transactionId?: string,
 *   amount?: number
 * }}
 */
function parseHubtelCallback(body) {
  const root = body && typeof body === 'object' ? body : {};
  const data = root.Data || root.data || root;
  const clientReference =
    data.ClientReference ||
    data.clientReference ||
    root.ClientReference ||
    root.clientReference ||
    null;
  const transactionId =
    data.TransactionId ||
    data.transactionId ||
    root.TransactionId ||
    undefined;
  const amountRaw = data.Amount ?? data.amount ?? root.Amount;
  const amount = amountRaw != null ? Number(amountRaw) : undefined;

  return {
    clientReference: clientReference ? String(clientReference) : null,
    status: normalizeHubtelPaymentStatus({
      ResponseCode: root.ResponseCode ?? root.responseCode ?? data.ResponseCode,
      Status: data.Status || root.Status || root.status,
      ...root
    }),
    transactionId: transactionId ? String(transactionId) : undefined,
    amount: Number.isFinite(amount) ? amount : undefined
  };
}

/** @deprecated Use initiateReceiveMoney */
function initiateHubtelReceiveMoneyStub() {
  return null;
}

module.exports = {
  getResolvedHubtelConfigForTenant,
  getHubtelCollectionPublicSummary,
  saveTenantHubtelCollectionCredentials,
  clearTenantHubtelCollectionCredentials,
  testHubtelCredentials,
  initiateReceiveMoney,
  checkReceiveMoneyStatus,
  parseHubtelCallback,
  mapProviderToHubtelChannel,
  normalizeHubtelPaymentStatus,
  getHubtelCallbackUrl,
  initiateHubtelReceiveMoneyStub,
  isEncryptionConfigured
};
