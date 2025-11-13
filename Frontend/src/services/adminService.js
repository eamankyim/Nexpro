import api from './api';

const getSummary = async () => api.get('/admin/summary');

const getTenants = async (params = {}) => api.get('/admin/tenants', { params });

const getTenantMetrics = async () => api.get('/admin/metrics/tenants');

const getAlerts = async () => api.get('/admin/alerts');

const getTenantDetail = async (tenantId) => api.get(`/admin/tenants/${tenantId}`);

const updateTenantStatus = async (tenantId, action) =>
  api.patch(`/admin/tenants/${tenantId}/status`, { action });

const updateTenantBranding = async (tenantId, payload) =>
  api.patch(`/admin/tenants/${tenantId}/branding`, payload);

const getBillingSummary = async () => api.get('/admin/billing/summary');

const getBillingTenants = async () => api.get('/admin/billing/tenants');

const getPlatformSettings = async () => api.get('/platform-settings');

const updatePlatformSettings = async (payload) =>
  api.put('/platform-settings', payload);

const getSystemHealth = async () => api.get('/admin/health');

const getPlatformAdmins = async () => api.get('/platform-admins');

const createPlatformAdmin = async (payload) =>
  api.post('/platform-admins', payload);

const updatePlatformAdmin = async (adminId, payload) =>
  api.put(`/platform-admins/${adminId}`, payload);

const getReportKpis = async (params = {}) => api.get('/reports/kpi-summary', { params });

const getReportRevenue = async (params = {}) => api.get('/reports/revenue', { params });

const getReportExpenses = async (params = {}) => api.get('/reports/expenses', { params });

const getReportPipeline = async () => api.get('/reports/pipeline-summary');

const getReportTopCustomers = async (params = {}) =>
  api.get('/reports/top-customers', { params });

const getSubscriptionPlans = async () => api.get('/platform-settings/plans');

const getSubscriptionPlan = async (id) => api.get(`/platform-settings/plans/${id}`);

const createSubscriptionPlan = async (payload) =>
  api.post('/platform-settings/plans', payload);

const updateSubscriptionPlan = async (id, payload) =>
  api.put(`/platform-settings/plans/${id}`, payload);

const deleteSubscriptionPlan = async (id) =>
  api.delete(`/platform-settings/plans/${id}`);

const reorderSubscriptionPlans = async (planOrders) =>
  api.put('/platform-settings/plans/bulk/reorder', { planOrders });

const getFeatureCatalog = async () => api.get('/platform-settings/features');

const getModules = async () => api.get('/platform-settings/modules');

export default {
  getSummary,
  getTenants,
  getTenantMetrics,
  getAlerts,
  getTenantDetail,
  updateTenantStatus,
  updateTenantBranding,
  getBillingSummary,
  getBillingTenants,
  getPlatformSettings,
  updatePlatformSettings,
  getSystemHealth,
  getPlatformAdmins,
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
  getFeatureCatalog,
  getModules,
};

