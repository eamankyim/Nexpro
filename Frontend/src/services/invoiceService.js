import api from './api';
import { buildScopedQueryString } from '../utils/shopScope';

const invoiceService = {
  getAll: async (params = {}) => {
    const queryString = buildScopedQueryString(params);
    return await api.get(queryString ? `/invoices?${queryString}` : '/invoices');
  },

  getById: async (id) => {
    return await api.get(`/invoices/${id}`);
  },

  create: async (invoiceData) => {
    return await api.post('/invoices', invoiceData);
  },

  update: async (id, invoiceData) => {
    return await api.put(`/invoices/${id}`, invoiceData);
  },

  delete: async (id) => {
    return await api.delete(`/invoices/${id}`);
  },

  deleteCancelled: async (id) => {
    return await api.delete(`/invoices/${id}/cancelled`);
  },

  recordPayment: async (id, paymentData) => {
    return await api.post(`/invoices/${id}/payment`, paymentData);
  },

  send: async (id) => {
    return await api.post(`/invoices/${id}/send`);
  },

  cancel: async (id) => {
    return await api.post(`/invoices/${id}/cancel`);
  },

  markPaid: async (id) => {
    return await api.post(`/invoices/${id}/mark-paid`);
  },

  markAsPaid: async (id) => {
    return await api.post(`/invoices/${id}/mark-paid`);
  },

  getStats: async (params = {}) => {
    const queryString = buildScopedQueryString(params);
    return await api.get(queryString ? `/invoices/stats/summary?${queryString}` : '/invoices/stats/summary');
  },

  exportInvoices: async (params = {}) => {
    const queryString = buildScopedQueryString(params);
    return await api.get(queryString ? `/invoices/export?${queryString}` : '/invoices/export', {
      responseType: 'blob',
    });
  },
};

export default invoiceService;
