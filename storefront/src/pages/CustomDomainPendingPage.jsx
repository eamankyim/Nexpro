import { Clock, Store, WifiOff } from 'lucide-react';

/**
 * Shown on a merchant's custom domain ("Online Store" product) before their store is
 * launched, if the domain is not connected, or when the public resolve-domain call
 * fails (CORS/network). No marketplace chrome/links here — this domain is not meant
 * to advertise the shared Sabito marketplace.
 *
 * @param {{
 *   displayName?: string|null,
 *   variant?: 'pending'|'unavailable'|'unmatched',
 * }} props
 */
const CustomDomainPendingPage = ({ displayName, variant = 'pending' }) => {
  const copy = {
    pending: {
      icon: Clock,
      iconClass: 'bg-amber-50 text-amber-700',
      title: displayName ? `${displayName} is getting ready` : 'This store is getting ready',
      body: 'The store owner is still finishing setup. Please check back soon.',
    },
    unavailable: {
      icon: WifiOff,
      iconClass: 'bg-slate-100 text-slate-600',
      title: 'Store temporarily unavailable',
      body: 'We could not reach this shop right now (connection issue). Please refresh in a moment.',
    },
    unmatched: {
      icon: Store,
      iconClass: 'bg-slate-100 text-slate-600',
      title: 'No store connected',
      body: 'This domain is not linked to an active online store yet. If you own this site, connect the domain in ABS Online Store settings.',
    },
  }[variant] || {
    icon: Clock,
    iconClass: 'bg-amber-50 text-amber-700',
    title: 'This store is getting ready',
    body: 'The store owner is still finishing setup. Please check back soon.',
  };

  const Icon = copy.icon;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <span
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${copy.iconClass}`}
        >
          <Icon className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-xl font-bold text-slate-900">{copy.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{copy.body}</p>
      </div>
    </div>
  );
};

export default CustomDomainPendingPage;
