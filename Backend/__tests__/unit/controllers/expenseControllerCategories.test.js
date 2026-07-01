jest.mock('../../../models', () => ({
  Expense: {
    count: jest.fn(),
  },
}));

jest.mock('../../../utils/tenantUtils', () => ({
  applyTenantFilter: jest.fn((tenantId, where = {}) => ({ ...where, tenantId })),
}));

jest.mock('../../../config/expenseCategories', () => ({
  getExpenseCategories: jest.fn(() => ['Rent', 'Utilities', 'Other']),
}));

const { Expense } = require('../../../models');
const {
  getExpenseCategories,
  addCustomExpenseCategory,
  removeCustomExpenseCategory,
} = require('../../../controllers/expenseController');

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const makeTenant = (overrides = {}) => ({
  id: 'tenant-1',
  businessType: 'shop',
  metadata: {},
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

describe('expenseController custom categories', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Expense.count.mockResolvedValue(0);
  });

  it('returns merged default and custom categories', async () => {
    const tenant = makeTenant({
      metadata: { customExpenseCategories: ['Custom A'] },
    });
    const req = { tenant };
    const res = makeRes();
    const next = jest.fn();

    await getExpenseCategories(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: ['Custom A', 'Other', 'Rent', 'Utilities'],
      custom: ['Custom A'],
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('adds a custom category to tenant metadata', async () => {
    const tenant = makeTenant();
    const req = { tenant, body: { name: '  Fleet Fuel  ' } };
    const res = makeRes();
    const next = jest.fn();

    await addCustomExpenseCategory(req, res, next);

    expect(tenant.metadata.customExpenseCategories).toEqual(['Fleet Fuel']);
    expect(tenant.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      custom: ['Fleet Fuel'],
      message: 'Custom category added',
    }));
  });

  it('rejects empty category name on add', async () => {
    const tenant = makeTenant();
    const req = { tenant, body: { name: '   ' } };
    const res = makeRes();
    const next = jest.fn();

    await addCustomExpenseCategory(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Category name is required',
    });
    expect(tenant.save).not.toHaveBeenCalled();
  });

  it('removes a custom category when no expenses use it', async () => {
    const tenant = makeTenant({
      metadata: { customExpenseCategories: ['Fleet Fuel', 'Supplies'] },
    });
    const req = { tenant, query: { name: 'Fleet Fuel' } };
    const res = makeRes();
    const next = jest.fn();

    await removeCustomExpenseCategory(req, res, next);

    expect(Expense.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', category: 'Fleet Fuel' },
    });
    expect(tenant.metadata.customExpenseCategories).toEqual(['Supplies']);
    expect(tenant.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      custom: ['Supplies'],
      message: 'Custom category removed',
    }));
  });

  it('blocks delete when expenses use the category', async () => {
    Expense.count.mockResolvedValue(2);
    const tenant = makeTenant({
      metadata: { customExpenseCategories: ['Fleet Fuel'] },
    });
    const req = { tenant, query: { name: 'Fleet Fuel' } };
    const res = makeRes();
    const next = jest.fn();

    await removeCustomExpenseCategory(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Cannot delete: 2 expense(s) use this category. Reassign those expenses first.',
    });
    expect(tenant.save).not.toHaveBeenCalled();
  });
});
