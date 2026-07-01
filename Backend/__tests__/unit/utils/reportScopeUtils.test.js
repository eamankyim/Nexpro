const { Op } = require('sequelize');
const {
  scopedReportWhere,
  jobScopeSqlFragment,
  documentScopeSqlFragment,
} = require('../../../utils/reportScopeUtils');

describe('reportScopeUtils', () => {
  it('applies shop filter for retail invoice-backed report queries', () => {
    const where = scopedReportWhere(
      { shopScoped: true, shopFilterId: 'shop-a', tenantId: 'tenant-1' },
      { status: 'sent' }
    );

    expect(where.tenantId).toBe('tenant-1');
    expect(where.status).toBe('sent');
    expect(where.shopId).toBe('shop-a');
  });

  it('applies studio location filter for studio invoice-backed report queries', () => {
    const where = scopedReportWhere(
      {
        studioLocationScoped: true,
        studioLocationFilterId: 'studio-a',
        tenantId: 'tenant-1',
      },
      { amountPaid: { [Op.gt]: 0 } }
    );

    expect(where.tenantId).toBe('tenant-1');
    expect(where.studioLocationId).toBe('studio-a');
  });

  it('adds job studio location SQL fragment for raw job-backed queries', () => {
    const frag = jobScopeSqlFragment({
      studioLocationScoped: true,
      studioLocationFilterId: 'studio-b',
    });

    expect(frag.sql).toContain('job."studioLocationId" = :studioLocationFilterId');
    expect(frag.replacements).toEqual({ studioLocationFilterId: 'studio-b' });
  });

  it('combines shop and studio SQL fragments for invoice raw queries', () => {
    const frag = documentScopeSqlFragment(
      {
        shopScoped: true,
        shopFilterId: 'shop-a',
        studioLocationScoped: true,
        studioLocationFilterId: 'studio-a',
      },
      'Invoice'
    );

    expect(frag.sql).toContain('Invoice."shopId" = :shopFilterId');
    expect(frag.sql).toContain('Invoice."studioLocationId" = :studioLocationFilterId');
    expect(frag.replacements).toEqual({
      shopFilterId: 'shop-a',
      studioLocationFilterId: 'studio-a',
    });
  });
});
