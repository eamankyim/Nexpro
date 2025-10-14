const { Job, Customer, User, Payment, Expense, JobItem } = require('../models');
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

    const { count, rows } = await Job.findAndCountAll({
      where,
      limit,
      offset,
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'company', 'email'] },
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
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
        { model: Payment, as: 'payments' },
        { model: Expense, as: 'expenses' },
        { model: JobItem, as: 'items' }
      ]
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

    const jobWithDetails = await Job.findByPk(job.id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
        { model: JobItem, as: 'items' }
      ]
    });

    res.status(201).json({
      success: true,
      data: jobWithDetails
    });
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

    await job.update(req.body);

    const updatedJob = await Job.findByPk(job.id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] }
      ]
    });

    res.status(200).json({
      success: true,
      data: updatedJob
    });
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


