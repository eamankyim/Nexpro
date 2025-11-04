const express = require('express');
const {
  getRevenueReport,
  getExpenseReport,
  getOutstandingPaymentsReport,
  getSalesReport,
  getProfitLossReport
} = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/revenue', getRevenueReport);
router.get('/expenses', getExpenseReport);
router.get('/outstanding-payments', getOutstandingPaymentsReport);
router.get('/sales', getSalesReport);
router.get('/profit-loss', getProfitLossReport);

module.exports = router;

