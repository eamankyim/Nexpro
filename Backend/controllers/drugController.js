const { Drug, Pharmacy, InventoryCategory, ExpiryAlert } = require('../models');
const { Op } = require('sequelize');
const config = require('../config/config');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');
const dayjs = require('dayjs');

// @desc    Get all drugs
// @route   GET /api/drugs
// @access  Private
exports.getDrugs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || config.pagination.defaultPageSize;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const pharmacyId = req.query.pharmacyId;
    const categoryId = req.query.categoryId;
    const drugType = req.query.drugType;
    const lowStock = req.query.lowStock === 'true';

    const where = applyTenantFilter(req.tenantId, {});
    if (pharmacyId) {
      where.pharmacyId = pharmacyId;
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (drugType) {
      where.drugType = drugType;
    }
    if (lowStock) {
      where.quantityOnHand = {
        [Op.lte]: require('sequelize').col('reorderLevel')
      };
    }
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { genericName: { [Op.iLike]: `%${search}%` } },
        { brandName: { [Op.iLike]: `%${search}%` } },
        { sku: { [Op.iLike]: `%${search}%` } },
        { barcode: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Drug.findAndCountAll({
      where,
      limit,
      offset,
      include: [
        { model: Pharmacy, as: 'pharmacy', attributes: ['id', 'name'] },
        { model: InventoryCategory, as: 'category', attributes: ['id', 'name'] }
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

// @desc    Get single drug
// @route   GET /api/drugs/:id
// @access  Private
exports.getDrug = async (req, res, next) => {
  try {
    const drug = await Drug.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [
        { model: Pharmacy, as: 'pharmacy' },
        { model: InventoryCategory, as: 'category' }
      ]
    });

    if (!drug) {
      return res.status(404).json({
        success: false,
        message: 'Drug not found'
      });
    }

    res.status(200).json({
      success: true,
      data: drug
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new drug
// @route   POST /api/drugs
// @access  Private
exports.createDrug = async (req, res, next) => {
  try {
    const payload = sanitizePayload(req.body);
    const drug = await Drug.create({
      ...payload,
      tenantId: req.tenantId
    });

    // Create expiry alert if expiry date is provided
    if (payload.expiryDate) {
      await createExpiryAlert(req.tenantId, drug.id, payload.expiryDate, payload.quantityOnHand || 0, payload.batchNumber);
    }

    res.status(201).json({
      success: true,
      data: drug
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update drug
// @route   PUT /api/drugs/:id
// @access  Private
exports.updateDrug = async (req, res, next) => {
  try {
    const drug = await Drug.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!drug) {
      return res.status(404).json({
        success: false,
        message: 'Drug not found'
      });
    }

    const payload = sanitizePayload(req.body);
    await drug.update(payload);

    // Update expiry alert if expiry date changed
    if (payload.expiryDate) {
      await ExpiryAlert.destroy({
        where: { drugId: drug.id, tenantId: req.tenantId }
      });
      await createExpiryAlert(req.tenantId, drug.id, payload.expiryDate, payload.quantityOnHand || drug.quantityOnHand, payload.batchNumber || drug.batchNumber);
    }

    res.status(200).json({
      success: true,
      data: drug
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete drug
// @route   DELETE /api/drugs/:id
// @access  Private
exports.deleteDrug = async (req, res, next) => {
  try {
    const drug = await Drug.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!drug) {
      return res.status(404).json({
        success: false,
        message: 'Drug not found'
      });
    }

    await drug.destroy();

    res.status(200).json({
      success: true,
      message: 'Drug deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get expiring drugs
// @route   GET /api/drugs/expiring
// @access  Private
exports.getExpiringDrugs = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const today = dayjs().startOf('day');
    const expiryDate = today.add(days, 'day').endOf('day');

    const drugs = await Drug.findAll({
      where: applyTenantFilter(req.tenantId, {
        expiryDate: {
          [Op.between]: [today.toDate(), expiryDate.toDate()]
        },
        isActive: true
      }),
      include: [
        { model: Pharmacy, as: 'pharmacy', attributes: ['id', 'name'] },
        { model: InventoryCategory, as: 'category', attributes: ['id', 'name'] }
      ],
      order: [['expiryDate', 'ASC']]
    });

    res.status(200).json({
      success: true,
      count: drugs.length,
      data: drugs
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to create expiry alert
const createExpiryAlert = async (tenantId, drugId, expiryDate, quantity, batchNumber) => {
  const expiry = dayjs(expiryDate);
  const today = dayjs().startOf('day');
  const daysUntilExpiry = expiry.diff(today, 'day');

  let alertType = 'expiring_90_days';
  if (daysUntilExpiry < 0) {
    alertType = 'expired';
  } else if (daysUntilExpiry <= 30) {
    alertType = 'expiring_30_days';
  } else if (daysUntilExpiry <= 60) {
    alertType = 'expiring_60_days';
  }

  await ExpiryAlert.create({
    tenantId,
    drugId,
    batchNumber,
    expiryDate,
    quantity,
    alertType,
    daysUntilExpiry
  });
};
