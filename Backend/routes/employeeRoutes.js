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

router
  .route('/')
  .get(getEmployees)
  .post(authorize('admin', 'manager'), createEmployee);

router
  .route('/:id')
  .get(getEmployee)
  .put(authorize('admin', 'manager'), updateEmployee)
  .delete(authorize('admin', 'manager'), archiveEmployee);

router.post(
  '/:id/documents',
  authorize('admin', 'manager'),
  uploadMiddleware,
  uploadEmployeeDocument
);

router.delete(
  '/:id/documents/:documentId',
  authorize('admin', 'manager'),
  deleteEmployeeDocument
);

router.post(
  '/:id/history',
  authorize('admin', 'manager'),
  addEmploymentHistory
);

module.exports = router;



