const express = require('express');
const {
  getStudioLocations,
  getStudioLocationAccess,
  getStudioLocation,
  createStudioLocation,
  updateStudioLocation,
  deleteStudioLocation,
  setUserStudioLocationAssignments,
  getUserStudioLocationAssignments,
} = require('../controllers/studioLocationController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { studioLocationContext } = require('../middleware/studioLocationContext');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
router.use(studioLocationContext);

router.get('/access', getStudioLocationAccess);

router
  .route('/users/:userId/assignments')
  .get(authorize('admin'), getUserStudioLocationAssignments)
  .put(authorize('admin'), setUserStudioLocationAssignments);

router
  .route('/')
  .get(getStudioLocations)
  .post(authorize('admin', 'manager'), createStudioLocation);

router
  .route('/:id')
  .get(getStudioLocation)
  .put(authorize('admin', 'manager'), updateStudioLocation)
  .delete(authorize('admin'), deleteStudioLocation);

module.exports = router;
