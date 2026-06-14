const {
  CUSTOMER_CONFIRMED_DELIVERY_ERROR_CODE,
  fulfillmentStateForOrder,
  hasCustomerConfirmedDelivery,
  paymentStatusForMarketplaceOrder,
} = require('../../../utils/marketplaceOrderStatus');

describe('marketplaceOrderStatus', () => {
  describe('fulfillmentStateForOrder', () => {
    it('maps preparing orderStatus to processing', () => {
      expect(fulfillmentStateForOrder({
        status: 'completed',
        orderStatus: 'preparing',
        deliveryStatus: null,
      })).toBe('processing');
    });

    it('maps received orderStatus to pending', () => {
      expect(fulfillmentStateForOrder({
        status: 'completed',
        orderStatus: 'received',
        deliveryStatus: null,
      })).toBe('pending');
    });
  });

  describe('paymentStatusForMarketplaceOrder', () => {
    it('prefers marketplace payment status over sale status', () => {
      expect(paymentStatusForMarketplaceOrder({
        status: 'completed',
        marketplacePayment: { status: 'paid_held' },
        metadata: { tradeAssurance: { paymentStatus: 'paid_held' } },
      })).toBe('paid_held');
    });

    it('falls back to metadata trade assurance payment status', () => {
      expect(paymentStatusForMarketplaceOrder({
        status: 'completed',
        metadata: { tradeAssurance: { paymentStatus: 'paid_held' } },
      })).toBe('paid_held');
    });

    it('does not use sale status when trade assurance is absent', () => {
      expect(paymentStatusForMarketplaceOrder({
        status: 'completed',
        metadata: {},
      })).toBeNull();
    });
  });

  describe('hasCustomerConfirmedDelivery', () => {
    it('detects delivered orders confirmed by the customer', () => {
      expect(hasCustomerConfirmedDelivery({
        status: 'completed',
        orderStatus: 'completed',
        deliveryStatus: 'delivered',
        metadata: { confirmedReceivedAt: '2026-06-10T13:00:00.000Z' },
      })).toBe(true);
    });

    it('does not lock unconfirmed delivered orders', () => {
      expect(hasCustomerConfirmedDelivery({
        status: 'completed',
        orderStatus: 'completed',
        deliveryStatus: 'delivered',
        metadata: {},
      })).toBe(false);
    });

    it('exports the lock error code used by status mutation endpoints', () => {
      expect(CUSTOMER_CONFIRMED_DELIVERY_ERROR_CODE).toBe('ORDER_DELIVERY_CONFIRMED_LOCKED');
    });
  });
});
