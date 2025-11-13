const { Op } = require('sequelize');
const {
  Employee,
  EmployeeDocument,
  EmploymentHistory,
  PayrollEntry,
  PayrollRun,
  User
} = require('../models');
const { createUploader } = require('../middleware/upload');
const path = require('path');
const { baseUploadDir, ensureDirExists } = require('../middleware/upload');
const fs = require('fs');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');

const buildFilter = (query) => {
  const where = {};

  if (query.search) {
    where[Op.or] = [
      { firstName: { [Op.iLike]: `%${query.search}%` } },
      { lastName: { [Op.iLike]: `%${query.search}%` } },
      { email: { [Op.iLike]: `%${query.search}%` } },
      { department: { [Op.iLike]: `%${query.search}%` } },
      { jobTitle: { [Op.iLike]: `%${query.search}%` } }
    ];
  }

  if (query.status && query.status !== 'all') {
    where.status = query.status;
  }

  if (query.department && query.department !== 'all') {
    where.department = query.department;
  }

  if (query.employmentType && query.employmentType !== 'all') {
    where.employmentType = query.employmentType;
  }

  return where;
};

exports.getEmployees = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const where = applyTenantFilter(req.tenantId, buildFilter(req.query));

    const { count, rows } = await Employee.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      },
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

exports.getEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [
        {
          model: EmployeeDocument,
          as: 'documents',
          include: [{ model: User, as: 'uploader', attributes: ['id', 'name', 'email'] }],
          order: [['createdAt', 'DESC']]
        },
        {
          model: EmploymentHistory,
          as: 'history',
          order: [['effectiveDate', 'DESC']]
        },
        {
          model: PayrollEntry,
          as: 'payrollEntries',
          include: [
            {
              model: PayrollRun,
              as: 'run',
              attributes: ['id', 'periodStart', 'periodEnd', 'payDate', 'status']
            }
          ],
          limit: 12,
          order: [['createdAt', 'DESC']]
        }
      ],
      order: [
        [{ model: EmploymentHistory, as: 'history' }, 'effectiveDate', 'DESC'],
        [{ model: EmployeeDocument, as: 'documents' }, 'createdAt', 'DESC']
      ]
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    res.status(200).json({ success: true, data: employee });
  } catch (error) {
    next(error);
  }
};

exports.createEmployee = async (req, res, next) => {
  try {
    const payload = sanitizePayload(req.body);
    const employee = await Employee.create({
      ...payload,
      tenantId: req.tenantId
    });

    await EmploymentHistory.create({
      employeeId: employee.id,
      tenantId: req.tenantId,
      changeType: 'hire',
      effectiveDate: payload.hireDate || new Date(),
      toValue: {
        jobTitle: employee.jobTitle,
        department: employee.department,
        salaryAmount: employee.salaryAmount
      },
      notes: 'Employee hired'
    });

    res.status(201).json({ success: true, data: employee });
  } catch (error) {
    next(error);
  }
};

exports.updateEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const previousData = employee.toJSON();
    const updatePayload = sanitizePayload(req.body);
    await employee.update(updatePayload);

    const changes = {};
    ['jobTitle', 'department', 'status', 'salaryAmount', 'employmentType', 'payFrequency'].forEach((field) => {
      if (previousData[field] !== employee[field]) {
        changes[field] = {
          from: previousData[field],
          to: employee[field]
        };
      }
    });

    if (Object.keys(changes).length > 0) {
      await EmploymentHistory.create({
        employeeId: employee.id,
        tenantId: req.tenantId,
        changeType: 'update',
        effectiveDate: new Date(),
        fromValue: Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value.from])),
        toValue: Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value.to])),
        notes: 'Employee updated'
      });
    }

    res.status(200).json({ success: true, data: employee });
  } catch (error) {
    next(error);
  }
};

exports.archiveEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    await employee.update({
      status: 'terminated',
      isActive: false,
      endDate: employee.endDate || new Date()
    });

    await EmploymentHistory.create({
      employeeId: employee.id,
      tenantId: req.tenantId,
      changeType: 'termination',
      effectiveDate: employee.endDate || new Date(),
      fromValue: { status: 'active' },
      toValue: { status: 'terminated' },
      notes: req.body?.notes || 'Employee archived'
    });

    res.status(200).json({ success: true, data: employee });
  } catch (error) {
    next(error);
  }
};

const employeeUploader = createUploader((req) => path.join('employees', req.params.id, 'documents'));

exports.uploadMiddleware = employeeUploader.single('file');

exports.uploadEmployeeDocument = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const storagePath = path.relative(baseUploadDir, req.file.path);
    const fileUrl = `/uploads/${storagePath.replace(/\\\\/g, '/')}`;

    const docPayload = sanitizePayload(req.body || {});

    const document = await EmployeeDocument.create({
      employeeId: employee.id,
      tenantId: req.tenantId,
      type: docPayload.type || null,
      title: docPayload.title || req.file.originalname,
      fileUrl,
      uploadedBy: req.user?.id || null,
      metadata: docPayload.metadata || {}
    });

    const populated = await EmployeeDocument.findOne({
      where: applyTenantFilter(req.tenantId, { id: document.id }),
      include: [{ model: User, as: 'uploader', attributes: ['id', 'name', 'email'] }]
    });

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

exports.deleteEmployeeDocument = async (req, res, next) => {
  try {
    const document = await EmployeeDocument.findOne({
      where: applyTenantFilter(req.tenantId, {
        id: req.params.documentId,
        employeeId: req.params.id
      })
    });

    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    if (document.fileUrl?.startsWith('/uploads/')) {
      const relative = document.fileUrl.replace('/uploads/', '').split('/').join(path.sep);
      const absolute = path.join(baseUploadDir, relative);
      fs.promises.unlink(absolute).catch(() => null);
    }

    await document.destroy();

    res.status(200).json({ success: true, message: 'Document deleted' });
  } catch (error) {
    next(error);
  }
};

exports.addEmploymentHistory = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const payload = sanitizePayload(req.body);

    const history = await EmploymentHistory.create({
      employeeId: employee.id,
      tenantId: req.tenantId,
      changeType: payload.changeType || 'note',
      effectiveDate: payload.effectiveDate || new Date(),
      fromValue: payload.fromValue || {},
      toValue: payload.toValue || {},
      notes: payload.notes || null,
      metadata: payload.metadata || {}
    });

    res.status(201).json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
};



