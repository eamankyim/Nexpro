const express = require('express');
const { protect } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const {
  getTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  getWeekFocus,
  updateWeekFocus,
  getTasks,
  getTaskById,
  getTaskComments,
  getTaskActivity,
  addTaskComment,
  getTaskMembers,
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
} = require('../controllers/userWorkspaceController');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router.route('/todos').get(getTodos).post(createTodo);
router.route('/todos/:id').put(updateTodo).delete(deleteTodo);
router.get('/week-focus', getWeekFocus);
router.put('/week-focus', updateWeekFocus);

router.route('/tasks').get(getTasks).post(createTask);
router.get('/task-members', getTaskMembers);
router.route('/tasks/:id').put(updateTask).delete(deleteTask);
router.get('/tasks/:id/detail', getTaskById);
router.get('/tasks/:id/comments', getTaskComments);
router.get('/tasks/:id/activity', getTaskActivity);
router.post('/tasks/:id/comments', addTaskComment);

router.route('/checklists').get(getChecklists).post(createChecklist);
router
  .route('/checklists/:id')
  .put(updateChecklist)
  .delete(deleteChecklist);

router
  .route('/checklists/:checklistId/items')
  .post(createChecklistItem);

router
  .route('/checklists/:checklistId/items/:itemId')
  .put(updateChecklistItem)
  .delete(deleteChecklistItem);

module.exports = router;
