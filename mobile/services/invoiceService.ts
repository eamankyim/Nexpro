import { api } from './api';
import { buildScopedQueryString } from '@/utils/shopScope';

type InvoiceParams = {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
};

export const invoiceService = {
  getInvoices: async (params: InvoiceParams = {}) => {
    const query = await buildScopedQueryString(params);
    const res = await api.get(query ? `/invoices?${query}` : '/invoices');
    return res.data;
  },

  getInvoiceById: async (id: string) => {
    const res = await api.get(`/invoices/${id}`);
    return res.data;
  },

  createInvoice: async (data: object) => {
    const query = await buildScopedQueryString({});
    const res = await api.post(query ? `/invoices?${query}` : '/invoices', data);
    return res.data;
  },

  updateInvoice: async (id: string, data: object) => {
    const query = await buildScopedQueryString({});
    const res = await api.put(query ? `/invoices/${id}?${query}` : `/invoices/${id}`, data);
    return res.data;
  },

  recordPayment: async (id: string, paymentData: object) => {
    const res = await api.post(`/invoices/${id}/payment`, paymentData);
    return res.data;
  },

  send: async (id: string) => {
    const res = await api.post(`/invoices/${id}/send`);
    return res.data;
  },

  cancel: async (id: string) => {
    const res = await api.post(`/invoices/${id}/cancel`);
    return res.data;
  },

  markAsPaid: async (id: string) => {
    const res = await api.post(`/invoices/${id}/mark-paid`);
    return res.data;
  },
};
