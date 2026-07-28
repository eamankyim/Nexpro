/**
 * Online Store setup route planning (Ghana mobile wizard).
 *
 * Continue / Back walk the full step order (no gap-skip).
 * Gap-skip applies only to Create Store / welcome resume (`getResumeSetupHref`).
 * Progress tap remains free navigation across all steps.
 */

import { firstFilled, isValidPrimaryColor } from '@/utils/onlineStoreDefaults';

export type StoreSetupStepId =
  | 'confirm-name'
  | 'whatsapp'
  | 'logo'
  | 'color'
  | 'payments'
  | 'products'
  | 'go-live';

export type StoreSetupGapFlags = {
  needsWhatsapp: boolean;
  needsLogo: boolean;
  needsColor: boolean;
  needsPayment: boolean;
};

/** Ordered steps after welcome (welcome lives on index / store tab). */
export const STORE_SETUP_STEP_ORDER: StoreSetupStepId[] = [
  'confirm-name',
  'whatsapp',
  'logo',
  'color',
  'payments',
  'products',
  'go-live',
];

export const STORE_SETUP_STEP_META: Record<
  StoreSetupStepId,
  { title: string; progressLabel: string }
> = {
  'confirm-name': { title: 'Store name', progressLabel: 'Name' },
  whatsapp: { title: 'WhatsApp', progressLabel: 'Contact' },
  logo: { title: 'Logo', progressLabel: 'Logo' },
  color: { title: 'Brand color', progressLabel: 'Color' },
  payments: { title: 'Get paid', progressLabel: 'Payments' },
  products: { title: 'Products', progressLabel: 'Stock' },
  'go-live': { title: 'Go live', progressLabel: 'Launch' },
};

export function buildGapFlags(input: {
  contactPhone?: string | null;
  whatsappNumber?: string | null;
  logoUrl?: string | null;
  hasExplicitPrimaryColor?: boolean;
  paymentConfigured?: boolean;
}): StoreSetupGapFlags {
  const hasPhone = Boolean(String(input.contactPhone || '').trim());
  const hasWhatsapp = Boolean(String(input.whatsappNumber || '').trim());
  return {
    needsWhatsapp: !hasPhone && !hasWhatsapp,
    needsLogo: !String(input.logoUrl || '').trim(),
    needsColor: !input.hasExplicitPrimaryColor,
    needsPayment: !input.paymentConfigured,
  };
}

/**
 * @deprecated Prefer getLinearNextSetupStep for Continue.
 * Gap-skip next step — kept for resume / analytics helpers only.
 */
export function getNextSetupStep(
  current: StoreSetupStepId,
  flags: StoreSetupGapFlags
): StoreSetupStepId | null {
  const idx = STORE_SETUP_STEP_ORDER.indexOf(current);
  if (idx < 0) return 'confirm-name';

  for (let i = idx + 1; i < STORE_SETUP_STEP_ORDER.length; i += 1) {
    const step = STORE_SETUP_STEP_ORDER[i];
    if (step === 'whatsapp' && !flags.needsWhatsapp) continue;
    if (step === 'logo' && !flags.needsLogo) continue;
    if (step === 'color' && !flags.needsColor) continue;
    if (step === 'payments' && !flags.needsPayment) continue;
    return step;
  }
  return null;
}

/** Immediate previous step in the full wizard order (includes gap-skipped). */
export function getPreviousSetupStep(current: StoreSetupStepId): StoreSetupStepId | null {
  const idx = STORE_SETUP_STEP_ORDER.indexOf(current);
  if (idx <= 0) return null;
  return STORE_SETUP_STEP_ORDER[idx - 1];
}

/** Immediate next step in the full wizard order (no gap skip). */
export function getLinearNextSetupStep(current: StoreSetupStepId): StoreSetupStepId | null {
  const idx = STORE_SETUP_STEP_ORDER.indexOf(current);
  if (idx < 0 || idx >= STORE_SETUP_STEP_ORDER.length - 1) return null;
  return STORE_SETUP_STEP_ORDER[idx + 1];
}

export function setupStepHref(step: StoreSetupStepId): string {
  return `/store-setup/${step}`;
}

/**
 * Later steps (after name) require basics saved so slug/settings exist.
 * confirm-name is always reachable.
 */
export function canVisitSetupStep(
  step: StoreSetupStepId,
  opts: { hasBasics: boolean }
): boolean {
  if (step === 'confirm-name') return true;
  return Boolean(opts.hasBasics);
}

/** Progress among all wizard steps (free navigation chrome). */
export function getStepProgress(current: StoreSetupStepId): {
  index: number;
  total: number;
  label: string;
  steps: StoreSetupStepId[];
} {
  const steps = STORE_SETUP_STEP_ORDER;
  const index = Math.max(0, steps.indexOf(current));
  return {
    index: index + 1,
    total: steps.length,
    label: STORE_SETUP_STEP_META[current]?.progressLabel || '',
    steps,
  };
}

/**
 * Steps remaining when gap-filtering (resume / analytics).
 * Wizard chrome progress and Continue use the full order.
 */
export function getVisibleSteps(
  flags: StoreSetupGapFlags,
  includeConfirmName = true
): StoreSetupStepId[] {
  return STORE_SETUP_STEP_ORDER.filter((step) => {
    if (step === 'confirm-name') return includeConfirmName;
    if (step === 'whatsapp') return flags.needsWhatsapp;
    if (step === 'logo') return flags.needsLogo;
    if (step === 'color') return flags.needsColor;
    if (step === 'payments') return flags.needsPayment;
    return true;
  });
}

export type SetupChecklist = {
  hasSettings?: boolean;
  hasBasics?: boolean;
  hasContact?: boolean;
  hasPaymentMethod?: boolean;
  hasFulfillment?: boolean;
  brandingReady?: boolean;
  hasPublishedListing?: boolean;
  canLaunch?: boolean;
  launched?: boolean;
  publishedListingWarning?: boolean;
  listingsCount?: number;
};

/**
 * Single human-readable reason when launch is blocked.
 */
export function getLaunchBlockReason(checklist: SetupChecklist): string | null {
  if (checklist.canLaunch) return null;
  if (!checklist.hasSettings || !checklist.hasBasics) {
    return 'Confirm your store name to finish the basics.';
  }
  if (!checklist.hasContact) {
    return 'Add a WhatsApp or phone number so customers can reach you.';
  }
  if (!checklist.hasPaymentMethod) {
    return 'Connect Mobile Money so you can get paid online.';
  }
  if (!checklist.hasFulfillment) {
    return 'Pickup or delivery must be enabled before going live.';
  }
  return 'Finish the remaining setup steps before going live.';
}

export type ResumeSetupSettings = {
  contactPhone?: string | null;
  whatsappNumber?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
};

export type ResumeSetupExtras = {
  /** Business/org logo when store settings.logoUrl is still empty. */
  businessLogoUrl?: string | null;
  hasExplicitPrimaryColor?: boolean;
};

/**
 * First incomplete wizard step for Create Store / Continue setup.
 * Skips logo when store or business already has a logo.
 */
export function getResumeSetupStep(
  checklist: SetupChecklist,
  settings?: ResumeSetupSettings | null,
  extras?: ResumeSetupExtras | null
): StoreSetupStepId {
  if (!checklist.hasSettings || !checklist.hasBasics) {
    return 'confirm-name';
  }

  const flags = buildGapFlags({
    contactPhone: settings?.contactPhone,
    whatsappNumber: settings?.whatsappNumber,
    logoUrl: firstFilled(settings?.logoUrl, extras?.businessLogoUrl),
    hasExplicitPrimaryColor:
      extras?.hasExplicitPrimaryColor !== undefined
        ? extras.hasExplicitPrimaryColor
        : isValidPrimaryColor(settings?.primaryColor),
    paymentConfigured: Boolean(checklist.hasPaymentMethod),
  });

  for (const step of STORE_SETUP_STEP_ORDER) {
    if (step === 'confirm-name') continue;
    if (step === 'whatsapp' && flags.needsWhatsapp) return step;
    if (step === 'logo' && flags.needsLogo) return step;
    if (step === 'color' && flags.needsColor) return step;
    if (step === 'payments' && flags.needsPayment) return step;
  }

  if (checklist.canLaunch) return 'go-live';
  return 'products';
}

/** Href into the setup stack, resuming an incomplete draft when present. */
export function getResumeSetupHref(
  checklist: SetupChecklist,
  settings?: ResumeSetupSettings | null,
  extras?: ResumeSetupExtras | null
): string {
  return setupStepHref(getResumeSetupStep(checklist, settings, extras));
}
