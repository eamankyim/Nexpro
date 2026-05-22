/**
 * Tracks browser online/offline connectivity.
 */
import { useState, useEffect } from 'react';
import { isNavigatorOnline } from '../utils/onlineRequired';

/**
 * @returns {{ isOnline: boolean }}
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(isNavigatorOnline);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}

export default useOnlineStatus;
