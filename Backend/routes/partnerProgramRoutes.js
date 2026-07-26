const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const {
  getPartnerProgramSettings,
  updatePartnerProgramSettings,
  listCatalogForPartnerProgram,
  listPartnershipApplications,
  approvePartnershipApplication,
  declinePartnershipApplication,
  listPartnerships,
  revokePartnership,
  listPartnerCommissions,
  markPartnerCommissionsPaid,
} = require('../controllers/partnerProgramController');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router.get('/settings', authorize('admin', 'manager'), getPartnerProgramSettings);
router.put('/settings', authorize('admin', 'manager'), updatePartnerProgramSettings);
router.get('/catalog', authorize('admin', 'manager'), listCatalogForPartnerProgram);

router.get('/applications', authorize('admin', 'manager'), listPartnershipApplications);
router.post('/applications/:id/approve', authorize('admin', 'manager'), approvePartnershipApplication);
router.post('/applications/:id/decline', authorize('admin', 'manager'), declinePartnershipApplication);

router.get('/partnerships', authorize('admin', 'manager'), listPartnerships);
router.post('/partnerships/:id/revoke', authorize('admin', 'manager'), revokePartnership);

router.get('/commissions', authorize('admin', 'manager'), listPartnerCommissions);
router.post('/commissions/mark-paid', authorize('admin', 'manager'), markPartnerCommissionsPaid);

module.exports = router;
