import { api } from './api';

type InvoiceParams = {
  page?: number;
  limit?: number;
  status?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
};

export const invoiceService = {
  getInvoices: async (params: InvoiceParams = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, String(value));
    });
    const query = searchParams.toString();
    const res = await api.get(query ? `/invoices?${query}` : '/invoices');
    return res.data;
  },

  getInvoiceById: async (id: string) => {
    const res = await api.get(`/invoices/${id}`);
    return res.data;
  },

  createInvoice: async (data: object) => {
    const res = await api.post('/invoices', data);
    return res.data;
  },

  updateInvoice: async (id: string, data: object) => {
    const res = await api.put(`/invoices/${id}`, data);
    return res.data;
  },
};
