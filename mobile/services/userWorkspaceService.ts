import { api } from './api';

export const userWorkspaceService = {
  getTasks: async (params: Record<string, string> = {}) => {
    const res = await api.get('/user-workspace/tasks', { params });
    return res.data;
  },

  getTaskMembers: async () => {
    const res = await api.get('/user-workspace/task-members');
    return res.data;
  },

  createTask: async (payload: Record<string, unknown>) => {
    const res = await api.post('/user-workspace/tasks', payload);
    return res.data;
  },

  updateTask: async (id: string, payload: Record<string, unknown>) => {
    const res = await api.put(`/user-workspace/tasks/${id}`, payload);
    return res.data;
  },

  deleteTask: async (id: string) => {
    const res = await api.delete(`/user-workspace/tasks/${id}`);
    return res.data;
  },

  getTaskDetail: async (id: string) => {
    const res = await api.get(`/user-workspace/tasks/${id}/detail`);
    return res.data;
  },

  getTaskComments: async (id: string) => {
    const res = await api.get(`/user-workspace/tasks/${id}/comments`);
    return res.data;
  },

  addTaskComment: async (id: string, payload: { text: string }) => {
    const res = await api.post(`/user-workspace/tasks/${id}/comments`, payload);
    return res.data;
  },
};
