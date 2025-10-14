const { Invoice, Job, Customer, JobItem } = require('../models');
const { Op } = require('sequelize');
const config = require('../config/config');

// Helper function to generate invoice number
const generateInvoiceNumber = async () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  const lastInvoice = await Invoice.findOne({
    where: {
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || config.pagination.defaultPageSize;
    const offset = (page - 1) * limit;
    const search = req.query.search;
    const status = req.query.status;
    const customerId = req.query.customerId;
    const jobId = req.query.jobId;

    const where = {};
    
    if (search) {
      where[Op.or] = [
        { invoiceNumber: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    if (status && status !== '') where.status = status;
    if (customerId) where.customerId = customerId;
    if (jobId) where.jobId = jobId;

    const { count, rows } = await Invoice.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'company', 'email', 'phone']
        },
        {
          model: Job,
          as: 'job',
          attributes: ['id', 'jobNumber', 'title', 'status']
        }
      ]
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
    const invoice = await Invoice.findByPk(req.params.id, {
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'company', 'email', 'phone', 'address', 'city']
        },
        {
          model: Job,
          as: 'job',
          attributes: ['id', 'jobNumber', 'title', 'description', 'status'],
          include: [
            {
              model: JobItem,
              as: 'items'
            }
          ]
        }
      ]
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
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
    const { jobId, dueDate, paymentTerms, taxRate, discountType, discountValue, notes, termsAndConditions } = req.body;

    // Fetch job with items
    const job = await Job.findByPk(jobId, {
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
    const existingInvoice = await Invoice.findOne({ where: { jobId } });
    if (existingInvoice) {
      return res.status(400).json({
        success: false,
        message: 'Invoice already exists for this job'
      });
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

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
    const createdInvoice = await Invoice.findByPk(invoice.id, {
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
    const invoice = await Invoice.findByPk(req.params.id);

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

    await invoice.update(req.body);

    const updatedInvoice = await Invoice.findByPk(invoice.id, {
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
    const invoice = await Invoice.findByPk(req.params.id);

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

    await invoice.destroy();

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
    const { amount, paymentMethod, referenceNumber, paymentDate } = req.body;

    const invoice = await Invoice.findByPk(req.params.id);

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
    const newAmountPaid = parseFloat(invoice.amountPaid) + paymentAmount;

    if (newAmountPaid > parseFloat(invoice.totalAmount)) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount exceeds invoice total'
      });
    }

    // Update invoice
    await invoice.update({
      amountPaid: newAmountPaid
    });

    // Create payment record
    const Payment = require('../models/Payment');
    const paymentNumber = `PAY-${Date.now()}`;
    
    await Payment.create({
      paymentNumber,
      type: 'income',
      customerId: invoice.customerId,
      jobId: invoice.jobId,
      amount: paymentAmount,
      paymentMethod: paymentMethod || 'cash',
      paymentDate: paymentDate || new Date(),
      referenceNumber,
      status: 'completed',
      notes: `Payment for invoice ${invoice.invoiceNumber}`
    });

    const updatedInvoice = await Invoice.findByPk(invoice.id, {
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

    res.status(200).json({
      success: true,
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
    const invoice = await Invoice.findByPk(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    await invoice.update({
      status: 'sent',
      sentDate: new Date()
    });

    const updatedInvoice = await Invoice.findByPk(invoice.id, {
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

    // TODO: Implement email sending functionality here

    res.status(200).json({
      success: true,
      message: 'Invoice marked as sent',
      data: updatedInvoice
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
    const invoice = await Invoice.findByPk(req.params.id);

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

    const updatedInvoice = await Invoice.findByPk(invoice.id, {
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
    const totalInvoices = await Invoice.count();
    const paidInvoices = await Invoice.count({ where: { status: 'paid' } });
    const unpaidInvoices = await Invoice.count({ where: { status: { [Op.in]: ['sent', 'draft'] } } });
    const overdueInvoices = await Invoice.count({ where: { status: 'overdue' } });
    
    const totalRevenue = await Invoice.sum('totalAmount', { where: { status: 'paid' } }) || 0;
    const outstandingAmount = await Invoice.sum('balance', { where: { status: { [Op.ne]: 'paid' } } }) || 0;

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


