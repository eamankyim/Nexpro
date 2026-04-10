const { Op } = require('sequelize');
const { Job, Sale, Customer, SaleActivity } = require('../models');
const { sequelize } = require('../config/database');
const { applyTenantFilter } = require('../utils/tenantUtils');
const { parseDeliveryStatusInput } = require('../utils/deliveryStatus');
const { invalidateSaleListCache } = require('../middleware/cache');

const DELIVERY_LABELS = {
  ready_for_delivery: 'Ready for delivery',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  returned: 'Returned'
};

const MAX_BULK_UPDATES = 40;

const ACTIVE_DELIVERY_OR_NULL = {
  [Op.or]: [
    { deliveryStatus: null },
    { deliveryStatus: 'ready_for_delivery' },
    { deliveryStatus: 'out_for_delivery' }
  ]
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
    total: s.total != null ? Number(s.total) : null
  };
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

    const customerInclude = {
      model: Customer,
      as: 'customer',
      attributes: ['id', 'name', 'company', 'phone', 'address', 'city', 'state']
    };

    if (scope === 'active') {
      const jobWhere = applyTenantFilter(tenantId, {
        status: 'completed',
        ...ACTIVE_DELIVERY_OR_NULL
      });
      const saleWhere = applyTenantFilter(tenantId, {
        status: 'completed',
        ...ACTIVE_DELIVERY_OR_NULL
      });

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

    const jobWhere = applyTenantFilter(tenantId, {
      status: 'completed',
      deliveryStatus: terminal,
      updatedAt: { [Op.gte]: ninetyDaysAgo }
    });
    const saleWhere = applyTenantFilter(tenantId, {
      status: 'completed',
      deliveryStatus: terminal,
      updatedAt: { [Op.gte]: ninetyDaysAgo }
    });

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

async function updateJobDeliveryStatus({ tenantId, jobId, deliveryStatus }) {
  const parsed = parseDeliveryStatusInput(deliveryStatus);
  if (parsed === undefined) {
    return { ok: false, message: 'Invalid deliveryStatus' };
  }

  const job = await Job.findOne({
    where: applyTenantFilter(tenantId, { id: jobId })
  });
  if (!job) {
    return { ok: false, message: 'Job not found' };
  }
  if (job.status !== 'completed') {
    return { ok: false, message: 'Only completed jobs can use delivery status here' };
  }

  await job.update({
    deliveryStatus: parsed,
    ...(parsed ? { deliveryRequired: true } : {})
  });
  return { ok: true };
}

async function updateSaleDeliveryStatus({ tenantId, saleId, deliveryStatus, userId }) {
  const parsed = parseDeliveryStatusInput(deliveryStatus);
  if (parsed === undefined) {
    return { ok: false, message: 'Invalid deliveryStatus' };
  }

  const transaction = await sequelize.transaction();
  try {
    const sale = await Sale.findOne({
      where: applyTenantFilter(tenantId, { id: saleId }),
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

    const previousDeliveryStatus = sale.deliveryStatus || null;
    if (String(previousDeliveryStatus || '') === String(parsed || '')) {
      await transaction.commit();
      return { ok: true, unchanged: true };
    }

    await sale.update({ deliveryStatus: parsed }, { transaction });

    const oldL = previousDeliveryStatus
      ? DELIVERY_LABELS[previousDeliveryStatus] || previousDeliveryStatus
      : 'Not set';
    const newL = parsed ? DELIVERY_LABELS[parsed] || parsed : 'Not set';
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
      if (!Object.prototype.hasOwnProperty.call(item || {}, 'deliveryStatus')) {
        results.push({ entityType, id, ok: false, message: 'deliveryStatus is required (null to clear)' });
        continue;
      }

      try {
        let r;
        if (entityType === 'job') {
          r = await updateJobDeliveryStatus({
            tenantId,
            jobId: id,
            deliveryStatus: item.deliveryStatus
          });
        } else {
          r = await updateSaleDeliveryStatus({
            tenantId,
            saleId: id,
            deliveryStatus: item.deliveryStatus,
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
