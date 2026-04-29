const { Invoice, Job, Customer, JobItem, Payment, Sale, SaleItem, Prescription, SaleActivity, Tenant, Setting, Quote, QuoteItem, Product } = require('../models');
const { Op } = require('sequelize');
const { getPagination } = require('../utils/paginationUtils');
const { createInvoicePaymentJournal, createInvoiceRevenueJournal } = require('../services/invoiceAccountingService');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');
const { invalidateInvoiceListCache, invalidateAfterMutation } = require('../middleware/cache');
const activityLogger = require('../services/activityLogger');
const { updateCustomerBalance } = require('../services/customerBalanceService');
const sabitoWebhookService = require('../services/sabitoWebhookService');
const mobileMoneyService = require('../services/mobileMoneyService');
const { getResolvedMtnConfigForTenant } = require('../services/tenantMomoCollectionService');
const { sequelize } = require('../config/database');
const { getTaxConfigForTenant } = require('../utils/taxConfig');
const { convertLineItemsFromTaxInclusive } = require('../utils/taxCalculation');
const { getTenantLogoUrl } = require('../utils/tenantLogo');

// Helper function to generate invoice number
const generateInvoiceNumber = async (tenantId) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  const lastInvoice = await Invoice.findOne({
    where: {
      tenantId,
      invoiceNumber: {
        [Op.like]: `INV-${year}${month}%`
      }
    },
    order: [['createdAt', 'DESC']]
  });

  let sequence = 1;
  if (lastInvoice) {
    const lastSequence = parseInt(lastInvoice.invoiceNumber.split('-').pop());
    sequence = lastSequence + 1;
  }

  return `INV-${year}${month}-${String(sequence).padStart(4, '0')}`;
};

/**
 * Visibility rules for invoice list and summary stats (must stay in sync).
 * Applies tenant scope, business-type sourceType rules, and staff "own jobs/sales only".
 *
 * @param {import('express').Request} req
 * @returns {Promise<Object>} Sequelize where clause
 */
const buildInvoiceVisibilityWhere = async (req) => {
  const where = applyTenantFilter(req.tenantId, {});

  const businessType = req.tenant?.businessType;
  if (businessType) {
    if (businessType === 'printing_press') {
      where[Op.or] = [{ sourceType: 'job' }, { sourceType: null }];
    } else if (businessType === 'shop') {
      where.sourceType = 'sale';
    } else if (businessType === 'pharmacy') {
      where.sourceType = 'prescription';
    }
  }

  const effectiveRole = (req.tenantRole && ['owner', 'admin'].includes(req.tenantRole)) ? 'admin' : req.user?.role;
  if (effectiveRole === 'staff') {
    const [mySales, myJobs] = await Promise.all([
      Sale.findAll({ where: applyTenantFilter(req.tenantId, { soldBy: req.user.id }), attributes: ['id'] }),
      Job.findAll({ where: applyTenantFilter(req.tenantId, { createdBy: req.user.id }), attributes: ['id'] })
    ]);
    const saleIds = mySales.map((s) => s.id);
    const jobIds = myJobs.map((j) => j.id);
    const ownOr = [];
    if (saleIds.length) ownOr.push({ saleId: { [Op.in]: saleIds } });
    if (jobIds.length) ownOr.push({ jobId: { [Op.in]: jobIds } });
    if (ownOr.length) {
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push({ [Op.or]: ownOr });
    } else {
      where.id = { [Op.in]: [] };
    }
  }

  return where;
};

/**
 * Send invoice paid confirmation to customer (email + optional SMS). Fire-and-forget; errors are logged only.
 * @param {string} tenantId - Tenant ID
 * @param {Object} invoice - Invoice with customer included (totalAmount, invoiceNumber, amountPaid, paidDate)
 */
async function sendInvoicePaidConfirmationToCustomer(tenantId, invoice) {
  try {
    const { Setting } = require('../models');
    const prefsRow = await Setting.findOne({ where: { tenantId, key: 'customer-notification-preferences' } });
    const prefs = prefsRow?.value || {};
    if (prefs.sendInvoicePaidConfirmationToCustomer === false) return;

    const customer = invoice.customer;
    if (!customer) return;

    const invoiceForTemplate = {
      invoiceNumber: invoice.invoiceNumber,
      total: parseFloat(invoice.totalAmount) || 0,
      currency: invoice.currency || 'GHS',
      paidDate: invoice.paidDate || new Date()
    };

    const { Tenant } = require('../models');
    const tenant = await Tenant.findByPk(tenantId);
    const company = {
      name: tenant?.name || 'African Business Suite',
      logo: getTenantLogoUrl(tenant),
      primaryColor: tenant?.metadata?.primaryColor || '#166534'
    };

    if (customer.email) {
      const emailService = require('../services/emailService');
      const emailTemplates = require('../services/emailTemplates');
      const { subject, html, text } = emailTemplates.invoicePaidConfirmation(invoiceForTemplate, customer, company);
      const result = await emailService.sendMessage(tenantId, customer.email, subject, html, text);
      if (result.success) {
        console.log('[Invoice] Paid confirmation email sent to customer');
      }
    }

    const smsService = require('../services/smsService');
    const smsConfig = await smsService.getResolvedConfig(tenantId);
    if (smsConfig && customer.phone) {
      const smsPhone = smsService.validatePhoneNumber(customer.phone);
      if (smsPhone && smsService.checkRateLimit(tenantId)) {
        const invNum = invoice.invoiceNumber || `#${invoice.id}`;
        const smsMessage = `Invoice ${invNum} paid. Thank you.`.substring(0, 160);
        const smsResult = await smsService.sendMessage(tenantId, smsPhone, smsMessage);
        if (smsResult.success) {
          console.log('[Invoice] Paid confirmation SMS sent to customer');
        }
      }
    }
  } catch (error) {
    console.error('[Invoice] sendInvoicePaidConfirmationToCustomer error:', error.message);
  }
}

exports.sendInvoicePaidConfirmationToCustomer = sendInvoicePaidConfirmationToCustomer;

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Private
exports.getInvoices = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = req.query.search;
    const status = req.query.status;
    const customerId = req.query.customerId;
    const jobId = req.query.jobId;
    const saleId = req.query.saleId;
    const prescriptionId = req.query.prescriptionId;
    const sourceType = req.query.sourceType;

    const where = await buildInvoiceVisibilityWhere(req);

    if (search) {
      // Build search condition; preserve existing where[Op.and] (e.g. staff "own" filter)
      const searchCondition = { invoiceNumber: { [Op.iLike]: `%${search}%` } };
      where[Op.and] = Array.isArray(where[Op.and]) ? [...where[Op.and]] : (where[Op.and] ? [where[Op.and]] : []);
      if (where[Op.or]) {
        where[Op.and].push({ [Op.or]: where[Op.or] });
        delete where[Op.or];
      }
      where[Op.and].push(searchCondition);
    }
    
    if (status && status !== '') where.status = status;
    if (customerId) where.customerId = customerId;
    if (jobId) where.jobId = jobId;
    if (saleId) where.saleId = saleId;
    if (prescriptionId) where.prescriptionId = prescriptionId;
    if (sourceType) where.sourceType = sourceType;

    // Build includes array
    const include = [
      {
        model: Customer,
        as: 'customer',
        attributes: ['id', 'name', 'company', 'email', 'phone']
      },
      {
        model: Job,
        as: 'job',
        attributes: ['id', 'jobNumber', 'title', 'status'],
        required: false
      }
    ];

    // Include Sale if model is available (for shop/pharmacy business types)
    if (Sale) {
      include.push({
        model: Sale,
        as: 'sale',
        attributes: ['id', 'saleNumber', 'createdAt', 'total'],
        required: false
      });
    }

    // Include Prescription if model is available (for pharmacy business type)
    if (Prescription) {
      include.push({
        model: Prescription,
        as: 'prescription',
        attributes: ['id', 'prescriptionNumber', 'prescriptionDate'],
        include: [{
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name'],
          required: false
        }],
        required: false
      });
    }

    const { count, rows } = await Invoice.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include
    });

    res.status(200).json({
      success: true,
      count,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      },
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export invoices to CSV/Excel
// @route   GET /api/invoices/export
// @access  Private (admin, manager)
exports.exportInvoices = async (req, res, next) => {
  try {
    const { format = 'csv', status } = req.query;
    const { sendCSV, sendExcel, COLUMN_DEFINITIONS } = require('../utils/dataExport');

    const where = applyTenantFilter(req.tenantId, {});
    if (status) where.status = status;

    const invoices = await Invoice.findAll({
      where,
      include: [{ model: Customer, as: 'customer', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
      raw: false
    });
    const rows = invoices.map((inv) => {
      const plain = inv.get({ plain: true });
      return {
        ...plain,
        customer: plain.customer || {},
        tax: plain.taxAmount,
        total: plain.totalAmount
      };
    });

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No invoices to export' });
    }

    const filename = `invoices_${new Date().toISOString().split('T')[0]}`;
    const columns = COLUMN_DEFINITIONS.invoices;

    if (format === 'excel') {
      await sendExcel(res, rows, `${filename}.xlsx`, { columns, sheetName: 'Invoices', title: 'Invoice List' });
    } else {
      sendCSV(res, rows, `${filename}.csv`, columns);
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get single invoice
// @route   GET /api/invoices/:id
// @access  Private
exports.getInvoice = async (req, res, next) => {
  try {
    const include = [
      {
        model: Customer,
        as: 'customer',
        attributes: ['id', 'name', 'company', 'email', 'phone', 'address', 'city']
      },
      {
        model: Job,
        as: 'job',
        attributes: ['id', 'jobNumber', 'title', 'description', 'status', 'createdBy'],
        include: [
          {
            model: JobItem,
            as: 'items'
          }
        ]
      }
    ];
    if (Sale) {
      include.push({
        model: Sale,
        as: 'sale',
        attributes: ['id', 'saleNumber', 'soldBy', 'createdAt', 'total'],
        required: false
      });
    }
    const invoice = await Invoice.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Staff may only view invoices from their sales or their jobs (prescription invoices allowed)
    const effectiveRole = (req.tenantRole && ['owner', 'admin'].includes(req.tenantRole)) ? 'admin' : req.user?.role;
    if (effectiveRole === 'staff') {
      const fromMySale = invoice.saleId && invoice.sale?.soldBy === req.user.id;
      const fromMyJob = invoice.jobId && invoice.job?.createdBy === req.user.id;
      const fromPrescription = !!invoice.prescriptionId;
      if (!fromMySale && !fromMyJob && !fromPrescription) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this invoice'
        });
      }
    }

    res.status(200).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create invoice (from job or direct/manual)
// @route   POST /api/invoices
// @access  Private
exports.createInvoice = async (req, res, next) => {
  try {
    const {
      jobId,
      customerId,
      items: bodyItems = [],
      dueDate,
      paymentTerms,
      taxRate: bodyTaxRate,
      discountType,
      discountValue,
      notes,
      termsAndConditions
    } = sanitizePayload(req.body);

    const taxConfig = await getTaxConfigForTenant(req.tenantId);
    const taxRate =
      taxConfig.enabled
        ? parseFloat(bodyTaxRate) || taxConfig.defaultRatePercent || 0
        : 0;

    const isJobLinked = !!jobId;
    let resolvedCustomerId = customerId || null;
    let sourceType = 'job';
    let job = null;

    if (isJobLinked) {
      // Fetch job with items
      job = await Job.findOne({
        where: applyTenantFilter(req.tenantId, { id: jobId }),
        include: [
          {
            model: JobItem,
            as: 'items'
          },
          {
            model: Customer,
            as: 'customer'
          }
        ]
      });

      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }

      // Check if invoice already exists for this job
      const existingInvoice = await Invoice.findOne({ where: applyTenantFilter(req.tenantId, { jobId }) });
      if (existingInvoice) {
        return res.status(400).json({
          success: false,
          message: 'Invoice already exists for this job'
        });
      }
      resolvedCustomerId = job.customerId;
      sourceType = 'job';
    } else {
      if (!resolvedCustomerId) {
        return res.status(400).json({
          success: false,
          message: 'Customer is required when creating an invoice directly'
        });
      }
      if (!Array.isArray(bodyItems) || bodyItems.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one invoice item is required'
        });
      }

      const customer = await Customer.findOne({
        where: applyTenantFilter(req.tenantId, { id: resolvedCustomerId }),
        attributes: ['id']
      });
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }

      // Keep sourceType within DB enum while ensuring records remain visible per business type.
      const businessType = req.tenant?.businessType;
      if (businessType === 'shop') sourceType = 'sale';
      else if (businessType === 'pharmacy') sourceType = 'prescription';
      else sourceType = 'job';
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(req.tenantId);

    // Calculate subtotal from linked job items OR manual payload items
    let subtotal = 0;
    let items = [];
    let totalItemDiscount = 0;

    if (isJobLinked && job?.items?.length > 0) {
      items = job.items.map((item) => {
        const qty = parseFloat(item.quantity || 0);
        const unitPrice = parseFloat(item.unitPrice || 0);
        const lineGross = qty * unitPrice;
        const storedTotal = parseFloat(item.totalPrice != null ? item.totalPrice : lineGross);
        const explicitDiscount = parseFloat(item.discountAmount || 0);
        const derivedDiscount = Math.max(0, lineGross - storedTotal);
        const lineDiscount = explicitDiscount > 0 ? explicitDiscount : derivedDiscount;
        return {
          description: item.description || item.category,
          category: item.category,
          paperSize: item.paperSize,
          quantity: item.quantity,
          unitPrice,
          discountAmount: lineDiscount,
          discountPercent: parseFloat(item.discountPercent || 0),
          discountReason: item.discountReason || (lineDiscount > 0 ? 'Discount from job line' : null),
          total: lineGross - lineDiscount
        };
      });
      subtotal = items.reduce((sum, item) => sum + (parseFloat(item.quantity) * parseFloat(item.unitPrice)), 0);
      totalItemDiscount = items.reduce((sum, item) => sum + parseFloat(item.discountAmount || 0), 0);
    } else if (isJobLinked) {
      // If linked job has no items, use finalPrice from job
      subtotal = parseFloat(job.finalPrice || 0);
      items = [{
        description: job.title,
        quantity: 1,
        unitPrice: subtotal,
        total: subtotal
      }];
      totalItemDiscount = 0;
    } else {
      items = bodyItems.map((item) => {
        const qty = parseFloat(item.quantity || 0);
        const unitPrice = parseFloat(item.unitPrice || 0);
        const rawDiscount = parseFloat(item.discountAmount || 0);
        const discountScope = String(item.discountScope || 'line').toLowerCase();
        const lineGross = qty * unitPrice;
        const providedTotal = parseFloat(item.total != null ? item.total : lineGross);
        const derivedDiscount = Math.max(0, lineGross - providedTotal);
        const explicitLineDiscount = discountScope === 'unit' ? rawDiscount * qty : rawDiscount;
        const lineDiscount = explicitLineDiscount > 0 ? explicitLineDiscount : derivedDiscount;
        const total = Math.max(0, lineGross - lineDiscount);
        return {
          description: item.description || '',
          quantity: qty,
          unitPrice,
          discountAmount: lineDiscount,
          discountPercent: parseFloat(item.discountPercent || 0),
          discountReason: item.discountReason || null,
          total
        };
      });
      subtotal = items.reduce((sum, item) => sum + (parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0)), 0);
      totalItemDiscount = items.reduce((sum, item) => sum + parseFloat(item.discountAmount || 0), 0);
    }

    if (taxConfig.enabled && taxConfig.pricesAreTaxInclusive && (taxRate || 0) > 0) {
      const conv = convertLineItemsFromTaxInclusive(items, taxRate);
      items = conv.items;
      subtotal = conv.subtotal;
    }

    // Preserve direct-invoice line-item discounts in invoice header totals.
    // For job-linked invoices, also reconcile against job.finalPrice so discounts
    // applied at job-level (but not persisted on each item) are still honored.
    // Invoice model computes total using subtotal - discountValue (+ tax).
    const jobLevelDiscountFallback = isJobLinked
      ? Math.max(
          0,
          (parseFloat(subtotal || 0) - parseFloat(job?.finalPrice || 0))
        )
      : 0;
    const hasHeaderDiscount = discountValue !== undefined && discountValue !== null && discountValue !== '';
    const resolvedDiscountType = discountType || 'fixed';
    const resolvedDiscountValue = hasHeaderDiscount
      ? parseFloat(discountValue || 0)
      : (totalItemDiscount > 0 ? totalItemDiscount : jobLevelDiscountFallback);

    // Create invoice
    const invoice = await Invoice.create({
      invoiceNumber,
      jobId: isJobLinked ? jobId : null,
      customerId: resolvedCustomerId,
      tenantId: req.tenantId,
      sourceType,
      invoiceDate: new Date(),
      dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
      subtotal,
      taxRate: taxRate || 0,
      discountType: resolvedDiscountType,
      discountValue: resolvedDiscountValue,
      paymentTerms: paymentTerms || 'Net 30',
      items,
      notes,
      termsAndConditions: termsAndConditions || 'Payment is due within the specified payment terms. Late payments may incur additional charges.'
    });

    // Fetch the created invoice with relationships
    const createdInvoice = await Invoice.findOne({
      where: applyTenantFilter(req.tenantId, { id: invoice.id }),
      include: [
        {
          model: Customer,
          as: 'customer'
        },
        {
          model: Job,
          as: 'job'
        }
      ]
    });

    // Update customer balance
    try {
      await updateCustomerBalance(invoice.customerId);
    } catch (error) {
      console.error('Failed to update customer balance:', error);
    }

    // Revenue recognition (Dr AR Cr Revenue) for accounting
    try {
      await createInvoiceRevenueJournal(createdInvoice, req.user?.id);
    } catch (journalError) {
      console.error('Failed to create accounting revenue entry for invoice', journalError);
    }

    // Send webhook to Sabito (async, don't block response)
    try {
      const customer = await Customer.findOne({
        where: applyTenantFilter(req.tenantId, { id: createdInvoice.customerId }),
        attributes: [
          'id', 
          'sabitoCustomerId', 
          'sabitoBusinessId', 
          'email', 
          'name', 
          'phone'
        ]
      });

      if (customer) {
        sabitoWebhookService.sendInvoiceWebhook(createdInvoice, customer, req.tenantId)
          .then(async (result) => {
            if (result.success) {
              // Update invoice with Sabito project ID
              await createdInvoice.update({
                sabitoProjectId: result.projectId,
                sabitoSyncedAt: new Date(),
                sabitoSyncStatus: 'synced'
              });
            } else if (result.skipped) {
              await createdInvoice.update({
                sabitoSyncStatus: 'skipped'
              });
            }
          })
          .catch(async (error) => {
            console.error('Failed to send Sabito webhook:', error);
            await createdInvoice.update({
              sabitoSyncStatus: 'failed',
              sabitoSyncError: error.message
            });
          });
      }
    } catch (error) {
      // Don't fail invoice creation if webhook fails
      console.error('Error sending Sabito webhook:', error);
    }

    // Invalidate cache after creating invoice
    invalidateAfterMutation(req.tenantId);

    invalidateInvoiceListCache(req.tenantId);
    res.status(201).json({
      success: true,
      data: createdInvoice
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update invoice
// @route   PUT /api/invoices/:id
// @access  Private
exports.updateInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Don't allow updating paid or cancelled invoices
    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: `Cannot update ${invoice.status} invoice`
      });
    }

    const oldStatus = invoice.status;
    await invoice.update(sanitizePayload(req.body));

    const updatedInvoice = await Invoice.findOne({
      where: applyTenantFilter(req.tenantId, { id: invoice.id }),
      include: [
        {
          model: Customer,
          as: 'customer'
        },
        {
          model: Job,
          as: 'job'
        }
      ]
    });

    // Log activity if status changed to 'sent'
    if (oldStatus !== 'sent' && updatedInvoice.status === 'sent') {
      try {
        await activityLogger.logInvoiceSent(updatedInvoice, req.user?.id || null);
      } catch (error) {
        console.error('Failed to log invoice sent activity:', error);
      }
    }

    invalidateAfterMutation(req.tenantId);
    invalidateInvoiceListCache(req.tenantId);
    res.status(200).json({
      success: true,
      data: updatedInvoice
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete invoice
// @route   DELETE /api/invoices/:id
// @access  Private (Admin only)
exports.deleteInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Don't allow deleting paid invoices
    if (invoice.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete paid invoice'
      });
    }

    const customerId = invoice.customerId;
    await invoice.destroy();

    // Update customer balance after deleting invoice
    try {
      await updateCustomerBalance(customerId);
    } catch (error) {
      console.error('Failed to update customer balance:', error);
    }

    // Invalidate cache after deleting invoice
    invalidateAfterMutation(req.tenantId);

    invalidateInvoiceListCache(req.tenantId);
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete cancelled invoice
// @route   DELETE /api/invoices/:id/cancelled
// @access  Private (Admin only)
exports.deleteCancelledInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    if (invoice.status !== 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Only cancelled invoices can be deleted with this action'
      });
    }

    const customerId = invoice.customerId;
    await invoice.destroy();

    try {
      await updateCustomerBalance(customerId);
    } catch (error) {
      console.error('Failed to update customer balance:', error);
    }

    invalidateAfterMutation(req.tenantId);
    invalidateInvoiceListCache(req.tenantId);
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Record payment on invoice
// @route   POST /api/invoices/:id/payment
// @access  Private
exports.recordPayment = async (req, res, next) => {
  try {
    const { amount, paymentMethod, referenceNumber, paymentDate } = sanitizePayload(req.body);

    const invoice = await Invoice.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    if (invoice.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot record payment on cancelled invoice'
      });
    }

    const paymentAmount = parseFloat(amount);
    const totalAmount = parseFloat(invoice.totalAmount || 0);
    const newAmountPaid = parseFloat(invoice.amountPaid || 0) + paymentAmount;
    const newBalance = Math.max(totalAmount - newAmountPaid, 0);

    if (newAmountPaid > totalAmount) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount exceeds invoice total'
      });
    }

    // Update invoice
    const effectivePaymentDate = paymentDate ? new Date(paymentDate) : new Date();
    const updatePayload = {
      amountPaid: newAmountPaid,
      balance: newBalance
    };

    if (newBalance <= 0) {
      updatePayload.status = 'paid';
      updatePayload.paidDate = effectivePaymentDate;
    } else if (invoice.status === 'draft') {
      updatePayload.status = 'sent';
    }

    await invoice.update(updatePayload);

    // Create payment record
    const paymentNumber = `PAY-${Date.now()}`;
    const payment = await Payment.create({
      paymentNumber,
      type: 'income',
      customerId: invoice.customerId,
      jobId: invoice.jobId,
      tenantId: req.tenantId,
      amount: paymentAmount,
      paymentMethod: paymentMethod || 'cash',
      paymentDate: effectivePaymentDate,
      referenceNumber,
      status: 'completed',
      notes: `Payment for invoice ${invoice.invoiceNumber}`
    });

    const updatedInvoice = await Invoice.findOne({
      where: applyTenantFilter(req.tenantId, { id: invoice.id }),
      include: [
        {
          model: Customer,
          as: 'customer'
        },
        {
          model: Job,
          as: 'job'
        }
      ]
    });

    // Update sale status if invoice is linked to a sale and payment covers the full amount
    if (invoice.saleId && newAmountPaid >= parseFloat(invoice.totalAmount)) {
      try {
        const sale = await Sale.findByPk(invoice.saleId);
        if (sale && sale.status === 'pending') {
          await sale.update({ status: 'completed' });
          
          // Create sale activity for payment received
          await SaleActivity.create({
            saleId: sale.id,
            tenantId: req.tenantId,
            type: 'payment',
            subject: 'Payment Received',
            notes: `Full payment received for invoice ${invoice.invoiceNumber}`,
            createdBy: req.user?.id || null,
            metadata: {
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              paymentAmount: paymentAmount
            }
          });
        }
      } catch (saleError) {
        console.error('Error updating sale status from payment:', saleError);
        // Don't fail the payment if sale update fails
      }
    }

    try {
      await createInvoicePaymentJournal({
        invoice: updatedInvoice,
        amount: paymentAmount,
        paymentDate: effectivePaymentDate,
        paymentMethod: paymentMethod || 'cash',
        referenceNumber,
        paymentRecordNumber: payment.paymentNumber,
        metadata: { paymentId: payment.id },
        userId: req.user?.id || null
      });
    } catch (journalError) {
      console.error('Failed to create accounting entry for invoice payment', journalError);
    }

    try {
      await activityLogger.logPaymentReceived(updatedInvoice, paymentAmount, req.user?.id || null);
    } catch (error) {
      console.error('Failed to log payment received activity:', error);
    }

    // Log activity if invoice is now fully paid
    if (updatedInvoice.status === 'paid' && invoice.status !== 'paid') {
      try {
        await activityLogger.logInvoicePaid(updatedInvoice, req.user?.id || null);
      } catch (error) {
        console.error('Failed to log payment activity:', error);
      }

      setImmediate(() => sendInvoicePaidConfirmationToCustomer(req.tenantId, updatedInvoice));

      // Shop quote flow: when quote-sourced invoice is paid, create sale from it
      if (updatedInvoice.quoteId) {
        setImmediate(async () => {
          try {
            await createSaleFromQuoteInvoiceInternal(req.tenantId, updatedInvoice, req.user?.id || null);
          } catch (e) {
            console.error('[Invoice] createSaleFromQuoteInvoice failed:', e?.message);
          }
        });
      }

      // Send paid webhook to Sabito (async)
      try {
        const customer = await Customer.findOne({
          where: applyTenantFilter(req.tenantId, { id: updatedInvoice.customerId }),
          attributes: [
            'id', 
            'sabitoCustomerId', 
            'sabitoBusinessId', 
            'email', 
            'name', 
            'phone'
          ]
        });

        if (customer) {
          sabitoWebhookService.sendInvoicePaidWebhook(updatedInvoice, customer, req.tenantId)
            .then(async (result) => {
              if (result.success) {
                await updatedInvoice.update({
                  sabitoSyncedAt: new Date()
                });
              }
            })
            .catch((error) => {
              console.error('Failed to send Sabito paid webhook:', error);
            });
        }
      } catch (error) {
        console.error('Error sending Sabito paid webhook:', error);
      }
    }

    // Update customer balance
    try {
      await updateCustomerBalance(invoice.customerId);
    } catch (error) {
      console.error('Failed to update customer balance:', error);
    }

    invalidateAfterMutation(req.tenantId);
    invalidateInvoiceListCache(req.tenantId);
    res.status(200).json({
      success: true,
      data: updatedInvoice
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark invoice as fully paid without recording partial payment details
// @route   POST /api/invoices/:id/mark-paid
// @access  Private
exports.markInvoicePaid = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    if (invoice.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot mark a cancelled invoice as paid'
      });
    }

    if (invoice.status === 'paid') {
      const hydratedInvoice = await Invoice.findOne({
        where: applyTenantFilter(req.tenantId, { id: invoice.id }),
        include: [
          {
            model: Customer,
            as: 'customer'
          },
          {
            model: Job,
            as: 'job'
          }
        ]
      });

      return res.status(200).json({
        success: true,
        message: 'Invoice is already marked as paid',
        data: hydratedInvoice
      });
    }

    const totalAmount = parseFloat(invoice.totalAmount || 0);
    const currentPaid = parseFloat(invoice.amountPaid || 0);
    const outstanding = Math.max(totalAmount - currentPaid, 0);
    const now = new Date();
    await invoice.update({
      amountPaid: totalAmount,
      balance: 0,
      status: 'paid',
      paidDate: now
    });

    let manualPayment = null;
    if (outstanding > 0) {
      const paymentNumber = `PAY-${Date.now()}`;

      manualPayment = await Payment.create({
        paymentNumber,
        type: 'income',
        customerId: invoice.customerId,
        jobId: invoice.jobId,
        tenantId: req.tenantId,
        amount: outstanding,
        paymentMethod: 'other',
        paymentDate: now,
        status: 'completed',
        notes: `Invoice ${invoice.invoiceNumber} manually marked as paid`
      });
    }

    const updatedInvoice = await Invoice.findOne({
      where: applyTenantFilter(req.tenantId, { id: invoice.id }),
      include: [
        {
          model: Customer,
          as: 'customer'
        },
        {
          model: Job,
          as: 'job'
        }
      ]
    });

    if (outstanding > 0 && manualPayment) {
      try {
        await createInvoicePaymentJournal({
          invoice: updatedInvoice,
          amount: outstanding,
          paymentDate: now,
          paymentMethod: 'other',
          paymentRecordNumber: manualPayment.paymentNumber,
          metadata: { paymentId: manualPayment.id, markedPaid: true },
          userId: req.user?.id || null
        });
      } catch (journalError) {
        console.error('Failed to create accounting entry for invoice mark-paid', journalError);
      }
    }

    // Log activity
    try {
      await activityLogger.logInvoicePaid(updatedInvoice, req.user?.id || null);
    } catch (error) {
      console.error('Failed to log payment activity:', error);
    }

    setImmediate(() => sendInvoicePaidConfirmationToCustomer(req.tenantId, updatedInvoice));

    // Update customer balance
    try {
      await updateCustomerBalance(invoice.customerId);
    } catch (error) {
      console.error('Failed to update customer balance:', error);
    }

    invalidateAfterMutation(req.tenantId);
    invalidateInvoiceListCache(req.tenantId);
    res.status(200).json({
      success: true,
      message: 'Invoice marked as paid successfully',
      data: updatedInvoice
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send invoice to customer
// @route   POST /api/invoices/:id/send
// @access  Private
exports.sendInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Ensure payment token exists
    if (!invoice.paymentToken) {
      const crypto = require('crypto');
      await invoice.update({
        paymentToken: crypto.randomBytes(32).toString('hex')
      });
    }

    await invoice.update({
      status: 'sent',
      sentDate: new Date()
    });

    const updatedInvoice = await Invoice.findOne({
      where: applyTenantFilter(req.tenantId, { id: invoice.id }),
      include: [
        {
          model: Customer,
          as: 'customer'
        },
        {
          model: Job,
          as: 'job'
        },
        {
          model: require('../models').Sale,
          as: 'sale',
          required: false
        },
        {
          model: require('../models').Prescription,
          as: 'prescription',
          required: false
        }
      ]
    });

    // Generate payment link
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const paymentLink = `${frontendUrl}/pay-invoice/${updatedInvoice.paymentToken}`;

    const prefsSetting = await Setting.findOne({ where: { tenantId: req.tenantId, key: 'customer-notification-preferences' } });
    const autoSendInvoice = (prefsSetting?.value?.autoSendInvoiceToCustomer !== false);

    // Send WhatsApp notification if enabled, customer has phone, and auto-send is on
    if (autoSendInvoice) {
    try {
      const whatsappService = require('../services/whatsappService');
      const whatsappTemplates = require('../services/whatsappTemplates');
      const config = await whatsappService.getConfig(req.tenantId);
      
      if (config && updatedInvoice.customer && updatedInvoice.customer.phone) {
        const phoneNumber = whatsappService.validatePhoneNumber(updatedInvoice.customer.phone);
        if (phoneNumber) {
          const parameters = whatsappTemplates.prepareInvoiceNotification(
            updatedInvoice,
            updatedInvoice.customer,
            paymentLink
          );
          
          await whatsappService.sendMessage(
            req.tenantId,
            phoneNumber,
            'invoice_notification',
            parameters
          ).catch(error => {
            console.error('[Invoice] WhatsApp send failed:', error);
            // Don't fail the request if WhatsApp fails
          });
        }
      }
    } catch (error) {
      console.error('[Invoice] WhatsApp integration error:', error);
    }
    }

    // Log activity
    try {
      await activityLogger.logInvoiceSent(updatedInvoice, req.user?.id || null);
    } catch (error) {
      console.error('Failed to log invoice sent activity:', error);
    }

    // Send email notification if auto-send is on
    let emailSent = false;
    let emailError = null;
    if (autoSendInvoice) {
    try {
      const emailService = require('../services/emailService');
      const emailTemplates = require('../services/emailTemplates');
      const { Tenant } = require('../models');
      
      // Check if customer has email
      if (updatedInvoice.customer && updatedInvoice.customer.email) {
        // Get tenant/company info for email template
        const tenant = await Tenant.findByPk(req.tenantId);
        const company = {
          name: tenant?.name || 'African Business Suite',
          logo: getTenantLogoUrl(tenant),
          primaryColor: tenant?.metadata?.primaryColor || '#166534'
        };
        
        // Prepare invoice items for email
        const invoiceItems = updatedInvoice.items || [];
        const invoiceForEmail = {
          ...updatedInvoice.toJSON(),
          items: invoiceItems
        };
        
        // Generate email content
        const { subject, html, text } = emailTemplates.invoiceNotification(
          invoiceForEmail,
          updatedInvoice.customer,
          paymentLink,
          company
        );
        
        // Send the email
        const emailResult = await emailService.sendMessage(
          req.tenantId,
          updatedInvoice.customer.email,
          subject,
          html,
          text
        );
        
        if (emailResult.success) {
          emailSent = true;
          console.log('[Invoice] Email sent successfully to:', updatedInvoice.customer.email);
        } else {
          emailError = emailResult.error;
          console.log('[Invoice] Email not sent:', emailResult.error);
        }
      } else {
        emailError = 'Customer email address not available';
        console.log('[Invoice] No customer email available');
      }
    } catch (error) {
      emailError = error.message;
      console.error('[Invoice] Email sending error:', error);
    }
    }

    // Send SMS notification if enabled and customer has phone (and auto-send is on)
    let smsSent = false;
    if (autoSendInvoice) {
    try {
      const smsService = require('../services/smsService');
      const smsConfig = await smsService.getResolvedConfig(req.tenantId);
      if (smsConfig && updatedInvoice.customer && updatedInvoice.customer.phone) {
        const smsPhone = smsService.validatePhoneNumber(updatedInvoice.customer.phone);
        if (smsPhone && smsService.checkRateLimit(req.tenantId)) {
          const invNum = updatedInvoice.invoiceNumber || `#${updatedInvoice.id}`;
          const total = parseFloat(updatedInvoice.totalAmount);
          const amount = Number.isFinite(total) ? `GHS ${total.toFixed(2)}` : '';
          const smsMessage = `Invoice ${invNum}. Amount: ${amount}. Pay: ${paymentLink}`.substring(0, 160);
          const smsResult = await smsService.sendMessage(req.tenantId, smsPhone, smsMessage);
          if (smsResult.success) {
            smsSent = true;
            console.log('[Invoice] SMS sent successfully to customer');
          }
        }
      }
    } catch (error) {
      console.error('[Invoice] SMS sending error:', error);
    }
    }

    res.status(200).json({
      success: true,
      message: emailSent
        ? 'Invoice sent successfully via email and marked as sent'
        : 'Invoice marked as sent (email not sent: ' + (emailError || 'unknown error') + ')',
      data: updatedInvoice,
      paymentLink,
      emailSent,
      emailError: emailSent ? null : emailError,
      smsSent
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create invoice from job (internal use, e.g. when customer accepts quote and auto-flow is on).
 * @param {string} tenantId - Tenant ID
 * @param {string} jobId - Job ID
 * @param {string|null} userId - User ID for audit (e.g. quote creator)
 * @returns {Promise<Object|null>} - Created invoice with customer, or null if job not found or invoice exists
 */
async function createInvoiceFromJobInternal(tenantId, jobId, userId = null) {
  const job = await Job.findOne({
    where: applyTenantFilter(tenantId, { id: jobId }),
    include: [
      { model: JobItem, as: 'items' },
      { model: Customer, as: 'customer' }
    ]
  });
  if (!job) {
    console.warn('[Invoice][createInvoiceFromJobInternal] job not found', { tenantId, jobId });
    return null;
  }
  const existingInvoice = await Invoice.findOne({ where: applyTenantFilter(tenantId, { jobId }) });
  if (existingInvoice) {
    console.log('[Invoice][createInvoiceFromJobInternal] skip: invoice already exists', {
      tenantId,
      jobId,
      invoiceId: existingInvoice.id,
      invoiceNumber: existingInvoice.invoiceNumber
    });
    return null;
  }

  const invoiceNumber = await generateInvoiceNumber(tenantId);
  let subtotal = 0;
  let items = [];
  if (job.items && job.items.length > 0) {
    items = job.items.map((item) => {
      const qty = parseFloat(item.quantity || 0);
      const unitPrice = parseFloat(item.unitPrice || 0);
      const lineGross = qty * unitPrice;
      const storedTotal = parseFloat(item.totalPrice != null ? item.totalPrice : lineGross);
      const explicitDiscount = parseFloat(item.discountAmount || 0);
      const derivedDiscount = Math.max(0, lineGross - storedTotal);
      const lineDiscount = explicitDiscount > 0 ? explicitDiscount : derivedDiscount;
      return {
        description: item.description || item.category,
        category: item.category,
        paperSize: item.paperSize,
        quantity: item.quantity,
        unitPrice,
        discountAmount: lineDiscount,
        discountPercent: parseFloat(item.discountPercent || 0),
        discountReason: item.discountReason || (lineDiscount > 0 ? 'Discount from job/quote line' : null),
        total: lineGross - lineDiscount
      };
    });
    subtotal = items.reduce((sum, item) => sum + parseFloat(item.quantity) * parseFloat(item.unitPrice), 0);
  } else {
    subtotal = parseFloat(job.finalPrice || 0);
    items = [{ description: job.title, quantity: 1, unitPrice: subtotal, total: subtotal }];
  }

  const taxConfigJob = await getTaxConfigForTenant(tenantId);
  const jobTaxRate = taxConfigJob.enabled ? taxConfigJob.defaultRatePercent || 0 : 0;

  if (taxConfigJob.enabled && taxConfigJob.pricesAreTaxInclusive && jobTaxRate > 0) {
    const conv = convertLineItemsFromTaxInclusive(items, jobTaxRate);
    items = conv.items;
    subtotal = conv.subtotal;
  }

  const totalItemDiscount = (job.items && job.items.length > 0)
    ? items.reduce((sum, item) => sum + parseFloat(item.discountAmount || 0), 0)
    : 0;
  const jobLevelDiscountFallback = Math.max(
    0,
    (parseFloat(subtotal || 0) - parseFloat(job?.finalPrice || 0))
  );
  const effectiveDiscount = totalItemDiscount > 0 ? totalItemDiscount : jobLevelDiscountFallback;

  const invoicePayload = {
    invoiceNumber,
    jobId,
    customerId: job.customerId,
    tenantId,
    sourceType: 'job',
    invoiceDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    subtotal,
    taxRate: jobTaxRate,
    discountType: 'fixed',
    discountValue: effectiveDiscount,
    discountAmount: effectiveDiscount,
    discountReason: effectiveDiscount > 0
      ? (items.find((i) => i.discountReason)?.discountReason || 'Line discounts from job')
      : undefined,
    paymentTerms: 'Net 30',
    items,
    notes: null,
    termsAndConditions: 'Payment is due within the specified payment terms. Late payments may incur additional charges.'
  };

  if (totalItemDiscount <= 0) {
    invoicePayload.totalAmount = subtotal;
  }

  const invoice = await Invoice.create(invoicePayload);

  console.log('[Invoice][createInvoiceFromJobInternal] created', {
    tenantId,
    jobId,
    invoiceNumber: invoice.invoiceNumber,
    lineCount: items.length,
    subtotal,
    lineDiscountTotal: totalItemDiscount,
    effectiveDiscount
  });

  try {
    await updateCustomerBalance(invoice.customerId);
  } catch (e) {
    console.error('Failed to update customer balance:', e);
  }
  try {
    await createInvoiceRevenueJournal(invoice, userId);
  } catch (e) {
    console.error('Failed to create revenue journal:', e);
  }

  const createdInvoice = await Invoice.findOne({
    where: applyTenantFilter(tenantId, { id: invoice.id }),
    include: [{ model: Customer, as: 'customer' }, { model: Job, as: 'job' }]
  });
  return createdInvoice;
}

/**
 * Create invoice from quote (shop flow: accept quote → invoice). Items taken from quote items; productId stored in item for later sale.
 * @param {string} tenantId
 * @param {string} quoteId
 * @param {string|null} userId
 * @returns {Promise<Object|null>}
 */
async function createInvoiceFromQuoteInternal(tenantId, quoteId, userId = null) {
  const quote = await Quote.findOne({
    where: applyTenantFilter(tenantId, { id: quoteId }),
    include: [
      { model: QuoteItem, as: 'items' },
      { model: Customer, as: 'customer' }
    ]
  });
  if (!quote) return null;
  const existingInvoice = await Invoice.findOne({ where: applyTenantFilter(tenantId, { quoteId }) });
  if (existingInvoice) return null;

  const invoiceNumber = await generateInvoiceNumber(tenantId);
  const items = [];
  let headerSubtotal = parseFloat(quote.subtotal || 0);
  if (quote.items && quote.items.length > 0) {
    for (const qi of quote.items) {
      const qty = parseFloat(qi.quantity || 0);
      const unitPrice = parseFloat(qi.unitPrice || 0);
      const discount = parseFloat(qi.discountAmount || 0);
      const lineTotal = qty * unitPrice - discount;
      items.push({
        description: qi.description || '',
        quantity: qi.quantity,
        unitPrice: qi.unitPrice,
        total: lineTotal,
        productId: qi.productId || undefined
      });
    }
  } else {
    headerSubtotal = parseFloat(quote.totalAmount || 0);
    items.push({
      description: quote.title,
      quantity: 1,
      unitPrice: headerSubtotal,
      total: headerSubtotal
    });
  }

  const discountTotal = parseFloat(quote.discountTotal || 0);
  const taxRate = parseFloat(quote.taxRate || 0);
  const taxCfgQuote = await getTaxConfigForTenant(tenantId);
  if (taxCfgQuote.enabled && taxCfgQuote.pricesAreTaxInclusive && taxRate > 0 && items.length > 0) {
    const conv = convertLineItemsFromTaxInclusive(items, taxRate);
    items.length = 0;
    conv.items.forEach((row) => items.push(row));
    headerSubtotal = Math.round((conv.subtotal + discountTotal) * 100) / 100;
  }

  const invoice = await Invoice.create({
    invoiceNumber,
    quoteId,
    customerId: quote.customerId,
    tenantId,
    sourceType: 'quote',
    invoiceDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    subtotal: headerSubtotal,
    taxRate,
    discountType: 'fixed',
    discountValue: discountTotal,
    discountAmount: discountTotal,
    amountPaid: 0,
    paymentTerms: 'Net 30',
    items,
    notes: quote.notes || null,
    termsAndConditions: 'Payment is due within the specified payment terms.'
  });

  try {
    await updateCustomerBalance(invoice.customerId);
  } catch (e) {
    console.error('Failed to update customer balance:', e);
  }
  try {
    await createInvoiceRevenueJournal(invoice, userId);
  } catch (e) {
    console.error('Failed to create revenue journal:', e);
  }

  return Invoice.findOne({
    where: applyTenantFilter(tenantId, { id: invoice.id }),
    include: [{ model: Customer, as: 'customer' }]
  });
}

/**
 * When a quote-sourced invoice is paid, create a sale from it (shop flow: invoice paid → sale).
 * @param {string} tenantId
 * @param {Object} invoice - Invoice with items (JSON array; items may have productId)
 * @param {string|null} userId
 * @returns {Promise<Object|null>} Created sale or null
 */
async function createSaleFromQuoteInvoiceInternal(tenantId, invoice, userId = null) {
  if (!invoice.quoteId || !invoice.items || !Array.isArray(invoice.items)) return null;
  const itemsWithProduct = invoice.items.filter((i) => i.productId);
  if (itemsWithProduct.length === 0) return null;

  const { Op } = require('sequelize');
  const prefix = 'SALE';
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const count = await Sale.count({
    where: {
      tenantId,
      createdAt: { [Op.between]: [startOfDay, endOfDay] }
    }
  });
  const saleNumber = `${prefix}-${dateStr}-${String(count + 1).padStart(4, '0')}`;

  const subtotal = itemsWithProduct.reduce((s, i) => s + (parseFloat(i.quantity || 0) * parseFloat(i.unitPrice || 0)), 0);
  const sale = await Sale.create({
    tenantId,
    saleNumber,
    customerId: invoice.customerId,
    subtotal,
    discount: 0,
    tax: 0,
    total: subtotal,
    paymentMethod: 'invoice',
    amountPaid: parseFloat(invoice.totalAmount || 0),
    change: 0,
    status: 'completed',
    soldBy: userId,
    notes: `Sale from paid invoice ${invoice.invoiceNumber} (quote)`,
    metadata: { quoteId: invoice.quoteId, invoiceId: invoice.id }
  });

  for (const it of itemsWithProduct) {
    const qty = parseFloat(it.quantity || 0);
    const unitPrice = parseFloat(it.unitPrice || 0);
    const itemSubtotal = qty * unitPrice;
    await SaleItem.create({
      saleId: sale.id,
      productId: it.productId,
      name: it.description || 'Product',
      quantity: qty,
      unitPrice,
      discount: 0,
      tax: 0,
      subtotal: itemSubtotal,
      total: itemSubtotal
    });
  }

  await invoice.update({ saleId: sale.id });
  return sale;
}

/**
 * Send invoice to customer via configured channels (internal use). Marks invoice as sent and sends email/WhatsApp/SMS.
 * @param {string} tenantId - Tenant ID
 * @param {Object} invoice - Invoice with customer loaded
 * @param {{ forceCustomerChannels?: boolean }} [options] - If forceCustomerChannels, notify customer even when global auto-send invoice pref is off (e.g. job-creation auto-send).
 */
async function sendInvoiceToCustomer(tenantId, invoice, options = {}) {
  const { forceCustomerChannels = false } = options || {};
  if (!invoice.paymentToken) {
    const crypto = require('crypto');
    await invoice.update({ paymentToken: crypto.randomBytes(32).toString('hex') });
  }
  await invoice.reload();
  await invoice.update({ status: 'sent', sentDate: new Date() });
  const updatedInvoice = await Invoice.findOne({
    where: applyTenantFilter(tenantId, { id: invoice.id }),
    include: [{ model: Customer, as: 'customer' }, { model: Job, as: 'job' }]
  });
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const paymentLink = `${frontendUrl}/pay-invoice/${updatedInvoice.paymentToken}`;
  const prefsSetting = await Setting.findOne({ where: { tenantId, key: 'customer-notification-preferences' } });
  const prefAllows = prefsSetting?.value?.autoSendInvoiceToCustomer !== false;
  const autoSend = forceCustomerChannels || prefAllows;

  if (autoSend && updatedInvoice.customer) {
    try {
      const whatsappService = require('../services/whatsappService');
      const whatsappTemplates = require('../services/whatsappTemplates');
      const config = await whatsappService.getConfig(tenantId);
      if (config && updatedInvoice.customer.phone) {
        const phoneNumber = whatsappService.validatePhoneNumber(updatedInvoice.customer.phone);
        if (phoneNumber) {
          const parameters = whatsappTemplates.prepareInvoiceNotification(updatedInvoice, updatedInvoice.customer, paymentLink);
          await whatsappService.sendMessage(tenantId, phoneNumber, 'invoice_notification', parameters).catch(() => {});
        }
      }
    } catch (e) {
      console.error('[Invoice] sendInvoiceToCustomer WhatsApp:', e?.message);
    }
    try {
      const emailService = require('../services/emailService');
      const emailTemplates = require('../services/emailTemplates');
      const tenant = await Tenant.findByPk(tenantId);
      const company = { name: tenant?.name || 'African Business Suite', logo: getTenantLogoUrl(tenant), primaryColor: tenant?.metadata?.primaryColor || '#166534' };
      if (updatedInvoice.customer.email) {
        const invoiceForEmail = { ...updatedInvoice.toJSON(), items: updatedInvoice.items || [] };
        const { subject, html, text } = emailTemplates.invoiceNotification(invoiceForEmail, updatedInvoice.customer, paymentLink, company);
        await emailService.sendMessage(tenantId, updatedInvoice.customer.email, subject, html, text);
      }
    } catch (e) {
      console.error('[Invoice] sendInvoiceToCustomer email:', e?.message);
    }
    try {
      const smsService = require('../services/smsService');
      const smsConfig = await smsService.getResolvedConfig(tenantId);
      if (smsConfig && updatedInvoice.customer.phone && smsService.checkRateLimit(tenantId)) {
        const smsPhone = smsService.validatePhoneNumber(updatedInvoice.customer.phone);
        if (smsPhone) {
          const invNum = updatedInvoice.invoiceNumber || `#${updatedInvoice.id}`;
          const total = parseFloat(updatedInvoice.totalAmount);
          const amount = Number.isFinite(total) ? `GHS ${total.toFixed(2)}` : '';
          const smsMessage = `Invoice ${invNum}. Amount: ${amount}. Pay: ${paymentLink}`.substring(0, 160);
          await smsService.sendMessage(tenantId, smsPhone, smsMessage);
        }
      }
    } catch (e) {
      console.error('[Invoice] sendInvoiceToCustomer SMS:', e?.message);
    }
  }
}

exports.createInvoiceFromJobInternal = createInvoiceFromJobInternal;
exports.createInvoiceFromQuoteInternal = createInvoiceFromQuoteInternal;
exports.sendInvoiceToCustomer = sendInvoiceToCustomer;

// @desc    Get invoice by payment token (public)
// @route   GET /api/public/invoices/:token
// @access  Public
exports.getInvoiceByToken = async (req, res, next) => {
  try {
    const { token } = req.params;

    const invoice = await Invoice.findOne({
      where: { paymentToken: token },
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'company', 'email', 'phone']
        },
        {
          model: Job,
          as: 'job',
          attributes: ['id', 'jobNumber', 'title'],
          required: false
        },
        {
          model: require('../models').Sale,
          as: 'sale',
          attributes: ['id', 'saleNumber', 'createdAt'],
          required: false
        },
        {
          model: require('../models').Prescription,
          as: 'prescription',
          attributes: ['id', 'prescriptionNumber', 'prescriptionDate'],
          include: [{
            model: require('../models').Customer,
            as: 'customer',
            attributes: ['id', 'name'],
            required: false
          }],
          required: false
        },
        {
          model: require('../models').Tenant,
          as: 'tenant',
          attributes: ['id', 'name', 'slug']
        }
      ]
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found or invalid payment link'
      });
    }

    if (invoice.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This invoice has been cancelled'
      });
    }

    // Prevent caching so payment link always shows current status (e.g. after paid)
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    const paystackService = require('../services/paystackService');
    const tenantForPay = await Tenant.findByPk(invoice.tenantId);
    const mtnCollectionOk = Boolean(tenantForPay && getResolvedMtnConfigForTenant(tenantForPay));
    const airtelDirectOk = Boolean(
      process.env.AIRTEL_MONEY_CLIENT_ID && process.env.AIRTEL_MONEY_CLIENT_SECRET
    );

    // Organization for public invoice display (name, contact, logo – no sensitive data)
    let organization = null;
    try {
      const orgSetting = await Setting.findOne({ where: { tenantId: invoice.tenantId, key: 'organization' } });
      if (orgSetting?.value && typeof orgSetting.value === 'object') {
        const v = orgSetting.value;
        organization = {
          name: v.name ?? invoice.tenant?.name,
          phone: v.phone ?? '',
          email: v.email ?? '',
          website: v.website ?? '',
          address: v.address ?? {},
          logoUrl: v.logoUrl ?? '',
          invoiceFooter: v.invoiceFooter ?? '',
          termsAndConditions: v.defaultTermsAndConditions ?? '',
          paymentDetails: v.paymentDetails ?? '',
          tax: v.tax ? { vatNumber: v.tax.vatNumber, tin: v.tax.tin } : {}
        };
      }
    } catch (e) {
      // non-fatal
    }

    // Return invoice data (without sensitive tenant info)
    res.status(200).json({
      success: true,
      data: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        subtotal: invoice.subtotal,
        taxRate: invoice.taxRate,
        taxAmount: invoice.taxAmount,
        discountAmount: invoice.discountAmount,
        totalAmount: invoice.totalAmount,
        amountPaid: invoice.amountPaid,
        balance: invoice.balance,
        status: invoice.status,
        paymentTerms: invoice.paymentTerms,
        items: invoice.items,
        notes: invoice.notes,
        termsAndConditions: invoice.termsAndConditions,
        customer: invoice.customer,
        job: invoice.job || null,
        tenant: {
          name: invoice.tenant?.name
        },
        organization: organization || { name: invoice.tenant?.name },
        source: invoice.sourceType,
        sourceDetails: invoice.job || invoice.sale || invoice.prescription || null,
        paymentOptions: {
          paystack: Boolean(paystackService.secretKey),
          directMtnMoMo: mtnCollectionOk,
          directAirtelMoMo: airtelDirectOk,
          directMoMo: mtnCollectionOk || airtelDirectOk
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @param {import('express').Response} res
 * @param {string} invoiceId
 * @param {import('axios').AxiosError} paystackErr
 */
function sendPaystackInitializeFailure(res, invoiceId, paystackErr) {
  const paystackService = require('../services/paystackService');
  const status = paystackErr?.response?.status;
  const fromProvider = paystackService.userFacingPaystackErrorMessage(paystackErr);
  const errMessage = paystackErr?.message || '';
  console.error('[Invoice] initialize-paystack Paystack error:', {
    invoiceId,
    status,
    fromProvider: fromProvider ? `${String(fromProvider).slice(0, 120)}…` : null,
    errMessage: errMessage.slice(0, 200)
  });
  const userMessage =
    fromProvider ||
    (status === 400
      ? 'Invalid payment details. Please check the amount and email and try again.'
      : status === 401
        ? 'Payment provider authentication failed. Please contact the business.'
        : status === 403
          ? 'Payment request was rejected. Please try again or use another method.'
          : status >= 500
            ? 'Payment provider is temporarily unavailable. Please try again later.'
            : 'Could not start payment. Please try again or contact the business.');
  return res.status(502).json({
    success: false,
    message: userMessage
  });
}

/**
 * Normalize MoMo subscriber number to 233XXXXXXXXX (digits only, no +).
 * @param {string} phone
 * @returns {string}
 */
function normalizePublicMoMoPhone(phone) {
  const raw = String(phone || '').replace(/\s/g, '');
  if (!raw) return '';
  if (raw.startsWith('+233')) return raw.slice(1);
  if (raw.startsWith('233')) return raw;
  if (raw.startsWith('0')) return `233${raw.slice(1)}`;
  if (/^\d{9}$/.test(raw)) return `233${raw}`;
  return raw.replace(/^\+/, '');
}

/**
 * Persist public-link invoice payment (manual /pay and direct MoMo poll success).
 * @param {object} invoice - Invoice instance with customer
 * @param {object} opts
 */
async function recordPublicInvoicePaymentCore(invoice, {
  paymentAmount,
  paymentMethod = 'online',
  referenceNumber,
  paymentDate,
  customerEmail,
  customerName
}) {
  const totalAmount = parseFloat(invoice.totalAmount || 0);
  const newAmountPaid = parseFloat(invoice.amountPaid || 0) + paymentAmount;
  const newBalance = Math.max(totalAmount - newAmountPaid, 0);

  const effectivePaymentDate = paymentDate ? new Date(paymentDate) : new Date();
  const updatePayload = {
    amountPaid: newAmountPaid,
    balance: newBalance
  };

  if (newBalance <= 0) {
    updatePayload.status = 'paid';
    updatePayload.paidDate = effectivePaymentDate;
  } else if (invoice.status === 'draft') {
    updatePayload.status = 'sent';
  } else if (invoice.status === 'sent' && newAmountPaid > 0) {
    updatePayload.status = 'partial';
  }

  await invoice.update(updatePayload);

  const paymentNumber = `PAY-${Date.now()}`;
  const paymentData = {
    paymentNumber,
    type: 'income',
    customerId: invoice.customerId,
    tenantId: invoice.tenantId,
    amount: paymentAmount,
    paymentMethod: paymentMethod || 'online',
    paymentDate: effectivePaymentDate,
    referenceNumber: referenceNumber || `PUBLIC-${paymentNumber}`,
    status: 'completed',
    notes: `Payment via public link for invoice ${invoice.invoiceNumber}`
  };

  if (invoice.jobId) paymentData.jobId = invoice.jobId;
  if (invoice.saleId) paymentData.saleId = invoice.saleId;
  if (invoice.prescriptionId) paymentData.prescriptionId = invoice.prescriptionId;

  if (invoice.saleId && newAmountPaid >= parseFloat(invoice.totalAmount)) {
    try {
      const sale = await Sale.findByPk(invoice.saleId);
      if (sale && sale.status === 'pending') {
        await sale.update({ status: 'completed' });

        await SaleActivity.create({
          saleId: sale.id,
          tenantId: invoice.tenantId,
          type: 'payment',
          subject: 'Payment Received',
          notes: `Full payment received for invoice ${invoice.invoiceNumber}`,
          createdBy: null,
          metadata: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            paymentAmount: paymentAmount,
            publicPayment: true
          }
        });
      }
    } catch (saleError) {
      console.error('Error updating sale status from public payment:', saleError);
    }
  }

  try {
    paymentData.metadata = {
      publicPayment: true,
      customerEmail: customerEmail || invoice.customer?.email,
      customerName: customerName || invoice.customer?.name
    };
  } catch (e) {
    // Metadata field might not exist, skip it
  }

  const payment = await Payment.create(paymentData);

  const updatedInvoice = await Invoice.findOne({
    where: { id: invoice.id },
    include: [
      {
        model: Customer,
        as: 'customer'
      }
    ]
  });

  try {
    await activityLogger.logPaymentReceived(updatedInvoice, paymentAmount, null);
  } catch (error) {
    console.error('Failed to log payment received activity:', error);
  }
  if (updatedInvoice.status === 'paid') {
    try {
      await activityLogger.logInvoicePaid(updatedInvoice, null);
    } catch (error) {
      console.error('Failed to log payment activity:', error);
    }
    setImmediate(() => sendInvoicePaidConfirmationToCustomer(invoice.tenantId, updatedInvoice));
    if (updatedInvoice.quoteId) {
      setImmediate(async () => {
        try {
          await createSaleFromQuoteInvoiceInternal(invoice.tenantId, updatedInvoice, null);
        } catch (e) {
          console.error('[Invoice] createSaleFromQuoteInvoice (public) failed:', e?.message);
        }
      });
    }
  }

  try {
    await updateCustomerBalance(invoice.customerId);
  } catch (error) {
    console.error('Failed to update customer balance:', error);
  }

  invalidateAfterMutation(invoice.tenantId);
  invalidateInvoiceListCache(invoice.tenantId);

  return { updatedInvoice, payment };
}

// @desc    Process payment via public link
// @route   POST /api/public/invoices/:token/pay
// @access  Public
exports.processPublicPayment = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { amount, paymentMethod, referenceNumber, paymentDate, customerEmail, customerName } = sanitizePayload(req.body);

    const invoice = await Invoice.findOne({
      where: { paymentToken: token },
      include: [
        {
          model: Customer,
          as: 'customer'
        }
      ]
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found or invalid payment link'
      });
    }

    if (invoice.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This invoice has been cancelled'
      });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'This invoice has already been paid'
      });
    }

    const paymentAmount = parseFloat(amount || invoice.balance);
    const totalAmount = parseFloat(invoice.totalAmount || 0);
    const newAmountPaid = parseFloat(invoice.amountPaid || 0) + paymentAmount;
    const newBalance = Math.max(totalAmount - newAmountPaid, 0);

    if (paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be greater than zero'
      });
    }

    if (newAmountPaid > totalAmount) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount exceeds invoice total'
      });
    }

    const { updatedInvoice, payment } = await recordPublicInvoicePaymentCore(invoice, {
      paymentAmount,
      paymentMethod,
      referenceNumber,
      paymentDate,
      customerEmail,
      customerName
    });

    res.status(200).json({
      success: true,
      message: 'Payment processed successfully',
      data: {
        invoice: updatedInvoice,
        payment: {
          id: payment.id,
          paymentNumber: payment.paymentNumber,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          paymentDate: payment.paymentDate
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Initialize Paystack payment for public invoice link
// @route   POST /api/public/invoices/:token/initialize-paystack
// @access  Public
exports.initializePaystackForInvoice = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { email, mobileNumber } = sanitizePayload(req.body);

    const invoice = await Invoice.findOne({
      where: { paymentToken: token },
      include: [{ model: Customer, as: 'customer' }]
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found or invalid payment link'
      });
    }
    if (invoice.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This invoice has been cancelled'
      });
    }
    if (invoice.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'This invoice has already been paid'
      });
    }

    const balance = parseFloat(invoice.balance ?? invoice.totalAmount ?? 0);
    if (balance <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No balance due on this invoice'
      });
    }

    const customerEmail = email || invoice.customer?.email;
    if (!customerEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is required to pay with Paystack. Please enter your email.'
      });
    }

    const paystackService = require('../services/paystackService');
    if (!paystackService.secretKey) {
      return res.status(503).json({
        success: false,
        message: 'Online payment is not configured'
      });
    }

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const callbackUrl = `${frontendUrl}/pay-invoice/${token}?paystack=1`;
    const orgRow = await Setting.findOne({ where: { tenantId: invoice.tenantId, key: 'organization' } });
    const orgTax = orgRow?.value?.tax || {};
    const oc = orgTax?.otherCharges || {};
    const shouldApplyCustomerCharge =
      oc?.enabled === true &&
      oc?.customerBears === true &&
      ['online_payments', 'all_payments'].includes(String(oc?.appliesTo || ''));
    const chargeRate = shouldApplyCustomerCharge ? Math.max(0, Math.min(100, parseFloat(oc?.ratePercent) || 0)) : 0;
    const chargeAmount = Math.round((balance * chargeRate / 100) * 100) / 100;
    const payableAmount = shouldApplyCustomerCharge ? balance + chargeAmount : balance;
    const amountPesewas = Math.round(payableAmount * 100);

    const tenant = await Tenant.findByPk(invoice.tenantId);
    const subaccount = tenant?.paystackSubaccountCode || null;

    const makeReference = () => `INV-${invoice.id}-${Date.now()}`.slice(0, 50);
    const metadata = {
      type: 'invoice',
      paymentToken: token,
      invoiceId: invoice.id,
      tenantId: invoice.tenantId,
      paymentSurcharge: shouldApplyCustomerCharge
        ? {
            label: typeof oc?.label === 'string' && oc.label.trim() ? oc.label.trim() : 'Transaction charge',
            ratePercent: chargeRate,
            amount: chargeAmount,
            customerBears: true
          }
        : undefined,
      ...(mobileNumber ? { mobileNumber: String(mobileNumber).trim() } : {})
    };

    const buildInit = (ref, channels) =>
      paystackService.initializeTransaction({
        email: customerEmail,
        amount: amountPesewas,
        currency: 'GHS',
        callback_url: callbackUrl,
        reference: ref,
        metadata,
        channels,
        ...(subaccount ? { subaccount } : {})
      });

    let result;
    let ref = makeReference();
    try {
      // Prefer card + Paystack MoMo when the business has it enabled; many accounts return 403 if mobile_money is not allowed
      result = await buildInit(ref, ['card', 'mobile_money']);
    } catch (paystackErr) {
      const st = paystackErr?.response?.status;
      // 403 often means this integration cannot use requested channels (e.g. mobile_money not enabled). Do not retry on 400 — likely bad payload.
      const retryable = st === 403;
      if (retryable) {
        ref = makeReference();
        console.warn('[Invoice] initialize-paystack: Paystack 403 — retrying with card-only channels', {
          invoiceId: invoice.id
        });
        try {
          result = await buildInit(ref, ['card']);
        } catch (retryErr) {
          return sendPaystackInitializeFailure(res, invoice.id, retryErr);
        }
      } else {
        return sendPaystackInitializeFailure(res, invoice.id, paystackErr);
      }
    }

    if (!result.status || !result.data?.authorization_url) {
      return res.status(502).json({
        success: false,
        message: result.message || 'Failed to initialize payment'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        authorization_url: result.data.authorization_url,
        reference: result.data.reference,
        access_code: result.data.access_code
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Paystack transaction after customer returns (webhook fallback)
// @route   POST /api/public/invoices/:token/verify-paystack
// @access  Public
exports.verifyPaystackReturnForPublicInvoice = async (req, res, next) => {
  try {
    const { token } = req.params;
    const bodyRef = sanitizePayload(req.body || {});
    const reference = String(
      bodyRef.reference || req.query?.reference || req.query?.trxref || ''
    ).trim();

    if (!reference) {
      return res.status(400).json({
        success: false,
        message:
          'Missing Paystack reference. After payment, the URL usually includes reference= or trxref=. Refresh the page or try again.'
      });
    }

    const invoiceRow = await Invoice.findOne({ where: { paymentToken: token } });
    if (!invoiceRow) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found or invalid payment link'
      });
    }

    const paystackService = require('../services/paystackService');
    if (!paystackService.secretKey) {
      return res.status(503).json({ success: false, message: 'Online payment is not configured' });
    }

    let result;
    try {
      result = await paystackService.verifyTransaction(reference);
    } catch (err) {
      console.error('[Invoice] verify-paystack Paystack error:', err?.message);
      return res.status(502).json({
        success: false,
        message: 'Could not reach Paystack to verify this payment. Try again shortly.'
      });
    }

    if (!result.status || !result.data) {
      return res.status(400).json({
        success: false,
        message: result.message || 'Paystack could not verify this reference.'
      });
    }

    const tx = result.data;
    const txStatus = String(tx.status || '').toLowerCase();
    if (txStatus !== 'success') {
      return res.status(200).json({
        success: true,
        data: {
          applied: false,
          paystackStatus: tx.status,
          gatewayResponse: tx.gateway_response || null,
          message:
            txStatus === 'pending'
              ? 'Payment may still be processing. Wait a moment and refresh again.'
              : 'This transaction is not completed on Paystack yet.'
        }
      });
    }

    const {
      getPaystackInvoiceLinkMetadata,
      parseInvoiceIdFromPublicPaystackReference,
      applyPaystackChargeToInvoiceFromTx
    } = require('../services/paystackPublicInvoicePayment');

    const metadata =
      typeof tx.metadata === 'string' ? JSON.parse(tx.metadata || '{}') : (tx.metadata || {});
    const invLink = getPaystackInvoiceLinkMetadata(metadata);
    const refInvoiceId = parseInvoiceIdFromPublicPaystackReference(reference);

    const tokenMatch = invLink.paymentToken && String(invLink.paymentToken) === String(token);
    const idMatch =
      invLink.invoiceId &&
      String(invLink.invoiceId) === String(invoiceRow.id) &&
      invLink.tenantId &&
      String(invLink.tenantId) === String(invoiceRow.tenantId);
    const refMatch = refInvoiceId && String(refInvoiceId) === String(invoiceRow.id);

    if (!tokenMatch && !idMatch && !refMatch) {
      console.warn('[Invoice] verify-paystack: reference does not match this invoice link', {
        invoiceId: invoiceRow.id
      });
      return res.status(403).json({
        success: false,
        message: 'This Paystack receipt does not match this invoice page.'
      });
    }

    const outcome = await applyPaystackChargeToInvoiceFromTx(reference, tx);

    if (outcome.duplicate || outcome.reason === 'invoice_terminal_state') {
      return res.status(200).json({
        success: true,
        data: {
          applied: false,
          alreadyRecorded: true,
          paystackStatus: 'success',
          message: 'Payment was already recorded for this invoice.'
        }
      });
    }

    if (!outcome.applied) {
      return res.status(200).json({
        success: true,
        data: {
          applied: false,
          paystackStatus: 'success',
          reason: outcome.reason,
          message: 'Could not apply this payment to the invoice.'
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        applied: true,
        paystackStatus: 'success',
        reference
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Initiate direct mobile money collection for public invoice (tenant MoMo APIs)
// @route   POST /api/public/invoices/:token/mobile-money/initiate
// @access  Public
exports.initiateMobileMoneyForPublicInvoice = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { phoneNumber, provider } = sanitizePayload(req.body || {});

    const invoice = await Invoice.findOne({
      where: { paymentToken: token },
      include: [{ model: Customer, as: 'customer' }]
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found or invalid payment link' });
    }
    if (invoice.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'This invoice has been cancelled' });
    }
    if (invoice.status === 'paid') {
      return res.status(400).json({ success: false, message: 'This invoice has already been paid' });
    }

    const normalized = normalizePublicMoMoPhone(phoneNumber);
    if (!normalized || normalized.length < 12) {
      return res.status(400).json({ success: false, message: 'Enter a valid mobile money number (e.g. 0XX XXX XXXX).' });
    }

    const balance = parseFloat(invoice.balance ?? invoice.totalAmount ?? 0);
    if (balance <= 0) {
      return res.status(400).json({ success: false, message: 'No balance due on this invoice' });
    }

    const detectedProvider = (provider && String(provider).trim()) || mobileMoneyService.detectProvider(normalized);
    if (detectedProvider === 'UNKNOWN') {
      return res.status(400).json({
        success: false,
        message: 'Could not detect network. Choose MTN or AirtelTigo and check the number.'
      });
    }

    const tenant = await Tenant.findByPk(invoice.tenantId);
    let mtnConfig;
    if (detectedProvider === 'MTN') {
      mtnConfig = tenant ? getResolvedMtnConfigForTenant(tenant) : null;
      if (!mtnConfig) {
        return res.status(503).json({
          success: false,
          message: 'This business has not configured MTN MoMo Collection yet.'
        });
      }
    }

    const externalId = `INV-PUB-${invoice.id}-${Date.now()}`;
    const result = await mobileMoneyService.requestPayment({
      phoneNumber: normalized,
      amount: balance,
      currency: 'GHS',
      externalId,
      provider: detectedProvider,
      payerMessage: `Invoice ${invoice.invoiceNumber || invoice.id}`,
      mtnConfig
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || 'Failed to start mobile money payment'
      });
    }

    await Invoice.update(
      {
        metadata: sequelize.fn(
          'jsonb_set',
          sequelize.fn('COALESCE', sequelize.col('metadata'), '{}'),
          '{mobileMoneyRef}',
          JSON.stringify({
            referenceId: result.referenceId,
            provider: result.provider,
            status: 'PENDING',
            initiatedAt: new Date().toISOString(),
            publicToken: token,
            amountDue: balance
          })
        )
      },
      { where: { id: invoice.id } }
    );

    res.status(200).json({
      success: true,
      data: {
        referenceId: result.referenceId,
        provider: result.provider,
        status: result.status,
        message: result.message,
        invoiceId: invoice.id
      }
    });
  } catch (error) {
    console.error('[Invoice] public MoMo initiate error:', error);
    next(error);
  }
};

// @desc    Poll direct mobile money status for public invoice; completes invoice when successful
// @route   POST /api/public/invoices/:token/mobile-money/poll
// @access  Public
exports.pollMobileMoneyForPublicInvoice = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { token } = req.params;

    const invoice = await Invoice.findOne({
      where: { paymentToken: token },
      include: [{ model: Customer, as: 'customer' }],
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!invoice) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Invoice not found or invalid payment link' });
    }

    if (invoice.status === 'paid') {
      await transaction.commit();
      return res.status(200).json({
        success: true,
        data: { paymentStatus: 'SUCCESSFUL', invoiceStatus: 'paid', alreadyPaid: true }
      });
    }

    const mobileMoneyRef = invoice.metadata?.mobileMoneyRef;
    if (!mobileMoneyRef?.referenceId || !mobileMoneyRef?.provider) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'No mobile money payment in progress for this invoice'
      });
    }

    const tenantForPoll = await Tenant.findByPk(invoice.tenantId);
    let mtnConfigPoll;
    if (mobileMoneyRef.provider === 'MTN') {
      mtnConfigPoll = tenantForPoll ? getResolvedMtnConfigForTenant(tenantForPoll) : null;
      if (!mtnConfigPoll) {
        await transaction.rollback();
        return res.status(503).json({
          success: false,
          message: 'MTN MoMo is not configured for this business.'
        });
      }
    }

    const statusResult = await mobileMoneyService.checkPaymentStatus(
      mobileMoneyRef.referenceId,
      mobileMoneyRef.provider,
      mtnConfigPoll
    );

    const updatedMeta = {
      ...invoice.metadata,
      mobileMoneyRef: {
        ...mobileMoneyRef,
        status: statusResult.status,
        lastChecked: new Date().toISOString(),
        financialTransactionId: statusResult.financialTransactionId
      }
    };

    if (statusResult.status !== 'SUCCESSFUL') {
      await invoice.update({ metadata: updatedMeta }, { transaction });
      await transaction.commit();
      return res.status(200).json({
        success: true,
        data: {
          paymentStatus: statusResult.status,
          invoiceStatus: invoice.status,
          provider: mobileMoneyRef.provider,
          referenceId: mobileMoneyRef.referenceId
        }
      });
    }

    await invoice.update({ metadata: updatedMeta }, { transaction });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('[Invoice] public MoMo poll error:', error);
    return next(error);
  }

  try {
    const { token } = req.params;
    const invoiceRow = await Invoice.findOne({
      where: { paymentToken: token },
      include: [{ model: Customer, as: 'customer' }]
    });
    if (!invoiceRow) {
      return res.status(404).json({ success: false, message: 'Invoice not found or invalid payment link' });
    }

    const mobileMoneyRef = invoiceRow.metadata?.mobileMoneyRef;
    if (!mobileMoneyRef?.referenceId) {
      return res.status(400).json({
        success: false,
        message: 'No mobile money payment in progress for this invoice'
      });
    }

    if (invoiceRow.status === 'paid') {
      return res.status(200).json({
        success: true,
        data: { paymentStatus: 'SUCCESSFUL', invoiceStatus: 'paid' }
      });
    }

    const paymentAmount = parseFloat(invoiceRow.balance ?? invoiceRow.totalAmount ?? 0);
    if (paymentAmount <= 0) {
      return res.status(200).json({
        success: true,
        data: { paymentStatus: 'SUCCESSFUL', invoiceStatus: invoiceRow.status }
      });
    }

    const { updatedInvoice, payment } = await recordPublicInvoicePaymentCore(invoiceRow, {
      paymentAmount,
      paymentMethod: 'mobile_money',
      referenceNumber: mobileMoneyRef.referenceId,
      customerEmail: invoiceRow.customer?.email,
      customerName: invoiceRow.customer?.name
    });

    return res.status(200).json({
      success: true,
      data: {
        paymentStatus: 'SUCCESSFUL',
        invoiceStatus: updatedInvoice.status,
        invoice: updatedInvoice,
        payment: {
          id: payment.id,
          paymentNumber: payment.paymentNumber,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod
        }
      }
    });
  } catch (error) {
    console.error('[Invoice] public MoMo finalize error:', error);
    return next(error);
  }
};

// @desc    Cancel invoice
// @route   POST /api/invoices/:id/cancel
// @access  Private
exports.cancelInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel paid invoice'
      });
    }

    await invoice.update({
      status: 'cancelled'
    });

    const updatedInvoice = await Invoice.findOne({
      where: applyTenantFilter(req.tenantId, { id: invoice.id }),
      include: [
        {
          model: Customer,
          as: 'customer'
        },
        {
          model: Job,
          as: 'job'
        }
      ]
    });

    invalidateAfterMutation(req.tenantId);
    invalidateInvoiceListCache(req.tenantId);
    res.status(200).json({
      success: true,
      data: updatedInvoice
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get invoice statistics
// @route   GET /api/invoices/stats/summary
// @access  Private
exports.getInvoiceStats = async (req, res, next) => {
  try {
    const baseWhere = await buildInvoiceVisibilityWhere(req);

    const totalInvoices = await Invoice.count({ where: baseWhere });
    const paidInvoices = await Invoice.count({ where: { ...baseWhere, status: 'paid' } });
    const unpaidInvoices = await Invoice.count({
      where: { ...baseWhere, status: { [Op.in]: ['sent', 'draft'] } }
    });
    const overdueInvoices = await Invoice.count({
      where: { ...baseWhere, status: 'overdue' }
    });
    
    const totalRevenue =
      (await Invoice.sum('totalAmount', { where: { ...baseWhere, status: 'paid' } })) || 0;
    const outstandingAmount =
      (await Invoice.sum('balance', {
        where: {
          ...baseWhere,
          status: { [Op.notIn]: ['paid', 'cancelled'] },
          balance: { [Op.gt]: 0 }
        }
      })) || 0;

    res.status(200).json({
      success: true,
      data: {
        totalInvoices,
        paidInvoices,
        unpaidInvoices,
        overdueInvoices,
        totalRevenue,
        outstandingAmount
      }
    });
  } catch (error) {
    next(error);
  }
};







