const express = require('express');
const {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  archiveEmployee,
  uploadEmployeeDocument,
  deleteEmployeeDocument,
  addEmploymentHistory,
  uploadMiddleware
} = require('../controllers/employeeController');
const { protect, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(protect);
router.use(tenantContext);
// HR / employee records: managers and workspace admins only (not staff)
router.use(authorize('admin', 'manager'));

router.route('/').get(getEmployees).post(createEmployee);

router.route('/:id').get(getEmployee).put(updateEmployee).delete(archiveEmployee);

router.post(
  '/:id/documents',
  uploadMiddleware,
  uploadEmployeeDocument
);

router.delete('/:id/documents/:documentId', deleteEmployeeDocument);

router.post('/:id/history', addEmploymentHistory);

module.exports = router;
