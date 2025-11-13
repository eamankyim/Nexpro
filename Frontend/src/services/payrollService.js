import api from './api';

const getRuns = async (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      query.append(key, value);
    }
  });
  const queryString = query.toString();
  return api.get(queryString ? `/payroll/runs?${queryString}` : '/payroll/runs');
};

const getRun = async (id) => api.get(`/payroll/runs/${id}`);

const createRun = async (payload) => api.post('/payroll/runs', payload);

const postRun = async (id) => api.post(`/payroll/runs/${id}/post`);

export default {
  getRuns,
  getRun,
  createRun,
  postRun
};





