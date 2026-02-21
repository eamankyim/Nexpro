import api from './api';

const getTodos = (params = {}) => api.get('/user-workspace/todos', { params });
const createTodo = (payload) => api.post('/user-workspace/todos', payload);
const updateTodo = (id, payload) => api.put(`/user-workspace/todos/${id}`, payload);
const deleteTodo = (id) => api.delete(`/user-workspace/todos/${id}`);

const getWeekFocus = (weekStart) =>
  api.get('/user-workspace/week-focus', weekStart ? { params: { weekStart } } : {});

const updateWeekFocus = (payload) => api.put('/user-workspace/week-focus', payload);

const getTasks = (params = {}) => api.get('/user-workspace/tasks', { params });
const createTask = (payload) => api.post('/user-workspace/tasks', payload);
const updateTask = (id, payload) => api.put(`/user-workspace/tasks/${id}`, payload);
const deleteTask = (id) => api.delete(`/user-workspace/tasks/${id}`);

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
  createTask,
  updateTask,
  deleteTask,
  getChecklists,
  createChecklist,
  updateChecklist,
  deleteChecklist,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem
};
