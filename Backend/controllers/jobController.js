const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { Job, Customer, User, Payment, Expense, JobItem, Invoice, Quote, JobStatusHistory } = require('../models');
const { Op } = require('sequelize');
const config = require('../config/config');
const { baseUploadDir } = require('../middleware/upload');
const activityLogger = require('../services/activityLogger');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');

// Generate unique job number
const generateJobNumber = async (tenantId) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  const lastJob = await Job.findOne({
    where: {
      tenantId,
      jobNumber: {
        [Op.like]: `JOB-${year}${month}%`
      }
    },
    order: [['createdAt', 'DESC']]
  });

  let sequence = 1;
  if (lastJob) {
    const lastSequence = parseInt(lastJob.jobNumber.split('-')[2]);
    sequence = lastSequence + 1;
  }

  return `JOB-${year}${month}-${String(sequence).padStart(4, '0')}`;
};

// Generate unique invoice number
const generateInvoiceNumber = async (tenantId) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  const lastInvoice = await Invoice.findOne({
    where: {
      tenantId,
      invoiceNumber: {
        [Op.like]: `INV-${year}${month}%`
      }
    },
    order: [['createdAt', 'DESC']]
  });

  let sequence = 1;
  if (lastInvoice) {
    const lastSequence = parseInt(lastInvoice.invoiceNumber.split('-').pop());
    sequence = lastSequence + 1;
  }

  return `INV-${year}${month}-${String(sequence).padStart(4, '0')}`;
};

// Helper function to automatically create invoice for completed job
const autoCreateInvoice = async (jobId, tenantId) => {
  try {
    // Check if invoice already exists for this job
    const existingInvoice = await Invoice.findOne({ where: applyTenantFilter(tenantId, { jobId }) });
    if (existingInvoice) {
      return null; // Invoice already exists, skip creation
    }

    // Fetch job with items
    const job = await Job.findOne({
      where: applyTenantFilter(tenantId, { id: jobId }),
      include: [
        {
          model: JobItem,
          as: 'items'
        },
        {
          model: Customer,
          as: 'customer'
        }
      ]
    });

    if (!job) {
      return null;
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(tenantId);

    // Calculate subtotal from job items or finalPrice
    let subtotal = 0;
    let items = [];

    if (job.items && job.items.length > 0) {
      items = job.items.map(item => {
        const itemSubtotal = parseFloat(item.quantity) * parseFloat(item.unitPrice);
        const itemDiscount = parseFloat(item.discountAmount || 0);
        return {
          description: item.description || item.category,
          category: item.category,
          paperSize: item.paperSize,
          quantity: item.quantity,
          unitPrice: parseFloat(item.unitPrice),
          discountAmount: itemDiscount,
          discountPercent: parseFloat(item.discountPercent || 0),
          discountReason: item.discountReason || null,
          total: itemSubtotal - itemDiscount
        };
      });
      subtotal = items.reduce((sum, item) => sum + (parseFloat(item.quantity) * parseFloat(item.unitPrice)), 0);
      
      // Calculate total discount from all items
      const totalItemDiscount = items.reduce((sum, item) => sum + parseFloat(item.discountAmount || 0), 0);
      
      // If there are item-level discounts, set invoice-level discount
      if (totalItemDiscount > 0) {
        const invoice = await Invoice.create({
          invoiceNumber,
          jobId,
          customerId: job.customerId,
          tenantId,
          invoiceDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          subtotal,
          taxRate: 0,
          discountType: 'fixed',
          discountValue: totalItemDiscount,
          discountAmount: totalItemDiscount,
          discountReason: items.find(i => i.discountReason)?.discountReason || 'Item discounts applied',
          paymentTerms: 'Net 30',
          items,
          notes: null,
          termsAndConditions: 'Payment is due within the specified payment terms. Late payments may incur additional charges.'
        });

        // Send webhook to Sabito (async, don't block)
        try {
          const sabitoWebhookService = require('../services/sabitoWebhookService');
          const customer = job.customer;
          
          if (customer && customer.sabitoCustomerId) {
            sabitoWebhookService.sendInvoiceWebhook(invoice, customer, tenantId)
              .then(async (result) => {
                if (result.success) {
                  await invoice.update({
                    sabitoProjectId: result.projectId,
                    sabitoSyncedAt: new Date(),
                    sabitoSyncStatus: 'synced'
                  });
                } else if (result.skipped) {
                  await invoice.update({
                    sabitoSyncStatus: 'skipped'
                  });
                }
              })
              .catch(async (error) => {
                console.error('Failed to send Sabito webhook for auto-generated invoice:', error);
                await invoice.update({
                  sabitoSyncStatus: 'failed',
                  sabitoSyncError: error.message
                });
              });
          }
        } catch (error) {
          console.error('Error sending Sabito webhook for auto-generated invoice:', error);
        }

        return invoice;
      }
    } else {
      // If no items, use finalPrice from job
      subtotal = parseFloat(job.finalPrice || 0);
      items = [{
        description: job.title,
        quantity: 1,
        unitPrice: subtotal,
        total: subtotal
      }];
    }

    // Create invoice without discounts (regular flow)
    const invoice = await Invoice.create({
      invoiceNumber,
      jobId,
      customerId: job.customerId,
      tenantId,
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
      subtotal,
      taxRate: 0,
      discountType: 'fixed',
      discountValue: 0,
      discountAmount: 0,
      paymentTerms: 'Net 30',
      items,
      notes: null,
      termsAndConditions: 'Payment is due within the specified payment terms. Late payments may incur additional charges.'
    });

    // Send webhook to Sabito (async, don't block)
    try {
      const sabitoWebhookService = require('../services/sabitoWebhookService');
      const customer = job.customer;
      
      if (customer && customer.sabitoCustomerId) {
        sabitoWebhookService.sendInvoiceWebhook(invoice, customer, tenantId)
          .then(async (result) => {
            if (result.success) {
              await invoice.update({
                sabitoProjectId: result.projectId,
                sabitoSyncedAt: new Date(),
                sabitoSyncStatus: 'synced'
              });
            } else if (result.skipped) {
              await invoice.update({
                sabitoSyncStatus: 'skipped'
              });
            }
          })
          .catch(async (error) => {
            console.error('Failed to send Sabito webhook for auto-generated invoice:', error);
            await invoice.update({
              sabitoSyncStatus: 'failed',
              sabitoSyncError: error.message
            });
          });
      }
    } catch (error) {
      console.error('Error sending Sabito webhook for auto-generated invoice:', error);
    }

    return invoice;
  } catch (error) {
    console.error('Error auto-creating invoice:', error);
    return null;
  }
};

// @desc    Get all jobs
// @route   GET /api/jobs
// @access  Private
exports.getJobs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || config.pagination.defaultPageSize;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status;
    const customerId = req.query.customerId;
    const assignedTo = req.query.assignedTo;

    const where = {};
    if (search) {
      where[Op.or] = [
        { jobNumber: { [Op.iLike]: `%${search}%` } },
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }
    if (status) {
      where.status = status;
    }
    if (customerId) {
      where.customerId = customerId;
    }
    if (assignedTo) {
      where.assignedTo = assignedTo;
    }

    const { count, rows } = await Job.findAndCountAll({
      where,
      limit,
      offset,
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'company', 'email'] },
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        { model: Quote, as: 'quote', attributes: ['id', 'quoteNumber', 'status', 'title'] },
        { model: JobItem, as: 'items' }
      ],
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

// @desc    Get single job
// @route   GET /api/jobs/:id
// @access  Private
exports.getJob = async (req, res, next) => {
  try {
    const job = await Job.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [
        { model: Customer, as: 'customer' },
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        {
          model: JobStatusHistory,
          as: 'statusHistory',
          include: [{ model: User, as: 'changedByUser', attributes: ['id', 'name', 'email'] }],
          order: [['createdAt', 'ASC']]
        },
        { model: Payment, as: 'payments' },
        { model: Expense, as: 'expenses' },
        { model: JobItem, as: 'items' }
      ],
      order: [[{ model: JobStatusHistory, as: 'statusHistory' }, 'createdAt', 'ASC']]
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (!Array.isArray(job.attachments)) {
      job.attachments = [];
    }

    res.status(200).json({
      success: true,
      data: job
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new job
// @route   POST /api/jobs
// @access  Private
exports.createJob = async (req, res, next) => {
  try {
    const { items, ...rawJobData } = req.body;
    const jobData = sanitizePayload(rawJobData);
    const jobNumber = await generateJobNumber(req.tenantId);
    if (req.user?.id) {
      jobData.createdBy = req.user.id;
    }
    
    // If status is completed, set completion date
    if (jobData.status === 'completed') {
      jobData.completionDate = new Date();
    }

    const job = await Job.create({
      ...jobData,
      tenantId: req.tenantId,
      jobNumber
    });

    // Create job items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      const jobItems = items.map(item => ({
        ...sanitizePayload(item),
        jobId: job.id,
        tenantId: req.tenantId,
        totalPrice: parseFloat(item.quantity) * parseFloat(item.unitPrice)
      }));
      await JobItem.bulkCreate(jobItems);
    }

    // Auto-create invoice for ALL new jobs (not just completed)
    let autoGeneratedInvoice = null;
    autoGeneratedInvoice = await autoCreateInvoice(job.id, req.tenantId);

    await JobStatusHistory.create({
      jobId: job.id,
      tenantId: req.tenantId,
      status: job.status,
      comment: 'Job created',
      changedBy: req.user?.id || null
    });

    const jobWithDetails = await Job.findOne({
      where: applyTenantFilter(req.tenantId, { id: job.id }),
      include: [
        { model: Customer, as: 'customer' },
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        { model: Quote, as: 'quote', attributes: ['id', 'quoteNumber', 'status', 'title'] },
        {
          model: JobStatusHistory,
          as: 'statusHistory',
          include: [{ model: User, as: 'changedByUser', attributes: ['id', 'name', 'email'] }],
          order: [['createdAt', 'ASC']]
        },
        { model: JobItem, as: 'items' }
      ],
      order: [[{ model: JobStatusHistory, as: 'statusHistory' }, 'createdAt', 'ASC']]
    });

    if (!Array.isArray(jobWithDetails.attachments)) {
      jobWithDetails.attachments = [];
    }

    if (jobWithDetails.assignedTo) {
      await activityLogger.logJobAssigned(jobWithDetails, req.user?.id || null);
    }

    const response = {
      success: true,
      data: jobWithDetails
    };

    // Include invoice info if it was auto-generated
    if (autoGeneratedInvoice) {
      response.invoice = {
        id: autoGeneratedInvoice.id,
        invoiceNumber: autoGeneratedInvoice.invoiceNumber,
        message: 'Invoice automatically generated'
      };
    }

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

// @desc    Update job
// @route   PUT /api/jobs/:id
// @access  Private
exports.updateJob = async (req, res, next) => {
  try {
    const job = await Job.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    const { statusComment, ...rawPayload } = req.body;
    const updatePayload = sanitizePayload(rawPayload);
    const oldStatus = job.status;
    const newStatus = updatePayload.status;
    const oldAssignedTo = job.assignedTo;

    // If status is changing to completed, set completion date
    if (newStatus === 'completed' && oldStatus !== 'completed') {
      updatePayload.completionDate = new Date();
    }

    await job.update(updatePayload);

    // Auto-create invoice when job is marked as completed
    let autoGeneratedInvoice = null;
    if (newStatus === 'completed' && oldStatus !== 'completed') {
      autoGeneratedInvoice = await autoCreateInvoice(job.id, req.tenantId);
    }

    const statusChanged = newStatus && newStatus !== oldStatus;
    if (statusChanged || statusComment) {
      await JobStatusHistory.create({
        jobId: job.id,
        tenantId: req.tenantId,
        status: statusChanged ? newStatus : job.status,
        comment: statusComment || null,
        changedBy: req.user?.id || null
      });
    }

    const updatedJob = await Job.findOne({
      where: applyTenantFilter(req.tenantId, { id: job.id }),
      include: [
        { model: Customer, as: 'customer' },
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
        { model: Quote, as: 'quote', attributes: ['id', 'quoteNumber', 'status', 'title'] },
        {
          model: JobStatusHistory,
          as: 'statusHistory',
          include: [{ model: User, as: 'changedByUser', attributes: ['id', 'name', 'email'] }],
          order: [['createdAt', 'ASC']]
        },
        { model: JobItem, as: 'items' }
      ],
      order: [[{ model: JobStatusHistory, as: 'statusHistory' }, 'createdAt', 'ASC']]
    });

    if (!Array.isArray(updatedJob.attachments)) {
      updatedJob.attachments = [];
    }

    if (updatePayload.assignedTo && updatePayload.assignedTo !== oldAssignedTo) {
      await activityLogger.logJobAssigned(updatedJob, req.user?.id || null);
    }

    if (statusChanged) {
      await activityLogger.logJobStatusChanged(updatedJob, oldStatus, newStatus, req.user?.id || null);
    }

    const response = {
      success: true,
      data: updatedJob
    };

    // Include invoice info if it was auto-generated
    if (autoGeneratedInvoice) {
      response.invoice = {
        id: autoGeneratedInvoice.id,
        invoiceNumber: autoGeneratedInvoice.invoiceNumber,
        message: 'Invoice automatically generated'
      };
    }

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete job
// @route   DELETE /api/jobs/:id
// @access  Private
exports.deleteJob = async (req, res, next) => {
  try {
    const job = await Job.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    await job.destroy();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get job statistics
// @route   GET /api/jobs/stats/overview
// @access  Private
exports.getJobStats = async (req, res, next) => {
  try {
    const { sequelize } = require('../config/database');

    const stats = await Job.findAll({
      where: applyTenantFilter(req.tenantId, {}),
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('finalPrice')), 'totalRevenue']
      ],
      group: ['status']
    });

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

const buildAttachmentResponse = (req, attachment) => {
  if (!attachment) return attachment;
  const normalized = { ...attachment };
  
  // If fileData exists (base64), use it as url
  if (normalized.fileData) {
    normalized.url = normalized.fileData;
  } else if (normalized.storagePath && !normalized.url) {
    // Legacy support for file paths
    normalized.url = `${req.protocol}://${req.get('host')}/uploads/${normalized.storagePath.replace(/\\/g, '/')}`;
  }
  
  // Don't expose full fileData in response, just url
  if (normalized.fileData && normalized.url) {
    delete normalized.fileData;
  }
  
  return normalized;
};

exports.uploadJobAttachment = async (req, res, next) => {
  try {
    console.log('[Job Attachment Upload] Starting upload...');
    const job = await Job.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (!req.file) {
      console.log('[Job Attachment Upload] ❌ No file uploaded');
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    console.log('[Job Attachment Upload] File info:', {
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
        console.log('[Job Attachment Upload] File is in memory, converting to base64...');
        const base64String = req.file.buffer.toString('base64');
        fileData = `data:${mimeType};base64,${base64String}`;
        console.log('[Job Attachment Upload] ✅ Base64 conversion complete. Length:', fileData.length);
      } else if (req.file.path) {
        console.log('[Job Attachment Upload] File is on disk, reading from path:', req.file.path);
        
        if (!fs.existsSync(req.file.path)) {
          console.log('[Job Attachment Upload] ❌ File path does not exist');
          return res.status(400).json({ success: false, message: 'Uploaded file not found on server' });
        }
        
        const fileBuffer = fs.readFileSync(req.file.path);
        const base64String = fileBuffer.toString('base64');
        fileData = `data:${mimeType};base64,${base64String}`;
        console.log('[Job Attachment Upload] ✅ Base64 conversion complete. Length:', fileData.length);
        
        // Delete the temporary file since we're storing in DB
        try {
          fs.unlinkSync(req.file.path);
          console.log('[Job Attachment Upload] ✅ Temporary file deleted');
        } catch (unlinkError) {
          console.log('[Job Attachment Upload] ⚠️  Warning: Could not delete temporary file:', unlinkError.message);
        }
      } else {
        console.log('[Job Attachment Upload] ❌ File has neither buffer nor path');
        return res.status(400).json({ success: false, message: 'Unable to process uploaded file' });
      }
    } catch (processingError) {
      console.error('[Job Attachment Upload] ❌ Error processing file:', processingError);
      return res.status(500).json({ success: false, message: 'Error processing uploaded file', error: processingError.message });
    }

    const attachment = {
      id: uuidv4(),
      originalName: req.file.originalname,
      mimeType: mimeType,
      size: req.file.size,
      fileData: fileData, // Store base64 data
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.user
        ? {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email
          }
        : null
    };

    const attachments = Array.isArray(job.attachments) ? [...job.attachments] : [];
    attachments.push(attachment);
    job.attachments = attachments;
    await job.save();

    console.log('[Job Attachment Upload] ✅ Upload completed successfully');
    res.status(201).json({
      success: true,
      data: buildAttachmentResponse(req, attachment),
      attachments: attachments.map((item) => buildAttachmentResponse(req, item))
    });
  } catch (error) {
    console.error('[Job Attachment Upload] ❌ Error:', error);
    next(error);
  }
};

exports.deleteJobAttachment = async (req, res, next) => {
  try {
    const job = await Job.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const attachments = Array.isArray(job.attachments) ? [...job.attachments] : [];
    const index = attachments.findIndex((attachment) => attachment.id === req.params.attachmentId);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }

    const [removed] = attachments.splice(index, 1);
    job.attachments = attachments;
    await job.save();

    // Only delete file if it's a file path (legacy support), not base64
    if (removed?.storagePath && !removed?.fileData) {
      console.log('[Job Attachment Delete] Deleting file from disk...');
      const filePath = path.join(baseUploadDir, removed.storagePath);
      fs.promises
        .access(filePath, fs.constants.F_OK)
        .then(() => {
          fs.promises.unlink(filePath);
          console.log('[Job Attachment Delete] ✅ File deleted from disk');
        })
        .catch(() => {
          console.log('[Job Attachment Delete] File not found on disk (may already be deleted)');
        });
    } else {
      console.log('[Job Attachment Delete] Attachment stored as base64, no file to delete');
    }

    res.status(200).json({
      success: true,
      message: 'Attachment removed',
      attachments: attachments.map((item) => buildAttachmentResponse(req, item))
    });
  } catch (error) {
    next(error);
  }
};


