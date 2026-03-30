import { useMemo, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Search, Calendar, Flag } from 'lucide-react';
import { API_BASE_URL } from '../services/api';
import { PublicTrackingBrandShell } from '../components/PublicTrackingBrandShell';
import { PublicJobTrackingPanel } from '../components/PublicJobTrackingPanel';
import { DEFAULT_APP_PRIMARY_HEX } from '../utils/colors';

const STATUS_LABELS = {
  new: 'New',
  in_progress: 'In progress',
  on_hold: 'On hold',
  cancelled: 'Cancelled',
  completed: 'Completed',
  pending: 'Pending',
  partially_paid: 'Partially paid',
  refunded: 'Refunded',
  ready: 'Ready',
  preparing: 'Preparing',
  received: 'Received',
  ready_for_delivery: 'Ready for delivery',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  returned: 'Returned',
};

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return '—';
  }
}

function toStatusLabel(status) {
  if (!status) return '—';
  return STATUS_LABELS[status] || status.replace(/_/g, ' ');
}

export default function TenantTrackLookup() {
  const { tenantSlug } = useParams();
  const [branding, setBranding] = useState(null);
  const [brandingError, setBrandingError] = useState('');
  const [trackingId, setTrackingId] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!tenantSlug) return undefined;
    let cancelled = false;
    setBranding(null);
    setBrandingError('');
    fetch(`${API_BASE_URL}/api/public/track/${encodeURIComponent(tenantSlug)}/branding`)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok || !payload?.success) {
          setBrandingError(payload?.message || 'Tracking is unavailable.');
          setBranding({ trackingEnabled: false });
          return;
        }
        setBranding(payload.data || { trackingEnabled: false });
      })
      .catch(() => {
        if (!cancelled) {
          setBrandingError('Unable to load this page.');
          setBranding({ trackingEnabled: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  const trackingKind = result?.tracking?.kind;
  const title = trackingKind === 'order' ? 'Order Tracking' : 'Job Tracking';
  const idLabel = trackingKind === 'order' ? 'Order ID' : 'Job ID';

  const orgDisplay = result?.organization || branding?.organization || {};
  const primaryColor =
    typeof orgDisplay.primaryColor === 'string' && orgDisplay.primaryColor.trim()
      ? orgDisplay.primaryColor.trim()
      : DEFAULT_APP_PRIMARY_HEX;
  const organizationName = orgDisplay.name || 'Track your request';
  const logoUrl = orgDisplay.logoUrl || undefined;

  const dateRows = useMemo(() => {
    if (!result?.tracking) return [];
    const rows = [
      { label: 'Order date', value: result.tracking.orderDate },
      { label: 'Start date', value: result.tracking.startDate },
      { label: 'Due date', value: result.tracking.dueDate },
      { label: 'Completion date', value: result.tracking.completionDate }
    ];
    return rows.filter((row) => !!row.value);
  }, [result]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const cleanId = trackingId.trim();
    const cleanPhone = phone.trim();
    if (!tenantSlug || !cleanId || !cleanPhone) {
      setLookupError({
        message: 'Missing details',
        hint: 'Enter your ID and phone.'
      });
      return;
    }

    setLoading(true);
    setLookupError(null);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/public/track/${encodeURIComponent(tenantSlug)}/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingId: cleanId,
          phone: cleanPhone
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success || !payload?.data) {
        setLookupError({
          message: payload?.message || 'No match found',
          hint: payload?.hint || 'Check your ID and phone, then try again—or contact the business.'
        });
        return;
      }

      setResult(payload.data);
    } catch {
      setLookupError({
        message: 'Connection problem',
        hint: 'Check your internet and try again—or contact the business.'
      });
    } finally {
      setLoading(false);
    }
  };

  if (branding === null) {
    return (
      <PublicTrackingBrandShell variant="neutral" organizationName="Loading" subtitle="Checking this tracking page…">
        <div className="p-10 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      </PublicTrackingBrandShell>
    );
  }

  if (brandingError) {
    return (
      <PublicTrackingBrandShell
        variant="neutral"
        organizationName="Unable to open tracking"
        subtitle="This link may be wrong or no longer available."
      >
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground">{brandingError}</p>
        </div>
      </PublicTrackingBrandShell>
    );
  }

  if (branding.trackingEnabled !== true) {
    return (
      <PublicTrackingBrandShell
        variant="neutral"
        organizationName="Tracking unavailable"
        subtitle="This business has not turned on customer tracking."
      >
        <div className="p-6 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Customer tracking is not enabled for this workspace, or this link is not valid.
          </p>
          <p className="text-sm text-muted-foreground">
            If you expected to see your order or job here, contact the business directly.
          </p>
        </div>
      </PublicTrackingBrandShell>
    );
  }

  return (
    <PublicTrackingBrandShell
      primaryColor={primaryColor}
      organizationName={organizationName}
      logoUrl={logoUrl}
      subtitle={result?.tracking ? title : `${title} — enter your details below`}
    >
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="tracking-id" className="text-sm font-medium text-foreground">
              {idLabel}
            </label>
            <input
              id="tracking-id"
              type="text"
              value={trackingId}
              onChange={(event) => setTrackingId(event.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm bg-background"
              placeholder={`Enter your ${idLabel.toLowerCase()}`}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="tracking-phone" className="text-sm font-medium text-foreground">
              Phone
            </label>
            <input
              id="tracking-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm bg-background"
              placeholder="Enter the phone used for this request"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-70"
            style={{ backgroundColor: primaryColor }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? 'Checking...' : 'Track now'}
          </button>
        </form>

        {lookupError ? (
          <div
            className="mt-4 rounded-md border border-border bg-muted/30 px-4 py-3 space-y-2"
            role="alert"
          >
            <p className="text-sm font-medium text-foreground">{lookupError.message}</p>
            {lookupError.hint ? (
              <p className="text-sm text-muted-foreground leading-relaxed">{lookupError.hint}</p>
            ) : null}
          </div>
        ) : null}

        {result?.tracking?.kind === 'job' ? (
          <div className="mt-6 border-t border-border pt-6">
            <PublicJobTrackingPanel
              primaryColor={primaryColor}
              jobNumber={result.tracking.idValue}
              title={result.tracking.titleOrSummary}
              timelineKind={result.tracking.timelineKind === 'delivery' ? 'delivery' : 'job'}
              status={result.tracking.status}
              deliveryStatus={result.tracking.deliveryStatus}
              orderDate={result.tracking.orderDate}
              startDate={result.tracking.startDate}
              inProgressAt={result.tracking.inProgressAt}
              completionDate={result.tracking.completionDate}
              createdAt={result.tracking.createdAt}
              updatedAt={result.tracking.updatedAt}
            />
          </div>
        ) : result?.tracking &&
          (result.tracking.timelineKind === 'delivery' || result.tracking.timelineKind === 'kitchen') ? (
          <div className="mt-6 border-t border-border pt-6">
            <PublicJobTrackingPanel
              primaryColor={primaryColor}
              jobNumber={result.tracking.idValue}
              title={result.tracking.titleOrSummary}
              timelineKind={result.tracking.timelineKind === 'kitchen' ? 'kitchen' : 'delivery'}
              status={result.tracking.status}
              deliveryStatus={result.tracking.deliveryStatus}
              orderStatus={result.tracking.orderStatus}
              orderDate={result.tracking.orderDate}
              createdAt={result.tracking.createdAt}
              updatedAt={result.tracking.updatedAt}
              completionDate={result.tracking.completionDate}
            />
          </div>
        ) : result?.tracking ? (
          <div className="mt-5 rounded-lg border border-border p-4 space-y-4">
            <div className="flex items-start gap-3">
              <Flag className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
                <p className="font-semibold text-foreground">{toStatusLabel(result.tracking.status)}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {result.tracking.idLabel || idLabel}
              </p>
              <p className="font-semibold text-foreground">{result.tracking.idValue}</p>
              {result.tracking.titleOrSummary ? (
                <p className="text-sm text-foreground mt-1">{result.tracking.titleOrSummary}</p>
              ) : null}
            </div>

            {dateRows.length > 0 ? (
              <div className="pt-2 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3">
                {dateRows.map((row) => (
                  <div key={row.label} className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{row.label}</p>
                      <p className="text-sm text-foreground">{formatDate(row.value)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </PublicTrackingBrandShell>
  );
}
