import { api } from './api';

type ExpenseParams = {
  page?: number;
  limit?: number;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
};

export const expenseService = {
  getExpenses: async (params: ExpenseParams = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, String(value));
    });
    const query = searchParams.toString();
    const res = await api.get(query ? `/expenses?${query}` : '/expenses');
    return res.data;
  },

  getExpenseById: async (id: string) => {
    const res = await api.get(`/expenses/${id}`);
    return res.data;
  },

  createExpense: async (data: object) => {
    const res = await api.post('/expenses', data);
    return res.data;
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
  getCategories: async () => {
    const res = await api.get('/expenses/categories');
    const data = res.data?.data ?? res.data;
    return Array.isArray(data) ? data : [];
  },
};
