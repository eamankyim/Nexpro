import api from './api';

const getSummary = async () => {
  return api.get('/notifications/summary');
};

const getNotifications = async (params = {}) => {
  return api.get('/notifications', { params });
};

const markRead = async (id) => {
  if (!id) {
    throw new Error('Notification id is required to mark as read');
  }
  return api.put(`/notifications/${id}/read`);
};

const markAllRead = async () => {
  return api.post('/notifications/mark-all-read');
};

export default {
  getSummary,
  getNotifications,
  markRead,
  markAllRead
};


