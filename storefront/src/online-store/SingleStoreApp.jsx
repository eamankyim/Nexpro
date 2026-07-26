import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';

import ComingSoonPage from '../pages/ComingSoonPage';
import CustomDomainPendingPage from '../pages/CustomDomainPendingPage';
import ConnectionHealthBanner from '../components/storefront/ConnectionHealthBanner';
import GoogleSignInHost from '../components/storefront/GoogleSignInHost';
import RouteFallback from '../components/storefront/RouteFallback';
import ShopperAuthModal from '../components/storefront/ShopperAuthModal';
import { useStorefrontAuth } from '../context/StorefrontAuthContext';
import { useStorefrontMode } from '../context/StorefrontModeContext';

const CartPage = lazy(() => import('../pages/CartPage'));
const CheckoutPage = lazy(() => import('../pages/CheckoutPage'));
const CheckoutPaystackCallbackPage = lazy(() => import('../pages/CheckoutPaystackCallbackPage'));
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage'));
const OrderSuccessPage = lazy(() => import('../pages/OrderSuccessPage'));
const PublicStoreHome = lazy(() => import('../pages/PublicStoreHome'));
const PublicStoreProduct = lazy(() => import('../pages/PublicStoreProduct'));
const PublicStudioService = lazy(() => import('../pages/PublicStudioService'));
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage'));
const ShopperAccountDashboard = lazy(() => import('../pages/ShopperAccountDashboard'));
const ShopperAddressesPage = lazy(() => import('../pages/ShopperAddressesPage'));
const ShopperOrderDetailPage = lazy(() => import('../pages/ShopperOrderDetailPage'));
const ShopperOrdersPage = lazy(() => import('../pages/ShopperOrdersPage'));
const ShopperProfilePage = lazy(() => import('../pages/ShopperProfilePage'));
const ShopperWishlistPage = lazy(() => import('../pages/ShopperWishlistPage'));
const StorefrontAuthPage = lazy(() => import('../pages/StorefrontAuthPage'));
const TemplatesGallery = lazy(() => import('../pages/TemplatesGallery'));
const TemplatePreview = lazy(() => import('../pages/TemplatePreview'));
const TrackOrderPage = lazy(() => import('../pages/TrackOrderPage'));

const withRouteSuspense = (element) => (
  <Suspense fallback={<RouteFallback />}>{element}</Suspense>
);

export const CheckoutRoute = () => {
  const location = useLocation();
  const { isAuthenticated, isLoading, openShopperAuthModal } = useStorefrontAuth();
  const { isSingleStoreMode } = useStorefrontMode();
  const returnTo = `${location.pathname}${location.search || ''}`;

  useEffect(() => {
    // Online Store uses full /signup under OnlineStorePageShell (store footer).
    if (isLoading || isAuthenticated || isSingleStoreMode) return;
    openShopperAuthModal({
      mode: 'signup',
      intent: {
        action: 'checkout',
        returnTo,
      },
    });
  }, [isAuthenticated, isLoading, isSingleStoreMode, openShopperAuthModal, returnTo]);

  if (isLoading) {
    return <ComingSoonPage type="auth-loading" />;
  }

  if (!isAuthenticated) {
    if (isSingleStoreMode) {
      return (
        <Navigate
          to={`/signup?returnTo=${encodeURIComponent(returnTo)}`}
          replace
          state={{ returnTo }}
        />
      );
    }
    return <ComingSoonPage type="checkout-auth-required" />;
  }

  return withRouteSuspense(<CheckoutPage />);
};

export const RequireShopperAuth = ({ children }) => {
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

/** Shopper + commerce routes shared by Online Store surfaces (no marketplace discovery). */
export const singleStoreCommerceRouteElements = [
  <Route key="track-order" path="/track-order" element={withRouteSuspense(<TrackOrderPage />)} />,
  <Route key="cart" path="/cart" element={withRouteSuspense(<CartPage />)} />,
  <Route key="checkout" path="/checkout" element={<CheckoutRoute />} />,
  <Route key="checkout-paystack" path="/checkout/paystack-callback" element={<RequireShopperAuth>{withRouteSuspense(<CheckoutPaystackCallbackPage />)}</RequireShopperAuth>} />,
  <Route key="checkout-success" path="/checkout/success/:id" element={<RequireShopperAuth>{withRouteSuspense(<OrderSuccessPage />)}</RequireShopperAuth>} />,
  <Route key="login" path="/login" element={withRouteSuspense(<StorefrontAuthPage />)} />,
  <Route key="signup" path="/signup" element={withRouteSuspense(<StorefrontAuthPage />)} />,
  <Route key="verify-email" path="/verify-email" element={withRouteSuspense(<StorefrontAuthPage />)} />,
  <Route key="forgot-password" path="/forgot-password" element={withRouteSuspense(<ForgotPasswordPage />)} />,
  <Route key="reset-password" path="/reset-password" element={withRouteSuspense(<ResetPasswordPage />)} />,
  <Route key="account" path="/account" element={<RequireShopperAuth>{withRouteSuspense(<ShopperAccountDashboard />)}</RequireShopperAuth>} />,
  <Route key="account-orders" path="/account/orders" element={<RequireShopperAuth>{withRouteSuspense(<ShopperOrdersPage />)}</RequireShopperAuth>} />,
  <Route key="account-order" path="/account/orders/:id" element={<RequireShopperAuth>{withRouteSuspense(<ShopperOrderDetailPage />)}</RequireShopperAuth>} />,
  <Route key="account-wishlist" path="/account/wishlist" element={<RequireShopperAuth>{withRouteSuspense(<ShopperWishlistPage />)}</RequireShopperAuth>} />,
  <Route key="account-addresses" path="/account/addresses" element={<RequireShopperAuth>{withRouteSuspense(<ShopperAddressesPage />)}</RequireShopperAuth>} />,
  <Route key="account-profile" path="/account/profile" element={<RequireShopperAuth>{withRouteSuspense(<ShopperProfilePage />)}</RequireShopperAuth>} />,
];

/** Live store page routes under a path prefix (`stores` marketplace or `shop` Online Store). */
export const storePageRouteElements = (prefix) => [
  <Route key={`${prefix}-home`} path={`/${prefix}/:storeSlug`} element={withRouteSuspense(<PublicStoreHome />)} />,
  <Route key={`${prefix}-products`} path={`/${prefix}/:storeSlug/products`} element={withRouteSuspense(<PublicStoreHome />)} />,
  <Route key={`${prefix}-services`} path={`/${prefix}/:storeSlug/services`} element={withRouteSuspense(<PublicStoreHome />)} />,
  <Route key={`${prefix}-categories`} path={`/${prefix}/:storeSlug/categories`} element={withRouteSuspense(<PublicStoreHome />)} />,
  <Route key={`${prefix}-about`} path={`/${prefix}/:storeSlug/about`} element={withRouteSuspense(<PublicStoreHome />)} />,
  <Route key={`${prefix}-reviews`} path={`/${prefix}/:storeSlug/reviews`} element={withRouteSuspense(<PublicStoreHome />)} />,
  <Route key={`${prefix}-product`} path={`/${prefix}/:storeSlug/products/:productSlug`} element={withRouteSuspense(<PublicStoreProduct />)} />,
  <Route key={`${prefix}-service`} path={`/${prefix}/:storeSlug/services/:serviceSlug`} element={withRouteSuspense(<PublicStudioService />)} />,
];

export const templatesGalleryRouteElements = [
  <Route key="templates" path="/templates" element={withRouteSuspense(<TemplatesGallery />)} />,
  <Route key="templates-preview" path="/templates/:templateId/preview" element={withRouteSuspense(<TemplatePreview />)} />,
  <Route key="templates-preview-tenant" path="/templates/:templateId/preview-tenant" element={withRouteSuspense(<TemplatePreview />)} />,
];

/**
 * Template gallery host only — never mounts marketplace discovery routes.
 */
export function TemplatesHostApp() {
  useEffect(() => {
    document.title = 'ABS Online Store — Templates';
  }, []);

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<TemplatesGallery />} />
        {templatesGalleryRouteElements}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

/**
 * Custom-domain Online Store: one merchant, store-scoped chrome only.
 * @param {{ slug: string, launched: boolean, displayName?: string|null }} props
 */
export function CustomDomainStoreApp({ slug, launched, displayName }) {
  useEffect(() => {
    document.title = displayName ? `${displayName} — Online Store` : 'Online Store';
  }, [displayName]);

  if (!launched || !slug) {
    return <CustomDomainPendingPage displayName={displayName} />;
  }

  return (
    <GoogleSignInHost>
      <ConnectionHealthBanner />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to={`/stores/${slug}`} replace />} />
          <Route path="/products" element={<Navigate to={`/stores/${slug}/products`} replace />} />
          <Route path="/services" element={<Navigate to={`/stores/${slug}/services`} replace />} />
          <Route path="/categories" element={<Navigate to={`/stores/${slug}/categories`} replace />} />
          <Route path="/about-contact" element={<Navigate to={`/stores/${slug}/about`} replace />} />
          <Route path="/about" element={<Navigate to={`/stores/${slug}/about`} replace />} />
          <Route path="/contact" element={<Navigate to={`/stores/${slug}/about`} replace />} />
          <Route path="/reviews" element={<Navigate to={`/stores/${slug}/reviews`} replace />} />
          <Route path="/shop" element={<Navigate to={`/stores/${slug}`} replace />} />
          <Route path="/shop/:storeSlug" element={<Navigate to={`/stores/${slug}`} replace />} />
          <Route path="/template" element={<Navigate to={`/stores/${slug}`} replace />} />
          <Route path="/template/:storeSlug" element={<Navigate to={`/stores/${slug}`} replace />} />
          {storePageRouteElements('stores')}
          {singleStoreCommerceRouteElements}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <ShopperAuthModal />
    </GoogleSignInHost>
  );
}
