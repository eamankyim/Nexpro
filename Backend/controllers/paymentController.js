const { Payment, Customer, Vendor, Job } = require('../models');
const { Op } = require('sequelize');
const config = require('../config/config');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');

// Generate unique payment number
const generatePaymentNumber = async (tenantId, type) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const prefix = type === 'income' ? 'PAY-IN' : 'PAY-OUT';
  
  const lastPayment = await Payment.findOne({
    where: {
      tenantId,
      paymentNumber: {
        [Op.like]: `${prefix}-${year}${month}%`
      }
    },
    order: [['createdAt', 'DESC']]
  });

  let sequence = 1;
  if (lastPayment) {
    const lastSequence = parseInt(lastPayment.paymentNumber.split('-')[3]);
    sequence = lastSequence + 1;
  }

  return `${prefix}-${year}${month}-${String(sequence).padStart(4, '0')}`;
};

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private
exports.getPayments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || config.pagination.defaultPageSize;
    const offset = (page - 1) * limit;
    const type = req.query.type;
    const status = req.query.status;
    const paymentMethod = req.query.paymentMethod;

    const where = applyTenantFilter(req.tenantId, {});
    if (type && type !== 'null') where.type = type;
    if (status && status !== 'null') where.status = status;
    if (paymentMethod && paymentMethod !== 'null') where.paymentMethod = paymentMethod;

    const { count, rows } = await Payment.findAndCountAll({
      where,
      limit,
      offset,
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'company'] },
        { model: Vendor, as: 'vendor', attributes: ['id', 'name', 'company'] },
        { model: Job, as: 'job', attributes: ['id', 'jobNumber', 'title'] }
      ],
      order: [['paymentDate', 'DESC']]
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

// @desc    Get single payment
// @route   GET /api/payments/:id
// @access  Private
exports.getPayment = async (req, res, next) => {
  try {
    const payment = await Payment.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [
        { model: Customer, as: 'customer' },
        { model: Vendor, as: 'vendor' },
        { model: Job, as: 'job' }
      ]
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new payment
// @route   POST /api/payments
// @access  Private
exports.createPayment = async (req, res, next) => {
  try {
    const payload = sanitizePayload(req.body);
    const paymentNumber = await generatePaymentNumber(req.tenantId, payload.type);
    const payment = await Payment.create({
      ...payload,
      tenantId: req.tenantId,
      paymentNumber
    });

    // Update customer/vendor balance
    if (payment.customerId && payment.type === 'income') {
      const customer = await Customer.findOne({
        where: applyTenantFilter(req.tenantId, { id: payment.customerId })
      });
      if (customer) {
        await customer.update({
          balance: parseFloat(customer.balance) - parseFloat(payment.amount)
        });
      }
    }

    if (payment.vendorId && payment.type === 'expense') {
      const vendor = await Vendor.findOne({
        where: applyTenantFilter(req.tenantId, { id: payment.vendorId })
      });
      if (vendor) {
        await vendor.update({
          balance: parseFloat(vendor.balance) - parseFloat(payment.amount)
        });
      }
    }

    const paymentWithDetails = await Payment.findOne({
      where: applyTenantFilter(req.tenantId, { id: payment.id }),
      include: [
        { model: Customer, as: 'customer' },
        { model: Vendor, as: 'vendor' },
        { model: Job, as: 'job' }
      ]
    });

    res.status(201).json({
      success: true,
      data: paymentWithDetails
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update payment
// @route   PUT /api/payments/:id
// @access  Private
exports.updatePayment = async (req, res, next) => {
  try {
    const payment = await Payment.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    await payment.update(sanitizePayload(req.body));

    const updatedPayment = await Payment.findOne({
      where: applyTenantFilter(req.tenantId, { id: payment.id }),
      include: [
        { model: Customer, as: 'customer' },
        { model: Vendor, as: 'vendor' },
        { model: Job, as: 'job' }
      ]
    });

    res.status(200).json({
      success: true,
      data: updatedPayment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete payment
// @route   DELETE /api/payments/:id
// @access  Private
exports.deletePayment = async (req, res, next) => {
  try {
    const payment = await Payment.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    await payment.destroy();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get payment statistics
// @route   GET /api/payments/stats/overview
// @access  Private
exports.getPaymentStats = async (req, res, next) => {
  try {
    const { sequelize } = require('../config/database');

    const stats = await Payment.findAll({
      attributes: [
        'type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount']
      ],
      where: {
        ...applyTenantFilter(req.tenantId, {}),
        status: 'completed'
      },
      group: ['type']
    });

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};


