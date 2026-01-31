import { useState, useEffect, useMemo } from 'react';

/**
 * Breakpoint constants for responsive design
 */
export const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  DESKTOP: 1280,
};

/**
 * Device type detection
 */
export const DEVICE_TYPES = {
  MOBILE: 'mobile',
  TABLET: 'tablet',
  DESKTOP: 'desktop',
};

/**
 * Enhanced responsive hook with breakpoint detection
 * @param {Object} options - Configuration options
 * @param {number} options.mobileBreakpoint - Mobile breakpoint (default: 768)
 * @param {number} options.tabletBreakpoint - Tablet breakpoint (default: 1024)
 * @returns {Object} Responsive state object
 */
export const useResponsive = ({ 
  mobileBreakpoint = BREAKPOINTS.MOBILE,
  tabletBreakpoint = BREAKPOINTS.TABLET 
} = {}) => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    // Call once to set initial size
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const responsive = useMemo(() => {
    const { width } = windowSize;
    
    return {
      isMobile: width < mobileBreakpoint,
      isTablet: width >= mobileBreakpoint && width < tabletBreakpoint,
      isDesktop: width >= tabletBreakpoint,
      deviceType: width < mobileBreakpoint 
        ? DEVICE_TYPES.MOBILE 
        : width < tabletBreakpoint 
        ? DEVICE_TYPES.TABLET 
        : DEVICE_TYPES.DESKTOP,
      width,
      height: windowSize.height,
    };
  }, [windowSize, mobileBreakpoint, tabletBreakpoint]);

  return responsive;
};

/**
 * Hook to detect touch devices
 * @returns {boolean} True if device supports touch
 */
export const useTouchDevice = () => {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    // Check for touch support
    const hasTouch = 
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0);

    setIsTouchDevice(hasTouch);
  }, []);

  return isTouchDevice;
};

/**
 * Hook for safe area insets (iOS notch support)
 * @returns {Object} Safe area insets
 */
export const useSafeAreaInsets = () => {
  const [insets, setInsets] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    // Check if CSS environment variables are supported
    const updateInsets = () => {
      if (typeof CSS !== 'undefined' && CSS.supports('padding-top', 'env(safe-area-inset-top)')) {
        // Get computed safe area insets from CSS
        const testEl = document.createElement('div');
        testEl.style.position = 'fixed';
        testEl.style.visibility = 'hidden';
        testEl.style.paddingTop = 'env(safe-area-inset-top)';
        testEl.style.paddingRight = 'env(safe-area-inset-right)';
        testEl.style.paddingBottom = 'env(safe-area-inset-bottom)';
        testEl.style.paddingLeft = 'env(safe-area-inset-left)';
        document.body.appendChild(testEl);
        
        const computed = window.getComputedStyle(testEl);
        const top = parseInt(computed.paddingTop) || 0;
        const right = parseInt(computed.paddingRight) || 0;
        const bottom = parseInt(computed.paddingBottom) || 0;
        const left = parseInt(computed.paddingLeft) || 0;
        
        document.body.removeChild(testEl);
        
        setInsets({ top, right, bottom, left });
      }
    };

    updateInsets();
    window.addEventListener('resize', updateInsets);
    window.addEventListener('orientationchange', updateInsets);

    return () => {
      window.removeEventListener('resize', updateInsets);
      window.removeEventListener('orientationchange', updateInsets);
    };
  }, []);

  return insets;
};

/**
 * Get responsive value based on breakpoint
 * @param {Object} values - Values for different breakpoints
 * @param {*} values.mobile - Value for mobile
 * @param {*} values.tablet - Value for tablet (optional)
 * @param {*} values.desktop - Value for desktop
 * @param {number} currentWidth - Current window width
 * @returns {*} Responsive value
 */
export const getResponsiveValue = (values, currentWidth = window.innerWidth) => {
  if (currentWidth < BREAKPOINTS.MOBILE) {
    return values.mobile;
  } else if (currentWidth < BREAKPOINTS.TABLET) {
    return values.tablet !== undefined ? values.tablet : values.desktop;
  }
  return values.desktop;
};

/**
 * Get responsive width for modals/drawers
 * @param {number} desktopWidth - Width for desktop (default: 800)
 * @param {number} mobileWidth - Width for mobile (default: '100%')
 * @param {number} tabletWidth - Width for tablet (optional)
 * @returns {number|string} - Responsive width
 */
export const getResponsiveWidth = (
  desktopWidth = 800, 
  mobileWidth = '100%',
  tabletWidth = undefined
) => {
  const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
  
  if (width < BREAKPOINTS.MOBILE) {
    return mobileWidth;
  } else if (width < BREAKPOINTS.TABLET && tabletWidth !== undefined) {
    return tabletWidth;
  }
  return desktopWidth;
};

/**
 * Legacy hook - kept for backward compatibility
 * @param {number} breakpoint - Breakpoint in pixels (default: 768)
 * @returns {boolean} - True if screen width is below breakpoint
 */
export const useMobile = (breakpoint = BREAKPOINTS.MOBILE) => {
  const { isMobile } = useResponsive({ mobileBreakpoint: breakpoint });
  return isMobile;
};
