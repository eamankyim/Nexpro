const express = require('express');
const {
  getAccounts,
  createAccount,
  updateAccount,
  getJournalEntries,
  createJournalEntry,
  getTrialBalance,
  getAccountSummary
} = require('../controllers/accountingController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

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

router.get('/trial-balance', getTrialBalance);
router.get('/accounts/summary', getAccountSummary);

module.exports = router;


