const express = require('express');
const { signupTenant } = require('../controllers/tenantController');

const router = express.Router();

router.post('/signup', signupTenant);

module.exports = router;



