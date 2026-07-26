import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  GalleryHorizontal,
  Globe,
  LayoutTemplate,
  Loader2,
  Package,
  Paintbrush,
  Pencil,
  Quote,
  LayoutGrid,
  MousePointerClick,
  Settings2,
  ShieldOff,
  ShoppingBag,
  Store,
} from 'lucide-react';

import { showError, showSuccess } from '../../utils/toast';
import { cn } from '@/lib/utils';

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
import StoreHeroSetupPanel from './StoreHeroSetupPanel';
import StoreProductCardActionsPanel from './StoreProductCardActionsPanel';
import StoreProductSectionsPanel from './StoreProductSectionsPanel';
import StoreProductsPanel from './StoreProductsPanel';
import StoreTestimonialsPanel from './StoreTestimonialsPanel';

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
 * Browser-chrome frame with a live storefront iframe and click-through overlay.
 * @param {{
 *   liveStoreUrl: string,
 *   displayUrl: string,
 *   storeName: string,
 * }} props
 */
const LiveStorePreviewFrame = ({ liveStoreUrl, displayUrl, storeName }) => {
  if (!liveStoreUrl) {
    return (
      <div className="relative w-full">
        <div className="w-full rounded-[28px] border border-slate-200 bg-white p-3 sm:p-4">
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-6 text-center sm:min-h-[360px]">
            <ShoppingBag className="h-8 w-8 text-slate-400" aria-hidden />
            <p className="text-sm font-medium text-slate-700">Store preview unavailable</p>
            <p className="max-w-xs text-sm text-slate-500">
              Finish store setup to see a live preview here.
            </p>
            <Button variant="outline" asChild className="mt-1">
              <Link to="/store/setup">Set up store</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div
        className="absolute inset-3 rounded-[32px] border border-emerald-200/80 bg-emerald-50/70 sm:inset-4"
        aria-hidden
      />

      <div className="relative w-full rounded-[28px] border border-slate-200 bg-white p-3 sm:p-4">
        <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-1.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </div>
            <div className="max-w-[70%] truncate rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-500">
              {displayUrl || 'yourstore.abs.app'}
            </div>
          </div>

          <div className="relative min-h-[300px] bg-white sm:min-h-[380px] lg:min-h-[420px]">
            <iframe
              title={`${storeName} live preview`}
              src={liveStoreUrl}
              className="pointer-events-none absolute inset-0 h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <a
              href={liveStoreUrl}
              target="_blank"
              rel="noreferrer"
              className="absolute inset-0 z-10 flex items-end justify-center bg-gradient-to-t from-slate-900/40 via-transparent to-transparent p-4 opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
              aria-label={`Open ${storeName}`}
            >
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-[#166534] px-4 py-2.5 text-sm font-semibold text-white">
                Open store
                <ExternalLink className="h-4 w-4" aria-hidden />
              </span>
            </a>
          </div>
        </div>
      </div>
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
          Connect domain
        </DialogTitle>
        <DialogDescription>
          Point a domain you own at your storefront. Status:{' '}
          <span className="inline-flex align-middle">
            <DomainStatusBadge status={domainStatus} />
          </span>
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <form id="connect-domain-form" onSubmit={onSave} className="space-y-5">
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
                Connected domain:{' '}
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

/**
 * Compact action row inside the Edit store dialog.
 * @param {{
 *   icon: import('react').ComponentType<{ className?: string }>,
 *   title: string,
 *   description: string,
 *   onClick?: () => void,
 *   to?: string,
 * }} props
 */
const EditActionRow = ({ icon: Icon, title, description, onClick, to }) => {
  const content = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
        <Icon className="h-4 w-4 text-emerald-700" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </>
  );

  const className =
    'flex w-full items-center gap-3 rounded-xl border border-border bg-background px-3.5 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
};

/**
 * Post-setup Online Store hub — preview-first rows with status chips and actions below.
 * @param {{
 *   storeName: string,
 *   liveStoreUrl: string,
 *   isPublished: boolean,
 *   domainStatus: 'none'|'pending'|'verified',
 *   domainInput: string,
 *   onDomainInputChange: (value: string) => void,
 *   customDomain: string,
 *   cnameTarget: string,
 *   dnsRecord: ReturnType<typeof buildDnsRecord>,
 *   onSaveDomain: (event: import('react').FormEvent) => void,
 *   onDisconnectDomain: () => void,
 *   onCopyAllRecord: () => void,
 *   onChangeTemplate: () => void,
 *   primaryColor?: string,
 *   heroSlides?: object[] | null,
 *   heroAnimation?: 'fade'|'slide'|'zoom'|string,
 *   onSaveHero?: (payload: { heroSlides: object[], heroAnimation: string }) => void | Promise<void>,
 *   heroSaving?: boolean,
 *   heroOpen?: boolean,
 *   onHeroOpenChange?: (open: boolean) => void,
 *   testimonials?: { enabled?: boolean, items?: object[] } | null,
 *   onSaveTestimonials?: (testimonials: object) => void | Promise<void>,
 *   testimonialsSaving?: boolean,
 *   testimonialsOpen?: boolean,
 *   onTestimonialsOpenChange?: (open: boolean) => void,
 *   productSections?: { enabled?: boolean, items?: object[] } | null,
 *   onSaveProductSections?: (productSections: object) => void | Promise<void>,
 *   productSectionsSaving?: boolean,
 *   productSectionsOpen?: boolean,
 *   onProductSectionsOpenChange?: (open: boolean) => void,
 *   productCardActions?: string[] | null,
 *   onSaveProductCardActions?: (actions: string[]) => void | Promise<void>,
 *   productCardActionsSaving?: boolean,
 *   productCardActionsOpen?: boolean,
 *   onProductCardActionsOpenChange?: (open: boolean) => void,
 *   whatsappNumber?: string | null,
 *   contactPhone?: string | null,
 *   productsOpen?: boolean,
 *   onProductsOpenChange?: (open: boolean) => void,
 *   editOpen?: boolean,
 *   onEditOpenChange?: (open: boolean) => void,
 *   savePending?: boolean,
 *   disconnectPending?: boolean,
 *   className?: string,
 * }} props
 */
const OnlineStoreDashboard = ({
  storeName,
  liveStoreUrl,
  isPublished,
  domainStatus,
  domainInput,
  onDomainInputChange,
  customDomain,
  cnameTarget,
  dnsRecord,
  onSaveDomain,
  onDisconnectDomain,
  onCopyAllRecord,
  onChangeTemplate,
  primaryColor = '#166534',
  heroSlides = null,
  heroAnimation = 'fade',
  onSaveHero,
  heroSaving = false,
  heroOpen: heroOpenProp,
  onHeroOpenChange,
  testimonials = null,
  onSaveTestimonials,
  testimonialsSaving = false,
  testimonialsOpen: testimonialsOpenProp,
  onTestimonialsOpenChange,
  productSections = null,
  onSaveProductSections,
  productSectionsSaving = false,
  productSectionsOpen: productSectionsOpenProp,
  onProductSectionsOpenChange,
  productCardActions = null,
  onSaveProductCardActions,
  productCardActionsSaving = false,
  productCardActionsOpen: productCardActionsOpenProp,
  onProductCardActionsOpenChange,
  whatsappNumber = null,
  contactPhone = null,
  productsOpen: productsOpenProp,
  onProductsOpenChange,
  editOpen: editOpenProp,
  onEditOpenChange,
  savePending = false,
  disconnectPending = false,
  className,
}) => {
  const [domainDialogOpen, setDomainDialogOpen] = useState(false);
  const [editOpenInternal, setEditOpenInternal] = useState(false);
  const [heroOpenInternal, setHeroOpenInternal] = useState(false);
  const [testimonialsOpenInternal, setTestimonialsOpenInternal] = useState(false);
  const [productSectionsOpenInternal, setProductSectionsOpenInternal] = useState(false);
  const [productCardActionsOpenInternal, setProductCardActionsOpenInternal] = useState(false);
  const [productsOpenInternal, setProductsOpenInternal] = useState(false);
  const [heroDraft, setHeroDraft] = useState([]);
  const [heroAnimationDraft, setHeroAnimationDraft] = useState('fade');

  const editControlled = typeof onEditOpenChange === 'function';
  const editOpen = editControlled ? Boolean(editOpenProp) : editOpenInternal;
  const setEditOpen = editControlled ? onEditOpenChange : setEditOpenInternal;

  const heroControlled = typeof onHeroOpenChange === 'function';
  const heroOpen = heroControlled ? Boolean(heroOpenProp) : heroOpenInternal;
  const setHeroOpen = heroControlled ? onHeroOpenChange : setHeroOpenInternal;

  const testimonialsControlled = typeof onTestimonialsOpenChange === 'function';
  const testimonialsOpen = testimonialsControlled
    ? Boolean(testimonialsOpenProp)
    : testimonialsOpenInternal;
  const setTestimonialsOpen = testimonialsControlled
    ? onTestimonialsOpenChange
    : setTestimonialsOpenInternal;

  const productSectionsControlled = typeof onProductSectionsOpenChange === 'function';
  const productSectionsOpen = productSectionsControlled
    ? Boolean(productSectionsOpenProp)
    : productSectionsOpenInternal;
  const setProductSectionsOpen = productSectionsControlled
    ? onProductSectionsOpenChange
    : setProductSectionsOpenInternal;

  const productCardActionsControlled = typeof onProductCardActionsOpenChange === 'function';
  const productCardActionsOpen = productCardActionsControlled
    ? Boolean(productCardActionsOpenProp)
    : productCardActionsOpenInternal;
  const setProductCardActionsOpen = productCardActionsControlled
    ? onProductCardActionsOpenChange
    : setProductCardActionsOpenInternal;

  const productsControlled = typeof onProductsOpenChange === 'function';
  const productsOpen = productsControlled ? Boolean(productsOpenProp) : productsOpenInternal;
  const setProductsOpen = productsControlled ? onProductsOpenChange : setProductsOpenInternal;

  const homeSectionItems = Array.isArray(productSections?.items) ? productSections.items : [];

  useEffect(() => {
    if (!heroOpen) return;
    setHeroDraft(Array.isArray(heroSlides) ? heroSlides : []);
    const key = String(heroAnimation || '').trim().toLowerCase();
    setHeroAnimationDraft(['fade', 'slide', 'zoom'].includes(key) ? key : 'fade');
  }, [heroOpen, heroSlides, heroAnimation]);

  const openFromEdit = useCallback((opener) => {
    setEditOpen(false);
    opener();
  }, [setEditOpen]);

  const handleOpenTemplate = useCallback(() => {
    openFromEdit(() => onChangeTemplate?.());
  }, [onChangeTemplate, openFromEdit]);

  const handleOpenHero = useCallback(() => {
    openFromEdit(() => setHeroOpen(true));
  }, [openFromEdit, setHeroOpen]);

  const handleOpenTestimonials = useCallback(() => {
    openFromEdit(() => setTestimonialsOpen(true));
  }, [openFromEdit, setTestimonialsOpen]);

  const handleOpenProductSections = useCallback(() => {
    openFromEdit(() => setProductSectionsOpen(true));
  }, [openFromEdit, setProductSectionsOpen]);

  const handleOpenProductCardActions = useCallback(() => {
    openFromEdit(() => setProductCardActionsOpen(true));
  }, [openFromEdit, setProductCardActionsOpen]);

  const handleOpenProducts = useCallback(() => {
    openFromEdit(() => setProductsOpen(true));
  }, [openFromEdit, setProductsOpen]);

  const displayUrl = liveStoreUrl
    ? liveStoreUrl.replace(/^https?:\/\//i, '')
    : '';

  return (
    <div
      className={cn(
        '-mx-2 min-h-[calc(100vh-8rem)] bg-[#f4f6f8] px-2 py-4 sm:mx-0 sm:min-h-0 sm:bg-transparent sm:px-0 sm:py-4',
        className,
      )}
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white sm:border-slate-200">
          <div className="flex flex-col gap-8 p-6 sm:gap-10 sm:p-8 lg:p-10">
            {/* Row 1: live storefront preview */}
            <LiveStorePreviewFrame
              liveStoreUrl={liveStoreUrl}
              displayUrl={displayUrl}
              storeName={storeName}
            />

            {/* Row 2: status, identity, actions */}
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {isPublished ? (
                    <Badge
                      className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-800"
                      variant="outline"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Published
                    </Badge>
                  ) : (
                    <Badge
                      className="gap-1.5 border-slate-200 bg-slate-50 text-slate-600"
                      variant="outline"
                    >
                      Draft
                    </Badge>
                  )}
                  <DomainStatusBadge status={domainStatus} />
                </div>

                <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {storeName}
                </h1>

                {displayUrl ? (
                  <a
                    href={liveStoreUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex max-w-full items-center gap-1.5 truncate text-sm text-slate-600 hover:text-[#166534] sm:text-base"
                  >
                    <Globe className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{displayUrl}</span>
                  </a>
                ) : (
                  <p className="mt-2 text-sm text-slate-600 sm:text-base">
                    Complete setup to get your live store URL.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditOpen(true)}
                  className="h-11 rounded-xl border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDomainDialogOpen(true)}
                  className="h-11 rounded-xl border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Globe className="mr-2 h-4 w-4" />
                  Connect domain
                </Button>
                {liveStoreUrl ? (
                  <Button
                    type="button"
                    asChild
                    className="h-11 rounded-xl bg-[#166534] px-5 text-sm font-semibold text-white hover:bg-[#14532d]"
                  >
                    <a href={liveStoreUrl} target="_blank" rel="noreferrer" className="inline-flex items-center">
                      Open store
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    asChild
                    className="h-11 rounded-xl bg-[#166534] px-5 text-sm font-semibold text-white hover:bg-[#14532d]"
                  >
                    <Link to="/store/setup" className="inline-flex items-center">
                      Set up store
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConnectDomainDialog
        open={domainDialogOpen}
        onOpenChange={setDomainDialogOpen}
        domainStatus={domainStatus}
        domainInput={domainInput}
        onDomainInputChange={onDomainInputChange}
        customDomain={customDomain}
        cnameTarget={cnameTarget}
        dnsRecord={dnsRecord}
        onSave={onSaveDomain}
        onDisconnect={onDisconnectDomain}
        onCopyAllRecord={onCopyAllRecord}
        savePending={savePending}
        disconnectPending={disconnectPending}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          className="sm:max-w-2xl"
          style={{ '--modal-w': 'min(92vw, 42rem)', '--modal-min-h': 'auto', '--modal-max-h': '90vh' }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-emerald-700" aria-hidden />
              Edit store
            </DialogTitle>
            <DialogDescription>
              Update template, products, hero, sections, testimonials, or branding.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-2">
              <EditActionRow
                icon={LayoutTemplate}
                title="Template"
                description="Change storefront layout"
                onClick={handleOpenTemplate}
              />
              <EditActionRow
                icon={Package}
                title="Products"
                description="What's on your store"
                onClick={handleOpenProducts}
              />
              {typeof onSaveHero === 'function' ? (
                <EditActionRow
                  icon={GalleryHorizontal}
                  title="Hero banners"
                  description="Edit homepage slides"
                  onClick={handleOpenHero}
                />
              ) : null}
              {typeof onSaveProductSections === 'function' ? (
                <EditActionRow
                  icon={LayoutGrid}
                  title="Product sections"
                  description="Home shelves for featured products"
                  onClick={handleOpenProductSections}
                />
              ) : null}
              {typeof onSaveProductCardActions === 'function' ? (
                <EditActionRow
                  icon={MousePointerClick}
                  title="Product buttons"
                  description="View, cart, buy, WhatsApp (max 2)"
                  onClick={handleOpenProductCardActions}
                />
              ) : null}
              {typeof onSaveTestimonials === 'function' ? (
                <EditActionRow
                  icon={Quote}
                  title="Testimonials"
                  description="Edit customer quotes"
                  onClick={handleOpenTestimonials}
                />
              ) : null}
              <EditActionRow
                icon={Paintbrush}
                title="Branding"
                description="Colors and logo"
                to="/store/setup?step=branding"
              />
              <EditActionRow
                icon={Store}
                title="Store info"
                description="Name, contact, description"
                to="/store/setup?step=info"
              />
              <EditActionRow
                icon={Settings2}
                title="Full setup"
                description="Payments, delivery, launch"
                to="/store/setup"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {typeof onSaveHero === 'function' ? (
        <Dialog open={heroOpen} onOpenChange={setHeroOpen}>
          <DialogContent
            className="sm:max-w-[min(96vw,72rem)]"
            style={{ '--modal-w': 'min(96vw, 72rem)', '--modal-min-h': 'auto', '--modal-max-h': '90vh' }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GalleryHorizontal className="h-4 w-4 text-emerald-700" aria-hidden />
                Hero banners
              </DialogTitle>
              <DialogDescription>
                Choose library slides or upload your own. Optional — leave empty for no hero.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <StoreHeroSetupPanel
                primaryColor={primaryColor}
                heroSlides={heroDraft}
                onChange={setHeroDraft}
                heroAnimation={heroAnimationDraft}
                onAnimationChange={setHeroAnimationDraft}
              />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setHeroOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={heroSaving}
                className="bg-[#166534] text-white hover:bg-[#14532d]"
                onClick={async () => {
                  await onSaveHero({
                    heroSlides: heroDraft,
                    heroAnimation: heroAnimationDraft,
                  });
                  setHeroOpen(false);
                }}
              >
                {heroSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save hero
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {typeof onSaveTestimonials === 'function' ? (
        <Dialog open={testimonialsOpen} onOpenChange={setTestimonialsOpen}>
          <DialogContent
            className="sm:max-w-3xl"
            style={{ '--modal-w': 'min(92vw, 48rem)', '--modal-min-h': 'auto', '--modal-max-h': '90vh' }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Quote className="h-4 w-4 text-emerald-700" aria-hidden />
                Testimonials
              </DialogTitle>
              <DialogDescription>
                Add customer quotes for your Online Store home. This is separate from Verified reviews.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <StoreTestimonialsPanel
                value={testimonials}
                saving={testimonialsSaving}
                onSave={async (next) => {
                  await onSaveTestimonials(next);
                  setTestimonialsOpen(false);
                }}
              />
            </DialogBody>
          </DialogContent>
        </Dialog>
      ) : null}

      {typeof onSaveProductSections === 'function' ? (
        <Dialog open={productSectionsOpen} onOpenChange={setProductSectionsOpen}>
          <DialogContent
            className="sm:max-w-3xl"
            style={{ '--modal-w': 'min(92vw, 48rem)', '--modal-min-h': 'auto', '--modal-max-h': '90vh' }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-emerald-700" aria-hidden />
                Product sections
              </DialogTitle>
              <DialogDescription>
                Curate home shelves. Assign products when publishing a listing.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <StoreProductSectionsPanel
                value={productSections}
                saving={productSectionsSaving}
                onSave={async (next) => {
                  await onSaveProductSections(next);
                  setProductSectionsOpen(false);
                }}
              />
            </DialogBody>
          </DialogContent>
        </Dialog>
      ) : null}

      {typeof onSaveProductCardActions === 'function' ? (
        <Dialog open={productCardActionsOpen} onOpenChange={setProductCardActionsOpen}>
          <DialogContent
            className="sm:max-w-xl"
            style={{ '--modal-w': 'min(92vw, 36rem)', '--modal-min-h': 'auto', '--modal-max-h': '90vh' }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MousePointerClick className="h-4 w-4 text-emerald-700" aria-hidden />
                Product buttons
              </DialogTitle>
              <DialogDescription>
                Choose up to two actions for product cards. Last is primary.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <StoreProductCardActionsPanel
                value={productCardActions}
                saving={productCardActionsSaving}
                whatsappNumber={whatsappNumber}
                contactPhone={contactPhone}
                accentColor={primaryColor}
                onSave={async (next) => {
                  await onSaveProductCardActions(next);
                  setProductCardActionsOpen(false);
                }}
              />
            </DialogBody>
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog open={productsOpen} onOpenChange={setProductsOpen}>
        <DialogContent
          className="sm:max-w-[min(96vw,72rem)]"
          style={{ '--modal-w': 'min(96vw, 72rem)', '--modal-min-h': 'auto', '--modal-max-h': '90vh' }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-4 w-4 text-emerald-700" aria-hidden />
              Products
            </DialogTitle>
            <DialogDescription>
              What's on your store. Removing hides the listing — inventory stays.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <StoreProductsPanel homeSections={homeSectionItems} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setProductsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OnlineStoreDashboard;
