import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertCircle,
  Banknote,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Globe2,
  ImageIcon,
  Loader2,
  Menu,
  MapPin,
  Monitor,
  PackageCheck,
  Paintbrush,
  Pencil,
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
import { useDebounce } from '../hooks/useDebounce';
import { showError, showSuccess, getErrorMessage } from '../utils/toast';
import { resolveImageUrl } from '../utils/fileUtils';
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
  primaryColor: z.string().min(4, 'Choose a brand color'),
  logoUrl: z.string().optional(),
  bannerImageUrl: z.string().optional(),
  currency: z.literal('GHS'),
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

const getResponseData = (response) => response?.data?.data || response?.data || response;

const getSettledData = (result) => (result?.status === 'fulfilled' ? getResponseData(result.value) : null);

const compactString = (value) => (typeof value === 'string' ? value.trim() : '');

const firstFilled = (...values) => values.map(compactString).find(Boolean) || '';

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
  const primaryColor = firstFilled(
    organization?.primaryColor,
    tenantMetadata.primaryColor,
    tenantMetadata.brandColor,
  ) || '#166534';

  return {
    displayName,
    slug: normalizeSlug(activeTenant?.slug || displayName),
    description: firstFilled(
      tenantMetadata.storeDescription,
      tenantMetadata.businessDescription,
      tenantMetadata.description,
      activeTenant?.description,
    ),
    category: firstFilled(
      tenantMetadata.storeCategory,
      tenantMetadata.businessCategory,
      CATEGORY_BY_BUSINESS_TYPE[activeTenant?.businessType],
      'Other',
    ),
    whatsappNumber: firstFilled(
      tenantMetadata.whatsappNumber,
      tenantMetadata.whatsapp,
      contactPhone,
    ),
    contactPhone,
    contactEmail,
    primaryColor,
    logoUrl: firstFilled(
      organization?.logoUrl,
      tenantMetadata.logoUrl,
      tenantMetadata.logo,
      activeTenant?.logoUrl,
    ),
    bannerImageUrl: firstFilled(tenantMetadata.bannerImageUrl, tenantMetadata.coverImageUrl),
    currency: 'GHS',
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
  mobileMoney: { enabled: true, configured: true },
  card: { enabled: true, configured: true },
  bankTransfer: { enabled: false, configured: false },
  payOnDelivery: { enabled: false, configured: false },
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

const UploadField = ({ label, description, value, onChange, onUpload, uploading, previewClassName = 'h-32' }) => {
  const previewSrc = resolveImageUrl(value);
  return (
  <div className="rounded-xl border border-border p-4">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
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
    </div>
    {previewSrc ? (
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-muted/30">
        <img src={previewSrc} alt="" className={cn('w-full object-cover', previewClassName)} />
      </div>
    ) : (
      <div className={cn('mt-4 flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground', previewClassName)}>
        <ImageIcon className="mr-2 h-4 w-4" />
        No image uploaded yet
      </div>
    )}
    <Input className="mt-3 h-11 rounded-xl" placeholder="/uploads/... or https://..." value={value || ''} onChange={(event) => onChange(event.target.value)} />
  </div>
  );
};

const StorePreview = ({ values, previewMode, enabledPaymentMethods, enabledDeliveryOptions, className, sticky = false }) => {
  const whatsapp = values.whatsappNumber || values.contactPhone;
  const containerClass = previewMode === 'mobile' ? 'mx-auto max-w-[320px]' : 'w-full';
  const logoSrc = resolveImageUrl(values.logoUrl);
  const bannerSrc = resolveImageUrl(values.bannerImageUrl);

  return (
    <Card className={cn('border border-border', sticky && 'sticky top-4', className)}>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Live preview</CardTitle>
          <Badge variant="outline">{previewMode === 'mobile' ? 'Mobile' : 'Desktop'}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">Updates as you complete each setup step.</p>
      </CardHeader>
      <CardContent>
        <div className={containerClass}>
          <div className="overflow-hidden rounded-2xl border border-border bg-background">
            <div
              className="h-28 bg-muted"
              style={{ background: bannerSrc ? `url(${bannerSrc}) center/cover` : values.primaryColor }}
            />
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
                  <p className="truncate text-xs text-muted-foreground">/{values.slug || 'store-url'}</p>
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
                  Contact to order
                </Button>
              </div>
              <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
                <p>Payments: {enabledPaymentMethods.length ? enabledPaymentMethods.join(', ') : 'Not configured'}</p>
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
      <p className="text-center text-base font-semibold">Store Setup</p>
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
      currency: 'GHS',
      paymentMethods: defaultPaymentMethods,
      deliveryOptions: defaultDeliveryOptions,
      deliveryFee: 0,
      localDeliveryAreas: '',
      nationwideRegions: '',
      pickupInstructions: '',
    },
  });

  const values = form.watch();
  const debouncedSlug = useDebounce(values.slug, 500);

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
    const storeInfoReady = Boolean(
      values.displayName &&
      values.slug &&
      /^[a-z0-9-]+$/.test(values.slug) &&
      (values.contactPhone || values.whatsappNumber || values.contactEmail)
    );
    const brandingReady = Boolean(values.primaryColor);
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
    !loading
  ), [introDismissed, loading, searchParams]);

  const moveToStep = useCallback((step, options = {}) => {
    const nextStep = clampStepIndex(step);
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
  }, [setSearchParams]);

  const handleStartSetup = useCallback(() => {
    setIntroDismissed(true);
    moveToStep(0, { replace: true });
  }, [moveToStep]);

  const loadStore = useCallback(async () => {
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
      const savedPaymentMethods = mergeOptions(defaultPaymentMethods, metadata.paymentMethods);
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

      form.reset({
        displayName: savedOrDefault(nextSettings?.displayName, inferredDefaults.displayName),
        slug: savedOrDefault(nextSettings?.slug, inferredDefaults.slug),
        description: savedOrDefault(nextSettings?.description, inferredDefaults.description),
        category: savedOrDefault(metadata.category, inferredDefaults.category),
        whatsappNumber: savedOrDefault(nextSettings?.whatsappNumber, inferredDefaults.whatsappNumber),
        contactPhone: savedOrDefault(nextSettings?.contactPhone, inferredDefaults.contactPhone),
        contactEmail: savedOrDefault(nextSettings?.contactEmail, inferredDefaults.contactEmail),
        primaryColor: savedOrDefault(nextSettings?.primaryColor, inferredDefaults.primaryColor),
        logoUrl: savedOrDefault(nextSettings?.logoUrl, inferredDefaults.logoUrl),
        bannerImageUrl: savedOrDefault(nextSettings?.bannerImageUrl, inferredDefaults.bannerImageUrl),
        currency: 'GHS',
        paymentMethods: nextSettings?.id ? savedPaymentMethods : inferredDefaults.paymentMethods,
        deliveryOptions: nextSettings?.id ? savedDeliveryOptions : inferredDefaults.deliveryOptions,
        deliveryFee: Number(nextSettings?.deliveryFee || inferredDefaults.deliveryFee || 0),
        localDeliveryAreas: savedOrDefault(metadata.localDeliveryAreas, inferredDefaults.localDeliveryAreas),
        nationwideRegions: savedOrDefault(metadata.nationwideRegions, inferredDefaults.nationwideRegions),
        pickupInstructions: savedOrDefault(metadata.pickupInstructions, inferredDefaults.pickupInstructions),
      });

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
      }
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to load store setup'));
    } finally {
      setLoading(false);
    }
  }, [activeTenant, form, user]);

  useEffect(() => {
    loadStore();
  }, [loadStore]);

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
    if (!form.getValues('slug')) {
      form.setValue('slug', normalizeSlug(form.getValues('displayName')), { shouldValidate: true });
    }
  }, [form]);

  const handleStepClick = useCallback((step) => {
    if (step > highestStepReached) return;
    moveToStep(step);
  }, [highestStepReached, moveToStep]);

  const handleNext = useCallback(async () => {
    const valid = await form.trigger(getStepFields(currentStep));
    if (!valid) return;
    if (currentStep === 0 && slugStatus.state === 'taken') return;
    moveToStep(currentStep + 1);
  }, [currentStep, form, moveToStep, slugStatus.state]);

  const handleBack = useCallback(() => {
    moveToStep(currentStep - 1);
  }, [currentStep, moveToStep]);

  const handleOptionToggle = useCallback((fieldName, key, enabled, available = true) => {
    if (!available) return;
    form.setValue(`${fieldName}.${key}.enabled`, enabled, { shouldDirty: true, shouldValidate: true });
    form.setValue(`${fieldName}.${key}.configured`, enabled, { shouldDirty: true, shouldValidate: true });
  }, [form]);

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

  const buildPayload = useCallback((launch = false) => {
    const formValues = form.getValues();
    const deliveryEnabled = Boolean(
      formValues.deliveryOptions.localDelivery.enabled ||
      formValues.deliveryOptions.nationwideDelivery.enabled
    );
    return {
      displayName: formValues.displayName,
      slug: normalizeSlug(formValues.slug),
      description: formValues.description || null,
      logoUrl: formValues.logoUrl || null,
      bannerImageUrl: formValues.bannerImageUrl || null,
      primaryColor: formValues.primaryColor,
      contactPhone: formValues.contactPhone || null,
      whatsappNumber: formValues.whatsappNumber || null,
      contactEmail: formValues.contactEmail || null,
      pickupEnabled: formValues.deliveryOptions.pickup.enabled,
      deliveryEnabled,
      deliveryFee: formValues.deliveryFee,
      currency: 'GHS',
      enabled: launch ? true : settings?.enabled === true,
      markSetupComplete: launch,
      metadata: {
        ...(settings?.metadata || {}),
        category: formValues.category || null,
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

  const saveStore = useCallback(async (launch = false) => {
    const valid = await form.trigger();
    if (!valid) return;
    if (launch && !readiness.launchReady) return;

    setSaving(true);
    try {
      const response = await storeService.updateSettings(buildPayload(launch));
      const savedSettings = getResponseData(response);
      setSettings(savedSettings);
      showSuccess(launch ? 'Store launched' : 'Store draft saved');
      if (launch) {
        navigate('/store/dashboard');
      } else {
        await loadStore();
      }
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to save store setup'));
    } finally {
      setSaving(false);
    }
  }, [buildPayload, form, loadStore, navigate, readiness.launchReady]);

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
                  <span className="flex items-center border-r border-border bg-muted px-3 text-sm text-muted-foreground">/store/</span>
                  <Input
                    {...field}
                    className="h-12 border-0 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                    onChange={(event) => field.onChange(normalizeSlug(event.target.value))}
                  />
                </div>
              </FormControl>
              <FormDescription className={cn(
                slugStatus.state === 'available' && 'text-green-700',
                slugStatus.state === 'taken' && 'text-destructive',
              )}
              >
                {slugStatus.message || 'This becomes the public URL for your customer-facing store.'}
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
                previewClassName="h-32 sm:h-36"
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
              <FormControl><Input type="color" className="mt-3 h-11 w-24 rounded-xl p-1" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <StorePreview
            className="xl:hidden"
            values={values}
            previewMode="mobile"
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
                      <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl" disabled={!option.available}>
                        Configure
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
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="h-12 rounded-xl bg-background">
                    <SelectValue />
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
              <Badge variant="outline" className="rounded-full px-3 py-1">Currency: {values.currency}</Badge>
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
                      <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl" disabled={!option.available}>
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
        <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Preview mode</p>
            <p className="text-sm text-muted-foreground">Review how the live preview behaves before launch.</p>
          </div>
          <Tabs value={previewMode} onValueChange={setPreviewMode}>
            <TabsList>
              <TabsTrigger value="desktop"><Monitor className="mr-2 h-4 w-4" />Desktop</TabsTrigger>
              <TabsTrigger value="mobile"><Smartphone className="mr-2 h-4 w-4" />Mobile</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <StorePreview
          values={values}
          previewMode={previewMode}
          enabledPaymentMethods={enabledPaymentMethods}
          enabledDeliveryOptions={enabledDeliveryOptions}
        />
        <div className="grid gap-4">
          <SummaryCard
            title="Store Info"
            status={{ ready: readiness.storeInfoReady, label: readiness.storeInfoReady ? 'Ready to publish' : 'Needs basics' }}
            onEdit={() => handleStepClick(0)}
          >
            {values.displayName || 'Store name missing'} · /{values.slug || 'store-url'} · {values.category || 'No category selected'}
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
    handleOptionToggle,
    handleStepClick,
    handleStoreNameBlur,
    previewMode,
    readiness,
    slugStatus,
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
          <p className="text-sm font-medium uppercase tracking-wide text-green-700">Online Store</p>
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
                      <Button
                        type="button"
                        variant="outline"
                        className="hidden h-10 rounded-xl sm:inline-flex"
                        onClick={() => saveStore(false)}
                        disabled={saving}
                      >
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save as Draft
                      </Button>
                      {currentStep < STEPS.length - 1 ? (
                        <Button type="button" className="h-12 rounded-xl sm:h-10" onClick={handleNext} disabled={saving}>
                          Continue
                          <ChevronRight className="ml-2 h-4 w-4" />
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
          previewMode={previewMode}
          enabledPaymentMethods={enabledPaymentMethods}
          enabledDeliveryOptions={enabledDeliveryOptions}
        />
      </div>
    </div>
  );
};

export default StoreSetup;
