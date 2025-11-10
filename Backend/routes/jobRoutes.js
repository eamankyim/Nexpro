const express = require('express');
const {
  getJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  getJobStats,
  uploadJobAttachment,
  deleteJobAttachment
} = require('../controllers/jobController');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

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

router.post(
  '/:id/attachments',
  authorize('admin', 'manager', 'staff'),
  upload.single('file'),
  uploadJobAttachment
);

router.delete(
  '/:id/attachments/:attachmentId',
  authorize('admin', 'manager', 'staff'),
  deleteJobAttachment
);

module.exports = router;


