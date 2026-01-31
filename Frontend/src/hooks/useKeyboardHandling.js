import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for smart keyboard handling on mobile
 * @param {Object} options - Configuration options
 * @param {boolean} options.enabled - Whether keyboard handling is enabled (default: true)
 * @param {number} options.scrollOffset - Offset from top when scrolling to input (default: 100)
 * @param {boolean} options.autoFocusNext - Whether to auto-focus next input (default: true)
 * @returns {Object} - { inputRefs, registerInput, focusNext }
 */
export const useKeyboardHandling = (options = {}) => {
  const {
    enabled = true,
    scrollOffset = 100,
    autoFocusNext = true,
  } = options;

  const inputRefs = useRef([]);
  const activeInputIndex = useRef(-1);

  // Register an input field
  const registerInput = useCallback((index, ref) => {
    if (!enabled) return;
    
    if (ref) {
      inputRefs.current[index] = ref;
    } else {
      delete inputRefs.current[index];
    }
  }, [enabled]);

  // Focus next input
  const focusNext = useCallback((currentIndex) => {
    if (!enabled || !autoFocusNext) return;

    const nextIndex = currentIndex + 1;
    const nextInput = inputRefs.current[nextIndex];

    if (nextInput && nextInput.focus) {
      // Small delay to ensure current input is processed
      setTimeout(() => {
        nextInput.focus();
      }, 100);
    }
  }, [enabled, autoFocusNext]);

  // Handle input focus - scroll into view
  useEffect(() => {
    if (!enabled) return;

    const handleFocus = (e) => {
      const input = e.target;
      if (!input || input.tagName !== 'INPUT' && input.tagName !== 'TEXTAREA') return;

      // Find input index
      const index = inputRefs.current.findIndex(ref => ref === input);
      if (index !== -1) {
        activeInputIndex.current = index;
      }

      // Scroll input into view with offset
      setTimeout(() => {
        const rect = input.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const inputTop = rect.top + scrollTop;

        // Calculate target scroll position
        const targetScroll = inputTop - scrollOffset;

        // Smooth scroll to input
        window.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: 'smooth',
        });
      }, 300); // Delay for iOS keyboard animation
    };

    document.addEventListener('focusin', handleFocus);
    return () => document.removeEventListener('focusin', handleFocus);
  }, [enabled, scrollOffset]);

  // Handle Enter key to move to next input
  useEffect(() => {
    if (!enabled || !autoFocusNext) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && activeInputIndex.current !== -1) {
        const currentInput = inputRefs.current[activeInputIndex.current];
        
        // Don't focus next if it's a submit button or textarea
        if (currentInput?.type === 'submit' || currentInput?.tagName === 'TEXTAREA') {
          return;
        }

        // Prevent default form submission
        if (currentInput?.form && currentInput.type !== 'submit') {
          e.preventDefault();
        }

        focusNext(activeInputIndex.current);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, autoFocusNext, focusNext]);

  // Dismiss keyboard on outside tap (mobile)
  useEffect(() => {
    if (!enabled) return;

    const handleClickOutside = (e) => {
      const target = e.target;
      
      // Don't dismiss if clicking on input/textarea
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') {
        return;
      }

      // Blur active input
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        document.activeElement.blur();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [enabled]);

  return {
    inputRefs: inputRefs.current,
    registerInput,
    focusNext,
  };
};

/**
 * Hook to handle iOS Safari viewport adjustments
 */
export const useIOSKeyboardFix = () => {
  useEffect(() => {
    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (!isIOS) return;

    // Set viewport height CSS variable
    const setViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', setViewportHeight);

    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
    };
  }, []);
};
