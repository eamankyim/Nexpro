const { Job, Customer, User, Payment, Expense, JobItem, Invoice, Quote, JobStatusHistory } = require('../models');
const { Op } = require('sequelize');
const config = require('../config/config');

// Generate unique job number
const generateJobNumber = async () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  const lastJob = await Job.findOne({
    where: {
      jobNumber: {
        [Op.like]: `JOB-${year}${month}%`
      }
    },
    order: [['createdAt', 'DESC']]
  });

  let sequence = 1;
  if (lastJob) {
    const lastSequence = parseInt(lastJob.jobNumber.split('-')[2]);
    sequence = lastSequence + 1;
  }

  return `JOB-${year}${month}-${String(sequence).padStart(4, '0')}`;
};

// Generate unique invoice number
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

// Helper function to automatically create invoice for completed job
const autoCreateInvoice = async (jobId) => {
  try {
    // Check if invoice already exists for this job
    const existingInvoice = await Invoice.findOne({ where: { jobId } });
    if (existingInvoice) {
      return null; // Invoice already exists, skip creation
    }

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
      return null;
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

    // Create invoice with default values
    const invoice = await Invoice.create({
      invoiceNumber,
      jobId,
      customerId: job.customerId,
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
      subtotal,
      taxRate: 0,
      discountType: 'fixed',
      discountValue: 0,
      paymentTerms: 'Net 30',
      items,
      notes: `Auto-generated invoice for job ${job.jobNumber}`,
      termsAndConditions: 'Payment is due within the specified payment terms. Late payments may incur additional charges.'
    });

    return invoice;
  } catch (error) {
    console.error('Error auto-creating invoice:', error);
    return null;
  }
};

// @desc    Get all jobs
// @route   GET /api/jobs
// @access  Private
exports.getJobs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || config.pagination.defaultPageSize;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status;
    const customerId = req.query.customerId;
    const assignedTo = req.query.assignedTo;

    const where = {};
    if (search) {
      where[Op.or] = [
        { jobNumber: { [Op.iLike]: `%${search}%` } },
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }
    if (status) {
      where.status = status;
    }
    if (customerId) {
      where.customerId = customerId;
    }
    if (assignedTo) {
      where.assignedTo = assignedTo;
    }

    const { count, rows } = await Job.findAndCountAll({
      where,
      limit,
      offset,
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'company', 'email'] },
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        { model: Quote, as: 'quote', attributes: ['id', 'quoteNumber', 'status', 'title'] },
        { model: JobItem, as: 'items' }
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
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single job
// @route   GET /api/jobs/:id
// @access  Private
exports.getJob = async (req, res, next) => {
  try {
    const job = await Job.findByPk(req.params.id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        {
          model: JobStatusHistory,
          as: 'statusHistory',
          include: [{ model: User, as: 'changedByUser', attributes: ['id', 'name', 'email'] }],
          order: [['createdAt', 'ASC']]
        },
        { model: Payment, as: 'payments' },
        { model: Expense, as: 'expenses' },
        { model: JobItem, as: 'items' }
      ],
      order: [[{ model: JobStatusHistory, as: 'statusHistory' }, 'createdAt', 'ASC']]
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    res.status(200).json({
      success: true,
      data: job
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new job
// @route   POST /api/jobs
// @access  Private
exports.createJob = async (req, res, next) => {
  try {
    const { items, ...jobData } = req.body;
    const jobNumber = await generateJobNumber();
    if (req.user?.id) {
      jobData.createdBy = req.user.id;
    }
    
    // If status is completed, set completion date
    if (jobData.status === 'completed') {
      jobData.completionDate = new Date();
    }

    const job = await Job.create({
      ...jobData,
      jobNumber
    });

    // Create job items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      const jobItems = items.map(item => ({
        ...item,
        jobId: job.id,
        totalPrice: parseFloat(item.quantity) * parseFloat(item.unitPrice)
      }));
      await JobItem.bulkCreate(jobItems);
    }

    // Auto-create invoice if job is created with completed status
    let autoGeneratedInvoice = null;
    if (jobData.status === 'completed') {
      autoGeneratedInvoice = await autoCreateInvoice(job.id);
    }

    await JobStatusHistory.create({
      jobId: job.id,
      status: job.status,
      comment: 'Job created',
      changedBy: req.user?.id || null
    });

    const jobWithDetails = await Job.findByPk(job.id, {
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

    const response = {
      success: true,
      data: jobWithDetails
    };

    // Include invoice info if it was auto-generated
    if (autoGeneratedInvoice) {
      response.invoice = {
        id: autoGeneratedInvoice.id,
        invoiceNumber: autoGeneratedInvoice.invoiceNumber,
        message: 'Invoice automatically generated'
      };
    }

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

// @desc    Update job
// @route   PUT /api/jobs/:id
// @access  Private
exports.updateJob = async (req, res, next) => {
  try {
    const job = await Job.findByPk(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    const { statusComment, ...updatePayload } = req.body;
    const oldStatus = job.status;
    const newStatus = updatePayload.status;

    // If status is changing to completed, set completion date
    if (newStatus === 'completed' && oldStatus !== 'completed') {
      updatePayload.completionDate = new Date();
    }

    await job.update(updatePayload);

    // Auto-create invoice when job is marked as completed
    let autoGeneratedInvoice = null;
    if (newStatus === 'completed' && oldStatus !== 'completed') {
      autoGeneratedInvoice = await autoCreateInvoice(job.id);
    }

    const statusChanged = newStatus && newStatus !== oldStatus;
    if (statusChanged || statusComment) {
      await JobStatusHistory.create({
        jobId: job.id,
        status: statusChanged ? newStatus : job.status,
        comment: statusComment || null,
        changedBy: req.user?.id || null
      });
    }

    const updatedJob = await Job.findByPk(job.id, {
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

    const response = {
      success: true,
      data: updatedJob
    };

    // Include invoice info if it was auto-generated
    if (autoGeneratedInvoice) {
      response.invoice = {
        id: autoGeneratedInvoice.id,
        invoiceNumber: autoGeneratedInvoice.invoiceNumber,
        message: 'Invoice automatically generated'
      };
    }

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete job
// @route   DELETE /api/jobs/:id
// @access  Private
exports.deleteJob = async (req, res, next) => {
  try {
    const job = await Job.findByPk(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    await job.destroy();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get job statistics
// @route   GET /api/jobs/stats/overview
// @access  Private
exports.getJobStats = async (req, res, next) => {
  try {
    const { sequelize } = require('../config/database');

    const stats = await Job.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('finalPrice')), 'totalRevenue']
      ],
      group: ['status']
    });

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};


