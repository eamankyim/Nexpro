import { api } from './api';

type NotificationParams = {
  page?: number;
  limit?: number;
  unread?: boolean;
};

export const notificationService = {
  getSummary: async () => {
    const res = await api.get('/notifications/summary');
    // Backend returns: { success: true, data: {...} }
    return res.data;
  },

  getNotifications: async (params: NotificationParams = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (typeof value === 'string' && value === '') return;
      searchParams.append(key, String(value));
    });
    const query = searchParams.toString();
    const res = await api.get(query ? `/notifications?${query}` : '/notifications');
    // Backend returns: { success: true, count: N, pagination: {...}, data: [...] }
    return res.data;
  },

  markRead: async (id: string) => {
    const res = await api.put(`/notifications/${id}/read`);
    // Backend returns: { success: true, data: {...} }
    return res.data;
  },

  markAllRead: async () => {
    const res = await api.post('/notifications/mark-all-read');
    // Backend returns: { success: true, message: '...' }
    return res.data;
  },
};
