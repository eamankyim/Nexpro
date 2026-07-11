const { Tenant } = require('../models');
const emailService = require('./emailService');
const emailTemplates = require('./emailTemplates');
const smsService = require('./smsService');
const whatsappService = require('./whatsappService');
const whatsappTemplates = require('./whatsappTemplates');
const { isChannelEnabledForEvent } = require('./messageDeliveryRulesService');
const { getTenantLogoUrl } = require('../utils/tenantLogo');
const { formatCedi } = require('../utils/formatNumber');
const smsTemplateService = require('./smsTemplateService');
const { resolveBusinessNameForContext } = require('../utils/resolveBusinessNameForContext');
const { resolveOrderTrackingLink } = require('../utils/orderTrackingLink');
const {
  TEMPLATE_KEYS,
  shouldUseAutomationInsteadOfBuiltIn,
} = require('./customerNotificationBridgeService');

const EVENT_KEY = 'order_created';

const customerDisplayName = (customer = {}) => customer.name || customer.company || 'Customer';

/**
 * @param {object} sale
 * @param {string} companyName
 * @param {string|null} [trackingLink]
 * @returns {string}
 */
const buildSmsMessageFallback = (sale, companyName, trackingLink = null) => {
  const orderNumber = sale?.saleNumber || 'your order';
  const total = formatCedi(sale?.total || 0);
  const delivery = sale?.metadata?.delivery;
  const deliveryText = delivery?.required
    ? ` Delivery: ${delivery.label || 'selected'} (${formatCedi(delivery.fee || 0)}).`
    : '';
  const trackText = trackingLink ? ` Track your order: ${trackingLink}` : '';
  return `Hello ${customerDisplayName(sale?.customer)}, your order ${orderNumber} from ${companyName} has been received. Total: ${total}.${deliveryText}${trackText}`;
};

/**
 * @param {string} tenantId
 * @param {object} sale
 * @param {{ name: string }} company
 * @param {string|null} trackingLink
 * @returns {Promise<string>}
 */
const buildOrderCreatedSmsMessage = async (tenantId, sale, company, trackingLink) => {
  const branchName = sale.shop?.name || sale.studioLocation?.name || '';
  const variables = {
    customerName: customerDisplayName(sale?.customer),
    businessName: company.name,
    branchName,
    orderNumber: sale?.saleNumber || String(sale?.id || ''),
    amount: formatCedi(sale?.total || 0),
    trackingLink: trackingLink || '',
  };
  const rendered = await smsTemplateService.renderForTenant(tenantId, EVENT_KEY, variables);
  return rendered || buildSmsMessageFallback(sale, company.name, trackingLink);
};

/**
 * Notify the customer when an order/sale is created (email / SMS / WhatsApp).
 * Skips built-in channels when an order_created automation rule is enabled.
 * @param {{ tenantId: string, sale: object }} params
 * @returns {Promise<{ sent: boolean, results: object[], skipped?: boolean, reason?: string }>}
 */
const notifyOrderCreatedForCustomer = async ({ tenantId, sale }) => {
  if (!tenantId || !sale?.customer) {
    return { sent: false, results: [] };
  }

  if (await shouldUseAutomationInsteadOfBuiltIn(tenantId, TEMPLATE_KEYS.ORDER_CREATED_NOTIFICATION)) {
    return { sent: false, results: [], skipped: true, reason: 'automation_enabled' };
  }

  const customer = sale.customer;
  const orderNumber = sale?.saleNumber || String(sale?.id || '');
  const trackingLink = await resolveOrderTrackingLink(tenantId, { orderNumber });

  const tenant = await Tenant.findByPk(tenantId);
  const resolvedNames = await resolveBusinessNameForContext(tenantId, {
    shopId: sale.shopId || sale.shop?.id || customer.shopId || null,
    studioLocationId: sale.studioLocationId || sale.studioLocation?.id || customer.studioLocationId || null,
    customer,
    sale,
  });
  const company = {
    name: resolvedNames.businessName || sale.shop?.name || tenant?.name || 'Business',
    primaryColor: tenant?.metadata?.primaryColor || '#166534',
    logoUrl: getTenantLogoUrl(tenant)
  };
  const results = [];

  const [emailAllowed, smsAllowed, whatsappAllowed] = await Promise.all([
    isChannelEnabledForEvent(tenantId, EVENT_KEY, 'email'),
    isChannelEnabledForEvent(tenantId, EVENT_KEY, 'sms'),
    isChannelEnabledForEvent(tenantId, EVENT_KEY, 'whatsapp')
  ]);

  const email = String(customer.email || '').trim();
  if (emailAllowed && email) {
    const emailConfig = await emailService.getConfig(tenantId);
    if (emailConfig) {
      const { subject, html, text } = emailTemplates.orderCreatedEmail(sale, customer, company, trackingLink);
      const result = await emailService.sendMessage(tenantId, email, subject, html, text);
      results.push({ channel: 'email', success: result.success === true, error: result.error || null });
    }
  }

  const phone = String(customer.phone || '').trim();
  if (smsAllowed && phone) {
    const smsConfig = await smsService.getResolvedConfig(tenantId);
    const smsPhone = smsService.validatePhoneNumber(phone);
    if (smsConfig && smsPhone) {
      const smsBody = await buildOrderCreatedSmsMessage(tenantId, sale, company, trackingLink);
      const result = await smsService.sendMessage(tenantId, smsPhone, smsBody);
      results.push({ channel: 'sms', success: result.success === true, error: result.error || null });
    }
  }

  if (whatsappAllowed && phone) {
    const whatsappConfig = await whatsappService.getConfig(tenantId);
    const whatsappPhone = whatsappService.validatePhoneNumber(phone);
    if (whatsappConfig?.enabled && whatsappPhone) {
      const templateName = whatsappConfig.orderCreatedTemplateName || 'order_created';
      const salePlain = typeof sale.toJSON === 'function' ? sale.toJSON() : sale;
      const whatsappFallback = buildSmsMessageFallback(sale, company.name, trackingLink);
      const result = await whatsappService.sendMessage(
        tenantId,
        whatsappPhone,
        templateName,
        templateName === 'order_created'
          ? whatsappTemplates.prepareOrderCreated({ ...salePlain, tenant })
          : [whatsappFallback.slice(0, 900)],
        whatsappConfig.orderCreatedTemplateLanguage || 'en',
        { category: 'transactional', metadata: { source: EVENT_KEY, saleId: sale.id } }
      );
      results.push({ channel: 'whatsapp', success: result.success === true, error: result.error || null });
    }
  }

  return {
    sent: results.some((result) => result.success),
    results
  };
};

module.exports = {
  EVENT_KEY,
  notifyOrderCreatedForCustomer,
  buildSmsMessageFallback,
  buildOrderCreatedSmsMessage,
};
