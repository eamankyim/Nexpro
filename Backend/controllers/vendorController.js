const { Vendor, Expense } = require('../models');
const { Op } = require('sequelize');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');
const { getPagination } = require('../utils/paginationUtils');
const { getVendorCategories } = require('../config/vendorCategories');

// @desc    Get vendor categories for current tenant (based on business type and shop/studio type)
// @route   GET /api/vendors/categories
// @access  Private
exports.getVendorCategories = async (req, res, next) => {
  try {
    const tenant = req.tenant || (req.tenantMembership && await req.tenantMembership.getTenant());
    const businessType = tenant?.businessType || 'shop';
    const metadata = tenant?.metadata || {};
    const categories = getVendorCategories(businessType, metadata);

    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all vendors
// @route   GET /api/vendors
// @access  Private
exports.getVendors = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = req.query.search || '';
    const category = req.query.category;
    const isActive = req.query.isActive;

    const where = applyTenantFilter(req.tenantId, {});
    if (typeof isActive === 'string' && (isActive === 'true' || isActive === 'false')) {
      where.isActive = isActive === 'true';
    }
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { company: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }
    if (category) {
      where.category = category;
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

// @desc    Export vendors to CSV
// @route   GET /api/vendors/export
// @access  Private (admin, manager)
exports.exportVendors = async (req, res, next) => {
  try {
    const { sendCSV, COLUMN_DEFINITIONS } = require('../utils/dataExport');
    const where = applyTenantFilter(req.tenantId, {});

    const vendors = await Vendor.findAll({
      where,
      order: [['createdAt', 'DESC']],
      raw: true,
    });

    if (vendors.length === 0) {
      return res.status(404).json({ success: false, message: 'No vendors to export' });
    }

    const filename = `vendors_${new Date().toISOString().split('T')[0]}`;
    sendCSV(res, vendors, `${filename}.csv`, COLUMN_DEFINITIONS.vendors);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single vendor
// @route   GET /api/vendors/:id
// @access  Private
exports.getVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [{
        model: Expense,
        as: 'expenses',
        limit: 10,
        order: [['createdAt', 'DESC']],
        where: applyTenantFilter(req.tenantId, {}),
        required: false
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
    const payload = sanitizePayload(req.body);
    if (payload.email === '') payload.email = null;
    // Normalize empty website string to null to avoid validation errors
    if (payload.website === '' || payload.website === null || payload.website === undefined) {
      payload.website = null;
    }
    const vendor = await Vendor.create({
      ...payload,
      tenantId: req.tenantId
    });

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
    const vendor = await Vendor.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const payload = sanitizePayload(req.body);
    if (payload.email === '') payload.email = null;
    // Normalize empty website string to null to avoid validation errors
    if (payload.website === '' || payload.website === null || payload.website === undefined) {
      payload.website = null;
    }
    await vendor.update(payload);

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
    const vendor = await Vendor.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

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


