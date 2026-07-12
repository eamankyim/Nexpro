import { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { STUDIO_LIKE_TYPES } from '../constants/studioLikeTypes';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Clock3,
  Loader2,
  Package,
  Settings,
  ShoppingBag,
  Store,
  WalletCards,
} from 'lucide-react';
import storeService from '../services/storeService';
import { formatAmount, formatInteger } from '../utils/formatNumber';
import OnlineStoreOrderBanner from '../components/store/OnlineStoreOrderBanner';
import {
  getCustomerName,
  getOrderNumber,
  useOnlineStoreOrderAttention,
} from '../hooks/useOnlineStoreOrderAttention';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const toCount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getOrderTotal = (order) => toCount(order?.total ?? order?.amount ?? order?.grandTotal);

const getOrderChannelLabel = (order) => (
  order?.orderType === 'service' ? 'Service order' : 'Sabito Store'
);

const getOrderStatus = (order) => (
  order?.orderStatus === 'cancelled'
      ? 'cancelled'
      : ['cancelled', 'refunded'].includes(String(order?.status || '').toLowerCase())
        ? order.status
        : order?.deliveryStatus
          || order?.orderStatus
          || order?.paymentStatus
          || order?.status
          || 'pending'
);

const formatStatusLabel = (status) => String(status || 'pending')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase());

const StoreDashboard = () => {
  const { activeTenant } = useAuth();
  const { data: statusResponse, isLoading } = useQuery({
    queryKey: ['store', 'setup-status'],
    queryFn: () => storeService.getSetupStatus(),
  });

  const data = statusResponse?.data ?? statusResponse ?? {};
  const settings = data.settings;
  const checklist = data.checklist || {};
  const hasStoreSettings = Boolean(checklist.hasSettings);
  const isStudioStore = checklist.storeMode === 'studio' || STUDIO_LIKE_TYPES.includes(activeTenant?.businessType);

  const {
    orderStats,
    recentOrders,
    pendingOrderCount,
    latestOrder,
    hasLoadedOrderStats,
    isOrderStatsFetching,
    isRecentOrdersFetching,
    isRecentOrdersLoading,
    isRecentOrdersError,
  } = useOnlineStoreOrderAttention({ enabled: hasStoreSettings });

  const totalOrders = useMemo(
    () => toCount(orderStats?.total ?? recentOrders.length),
    [orderStats?.total, recentOrders.length]
  );
  const checklistItems = useMemo(() => ([
    ['Store information', checklist.hasBasics],
    ['Branding', checklist.brandingReady],
    ['Contact details', checklist.hasContact],
    ['Fulfillment', checklist.hasFulfillment],
    [isStudioStore ? 'Published service' : 'Published listing', checklist.hasPublishedListing],
  ]), [
    checklist.brandingReady,
    checklist.hasBasics,
    checklist.hasContact,
    checklist.hasFulfillment,
    checklist.hasPublishedListing,
    isStudioStore,
  ]);
  const isChecklistComplete = checklistItems.every(([, done]) => done === true);
  const showLaunchChecklist = !checklist.launched || !isChecklistComplete;
  const stats = useMemo(() => ([
    {
      label: isStudioStore ? 'Published services' : 'Published listings',
      value: formatInteger(checklist.listingsCount || 0),
      description: isStudioStore ? 'Services customers can request online' : 'Products customers can buy online',
      icon: Package,
    },
    {
      label: 'Sabito Store status',
      value: checklist.launched ? 'Live' : 'Draft',
      description: checklist.launched
        ? (isStudioStore ? 'Public Sabito studio storefront is active' : 'Public Sabito storefront is active')
        : 'Finish setup to launch',
      icon: Store,
    },
    {
      label: 'Pending orders',
      value: isOrderStatsFetching && !hasLoadedOrderStats ? '...' : formatInteger(pendingOrderCount),
      description: 'Payment or fulfillment needs attention',
      icon: Clock3,
    },
    {
      label: 'Total Sabito revenue',
      value: isOrderStatsFetching && !hasLoadedOrderStats ? '...' : formatAmount(orderStats?.totalRevenue || 0),
      description: `${formatInteger(totalOrders)} online ${totalOrders === 1 ? 'order' : 'orders'} received`,
      icon: WalletCards,
    },
  ]), [
    checklist.launched,
    checklist.listingsCount,
    isStudioStore,
    hasLoadedOrderStats,
    isOrderStatsFetching,
    orderStats?.totalRevenue,
    pendingOrderCount,
    totalOrders,
  ]);

  if (!isLoading && !checklist.hasSettings) {
    return <Navigate to="/store/setup" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sabito Store dashboard</h1>
          <p className="text-muted-foreground">
            {settings?.displayName || 'Your Sabito Store'} {checklist.launched ? 'is live' : 'is not launched yet'}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/store/settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      {!isStudioStore ? (
        <OnlineStoreOrderBanner
          pendingOrderCount={pendingOrderCount}
          latestOrder={latestOrder}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stat.value}</div>
                <p className="mt-1 text-sm text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="w-full border border-border">
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle>Recent online orders</CardTitle>
            <CardDescription>Track new storefront orders without leaving the dashboard.</CardDescription>
          </div>
          <Button variant="outline" asChild className="shrink-0">
            <Link to="/store/orders">
              View all orders
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="w-full">
            {isRecentOrdersLoading || (isRecentOrdersFetching && recentOrders.length === 0) ? (
              <div className="flex items-center gap-2 rounded-xl border border-border p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading recent online orders...
              </div>
            ) : isRecentOrdersError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Could not load recent online orders. Use the online orders page to try again.
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground" />
                <h3 className="mt-3 font-semibold">No online orders yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Share your public store link and new orders will appear here.
                </p>
              </div>
            ) : (
              <div className="w-full divide-y divide-border rounded-xl border border-border">
                {recentOrders.slice(0, 5).map((order) => {
                  const status = getOrderStatus(order);
                  return (
                    <div
                      key={order.id || getOrderNumber(order)}
                      className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(160px,0.75fr)] lg:items-center lg:gap-6"
                    >
                      <p className="min-w-0 font-medium">{getOrderNumber(order)}</p>
                      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 lg:flex-col lg:items-start lg:gap-1">
                        <Badge variant="outline" className="w-fit">
                          {formatStatusLabel(status)}
                        </Badge>
                        <p className="min-w-0 text-sm text-muted-foreground">
                          {getCustomerName(order)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-end lg:justify-center lg:gap-1 lg:text-right">
                        <p className="font-semibold">{formatAmount(getOrderTotal(order))}</p>
                        <p className="text-xs text-muted-foreground">{getOrderChannelLabel(order)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </CardContent>
      </Card>

      {showLaunchChecklist && (
        <Card className="border border-border">
          <CardHeader>
            <CardTitle>Launch checklist</CardTitle>
            <CardDescription>Finish these setup steps before the store is fully ready.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {checklistItems.map(([label, done]) => (
              <div key={label} className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm font-medium">{label}</span>
                <Badge variant={done ? 'default' : 'outline'}>{done ? 'Done' : 'Needed'}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StoreDashboard;
