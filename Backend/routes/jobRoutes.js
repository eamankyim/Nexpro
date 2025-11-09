const express = require('express');
const {
  getJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  getJobStats
} = require('../controllers/jobController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/stats/overview', getJobStats);

router.route('/')
  .get(getJobs)
  .post(authorize('admin', 'manager', 'staff'), createJob);

router.route('/:id')
  .get(getJob)
  .put(authorize('admin', 'manager', 'staff'), updateJob)
  .delete(authorize('admin', 'manager', 'staff'), deleteJob);

module.exports = router;


