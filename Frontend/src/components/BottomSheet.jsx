import { useEffect, useRef } from 'react';
import { useSafeAreaInsets } from '@/hooks/useResponsive';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

/**
 * BottomSheet - Mobile-optimized bottom sheet component
 * @param {boolean} open - Whether the sheet is open
 * @param {Function} onOpenChange - Callback when open state changes
 * @param {React.ReactNode} children - Sheet content
 * @param {string} title - Sheet title
 * @param {string} description - Sheet description
 * @param {string} className - Additional CSS classes
 * @param {React.ReactNode} footer - Footer content (sticky at bottom)
 */
const BottomSheet = ({
  open,
  onOpenChange,
  children,
  title,
  description,
  className,
  footer,
}) => {
  const safeAreaInsets = useSafeAreaInsets();
  const sheetRef = useRef(null);

  // Dispatch events for FAB visibility
  useEffect(() => {
    if (open) {
      window.dispatchEvent(new CustomEvent('drawer-open'));
    } else {
      window.dispatchEvent(new CustomEvent('drawer-close'));
    }
  }, [open]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        ref={sheetRef}
        side="bottom"
        className={cn(
          "flex flex-col h-[95vh] max-h-[95vh] rounded-t-2xl p-0 overflow-hidden",
          className
        )}
        style={{
          paddingTop: safeAreaInsets.top > 0 ? `${safeAreaInsets.top}px` : undefined,
          paddingBottom: safeAreaInsets.bottom > 0 ? `${safeAreaInsets.bottom}px` : undefined,
          paddingLeft: safeAreaInsets.left > 0 ? `${safeAreaInsets.left}px` : undefined,
          paddingRight: safeAreaInsets.right > 0 ? `${safeAreaInsets.right}px` : undefined,
        }}
      >
        {/* Handle bar */}
        <div className="flex flex-shrink-0 justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-muted rounded-full" />
        </div>

        {/* Header */}
        {(title || description) && (
          <SheetHeader className="flex-shrink-0 px-4 pb-4 border-b border-border">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                {title && <SheetTitle>{title}</SheetTitle>}
                {description && (
                  <SheetDescription className="mt-1">{description}</SheetDescription>
                )}
              </div>
            </div>
          </SheetHeader>
        )}

        {/* Content Area - Flex container */}
        <div className="flex flex-col flex-1 min-h-0">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {children}
          </div>
          
          {/* Fixed Footer - content scrolls behind */}
          {footer && (
            <div 
              className="flex-shrink-0 left-0 right-0 bg-background border-t border-border px-4 py-3 z-10"
              style={{
                paddingBottom: safeAreaInsets.bottom > 0 
                  ? `calc(0.75rem + ${safeAreaInsets.bottom}px)` 
                  : undefined,
              }}
            >
              <div className="flex flex-row gap-2 w-full [&>*]:flex-1">
                {footer}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default BottomSheet;
