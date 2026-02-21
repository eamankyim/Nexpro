import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useResponsive, useSafeAreaInsets } from '@/hooks/useResponsive';
import { cn } from '@/lib/utils';

const FAB_STORAGE_KEY = 'nexpro-fab-position';
const FAB_SIZE = 56;
const DRAG_THRESHOLD = 5;

/**
 * FloatingActionButton - Floating action button for mobile devices. Default bottom-right, draggable.
 * @param {Function} onClick - Callback when button is clicked
 * @param {React.ReactNode} icon - Custom icon (default: Plus)
 * @param {string} label - Button label/tooltip
 * @param {string} tooltip - Optional tooltip text (when provided, shows on hover)
 * @param {boolean} show - Whether to show the FAB (default: true)
 * @param {string} position - Default position: 'bottom-right' | 'bottom-left' (default: 'bottom-right')
 * @param {Array} expandActions - Optional array of actions to show when expanded
 * @param {boolean} hideOnScroll - Whether to hide FAB when scrolling down (default: true)
 * @param {boolean} showOnAllSizes - If true, show on desktop too (default: false)
 */
const FloatingActionButton = ({
  onClick,
  icon: Icon = Plus,
  label = 'Add',
  tooltip,
  show = true,
  position = 'bottom-right',
  expandActions = [],
  hideOnScroll = true,
  showOnAllSizes = false,
}) => {
  const { isMobile, isTablet } = useResponsive();
  const safeAreaInsets = useSafeAreaInsets();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [dragPosition, setDragPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, cursorX: 0, cursorY: 0 });
  const didDragRef = useRef(false);
  const buttonRef = useRef(null);

  // Hide/show on scroll
  useEffect(() => {
    if (!hideOnScroll || (!isMobile && !isTablet)) return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Hide when scrolling down, show when scrolling up
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY) {
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hideOnScroll, isMobile, isTablet, lastScrollY]);

  const shouldShow = show && (showOnAllSizes || isMobile || isTablet);

  const clampPosition = useCallback((x, y) => {
    const margin = 8;
    return {
      x: Math.max(margin, Math.min(window.innerWidth - FAB_SIZE - margin, x)),
      y: Math.max(margin, Math.min(window.innerHeight - FAB_SIZE - margin, y)),
    };
  }, []);

  const handlePointerDown = useCallback(
    (e) => {
      if (!shouldShow) return;
      didDragRef.current = false;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const rect = buttonRef.current?.getBoundingClientRect();
      const currentX = rect?.left ?? (position === 'bottom-right' ? window.innerWidth - FAB_SIZE - 16 : 16);
      const currentY = rect?.top ?? window.innerHeight - FAB_SIZE - (16 + (safeAreaInsets.bottom || 0));
      dragStartRef.current = {
        x: dragPosition?.x ?? currentX,
        y: dragPosition?.y ?? currentY,
        cursorX: clientX,
        cursorY: clientY,
      };
      setIsDragging(true);
    },
    [shouldShow, position, safeAreaInsets.bottom, dragPosition]
  );

  const handlePointerMove = useCallback((e) => {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const { x, y, cursorX, cursorY } = dragStartRef.current;
    const dx = clientX - cursorX;
    const dy = clientY - cursorY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) didDragRef.current = true;
    const next = clampPosition(x + dx, y + dy);
    dragStartRef.current = { ...dragStartRef.current, x: next.x, y: next.y, cursorX: clientX, cursorY: clientY };
    setDragPosition(next);
  }, [isDragging, clampPosition]);

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragPosition) {
      try {
        localStorage.setItem(FAB_STORAGE_KEY, JSON.stringify({ x: dragPosition.x, y: dragPosition.y }));
      } catch (_) {}
    }
  }, [isDragging, dragPosition]);

  useEffect(() => {
    if (!isDragging) return;
    const move = (e) => handlePointerMove(e);
    const up = () => handlePointerUp();
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  // Close expanded actions when clicking outside
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = () => {
      setIsExpanded(false);
    };

    // Small delay to prevent immediate close
    const timeout = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isExpanded]);

  // Hide when modals/drawers are open
  useEffect(() => {
    const handleModalOpen = () => setIsVisible(false);
    const handleModalClose = () => setIsVisible(true);

    // Listen for modal/drawer open/close events
    window.addEventListener('modal-open', handleModalOpen);
    window.addEventListener('modal-close', handleModalClose);
    window.addEventListener('drawer-open', handleModalOpen);
    window.addEventListener('drawer-close', handleModalClose);

    return () => {
      window.removeEventListener('modal-open', handleModalOpen);
      window.removeEventListener('modal-close', handleModalClose);
      window.removeEventListener('drawer-open', handleModalOpen);
      window.removeEventListener('drawer-close', handleModalClose);
    };
  }, []);

  if (!shouldShow) {
    return null;
  }

  const hasExpandActions = expandActions.length > 0;

  const handleMainClick = () => {
    if (didDragRef.current) return;
    if (hasExpandActions) {
      setIsExpanded(!isExpanded);
    } else {
      onClick?.();
    }
  };

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  const bottomOffset = safeAreaInsets.bottom > 0
    ? `calc(1rem + ${safeAreaInsets.bottom}px)`
    : '1rem';

  const useDragPosition = dragPosition != null;
  const fabStyle = useDragPosition
    ? { left: dragPosition.x, top: dragPosition.y, backgroundColor: 'var(--color-primary)' }
    : {
        [position === 'bottom-right' ? 'right' : 'left']: '1rem',
        bottom: bottomOffset,
        backgroundColor: 'var(--color-primary)',
      };

  return (
    <>
      {/* Expanded Actions */}
      {hasExpandActions && isExpanded && (
        <div
          className={cn(
            'fixed z-50 flex flex-col-reverse gap-3 transition-all duration-300',
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          )}
          style={
            useDragPosition
              ? {
                  left: dragPosition.x,
                  bottom: window.innerHeight - dragPosition.y + 8,
                  marginBottom: 0,
                }
              : {
                  [position === 'bottom-right' ? 'right' : 'left']: '1rem',
                  bottom: bottomOffset,
                  marginBottom: '4.5rem',
                }
          }
        >
          {expandActions.map((action, index) => (
            <div
              key={index}
              className="flex items-center gap-3 animate-in slide-in-from-bottom-2"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <span className="text-sm text-primary-foreground bg-primary px-3 py-1.5 rounded-lg whitespace-nowrap">
                {action.label}
              </span>
              <Button
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick?.();
                  setIsExpanded(false);
                }}
                className="h-12 w-12 rounded-full border border-border min-h-[48px] min-w-[48px]"
                style={{ backgroundColor: action.color || 'var(--color-primary)' }}
              >
                {action.icon && <action.icon className="h-5 w-5 text-white" />}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Main FAB */}
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              ref={buttonRef}
              size="icon"
              onClick={handleMainClick}
              onPointerDown={handlePointerDown}
              className={cn(
                'fixed z-50 h-14 w-14 rounded-full transition-all duration-300 min-h-[56px] min-w-[56px] touch-none',
                !useDragPosition && positionClasses[position],
                isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none',
                isExpanded && hasExpandActions && 'rotate-45'
              )}
              style={fabStyle}
            >
              {isExpanded && hasExpandActions ? (
                <X className="h-6 w-6 text-white" />
              ) : (
                <Icon className="h-6 w-6 text-white" />
              )}
              <span className="sr-only">{label}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        <Button
          ref={buttonRef}
          size="icon"
          onClick={handleMainClick}
          onPointerDown={handlePointerDown}
          className={cn(
            'fixed z-50 h-14 w-14 rounded-full transition-all duration-300 min-h-[56px] min-w-[56px] touch-none',
            !useDragPosition && positionClasses[position],
            isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none',
            isExpanded && hasExpandActions && 'rotate-45'
          )}
          style={fabStyle}
        >
          {isExpanded && hasExpandActions ? (
            <X className="h-6 w-6 text-white" />
          ) : (
            <Icon className="h-6 w-6 text-white" />
          )}
          <span className="sr-only">{label}</span>
        </Button>
      )}
    </>
  );
};

export default FloatingActionButton;
