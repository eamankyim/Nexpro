const { UserTodo, UserWeekFocus, UserTask, UserChecklist, UserChecklistItem, UserTenant } = require('../models');
const { Op } = require('sequelize');

const ALLOWED_TASK_STATUSES = ['todo', 'in_progress', 'on_hold', 'completed'];

/**
 * Get Monday of the week for a given date (YYYY-MM-DD)
 * @param {Date} d
 * @returns {string}
 */
const getWeekStart = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  return monday.toISOString().slice(0, 10);
};

/**
 * Get todos for the current user
 */
exports.getTodos = async (req, res, next) => {
  try {
    const todos = await UserTodo.findAll({
      where: { userId: req.user.id },
      order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']]
    });
    res.status(200).json({ success: true, data: todos });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new todo
 */
exports.createTodo = async (req, res, next) => {
  try {
    const { title, dueDate } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const count = await UserTodo.count({ where: { userId: req.user.id } });
    const todo = await UserTodo.create({
      userId: req.user.id,
      title: title.trim(),
      done: false,
      dueDate: dueDate || null,
      sortOrder: count
    });
    res.status(201).json({ success: true, data: todo });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a todo (toggle done, edit title, etc.)
 */
exports.updateTodo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, done, dueDate, sortOrder } = req.body;

    const todo = await UserTodo.findOne({ where: { id, userId: req.user.id } });
    if (!todo) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }

    if (title !== undefined) todo.title = typeof title === 'string' ? title.trim() : todo.title;
    if (done !== undefined) todo.done = Boolean(done);
    if (dueDate !== undefined) todo.dueDate = dueDate || null;
    if (sortOrder !== undefined) todo.sortOrder = parseInt(sortOrder, 10) || 0;

    await todo.save();
    res.status(200).json({ success: true, data: todo });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a todo
 */
exports.deleteTodo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const todo = await UserTodo.findOne({ where: { id, userId: req.user.id } });
    if (!todo) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }
    await todo.destroy();
    res.status(200).json({ success: true, data: { id } });
  } catch (error) {
    next(error);
  }
};

/**
 * Get week focus for the current week
 */
exports.getWeekFocus = async (req, res, next) => {
  try {
    const weekStart = req.query.weekStart || getWeekStart(new Date());
    const focus = await UserWeekFocus.findOne({
      where: { userId: req.user.id, weekStart: weekStart }
    });
    const items = focus ? (focus.items || []) : [];
    res.status(200).json({
      success: true,
      data: { weekStart, items }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update week focus (upsert)
 */
exports.updateWeekFocus = async (req, res, next) => {
  try {
    const weekStart = req.body.weekStart || getWeekStart(new Date());
    const items = Array.isArray(req.body.items) ? req.body.items : [];

    const normalized = items
      .filter((i) => i && typeof i.text === 'string' && i.text.trim())
      .map((i, idx) => ({ text: i.text.trim(), order: idx }));

    const [focus] = await UserWeekFocus.findOrCreate({
      where: { userId: req.user.id, weekStart },
      defaults: { userId: req.user.id, weekStart, items: normalized }
    });

    if (!focus.isNewRecord) {
      focus.items = normalized;
      await focus.save();
    }

    res.status(200).json({
      success: true,
      data: { weekStart, items: focus.items }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get tasks for the current tenant workspace.
 * Returns:
 *  - All non-private tasks for the tenant
 *  - Plus the current user's private tasks
 */
exports.getTasks = async (req, res, next) => {
  try {
    const { status } = req.query;

    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required for workspace tasks'
      });
    }

    const where = {
      tenantId: req.tenantId,
      [Op.or]: [
        { isPrivate: false },
        { userId: req.user.id }
      ]
    };

    if (status && typeof status === 'string') {
      where.status = status;
    }

    const tasks = await UserTask.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new workspace task
 */
exports.createTask = async (req, res, next) => {
  try {
    const { title, status, dueDate, priority, description, isPrivate, assigneeId } = req.body;

    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required for workspace tasks'
      });
    }

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    let normalizedStatus = typeof status === 'string' && status.trim()
      ? status.trim()
      : 'todo';
    if (!ALLOWED_TASK_STATUSES.includes(normalizedStatus)) {
      normalizedStatus = 'todo';
    }

    let finalAssigneeId = null;
    if (assigneeId) {
      const membership = await UserTenant.findOne({
        where: {
          userId: assigneeId,
          tenantId: req.tenantId,
          status: 'active'
        }
      });
      if (!membership) {
        return res.status(400).json({ success: false, message: 'Assignee must be a member of this workspace' });
      }
      finalAssigneeId = assigneeId;
    }

    const task = await UserTask.create({
      tenantId: req.tenantId,
      userId: req.user.id,
      title: title.trim(),
      status: normalizedStatus,
      dueDate: dueDate || null,
      priority: priority || null,
      description: description || null,
      assigneeId: finalAssigneeId,
      isPrivate: Boolean(isPrivate)
    });

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a workspace task
 * Only the creator can update for now.
 */
exports.updateTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, status, dueDate, priority, description, isPrivate, assigneeId } = req.body;

    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required for workspace tasks'
      });
    }

    const task = await UserTask.findOne({
      where: {
        id,
        tenantId: req.tenantId,
        userId: req.user.id
      }
    });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (title !== undefined && typeof title === 'string' && title.trim()) {
      task.title = title.trim();
    }
    if (status !== undefined && typeof status === 'string' && status.trim()) {
      const nextStatus = status.trim();
      task.status = ALLOWED_TASK_STATUSES.includes(nextStatus) ? nextStatus : task.status;
    }
    if (dueDate !== undefined) {
      task.dueDate = dueDate || null;
    }
    if (priority !== undefined) {
      task.priority = priority || null;
    }
    if (description !== undefined) {
      task.description = description || null;
    }
    if (assigneeId !== undefined) {
      if (!assigneeId) {
        task.assigneeId = null;
      } else {
        const membership = await UserTenant.findOne({
          where: {
            userId: assigneeId,
            tenantId: req.tenantId,
            status: 'active'
          }
        });
        if (!membership) {
          return res.status(400).json({ success: false, message: 'Assignee must be a member of this workspace' });
        }
        task.assigneeId = assigneeId;
      }
    }
    if (isPrivate !== undefined) {
      task.isPrivate = Boolean(isPrivate);
    }

    await task.save();
    res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a workspace task
 */
exports.deleteTask = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required for workspace tasks'
      });
    }

    const task = await UserTask.findOne({
      where: {
        id,
        tenantId: req.tenantId,
        userId: req.user.id
      }
    });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    await task.destroy();
    res.status(200).json({ success: true, data: { id } });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all checklists for the tenant with visible items for the current user.
 */
exports.getChecklists = async (req, res, next) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required for workspace checklists'
      });
    }

    const checklists = await UserChecklist.findAll({
      where: { tenantId: req.tenantId },
      order: [['createdAt', 'ASC']]
    });

    if (checklists.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const checklistIds = checklists.map((c) => c.id);

    const items = await UserChecklistItem.findAll({
      where: {
        checklistId: { [Op.in]: checklistIds },
        [Op.or]: [
          { isPrivate: false },
          { userId: req.user.id }
        ]
      },
      order: [['order', 'ASC'], ['createdAt', 'ASC']]
    });

    const itemsByChecklist = items.reduce((acc, item) => {
      const key = item.checklistId;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    const result = checklists.map((cl) => ({
      ...cl.toJSON(),
      items: itemsByChecklist[cl.id] || []
    }));

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new checklist
 */
exports.createChecklist = async (req, res, next) => {
  try {
    const { title } = req.body;

    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required for workspace checklists'
      });
    }

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const checklist = await UserChecklist.create({
      tenantId: req.tenantId,
      userId: req.user.id,
      title: title.trim()
    });

    res.status(201).json({ success: true, data: checklist });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a checklist (e.g. rename)
 */
exports.updateChecklist = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required for workspace checklists'
      });
    }

    const checklist = await UserChecklist.findOne({
      where: {
        id,
        tenantId: req.tenantId,
        userId: req.user.id
      }
    });

    if (!checklist) {
      return res.status(404).json({ success: false, message: 'Checklist not found' });
    }

    if (title && typeof title === 'string' && title.trim()) {
      checklist.title = title.trim();
    }

    await checklist.save();
    res.status(200).json({ success: true, data: checklist });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a checklist (and its items)
 */
exports.deleteChecklist = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required for workspace checklists'
      });
    }

    const checklist = await UserChecklist.findOne({
      where: {
        id,
        tenantId: req.tenantId,
        userId: req.user.id
      }
    });

    if (!checklist) {
      return res.status(404).json({ success: false, message: 'Checklist not found' });
    }

    await checklist.destroy();
    res.status(200).json({ success: true, data: { id } });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a checklist item
 */
exports.createChecklistItem = async (req, res, next) => {
  try {
    const { checklistId } = req.params;
    const { label, isPrivate } = req.body;

    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required for workspace checklists'
      });
    }

    if (!label || typeof label !== 'string' || !label.trim()) {
      return res.status(400).json({ success: false, message: 'Label is required' });
    }

    const checklist = await UserChecklist.findOne({
      where: {
        id: checklistId,
        tenantId: req.tenantId
      }
    });

    if (!checklist) {
      return res.status(404).json({ success: false, message: 'Checklist not found' });
    }

    const count = await UserChecklistItem.count({
      where: { checklistId }
    });

    const item = await UserChecklistItem.create({
      checklistId,
      userId: req.user.id,
      label: label.trim(),
      done: false,
      order: count,
      isPrivate: Boolean(isPrivate)
    });

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a checklist item
 */
exports.updateChecklistItem = async (req, res, next) => {
  try {
    const { checklistId, itemId } = req.params;
    const { label, done, order, isPrivate } = req.body;

    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required for workspace checklists'
      });
    }

    const item = await UserChecklistItem.findOne({
      where: {
        id: itemId,
        checklistId,
        userId: req.user.id
      }
    });

    if (!item) {
      return res.status(404).json({ success: false, message: 'Checklist item not found' });
    }

    if (label !== undefined && typeof label === 'string' && label.trim()) {
      item.label = label.trim();
    }
    if (done !== undefined) {
      item.done = Boolean(done);
    }
    if (order !== undefined) {
      item.order = parseInt(order, 10) || 0;
    }
    if (isPrivate !== undefined) {
      item.isPrivate = Boolean(isPrivate);
    }

    await item.save();
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a checklist item
 */
exports.deleteChecklistItem = async (req, res, next) => {
  try {
    const { checklistId, itemId } = req.params;

    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context is required for workspace checklists'
      });
    }

    const item = await UserChecklistItem.findOne({
      where: {
        id: itemId,
        checklistId,
        userId: req.user.id
      }
    });

    if (!item) {
      return res.status(404).json({ success: false, message: 'Checklist item not found' });
    }

    await item.destroy();
    res.status(200).json({ success: true, data: { id: itemId } });
  } catch (error) {
    next(error);
  }
};


