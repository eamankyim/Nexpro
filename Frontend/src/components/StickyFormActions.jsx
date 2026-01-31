import { useResponsive, useSafeAreaInsets } from '@/hooks/useResponsive';
import { cn } from '@/lib/utils';

/**
 * StickyFormActions - Sticky form action buttons for mobile
 * @param {React.ReactNode} children - Action buttons
 * @param {string} className - Additional CSS classes
 */
const StickyFormActions = ({ children, className }) => {
  const { isMobile } = useResponsive();
  const safeAreaInsets = useSafeAreaInsets();

  if (!isMobile) {
    // On desktop, just render normally (not sticky)
    return <div className={cn('flex gap-2', className)}>{children}</div>;
  }

  return (
    <div
      className={cn(
        'sticky bottom-0 left-0 right-0 z-10',
        'bg-background border-t border-gray-200',
        'px-4 py-3',
        'flex flex-col-reverse gap-2',
        className
      )}
      style={{
        paddingBottom: safeAreaInsets.bottom > 0 
          ? `calc(0.75rem + ${safeAreaInsets.bottom}px)` 
          : undefined,
      }}
    >
      {children}
    </div>
  );
};

export default StickyFormActions;
