import { useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  Info,
  Loader2,
  Package,
  Pencil,
  Share2,
  ShoppingBag,
  Store,
  Warehouse,
} from 'lucide-react';

import productService from '../services/productService';
import storeService from '../services/storeService';
import { resolveImageUrl } from '../utils/fileUtils';
import { formatAmount, formatInteger } from '../utils/formatNumber';
import { showError, showSuccess } from '../utils/toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const unwrapData = (response) => response?.data?.data || response?.data || response;

const getOrigin = () => {
  if (typeof window === 'undefined') return '';
  return window.location.origin.replace(/\/$/, '');
};

const normalizePhone = (value) => String(value || '').replace(/[^\d]/g, '');

const buildPublicProductUrl = (settings, listing) => {
  const storeSlug = settings?.slug;
  const productSlug = listing?.slug || listing?.id;
  if (!storeSlug || !productSlug) return '';
  return `${getOrigin()}/store/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(productSlug)}`;
};

const getStockText = (listing, product) => {
  if (listing?.inventoryPolicy === 'continue') return 'Available for order';
  if (product?.trackStock === false) return 'Availability confirmed after order';
  return `${formatInteger(product?.quantityOnHand || 0)} ${product?.unit || 'pcs'} available`;
};

const LiveProductPreview = ({ listing, product, settings }) => {
  const imageUrl = resolveImageUrl(listing?.images?.[0] || product?.imageUrl);
  const title = listing?.title || product?.name || 'Published product';
  const description = listing?.shortDescription || listing?.description || product?.description || 'Product details will appear here.';
  const compareAtPrice = Number(listing?.compareAtPrice || 0);

  return (
    <Card className="border border-border lg:sticky lg:top-4">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Live product preview</CardTitle>
            <CardDescription>No wishlist or reviews are shown for the MVP.</CardDescription>
          </div>
          <Badge className="bg-green-700 text-white hover:bg-green-700">Live</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-2xl border border-border bg-background p-3">
          <div className="aspect-square overflow-hidden rounded-xl border border-border bg-muted">
            {imageUrl ? (
              <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                <Package className="mb-2 h-9 w-9" />
                <span className="text-sm">Product image</span>
              </div>
            )}
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="outline">{settings?.displayName || 'Online store'}</Badge>
              <Badge variant="outline">{listing?.status || 'published'}</Badge>
            </div>
            <div>
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-semibold text-green-800">{formatAmount(listing?.publicPrice || product?.sellingPrice || 0)}</span>
              {compareAtPrice > 0 ? (
                <span className="text-sm text-muted-foreground line-through">{formatAmount(compareAtPrice)}</span>
              ) : null}
            </div>
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {getStockText(listing, product)}
            </p>
            <Button type="button" className="w-full bg-green-700 hover:bg-green-800">
              Add to cart
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const StoreListingPublished = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const stateProduct = location.state?.product;
  const stateListing = location.state?.listing;

  const productQuery = useQuery({
    queryKey: ['products', productId],
    queryFn: () => productService.getProductById(productId),
    enabled: Boolean(productId && !stateProduct?.id),
  });

  const listingQuery = useQuery({
    queryKey: ['store', 'listing', 'product', productId],
    queryFn: () => storeService.getListingForProduct(productId),
    enabled: Boolean(productId),
  });

  const setupQuery = useQuery({
    queryKey: ['store', 'setup-status'],
    queryFn: () => storeService.getSetupStatus(),
  });

  const product = useMemo(() => stateProduct || unwrapData(productQuery.data), [productQuery.data, stateProduct]);
  const listing = useMemo(() => unwrapData(listingQuery.data) || stateListing, [listingQuery.data, stateListing]);
  const settings = useMemo(() => {
    const setup = unwrapData(setupQuery.data);
    return setup?.settings || null;
  }, [setupQuery.data]);

  const publicProductUrl = useMemo(() => buildPublicProductUrl(settings, listing), [listing, settings]);
  const whatsappShareUrl = useMemo(() => {
    const message = `Hi, I just published ${listing?.title || product?.name || 'this product'} online. View it here: ${publicProductUrl}`;
    const phone = normalizePhone(settings?.whatsappNumber || settings?.contactPhone);
    const phonePath = phone ? `/${phone}` : '';
    return `https://wa.me${phonePath}?text=${encodeURIComponent(message)}`;
  }, [listing?.title, product?.name, publicProductUrl, settings?.contactPhone, settings?.whatsappNumber]);

  const handleCopy = useCallback(async () => {
    if (!publicProductUrl) {
      showError('Set up your store URL before copying the product link.');
      return;
    }
    try {
      await navigator.clipboard.writeText(publicProductUrl);
      showSuccess('Product link copied');
    } catch (error) {
      showError('Could not copy the product link');
    }
  }, [publicProductUrl]);

  const handleViewProduct = useCallback(() => {
    if (!publicProductUrl) {
      showError('Set up your store URL before viewing the product.');
      return;
    }
    window.open(publicProductUrl, '_blank', 'noopener,noreferrer');
  }, [publicProductUrl]);

  const handleShareWhatsApp = useCallback(() => {
    if (!publicProductUrl) {
      showError('Set up your store URL before sharing the product.');
      return;
    }
    window.open(whatsappShareUrl, '_blank', 'noopener,noreferrer');
  }, [publicProductUrl, whatsappShareUrl]);

  const isLoading = productQuery.isLoading || listingQuery.isLoading || setupQuery.isLoading;
  const nextSteps = useMemo(() => ([
    {
      title: 'Share product',
      description: 'Send the public link to customers on WhatsApp, social media, or SMS.',
      icon: Share2,
    },
    {
      title: 'Manage inventory',
      description: 'Keep stock levels accurate so published availability stays reliable.',
      icon: Warehouse,
    },
    {
      title: 'View orders',
      description: 'Track incoming online orders from the store orders page.',
      icon: ShoppingBag,
    },
  ]), []);

  if (isLoading && !listing) {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="ghost" className="-ml-3" onClick={() => navigate('/products')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to products
        </Button>
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertDescription>We could not find this product listing. It may have been removed or you may not have access.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <Button type="button" variant="ghost" className="-ml-3" onClick={() => navigate('/products')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to products
      </Button>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
        <Card className="order-1 border border-green-200 bg-green-50/60 lg:col-start-1">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-green-200 bg-white text-green-700">
                  <CheckCircle2 className="h-7 w-7" />
                </span>
                <div>
                  <Badge className="mb-3 bg-green-700 text-white hover:bg-green-700">Published</Badge>
                  <CardTitle className="text-2xl">Product published successfully</CardTitle>
                  <CardDescription className="mt-2 text-green-900/70">
                    {listing.title || product?.name || 'Your product'} is now ready to share with customers.
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="order-2 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <LiveProductPreview listing={listing} product={product} settings={settings} />
        </div>

        <div className="order-3 space-y-6 lg:col-start-1 lg:row-start-2">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle>Share your product</CardTitle>
              <CardDescription>Copy the product URL or open the live page to confirm it looks right.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="published-product-url">Product URL</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="published-product-url"
                    readOnly
                    value={publicProductUrl || 'Store URL is not available yet'}
                    className="bg-white"
                  />
                  <Button type="button" variant="outline" className="w-full bg-white sm:w-auto" onClick={handleCopy}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy link
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button type="button" className="w-full bg-green-700 hover:bg-green-800" onClick={handleViewProduct}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Product
                </Button>
                <Button type="button" variant="outline" className="w-full bg-white" onClick={handleShareWhatsApp}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share on WhatsApp
                </Button>
                <Button type="button" variant="outline" className="w-full bg-white" asChild>
                  <Link to={`/store/listings/${productId}/edit`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit listing
                  </Link>
                </Button>
                <Button type="button" variant="outline" className="w-full bg-white" asChild>
                  <Link to="/products">
                    <Store className="mr-2 h-4 w-4" />
                    Publish another product
                  </Link>
                </Button>
                <Button type="button" variant="outline" className="w-full bg-white" asChild>
                  <Link to="/products">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to products
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardHeader>
              <CardTitle>What&apos;s next?</CardTitle>
              <CardDescription>Keep momentum after publishing this product.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {nextSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="rounded-xl border border-border bg-background p-4">
                    <Icon className="h-5 w-5 text-green-700" />
                    <h3 className="mt-3 font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.description}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Alert className="border-amber-200 bg-amber-50 text-amber-950">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Search engines and shared link previews can take a little while to index new product pages.
              The product link is ready to share now.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
};

export default StoreListingPublished;
