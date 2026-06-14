import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, CreditCard, Loader2, ShoppingBag, ShoppingCart } from 'lucide-react';

import { Breadcrumbs, PageShell } from '../components/storefront/StorefrontLayout';
import { useStorefrontAuth } from '../context/StorefrontAuthContext';
import { Button } from '@/components/ui/button';

const pageCopy = {
  cart: {
    eyebrow: 'Shopping Cart',
    title: 'Your cart is almost ready',
    description: 'Customers can browse live products today. Cart saving, quantity updates, and checkout handoff will launch with marketplace ordering.',
    icon: ShoppingCart,
    primaryLabel: 'Shop products',
    primaryTo: '/products',
    secondaryLabel: 'Browse stores',
    secondaryTo: '/stores',
    activePath: '/cart',
  },
  checkout: {
    eyebrow: 'Checkout',
    title: 'Account checkout is coming soon',
    description: 'You are signed in. Sabito Store checkout will collect buyer payment into Sabito Trade Assurance, hold funds during delivery, and release seller payout after confirmation.',
    icon: CreditCard,
    primaryLabel: 'Shop products',
    primaryTo: '/products',
    secondaryLabel: 'Track order',
    secondaryTo: '/track-order',
    activePath: '/checkout',
  },
  'checkout-auth-required': {
    eyebrow: 'No Guest Checkout',
    title: 'Create an account to buy',
    description: 'Shoppers can browse freely, but purchases require a Sabito Store customer account for order tracking, trade assurance, and seller communication.',
    icon: CreditCard,
    primaryLabel: 'Create account and checkout',
    primaryTo: '/checkout',
    secondaryLabel: 'Continue browsing',
    secondaryTo: '/products',
    activePath: '/checkout',
  },
  'auth-loading': {
    eyebrow: 'Shopper account',
    title: 'Checking your shopper session',
    description: 'Please wait while Sabito Store verifies your customer account before checkout.',
    icon: Loader2,
    primaryLabel: 'Shop products',
    primaryTo: '/products',
    secondaryLabel: 'Browse stores',
    secondaryTo: '/stores',
    activePath: '/checkout',
  },
};

const ComingSoonPage = ({ type = 'cart' }) => {
  const copy = pageCopy[type] || pageCopy.cart;
  const Icon = copy.icon;
  const { openShopperAuthModal } = useStorefrontAuth();
  const needsCheckoutAuth = type === 'checkout-auth-required';
  const handleOpenCheckoutAuth = useCallback(() => {
    openShopperAuthModal({
      mode: 'signup',
      intent: {
        action: 'checkout',
        returnTo: '/checkout',
      },
    });
  }, [openShopperAuthModal]);

  return (
    <PageShell activePath={copy.activePath}>
      <Breadcrumbs items={[{ label: copy.eyebrow }]} />

      <section className="mx-auto max-w-3xl rounded-2xl border border-green-200 bg-white p-8 text-center sm:rounded-[2rem] md:p-10">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-green-100 bg-green-50 text-green-800 sm:rounded-3xl">
          <Icon className={`h-10 w-10 ${type === 'auth-loading' ? 'animate-spin' : ''}`} />
        </span>
        <p className="mt-6 text-sm font-bold uppercase tracking-[0.18em] text-green-700">{copy.eyebrow}</p>
        <h1 className="mt-3 text-3xl font-black text-slate-950 md:text-4xl">{copy.title}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">{copy.description}</p>

        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left sm:rounded-3xl">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-amber-800">
            <Clock className="h-4 w-4" />
            {type === 'checkout' || needsCheckoutAuth ? 'Login required' : 'Coming soon'}
          </span>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {needsCheckoutAuth
              ? 'Your cart and checkout path are preserved. After authentication, you will return to the purchase flow.'
              : type === 'checkout'
              ? 'Guest buying is disabled. Checkout and order placement will only continue for signed-in shopper accounts, with payment held by Sabito until delivery is confirmed.'
              : 'You can still open product pages, contact sellers, and discover stores across the marketplace while checkout is being finished.'}
          </p>
        </div>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button variant="outline" className="rounded-full border-green-200 text-green-800 hover:bg-green-50" asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to marketplace
            </Link>
          </Button>
          <Button variant="outline" className="rounded-full border-green-200 text-green-800 hover:bg-green-50" asChild>
            <Link to={copy.secondaryTo}>{copy.secondaryLabel}</Link>
          </Button>
          <Button
            type="button"
            className="rounded-full bg-green-700 hover:bg-green-800"
            onClick={needsCheckoutAuth ? handleOpenCheckoutAuth : undefined}
            asChild={!needsCheckoutAuth}
          >
            {needsCheckoutAuth ? (
              <>
                <ShoppingBag className="mr-2 h-4 w-4" />
                {copy.primaryLabel}
              </>
            ) : (
              <Link to={copy.primaryTo}>
              <ShoppingBag className="mr-2 h-4 w-4" />
              {copy.primaryLabel}
              </Link>
            )}
          </Button>
        </div>
      </section>
    </PageShell>
  );
};

export default ComingSoonPage;
