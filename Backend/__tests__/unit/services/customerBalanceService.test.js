jest.mock('../../../models', () => ({
  Customer: {
    update: jest.fn(),
  },
  Invoice: {
    findAll: jest.fn(),
  },
}));

const { Op } = require('sequelize');
const { Customer, Invoice } = require('../../../models');
const { updateCustomerBalance } = require('../../../services/customerBalanceService');

describe('customerBalanceService.updateCustomerBalance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Customer.update.mockResolvedValue([1]);
  });

  it('sums outstanding invoice balances and excludes cancelled invoices', async () => {
    Invoice.findAll.mockResolvedValue([
      { balance: '50.00', status: 'sent' },
      { balance: '25.50', status: 'partial' },
    ]);

    const total = await updateCustomerBalance('customer-1');

    expect(Invoice.findAll).toHaveBeenCalledWith({
      where: {
        customerId: 'customer-1',
        status: { [Op.ne]: 'cancelled' },
      },
      attributes: ['balance', 'status'],
      transaction: null,
    });
    expect(Customer.update).toHaveBeenCalledWith(
      { balance: 75.5 },
      { where: { id: 'customer-1' }, transaction: null }
    );
    expect(total).toBe(75.5);
  });
});
