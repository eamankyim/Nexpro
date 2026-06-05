const { Op } = require('sequelize');
const { applyScopedReadFilters } = require('../../../utils/shopUtils');
const { applyStudioLocationReadFilter } = require('../../../utils/studioLocationUtils');

describe('scoped read filters', () => {
  it('includes legacy null shopId when a shop filter is active', () => {
    const where = applyScopedReadFilters(
      { shopScoped: true, shopFilterId: 'shop-a' },
      { tenantId: 'tenant-1', id: 'inv-1' }
    );

    expect(where.tenantId).toBe('tenant-1');
    expect(where.id).toBe('inv-1');
    expect(where[Op.or]).toEqual(
      expect.arrayContaining([
        { shopId: 'shop-a' },
        { shopId: null },
      ])
    );
  });

  it('includes legacy null studioLocationId when a location filter is active', () => {
    const where = applyStudioLocationReadFilter(
      { studioLocationScoped: true, studioLocationFilterId: 'studio-a' },
      { tenantId: 'tenant-1', status: 'cancelled' }
    );

    expect(where.tenantId).toBe('tenant-1');
    expect(where.status).toBe('cancelled');
    expect(where[Op.or]).toEqual(
      expect.arrayContaining([
        { studioLocationId: 'studio-a' },
        { studioLocationId: null },
      ])
    );
  });
});
