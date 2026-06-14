const { Op } = require('sequelize');
const { appendWhereOrGroup } = require('../../../utils/sequelizeWhereUtils');
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

  it('preserves invoice sourceType visibility when shop read filter is applied', () => {
    const where = applyScopedReadFilters(
      { shopScoped: true, shopFilterId: 'shop-a' },
      {
        tenantId: 'tenant-1',
        [Op.or]: [{ sourceType: 'sale' }, { sourceType: 'quote' }],
      }
    );

    expect(where[Op.or]).toBeUndefined();
    expect(where[Op.and]).toEqual(
      expect.arrayContaining([
        { [Op.or]: [{ sourceType: 'sale' }, { sourceType: 'quote' }] },
        { [Op.or]: [{ shopId: 'shop-a' }, { shopId: null }] },
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

  it('preserves existing Op.or when studio location read filter is applied', () => {
    const where = applyStudioLocationReadFilter(
      { studioLocationScoped: true, studioLocationFilterId: 'studio-a' },
      {
        tenantId: 'tenant-1',
        [Op.or]: [{ sourceType: 'job' }, { sourceType: 'quote' }],
      }
    );

    expect(where[Op.and]).toEqual(
      expect.arrayContaining([
        { [Op.or]: [{ sourceType: 'job' }, { sourceType: 'quote' }] },
        { [Op.or]: [{ studioLocationId: 'studio-a' }, { studioLocationId: null }] },
      ])
    );
  });
});

describe('appendWhereOrGroup', () => {
  it('appends a second OR group into Op.and', () => {
    const merged = appendWhereOrGroup(
      { tenantId: 'tenant-1', [Op.or]: [{ sourceType: 'sale' }] },
      [{ shopId: 'shop-a' }, { shopId: null }]
    );

    expect(merged[Op.and]).toEqual([
      { [Op.or]: [{ sourceType: 'sale' }] },
      { [Op.or]: [{ shopId: 'shop-a' }, { shopId: null }] },
    ]);
  });
});
