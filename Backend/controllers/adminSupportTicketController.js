const { Op } = require('sequelize');
const { SupportTicket, Tenant, User } = require('../models');
const { getPagination } = require('../utils/paginationUtils');
const { sanitizePayload } = require('../utils/tenantUtils');

const TICKET_STATUSES = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const ticketIncludes = [
  { model: Tenant, as: 'tenant', attributes: ['id', 'name', 'slug', 'status', 'plan', 'businessType'] },
  { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
  { model: User, as: 'assignee', attributes: ['id', 'name', 'email'] },
];

exports.getSupportTickets = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = req.query.search;
    const status = req.query.status;
    const priority = req.query.priority;
    const tenantId = req.query.tenantId;
    const assignedTo = req.query.assignedTo;

    const where = {};
    if (tenantId) where.tenantId = tenantId;
    if (status && status !== 'all') where.status = status;
    if (priority && priority !== 'all') where.priority = priority;
    if (assignedTo) where.assignedTo = assignedTo;
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { category: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await SupportTicket.findAndCountAll({
      where,
      limit,
      offset,
      order: [['updatedAt', 'DESC']],
      include: ticketIncludes,
    });

    res.status(200).json({
      success: true,
      count,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
      data: rows,
    });
  } catch (error) {
    next(error);
  }
};

exports.getSupportTicket = async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findByPk(req.params.id, {
      include: ticketIncludes,
    });
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Support ticket not found' });
    }
    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
};

exports.createSupportTicket = async (req, res, next) => {
  try {
    const payload = {
      ...sanitizePayload(req.body),
      tenantId: req.body?.tenantId,
    };
    if (!payload.title?.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    if (!payload.tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant is required' });
    }

    const tenant = await Tenant.findByPk(payload.tenantId, { attributes: ['id'] });
    if (!tenant) {
      return res.status(400).json({ success: false, message: 'Tenant not found' });
    }

    const status = TICKET_STATUSES.includes(payload.status) ? payload.status : 'open';
    const priority = TICKET_PRIORITIES.includes(payload.priority) ? payload.priority : 'medium';

    const ticket = await SupportTicket.create({
      tenantId: payload.tenantId,
      title: String(payload.title).trim(),
      description: payload.description || null,
      status,
      priority,
      category: payload.category || null,
      source: payload.source || 'admin_manual',
      createdBy: req.user?.id || null,
      assignedTo: payload.assignedTo || null,
      metadata: payload.metadata || {},
      resolvedAt: status === 'resolved' || status === 'closed' ? new Date() : null,
    });

    const created = await SupportTicket.findByPk(ticket.id, { include: ticketIncludes });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
};

exports.updateSupportTicket = async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findByPk(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Support ticket not found' });
    }

    const payload = sanitizePayload(req.body);
    const updates = {};

    if (payload.title != null) updates.title = String(payload.title).trim();
    if (payload.description !== undefined) updates.description = payload.description;
    if (payload.category !== undefined) updates.category = payload.category;
    if (payload.assignedTo !== undefined) updates.assignedTo = payload.assignedTo || null;
    if (payload.metadata !== undefined) updates.metadata = payload.metadata;

    if (payload.status != null) {
      if (!TICKET_STATUSES.includes(payload.status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Expected one of: ${TICKET_STATUSES.join(', ')}`,
        });
      }
      updates.status = payload.status;
      if (payload.status === 'resolved' || payload.status === 'closed') {
        updates.resolvedAt = payload.resolvedAt ? new Date(payload.resolvedAt) : new Date();
      } else {
        updates.resolvedAt = null;
      }
    }

    if (payload.priority != null) {
      if (!TICKET_PRIORITIES.includes(payload.priority)) {
        return res.status(400).json({
          success: false,
          message: `Invalid priority. Expected one of: ${TICKET_PRIORITIES.join(', ')}`,
        });
      }
      updates.priority = payload.priority;
    }

    await ticket.update(updates);
    const updated = await SupportTicket.findByPk(ticket.id, { include: ticketIncludes });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};
