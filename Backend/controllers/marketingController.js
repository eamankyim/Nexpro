const { Customer, Setting, Tenant } = require('../models');
const emailTemplates = require('../services/emailTemplates');
const { applyTenantFilter } = require('../utils/tenantUtils');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const whatsappService = require('../services/whatsappService');
const { getTenantLogoUrl } = require('../utils/tenantLogo');
const {
  enrichCapabilitiesWithVerification,
  applyVerificationAfterBroadcast,
} = require('../services/marketingChannelVerification');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const MAX_BROADCAST_RECIPIENTS = 500;
const MAX_FAILED_SAMPLES = 40;

/**
 * Email is “available” only when Settings → Email is enabled and has outbound credentials
 * (SMTP host, SendGrid, or SES). A company profile email alone does not send mail.
 * Matches GET /api/settings/notification-channels `email` flag.
 *
 * @param {string} tenantId
 * @returns {Promise<{ email: { available: boolean, businessProfileEmailSet: boolean }, sms: { available: boolean }, whatsapp: { available: boolean } }>}
 */
async function resolveCapabilities(tenantId) {
  const [emailCfg, smsCfg, waCfg, orgSetting, emailSettingRow] = await Promise.all([
    emailService.getConfig(tenantId),
    smsService.getResolvedConfig(tenantId),
    whatsappService.getConfig(tenantId),
    Setting.findOne({
      where: { tenantId, key: 'organization' },
      attributes: ['value'],
    }),
    Setting.findOne({
      where: { tenantId, key: 'email' },
      attributes: ['value'],
    }),
  ]);
  const ev = emailCfg || {};
  const emailAvailable = !!(
    emailCfg &&
    (ev.smtpHost || ev.sendgridApiKey || ev.sesAccessKeyId)
  );
  const orgEmail = (orgSetting?.value?.email || '').trim();
  const businessProfileEmailSet = EMAIL_REGEX.test(orgEmail);
  const rawEmail = emailSettingRow?.value || {};
  console.log(
    `[Marketing][capabilities] marketingEmailAvailable=${emailAvailable} businessProfileEmailSet=${businessProfileEmailSet} ` +
      `${emailService.formatTenantEmailAudit(tenantId, rawEmail)}`
  );
  return {
    email: { available: emailAvailable, businessProfileEmailSet },
    sms: { available: !!smsCfg },
    whatsapp: { available: !!waCfg },
  };
}

function customerDisplayName(c) {
  return (c.name && String(c.name).trim()) || (c.company && String(c.company).trim()) || 'Customer';
}

/**
 * Load customers for broadcast (newest first), capped.
 * @returns {Promise<{ rows: object[], total: number, truncated: boolean }>}
 */
async function loadCustomersForBroadcast(tenantId, activeOnly) {
  const where = applyTenantFilter(tenantId, activeOnly ? { isActive: true } : {});
  const total = await Customer.count({ where });
  const rows = await Customer.findAll({
    where,
    attributes: ['id', 'name', 'company', 'email', 'phone'],
    order: [['createdAt', 'DESC']],
    limit: MAX_BROADCAST_RECIPIENTS,
  });
  return { rows, total, truncated: total > MAX_BROADCAST_RECIPIENTS };
}

function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

function pushFailure(bucket, customerId, reason, cap = MAX_FAILED_SAMPLES) {
  if (bucket.length >= cap) return;
  bucket.push({ customerId, reason: String(reason).slice(0, 200) });
}

// @desc    Which marketing channels are configured for this tenant
// @route   GET /api/marketing/capabilities
// @access  Private (admin, manager)
exports.getCapabilities = async (req, res, next) => {
  try {
    const base = await resolveCapabilities(req.tenantId);
    const data = await enrichCapabilitiesWithVerification(req.tenantId, base);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Recipient counts for current workspace customers
// @route   GET /api/marketing/preview
// @access  Private (admin, manager)
exports.getPreview = async (req, res, next) => {
  try {
    const activeOnly = req.query.activeOnly !== 'false';
    const { rows, total, truncated } = await loadCustomersForBroadcast(req.tenantId, activeOnly);

    const seenEmails = new Set();
    let withEmail = 0;
    let withSmsPhone = 0;
    let withWhatsappPhone = 0;

    for (const c of rows) {
      const em = normalizeEmail(c.email);
      if (em && EMAIL_REGEX.test(em) && !seenEmails.has(em)) {
        seenEmails.add(em);
        withEmail += 1;
      }
      const ph = smsService.validatePhoneNumber(c.phone);
      if (ph) {
        withSmsPhone += 1;
        withWhatsappPhone += 1;
      }
    }

    const baseCaps = await resolveCapabilities(req.tenantId);
    const capabilities = await enrichCapabilitiesWithVerification(req.tenantId, baseCaps);

    res.status(200).json({
      success: true,
      data: {
        totalInWorkspace: total,
        batchSize: rows.length,
        truncated,
        maxRecipients: MAX_BROADCAST_RECIPIENTS,
        withEmail,
        withSmsPhone,
        withWhatsappPhone,
        capabilities,
        contacts: rows.map((c) => ({
          id: c.id,
          name: c.name,
          company: c.company,
          email: c.email,
          phone: c.phone,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Broadcast message to customers (email / SMS / WhatsApp template)
// @route   POST /api/marketing/broadcast
// @access  Private (admin, manager)
exports.postBroadcast = async (req, res, next) => {
  try {
    const {
      channels = [],
      activeOnly = true,
      dryRun = false,
      customerIds: rawCustomerIds,
      subject,
      emailBody,
      smsBody,
      whatsappTemplateName,
      whatsappLanguage = 'en',
      whatsappParameters = [],
      whatsappPrependCustomerName = false,
    } = req.body || {};

    let customerIdFilter = null;
    if (rawCustomerIds !== undefined && rawCustomerIds !== null) {
      if (!Array.isArray(rawCustomerIds)) {
        return res.status(400).json({
          success: false,
          message: 'customerIds must be an array of customer IDs',
        });
      }
      if (rawCustomerIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Select at least one contact to message',
        });
      }
      if (rawCustomerIds.length > MAX_BROADCAST_RECIPIENTS) {
        return res.status(400).json({
          success: false,
          message: `At most ${MAX_BROADCAST_RECIPIENTS} recipients per broadcast`,
        });
      }
      customerIdFilter = new Set(rawCustomerIds.map((id) => String(id)));
    }

    const list = Array.isArray(channels) ? channels.map((c) => String(c).toLowerCase()) : [];
    const allowed = new Set(['email', 'sms', 'whatsapp']);
    const normalizedChannels = [...new Set(list.filter((c) => allowed.has(c)))];

    if (normalizedChannels.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Select at least one channel: email, sms, or whatsapp',
      });
    }

    const capabilities = await resolveCapabilities(req.tenantId);
    for (const ch of normalizedChannels) {
      if (!capabilities[ch]?.available) {
        return res.status(400).json({
          success: false,
          message: `Channel "${ch}" is not configured for this workspace. Configure it in Settings first.`,
        });
      }
    }

    if (normalizedChannels.includes('email')) {
      if (!subject || !String(subject).trim()) {
        return res.status(400).json({ success: false, message: 'Email subject is required' });
      }
      if (!emailBody || !String(emailBody).trim()) {
        return res.status(400).json({ success: false, message: 'Email body is required' });
      }
    }

    if (normalizedChannels.includes('sms')) {
      if (!smsBody || !String(smsBody).trim()) {
        return res.status(400).json({ success: false, message: 'SMS message is required' });
      }
    }

    if (normalizedChannels.includes('whatsapp')) {
      if (!whatsappTemplateName || !String(whatsappTemplateName).trim()) {
        return res.status(400).json({
          success: false,
          message: 'WhatsApp requires a Meta-approved template name (whatsappTemplateName)',
        });
      }
      if (!Array.isArray(whatsappParameters)) {
        return res.status(400).json({
          success: false,
          message: 'whatsappParameters must be an array of strings (template body variables)',
        });
      }
    }

    const { rows, total, truncated } = await loadCustomersForBroadcast(req.tenantId, Boolean(activeOnly));

    let recipientRows = rows;
    if (customerIdFilter) {
      recipientRows = rows.filter((r) => customerIdFilter.has(String(r.id)));
      if (recipientRows.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            'No matching contacts in the current audience. Refresh the list, adjust Active customers only, or update your selection.',
        });
      }
    }

    const result = {
      dryRun: Boolean(dryRun),
      totalInWorkspace: total,
      batchSize: recipientRows.length,
      truncated,
      channels: normalizedChannels,
      email: { sent: 0, skipped: 0, failed: [] },
      sms: { sent: 0, skipped: 0, failed: [] },
      whatsapp: { sent: 0, skipped: 0, failed: [] },
    };

    const subj = subject ? String(subject).trim() : '';
    let html = '';
    if (emailBody) {
      const tenantRow = await Tenant.findByPk(req.tenantId, {
        attributes: ['name', 'metadata']
      });
      const company = {
        name: tenantRow?.name || 'Your business',
        primaryColor: tenantRow?.metadata?.primaryColor || '#166534',
        logoUrl: getTenantLogoUrl(tenantRow)
      };
      html = emailTemplates.marketingPlainMessageEmail(String(emailBody), company);
    }
    const text = emailBody ? String(emailBody).trim() : '';
    const smsText = smsBody ? String(smsBody).trim().substring(0, 480) : '';
    const waTemplate = whatsappTemplateName ? String(whatsappTemplateName).trim() : '';
    const waLang = String(whatsappLanguage || 'en').trim() || 'en';
    const waStaticParams = (whatsappParameters || []).map((p) => String(p ?? ''));

    const seenEmails = new Set();
    const seenSmsPhones = new Set();
    const seenWaPhones = new Set();
    /** @type {{ customerId: string, to: string }[]} */
    const pendingEmailSends = [];

    for (const c of recipientRows) {
      if (normalizedChannels.includes('email')) {
        const em = normalizeEmail(c.email);
        if (!em || !EMAIL_REGEX.test(em)) {
          result.email.skipped += 1;
        } else if (seenEmails.has(em)) {
          result.email.skipped += 1;
        } else if (dryRun) {
          seenEmails.add(em);
          result.email.sent += 1;
        } else {
          seenEmails.add(em);
          pendingEmailSends.push({ customerId: c.id, to: em });
        }
      }

      if (normalizedChannels.includes('sms')) {
        const ph = smsService.validatePhoneNumber(c.phone);
        if (!ph) {
          result.sms.skipped += 1;
        } else if (seenSmsPhones.has(ph)) {
          result.sms.skipped += 1;
        } else if (dryRun) {
          seenSmsPhones.add(ph);
          result.sms.sent += 1;
        } else {
          const sendRes = await smsService.sendMessage(req.tenantId, ph, smsText);
          seenSmsPhones.add(ph);
          if (sendRes.success) {
            result.sms.sent += 1;
          } else {
            pushFailure(result.sms.failed, c.id, sendRes.error || 'send failed');
          }
        }
      }

      if (normalizedChannels.includes('whatsapp')) {
        const ph = whatsappService.validatePhoneNumber(c.phone);
        if (!ph) {
          result.whatsapp.skipped += 1;
        } else if (seenWaPhones.has(ph)) {
          result.whatsapp.skipped += 1;
        } else {
          const params = whatsappPrependCustomerName
            ? [customerDisplayName(c), ...waStaticParams]
            : [...waStaticParams];
          if (dryRun) {
            seenWaPhones.add(ph);
            result.whatsapp.sent += 1;
          } else {
            const sendRes = await whatsappService.sendMessage(req.tenantId, ph, waTemplate, params, waLang);
            seenWaPhones.add(ph);
            if (sendRes.success) {
              result.whatsapp.sent += 1;
            } else {
              pushFailure(result.whatsapp.failed, c.id, sendRes.error || 'send failed');
            }
          }
        }
      }
    }

    if (!dryRun && pendingEmailSends.length > 0) {
      const mailJobs = pendingEmailSends.map((p) => ({
        to: p.to,
        subject: subj,
        html,
        text,
      }));
      const bulkResults = await emailService.sendBulkTenantEmails(req.tenantId, mailJobs);
      bulkResults.forEach((r, i) => {
        const cid = pendingEmailSends[i].customerId;
        if (r.success) {
          result.email.sent += 1;
        } else {
          pushFailure(result.email.failed, cid, r.error || 'send failed');
        }
      });
    }

    console.log('[Marketing] broadcast', {
      tenantId: req.tenantId,
      userId: req.user?.id,
      dryRun: result.dryRun,
      channels: normalizedChannels,
      email: { sent: result.email.sent, failed: result.email.failed.length, skipped: result.email.skipped },
      sms: { sent: result.sms.sent, failed: result.sms.failed.length, skipped: result.sms.skipped },
      whatsapp: { sent: result.whatsapp.sent, failed: result.whatsapp.failed.length, skipped: result.whatsapp.skipped },
    });

    try {
      await applyVerificationAfterBroadcast(req.tenantId, result.dryRun, result);
    } catch (verifyErr) {
      console.warn('[Marketing] applyVerificationAfterBroadcast:', verifyErr?.message || verifyErr);
    }

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
