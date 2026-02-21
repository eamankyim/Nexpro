const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { getTourStatus, completeTour, resetTour } = require('../controllers/tourController');

// Apply auth and tenant context to all routes
router.use(protect);
router.use(tenantContext);

/**
 * @route   GET /api/tours/status
 * @desc    Get tour completion status for current user/tenant
 * @access  Private
 */
router.get('/status', getTourStatus);

/**
 * @route   POST /api/tours/complete
 * @desc    Mark a tour as completed
 * @access  Private
 */
router.post('/complete', completeTour);

/**
 * @route   POST /api/tours/reset
 * @desc    Reset a tour (mark as not completed)
 * @access  Private
 */
router.post('/reset', resetTour);

module.exports = router;
