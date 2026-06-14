import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Package, Scissors } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import AccountLayout from '../components/storefront/AccountLayout';
import { EmptyState } from '../components/storefront/StorefrontLayout';
import { InlineErrorState, OrderHistorySkeleton } from '../components/storefront/StateBlocks';
import storeService from '../services/storeService';
import { showError } from '../utils/toast';
import { formatAmount } from '../utils/formatNumber';
import { QUERY_STALE, SHOPPER_QUERY_KEYS } from '../utils/queryInvalidation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const formatDate = (value) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const getOrderStatusLabel = (order) => {
  if (order?.status === 'cancelled' || order?.orderStatus === 'cancelled') return 'Cancelled';
  if (order?.status === 'refunded') return 'Refunded';
  if (order?.dispute?.status === 'open') return 'Issue open';
  if (order?.tradeAssurance?.paymentStatus === 'refunded') return 'Refunded';
  if (order?.tradeAssurance?.paymentStatus === 'released') return 'Payment released';
  if (order?.confirmedReceivedAt) return 'Received';
  return (order?.deliveryTracking?.currentLabel || order?.deliveryStatus || order?.orderStatus || order?.status || 'pending').replace(/_/g, ' ');
};

export const getDeliveryProgressLabel = (order) => (
  order?.deliveryTracking?.currentLabel
  || (order?.deliveryStatus || order?.orderStatus || 'Processing').replace(/_/g, ' ')
);

const getTradeAssuranceLabel = (order) => {
  const status = order?.tradeAssurance?.paymentStatus;
  if (status === 'released') return 'Payment released to seller';
  if (status === 'refunded' || order?.status === 'refunded') return 'Refund recorded';
  if (status === 'disputed') return 'Held while issue is reviewed';
  if (order?.status === 'cancelled' || order?.orderStatus === 'cancelled') return 'Payment hold cancelled';
  return 'Sabito is holding payment until delivery is confirmed';
};

const getServiceBookingStatusLabel = (booking) => {
  if (booking?.paymentStatus === 'paid') return 'Service paid';
  if (booking?.paymentStatus === 'awaiting_payment') return 'Awaiting payment';
  return (booking?.status || 'Booked').replace(/_/g, ' ');
};

const getServiceBookingProgressLabel = (booking) => {
  if (booking?.appointmentAt) return `Appointment: ${formatDate(booking.appointmentAt)}`;
  if (booking?.preferredDate) return `Preferred date: ${formatDate(booking.preferredDate)}`;
  return 'Service request received';
};

const normalizeOrderHistoryItem = (order) => ({
  id: `order-${order.id}`,
  sortDate: order.createdAt,
  type: 'order',
  title: order.saleNumber,
  statusLabel: getOrderStatusLabel(order),
  merchantName: order.storeName,
  progressLabel: `Delivery: ${getDeliveryProgressLabel(order)}`,
  supportLabel: getTradeAssuranceLabel(order),
  createdAt: order.createdAt,
  total: order.total,
  currency: order.currency,
  to: `/account/orders/${order.id}`,
  Icon: Package,
});

const normalizeServiceBookingHistoryItem = (booking) => ({
  id: `service-${booking.id}`,
  sortDate: booking.createdAt,
  type: 'service',
  title: booking.jobNumber || booking.serviceTitle || booking.title,
  statusLabel: getServiceBookingStatusLabel(booking),
  merchantName: booking.serviceTitle || booking.title,
  progressLabel: getServiceBookingProgressLabel(booking),
  supportLabel: booking.paymentStatus === 'paid'
    ? 'Payment received for this service booking'
    : 'Service booking is being processed',
  createdAt: booking.createdAt,
  total: booking.total,
  currency: booking.currency,
  to: booking.trackingToken
    ? `/track-order?token=${encodeURIComponent(booking.trackingToken)}`
    : (booking.studioSlug && booking.serviceSlug
      ? `/studios/${encodeURIComponent(booking.studioSlug)}/services/${encodeURIComponent(booking.serviceSlug)}`
      : '/services'),
  Icon: Scissors,
});

const ShopperOrdersPage = () => {
  const ordersQuery = useQuery({
    queryKey: SHOPPER_QUERY_KEYS.orders(),
    queryFn: storeService.getStorefrontOrders,
    staleTime: QUERY_STALE.TRANSACTIONAL,
    refetchOnWindowFocus: false,
  });

  const bookingsQuery = useQuery({
    queryKey: SHOPPER_QUERY_KEYS.serviceBookings(),
    queryFn: storeService.getStorefrontServiceBookings,
    staleTime: QUERY_STALE.TRANSACTIONAL,
    refetchOnWindowFocus: false,
  });

  const historyItems = useMemo(() => {
    const orders = ordersQuery.data?.data?.orders || ordersQuery.data?.orders || [];
    const bookings = bookingsQuery.data?.data?.bookings || bookingsQuery.data?.bookings || [];
    return [
      ...orders.map(normalizeOrderHistoryItem),
      ...bookings.map(normalizeServiceBookingHistoryItem),
    ].sort((first, second) => new Date(second.sortDate || 0) - new Date(first.sortDate || 0));
  }, [bookingsQuery.data, ordersQuery.data]);

  const isLoading = ordersQuery.isLoading || bookingsQuery.isLoading;
  const loadError = ordersQuery.error || bookingsQuery.error;

  useEffect(() => {
    if (loadError) showError(loadError, 'Could not load your orders.');
  }, [loadError]);

  const retryOrders = () => {
    ordersQuery.refetch();
    bookingsQuery.refetch();
  };

  return (
    <AccountLayout
      title="My orders"
      description="Review storefront purchases, delivery progress, and order support actions."
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:rounded-[2rem] sm:p-6">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700">Order history</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Your Sabito orders</h2>
          </div>
          <Button asChild variant="outline" className="w-full rounded-full border-green-200 text-green-800 hover:bg-green-50 sm:w-auto">
            <Link to="/products">Continue shopping</Link>
          </Button>
        </div>

        {isLoading ? (
          <OrderHistorySkeleton />
        ) : loadError ? (
          <InlineErrorState
            title="Could not load your orders"
            message="Your order history is safe. Retry when your connection is stable."
            onRetry={retryOrders}
          />
        ) : historyItems.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={Package}
              title="No orders yet"
              description="Product orders and service bookings will appear here once checkout or booking is complete."
              action={<Button asChild className="rounded-full bg-green-700 hover:bg-green-800"><Link to="/products">Browse products</Link></Button>}
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {historyItems.map((item) => {
              const Icon = item.Icon;
              return (
              <Link
                key={item.id}
                to={item.to}
                className="grid gap-4 rounded-2xl border border-slate-200 p-4 transition-colors hover:border-green-300 hover:bg-green-50/40 sm:rounded-3xl md:grid-cols-[1fr_auto]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-50 text-green-800">
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="break-words text-lg font-black text-slate-950">{item.title}</p>
                    <Badge variant="outline" className="border-green-100 bg-green-50 capitalize text-green-800">
                      {item.statusLabel}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-700">{item.merchantName}</p>
                  <p className="mt-1 text-sm font-semibold text-green-800">{item.progressLabel}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.supportLabel}</p>
                  <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-500">
                    <CalendarDays className="h-4 w-4" />
                    {formatDate(item.createdAt)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 md:justify-end">
                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
                    <p className="text-lg font-black text-green-800">{formatAmount(item.total, item.currency)}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-400" />
                </div>
              </Link>
              );
            })}
          </div>
        )}
      </div>
    </AccountLayout>
  );
};

export default ShopperOrdersPage;
