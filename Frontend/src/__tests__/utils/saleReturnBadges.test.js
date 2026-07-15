import { getSaleReturnBadgeStatuses } from '../../utils/saleReturnBadges';

describe('getSaleReturnBadgeStatuses', () => {
  it('returns refunded for fully refunded sales', () => {
    expect(getSaleReturnBadgeStatuses({
      status: 'refunded',
      metadata: { returnSummary: { fullyReturned: true, hasExchange: false } },
    })).toEqual(['refunded']);
  });

  it('returns partial_return when qty returned but not fully', () => {
    expect(getSaleReturnBadgeStatuses({
      status: 'completed',
      metadata: { returnSummary: { fullyReturned: false, totalReturnedQty: 1, hasExchange: false } },
    })).toEqual(['partial_return']);
  });

  it('adds exchanged when return summary has exchange', () => {
    expect(getSaleReturnBadgeStatuses({
      status: 'completed',
      metadata: { returnSummary: { fullyReturned: false, totalReturnedQty: 1, hasExchange: true } },
    })).toEqual(['partial_return', 'exchanged']);
  });
});
