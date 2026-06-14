import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Heart, MapPin, Package, UserRound } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import AccountLayout from '../components/storefront/AccountLayout';
import { EmptyState } from '../components/storefront/StorefrontLayout';
import { InlineErrorState, OrderHistorySkeleton, SkeletonBlock } from '../components/storefront/StateBlocks';
import { useStorefrontAuth } from '../context/StorefrontAuthContext';
import { useWishlist } from '../context/WishlistContext';
import storeService from '../services/storeService';
import { showError } from '../utils/toast';
import { formatAmount } from '../utils/formatNumber';
import { QUERY_STALE, SHOPPER_QUERY_KEYS } from '../utils/queryInvalidation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const RECENT_ORDERS_PARAMS = { limit: 3 };

const ShopperAccountDashboard = () => {
  const { customer } = useStorefrontAuth();
  const { count: wishlistCount } = useWishlist();

  const ordersQuery = useQuery({
    queryKey: SHOPPER_QUERY_KEYS.orders(RECENT_ORDERS_PARAMS),
    queryFn: () => storeService.getStorefrontOrders(RECENT_ORDERS_PARAMS),
    staleTime: QUERY_STALE.TRANSACTIONAL,
    refetchOnWindowFocus: false,
  });

  const addressesQuery = useQuery({
    queryKey: SHOPPER_QUERY_KEYS.addresses,
    queryFn: storeService.getDeliveryAddresses,
    staleTime: QUERY_STALE.LIST,
    refetchOnWindowFocus: false,
  });

  const orders = ordersQuery.data?.data?.orders || ordersQuery.data?.orders || [];
  const addresses = addressesQuery.data?.data?.addresses || addressesQuery.data?.addresses || [];
  const isLoading = ordersQuery.isLoading || addressesQuery.isLoading;
  const loadError = ordersQuery.error || addressesQuery.error;

  useEffect(() => {
    if (loadError) showError(loadError, 'Could not load account dashboard.');
  }, [loadError]);

  const retryDashboard = () => {
    ordersQuery.refetch();
    addressesQuery.refetch();
  };

  return (
    <AccountLayout
      title="Dashboard"
      description="Track your orders, delivery addresses, and shopper profile."
    >
      <div className="grid gap-4 md:grid-cols-4">
        {isLoading ? (
          <>
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </>
        ) : (
          <>
            <SummaryCard icon={Package} label="Recent orders" value={orders.length} to="/account/orders" />
            <SummaryCard icon={Heart} label="Wishlist" value={wishlistCount} to="/account/wishlist" />
            <SummaryCard icon={MapPin} label="Saved addresses" value={addresses.length} to="/account/addresses" />
            <SummaryCard icon={UserRound} label="Profile" value={customer?.isEmailVerified ? 'Verified' : 'Pending'} to="/account/profile" />
          </>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 sm:rounded-[2rem] sm:p-6">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700">Latest activity</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Recent orders</h2>
          </div>
          <Button asChild variant="outline" className="w-full rounded-full border-green-200 text-green-800 hover:bg-green-50 sm:w-auto">
            <Link to="/account/orders">View all orders</Link>
          </Button>
        </div>

        {isLoading ? (
          <OrderHistorySkeleton rows={2} />
        ) : loadError ? (
          <InlineErrorState
            title="Could not load dashboard activity"
            message="Retry to refresh orders and saved addresses."
            onRetry={retryDashboard}
          />
        ) : orders.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="No orders yet"
              description="When you buy from a Sabito storefront, your orders will appear here."
              action={<Button asChild className="rounded-full bg-green-700 hover:bg-green-800"><Link to="/products">Start shopping</Link></Button>}
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                to={`/account/orders/${order.id}`}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 transition-colors hover:border-green-300 hover:bg-green-50/40 sm:flex-row sm:items-center sm:justify-between sm:rounded-3xl"
              >
                <div className="min-w-0">
                  <p className="break-words font-black text-slate-950">{order.saleNumber}</p>
                  <p className="mt-1 text-sm text-slate-500">{order.storeName}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline" className="border-green-100 bg-green-50 capitalize text-green-800">
                    {(order.deliveryStatus || order.orderStatus || order.status || 'pending').replace(/_/g, ' ')}
                  </Badge>
                  <span className="font-black text-green-800">{formatAmount(order.total, order.currency)}</span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AccountLayout>
  );
};

const SummaryCard = ({ icon: Icon, label, value, to }) => (
  <Link to={to} className="rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-green-300 hover:bg-green-50/40 sm:rounded-[2rem]">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-800">
      <Icon className="h-6 w-6" />
    </span>
    <p className="mt-4 text-sm font-semibold text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
  </Link>
);

const SummaryCardSkeleton = () => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:rounded-[2rem]" role="status" aria-label="Loading account summary">
    <SkeletonBlock className="h-12 w-12 rounded-2xl" />
    <SkeletonBlock className="mt-4 h-4 w-24" />
    <SkeletonBlock className="mt-2 h-8 w-16" />
  </div>
);

export default ShopperAccountDashboard;
