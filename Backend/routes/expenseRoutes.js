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
const { shopContext } = require('../middleware/shopContext');
const { studioLocationContext } = require('../middleware/studioLocationContext');
const { expenseReceiptUploader, checkStorageLimit } = require('../middleware/upload');
const { exportLimiter } = require('../middleware/rateLimiter');
const { timeCrudAction } = require('../middleware/crudTiming');
const { cacheMiddleware, generateExpenseStatsKey } = require('../middleware/cache');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(shopContext);
router.use(studioLocationContext);
router.use((req, res, next) => {
  // Expense lists must reflect writes immediately; avoid browser 304s after create/update/archive.
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/categories', getExpenseCategories);
router.post('/categories', authorize('admin', 'manager', 'staff'), timeCrudAction('expenses.categories.create'), addCustomExpenseCategory);
router.delete('/categories', authorize('admin', 'manager', 'staff'), timeCrudAction('expenses.categories.delete'), removeCustomExpenseCategory);
router.get('/stats/overview', cacheMiddleware(30, generateExpenseStatsKey), getExpenseStats);
router.get('/by-job/:jobId', getExpensesByJob);

router.route('/')
  .get(timeCrudAction('expenses.list'), getExpenses)
  .post(authorize('admin', 'manager', 'staff'), timeCrudAction('expenses.create'), createExpense);

router.get('/export', exportLimiter, authorize('admin', 'manager'), exportExpenses);

router.post('/bulk', authorize('admin', 'manager', 'staff'), timeCrudAction('expenses.bulk_create'), createBulkExpenses);

router.post(
  '/upload-receipt',
  authorize('admin', 'manager', 'staff'),
  checkStorageLimit,
  expenseReceiptUploader.single('file'),
  uploadExpenseReceipt
);

router.route('/:id')
  .get(timeCrudAction('expenses.read'), getExpense)
  .put(authorize('admin', 'manager', 'staff'), timeCrudAction('expenses.update'), updateExpense);

router.put('/:id/archive', authorize('admin', 'manager', 'staff'), timeCrudAction('expenses.archive'), archiveExpense);

// Approval workflow routes
// Only non-admins can submit expenses for approval
router.post('/:id/submit', authorize('manager', 'staff'), timeCrudAction('expenses.submit'), submitExpense);
// Only admins can approve/reject expenses
router.post('/:id/approve', authorize('admin'), timeCrudAction('expenses.approve'), approveExpense);
router.post('/:id/reject', authorize('admin'), timeCrudAction('expenses.reject'), rejectExpense);

// Activity routes
router.get('/:id/activities', getExpenseActivities);
router.post('/:id/activities', authorize('admin', 'manager', 'staff'), addExpenseActivity);

module.exports = router;


