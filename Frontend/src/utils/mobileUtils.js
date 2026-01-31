/**
 * Mobile utility functions for responsive design
 */

/**
 * Mobile breakpoints
 */
export const MOBILE_BREAKPOINT = 768;
export const TABLET_BREAKPOINT = 1024;

/**
 * Touch target minimum size (iOS/Android guidelines)
 */
export const MIN_TOUCH_TARGET = 44;

/**
 * Mobile-optimized spacing scale
 */
export const MOBILE_SPACING = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '0.75rem',   // 12px
  lg: '1rem',      // 16px
  xl: '1.25rem',   // 20px
  '2xl': '1.5rem', // 24px
};

/**
 * Desktop spacing scale
 */
export const DESKTOP_SPACING = {
  xs: '0.5rem',    // 8px
  sm: '0.75rem',   // 12px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
};

/**
 * Mobile typography scale
 */
export const MOBILE_TYPOGRAPHY = {
  xs: '0.75rem',    // 12px
  sm: '0.875rem',   // 14px
  base: '1rem',     // 16px
  lg: '1.125rem',   // 18px
  xl: '1.25rem',    // 20px
  '2xl': '1.5rem',  // 24px
};

/**
 * Get responsive spacing value
 * @param {string} mobileValue - Spacing value for mobile
 * @param {string} desktopValue - Spacing value for desktop
 * @param {number} currentWidth - Current window width
 * @returns {string} Responsive spacing value
 */
export const getResponsiveSpacing = (mobileValue, desktopValue, currentWidth = window.innerWidth) => {
  return currentWidth < MOBILE_BREAKPOINT ? mobileValue : desktopValue;
};

/**
 * Get responsive font size
 * @param {string} mobileSize - Font size for mobile
 * @param {string} desktopSize - Font size for desktop
 * @param {number} currentWidth - Current window width
 * @returns {string} Responsive font size
 */
export const getResponsiveFontSize = (mobileSize, desktopSize, currentWidth = window.innerWidth) => {
  return currentWidth < MOBILE_BREAKPOINT ? mobileSize : desktopSize;
};

/**
 * Check if element meets minimum touch target size
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} True if element meets minimum size
 */
export const meetsTouchTargetSize = (element) => {
  if (!element) return false;
  
  const rect = element.getBoundingClientRect();
  const minSize = MIN_TOUCH_TARGET;
  
  return rect.width >= minSize && rect.height >= minSize;
};

/**
 * Ensure element meets minimum touch target size
 * @param {HTMLElement} element - Element to ensure size for
 * @param {number} minSize - Minimum size (default: MIN_TOUCH_TARGET)
 */
export const ensureTouchTargetSize = (element, minSize = MIN_TOUCH_TARGET) => {
  if (!element) return;
  
  const style = window.getComputedStyle(element);
  const width = parseFloat(style.width) || 0;
  const height = parseFloat(style.height) || 0;
  
  if (width < minSize) {
    element.style.minWidth = `${minSize}px`;
  }
  
  if (height < minSize) {
    element.style.minHeight = `${minSize}px`;
  }
};

/**
 * Get safe area insets from CSS environment variables
 * @returns {Object} Safe area insets { top, right, bottom, left }
 */
export const getSafeAreaInsets = () => {
  if (typeof window === 'undefined' || typeof CSS === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  // Check if CSS environment variables are supported
  if (!CSS.supports('padding-top', 'env(safe-area-inset-top)')) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  // Create a test element to get computed safe area insets
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
  
  return { top, right, bottom, left };
};

/**
 * Apply safe area insets to element
 * @param {HTMLElement} element - Element to apply insets to
 * @param {Object} insets - Safe area insets { top, right, bottom, left }
 * @param {Object} options - Options { applyTop, applyRight, applyBottom, applyLeft }
 */
export const applySafeAreaInsets = (element, insets, options = {}) => {
  if (!element || !insets) return;
  
  const {
    applyTop = true,
    applyRight = true,
    applyBottom = true,
    applyLeft = true,
  } = options;
  
  if (applyTop && insets.top > 0) {
    element.style.paddingTop = `calc(${element.style.paddingTop || '0px'} + ${insets.top}px)`;
  }
  
  if (applyRight && insets.right > 0) {
    element.style.paddingRight = `calc(${element.style.paddingRight || '0px'} + ${insets.right}px)`;
  }
  
  if (applyBottom && insets.bottom > 0) {
    element.style.paddingBottom = `calc(${element.style.paddingBottom || '0px'} + ${insets.bottom}px)`;
  }
  
  if (applyLeft && insets.left > 0) {
    element.style.paddingLeft = `calc(${element.style.paddingLeft || '0px'} + ${insets.left}px)`;
  }
};

/**
 * Get mobile-optimized padding
 * @param {string} size - Size key (xs, sm, md, lg, xl, 2xl)
 * @param {boolean} isMobile - Whether current view is mobile
 * @returns {string} Padding value
 */
export const getMobilePadding = (size = 'md', isMobile = window.innerWidth < MOBILE_BREAKPOINT) => {
  if (isMobile) {
    return MOBILE_SPACING[size] || MOBILE_SPACING.md;
  }
  return DESKTOP_SPACING[size] || DESKTOP_SPACING.md;
};

/**
 * Get mobile-optimized margin
 * @param {string} size - Size key (xs, sm, md, lg, xl, 2xl)
 * @param {boolean} isMobile - Whether current view is mobile
 * @returns {string} Margin value
 */
export const getMobileMargin = (size = 'md', isMobile = window.innerWidth < MOBILE_BREAKPOINT) => {
  return getMobilePadding(size, isMobile);
};

/**
 * Check if device is mobile
 * @param {number} breakpoint - Breakpoint to use (default: MOBILE_BREAKPOINT)
 * @returns {boolean} True if device is mobile
 */
export const isMobileDevice = (breakpoint = MOBILE_BREAKPOINT) => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < breakpoint;
};

/**
 * Check if device is tablet
 * @param {number} mobileBreakpoint - Mobile breakpoint (default: MOBILE_BREAKPOINT)
 * @param {number} tabletBreakpoint - Tablet breakpoint (default: TABLET_BREAKPOINT)
 * @returns {boolean} True if device is tablet
 */
export const isTabletDevice = (
  mobileBreakpoint = MOBILE_BREAKPOINT,
  tabletBreakpoint = TABLET_BREAKPOINT
) => {
  if (typeof window === 'undefined') return false;
  const width = window.innerWidth;
  return width >= mobileBreakpoint && width < tabletBreakpoint;
};

/**
 * Get viewport height accounting for mobile browser UI
 * @returns {number} Viewport height
 */
export const getViewportHeight = () => {
  if (typeof window === 'undefined') return 0;
  
  // Use visual viewport if available (mobile browsers)
  if (window.visualViewport) {
    return window.visualViewport.height;
  }
  
  // Fallback to window inner height
  return window.innerHeight;
};

/**
 * Get viewport width accounting for mobile browser UI
 * @returns {number} Viewport width
 */
export const getViewportWidth = () => {
  if (typeof window === 'undefined') return 0;
  
  // Use visual viewport if available (mobile browsers)
  if (window.visualViewport) {
    return window.visualViewport.width;
  }
  
  // Fallback to window inner width
  return window.innerWidth;
};
