import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Heart,
  Loader2,
  MessageCircle,
  Package,
  Search,
  ShoppingBag,
  ShoppingCart,
  Store,
  User,
} from 'lucide-react';

import storeService from '../services/storeService';
import { useCart } from '../context/CartContext';
import { useStorefrontAuth } from '../context/StorefrontAuthContext';
import { useWishlist } from '../context/WishlistContext';
import { buildProductsSearchPath } from '../utils/marketplaceSearch';
import { showSuccess } from '../utils/toast';
import {
  ActionLink,
  ProductImage,
  StoreLogo,
  StoreScopedFooter,
  getDiscountPercent,
} from '../components/storefront/StorefrontLayout';
import {
  ReviewList,
  ReviewSummaryLine,
  VerifiedReviewForm,
} from '../components/storefront/VerifiedReviewSection';
import { resolveImageUrl } from '../utils/fileUtils';
import { formatAmount } from '../utils/formatNumber';
import { showError } from '../utils/toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const unwrapData = (response) => response?.data?.data || response?.data || response;
const normalizePhone = (value) => String(value || '').replace(/[^\d]/g, '');

const buildContactHref = (store, product) => {
  const phone = normalizePhone(store?.whatsappNumber || store?.contactPhone);
  const message = `Hi, I am interested in ${product?.title || 'a product'} from ${store?.displayName || 'your store'}.`;
  if (phone) return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  if (store?.contactEmail) return `mailto:${store.contactEmail}`;
  return '';
};

const StoreScopedHeader = ({ store, product, onSearch }) => {
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
          <Button variant="outline" className="hidden rounded-full border-green-200 text-green-800 hover:bg-green-50 sm:inline-flex" asChild>
            <Link to={`/stores/${encodeURIComponent(store.slug)}`}>Store Home</Link>
          </Button>
        </div>
      </div>
    </header>
  );
};

const getAvailability = (product) => {
  const status = product?.availability?.status;
  const available = product?.available ?? status === 'in_stock';
  return {
    available: Boolean(available),
    label: product?.availability?.label || (available ? 'Available' : 'Out of stock'),
    message: product?.availability?.message || (available ? 'In stock' : 'Not available right now'),
  };
};

const PublicStoreProduct = () => {
  const { storeSlug, productSlug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addItem } = useCart();
  const { isAuthenticated, openShopperAuthModal } = useStorefrontAuth();
  const { isWishlisted, pendingListingIds, toggleWishlist } = useWishlist();
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const reviewSaleId = searchParams.get('saleId') || '';

  const handleSearch = useCallback((search) => {
    navigate(buildProductsSearchPath({ search, storeSlug }));
  }, [navigate, storeSlug]);

  const storeQuery = useQuery({
    queryKey: ['public-store', storeSlug],
    queryFn: () => storeService.getPublicStore(storeSlug),
    enabled: Boolean(storeSlug),
    retry: false,
  });

  const productsQuery = useQuery({
    queryKey: ['public-store-products', storeSlug],
    queryFn: () => storeService.getPublicStoreProducts(storeSlug),
    enabled: Boolean(storeSlug),
    retry: false,
  });

  const store = useMemo(() => unwrapData(storeQuery.data), [storeQuery.data]);
  const products = useMemo(() => {
    const response = productsQuery.data || {};
    return Array.isArray(response.data) ? response.data : [];
  }, [productsQuery.data]);
  const currency = productsQuery.data?.currency || store?.currency;
  const product = useMemo(
    () => products.find((item) => item.slug === productSlug || item.id === productSlug),
    [productSlug, products],
  );
  const availability = useMemo(() => getAvailability(product), [product]);
  const discount = getDiscountPercent(product);
  const saved = isWishlisted(product?.listingId || product?.id);
  const wishlistPending = pendingListingIds.includes(product?.listingId || product?.id);
  const galleryImages = useMemo(() => {
    const images = Array.isArray(product?.images) ? product.images : [];
    return [...new Set(images.map((image) => resolveImageUrl(image)).filter(Boolean))];
  }, [product?.images]);
  const coverImage = galleryImages[0] || null;
  const [selectedImage, setSelectedImage] = useState(null);
  const activeImage = selectedImage || coverImage;
  const hasMultipleImages = galleryImages.length > 1;

  const productReviewsQuery = useQuery({
    queryKey: ['product-reviews', product?.id],
    queryFn: () => storeService.getProductReviews(product.id),
    enabled: Boolean(product?.id),
    retry: false,
  });

  const productReviewEligibilityQuery = useQuery({
    queryKey: ['product-review-eligibility', product?.id, reviewSaleId, isAuthenticated],
    queryFn: () => {
      const params = {
        ...(reviewSaleId ? { saleId: reviewSaleId } : {}),
      };
      console.info('[reviews] fetching product review eligibility', {
        listingId: product.id,
        productSlug,
        storeSlug,
        saleId: reviewSaleId || null,
      });
      return storeService.getProductReviewEligibility(product.id, params);
    },
    enabled: Boolean(product?.id && isAuthenticated),
    retry: false,
  });

  const reviewPayload = useMemo(() => unwrapData(productReviewsQuery.data) || {}, [productReviewsQuery.data]);
  const reviewSummary = reviewPayload.summary || product?.reviewSummary || {
    rating: product?.rating || null,
    reviewsCount: product?.reviewsCount || 0,
    reviews: [],
  };
  const productReviews = useMemo(() => (
    Array.isArray(reviewPayload.reviews) ? reviewPayload.reviews : (reviewSummary.reviews || [])
  ), [reviewPayload.reviews, reviewSummary.reviews]);
  const reviewEligibility = useMemo(() => unwrapData(productReviewEligibilityQuery.data) || null, [productReviewEligibilityQuery.data]);

  useEffect(() => {
    setSelectedImage(coverImage);
  }, [coverImage]);

  useEffect(() => {
    if (!product?.id || window.location.hash !== '#reviews') return;
    window.requestAnimationFrame(() => {
      document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [product?.id, reviewEligibility?.eligible]);

  useEffect(() => {
    if (!product?.id || !isAuthenticated || productReviewEligibilityQuery.isLoading) return;
    console.info('[reviews] product review eligibility result', {
      listingId: product.id,
      saleId: reviewEligibility?.saleId || reviewSaleId || null,
      saleItemId: reviewEligibility?.saleItemId || null,
      eligible: reviewEligibility?.eligible === true,
      reason: reviewEligibility?.reason || null,
      hasExistingReview: Boolean(reviewEligibility?.existingReview),
    });
  }, [
    isAuthenticated,
    product?.id,
    productReviewEligibilityQuery.isLoading,
    reviewEligibility,
    reviewSaleId,
  ]);

  const handleGalleryStep = useCallback((direction) => {
    if (!hasMultipleImages) {
      return;
    }

    setSelectedImage((currentImage) => {
      const foundIndex = galleryImages.findIndex((imageUrl) => imageUrl === (currentImage || coverImage));
      const currentIndex = foundIndex >= 0 ? foundIndex : 0;
      const nextIndex = (currentIndex + direction + galleryImages.length) % galleryImages.length;
      return galleryImages[nextIndex];
    });
  }, [coverImage, galleryImages, hasMultipleImages]);

  const handlePurchaseIntent = useCallback(() => {
    addItem({ product, store, storeSlug, quantity: 1 });
    openShopperAuthModal({
      mode: 'signup',
      intent: {
        action: 'checkout',
        productId: product?.id,
        productSlug: product?.slug || productSlug,
        returnTo: `/stores/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(productSlug)}`,
        storeSlug,
      },
    });
  }, [addItem, openShopperAuthModal, product, productSlug, store, storeSlug]);

  const handleAddToCart = useCallback(() => {
    const result = addItem({ product, store, storeSlug, quantity: 1 });
    if (result.ok) {
      showSuccess(result.replacedStore
        ? 'Cart updated for this seller. Previous seller items were removed.'
        : 'Added to cart.');
    }
  }, [addItem, product, store, storeSlug]);

  const handleWishlistClick = useCallback(() => {
    toggleWishlist(product);
  }, [product, toggleWishlist]);

  const handleReviewAuth = useCallback(() => {
    openShopperAuthModal({
      mode: 'login',
      intent: {
        action: 'review',
        returnTo: `/stores/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(productSlug)}`,
      },
    });
  }, [openShopperAuthModal, productSlug, storeSlug]);

  const handleSubmitReview = useCallback(async (payload) => {
    if (!product?.id) return;
    setReviewSubmitting(true);
    try {
      console.info('[reviews] submitting product review', {
        listingId: product.id,
        saleId: payload?.saleId || reviewEligibility?.saleId || reviewSaleId || null,
        rating: payload?.rating,
        hasTitle: Boolean(payload?.title),
        hasComment: Boolean(payload?.comment),
      });
      await storeService.submitProductReview(product.id, payload);
      console.info('[reviews] product review submit success', {
        listingId: product.id,
        saleId: payload?.saleId || reviewEligibility?.saleId || reviewSaleId || null,
      });
      showSuccess('Product review saved.');
      await Promise.all([
        productReviewsQuery.refetch(),
        productReviewEligibilityQuery.refetch(),
        productsQuery.refetch(),
      ]);
    } catch (error) {
      console.error('[reviews] product review submit failed', {
        listingId: product.id,
        saleId: payload?.saleId || reviewEligibility?.saleId || reviewSaleId || null,
        status: error?.response?.status,
        errorCode: error?.response?.data?.errorCode,
        message: error?.response?.data?.message || error?.message,
      });
      showError(error, 'Could not save your review.');
    } finally {
      setReviewSubmitting(false);
    }
  }, [product?.id, productReviewEligibilityQuery, productReviewsQuery, productsQuery, reviewEligibility?.saleId, reviewSaleId]);

  const handleCheckoutClick = useCallback(() => {
    const result = addItem({ product, store, storeSlug, quantity: 1 });
    if (result.ok) {
      navigate('/checkout');
    }
  }, [addItem, navigate, product, store, storeSlug]);

  const whatsappHref = useMemo(() => {
    const phone = normalizePhone(store?.whatsappNumber || store?.contactPhone);
    const interest = availability.available ? 'interested in' : 'asking about restocking';
    const message = `Hi, I am ${interest} ${product?.title || 'this product'} from ${store?.displayName || 'your store'}.`;
    return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`;
  }, [availability.available, product?.title, store?.contactPhone, store?.displayName, store?.whatsappNumber]);

  if (storeQuery.isLoading || productsQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7f2]">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!store || !product) {
    return (
      <div className="min-h-screen bg-[#f4f7f2] text-slate-900">
        <main className="w-full px-4 py-12">
          <div className="mx-auto max-w-3xl">
            <Alert variant="destructive" className="mt-6">
              <Package className="h-4 w-4" />
              <AlertDescription>This product is not available right now.</AlertDescription>
            </Alert>
            <Button className="mt-4 rounded-full bg-green-700 hover:bg-green-800" asChild>
              <Link to={storeSlug ? `/stores/${encodeURIComponent(storeSlug)}` : '/stores'}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to store
              </Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7f2] text-slate-900">
      <StoreScopedHeader store={store} product={product} onSearch={handleSearch} />

      <main className="mx-auto w-full max-w-[1440px] px-3 py-6 sm:px-4 sm:py-8">
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link to={`/stores/${encodeURIComponent(storeSlug)}`} className="hover:text-green-800">{store.displayName}</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-slate-800">{product.title}</span>
        </div>

        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:rounded-[2rem]">
          <Link to={`/stores/${encodeURIComponent(storeSlug)}`} className="flex min-w-0 items-center gap-3 text-slate-900">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-green-50">
              {resolveImageUrl(store.logoUrl) ? (
                <img src={resolveImageUrl(store.logoUrl)} alt={store.displayName} className="h-full w-full object-contain p-1.5" />
              ) : (
                <Store className="h-5 w-5 text-green-700" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-500">Sold by</p>
              <h1 className="truncate text-xl font-black text-slate-950">{store.displayName}</h1>
            </div>
          </Link>
          <Badge variant="outline" className="border-green-200 bg-green-50 text-green-800">Published product</Badge>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white sm:rounded-[2rem]">
          <div className="grid gap-6 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:p-8">
            <div className="space-y-3">
              <div className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 sm:rounded-3xl">
                {activeImage ? (
                  <img
                    src={activeImage}
                    alt={product.title}
                    className="h-full w-full object-contain p-2 transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <ProductImage product={product} />
                )}
                {discount > 0 ? (
                  <Badge className="absolute left-4 top-4 border-0 bg-rose-500 text-white hover:bg-rose-500">-{discount}%</Badge>
                ) : null}
                {hasMultipleImages ? (
                  <>
                    <button
                      type="button"
                      className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/90 text-slate-800 backdrop-blur transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2 focus:ring-offset-white sm:h-11 sm:w-11"
                      onClick={() => handleGalleryStep(-1)}
                      aria-label="View previous product image"
                    >
                      <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/90 text-slate-800 backdrop-blur transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2 focus:ring-offset-white sm:h-11 sm:w-11"
                      onClick={() => handleGalleryStep(1)}
                      aria-label="View next product image"
                    >
                      <ChevronRight className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </>
                ) : null}
              </div>

              {hasMultipleImages ? (
                <div className="flex flex-nowrap gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {galleryImages.map((imageUrl, index) => {
                    const isSelected = imageUrl === activeImage;
                    return (
                      <button
                        key={imageUrl}
                        type="button"
                        className={`h-20 min-w-20 flex-none overflow-hidden rounded-2xl border bg-slate-50 transition sm:h-32 sm:min-w-32 ${
                          isSelected ? 'border-green-700 ring-2 ring-green-100' : 'border-slate-200 hover:border-green-300'
                        }`}
                        onClick={() => setSelectedImage(imageUrl)}
                        aria-current={isSelected ? 'true' : undefined}
                        aria-label={`View product image ${index + 1}`}
                      >
                        <img
                          src={imageUrl}
                          alt={`${product.title} thumbnail ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col justify-center space-y-5">
              <div>
                <Badge
                  className={availability.available
                    ? 'mb-3 border-0 bg-green-700 text-white hover:bg-green-700'
                    : 'mb-3 border-red-200 bg-red-50 text-red-700 hover:bg-red-50'}
                  variant={availability.available ? 'default' : 'outline'}
                >
                  {availability.label}
                </Badge>
                <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl md:text-4xl">{product.title}</h2>
                <div className="mt-3">
                  <ReviewSummaryLine summary={reviewSummary} />
                </div>
                {product.shortDescription ? (
                  <p className="mt-3 text-base leading-7 text-slate-500">{product.shortDescription}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-black text-green-800 sm:text-3xl">{formatAmount(product.publicPrice || 0, currency)}</span>
                {Number(product.compareAtPrice || 0) > 0 ? (
                  <span className="text-sm text-slate-400 line-through">{formatAmount(product.compareAtPrice, currency)}</span>
                ) : null}
              </div>

              <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {availability.message}
              </p>

              <div className="grid gap-3 sm:flex sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-full border-green-200 text-green-800 hover:bg-green-50 sm:w-auto"
                  onClick={handleWishlistClick}
                  disabled={wishlistPending}
                >
                  <Heart className={`mr-2 h-4 w-4 ${saved ? 'fill-current text-rose-600' : ''}`} />
                  {saved ? 'Saved to wishlist' : 'Save to wishlist'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-full border-green-200 text-green-800 hover:bg-green-50 sm:w-auto"
                  asChild
                >
                  <a href={whatsappHref} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    {availability.available ? 'Contact on WhatsApp' : 'Ask about restock on WhatsApp'}
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-full border-green-200 text-green-800 hover:bg-green-50 sm:w-auto"
                  disabled={!availability.available}
                  onClick={handleAddToCart}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Add to cart
                </Button>
                <Button
                  type="button"
                  className="w-full rounded-full bg-green-700 hover:bg-green-800 sm:w-auto"
                  onClick={isAuthenticated ? handleCheckoutClick : handlePurchaseIntent}
                  disabled={!availability.available}
                >
                  {isAuthenticated ? (
                    <>
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      Continue to checkout
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      Buy Now
                    </>
                  )}
                </Button>
              </div>

              {product.description ? (
                <div className="border-t border-slate-200 pt-5">
                  <h3 className="font-black text-slate-950">Product details</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">{product.description}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <section id="reviews" className="mt-8 grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:rounded-[2rem] md:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-green-800">Product reviews</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">Verified shopper feedback</h2>
            </div>
            <ReviewSummaryLine summary={reviewSummary} />
          </div>
          <VerifiedReviewForm
            eligibility={reviewEligibility}
            isAuthenticated={isAuthenticated}
            isEligibilityLoading={productReviewEligibilityQuery.isLoading}
            isSubmitting={reviewSubmitting}
            onRequireAuth={handleReviewAuth}
            onSubmit={handleSubmitReview}
            targetLabel={product.title}
          />
          <ReviewList reviews={productReviews} emptyText="No verified product reviews yet." />
        </section>
      </main>
      <StoreScopedFooter store={store} contactHref={whatsappHref} />
    </div>
  );
};

export default PublicStoreProduct;
