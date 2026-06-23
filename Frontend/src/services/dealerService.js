import api from './api';
import { buildScopedQueryString } from '../utils/shopScope';

const buildQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.append(key, String(value));
  });
  return searchParams.toString();
};

const dealerService = {
  getAll: async (params = {}) => {
    const queryString = buildQueryString(params);
    return api.get(queryString ? `/dealers?${queryString}` : '/dealers');
  },

  getStats: async () => {
    const res = await api.get('/dealers/stats');
    return res?.data || res;
  },

  getById: async (id) => api.get(`/dealers/${id}`),

  create: async (data) => api.post('/dealers', data),

  update: async (id, data) => api.put(`/dealers/${id}`, data),

  patch: async (id, data) => api.patch(`/dealers/${id}`, data),

  posSearch: async (params = {}) => {
    const queryString = buildQueryString(params);
    return api.get(queryString ? `/dealers/pos-search?${queryString}` : '/dealers/pos-search');
  },

  getLedger: async (id, params = {}) => {
    const queryString = buildQueryString(params);
    return api.get(queryString ? `/dealers/${id}/ledger?${queryString}` : `/dealers/${id}/ledger`);
  },

  recordPayment: async (id, data) => api.post(`/dealers/${id}/payments`, data),

  createAdjustment: async (id, data) => api.post(`/dealers/${id}/ledger/adjustment`, data),

  getStatement: async (id, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(qs ? `/dealers/${id}/statement?${qs}` : `/dealers/${id}/statement`);
  },

  getOutstandingReport: async () => api.get('/dealers/report/outstanding'),

  getPrices: async (id, params = {}) => {
    const queryString = buildScopedQueryString(params);
    return api.get(queryString ? `/dealers/${id}/prices?${queryString}` : `/dealers/${id}/prices`);
  },

  upsertPrices: async (id, data) => api.put(`/dealers/${id}/prices`, data),

  resolvePrice: async (id, params = {}) => {
    const queryString = buildScopedQueryString(params);
    return api.get(queryString ? `/dealers/${id}/prices/resolve?${queryString}` : `/dealers/${id}/prices/resolve`);
  },

  resolvePricesBatch: async (id, data) => api.post(`/dealers/${id}/prices/resolve-batch`, data),

  creditCheck: async (id, data) => api.post(`/dealers/${id}/credit-check`, data),

  getPriceTiers: async () => api.get('/dealers/price-tiers'),

  createPriceTier: async (data) => api.post('/dealers/price-tiers', data),

  updatePriceTier: async (tierId, data) => api.put(`/dealers/price-tiers/${tierId}`, data),
};

export default dealerService;
