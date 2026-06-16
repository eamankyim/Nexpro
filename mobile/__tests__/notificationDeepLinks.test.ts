import { resolveNotificationDeepLink } from '@/utils/notificationDeepLinks';

describe('notification deep link resolver', () => {
  it('routes product stock notifications to product details when productId exists', () => {
    expect(
      resolveNotificationDeepLink({
        type: 'inventory',
        metadata: { source: 'stock_alert', alertType: 'out_of_stock', productId: 'product 1' },
      }),
    ).toBe('/product/product%201');
  });

  it('routes stock alerts without product metadata to the products tab', () => {
    expect(
      resolveNotificationDeepLink({
        type: 'inventory',
        link: '/products',
        metadata: { source: 'stock_alert', alertType: 'low_stock' },
      }),
    ).toBe('/(tabs)/products');
  });

  it('routes online store orders to seller order details', () => {
    expect(
      resolveNotificationDeepLink({
        type: 'order',
        metadata: { source: 'online_store', saleId: 'sale-1' },
      }),
    ).toBe('/store-order/sale-1');
  });

  it('routes restaurant order notifications with sale IDs to sale details', () => {
    expect(
      resolveNotificationDeepLink({
        type: 'order',
        metadata: { saleId: 'sale-2' },
      }),
    ).toBe('/sale/sale-2');
  });

  it.each([
    ['invoiceId', 'invoice-1', '/invoice/invoice-1'],
    ['jobId', 'job-1', '/job/job-1'],
    ['quoteId', 'quote-1', '/quote/quote-1'],
    ['customerId', 'customer-1', '/customer/customer-1'],
    ['expenseId', 'expense-1', '/expense/expense-1'],
    ['leadId', 'lead-1', '/lead/lead-1'],
    ['taskId', 'task-1', '/task/task-1'],
  ])('routes %s metadata to detail route', (key, id, route) => {
    expect(resolveNotificationDeepLink({ metadata: { [key]: id } })).toBe(route);
  });

  it('parses supported backend web links', () => {
    expect(resolveNotificationDeepLink({ link: '/invoices/invoice 2' })).toBe('/invoice/invoice%202');
    expect(resolveNotificationDeepLink({ link: 'https://example.com/jobs/job-2' })).toBe('/job/job-2');
    expect(resolveNotificationDeepLink({ link: '/store/orders/sale-3' })).toBe('/store-order/sale-3');
  });

  it('falls back for missing, invalid, or unrelated payloads', () => {
    expect(resolveNotificationDeepLink(null)).toBeNull();
    expect(resolveNotificationDeepLink([])).toBeNull();
    expect(resolveNotificationDeepLink({ type: 'inventory' })).toBeNull();
    expect(resolveNotificationDeepLink({ link: '/settings' })).toBeNull();
  });
});
