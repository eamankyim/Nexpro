import { useMemo, useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Loader2,
  Search,
  Calendar,
  Flag,
  Package,
  Cog,
  Printer,
  CheckCircle2,
  Tag,
  Phone,
  ArrowRight,
  HelpCircle,
  MessageCircle,
  Lock,
} from 'lucide-react';
import { API_BASE_URL } from '../services/api';
import { PublicTrackingBrandShell } from '../components/PublicTrackingBrandShell';
import { PublicJobTrackingPanel } from '../components/PublicJobTrackingPanel';
import { DEFAULT_APP_PRIMARY_HEX } from '../utils/colors';
import { PUBLIC_PAGE_HERO_GREEN, PUBLIC_PAGE_MINT } from '../utils/colors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

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
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

function toStatusLabel(status) {
  if (!status) return '—';
  return STATUS_LABELS[status] || status.replace(/_/g, ' ');
}

function onlyDigits(s) {
  return String(s || '').replace(/\D/g, '');
}

function waMeUrl(phone) {
  const d = onlyDigits(phone);
  if (!d) return null;
  return `https://wa.me/${d}`;
}

function WhatsAppGlyph({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

const JOB_FLOW_STEPS = [
  { title: 'Received', desc: "We've received your order.", Icon: Package, circle: 'bg-amber-100 text-amber-900 border-amber-200' },
  { title: 'In Production', desc: 'Working on your order.', Icon: Cog, circle: 'bg-sky-100 text-sky-900 border-sky-200' },
  { title: 'Printing', desc: 'Your order is being printed.', Icon: Printer, circle: 'bg-violet-100 text-violet-900 border-violet-200' },
  { title: 'Ready', desc: 'Your order is ready for pickup.', Icon: CheckCircle2, circle: 'bg-emerald-100 text-emerald-900 border-emerald-200' },
];

const ORDER_FLOW_STEPS = [
  { title: 'Received', desc: "We've received your order.", Icon: Package, circle: 'bg-amber-100 text-amber-900 border-amber-200' },
  { title: 'Processing', desc: 'We are preparing your order.', Icon: Cog, circle: 'bg-sky-100 text-sky-900 border-sky-200' },
  { title: 'Ready', desc: 'Ready for pickup or delivery.', Icon: CheckCircle2, circle: 'bg-violet-100 text-violet-900 border-violet-200' },
  { title: 'Completed', desc: 'Order fulfilled.', Icon: CheckCircle2, circle: 'bg-emerald-100 text-emerald-900 border-emerald-200' },
];

export default function TenantTrackLookup() {
  const { tenantSlug } = useParams();
  const [searchParams] = useSearchParams();
  const [branding, setBranding] = useState(null);
  const [brandingError, setBrandingError] = useState('');
  const [trackingId, setTrackingId] = useState(() => String(searchParams.get('order') || '').trim());
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const fromQuery = String(searchParams.get('order') || '').trim();
    if (fromQuery) setTrackingId(fromQuery);
  }, [searchParams]);

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

  const orgDisplay = result?.organization || branding?.organization || {};
  const primaryColor =
    typeof orgDisplay.primaryColor === 'string' && orgDisplay.primaryColor.trim()
      ? orgDisplay.primaryColor.trim()
      : DEFAULT_APP_PRIMARY_HEX;
  const organizationName = orgDisplay.name || 'Track your request';
  const logoUrl = orgDisplay.logoUrl || undefined;
  const orgPhone = orgDisplay.phone || null;

  const businessType = branding?.businessType ?? null;
  const isShopOrder = businessType === 'shop';

  const trackingKind = result?.tracking?.kind;
  const resolvedKind = trackingKind || (isShopOrder ? 'order' : 'job');
  const title = resolvedKind === 'order' ? 'Order Tracking' : 'Job Tracking';
  const idLabel = resolvedKind === 'order' ? 'Order ID' : 'Job ID';

  const heroTitle = isShopOrder ? 'Track your order instantly' : 'Track your job instantly';
  const heroTagline = isShopOrder
    ? 'Enter your details below to see the latest progress of your order.'
    : 'Enter your details below to see the latest progress of your job.';

  const dateRows = useMemo(() => {
    if (!result?.tracking) return [];
    const rows = [
      { label: 'Order date', value: result.tracking.orderDate },
      { label: 'Start date', value: result.tracking.startDate },
      { label: 'Due date', value: result.tracking.dueDate },
      { label: 'Completion date', value: result.tracking.completionDate },
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
        hint: 'Enter your ID and phone.',
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
          phone: cleanPhone,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success || !payload?.data) {
        setLookupError({
          message: payload?.message || 'No match found',
          hint: payload?.hint || 'Check your ID and phone, then try again—or contact the business.',
        });
        return;
      }

      setResult(payload.data);
    } catch {
      setLookupError({
        message: 'Connection problem',
        hint: 'Check your internet and try again—or contact the business.',
      });
    } finally {
      setLoading(false);
    }
  };

  const waUrl = waMeUrl(orgPhone);
  const flowSteps = isShopOrder ? ORDER_FLOW_STEPS : JOB_FLOW_STEPS;

  if (branding === null) {
    return (
      <PublicTrackingBrandShell
        variant="neutral"
        organizationName="Loading"
        heroTitle="Loading"
        heroTagline="Checking this tracking page…"
        logoSize="md"
      >
        <div className="rounded-2xl border border-[#e4e4e7] bg-white px-6 py-14">
          <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin" />
          </div>
        </div>
      </PublicTrackingBrandShell>
    );
  }

  if (brandingError) {
    return (
      <PublicTrackingBrandShell
        variant="neutral"
        organizationName="Unable to open tracking"
        heroTitle="Unable to open tracking"
        heroTagline="This link may be wrong or no longer available."
        logoSize="md"
      >
        <div className="rounded-2xl border border-[#e4e4e7] bg-white p-6 text-center">
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
        heroTitle="Tracking unavailable"
        heroTagline="This business has not turned on customer tracking."
        logoSize="md"
      >
        <div className="rounded-2xl border border-[#e4e4e7] bg-white p-6 text-center space-y-2">
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
      contentMode="plain"
      primaryColor={primaryColor}
      organizationName={organizationName}
      logoUrl={logoUrl}
      heroTitle={result?.tracking ? title : heroTitle}
      heroTagline={result?.tracking ? `${organizationName} — ${title}` : heroTagline}
      headerAllowOverlap={!result?.tracking}
    >
      {!result?.tracking ? (
        <div className="relative z-10 -mt-10 rounded-2xl border border-[#e4e4e7] bg-white p-4 sm:-mt-12 sm:p-5">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border sm:mb-4 sm:h-11 sm:w-11" style={{ backgroundColor: PUBLIC_PAGE_MINT, borderColor: `${PUBLIC_PAGE_HERO_GREEN}33`, color: PUBLIC_PAGE_HERO_GREEN }}>
            <Search className="h-5 w-5" strokeWidth={2} />
          </div>
          <h2 className="text-center text-lg font-bold text-foreground sm:text-xl">Track Your {isShopOrder ? 'Order' : 'Job'}</h2>
          <p className="mt-1 text-center text-sm text-muted-foreground">Enter your {isShopOrder ? 'order' : 'job'} details to check status.</p>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="tracking-id" className="text-sm font-semibold text-foreground">
                {idLabel}
              </label>
              <div className="relative">
                <Tag
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: PUBLIC_PAGE_HERO_GREEN }}
                  aria-hidden
                />
                <Input
                  id="tracking-id"
                  type="text"
                  value={trackingId}
                  onChange={(event) => setTrackingId(event.target.value)}
                  className="h-10 rounded-lg border-[#e4e4e7] bg-white pl-10"
                  placeholder={isShopOrder ? 'e.g. ORD-02341' : 'e.g. JOB-02341'}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="tracking-phone" className="text-sm font-semibold text-foreground">
                Phone Number
              </label>
              <div className="relative">
                <Phone
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: PUBLIC_PAGE_HERO_GREEN }}
                  aria-hidden
                />
                <Input
                  id="tracking-phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="h-10 rounded-lg border-[#e4e4e7] bg-white pl-10"
                  placeholder="e.g. 055 515 5972"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-lg border-0 text-base font-semibold text-white hover:opacity-95"
              style={{ backgroundColor: PUBLIC_PAGE_HERO_GREEN }}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Track {isShopOrder ? 'Order' : 'Job'}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
            <p className="flex items-center justify-center gap-1.5 pt-0.5 text-center text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5 shrink-0" style={{ color: PUBLIC_PAGE_HERO_GREEN }} aria-hidden />
              Your information is secure and private
            </p>
          </form>

          {lookupError ? (
            <div className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5 space-y-1.5" role="alert">
              <p className="text-sm font-medium text-foreground">{lookupError.message}</p>
              {lookupError.hint ? <p className="text-sm text-muted-foreground leading-relaxed">{lookupError.hint}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {result?.tracking?.kind === 'job' ? (
        <div className="rounded-2xl border border-[#e4e4e7] bg-white p-4 sm:p-5">
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
        <div className="rounded-2xl border border-[#e4e4e7] bg-white p-4 sm:p-5">
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
        <div className="rounded-2xl border border-[#e4e4e7] bg-white p-4 sm:p-5">
          <div className="rounded-lg border border-[#e4e4e7] p-3 space-y-3">
            <div className="flex items-start gap-2.5">
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
              <div className="pt-2 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-2">
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
        </div>
      ) : null}

      {!result?.tracking ? (
        <>
          <div className="rounded-2xl border border-[#e4e4e7] bg-white p-3 sm:p-4">
            <div className="flex items-start gap-2.5">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
                style={{ backgroundColor: PUBLIC_PAGE_MINT, borderColor: `${PUBLIC_PAGE_HERO_GREEN}33`, color: PUBLIC_PAGE_HERO_GREEN }}
              >
                <HelpCircle className="h-4 w-4" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="font-semibold text-foreground">Can&apos;t find your {idLabel}?</p>
                <p className="mt-0.5 text-sm text-muted-foreground">Check your WhatsApp message or SMS from us.</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {waUrl ? (
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-md border-[#006437]/40" asChild>
                    <a href={waUrl} target="_blank" rel="noopener noreferrer" aria-label="Open WhatsApp">
                      <WhatsAppGlyph className="h-4 w-4 text-[#006437]" />
                    </a>
                  </Button>
                ) : null}
                {orgPhone ? (
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-md border-[#006437]/40" asChild>
                    <a href={`sms:${onlyDigits(orgPhone)}`} aria-label="Send SMS">
                      <MessageCircle className="h-4 w-4 text-[#006437]" />
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#e4e4e7] bg-white p-4 sm:p-5">
            <h3 className="text-center text-base font-bold text-foreground">How tracking works</h3>
            <div className="relative mt-3">
              <div
                className="pointer-events-none absolute left-0 right-0 top-[1.25rem] hidden border-t border-dotted border-[#d4d4d8] sm:block"
                aria-hidden
              />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-2">
                {flowSteps.map(({ title: stepTitle, desc, Icon, circle }) => (
                  <div key={stepTitle} className="relative flex flex-col items-center text-center">
                    <div
                      className={cn(
                        'relative z-[1] flex h-10 w-10 items-center justify-center rounded-full border sm:h-11 sm:w-11',
                        circle
                      )}
                    >
                      <Icon className="h-5 w-5 sm:h-5 sm:w-5" strokeWidth={2} />
                    </div>
                    <p className="mt-2 text-xs font-bold text-foreground sm:text-sm">{stepTitle}</p>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground sm:text-xs">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </PublicTrackingBrandShell>
  );
}
