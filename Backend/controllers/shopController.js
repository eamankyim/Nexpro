const { Shop } = require('../models');
const { Op } = require('sequelize');
const config = require('../config/config');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');

// @desc    Get all shops
// @route   GET /api/shops
// @access  Private
exports.getShops = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || config.pagination.defaultPageSize;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    const where = applyTenantFilter(req.tenantId, {});
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { code: { [Op.iLike]: `%${search}%` } },
        { city: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Shop.findAndCountAll({
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

// @desc    Get single shop
// @route   GET /api/shops/:id
// @access  Private
exports.getShop = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    res.status(200).json({
      success: true,
      data: shop
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new shop
// @route   POST /api/shops
// @access  Private
exports.createShop = async (req, res, next) => {
  try {
    const payload = sanitizePayload(req.body);
    const shop = await Shop.create({
      ...payload,
      tenantId: req.tenantId
    });

    res.status(201).json({
      success: true,
      data: shop
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update shop
// @route   PUT /api/shops/:id
// @access  Private
exports.updateShop = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    const payload = sanitizePayload(req.body);
    await shop.update(payload);

    res.status(200).json({
      success: true,
      data: shop
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete shop
// @route   DELETE /api/shops/:id
// @access  Private
exports.deleteShop = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    await shop.destroy();

    res.status(200).json({
      success: true,
      message: 'Shop deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
