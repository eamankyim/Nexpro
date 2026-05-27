import { useId } from 'react';
import { useResponsive } from '@/hooks/useResponsive';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import UnsavedChangesDialog from './UnsavedChangesDialog';
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
 * @param {boolean} [isDirty] - When set, prompts before closing with unsaved changes
 * @param {Function} [onDiscard] - Optional cleanup when the user discards changes
 * @param {React.ReactNode|Function} children - Dialog content
 * @param {string} title - Dialog title
 * @param {string} description - Dialog description
 * @param {React.ReactNode|Function} footer - Footer content; pass a function to receive `{ requestClose }`
 * @param {string} className - Additional CSS classes
 */
const MobileFormDialog = ({
  open,
  onOpenChange,
  isDirty,
  onDiscard,
  children,
  title,
  description,
  footer,
  className,
}) => {
  const { isMobile } = useResponsive();
  const descriptionId = useId();
  const hasUnsavedGuard = isDirty !== undefined;

  const guard = useUnsavedChangesGuard({
    isDirty: Boolean(isDirty),
    onClose: () => {
      onDiscard?.();
      onOpenChange(false);
    },
  });

  const requestClose = hasUnsavedGuard ? guard.requestClose : () => onOpenChange(false);

  const handleOpenChange = (nextOpen) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (hasUnsavedGuard) {
      guard.requestClose();
      return;
    }
    onOpenChange(false);
  };

  const footerContent =
    typeof footer === 'function' ? footer({ requestClose }) : footer;

  const dialogNode = (
    <>
      {isMobile ? (
        <BottomSheet
          open={open}
          onOpenChange={handleOpenChange}
          title={title}
          description={description}
          className={className}
          footer={footerContent}
        >
          <div className="space-y-4 mobile-scroll">{children}</div>
        </BottomSheet>
      ) : (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent
            aria-describedby={description ? descriptionId : undefined}
            className={cn(
              '!flex flex-col w-full sm:w-[var(--modal-w-lg)] sm:min-w-[min(90vw,20rem)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)] overflow-hidden gap-0 p-0',
              className
            )}
          >
            <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 pr-12 border-b border-gray-200">
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription id={descriptionId}>{description}</DialogDescription>}
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-4">
              {children}
            </div>
            {footerContent && (
              <DialogFooter className="sticky bottom-0 z-20 flex-shrink-0 px-6 pt-4 pb-6 border-t border-border bg-background">
                {footerContent}
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}
      {hasUnsavedGuard ? <UnsavedChangesDialog {...guard.dialogProps} /> : null}
    </>
  );

  return dialogNode;
};

export default MobileFormDialog;
