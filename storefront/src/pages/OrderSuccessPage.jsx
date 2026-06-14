import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Package, ShieldCheck } from 'lucide-react';

import storeService from '../services/storeService';
import { showError } from '../utils/toast';
import { formatAmount } from '../utils/formatNumber';
import { Breadcrumbs, PageShell } from '../components/storefront/StorefrontLayout';
import { Button } from '@/components/ui/button';

const OrderSuccessPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(location.state?.order || null);
  const [isLoading, setIsLoading] = useState(!location.state?.order && Boolean(id));

  useEffect(() => {
    if (order || !id) return undefined;
    let mounted = true;
    storeService.getStorefrontOrder(id)
      .then((response) => {
        if (mounted) setOrder(response?.data?.order || response?.order || null);
      })
      .catch((error) => {
        if (mounted) showError(error, 'Could not load order confirmation.');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id, order]);

  return (
    <PageShell activePath="/checkout" appMode>
      <Breadcrumbs items={[{ label: 'Order placed' }]} />
      <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 text-center sm:rounded-[2rem] md:p-10">
        {isLoading ? (
          <div className="flex min-h-60 items-center justify-center text-sm font-semibold text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading order confirmation...
          </div>
        ) : (
          <>
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-50 text-green-700">
              <CheckCircle2 className="h-11 w-11" />
            </span>
            <p className="mt-6 text-sm font-bold uppercase tracking-[0.18em] text-green-700">Order placed</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950 md:text-4xl">
              {order?.saleNumber ? `Order ${order.saleNumber}` : 'Your order is confirmed'}
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
              {order?.paymentStatus === 'paid_held' || order?.tradeAssurance?.paymentStatus === 'paid_held'
                ? 'The seller has received your order. Sabito is holding the payment until delivery is confirmed.'
                : 'Your order details are shown below. Payment confirmation may still be processing.'}
            </p>

            {order ? (
              <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left sm:grid-cols-3 sm:rounded-3xl">
                <TotalLine label="Subtotal" value={formatAmount(order.subtotal, order.currency)} />
                <TotalLine label="Delivery" value={formatAmount(order.deliveryFee, order.currency)} />
                <TotalLine label="Total" value={formatAmount(order.total, order.currency)} strong />
              </div>
            ) : null}

            <div className="mt-6 rounded-2xl border border-green-100 bg-green-50 p-5 text-left sm:rounded-3xl">
              <span className="inline-flex items-center gap-2 font-black text-green-800">
                <ShieldCheck className="h-5 w-5" />
                What happens next
              </span>
              <div className="mt-3 grid gap-2 text-sm leading-6 text-green-900">
                <p>The seller prepares your order and contacts you for delivery or pickup details.</p>
                {(order?.paymentStatus === 'paid_held' || order?.tradeAssurance?.paymentStatus === 'paid_held') ? (
                  <p>Payment stays held by Sabito Trade Assurance until you confirm the order was received.</p>
                ) : (
                  <p>If payment is still processing, refresh this page shortly or check your orders list.</p>
                )}
                <p>You can track this order from your shopper account and confirm receipt after delivery.</p>
              </div>
            </div>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button variant="outline" className="rounded-full border-green-200 text-green-800 hover:bg-green-50" asChild>
                <Link to="/products">Continue shopping</Link>
              </Button>
              <Button className="rounded-full bg-green-700 hover:bg-green-800" asChild>
                <Link to={order?.id ? `/account/orders/${order.id}` : '/account/orders'}>
                  <Package className="mr-2 h-4 w-4" />
                  View order
                </Link>
              </Button>
            </div>
          </>
        )}
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

export default OrderSuccessPage;

