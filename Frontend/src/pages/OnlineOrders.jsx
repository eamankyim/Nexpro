import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  Download,
  Eye,
  Filter,
  MessageCircle,
  MoreHorizontal,
  PackageCheck,
  RefreshCw,
  Search,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import dayjs from 'dayjs';
import storeService from '../services/storeService';
import { useDebounce } from '../hooks/useDebounce';
import { formatAmount } from '../utils/formatNumber';
import { showError, showSuccess } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DEBOUNCE_DELAYS, PAGINATION } from '../constants';

const STATUS_FILTERS = [
  { label: 'All Orders', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Paid', value: 'paid' },
  { label: 'Processing', value: 'processing' },
  { label: 'Out For Delivery', value: 'out_for_delivery' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
];

const STATUS_ACTIONS = [
  { label: 'Mark processing', value: 'processing' },
  { label: 'Mark out for delivery', value: 'out_for_delivery' },
  { label: 'Mark delivered', value: 'delivered' },
  { label: 'Cancel order', value: 'cancelled' },
];

const STATUS_STYLES = {
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  pending_payment: 'border-amber-200 bg-amber-50 text-amber-700',
  paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  processing: 'border-blue-200 bg-blue-50 text-blue-700',
  ready: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  out_for_delivery: 'border-purple-200 bg-purple-50 text-purple-700',
  delivered: 'border-green-200 bg-green-50 text-green-700',
  cancelled: 'border-red-200 bg-red-50 text-red-700',
};

const normalizeStatus = (status) => String(status || 'pending').toLowerCase();

const formatStatusLabel = (status) => (
  normalizeStatus(status)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
);

const getBody = (response) => response?.data ?? response ?? {};

const getOrderRows = (body) => {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.data)) return body.data;
  if (Array.isArray(body.orders)) return body.orders;
  if (Array.isArray(body.data?.orders)) return body.data.orders;
  if (Array.isArray(body.rows)) return body.rows;
  return [];
};

const getStats = (body, orders) => {
  const stats = body.stats || body.data?.stats || body.summary || {};
  const today = dayjs();
  const todayOrders = orders.filter((order) => dayjs(order.createdAt || order.orderDate).isSame(today, 'day'));

  return {
    totalOrders: stats.totalOrders ?? stats.total ?? orders.length,
    pendingPayment: stats.pendingPayment ?? orders.filter((order) => {
      const paymentStatus = normalizeStatus(order.paymentStatus || order.payment?.status);
      const orderStatus = normalizeStatus(order.status || order.orderStatus);
      return paymentStatus === 'pending' || orderStatus === 'pending_payment';
    }).length,
    processing: stats.processing ?? orders.filter((order) => normalizeStatus(order.status || order.orderStatus) === 'processing').length,
    delivered: stats.delivered ?? orders.filter((order) => normalizeStatus(order.status || order.orderStatus) === 'delivered').length,
    cancelled: stats.cancelled ?? orders.filter((order) => normalizeStatus(order.status || order.orderStatus) === 'cancelled').length,
    todayRevenue: stats.todayRevenue ?? stats.todaySales ?? todayOrders.reduce((sum, order) => sum + Number(order.total || order.amount || order.grandTotal || 0), 0),
    todayOrderCount: stats.todayOrderCount ?? stats.todayOrders ?? todayOrders.length,
  };
};

const getPagination = (body, fallbackPage) => {
  const pagination = body.pagination || body.data?.pagination || body.meta || {};
  const page = Number(pagination.page || pagination.currentPage || fallbackPage || 1);
  const totalPages = Number(pagination.totalPages || pagination.pages || 1);
  const total = Number(pagination.total || pagination.count || 0);

  return { page, totalPages: Math.max(totalPages, 1), total };
};

const getCustomerName = (order) => (
  order.customerName
  || order.customer?.name
  || order.customer?.fullName
  || order.customer?.businessName
  || 'Guest customer'
);

const getCustomerPhone = (order) => (
  order.customerPhone
  || order.phone
  || order.customer?.phone
  || order.customer?.phoneNumber
  || order.deliveryAddress?.phone
  || ''
);

const getCustomerInitials = (order) => getCustomerName(order)
  .split(' ')
  .filter(Boolean)
  .slice(0, 2)
  .map((name) => name[0])
  .join('')
  .toUpperCase();

const getOrderItems = (order) => (
  order.items
  || order.orderItems
  || order.saleItems
  || order.lineItems
  || order.products
  || []
);

const getItemSummary = (order) => {
  const items = getOrderItems(order);
  if (!items.length) return order.itemsSummary || 'No item details';
  const firstItem = items[0];
  const firstName = firstItem.name || firstItem.productName || firstItem.product?.name || firstItem.title || 'Item';
  const quantity = firstItem.quantity || firstItem.qty || 1;
  const remaining = items.length - 1;
  return `${quantity} x ${firstName}${remaining > 0 ? ` +${remaining} more` : ''}`;
};

const getPaymentLabel = (order) => {
  const paymentStatus = order.paymentStatus || order.payment?.status || order.status;
  const method = order.paymentMethod || order.payment?.method || 'Online';
  return `${formatStatusLabel(paymentStatus)} · ${formatStatusLabel(method)}`;
};

const getWhatsAppHref = (order) => {
  const phone = getCustomerPhone(order).replace(/[^\d]/g, '');
  if (!phone) return '';
  const orderNo = order.orderNumber || order.orderNo || order.saleNumber || order.id;
  const message = `Hi ${getCustomerName(order)}, thanks for your online order ${orderNo}. We are following up on it.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

const getPreviewUrl = (settings) => {
  const slug = settings?.slug || settings?.storeSlug;
  if (!slug) return '';
  return `/store/${encodeURIComponent(slug)}`;
};

const StatusBadge = ({ status }) => {
  const normalized = normalizeStatus(status);
  return (
    <Badge variant="outline" className={STATUS_STYLES[normalized] || 'border-border bg-muted/30 text-foreground'}>
      {formatStatusLabel(normalized)}
    </Badge>
  );
};

const DetailRow = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 border-b border-border py-3 text-sm last:border-b-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{value || '—'}</span>
  </div>
);

const OnlineOrders = () => {
  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const debouncedSearch = useDebounce(searchValue, DEBOUNCE_DELAYS.SEARCH);

  const queryParams = useMemo(() => ({
    page,
    limit: PAGINATION.DEFAULT_PAGE_SIZE,
    search: debouncedSearch,
    status: statusFilter === 'all' ? undefined : statusFilter,
  }), [debouncedSearch, page, statusFilter]);

  const {
    data: response,
    error,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['store', 'online-orders', queryParams],
    queryFn: () => storeService.getOrders(queryParams),
    retry: 1,
  });

  const { data: settingsResponse } = useQuery({
    queryKey: ['store', 'settings'],
    queryFn: () => storeService.getSettings(),
    retry: 1,
  });

  const body = useMemo(() => getBody(response), [response]);
  const orders = useMemo(() => getOrderRows(body), [body]);
  const stats = useMemo(() => getStats(body, orders), [body, orders]);
  const pagination = useMemo(() => getPagination(body, page), [body, page]);
  const settings = getBody(settingsResponse);
  const previewUrl = getPreviewUrl(settings?.settings || settings);

  const kpiCards = useMemo(() => ([
    { label: 'Total online orders', value: stats.totalOrders, icon: ShoppingBag },
    { label: 'Pending payment', value: stats.pendingPayment, icon: CalendarDays },
    { label: 'Processing', value: stats.processing, icon: PackageCheck },
    { label: 'Delivered', value: stats.delivered, icon: Truck },
    { label: 'Cancelled', value: stats.cancelled, icon: ShoppingBag },
  ]), [stats.cancelled, stats.delivered, stats.pendingPayment, stats.processing, stats.totalOrders]);

  const detailOrder = selectedOrder || {};
  const detailItems = useMemo(() => getOrderItems(detailOrder), [detailOrder]);

  const detailQuery = useQuery({
    queryKey: ['store', 'online-orders', selectedOrder?.id],
    queryFn: () => storeService.getOrderById(selectedOrder.id),
    enabled: Boolean(isDetailOpen && selectedOrder?.id),
    retry: 1,
  });

  const fullDetailOrder = useMemo(() => {
    const detailBody = getBody(detailQuery.data);
    return detailBody.data || detailBody.order || detailBody || detailOrder;
  }, [detailOrder, detailQuery.data]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status }) => storeService.updateOrderStatus(orderId, status),
    onSuccess: () => {
      showSuccess('Online order status updated');
      queryClient.invalidateQueries({ queryKey: ['store', 'online-orders'] });
    },
    onError: (mutationError) => {
      showError(mutationError, 'Failed to update online order status');
    },
  });

  const handleSearchChange = useCallback((event) => {
    setSearchValue(event.target.value);
    setPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((status) => {
    setStatusFilter(status);
    setPage(1);
  }, []);

  const handleViewOrder = useCallback((order) => {
    setSelectedOrder(order);
    setIsDetailOpen(true);
  }, []);

  const handleStatusUpdate = useCallback((order, status) => {
    updateStatusMutation.mutate({ orderId: order.id, status });
  }, [updateStatusMutation]);

  const handleExportPlaceholder = useCallback(() => {
    showSuccess('Export for online orders is coming soon');
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const renderStatusActions = useCallback((order) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-11 w-11 md:h-8 md:w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open order actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleViewOrder(order)}>
          <Eye className="mr-2 h-4 w-4" />
          View details
        </DropdownMenuItem>
        {getWhatsAppHref(order) && (
          <DropdownMenuItem asChild>
            <a href={getWhatsAppHref(order)} target="_blank" rel="noreferrer">
              <MessageCircle className="mr-2 h-4 w-4" />
              WhatsApp customer
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Update status</DropdownMenuLabel>
        {STATUS_ACTIONS.map((action) => (
          <DropdownMenuItem
            key={action.value}
            disabled={updateStatusMutation.isPending}
            onClick={() => handleStatusUpdate(order, action.value)}
          >
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ), [handleStatusUpdate, handleViewOrder, updateStatusMutation.isPending]);

  const renderLoadingSkeleton = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-lg" />
    </div>
  );

  const renderEmptyState = () => (
    <Card className="border border-border">
      <CardContent className="flex min-h-64 flex-col items-center justify-center text-center">
        <ShoppingBag className="mb-3 h-10 w-10 text-muted-foreground" />
        <h2 className="font-semibold">No online orders found</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {error
            ? 'The online orders API is not available yet. Orders will appear here when the backend endpoint is ready.'
            : 'Orders from your online storefront will appear here as customers check out.'}
        </p>
      </CardContent>
    </Card>
  );

  const renderOrderTable = () => (
    <Card className="hidden border border-border md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order No</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id || order.orderNumber || order.saleNumber}>
              <TableCell className="font-medium">{order.orderNumber || order.orderNo || order.saleNumber || '—'}</TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{getCustomerName(order)}</div>
                  <div className="text-xs text-muted-foreground">{getCustomerPhone(order) || 'No phone'}</div>
                </div>
              </TableCell>
              <TableCell className="max-w-[240px] truncate">{getItemSummary(order)}</TableCell>
              <TableCell className="font-medium">{formatAmount(order.total || order.amount || order.grandTotal || 0)}</TableCell>
              <TableCell>{getPaymentLabel(order)}</TableCell>
              <TableCell><StatusBadge status={order.status || order.orderStatus} /></TableCell>
              <TableCell>{dayjs(order.createdAt || order.orderDate).format('MMM D, YYYY h:mm A')}</TableCell>
              <TableCell className="text-right">{renderStatusActions(order)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );

  const renderMobileCards = () => (
    <div className="space-y-2 md:hidden">
      {orders.map((order) => (
        <Card key={order.id || order.orderNumber || order.saleNumber} className="border border-border">
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {getCustomerInitials(order) || 'OO'}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{order.orderNumber || order.orderNo || order.saleNumber || 'Online order'}</p>
                    <p className="truncate text-xs text-muted-foreground">{getCustomerName(order)}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">{formatAmount(order.total || order.amount || order.grandTotal || 0)}</p>
                </div>
                <p className="truncate text-xs text-muted-foreground">{getItemSummary(order)}</p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <StatusBadge status={order.status || order.orderStatus} />
                  <span className="text-xs text-muted-foreground">{dayjs(order.createdAt || order.orderDate).format('MMM D, YYYY h:mm A')}</span>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                  {getWhatsAppHref(order) && (
                    <Button variant="outline" size="icon" className="h-11 w-11" asChild>
                      <a href={getWhatsAppHref(order)} target="_blank" rel="noreferrer">
                        <MessageCircle className="h-4 w-4" />
                        <span className="sr-only">WhatsApp customer</span>
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="min-w-16" onClick={() => handleViewOrder(order)}>View</Button>
                  {renderStatusActions(order)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderPagination = () => (
    <div className="flex flex-col gap-3 border-t border-border pt-4 text-center text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:text-left">
      <span className="block">
        Page {pagination.page} of {pagination.totalPages}
        {pagination.total ? ` · ${pagination.total} orders` : ''}
      </span>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          disabled={page <= 1 || isFetching}
          onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}
        >
          Previous
        </Button>
        <Button
          size="sm"
          className="w-full sm:w-auto"
          disabled={page >= pagination.totalPages || isFetching}
          onClick={() => setPage((currentPage) => currentPage + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );

  const renderDetailDialog = () => (
    <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
      <DialogContent style={{ '--modal-w': 'min(42rem, 94vw)', '--modal-min-h': 'auto', '--modal-max-h': '92vh' }}>
        <DialogHeader>
          <DialogTitle>{fullDetailOrder.orderNumber || fullDetailOrder.orderNo || fullDetailOrder.saleNumber || 'Online order'}</DialogTitle>
          <DialogDescription>Review customer, payment, fulfillment, and item details.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {detailQuery.isFetching ? (
            <div className="space-y-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </div>
          ) : (
            <div className="space-y-5">
              <Card className="border border-border">
                <CardContent className="p-4">
                  <DetailRow label="Customer" value={getCustomerName(fullDetailOrder)} />
                  <DetailRow label="Phone" value={getCustomerPhone(fullDetailOrder)} />
                  <DetailRow label="Payment" value={getPaymentLabel(fullDetailOrder)} />
                  <DetailRow label="Status" value={formatStatusLabel(fullDetailOrder.status || fullDetailOrder.orderStatus)} />
                  <DetailRow label="Amount" value={formatAmount(fullDetailOrder.total || fullDetailOrder.amount || fullDetailOrder.grandTotal || 0)} />
                  <DetailRow label="Date" value={dayjs(fullDetailOrder.createdAt || fullDetailOrder.orderDate).format('MMM D, YYYY h:mm A')} />
                </CardContent>
              </Card>

              <Card className="border border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Items</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(getOrderItems(fullDetailOrder).length ? getOrderItems(fullDetailOrder) : detailItems).map((item, index) => (
                    <div key={item.id || index} className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0">
                      <div>
                        <p className="font-medium">{item.name || item.productName || item.product?.name || item.title || 'Item'}</p>
                        <p className="text-sm text-muted-foreground">Qty {item.quantity || item.qty || 1}</p>
                      </div>
                      <p className="font-medium">{formatAmount(item.total || item.amount || item.price || item.unitPrice || 0)}</p>
                    </div>
                  ))}
                  {!getOrderItems(fullDetailOrder).length && !detailItems.length && (
                    <p className="text-sm text-muted-foreground">No item details are available for this order yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Close</Button>
          {getWhatsAppHref(fullDetailOrder) && (
            <Button asChild>
              <a href={getWhatsAppHref(fullDetailOrder)} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold sm:text-2xl">Online orders</h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">Track storefront orders, payments, fulfillment, and customer follow-up.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Button variant="outline" className="w-full sm:w-auto" disabled={!previewUrl} asChild={Boolean(previewUrl)}>
            {previewUrl ? (
              <Link to={previewUrl}>
                <ArrowUpRight className="mr-2 h-4 w-4" />
                Preview Store
              </Link>
            ) : (
              <span>
                <ArrowUpRight className="mr-2 h-4 w-4" />
                Preview Store
              </span>
            )}
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={handleExportPlaceholder}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <Filter className="mr-2 h-4 w-4" />
                Filter
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Order status</DropdownMenuLabel>
              {STATUS_FILTERS.map((filter) => (
                <DropdownMenuItem key={filter.value} onClick={() => handleStatusFilterChange(filter.value)}>
                  {filter.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button className="w-full sm:w-auto" onClick={handleRefresh} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? renderLoadingSkeleton() : (
        <>
          <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-5">
            {kpiCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <Card key={card.label} className={`border border-border ${index === kpiCards.length - 1 ? 'col-span-2 md:col-span-1' : ''}`}>
                  <CardHeader className="flex flex-row items-start justify-between gap-2 p-4 pb-2 sm:p-6 sm:pb-2">
                    <CardTitle className="text-xs font-medium leading-snug text-muted-foreground sm:text-sm">{card.label}</CardTitle>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                    <div className="text-2xl font-semibold leading-none">{card.value}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card className="border border-border">
              <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
                <CardTitle className="text-base text-primary">Today&apos;s Online Sales</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                <div className="text-3xl font-semibold sm:text-4xl">{formatAmount(stats.todayRevenue || 0)}</div>
                <p className="mt-1 text-sm text-muted-foreground">{stats.todayOrderCount || 0} orders today · Trend coming soon</p>
              </CardContent>
            </Card>
            <Card className="border border-border">
              <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
                <CardTitle className="text-base">Store Activity</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 divide-x divide-border p-4 pt-0 text-center text-xs sm:p-6 sm:pt-0 sm:text-sm lg:grid-cols-1 lg:divide-x-0 lg:text-left">
                <div className="space-y-1 px-2 first:pl-0 lg:flex lg:items-center lg:justify-between lg:px-0 lg:py-2">
                  <span className="text-muted-foreground">Today&apos;s orders</span>
                  <span className="block font-semibold lg:inline">{stats.todayOrderCount || 0}</span>
                </div>
                <div className="space-y-1 px-2 lg:flex lg:items-center lg:justify-between lg:px-0 lg:py-2">
                  <span className="text-muted-foreground">Visitors</span>
                  <span className="block font-semibold text-muted-foreground lg:inline">Not tracked</span>
                </div>
                <div className="space-y-1 px-2 last:pr-0 lg:flex lg:items-center lg:justify-between lg:px-0 lg:py-2">
                  <span className="text-muted-foreground">Conversion</span>
                  <span className="block font-semibold text-muted-foreground lg:inline">Not tracked</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-border">
            <CardContent className="space-y-4 p-3 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchValue}
                    onChange={handleSearchChange}
                    placeholder="Search by order, customer, phone..."
                    className="h-11 pl-9"
                  />
                </div>
                <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                  {STATUS_FILTERS.map((filter) => (
                    <Button
                      key={filter.value}
                      variant={statusFilter === filter.value ? 'default' : 'outline'}
                      size="sm"
                      className="shrink-0"
                      onClick={() => handleStatusFilterChange(filter.value)}
                    >
                      {filter.label}
                    </Button>
                  ))}
                </div>
              </div>

              {orders.length === 0 ? renderEmptyState() : (
                <>
                  {renderOrderTable()}
                  {renderMobileCards()}
                  {renderPagination()}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {renderDetailDialog()}
    </div>
  );
};

export default OnlineOrders;
