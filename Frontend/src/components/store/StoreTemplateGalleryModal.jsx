import { useCallback, useMemo, useState } from 'react';
import { ArrowRight, Eye, LayoutTemplate, Loader2, Store, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  STORE_TEMPLATES,
  getStoreTemplate,
  getTemplateDefaultColors,
  mergeColorsForTemplate,
  resolveStoreBrandColors,
} from '../../constants/storeTemplates';
import { resolveImageUrl } from '../../utils/fileUtils';
import TemplatePreviewFrame from './TemplatePreviewFrame';

/**
 * Compact visual hint for a storefront template (in-app, no navigation away).
 * Uses merchant branding when previewBranding is provided.
 *
 * @param {{
 *   template: (typeof STORE_TEMPLATES)[number],
 *   className?: string,
 *   branding?: {
 *     displayName?: string,
 *     logoUrl?: string,
 *     primaryColor?: string,
 *     secondaryColor?: string,
 *     tertiaryColor?: string,
 *   } | null,
 * }} props
 */
const TemplateMiniPreview = ({ template, className, branding = null }) => {
  const merged = mergeColorsForTemplate(template.id, {
    primaryColor: branding?.primaryColor || template.previewAccent,
    secondaryColor: branding?.secondaryColor || null,
    tertiaryColor: branding?.tertiaryColor || null,
  });
  const colors = resolveStoreBrandColors(template.id, {
    primaryColor: merged.primaryColor,
    secondaryColor: merged.secondaryColor || '',
    tertiaryColor: merged.tertiaryColor || '',
  });
  const accent = colors.primary || template.previewAccent || '#166534';
  const logoSrc = resolveImageUrl(branding?.logoUrl);
  const storeName = branding?.displayName || '';
  const dense = template.id === 'marketplace';
  const catalog = template.id === 'catalog';
  const minimal = template.id === 'minimal';
  const bold = template.id === 'bold';

  return (
    <div
      className={cn(
        'relative h-36 overflow-hidden border-b border-slate-200',
        minimal ? 'bg-white' : 'bg-slate-50',
        className,
      )}
      style={{ '--preview-accent': accent }}
      aria-hidden
    >
      <div
        className={cn(
          'absolute inset-4 flex flex-col justify-end border border-slate-200/80 bg-white p-3',
          bold && 'border-[var(--preview-accent)]',
          catalog && 'rounded-none',
          !catalog && 'rounded-xl',
        )}
        style={{ backgroundColor: bold ? `${accent}14` : undefined }}
      >
        <div className="mb-2 flex items-center gap-2">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white"
            style={{ borderColor: minimal ? undefined : `${accent}55` }}
          >
            {logoSrc ? (
              <img src={logoSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <Store className="h-3.5 w-3.5 text-slate-400" />
            )}
          </span>
          {storeName ? (
            <span className="truncate text-[11px] font-semibold text-slate-800">{storeName}</span>
          ) : (
            <div
              className={cn('h-2 rounded-full', minimal ? 'w-10 bg-slate-800' : 'w-16')}
              style={{ backgroundColor: minimal ? undefined : accent }}
            />
          )}
        </div>
        <div className="h-2 w-24 rounded-full bg-slate-200" />
        <div
          className={cn(
            'mt-3 gap-1.5',
            dense ? 'grid grid-cols-4 gap-1' : catalog ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-3',
          )}
        >
          {[0, 1, 2, 3].slice(0, dense ? 4 : catalog ? 2 : 3).map((i) => (
            <div
              key={i}
              className={cn(
                'bg-slate-100',
                dense ? 'h-7 rounded-sm' : catalog ? 'h-10 rounded-md' : 'h-8 rounded-md',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Full-screen in-app template gallery for ABS merchants.
 * Selecting a template calls onSelect — parent applies templateId and continues setup/hub flow.
 *
 * @param {{
 *   open: boolean,
 *   onOpenChange: (open: boolean) => void,
 *   onSelect: (templateId: string) => void | Promise<void>,
 *   currentTemplateId?: string | null,
 *   selectingId?: string | null,
 *   title?: string,
 *   description?: string,
 *   previewBranding?: {
 *     displayName?: string,
 *     logoUrl?: string,
 *     primaryColor?: string,
 *     secondaryColor?: string,
 *     tertiaryColor?: string,
 *     description?: string,
 *     contactPhone?: string,
 *     whatsappNumber?: string,
 *     contactEmail?: string,
 *     currency?: string,
 *   } | null,
 * }} props
 */
const StoreTemplateGalleryModal = ({
  open,
  onOpenChange,
  onSelect,
  currentTemplateId = null,
  selectingId = null,
  title = 'Choose a storefront layout',
  description = 'Pick a layout for your Online Store. You can change it later — products and branding stay.',
  previewBranding = null,
}) => {
  const [previewId, setPreviewId] = useState(null);
  const isBusy = Boolean(selectingId);

  const previewBrandingForFrame = useMemo(() => {
    if (!previewId) return null;
    const template = getStoreTemplate(previewId);
    const merged = mergeColorsForTemplate(template.id, {
      primaryColor: previewBranding?.primaryColor || template.previewAccent,
      secondaryColor: previewBranding?.secondaryColor || null,
      tertiaryColor: previewBranding?.tertiaryColor || null,
    });
    const colors = resolveStoreBrandColors(template.id, {
      primaryColor: merged.primaryColor,
      secondaryColor: merged.secondaryColor || '',
      tertiaryColor: merged.tertiaryColor || '',
    });
    return {
      businessName: previewBranding?.displayName || undefined,
      logoUrl: previewBranding?.logoUrl || undefined,
      primaryColor: colors.primary || undefined,
      secondaryColor: colors.secondary || undefined,
      tertiaryColor: colors.tertiary || undefined,
      description: previewBranding?.description || undefined,
      contactPhone: previewBranding?.contactPhone || undefined,
      whatsappNumber: previewBranding?.whatsappNumber || undefined,
      contactEmail: previewBranding?.contactEmail || undefined,
      currency: previewBranding?.currency || undefined,
    };
  }, [previewBranding, previewId]);

  const previewTemplate = useMemo(
    () => (previewId ? getStoreTemplate(previewId) : null),
    [previewId],
  );

  const handleClosePreview = useCallback(() => setPreviewId(null), []);

  const handleSelect = useCallback(
    async (templateId) => {
      if (isBusy) return;
      await onSelect(templateId);
    },
    [isBusy, onSelect],
  );

  const handleOpenChange = useCallback(
    (nextOpen) => {
      if (!nextOpen && isBusy) return;
      if (!nextOpen) setPreviewId(null);
      onOpenChange(nextOpen);
    },
    [isBusy, onOpenChange],
  );

  const previewTitle = previewBranding?.displayName
    ? `${previewBranding.displayName} · ${previewTemplate?.name || 'Preview'}`
    : previewTemplate?.name;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="!left-0 !top-0 !translate-x-0 !translate-y-0 !h-[100dvh] !max-h-[100dvh] !min-h-0 !w-[100vw] !max-w-[100vw] !gap-0 !rounded-none !border-0 !p-0 overflow-hidden flex flex-col bg-[#f8fafc] sm:!left-0 sm:!top-0 sm:!translate-x-0 sm:!translate-y-0 sm:!h-[100dvh] sm:!max-h-[100dvh] sm:!w-[100vw] sm:!max-w-[100vw] sm:!rounded-none sm:!border-0"
        aria-describedby={undefined}
        onEscapeKeyDown={(event) => {
          if (isBusy) {
            event.preventDefault();
            return;
          }
          if (previewId) {
            event.preventDefault();
            handleClosePreview();
          }
        }}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>

        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800">
              <LayoutTemplate className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Online Store
              </p>
              <h2 className="truncate text-lg font-bold text-slate-900">{title}</h2>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
            <div className="max-w-2xl">
              <h3 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {title}
              </h3>
              <p className="mt-2 text-base leading-7 text-slate-600">{description}</p>
              {previewBranding?.displayName ? (
                <p className="mt-3 text-sm text-slate-500">
                  Previews use your branding ({previewBranding.displayName}) with sample products.
                </p>
              ) : null}
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {STORE_TEMPLATES.map((template) => {
                const isCurrent = currentTemplateId
                  && getStoreTemplate(currentTemplateId).id === template.id;
                const isSelecting = selectingId === template.id;
                const defaults = getTemplateDefaultColors(template.id);

                return (
                  <article
                    key={template.id}
                    className={cn(
                      'flex flex-col overflow-hidden rounded-2xl border bg-white',
                      isCurrent ? 'border-emerald-600' : 'border-slate-200',
                    )}
                  >
                    <TemplateMiniPreview template={template} branding={previewBranding} />

                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex flex-wrap gap-1.5">
                        {isCurrent ? (
                          <Badge
                            variant="outline"
                            className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-800"
                          >
                            Current
                          </Badge>
                        ) : null}
                        {template.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="rounded-full border-slate-200 bg-slate-50 text-slate-700"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      <h4 className="mt-3 text-xl font-semibold text-slate-900">{template.name}</h4>
                      <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
                        {template.tagline}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {Object.entries(defaults).map(([key, color]) => (
                          <span
                            key={key}
                            className="h-4 w-4 rounded-full border border-slate-200"
                            style={{ backgroundColor: color }}
                            title={key}
                          />
                        ))}
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() => setPreviewId(template.id)}
                          className="border-slate-300"
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Preview
                        </Button>
                        <Button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleSelect(template.id)}
                          className="bg-[#166534] text-white hover:bg-[#14532d]"
                        >
                          {isSelecting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <ArrowRight className="mr-2 h-4 w-4" />
                          )}
                          {isSelecting ? 'Applying…' : 'Use this template'}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>

        {previewId && previewTemplate ? (
          <div className="absolute inset-0 z-10 flex flex-col bg-white">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Preview
                </p>
                <p className="truncate font-semibold text-slate-900">
                  {previewTitle}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isBusy}
                  onClick={handleClosePreview}
                >
                  <X className="mr-2 h-4 w-4" />
                  Back to gallery
                </Button>
                <Button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleSelect(previewId)}
                  className="bg-[#166534] text-white hover:bg-[#14532d]"
                >
                  {selectingId === previewId ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-2 h-4 w-4" />
                  )}
                  {selectingId === previewId ? 'Applying…' : 'Use this template'}
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-slate-100">
              {previewId && previewBrandingForFrame ? (
                <TemplatePreviewFrame
                  templateId={previewId}
                  branding={previewBrandingForFrame}
                  title={`${previewTemplate.name} template preview`}
                  className="h-full w-full border-0 bg-white"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Preview unavailable
                </div>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default StoreTemplateGalleryModal;
