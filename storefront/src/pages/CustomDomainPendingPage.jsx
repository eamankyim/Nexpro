import { Clock } from 'lucide-react';

/**
 * Shown on a merchant's custom domain ("Online Store" product) before their store is
 * launched, or if the domain no longer resolves to an active store. No marketplace
 * chrome/links here — this domain is not meant to advertise the shared Sabito marketplace.
 */
const CustomDomainPendingPage = ({ displayName }) => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-700">
        <Clock className="h-7 w-7" />
      </span>
      <h1 className="mt-5 text-xl font-bold text-slate-900">
        {displayName ? `${displayName} is getting ready` : 'This store is getting ready'}
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        The store owner is still finishing setup. Please check back soon.
      </p>
    </div>
  </div>
);

export default CustomDomainPendingPage;
