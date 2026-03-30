const express = require('express');
const {
  getExpenses,
  getExpense,
  getExpenseCategories,
  addCustomExpenseCategory,
  removeCustomExpenseCategory,
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
  addExpenseActivity,
  uploadExpenseReceipt,
  exportExpenses
} = require('../controllers/expenseController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { expenseReceiptUploader, checkStorageLimit } = require('../middleware/upload');
const { exportLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router.get('/categories', getExpenseCategories);
router.post('/categories', authorize('admin', 'manager', 'staff'), addCustomExpenseCategory);
router.delete('/categories', authorize('admin', 'manager', 'staff'), removeCustomExpenseCategory);
router.get('/stats/overview', getExpenseStats);
router.get('/by-job/:jobId', getExpensesByJob);

router.route('/')
  .get(getExpenses)
  .post(authorize('admin', 'manager', 'staff'), createExpense);

router.get('/export', exportLimiter, authorize('admin', 'manager'), exportExpenses);

router.post('/bulk', authorize('admin', 'manager', 'staff'), createBulkExpenses);

router.post(
  '/upload-receipt',
  authorize('admin', 'manager', 'staff'),
  checkStorageLimit,
  expenseReceiptUploader.single('file'),
  uploadExpenseReceipt
);

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


