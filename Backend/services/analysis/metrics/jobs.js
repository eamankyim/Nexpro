const { Op } = require('sequelize');
const { Job, Tenant, Customer } = require('../../../models');

const STUDIO_TYPES = new Set([
  'printing_press',
  'mechanic',
  'barber',
  'salon',
  'studio',
]);

/**
 * Open job pipeline counts for studio-like businesses.
 * @param {Object} ctx
 * @returns {Promise<{
 *   isStudio: boolean,
 *   pendingCount: number,
 *   inProgressCount: number,
 *   onHoldCount: number,
 *   openCount: number,
 *   samples: Array<{ id: string, jobNumber?: string, title?: string, status: string, customerName?: string }>,
 * }>}
 */
async function getJobPipeline(ctx) {
  const tenant = await Tenant.findByPk(ctx.tenantId, {
    attributes: ['id', 'businessType'],
  });
  const businessType = tenant?.businessType || 'printing_press';
  const isStudio = STUDIO_TYPES.has(businessType);

  if (!isStudio) {
    return {
      isStudio: false,
      pendingCount: 0,
      inProgressCount: 0,
      onHoldCount: 0,
      openCount: 0,
      samples: [],
    };
  }

  const whereBase = { tenantId: ctx.tenantId };
  if (ctx.studioLocationFilterId) {
    whereBase.studioLocationId = ctx.studioLocationFilterId;
  }

  const [pendingCount, inProgressCount, onHoldCount, samples] = await Promise.all([
    Job.count({ where: { ...whereBase, status: 'new' } }),
    Job.count({ where: { ...whereBase, status: 'in_progress' } }),
    Job.count({ where: { ...whereBase, status: 'on_hold' } }),
    Job.findAll({
      where: {
        ...whereBase,
        status: { [Op.in]: ['new', 'in_progress', 'on_hold'] },
      },
      attributes: ['id', 'jobNumber', 'title', 'status', 'updatedAt'],
      order: [['updatedAt', 'DESC']],
      limit: 8,
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['name', 'company'],
          required: false,
        },
      ],
    }),
  ]);

  return {
    isStudio: true,
    pendingCount: Number(pendingCount || 0),
    inProgressCount: Number(inProgressCount || 0),
    onHoldCount: Number(onHoldCount || 0),
    openCount:
      Number(pendingCount || 0) +
      Number(inProgressCount || 0) +
      Number(onHoldCount || 0),
    samples: (samples || []).map((j) => ({
      id: j.id,
      jobNumber: j.jobNumber,
      title: j.title,
      status: j.status,
      customerName: j.customer?.company || j.customer?.name || null,
    })),
  };
}

module.exports = {
  getJobPipeline,
};
