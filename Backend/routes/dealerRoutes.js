const express = require('express');
const {
  getDealerStats,
  getDealers,
  getDealer,
  createDealer,
  updateDealer,
  patchDealer,
  getDealerLedger,
  recordDealerPayment,
  createLedgerAdjustment,
  getDealerStatement,
  getDealerPrices,
  upsertDealerPrices,
  resolveDealerPrice,
  resolveDealerPricesBatch,
  getPriceTiers,
  createPriceTier,
  updatePriceTier,
  posSearchDealers,
  getOutstandingReport,
  checkDealerCredit,
} = require('../controllers/dealerController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { shopContext } = require('../middleware/shopContext');
const { requireFeature } = require('../middleware/featureAccess');
const { timeCrudAction } = require('../middleware/crudTiming');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(shopContext);
router.use(requireFeature('dealersAccount'));

router.route('/stats').get(getDealerStats);
router.route('/pos-search').get(posSearchDealers);
router.route('/report/outstanding').get(getOutstandingReport);

router.route('/price-tiers')
  .get(getPriceTiers)
  .post(authorize('admin', 'manager'), createPriceTier);

router.route('/price-tiers/:tierId')
  .put(authorize('admin', 'manager'), updatePriceTier);

router.route('/')
  .get(timeCrudAction('dealers.list'), getDealers)
  .post(authorize('admin', 'manager', 'staff'), timeCrudAction('dealers.create'), createDealer);

router.route('/:id')
  .get(timeCrudAction('dealers.read'), getDealer)
  .put(authorize('admin', 'manager', 'staff'), timeCrudAction('dealers.update'), updateDealer)
  .patch(authorize('admin', 'manager'), patchDealer);

router.route('/:id/ledger')
  .get(getDealerLedger);

router.route('/:id/ledger/adjustment')
  .post(authorize('admin', 'manager'), createLedgerAdjustment);

router.route('/:id/payments')
  .post(authorize('admin', 'manager', 'staff'), recordDealerPayment);

router.route('/:id/statement')
  .get(getDealerStatement);

router.route('/:id/credit-check')
  .post(checkDealerCredit);

router.route('/:id/prices/resolve')
  .get(resolveDealerPrice);

router.route('/:id/prices/resolve-batch')
  .post(resolveDealerPricesBatch);

router.route('/:id/prices')
  .get(getDealerPrices)
  .put(authorize('admin', 'manager'), upsertDealerPrices);

module.exports = router;
