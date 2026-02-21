import { useResponsive } from '@/hooks/useResponsive';
import BottomSheet from './BottomSheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * MobileFormDialog - Responsive form dialog that uses BottomSheet on mobile, Dialog on desktop
 * @param {boolean} open - Whether the dialog is open
 * @param {Function} onOpenChange - Callback when open state changes
 * @param {React.ReactNode} children - Dialog content
 * @param {string} title - Dialog title
 * @param {string} description - Dialog description
 * @param {React.ReactNode} footer - Footer content (action buttons)
 * @param {string} className - Additional CSS classes
 */
const MobileFormDialog = ({
  open,
  onOpenChange,
  children,
  title,
  description,
  footer,
  className,
}) => {
  const { isMobile } = useResponsive();

  if (isMobile) {
    return (
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description={description}
        className={className}
        footer={footer}
      >
        <div className="space-y-4 mobile-scroll">
          {children}
        </div>
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          '!flex flex-col w-full sm:w-[var(--modal-w-lg)] sm:min-w-[min(90vw,20rem)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)] overflow-hidden gap-0 p-0',
          className
        )}
      >
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 pr-12 border-b border-gray-200">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-4">
          {children}
        </div>
        {footer && (
          <DialogFooter className="flex-shrink-0 px-6 pt-4 pb-6 border-t border-border bg-background">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MobileFormDialog;
