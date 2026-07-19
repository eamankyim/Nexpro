jest.mock('../../../config/database', () => ({
  sequelize: {
    define: jest.fn(() => ({})),
    transaction: jest.fn(),
    query: jest.fn(),
    QueryTypes: { SELECT: 'SELECT' },
  },
}));

jest.mock('../../../models', () => ({
  Expense: {
    create: jest.fn(),
    findOne: jest.fn(),
    findAndCountAll: jest.fn(),
    findAll: jest.fn(),
  },
  Vendor: { findOne: jest.fn() },
  Job: { findOne: jest.fn() },
  User: {},
  Shop: {},
}));

jest.mock('../../../models/ExpenseActivity', () => ({
  create: jest.fn().mockResolvedValue({}),
  findOne: jest.fn(),
}));

jest.mock('../../../utils/tenantUtils', () => ({
  applyTenantFilter: jest.fn((tenantId, where = {}) => ({ ...where, tenantId })),
  sanitizePayload: jest.fn((body = {}) => ({ ...body })),
}));

jest.mock('../../../utils/shopUtils', () => ({
  applyShopReadFilter: jest.fn((_req, where) => where),
  attachScopedToPayload: jest.fn((_req, payload) => payload),
  assertShopRecordAccess: jest.fn(),
}));

jest.mock('../../../utils/studioLocationUtils', () => ({
  applyStudioLocationFilter: jest.fn((_req, where) => where),
}));

jest.mock('../../../utils/paginationUtils', () => ({
  getPagination: jest.fn(() => ({ page: 1, limit: 20, offset: 0 })),
}));

jest.mock('../../../middleware/cache', () => ({
  invalidateAfterMutation: jest.fn(),
  invalidateExpenseStatsCache: jest.fn(),
}));

jest.mock('../../../middleware/upload', () => ({
  baseUploadDir: '/tmp',
  ensureDirExists: jest.fn(),
}));

jest.mock('../../../services/activityLogger', () => ({
  logExpenseSubmitted: jest.fn(),
  logExpenseApproved: jest.fn(),
  logExpenseRejected: jest.fn(),
}));

jest.mock('../../../services/expenseAccountingService', () => ({
  createExpenseJournal: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../../config/expenseCategories', () => ({
  getExpenseCategories: jest.fn(() => ['Rent', 'Other']),
}));

const { sequelize } = require('../../../config/database');
const { Expense } = require('../../../models');
const ExpenseActivity = require('../../../models/ExpenseActivity');
const { createExpense } = require('../../../controllers/expenseController');

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('expenseController.createExpense submitter', () => {
  const transaction = {
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sequelize.transaction.mockResolvedValue(transaction);
    sequelize.query
      .mockResolvedValueOnce([{ lock_hash: 1 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    Expense.create.mockImplementation(async (payload) => ({
      ...payload,
      id: 'expense-1',
      toJSON() {
        return { ...payload, id: 'expense-1' };
      },
    }));
  });

  it('persists submittedBy/approvedBy from req.user.id (not undefined req.userId)', async () => {
    const req = {
      tenantId: 'tenant-1',
      userId: undefined,
      user: { id: 'user-abc', name: 'Ada', email: 'ada@example.com' },
      body: {
        category: 'Rent',
        amount: 100,
        description: 'Shop rent',
        paymentMethod: 'cash',
      },
    };
    const res = makeRes();
    const next = jest.fn();

    await createExpense(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(Expense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        submittedBy: 'user-abc',
        approvedBy: 'user-abc',
        approvalStatus: 'approved',
      }),
      expect.objectContaining({ transaction })
    );
    expect(ExpenseActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: 'user-abc' }),
      expect.objectContaining({ transaction })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          submitter: expect.objectContaining({ id: 'user-abc', name: 'Ada' }),
        }),
      })
    );
  });
});
