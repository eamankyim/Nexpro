import { useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useResponsive, useSafeAreaInsets, BREAKPOINTS } from '@/hooks/useResponsive';
import { cn } from '@/lib/utils';

/**
 * ResponsiveSheet
 * - Desktop/Tablet: right-side sheet with margins and scrollable body
 * - Mobile: full-height bottom-style sheet using safe area insets
 */
const ResponsiveSheet = ({
  open,
  onOpenChange,
  side = 'right',
  title,
  header,
  children,
  className,
  contentClassName,
}) => {
  const { isMobile: isBelowTablet } = useResponsive({ mobileBreakpoint: BREAKPOINTS.TABLET });
  const insets = useSafeAreaInsets();

  const computedSide = useMemo(() => (isBelowTablet ? 'bottom' : side), [isBelowTablet, side]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={computedSide}
        className={cn(
          'flex flex-col overflow-hidden',
          !isBelowTablet &&
            'w-full sm:w-[400px] md:w-[540px] !top-2 !bottom-2 !right-2 rounded-lg',
          isBelowTablet && 'h-[95dvh] max-h-[95dvh] rounded-t-2xl',
          className,
        )}
        style={{
          paddingTop: insets.top ? `calc(1rem + ${insets.top}px)` : undefined,
          paddingBottom: insets.bottom ? `calc(1rem + ${insets.bottom}px)` : undefined,
        }}
      >
        {(title || header) && (
          <SheetHeader className="flex-shrink-0 pb-3 border-b border-border">
            {header || <SheetTitle>{title}</SheetTitle>}
          </SheetHeader>
        )}
        <div className={cn('flex-1 min-h-0 overflow-y-auto', contentClassName)}>{children}</div>
      </SheetContent>
    </Sheet>
  );
};

export default ResponsiveSheet;

