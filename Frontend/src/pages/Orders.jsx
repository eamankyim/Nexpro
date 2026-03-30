import { useState, useEffect, useCallback, useRef } from 'react';
import { LayoutGrid, List, RefreshCw, Loader2, Clock, ChefHat, CheckCircle, User, Package, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import saleService from '../services/saleService';
import { useAuth } from '../context/AuthContext';
import { useResponsive } from '../hooks/useResponsive';
import { showSuccess, showError } from '../utils/toast';
import dayjs from 'dayjs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  SHOP_TYPES,
  DELIVERY_STATUS_ORDER,
  DELIVERY_STATUS_LABELS,
} from '../constants';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { resolveImageUrl } from '../utils/fileUtils';

const POLL_INTERVAL_MS = 12000; // 12 seconds
const KANBAN_COLUMNS = [
  { key: ORDER_STATUSES.RECEIVED, label: 'Received', icon: Clock },
  { key: ORDER_STATUSES.PREPARING, label: 'Preparing', icon: ChefHat },
  { key: ORDER_STATUSES.READY, label: 'Ready', icon: CheckCircle },
];

/**
 * Play a short beep when a new order arrives (browser autoplay policy may require user interaction first)
 */
const playNewOrderSound = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 880;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (err) {
    console.warn('New order sound failed:', err);
  }
};

/**
 * Group order items by product (productId) and sum quantities
 */
const groupOrderItems = (items) => {
  if (!items?.length) return [];
  const map = {};
  items.forEach((i) => {
    const key = i.productId || i.name;
    if (!map[key]) {
      map[key] = {
        productId: i.productId,
        name: i.name,
        quantity: 0,
        imageUrl: i.product?.imageUrl,
      };
    }
    map[key].quantity += parseFloat(i.quantity) || 1;
    if (!map[key].imageUrl && i.product?.imageUrl) map[key].imageUrl = i.product.imageUrl;
  });
  return Object.values(map);
};

function DeliveryStatusSelect({ order, loadingId, onDeliveryChange, triggerClassName }) {
  return (
    <Select
      value={order.deliveryStatus || '__none__'}
      onValueChange={(v) => onDeliveryChange(order, v)}
      disabled={loadingId === order.id}
    >
      <SelectTrigger className={triggerClassName || 'h-8 text-xs w-full max-w-[200px]'} aria-label="Delivery status">
        <SelectValue placeholder="Delivery" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">Delivery: not set</SelectItem>
        {DELIVERY_STATUS_ORDER.map((key) => (
          <SelectItem key={key} value={key}>
            {DELIVERY_STATUS_LABELS[key]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const OrderCard = ({ order, onStatusChange, onDeliveryChange, loadingId, dragHandleProps, touchFriendly }) => {
  const groupedItems = groupOrderItems(order.items);
  const customerName = order.customer?.name || 'Walk-in';
  const timeAgo = order.createdAt ? dayjs(order.createdAt).fromNow() : '';

  return (
    <Card className="border border-border">
      <CardHeader className="py-2 px-3">
        <div
          {...(dragHandleProps || {})}
          className={`flex items-center justify-between gap-1 ${dragHandleProps ? 'touch-none cursor-grab active:cursor-grabbing select-none' : ''}`}
          aria-label={dragHandleProps ? 'Drag to move order' : undefined}
        >
          <div className={`flex items-center justify-center text-muted-foreground flex-shrink-0 ${touchFriendly ? 'min-w-[44px] min-h-[44px]' : 'min-w-[28px]'}`}>
            <GripVertical className="h-4 w-4" />
          </div>
          <CardTitle className="text-sm font-medium flex-1 min-w-0 truncate">{order.saleNumber}</CardTitle>
          <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo}</span>
        </div>
      </CardHeader>
      <CardContent className="py-2 px-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          {groupedItems.map((item) => (
            <div
              key={item.productId || item.name}
              className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5 min-w-0"
            >
              <div className="w-10 h-10 rounded flex-shrink-0 overflow-hidden bg-muted relative flex items-center justify-center">
                <Package className="absolute h-5 w-5 text-muted-foreground" aria-hidden />
                {item.imageUrl && (
                  <img
                    src={resolveImageUrl(item.imageUrl) || ''}
                    alt={item.name}
                    className="relative z-10 w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {Number(item.quantity) % 1 === 0 ? item.quantity : parseFloat(item.quantity).toFixed(2)}x
                </p>
              </div>
            </div>
          ))}
        </div>
        {groupedItems.length === 0 && (
          <p className="text-sm text-muted-foreground">No items</p>
        )}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          {customerName}
        </div>
        <div className="flex flex-wrap gap-1 pt-1">
          {order.orderStatus === ORDER_STATUSES.RECEIVED && (
            <Button
              size="sm"
              variant="outline"
              className={touchFriendly ? 'min-h-[44px] min-w-[44px] text-xs' : 'h-7 text-xs'}
              disabled={loadingId === order.id}
              onClick={() => onStatusChange(order, ORDER_STATUSES.PREPARING)}
            >
              {loadingId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Start'}
            </Button>
          )}
          {order.orderStatus === ORDER_STATUSES.PREPARING && (
            <Button
              size="sm"
              variant="outline"
              className={touchFriendly ? 'min-h-[44px] min-w-[44px] text-xs' : 'h-7 text-xs'}
              disabled={loadingId === order.id}
              onClick={() => onStatusChange(order, ORDER_STATUSES.READY)}
            >
              {loadingId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Ready'}
            </Button>
          )}
          {order.orderStatus === ORDER_STATUSES.READY && (
            <Button
              size="sm"
              className={touchFriendly ? 'min-h-[44px] min-w-[44px] text-xs bg-brand hover:bg-brand-dark' : 'h-7 text-xs bg-brand hover:bg-brand-dark'}
              disabled={loadingId === order.id}
              onClick={() => onStatusChange(order, ORDER_STATUSES.COMPLETED)}
            >
              {loadingId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Complete'}
            </Button>
          )}
        </div>
        <div className="pt-2 border-t border-border">
          <DeliveryStatusSelect
            order={order}
            loadingId={loadingId}
            onDeliveryChange={onDeliveryChange}
            triggerClassName={touchFriendly ? 'h-10 text-sm w-full max-w-none' : 'h-8 text-xs w-full max-w-[220px]'}
          />
        </div>
      </CardContent>
    </Card>
  );
};

const Orders = () => {
  const { activeTenant } = useAuth();
  const { isMobile } = useResponsive();
  const shopType =
    activeTenant?.metadata?.businessSubType ||
    activeTenant?.metadata?.shopType ||
    null;
  const isRestaurant = shopType === SHOP_TYPES.RESTAURANT;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'list'
  const [statusFilter, setStatusFilter] = useState('all');
  const [loadingId, setLoadingId] = useState(null);
  const lastOrderIds = useRef(new Set());
  const [hasInteracted, setHasInteracted] = useState(false);
  const isDraggingRef = useRef(false);

  const fetchOrders = useCallback(async () => {
    if (!isRestaurant) return;
    if (isDraggingRef.current) return;
    try {
      const today = dayjs().format('YYYY-MM-DD');
      const params = {
        activeOrders: true,
        startDate: today,
        endDate: today,
        limit: 100,
      };
      if (statusFilter !== 'all') params.orderStatus = statusFilter;
      const res = await saleService.getOrders(params);
      const data = res?.data?.data ?? res?.data ?? [];
      const rows = Array.isArray(data) ? data : [];
      setOrders(rows);

      // Detect new orders for sound
      const currentIds = new Set(rows.map((o) => o.id));
      if (lastOrderIds.current.size > 0) {
        const newIds = rows.filter((o) => !lastOrderIds.current.has(o.id)).map((o) => o.id);
        if (newIds.length > 0 && hasInteracted) {
          playNewOrderSound();
        }
      }
      lastOrderIds.current = currentIds;
    } catch (err) {
      showError(err, 'Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [isRestaurant, statusFilter, hasInteracted]);

  useEffect(() => {
    if (!isRestaurant) return;
    fetchOrders();
    const interval = setInterval(fetchOrders, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchOrders, isRestaurant]);

  const handleStatusChange = useCallback(
    async (order, newStatus) => {
      setLoadingId(order.id);
      try {
        await saleService.updateOrderStatus(order.id, newStatus);
        showSuccess(`Order ${order.saleNumber} moved to ${ORDER_STATUS_LABELS[newStatus]}`);
        await fetchOrders();
      } catch (err) {
        showError(err, 'Failed to update order status');
      } finally {
        setLoadingId(null);
      }
    },
    [fetchOrders]
  );

  const handleDeliveryChange = useCallback(
    async (order, value) => {
      const val = value === '__none__' ? null : value;
      setLoadingId(order.id);
      try {
        await saleService.updateDeliveryStatus(order.id, val);
        showSuccess('Delivery status updated');
        await fetchOrders();
      } catch (err) {
        showError(err, 'Failed to update delivery status');
      } finally {
        setLoadingId(null);
      }
    },
    [fetchOrders]
  );

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const handleDragEnd = useCallback(
    (result) => {
      isDraggingRef.current = false;
      const { source, destination } = result;
      if (!destination || source.droppableId === destination.droppableId) return;
      const order = orders.find((o) => String(o.id) === String(source.draggableId));
      if (!order) return;
      handleStatusChange(order, destination.droppableId);
    },
    [orders, handleStatusChange]
  );

  const ordersByStatus = useCallback(() => {
    const map = { [ORDER_STATUSES.RECEIVED]: [], [ORDER_STATUSES.PREPARING]: [], [ORDER_STATUSES.READY]: [] };
    orders.forEach((o) => {
      if (map[o.orderStatus]) map[o.orderStatus].push(o);
    });
    return map;
  }, [orders]);

  if (!isRestaurant) {
    return (
      <div>
        <p className="text-muted-foreground">Order tracking is only available for restaurant tenants.</p>
      </div>
    );
  }

  const grouped = ordersByStatus();

  return (
    <div onClick={() => setHasInteracted(true)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Kitchen Orders</h1>
        <div className="flex items-center gap-2 flex-1 min-w-0 sm:justify-end sm:ml-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 min-h-[44px] min-w-[120px] sm:min-w-[140px] rounded-md border border-input bg-background px-3 sm:px-4 text-sm flex-shrink-0"
              >
                <option value="all">All active</option>
                <option value={ORDER_STATUSES.RECEIVED}>Received</option>
                <option value={ORDER_STATUSES.PREPARING}>Preparing</option>
                <option value={ORDER_STATUSES.READY}>Ready</option>
              </select>
            </TooltipTrigger>
            <TooltipContent>Filter orders by status</TooltipContent>
          </Tooltip>
          {!isMobile && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex border border-border rounded-md">
                  <Button
                    variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-r-none"
                    onClick={() => setViewMode('kanban')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-l-none"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent>Switch between Kanban and list view</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={() => fetchOrders()} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh orders</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {loading && orders.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (isMobile || viewMode === 'kanban') ? (
        <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className={isMobile ? 'flex flex-col gap-4' : 'grid grid-cols-1 md:grid-cols-3 gap-4'}>
            {KANBAN_COLUMNS.map((col) => {
              const columnOrders = grouped[col.key] ?? [];
              const isEmpty = columnOrders.length === 0;
              return (
                <div key={col.key} className="border border-border rounded-lg p-3 bg-muted/30 min-h-[200px]">
                  <div className="flex items-center gap-2 mb-3">
                    <col.icon className="h-4 w-4" />
                    <span className="font-medium">{col.label}</span>
                    <Badge variant="secondary">{columnOrders.length}</Badge>
                  </div>
                  <Droppable droppableId={col.key}>
                    {(droppableProvided) => (
                      <div
                        ref={droppableProvided.innerRef}
                        {...droppableProvided.droppableProps}
                        className="space-y-2 min-h-[120px]"
                      >
                        {columnOrders.map((order, index) => (
                          <Draggable key={order.id} draggableId={String(order.id)} index={index}>
                            {(draggableProvided, snapshot) => (
                              <div
                                ref={draggableProvided.innerRef}
                                {...draggableProvided.draggableProps}
                                className={snapshot.isDragging ? 'opacity-90' : ''}
                              >
                                <OrderCard
                                  order={order}
                                  onStatusChange={handleStatusChange}
                                  onDeliveryChange={handleDeliveryChange}
                                  loadingId={loadingId}
                                  dragHandleProps={draggableProvided.dragHandleProps}
                                  touchFriendly={isMobile}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {droppableProvided.placeholder}
                        {isEmpty && (
                          <div className="flex flex-col items-center justify-center py-8 px-4 text-center border border-dashed border-border rounded-md bg-background/50">
                            <col.icon className="h-10 w-10 text-muted-foreground/50 mb-2" />
                            <p className="text-sm text-muted-foreground font-medium">No orders</p>
                            <p className="text-xs text-muted-foreground/80 mt-0.5">
                              {col.key === ORDER_STATUSES.RECEIVED
                                ? 'New orders will appear here'
                                : col.key === ORDER_STATUSES.PREPARING
                                  ? 'Drag orders here or move from Received'
                                  : 'Drag orders here or move from Preparing'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const listGroupedItems = groupOrderItems(order.items);
            return (
            <Card key={order.id} className="border border-border">
              <CardContent className="py-3 px-4 flex flex-wrap items-center gap-4">
                <span className="font-medium">{order.saleNumber}</span>
                <Badge variant="outline">{ORDER_STATUS_LABELS[order.orderStatus] || order.orderStatus}</Badge>
                <div className="flex items-center gap-2 flex-wrap">
                  {listGroupedItems.map((item) => (
                    <div key={item.productId || item.name} className="flex items-center gap-1.5 rounded border border-border bg-muted/30 px-2 py-1">
                      <div className="w-8 h-8 rounded overflow-hidden bg-muted relative flex items-center justify-center flex-shrink-0">
                        <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
                        {item.imageUrl && (
                          <img
                            src={resolveImageUrl(item.imageUrl) || ''}
                            alt={item.name}
                            className="relative z-10 w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {Number(item.quantity) % 1 === 0 ? item.quantity : parseFloat(item.quantity).toFixed(2)}x {item.name}
                      </span>
                    </div>
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">{order.customer?.name || 'Walk-in'}</span>
                <span className="text-sm text-muted-foreground">{dayjs(order.createdAt).format('h:mm A')}</span>
                <div className={isMobile ? 'ml-auto flex gap-1 [&>button]:min-h-[44px] [&>button]:min-w-[44px]' : 'ml-auto flex gap-1'}>
                  {order.orderStatus === ORDER_STATUSES.RECEIVED && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loadingId === order.id}
                      onClick={() => handleStatusChange(order, ORDER_STATUSES.PREPARING)}
                    >
                      {loadingId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Start'}
                    </Button>
                  )}
                  {order.orderStatus === ORDER_STATUSES.PREPARING && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loadingId === order.id}
                      onClick={() => handleStatusChange(order, ORDER_STATUSES.READY)}
                    >
                      {loadingId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Ready'}
                    </Button>
                  )}
                  {order.orderStatus === ORDER_STATUSES.READY && (
                    <Button
                      size="sm"
                      className="bg-brand hover:bg-brand-dark"
                      disabled={loadingId === order.id}
                      onClick={() => handleStatusChange(order, ORDER_STATUSES.COMPLETED)}
                    >
                      {loadingId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Complete'}
                    </Button>
                  )}
                  <DeliveryStatusSelect
                    order={order}
                    loadingId={loadingId}
                    onDeliveryChange={handleDeliveryChange}
                    triggerClassName="h-8 text-xs w-[min(200px,100%)]"
                  />
                </div>
              </CardContent>
            </Card>
            );
          })}
          {orders.length === 0 && !loading && (
            <p className="text-center text-muted-foreground py-8">No active orders</p>
          )}
        </div>
      )}
    </div>
  );
};

export default Orders;
