import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, ExternalLink, Globe, Loader2, ShieldOff, Sparkles, Store } from 'lucide-react';

import storeService from '../services/storeService';
import { buildStorefrontStoreUrl } from '../utils/storefrontUrl';
import { isSabitoStoreEnabled } from '../utils/sabitoStoreFeature';
import { showError, showSuccess } from '../utils/toast';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Status pill for the connected custom domain (none / pending / verified).
 * @param {{ status: 'none'|'pending'|'verified' }} props
 */
const DomainStatusBadge = ({ status }) => {
  if (status === 'verified') {
    return (
      <Badge className="gap-1.5 border-green-200 bg-green-50 text-green-800" variant="outline">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Connected
      </Badge>
    );
  }
  if (status === 'pending') {
    return (
      <Badge className="gap-1.5 border-amber-200 bg-amber-50 text-amber-800" variant="outline">
        <Clock className="h-3.5 w-3.5" />
        Pending verification
      </Badge>
    );
  }
  return (
    <Badge className="gap-1.5 border-slate-200 bg-slate-50 text-slate-600" variant="outline">
      <ShieldOff className="h-3.5 w-3.5" />
      Not connected
    </Badge>
  );
};

/**
 * MVP shell for the "Online Store" product: a customer-owned, custom-domain storefront
 * (separate from the Sabito marketplace channel — no trade assurance, pay the shop directly).
 * Uses a single shared template filled with the tenant's own store info; merchants connect
 * their own domain via CNAME. DNS/SSL verification is manual for now (see backend TODO in
 * storeController.updateDomain).
 */
const OnlineStore = () => {
  const queryClient = useQueryClient();
  const [domainInput, setDomainInput] = useState('');

  const { data: response, isLoading } = useQuery({
    queryKey: ['store', 'domain'],
    queryFn: () => storeService.getDomainSettings(),
  });

  const data = response?.data ?? response ?? {};
  const hasStoreSettings = Boolean(data.hasStoreSettings);
  const cnameTarget = data.cnameTarget || 'store.abs.app';

  useEffect(() => {
    setDomainInput(data.customDomain || '');
  }, [data.customDomain]);

  const saveMutation = useMutation({
    mutationFn: (customDomain) => storeService.updateDomain(customDomain),
    onSuccess: () => {
      showSuccess('Domain saved. Follow the CNAME instructions to finish connecting it.');
      queryClient.invalidateQueries({ queryKey: ['store', 'domain'] });
    },
    onError: (error) => showError(error, 'Could not save domain'),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => storeService.updateDomain(''),
    onSuccess: () => {
      showSuccess('Custom domain disconnected');
      queryClient.invalidateQueries({ queryKey: ['store', 'domain'] });
    },
    onError: (error) => showError(error, 'Could not disconnect domain'),
  });

  const templatePreviewUrl = useMemo(
    () => (data.slug ? buildStorefrontStoreUrl(data.slug) : ''),
    [data.slug],
  );

  const handleSave = (event) => {
    event.preventDefault();
    saveMutation.mutate(domainInput.trim());
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Online Store</h1>
          <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800">New</Badge>
        </div>
        <p className="mt-1 text-muted-foreground">
          Your own storefront on your own domain — separate from Sabito Store. Customers pay you
          directly; there is no marketplace listing or trade assurance here.
        </p>
      </div>

      {!hasStoreSettings ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-900">
              {isSabitoStoreEnabled()
                ? 'Finish basic store setup first (store name, products, branding) — Online Store reuses that same information for your template.'
                : 'Basic store profile (name, products, branding) is required before connecting a domain. Sabito Store setup is currently unavailable — contact support if you need help.'}
            </p>
            {isSabitoStoreEnabled() ? (
              <Button asChild className="shrink-0">
                <Link to="/store/setup">Start store setup</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            Template
          </CardTitle>
          <CardDescription>
            Powered by an ABS template — filled automatically with your store name, products and
            branding. Custom, one-off designs per store are not available yet; every Online Store
            uses this same layout for now.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Store className="h-5 w-5" />
            </span>
            <div>
              <p className="font-medium">{data.displayName || 'Your store'}</p>
              <p className="text-sm text-muted-foreground">
                {data.slug ? `Template preview at /store/${data.slug}` : 'Set up your store to preview the template'}
              </p>
            </div>
          </div>
          {templatePreviewUrl ? (
            <Button variant="outline" asChild>
              <a href={templatePreviewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
                Preview template
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-emerald-600" />
              Custom domain
            </CardTitle>
            <DomainStatusBadge status={data.customDomainStatus || 'none'} />
          </div>
          <CardDescription>
            Connect a domain you own (e.g. shop.yourbusiness.com) so customers can reach your store
            directly, without any Sabito or ABS branding in the URL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={handleSave} className="space-y-2">
            <Label htmlFor="custom-domain">Your domain (optional)</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="custom-domain"
                placeholder="shop.yourbusiness.com"
                value={domainInput}
                onChange={(event) => setDomainInput(event.target.value)}
                disabled={!hasStoreSettings || saveMutation.isPending}
              />
              <Button
                type="submit"
                disabled={!hasStoreSettings || saveMutation.isPending || domainInput.trim() === (data.customDomain || '')}
                className="shrink-0"
              >
                {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save domain
              </Button>
            </div>
          </form>

          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <p className="font-medium">How to connect it</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-muted-foreground">
              <li>Go to your domain provider's DNS settings (e.g. Namecheap, GoDaddy, Cloudflare).</li>
              <li>
                Add a <span className="font-mono text-foreground">CNAME</span> record pointing your
                domain (or subdomain, e.g. <span className="font-mono text-foreground">shop</span>)
                to <span className="font-mono text-foreground">{cnameTarget}</span>.
              </li>
              <li>Save your domain above. DNS changes can take a few minutes to a few hours.</li>
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              Note: automatic DNS/SSL verification isn't live yet — our team confirms new domains
              manually before flipping them to "Connected". HTTPS is provisioned once verified.
            </p>
          </div>

          {data.customDomain ? (
            <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                Connected domain: <span className="font-medium text-foreground">{data.customDomain}</span>
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
              >
                Disconnect
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default OnlineStore;
