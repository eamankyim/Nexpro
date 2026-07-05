const { Tenant } = require('../models');

const applyTenantFilter = (tenantId, where = {}) => ({
  ...where,
  tenantId
});

const sanitizePayload = (payload = {}) => {
  const clone = { ...payload };
  delete clone.tenantId;
  delete clone.tenant;
  delete clone.tenantIds;
  delete clone.tenant_id;
  return clone;
};

/**
 * Load a tenant including optional columns excluded by the default scope
 * (e.g. paystackSubaccountCode for payment collection splits).
 * @param {string} tenantId
 * @param {import('sequelize').FindOptions} [options]
 */
const findTenantWithOptionalColumns = (tenantId, options = {}) =>
  Tenant.scope('withOptionalColumns').findByPk(tenantId, options);

module.exports = {
  applyTenantFilter,
  sanitizePayload,
  findTenantWithOptionalColumns,
};



