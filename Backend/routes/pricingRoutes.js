const express = require('express');
const {
  getPricingTemplates,
  getPricingTemplate,
  createPricingTemplate,
  updatePricingTemplate,
  deletePricingTemplate,
  calculatePrice
} = require('../controllers/pricingController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/calculate', calculatePrice);

router.route('/')
  .get(getPricingTemplates)
  .post(authorize('admin', 'manager'), createPricingTemplate);

router.route('/:id')
  .get(getPricingTemplate)
  .put(authorize('admin', 'manager'), updatePricingTemplate)
  .delete(authorize('admin'), deletePricingTemplate);

module.exports = router;


