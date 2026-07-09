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

const EVENT_KEY = 'order_created';

const customerDisplayName = (customer = {}) => customer.name || customer.company || 'Customer';

const buildSmsMessageFallback = (sale, companyName) => {
  const orderNumber = sale?.saleNumber || 'your order';
  const total = formatCedi(sale?.total || 0);
  const delivery = sale?.metadata?.delivery;
  const deliveryText = delivery?.required
    ? ` Delivery: ${delivery.label || 'selected'} (${formatCedi(delivery.fee || 0)}).`
    : '';
  return `Hello ${customerDisplayName(sale?.customer)}, your order ${orderNumber} from ${companyName} has been received. Total: ${total}.${deliveryText}`;
};

const buildOrderCreatedSmsMessage = async (tenantId, sale, company) => {
  const branchName = sale.shop?.name || sale.studioLocation?.name || '';
  const variables = {
    customerName: customerDisplayName(sale?.customer),
    businessName: company.name,
    branchName,
    orderNumber: sale?.saleNumber || String(sale?.id || ''),
    amount: formatCedi(sale?.total || 0),
    trackingLink: '',
  };
  const rendered = await smsTemplateService.renderForTenant(tenantId, EVENT_KEY, variables);
  return rendered || buildSmsMessageFallback(sale, company.name);
};

const notifyOrderCreatedForCustomer = async ({ tenantId, sale }) => {
  if (!tenantId || !sale?.customer) {
    return { sent: false, results: [] };
  }

  const customer = sale.customer;
  const tenant = await Tenant.findByPk(tenantId);
  const company = {
    name: sale.shop?.name || tenant?.name || 'Business',
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
      const { subject, html, text } = emailTemplates.orderCreatedEmail(sale, customer, company);
      const result = await emailService.sendMessage(tenantId, email, subject, html, text);
      results.push({ channel: 'email', success: result.success === true, error: result.error || null });
    }
  }

  const phone = String(customer.phone || '').trim();
  if (smsAllowed && phone) {
    const smsConfig = await smsService.getResolvedConfig(tenantId);
    const smsPhone = smsService.validatePhoneNumber(phone);
    if (smsConfig && smsPhone) {
      const smsBody = await buildOrderCreatedSmsMessage(tenantId, sale, company);
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
      const whatsappFallback = buildSmsMessageFallback(sale, company.name);
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
  notifyOrderCreatedForCustomer
};
