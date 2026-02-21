const express = require('express');
const {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getJournalEntries,
  getJournalEntry,
  createJournalEntry,
  postJournalEntry,
  deleteJournalEntry,
  getTrialBalance,
  getAccountSummary
} = require('../controllers/accountingController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router
  .route('/accounts')
  .get(getAccounts)
  .post(authorize('admin', 'manager'), createAccount);

router
  .route('/accounts/:id')
  .put(authorize('admin', 'manager'), updateAccount)
  .delete(authorize('admin', 'manager'), deleteAccount);

router
  .route('/journal')
  .get(getJournalEntries)
  .post(authorize('admin', 'manager'), createJournalEntry);

router
  .route('/journal/:id')
  .get(getJournalEntry)
  .delete(authorize('admin', 'manager'), deleteJournalEntry);

router.patch('/journal/:id/post', authorize('admin', 'manager'), postJournalEntry);

router.get('/trial-balance', getTrialBalance);
router.get('/accounts/summary', getAccountSummary);

module.exports = router;



