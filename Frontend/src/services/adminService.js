import api from './api';

const getSummary = async () => api.get('/admin/summary');

const getTenants = async (params = {}) => api.get('/admin/tenants', { params });

/** Invite a new tenant (platform admin). Sends email with signup link; invitee creates account and becomes owner. */
const inviteTenant = async (payload) => api.post('/admin/tenants/invite', payload);

const getTenantMetrics = async () => api.get('/admin/metrics/tenants');

const getAlerts = async () => api.get('/admin/alerts');

const getTenantDetail = async (tenantId) => api.get(`/admin/tenants/${tenantId}`);
const getTenantAccessAudit = async (tenantId) => api.get(`/admin/tenants/${tenantId}/access-audit`);

const updateTenantStatus = async (tenantId, action) =>
  api.patch(`/admin/tenants/${tenantId}/status`, { action });

const updateTenantAccess = async (tenantId, payload) =>
  api.patch(`/admin/tenants/${tenantId}/access`, payload);

const updateTenantBranding = async (tenantId, payload) =>
  api.patch(`/admin/tenants/${tenantId}/branding`, payload);

const getBillingSummary = async () => api.get('/admin/billing/summary');

const getBillingTenants = async () => api.get('/admin/billing/tenants');

const getPlatformSettings = async () => api.get('/platform-settings');

const updatePlatformSettings = async (payload) =>
  api.put('/platform-settings', payload);

const getSystemHealth = async () => api.get('/admin/health');

const getPlatformAdmins = async () => api.get('/platform-admins');

/** Roles offered when inviting a platform admin */
const getPlatformAdminInviteRoles = async () => {
  const res = await api.get('/platform-admins/invite-roles');
  const data = res?.data;
  return Array.isArray(data) ? data : [];
};

/** Invite platform admin (same flow as shop invites: invitee sets password at signup) */
const invitePlatformAdmin = async (payload) =>
  api.post('/platform-admins/invite', payload);

const getPlatformAdminInvites = async () =>
  api.get('/platform-admins/invites');

const revokePlatformAdminInvite = async (id) =>
  api.delete(`/platform-admins/invites/${id}`);

const createPlatformAdmin = async (payload) =>
  api.post('/platform-admins', payload);

const updatePlatformAdmin = async (adminId, payload) =>
  api.put(`/platform-admins/${adminId}`, payload);

const getReportKpis = async (params = {}) => api.get('/admin/reports/kpi-summary', { params });

const getReportRevenue = async (params = {}) => api.get('/admin/reports/revenue', { params });

const getReportExpenses = async (params = {}) => api.get('/admin/reports/expenses', { params });

const getReportPipeline = async () => api.get('/admin/reports/pipeline-summary');

const getReportTopCustomers = async (params = {}) =>
  api.get('/admin/reports/top-customers', { params });

const getSubscriptionPlans = async () => {
  console.log('[adminService] getSubscriptionPlans: Making API call to /platform-settings/plans');
  try {
    const result = await api.get('/platform-settings/plans');
    console.log('[adminService] getSubscriptionPlans: API call successful');
    console.log('[adminService] getSubscriptionPlans: Result:', result);
    return result;
  } catch (error) {
    console.error('[adminService] getSubscriptionPlans: API call failed');
    console.error('[adminService] getSubscriptionPlans: Error:', error);
    throw error;
  }
};

const getSubscriptionPlan = async (id) => api.get(`/platform-settings/plans/${id}`);

const createSubscriptionPlan = async (payload) =>
  api.post('/platform-settings/plans', payload);

const updateSubscriptionPlan = async (id, payload) =>
  api.put(`/platform-settings/plans/${id}`, payload);

const deleteSubscriptionPlan = async (id) =>
  api.delete(`/platform-settings/plans/${id}`);

const reorderSubscriptionPlans = async (planOrders) =>
  api.put('/platform-settings/plans/bulk/reorder', { planOrders });

const syncPaystackPlans = async () => api.post('/platform-settings/plans/sync-paystack');

const getFeatureCatalog = async () => api.get('/platform-settings/features');
const getFeatureMatrix = async () => api.get('/platform-settings/feature-matrix');
const updateFeatureMatrix = async (matrix) => api.put('/platform-settings/feature-matrix', { matrix });

const getModules = async () => api.get('/platform-settings/modules');

// Admin Leads
const getAdminLeads = async (params = {}) => api.get('/admin/leads', { params });
const getAdminLead = async (id) => api.get(`/admin/leads/${id}`);
const createAdminLead = async (data) => api.post('/admin/leads', data);
const updateAdminLead = async (id, data) => api.put(`/admin/leads/${id}`, data);
const deleteAdminLead = async (id) => api.delete(`/admin/leads/${id}`);
const addAdminLeadActivity = async (id, data) => api.post(`/admin/leads/${id}/activities`, data);
const getAdminLeadStats = async () => api.get('/admin/leads/stats');
const convertAdminLeadToJob = async (id, jobData) => api.post(`/admin/leads/${id}/convert-to-job`, jobData);

// Admin Jobs
const getAdminJobs = async (params = {}) => api.get('/admin/jobs', { params });
const getAdminJob = async (id) => api.get(`/admin/jobs/${id}`);
const createAdminJob = async (data) => api.post('/admin/jobs', data);
const updateAdminJob = async (id, data) => api.put(`/admin/jobs/${id}`, data);
const assignAdminJob = async (id, userId) => api.patch(`/admin/jobs/${id}/assign`, { assignedTo: userId });
const deleteAdminJob = async (id) => api.delete(`/admin/jobs/${id}`);
const getAdminJobStats = async () => api.get('/admin/jobs/stats');

// Admin Expenses (platform/internal; categories are admin-specific)
const getAdminExpenseCategories = async () => {
  const res = await api.get('/admin/expenses/categories');
  const data = res?.data;
  return Array.isArray(data) ? data : [];
};
const getAdminExpenses = async (params = {}) => api.get('/admin/expenses', { params });
const getAdminExpense = async (id) => api.get(`/admin/expenses/${id}`);
const getAdminExpenseStats = async (params = {}) => api.get('/admin/expenses/stats', { params });
const createAdminExpense = async (data) => api.post('/admin/expenses', data);
const getTenantVendors = async (tenantId) => api.get(`/admin/tenants/${tenantId}/vendors`);
const getTenantJobs = async (tenantId) => api.get(`/admin/tenants/${tenantId}/jobs`);

// Admin Customers (platform's own customers)
const getAdminCustomers = async (params = {}) => api.get('/admin/customers', { params });
const getAdminCustomer = async (id) => api.get(`/admin/customers/${id}`);
const createAdminCustomer = async (data) => api.post('/admin/customers', data);
const updateAdminCustomer = async (id, data) => api.put(`/admin/customers/${id}`, data);
const deleteAdminCustomer = async (id) => api.delete(`/admin/customers/${id}`);

// Platform Admin Roles
const getPlatformAdminRoles = async () => api.get('/platform-admin/roles');
const getPlatformAdminRole = async (id) => api.get(`/platform-admin/roles/${id}`);
const createPlatformAdminRole = async (data) => api.post('/platform-admin/roles', data);
const updatePlatformAdminRole = async (id, data) => api.put(`/platform-admin/roles/${id}`, data);
const deletePlatformAdminRole = async (id) => api.delete(`/platform-admin/roles/${id}`);
const assignPermissionsToRole = async (roleId, permissionIds) => api.post(`/platform-admin/roles/${roleId}/permissions`, { permissionIds });
const getPlatformAdminPermissions = async () => api.get('/platform-admin/permissions');
const getUserRoles = async (userId) => api.get(`/platform-admin/users/${userId}/roles`);
const assignRoleToUser = async (userId, roleId) => api.post(`/platform-admin/users/${userId}/roles`, { roleId });
const removeRoleFromUser = async (userId, roleId) => api.delete(`/platform-admin/users/${userId}/roles/${roleId}`);
const getUserPermissions = async (userId) => api.get(`/platform-admin/users/${userId}/permissions`);

export default {
  getSummary,
  getTenants,
  inviteTenant,
  getTenantMetrics,
  getAlerts,
  getTenantDetail,
  getTenantAccessAudit,
  updateTenantStatus,
  updateTenantAccess,
  updateTenantBranding,
  getBillingSummary,
  getBillingTenants,
  getPlatformSettings,
  updatePlatformSettings,
  getSystemHealth,
  getPlatformAdmins,
  getPlatformAdminInviteRoles,
  invitePlatformAdmin,
  getPlatformAdminInvites,
  revokePlatformAdminInvite,
  createPlatformAdmin,
  updatePlatformAdmin,
  getReportKpis,
  getReportRevenue,
  getReportExpenses,
  getReportPipeline,
  getReportTopCustomers,
  getSubscriptionPlans,
  getSubscriptionPlan,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  reorderSubscriptionPlans,
  syncPaystackPlans,
  getFeatureCatalog,
  getFeatureMatrix,
  updateFeatureMatrix,
  getModules,
  // Admin Leads
  getAdminLeads,
  getAdminLead,
  createAdminLead,
  updateAdminLead,
  deleteAdminLead,
  addAdminLeadActivity,
  getAdminLeadStats,
  convertAdminLeadToJob,
  // Admin Jobs
  getAdminJobs,
  getAdminJob,
  createAdminJob,
  updateAdminJob,
  assignAdminJob,
  deleteAdminJob,
  getAdminJobStats,
  // Admin Expenses
  getAdminExpenseCategories,
  getAdminExpenses,
  getAdminExpense,
  getAdminExpenseStats,
  createAdminExpense,
  getTenantVendors,
  getTenantJobs,
  getAdminCustomers,
  getAdminCustomer,
  createAdminCustomer,
  updateAdminCustomer,
  deleteAdminCustomer,
  // Platform Admin Roles
  getPlatformAdminRoles,
  getPlatformAdminRole,
  createPlatformAdminRole,
  updatePlatformAdminRole,
  deletePlatformAdminRole,
  assignPermissionsToRole,
  getPlatformAdminPermissions,
  getUserRoles,
  assignRoleToUser,
  removeRoleFromUser,
  getUserPermissions,
};

