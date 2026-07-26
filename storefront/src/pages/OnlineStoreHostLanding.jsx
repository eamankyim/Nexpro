import { useEffect } from 'react';
import { ExternalLink, Store } from 'lucide-react';

import { ABS_MARKETING_SITE_URL } from '../constants';
import { absAppLink } from '../config';
import { Button } from '@/components/ui/button';

/**
 * Root `/` on the shared ABS Online Store host (`store.absghana.com`).
 * Never renders Sabito marketplace chrome — shops live at `/shop/:slug`.
 */
export default function OnlineStoreHostLanding() {
  useEffect(() => {
    document.title = 'ABS Online Store';
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-emerald-50 via-white to-slate-50">
      <header className="border-b border-emerald-100/80 bg-white/80">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white">
            <Store className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight text-emerald-950">ABS Online Store</p>
            <p className="text-xs text-slate-500">African Business Suite</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Merchant shops live here
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
          This host serves each business Online Store at its own path. Open a store with a link like{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm text-slate-800">
            /shop/your-store-slug
          </code>
          . There is no Sabito marketplace on this domain.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="outline" className="border-slate-200">
            <a href={ABS_MARKETING_SITE_URL}>
              Learn about ABS
              <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
            </a>
          </Button>
          <Button asChild className="bg-emerald-700 text-white hover:bg-emerald-800">
            <a href={absAppLink('/online-store')}>Open merchant dashboard</a>
          </Button>
        </div>
      </main>
    </div>
  );
}
