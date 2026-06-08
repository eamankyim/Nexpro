import api from './api';

const getTodos = (params = {}) => api.get('/user-workspace/todos', { params });
const createTodo = (payload) => api.post('/user-workspace/todos', payload);
const updateTodo = (id, payload) => api.put(`/user-workspace/todos/${id}`, payload);
const deleteTodo = (id) => api.delete(`/user-workspace/todos/${id}`);

const getWeekFocus = (weekStart) =>
  api.get('/user-workspace/week-focus', weekStart ? { params: { weekStart } } : {});

const updateWeekFocus = (payload) => api.put('/user-workspace/week-focus', payload);

const getTasks = (params = {}) => api.get('/user-workspace/tasks', { params });
const getTaskMembers = () => api.get('/user-workspace/task-members');
const createTask = (payload, params = {}) => api.post('/user-workspace/tasks', payload, { params });
const updateTask = (id, payload, params = {}) => api.put(`/user-workspace/tasks/${id}`, payload, { params });
const deleteTask = (id, params = {}) => api.delete(`/user-workspace/tasks/${id}`, { params });
const getTaskDetail = (id, params = {}) => api.get(`/user-workspace/tasks/${id}/detail`, { params });
const getTaskComments = (id, params = {}) => api.get(`/user-workspace/tasks/${id}/comments`, { params });
const getTaskActivity = (id, params = {}) => api.get(`/user-workspace/tasks/${id}/activity`, { params });
const addTaskComment = (id, payload, params = {}) => api.post(`/user-workspace/tasks/${id}/comments`, payload, { params });

const getChecklists = () => api.get('/user-workspace/checklists');
const createChecklist = (payload) => api.post('/user-workspace/checklists', payload);
const updateChecklist = (id, payload) => api.put(`/user-workspace/checklists/${id}`, payload);
const deleteChecklist = (id) => api.delete(`/user-workspace/checklists/${id}`);

const createChecklistItem = (checklistId, payload) =>
  api.post(`/user-workspace/checklists/${checklistId}/items`, payload);

const updateChecklistItem = (checklistId, itemId, payload) =>
  api.put(`/user-workspace/checklists/${checklistId}/items/${itemId}`, payload);

const deleteChecklistItem = (checklistId, itemId) =>
  api.delete(`/user-workspace/checklists/${checklistId}/items/${itemId}`);

export default {
  getTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  getWeekFocus,
  updateWeekFocus,
  getTasks,
  getTaskMembers,
  createTask,
  updateTask,
  deleteTask,
  getTaskDetail,
  getTaskComments,
  getTaskActivity,
  addTaskComment,
  getChecklists,
  createChecklist,
  updateChecklist,
  deleteChecklist,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem
};
