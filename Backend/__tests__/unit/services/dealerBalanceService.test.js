jest.mock('../../../models', () => ({
  Dealer: {
    findByPk: jest.fn(),
    update: jest.fn(),
  },
}));

const { Dealer } = require('../../../models');
const {
  roundMoney,
  computeBalanceAfter,
  getAvailableCredit,
  checkCreditLimit,
  applyBalanceChange,
} = require('../../../services/dealerBalanceService');

describe('dealerBalanceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('computeBalanceAfter', () => {
    it('increases balance on debit and decreases on credit', () => {
      expect(computeBalanceAfter(100, 'debit', 50)).toBe(150);
      expect(computeBalanceAfter(100, 'credit', 30)).toBe(70);
    });
  });

  describe('getAvailableCredit', () => {
    it('returns credit limit minus balance', () => {
      expect(getAvailableCredit({ creditLimit: 1000, balance: 250 })).toBe(750);
      expect(getAvailableCredit({ creditLimit: 500, balance: 600 })).toBe(0);
    });
  });

  describe('checkCreditLimit', () => {
    it('blocks charge that exceeds limit unless overridden', () => {
      const dealer = { balance: 800, creditLimit: 1000 };
      const blocked = checkCreditLimit(dealer, 300, false);
      expect(blocked.exceedsLimit).toBe(true);
      expect(blocked.allowed).toBe(false);
      expect(blocked.projectedBalance).toBe(1100);

      const allowed = checkCreditLimit(dealer, 300, true);
      expect(allowed.allowed).toBe(true);
    });

    it('allows charge within available credit', () => {
      const result = checkCreditLimit({ balance: 200, creditLimit: 1000 }, 100, false);
      expect(result.exceedsLimit).toBe(false);
      expect(result.allowed).toBe(true);
      expect(result.availableCredit).toBe(800);
    });
  });

  describe('applyBalanceChange', () => {
    it('locks dealer row and persists new balance', async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      Dealer.findByPk.mockResolvedValue({
        balance: '100.00',
        update,
      });

      const result = await applyBalanceChange({
        dealerId: 'dealer-1',
        direction: 'debit',
        amount: 25.5,
        transaction: { LOCK: { UPDATE: 'UPDATE' } },
      });

      expect(Dealer.findByPk).toHaveBeenCalledWith('dealer-1', expect.objectContaining({
        lock: 'UPDATE',
      }));
      expect(update).toHaveBeenCalledWith({ balance: 125.5 }, expect.any(Object));
      expect(result).toEqual({ previousBalance: 100, balanceAfter: 125.5 });
    });
  });

  describe('roundMoney', () => {
    it('rounds to two decimal places', () => {
      expect(roundMoney(10.005)).toBe(10.01);
      expect(roundMoney('99.999')).toBe(100);
    });
  });
});
