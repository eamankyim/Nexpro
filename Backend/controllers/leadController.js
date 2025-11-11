const { Op, Sequelize } = require('sequelize');
const {
  Lead,
  LeadActivity,
  User,
  Customer,
  Job
} = require('../models');
const { sequelize } = require('../config/database');
const config = require('../config/config');
const notificationService = require('../services/notificationService');

const logLeadDebug = (...args) => {
  if (config.nodeEnv === 'development') {
    console.log('[LeadController]', ...args);
  }
};

const buildLeadInclude = () => ([
  {
    model: User,
    as: 'assignee',
    attributes: ['id', 'name', 'email']
  },
  {
    model: Customer,
    as: 'convertedCustomer',
    attributes: ['id', 'name', 'company']
  },
  {
    model: Job,
    as: 'convertedJob',
    attributes: ['id', 'jobNumber', 'title']
  }
]);

exports.getLeads = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || config.pagination.defaultPageSize;
    const offset = (page - 1) * limit;

    const search = req.query.search;
    const status = req.query.status;
    const assignedTo = req.query.assignedTo;
    const priority = req.query.priority;
    const source = req.query.source;
    const isActive = req.query.isActive;

    const where = {};

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { company: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } }
      ];
    }
    if (status && status !== 'all') {
      where.status = status;
    }
    if (assignedTo) {
      where.assignedTo = assignedTo;
    }
    if (priority && priority !== 'all') {
      where.priority = priority;
    }
    if (source && source !== 'all') {
      where.source = source;
    }
    if (isActive !== undefined && isActive !== 'all') {
      where.isActive = isActive === 'true';
    }

    const { count, rows } = await Lead.findAndCountAll({
      where,
      limit,
      offset,
      order: [['nextFollowUp', 'ASC'], ['createdAt', 'DESC']],
      include: buildLeadInclude()
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

exports.getLead = async (req, res, next) => {
  try {
    const lead = await Lead.findByPk(req.params.id, {
      include: [
        ...buildLeadInclude(),
        {
          model: LeadActivity,
          as: 'activities',
          include: [{ model: User, as: 'createdByUser', attributes: ['id', 'name', 'email'] }],
          order: [['createdAt', 'DESC']]
        }
      ]
    });

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    res.status(200).json({ success: true, data: lead });
  } catch (error) {
    next(error);
  }
};

exports.createLead = async (req, res, next) => {
  try {
    const lead = await Lead.create({
      name: req.body.name,
      company: req.body.company || null,
      email: req.body.email || null,
      phone: req.body.phone || null,
      source: req.body.source || 'unknown',
      status: req.body.status || 'new',
      priority: req.body.priority || 'medium',
      assignedTo: req.body.assignedTo || null,
      nextFollowUp: req.body.nextFollowUp || null,
      lastContactedAt: req.body.lastContactedAt || null,
      notes: req.body.notes || null,
      tags: req.body.tags || [],
      metadata: req.body.metadata || {},
      convertedCustomerId: req.body.convertedCustomerId || null,
      convertedJobId: req.body.convertedJobId || null
    });

    const createdLead = await Lead.findByPk(lead.id, { include: buildLeadInclude() });

    if (createdLead && createdLead.assignedTo) {
      try {
        await notificationService.notifyLeadCreated({
          lead: createdLead,
          triggeredBy: req.user?.id || null
        });
      } catch (notificationError) {
        console.error('[LeadController] Failed to send lead created notification', notificationError);
      }
    }

    res.status(201).json({ success: true, data: createdLead });
  } catch (error) {
    next(error);
  }
};

exports.updateLead = async (req, res, next) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const previousStatus = lead.status;

    const fields = [
      'name', 'company', 'email', 'phone', 'source', 'status', 'priority',
      'assignedTo', 'nextFollowUp', 'lastContactedAt', 'notes', 'tags',
      'metadata', 'convertedCustomerId', 'convertedJobId', 'isActive'
    ];

    const updates = {};
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    await lead.update(updates);
    const updatedLead = await Lead.findByPk(lead.id, { include: buildLeadInclude() });

    if (updates.status && updates.status !== previousStatus) {
      await notificationService.notifyLeadStatusChanged({
        lead: updatedLead,
        oldStatus: previousStatus,
        newStatus: updates.status,
        triggeredBy: req.user?.id || null
      });
    }

    res.status(200).json({ success: true, data: updatedLead });
  } catch (error) {
    next(error);
  }
};

exports.deleteLead = async (req, res, next) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    await lead.update({ isActive: false, status: 'lost' });
    res.status(200).json({ success: true, message: 'Lead archived' });
  } catch (error) {
    next(error);
  }
};

exports.addLeadActivity = async (req, res, next) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const activity = await LeadActivity.create({
      leadId: lead.id,
      type: req.body.type || 'note',
      subject: req.body.subject || null,
      notes: req.body.notes || null,
      createdBy: req.user?.id || null,
      nextStep: req.body.nextStep || null,
      followUpDate: req.body.followUpDate || null,
      metadata: req.body.metadata || {}
    });

    if (req.body.followUpDate) {
      await lead.update({ nextFollowUp: req.body.followUpDate });
    }
    if (req.body.updateStatus) {
      await lead.update({ status: req.body.updateStatus });
    }

    const populatedActivity = await LeadActivity.findByPk(activity.id, {
      include: [{ model: User, as: 'createdByUser', attributes: ['id', 'name', 'email'] }]
    });

    await notificationService.notifyLeadActivityLogged({
      lead,
      activity: populatedActivity,
      triggeredBy: req.user?.id || null
    });

    res.status(201).json({ success: true, data: populatedActivity });
  } catch (error) {
    next(error);
  }
};

exports.getLeadActivities = async (req, res, next) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const activities = await LeadActivity.findAll({
      where: { leadId: lead.id },
      order: [['createdAt', 'DESC']],
      include: [{ model: User, as: 'createdByUser', attributes: ['id', 'name', 'email'] }]
    });

    res.status(200).json({ success: true, data: activities });
  } catch (error) {
    next(error);
  }
};

exports.getLeadSummary = async (req, res, next) => {
  try {
    const [summary] = await Lead.findAll({
      attributes: [
        [Sequelize.fn('COUNT', Sequelize.col('Lead.id')), 'totalLeads'],
        [Sequelize.fn('SUM', Sequelize.literal(`CASE WHEN status = 'new' THEN 1 ELSE 0 END`)), 'newLeads'],
        [Sequelize.fn('SUM', Sequelize.literal(`CASE WHEN status = 'qualified' THEN 1 ELSE 0 END`)), 'qualifiedLeads'],
        [Sequelize.fn('SUM', Sequelize.literal(`CASE WHEN status = 'converted' THEN 1 ELSE 0 END`)), 'convertedLeads'],
        [Sequelize.fn('SUM', Sequelize.literal(`CASE WHEN status = 'lost' THEN 1 ELSE 0 END`)), 'lostLeads']
      ]
    });

    const upcomingFollowUps = await Lead.findAll({
      where: {
        nextFollowUp: {
          [Op.ne]: null,
          [Op.lte]: Sequelize.literal("NOW() + interval '7 days'")
        },
        isActive: true
      },
      order: [['nextFollowUp', 'ASC']],
      limit: 5,
      include: buildLeadInclude()
    });

    res.status(200).json({
      success: true,
      data: {
        totals: summary ? summary.toJSON() : {},
        upcomingFollowUps
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.convertLead = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const lead = await Lead.findByPk(req.params.id, {
      include: buildLeadInclude(),
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!lead) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const previousStatus = lead.status;

    if (lead.convertedCustomerId) {
      await transaction.commit();
      return res.status(200).json({
        success: true,
        data: lead,
        message: 'Lead already converted'
      });
    }

    const customerPayload = {
      name: lead.name || lead.company || 'New Customer',
      company: lead.company || null,
      email: lead.email || null,
      phone: lead.phone || null,
      notes: lead.notes || null
    };

    const customer = await Customer.create(customerPayload, { transaction });

    await lead.update(
      {
        status: 'converted',
        convertedCustomerId: customer.id,
        isActive: false
      },
      { transaction }
    );

    await LeadActivity.create(
      {
        leadId: lead.id,
        type: 'note',
        subject: 'Lead Converted',
        notes: `Lead converted to customer ${customer.name}`,
        createdBy: req.user?.id || null,
        metadata: {
          customerId: customer.id
        }
      },
      { transaction }
    );

    await transaction.commit();

    const updatedLead = await Lead.findByPk(lead.id, { include: buildLeadInclude() });

    await notificationService.notifyLeadStatusChanged({
      lead: updatedLead,
      oldStatus: previousStatus,
      newStatus: 'converted',
      triggeredBy: req.user?.id || null
    });

    res.status(200).json({
      success: true,
      data: updatedLead,
      customer
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};


