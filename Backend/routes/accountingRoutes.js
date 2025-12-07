const express = require('express');
const {
  getAccounts,
  createAccount,
  updateAccount,
  getJournalEntries,
  getJournalEntry,
  createJournalEntry,
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
  .put(authorize('admin', 'manager'), updateAccount);

router
  .route('/journal')
  .get(getJournalEntries)
  .post(authorize('admin', 'manager'), createJournalEntry);

router
  .route('/journal/:id')
  .get(getJournalEntry);

router.get('/trial-balance', getTrialBalance);
router.get('/accounts/summary', getAccountSummary);

module.exports = router;



