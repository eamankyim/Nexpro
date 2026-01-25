const { Pharmacy } = require('../models');
const { Op } = require('sequelize');
const config = require('../config/config');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');

// @desc    Get all pharmacies
// @route   GET /api/pharmacies
// @access  Private
exports.getPharmacies = async (req, res, next) => {
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
        { city: { [Op.iLike]: `%${search}%` } },
        { pharmacistName: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Pharmacy.findAndCountAll({
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

// @desc    Get single pharmacy
// @route   GET /api/pharmacies/:id
// @access  Private
exports.getPharmacy = async (req, res, next) => {
  try {
    const pharmacy = await Pharmacy.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }

    res.status(200).json({
      success: true,
      data: pharmacy
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new pharmacy
// @route   POST /api/pharmacies
// @access  Private
exports.createPharmacy = async (req, res, next) => {
  try {
    const payload = sanitizePayload(req.body);
    const pharmacy = await Pharmacy.create({
      ...payload,
      tenantId: req.tenantId
    });

    res.status(201).json({
      success: true,
      data: pharmacy
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update pharmacy
// @route   PUT /api/pharmacies/:id
// @access  Private
exports.updatePharmacy = async (req, res, next) => {
  try {
    const pharmacy = await Pharmacy.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }

    const payload = sanitizePayload(req.body);
    await pharmacy.update(payload);

    res.status(200).json({
      success: true,
      data: pharmacy
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete pharmacy
// @route   DELETE /api/pharmacies/:id
// @access  Private
exports.deletePharmacy = async (req, res, next) => {
  try {
    const pharmacy = await Pharmacy.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy not found'
      });
    }

    await pharmacy.destroy();

    res.status(200).json({
      success: true,
      message: 'Pharmacy deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
