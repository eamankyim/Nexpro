import { useResponsive, useSafeAreaInsets } from '@/hooks/useResponsive';
import { cn } from '@/lib/utils';

/**
 * StickyFormActions - Fixed form action buttons at bottom; content scrolls behind
 * Works on both mobile and web - footer stays fixed, content scrolls behind it
 * @param {React.ReactNode} children - Action buttons
 * @param {string} className - Additional CSS classes
 */
const StickyFormActions = ({ children, className }) => {
  const { isMobile } = useResponsive();
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <div
      className={cn(
        'sticky bottom-0 left-0 right-0 z-10',
        'bg-background border-t border-border',
        'px-4 py-3',
        isMobile ? 'flex flex-col-reverse gap-2' : 'flex flex-row justify-end gap-2',
        className
      )}
      style={{
        paddingBottom: isMobile && safeAreaInsets.bottom > 0 
          ? `calc(0.75rem + ${safeAreaInsets.bottom}px)` 
          : undefined,
      }}
    >
      {children}
    </div>
  );
};

export default StickyFormActions;
