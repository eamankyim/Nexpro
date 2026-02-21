const { Quote, QuoteItem, Customer, User, Job, JobItem, JobStatusHistory, QuoteActivity, Sale, SaleItem, SaleActivity } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { getPagination } = require('../utils/paginationUtils');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');

const generateQuoteNumber = async (tenantId) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  const lastQuote = await Quote.findOne({
    where: {
      tenantId,
      quoteNumber: {
        [Op.like]: `QTE-${year}${month}%`
      }
    },
    order: [['createdAt', 'DESC']]
  });

  let sequence = 1;
  if (lastQuote) {
    const lastSequence = parseInt(lastQuote.quoteNumber.split('-')[2], 10);
    sequence = lastSequence + 1;
  }

  return `QTE-${year}${month}-${String(sequence).padStart(4, '0')}`;
};

const formatQuoteResponse = (quote) => ({
  id: quote.id,
  quoteNumber: quote.quoteNumber,
  title: quote.title,
  description: quote.description,
  status: quote.status,
  validUntil: quote.validUntil,
  subtotal: quote.subtotal,
  discountTotal: quote.discountTotal,
  totalAmount: quote.totalAmount,
  notes: quote.notes,
  createdBy: quote.createdBy,
  acceptedAt: quote.acceptedAt,
  createdAt: quote.createdAt,
  updatedAt: quote.updatedAt,
  customer: quote.customer,
  creator: quote.creator,
  items: quote.items
});

const calculateTotals = (items = []) => {
  let subtotal = 0;
  let discountTotal = 0;

  items.forEach((item) => {
    const qty = parseFloat(item.quantity || 0);
    const price = parseFloat(item.unitPrice || 0);
    const lineSubtotal = qty * price;
    const discount = parseFloat(item.discountAmount || 0);

    subtotal += lineSubtotal;
    discountTotal += discount;
  });

  const totalAmount = subtotal - discountTotal;

  return {
    subtotal: subtotal.toFixed(2),
    discountTotal: discountTotal.toFixed(2),
    totalAmount: totalAmount.toFixed(2)
  };
};

exports.getQuotes = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const status = req.query.status;
    const customerId = req.query.customerId;
    const search = req.query.search || '';

    const where = applyTenantFilter(req.tenantId, {});
    // Staff see only quotes they created; admin/manager see all
    const effectiveRole = (req.tenantRole && ['owner', 'admin'].includes(req.tenantRole)) ? 'admin' : req.user?.role;
    if (effectiveRole === 'staff') {
      where.createdBy = req.user.id;
    }
    if (status && status !== 'all') {
      where.status = status;
    }
    if (customerId && customerId !== 'null' && customerId !== 'undefined') {
      where.customerId = customerId;
    }
    if (search) {
      where[Op.or] = [
        { quoteNumber: { [Op.iLike]: `%${search}%` } },
        { title: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Quote.findAndCountAll({
      where,
      limit,
      offset,
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'company', 'email']
        },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        { model: QuoteItem, as: 'items' }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      },
      data: rows.map(formatQuoteResponse)
    });
  } catch (error) {
    console.error('Error fetching quotes:', error);
    next(error);
  }
};

exports.getQuote = async (req, res, next) => {
  try {
    const quote = await Quote.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [
        { model: Customer, as: 'customer' },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        { model: QuoteItem, as: 'items' }
      ]
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    // Staff may only view quotes they created
    const effectiveRole = (req.tenantRole && ['owner', 'admin'].includes(req.tenantRole)) ? 'admin' : req.user?.role;
    if (effectiveRole === 'staff' && quote.createdBy !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this quote'
      });
    }

    res.status(200).json({
      success: true,
      data: formatQuoteResponse(quote)
    });
  } catch (error) {
    console.error(`Error fetching quote ${req.params.id}:`, error);
    next(error);
  }
};

exports.createQuote = async (req, res, next) => {
  try {
    const { items = [], ...quoteData } = sanitizePayload(req.body);

    const quoteNumber = await generateQuoteNumber(req.tenantId);
    const totals = calculateTotals(items);

    const quote = await Quote.create({
      ...quoteData,
      tenantId: req.tenantId,
      quoteNumber,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      totalAmount: totals.totalAmount,
      createdBy: req.user?.id || null
    });

    if (items.length) {
      const quoteItems = items.map((item) => ({
        quoteId: quote.id,
        tenantId: req.tenantId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount || 0,
        discountPercent: item.discountPercent || 0,
        discountReason: item.discountReason || null,
        total: item.total || ((parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0)) - parseFloat(item.discountAmount || 0)),
        metadata: item.metadata || {}
      }));
      await QuoteItem.bulkCreate(quoteItems);
    }

    const fullQuote = await Quote.findOne({
      where: applyTenantFilter(req.tenantId, { id: quote.id }),
      include: [
        { model: Customer, as: 'customer' },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        { model: QuoteItem, as: 'items' }
      ]
    });

    // Create activity for quote creation
    await QuoteActivity.create({
      quoteId: quote.id,
      tenantId: req.tenantId,
      type: 'note',
      subject: 'Quote Created',
      notes: `Quote ${quoteNumber} created`,
      createdBy: req.user?.id || null,
      metadata: {
        action: 'created'
      }
    });

    res.status(201).json({
      success: true,
      data: formatQuoteResponse(fullQuote)
    });

    // Send WhatsApp notification if enabled and customer has phone
    try {
      const whatsappService = require('../services/whatsappService');
      const whatsappTemplates = require('../services/whatsappTemplates');
      const config = await whatsappService.getConfig(req.tenantId);
      
      if (config && fullQuote.customer && fullQuote.customer.phone) {
        const phoneNumber = whatsappService.validatePhoneNumber(fullQuote.customer.phone);
        if (phoneNumber) {
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          const quoteLink = `${frontendUrl}/quotes/${fullQuote.id}`;
          const parameters = whatsappTemplates.prepareQuoteDelivery(
            fullQuote,
            fullQuote.customer,
            quoteLink
          );
          
          await whatsappService.sendMessage(
            req.tenantId,
            phoneNumber,
            'quote_delivery',
            parameters
          ).catch(error => {
            console.error('[Quote] WhatsApp send failed:', error);
          });
        }
      }
    } catch (error) {
      console.error('[Quote] WhatsApp integration error:', error);
    }
  } catch (error) {
    console.error('Error creating quote:', error);
    next(error);
  }
};

exports.updateQuote = async (req, res, next) => {
  try {
    const { items = [], ...quoteData } = sanitizePayload(req.body);

    const quote = await Quote.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [{ model: QuoteItem, as: 'items' }]
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    if (quote.status === 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Accepted quotes cannot be modified'
      });
    }

    const previousStatus = quote.status;
    const totals = calculateTotals(items);

    await quote.update({
      ...quoteData,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      totalAmount: totals.totalAmount
    });

    if (quoteData.status && quoteData.status !== previousStatus && quoteData.status) {
      const statusLabels = {
        draft: 'Draft',
        sent: 'Sent',
        accepted: 'Accepted',
        declined: 'Declined',
        expired: 'Expired'
      };
      const oldStatusLabel = statusLabels[previousStatus] || previousStatus;
      const newStatusLabel = statusLabels[quoteData.status] || quoteData.status;
      await QuoteActivity.create({
        quoteId: quote.id,
        tenantId: req.tenantId,
        type: 'status_change',
        subject: 'Status Updated',
        notes: `Status changed from ${oldStatusLabel} to ${newStatusLabel}`,
        createdBy: req.user?.id || null,
        metadata: {
          oldStatus: previousStatus,
          newStatus: quoteData.status
        }
      });
    } else {
      await QuoteActivity.create({
        quoteId: quote.id,
        tenantId: req.tenantId,
        type: 'note',
        subject: 'Quote Updated',
        notes: 'Details were updated',
        createdBy: req.user?.id || null,
        metadata: {}
      });
    }

    // Replace items
    await QuoteItem.destroy({ where: applyTenantFilter(req.tenantId, { quoteId: quote.id }) });
    if (items.length) {
      const quoteItems = items.map((item) => ({
        quoteId: quote.id,
        tenantId: req.tenantId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount || 0,
        discountPercent: item.discountPercent || 0,
        discountReason: item.discountReason || null,
        total: item.total || ((parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0)) - parseFloat(item.discountAmount || 0)),
        metadata: item.metadata || {}
      }));
      await QuoteItem.bulkCreate(quoteItems);
    }

    const fullQuote = await Quote.findOne({
      where: applyTenantFilter(req.tenantId, { id: quote.id }),
      include: [
        { model: Customer, as: 'customer' },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        { model: QuoteItem, as: 'items' }
      ]
    });

    res.status(200).json({
      success: true,
      data: formatQuoteResponse(fullQuote)
    });
  } catch (error) {
    console.error(`Error updating quote ${req.params.id}:`, error);
    next(error);
  }
};

exports.deleteQuote = async (req, res, next) => {
  try {
    const quote = await Quote.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    if (quote.status === 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Accepted quotes cannot be deleted'
      });
    }

    await quote.destroy();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error(`Error deleting quote ${req.params.id}:`, error);
    next(error);
  }
};

exports.convertQuoteToJob = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    // First, fetch quote without includes to avoid FOR UPDATE with JOIN issue
    const quote = await Quote.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!quote) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    if (quote.status === 'accepted') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Quote has already been converted'
      });
    }

    // Check if a job already exists for this quote
    const existingJob = await Job.findOne({
      where: applyTenantFilter(req.tenantId, { quoteId: quote.id }),
      transaction
    });

    if (existingJob) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'A job has already been created from this quote',
        data: {
          jobId: existingJob.id,
          jobNumber: existingJob.jobNumber
        }
      });
    }

    // Fetch related data separately (customer and items)
    const customer = await Customer.findOne({
      where: applyTenantFilter(req.tenantId, { id: quote.customerId }),
      transaction
    });

    const quoteItems = await QuoteItem.findAll({
      where: applyTenantFilter(req.tenantId, { quoteId: quote.id }),
      transaction
    });

    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const lastJob = await Job.findOne({
      where: {
        tenantId: req.tenantId,
        jobNumber: {
          [Op.like]: `JOB-${year}${month}%`
        }
      },
      order: [['createdAt', 'DESC']],
      transaction
    });

    let sequence = 1;
    if (lastJob) {
      const lastSequence = parseInt(lastJob.jobNumber.split('-')[2], 10);
      sequence = lastSequence + 1;
    }

    const jobNumber = `JOB-${year}${month}-${String(sequence).padStart(4, '0')}`;

    const job = await Job.create({
      jobNumber,
      quoteId: quote.id,
      customerId: quote.customerId,
      title: quote.title,
      description: quote.description,
      status: 'new',
      priority: 'medium',
      quotedPrice: quote.totalAmount,
      finalPrice: quote.totalAmount,
      notes: quote.notes,
      tenantId: req.tenantId,
      createdBy: req.user?.id || null
    }, { transaction });

    if (quoteItems && quoteItems.length) {
      const jobItems = quoteItems.map(item => ({
        jobId: job.id,
        quoteItemId: item.id,
        tenantId: req.tenantId,
        category: item.description,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.total,
        specifications: item.metadata || {}
      }));
      await JobItem.bulkCreate(jobItems, { transaction });
    }

    await JobStatusHistory.create({
      jobId: job.id,
      status: 'new',
      comment: `Job created from quote ${quote.quoteNumber}`,
      changedBy: req.user?.id || null,
      tenantId: req.tenantId
    }, { transaction });

    await quote.update({
      status: 'accepted',
      acceptedAt: new Date()
    }, { transaction });

    // Create activity for quote-to-job conversion
    await QuoteActivity.create({
      quoteId: quote.id,
      tenantId: req.tenantId,
      type: 'conversion',
      subject: 'Quote Converted to Job',
      notes: `Quote converted to job ${jobNumber}`,
      createdBy: req.user?.id || null,
      metadata: {
        jobId: job.id,
        jobNumber: jobNumber
      }
    }, { transaction });

    await transaction.commit();

    const jobWithDetails = await Job.findOne({
      where: applyTenantFilter(req.tenantId, { id: job.id }),
      include: [
        { model: Customer, as: 'customer' },
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        { model: Quote, as: 'quote', attributes: ['id', 'quoteNumber', 'status', 'title'] },
        {
          model: JobStatusHistory,
          as: 'statusHistory',
          include: [{ model: User, as: 'changedByUser', attributes: ['id', 'name', 'email'] }],
          order: [['createdAt', 'ASC']]
        },
        { model: JobItem, as: 'items' }
      ],
      order: [[{ model: JobStatusHistory, as: 'statusHistory' }, 'createdAt', 'ASC']]
    });

    const updatedQuote = await Quote.findOne({
      where: applyTenantFilter(req.tenantId, { id: quote.id }),
      include: [
        { model: Customer, as: 'customer' },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        { model: QuoteItem, as: 'items' }
      ]
    });

    res.status(200).json({
      success: true,
      data: {
        quote: formatQuoteResponse(updatedQuote),
        job: jobWithDetails
      }
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error(`Error converting quote ${req.params.id} to job:`, error);
    next(error);
  }
};

exports.addQuoteActivity = async (req, res, next) => {
  try {
    const quote = await Quote.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found' });
    }

    const payload = sanitizePayload(req.body);

    const activity = await QuoteActivity.create({
      quoteId: quote.id,
      tenantId: req.tenantId,
      type: payload.type || 'note',
      subject: payload.subject || null,
      notes: payload.notes || null,
      createdBy: req.user?.id || null,
      nextStep: payload.nextStep || null,
      followUpDate: payload.followUpDate || null,
      metadata: payload.metadata || {}
    });

    const populatedActivity = await QuoteActivity.findOne({
      where: applyTenantFilter(req.tenantId, { id: activity.id }),
      include: [{ model: User, as: 'createdByUser', attributes: ['id', 'name', 'email'] }]
    });

    res.status(201).json({ success: true, data: populatedActivity });
  } catch (error) {
    next(error);
  }
};

exports.getQuoteActivities = async (req, res, next) => {
  try {
    const quote = await Quote.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found' });
    }

    const activities = await QuoteActivity.findAll({
      where: applyTenantFilter(req.tenantId, { quoteId: quote.id }),
      order: [['createdAt', 'DESC']],
      include: [{ model: User, as: 'createdByUser', attributes: ['id', 'name', 'email'] }]
    });

    res.status(200).json({ success: true, data: activities });
  } catch (error) {
    next(error);
  }
};

exports.convertQuoteToSale = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    // First, fetch quote without includes to avoid FOR UPDATE with JOIN issue
    const quote = await Quote.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!quote) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    if (quote.status === 'accepted') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Quote has already been converted'
      });
    }

    // Check if a sale already exists for this quote
    const existingSale = await Sale.findOne({
      where: applyTenantFilter(req.tenantId, { 
        metadata: { quoteId: quote.id }
      }),
      transaction
    });

    if (existingSale) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'A sale has already been created from this quote',
        data: {
          saleId: existingSale.id,
          saleNumber: existingSale.saleNumber
        }
      });
    }

    // Fetch related data separately
    const customer = await Customer.findOne({
      where: applyTenantFilter(req.tenantId, { id: quote.customerId }),
      transaction
    });

    const quoteItems = await QuoteItem.findAll({
      where: applyTenantFilter(req.tenantId, { quoteId: quote.id }),
      transaction
    });    // Get payment method from request body (default to 'credit' for quote conversions)
    const paymentMethod = req.body.paymentMethod || 'credit';
    const shopId = req.body.shopId || null;

    // Generate sale number
    const prefix = 'SALE';
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    
    const count = await Sale.count({
      where: {
        tenantId: req.tenantId,
        createdAt: {
          [Op.between]: [startOfDay, endOfDay]
        }
      },
      transaction
    });
    
    const sequence = String(count + 1).padStart(4, '0');
    const saleNumber = `${prefix}-${dateStr}-${sequence}`;

    // Calculate totals from quote
    const subtotal = parseFloat(quote.subtotal || 0);
    const discount = parseFloat(quote.discountTotal || 0);
    const tax = 0; // Quotes don't have tax, can be added later
    const total = subtotal - discount + tax;
    const amountPaid = paymentMethod === 'credit' ? 0 : total;
    const change = 0;

    // Create sale
    const sale = await Sale.create({
      tenantId: req.tenantId,
      shopId: shopId,
      saleNumber,
      customerId: quote.customerId,
      subtotal,
      discount,
      tax,
      total,
      paymentMethod,
      amountPaid,
      change,
      status: paymentMethod === 'credit' ? 'pending' : 'completed',
      soldBy: req.user?.id || null,
      notes: `Converted from quote ${quote.quoteNumber}`,
      metadata: {
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber
      }
    }, { transaction });

    // Create sale items from quote items
    // Note: SaleItems require productId, but quotes may not have products
    // For now, we'll create sale items with minimal product info
    // In production, you might want to require products to be linked to quotes first
    if (quoteItems && quoteItems.length) {
      for (const quoteItem of quoteItems) {
        // Try to find a product by description or create a placeholder
        // For now, we'll require productId in metadata or skip items without products
        const productId = quoteItem.metadata?.productId || null;
        
        if (!productId) {
          // Skip items without productId - in production, you might want to handle this differently
          console.warn(`Skipping quote item ${quoteItem.id} - no productId found`);
          continue;
        }        const itemSubtotal = parseFloat(quoteItem.quantity || 0) * parseFloat(quoteItem.unitPrice || 0);
        const itemDiscount = parseFloat(quoteItem.discountAmount || 0);
        const itemTax = 0;
        const itemTotal = itemSubtotal - itemDiscount + itemTax;

        await SaleItem.create({
          saleId: sale.id,
          productId: productId,
          productVariantId: quoteItem.metadata?.productVariantId || null,
          name: quoteItem.description,
          sku: quoteItem.metadata?.sku || null,
          quantity: quoteItem.quantity,
          unitPrice: quoteItem.unitPrice,
          discount: itemDiscount,
          tax: itemTax,
          subtotal: itemSubtotal,
          total: itemTotal,
          metadata: {
            quoteItemId: quoteItem.id,
            ...quoteItem.metadata
          }
        }, { transaction });
      }
    }

    // Update quote status
    await quote.update({
      status: 'accepted',
      acceptedAt: new Date()
    }, { transaction });    // Create activity for quote-to-sale conversion
    await QuoteActivity.create({
      quoteId: quote.id,
      tenantId: req.tenantId,
      type: 'conversion',
      subject: 'Quote Converted to Sale',
      notes: `Quote converted to sale ${saleNumber}`,
      createdBy: req.user?.id || null,
      metadata: {
        saleId: sale.id,
        saleNumber: saleNumber,
        paymentMethod: paymentMethod
      }
    }, { transaction });    // Create activity for sale creation
    await SaleActivity.create({
      saleId: sale.id,
      tenantId: req.tenantId,
      type: 'note',
      subject: 'Sale Created from Quote',
      notes: `Sale created from quote ${quote.quoteNumber}`,
      createdBy: req.user?.id || null,
      metadata: {
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        action: 'created_from_quote'
      }
    }, { transaction });

    await transaction.commit();

    // Auto-create invoice for credit sales (outside transaction)
    if (paymentMethod === 'credit') {
      try {
        const { autoCreateInvoiceFromSale } = require('./saleController');
        console.log(`[ConvertQuoteToSale] Attempting to auto-create invoice for sale ${sale.id}`);
        const autoGeneratedInvoice = await autoCreateInvoiceFromSale(sale.id, req.tenantId);
        if (autoGeneratedInvoice) {
          console.log(`[ConvertQuoteToSale] ✅ Invoice auto-created: ${autoGeneratedInvoice.invoiceNumber}`);
        }
      } catch (invoiceError) {
        console.error('[ConvertQuoteToSale] ❌ Failed to auto-create invoice:', invoiceError);
      }
    }    // Fetch sale with relations
    const createdSale = await Sale.findByPk(sale.id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: User, as: 'seller', attributes: ['id', 'name', 'email'] },
        {
          model: SaleItem,
          as: 'items',
          include: [
            { model: require('../models').Product, as: 'product' },
            { model: require('../models').ProductVariant, as: 'variant' }
          ]
        }
      ]
    });

    const updatedQuote = await Quote.findOne({
      where: applyTenantFilter(req.tenantId, { id: quote.id }),
      include: [
        { model: Customer, as: 'customer' },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        { model: QuoteItem, as: 'items' }
      ]
    });

    res.status(200).json({
      success: true,
      data: {
        quote: formatQuoteResponse(updatedQuote),
        sale: createdSale
      }
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error(`Error converting quote ${req.params.id} to sale:`, error);
    next(error);
  }
};