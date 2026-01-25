const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { Job, Customer, User, Payment, Expense, JobItem, Invoice, Quote, JobStatusHistory } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const config = require('../config/config');
const { baseUploadDir } = require('../middleware/upload');
const activityLogger = require('../services/activityLogger');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');

// Generate unique job number with transaction support for advisory locks
const generateJobNumber = async (tenantId, transaction = null) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  try {
    // Use advisory lock if we have a transaction to prevent race conditions
    if (transaction) {
      const lockId = `job_number_${tenantId}_${year}${month}`.replace(/-/g, '_').substring(0, 63);
      const [lockHash] = await sequelize.query(
        `SELECT hashtext(:lockId) as lock_hash`,
        {
          replacements: { lockId },
          type: sequelize.QueryTypes.SELECT,
          transaction
        }
      );
      const lockKey = Math.abs(lockHash?.lock_hash || 0);
      
      // Acquire advisory lock (blocks until available, releases on transaction commit/rollback)
      await sequelize.query(`SELECT pg_advisory_xact_lock(:lockKey)`, {
        replacements: { lockKey },
        type: sequelize.QueryTypes.SELECT,
        transaction
      });
    }
    
    // Query for max sequence (advisory lock ensures no race conditions)
    // Use a simpler query that definitely finds existing jobs
    const queryResults = await sequelize.query(
      `SELECT "jobNumber",
              CAST(SPLIT_PART("jobNumber", '-', 3) AS INTEGER) as sequence
       FROM "jobs" 
       WHERE "tenantId" = :tenantId 
         AND "jobNumber" LIKE :pattern
         AND SPLIT_PART("jobNumber", '-', 3) ~ '^[0-9]+$'
       ORDER BY CAST(SPLIT_PART("jobNumber", '-', 3) AS INTEGER) DESC
       LIMIT 1`,
      {
        replacements: {
          tenantId: tenantId,
          pattern: `JOB-${year}${month}-%`
        },
        type: sequelize.QueryTypes.SELECT,
        transaction
      }
    );
    
    console.log(`[JobNumber] Query results for pattern JOB-${year}${month}-%:`, queryResults);
    console.log(`[JobNumber] Query results type:`, typeof queryResults, 'isArray:', Array.isArray(queryResults));
    
    let sequence = 1;
    // Handle both array and single object results from sequelize.query
    let result = null;
    if (Array.isArray(queryResults) && queryResults.length > 0) {
      result = queryResults[0];
    } else if (queryResults && typeof queryResults === 'object' && queryResults.sequence !== undefined) {
      // Handle case where query returns a single object instead of array
      result = queryResults;
    }
    
    if (result && result.sequence !== null && result.sequence !== undefined) {
      const maxSequence = parseInt(result.sequence, 10);
      if (!isNaN(maxSequence) && maxSequence >= 1) {
        sequence = maxSequence + 1;
        console.log(`[JobNumber] ✅ Found max sequence: ${maxSequence}, generating next: ${sequence}`);
      } else {
        console.log(`[JobNumber] ⚠️ Invalid sequence value: ${result.sequence}, starting at 1`);
      }
    } else {
      console.log(`[JobNumber] ℹ️ No existing jobs found for pattern JOB-${year}${month}-%, starting at 1`);
    }

    const generatedNumber = `JOB-${year}${month}-${String(sequence).padStart(4, '0')}`;
    console.log(`[JobNumber] Generated: ${generatedNumber} for tenant: ${tenantId}`);
    
    return generatedNumber;
  } catch (error) {
    console.error(`[JobNumber] Error with advisory lock, using fallback query:`, error.message);
    // Fallback to simple MAX query without transaction to ensure we see all committed jobs
    try {
      const fallbackResults = await sequelize.query(
        `SELECT MAX(CAST(SPLIT_PART("jobNumber", '-', 3) AS INTEGER)) as max_sequence
         FROM "jobs" 
         WHERE "tenantId" = :tenantId 
           AND "jobNumber" LIKE :pattern
           AND SPLIT_PART("jobNumber", '-', 3) ~ '^[0-9]+$'`,
        {
          replacements: {
            tenantId: tenantId,
            pattern: `JOB-${year}${month}-%`
          },
          type: sequelize.QueryTypes.SELECT
          // No transaction - query committed data directly
        }
      );
      
      let sequence = 1;
      if (fallbackResults && Array.isArray(fallbackResults) && fallbackResults.length > 0) {
        const result = fallbackResults[0];
        if (result?.max_sequence !== null && result?.max_sequence !== undefined) {
          const maxSeq = parseInt(result.max_sequence, 10);
          if (!isNaN(maxSeq) && maxSeq >= 1) {
            sequence = maxSeq + 1;
            console.log(`[JobNumber] Fallback found max sequence: ${maxSeq}, generating: ${sequence}`);
          }
        }
      }
      
      return `JOB-${year}${month}-${String(sequence).padStart(4, '0')}`;
    } catch (fallbackError) {
      console.error(`[JobNumber] Fallback query also failed:`, fallbackError);
      // Last resort - just use timestamp-based to ensure uniqueness
      const timestamp = Date.now().toString().slice(-6);
      return `JOB-${year}${month}-${timestamp}`;
    }
  }
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
    console.log(`[AutoInvoice] Starting invoice creation for jobId: ${jobId}, tenantId: ${tenantId}`);
    
    // Check if invoice already exists for this job
    const existingInvoice = await Invoice.findOne({ where: applyTenantFilter(tenantId, { jobId }) });
    if (existingInvoice) {
      console.log(`[AutoInvoice] Invoice already exists for job ${jobId}, skipping creation`);
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
      console.log(`[AutoInvoice] Job ${jobId} not found, cannot create invoice`);
      return null;
    }
    
    console.log(`[AutoInvoice] Job found: ${job.jobNumber}, items: ${job.items?.length || 0}, finalPrice: ${job.finalPrice}`);

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
      console.log(`[AutoInvoice] Items processed: ${items.length}, subtotal: ${subtotal}, totalItemDiscount: ${totalItemDiscount}`);
      
      // If there are item-level discounts, set invoice-level discount
      if (totalItemDiscount > 0) {
        console.log(`[AutoInvoice] Creating invoice with discounts: ${totalItemDiscount}`);
        const invoice = await Invoice.create({
          invoiceNumber,
          jobId,
          customerId: job.customerId,
          tenantId,
          sourceType: 'job', // Set source type for business type filtering
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
      } else {
        console.log(`[AutoInvoice] Items exist but no discounts, will create invoice without discounts`);
      }
    } else {
      // If no items, use finalPrice from job
      console.log(`[AutoInvoice] No items found, using finalPrice: ${job.finalPrice}`);
      subtotal = parseFloat(job.finalPrice || 0);
      items = [{
        description: job.title,
        quantity: 1,
        unitPrice: subtotal,
        total: subtotal
      }];
    }

    // Create invoice without discounts (regular flow) - runs for items without discounts OR no items
    console.log(`[AutoInvoice] Creating invoice with subtotal: ${subtotal}, items count: ${items.length}`);
    const invoice = await Invoice.create({
      invoiceNumber,
      jobId,
      customerId: job.customerId,
      tenantId,
      sourceType: 'job', // Set source type for business type filtering
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
    
    console.log(`[AutoInvoice] ✅ Invoice created successfully: ${invoice.invoiceNumber} (ID: ${invoice.id})`);

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
    // Ensure tenantId is available (set by tenantContext middleware)
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || config.pagination.defaultPageSize;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status;
    const customerId = req.query.customerId;
    const assignedTo = req.query.assignedTo;

    // Start with tenant filter - CRITICAL for data isolation
    const where = applyTenantFilter(req.tenantId, {});
    
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
  const maxRetries = 5;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    // Use a transaction to ensure atomicity for each retry attempt
    let transaction = await sequelize.transaction();
    
    try {
      const { items, ...rawJobData } = req.body;
      const jobData = sanitizePayload(rawJobData);
      
      // Generate job number INSIDE the transaction with advisory lock
      // This ensures no race conditions - the lock serializes job number generation
      const jobNumber = await generateJobNumber(req.tenantId, transaction);
      
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
      }, { transaction });

      // Create job items if provided
      if (items && Array.isArray(items) && items.length > 0) {
        const jobItems = items.map(item => ({
          ...sanitizePayload(item),
          jobId: job.id,
          tenantId: req.tenantId,
          totalPrice: parseFloat(item.quantity) * parseFloat(item.unitPrice)
        }));
        await JobItem.bulkCreate(jobItems, { transaction });
      }

      await JobStatusHistory.create({
        jobId: job.id,
        tenantId: req.tenantId,
        status: job.status,
        comment: 'Job created',
        changedBy: req.user?.id || null
      }, { transaction });
      
      // Commit transaction before auto-creating invoice (invoice creation is separate)
      await transaction.commit();
      
      // Auto-create invoice for ALL new jobs (not just completed) - outside transaction
      let autoGeneratedInvoice = null;
      try {
        console.log(`[CreateJob] Attempting to auto-create invoice for job ${job.id}`);
        autoGeneratedInvoice = await autoCreateInvoice(job.id, req.tenantId);
        if (autoGeneratedInvoice) {
          console.log(`[CreateJob] ✅ Invoice auto-created: ${autoGeneratedInvoice.invoiceNumber}`);
        } else {
          console.log(`[CreateJob] ⚠️ No invoice was created (may already exist or job has no items/price)`);
        }
      } catch (invoiceError) {
        console.error('[CreateJob] ❌ Failed to auto-create invoice, but job was created:', invoiceError);
        console.error('[CreateJob] Error stack:', invoiceError.stack);
        // Don't fail the job creation if invoice creation fails
      }

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
      
      // Success - break out of retry loop
      return;
    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      
      // Check if it's a duplicate key error for jobNumber
      // Handle both Sequelize errors and raw PostgreSQL errors
      // For composite unique constraints, check the constraint name directly
      const constraintName = error?.original?.constraint || error?.constraint;
      const isJobNumberConstraint = constraintName === 'jobs_tenantId_jobNumber_key' || 
                                    constraintName === 'jobs_jobNumber_key' ||
                                    constraintName?.includes('jobNumber') ||
                                    constraintName?.includes('job_number');
      
      const hasJobNumberField = error?.fields?.jobNumber || 
                                (Array.isArray(error?.fields) && error.fields.includes('jobNumber')) ||
                                (error?.errors && Array.isArray(error.errors) && error.errors.some(e => e.path === 'jobNumber'));
      
      const hasJobNumberInMessage = error?.message?.includes('jobNumber') ||
                                    error?.message?.includes('job_number') ||
                                    error?.original?.message?.includes('jobNumber') ||
                                    error?.original?.message?.includes('job_number');
      
      const isSequelizeUniqueError = error?.name === 'SequelizeUniqueConstraintError';
      const isPostgresDuplicate = error?.original?.code === '23505';
      
      // It's a duplicate job number if:
      // 1. It's a unique constraint error AND
      // 2. The constraint is related to jobNumber OR the fields include jobNumber OR message mentions jobNumber
      const isDuplicateJobNumber = (isSequelizeUniqueError || isPostgresDuplicate) && 
                                    (isJobNumberConstraint || hasJobNumberField || hasJobNumberInMessage);
      
      if (isDuplicateJobNumber && retryCount < maxRetries - 1) {
        // Retry with a new job number
        retryCount++;
        console.log(`⚠️  Duplicate job number detected, retrying (attempt ${retryCount + 1}/${maxRetries})...`);
        console.log(`   Error details:`, {
          name: error?.name,
          code: error?.original?.code,
          constraint: constraintName,
          fields: error?.fields,
          errors: error?.errors?.map(e => ({ path: e.path, value: e.value })),
          message: error?.message,
          originalMessage: error?.original?.message,
          isJobNumberConstraint,
          hasJobNumberField,
          hasJobNumberInMessage
        });
        // Small delay to reduce race condition likelihood
        await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
        // Create new transaction for retry
        transaction = await sequelize.transaction();
        continue;
      } else {
        // Either not a duplicate error or max retries reached
        console.error(`❌ Job creation failed after ${retryCount + 1} attempts:`, error);
        next(error);
        return;
      }
    }
  }
  
  // If we get here, max retries exceeded
  next(new Error('Failed to create job after multiple attempts due to job number conflicts'));
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
      
      // Send WhatsApp order confirmation when status changes to 'in_progress'
      if (newStatus === 'in_progress' && oldStatus !== 'in_progress') {
        try {
          const whatsappService = require('../services/whatsappService');
          const whatsappTemplates = require('../services/whatsappTemplates');
          const config = await whatsappService.getConfig(req.tenantId);
          
          if (config && updatedJob.customer && updatedJob.customer.phone) {
            const phoneNumber = whatsappService.validatePhoneNumber(updatedJob.customer.phone);
            if (phoneNumber) {
              const parameters = whatsappTemplates.prepareOrderConfirmation(
                updatedJob,
                updatedJob.customer
              );
              
              await whatsappService.sendMessage(
                req.tenantId,
                phoneNumber,
                'order_confirmation',
                parameters
              ).catch(error => {
                console.error('[Job] WhatsApp send failed:', error);
              });
            }
          }
        } catch (error) {
          console.error('[Job] WhatsApp integration error:', error);
        }
      }
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


