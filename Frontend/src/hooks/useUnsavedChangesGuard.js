import { useCallback, useState } from 'react';

/**
 * Guards closing a form/modal when there are unsaved changes.
 * @param {Object} options
 * @param {boolean} options.isDirty - Whether the form has unsaved changes
 * @param {() => void} options.onClose - Called after close is confirmed (discard or clean)
 * @returns {{ requestClose: () => void, handleOpenChange: (open: boolean) => void, dialogProps: { open: boolean, onOpenChange: (open: boolean) => void, onConfirmDiscard: () => void } }}
 */
export function useUnsavedChangesGuard({ isDirty, onClose }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const performClose = useCallback(() => {
    setConfirmOpen(false);
    onClose();
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (isDirty) {
      setConfirmOpen(true);
      return;
    }
    performClose();
  }, [isDirty, performClose]);

  const handleOpenChange = useCallback(
    (nextOpen) => {
      if (nextOpen) return;
      requestClose();
    },
    [requestClose]
  );

  const dialogProps = {
    open: confirmOpen,
    onOpenChange: setConfirmOpen,
    onConfirmDiscard: performClose,
  };

  return { requestClose, handleOpenChange, dialogProps };
}
