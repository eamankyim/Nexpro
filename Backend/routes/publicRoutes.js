const express = require('express');
const { getPublicPlans } = require('../controllers/publicPricingController');

const router = express.Router();

router.get('/pricing', getPublicPlans);

module.exports = router;

