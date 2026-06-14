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
  ServiceCard,
  extractList,
} from '../components/storefront/StorefrontLayout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MarketplaceServicesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSearch = searchParams.get('search') || '';
  const activeCategory = searchParams.get('category') || 'all';
  const activeStudioSlug = searchParams.get('studioSlug') || '';

  const categoriesQuery = useQuery({
    queryKey: ['marketplace', 'service-categories'],
    queryFn: () => storeService.getMarketplaceServiceCategories(),
    retry: false,
  });

  const servicesQuery = useQuery({
    queryKey: ['marketplace', 'services', activeSearch, activeCategory, activeStudioSlug],
    queryFn: () => storeService.getMarketplaceServices({
      search: activeSearch,
      category: activeCategory === 'all' ? '' : activeCategory,
      studioSlug: activeStudioSlug,
      limit: 48,
    }),
    retry: false,
  });

  const categories = useMemo(() => extractList(categoriesQuery.data), [categoriesQuery.data]);
  const services = useMemo(() => extractList(servicesQuery.data), [servicesQuery.data]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  };

  return (
    <PageShell activePath="/services">
      <Breadcrumbs items={[{ label: 'Services' }]} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:rounded-[2rem] md:p-8">
        <SectionHeader
          eyebrow="Services"
          title="Browse studio services on Sabito"
          description="Request quotes, book appointments, and connect with trusted service providers."
        />

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Select value={activeCategory} onValueChange={(value) => updateParam('category', value)}>
            <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.name} value={category.name}>{category.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeStudioSlug ? (
            <Button variant="outline" className="rounded-full" onClick={() => updateParam('studioSlug', '')}>
              Clear studio filter
            </Button>
          ) : null}
        </div>

        {servicesQuery.isLoading ? (
          <div className="mt-8"><LoadingState label="Loading services..." /></div>
        ) : servicesQuery.isError ? (
          <div className="mt-8">
            <EmptyState
              icon={Scissors}
              title="Could not load services"
              description="The services directory is temporarily unavailable."
              action={<Button className="rounded-full bg-green-700 hover:bg-green-800" onClick={() => servicesQuery.refetch()}>Try again</Button>}
            />
          </div>
        ) : services.length ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        ) : (
          <div className="mt-8">
            <EmptyState
              icon={Scissors}
              title="No services found"
              description="Try another category or search term."
              action={<Button variant="outline" className="rounded-full" asChild><Link to="/studios">Browse studios</Link></Button>}
            />
          </div>
        )}
      </section>
    </PageShell>
  );
};

export default MarketplaceServicesPage;
