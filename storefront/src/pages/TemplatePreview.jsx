import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';

import { ABS_APP_URL } from '../config';
import { getStoreTemplate, normalizeTemplateId, STORE_TEMPLATE_IDS } from '../templates/registry';
import { buildPreviewStore, SAMPLE_PRODUCTS } from '../templates/sampleCatalog';
import StoreTemplateShell from '../templates/StoreTemplateShell';
import { resolveImageUrl } from '../utils/fileUtils';

/** Must match Frontend TemplatePreviewFrame message types. */
const TEMPLATE_PREVIEW_READY = 'abs:template-preview-ready';
const TEMPLATE_PREVIEW_BRANDING = 'abs:template-preview-branding';

/**
 * @param {string|null|undefined} value
 * @returns {string|undefined}
 */
const compactParam = (value) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || undefined;
};

/**
 * Full-page template demo. Supports:
 * - `/templates/:templateId/preview` — demo brand + sample products (template default colors)
 * - `/templates/:templateId/preview-tenant?businessName=&logoUrl=&primaryColor=&…` — ABS iframe
 *   (also contactPhone, whatsappNumber, contactEmail, currency, description, secondary/tertiary).
 *   Large/data: logos arrive via postMessage from ABS TemplatePreviewFrame.
 * Online Store previews do not use a storefront banner.
 */
export default function TemplatePreview() {
  const { templateId: rawId } = useParams();
  const [searchParams] = useSearchParams();
  const requestedId = String(rawId || '').trim().toLowerCase();
  const templateId = normalizeTemplateId(rawId);
  const isTenantPreview = typeof window !== 'undefined'
    && window.location.pathname.includes('/preview-tenant');
  const [messageBranding, setMessageBranding] = useState(null);

  useEffect(() => {
    if (!isTenantPreview) return undefined;

    const onMessage = (event) => {
      if (event.data?.type !== TEMPLATE_PREVIEW_BRANDING) return;
      // Accept ABS dashboard / app origins; reject unrelated embeds.
      const allowed = (() => {
        try {
          const absOrigin = new URL(ABS_APP_URL).origin;
          if (event.origin === absOrigin) return true;
        } catch {
          // ignore invalid ABS_APP_URL
        }
        try {
          if (event.origin === window.location.origin) return true;
          if (event.source === window.parent) {
            const host = new URL(event.origin).hostname;
            return (
              host === 'localhost' ||
              host === '127.0.0.1' ||
              host.endsWith('.africanbusinesssuite.com') ||
              host.endsWith('.absghana.com')
            );
          }
        } catch {
          return false;
        }
        return false;
      })();
      if (!allowed) return;

      const payload = event.data?.payload;
      if (!payload || typeof payload !== 'object') return;
      setMessageBranding({
        businessName: compactParam(payload.businessName || payload.displayName),
        logoUrl: compactParam(payload.logoUrl),
        primaryColor: compactParam(payload.primaryColor),
        secondaryColor: compactParam(payload.secondaryColor),
        tertiaryColor: compactParam(payload.tertiaryColor),
        description: compactParam(payload.description),
        contactPhone: compactParam(payload.contactPhone),
        whatsappNumber: compactParam(payload.whatsappNumber),
        contactEmail: compactParam(payload.contactEmail),
        currency: compactParam(payload.currency),
      });
    };

    window.addEventListener('message', onMessage);
    // Use * so local ABS on :3000 still receives READY when VITE_ABS_APP_URL is unset/wrong.
    window.parent?.postMessage({ type: TEMPLATE_PREVIEW_READY }, '*');

    return () => window.removeEventListener('message', onMessage);
  }, [isTenantPreview]);

  const store = useMemo(() => {
    const template = getStoreTemplate(templateId);

    // Gallery demo: omit merchant colors so registry defaults apply.
    if (!isTenantPreview) {
      return buildPreviewStore({
        templateId,
        primaryColor: template.previewAccent,
      });
    }

    const businessName = messageBranding?.businessName
      || compactParam(searchParams.get('businessName'))
      || compactParam(searchParams.get('displayName'));
    const logoUrl = resolveImageUrl(
      messageBranding?.logoUrl || compactParam(searchParams.get('logoUrl')),
    ) || undefined;

    return buildPreviewStore({
      templateId,
      personalized: true,
      displayName: businessName || undefined,
      logoUrl,
      primaryColor: messageBranding?.primaryColor || compactParam(searchParams.get('primaryColor')),
      secondaryColor: messageBranding?.secondaryColor || compactParam(searchParams.get('secondaryColor')),
      tertiaryColor: messageBranding?.tertiaryColor || compactParam(searchParams.get('tertiaryColor')),
      description: messageBranding?.description || compactParam(searchParams.get('description')),
      contactPhone: messageBranding?.contactPhone || compactParam(searchParams.get('contactPhone')),
      whatsappNumber: messageBranding?.whatsappNumber || compactParam(searchParams.get('whatsappNumber')),
      contactEmail: messageBranding?.contactEmail || compactParam(searchParams.get('contactEmail')),
      currency: messageBranding?.currency || compactParam(searchParams.get('currency')),
    });
  }, [isTenantPreview, messageBranding, searchParams, templateId]);

  if (requestedId && !STORE_TEMPLATE_IDS.includes(requestedId)) {
    return <Navigate to="/templates" replace />;
  }

  const useTemplateCtaHref = `${ABS_APP_URL}/online-store?template=${encodeURIComponent(templateId)}`;

  return (
    <StoreTemplateShell
      store={store}
      products={SAMPLE_PRODUCTS}
      previewMode
      showGalleryChrome={!isTenantPreview}
      galleryBackTo="/templates"
      useTemplateCtaHref={isTenantPreview ? undefined : useTemplateCtaHref}
    />
  );
}
