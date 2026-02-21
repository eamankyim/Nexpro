import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../context/AuthContext';

/**
 * Listens for notification events via WebSocket and invalidates
 * notification queries so the NotificationBell updates in real time.
 * Mounted in MainLayout so it runs on all workspace pages.
 */
const NotificationWebSocketListener = () => {
  const queryClient = useQueryClient();
  const { user, activeTenantId } = useAuth();

  const handleNotification = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  useWebSocket({
    channels: [],
    onNotification: handleNotification,
    enabled: !!user && !!activeTenantId,
  });

  return null;
};

export default NotificationWebSocketListener;
