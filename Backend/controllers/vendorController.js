const { Vendor, Expense } = require('../models');
const { Op } = require('sequelize');
const config = require('../config/config');

// @desc    Get all vendors
// @route   GET /api/vendors
// @access  Private
exports.getVendors = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || config.pagination.defaultPageSize;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    const where = {};
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { company: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Vendor.findAndCountAll({
      where,
      limit,
      offset,
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

// @desc    Get single vendor
// @route   GET /api/vendors/:id
// @access  Private
exports.getVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findByPk(req.params.id, {
      include: [{
        model: Expense,
        as: 'expenses',
        limit: 10,
        order: [['createdAt', 'DESC']]
      }]
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    res.status(200).json({
      success: true,
      data: vendor
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new vendor
// @route   POST /api/vendors
// @access  Private
exports.createVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.create(req.body);

    res.status(201).json({
      success: true,
      data: vendor
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update vendor
// @route   PUT /api/vendors/:id
// @access  Private
exports.updateVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findByPk(req.params.id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    await vendor.update(req.body);

    res.status(200).json({
      success: true,
      data: vendor
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete vendor
// @route   DELETE /api/vendors/:id
// @access  Private
exports.deleteVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findByPk(req.params.id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    await vendor.destroy();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};


