const { Op } = require('sequelize');
const { Job, Sale, Customer, SaleActivity, User, UserTenant } = require('../models');
const { sequelize } = require('../config/database');
const { applyTenantFilter } = require('../utils/tenantUtils');
const { applyShopFilter } = require('../utils/shopUtils');
const { applyStudioLocationFilter } = require('../utils/studioLocationUtils');
const { parseDeliveryStatusInput } = require('../utils/deliveryStatus');
const { invalidateSaleListCache } = require('../middleware/cache');
const { getEffectiveRole } = require('../middleware/auth');

const DELIVERY_LABELS = {
  ready_for_delivery: 'Ready for delivery',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  returned: 'Returned'
};

const MAX_BULK_UPDATES = 40;
const DRIVER_ROLE = 'driver';

const ACTIVE_DELIVERY_OR_NULL = {
  [Op.or]: [
    { deliveryStatus: null },
    { deliveryStatus: 'ready_for_delivery' },
    { deliveryStatus: 'out_for_delivery' }
  ]
};

const DRIVER_ACTIVE_DELIVERY_ONLY = {
  [Op.or]: [{ deliveryStatus: 'ready_for_delivery' }, { deliveryStatus: 'out_for_delivery' }],
};

const DRIVER_ALLOWED_NEXT_STATUSES = {
  ready_for_delivery: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
};

const isDriverRequest = (req) => getEffectiveRole(req) === DRIVER_ROLE;

const canAssignDriver = (req) => ['admin', 'manager'].includes(getEffectiveRole(req));

const normalizeAssignedDriver = (value) => {
  if (value == null || value === '') return null;
  return String(value);
};

const assertAssignedDriverIsValid = async (tenantId, userId) => {
  if (!userId) return { ok: true };
  const membership = await UserTenant.findOne({
    where: {
      tenantId,
      userId,
      role: DRIVER_ROLE,
      status: 'active',
    },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'isActive'],
        required: true,
      },
    ],
  });
  if (!membership || membership.user?.isActive === false) {
    return { ok: false, message: 'deliveryAssignedTo must be an active driver in this workspace' };
  }
  return { ok: true };
};

const enforceDriverStatusTransition = ({ currentStatus, nextStatus }) => {
  if (!nextStatus) {
    return { ok: false, message: 'Drivers cannot clear delivery status' };
  }
  if (nextStatus === 'returned') {
    return { ok: false, message: 'Drivers cannot mark deliveries as returned' };
  }
  const from = currentStatus || 'ready_for_delivery';
  const allowed = DRIVER_ALLOWED_NEXT_STATUSES[from] || [];
  if (!allowed.includes(nextStatus)) {
    return {
      ok: false,
      message: `Driver status transition not allowed (${from} -> ${nextStatus})`,
    };
  }
  return { ok: true };
};

function formatAddressSummary(customer) {
  if (!customer) return null;
  const parts = [customer.address, customer.city, customer.state].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function formatJobRow(job) {
  const j = job.toJSON ? job.toJSON() : job;
  const c = j.customer;
  return {
    entityType: 'job',
    id: j.id,
    reference: j.jobNumber,
    title: j.title,
    customerName: c?.name || c?.company || null,
    customerPhone: c?.phone || null,
    addressSummary: formatAddressSummary(c),
    completedAt: j.completionDate || j.updatedAt,
    deliveryStatus: j.deliveryStatus || null,
    deliveryAssignedTo: j.deliveryAssignedTo || null,
    deliveryAssignedAt: j.deliveryAssignedAt || null,
    deliveredBy: j.deliveredBy || null,
    deliveredAt: j.deliveredAt || null,
    total: null
  };
}

function formatSaleRow(sale) {
  const s = sale.toJSON ? sale.toJSON() : sale;
  const c = s.customer;
  return {
    entityType: 'sale',
    id: s.id,
    reference: s.saleNumber,
    title: null,
    customerName: c?.name || c?.company || 'Walk-in',
    customerPhone: c?.phone || null,
    addressSummary: formatAddressSummary(c),
    completedAt: s.updatedAt,
    deliveryStatus: s.deliveryStatus || null,
    deliveryAssignedTo: s.deliveryAssignedTo || null,
    deliveryAssignedAt: s.deliveryAssignedAt || null,
    deliveredBy: s.deliveredBy || null,
    deliveredAt: s.deliveredAt || null,
    total: s.total != null ? Number(s.total) : null
  };
}

function applyJobScope(req, where) {
  return applyStudioLocationFilter(req, where);
}

function applySaleScope(req, where) {
  return applyShopFilter(req, where);
}

/**
 * @desc    List completed jobs and sales in the delivery queue (or recent finished deliveries)
 * @route   GET /api/deliveries/queue
 * @access  Private (tenant)
 */
exports.getDeliveryQueue = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const scope = req.query.scope === 'done' ? 'done' : 'active';
    const isDriver = isDriverRequest(req);

    const customerInclude = {
      model: Customer,
      as: 'customer',
      attributes: ['id', 'name', 'company', 'phone', 'address', 'city', 'state']
    };

    if (scope === 'active') {
      const jobWhere = applyJobScope(req, applyTenantFilter(tenantId, {
        status: 'completed',
        ...(isDriver ? DRIVER_ACTIVE_DELIVERY_ONLY : ACTIVE_DELIVERY_OR_NULL),
        ...(isDriver ? { deliveryAssignedTo: req.user.id } : {}),
      }));
      const saleWhere = applySaleScope(req, applyTenantFilter(tenantId, {
        status: 'completed',
        ...(isDriver ? DRIVER_ACTIVE_DELIVERY_ONLY : ACTIVE_DELIVERY_OR_NULL),
        ...(isDriver ? { deliveryAssignedTo: req.user.id } : {}),
      }));

      const [jobs, sales] = await Promise.all([
        Job.findAll({
          where: jobWhere,
          include: [customerInclude],
          order: [
            ['completionDate', 'DESC'],
            ['updatedAt', 'DESC']
          ]
        }),
        Sale.findAll({
          where: saleWhere,
          include: [customerInclude],
          order: [['updatedAt', 'DESC']]
        })
      ]);

      const rows = [...jobs.map(formatJobRow), ...sales.map(formatSaleRow)].sort(
        (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
      );

      return res.status(200).json({ success: true, data: { scope, rows } });
    }

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const terminal = { [Op.in]: ['delivered', 'returned'] };

    const jobWhere = applyJobScope(req, applyTenantFilter(tenantId, {
      status: 'completed',
      deliveryStatus: terminal,
      updatedAt: { [Op.gte]: ninetyDaysAgo },
      ...(isDriver ? { deliveredBy: req.user.id } : {}),
    }));
    const saleWhere = applySaleScope(req, applyTenantFilter(tenantId, {
      status: 'completed',
      deliveryStatus: terminal,
      updatedAt: { [Op.gte]: ninetyDaysAgo },
      ...(isDriver ? { deliveredBy: req.user.id } : {}),
    }));

    const [jobs, sales] = await Promise.all([
      Job.findAll({
        where: jobWhere,
        include: [customerInclude],
        order: [['updatedAt', 'DESC']]
      }),
      Sale.findAll({
        where: saleWhere,
        include: [customerInclude],
        order: [['updatedAt', 'DESC']]
      })
    ]);

    const rows = [...jobs.map(formatJobRow), ...sales.map(formatSaleRow)].sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );

    return res.status(200).json({ success: true, data: { scope: 'done', rows } });
  } catch (err) {
    next(err);
  }
};

async function updateJobDeliveryStatus(
  req,
  { tenantId, jobId, deliveryStatus, deliveryAssignedTo, hasAssignedDriverField, userId }
) {
  const isDriver = isDriverRequest(req);
  const normalizedAssignedDriver = normalizeAssignedDriver(deliveryAssignedTo);
  const parsed = parseDeliveryStatusInput(deliveryStatus);
  if (parsed === undefined && deliveryStatus !== undefined) {
    return { ok: false, message: 'Invalid deliveryStatus' };
  }
  if (isDriver && hasAssignedDriverField) {
    return { ok: false, message: 'Drivers cannot assign deliveries' };
  }
  if (!isDriver && hasAssignedDriverField) {
    if (!canAssignDriver(req)) return { ok: false, message: 'Only managers/admins can assign drivers' };
  }
  if (!isDriver && hasAssignedDriverField && normalizedAssignedDriver) {
    const validAssignee = await assertAssignedDriverIsValid(tenantId, normalizedAssignedDriver);
    if (!validAssignee.ok) return { ok: false, message: validAssignee.message };
  }

  const job = await Job.findOne({
    where: applyJobScope(req, applyTenantFilter(tenantId, { id: jobId }))
  });
  if (!job) {
    return { ok: false, message: 'Job not found' };
  }
  if (job.status !== 'completed') {
    return { ok: false, message: 'Only completed jobs can use delivery status here' };
  }
  if (isDriver && job.deliveryAssignedTo !== userId) {
    return { ok: false, message: 'This delivery is not assigned to you' };
  }

  if (isDriver) {
    const guard = enforceDriverStatusTransition({
      currentStatus: job.deliveryStatus || null,
      nextStatus: parsed,
    });
    if (!guard.ok) return { ok: false, message: guard.message };
  }

  const updates = {};
  if (deliveryStatus !== undefined) {
    updates.deliveryStatus = parsed;
    if (parsed) updates.deliveryRequired = true;
    if (parsed === 'delivered' || parsed === 'returned') {
      updates.deliveredBy = userId || null;
      updates.deliveredAt = new Date();
    } else {
      updates.deliveredBy = null;
      updates.deliveredAt = null;
    }
  }
  if (hasAssignedDriverField) {
    updates.deliveryAssignedTo = normalizedAssignedDriver;
    updates.deliveryAssignedAt = new Date();
  }

  await job.update(updates);
  return { ok: true };
}

async function updateSaleDeliveryStatus(
  req,
  { tenantId, saleId, deliveryStatus, deliveryAssignedTo, hasAssignedDriverField, userId }
) {
  const isDriver = isDriverRequest(req);
  const normalizedAssignedDriver = normalizeAssignedDriver(deliveryAssignedTo);
  const parsed = parseDeliveryStatusInput(deliveryStatus);
  if (parsed === undefined && deliveryStatus !== undefined) {
    return { ok: false, message: 'Invalid deliveryStatus' };
  }
  if (isDriver && hasAssignedDriverField) {
    return { ok: false, message: 'Drivers cannot assign deliveries' };
  }
  if (!isDriver && hasAssignedDriverField) {
    if (!canAssignDriver(req)) return { ok: false, message: 'Only managers/admins can assign drivers' };
  }
  if (!isDriver && hasAssignedDriverField && normalizedAssignedDriver) {
    const validAssignee = await assertAssignedDriverIsValid(tenantId, normalizedAssignedDriver);
    if (!validAssignee.ok) return { ok: false, message: validAssignee.message };
  }

  const transaction = await sequelize.transaction();
  try {
    const sale = await Sale.findOne({
      where: applySaleScope(req, applyTenantFilter(tenantId, { id: saleId })),
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!sale) {
      await transaction.rollback();
      return { ok: false, message: 'Sale not found' };
    }
    if (sale.status !== 'completed') {
      await transaction.rollback();
      return { ok: false, message: 'Only completed sales can use delivery status here' };
    }
    if (isDriver && sale.deliveryAssignedTo !== userId) {
      await transaction.rollback();
      return { ok: false, message: 'This delivery is not assigned to you' };
    }

    const previousDeliveryStatus = sale.deliveryStatus || null;
    if (isDriver) {
      const guard = enforceDriverStatusTransition({
        currentStatus: previousDeliveryStatus,
        nextStatus: parsed,
      });
      if (!guard.ok) {
        await transaction.rollback();
        return { ok: false, message: guard.message };
      }
    }

    if (
      String(previousDeliveryStatus || '') === String(parsed || '') &&
      (!hasAssignedDriverField || String(sale.deliveryAssignedTo || '') === String(normalizedAssignedDriver || ''))
    ) {
      await transaction.commit();
      return { ok: true, unchanged: true };
    }

    const saleUpdates = {};
    if (deliveryStatus !== undefined) {
      saleUpdates.deliveryStatus = parsed;
      if (parsed === 'delivered' || parsed === 'returned') {
        saleUpdates.deliveredBy = userId || null;
        saleUpdates.deliveredAt = new Date();
      } else {
        saleUpdates.deliveredBy = null;
        saleUpdates.deliveredAt = null;
      }
    }
    if (hasAssignedDriverField) {
      saleUpdates.deliveryAssignedTo = normalizedAssignedDriver;
      saleUpdates.deliveryAssignedAt = new Date();
    }

    await sale.update(saleUpdates, { transaction });

    const oldL = previousDeliveryStatus
      ? DELIVERY_LABELS[previousDeliveryStatus] || previousDeliveryStatus
      : 'Not set';
    const newL = parsed ? DELIVERY_LABELS[parsed] || parsed : 'Not set';
    if (deliveryStatus !== undefined) {
      await SaleActivity.create(
        {
          saleId: sale.id,
          tenantId,
          type: 'note',
          subject: 'Delivery status updated',
          notes: `Delivery status changed from ${oldL} to ${newL}`,
          createdBy: userId || null,
          metadata: {
            deliveryStatusChange: true,
            oldDeliveryStatus: previousDeliveryStatus,
            newDeliveryStatus: parsed
          }
        },
        { transaction }
      );
    }

    if (hasAssignedDriverField) {
      await SaleActivity.create(
        {
          saleId: sale.id,
          tenantId,
          type: 'note',
          subject: 'Delivery reassigned',
          notes: `Delivery assigned to user ${normalizedAssignedDriver}`,
          createdBy: userId || null,
          metadata: {
            deliveryAssignmentChange: true,
            deliveryAssignedTo: normalizedAssignedDriver,
          },
        },
        { transaction }
      );
    }

    await transaction.commit();
    return { ok: true };
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
}

/**
 * @desc    Set deliveryStatus on one or more jobs / sales (tenant-scoped)
 * @route   PATCH /api/deliveries/status
 * @body    { updates: [{ entityType: 'job'|'sale', id: uuid, deliveryStatus: string|null }] }
 * @access  Private (tenant)
 */
exports.patchDeliveryStatuses = async (req, res, next) => {
  try {
    const raw = req.body?.updates;
    if (!Array.isArray(raw) || raw.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'updates must be a non-empty array'
      });
    }
    if (raw.length > MAX_BULK_UPDATES) {
      return res.status(400).json({
        success: false,
        message: `At most ${MAX_BULK_UPDATES} updates per request`
      });
    }

    const tenantId = req.tenantId;
    const userId = req.user?.id || null;
    const results = [];
    let saleTouched = false;

    for (const item of raw) {
      const entityType = item?.entityType;
      const id = item?.id;
      if (!id || (entityType !== 'job' && entityType !== 'sale')) {
        results.push({
          entityType: entityType || null,
          id: id || null,
          ok: false,
          message: 'Each update needs entityType "job" or "sale" and id'
        });
        continue;
      }
      if (
        !Object.prototype.hasOwnProperty.call(item || {}, 'deliveryStatus') &&
        !Object.prototype.hasOwnProperty.call(item || {}, 'deliveryAssignedTo')
      ) {
        results.push({
          entityType,
          id,
          ok: false,
          message: 'Provide deliveryStatus and/or deliveryAssignedTo',
        });
        continue;
      }

      try {
        let r;
        if (entityType === 'job') {
          r = await updateJobDeliveryStatus(req, {
            tenantId,
            jobId: id,
            deliveryStatus: item.deliveryStatus,
            deliveryAssignedTo: item.deliveryAssignedTo,
            hasAssignedDriverField: Object.prototype.hasOwnProperty.call(item || {}, 'deliveryAssignedTo'),
            userId
          });
        } else {
          r = await updateSaleDeliveryStatus(req, {
            tenantId,
            saleId: id,
            deliveryStatus: item.deliveryStatus,
            deliveryAssignedTo: item.deliveryAssignedTo,
            hasAssignedDriverField: Object.prototype.hasOwnProperty.call(item || {}, 'deliveryAssignedTo'),
            userId
          });
          if (r.ok) saleTouched = true;
        }
        results.push({ entityType, id, ...r });
      } catch (err) {
        results.push({
          entityType,
          id,
          ok: false,
          message: err?.message || 'Update failed'
        });
      }
    }

    if (saleTouched) {
      invalidateSaleListCache(tenantId);
    }

    const allOk = results.every((r) => r.ok);
    return res.status(allOk ? 200 : 207).json({
      success: allOk,
      data: { results }
    });
  } catch (err) {
    next(err);
  }
};
