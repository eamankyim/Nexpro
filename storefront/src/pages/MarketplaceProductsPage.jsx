import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package, Sparkles, Tag } from 'lucide-react';

import storeService from '../services/storeService';
import { mergeWithDefaultCategories } from '../utils/categoryImages';
import {
  Breadcrumbs,
  EmptyState,
  LoadingState,
  PageShell,
  ProductCard,
  SectionHeader,
  extractList,
  getDiscountPercent,
  getPublishedTime,
} from '../components/storefront/StorefrontLayout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const pageCopy = {
  products: {
    activePath: '/products',
    eyebrow: 'Products',
    title: 'All marketplace products',
    description: 'Shop everyday essentials from Sabito sellers and checkout securely.',
    emptyTitle: 'No products found yet',
    emptyDescription: 'Try another search or category. Products appear here when launched stores publish their public catalogs.',
    icon: Package,
  },
  foods: {
    activePath: '/foods',
    eyebrow: 'Foods',
    title: 'Foods and groceries',
    description: 'Shop food, drinks, pantry items, and grocery essentials from Sabito sellers.',
    emptyTitle: 'No foods found yet',
    emptyDescription: 'Food and grocery listings will appear here when sellers publish matching products.',
    icon: Package,
  },
  deals: {
    activePath: '/deals',
    eyebrow: 'Deals',
    title: 'Live marketplace deals',
    description: 'Find current offers and savings from Sabito sellers.',
    emptyTitle: 'No live deals yet',
    emptyDescription: 'Sabito Store will show discounted products here automatically when sellers publish real offers.',
    icon: Tag,
  },
  arrivals: {
    activePath: '/new-arrivals',
    eyebrow: 'New Arrivals',
    title: 'Freshly published products',
    description: 'See the newest products from public Sabito storefronts, sorted by publish date where available.',
    emptyTitle: 'No new arrivals yet',
    emptyDescription: 'Recently published products will appear here as sellers update their storefront catalogs.',
    icon: Sparkles,
  },
};

const FOOD_KEYWORDS = ['food', 'foods', 'grocery', 'groceries', 'drink', 'drinks', 'beverage', 'beverages', 'pantry', 'supermarket'];

const getProductSearchText = (product) => [
  product?.title,
  product?.name,
  product?.category,
  product?.categoryName,
  product?.category?.name,
  product?.category?.slug,
  product?.store?.shopType,
  product?.store?.businessType,
].filter(Boolean).join(' ').toLowerCase();

const isFoodProduct = (product) => {
  const searchText = getProductSearchText(product);
  return FOOD_KEYWORDS.some((keyword) => searchText.includes(keyword));
};

const MarketplaceProductsPage = ({ mode = 'products' }) => {
  const copy = pageCopy[mode] || pageCopy.products;
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const activeSearch = searchParams.get('search') || '';
  const activeCategory = searchParams.get('category') || 'all';
  const activeStoreSlug = searchParams.get('storeSlug') || '';

  const categoriesQuery = useQuery({
    queryKey: ['marketplace', 'categories'],
    queryFn: () => storeService.getMarketplaceCategories(),
    retry: false,
  });

  const productsQuery = useQuery({
    queryKey: ['marketplace', 'products', mode, activeSearch, activeCategory, activeStoreSlug],
    queryFn: () => storeService.getMarketplaceProducts({
      search: activeSearch,
      category: activeCategory === 'all' ? undefined : activeCategory,
      storeSlug: activeStoreSlug || undefined,
      limit: 48,
    }),
    retry: false,
  });

  const categories = useMemo(() => (
    mergeWithDefaultCategories(extractList(categoriesQuery.data))
  ), [categoriesQuery.data]);
  const apiProducts = useMemo(() => extractList(productsQuery.data), [productsQuery.data]);
  const products = useMemo(() => {
    if (mode === 'deals') return apiProducts.filter((product) => getDiscountPercent(product) > 0);
    if (mode === 'arrivals') {
      return [...apiProducts]
        .filter((product) => getPublishedTime(product) > 0)
        .sort((first, second) => getPublishedTime(second) - getPublishedTime(first));
    }
    if (mode === 'foods' && activeCategory === 'all') return apiProducts.filter(isFoodProduct);
    return apiProducts;
  }, [activeCategory, apiProducts, mode]);

  const handleCategoryChange = useCallback((nextCategory) => {
    const nextParams = new URLSearchParams();
    if (activeSearch) nextParams.set('search', activeSearch);
    if (nextCategory && nextCategory !== 'all') nextParams.set('category', nextCategory);
    if (activeStoreSlug) nextParams.set('storeSlug', activeStoreSlug);
    setSearchParams(nextParams);
    setMobileFiltersOpen(false);
  }, [activeSearch, activeStoreSlug, setSearchParams]);

  const handleClearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams());
    setMobileFiltersOpen(false);
  }, [setSearchParams]);

  const filterControls = (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-2 sm:flex-row sm:items-center sm:justify-between sm:rounded-3xl">
      <Select value={activeCategory} onValueChange={handleCategoryChange}>
        <SelectTrigger className="h-12 min-h-12 w-full rounded-full border-0 bg-white px-5 font-semibold text-slate-700 shadow-none focus:ring-green-700 sm:max-w-xs">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((item) => (
            <SelectItem key={item.id || item.name} value={item.name}>{item.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" className="h-12 w-full rounded-full border-green-200 px-6 font-bold text-green-800 hover:bg-green-50 sm:w-auto" onClick={handleClearFilters}>
        Clear filters
      </Button>
    </div>
  );

  return (
    <PageShell
      activePath={copy.activePath}
      headerProps={{
        showSearchFilterButton: true,
        onSearchFilterClick: () => setMobileFiltersOpen((current) => !current),
        searchFiltersOpen: mobileFiltersOpen,
        searchFiltersContent: filterControls,
      }}
    >
      <Breadcrumbs items={[{ label: copy.title }]} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:rounded-[2rem] md:p-8">
        <SectionHeader
          eyebrow={(
            <span className="flex items-center justify-between gap-3">
              <span>{copy.eyebrow}</span>
              <span className="rounded-full border border-green-100 bg-green-50 px-3 py-1 text-xs font-bold normal-case tracking-normal text-green-800 sm:hidden">
                {products.length ? `${products.length} live listings` : 'API-backed listings'}
              </span>
            </span>
          )}
          title={copy.title}
          description={copy.description}
          action={<p className="hidden rounded-full border border-green-100 bg-green-50 px-3 py-1.5 text-center text-xs font-bold text-green-800 sm:block sm:text-sm">{products.length ? `${products.length} live listings` : 'API-backed listings'}</p>}
        />

        <div className="mt-6 hidden sm:block">
          {filterControls}
        </div>

        {productsQuery.isLoading ? (
          <div className="mt-8">
            <LoadingState label="Loading marketplace products..." />
          </div>
        ) : products.length ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="mt-8">
            <EmptyState
              icon={copy.icon}
              title={copy.emptyTitle}
              description={copy.emptyDescription}
              action={(
                <div className="flex flex-col justify-center gap-3 sm:flex-row">
                  <Button variant="outline" className="rounded-full border-green-200 text-green-800 hover:bg-green-50" asChild>
                    <Link to="/stores">Browse stores</Link>
                  </Button>
                  <Button className="rounded-full bg-green-700 hover:bg-green-800" asChild>
                    <Link to="/products">View all products</Link>
                  </Button>
                </div>
              )}
            />
          </div>
        )}
      </section>
    </PageShell>
  );
};

export default MarketplaceProductsPage;
