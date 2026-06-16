import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../context/AuthContext';
import {
  refreshAfterInventoryChange,
  refreshAfterSale,
  refreshNotifications,
} from '../utils/queryInvalidation';

/**
 * Headless workspace listener mounted once in MainLayout.
 * Keeps money, dashboard, inventory, and notification caches fresh when sockets are enabled.
 */
const NotificationWebSocketListener = () => {
  const queryClient = useQueryClient();
  const { user, activeTenantId } = useAuth();

  const handleSaleChange = useCallback(() => {
    void refreshAfterSale(queryClient);
  }, [queryClient]);

  const handleInventoryChange = useCallback(() => {
    void refreshAfterInventoryChange(queryClient);
  }, [queryClient]);

  const handleDashboardUpdate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'active' });
  }, [queryClient]);

  const handleNotification = useCallback(() => {
    void refreshNotifications(queryClient);
  }, [queryClient]);

  useWebSocket({
    channels: ['dashboard', 'sales', 'inventory'],
    onSaleCreated: handleSaleChange,
    onSaleUpdated: handleSaleChange,
    onInventoryAlert: handleInventoryChange,
    onDashboardUpdate: handleDashboardUpdate,
    onNotification: handleNotification,
    enabled: !!user && !!activeTenantId,
  });

  return null;
};

export default NotificationWebSocketListener;
