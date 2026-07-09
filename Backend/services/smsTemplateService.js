const { Setting } = require('../models');
const {
  SMS_TEMPLATE_EVENT_KEYS,
  getSmsTemplateDefinition,
  listSmsTemplateDefinitions,
} = require('../config/smsTemplatesCatalog');
const { formatCustomerSmsMessage } = require('../utils/smsMessageUtils');

const SETTINGS_KEY = 'sms_templates';
const PLACEHOLDER_REGEX = /\{(\w+)\}/g;

const getSettingValue = async (tenantId) => {
  const setting = await Setting.findOne({ where: { tenantId, key: SETTINGS_KEY } });
  return setting?.value && typeof setting.value === 'object' ? setting.value : {};
};

const upsertSettingValue = async (tenantId, value) => {
  const [setting] = await Setting.findOrCreate({
    where: { tenantId, key: SETTINGS_KEY },
    defaults: {
      tenantId,
      key: SETTINGS_KEY,
      value,
      description: 'Tenant SMS message template overrides',
    },
  });
  if (!setting.isNewRecord) {
    setting.value = value;
    await setting.save();
  }
  return value;
};

/**
 * Replace {variable} placeholders in template body.
 * @param {string} body
 * @param {Record<string, string>} variables
 * @returns {string}
 */
const replacePlaceholders = (body, variables = {}) =>
  String(body || '').replace(PLACEHOLDER_REGEX, (match, key) => {
    const value = variables[key];
    if (value === undefined || value === null || String(value).trim() === '') {
      return match;
    }
    return String(value);
  });

/**
 * Validate template body for an event (required placeholders present in body).
 * @param {string} eventKey
 * @param {string} body
 * @returns {{ valid: boolean, errors: string[] }}
 */
const validateTemplateBody = (eventKey, body) => {
  const def = getSmsTemplateDefinition(eventKey);
  if (!def) {
    return { valid: false, errors: [`Unknown SMS template event: ${eventKey}`] };
  }

  const trimmed = String(body || '').trim();
  if (!trimmed) {
    return { valid: false, errors: ['Message body cannot be empty'] };
  }

  const errors = [];
  const required = def.requiredVariables || [];
  required.forEach((varName) => {
    if (!trimmed.includes(`{${varName}}`)) {
      errors.push(`Template must include {${varName}}`);
    }
  });

  const anyOfGroups = def.requiredAnyOf || [];
  if (anyOfGroups.length > 0) {
    const anySatisfied = anyOfGroups.some((group) =>
      group.some((varName) => trimmed.includes(`{${varName}}`))
    );
    if (!anySatisfied) {
      const options = [...new Set(anyOfGroups.flat())].map((v) => `{${v}}`).join(', ');
      errors.push(`Template must include at least one of: ${options}`);
    }
  }

  const unknownPlaceholders = [...trimmed.matchAll(PLACEHOLDER_REGEX)]
    .map((match) => match[1])
    .filter((key) => !def.variables.includes(key));
  if (unknownPlaceholders.length > 0) {
    errors.push(`Unknown variables: ${[...new Set(unknownPlaceholders)].join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validate that runtime variables satisfy required placeholders still in body.
 * @param {string} eventKey
 * @param {string} body
 * @param {Record<string, string>} variables
 * @returns {{ valid: boolean, missing: string[] }}
 */
const validateRenderVariables = (eventKey, body, variables = {}) => {
  const def = getSmsTemplateDefinition(eventKey);
  if (!def) {
    return { valid: false, missing: ['event'] };
  }

  const placeholders = [...String(body).matchAll(PLACEHOLDER_REGEX)].map((m) => m[1]);
  const missing = placeholders.filter((key) => {
    const val = variables[key];
    return val === undefined || val === null || String(val).trim() === '';
  });

  const anyOfGroups = def.requiredAnyOf || [];
  anyOfGroups.forEach((group) => {
    const usedInBody = group.filter((varName) => String(body).includes(`{${varName}}`));
    if (usedInBody.length === 0) return;
    const hasValue = usedInBody.some((varName) => {
      const val = variables[varName];
      return val !== undefined && val !== null && String(val).trim() !== '';
    });
    if (!hasValue) {
      missing.push(...usedInBody);
    }
  });

  return { valid: missing.length === 0, missing: [...new Set(missing)] };
};

/**
 * Render SMS body with variables and business prefix.
 * @param {string} eventKey
 * @param {string} body
 * @param {Record<string, string>} variables
 * @returns {string}
 */
const renderTemplate = (eventKey, body, variables = {}) => {
  const rendered = replacePlaceholders(body, variables);
  const displayName =
    String(variables.branchName || '').trim() ||
    String(variables.businessName || '').trim() ||
    '';
  return formatCustomerSmsMessage(rendered, displayName);
};

const getEffectiveBody = async (tenantId, eventKey) => {
  const def = getSmsTemplateDefinition(eventKey);
  if (!def) return null;

  const overrides = await getSettingValue(tenantId);
  const override = overrides[eventKey];
  if (override && override.enabled === false) {
    return def.defaultBody;
  }
  if (override?.body && String(override.body).trim()) {
    return String(override.body).trim();
  }
  return def.defaultBody;
};

/**
 * @param {string} tenantId
 * @returns {Promise<object[]>}
 */
const getTemplatesForTenant = async (tenantId) => {
  const overrides = await getSettingValue(tenantId);
  return listSmsTemplateDefinitions().map((def) => {
    const override = overrides[def.key];
    const isCustom = Boolean(override?.body && String(override.body).trim());
    const useCustom = isCustom && override.enabled !== false;
    const body = useCustom ? String(override.body).trim() : def.defaultBody;
    return {
      eventKey: def.key,
      label: def.label,
      description: def.description,
      category: def.category,
      variables: def.variables,
      requiredVariables: def.requiredVariables,
      requiredAnyOf: def.requiredAnyOf,
      defaultBody: def.defaultBody,
      body,
      isCustom: useCustom,
      enabled: override?.enabled !== false,
    };
  });
};

/**
 * @param {string} tenantId
 * @param {string} eventKey
 * @param {string} body
 * @param {boolean} [enabled]
 */
const saveTemplate = async (tenantId, eventKey, body, enabled = true) => {
  const def = getSmsTemplateDefinition(eventKey);
  if (!def) {
    const err = new Error(`Unknown SMS template event: ${eventKey}`);
    err.statusCode = 400;
    throw err;
  }

  const validation = validateTemplateBody(eventKey, body);
  if (!validation.valid) {
    const err = new Error(validation.errors.join(' '));
    err.statusCode = 400;
    err.details = validation.errors;
    throw err;
  }

  const overrides = await getSettingValue(tenantId);
  overrides[eventKey] = {
    body: String(body).trim(),
    enabled: enabled !== false,
  };
  await upsertSettingValue(tenantId, overrides);
  return getTemplatesForTenant(tenantId).then((list) => list.find((t) => t.eventKey === eventKey));
};

/**
 * @param {string} tenantId
 * @param {string} eventKey
 */
const resetTemplate = async (tenantId, eventKey) => {
  const def = getSmsTemplateDefinition(eventKey);
  if (!def) {
    const err = new Error(`Unknown SMS template event: ${eventKey}`);
    err.statusCode = 400;
    throw err;
  }

  const overrides = await getSettingValue(tenantId);
  delete overrides[eventKey];
  await upsertSettingValue(tenantId, overrides);
  return getTemplatesForTenant(tenantId).then((list) => list.find((t) => t.eventKey === eventKey));
};

/**
 * Resolve tenant template and render for sending.
 * @param {string} tenantId
 * @param {string} eventKey
 * @param {Record<string, string>} variables
 * @returns {Promise<string|null>} null if validation fails
 */
const renderForTenant = async (tenantId, eventKey, variables = {}) => {
  const body = await getEffectiveBody(tenantId, eventKey);
  if (!body) return null;

  const { valid, missing } = validateRenderVariables(eventKey, body, variables);
  if (!valid) {
    console.warn(`[SmsTemplate] Missing variables for ${eventKey}:`, missing.join(', '));
    return null;
  }

  return renderTemplate(eventKey, body, variables);
};

module.exports = {
  SETTINGS_KEY,
  SMS_TEMPLATE_EVENT_KEYS,
  replacePlaceholders,
  validateTemplateBody,
  validateRenderVariables,
  renderTemplate,
  getEffectiveBody,
  getTemplatesForTenant,
  saveTemplate,
  resetTemplate,
  renderForTenant,
};
