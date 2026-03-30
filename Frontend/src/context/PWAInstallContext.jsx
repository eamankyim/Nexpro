import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const PWAInstallContext = createContext(null);

const ua = () => (typeof navigator !== 'undefined' ? navigator.userAgent : '');

/**
 * Detects if the device is running iOS
 */
const isIOS = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(ua()) && !window.MSStream;
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

/** Opera Mini (does not support PWA install) */
const isOperaMini = () => /Opera Mini|OPR\/.*Mini/i.test(ua());

/** Safari desktop (Mac) – no beforeinstallprompt */
const isSafariDesktop = () => !isIOS() && /Safari/i.test(ua()) && !/Chrome|Chromium|Firefox|Edg/i.test(ua());

/** Firefox */
const isFirefox = () => /Firefox|FxiOS/i.test(ua());

/** Edge (may or may not fire beforeinstallprompt) */
const isEdge = () => /Edg\//i.test(ua());

/**
 * PWA Install Provider
 * Captures beforeinstallprompt event and manages install state
 */
export const PWAInstallProvider = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [installVariant, setInstallVariant] = useState(null);

  useEffect(() => {
    const ios = isIOS();
    setIsIOSDevice(ios);
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

  // Derive install variant for banner messaging (Safari desktop, Firefox, Edge, Opera Mini)
  useEffect(() => {
    if (isInstalled) {
      setInstallVariant(null);
      return;
    }
    if (isOperaMini()) {
      setInstallVariant('opera-mini');
      return;
    }
    if (isIOSDevice) {
      setInstallVariant('ios');
      return;
    }
    if (isSafariDesktop()) {
      setInstallVariant('safari-desktop');
      return;
    }
    if (isFirefox()) {
      setInstallVariant('firefox');
      return;
    }
    if (isEdge() && !deferredPrompt) {
      setInstallVariant('edge-manual');
      return;
    }
    setInstallVariant(deferredPrompt ? 'native' : null);
  }, [isInstalled, isIOSDevice, deferredPrompt]);

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
   * True when native install is available (Chrome/Android prompt or iOS Add to Home Screen).
   */
  const canInstall = !isInstalled && (!!deferredPrompt || isIOSDevice);

  /**
   * True when we should show the install banner/area (includes Opera Mini, Safari desktop, Firefox, Edge with message only).
   */
  const showInstallBanner = !isInstalled && (!!deferredPrompt || isIOSDevice || installVariant === 'opera-mini' || installVariant === 'safari-desktop' || installVariant === 'firefox' || installVariant === 'edge-manual');

  const value = {
    canInstall,
    showInstallBanner,
    installVariant,
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
