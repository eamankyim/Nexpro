import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, MessageCircle, Package, Store } from 'lucide-react';

import storeService from '../services/storeService';
import { resolveImageUrl } from '../utils/fileUtils';
import { formatAmount } from '../utils/formatNumber';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const unwrapData = (response) => response?.data?.data || response?.data || response;

const normalizePhone = (value) => String(value || '').replace(/[^\d]/g, '');

const PublicStoreProduct = () => {
  const { storeSlug, productSlug } = useParams();

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

  const imageUrl = resolveImageUrl(product?.images?.[0]);
  const whatsappHref = useMemo(() => {
    const phone = normalizePhone(store?.whatsappNumber || store?.contactPhone);
    const message = `Hi, I am interested in ${product?.title || 'this product'} from ${store?.displayName || 'your store'}.`;
    return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`;
  }, [product?.title, store?.contactPhone, store?.displayName, store?.whatsappNumber]);

  if (storeQuery.isLoading || productsQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!store || !product) {
    return (
      <div className="min-h-screen bg-muted/30 px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <Button type="button" variant="ghost" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Alert variant="destructive">
            <Package className="h-4 w-4" />
            <AlertDescription>This product is not available right now.</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted">
              <Store className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Online store</p>
              <h1 className="text-xl font-semibold">{store.displayName}</h1>
            </div>
          </div>
          <Badge variant="outline">Published product</Badge>
        </div>

        <Card className="border border-border">
          <CardContent className="grid gap-6 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:p-6">
            <div className="aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
              {imageUrl ? (
                <img src={imageUrl} alt={product.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                  <Package className="mb-2 h-10 w-10" />
                  <span>Product image</span>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center space-y-5">
              <div>
                <Badge className="mb-3 bg-green-700 text-white hover:bg-green-700">Available</Badge>
                <h2 className="text-3xl font-semibold tracking-tight">{product.title}</h2>
                {product.shortDescription ? (
                  <p className="mt-3 text-base leading-7 text-muted-foreground">{product.shortDescription}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-3xl font-semibold text-green-800">{formatAmount(product.publicPrice || 0, currency)}</span>
                {Number(product.compareAtPrice || 0) > 0 ? (
                  <span className="text-sm text-muted-foreground line-through">{formatAmount(product.compareAtPrice, currency)}</span>
                ) : null}
              </div>

              <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                {product.inventoryPolicy === 'continue' ? 'Available for order' : 'Availability confirmed by the store'}
              </p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" className="bg-green-700 hover:bg-green-800" asChild>
                  <a href={whatsappHref} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Contact on WhatsApp
                  </a>
                </Button>
              </div>

              {product.description ? (
                <div className="border-t border-border pt-5">
                  <h3 className="font-semibold">Product details</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{product.description}</p>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PublicStoreProduct;
