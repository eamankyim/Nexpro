import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import AboutPage from './pages/AboutPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import CheckoutPaystackCallbackPage from './pages/CheckoutPaystackCallbackPage';
import ComingSoonPage from './pages/ComingSoonPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import MarketplaceHome from './pages/MarketplaceHome';
import MarketplaceProductsPage from './pages/MarketplaceProductsPage';
import MarketplaceStoresPage from './pages/MarketplaceStoresPage';
import MarketplaceStudiosPage from './pages/MarketplaceStudiosPage';
import MarketplaceServicesPage from './pages/MarketplaceServicesPage';
import PublicStudioHome from './pages/PublicStudioHome';
import PublicStudioService from './pages/PublicStudioService';
import OrderSuccessPage from './pages/OrderSuccessPage';
import PublicStoreHome from './pages/PublicStoreHome';
import PublicStoreProduct from './pages/PublicStoreProduct';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ShopperAccountDashboard from './pages/ShopperAccountDashboard';
import ShopperAddressesPage from './pages/ShopperAddressesPage';
import ShopperOrderDetailPage from './pages/ShopperOrderDetailPage';
import ShopperOrdersPage from './pages/ShopperOrdersPage';
import ShopperProfilePage from './pages/ShopperProfilePage';
import ShopperWishlistPage from './pages/ShopperWishlistPage';
import StorefrontAuthPage from './pages/StorefrontAuthPage';
import TrackOrderPage from './pages/TrackOrderPage';
import ConnectionHealthBanner from './components/storefront/ConnectionHealthBanner';
import GoogleSignInHost from './components/storefront/GoogleSignInHost';
import ShopperAuthModal from './components/storefront/ShopperAuthModal';
import CustomDomainPendingPage from './pages/CustomDomainPendingPage';
import { useStorefrontAuth } from './context/StorefrontAuthContext';
import { useStorefrontBackgroundPrefetch } from './hooks/useStorefrontBackgroundPrefetch';
import { useCustomDomainStore } from './hooks/useCustomDomainStore';

function App() {
  useStorefrontBackgroundPrefetch();
  const customDomain = useCustomDomainStore();

  if (customDomain.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-700 border-t-transparent" />
      </div>
    );
  }

  // "Online Store" custom domain: single-store mode, no marketplace discovery/chrome.
  // `/stores/:storeSlug/*` below already renders a fully store-scoped page (its own
  // header/footer, no marketplace nav) — we just route top-level paths into it.
  if (customDomain.matched) {
    const slug = customDomain.slug;
    if (!customDomain.launched || !slug) {
      return (
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <CustomDomainPendingPage displayName={customDomain.displayName} />
        </BrowserRouter>
      );
    }

    return (
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <GoogleSignInHost>
        <ConnectionHealthBanner />
        <Routes>
          <Route path="/" element={<Navigate to={`/stores/${slug}`} replace />} />
          <Route path="/products" element={<Navigate to={`/stores/${slug}/products`} replace />} />
          <Route path="/services" element={<Navigate to={`/stores/${slug}/services`} replace />} />
          <Route path="/categories" element={<Navigate to={`/stores/${slug}/categories`} replace />} />
          <Route path="/about-contact" element={<Navigate to={`/stores/${slug}/about`} replace />} />
          <Route path="/about" element={<Navigate to={`/stores/${slug}/about`} replace />} />
          <Route path="/contact" element={<Navigate to={`/stores/${slug}/about`} replace />} />
          <Route path="/reviews" element={<Navigate to={`/stores/${slug}/reviews`} replace />} />
          <Route path="/stores/:storeSlug" element={<PublicStoreHome />} />
          <Route path="/stores/:storeSlug/products" element={<PublicStoreHome />} />
          <Route path="/stores/:storeSlug/services" element={<PublicStoreHome />} />
          <Route path="/stores/:storeSlug/categories" element={<PublicStoreHome />} />
          <Route path="/stores/:storeSlug/about" element={<PublicStoreHome />} />
          <Route path="/stores/:storeSlug/reviews" element={<PublicStoreHome />} />
          <Route path="/stores/:storeSlug/products/:productSlug" element={<PublicStoreProduct />} />
          <Route path="/stores/:storeSlug/services/:serviceSlug" element={<PublicStudioService />} />
          <Route path="/track-order" element={<TrackOrderPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutRoute />} />
          <Route path="/checkout/paystack-callback" element={<RequireShopperAuth><CheckoutPaystackCallbackPage /></RequireShopperAuth>} />
          <Route path="/checkout/success/:id" element={<RequireShopperAuth><OrderSuccessPage /></RequireShopperAuth>} />
          <Route path="/login" element={<StorefrontAuthPage />} />
          <Route path="/signup" element={<StorefrontAuthPage />} />
          <Route path="/verify-email" element={<StorefrontAuthPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/account" element={<RequireShopperAuth><ShopperAccountDashboard /></RequireShopperAuth>} />
          <Route path="/account/orders" element={<RequireShopperAuth><ShopperOrdersPage /></RequireShopperAuth>} />
          <Route path="/account/orders/:id" element={<RequireShopperAuth><ShopperOrderDetailPage /></RequireShopperAuth>} />
          <Route path="/account/wishlist" element={<RequireShopperAuth><ShopperWishlistPage /></RequireShopperAuth>} />
          <Route path="/account/addresses" element={<RequireShopperAuth><ShopperAddressesPage /></RequireShopperAuth>} />
          <Route path="/account/profile" element={<RequireShopperAuth><ShopperProfilePage /></RequireShopperAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ShopperAuthModal />
        </GoogleSignInHost>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <GoogleSignInHost>
      <ConnectionHealthBanner />
      <Routes>
        <Route path="/" element={<MarketplaceHome />} />
        <Route path="/stores" element={<MarketplaceStoresPage />} />
        <Route path="/studios" element={<MarketplaceStudiosPage />} />
        <Route path="/services" element={<MarketplaceServicesPage />} />
        <Route path="/foods" element={<MarketplaceProductsPage mode="foods" />} />
        <Route path="/studios/:studioSlug" element={<PublicStudioHome />} />
        <Route path="/studios/:studioSlug/services/:serviceSlug" element={<PublicStudioService />} />
        <Route path="/stores/:storeSlug" element={<PublicStoreHome />} />
        <Route path="/stores/:storeSlug/products" element={<PublicStoreHome />} />
        <Route path="/stores/:storeSlug/services" element={<PublicStoreHome />} />
        <Route path="/stores/:storeSlug/categories" element={<PublicStoreHome />} />
        <Route path="/stores/:storeSlug/about" element={<PublicStoreHome />} />
        <Route path="/stores/:storeSlug/reviews" element={<PublicStoreHome />} />
        <Route path="/stores/:storeSlug/products/:productSlug" element={<PublicStoreProduct />} />
        <Route path="/stores/:storeSlug/services/:serviceSlug" element={<PublicStudioService />} />
        <Route path="/products" element={<MarketplaceProductsPage mode="products" />} />
        <Route path="/shop" element={<Navigate to="/products" replace />} />
        <Route path="/deals" element={<MarketplaceProductsPage mode="deals" />} />
        <Route path="/new-arrivals" element={<MarketplaceProductsPage mode="arrivals" />} />
        <Route path="/about-contact" element={<AboutPage />} />
        <Route path="/about" element={<Navigate to="/about-contact" replace />} />
        <Route path="/contact" element={<Navigate to="/about-contact" replace />} />
        <Route path="/track-order" element={<TrackOrderPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutRoute />} />
        <Route path="/checkout/paystack-callback" element={<RequireShopperAuth><CheckoutPaystackCallbackPage /></RequireShopperAuth>} />
        <Route path="/checkout/success/:id" element={<RequireShopperAuth><OrderSuccessPage /></RequireShopperAuth>} />
        <Route path="/login" element={<StorefrontAuthPage />} />
        <Route path="/signup" element={<StorefrontAuthPage />} />
        <Route path="/verify-email" element={<StorefrontAuthPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/account" element={<RequireShopperAuth><ShopperAccountDashboard /></RequireShopperAuth>} />
        <Route path="/account/orders" element={<RequireShopperAuth><ShopperOrdersPage /></RequireShopperAuth>} />
        <Route path="/account/orders/:id" element={<RequireShopperAuth><ShopperOrderDetailPage /></RequireShopperAuth>} />
        <Route path="/account/wishlist" element={<RequireShopperAuth><ShopperWishlistPage /></RequireShopperAuth>} />
        <Route path="/account/addresses" element={<RequireShopperAuth><ShopperAddressesPage /></RequireShopperAuth>} />
        <Route path="/account/profile" element={<RequireShopperAuth><ShopperProfilePage /></RequireShopperAuth>} />
        <Route path="/marketplace" element={<Navigate to="/" replace />} />
        <Route path="/store" element={<Navigate to="/" replace />} />
        <Route path="/store/:storeSlug" element={<NavigateToStore />} />
        <Route path="/store/:storeSlug/products/:productSlug" element={<NavigateToProduct />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ShopperAuthModal />
      </GoogleSignInHost>
    </BrowserRouter>
  );
}

const CheckoutRoute = () => {
  const location = useLocation();
  const { isAuthenticated, isLoading, openShopperAuthModal } = useStorefrontAuth();
  const returnTo = `${location.pathname}${location.search || ''}`;

  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    openShopperAuthModal({
      mode: 'signup',
      intent: {
        action: 'checkout',
        returnTo,
      },
    });
  }, [isAuthenticated, isLoading, openShopperAuthModal, returnTo]);

  if (isLoading) {
    return <ComingSoonPage type="auth-loading" />;
  }

  if (!isAuthenticated) {
    return <ComingSoonPage type="checkout-auth-required" />;
  }

  return <CheckoutPage />;
};

const RequireShopperAuth = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useStorefrontAuth();

  if (isLoading) {
    return <ComingSoonPage type="auth-loading" />;
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search || ''}`;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace state={{ returnTo }} />;
  }

  return children;
};

const NavigateToStore = () => {
  const storeSlug = window.location.pathname.split('/')[2] || '';
  return <Navigate to={`/stores/${encodeURIComponent(storeSlug)}`} replace />;
};

const NavigateToProduct = () => {
  const [, , storeSlug, , productSlug] = window.location.pathname.split('/');
  return <Navigate to={`/stores/${encodeURIComponent(storeSlug || '')}/products/${encodeURIComponent(productSlug || '')}`} replace />;
};

export default App;
