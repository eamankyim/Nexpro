import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { EyeOff, Loader2, Pencil, Plus, RefreshCw, Scissors, Search } from 'lucide-react';
import pricingService from '../services/pricingService';
import storeService from '../services/storeService';
import { showError, showSuccess, getErrorMessage } from '../utils/toast';
import { formatAmount } from '../utils/formatNumber';
import { resolveImageUrl } from '../utils/fileUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formatPriceLabel = (listing) => {
  if (listing.priceType === 'quote_only') return 'Quote on request';
  const price = Number.parseFloat(listing.startingPrice || 0);
  if (!price) return 'Price on request';
  return listing.priceType === 'fixed'
    ? formatAmount(price)
    : `From ${formatAmount(price)}`;
};

const StoreServices = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [importingId, setImportingId] = useState(null);
  const queryParams = useMemo(() => ({
    limit: 100,
    ...(status !== 'all' ? { status } : {}),
  }), [status]);

  const { data: response, isLoading, refetch } = useQuery({
    queryKey: ['store', 'service-listings', queryParams],
    queryFn: () => storeService.getServiceListings(queryParams),
  });

  const { data: templatesResponse, isLoading: templatesLoading } = useQuery({
    queryKey: ['pricing-templates', 'service-import', templateSearch],
    queryFn: () => pricingService.getAll({ isActive: 'true', search: templateSearch, limit: 50 }),
    enabled: importDialogOpen,
  });

  const listings = useMemo(() => {
    const body = response?.data ? response : response || {};
    return Array.isArray(body.data) ? body.data : [];
  }, [response]);

  const templates = useMemo(() => {
    const body = templatesResponse?.data ? templatesResponse : templatesResponse || {};
    const raw = body.data || body.templates || body;
    return Array.isArray(raw) ? raw : [];
  }, [templatesResponse]);

  const handlePublishToggle = useCallback(async (listing) => {
    setBusyId(listing.id);
    try {
      if (listing.status === 'published') {
        await storeService.unpublishServiceListing(listing.id);
        showSuccess('Service hidden from studio store');
      } else {
        await storeService.publishServiceListing(listing.id);
        showSuccess('Service published');
      }
      refetch();
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to update service listing'));
    } finally {
      setBusyId(null);
    }
  }, [refetch]);

  const handleImportTemplate = useCallback(async (templateId) => {
    if (!templateId) return;
    setImportingId(templateId);
    try {
      const response = await storeService.importServiceListingFromPricingTemplate(templateId, { status: 'draft' });
      const listing = response?.data?.data || response?.data || response;
      showSuccess('Service imported from pricing template');
      setImportDialogOpen(false);
      navigate(`/store/services/${listing.id}/edit`);
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to import pricing template'));
    } finally {
      setImportingId(null);
    }
  }, [navigate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Studio services</h1>
          <p className="text-muted-foreground">Services published on your Sabito studio storefront.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Import from pricing
          </Button>
          <Button onClick={() => navigate('/store/services/new/edit')}>
            <Plus className="mr-2 h-4 w-4" />
            New service
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading services...
        </div>
      ) : listings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <Scissors className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No studio services yet</p>
              <p className="text-sm text-muted-foreground">Import from pricing templates or create a new service listing.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImportDialogOpen(true)}>Import from pricing</Button>
              <Button onClick={() => navigate('/store/services/new/edit')}>Create service</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing) => {
            const image = listing.images?.[0];
            return (
              <Card key={listing.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{listing.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">{listing.category || 'General service'}</p>
                    </div>
                    <Badge variant={listing.status === 'published' ? 'default' : 'secondary'}>
                      {listing.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {image ? (
                    <img src={resolveImageUrl(image)} alt={listing.title} className="h-36 w-full rounded-lg border border-border object-cover" />
                  ) : (
                    <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
                      No image yet
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{formatPriceLabel(listing)}</span>
                    <span className="text-muted-foreground capitalize">{listing.ctaType?.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/store/services/${listing.id}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === listing.id}
                      onClick={() => handlePublishToggle(listing)}
                    >
                      {busyId === listing.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : listing.status === 'published' ? (
                        <EyeOff className="mr-2 h-4 w-4" />
                      ) : null}
                      {listing.status === 'published' ? 'Hide' : 'Publish'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import from pricing template</DialogTitle>
            <DialogDescription>Start a storefront service from an existing pricing template.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={templateSearch}
                onChange={(event) => setTemplateSearch(event.target.value)}
                placeholder="Search pricing templates"
                className="pl-9"
              />
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {templatesLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading templates...
                </div>
              ) : templates.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No pricing templates found.</p>
              ) : (
                templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-3 text-left hover:bg-muted/40"
                    disabled={importingId === template.id}
                    onClick={() => handleImportTemplate(template.id)}
                  >
                    <div>
                      <p className="font-medium">{template.name}</p>
                      <p className="text-sm text-muted-foreground">{template.category}</p>
                    </div>
                    {importingId === template.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </button>
                ))
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StoreServices;
