import api from './api';

const getSettings = () => api.get('/partner-program/settings');
const updateSettings = (payload) => api.put('/partner-program/settings', payload);
const getCatalog = () => api.get('/partner-program/catalog');
const listApplications = (params) => api.get('/partner-program/applications', { params });
const approveApplication = (id) => api.post(`/partner-program/applications/${id}/approve`);
const declineApplication = (id, payload) =>
  api.post(`/partner-program/applications/${id}/decline`, payload || {});
const listPartnerships = (params) => api.get('/partner-program/partnerships', { params });
const revokePartnership = (id) => api.post(`/partner-program/partnerships/${id}/revoke`);
const listCommissions = (params) => api.get('/partner-program/commissions', { params });
const markCommissionsPaid = (payload) => api.post('/partner-program/commissions/mark-paid', payload);

const partnerProgramService = {
  getSettings,
  updateSettings,
  getCatalog,
  listApplications,
  approveApplication,
  declineApplication,
  listPartnerships,
  revokePartnership,
  listCommissions,
  markCommissionsPaid,
};

export default partnerProgramService;
