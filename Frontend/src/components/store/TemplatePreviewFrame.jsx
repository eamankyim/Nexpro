import { useCallback, useEffect, useMemo, useRef } from 'react';

import { toAbsoluteAssetUrl, toPreviewQueryImageUrl } from '../../utils/fileUtils';
import { buildStoreTemplateTenantPreviewUrl, getTemplatesGalleryBaseUrl } from '../../utils/storefrontUrl';

/** Storefront iframe → ABS parent: ready for branding payload. */
export const TEMPLATE_PREVIEW_READY = 'abs:template-preview-ready';
/** ABS parent → storefront iframe: full branding (including data: logos). */
export const TEMPLATE_PREVIEW_BRANDING = 'abs:template-preview-branding';

/**
 * Branding fields sent to the storefront preview iframe (query + postMessage).
 * Online Store previews do not include a storefront banner.
 * @param {object} [branding]
 * @returns {{
 *   businessName?: string,
 *   logoUrl?: string,
 *   primaryColor?: string,
 *   secondaryColor?: string,
 *   tertiaryColor?: string,
 *   description?: string,
 *   contactPhone?: string,
 *   whatsappNumber?: string,
 *   contactEmail?: string,
 *   currency?: string,
 * }}
 */
export const buildTemplatePreviewBranding = (branding = {}) => {
  const businessName = String(branding.businessName || branding.displayName || '').trim() || undefined;
  return {
    businessName,
    logoUrl: toAbsoluteAssetUrl(branding.logoUrl) || undefined,
    primaryColor: String(branding.primaryColor || '').trim() || undefined,
    secondaryColor: String(branding.secondaryColor || '').trim() || undefined,
    tertiaryColor: String(branding.tertiaryColor || '').trim() || undefined,
    description: String(branding.description || '').trim() || undefined,
    contactPhone: String(branding.contactPhone || '').trim() || undefined,
    whatsappNumber: String(branding.whatsappNumber || '').trim() || undefined,
    contactEmail: String(branding.contactEmail || '').trim() || undefined,
    currency: String(branding.currency || '').trim() || undefined,
  };
};

/**
 * Query-string subset: omit data:/blob:/oversized image URLs (sent via postMessage instead).
 * @param {ReturnType<typeof buildTemplatePreviewBranding>} branding
 */
export const buildTemplatePreviewQueryBranding = (branding = {}) => ({
  ...branding,
  logoUrl: toPreviewQueryImageUrl(branding.logoUrl) || undefined,
});

/**
 * Iframe that loads a personalized storefront template preview and pushes full
 * logo URLs via postMessage (so org data: logos and /uploads paths work cross-origin).
 *
 * @param {{
 *   templateId: string,
 *   branding?: object,
 *   title?: string,
 *   className?: string,
 * }} props
 */
const TemplatePreviewFrame = ({
  templateId,
  branding = {},
  title = 'Store template preview',
  className,
}) => {
  const iframeRef = useRef(null);
  const lastPostedRef = useRef('');
  const fullBranding = useMemo(() => buildTemplatePreviewBranding(branding), [branding]);
  const queryBranding = useMemo(
    () => buildTemplatePreviewQueryBranding(fullBranding),
    [fullBranding],
  );
  const previewSrc = useMemo(
    () => buildStoreTemplateTenantPreviewUrl(templateId, queryBranding),
    [queryBranding, templateId],
  );
  const storefrontOrigin = useMemo(() => {
    try {
      return new URL(getTemplatesGalleryBaseUrl()).origin;
    } catch {
      return '';
    }
  }, []);

  const postBranding = useCallback(() => {
    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow || !storefrontOrigin) return;
    const serialized = JSON.stringify(fullBranding);
    lastPostedRef.current = serialized;
    frameWindow.postMessage(
      { type: TEMPLATE_PREVIEW_BRANDING, payload: fullBranding },
      storefrontOrigin,
    );
  }, [fullBranding, storefrontOrigin]);

  useEffect(() => {
    lastPostedRef.current = '';
  }, [previewSrc]);

  useEffect(() => {
    const onMessage = (event) => {
      if (storefrontOrigin && event.origin !== storefrontOrigin) return;
      if (event.data?.type !== TEMPLATE_PREVIEW_READY) return;
      postBranding();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [postBranding, storefrontOrigin]);

  useEffect(() => {
    const serialized = JSON.stringify(fullBranding);
    if (serialized === lastPostedRef.current) return;
    postBranding();
  }, [fullBranding, postBranding]);

  if (!previewSrc) return null;

  return (
    <iframe
      ref={iframeRef}
      title={title}
      src={previewSrc}
      className={className}
      onLoad={postBranding}
    />
  );
};

export default TemplatePreviewFrame;
