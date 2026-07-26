import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import ConnectionHealthBanner from './components/storefront/ConnectionHealthBanner';
import GoogleSignInHost from './components/storefront/GoogleSignInHost';
import RouteFallback from './components/storefront/RouteFallback';
import ShopperAuthModal from './components/storefront/ShopperAuthModal';
import { ABS_MARKETING_SITE_URL } from './constants';
import { StorefrontModeProvider } from './context/StorefrontModeContext';
import { useStorefrontBackgroundPrefetch } from './hooks/useStorefrontBackgroundPrefetch';
import { useCustomDomainStore } from './hooks/useCustomDomainStore';
import {
  CheckoutRoute,
  CustomDomainStoreApp,
  RequireShopperAuth,
  singleStoreCommerceRouteElements,
  storePageRouteElements,
  TemplatesHostApp,
  templatesGalleryRouteElements,
} from './online-store/SingleStoreApp';

const MarketplaceHome = lazy(() => import('./pages/MarketplaceHome'));
const MarketplaceProductsPage = lazy(() => import('./pages/MarketplaceProductsPage'));
const MarketplaceStoresPage = lazy(() => import('./pages/MarketplaceStoresPage'));
const MarketplaceStudiosPage = lazy(() => import('./pages/MarketplaceStudiosPage'));
const MarketplaceServicesPage = lazy(() => import('./pages/MarketplaceServicesPage'));
const PublicStudioHome = lazy(() => import('./pages/PublicStudioHome'));
const PublicStudioService = lazy(() => import('./pages/PublicStudioService'));
const AboutPage = lazy(() => import('./pages/AboutPage'));

const ROUTER_FUTURE = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

const NavigateToStore = () => {
  const storeSlug = window.location.pathname.split('/')[2] || '';
  return <Navigate to={`/stores/${encodeURIComponent(storeSlug)}`} replace />;
};

const NavigateToProduct = () => {
  const [, , storeSlug, , productSlug] = window.location.pathname.split('/');
  return (
    <Navigate
      to={`/stores/${encodeURIComponent(storeSlug || '')}/products/${encodeURIComponent(productSlug || '')}`}
      replace
    />
  );
};

/** Legacy `/template/:slug` → `/shop/:slug` (bookmarks / old emails). */
const NavigateTemplateToShop = () => {
  const rest = window.location.pathname.replace(/^\/template(?=\/|$)/, '/shop');
  return <Navigate to={`${rest}${window.location.search}${window.location.hash}`} replace />;
};

/** Leave the storefront SPA for the ABS marketing site (external absolute URL). */
const RedirectToMarketing = () => {
  useEffect(() => {
    window.location.replace(ABS_MARKETING_SITE_URL);
  }, []);
  return (
    <div className="flex min-h-screen items-center justify-center bg-white text-sm text-gray-600">
      Redirecting…
    </div>
  );
};

/**
 * Shared-host Sabito marketplace + Online Store shop/gallery surfaces.
 * Marketplace discovery stays here; `/shop/:slug` and `/templates` use single-shop chrome via mode context.
 * On ABS Online Store host (`store.absghana.com`), `/` goes to marketing and bare `/shop`
 * is not forced into Sabito marketplace products.
 * @param {{ isAbsOnlineStoreHost?: boolean }} props
 */
function MarketplaceHostApp({ isAbsOnlineStoreHost = false }) {
  useStorefrontBackgroundPrefetch();

  return (
    <GoogleSignInHost>
      <ConnectionHealthBanner />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route
            path="/"
            element={isAbsOnlineStoreHost ? <RedirectToMarketing /> : <MarketplaceHome />}
          />
          <Route path="/stores" element={<MarketplaceStoresPage />} />
          <Route path="/studios" element={<MarketplaceStudiosPage />} />
          <Route path="/services" element={<MarketplaceServicesPage />} />
          <Route path="/foods" element={<MarketplaceProductsPage mode="foods" />} />
          <Route path="/studios/:studioSlug" element={<PublicStudioHome />} />
          <Route path="/studios/:studioSlug/services/:serviceSlug" element={<PublicStudioService />} />
          {storePageRouteElements('stores')}
          <Route path="/products" element={<MarketplaceProductsPage mode="products" />} />
          {/* Bare /shop: Sabito products alias; on ABS Online Store host keep Online Store surface */}
          <Route
            path="/shop"
            element={
              isAbsOnlineStoreHost
                ? <RedirectToMarketing />
                : <Navigate to="/products" replace />
            }
          />
          {storePageRouteElements('shop')}
          <Route path="/deals" element={<MarketplaceProductsPage mode="deals" />} />
          <Route path="/new-arrivals" element={<MarketplaceProductsPage mode="arrivals" />} />
          <Route path="/about-contact" element={<AboutPage />} />
          <Route path="/about" element={<Navigate to="/about-contact" replace />} />
          <Route path="/contact" element={<Navigate to="/about-contact" replace />} />
          {singleStoreCommerceRouteElements}
          <Route path="/marketplace" element={<Navigate to="/" replace />} />
          <Route path="/store" element={<Navigate to="/" replace />} />
          <Route path="/store/:storeSlug" element={<NavigateToStore />} />
          <Route path="/store/:storeSlug/products/:productSlug" element={<NavigateToProduct />} />
          {/* Legacy ABS path — redirect to /shop/:slug */}
          <Route
            path="/template"
            element={isAbsOnlineStoreHost ? <RedirectToMarketing /> : <Navigate to="/" replace />}
          />
          <Route path="/template/*" element={<NavigateTemplateToShop />} />
          {templatesGalleryRouteElements}
          <Route
            path="*"
            element={isAbsOnlineStoreHost ? <RedirectToMarketing /> : <Navigate to="/" replace />}
          />
        </Routes>
      </Suspense>
      <ShopperAuthModal />
    </GoogleSignInHost>
  );
}

function App() {
  const customDomain = useCustomDomainStore();

  if (customDomain.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-700 border-t-transparent" />
      </div>
    );
  }

  if (customDomain.isTemplatesHost) {
    return (
      <BrowserRouter future={ROUTER_FUTURE}>
        <StorefrontModeProvider isTemplatesHost forceMode="templates">
          <TemplatesHostApp />
        </StorefrontModeProvider>
      </BrowserRouter>
    );
  }

  if (customDomain.matched) {
    return (
      <BrowserRouter future={ROUTER_FUTURE}>
        <StorefrontModeProvider
          isCustomDomain
          customDomainSlug={customDomain.slug}
          forceMode="online-store"
        >
          <CustomDomainStoreApp
            slug={customDomain.slug}
            launched={customDomain.launched}
            displayName={customDomain.displayName}
          />
        </StorefrontModeProvider>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter future={ROUTER_FUTURE}>
      <StorefrontModeProvider isAbsOnlineStoreHost={customDomain.isAbsOnlineStoreHost}>
        <MarketplaceHostApp isAbsOnlineStoreHost={customDomain.isAbsOnlineStoreHost} />
      </StorefrontModeProvider>
    </BrowserRouter>
  );
}

export { CheckoutRoute, RequireShopperAuth };
export default App;
