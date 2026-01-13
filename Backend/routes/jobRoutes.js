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
const { tenantContext } = require('../middleware/tenant');
const multer = require('multer');

const router = express.Router();

router.use(protect);
router.use(tenantContext);

router.get('/stats/overview', getJobStats);

router.route('/')
  .get(getJobs)
  .post(authorize('admin', 'manager', 'staff'), createJob);

router.route('/:id')
  .get(getJob)
  .put(authorize('admin', 'manager', 'staff'), updateJob)
  .delete(authorize('admin', 'manager', 'staff'), deleteJob);

// Use memory storage for job attachments since we store base64 in database
const jobAttachmentUploader = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.UPLOAD_MAX_SIZE_MB || '20', 10) * 1024 * 1024 // 20MB for attachments
  }
});

router.post(
  '/:id/attachments',
  authorize('admin', 'manager', 'staff'),
  jobAttachmentUploader.single('file'),
  uploadJobAttachment
);

router.delete(
  '/:id/attachments/:attachmentId',
  authorize('admin', 'manager', 'staff'),
  deleteJobAttachment
);

module.exports = router;


