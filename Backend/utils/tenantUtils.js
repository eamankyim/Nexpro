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

module.exports = {
  applyTenantFilter,
  sanitizePayload
};



