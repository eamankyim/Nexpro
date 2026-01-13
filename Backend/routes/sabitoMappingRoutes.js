const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const {
  createMapping,
  getMappings,
  deleteMapping,
  updateMappingByBusinessId
} = require('../controllers/sabitoMappingController');
const {
  triggerSync,
  syncTenant,
  getSyncStatus
} = require('../controllers/sabitoSyncController');

// All routes require authentication and tenant context
router.use(protect);
router.use(tenantContext);

router.post('/mappings', createMapping);
router.get('/mappings', getMappings);
router.delete('/mappings/:id', deleteMapping);
router.put('/mappings/by-business-id/:businessId', updateMappingByBusinessId);

// Sync endpoints
router.post('/sync', triggerSync);
router.post('/sync/:mappingId', syncTenant);
router.get('/sync/status', getSyncStatus);

module.exports = router;

