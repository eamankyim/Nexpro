import { useState, useEffect } from 'react';

/**
 * Custom hook to detect mobile screen size
 * @param {number} breakpoint - Breakpoint in pixels (default: 768)
 * @returns {boolean} - True if screen width is below breakpoint
 */
export const useMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
};

/**
 * Get responsive width for modals/drawers
 * @param {number} desktopWidth - Width for desktop (default: 800)
 * @param {number} mobileWidth - Width for mobile (default: '100%')
 * @returns {number|string} - Responsive width
 */
export const getResponsiveWidth = (desktopWidth = 800, mobileWidth = '100%') => {
  return window.innerWidth < 768 ? mobileWidth : desktopWidth;
};




