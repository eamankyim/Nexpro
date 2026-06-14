import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Loader2,
  Mail,
  MessageCircle,
  Package,
  Phone,
  Scissors,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Star,
  Store,
  Truck,
  User,
} from 'lucide-react';

import storeService from '../services/storeService';
import { useCart } from '../context/CartContext';
import { useStorefrontAuth } from '../context/StorefrontAuthContext';
import { getCategoryImageUrl } from '../utils/categoryImages';
import { buildProductsSearchPath, buildServicesSearchPath } from '../utils/marketplaceSearch';
import {
  ActionLink,
  getStoreServiceUrl,
  ProductCard,
  ServiceCard,
  StoreScopedFooter,
  StoreLogo,
  unwrapData,
} from '../components/storefront/StorefrontLayout';
import {
  ReviewList,
  ReviewSummaryLine,
  VerifiedReviewForm,
} from '../components/storefront/VerifiedReviewSection';
import { resolveStoreBannerImageUrl } from '../utils/fileUtils';
import { formatAmount, formatInteger } from '../utils/formatNumber';
import { showError, showSuccess } from '../utils/toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const normalizePhone = (value) => String(value || '').replace(/[^\d]/g, '');
const cleanContactValue = (value) => String(value || '').trim();

const buildContactHref = (store) => {
  const phone = normalizePhone(store?.whatsappNumber || store?.contactPhone);
  if (phone) {
    return `https://wa.me/${phone}?text=${encodeURIComponent(`Hi, I would like to contact ${store?.displayName || 'your store'}.`)}`;
  }
  const email = cleanContactValue(store?.contactEmail);
  if (email) return `mailto:${email}`;
  return '';
};

const buildPublicContactDetails = (store) => {
  const phone = cleanContactValue(store?.contactPhone);
  const whatsapp = cleanContactValue(store?.whatsappNumber);
  const email = cleanContactValue(store?.contactEmail);
  const phoneDigits = normalizePhone(phone);
  const whatsappDigits = normalizePhone(whatsapp);

  return {
    phone: phone ? { label: phone, href: phoneDigits ? `tel:${phoneDigits}` : '' } : null,
    whatsapp: whatsapp && whatsappDigits && whatsappDigits !== phoneDigits
      ? {
        label: whatsapp,
        href: `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Hi, I would like to contact ${store?.displayName || 'your store'}.`)}`,
      }
      : null,
    email: email ? { label: email, href: `mailto:${email}` } : null,
  };
};

const getProductUrl = (storeSlug, product) => {
  const productSlug = product?.slug || product?.id;
  return storeSlug && productSlug ? `/stores/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(productSlug)}` : '/products';
};

const uniqueById = (...lists) => {
  const seen = new Set();
  return lists.flat().filter((item) => {
    const key = item?.id || item?.slug;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const resolveStorePage = (pathname = '') => {
  if (pathname.endsWith('/categories')) return 'categories';
  if (pathname.endsWith('/about')) return 'about';
  if (pathname.endsWith('/reviews')) return 'reviews';
  if (pathname.endsWith('/products')) return 'catalog';
  if (pathname.endsWith('/services')) return 'catalog';
  return 'home';
};

const StoreScopedHeader = ({ store, onSearch }) => {
  const [searchText, setSearchText] = useState('');
  const { cartSummary } = useCart();
  const { isAuthenticated, openShopperAuthModal } = useStorefrontAuth();
  const cartCount = cartSummary.itemCount ? String(cartSummary.itemCount) : null;

  const handleSubmit = useCallback((event) => {
    event.preventDefault();
    onSearch(searchText.trim());
  }, [onSearch, searchText]);

  const handleSignIn = useCallback(() => {
    openShopperAuthModal({
      mode: 'login',
      intent: {
        action: 'store',
        returnTo: `${window.location.pathname}${window.location.search || ''}`,
      },
    });
  }, [openShopperAuthModal]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-3 py-3 sm:px-4 lg:flex-row lg:items-center">
        <Link to={`/stores/${encodeURIComponent(store.slug)}`} className="flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <StoreLogo store={store} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-lg font-black text-slate-950 sm:text-xl">{store.displayName}</span>
            <span className="block truncate text-xs font-semibold uppercase tracking-[0.16em] text-green-700">Official Store</span>
          </span>
        </Link>

        <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 overflow-hidden rounded-full border border-slate-200 bg-slate-50 p-1">
          <Input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder={`Search ${store.displayName}`}
            className="h-11 min-h-11 border-0 bg-transparent px-4 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Button type="submit" size="icon" className="h-11 min-h-11 w-11 shrink-0 rounded-full bg-green-700 hover:bg-green-800" aria-label={`Search ${store.displayName}`}>
            <Search className="h-5 w-5" />
          </Button>
        </form>

        <div className="flex shrink-0 gap-2">
          <ActionLink to="/cart" icon={ShoppingCart} label="Cart" badge={cartCount} />
          {isAuthenticated ? (
            <Button className="rounded-full bg-green-700 hover:bg-green-800" asChild>
              <Link to="/account">
                <User className="mr-2 h-4 w-4" />
                Account
              </Link>
            </Button>
          ) : (
            <Button type="button" className="rounded-full bg-green-700 hover:bg-green-800" onClick={handleSignIn}>
              <User className="mr-2 h-4 w-4" />
              Sign in/Register
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

const ProductSection = ({ storeName, title, description, products, emptyText, sectionId = 'products' }) => (
  <section id={sectionId} className="space-y-5">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-green-800">{storeName}</p>
        <h2 className="mt-1 text-2xl font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
    </div>
    {products.length ? (
      <div className="grid gap-4 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    ) : (
      <div className="rounded-2xl border border-border bg-background p-8 text-center text-muted-foreground">
        {emptyText}
      </div>
    )}
  </section>
);

const ServiceSection = ({ storeName, storeSlug, title, description, services, emptyText, sectionId = 'services' }) => (
  <section id={sectionId} className="space-y-5">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-green-800">{storeName}</p>
        <h2 className="mt-1 text-2xl font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
    </div>
    {services.length ? (
      <div className="grid gap-4 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
        {services.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            serviceUrl={getStoreServiceUrl(storeSlug, service)}
          />
        ))}
      </div>
    ) : (
      <div className="rounded-2xl border border-border bg-background p-8 text-center text-muted-foreground">
        {emptyText}
      </div>
    )}
  </section>
);

const PublicStoreHome = () => {
  const { storeSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, openShopperAuthModal } = useStorefrontAuth();
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const storeQuery = useQuery({
    queryKey: ['marketplace-store-home', storeSlug],
    queryFn: () => storeService.getMarketplaceStoreHome(storeSlug),
    enabled: Boolean(storeSlug),
    retry: false,
  });

  const data = useMemo(() => unwrapData(storeQuery.data) || {}, [storeQuery.data]);
  const store = data.store || null;
  const isServiceStore = store?.storeMode === 'studio';
  const productCategories = useMemo(() => (Array.isArray(data.categories) ? data.categories : []), [data.categories]);
  const serviceCategories = useMemo(() => (Array.isArray(data.serviceCategories) ? data.serviceCategories : []), [data.serviceCategories]);
  const categories = isServiceStore ? serviceCategories : productCategories;
  const featuredProducts = useMemo(() => Array.isArray(data.featuredProducts) ? data.featuredProducts : [], [data.featuredProducts]);
  const secondaryProducts = useMemo(() => Array.isArray(data.secondaryProducts) ? data.secondaryProducts : [], [data.secondaryProducts]);
  const featuredServices = useMemo(() => Array.isArray(data.featuredServices) ? data.featuredServices : [], [data.featuredServices]);
  const secondaryServices = useMemo(() => Array.isArray(data.secondaryServices) ? data.secondaryServices : [], [data.secondaryServices]);
  const allProducts = useMemo(() => (
    Array.isArray(data.products) ? data.products : uniqueById(featuredProducts, secondaryProducts)
  ), [data.products, featuredProducts, secondaryProducts]);
  const allServices = useMemo(() => (
    Array.isArray(data.services) ? data.services : uniqueById(featuredServices, secondaryServices)
  ), [data.services, featuredServices, secondaryServices]);
  const reviews = useMemo(() => Array.isArray(data.reviews) ? data.reviews : [], [data.reviews]);
  const stats = store?.stats || {};
  const currency = store?.currency;
  const bannerUrl = resolveStoreBannerImageUrl(store);
  const contactHref = useMemo(() => buildContactHref(store), [store]);
  const publicContactDetails = useMemo(() => buildPublicContactDetails(store), [store]);
  const hasPublicContactDetails = Boolean(
    publicContactDetails.phone || publicContactDetails.whatsapp || publicContactDetails.email
  );
  const promo = data.promotionalBanner || store?.promo || null;
  const activePage = resolveStorePage(location.pathname);

  const storeReviewsQuery = useQuery({
    queryKey: ['store-reviews', storeSlug],
    queryFn: () => storeService.getStoreReviews(storeSlug),
    enabled: Boolean(storeSlug && store),
    retry: false,
  });

  const storeReviewEligibilityQuery = useQuery({
    queryKey: ['store-review-eligibility', storeSlug, isAuthenticated],
    queryFn: () => storeService.getStoreReviewEligibility(storeSlug),
    enabled: Boolean(storeSlug && store && isAuthenticated),
    retry: false,
  });

  const storeReviewPayload = useMemo(() => unwrapData(storeReviewsQuery.data) || {}, [storeReviewsQuery.data]);
  const storeReviewSummary = storeReviewPayload.summary || {
    rating: stats.rating || null,
    reviewsCount: stats.reviewsCount || 0,
    reviews,
  };
  const storeReviewList = useMemo(() => (
    Array.isArray(storeReviewPayload.reviews) ? storeReviewPayload.reviews : reviews
  ), [storeReviewPayload.reviews, reviews]);
  const storeReviewEligibility = useMemo(() => unwrapData(storeReviewEligibilityQuery.data) || null, [storeReviewEligibilityQuery.data]);

  const trustBadges = useMemo(() => ([
    ...(stats.positiveReviewsPercent ? [{
      label: `${stats.positiveReviewsPercent}% positive reviews`,
      icon: Star,
    }] : []),
    ...(store?.deliveryEnabled ? [{
      label: 'Delivery available',
      icon: Truck,
    }] : []),
    { label: 'Secure payments', icon: ShieldCheck },
  ]), [stats.positiveReviewsPercent, store?.deliveryEnabled]);

  const handleSearch = useCallback((search) => {
    if (isServiceStore) {
      navigate(buildServicesSearchPath({ search, studioSlug: storeSlug }));
      return;
    }
    navigate(buildProductsSearchPath({ search, storeSlug }));
  }, [isServiceStore, navigate, storeSlug]);

  const handleFollowStore = useCallback(() => {
    showSuccess('Following stores is coming soon.');
  }, []);

  const handleReviewAuth = useCallback(() => {
    openShopperAuthModal({
      mode: 'login',
      intent: {
        action: 'review',
        returnTo: `/stores/${encodeURIComponent(storeSlug)}`,
      },
    });
  }, [openShopperAuthModal, storeSlug]);

  const handleSubmitStoreReview = useCallback(async (payload) => {
    setReviewSubmitting(true);
    try {
      await storeService.submitStoreReview(storeSlug, payload);
      showSuccess('Store review saved.');
      await Promise.all([
        storeReviewsQuery.refetch(),
        storeReviewEligibilityQuery.refetch(),
        storeQuery.refetch(),
      ]);
    } catch (error) {
      showError(error, 'Could not save your store review.');
    } finally {
      setReviewSubmitting(false);
    }
  }, [storeQuery, storeReviewEligibilityQuery, storeReviewsQuery, storeSlug]);

  if (storeQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-[#f4f7f2] text-slate-900">
        <main className="w-full px-4 py-12">
          <div className="mx-auto max-w-3xl">
            <Alert variant="destructive">
              <Store className="h-4 w-4" />
              <AlertDescription>This store is not available right now.</AlertDescription>
            </Alert>
            <Button className="mt-4 bg-green-700 hover:bg-green-800" asChild>
              <Link to="/stores">Back to stores</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const storeBasePath = `/stores/${encodeURIComponent(storeSlug)}`;
  const catalogPath = isServiceStore ? `${storeBasePath}/services` : `${storeBasePath}/products`;
  const navItems = [
    { key: 'home', label: 'Store Home', to: storeBasePath },
    { key: 'catalog', label: isServiceStore ? 'All Services' : 'All Products', to: catalogPath },
    { key: 'categories', label: 'Categories', to: `${storeBasePath}/categories` },
    { key: 'about', label: 'About Us', to: `${storeBasePath}/about` },
    { key: 'reviews', label: 'Reviews', to: `${storeBasePath}/reviews` },
  ];
  const storeCatalog = isServiceStore ? allServices : allProducts;
  const navLinkClass = (key) => (
    `whitespace-nowrap border-b-2 px-1 py-2 transition-colors ${
      activePage === key
        ? 'border-green-700 text-green-800'
        : 'border-transparent text-slate-700 hover:border-green-200 hover:text-green-800'
    }`
  );
  const categoryLinkFor = (category) => (
    isServiceStore
      ? buildServicesSearchPath({ category: category.name, studioSlug: storeSlug })
      : buildProductsSearchPath({ category: category.name, storeSlug })
  );

  const categoriesCard = (
    <Card id="categories" className="border border-border">
      <CardContent className="p-5">
        <h2 className="text-lg font-semibold">{isServiceStore ? 'Browse by Category' : 'Shop by Category'}</h2>
        <div className="mt-4 grid gap-2">
          {categories.length ? categories.map((category) => {
            const imageUrl = getCategoryImageUrl(category);
            return (
              <Link
                key={category.id || category.name}
                to={categoryLinkFor(category)}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2 text-sm transition-colors hover:border-green-200 hover:bg-green-50"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-green-100 bg-gradient-to-br from-green-50 to-amber-50 text-green-800">
                    {imageUrl ? (
                      <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      isServiceStore ? <Scissors className="h-4 w-4" /> : <Package className="h-4 w-4" />
                    )}
                  </span>
                  <span className="truncate">{category.name}</span>
                </span>
                <Badge variant="outline" className="shrink-0">{formatInteger(category.count || 0)}</Badge>
              </Link>
            );
          }) : (
            <p className="text-sm text-muted-foreground">
              {isServiceStore
                ? 'Categories appear when services are categorized.'
                : 'Categories appear when products are categorized.'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const aboutCard = (
    <Card id="about" className="border border-border">
      <CardContent className="p-5">
        <h2 className="text-lg font-semibold">About Store</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {store.description || (
            isServiceStore
              ? `${store.displayName} has launched a public service catalog.`
              : `${store.displayName} has launched a public product catalog.`
          )}
        </p>
        <div className="mt-4 grid gap-2 text-sm">
          <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-700" /> Published store</span>
          {isServiceStore ? (
            <span className="inline-flex items-center gap-2">
              <Scissors className="h-4 w-4 text-green-700" />
              {formatInteger(stats.serviceCount || 0)} services
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Package className="h-4 w-4 text-green-700" />
              {formatInteger(stats.productCount || 0)} products
            </span>
          )}
          {publicContactDetails.phone ? (
            <a className="inline-flex min-w-0 items-center gap-2 text-green-800 hover:text-green-900" href={publicContactDetails.phone.href || undefined}>
              <Phone className="h-4 w-4 text-green-700" />
              <span className="truncate">{publicContactDetails.phone.label}</span>
            </a>
          ) : null}
          {publicContactDetails.whatsapp ? (
            <a className="inline-flex min-w-0 items-center gap-2 text-green-800 hover:text-green-900" href={publicContactDetails.whatsapp.href} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4 text-green-700" />
              <span className="truncate">WhatsApp: {publicContactDetails.whatsapp.label}</span>
            </a>
          ) : null}
          {publicContactDetails.email ? (
            <a className="inline-flex min-w-0 items-center gap-2 text-green-800 hover:text-green-900" href={publicContactDetails.email.href}>
              <Mail className="h-4 w-4 text-green-700" />
              <span className="truncate">{publicContactDetails.email.label}</span>
            </a>
          ) : null}
          {!hasPublicContactDetails ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4 text-green-700" />
              Contact details not published
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );

  const deliveryCard = (store.freeDeliveryThreshold || store.deliveryEnabled) ? (
    <Card className="border border-green-200 bg-green-50/60">
      <CardContent className="p-5">
        <Truck className="h-6 w-6 text-green-800" />
        <h2 className="mt-3 text-lg font-semibold text-green-950">Delivery Options</h2>
        <p className="mt-2 text-sm leading-6 text-green-950/70">
          {store.freeDeliveryThreshold
            ? `Free delivery from ${formatAmount(store.freeDeliveryThreshold, currency)}.`
            : 'Delivery is available where the store can fulfill orders.'}
        </p>
      </CardContent>
    </Card>
  ) : null;

  const trustSection = (
    <section className="border-y border-border bg-muted/20">
      <div className="grid w-full gap-3 px-3 py-6 sm:px-4 md:grid-cols-4">
        {[
          isServiceStore
            ? { title: 'Professional Services', description: `Offered by ${store.displayName}`, icon: Scissors }
            : { title: 'Genuine Products', description: `Published by ${store.displayName}`, icon: ShieldCheck },
          isServiceStore
            ? { title: 'Request Quotes', description: 'Get pricing before you book', icon: MessageCircle }
            : { title: 'Fast Delivery', description: store.deliveryEnabled ? 'Delivery available from this store' : 'Fulfillment managed by the store', icon: Truck },
          { title: 'Secure Payments', description: 'Protected checkout options', icon: CreditCard },
          isServiceStore
            ? { title: 'Trusted Support', description: 'Store-managed service follow-up', icon: RotateCcw }
            : { title: 'Easy Returns', description: 'Store-managed support', icon: RotateCcw },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="rounded-2xl border border-border bg-background p-4">
              <Icon className="h-6 w-6 text-green-800" />
              <p className="mt-3 font-semibold">{item.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );

  const reviewsSection = (
    <section id="reviews" className="w-full px-3 py-10 sm:px-4 sm:py-12">
      <div className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:rounded-3xl md:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-green-800">Customer Reviews</p>
            <h2 className="mt-1 text-2xl font-semibold">Verified store feedback</h2>
          </div>
          <ReviewSummaryLine summary={storeReviewSummary} />
        </div>
        <VerifiedReviewForm
          eligibility={storeReviewEligibility}
          isAuthenticated={isAuthenticated}
          isEligibilityLoading={storeReviewEligibilityQuery.isLoading}
          isSubmitting={reviewSubmitting}
          onRequireAuth={handleReviewAuth}
          onSubmit={handleSubmitStoreReview}
          targetLabel={store.displayName}
        />
        <ReviewList reviews={storeReviewList} emptyText="No verified store reviews yet." />
      </div>
    </section>
  );

  const catalogSection = isServiceStore ? (
    <section className="w-full px-3 py-8 sm:px-4 sm:py-10">
      <ServiceSection
        storeName={store.displayName}
        storeSlug={storeSlug}
        title="All Services"
        description="Browse every published service from this store."
        services={storeCatalog}
        emptyText="This store has not published services yet."
      />
    </section>
  ) : (
    <section className="w-full px-3 py-8 sm:px-4 sm:py-10">
      <ProductSection
        storeName={store.displayName}
        title="All Products"
        description="Browse every published product from this store."
        products={storeCatalog}
        emptyText="This store has not published products yet."
      />
    </section>
  );

  const homeContent = (
    <>
      <section className="grid w-full gap-6 px-3 py-8 sm:px-4 sm:py-10 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-5">
          {categoriesCard}
          {aboutCard}
          {deliveryCard}
        </aside>

        <div className="space-y-10">
          {promo ? (
            <section className="rounded-2xl border border-green-200 bg-green-950 p-6 text-white sm:rounded-3xl md:p-8">
              <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-green-100">Featured Promo</p>
                  <h2 className="mt-2 text-3xl font-semibold">{promo.title || 'Featured offer'}</h2>
                  <p className="mt-3 max-w-2xl text-green-50/80">{promo.description || 'Explore current featured products from this store.'}</p>
                </div>
                {promo.product ? (
                  <Button className="w-full bg-white text-green-950 hover:bg-green-50 md:w-auto" asChild>
                    <Link to={getProductUrl(storeSlug, promo.product)}>View deal</Link>
                  </Button>
                ) : null}
              </div>
            </section>
          ) : null}

          {isServiceStore ? (
            <>
              <ServiceSection
                storeName={store.displayName}
                storeSlug={storeSlug}
                title="Featured Services"
                description="Services published by this store and sorted by storefront priority."
                services={featuredServices}
                emptyText="This store has not published featured services yet."
              />
              <ServiceSection
                storeName={store.displayName}
                storeSlug={storeSlug}
                sectionId="more-services"
                title="More Services"
                description="Latest services published by this store."
                services={secondaryServices}
                emptyText="No additional services are available right now."
              />
            </>
          ) : (
            <>
              <ProductSection
                storeName={store.displayName}
                title="Featured Products"
                description="Products published by this store and sorted by storefront priority."
                products={featuredProducts}
                emptyText="This store has not published featured products yet."
              />
              <ProductSection
                storeName={store.displayName}
                title={data.secondaryProductsLabel || 'New Arrivals'}
                description={data.secondaryProductsLabel === 'Best Selling Products' ? 'Ranked from recorded sales for this store.' : 'Latest products published by this store.'}
                products={secondaryProducts}
                emptyText="No additional products are available right now."
              />
            </>
          )}
        </div>
      </section>
      {trustSection}
    </>
  );

  const categoriesPage = (
    <section className="w-full px-3 py-8 sm:px-4 sm:py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:rounded-3xl md:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-green-800">{store.displayName}</p>
        <h2 className="mt-1 text-2xl font-semibold">Categories</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isServiceStore ? 'Browse service categories from this store.' : 'Browse product categories from this store.'}
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.length ? categories.map((category) => {
            const imageUrl = getCategoryImageUrl(category);
            return (
              <Link
                key={category.id || category.name}
                to={categoryLinkFor(category)}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-green-200 hover:bg-green-50"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-green-100 bg-white text-green-800">
                    {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : (
                      isServiceStore ? <Scissors className="h-5 w-5" /> : <Package className="h-5 w-5" />
                    )}
                  </span>
                  <span className="truncate font-semibold text-slate-950">{category.name}</span>
                </span>
                <Badge variant="outline" className="shrink-0">{formatInteger(category.count || 0)}</Badge>
              </Link>
            );
          }) : (
            <p className="text-sm text-muted-foreground">
              {isServiceStore ? 'No service categories are published yet.' : 'No product categories are published yet.'}
            </p>
          )}
        </div>
      </div>
    </section>
  );

  const aboutPage = (
    <section className="grid w-full gap-6 px-3 py-8 sm:px-4 sm:py-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      {aboutCard}
      <aside className="space-y-5">
        {categoriesCard}
        {deliveryCard}
      </aside>
    </section>
  );

  const pageContent = activePage === 'catalog'
    ? catalogSection
    : activePage === 'categories'
      ? categoriesPage
      : activePage === 'about'
        ? aboutPage
        : activePage === 'reviews'
          ? reviewsSection
          : homeContent;

  const listingLabel = isServiceStore
    ? `${formatInteger(stats.serviceCount || 0)} services`
    : `${formatInteger(stats.productCount || 0)} products`;

  const fullHeroSection = (
    <section className="relative z-0 border-b border-green-100 bg-gradient-to-br from-green-50 via-white to-amber-50">
      <div className="w-full px-3 py-6 sm:px-4 sm:py-8">
        <div className="rounded-2xl border border-border bg-background sm:rounded-3xl">
          <div className="relative h-48 overflow-hidden border-b border-border sm:h-64 md:h-72">
            {bannerUrl ? (
              <img
                src={bannerUrl}
                alt={`${store.displayName} banner`}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#22c55e33,transparent_35%),linear-gradient(135deg,#052e16,#166534)]" />
            )}
          </div>

          <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:p-8">
            <div className="flex flex-col gap-5 sm:flex-row">
              <div className="relative z-10 -mt-16 flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white sm:rounded-3xl">
                <StoreLogo store={store} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="min-w-0 text-2xl font-bold tracking-tight text-green-950 sm:text-3xl md:text-4xl">{store.displayName}</h1>
                  <Badge className="bg-green-700 text-white hover:bg-green-700">
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    Verified Store
                  </Badge>
                </div>
                <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
                  {store.description || (
                    isServiceStore
                      ? `Browse published services from ${store.displayName}.`
                      : `Browse published products from ${store.displayName}.`
                  )}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {trustBadges.map((badge) => {
                    const Icon = badge.icon;
                    return (
                      <Badge key={badge.label} variant="outline" className="gap-1.5 rounded-full border-green-100 bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-800">
                        <Icon className="h-3.5 w-3.5" />
                        {badge.label}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:flex sm:flex-row sm:flex-wrap lg:justify-end">
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={handleFollowStore}>Follow Store</Button>
              <Button type="button" className="w-full bg-green-700 hover:bg-green-800 sm:w-auto" disabled={!contactHref} asChild={Boolean(contactHref)}>
                {contactHref ? (
                  <a href={contactHref} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Contact Store
                  </a>
                ) : (
                  <span>Contact Store</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  const compactSummarySection = (
    <section className="border-b border-border bg-white">
      <div className="flex w-full flex-col gap-4 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white sm:h-16 sm:w-16">
            <StoreLogo store={store} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-bold text-green-950 sm:text-xl">{store.displayName}</h1>
              <Badge className="bg-green-700 text-white hover:bg-green-700">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Verified
              </Badge>
            </div>
            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
              {store.category || listingLabel}
              {store.category ? ` · ${listingLabel}` : ''}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={handleFollowStore}>Follow</Button>
          <Button type="button" size="sm" className="rounded-full bg-green-700 hover:bg-green-800" disabled={!contactHref} asChild={Boolean(contactHref)}>
            {contactHref ? (
              <a href={contactHref} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-1.5 h-4 w-4" />
                Contact
              </a>
            ) : (
              <span>Contact</span>
            )}
          </Button>
        </div>
      </div>
    </section>
  );

  return (
    <div className="min-h-screen bg-[#f4f7f2] text-slate-900">
      <StoreScopedHeader store={store} onSearch={handleSearch} />

      <main>
        <div className="mx-auto w-full max-w-[1440px] px-3 pt-5 sm:px-4 sm:pt-6">
        <section className="bg-muted/20">
          <div className="flex w-full items-center justify-between gap-4 px-3 py-3 text-sm text-muted-foreground sm:px-4">
            <div className="min-w-0">
              <Link to="/stores" className="hover:text-green-800">Stores</Link>
              <ChevronRight className="mx-2 inline h-4 w-4" />
              <span className="font-medium text-foreground">{store.displayName}</span>
            </div>
            <Link to="/" className="shrink-0 font-semibold text-green-800 hover:text-green-900">
              Sabito
            </Link>
          </div>
        </section>
        </div>

        <nav className="sticky top-[73px] z-40 border-b border-border bg-background/95 backdrop-blur sm:top-[81px]">
          <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3 overflow-x-auto px-6 py-3 text-sm font-medium sm:gap-5 sm:px-8">
            {navItems.map((item) => (
              <Link key={item.key} to={item.to} className={navLinkClass(item.key)}>
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="mx-auto w-full max-w-[1440px] px-3 pb-5 sm:px-4 sm:pb-6">
        {activePage === 'home' ? fullHeroSection : compactSummarySection}

        {pageContent}

        </div>
      </main>
      <StoreScopedFooter store={store} isServiceStore={isServiceStore} contactHref={contactHref} />
    </div>
  );
};

export default PublicStoreHome;
