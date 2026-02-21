const { Op } = require('sequelize');
const { Customer, Tenant } = require('../models');
const { getPagination } = require('../utils/paginationUtils');
const { sanitizePayload } = require('../utils/tenantUtils');

const PLATFORM_TENANT_SLUG = 'platform';

/**
 * Get or create the platform tenant (used for admin-owned customers, e.g. website design clients).
 * @returns {Promise<string>} Platform tenant UUID
 */
async function getPlatformTenantId() {
  let tenant = await Tenant.findOne({ where: { slug: PLATFORM_TENANT_SLUG } });
  if (!tenant) {
    tenant = await Tenant.create({
      name: 'Platform',
      slug: PLATFORM_TENANT_SLUG,
      status: 'active',
      plan: 'trial',
    });
  }
  return tenant.id;
}

/**
 * List customers owned by the platform (admin's own customers). Pagination and search.
 */
exports.getAdminCustomers = async (req, res, next) => {
  try {
    const platformTenantId = await getPlatformTenantId();
    const { page, limit, offset } = getPagination(req);
    const search = (req.query.search || '').trim();

    const where = { tenantId: platformTenantId };
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { company: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Customer.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [{ model: Tenant, as: 'tenant', attributes: ['id', 'name'] }],
    });

    res.status(200).json({
      success: true,
      count,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
      data: rows,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single customer by ID. Must belong to platform tenant.
 */
exports.getAdminCustomer = async (req, res, next) => {
  try {
    const platformTenantId = await getPlatformTenantId();
    const customer = await Customer.findOne({
      where: { id: req.params.id, tenantId: platformTenantId },
      include: [{ model: Tenant, as: 'tenant', attributes: ['id', 'name', 'businessType'] }],
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a customer for the platform (admin's own customer).
 */
exports.createAdminCustomer = async (req, res, next) => {
  try {
    const platformTenantId = await getPlatformTenantId();
    const payload = sanitizePayload(req.body);
    const customer = await Customer.create({
      ...payload,
      tenantId: platformTenantId,
    });

    res.status(201).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a platform customer by ID.
 */
exports.updateAdminCustomer = async (req, res, next) => {
  try {
    const platformTenantId = await getPlatformTenantId();
    const customer = await Customer.findOne({
      where: { id: req.params.id, tenantId: platformTenantId },
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const payload = sanitizePayload(req.body);
    await customer.update(payload);

    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a platform customer by ID.
 */
exports.deleteAdminCustomer = async (req, res, next) => {
  try {
    const platformTenantId = await getPlatformTenantId();
    const customer = await Customer.findOne({
      where: { id: req.params.id, tenantId: platformTenantId },
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    await customer.destroy();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};
