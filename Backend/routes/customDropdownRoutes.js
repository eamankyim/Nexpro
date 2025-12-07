const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { getCustomOptions, saveCustomOption, getBatchCustomOptions } = require('../controllers/customDropdownController');

// Apply authentication and tenant context to all routes
router.use(protect);
router.use(tenantContext);

// Get custom options for a specific dropdown type
router.get('/:dropdownType', getCustomOptions);

// Save a new custom option
router.post('/', saveCustomOption);

// Get batch custom options for multiple dropdown types
router.post('/batch', getBatchCustomOptions);

module.exports = router;

