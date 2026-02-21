const { Invoice, Job, Customer, JobItem, Payment, Sale, Prescription, SaleActivity } = require('../models');
const { Op } = require('sequelize');
const { getPagination } = require('../utils/paginationUtils');
const { createInvoicePaymentJournal, createInvoiceRevenueJournal } = require('../services/invoiceAccountingService');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');
const { invalidateInvoiceListCache } = require('../middleware/cache');
const activityLogger = require('../services/activityLogger');
const { updateCustomerBalance } = require('../services/customerBalanceService');
const sabitoWebhookService = require('../services/sabitoWebhookService');

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

    const where = applyTenantFilter(req.tenantId, {});
    
    // Filter by business type - only show invoices relevant to the tenant's business type
    const businessType = req.tenant?.businessType;
    if (businessType) {
      if (businessType === 'printing_press') {
        // Printing press only sees job-based invoices (or legacy invoices without sourceType)
        where[Op.or] = [
          { sourceType: 'job' },
          { sourceType: null }
        ];
      } else if (businessType === 'shop') {
        // Shop only sees sale-based invoices
        where.sourceType = 'sale';
      } else if (businessType === 'pharmacy') {
        // Pharmacy only sees prescription-based invoices
        where.sourceType = 'prescription';
      }
    }

    // Staff see only invoices from their sales or their jobs; admin/manager see all
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

// @desc    Create invoice from job
// @route   POST /api/invoices
// @access  Private
exports.createInvoice = async (req, res, next) => {
  try {
    const {
      jobId,
      dueDate,
      paymentTerms,
      taxRate,
      discountType,
      discountValue,
      notes,
      termsAndConditions
    } = sanitizePayload(req.body);

    // Fetch job with items
    const job = await Job.findOne({
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

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(req.tenantId);

    // Calculate subtotal from job items or finalPrice
    let subtotal = 0;
    let items = [];

    if (job.items && job.items.length > 0) {
      items = job.items.map(item => ({
        description: item.description || item.category,
        category: item.category,
        paperSize: item.paperSize,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice),
        total: parseFloat(item.quantity) * parseFloat(item.unitPrice)
      }));
      subtotal = items.reduce((sum, item) => sum + item.total, 0);
    } else {
      // If no items, use finalPrice from job
      subtotal = parseFloat(job.finalPrice || 0);
      items = [{
        description: job.title,
        quantity: 1,
        unitPrice: subtotal,
        total: subtotal
      }];
    }

    // Create invoice
    const invoice = await Invoice.create({
      invoiceNumber,
      jobId,
      customerId: job.customerId,
      tenantId: req.tenantId,
      sourceType: 'job', // Set source type for business type filtering
      invoiceDate: new Date(),
      dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
      subtotal,
      taxRate: taxRate || 0,
      discountType: discountType || 'fixed',
      discountValue: discountValue || 0,
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

    // Log activity if invoice is now fully paid
    if (updatedInvoice.status === 'paid' && invoice.status !== 'paid') {
      try {
        await activityLogger.logInvoicePaid(updatedInvoice, req.user?.id || null);
      } catch (error) {
        console.error('Failed to log payment activity:', error);
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

    // Update customer balance
    try {
      await updateCustomerBalance(invoice.customerId);
    } catch (error) {
      console.error('Failed to update customer balance:', error);
    }

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

    // Send WhatsApp notification if enabled and customer has phone
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
      // Don't fail the request if WhatsApp fails
    }

    // Log activity
    try {
      await activityLogger.logInvoiceSent(updatedInvoice, req.user?.id || null);
    } catch (error) {
      console.error('Failed to log invoice sent activity:', error);
    }

    // Send email notification
    let emailSent = false;
    let emailError = null;
    
    try {
      const emailService = require('../services/emailService');
      const emailTemplates = require('../services/emailTemplates');
      const { Tenant } = require('../models');
      
      // Check if customer has email
      if (updatedInvoice.customer && updatedInvoice.customer.email) {
        // Get tenant/company info for email template
        const tenant = await Tenant.findByPk(req.tenantId);
        const company = {
          name: tenant?.name || 'ShopWISE',
          logo: tenant?.logo || '',
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
      // Don't fail the request if email fails
    }

    res.status(200).json({
      success: true,
      message: emailSent 
        ? 'Invoice sent successfully via email and marked as sent' 
        : 'Invoice marked as sent (email not sent: ' + (emailError || 'unknown error') + ')',
      data: updatedInvoice,
      paymentLink,
      emailSent,
      emailError: emailSent ? null : emailError
    });
  } catch (error) {
    next(error);
  }
};

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
        tenant: {
          name: invoice.tenant?.name
        },
        source: invoice.sourceType,
        sourceDetails: invoice.job || invoice.sale || invoice.prescription || null
      }
    });
  } catch (error) {
    next(error);
  }
};

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
    } else if (invoice.status === 'sent' && newAmountPaid > 0) {
      updatePayload.status = 'partial';
    }

    await invoice.update(updatePayload);

    // Create payment record
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

    // Add source-specific fields if they exist
    if (invoice.jobId) paymentData.jobId = invoice.jobId;
    if (invoice.saleId) paymentData.saleId = invoice.saleId;
    if (invoice.prescriptionId) paymentData.prescriptionId = invoice.prescriptionId;

    // Update sale status if invoice is linked to a sale and payment covers the full amount
    if (invoice.saleId && newAmountPaid >= parseFloat(invoice.totalAmount)) {
      try {
        const sale = await Sale.findByPk(invoice.saleId);
        if (sale && sale.status === 'pending') {
          await sale.update({ status: 'completed' });
          
          // Create sale activity for payment received
          await SaleActivity.create({
            saleId: sale.id,
            tenantId: invoice.tenantId,
            type: 'payment',
            subject: 'Payment Received',
            notes: `Full payment received for invoice ${invoice.invoiceNumber}`,
            createdBy: null, // Public payment, no user
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
        // Don't fail the payment if sale update fails
      }
    }

    // Add metadata if Payment model supports it
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

    // Log activity (if user context available)
    try {
      await activityLogger.logInvoicePaid(updatedInvoice, null);
    } catch (error) {
      console.error('Failed to log payment activity:', error);
    }

    // Update customer balance
    try {
      await updateCustomerBalance(invoice.customerId);
    } catch (error) {
      console.error('Failed to update customer balance:', error);
    }

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
    const baseWhere = applyTenantFilter(req.tenantId, {});

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
        where: { ...baseWhere, status: { [Op.ne]: 'paid' } }
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







