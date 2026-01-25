const express = require('express');
const {
  getPharmacies,
  getPharmacy,
  createPharmacy,
  updatePharmacy,
  deletePharmacy
} = require('../controllers/pharmacyController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router.route('/')
  .get(getPharmacies)
  .post(authorize('admin', 'manager', 'staff'), createPharmacy);

router.route('/:id')
  .get(getPharmacy)
  .put(authorize('admin', 'manager', 'staff'), updatePharmacy)
  .delete(authorize('admin', 'manager', 'staff'), deletePharmacy);

module.exports = router;
