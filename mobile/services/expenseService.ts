import { api } from './api';
import { buildScopedQueryString, withActiveShopScope } from '@/utils/shopScope';

type ExpenseParams = {
  page?: number;
  limit?: number;
  categoryId?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  shopId?: string;
};

type ExpenseCategoriesResponse = {
  data: string[];
  custom: string[];
};

type CreateExpensePayload = {
  description?: string;
  amount: number;
  category?: string;
  expenseDate: string;
  paymentMethod?: string;
  receiptUrl?: string;
  notes?: string;
  shopId?: string;
};

export const expenseService = {
  getExpenses: async (params: ExpenseParams = {}) => {
    const query = await buildScopedQueryString(params);
    const res = await api.get(query ? `/expenses?${query}` : '/expenses');
    return res.data;
  },

  getStats: async (params: ExpenseParams = {}) => {
    const query = await buildScopedQueryString(params);
    const res = await api.get(query ? `/expenses/stats/overview?${query}` : '/expenses/stats/overview');
    return res.data;
  },

  getExpenseById: async (id: string) => {
    const res = await api.get(`/expenses/${id}`);
    return res.data;
  },

  createExpense: async (data: CreateExpensePayload) => {
    const scoped = await withActiveShopScope(data);
    const res = await api.post('/expenses', scoped);
    return res.data;
  },

  uploadReceipt: async (uri: string, name = 'receipt.jpg', mimeType = 'image/jpeg') => {
    const formData = new FormData();
    formData.append('file', {
      uri,
      name,
      type: mimeType,
    } as unknown as Blob);

    const res = await api.post('/expenses/upload-receipt', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    const body = res.data as { receiptUrl?: string; url?: string; data?: { receiptUrl?: string; url?: string } };
    const receiptUrl = body?.receiptUrl ?? body?.url ?? body?.data?.receiptUrl ?? body?.data?.url;
    if (!receiptUrl) {
      throw new Error('Upload succeeded but no receipt URL was returned');
    }
    return receiptUrl;
  },

  updateExpense: async (id: string, data: object) => {
    const res = await api.put(`/expenses/${id}`, data);
    return res.data;
  },

  /** Archive expense (soft delete). Backend does not support hard delete. */
  archive: async (id: string) => {
    const res = await api.put(`/expenses/${id}/archive`);
    return res.data;
  },

  /** Get business-type-specific expense categories from backend */
  getCategories: async (): Promise<ExpenseCategoriesResponse> => {
    const res = await api.get('/expenses/categories');
    const body = res.data;
    return {
      data: Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [],
      custom: Array.isArray(body?.custom) ? body.custom : [],
    };
  },
};
