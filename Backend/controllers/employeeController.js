const { Op } = require('sequelize');
const {
  Employee,
  EmployeeDocument,
  EmploymentHistory,
  PayrollEntry,
  PayrollRun,
  User
} = require('../models');
const path = require('path');
const { baseUploadDir } = require('../middleware/upload');
const fs = require('fs');
const multer = require('multer');
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

// Use memory storage for documents since we store base64 in database
const employeeDocumentUploader = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.UPLOAD_MAX_SIZE_MB || '20', 10) * 1024 * 1024 // 20MB for documents
  }
});

exports.uploadMiddleware = employeeDocumentUploader.single('file');

exports.uploadEmployeeDocument = async (req, res, next) => {
  try {
    console.log('[Employee Document Upload] Starting upload...');
    const employee = await Employee.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (!req.file) {
      console.log('[Employee Document Upload] ❌ No file uploaded');
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    console.log('[Employee Document Upload] File info:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      hasBuffer: !!req.file.buffer,
      hasPath: !!req.file.path
    });

    // Convert file to base64 and store in database
    let fileData;
    const mimeType = req.file.mimetype || 'application/octet-stream';
    
    try {
      if (req.file.buffer) {
        console.log('[Employee Document Upload] File is in memory, converting to base64...');
        const base64String = req.file.buffer.toString('base64');
        fileData = `data:${mimeType};base64,${base64String}`;
        console.log('[Employee Document Upload] ✅ Base64 conversion complete. Length:', fileData.length);
      } else if (req.file.path) {
        console.log('[Employee Document Upload] File is on disk, reading from path:', req.file.path);
        const fs = require('fs');
        
        if (!fs.existsSync(req.file.path)) {
          console.log('[Employee Document Upload] ❌ File path does not exist');
          return res.status(400).json({ success: false, message: 'Uploaded file not found on server' });
        }
        
        const fileBuffer = fs.readFileSync(req.file.path);
        const base64String = fileBuffer.toString('base64');
        fileData = `data:${mimeType};base64,${base64String}`;
        console.log('[Employee Document Upload] ✅ Base64 conversion complete. Length:', fileData.length);
        
        // Delete the temporary file since we're storing in DB
        try {
          fs.unlinkSync(req.file.path);
          console.log('[Employee Document Upload] ✅ Temporary file deleted');
        } catch (unlinkError) {
          console.log('[Employee Document Upload] ⚠️  Warning: Could not delete temporary file:', unlinkError.message);
        }
      } else {
        console.log('[Employee Document Upload] ❌ File has neither buffer nor path');
        return res.status(400).json({ success: false, message: 'Unable to process uploaded file' });
      }
    } catch (processingError) {
      console.error('[Employee Document Upload] ❌ Error processing file:', processingError);
      return res.status(500).json({ success: false, message: 'Error processing uploaded file', error: processingError.message });
    }

    const docPayload = sanitizePayload(req.body || {});

    const document = await EmployeeDocument.create({
      employeeId: employee.id,
      tenantId: req.tenantId,
      type: docPayload.type || null,
      title: docPayload.title || req.file.originalname,
      fileUrl: fileData, // Store base64 data
      uploadedBy: req.user?.id || null,
      metadata: {
        ...(docPayload.metadata || {}),
        originalName: req.file.originalname,
        mimeType: mimeType,
        size: req.file.size
      }
    });

    const populated = await EmployeeDocument.findOne({
      where: applyTenantFilter(req.tenantId, { id: document.id }),
      include: [{ model: User, as: 'uploader', attributes: ['id', 'name', 'email'] }]
    });

    console.log('[Employee Document Upload] ✅ Upload completed successfully');
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    console.error('[Employee Document Upload] ❌ Error:', error);
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



