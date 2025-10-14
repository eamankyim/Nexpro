const express = require('express');
const {
  getExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseStats
} = require('../controllers/expenseController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/stats/overview', getExpenseStats);

router.route('/')
  .get(getExpenses)
  .post(authorize('admin', 'manager'), createExpense);

router.route('/:id')
  .get(getExpense)
  .put(authorize('admin', 'manager'), updateExpense)
  .delete(authorize('admin'), deleteExpense);

module.exports = router;


