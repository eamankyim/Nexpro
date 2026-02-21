import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Radio, 
  ShoppingCart, 
  AlertTriangle,
  Bell,
  RefreshCw,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import { showSuccess, showWarning } from '../utils/toast';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const MAX_FEED_ITEMS = 10;

/**
 * RealTimeSalesFeed Component
 * Displays live sales and alerts in real-time using WebSocket
 */
const RealTimeSalesFeed = ({ shopId = null }) => {
  const queryClient = useQueryClient();
  const [feedItems, setFeedItems] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Format currency
  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  }, []);

  // Add item to feed
  const addFeedItem = useCallback((item) => {
    setFeedItems(prev => {
      const newItems = [item, ...prev].slice(0, MAX_FEED_ITEMS);
      return newItems;
    });
  }, []);

  // Handle new sale
  const handleSaleCreated = useCallback((data) => {
    const sale = data.sale;
    addFeedItem({
      id: `sale-${sale.id}-${Date.now()}`,
      type: 'sale',
      title: `New Sale: ${sale.saleNumber}`,
      description: `${sale.customerName} - ${formatCurrency(sale.total)}`,
      amount: sale.total,
      timestamp: data.timestamp,
      icon: ShoppingCart,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    });

    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['sales'] });
    queryClient.invalidateQueries({ queryKey: ['footTraffic', 'today'] });

    // Show notification
    showSuccess(`New sale: ${formatCurrency(sale.total)}`);
  }, [addFeedItem, formatCurrency, queryClient]);

  // Handle inventory alert
  const handleInventoryAlert = useCallback((data) => {
    const { product, alertType } = data;
    const isOutOfStock = alertType === 'out_of_stock';
    
    addFeedItem({
      id: `inventory-${product.id}-${Date.now()}`,
      type: 'inventory',
      title: isOutOfStock ? 'Out of Stock' : 'Low Stock Alert',
      description: `${product.name} (${product.sku})`,
      quantity: product.quantity,
      timestamp: data.timestamp,
      icon: AlertTriangle,
      color: isOutOfStock ? 'text-red-600' : 'text-orange-600',
      bgColor: isOutOfStock ? 'bg-red-50' : 'bg-orange-50'
    });

    // Invalidate inventory queries
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });

    // Show warning
    showWarning(
      isOutOfStock 
        ? `${product.name} is out of stock!` 
        : `${product.name} is running low`
    );
  }, [addFeedItem, queryClient]);

  // Handle dashboard update
  const handleDashboardUpdate = useCallback(() => {
    // Invalidate dashboard queries
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }, [queryClient]);

  // Handle notification
  const handleNotification = useCallback((data) => {
    addFeedItem({
      id: `notification-${Date.now()}`,
      type: 'notification',
      title: data.title || 'Notification',
      description: data.message || data.body,
      timestamp: data.timestamp,
      icon: Bell,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    });
    // Invalidate so NotificationBell and Dashboard notice board show the new notification
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [addFeedItem, queryClient]);

  // Initialize WebSocket
  const { isConnected, reconnect } = useWebSocket({
    channels: ['dashboard', 'sales', 'inventory'],
    onSaleCreated: handleSaleCreated,
    onInventoryAlert: handleInventoryAlert,
    onDashboardUpdate: handleDashboardUpdate,
    onNotification: handleNotification,
    enabled: true
  });

  // Set initialized after mount
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // Render feed item
  const renderFeedItem = (item) => {
    const Icon = item.icon;
    const timeAgo = dayjs(item.timestamp).fromNow();

    return (
      <div 
        key={item.id}
        className={`flex items-start gap-3 p-3 rounded-lg ${item.bgColor} animate-in slide-in-from-top-2 duration-300`}
      >
        <div className={`p-2 rounded-full ${item.bgColor}`}>
          <Icon className={`h-4 w-4 ${item.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
          <p className="text-xs text-gray-500 truncate">{item.description}</p>
          <p className="text-xs text-gray-400 mt-1">{timeAgo}</p>
        </div>
        {item.amount && (
          <span className="text-sm font-semibold text-green-600">
            {formatCurrency(item.amount)}
          </span>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Radio className="h-4 w-4 text-red-500 animate-pulse" />
          Live Feed
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className={isConnected ? 'text-green-600 border-green-200' : 'text-red-600 border-red-200'}
          >
            {isConnected ? (
              <><Wifi className="h-3 w-3 mr-1" /> Connected</>
            ) : (
              <><WifiOff className="h-3 w-3 mr-1" /> Offline</>
            )}
          </Badge>
          {!isConnected && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={reconnect}
              className="h-7 px-2"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!isInitialized ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : feedItems.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Radio className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Waiting for activity...</p>
            <p className="text-xs text-gray-400 mt-1">
              New sales and alerts will appear here in real-time
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {feedItems.map(renderFeedItem)}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RealTimeSalesFeed;
