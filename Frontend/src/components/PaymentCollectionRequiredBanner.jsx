/**
 * When automatic invoice sending is enabled but payment collection is not set up,
 * show a persistent banner and force the user to set payment collection.
 * Re-checks every 10 minutes and on window focus so the banner appears/updates
 * as soon as auto-send is turned on or payment is not configured.
 */
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { CreditCard } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import settingsService from '@/services/settingsService';
import { Button } from '@/components/ui/button';

const REFETCH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes – force check for payment collection

function isPaymentConfigured(pc) {
  if (!pc || typeof pc !== 'object') return false;
  const settlementType = pc.settlement_type ?? pc.settlementType;
  const isMomo = settlementType === 'momo';
  const hasMomoDetails = Boolean(pc.momo_phone_masked ?? pc.momoPhone ?? pc.momo_provider ?? pc.momoProvider);
  return Boolean(
    pc.hasSubaccount === true ||
    pc.configured === true ||
    (isMomo && hasMomoDetails)
  );
}

/** Unwrap API response: may be { success, data } or the payload directly */
function getPaymentCollectionPayload(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  if (raw.data != null && (raw.success === true || raw.success === 'true')) return raw.data;
  return raw;
}

const sharedRefetchOptions = {
  refetchInterval: REFETCH_INTERVAL_MS,
  refetchOnWindowFocus: true,
};

export default function PaymentCollectionRequiredBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeTenant, isManager } = useAuth();
  const tenantId = activeTenant?.id;

  const isOnPaymentSettings =
    location.pathname === '/settings' &&
    new URLSearchParams(location.search).get('tab') === 'integration' &&
    new URLSearchParams(location.search).get('subtab') === 'payments';

  const { data: channels } = useQuery({
    queryKey: ['settings', 'notification-channels'],
    queryFn: settingsService.getNotificationChannels,
    enabled: !!tenantId,
    ...sharedRefetchOptions,
  });

  const { data: quoteWorkflow } = useQuery({
    queryKey: ['settings', 'quote-workflow'],
    queryFn: settingsService.getQuoteWorkflow,
    enabled: !!tenantId,
    ...sharedRefetchOptions,
  });

  const { data: paymentCollection } = useQuery({
    queryKey: ['settings', 'payment-collection', tenantId],
    queryFn: settingsService.getPaymentCollectionSettings,
    enabled: !!tenantId,
    staleTime: 0,
    refetchOnMount: 'always',
    ...sharedRefetchOptions,
  });

  const pc = getPaymentCollectionPayload(paymentCollection);
  const paymentConfigured = isPaymentConfigured(pc);
  // Only enforce when explicitly enabled by tenant settings.
  const autoSendInvoice = channels?.autoSendInvoiceToCustomer === true;
  const quoteAutoSend =
    (quoteWorkflow?.onAccept || 'record_only') === 'create_job_invoice_and_send';
  const autoSendEnabled = autoSendInvoice || quoteAutoSend;

  if (!tenantId || !autoSendEnabled || paymentConfigured || isOnPaymentSettings) {
    return null;
  }

  return (
    <div className="mx-4 sm:mx-4 lg:mx-6 mt-2 rounded-lg border border-amber-600/50 bg-amber-500/10 px-3 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <CreditCard className="h-5 w-5 shrink-0 text-amber-600" />
        <p className="text-sm text-foreground">
          {isManager
            ? 'Automatic invoice sending is on but payment collection is not set up. Customers cannot pay online. Set up payment collection so invoice links work for payment.'
            : 'Automatic invoice sending is on but payment collection is not set up. Ask a workspace manager or administrator to configure payment collection in Settings.'}
        </p>
      </div>
      {isManager && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 border-amber-600/50 text-amber-700 hover:bg-amber-500/20"
          onClick={() => navigate('/settings?tab=payments')}
        >
          Set up payment collection
        </Button>
      )}
    </div>
  );
}
