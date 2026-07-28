jest.mock('../../../models', () => ({
  JournalEntry: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    sequelize: { transaction: jest.fn() }
  },
  JournalEntryLine: {
    findAll: jest.fn(),
    bulkCreate: jest.fn(),
    destroy: jest.fn()
  },
  Account: { findAll: jest.fn(), findOne: jest.fn() },
  AccountBalance: {
    findOrCreate: jest.fn(),
    findOne: jest.fn()
  },
  User: {}
}));

jest.mock('../../../utils/tenantUtils', () => ({
  applyTenantFilter: jest.fn((_tenantId, where) => ({ tenantId: _tenantId, ...where }))
}));

const { AccountBalance, JournalEntryLine } = require('../../../models');
const {
  findOrCreatePeriodBalance,
  updateAccountBalances
} = require('../../../services/accountingService');

describe('accountingService account balances', () => {
  const tenantId = 'tenant-1';
  const accountId = 'account-1';
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findOrCreatePeriodBalance', () => {
    it('finds or creates by tenantId, accountId, fiscalYear, and period', async () => {
      const row = { id: 'bal-1', debit: 0, credit: 0, balance: 0, save: jest.fn() };
      AccountBalance.findOrCreate.mockResolvedValue([row, true]);

      const result = await findOrCreatePeriodBalance(tenantId, accountId, 2026, 7, transaction);

      expect(AccountBalance.findOrCreate).toHaveBeenCalledWith({
        where: { tenantId, accountId, fiscalYear: 2026, period: 7 },
        defaults: {
          tenantId,
          accountId,
          fiscalYear: 2026,
          period: 7,
          debit: 0,
          credit: 0,
          balance: 0
        },
        transaction
      });
      expect(result).toBe(row);
    });

    it('retries findOne when findOrCreate hits UniqueConstraintError', async () => {
      const existing = { id: 'bal-existing', debit: 10, credit: 0, balance: 10 };
      const uniqueErr = Object.assign(new Error('duplicate key'), {
        name: 'SequelizeUniqueConstraintError',
        parent: { code: '23505' }
      });
      AccountBalance.findOrCreate.mockRejectedValue(uniqueErr);
      AccountBalance.findOne.mockResolvedValue(existing);

      const result = await findOrCreatePeriodBalance(tenantId, accountId, 2026, 7, transaction);

      expect(AccountBalance.findOne).toHaveBeenCalledWith({
        where: { tenantId, accountId, fiscalYear: 2026, period: 7 },
        transaction,
        lock: 'UPDATE'
      });
      expect(result).toBe(existing);
    });
  });

  describe('updateAccountBalances', () => {
    it('updates the period balance for the journal entry month', async () => {
      const balance = {
        debit: 0,
        credit: 0,
        balance: 0,
        save: jest.fn().mockResolvedValue(undefined)
      };
      AccountBalance.findOrCreate.mockResolvedValue([balance, true]);
      JournalEntryLine.findAll.mockResolvedValue([
        {
          accountId,
          debit: 50,
          credit: 0,
          journalEntry: { entryDate: new Date('2026-07-15T12:00:00Z') }
        }
      ]);

      await updateAccountBalances(tenantId, 'journal-1', transaction);

      expect(AccountBalance.findOrCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accountId,
            fiscalYear: 2026,
            period: 7
          })
        })
      );
      expect(balance.debit).toBe(50);
      expect(balance.credit).toBe(0);
      expect(balance.balance).toBe(50);
      expect(balance.save).toHaveBeenCalledWith({ transaction });
    });
  });
});
