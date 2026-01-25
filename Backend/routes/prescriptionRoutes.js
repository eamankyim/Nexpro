const express = require('express');
const {
  getPrescriptions,
  getPrescription,
  createPrescription,
  fillPrescription,
  updatePrescription,
  checkDrugInteractions,
  generateInvoice,
  printLabel
} = require('../controllers/prescriptionController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router.route('/')
  .get(getPrescriptions)
  .post(authorize('admin', 'manager', 'staff'), createPrescription);

router.route('/check-interactions')
  .post(checkDrugInteractions);

router.route('/:id')
  .get(getPrescription)
  .put(authorize('admin', 'manager', 'staff'), updatePrescription);

router.route('/:id/fill')
  .post(authorize('admin', 'manager', 'staff'), fillPrescription);

router.route('/:id/generate-invoice')
  .post(authorize('admin', 'manager', 'staff'), generateInvoice);

router.route('/:id/label')
  .get(authorize('admin', 'manager', 'staff'), printLabel);

module.exports = router;
