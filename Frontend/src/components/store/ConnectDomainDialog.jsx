import { useCallback, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Globe,
  Loader2,
  ShieldOff,
} from 'lucide-react';

import { showError, showSuccess } from '../../utils/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import OnlineStoreHelpBanner from './OnlineStoreHelpBanner';

/**
 * True when a domain has been submitted (awaiting verification or live).
 * @param {string|null|undefined} status
 * @returns {boolean}
 */
export const isDomainConfigured = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === 'pending' || normalized === 'verified';
};

/**
 * Primary CTA / dialog title for domain actions.
 * Avoids "Connect domain" once a domain is pending or verified.
 * @param {string|null|undefined} status
 * @returns {string}
 */
export const getDomainActionLabel = (status) =>
  (isDomainConfigured(status) ? 'Manage domain' : 'Connect domain');

/**
 * Status pill for the connected custom domain (none / pending / verified).
 * @param {{ status: 'none'|'pending'|'verified' }} props
 */
export const DomainStatusBadge = ({ status }) => {
  if (status === 'verified') {
    return (
      <Badge className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-800" variant="outline">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Domain Connected
      </Badge>
    );
  }
  if (status === 'pending') {
    return (
      <Badge className="gap-1.5 border-amber-200 bg-amber-50 text-amber-800" variant="outline">
        <Clock className="h-3.5 w-3.5" />
        Pending
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
 * @param {string} customDomain
 * @param {string} cnameTarget
 * @returns {{ type: string, host: string, value: string, isApex: boolean, fqdn: string } | null}
 */
export const buildDnsRecord = (customDomain, cnameTarget) => {
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
 * Connect-domain dialog: form, DNS how-to, and record table.
 * @param {{
 *   open: boolean,
 *   onOpenChange: (open: boolean) => void,
 *   domainStatus: 'none'|'pending'|'verified',
 *   domainInput: string,
 *   onDomainInputChange: (value: string) => void,
 *   customDomain: string,
 *   cnameTarget: string,
 *   dnsRecord: ReturnType<typeof buildDnsRecord>,
 *   onSave: (event: import('react').FormEvent) => void,
 *   onDisconnect: () => void,
 *   onCopyAllRecord: () => void,
 *   savePending?: boolean,
 *   disconnectPending?: boolean,
 * }} props
 */
const ConnectDomainDialog = ({
  open,
  onOpenChange,
  domainStatus,
  domainInput,
  onDomainInputChange,
  customDomain,
  cnameTarget,
  dnsRecord,
  onSave,
  onDisconnect,
  onCopyAllRecord,
  savePending = false,
  disconnectPending = false,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      className="sm:max-w-xl"
      style={{ '--modal-w': '36rem', '--modal-min-h': 'auto', '--modal-max-h': '90vh' }}
      onInteractOutside={(event) => event.preventDefault()}
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-emerald-700" aria-hidden />
          {getDomainActionLabel(domainStatus)}
        </DialogTitle>
        <DialogDescription>
          {isDomainConfigured(domainStatus)
            ? 'Update DNS, change the domain, or disconnect it. Status: '
            : 'Point a domain you own at your storefront. Status: '}
          <span className="inline-flex align-middle">
            <DomainStatusBadge status={domainStatus} />
          </span>
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <form id="connect-domain-form" onSubmit={onSave} className="space-y-5">
          <OnlineStoreHelpBanner compact />

          <div className="space-y-2">
            <Label htmlFor="custom-domain">Your domain (optional)</Label>
            <Input
              id="custom-domain"
              placeholder="shop.yourbusiness.com"
              value={domainInput}
              onChange={(event) => onDomainInputChange(event.target.value)}
              disabled={savePending}
            />
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <p className="font-medium">How to connect it</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-muted-foreground">
              <li>
                Save your domain above (e.g.{' '}
                <span className="font-mono text-foreground">www.yourbusiness.com</span>).
              </li>
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
                  <p className="text-sm font-medium">
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
                  onClick={onCopyAllRecord}
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

          {customDomain ? (
            <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                {domainStatus === 'verified' ? 'Connected domain' : 'Saved domain'}:{' '}
                <span className="font-medium text-foreground">{customDomain}</span>
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDisconnect}
                disabled={disconnectPending}
              >
                {disconnectPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Disconnect
              </Button>
            </div>
          ) : null}
        </form>
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
        <Button
          type="submit"
          form="connect-domain-form"
          disabled={savePending || domainInput.trim() === (customDomain || '')}
          className="bg-[#166534] text-white hover:bg-[#14532d]"
        >
          {savePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save domain
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default ConnectDomainDialog;
