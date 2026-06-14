/**
 * Normalized fulfillment and payment status for marketplace (online store) orders.
 * Keeps admin control center and seller Online Orders in sync.
 */

const normalizeStatus = (value) => String(value || '').toLowerCase().trim();

const CUSTOMER_CONFIRMED_DELIVERY_ERROR_CODE = 'ORDER_DELIVERY_CONFIRMED_LOCKED';
const CUSTOMER_CONFIRMED_DELIVERY_ERROR_MESSAGE = 'This order was delivered and confirmed by the customer. Its status can no longer be changed.';

const getOrderMetadata = (order = {}) => (
  order?.metadata && typeof order.metadata === 'object' && !Array.isArray(order.metadata)
    ? order.metadata
    : {}
);

/**
 * Derive seller-facing fulfillment state from sale, order, and delivery fields.
 * Maps raw values like `preparing` to `processing` for consistent UI labels.
 * @param {object} order
 * @returns {'pending'|'paid'|'processing'|'ready'|'out_for_delivery'|'delivered'|'cancelled'}
 */
const fulfillmentStateForOrder = (order = {}) => {
  const saleStatus = normalizeStatus(order.status);
  const orderStatus = normalizeStatus(order.orderStatus);
  const deliveryStatus = normalizeStatus(order.deliveryStatus);

  if (saleStatus === 'cancelled' || saleStatus === 'refunded' || orderStatus === 'cancelled') return 'cancelled';
  if (deliveryStatus === 'delivered' || orderStatus === 'completed') return 'delivered';
  if (deliveryStatus === 'out_for_delivery') return 'out_for_delivery';
  if (deliveryStatus === 'ready_for_delivery' || orderStatus === 'ready') return 'ready';
  if (orderStatus === 'received') return 'pending';
  if (['preparing', 'processing'].includes(orderStatus)) return 'processing';
  if (saleStatus === 'pending' || saleStatus === 'partially_paid') return 'pending';
  return 'paid';
};

const hasCustomerConfirmedDelivery = (order = {}) => {
  const metadata = getOrderMetadata(order);
  const confirmedAt = metadata.confirmedReceivedAt
    || metadata.storefrontActions?.confirmReceived?.at
    || metadata.tradeAssurance?.buyerConfirmedAt
    || null;

  return Boolean(confirmedAt) && fulfillmentStateForOrder(order) === 'delivered';
};

/**
 * Trade-assurance payment status for marketplace orders (not Sale.status).
 * @param {object} order
 * @returns {string|null}
 */
const paymentStatusForMarketplaceOrder = (order = {}) => {
  const metadata = getOrderMetadata(order);
  const tradeAssuranceMeta = metadata.tradeAssurance && typeof metadata.tradeAssurance === 'object'
    ? metadata.tradeAssurance
    : {};
  const marketplacePayment = order.marketplacePayment && typeof order.marketplacePayment === 'object'
    ? order.marketplacePayment
    : null;

  return marketplacePayment?.status || tradeAssuranceMeta.paymentStatus || null;
};

module.exports = {
  CUSTOMER_CONFIRMED_DELIVERY_ERROR_CODE,
  CUSTOMER_CONFIRMED_DELIVERY_ERROR_MESSAGE,
  fulfillmentStateForOrder,
  hasCustomerConfirmedDelivery,
  paymentStatusForMarketplaceOrder,
};
