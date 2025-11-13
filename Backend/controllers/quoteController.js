const { Quote, QuoteItem, Customer, User, Job, JobItem, JobStatusHistory } = require('../models');
const { Op } = require('sequelize');
const config = require('../config/config');
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
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || config.pagination.defaultPageSize;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const customerId = req.query.customerId;
    const search = req.query.search || '';

    const where = applyTenantFilter(req.tenantId, {});
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

    res.status(201).json({
      success: true,
      data: formatQuoteResponse(fullQuote)
    });
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

    const totals = calculateTotals(items);

    await quote.update({
      ...quoteData,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      totalAmount: totals.totalAmount
    });

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
  try {
    const quote = await Quote.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [
        { model: Customer, as: 'customer' },
        { model: QuoteItem, as: 'items' }
      ]
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
        message: 'Quote has already been converted'
      });
    }

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
      order: [['createdAt', 'DESC']]
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
      finalPrice: quote.totalAmount,
      notes: quote.notes,
      tenantId: req.tenantId,
      createdBy: req.user?.id || null
    });

    if (quote.items && quote.items.length) {
      const jobItems = quote.items.map(item => ({
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
      await JobItem.bulkCreate(jobItems);
    }

    await JobStatusHistory.create({
      jobId: job.id,
      status: 'new',
      comment: `Job created from quote ${quote.quoteNumber}`,
      changedBy: req.user?.id || null
    });

    await quote.update({
      status: 'accepted',
      acceptedAt: new Date()
    });

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

    res.status(200).json({
      success: true,
      data: {
        quote: formatQuoteResponse(await Quote.findOne({
          where: applyTenantFilter(req.tenantId, { id: quote.id }),
          include: [
            { model: Customer, as: 'customer' },
            { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
            { model: QuoteItem, as: 'items' }
          ]
        })),
        job: jobWithDetails
      }
    });
  } catch (error) {
    console.error(`Error converting quote ${req.params.id} to job:`, error);
    next(error);
  }
};


