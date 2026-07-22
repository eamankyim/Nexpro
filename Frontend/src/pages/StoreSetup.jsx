import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertCircle,
  Banknote,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  ExternalLink,
  Globe2,
  ImageIcon,
  Loader2,
  Menu,
  MapPin,
  Monitor,
  Package,
  PackageCheck,
  Paintbrush,
  Pencil,
  ShoppingBag,
  Sparkles,
  Smartphone,
  Store,
  Truck,
  Upload,
  WalletCards,
} from 'lucide-react';

import OnlineStoreWelcome from '../components/store/OnlineStoreWelcome';
import storeService from '../services/storeService';
import settingsService from '../services/settingsService';
import { useAuth } from '../context/AuthContext';
import { STUDIO_LIKE_TYPES } from '../constants/studioLikeTypes';
import { useDebounce } from '../hooks/useDebounce';
import { usePaymentSettings, isPaymentConfigured } from '../hooks/usePaymentSettings';
import { CURRENCY } from '../constants';
import { showError, showSuccess, getErrorMessage } from '../utils/toast';
import { resolveImageUrl } from '../utils/fileUtils';
import { isValidPrimaryColor, normalizePrimaryColor } from '../utils/brandingColors';
import {
  buildStorefrontStoreUrl,
  getStorefrontDisplayBaseUrl,
  getStorefrontDisplayStoreUrl,
} from '../utils/storefrontUrl';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STEPS = [
  { id: 'info', label: 'Store Information', icon: Store },
  { id: 'branding', label: 'Branding', icon: Paintbrush },
  { id: 'payments', label: 'Payments', icon: WalletCards },
  { id: 'delivery', label: 'Delivery', icon: Truck },
  { id: 'launch', label: 'Launch', icon: PackageCheck },
];

const STEP_INDEX_BY_ID = STEPS.reduce((acc, step, index) => {
  acc[step.id] = index;
  return acc;
}, {});

const THEME_PRESETS = [
  { label: 'ABS Green', value: '#166534' },
  { label: 'Forest Green', value: '#14532d' },
  { label: 'Emerald', value: '#047857' },
  { label: 'Dark Green', value: '#064e3b' },
];

const CATEGORY_OPTIONS = [
  'Fashion and apparel',
  'Food and restaurants',
  'Groceries and provisions',
  'Health and pharmacy',
  'Beauty and salon',
  'Printing and creative services',
  'Electronics',
  'Home and office',
  'Other',
];

const CATEGORY_BY_BUSINESS_TYPE = {
  shop: 'Other',
  studio: 'Printing and creative services',
  printing_press: 'Printing and creative services',
  pharmacy: 'Health and pharmacy',
  barber: 'Beauty and salon',
  salon: 'Beauty and salon',
};

const CATEGORY_BY_SHOP_TYPE = {
  restaurant: 'Food and restaurants',
  bakery: 'Food and restaurants',
  supermarket: 'Groceries and provisions',
  groceries: 'Groceries and provisions',
  grocery: 'Groceries and provisions',
  convenience: 'Groceries and provisions',
  electronics: 'Electronics',
  clothing: 'Fashion and apparel',
  fashion: 'Fashion and apparel',
  beauty: 'Beauty and salon',
  furniture: 'Home and office',
};

const getTenantShopType = (activeTenant, tenantMetadata = {}) => compactString(
  activeTenant?.shopType ||
  tenantMetadata.shopType ||
  tenantMetadata.businessSubType ||
  tenantMetadata.shopTypeKey ||
  tenantMetadata.businessSubtype,
);

const resolveBusinessCategory = (activeTenant, tenantMetadata = {}) => {
  const shopType = getTenantShopType(activeTenant, tenantMetadata);
  return CATEGORY_BY_SHOP_TYPE[shopType] ||
    CATEGORY_BY_BUSINESS_TYPE[activeTenant?.businessType] ||
    'Other';
};

const resolveSavedCategory = (savedCategory, fallbackCategory) => {
  const saved = compactString(savedCategory);
  if (!saved) return fallbackCategory;
  if (saved === 'Other' && fallbackCategory && fallbackCategory !== 'Other') return fallbackCategory;
  return saved;
};

const STORE_SETUP_PAYMENTS_RETURN = '/store/setup?step=payments';
const BANNER_PROMPT_MAX_LENGTH = 500;

const PAYMENT_OPTIONS = [
  {
    key: 'mobileMoney',
    label: 'Mobile Money',
    description: 'Accept MTN MoMo, Vodafone Cash, and AirtelTigo Money through the existing checkout flow.',
    icon: Smartphone,
    available: true,
  },
  {
    key: 'card',
    label: 'Card Payments',
    description: 'Let shoppers pay with debit or credit cards where Paystack/card checkout is available.',
    icon: CreditCard,
    available: true,
  },
  {
    key: 'bankTransfer',
    label: 'Bank Transfer',
    description: 'Manual bank transfer instructions are planned for a later phase.',
    icon: Banknote,
    available: false,
  },
  {
    key: 'payOnDelivery',
    label: 'Pay on Delivery',
    description: 'Collect payment during fulfillment once order controls are wired.',
    icon: PackageCheck,
    available: false,
  },
];

const DELIVERY_OPTIONS = [
  {
    key: 'localDelivery',
    label: 'Local Delivery',
    description: 'Deliver orders within your city or nearby areas.',
    icon: Truck,
    available: true,
  },
  {
    key: 'nationwideDelivery',
    label: 'Nationwide Delivery',
    description: 'Ship to customers across Ghana with a manual confirmation flow.',
    icon: Globe2,
    available: true,
  },
  {
    key: 'pickup',
    label: 'Pickup',
    description: 'Customers can arrange pickup from your shop or preferred location.',
    icon: MapPin,
    available: true,
  },
  {
    key: 'international',
    label: 'International',
    description: 'International shipping is not part of the MVP setup.',
    icon: Globe2,
    available: false,
  },
];

const DELIVERY_EDITOR_CONFIG = {
  localDelivery: {
    title: 'Local delivery areas',
    description: 'Add nearby areas you can reach quickly.',
    fieldName: 'localDeliveryAreas',
    label: 'Delivery areas (optional)',
    placeholder: 'Osu, East Legon, Adenta...',
    multiline: true,
    includeDeliveryFee: true,
  },
  nationwideDelivery: {
    title: 'Nationwide delivery',
    description: 'Confirm regions, courier notes, and timelines.',
    fieldName: 'nationwideRegions',
    label: 'Nationwide delivery notes (optional)',
    placeholder: 'Regions, courier notes, delivery timelines...',
    multiline: true,
  },
  pickup: {
    title: 'Pickup details',
    description: 'Tell customers where and when pickup is available.',
    fieldName: 'pickupInstructions',
    label: 'Pickup instructions (optional)',
    placeholder: 'Pickup from main branch, 9am-5pm',
    multiline: false,
  },
};

const isDeliveryOptionConfigured = (optionKey, formValues) => {
  const config = DELIVERY_EDITOR_CONFIG[optionKey];
  if (!config) return false;
  return Boolean(String(formValues?.[config.fieldName] || '').trim());
};

const paymentMethodSchema = z.object({
  enabled: z.boolean().default(false),
  configured: z.boolean().default(false),
});

const deliveryOptionSchema = z.object({
  enabled: z.boolean().default(false),
  configured: z.boolean().default(false),
});

const setupSchema = z.object({
  displayName: z.string().trim().min(2, 'Store name is required'),
  slug: z.string()
    .trim()
    .min(3, 'Store URL must be at least 3 characters')
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers, and dashes only'),
  description: z.string().max(500, 'Keep the store description under 500 characters').optional(),
  category: z.string().optional(),
  whatsappNumber: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email('Enter a valid email').or(z.literal('')).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Choose a valid brand color'),
  logoUrl: z.string().optional(),
  bannerImageUrl: z.string().optional(),
  currency: z.string().trim().default(CURRENCY.CODE),
  paymentMethods: z.object({
    mobileMoney: paymentMethodSchema,
    card: paymentMethodSchema,
    bankTransfer: paymentMethodSchema,
    payOnDelivery: paymentMethodSchema,
  }),
  deliveryOptions: z.object({
    localDelivery: deliveryOptionSchema,
    nationwideDelivery: deliveryOptionSchema,
    pickup: deliveryOptionSchema,
    international: deliveryOptionSchema,
  }),
  deliveryFee: z.coerce.number().min(0, 'Delivery fee cannot be negative').default(0),
  localDeliveryAreas: z.string().optional(),
  nationwideRegions: z.string().optional(),
  pickupInstructions: z.string().optional(),
});

const normalizeSlug = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80);

const STORE_SETUP_DRAFT_VERSION = 1;
const STORE_SETUP_DRAFT_PREFIX = 'abs:store-setup-draft';

const getScopedStoragePart = (...values) => (
  values
    .map((value) => compactString(value))
    .find(Boolean) || 'unknown'
);

const getStoreSetupDraftKey = ({ activeTenant, user }) => {
  const tenantPart = getScopedStoragePart(
    activeTenant?.id,
    activeTenant?._id,
    activeTenant?.tenantId,
    activeTenant?.slug,
  );
  const userPart = getScopedStoragePart(user?.id, user?._id, user?.email);
  return `${STORE_SETUP_DRAFT_PREFIX}:v${STORE_SETUP_DRAFT_VERSION}:${tenantPart}:${userPart}`;
};

const isFileLikeValue = (value) => (
  (typeof File !== 'undefined' && value instanceof File) ||
  (typeof Blob !== 'undefined' && value instanceof Blob)
);

const omitFileLikeValues = (value) => {
  if (isFileLikeValue(value)) return undefined;
  if (Array.isArray(value)) return value.map(omitFileLikeValues).filter((item) => item !== undefined);
  if (!value || typeof value !== 'object') return value;
  return Object.entries(value).reduce((acc, [key, childValue]) => {
    const sanitizedValue = omitFileLikeValues(childValue);
    if (sanitizedValue !== undefined) acc[key] = sanitizedValue;
    return acc;
  }, {});
};

const sanitizeStoreSetupDraftValues = (values = {}) => omitFileLikeValues({
  displayName: firstFilled(values.displayName, values.storeName, values.name),
  slug: normalizeSlug(firstFilled(values.slug, values.storeUrl, values.publicUrl)),
  description: values.description || '',
  category: firstFilled(values.category, values.businessCategory),
  whatsappNumber: values.whatsappNumber || '',
  contactPhone: values.contactPhone || '',
  contactEmail: values.contactEmail || '',
  primaryColor: normalizePrimaryColor(values.primaryColor),
  logoUrl: values.logoUrl || '',
  bannerImageUrl: resolveStoreBannerImageUrl(values),
  currency: resolveStoreCurrency(values.currency),
  paymentMethods: values.paymentMethods || defaultPaymentMethods,
  deliveryOptions: values.deliveryOptions || defaultDeliveryOptions,
  deliveryFee: Number(values.deliveryFee || 0),
  localDeliveryAreas: values.localDeliveryAreas || '',
  nationwideRegions: values.nationwideRegions || '',
  pickupInstructions: values.pickupInstructions || '',
});

const readStoreSetupDraft = (storageKey) => {
  if (typeof window === 'undefined' || !storageKey) return null;
  try {
    const rawDraft = window.localStorage.getItem(storageKey);
    if (!rawDraft) return null;
    const parsedDraft = JSON.parse(rawDraft);
    if (parsedDraft?.version !== STORE_SETUP_DRAFT_VERSION || !parsedDraft?.values) return null;
    return parsedDraft;
  } catch {
    return null;
  }
};

const isDraftNewerThanSettings = (draft, settings) => {
  const draftTime = Date.parse(draft?.savedAt || '');
  const settingsTime = Date.parse(settings?.updatedAt || settings?.createdAt || '');
  return Number.isFinite(draftTime) && (!Number.isFinite(settingsTime) || draftTime > settingsTime);
};

const writeStoreSetupDraft = (storageKey, draft) => {
  if (typeof window === 'undefined' || !storageKey) return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    // Local storage can be unavailable in private browsing or quota-limited sessions.
  }
};

const writeStoreSetupValuesDraft = ({
  storageKey,
  values,
  currentStep,
  highestStepReached,
  introDismissed,
  slugManuallyEdited,
}) => {
  writeStoreSetupDraft(storageKey, {
    version: STORE_SETUP_DRAFT_VERSION,
    savedAt: new Date().toISOString(),
    values: sanitizeStoreSetupDraftValues(values),
    currentStep,
    highestStepReached,
    introDismissed,
    slugManuallyEdited,
  });
};

const clearStoreSetupDraft = (storageKey) => {
  if (typeof window === 'undefined' || !storageKey) return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage cleanup failures; backend settings remain the source of truth.
  }
};

const buildPublicStoreUrl = (slug) => {
  const normalizedSlug = normalizeSlug(slug) || 'store-url';
  return buildStorefrontStoreUrl(normalizedSlug);
};

const getPublicStoreDisplayUrl = (slug) => {
  const normalizedSlug = normalizeSlug(slug) || 'store-url';
  return getStorefrontDisplayStoreUrl(normalizedSlug);
};

const isLikelyGeneratedSlug = (slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-z0-9]{6}$/.test(slug);

const getResponseData = (response) => response?.data?.data || response?.data || response;

const getSettledData = (result) => (result?.status === 'fulfilled' ? getResponseData(result.value) : null);

const compactString = (value) => (typeof value === 'string' ? value.trim() : '');

const firstFilled = (...values) => values.map(compactString).find(Boolean) || '';

const buildDefaultBannerPrompt = (values = {}) => {
  const storeName = compactString(values.displayName) || 'my online store';
  const category = compactString(values.category) || 'retail';
  const description = compactString(values.description);
  return [
    `A clean, premium storefront banner for ${storeName}`,
    `selling ${category.toLowerCase()}`,
    description ? `with a warm visual feel inspired by: ${description}` : 'with welcoming product-inspired shapes',
  ].join(', ').slice(0, BANNER_PROMPT_MAX_LENGTH);
};

const getPlainObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

const formatAddress = (address = {}) => [
  address.line1,
  address.line2,
  [address.city, address.state].map(compactString).filter(Boolean).join(', '),
  address.postalCode,
  address.country,
].map(compactString).filter(Boolean).join(', ');

const buildStoreSetupDefaults = ({ activeTenant, user, organization, profile }) => {
  const tenantMetadata = getPlainObject(activeTenant?.metadata);
  const organizationAddress = getPlainObject(organization?.address || tenantMetadata.address);
  const addressText = formatAddress(organizationAddress);
  const localArea = [organizationAddress.city, organizationAddress.state]
    .map(compactString)
    .filter(Boolean)
    .join(', ');
  const displayName = firstFilled(
    organization?.name,
    organization?.legalName,
    activeTenant?.name,
    tenantMetadata.businessName,
    tenantMetadata.companyName,
  );
  const contactPhone = firstFilled(
    organization?.phone,
    tenantMetadata.businessPhone,
    tenantMetadata.companyPhone,
    tenantMetadata.phone,
    activeTenant?.phone,
    profile?.phone,
    profile?.phoneNumber,
    user?.phone,
    user?.phoneNumber,
  );
  const contactEmail = firstFilled(
    organization?.email,
    organization?.supportEmail,
    tenantMetadata.businessEmail,
    tenantMetadata.companyEmail,
    tenantMetadata.email,
    activeTenant?.email,
    profile?.email,
    user?.email,
  );
  const primaryColor = normalizePrimaryColor(firstFilled(
    organization?.primaryColor,
    tenantMetadata.primaryColor,
    tenantMetadata.brandColor,
  ));

  return {
    displayName,
    slug: normalizeSlug(displayName),
    description: firstFilled(
      tenantMetadata.storeDescription,
      tenantMetadata.businessDescription,
      tenantMetadata.description,
      activeTenant?.description,
    ),
    category: resolveSavedCategory(
      firstFilled(tenantMetadata.storeCategory, tenantMetadata.businessCategory),
      resolveBusinessCategory(activeTenant, tenantMetadata),
    ),
    whatsappNumber: firstFilled(
      tenantMetadata.whatsappNumber,
      tenantMetadata.whatsapp,
      contactPhone,
    ),
    contactPhone,
    contactEmail,
    primaryColor,
    logoUrl: resolveStoreLogoUrl(organization, tenantMetadata, activeTenant),
    bannerImageUrl: resolveStoreBannerImageUrl(tenantMetadata),
    currency: CURRENCY.CODE,
    paymentMethods: defaultPaymentMethods,
    deliveryOptions: defaultDeliveryOptions,
    deliveryFee: 0,
    localDeliveryAreas: localArea,
    nationwideRegions: '',
    pickupInstructions: addressText ? `Pickup from ${addressText}` : '',
  };
};

const savedOrDefault = (saved, fallback) => firstFilled(saved, fallback);

const clampStepIndex = (step) => {
  const numericStep = Number(step);
  if (!Number.isFinite(numericStep)) return 0;
  return Math.min(Math.max(Math.trunc(numericStep), 0), STEPS.length - 1);
};

const getStepIndexFromParam = (value) => (
  Object.prototype.hasOwnProperty.call(STEP_INDEX_BY_ID, value)
    ? STEP_INDEX_BY_ID[value]
    : 0
);

const getReachedStepFromCompletion = (completedSteps = []) => {
  if (!Array.isArray(completedSteps)) return 0;
  return completedSteps.reduce((highest, completed, index) => (
    completed ? Math.max(highest, clampStepIndex(index + 1)) : highest
  ), 0);
};

const defaultPaymentMethods = {
  mobileMoney: { enabled: true, configured: false },
  card: { enabled: true, configured: false },
  bankTransfer: { enabled: false, configured: false },
  payOnDelivery: { enabled: false, configured: false },
};

const resolveStoreCurrency = (...values) => {
  const saved = values.map(compactString).find(Boolean);
  return saved || CURRENCY.CODE;
};

const resolveStoreBannerImageUrl = (...sources) => firstFilled(
  ...sources.flatMap((source) => [
    source?.bannerImageUrl,
    source?.bannerUrl,
    source?.heroImageUrl,
    source?.coverImageUrl,
  ]),
);

const resolveStoreLogoUrl = (...sources) => firstFilled(
  ...sources.flatMap((source) => [
    source?.logoUrl,
    source?.logo,
    source?.companyLogoUrl,
    source?.companyLogo,
    source?.businessLogoUrl,
    source?.businessLogo,
    source?.tenantLogoUrl,
    source?.tenantLogo,
  ]),
);

const resolvePaymentMethods = (savedMethods = {}, paymentCollection = null) => {
  const merged = mergeOptions(defaultPaymentMethods, savedMethods);
  const collectionConfigured = isPaymentConfigured(paymentCollection);
  const mtnCollectionActive = ['tenant', 'platform', 'merchant_id'].includes(
    paymentCollection?.mtn_collection?.activeSource
  );
  const hubtelConnected = Boolean(paymentCollection?.hubtel_collection?.configured);

  return {
    ...merged,
    mobileMoney: {
      ...merged.mobileMoney,
      configured: collectionConfigured || mtnCollectionActive || hubtelConnected,
    },
    card: {
      ...merged.card,
      configured: collectionConfigured || hubtelConnected,
    },
  };
};

const getPaymentCollectionSettingsUrl = (methodKey, returnTo = STORE_SETUP_PAYMENTS_RETURN) => {
  const params = new URLSearchParams({
    subtab: methodKey === 'mobileMoney' ? 'merchant-id' : 'settlements',
    method: methodKey,
    returnTo,
  });
  return `/settings/payments?${params.toString()}`;
};

const defaultDeliveryOptions = {
  localDelivery: { enabled: true, configured: true },
  nationwideDelivery: { enabled: true, configured: true },
  pickup: { enabled: true, configured: true },
  international: { enabled: false, configured: false },
};

const mergeOptions = (defaults, saved = {}) => Object.keys(defaults).reduce((acc, key) => {
  acc[key] = {
    ...defaults[key],
    ...(saved?.[key] || {}),
    enabled: saved?.[key]?.enabled ?? defaults[key].enabled,
    configured: saved?.[key]?.configured ?? defaults[key].configured,
  };
  return acc;
}, {});

const mergeStoreSetupDraftValues = (baseValues = {}, draftValues = {}) => {
  const sanitizedDraft = sanitizeStoreSetupDraftValues(draftValues);

  return {
    ...baseValues,
    displayName: firstFilled(sanitizedDraft.displayName, baseValues.displayName),
    slug: firstFilled(sanitizedDraft.slug, baseValues.slug),
    description: firstFilled(sanitizedDraft.description, baseValues.description),
    category: resolveSavedCategory(sanitizedDraft.category, baseValues.category),
    whatsappNumber: firstFilled(sanitizedDraft.whatsappNumber, baseValues.whatsappNumber),
    contactPhone: firstFilled(sanitizedDraft.contactPhone, baseValues.contactPhone),
    contactEmail: firstFilled(sanitizedDraft.contactEmail, baseValues.contactEmail),
    primaryColor: normalizePrimaryColor(firstFilled(sanitizedDraft.primaryColor, baseValues.primaryColor)),
    logoUrl: firstFilled(sanitizedDraft.logoUrl, baseValues.logoUrl),
    bannerImageUrl: resolveStoreBannerImageUrl(sanitizedDraft, baseValues),
    currency: resolveStoreCurrency(sanitizedDraft.currency, baseValues.currency),
    paymentMethods: mergeOptions(baseValues.paymentMethods, sanitizedDraft.paymentMethods),
    deliveryOptions: mergeOptions(baseValues.deliveryOptions, sanitizedDraft.deliveryOptions),
    deliveryFee: Number.isFinite(Number(sanitizedDraft.deliveryFee))
      ? Number(sanitizedDraft.deliveryFee)
      : Number(baseValues.deliveryFee ?? 0),
    localDeliveryAreas: firstFilled(sanitizedDraft.localDeliveryAreas, baseValues.localDeliveryAreas),
    nationwideRegions: firstFilled(sanitizedDraft.nationwideRegions, baseValues.nationwideRegions),
    pickupInstructions: firstFilled(sanitizedDraft.pickupInstructions, baseValues.pickupInstructions),
  };
};

const getStepFields = (step) => {
  if (step === 0) return ['displayName', 'slug', 'description', 'category', 'whatsappNumber', 'contactPhone', 'contactEmail'];
  if (step === 1) return ['primaryColor', 'logoUrl', 'bannerImageUrl'];
  if (step === 2) return ['currency', 'paymentMethods'];
  if (step === 3) return ['deliveryOptions', 'deliveryFee', 'localDeliveryAreas', 'nationwideRegions', 'pickupInstructions'];
  return undefined;
};

const OptionStatus = ({ enabled, configured, unavailable }) => {
  if (unavailable) {
    return <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">Coming soon</Badge>;
  }
  if (enabled && configured) {
    return <Badge className="bg-green-700 text-white hover:bg-green-700">Ready</Badge>;
  }
  if (enabled) {
    return <Badge variant="outline" className="border-amber-300 text-amber-700">Needs setup</Badge>;
  }
  return <Badge variant="secondary">Off</Badge>;
};

const Stepper = ({ currentStep, completion, highestStepReached, onStepClick }) => (
  <div className="rounded-2xl border border-border bg-background px-2 py-4 sm:p-4">
    <div className="grid grid-cols-5 items-start">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isActive = index === currentStep;
        const isDone = completion[index];
        const isReached = index <= currentStep || isDone;
        const canOpenStep = index <= highestStepReached;
        return (
          <div key={step.id} className="relative flex min-w-0 flex-col items-center">
            {index > 0 && (
              <span className={cn(
                'absolute left-0 top-[18px] h-0.5 w-1/2',
                index <= highestStepReached ? 'bg-green-700' : 'bg-border',
              )}
              />
            )}
            {index < STEPS.length - 1 && (
              <span className={cn(
                'absolute right-0 top-[18px] h-0.5 w-1/2',
                index < highestStepReached ? 'bg-green-700' : 'bg-border',
              )}
              />
            )}
            <button
              type="button"
              onClick={() => onStepClick(index)}
              disabled={!canOpenStep}
              aria-current={isActive ? 'step' : undefined}
              className={cn(
                'relative z-10 flex h-9 w-9 items-center justify-center rounded-full border bg-background text-sm transition-colors sm:h-10 sm:w-10',
                isDone && 'border-green-700 bg-green-700 text-white',
                isActive && !isDone && 'border-green-700 bg-green-50 text-green-700',
                !isActive && !isDone && 'border-border text-muted-foreground hover:bg-muted/50',
                !canOpenStep && 'cursor-not-allowed hover:bg-background',
              )}
            >
              <span className="sr-only">Go to {step.label}</span>
              {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => onStepClick(index)}
              disabled={!canOpenStep}
              className={cn(
                'mt-2 min-h-8 max-w-[4.5rem] text-center text-[11px] font-medium leading-tight sm:max-w-none sm:text-xs',
                isReached ? 'text-green-800' : 'text-muted-foreground',
                !canOpenStep && 'cursor-not-allowed',
              )}
            >
              {step.label}
            </button>
          </div>
        );
      })}
    </div>
  </div>
);

const UploadField = ({
  label,
  description,
  value,
  onChange,
  onUpload,
  uploading,
  previewClassName = 'h-32',
  previewAreaClassName,
  imageClassName,
  actionSlot = null,
}) => {
  const previewSrc = resolveImageUrl(value);
  return (
  <div className="rounded-xl border border-border p-4">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Upload
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => onUpload(event.target.files?.[0])}
            disabled={uploading}
          />
        </label>
        {actionSlot}
      </div>
    </div>
    {previewSrc ? (
      <div className={cn('mt-4 overflow-hidden rounded-xl border border-border bg-muted/30', previewAreaClassName)}>
        <img src={previewSrc} alt="" className={cn('w-full object-cover', previewClassName, imageClassName)} />
      </div>
    ) : (
      <div className={cn('mt-4 flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground', previewClassName, previewAreaClassName)}>
        <ImageIcon className="mr-2 h-4 w-4" />
        No image uploaded yet
      </div>
    )}
    <Input className="mt-3 h-11 rounded-xl" placeholder="/uploads/... or https://..." value={value || ''} onChange={(event) => onChange(event.target.value)} />
  </div>
  );
};

const StorePreview = ({
  values,
  previewSlug,
  previewMode,
  onPreviewModeChange,
  enabledPaymentMethods,
  enabledDeliveryOptions,
  className,
  sticky = false,
}) => {
  const whatsapp = values.whatsappNumber || values.contactPhone;
  const previewCurrencyCode = values.currency || CURRENCY.CODE;
  const previewCurrencySymbol = previewCurrencyCode === CURRENCY.CODE ? CURRENCY.SYMBOL : previewCurrencyCode;
  const containerClass = previewMode === 'mobile' ? 'mx-auto max-w-[320px]' : 'w-full';
  const logoSrc = resolveImageUrl(values.logoUrl);
  const bannerSrc = resolveImageUrl(values.bannerImageUrl);

  return (
    <Card className={cn('border border-border', sticky && 'sticky top-4', className)}>
      <CardHeader className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Live preview</CardTitle>
          <Tabs value={previewMode} onValueChange={onPreviewModeChange}>
            <TabsList>
              <TabsTrigger value="desktop"><Monitor className="mr-2 h-4 w-4" />Desktop</TabsTrigger>
              <TabsTrigger value="mobile"><Smartphone className="mr-2 h-4 w-4" />Mobile</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <p className="text-sm text-muted-foreground">Updates as you complete each setup step.</p>
      </CardHeader>
      <CardContent>
        <div className={containerClass}>
          <div className="overflow-hidden rounded-2xl border border-border bg-background">
            <div
              className="relative h-28 overflow-hidden bg-muted"
              style={{ backgroundColor: bannerSrc ? undefined : values.primaryColor }}
            >
              {bannerSrc && <img src={bannerSrc} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted">
                  {logoSrc ? (
                    <img src={logoSrc} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Store className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{values.displayName || 'Your store'}</h3>
                  <a
                    href={buildPublicStoreUrl(previewSlug)}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-xs text-muted-foreground hover:text-green-700"
                  >
                    {getPublicStoreDisplayUrl(previewSlug)}
                  </a>
                </div>
              </div>
              <p className="min-h-12 text-sm text-muted-foreground">
                {values.description || 'Describe what shoppers can buy from your store.'}
              </p>
              <div className="mt-5 rounded-xl border border-border p-3">
                <div className="h-24 rounded-lg bg-muted" />
                <p className="mt-3 text-sm font-medium">Sample listing</p>
                <p className="mt-1 text-xs text-muted-foreground">Product cards will show photos, public prices, and order actions.</p>
                <Button className="mt-3 w-full" style={{ backgroundColor: values.primaryColor || undefined }}>
                  Order now
                </Button>
              </div>
              <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
                <p>Payments: {enabledPaymentMethods.length ? enabledPaymentMethods.join(', ') : 'Not configured'}</p>
                <p>Currency: {previewCurrencyCode}</p>
                <p>Fulfillment: {enabledDeliveryOptions.length ? enabledDeliveryOptions.join(', ') : 'Not configured'}</p>
                {whatsapp && <p>WhatsApp: wa.me/{String(whatsapp).replace(/\D/g, '')}</p>}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const BannerGeneratorDialog = ({
  open,
  onOpenChange,
  prompt,
  onPromptChange,
  styleHint,
  onStyleHintChange,
  generatedBanner,
  generating,
  saving,
  onGenerate,
  onUseBanner,
}) => {
  const previewSrc = resolveImageUrl(generatedBanner?.imageUrl || generatedBanner?.bannerImageUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,760px)] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate banner with AI</DialogTitle>
          <DialogDescription>
            Describe the storefront mood you want. The generated banner can replace or supplement a manual upload.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="banner-generator-prompt">Banner prompt</Label>
            <Textarea
              id="banner-generator-prompt"
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value.slice(0, BANNER_PROMPT_MAX_LENGTH))}
              rows={5}
              className="rounded-xl"
              placeholder="A bright banner with product shapes, friendly shopping energy, and a clean green brand accent."
              disabled={generating}
            />
            <div className="text-right text-xs text-muted-foreground">{String(prompt || '').length}/{BANNER_PROMPT_MAX_LENGTH}</div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="banner-generator-style-hint">Style or color hints (optional)</Label>
            <Input
              id="banner-generator-style-hint"
              value={styleHint}
              onChange={(event) => onStyleHintChange(event.target.value)}
              className="h-11 rounded-xl"
              placeholder="Modern, minimal, Ghana-inspired, use #166534 accents"
              disabled={generating}
            />
          </div>
          {previewSrc ? (
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <p className="mb-2 text-sm font-medium">Generated preview</p>
              <div className="overflow-hidden rounded-xl border border-border bg-background">
                <img src={previewSrc} alt="Generated store banner preview" className="h-40 w-full object-cover sm:h-52" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Generated as SVG vector artwork using your AI provider. Review before applying it to your public store.
              </p>
            </div>
          ) : (
            <div className="flex min-h-36 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
              {generating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating banner...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Your generated banner preview will appear here
                </span>
              )}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={generating}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={onGenerate}
            disabled={generating || String(prompt || '').trim().length < 8}
          >
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {generatedBanner ? 'Regenerate' : 'Generate'}
          </Button>
          <Button type="button" className="rounded-xl" onClick={onUseBanner} disabled={generating || saving || !previewSrc}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {saving ? 'Saving banner...' : 'Use this banner'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DeliveryAreasEditorDialog = ({
  open,
  optionKey,
  onOpenChange,
  form,
  onSaved,
}) => {
  const config = optionKey ? DELIVERY_EDITOR_CONFIG[optionKey] : null;

  if (!config) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,720px)] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <DialogBody className="space-y-4">
          {config.includeDeliveryFee && (
            <FormField control={form.control} name="deliveryFee" render={({ field }) => (
              <FormItem>
                <FormLabel>Base delivery fee</FormLabel>
                <FormControl>
                  <Input className="h-11 rounded-xl" type="number" min="0" step="0.01" {...field} />
                </FormControl>
                <FormDescription>Use 0 if you confirm fees manually.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
          )}
          <FormField control={form.control} name={config.fieldName} render={({ field }) => (
            <FormItem>
              <FormLabel>{config.label}</FormLabel>
              <FormControl>
                {config.multiline ? (
                  <Textarea className="rounded-xl" rows={4} placeholder={config.placeholder} {...field} />
                ) : (
                  <Input className="h-11 rounded-xl" placeholder={config.placeholder} {...field} />
                )}
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          </DialogBody>
        </Form>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="rounded-xl" onClick={onSaved}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const SummaryCard = ({ title, status, children, onEdit }) => (
  <div className="rounded-xl border border-border p-4">
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <p className="font-medium">{title}</p>
        <p className={cn('text-sm', status.ready ? 'text-green-700' : 'text-amber-700')}>{status.label}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onEdit}>
        <Pencil className="mr-2 h-3.5 w-3.5" />
        Edit
      </Button>
    </div>
    <div className="text-sm text-muted-foreground">{children}</div>
  </div>
);

const MobileStoreTopBar = ({ onBack }) => (
  <div className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
      <Button type="button" variant="ghost" size="sm" className="-ml-2 h-10 px-2" onClick={onBack}>
        <ChevronLeft className="mr-1 h-4 w-4" />
        Back
      </Button>
      <p className="text-center text-base font-semibold">Sabito Store Setup</p>
      <Button type="button" variant="ghost" size="icon" className="-mr-2 h-10 w-10" aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </Button>
    </div>
  </div>
);

const StoreSetup = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeTenant, user } = useAuth();
  const isStudioStore = STUDIO_LIKE_TYPES.includes(activeTenant?.businessType);
  const initialStep = getStepIndexFromParam(searchParams.get('step'));
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [highestStepReached, setHighestStepReached] = useState(initialStep);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [slugStatus, setSlugStatus] = useState({ state: 'idle', message: '' });
  const [uploadingField, setUploadingField] = useState(null);
  const [previewMode, setPreviewMode] = useState('desktop');
  const [introDismissed, setIntroDismissed] = useState(false);
  const [activeDeliveryEditor, setActiveDeliveryEditor] = useState(null);
  const [bannerGeneratorOpen, setBannerGeneratorOpen] = useState(false);
  const [bannerPrompt, setBannerPrompt] = useState('');
  const [bannerStyleHint, setBannerStyleHint] = useState('');
  const [generatedBanner, setGeneratedBanner] = useState(null);
  const [generatingBanner, setGeneratingBanner] = useState(false);
  const slugEditedRef = useRef(false);
  const draftInitializedRef = useRef(false);
  const {
    paymentCollection,
    isLoading: paymentCollectionLoading,
  } = usePaymentSettings({
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  const form = useForm({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      displayName: '',
      slug: '',
      description: '',
      category: '',
      whatsappNumber: '',
      contactPhone: '',
      contactEmail: '',
      primaryColor: '#166534',
      logoUrl: '',
      bannerImageUrl: '',
      currency: CURRENCY.CODE,
      paymentMethods: defaultPaymentMethods,
      deliveryOptions: defaultDeliveryOptions,
      deliveryFee: 0,
      localDeliveryAreas: '',
      nationwideRegions: '',
      pickupInstructions: '',
    },
  });

  const values = form.watch();
  const hasUnsavedChanges = form.formState.isDirty;
  const storeSetupDraftKey = useMemo(() => getStoreSetupDraftKey({ activeTenant, user }), [activeTenant, user]);
  const debouncedSlug = useDebounce(values.slug, 500);
  const slugSuggestion = useMemo(() => normalizeSlug(values.displayName), [values.displayName]);
  const previewSlug = useMemo(() => {
    const suggested = normalizeSlug(values.displayName);
    const current = normalizeSlug(values.slug);
    if (
      !slugEditedRef.current ||
      !current ||
      current === slugSuggestion ||
      isLikelyGeneratedSlug(current)
    ) {
      return suggested || current || 'store-url';
    }
    return current || suggested || 'store-url';
  }, [values.displayName, values.slug, slugSuggestion]);
  const resolvedStoreSlug = useMemo(() => (
    normalizeSlug(settings?.slug || values.slug || previewSlug)
  ), [previewSlug, settings?.slug, values.slug]);
  const publicStoreUrl = useMemo(() => (
    resolvedStoreSlug ? buildPublicStoreUrl(resolvedStoreSlug) : ''
  ), [resolvedStoreSlug]);
  const publicApiPreviewPath = resolvedStoreSlug ? `/api/public/store/${resolvedStoreSlug}` : '';
  const checklistItems = useMemo(() => ([
    ['Store information', checklist?.hasBasics],
    ['Branding', checklist?.brandingReady],
    ['Contact details', checklist?.hasContact],
    ['Fulfillment', checklist?.hasFulfillment],
    ['Published listing', checklist?.hasPublishedListing],
  ]), [
    checklist?.brandingReady,
    checklist?.hasBasics,
    checklist?.hasContact,
    checklist?.hasFulfillment,
    checklist?.hasPublishedListing,
  ]);
  const storeInfoSummary = useMemo(() => {
    const storeName = compactString(values.displayName);
    const category = compactString(values.category);
    const publicSlug = normalizeSlug(values.slug) || normalizeSlug(storeName) || previewSlug;

    return {
      storeName: storeName || 'Store name missing',
      publicUrl: getPublicStoreDisplayUrl(publicSlug),
      category: category || 'No category selected',
    };
  }, [previewSlug, values.category, values.displayName, values.slug]);

  const enabledPaymentMethods = useMemo(() => (
    PAYMENT_OPTIONS
      .filter((option) => values.paymentMethods?.[option.key]?.enabled && values.paymentMethods?.[option.key]?.configured)
      .map((option) => option.label)
  ), [values.paymentMethods]);

  const enabledDeliveryOptions = useMemo(() => (
    DELIVERY_OPTIONS
      .filter((option) => values.deliveryOptions?.[option.key]?.enabled)
      .map((option) => option.label)
  ), [values.deliveryOptions]);

  const readiness = useMemo(() => {
    const displayName = compactString(values.displayName);
    const slug = compactString(values.slug);
    const storeInfoReady = Boolean(
      displayName &&
      slug &&
      /^[a-z0-9-]+$/.test(slug) &&
      (
        compactString(values.contactPhone) ||
        compactString(values.whatsappNumber) ||
        compactString(values.contactEmail)
      )
    );
    const brandingReady = isValidPrimaryColor(values.primaryColor);
    const paymentReady = PAYMENT_OPTIONS.some((option) => (
      option.available &&
      values.paymentMethods?.[option.key]?.enabled &&
      values.paymentMethods?.[option.key]?.configured
    ));
    const deliveryReady = DELIVERY_OPTIONS.some((option) => (
      option.available && values.deliveryOptions?.[option.key]?.enabled
    ));
    const launchReady = storeInfoReady && paymentReady && deliveryReady && slugStatus.state !== 'taken';

    return {
      storeInfoReady,
      brandingReady,
      paymentReady,
      deliveryReady,
      launchReady,
      publishedListingReady: checklist?.hasPublishedListing === true,
    };
  }, [checklist?.hasPublishedListing, slugStatus.state, values]);

  const readinessByStep = useMemo(() => [
    readiness.storeInfoReady,
    readiness.brandingReady,
    readiness.paymentReady,
    readiness.deliveryReady,
    settings?.enabled === true,
  ], [readiness, settings?.enabled]);

  const stepCompletion = useMemo(() => readinessByStep.map((ready, index) => (
    index < highestStepReached || (index === currentStep && ready)
  )), [currentStep, highestStepReached, readinessByStep]);

  const setupProgress = useMemo(() => {
    if (STEPS.length <= 1) return 100;
    return Math.round((highestStepReached / (STEPS.length - 1)) * 100);
  }, [highestStepReached]);

  const showWelcomeIntro = useMemo(() => (
    !introDismissed &&
    !searchParams.has('step') &&
    !loading &&
    !settings?.id &&
    checklist?.hasSettings !== true
  ), [checklist?.hasSettings, introDismissed, loading, searchParams, settings?.id]);

  const persistDraft = useCallback((overrides = {}) => {
    if (!draftInitializedRef.current || loading || settings?.id) return;
    const nextCurrentStep = overrides.currentStep ?? currentStep;
    const nextHighestStepReached = overrides.highestStepReached ?? highestStepReached;
    writeStoreSetupDraft(storeSetupDraftKey, {
      version: STORE_SETUP_DRAFT_VERSION,
      savedAt: new Date().toISOString(),
      values: sanitizeStoreSetupDraftValues(form.getValues()),
      currentStep: nextCurrentStep,
      highestStepReached: nextHighestStepReached,
      introDismissed: overrides.introDismissed ?? introDismissed,
      slugManuallyEdited: slugEditedRef.current,
    });
  }, [
    currentStep,
    form,
    highestStepReached,
    introDismissed,
    loading,
    settings?.id,
    storeSetupDraftKey,
  ]);

  const moveToStep = useCallback((step, options = {}) => {
    const nextStep = clampStepIndex(step);
    const nextHighestStepReached = Math.max(highestStepReached, nextStep);
    persistDraft({
      currentStep: nextStep,
      highestStepReached: nextHighestStepReached,
      introDismissed: options.introDismissed ?? introDismissed,
    });
    setCurrentStep(nextStep);
    setHighestStepReached((reached) => Math.max(reached, nextStep));
    setSearchParams((previousParams) => {
      const nextParams = new URLSearchParams(previousParams);
      nextParams.set('step', STEPS[nextStep].id);
      return nextParams;
    }, { replace: options.replace ?? true });
    if (options.scroll !== false) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [highestStepReached, introDismissed, persistDraft, setSearchParams]);

  const handleStartSetup = useCallback(() => {
    setIntroDismissed(true);
    moveToStep(0, { introDismissed: true, replace: true });
  }, [moveToStep]);

  const loadStore = useCallback(async ({ force = false } = {}) => {
    const preserveInProgressValues = !force && draftInitializedRef.current;
    setLoading(true);
    try {
      const [settingsResponse, statusResponse, organizationResponse, profileResponse] = await Promise.allSettled([
        storeService.getSettings(),
        storeService.getSetupStatus(),
        settingsService.getOrganization(),
        settingsService.getProfile(),
      ]);
      if (settingsResponse.status === 'rejected') throw settingsResponse.reason;
      if (statusResponse.status === 'rejected') throw statusResponse.reason;

      const nextSettings = getSettledData(settingsResponse);
      const statusData = getSettledData(statusResponse);
      const organization = getSettledData(organizationResponse);
      const profile = getSettledData(profileResponse);
      const metadata = nextSettings?.metadata || {};
      const inferredDefaults = buildStoreSetupDefaults({
        activeTenant,
        user,
        organization,
        profile,
      });
      const savedPaymentMethods = resolvePaymentMethods(metadata.paymentMethods);
      const savedDeliveryOptions = mergeOptions(defaultDeliveryOptions, {
        ...metadata.deliveryOptions,
        localDelivery: metadata.deliveryOptions?.localDelivery || {
          enabled: nextSettings?.deliveryEnabled === true,
          configured: nextSettings?.deliveryEnabled === true,
        },
        pickup: metadata.deliveryOptions?.pickup || {
          enabled: nextSettings?.pickupEnabled !== false,
          configured: nextSettings?.pickupEnabled !== false,
        },
      });

      setSettings(nextSettings || null);
      setChecklist(statusData?.checklist || null);
      const resolvedDisplayName = savedOrDefault(nextSettings?.displayName, inferredDefaults.displayName);
      const savedSlug = normalizeSlug(nextSettings?.slug);
      const tenantSlug = normalizeSlug(activeTenant?.slug);
      const suggestedSlug = normalizeSlug(resolvedDisplayName || inferredDefaults.displayName);
      const savedSlugManuallyEdited = metadata.slugManuallyEdited === true;
      const hasCustomSavedSlug = Boolean(
        savedSlug &&
        (
          (savedSlugManuallyEdited && !isLikelyGeneratedSlug(savedSlug)) ||
          (savedSlug !== tenantSlug && savedSlug !== suggestedSlug && !isLikelyGeneratedSlug(savedSlug))
        )
      );
      const resolvedSlug = hasCustomSavedSlug ? savedSlug : savedOrDefault(suggestedSlug, inferredDefaults.slug);
      slugEditedRef.current = hasCustomSavedSlug;

      const baseValues = {
        displayName: resolvedDisplayName,
        slug: resolvedSlug,
        description: savedOrDefault(nextSettings?.description, inferredDefaults.description),
        category: resolveSavedCategory(metadata.category, inferredDefaults.category),
        whatsappNumber: savedOrDefault(nextSettings?.whatsappNumber, inferredDefaults.whatsappNumber),
        contactPhone: savedOrDefault(nextSettings?.contactPhone, inferredDefaults.contactPhone),
        contactEmail: savedOrDefault(nextSettings?.contactEmail, inferredDefaults.contactEmail),
        primaryColor: normalizePrimaryColor(savedOrDefault(nextSettings?.primaryColor, inferredDefaults.primaryColor)),
        logoUrl: resolveStoreLogoUrl(
          nextSettings,
          statusData?.settings,
          metadata,
          organization,
          activeTenant?.metadata,
          activeTenant,
          inferredDefaults,
        ),
        bannerImageUrl: resolveStoreBannerImageUrl(nextSettings, metadata, inferredDefaults),
        currency: resolveStoreCurrency(nextSettings?.currency, inferredDefaults.currency),
        paymentMethods: nextSettings?.id
          ? savedPaymentMethods
          : resolvePaymentMethods(inferredDefaults.paymentMethods),
        deliveryOptions: nextSettings?.id ? savedDeliveryOptions : inferredDefaults.deliveryOptions,
        deliveryFee: Number(nextSettings?.deliveryFee || inferredDefaults.deliveryFee || 0),
        localDeliveryAreas: savedOrDefault(metadata.localDeliveryAreas, inferredDefaults.localDeliveryAreas),
        nationwideRegions: savedOrDefault(metadata.nationwideRegions, inferredDefaults.nationwideRegions),
        pickupInstructions: savedOrDefault(metadata.pickupInstructions, inferredDefaults.pickupInstructions),
      };
      const localDraft = readStoreSetupDraft(storeSetupDraftKey);
      const shouldRestoreLocalDraft = Boolean(
        localDraft?.values &&
        (!nextSettings?.id || isDraftNewerThanSettings(localDraft, nextSettings))
      );
      const localDraftValues = shouldRestoreLocalDraft ? localDraft.values : null;
      if (nextSettings?.id && localDraft && !shouldRestoreLocalDraft) {
        clearStoreSetupDraft(storeSetupDraftKey);
      }
      let restoredValues = localDraftValues
        ? mergeStoreSetupDraftValues(baseValues, localDraftValues)
        : baseValues;

      if (localDraftValues) {
        slugEditedRef.current = localDraft.slugManuallyEdited === true;
      }

      if (preserveInProgressValues) {
        restoredValues = mergeStoreSetupDraftValues(
          restoredValues,
          sanitizeStoreSetupDraftValues(form.getValues()),
        );
      }

      form.reset(restoredValues);

      if (preserveInProgressValues) {
        draftInitializedRef.current = true;
        return;
      }

      if (nextSettings?.id) {
        const savedStep = clampStepIndex(metadata.setupProgress?.currentStep || 0);
        const stepParam = new URLSearchParams(window.location.search).get('step');
        const requestedStep = stepParam
          ? getStepIndexFromParam(stepParam)
          : savedStep;
        setCurrentStep(requestedStep);
        setHighestStepReached(Math.max(
          requestedStep,
          savedStep,
          getReachedStepFromCompletion(metadata.setupProgress?.completedSteps),
        ));
      } else if (localDraftValues) {
        const draftStep = clampStepIndex(localDraft.currentStep);
        const stepParam = new URLSearchParams(window.location.search).get('step');
        const requestedStep = stepParam
          ? getStepIndexFromParam(stepParam)
          : draftStep;
        const restoredHighestStep = Math.max(
          requestedStep,
          draftStep,
          clampStepIndex(localDraft.highestStepReached),
        );
        setCurrentStep(requestedStep);
        setHighestStepReached(restoredHighestStep);
        setIntroDismissed(localDraft.introDismissed === true || restoredHighestStep > 0);
      }
      draftInitializedRef.current = true;
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to load store setup'));
    } finally {
      setLoading(false);
    }
  }, [activeTenant, form, storeSetupDraftKey, user]);

  useEffect(() => {
    loadStore();
  }, [loadStore]);

  useEffect(() => {
    if (paymentCollectionLoading) return;
    const currentPaymentMethods = form.getValues('paymentMethods');
    const nextPaymentMethods = resolvePaymentMethods(currentPaymentMethods, paymentCollection);
    const hasPaymentStatusChange = PAYMENT_OPTIONS.some((option) => (
      Boolean(currentPaymentMethods?.[option.key]?.configured) !== Boolean(nextPaymentMethods?.[option.key]?.configured)
    ));
    if (!hasPaymentStatusChange) return;
    form.setValue('paymentMethods', nextPaymentMethods, { shouldDirty: false, shouldValidate: true });
  }, [form, paymentCollection, paymentCollectionLoading]);

  useEffect(() => {
    if (!draftInitializedRef.current || loading || settings?.id) return undefined;
    const timeoutId = window.setTimeout(() => persistDraft(), 250);
    return () => window.clearTimeout(timeoutId);
  }, [currentStep, highestStepReached, introDismissed, loading, persistDraft, settings?.id, values]);

  useEffect(() => {
    if (!introDismissed) return;
    if (searchParams.has('step')) return;
    setSearchParams((previousParams) => {
      const nextParams = new URLSearchParams(previousParams);
      nextParams.set('step', STEPS[currentStep].id);
      return nextParams;
    }, { replace: true });
  }, [currentStep, introDismissed, searchParams, setSearchParams]);

  useEffect(() => {
    if (!searchParams.has('step')) return;
    const stepFromUrl = getStepIndexFromParam(searchParams.get('step'));
    if (stepFromUrl === currentStep) return;
    setCurrentStep(stepFromUrl);
    setHighestStepReached((reached) => Math.max(reached, stepFromUrl));
  }, [currentStep, searchParams]);

  useEffect(() => {
    if (loading || !slugSuggestion || values.slug === slugSuggestion) return;
    if (
      slugEditedRef.current &&
      values.slug &&
      !isLikelyGeneratedSlug(values.slug) &&
      values.slug !== slugSuggestion
    ) {
      return;
    }
    form.setValue('slug', slugSuggestion, { shouldValidate: true });
  }, [form, loading, slugSuggestion, values.slug]);

  useEffect(() => {
    let cancelled = false;
    if (!debouncedSlug || debouncedSlug.length < 3 || !/^[a-z0-9-]+$/.test(debouncedSlug)) {
      setSlugStatus({ state: 'idle', message: 'Use lowercase letters, numbers, and dashes.' });
      return () => { cancelled = true; };
    }

    setSlugStatus({ state: 'checking', message: 'Checking store URL availability...' });
    storeService.checkSlugAvailability(debouncedSlug)
      .then((response) => {
        if (cancelled) return;
        const data = getResponseData(response);
        setSlugStatus(data?.available
          ? { state: 'available', message: 'Store URL is available.' }
          : { state: 'taken', message: data?.message || 'Store URL is already taken.' });
      })
      .catch(() => {
        if (!cancelled) setSlugStatus({ state: 'unknown', message: 'Availability will be checked when you save.' });
      });

    return () => { cancelled = true; };
  }, [debouncedSlug]);

  const handleStoreNameBlur = useCallback(() => {
    if (!slugEditedRef.current && !form.getValues('slug') && slugSuggestion) {
      form.setValue('slug', slugSuggestion, { shouldValidate: true });
    }
  }, [form, slugSuggestion]);

  const handleStepClick = useCallback((step) => {
    if (step > highestStepReached) return;
    moveToStep(step);
  }, [highestStepReached, moveToStep]);

  const handleCopyApiPreview = useCallback(async () => {
    if (!publicApiPreviewPath) {
      showError('Set up your store URL before copying the public API path.');
      return;
    }

    try {
      await navigator.clipboard.writeText(publicApiPreviewPath);
      showSuccess('Public API path copied');
    } catch (error) {
      showError('Could not copy the public API path');
    }
  }, [publicApiPreviewPath]);

  const handleNext = useCallback(async () => {
    const valid = await form.trigger(getStepFields(currentStep));
    if (!valid) return;
    if (currentStep === 0 && ['checking', 'taken'].includes(slugStatus.state)) return;
    moveToStep(currentStep + 1);
  }, [currentStep, form, moveToStep, slugStatus.state]);

  const handleBack = useCallback(() => {
    moveToStep(currentStep - 1);
  }, [currentStep, moveToStep]);

  const handleOptionToggle = useCallback((fieldName, key, enabled, available = true) => {
    if (!available) return;
    form.setValue(`${fieldName}.${key}.enabled`, enabled, { shouldDirty: true, shouldValidate: true });
    if (fieldName === 'deliveryOptions') {
      const configured = enabled ? isDeliveryOptionConfigured(key, form.getValues()) : false;
      form.setValue(`${fieldName}.${key}.configured`, configured, { shouldDirty: true, shouldValidate: true });
    }
  }, [form]);

  const handleConfigurePaymentMethod = useCallback((methodKey, available = true) => {
    if (!available) return;
    navigate(getPaymentCollectionSettingsUrl(methodKey));
  }, [navigate]);

  const handleOpenDeliveryEditor = useCallback((optionKey, available = true) => {
    if (!available || !DELIVERY_EDITOR_CONFIG[optionKey]) return;
    const current = form.getValues(`deliveryOptions.${optionKey}`);
    if (!current?.enabled) {
      form.setValue(`deliveryOptions.${optionKey}.enabled`, true, { shouldDirty: true, shouldValidate: true });
    }
    setActiveDeliveryEditor(optionKey);
  }, [form]);

  const handleDeliveryEditorSaved = useCallback(() => {
    if (!activeDeliveryEditor) return;
    const formValues = form.getValues();
    const configured = isDeliveryOptionConfigured(activeDeliveryEditor, formValues);
    form.setValue(`deliveryOptions.${activeDeliveryEditor}.configured`, configured, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setActiveDeliveryEditor(null);
  }, [activeDeliveryEditor, form]);

  const handleAssetUpload = useCallback(async (fieldName, file) => {
    if (!file) return;
    setUploadingField(fieldName);
    try {
      const imageUrl = await storeService.uploadStoreAsset(file);
      if (!imageUrl) throw new Error('Upload did not return an image URL');
      form.setValue(fieldName, imageUrl, { shouldDirty: true, shouldValidate: true });
      showSuccess('Image uploaded');
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to upload image'));
    } finally {
      setUploadingField(null);
    }
  }, [form]);

  const handleOpenBannerGenerator = useCallback(() => {
    setBannerPrompt(buildDefaultBannerPrompt(form.getValues()));
    setBannerStyleHint(`Use ${form.getValues('primaryColor') || '#166534'} as the main brand accent.`);
    setGeneratedBanner(null);
    setBannerGeneratorOpen(true);
  }, [form]);

  const handleGenerateBanner = useCallback(async () => {
    const prompt = compactString(bannerPrompt);
    if (prompt.length < 8 || generatingBanner) return;

    setGeneratingBanner(true);
    try {
      const formValues = form.getValues();
      const response = await storeService.generateBanner({
        prompt,
        styleHint: bannerStyleHint,
        storeName: formValues.displayName,
        category: formValues.category,
        description: formValues.description,
        primaryColor: normalizePrimaryColor(formValues.primaryColor),
      });
      const data = getResponseData(response);
      const imageUrl = data?.imageUrl || data?.bannerImageUrl;
      if (!imageUrl) throw new Error('AI did not return a banner image');
      setGeneratedBanner({ ...data, imageUrl });
      const nextValues = { ...form.getValues(), bannerImageUrl: imageUrl };
      form.setValue('bannerImageUrl', imageUrl, { shouldDirty: true, shouldValidate: true });
      writeStoreSetupValuesDraft({
        storageKey: storeSetupDraftKey,
        values: nextValues,
        currentStep,
        highestStepReached,
        introDismissed,
        slugManuallyEdited: slugEditedRef.current,
      });
      showSuccess('AI banner generated');
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to generate banner'));
    } finally {
      setGeneratingBanner(false);
    }
  }, [bannerPrompt, bannerStyleHint, currentStep, form, generatingBanner, highestStepReached, introDismissed, storeSetupDraftKey]);

  const buildPayload = useCallback((launch = false) => {
    const formValues = form.getValues();
    const resolvedSlug = slugEditedRef.current
      ? normalizeSlug(formValues.slug)
      : normalizeSlug(formValues.displayName || formValues.slug);
    const deliveryEnabled = Boolean(
      formValues.deliveryOptions.localDelivery.enabled ||
      formValues.deliveryOptions.nationwideDelivery.enabled
    );
    return {
      displayName: formValues.displayName,
      slug: resolvedSlug,
      description: formValues.description || null,
      logoUrl: formValues.logoUrl || null,
      bannerImageUrl: formValues.bannerImageUrl || null,
      primaryColor: normalizePrimaryColor(formValues.primaryColor),
      contactPhone: formValues.contactPhone || null,
      whatsappNumber: formValues.whatsappNumber || null,
      contactEmail: formValues.contactEmail || null,
      pickupEnabled: formValues.deliveryOptions.pickup.enabled,
      deliveryEnabled,
      deliveryFee: formValues.deliveryFee,
      currency: resolveStoreCurrency(formValues.currency),
      enabled: launch ? true : settings?.enabled === true,
      markSetupComplete: launch,
      metadata: {
        ...(settings?.metadata || {}),
        category: formValues.category || null,
        bannerImageUrl: formValues.bannerImageUrl || null,
        slugManuallyEdited: slugEditedRef.current,
        paymentMethods: formValues.paymentMethods,
        deliveryOptions: formValues.deliveryOptions,
        localDeliveryAreas: formValues.localDeliveryAreas || null,
        nationwideRegions: formValues.nationwideRegions || null,
        pickupInstructions: formValues.pickupInstructions || null,
        setupProgress: {
          currentStep,
          completedSteps: stepCompletion,
          progress: setupProgress,
          updatedAt: new Date().toISOString(),
        },
      },
    };
  }, [currentStep, form, settings, setupProgress, stepCompletion]);

  const handleUseGeneratedBanner = useCallback(async () => {
    const imageUrl = generatedBanner?.imageUrl || generatedBanner?.bannerImageUrl;
    if (!imageUrl || saving) return;
    const nextValues = { ...form.getValues(), bannerImageUrl: imageUrl };
    form.setValue('bannerImageUrl', imageUrl, { shouldDirty: true, shouldValidate: true });
    writeStoreSetupValuesDraft({
      storageKey: storeSetupDraftKey,
      values: nextValues,
      currentStep,
      highestStepReached,
      introDismissed,
      slugManuallyEdited: slugEditedRef.current,
    });
    setSaving(true);
    try {
      const response = await storeService.updateSettings(buildPayload(false));
      const savedSettings = getResponseData(response);
      clearStoreSetupDraft(storeSetupDraftKey);
      setSettings(savedSettings);
      setBannerGeneratorOpen(false);
      showSuccess('AI banner saved');
      await loadStore({ force: true });
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to save AI banner'));
    } finally {
      setSaving(false);
    }
  }, [
    buildPayload,
    currentStep,
    form,
    generatedBanner,
    highestStepReached,
    introDismissed,
    loadStore,
    saving,
    storeSetupDraftKey,
  ]);

  const saveStore = useCallback(async (launch = false) => {
    if (launch) {
      const valid = await form.trigger();
      if (!valid || !readiness.launchReady) return;
    } else {
      writeStoreSetupValuesDraft({
        storageKey: storeSetupDraftKey,
        values: form.getValues(),
        currentStep,
        highestStepReached,
        introDismissed,
        slugManuallyEdited: slugEditedRef.current,
      });
    }

    setSaving(true);
    try {
      const response = await storeService.updateSettings(buildPayload(launch));
      const savedSettings = getResponseData(response);
      clearStoreSetupDraft(storeSetupDraftKey);
      setSettings(savedSettings);
      showSuccess(launch ? 'Store launched' : 'Store draft saved');
      if (launch) {
        navigate('/store/dashboard');
      } else {
        await loadStore({ force: true });
      }
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to save store setup'));
    } finally {
      setSaving(false);
    }
  }, [
    buildPayload,
    currentStep,
    form,
    highestStepReached,
    introDismissed,
    loadStore,
    navigate,
    readiness.launchReady,
    storeSetupDraftKey,
  ]);

  const stepContent = useMemo(() => {
    if (currentStep === 0) {
      return (
        <div className="space-y-5">
          <FormField control={form.control} name="displayName" render={({ field }) => (
            <FormItem>
              <FormLabel>Store Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  className="h-12 rounded-xl text-base"
                  placeholder="Akosua's Beauty Store"
                  onBlur={() => { field.onBlur(); handleStoreNameBlur(); }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="slug" render={({ field }) => (
            <FormItem>
              <FormLabel>Store URL</FormLabel>
              <FormControl>
                <div className="flex min-h-12 overflow-hidden rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                  <span className="flex items-center whitespace-nowrap border-r border-border bg-muted px-3 text-sm text-muted-foreground">
                    {getStorefrontDisplayBaseUrl()}/
                  </span>
                  <Input
                    {...field}
                    placeholder={slugSuggestion || 'aseda-store'}
                    className="h-12 border-0 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                    onChange={(event) => {
                      slugEditedRef.current = true;
                      field.onChange(normalizeSlug(event.target.value));
                    }}
                  />
                </div>
              </FormControl>
              <FormDescription className={cn(
                slugStatus.state === 'available' && 'text-green-700',
                slugStatus.state === 'taken' && 'text-destructive',
              )}
              >
                <span className="inline-flex items-center gap-2">
                  {slugStatus.state === 'checking' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{slugStatus.message || `This becomes ${getPublicStoreDisplayUrl(previewSlug)}.`}</span>
                </span>
              </FormDescription>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="category" render={({ field }) => (
            <FormItem>
              <FormLabel>Business Category (optional)</FormLabel>
              <Select value={field.value || ''} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="h-12 rounded-xl text-base">
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem>
              <FormLabel>Store Description (optional)</FormLabel>
              <FormControl>
                <Textarea
                  rows={5}
                  className="min-h-32 rounded-xl text-base"
                  placeholder="Tell customers what you sell and why they should order from you."
                  {...field}
                />
              </FormControl>
              <div className="text-right text-xs text-muted-foreground">{String(field.value || '').length}/500</div>
              <FormMessage />
            </FormItem>
          )} />
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="mb-4 text-sm font-medium">Contact details</p>
            <div className="grid gap-4 md:grid-cols-3">
              <FormField control={form.control} name="contactEmail" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact email (optional)</FormLabel>
                  <FormControl><Input className="h-11 rounded-xl" type="email" placeholder="orders@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="whatsappNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp number (optional)</FormLabel>
                  <FormControl><Input className="h-11 rounded-xl" placeholder="233..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contactPhone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact phone (optional)</FormLabel>
                  <FormControl><Input className="h-11 rounded-xl" placeholder="Business phone" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </div>
          {!readiness.storeInfoReady && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Before launch</AlertTitle>
              <AlertDescription>Add a store name, valid URL slug, and at least one contact method.</AlertDescription>
            </Alert>
          )}
        </div>
      );
    }

    if (currentStep === 1) {
      return (
        <div className="space-y-5">
          <FormField control={form.control} name="logoUrl" render={({ field }) => (
            <FormItem>
              <UploadField
                label="Logo upload"
                description="Use a square logo for the store header and checkout touchpoints."
                value={field.value}
                onChange={field.onChange}
                onUpload={(file) => handleAssetUpload('logoUrl', file)}
                uploading={uploadingField === 'logoUrl'}
                previewAreaClassName="mx-auto h-40 w-40 sm:h-44 sm:w-44"
                previewClassName="h-full"
                imageClassName="h-full"
              />
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="bannerImageUrl" render={({ field }) => (
            <FormItem>
              <UploadField
                label="Banner upload"
                description="Add a wide image for the top of your public store."
                value={field.value}
                onChange={field.onChange}
                onUpload={(file) => handleAssetUpload('bannerImageUrl', file)}
                uploading={uploadingField === 'bannerImageUrl'}
                previewClassName="h-36 sm:h-40"
                actionSlot={(
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 rounded-xl"
                    onClick={handleOpenBannerGenerator}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate with AI
                  </Button>
                )}
              />
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="primaryColor" render={({ field }) => (
            <FormItem>
              <FormLabel>Theme color</FormLabel>
              <div className="grid grid-cols-2 gap-3">
                {THEME_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => field.onChange(preset.value)}
                    className={cn(
                      'flex min-h-20 flex-col items-start justify-between rounded-xl border p-3 text-left',
                      field.value === preset.value ? 'border-green-700 bg-green-50' : 'border-border',
                    )}
                  >
                    <span className="flex w-full items-center justify-between gap-3">
                      <span className="h-8 w-8 rounded-full border border-border" style={{ backgroundColor: preset.value }} />
                      {field.value === preset.value && <Check className="h-4 w-4 text-green-700" />}
                    </span>
                    <span className="text-sm font-medium">{preset.label}</span>
                  </button>
                ))}
              </div>
              <FormControl>
                <Input
                  type="color"
                  className="mt-3 h-11 w-24 rounded-xl p-1"
                  value={normalizePrimaryColor(field.value)}
                  onChange={(event) => field.onChange(event.target.value)}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <StorePreview
            className="xl:hidden"
            values={values}
            previewSlug={previewSlug}
            previewMode={previewMode}
            onPreviewModeChange={setPreviewMode}
            enabledPaymentMethods={enabledPaymentMethods}
            enabledDeliveryOptions={enabledDeliveryOptions}
          />
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="space-y-5">
          <div className="grid gap-4">
            {PAYMENT_OPTIONS.map((option) => {
              const Icon = option.icon;
              const method = values.paymentMethods?.[option.key] || {};
              return (
                <div
                  key={option.key}
                  className={cn(
                    'rounded-xl border p-4',
                    method.enabled && option.available ? 'border-green-200 bg-green-50/50' : 'border-border',
                    !option.available && 'bg-muted/30 opacity-75',
                  )}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3">
                      <span className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                        method.enabled && option.available ? 'bg-green-700 text-white' : 'bg-muted text-muted-foreground',
                      )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{option.label}</p>
                          <OptionStatus enabled={method.enabled} configured={method.configured} unavailable={!option.available} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-xl"
                        disabled={!option.available}
                        onClick={() => handleConfigurePaymentMethod(option.key, option.available)}
                      >
                        {method.configured ? 'Change' : 'Configure'}
                      </Button>
                      <Switch
                        checked={Boolean(method.enabled)}
                        onCheckedChange={(checked) => handleOptionToggle('paymentMethods', option.key, checked, option.available)}
                        disabled={!option.available}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <FormField control={form.control} name="currency" render={({ field }) => (
            <FormItem className="rounded-xl border border-border bg-muted/20 p-4">
              <FormLabel>Currency</FormLabel>
              <Select value={resolveStoreCurrency(field.value)} onValueChange={(value) => field.onChange(resolveStoreCurrency(value))}>
                <FormControl>
                  <SelectTrigger className="h-12 rounded-xl bg-background">
                    <SelectValue placeholder="GHS - Ghanaian Cedi" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="GHS">GHS - Ghanaian Cedi</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>Currency cannot be changed after launch.</FormDescription>
              <FormMessage />
            </FormItem>
          )} />
          <div className="rounded-xl border border-border p-4">
            <p className="font-medium">What your customers will see</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(enabledPaymentMethods.length ? enabledPaymentMethods : ['No payment methods enabled']).map((method) => (
                <Badge key={method} variant="outline" className="rounded-full border-green-200 bg-green-50 px-3 py-1 text-green-800">
                  {method}
                </Badge>
              ))}
              <Badge variant="outline" className="rounded-full px-3 py-1">Currency: {resolveStoreCurrency(values.currency)}</Badge>
            </div>
          </div>
          {!readiness.paymentReady && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Payment required</AlertTitle>
              <AlertDescription>Enable at least one available payment method before launch.</AlertDescription>
            </Alert>
          )}
        </div>
      );
    }

    if (currentStep === 3) {
      return (
        <div className="space-y-5">
          <div className="grid gap-4">
            {DELIVERY_OPTIONS.map((option) => {
              const Icon = option.icon;
              const delivery = values.deliveryOptions?.[option.key] || {};
              const detail = {
                localDelivery: values.localDeliveryAreas || 'Add nearby areas you can reach quickly.',
                nationwideDelivery: values.nationwideRegions || 'Confirm regions, courier notes, and timelines.',
                pickup: values.pickupInstructions || 'Tell customers where and when pickup is available.',
                international: 'International delivery will be available later.',
              }[option.key];
              return (
                <div
                  key={option.key}
                  className={cn(
                    'rounded-xl border p-4',
                    delivery.enabled && option.available ? 'border-green-200 bg-green-50/50' : 'border-border',
                    !option.available && 'bg-muted/30 opacity-75',
                  )}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3">
                      <span className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                        delivery.enabled && option.available ? 'bg-green-700 text-white' : 'bg-muted text-muted-foreground',
                      )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{option.label}</p>
                          <OptionStatus enabled={delivery.enabled} configured={delivery.configured} unavailable={!option.available} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-xl"
                        disabled={!option.available}
                        onClick={() => handleOpenDeliveryEditor(option.key, option.available)}
                      >
                        {delivery.enabled ? 'Edit areas' : 'Configure'}
                      </Button>
                      <Switch
                        checked={Boolean(delivery.enabled)}
                        onCheckedChange={(checked) => handleOptionToggle('deliveryOptions', option.key, checked, option.available)}
                        disabled={!option.available}
                      />
                    </div>
                  </div>
                  <div className={cn(
                    'mt-4 rounded-lg border px-3 py-2 text-xs',
                    delivery.enabled && option.available
                      ? 'border-green-200 bg-background text-green-900'
                      : 'border-border bg-background text-muted-foreground',
                  )}
                  >
                    {detail}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField control={form.control} name="deliveryFee" render={({ field }) => (
              <FormItem>
                <FormLabel>Base delivery fee</FormLabel>
                <FormControl><Input className="h-11 rounded-xl" type="number" min="0" step="0.01" {...field} /></FormControl>
                <FormDescription>Use 0 if you confirm fees manually.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="pickupInstructions" render={({ field }) => (
              <FormItem>
                <FormLabel>Pickup instructions (optional)</FormLabel>
                <FormControl><Input className="h-11 rounded-xl" placeholder="Pickup from main branch, 9am-5pm" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <FormField control={form.control} name="localDeliveryAreas" render={({ field }) => (
            <FormItem>
              <FormLabel>Local delivery areas (optional)</FormLabel>
              <FormControl><Textarea className="rounded-xl" rows={3} placeholder="Osu, East Legon, Adenta..." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="nationwideRegions" render={({ field }) => (
            <FormItem>
              <FormLabel>Nationwide delivery notes (optional)</FormLabel>
              <FormControl><Textarea className="rounded-xl" rows={3} placeholder="Regions, courier notes, delivery timelines..." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
            <p className="font-medium">Delivery summary</p>
            <p className="mt-1 text-muted-foreground">
              {enabledDeliveryOptions.length
                ? `${enabledDeliveryOptions.join(', ')} enabled. Base fee: GHS ${Number(values.deliveryFee || 0).toFixed(2)}.`
                : 'Enable pickup or delivery so customers know how orders will be fulfilled.'}
            </p>
          </div>
          {!readiness.deliveryReady && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Fulfillment required</AlertTitle>
              <AlertDescription>Enable at least one delivery option or pickup before launch.</AlertDescription>
            </Alert>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">Review & Launch</p>
              <p className="mt-1 text-sm text-muted-foreground">Check your setup details before making the store public.</p>
            </div>
            <Badge className={cn(readiness.launchReady ? 'bg-green-700 text-white hover:bg-green-700' : 'bg-amber-100 text-amber-800 hover:bg-amber-100')}>
              {readiness.launchReady ? 'Ready' : 'Needs checks'}
            </Badge>
          </div>
        </div>
        <StorePreview
          values={values}
          previewSlug={previewSlug}
          previewMode={previewMode}
          onPreviewModeChange={setPreviewMode}
          enabledPaymentMethods={enabledPaymentMethods}
          enabledDeliveryOptions={enabledDeliveryOptions}
        />
        <div className="grid gap-4">
          <SummaryCard
            title="Store Info"
            status={{ ready: readiness.storeInfoReady, label: readiness.storeInfoReady ? 'Ready to publish' : 'Needs basics' }}
            onEdit={() => handleStepClick(0)}
          >
            {storeInfoSummary.storeName} · {storeInfoSummary.publicUrl} · {storeInfoSummary.category}
          </SummaryCard>
          <SummaryCard
            title="Branding"
            status={{ ready: readiness.brandingReady, label: readiness.brandingReady ? 'Theme selected' : 'Needs color' }}
            onEdit={() => handleStepClick(1)}
          >
            Theme color {values.primaryColor}. Logo {values.logoUrl ? 'uploaded' : 'not uploaded'} and banner {values.bannerImageUrl ? 'uploaded' : 'not uploaded'}.
          </SummaryCard>
          <SummaryCard
            title="Payments"
            status={{ ready: readiness.paymentReady, label: readiness.paymentReady ? 'Payment ready' : 'Needs payment method' }}
            onEdit={() => handleStepClick(2)}
          >
            {enabledPaymentMethods.length ? enabledPaymentMethods.join(', ') : 'No enabled payment methods yet.'}
          </SummaryCard>
          <SummaryCard
            title="Delivery"
            status={{ ready: readiness.deliveryReady, label: readiness.deliveryReady ? 'Fulfillment ready' : 'Needs delivery or pickup' }}
            onEdit={() => handleStepClick(3)}
          >
            {enabledDeliveryOptions.length ? enabledDeliveryOptions.join(', ') : 'No fulfillment options enabled.'}
          </SummaryCard>
        </div>
        {readiness.launchReady && (
          <Alert className="border-green-200 bg-green-50 text-green-900">
            <Check className="h-4 w-4" />
            <AlertTitle>Store ready to launch</AlertTitle>
            <AlertDescription>Your store information, payment methods, and delivery options are ready.</AlertDescription>
          </Alert>
        )}
        {!readiness.publishedListingReady && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Listing warning</AlertTitle>
            <AlertDescription>
              You can launch now, but your store will look empty until at least one listing is published.
            </AlertDescription>
          </Alert>
        )}
        {!readiness.launchReady && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Launch checks incomplete</AlertTitle>
            <AlertDescription>Complete store info, payments, and delivery before launching.</AlertDescription>
          </Alert>
        )}
      </div>
    );
  }, [
    currentStep,
    enabledDeliveryOptions,
    enabledPaymentMethods,
    form.control,
    handleAssetUpload,
    handleOpenBannerGenerator,
    handleOpenDeliveryEditor,
    handleOptionToggle,
    handleStepClick,
    handleStoreNameBlur,
    previewMode,
    previewSlug,
    readiness,
    slugStatus,
    storeInfoSummary,
    uploadingField,
    values,
  ]);

  if (loading && !settings?.id && !searchParams.has('step')) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-700" />
      </div>
    );
  }

  if (showWelcomeIntro) {
    return <OnlineStoreWelcome onStartSetup={handleStartSetup} />;
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <MobileStoreTopBar onBack={() => navigate('/store/dashboard')} />

      <div className="hidden flex-col gap-4 md:flex lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-green-700">Sabito Store</p>
          <h1 className="text-2xl font-semibold">Setup wizard</h1>
          <p className="mt-1 text-muted-foreground">Build your customer-facing store from information to launch.</p>
        </div>
        <div className="w-full rounded-xl border border-border p-3 lg:w-72">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Setup progress</span>
            <span className="text-muted-foreground">{setupProgress}%</span>
          </div>
          <Progress value={setupProgress} className="h-2" />
        </div>
      </div>

      {settings?.id && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle>Live store actions</CardTitle>
              <p className="text-sm text-muted-foreground">Quick links for managing the storefront after launch.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {publicStoreUrl && (
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium">Public store link</p>
                  <p className="mt-1 break-all text-sm text-muted-foreground">{publicStoreUrl}</p>
                </div>
              )}

              {publicApiPreviewPath && (
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium">Public API preview</p>
                  <code className="mt-1 block break-all text-sm text-muted-foreground">{publicApiPreviewPath}</code>
                  <Button type="button" variant="outline" className="mt-3 w-full bg-background" onClick={handleCopyApiPreview}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy API path
                  </Button>
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-3">
                {publicStoreUrl && (
                  <Button variant="outline" className="justify-start bg-background" asChild>
                    <a href={publicStoreUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Public store
                    </a>
                  </Button>
                )}
                {!isStudioStore ? (
                  <Button variant="outline" className="justify-start bg-background" asChild>
                    <Link to="/store/orders">
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      Online orders
                    </Link>
                  </Button>
                ) : null}
                <Button className="justify-start" asChild>
                  <Link to={isStudioStore ? '/store/services' : '/store/listings'}>
                    <Package className="mr-2 h-4 w-4" />
                    {isStudioStore ? 'Manage services' : 'Manage listings'}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardHeader>
              <CardTitle>Launch checklist</CardTitle>
              <p className="text-sm text-muted-foreground">Setup completion reference for this store.</p>
            </CardHeader>
            <CardContent className="grid gap-3">
              {checklistItems.map(([label, done]) => (
                <div key={label} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm font-medium">{label}</span>
                  <Badge variant={done ? 'default' : 'outline'}>{done ? 'Done' : 'Needed'}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <Stepper
        currentStep={currentStep}
        completion={stepCompletion}
        highestStepReached={highestStepReached}
        onStepClick={handleStepClick}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
        <Card className="overflow-hidden border border-border">
          <CardHeader className="px-4 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-xl sm:text-2xl">{STEPS[currentStep].label}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Step {currentStep + 1} of {STEPS.length}
                </p>
              </div>
              {settings?.enabled && <Badge className="bg-green-700 text-white hover:bg-green-700">Launched</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex min-h-64 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Form {...form}>
                <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
                  {stepContent}
        <div className={cn(
          'grid gap-3 border-t border-border pt-5 sm:flex sm:flex-row sm:items-center sm:justify-between',
          currentStep === 0 ? 'grid-cols-1' : 'grid-cols-2',
        )}
        >
          <Button
            type="button"
            variant="outline"
            className={cn('h-12 rounded-xl sm:h-10', currentStep === 0 && 'hidden sm:inline-flex')}
            onClick={handleBack}
            disabled={currentStep === 0 || saving}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="contents sm:flex sm:gap-2">
            {(!settings?.enabled || hasUnsavedChanges) && (
              <Button
                type="button"
                variant="outline"
                className="hidden h-10 rounded-xl sm:inline-flex"
                onClick={() => saveStore(false)}
                disabled={saving}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {settings?.enabled ? 'Save changes' : 'Save as Draft'}
              </Button>
            )}
            {currentStep < STEPS.length - 1 ? (
              <Button type="button" className="h-12 rounded-xl sm:h-10" onClick={handleNext} disabled={saving}>
                Continue
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : settings?.enabled ? (
              <Button type="button" className="h-12 rounded-xl sm:h-10" asChild>
                <Link to="/store/dashboard">
                  <Check className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Link>
              </Button>
            ) : (
              <Button type="button" className="h-12 rounded-xl sm:h-10" onClick={() => saveStore(true)} disabled={saving || !readiness.launchReady}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Launch Store
              </Button>
            )}
          </div>
        </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        <StorePreview
          className={currentStep === STEPS.length - 1 ? 'hidden' : 'hidden xl:block'}
          sticky
          values={values}
          previewSlug={previewSlug}
          previewMode={previewMode}
          onPreviewModeChange={setPreviewMode}
          enabledPaymentMethods={enabledPaymentMethods}
          enabledDeliveryOptions={enabledDeliveryOptions}
        />
      </div>

      <DeliveryAreasEditorDialog
        open={Boolean(activeDeliveryEditor)}
        optionKey={activeDeliveryEditor}
        onOpenChange={(open) => {
          if (!open) setActiveDeliveryEditor(null);
        }}
        form={form}
        onSaved={handleDeliveryEditorSaved}
      />
      <BannerGeneratorDialog
        open={bannerGeneratorOpen}
        onOpenChange={setBannerGeneratorOpen}
        prompt={bannerPrompt}
        onPromptChange={setBannerPrompt}
        styleHint={bannerStyleHint}
        onStyleHintChange={setBannerStyleHint}
        generatedBanner={generatedBanner}
        generating={generatingBanner}
        saving={saving}
        onGenerate={handleGenerateBanner}
        onUseBanner={handleUseGeneratedBanner}
      />
    </div>
  );
};

export default StoreSetup;
