const { getTenantAnthropicApiKey } = require('../services/tenantAiSettingsService');

const DEFAULT_BILLING_CIRCUIT_TTL_MS = Math.max(
  5000,
  Number.parseInt(process.env.AI_BILLING_CIRCUIT_TTL_MS || '60000', 10) || 60000
);

/** @type {Map<string, { until: number, statusCode: number, errorCode: string, message: string }>} */
const billingCircuit = new Map();

const circuitKey = (tenantId) => String(tenantId || 'system');

const normalizedSystemKey = () => (process.env.ANTHROPIC_API_KEY || '').replace(/\r?\n/g, '').trim();

const extractProviderMessage = (error) => {
  const nested = error?.error;
  if (nested && typeof nested === 'object') {
    if (typeof nested.message === 'string' && nested.message.trim()) {
      return nested.message.trim();
    }
  }
  return String(error?.message || '').trim();
};

const isBillingCreditError = (error) => {
  const message = extractProviderMessage(error).toLowerCase();
  const type = String(error?.error?.type || error?.type || '').toLowerCase();

  if (type === 'insufficient_balance_error' || type === 'account_billing_error') {
    return true;
  }

  return (
    (message.includes('credit balance') && (message.includes('too low') || message.includes('insufficient')))
    || message.includes('insufficient credits')
    || message.includes('purchase credits')
    || message.includes('plans & billing')
    || message.includes('plans and billing')
  );
};

const isInvalidApiKeyError = (error) => (
  error?.status === 401
  || error?.code === 'invalid_api_key'
  || error?.error?.type === 'authentication_error'
);

const isProviderUnavailableError = (error) => {
  const status = Number(error?.status || 0);
  if ([429, 500, 502, 503, 529].includes(status)) {
    return true;
  }

  const type = String(error?.error?.type || error?.type || '').toLowerCase();
  return type === 'overloaded_error' || type === 'api_error';
};

/**
 * Map provider failures to safe API responses without leaking secrets or raw headers.
 * @param {Error & { status?: number, code?: string, error?: object }} error
 * @returns {{ statusCode: number, errorCode: string, message: string } | null}
 */
const classifyAiProviderError = (error) => {
  if (!error) return null;

  if (error.code === 'OPENAI_NOT_CONFIGURED' || error.errorCode === 'OPENAI_NOT_CONFIGURED') {
    return {
      statusCode: 503,
      errorCode: 'OPENAI_NOT_CONFIGURED',
      message: 'AI assistant is not configured. Set ANTHROPIC_API_KEY in the backend .env to enable.',
    };
  }

  if (isInvalidApiKeyError(error) || error.code === 'OPENAI_INVALID_KEY' || error.errorCode === 'OPENAI_INVALID_KEY') {
    return {
      statusCode: 503,
      errorCode: 'OPENAI_INVALID_KEY',
      message: 'Invalid Anthropic API key. Check the workspace AI key or ANTHROPIC_API_KEY in Backend/.env.',
    };
  }

  if (isBillingCreditError(error)) {
    return {
      statusCode: 402,
      errorCode: 'AI_PROVIDER_BILLING_REQUIRED',
      message: 'AI assistant is temporarily unavailable because provider billing limits were reached. Please try again later or contact support.',
    };
  }

  if (isProviderUnavailableError(error)) {
    return {
      statusCode: 503,
      errorCode: 'AI_PROVIDER_UNAVAILABLE',
      message: 'AI assistant is temporarily unavailable. Please try again in a moment.',
    };
  }

  return null;
};

/**
 * Re-throw provider errors with normalized status/code/message fields.
 * @param {Error} error
 * @returns {never}
 */
const normalizeAiProviderError = (error) => {
  const classified = classifyAiProviderError(error);
  if (!classified) {
    throw error;
  }

  const normalized = new Error(classified.message);
  normalized.statusCode = classified.statusCode;
  normalized.errorCode = classified.errorCode;
  normalized.code = classified.errorCode;
  normalized.aiProviderError = true;
  throw normalized;
};

const getBillingCircuitState = (tenantId) => {
  const key = circuitKey(tenantId);
  const entry = billingCircuit.get(key);
  if (!entry) return null;
  if (Date.now() > entry.until) {
    billingCircuit.delete(key);
    return null;
  }
  return entry;
};

const openBillingCircuit = (tenantId, error) => {
  const classified = classifyAiProviderError(error);
  if (!classified || classified.errorCode !== 'AI_PROVIDER_BILLING_REQUIRED') {
    return;
  }

  billingCircuit.set(circuitKey(tenantId), {
    until: Date.now() + DEFAULT_BILLING_CIRCUIT_TTL_MS,
    statusCode: classified.statusCode,
    errorCode: classified.errorCode,
    message: classified.message,
  });
};

const clearBillingCircuit = (tenantId) => {
  billingCircuit.delete(circuitKey(tenantId));
};

const buildBillingCircuitError = (tenantId) => {
  const entry = getBillingCircuitState(tenantId);
  if (!entry) return null;

  const error = new Error(entry.message);
  error.statusCode = entry.statusCode;
  error.errorCode = entry.errorCode;
  error.code = entry.errorCode;
  error.aiProviderError = true;
  error.circuitBreaker = true;
  return error;
};

/**
 * Fast preflight: ensure a tenant or system Anthropic key exists before expensive work.
 * @param {string | null | undefined} tenantId
 */
const assertAiProviderConfigured = async (tenantId) => {
  const tenantKey = await getTenantAnthropicApiKey(tenantId);
  if (tenantKey || normalizedSystemKey()) {
    return;
  }

  const error = new Error('AI assistant is not configured. Set ANTHROPIC_API_KEY in the backend .env to enable.');
  error.statusCode = 503;
  error.errorCode = 'OPENAI_NOT_CONFIGURED';
  error.code = 'OPENAI_NOT_CONFIGURED';
  error.aiProviderError = true;
  throw error;
};

const toDurationMs = (start) => Number((process.hrtime.bigint() - start) / 1000000n);

module.exports = {
  DEFAULT_BILLING_CIRCUIT_TTL_MS,
  assertAiProviderConfigured,
  buildBillingCircuitError,
  classifyAiProviderError,
  clearBillingCircuit,
  getBillingCircuitState,
  isBillingCreditError,
  normalizeAiProviderError,
  openBillingCircuit,
  toDurationMs,
};
