import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useResponsive, useSafeAreaInsets } from '@/hooks/useResponsive';
import { cn } from '@/lib/utils';

/**
 * FloatingActionButton - Floating action button for mobile devices
 * @param {Function} onClick - Callback when button is clicked
 * @param {React.ReactNode} icon - Custom icon (default: Plus)
 * @param {string} label - Button label/tooltip
 * @param {boolean} show - Whether to show the FAB (default: true)
 * @param {string} position - Position: 'bottom-right' | 'bottom-left' (default: 'bottom-right')
 * @param {Array} expandActions - Optional array of actions to show when expanded
 * @param {boolean} hideOnScroll - Whether to hide FAB when scrolling down (default: true)
 * @param {boolean} showOnAllSizes - If true, show on desktop too (default: false)
 */
const FloatingActionButton = ({
  onClick,
  icon: Icon = Plus,
  label = 'Add',
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

  const shouldShow = show && (showOnAllSizes || isMobile || isTablet);
  if (!shouldShow) {
    return null;
  }

  const hasExpandActions = expandActions.length > 0;

  const handleMainClick = () => {
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

  return (
    <>
      {/* Expanded Actions */}
      {hasExpandActions && isExpanded && (
        <div 
          className={cn(
            "fixed z-50 flex flex-col-reverse gap-3 transition-all duration-300",
            position === 'bottom-right' ? 'right-4' : 'left-4',
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          )}
          style={{ 
            bottom: bottomOffset,
            marginBottom: '4.5rem', // Space for main FAB
          }}
        >
          {expandActions.map((action, index) => (
            <div
              key={index}
              className="flex items-center gap-3 animate-in slide-in-from-bottom-2"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <span className="text-sm text-white bg-gray-900 px-3 py-1.5 rounded-lg whitespace-nowrap">
                {action.label}
              </span>
              <Button
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick?.();
                  setIsExpanded(false);
                }}
                className="h-12 w-12 rounded-full shadow-lg min-h-[48px] min-w-[48px]"
                style={{ backgroundColor: action.color || '#166534' }}
              >
                {action.icon && <action.icon className="h-5 w-5 text-white" />}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Main FAB */}
      <Button
        size="icon"
        onClick={handleMainClick}
        className={cn(
          "fixed z-50 h-14 w-14 rounded-full shadow-lg transition-all duration-300 min-h-[56px] min-w-[56px]",
          positionClasses[position],
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none',
          isExpanded && hasExpandActions && 'rotate-45'
        )}
        style={{
          backgroundColor: '#166534',
          bottom: bottomOffset,
        }}
      >
        {isExpanded && hasExpandActions ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <Icon className="h-6 w-6 text-white" />
        )}
        <span className="sr-only">{label}</span>
      </Button>
    </>
  );
};

export default FloatingActionButton;
