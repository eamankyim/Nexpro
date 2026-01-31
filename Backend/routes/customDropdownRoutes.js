const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { 
  getCustomOptions, 
  getAllCustomOptions,
  saveCustomOption, 
  updateCustomOption,
  deleteCustomOption,
  getBatchCustomOptions 
} = require('../controllers/customDropdownController');

// Apply authentication and tenant context to all routes
router.use(protect);
router.use(tenantContext);

// Get batch custom options for multiple dropdown types (must be before /:dropdownType)
router.post('/batch', getBatchCustomOptions);

// Save a new custom option
router.post('/', saveCustomOption);

// Get custom options for a specific dropdown type
router.get('/:dropdownType', getCustomOptions);

// Get all custom options including inactive (admin view)
router.get('/:dropdownType/all', authorize('admin', 'manager'), getAllCustomOptions);

// Update a custom option
router.put('/:id', authorize('admin', 'manager'), updateCustomOption);

// Delete a custom option (soft delete)
router.delete('/:id', authorize('admin', 'manager'), deleteCustomOption);

module.exports = router;

