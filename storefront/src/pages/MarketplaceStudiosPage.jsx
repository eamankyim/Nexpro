import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Scissors } from 'lucide-react';

import storeService from '../services/storeService';
import {
  Breadcrumbs,
  EmptyState,
  LoadingState,
  PageShell,
  SectionHeader,
  StudioCard,
  extractList,
  unwrapData,
} from '../components/storefront/StorefrontLayout';
import { Button } from '@/components/ui/button';

const MarketplaceStudiosPage = () => {
  const [searchParams] = useSearchParams();
  const activeSearch = searchParams.get('search') || '';

  const studiosQuery = useQuery({
    queryKey: ['marketplace', 'studios', activeSearch],
    queryFn: () => storeService.getMarketplaceStudios({ search: activeSearch, limit: 48 }),
    retry: false,
  });

  const studios = useMemo(() => extractList(studiosQuery.data), [studiosQuery.data]);
  const pagination = useMemo(() => unwrapData(studiosQuery.data)?.pagination || {}, [studiosQuery.data]);

  return (
    <PageShell activePath="/studios">
      <Breadcrumbs items={[{ label: 'Studios' }]} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:rounded-[2rem] md:p-8">
        <SectionHeader
          eyebrow="All Studios"
          title="Book services from Sabito studios"
          description="Browse printing shops, salons, mechanics, and other studio businesses offering services on Sabito."
          action={pagination.totalPages > 1 ? <p className="text-sm font-semibold text-slate-500">Showing first {studios.length} studios</p> : null}
        />

        {activeSearch ? (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-green-100 bg-green-50 p-4 text-sm text-green-950 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing studios for <span className="font-semibold">"{activeSearch}"</span>
            </p>
            <Button type="button" variant="outline" className="rounded-full border-green-200 bg-white px-5 font-bold text-green-800 hover:bg-green-50" asChild>
              <Link to="/studios">Clear search</Link>
            </Button>
          </div>
        ) : null}

        {studiosQuery.isLoading ? (
          <div className="mt-8"><LoadingState label="Loading studios..." /></div>
        ) : studiosQuery.isError ? (
          <div className="mt-8">
            <EmptyState
              icon={Scissors}
              title="Could not load studios"
              description="The studio directory is temporarily unavailable."
              action={<Button className="rounded-full bg-green-700 hover:bg-green-800" onClick={() => studiosQuery.refetch()}>Try again</Button>}
            />
          </div>
        ) : studios.length ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {studios.map((studio) => (
              <StudioCard key={studio.id || studio.slug} studio={studio} />
            ))}
          </div>
        ) : (
          <div className="mt-8">
            <EmptyState
              icon={Scissors}
              title="No studios found yet"
              description="Studios appear here when businesses publish services on Sabito."
            />
          </div>
        )}
      </section>
    </PageShell>
  );
};

export default MarketplaceStudiosPage;
