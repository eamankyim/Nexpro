import api from './api';

const getEmployees = async (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === 'all') {
      return;
    }
    query.append(key, value);
  });
  const queryString = query.toString();
  return api.get(queryString ? `/employees?${queryString}` : '/employees');
};

const getEmployee = async (id) => api.get(`/employees/${id}`);

const createEmployee = async (payload) => api.post('/employees', payload);

const updateEmployee = async (id, payload) => api.put(`/employees/${id}`, payload);

const archiveEmployee = async (id, payload = {}) => api.delete(`/employees/${id}`, { data: payload });

const uploadDocument = async (id, file, payload = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  });
  return api.post(`/employees/${id}/documents`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
};

const deleteDocument = async (id, documentId) => api.delete(`/employees/${id}/documents/${documentId}`);

const addHistory = async (id, payload) => api.post(`/employees/${id}/history`, payload);

export default {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  archiveEmployee,
  uploadDocument,
  deleteDocument,
  addHistory
};


