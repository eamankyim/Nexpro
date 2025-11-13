const express = require('express');
const {
  getExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseStats,
  getExpensesByJob
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

router.route('/:id')
  .get(getExpense)
  .put(authorize('admin', 'manager', 'staff'), updateExpense)
  .delete(authorize('admin', 'manager', 'staff'), deleteExpense);

module.exports = router;


