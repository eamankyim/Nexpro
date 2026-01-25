const express = require('express');
const {
  getDrugs,
  getDrug,
  createDrug,
  updateDrug,
  deleteDrug,
  getExpiringDrugs
} = require('../controllers/drugController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router.route('/')
  .get(getDrugs)
  .post(authorize('admin', 'manager', 'staff'), createDrug);

router.route('/expiring')
  .get(getExpiringDrugs);

router.route('/:id')
  .get(getDrug)
  .put(authorize('admin', 'manager', 'staff'), updateDrug)
  .delete(authorize('admin', 'manager', 'staff'), deleteDrug);

module.exports = router;
