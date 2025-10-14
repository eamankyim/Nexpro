const express = require('express');
const {
  getDashboardOverview,
  getRevenueByMonth,
  getExpensesByCategory,
  getTopCustomers,
  getJobStatusDistribution
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/overview', getDashboardOverview);
router.get('/revenue-by-month', getRevenueByMonth);
router.get('/expenses-by-category', getExpensesByCategory);
router.get('/top-customers', getTopCustomers);
router.get('/job-status-distribution', getJobStatusDistribution);

module.exports = router;


