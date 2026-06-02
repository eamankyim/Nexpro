import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { EyeOff, Loader2, Package, Pencil, RefreshCw } from 'lucide-react';
import storeService from '../services/storeService';
import { showError, showSuccess, getErrorMessage } from '../utils/toast';
import { formatAmount } from '../utils/formatNumber';
import { resolveImageUrl } from '../utils/fileUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const StoreListings = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const queryParams = useMemo(() => ({
    limit: 100,
    ...(status !== 'all' ? { status } : {}),
  }), [status]);

  const { data: response, isLoading, refetch } = useQuery({
    queryKey: ['store', 'listings', queryParams],
    queryFn: () => storeService.getListings(queryParams),
  });

  const listings = useMemo(() => {
    const body = response?.data ? response : response || {};
    return Array.isArray(body.data) ? body.data : [];
  }, [response]);

  const handlePublishToggle = useCallback(async (listing) => {
    setBusyId(listing.id);
    try {
      if (listing.status === 'published') {
        await storeService.unpublishListing(listing.id);
        showSuccess('Listing hidden from store');
      } else {
        const response = await storeService.publishListing(listing.id);
        const savedListing = response?.data?.data || response?.data || response;
        showSuccess('Listing published');
        navigate(`/store/listings/${listing.productId}/published`, {
          state: { listing: savedListing, product: listing.product },
        });
      }
      refetch();
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to update listing'));
    } finally {
      setBusyId(null);
    }
  }, [navigate, refetch]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Store listings</h1>
          <p className="text-muted-foreground">Products prepared for the public online store.</p>
        </div>
        <div className="flex gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="hidden">Hidden</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : listings.length === 0 ? (
        <Card className="border border-border">
          <CardContent className="flex min-h-64 flex-col items-center justify-center text-center">
            <Package className="mb-3 h-10 w-10 text-muted-foreground" />
            <h2 className="font-semibold">No store listings yet</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Open the Products page and use “Publish to store” to create your first listing.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {listings.map((listing) => {
            const image = resolveImageUrl(listing.images?.[0] || listing.product?.imageUrl);
            const isPublished = listing.status === 'published';
            return (
              <Card key={listing.id} className="border border-border">
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                      {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <Package className="h-6 w-6 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{listing.title}</CardTitle>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{listing.shortDescription || listing.product?.name || 'No description'}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant={isPublished ? 'default' : 'outline'}>{listing.status}</Badge>
                        <Badge variant="outline">{formatAmount(listing.publicPrice || 0)}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/store/listings/${listing.productId}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant={isPublished ? 'outline' : 'default'}
                      disabled={busyId === listing.id}
                      onClick={() => handlePublishToggle(listing)}
                    >
                      {busyId === listing.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isPublished ? <EyeOff className="mr-2 h-4 w-4" /> : null)}
                      {isPublished ? 'Hide' : 'Publish'}
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StoreListings;
