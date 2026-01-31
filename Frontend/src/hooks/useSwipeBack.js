import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResponsive } from './useResponsive';

/**
 * Hook to enable swipe-back gesture navigation (like iOS)
 * @param {Object} options - Configuration options
 * @param {boolean} options.enabled - Whether swipe-back is enabled (default: true on mobile)
 * @param {number} options.threshold - Minimum swipe distance to trigger (default: 100)
 * @param {number} options.edgeThreshold - Distance from left edge to detect swipe (default: 20)
 * @param {Function} options.onSwipeBack - Optional callback before navigation
 * @returns {void}
 */
export const useSwipeBack = (options = {}) => {
  const {
    enabled: enabledOption = true,
    threshold = 100,
    edgeThreshold = 20,
    onSwipeBack,
  } = options;

  const { isMobile } = useResponsive();
  const navigate = useNavigate();
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const isSwiping = useRef(false);
  const swipeDistance = useRef(0);

  const enabled = enabledOption && isMobile;

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e) => {
      const touch = e.touches[0];
      const x = touch.clientX;
      const y = touch.clientY;

      // Only start swipe if at left edge
      if (x <= edgeThreshold) {
        startX.current = x;
        startY.current = y;
        currentX.current = x;
        isSwiping.current = true;
        swipeDistance.current = 0;
      }
    };

    const handleTouchMove = (e) => {
      if (!isSwiping.current) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - startX.current;
      const deltaY = Math.abs(touch.clientY - startY.current);

      // Cancel if vertical swipe is greater than horizontal (scrolling)
      if (deltaY > Math.abs(deltaX) * 2) {
        isSwiping.current = false;
        return;
      }

      // Only allow rightward swipe
      if (deltaX > 0) {
        e.preventDefault();
        currentX.current = touch.clientX;
        swipeDistance.current = deltaX;
      } else {
        isSwiping.current = false;
      }
    };

    const handleTouchEnd = () => {
      if (!isSwiping.current) return;

      isSwiping.current = false;

      // Navigate back if threshold met
      if (swipeDistance.current >= threshold) {
        onSwipeBack?.();
        navigate(-1);
      }

      swipeDistance.current = 0;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, threshold, edgeThreshold, navigate, onSwipeBack]);
};
