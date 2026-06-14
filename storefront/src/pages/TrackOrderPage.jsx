import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CalendarDays, Loader2, MapPin, Package, Search, ShoppingBag, Store, Truck } from 'lucide-react';

import { Breadcrumbs, PageShell, SectionHeader } from '../components/storefront/StorefrontLayout';
import DeliveryProgressTimeline from '../components/storefront/DeliveryProgressTimeline';
import { useStorefrontAuth } from '../context/StorefrontAuthContext';
import storeService from '../services/storeService';
import { formatAmount } from '../utils/formatNumber';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const helpHints = [
  'Use the order reference from your Sabito Store checkout confirmation.',
  'Enter the same email or phone number used when the order was placed.',
  'For delivery changes or urgent questions, contact the seller from the store page.',
];

const formatDateTime = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const getStatusLabel = (order) => (
  order?.currentLabel
  || order?.deliveryTracking?.currentLabel
  || order?.deliveryStatus
  || order?.orderStatus
  || order?.status
  || 'Order received'
).replace(/_/g, ' ');

const getDeliveryLocation = (summary = {}) => (
  [summary.city, summary.region, summary.country].filter(Boolean).join(', ')
);

const TrackOrderPage = () => {
  const { isAuthenticated } = useStorefrontAuth();
  const [orderReference, setOrderReference] = useState('');
  const [contact, setContact] = useState('');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const normalizedReference = useMemo(() => orderReference.trim().toUpperCase(), [orderReference]);
  const canSubmit = normalizedReference && contact.trim() && !isLoading;
  const deliveryTracking = order?.deliveryTracking || {};
  const deliveryTimeline = deliveryTracking.timeline || order?.deliveryTimeline || [];
  const storePath = order?.support?.storePath || (order?.storeSlug ? `/stores/${encodeURIComponent(order.storeSlug)}` : '/stores');

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    setError('');
    setOrder(null);

    if (!normalizedReference || !contact.trim()) {
      setError('Enter your order reference and checkout email or phone.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await storeService.trackStorefrontOrder({
        reference: normalizedReference,
        contact: contact.trim(),
      });
      setOrder(response?.data?.order || response?.order || null);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message
        || requestError?.message
        || 'Could not track this order. Check the details and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [contact, normalizedReference]);

  return (
    <PageShell activePath="/track-order" appMode={isAuthenticated}>
      {!isAuthenticated ? <Breadcrumbs items={[{ label: 'Track Order' }]} /> : null}

      <section className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 sm:rounded-[2rem] sm:p-5 md:p-8">
        {!isAuthenticated ? (
          <SectionHeader
            eyebrow="Track Order"
            title="Follow your marketplace order"
            description="Enter your order reference and the email or phone used at checkout to see the latest seller and delivery updates."
          />
        ) : null}

        <form onSubmit={handleSubmit} className={`${isAuthenticated ? '' : 'mt-8 '}grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:rounded-3xl`}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="order-reference" className="mb-2 block text-sm font-bold text-slate-700">Order reference</label>
              <Input
                id="order-reference"
                value={orderReference}
                onChange={(event) => setOrderReference(event.target.value)}
                placeholder="e.g. SALE-20260610-0001"
                className="h-12 rounded-full px-5"
                autoComplete="off"
                required
              />
            </div>
            <div>
              <label htmlFor="order-contact" className="mb-2 block text-sm font-bold text-slate-700">Email or phone</label>
              <Input
                id="order-contact"
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder="Checkout email or phone number"
                className="h-12 rounded-full px-5"
                autoComplete="email"
                required
              />
            </div>
          </div>
          {error ? (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={!canSubmit} className="h-12 w-full rounded-full bg-green-700 px-6 hover:bg-green-800 disabled:opacity-70 sm:w-auto">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              {isLoading ? 'Tracking order...' : 'Track order'}
            </Button>
          </div>
        </form>

        {order ? (
          <div className="mt-6 grid gap-6">
            <section className="rounded-2xl border border-green-200 bg-green-50 p-5 sm:rounded-[2rem]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700">{order.storeName}</p>
                  <h2 className="mt-2 break-words text-2xl font-black text-slate-950 sm:text-3xl">{order.saleNumber}</h2>
                  <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-600">
                    <CalendarDays className="h-4 w-4" />
                    Placed {formatDateTime(order.createdAt)}
                  </p>
                </div>
                <Badge variant="outline" className="border-green-200 bg-white capitalize text-green-800">
                  {getStatusLabel(order)}
                </Badge>
              </div>
              <div className="mt-5 grid gap-3 rounded-2xl border border-green-100 bg-white p-4 sm:grid-cols-3 sm:rounded-3xl">
                <TotalLine label="Items" value={`${order.itemCount || 0}`} />
                <TotalLine label="Delivery" value={formatAmount(order.deliveryFee || 0, order.currency)} />
                <TotalLine label="Total" value={formatAmount(order.total || 0, order.currency)} strong />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:rounded-[2rem]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="inline-flex items-center gap-2 text-xl font-black text-slate-950">
                    <Truck className="h-5 w-5 text-green-700" />
                    Delivery progress
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">Seller updates appear here as the order moves forward.</p>
                </div>
                <Badge variant="outline" className="border-green-100 bg-green-50 capitalize text-green-800">
                  {deliveryTracking.currentLabel || getStatusLabel(order)}
                </Badge>
              </div>
              <div className="mt-5">
                <DeliveryProgressTimeline timeline={deliveryTimeline} />
              </div>
              {(deliveryTracking.courier || deliveryTracking.trackingNumber || deliveryTracking.notes) ? (
                <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3 sm:rounded-3xl">
                  <TotalLine label="Courier" value={deliveryTracking.courier || 'Not provided'} />
                  <TotalLine label="Tracking no." value={deliveryTracking.trackingNumber || 'Not provided'} />
                  <TotalLine label="Notes" value={deliveryTracking.notes || 'No notes'} />
                </div>
              ) : null}
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:rounded-[2rem]">
                <h3 className="inline-flex items-center gap-2 text-xl font-black text-slate-950">
                  <ShoppingBag className="h-5 w-5 text-green-700" />
                  Items summary
                </h3>
                <div className="mt-4 grid gap-3">
                  {(order.items || []).map((item) => (
                    <div key={`${item.name}-${item.quantity}`} className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 p-4 sm:rounded-3xl">
                      <div className="min-w-0">
                        <p className="break-words font-bold text-slate-950">{item.name}</p>
                        <p className="mt-1 text-sm text-slate-500">Qty {item.quantity}</p>
                      </div>
                      <p className="shrink-0 font-black text-green-800">{formatAmount(item.total || 0, order.currency)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:rounded-[2rem]">
                  <h3 className="inline-flex items-center gap-2 text-xl font-black text-slate-950">
                    <MapPin className="h-5 w-5 text-green-700" />
                    Delivery summary
                  </h3>
                  {order.deliverySummary ? (
                    <div className="mt-4 text-sm leading-6 text-slate-600">
                      <p className="font-bold text-slate-900">{order.deliverySummary.recipientName || order.deliverySummary.label || 'Delivery address'}</p>
                      {getDeliveryLocation(order.deliverySummary) ? <p>{getDeliveryLocation(order.deliverySummary)}</p> : null}
                      <p className="mt-2 text-slate-500">Full delivery details stay private and are only available in your shopper account.</p>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">Pickup order. Seller pickup details are handled by the store.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:rounded-[2rem]">
                  <h3 className="inline-flex items-center gap-2 text-xl font-black text-slate-950">
                    <Store className="h-5 w-5 text-green-700" />
                    Need help?
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {order.support?.message || 'Contact the seller for delivery changes or product questions.'}
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <Button variant="outline" className="w-full rounded-full border-green-200 text-green-800 hover:bg-green-50 sm:w-auto" asChild>
                      <Link to="/products">Continue shopping</Link>
                    </Button>
                    <Button className="w-full rounded-full bg-green-700 hover:bg-green-800 sm:w-auto" asChild>
                      <Link to={storePath}>Contact store</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-green-100 bg-green-50 p-5 sm:rounded-3xl">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-green-700">
                <Truck className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-black text-slate-950">Live order tracking</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Tracking is available for Sabito Store checkout orders. Your contact detail is required before we show order information.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-3">
          {helpHints.map((hint) => (
            <div key={hint} className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-600">
              <Package className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
              {hint}
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" className="rounded-full border-green-200 text-green-800 hover:bg-green-50" asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to marketplace
            </Link>
          </Button>
          <Button className="rounded-full bg-green-700 hover:bg-green-800" asChild>
            <Link to="/about-contact">
              <Truck className="mr-2 h-4 w-4" />
              Contact support
            </Link>
          </Button>
        </div>
      </section>
    </PageShell>
  );
};

const TotalLine = ({ label, value, strong = false }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`mt-1 ${strong ? 'text-2xl' : 'text-lg'} font-black text-slate-950`}>{value}</p>
  </div>
);

export default TrackOrderPage;
