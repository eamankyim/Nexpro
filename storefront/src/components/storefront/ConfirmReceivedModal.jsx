import { useCallback, useEffect } from 'react';
import { Loader2, PackageCheck, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

const ConfirmReceivedModal = ({
  isOpen,
  isSubmitting = false,
  onClose,
  onReportIssue,
  onSubmit,
  orderNumber = '',
}) => {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSubmitting, onClose]);

  const handleSubmit = useCallback((event) => {
    event.preventDefault();
    if (isSubmitting) return;

    onSubmit({
      confirmations: {
        receivedOrder: true,
        itemsMatchOrder: true,
      },
    });
  }, [isSubmitting, onSubmit]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 px-3 py-4 sm:items-center sm:px-6" role="dialog" aria-modal="true" aria-labelledby="confirm-received-modal-title">
      <form onSubmit={handleSubmit} className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-green-200 bg-white p-5 sm:rounded-[2rem] sm:p-6">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          aria-label="Close confirm received form"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-3 pr-12">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-50 text-green-800">
            <PackageCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700">Confirm received?</p>
            <h2 id="confirm-received-modal-title" className="mt-1 text-xl font-black text-slate-950">
              {orderNumber ? `Order ${orderNumber}` : 'Order received'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Confirm only if the order was delivered and the items are correct.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:rounded-3xl">
          <div>
            <h3 className="text-lg font-black text-slate-950">Do the delivered items match your order?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Yes releases the held payment to the seller. No lets you report an issue.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-full border-amber-200 text-amber-700 hover:bg-amber-50 sm:w-auto"
            onClick={onReportIssue}
            disabled={isSubmitting}
          >
            No, report issue
          </Button>
          <Button type="submit" className="w-full rounded-full bg-green-700 hover:bg-green-800 sm:w-auto" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
            Yes, confirm received
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ConfirmReceivedModal;
