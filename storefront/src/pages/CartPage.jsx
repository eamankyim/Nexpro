import { Link } from 'react-router-dom';
import { Minus, Plus, ShieldCheck, ShoppingCart, Trash2 } from 'lucide-react';

import { useCart } from '../context/CartContext';
import { resolveImageUrl } from '../utils/fileUtils';
import { formatAmount } from '../utils/formatNumber';
import AccountLayout from '../components/storefront/AccountLayout';
import { EmptyState } from '../components/storefront/StorefrontLayout';
import { Button } from '@/components/ui/button';

const CartPage = () => {
  const { cartSummary, items, removeItem, updateQuantity } = useCart();

  return (
    <AccountLayout
      activePath="/cart"
      title="Cart"
      description="Review your basket, continue shopping, or move into checkout when you are ready."
      breadcrumbItems={[{ label: 'Cart' }]}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:rounded-[2rem] sm:p-5 md:p-6">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700">Shopping cart</p>
              <h1 className="mt-2 text-3xl font-black text-slate-950">Your cart</h1>
              {cartSummary.store ? (
                <p className="mt-2 text-sm text-slate-500">Ordering from {cartSummary.store.displayName}</p>
              ) : null}
            </div>
            <Button asChild variant="outline" className="w-full rounded-full border-green-200 text-green-800 hover:bg-green-50 sm:w-auto">
              <Link to="/products">Continue shopping</Link>
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                icon={ShoppingCart}
                title="Your cart is empty"
                description="Add products from a Sabito seller and checkout with payment held by Sabito until delivery is confirmed."
                action={<Button asChild className="rounded-full bg-green-700 hover:bg-green-800"><Link to="/products">Browse products</Link></Button>}
              />
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {items.map((item) => (
                <article key={item.listingId} className="grid gap-4 rounded-2xl border border-slate-200 p-4 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:rounded-3xl">
                  <div className="h-24 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 sm:w-24">
                    {resolveImageUrl(item.image) ? (
                      <img src={resolveImageUrl(item.image)} alt={item.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-400">
                        <ShoppingCart className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-green-700">{item.storeName}</p>
                    <h2 className="mt-1 break-words text-lg font-black text-slate-950">{item.title}</h2>
                    {item.sku ? <p className="mt-1 text-xs text-slate-500">SKU {item.sku}</p> : null}
                    <p className="mt-3 font-black text-green-800">{formatAmount(item.unitPrice, cartSummary.currency)}</p>
                  </div>
                  <div className="flex flex-col gap-3 sm:items-end sm:justify-between">
                    <div className="inline-flex items-center overflow-hidden rounded-full border border-slate-200">
                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center text-slate-600 hover:bg-slate-50"
                        onClick={() => updateQuantity(item.listingId, item.quantity - 1)}
                        aria-label={`Decrease quantity for ${item.title}`}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        value={item.quantity}
                        onChange={(event) => updateQuantity(item.listingId, event.target.value)}
                        className="h-10 w-12 border-x border-slate-200 text-center text-sm font-bold outline-none"
                        aria-label={`Quantity for ${item.title}`}
                      />
                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center text-slate-600 hover:bg-slate-50"
                        onClick={() => updateQuantity(item.listingId, item.quantity + 1)}
                        aria-label={`Increase quantity for ${item.title}`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
                      <p className="font-black text-slate-950">{formatAmount(item.unitPrice * item.quantity, cartSummary.currency)}</p>
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 text-rose-700 hover:bg-rose-50"
                        onClick={() => removeItem(item.listingId)}
                        aria-label={`Remove ${item.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 sm:rounded-[2rem] sm:p-5 md:p-6">
          <h2 className="text-xl font-black text-slate-950">Order summary</h2>
          <div className="mt-5 grid gap-3 text-sm">
            <SummaryLine label="Items" value={cartSummary.itemCount} />
            <SummaryLine label="Subtotal" value={formatAmount(cartSummary.subtotal, cartSummary.currency)} />
          </div>
          <div className="mt-5 rounded-2xl border border-green-100 bg-green-50 p-4 text-sm leading-6 text-green-900 sm:rounded-3xl">
            <span className="inline-flex items-center gap-2 font-black text-green-800">
              <ShieldCheck className="h-4 w-4" />
              Sabito Trade Assurance
            </span>
            <p className="mt-2">Your payment is held by Sabito and released to the seller after delivery is confirmed.</p>
          </div>
          <Button asChild className="mt-5 w-full rounded-full bg-green-700 hover:bg-green-800" disabled={items.length === 0}>
            <Link to={items.length === 0 ? '/products' : '/checkout'}>
              {items.length === 0 ? 'Browse products' : 'Checkout'}
            </Link>
          </Button>
        </aside>
      </div>
    </AccountLayout>
  );
};

const SummaryLine = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-slate-500">{label}</span>
    <span className="font-black text-slate-950">{value}</span>
  </div>
);

export default CartPage;

