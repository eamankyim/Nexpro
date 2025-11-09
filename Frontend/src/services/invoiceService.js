import api from './api';

const invoiceService = {
  // Get all invoices
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return await api.get(`/invoices?${queryString}`);
  },

  // Get single invoice
  getById: async (id) => {
    return await api.get(`/invoices/${id}`);
  },

  // Create invoice from job
  create: async (invoiceData) => {
    return await api.post('/invoices', invoiceData);
  },

  // Update invoice
  update: async (id, invoiceData) => {
    return await api.put(`/invoices/${id}`, invoiceData);
  },

  // Delete invoice
  delete: async (id) => {
    return await api.delete(`/invoices/${id}`);
  },

  // Record payment on invoice
  recordPayment: async (id, paymentData) => {
    return await api.post(`/invoices/${id}/payment`, paymentData);
  },

  // Send invoice to customer
  send: async (id) => {
    return await api.post(`/invoices/${id}/send`);
  },

  // Cancel invoice
  cancel: async (id) => {
    return await api.post(`/invoices/${id}/cancel`);
  },

  // Mark invoice as fully paid
  markAsPaid: async (id) => {
    return await api.post(`/invoices/${id}/mark-paid`);
  },

  // Get invoice statistics
  getStats: async () => {
    return await api.get('/invoices/stats/summary');
  }
};

export default invoiceService;







