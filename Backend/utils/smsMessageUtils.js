const { resolveDocumentOrganization } = require('./documentOrganizationUtils');

const SMS_MAX_LENGTH = 160;

/**
 * Display name for SMS prefix (shop/branch or tenant name).
 * @param {object|null} organization - From resolveDocumentOrganization
 * @returns {string}
 */
function resolveSmsDisplayName(organization) {
  const name = String(organization?.name || '').trim();
  if (name) return name;
  return 'African Business Suite';
}

/**
 * Prefix customer-facing SMS with business/shop name.
 * @param {string} body - Message body without prefix
 * @param {string} displayName - Shop or business name
 * @returns {string}
 */
function formatCustomerSmsMessage(body, displayName) {
  const trimmedBody = String(body || '').trim();
  const name = String(displayName || '').trim();
  if (!name) return trimmedBody.substring(0, SMS_MAX_LENGTH);
  const prefixed = `${name}: ${trimmedBody}`;
  return prefixed.substring(0, SMS_MAX_LENGTH);
}

/**
 * Resolve organization and format a customer SMS in one step.
 * @param {object} options
 * @param {string} options.tenantId
 * @param {object|null} [options.shop]
 * @param {object|null} [options.studioLocation]
 * @param {string} options.body
 * @returns {Promise<string>}
 */
async function formatCustomerSmsForTenant({ tenantId, shop = null, studioLocation = null, body }) {
  const organization = await resolveDocumentOrganization({ tenantId, shop, studioLocation });
  const displayName = resolveSmsDisplayName(organization);
  return formatCustomerSmsMessage(body, displayName);
}

module.exports = {
  SMS_MAX_LENGTH,
  resolveSmsDisplayName,
  formatCustomerSmsMessage,
  formatCustomerSmsForTenant,
};
