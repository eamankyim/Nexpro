import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Edit, Trash2, Archive, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * SwipeableCard - Wrapper component that enables swipe gestures on cards
 * @param {React.ReactNode} children - Card content to wrap
 * @param {Array} leftActions - Actions to show when swiping left (e.g., [{ icon: Edit, label: 'Edit', onClick, color }])
 * @param {Array} rightActions - Actions to show when swiping right (e.g., [{ icon: Archive, label: 'Archive', onClick, color }])
 * @param {Function} onSwipe - Optional callback when swipe occurs
 * @param {number} swipeThreshold - Minimum distance to trigger swipe (default: 80)
 * @param {boolean} enabled - Whether swipe is enabled (default: true)
 */
const SwipeableCard = ({
  children,
  leftActions = [],
  rightActions = [],
  onSwipe,
  swipeThreshold = 80,
  enabled = true,
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const cardRef = useRef(null);
  const containerRef = useRef(null);
  const isOpenRef = useRef(false);

  // Close other swiped cards when this one opens
  useEffect(() => {
    if (enabled && swipeOffset !== 0) {
      isOpenRef.current = true;
      // Dispatch event to close other cards
      window.dispatchEvent(new CustomEvent('swipeable-card-opened', { 
        detail: { cardId: cardRef.current?.id || Math.random() } 
      }));
    } else {
      isOpenRef.current = false;
    }
  }, [swipeOffset, enabled]);

  // Listen for other cards opening to close this one
  useEffect(() => {
    if (!enabled) return;

    const handleOtherCardOpened = () => {
      if (isOpenRef.current) return; // Don't close if this is the opened card
      setSwipeOffset(0);
    };

    window.addEventListener('swipeable-card-opened', handleOtherCardOpened);
    return () => {
      window.removeEventListener('swipeable-card-opened', handleOtherCardOpened);
    };
  }, [enabled]);

  const handleTouchStart = useCallback((e) => {
    if (!enabled) return;
    const touch = e.touches[0];
    setStartX(touch.clientX);
    setCurrentX(touch.clientX);
    setIsSwiping(true);
  }, [enabled]);

  const handleTouchMove = useCallback((e) => {
    if (!enabled || !isSwiping) return;
    e.preventDefault();
    const touch = e.touches[0];
    const deltaX = touch.clientX - startX;
    setCurrentX(touch.clientX);

    // Determine max swipe distance based on available actions
    const maxSwipeLeft = leftActions.length > 0 ? leftActions.length * 60 : 0;
    const maxSwipeRight = rightActions.length > 0 ? rightActions.length * 60 : 0;

    // Constrain swipe distance
    if (deltaX > 0 && maxSwipeRight > 0) {
      setSwipeOffset(Math.min(deltaX, maxSwipeRight));
    } else if (deltaX < 0 && maxSwipeLeft > 0) {
      setSwipeOffset(Math.max(deltaX, -maxSwipeLeft));
    }
  }, [enabled, isSwiping, startX, leftActions.length, rightActions.length]);

  const handleTouchEnd = useCallback(() => {
    if (!enabled || !isSwiping) return;
    setIsSwiping(false);

    const deltaX = currentX - startX;
    const absDeltaX = Math.abs(deltaX);

    // Determine which actions are available
    const hasLeftActions = leftActions.length > 0;
    const hasRightActions = rightActions.length > 0;

    if (absDeltaX >= swipeThreshold) {
      // Swipe threshold met - snap to action position
      if (deltaX > 0 && hasRightActions) {
        // Swiped right - show right actions
        const actionWidth = 60;
        setSwipeOffset(Math.min(rightActions.length * actionWidth, absDeltaX));
        onSwipe?.('right', absDeltaX);
      } else if (deltaX < 0 && hasLeftActions) {
        // Swiped left - show left actions
        const actionWidth = 60;
        setSwipeOffset(-Math.min(leftActions.length * actionWidth, absDeltaX));
        onSwipe?.('left', absDeltaX);
      }
    } else {
      // Swipe threshold not met - snap back
      setSwipeOffset(0);
    }
  }, [enabled, isSwiping, currentX, startX, swipeThreshold, leftActions.length, rightActions.length, onSwipe]);

  const handleActionClick = useCallback((action, e) => {
    e.stopPropagation();
    action.onClick?.();
    // Close after action
    setSwipeOffset(0);
  }, []);

  const handleCardClick = useCallback((e) => {
    // Close swipe if clicking on card while swiped open
    if (swipeOffset !== 0) {
      e.preventDefault();
      setSwipeOffset(0);
    }
  }, [swipeOffset]);

  if (!enabled) {
    return <div>{children}</div>;
  }

  const hasLeftActions = leftActions.length > 0;
  const hasRightActions = rightActions.length > 0;

  return (
    <div className="relative overflow-hidden" ref={containerRef}>
      {/* Left Actions */}
      {hasLeftActions && (
        <div className="absolute left-0 top-0 bottom-0 flex items-center bg-muted z-10">
          {leftActions.map((action, index) => (
            <Button
              key={index}
              variant="ghost"
              size="icon"
              onClick={(e) => handleActionClick(action, e)}
              className={cn(
                "h-full min-w-[60px] rounded-none",
                action.color || "text-foreground hover:bg-muted"
              )}
              style={{ backgroundColor: action.bgColor || 'transparent' }}
            >
              {action.icon && <action.icon className="h-5 w-5" />}
              {action.label && (
                <span className="text-xs ml-1">{action.label}</span>
              )}
            </Button>
          ))}
        </div>
      )}

      {/* Right Actions */}
      {hasRightActions && (
        <div className="absolute right-0 top-0 bottom-0 flex items-center bg-muted z-10">
          {rightActions.map((action, index) => (
            <Button
              key={index}
              variant="ghost"
              size="icon"
              onClick={(e) => handleActionClick(action, e)}
              className={cn(
                "h-full min-w-[60px] rounded-none",
                action.color || "text-foreground hover:bg-muted"
              )}
              style={{ backgroundColor: action.bgColor || 'transparent' }}
            >
              {action.icon && <action.icon className="h-5 w-5" />}
              {action.label && (
                <span className="text-xs ml-1">{action.label}</span>
              )}
            </Button>
          ))}
        </div>
      )}

      {/* Card Content */}
      <div
        ref={cardRef}
        className={cn(
          "relative transition-transform duration-200 ease-out bg-card",
          isSwiping && "transition-none"
        )}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          touchAction: 'pan-y',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleCardClick}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeableCard;
