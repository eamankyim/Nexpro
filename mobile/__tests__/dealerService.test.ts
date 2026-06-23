jest.mock('@/services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

import { api } from '@/services/api';
import { dealerService } from '@/services/dealerService';

describe('dealerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches dealer stats without shop scope', async () => {
    jest.mocked(api.get).mockResolvedValue({
      data: { success: true, data: { totalDealers: 3, totalOutstanding: 500 } },
    });

    const stats = await dealerService.getStats();

    expect(api.get).toHaveBeenCalledWith('/dealers/stats');
    expect(stats).toEqual({ totalDealers: 3, totalOutstanding: 500 });
  });

  it('creates a dealer without attaching shopId', async () => {
    jest.mocked(api.post).mockResolvedValue({
      data: { success: true, data: { id: 'dealer-1', businessName: 'Acme Wholesale' } },
    });

    await dealerService.create({
      businessName: 'Acme Wholesale',
      creditLimit: 1000,
      openingBalance: 0,
    });

    expect(api.post).toHaveBeenCalledWith('/dealers', {
      businessName: 'Acme Wholesale',
      creditLimit: 1000,
      openingBalance: 0,
    });
  });

  it('records a dealer payment', async () => {
    jest.mocked(api.post).mockResolvedValue({ data: { success: true } });

    await dealerService.recordPayment('dealer-1', {
      amount: 250,
      paymentMethod: 'cash',
      referenceNumber: 'RCPT-1',
    });

    expect(api.post).toHaveBeenCalledWith('/dealers/dealer-1/payments', {
      amount: 250,
      paymentMethod: 'cash',
      referenceNumber: 'RCPT-1',
    });
  });
});
