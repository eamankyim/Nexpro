import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  ShieldOff,
  Sparkles,
  Store,
} from 'lucide-react';

import storeService from '../services/storeService';
import { buildOnlineStoreTemplateUrl } from '../utils/storefrontUrl';
import { showError, showSuccess } from '../utils/toast';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
 * Builds the DNS record a merchant should add at their registrar.
 * Subdomains use Host = leftmost label(s); apex (e.g. example.com) uses `@`.
 * @param {string} customDomain - Normalized hostname, e.g. "www.asedastore.com"
 * @param {string} cnameTarget - CNAME target host from the API
 * @returns {{ type: string, host: string, value: string, isApex: boolean, fqdn: string } | null}
 */
const buildDnsRecord = (customDomain, cnameTarget) => {
  const host = String(customDomain || '').trim().toLowerCase();
  const target = String(cnameTarget || '').trim().toLowerCase();
  if (!host || !target) return null;

  const labels = host.split('.').filter(Boolean);
  if (labels.length < 2) return null;

  const isApex = labels.length === 2;
  const recordHost = isApex ? '@' : labels.slice(0, -2).join('.');

  return {
    type: 'CNAME',
    host: recordHost,
    value: target,
    isApex,
    fqdn: host,
  };
};

/**
 * Copyable cell for a DNS record field.
 * @param {{ label: string, value: string }} props
 */
const DnsCopyField = ({ label, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      showSuccess(`${label} copied`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      showError('Could not copy to clipboard');
    }
  }, [label, value]);

  return (
    <div className="flex items-center gap-2">
      <code className="rounded border border-border bg-background px-2 py-1 font-mono text-sm text-foreground">
        {value}
      </code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 shrink-0 gap-1.5 px-2"
        onClick={handleCopy}
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
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
  const cnameTarget = data.cnameTarget || 'www.absghana.com';
  const domainStatus = data.customDomainStatus || 'none';

  useEffect(() => {
    setDomainInput(data.customDomain || '');
  }, [data.customDomain]);

  const saveMutation = useMutation({
    mutationFn: (customDomain) => storeService.updateDomain(customDomain),
    onSuccess: () => {
      showSuccess('Domain saved. Add the DNS record below at your domain provider.');
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
    () => (data.slug ? buildOnlineStoreTemplateUrl(data.slug) : ''),
    [data.slug],
  );

  const dnsRecord = useMemo(
    () => buildDnsRecord(data.customDomain, cnameTarget),
    [data.customDomain, cnameTarget],
  );

  const handleSave = (event) => {
    event.preventDefault();
    saveMutation.mutate(domainInput.trim());
  };

  const handleCopyAllRecord = useCallback(async () => {
    if (!dnsRecord) return;
    const text = `Type: ${dnsRecord.type}\nHost / Name: ${dnsRecord.host}\nValue / Target / Points to: ${dnsRecord.value}`;
    try {
      await navigator.clipboard.writeText(text);
      showSuccess('DNS record copied');
    } catch {
      showError('Could not copy to clipboard');
    }
  }, [dnsRecord]);

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
              Finish basic store setup first (store name, branding, and contact details). Online Store
              uses that information for your template and custom domain.
            </p>
            <Button asChild className="shrink-0">
              <Link to="/store/setup">Start store setup</Link>
            </Button>
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
                {data.slug ? `Template preview at /template/${data.slug}` : 'Set up your store to preview the template'}
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
          ) : (
            <Button variant="outline" asChild>
              <Link to="/store/setup">Set up store</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-emerald-600" />
              Custom domain
            </CardTitle>
            <DomainStatusBadge status={domainStatus} />
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
              <li>Save your domain above (e.g. <span className="font-mono text-foreground">www.yourbusiness.com</span>).</li>
              <li>Go to your domain provider&apos;s DNS settings (Namecheap, GoDaddy, Cloudflare, etc.).</li>
              <li>Add the CNAME record from the table below, then wait for DNS to propagate.</li>
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              Note: automatic DNS/SSL verification isn&apos;t live yet — our team confirms new domains
              manually before flipping them to &quot;Connected&quot;. HTTPS is provisioned once verified.
            </p>
          </div>

          {dnsRecord ? (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium text-sm">
                    {domainStatus === 'pending' ? 'DNS record to add' : 'DNS record'}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Paste these values at your registrar for{' '}
                    <span className="font-mono text-foreground">{dnsRecord.fqdn}</span>.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={handleCopyAllRecord}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy all
                </Button>
              </div>

              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Type</TableHead>
                      <TableHead>Host / Name</TableHead>
                      <TableHead>Value / Target / Points to</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <DnsCopyField label="Type" value={dnsRecord.type} />
                      </TableCell>
                      <TableCell>
                        <DnsCopyField label="Host" value={dnsRecord.host} />
                      </TableCell>
                      <TableCell>
                        <DnsCopyField label="Value" value={dnsRecord.value} />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {dnsRecord.isApex ? (
                <p className="text-xs text-amber-800">
                  Apex / root domains (e.g. <span className="font-mono">example.com</span>) often
                  cannot use a CNAME. Prefer a subdomain like{' '}
                  <span className="font-mono">www.example.com</span>, or use an ALIAS/ANAME record
                  if your provider supports it (same target:{' '}
                  <span className="font-mono">{dnsRecord.value}</span>).
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Some providers label Host as &quot;Name&quot; or &quot;Hostname&quot;, and Value as
                  &quot;Points to&quot;, &quot;Target&quot;, or &quot;Content&quot;. TTL can stay at
                  the default (or 300 / Automatic).
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              Save a domain above to generate the exact DNS record (Type, Host, Value) to add at
              your provider. Target will be{' '}
              <span className="font-mono text-foreground">{cnameTarget}</span>.
            </div>
          )}

          {data.customDomain ? (
            <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                Connected domain:{' '}
                <span className="font-medium text-foreground">{data.customDomain}</span>
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
