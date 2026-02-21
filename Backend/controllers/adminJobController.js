const { Op } = require('sequelize');
const {
  Job,
  User,
  Lead,
  JobStatusHistory
} = require('../models');
const { sequelize } = require('../config/database');
const { getPagination } = require('../utils/paginationUtils');
const { sanitizePayload } = require('../utils/tenantUtils');

/**
 * Generate admin job number (format: ADMIN-JOB-YYYYMM-####)
 */
const generateAdminJobNumber = async (transaction = null) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const pattern = `ADMIN-JOB-${year}${month}-%`;
  
  try {
    // Use advisory lock if we have a transaction
    if (transaction) {
      const lockId = `admin_job_number_${year}${month}`.replace(/-/g, '_').substring(0, 63);
      const [lockHash] = await sequelize.query(
        `SELECT hashtext(:lockId) as lock_hash`,
        {
          replacements: { lockId },
          type: sequelize.QueryTypes.SELECT,
          transaction
        }
      );
      const lockKey = Math.abs(lockHash?.lock_hash || 0);
      await sequelize.query(`SELECT pg_advisory_xact_lock(:lockKey)`, {
        replacements: { lockKey },
        type: sequelize.QueryTypes.SELECT,
        transaction
      });
    }
    
    const queryResults = await sequelize.query(
      `SELECT "jobNumber",
              CAST(SPLIT_PART("jobNumber", '-', 4) AS INTEGER) as sequence
       FROM jobs 
       WHERE "tenantId" IS NULL
         AND "jobNumber" LIKE :pattern
         AND SPLIT_PART("jobNumber", '-', 4) ~ '^[0-9]+$'
       ORDER BY CAST(SPLIT_PART("jobNumber", '-', 4) AS INTEGER) DESC
       LIMIT 1`,
      {
        replacements: { pattern },
        type: sequelize.QueryTypes.SELECT,
        transaction
      }
    );
    
    let sequence = 1;
    if (queryResults && queryResults.length > 0 && queryResults[0].sequence) {
      sequence = parseInt(queryResults[0].sequence, 10) + 1;
    }
    
    return `ADMIN-JOB-${year}${month}-${String(sequence).padStart(4, '0')}`;
  } catch (error) {
    console.error('[AdminJobNumber] Error generating admin job number:', error);
    // Fallback
    const timestamp = Date.now().toString().slice(-6);
    return `ADMIN-JOB-${year}${month}-${timestamp}`;
  }
};

const buildAdminJobInclude = () => ([
  {
    model: User,
    as: 'assignedUser',
    attributes: ['id', 'name', 'email']
  },
  {
    model: User,
    as: 'creator',
    attributes: ['id', 'name', 'email']
  },
  {
    model: Lead,
    as: 'adminLead',
    attributes: ['id', 'name', 'company', 'email', 'phone'],
    where: { tenantId: null },
    required: false
  }
]);

/**
 * Get all admin jobs (where tenantId IS NULL)
 * Visible to all platform admins
 */
exports.getAdminJobs = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = req.query.search || '';
    const status = req.query.status;
    const assignedTo = req.query.assignedTo;
    const priority = req.query.priority;
    const adminLeadId = req.query.adminLeadId;
    const dueDateFilter = req.query.dueDate;

    // Admin jobs: tenantId IS NULL
    const where = {
      tenantId: null
    };
    
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
    if (assignedTo) {
      where.assignedTo = assignedTo;
    }
    if (priority) {
      where.priority = priority;
    }
    if (adminLeadId) {
      where.adminLeadId = adminLeadId;
    }
    if (dueDateFilter) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      if (dueDateFilter === 'overdue') {
        where.dueDate = { [Op.lt]: today };
      } else if (dueDateFilter === 'today') {
        where.dueDate = { [Op.between]: [today, tomorrow] };
      } else if (dueDateFilter === 'this_week') {
        where.dueDate = { [Op.between]: [today, nextWeek] };
      }
    }

    const { count, rows } = await Job.findAndCountAll({
      where,
      limit,
      offset,
      include: buildAdminJobInclude(),
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

/**
 * Get single admin job by ID
 */
exports.getAdminJob = async (req, res, next) => {
  try {
    const job = await Job.findOne({
      where: {
        id: req.params.id,
        tenantId: null // Ensure it's an admin job
      },
      include: [
        ...buildAdminJobInclude(),
        {
          model: JobStatusHistory,
          as: 'statusHistory',
          include: [{ model: User, as: 'changedByUser', attributes: ['id', 'name', 'email'] }],
          order: [['createdAt', 'ASC']]
        }
      ],
      order: [[{ model: JobStatusHistory, as: 'statusHistory' }, 'createdAt', 'ASC']]
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Admin job not found'
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

/**
 * Create new admin job
 */
exports.createAdminJob = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const jobData = sanitizePayload(req.body);
    
    // Generate admin job number
    const jobNumber = await generateAdminJobNumber(transaction);
    
    // Validate adminLeadId if provided
    if (jobData.adminLeadId) {
      const lead = await Lead.findOne({
        where: {
          id: jobData.adminLeadId,
          tenantId: null // Must be an admin lead
        },
        transaction
      });
      
      if (!lead) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Admin lead not found'
        });
      }
    }
    
    // Validate assignedTo is a platform admin if provided
    if (jobData.assignedTo) {
      const assignedUser = await User.findOne({
        where: {
          id: jobData.assignedTo,
          isPlatformAdmin: true
        },
        transaction
      });
      
      if (!assignedUser) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Assigned user must be a platform admin'
        });
      }
    }
    
    // If status is completed, set completion date
    if (jobData.status === 'completed') {
      jobData.completionDate = new Date();
    }

    const job = await Job.create({
      ...jobData,
      tenantId: null, // Admin job
      customerId: null, // No customer for admin jobs
      jobNumber,
      createdBy: req.user?.id || null
    }, { transaction });

    await JobStatusHistory.create({
      jobId: job.id,
      tenantId: null, // Admin job status history
      status: job.status,
      comment: 'Admin job created',
      changedBy: req.user?.id || null
    }, { transaction });
    
    await transaction.commit();

    const createdJob = await Job.findOne({
      where: { id: job.id, tenantId: null },
      include: [
        ...buildAdminJobInclude(),
        {
          model: JobStatusHistory,
          as: 'statusHistory',
          include: [{ model: User, as: 'changedByUser', attributes: ['id', 'name', 'email'] }],
          order: [['createdAt', 'ASC']]
        }
      ]
    });

    res.status(201).json({
      success: true,
      data: createdJob
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

/**
 * Update admin job
 */
exports.updateAdminJob = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const job = await Job.findOne({
      where: {
        id: req.params.id,
        tenantId: null // Ensure it's an admin job
      },
      transaction
    });

    if (!job) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Admin job not found'
      });
    }

    const { statusComment, ...rawPayload } = req.body;
    const updatePayload = sanitizePayload(rawPayload);
    
    const previousStatus = job.status;

    // Validate adminLeadId if provided
    if (updatePayload.adminLeadId !== undefined) {
      if (updatePayload.adminLeadId) {
        const lead = await Lead.findOne({
          where: {
            id: updatePayload.adminLeadId,
            tenantId: null
          },
          transaction
        });
        
        if (!lead) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: 'Admin lead not found'
          });
        }
      }
    }
    
    // Validate assignedTo is a platform admin if provided
    if (updatePayload.assignedTo !== undefined && updatePayload.assignedTo) {
      const assignedUser = await User.findOne({
        where: {
          id: updatePayload.assignedTo,
          isPlatformAdmin: true
        },
        transaction
      });
      
      if (!assignedUser) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Assigned user must be a platform admin'
        });
      }
    }

    // If status changed, update completion date
    if (updatePayload.status === 'completed' && previousStatus !== 'completed') {
      updatePayload.completionDate = new Date();
    } else if (updatePayload.status !== 'completed' && previousStatus === 'completed') {
      updatePayload.completionDate = null;
    }

    await job.update(updatePayload, { transaction });

    // Create status history entry if status changed
    if (updatePayload.status && updatePayload.status !== previousStatus) {
      await JobStatusHistory.create({
        jobId: job.id,
        tenantId: null,
        status: updatePayload.status,
        comment: statusComment || `Status changed from ${previousStatus} to ${updatePayload.status}`,
        changedBy: req.user?.id || null
      }, { transaction });
    }

    await transaction.commit();

    const updatedJob = await Job.findOne({
      where: { id: job.id, tenantId: null },
      include: [
        ...buildAdminJobInclude(),
        {
          model: JobStatusHistory,
          as: 'statusHistory',
          include: [{ model: User, as: 'changedByUser', attributes: ['id', 'name', 'email'] }],
          order: [['createdAt', 'ASC']]
        }
      ]
    });

    res.status(200).json({
      success: true,
      data: updatedJob
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

/**
 * Assign admin job to platform admin team member
 */
exports.assignAdminJob = async (req, res, next) => {
  try {
    const job = await Job.findOne({
      where: {
        id: req.params.id,
        tenantId: null // Ensure it's an admin job
      }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Admin job not found'
      });
    }

    const { assignedTo } = req.body;

    // Validate assignedTo is a platform admin
    if (assignedTo) {
      const assignedUser = await User.findOne({
        where: {
          id: assignedTo,
          isPlatformAdmin: true
        }
      });
      
      if (!assignedUser) {
        return res.status(400).json({
          success: false,
          message: 'Assigned user must be a platform admin'
        });
      }
    }

    await job.update({ assignedTo });

    // Create status history entry
    await JobStatusHistory.create({
      jobId: job.id,
      tenantId: null,
      status: job.status,
      comment: assignedTo 
        ? `Job assigned to ${assignedUser.name}` 
        : 'Job assignment removed',
      changedBy: req.user?.id || null
    });

    const updatedJob = await Job.findOne({
      where: { id: job.id, tenantId: null },
      include: buildAdminJobInclude()
    });

    res.status(200).json({
      success: true,
      data: updatedJob
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete admin job
 */
exports.deleteAdminJob = async (req, res, next) => {
  try {
    const job = await Job.findOne({
      where: {
        id: req.params.id,
        tenantId: null // Ensure it's an admin job
      }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Admin job not found'
      });
    }

    await job.destroy();
    res.status(200).json({
      success: true,
      message: 'Admin job deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get admin job statistics
 */
exports.getAdminJobStats = async (req, res, next) => {
  try {
    const where = { tenantId: null };

    const [
      total,
      byStatus,
      byPriority,
      overdue,
      byAssigned
    ] = await Promise.all([
      Job.count({ where }),
      Job.findAll({
        where,
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      }),
      Job.findAll({
        where,
        attributes: [
          'priority',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['priority'],
        raw: true
      }),
      Job.count({
        where: {
          ...where,
          dueDate: {
            [Op.lt]: new Date()
          },
          status: {
            [Op.notIn]: ['completed', 'cancelled']
          }
        }
      }),
      Job.findAll({
        where,
        attributes: [
          'assignedTo',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['assignedTo'],
        include: [{
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'name', 'email'],
          required: false
        }],
        raw: false
      })
    ]);

    const statusMap = {};
    byStatus.forEach(item => {
      statusMap[item.status] = parseInt(item.count);
    });

    const priorityMap = {};
    byPriority.forEach(item => {
      priorityMap[item.priority] = parseInt(item.count);
    });

    const assignedMap = {};
    byAssigned.forEach(item => {
      const userId = item.assignedTo || 'unassigned';
      assignedMap[userId] = {
        count: parseInt(item.count),
        user: item.assignedUser ? {
          id: item.assignedUser.id,
          name: item.assignedUser.name,
          email: item.assignedUser.email
        } : null
      };
    });

    res.status(200).json({
      success: true,
      data: {
        total,
        byStatus: statusMap,
        byPriority: priorityMap,
        overdue,
        byAssigned: assignedMap
      }
    });
  } catch (error) {
    next(error);
  }
};
