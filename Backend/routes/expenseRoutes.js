const express = require('express');
const {
  getExpenses,
  getExpense,
  createExpense,
  createBulkExpenses,
  updateExpense,
  deleteExpense,
  getExpenseStats,
  getExpensesByJob,
  submitExpense,
  approveExpense,
  rejectExpense
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
  .put(authorize('admin', 'manager', 'staff'), updateExpense)
  .delete(authorize('admin', 'manager', 'staff'), deleteExpense);

// Approval workflow routes
// Only non-admins can submit expenses for approval
router.post('/:id/submit', authorize('manager', 'staff'), submitExpense);
// Only admins can approve/reject expenses
router.post('/:id/approve', authorize('admin'), approveExpense);
router.post('/:id/reject', authorize('admin'), rejectExpense);

module.exports = router;


