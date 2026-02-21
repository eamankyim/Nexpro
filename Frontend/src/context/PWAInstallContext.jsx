import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const PWAInstallContext = createContext(null);

/**
 * Detects if the device is running iOS
 */
const isIOS = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
};

/**
 * Detects if the app is running in standalone mode (already installed)
 */
const isStandalone = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
};

/**
 * PWA Install Provider
 * Captures beforeinstallprompt event and manages install state
 */
export const PWAInstallProvider = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    setIsIOSDevice(isIOS());
    setIsInstalled(isStandalone());

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      localStorage.setItem('pwa-installed', 'true');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if previously marked as installed
    if (localStorage.getItem('pwa-installed') === 'true') {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  /**
   * Triggers the native install prompt (Chrome/Android)
   * or shows iOS instructions
   */
  const promptInstall = useCallback(async () => {
    if (isIOSDevice) {
      setShowIOSInstructions(true);
      return { outcome: 'ios-instructions' };
    }

    if (!deferredPrompt) {
      return { outcome: 'unavailable' };
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        localStorage.setItem('pwa-installed', 'true');
      }
      
      setDeferredPrompt(null);
      return { outcome };
    } catch (error) {
      console.error('[PWA] Install prompt error:', error);
      return { outcome: 'error', error };
    }
  }, [deferredPrompt, isIOSDevice]);

  /**
   * Closes the iOS instructions modal
   */
  const closeIOSInstructions = useCallback(() => {
    setShowIOSInstructions(false);
  }, []);

  /**
   * Determines if the install option should be shown
   * - Not already installed
   * - Either has deferred prompt (Chrome/Android) or is iOS
   */
  const canInstall = !isInstalled && (!!deferredPrompt || isIOSDevice);

  const value = {
    canInstall,
    isInstalled,
    isIOSDevice,
    showIOSInstructions,
    promptInstall,
    closeIOSInstructions,
  };

  return (
    <PWAInstallContext.Provider value={value}>
      {children}
    </PWAInstallContext.Provider>
  );
};

/**
 * Hook to access PWA install context
 */
export const usePWAInstall = () => {
  const context = useContext(PWAInstallContext);
  if (!context) {
    throw new Error('usePWAInstall must be used within a PWAInstallProvider');
  }
  return context;
};

export default PWAInstallContext;
