import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Store } from 'lucide-react';

import storeService from '../services/storeService';
import {
  Breadcrumbs,
  EmptyState,
  LoadingState,
  PageShell,
  SectionHeader,
  StoreCard,
  extractList,
  unwrapData,
} from '../components/storefront/StorefrontLayout';
import { Button } from '@/components/ui/button';

const MarketplaceStoresPage = () => {
  const [searchParams] = useSearchParams();
  const activeSearch = searchParams.get('search') || '';

  const storesQuery = useQuery({
    queryKey: ['marketplace', 'stores', activeSearch],
    queryFn: () => storeService.getMarketplaceStores({ search: activeSearch, limit: 48 }),
    retry: false,
  });

  const stores = useMemo(() => extractList(storesQuery.data), [storesQuery.data]);
  const pagination = useMemo(() => unwrapData(storesQuery.data)?.pagination || {}, [storesQuery.data]);

  return (
    <PageShell activePath="/stores">
      <Breadcrumbs items={[{ label: 'Stores' }]} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:rounded-[2rem] md:p-8">
        <SectionHeader
          eyebrow="All Stores"
          title="Shop from launched Sabito storefronts"
          description="Browse verified public storefronts and open each store to explore its published catalog, contact options, delivery hints, and customer trust details."
          action={pagination.totalPages > 1 ? <p className="text-sm font-semibold text-slate-500">Showing first {stores.length} stores</p> : null}
        />

        {activeSearch ? (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-green-100 bg-green-50 p-4 text-sm text-green-950 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing stores for <span className="font-semibold">"{activeSearch}"</span>
            </p>
            <Button type="button" variant="outline" className="rounded-full border-green-200 bg-white px-5 font-bold text-green-800 hover:bg-green-50" asChild>
              <Link to="/stores">Clear search</Link>
            </Button>
          </div>
        ) : null}

        {storesQuery.isLoading ? (
          <div className="mt-8">
            <LoadingState label="Loading public stores..." />
          </div>
        ) : storesQuery.isError ? (
          <div className="mt-8">
            <EmptyState
              icon={Store}
              title="Could not load stores"
              description="The marketplace directory is temporarily unavailable. Confirm the backend is running and refresh this page."
              action={(
                <Button className="rounded-full bg-green-700 hover:bg-green-800" onClick={() => storesQuery.refetch()}>
                  Try again
                </Button>
              )}
            />
          </div>
        ) : stores.length ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {stores.map((storeItem) => (
              <StoreCard key={storeItem.id || storeItem.slug} store={storeItem} />
            ))}
          </div>
        ) : (
          <div className="mt-8">
            <EmptyState
              icon={Store}
              title={activeSearch ? 'No stores match that search yet' : 'No launched stores yet'}
              description={activeSearch ? 'Try another store name, business type, or product category.' : 'Stores appear here automatically after Sabito sellers launch public storefronts with published products.'}
              action={(
                <Button className="rounded-full bg-green-700 hover:bg-green-800" asChild>
                  <Link to="/products">Browse products</Link>
                </Button>
              )}
            />
          </div>
        )}
      </section>
    </PageShell>
  );
};

export default MarketplaceStoresPage;
