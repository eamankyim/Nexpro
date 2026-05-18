import api from './api';

/**
 * List customer reviews (same records as public feedback form) for the active tenant (authenticated).
 * @param {{ page?: number, limit?: number }} params
 */
const getCustomerFeedback = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.page != null) query.set('page', String(params.page));
  if (params.limit != null) query.set('limit', String(params.limit));
  const qs = query.toString();
  return api.get(`/feedback${qs ? `?${qs}` : ''}`);
};

export default {
  getCustomerFeedback,
};
