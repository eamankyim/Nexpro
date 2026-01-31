const express = require('express');
const {
  getExpenses,
  getExpense,
  createExpense,
  createBulkExpenses,
  updateExpense,
  archiveExpense,
  getExpenseStats,
  getExpensesByJob,
  submitExpense,
  approveExpense,
  rejectExpense,
  getExpenseActivities,
  addExpenseActivity
} = require('../controllers/expenseController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router.get('/stats/overview', getExpenseStats);
router.get('/by-job/:jobId', getExpensesByJob);

router.route('/')
  .get(getExpenses)
  .post(authorize('admin', 'manager', 'staff'), createExpense);

router.post('/bulk', authorize('admin', 'manager', 'staff'), createBulkExpenses);

router.route('/:id')
  .get(getExpense)
  .put(authorize('admin', 'manager', 'staff'), updateExpense);

router.put('/:id/archive', authorize('admin', 'manager', 'staff'), archiveExpense);

// Approval workflow routes
// Only non-admins can submit expenses for approval
router.post('/:id/submit', authorize('manager', 'staff'), submitExpense);
// Only admins can approve/reject expenses
router.post('/:id/approve', authorize('admin'), approveExpense);
router.post('/:id/reject', authorize('admin'), rejectExpense);

// Activity routes
router.get('/:id/activities', getExpenseActivities);
router.post('/:id/activities', authorize('admin', 'manager', 'staff'), addExpenseActivity);

module.exports = router;


