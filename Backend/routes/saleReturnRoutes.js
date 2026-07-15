const express = require('express');
const {
  getReturns,
  getReturn,
} = require('../controllers/saleReturnController');
const { protect } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { shopContext } = require('../middleware/shopContext');
const { timeCrudAction } = require('../middleware/crudTiming');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(shopContext);
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.route('/')
  .get(timeCrudAction('returns.list'), getReturns);

router.route('/:id')
  .get(timeCrudAction('returns.read'), getReturn);

module.exports = router;
