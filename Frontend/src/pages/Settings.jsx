import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import settingsService from '../services/settingsService';
import whatsappService from '../services/whatsappService';
import smsService from '../services/smsService';
import emailService from '../services/emailService';
import { Camera, User, Mail, UserCog, Loader2, Eye, EyeOff, Trash2, Moon, Lightbulb, ExternalLink, HelpCircle, CreditCard, ChevronDown, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { useHintMode } from '../context/HintModeContext';
import { showSuccess, showError, showLoading } from '../utils/toast';
import { maskEmail } from '../utils/maskEmail';
import { numberInputValue, handleIntegerChange, integerOrEmptySchema } from '../utils/formUtils';
import inviteService from '../services/inviteService';
import authService from '../services/authService';
import PhoneNumberInput from '../components/PhoneNumberInput';
import StatusChip from '../components/StatusChip';
import FileUpload from '../components/FileUpload';
import FilePreview from '../components/FilePreview';
import PrintableInvoice from '../components/PrintableInvoice';
import { API_BASE_URL } from '../services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card as ShadcnCard, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Descriptions as ShadcnDescriptions, DescriptionItem } from '@/components/ui/descriptions';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  SHOP_TYPE_LABELS,
  CURRENCIES,
  NOTIFICATION_PREFERENCE_CATEGORY_ORDER,
  NOTIFICATION_PREFERENCE_CATEGORY_LABELS,
  STUDIO_LIKE_TYPES,
  DEFAULT_TENANT_NAMES,
  QUERY_CACHE,
} from '../constants';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const profileSchema = z.object({
  name: z.string().min(1, 'Enter your name'),
  email: z.string().email().optional(),
  profilePicture: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
}).refine((data) => {
  if (data.newPassword && !data.currentPassword) {
    return false;
  }
  return true;
}, {
  message: 'Enter current password to set a new one',
  path: ['currentPassword'],
});

const organizationSchema = z.object({
  name: z.string().min(1, 'Enter organization name'),
  legalName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  logoUrl: z.string().optional(),
  appName: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().or(z.literal('')),
  invoiceFooter: z.string().optional(),
  paymentDetails: z.string().optional(),
  paymentDetailsEnabled: z.boolean().optional(),
  defaultPaymentTerms: z.string().optional(),
  defaultTermsAndConditions: z.string().optional(),
  supportEmail: z.string().email().optional().or(z.literal('')),
  currency: z.string().optional(),
  address: z.object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  tax: z.object({
    vatNumber: z.string().optional(),
    tin: z.string().optional(),
    enabled: z.boolean().optional(),
    defaultRatePercent: z.preprocess(
      (val) => {
        if (val === '' || val === undefined || val === null) return 0;
        const n = typeof val === 'string' ? parseFloat(val.trim()) : Number(val);
        if (!Number.isFinite(n)) return 0;
        return Math.min(100, Math.max(0, n));
      },
      z.number().min(0).max(100)
    ),
    pricesAreTaxInclusive: z.boolean().optional(),
    displayLabel: z.string().max(80).optional(),
    otherCharges: z.object({
      enabled: z.boolean().optional(),
      label: z.string().max(80).optional(),
      ratePercent: z.preprocess(
        (val) => {
          if (val === '' || val === undefined || val === null) return 0;
          const n = typeof val === 'string' ? parseFloat(val.trim()) : Number(val);
          if (!Number.isFinite(n)) return 0;
          return Math.min(100, Math.max(0, n));
        },
        z.number().min(0).max(100)
      ),
      customerBears: z.boolean().optional(),
      appliesTo: z.enum(['online_payments', 'all_payments']).optional(),
    }).optional(),
  }).optional(),
  shopType: z.string().optional(),
});

const whatsappSchema = z.object({
  enabled: z.boolean().default(false),
  phoneNumberId: z.string().optional(),
  accessToken: z.string().optional(),
  businessAccountId: z.string().optional(),
  webhookVerifyToken: z.string().optional(),
  templateNamespace: z.string().optional(),
});

const smsSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.enum(['termii', 'twilio', 'africas_talking']).default('termii'),
  senderId: z.string().optional(),
  apiKey: z.string().optional(),
  accountSid: z.string().optional(),
  authToken: z.string().optional(),
  fromNumber: z.string().optional(),
  username: z.string().optional(),
});

const emailSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.enum(['smtp', 'sendgrid', 'ses']).default('smtp'),
  smtpHost: z.string().optional(),
  smtpPort: z.union([z.number(), z.literal('')]).optional().transform((v) => (v === '' || v == null ? 587 : v)),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpRejectUnauthorized: z.boolean().default(true),
  fromEmail: z.string().email().optional(),
  fromName: z.string().optional(),
  sendgridApiKey: z.string().optional(),
  sesAccessKeyId: z.string().optional(),
  sesSecretAccessKey: z.string().optional(),
  sesRegion: z.string().optional(),
  sesHost: z.string().optional(),
});

const subscriptionSchema = z.object({
  plan: z.string().min(1, 'Plan is required'),
  status: z.string().min(1, 'Status is required'),
  seats: integerOrEmptySchema(z, 1).refine((v) => v >= 1, 'Seats count is required'),
  currentPeriodEnd: z.date().optional().nullable(),
  notes: z.string().optional(),
});

const posConfigSchema = z.object({
  receipt: z.object({
    mode: z.enum(['ask', 'auto_send', 'auto_print', 'auto_both']),
    channels: z.array(z.enum(['sms', 'whatsapp', 'email', 'print'])),
  }),
  print: z.object({
    format: z.enum(['a4', 'thermal_58', 'thermal_80']),
    showLogo: z.boolean().optional(),
    color: z.boolean().optional(),
    fontSize: z.enum(['normal', 'small']).optional(),
  }),
  customer: z.object({
    phoneRequired: z.boolean(),
    nameRequired: z.boolean(),
  }),
});

const paymentCollectionSchema = z.object({
  settlement_type: z.enum(['bank', 'momo']),
  business_name: z.string().min(1, 'Business / account name is required'),
  bank_code: z.string().optional(),
  bank_name: z.string().optional(),
  account_number: z.string().optional(),
  primary_contact_email: z.string().email().optional().or(z.literal('')),
  momo_phone: z.string().optional(),
  momo_provider: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.settlement_type === 'bank') {
    if (!data.bank_code || !data.bank_code.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Bank is required', path: ['bank_code'] });
    if (!data.account_number || String(data.account_number).replace(/\s/g, '').length < 8) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Account number must be at least 8 characters', path: ['account_number'] });
  }
  if (data.settlement_type === 'momo') {
    const phone = (data.momo_phone || '').replace(/\s/g, '');
    if (!phone || phone.length < 9) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'MoMo phone number is required (e.g. 0XXXXXXXXX)', path: ['momo_phone'] });
    if (!data.momo_provider || !['MTN', 'AIRTEL', 'VODAFONE'].includes(String(data.momo_provider).toUpperCase())) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Select MoMo provider (MTN, AirtelTigo Money, or Vodafone Cash)', path: ['momo_provider'] });
  }
});

// Helper function to resolve file URLs (handles base64, relative paths, and absolute URLs)
const resolveFileUrl = (url) => {
  if (!url) return '';
  // Base64 data URLs (data:image/png;base64,...)
  if (url.startsWith('data:')) return url;
  // Absolute URLs (http:// or https://)
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Relative paths - prepend API base URL
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  // Return as-is for other cases
  return url;
};

const Settings = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const normalizeMainTab = (tab) => {
    const value = String(tab || 'profile');
    if (['profile', 'workspace', 'operations', 'billing', 'messaging'].includes(value)) return value;
    if (['organization', 'appearance'].includes(value)) return 'workspace';
    if (['subscription', 'payments'].includes(value)) return 'billing';
    if (['integration', 'notifications', 'whatsapp', 'sms', 'email'].includes(value)) return 'messaging';
    if (value === 'configurations') return 'operations';
    return 'profile';
  };
  const tabFromUrl = normalizeMainTab(searchParams.get('tab') || 'profile');
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [integrationSubTab, setIntegrationSubTab] = useState('whatsapp');
  const [paymentsSubTab, setPaymentsSubTab] = useState('settlements');

  // Update tab when URL parameter changes (keep old links working)
  useEffect(() => {
    const tab = searchParams.get('tab') || 'profile';
    const subtab = searchParams.get('subtab');
    const mappedTab = normalizeMainTab(tab);
    setActiveTab(mappedTab);

    if (['whatsapp', 'sms', 'email'].includes(tab)) {
      setIntegrationSubTab(tab);
      setSearchParams({ tab: 'messaging', subtab: tab });
      return;
    }

    if (tab === 'integration' || tab === 'messaging') {
      if (subtab && ['whatsapp', 'sms', 'email'].includes(subtab)) {
        setIntegrationSubTab(subtab);
      }
      if (tab === 'integration') {
        setSearchParams({ tab: 'messaging', subtab: subtab && ['whatsapp', 'sms', 'email'].includes(subtab) ? subtab : 'whatsapp' });
        return;
      }
    }

    if (tab === 'payments' || tab === 'billing') {
      const paySub = searchParams.get('subtab');
      setPaymentsSubTab(paySub === 'mtn-collection' ? 'mtn-collection' : 'settlements');
      if (tab === 'payments') {
        setSearchParams({ tab: 'billing', subtab: paySub === 'mtn-collection' ? 'mtn-collection' : 'settlements' });
        return;
      }
    }

    if (tab !== mappedTab && !['whatsapp', 'sms', 'email', 'integration', 'payments'].includes(tab)) {
      setSearchParams({ tab: mappedTab });
    }
  }, [searchParams, setSearchParams]);
  const [profilePreview, setProfilePreview] = useState('');
  const [profileEditing, setProfileEditing] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [profilePreviewVisible, setProfilePreviewVisible] = useState(false);
  const [profileUploading, setProfileUploading] = useState(false);
  const [organizationLogoPreview, setOrganizationLogoPreview] = useState('');
  const [organizationEditing, setOrganizationEditing] = useState(false);
  const [emailEditing, setEmailEditing] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [organizationLogoPreviewVisible, setOrganizationLogoPreviewVisible] = useState(false);
  const [organizationLogoUploading, setOrganizationLogoUploading] = useState(false);
  const [paymentVerifyPassword, setPaymentVerifyPassword] = useState('');
  const [paymentVerifyOtp, setPaymentVerifyOtp] = useState('');
  const [paymentOtpSent, setPaymentOtpSent] = useState(false);
  const [paymentOtpSending, setPaymentOtpSending] = useState(false);
  const [paymentVerifyModalOpen, setPaymentVerifyModalOpen] = useState(false);
  const [paymentVerificationDone, setPaymentVerificationDone] = useState(false);
  const [paymentPasswordVerified, setPaymentPasswordVerified] = useState(false);
  const [paymentPasswordVerifying, setPaymentPasswordVerifying] = useState(false);
  const [paymentVerifyOtpVerifying, setPaymentVerifyOtpVerifying] = useState(false);
  const [showPaymentOtpEmailHint, setShowPaymentOtpEmailHint] = useState(false);
  const [bankSelectOpen, setBankSelectOpen] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [mtnCredForm, setMtnCredForm] = useState({
    subscriptionKey: '',
    apiUser: '',
    apiKey: '',
    environment: 'sandbox',
    collectionApiUrl: '',
    callbackUrl: ''
  });
  const [mtnOtp, setMtnOtp] = useState('');
  const [mtnGatePassword, setMtnGatePassword] = useState('');
  const [mtnSaving, setMtnSaving] = useState(false);
  const [mtnTesting, setMtnTesting] = useState(false);
  const [mtnDisconnecting, setMtnDisconnecting] = useState(false);
  const [paystackTxFrom, setPaystackTxFrom] = useState(() => dayjs().subtract(30, 'day').format('YYYY-MM-DD'));
  const [paystackTxTo, setPaystackTxTo] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [paystackTxPage, setPaystackTxPage] = useState(1);
  const paymentOtpInputRefs = useRef([]);
  /** When true, closing the payment verify dialog must not wipe OTP/password (needed for Link MoMo / Link bank submit). */
  const skipResetPaymentVerifyOnCloseRef = useRef(false);
  /** Dismiss "Saving..." toast when mutation completes (success or error). */
  const savingToastDismissRef = useRef(null);
  const [posConfigEditing, setPosConfigEditing] = useState(false);
  const [seatUsage, setSeatUsage] = useState(null);
  const [storageUsage, setStorageUsage] = useState(null);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [whatsappTemplateLearnMoreOpen, setWhatsappTemplateLearnMoreOpen] = useState(false);
  const [notificationPrefsDraft, setNotificationPrefsDraft] = useState(null);
  const { user, updateUser, activeTenant, refreshAuthState, needsEmailVerification, isManager, wasInvited } = useAuth();
  const { isMobile } = useResponsive();
  /** Must match API authorize() which uses workspace membership role (req.tenantRole), not only users.role */
  const canManageOrganization = Boolean(isManager);
  const isStudioLike = useMemo(
    () => STUDIO_LIKE_TYPES.includes(activeTenant?.businessType || 'printing_press'),
    [activeTenant?.businessType]
  );
  const isGoogleUser = Boolean(user?.googleId);

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      email: '',
      profilePicture: '',
      currentPassword: '',
      newPassword: '',
    },
  });

  const organizationForm = useForm({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: '',
      legalName: '',
      email: '',
      phone: '',
      website: '',
      logoUrl: '',
      invoiceFooter: '',
      paymentDetails: '',
      paymentDetailsEnabled: false,
      defaultPaymentTerms: '',
      defaultTermsAndConditions: '',
      supportEmail: '',
      address: {
        line1: '',
        line2: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      },
      tax: {
        vatNumber: '',
        tin: '',
        enabled: false,
        defaultRatePercent: 0,
        pricesAreTaxInclusive: false,
        displayLabel: 'Tax',
        otherCharges: {
          enabled: false,
          label: 'Transaction charge',
          ratePercent: 0,
          customerBears: false,
          appliesTo: 'online_payments',
        },
      },
      shopType: '',
    },
  });

  const whatsappForm = useForm({
    resolver: zodResolver(whatsappSchema),
    defaultValues: {
      enabled: false,
      phoneNumberId: '',
      accessToken: '',
      businessAccountId: '',
      webhookVerifyToken: '',
      templateNamespace: '',
    },
  });

  const smsForm = useForm({
    resolver: zodResolver(smsSchema),
    defaultValues: {
      enabled: false,
      provider: 'termii',
      senderId: '',
      apiKey: '',
      accountSid: '',
      authToken: '',
      fromNumber: '',
      username: '',
    },
  });

  const emailForm = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      enabled: false,
      provider: 'smtp',
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpPassword: '',
      smtpRejectUnauthorized: true,
      fromEmail: '',
      fromName: '',
      sendgridApiKey: '',
      sesAccessKeyId: '',
      sesSecretAccessKey: '',
      sesRegion: 'us-east-1',
      sesHost: '',
    },
  });

  const subscriptionForm = useForm({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      plan: 'trial',
      status: 'active',
      seats: 5,
      currentPeriodEnd: null,
      notes: '',
    },
  });

  const posConfigForm = useForm({
    resolver: zodResolver(posConfigSchema),
    defaultValues: {
      receipt: { mode: 'ask', channels: ['sms', 'print'] },
      print: { format: 'a4', showLogo: true, color: true, fontSize: 'normal' },
      customer: { phoneRequired: false, nameRequired: false },
    },
  });

  const paymentCollectionForm = useForm({
    resolver: zodResolver(paymentCollectionSchema),
    defaultValues: {
      settlement_type: 'bank',
      business_name: '',
      bank_code: '',
      bank_name: '',
      account_number: '',
      primary_contact_email: '',
      momo_phone: '',
      momo_provider: '',
    },
  });

  const {
    data: profileData,
    isLoading: loadingProfile
  } = useQuery({
    queryKey: ['settings', 'profile'],
    queryFn: settingsService.getProfile
  });

  const {
    data: organizationData,
    isLoading: loadingOrganization,
    isPending: organizationSettingsPending,
  } = useQuery({
    queryKey: ['settings', 'organization', activeTenant?.id],
    queryFn: settingsService.getOrganization,
    enabled: !!activeTenant?.id,
  });

  const organizationRecord = useMemo(() => organizationData?.data || {}, [organizationData]);

  const hasBusinessNameForOnboarding = useMemo(() => {
    const name = activeTenant?.name;
    return !!(name && name.trim() && !DEFAULT_TENANT_NAMES.includes(name));
  }, [activeTenant?.name]);

  const hasCompanyPhoneForOnboarding = useMemo(
    () => !!(organizationRecord?.phone && String(organizationRecord.phone).trim()),
    [organizationRecord?.phone]
  );

  const hasOrganizationEmailForOnboarding = useMemo(
    () => !!(organizationRecord?.email && String(organizationRecord.email).trim()),
    [organizationRecord?.email]
  );

  /** Match Dashboard: explicit onboarding completion OR profile fields (phone or org email). */
  const onboardingCompleted = useMemo(() => {
    if (activeTenant?.metadata?.onboarding?.completedAt) return true;
    return (
      hasBusinessNameForOnboarding &&
      (hasCompanyPhoneForOnboarding || hasOrganizationEmailForOnboarding)
    );
  }, [
    activeTenant?.metadata?.onboarding?.completedAt,
    hasBusinessNameForOnboarding,
    hasCompanyPhoneForOnboarding,
    hasOrganizationEmailForOnboarding,
  ]);

  const showOnboardingBanner = useMemo(() => {
    if (wasInvited) return false;
    if (organizationSettingsPending) return false;
    return !onboardingCompleted;
  }, [wasInvited, organizationSettingsPending, onboardingCompleted]);

  const {
    data: subscriptionData,
    isLoading: loadingSubscription
  } = useQuery({
    queryKey: ['settings', 'subscription'],
    queryFn: settingsService.getSubscription
  });

  const {
    data: whatsappData,
    isLoading: loadingWhatsApp
  } = useQuery({
    queryKey: ['settings', 'whatsapp'],
    queryFn: whatsappService.getSettings,
    enabled: canManageOrganization
  });

  const {
    data: smsData,
    isLoading: loadingSMS
  } = useQuery({
    queryKey: ['settings', 'sms'],
    queryFn: smsService.getSettings,
    enabled: canManageOrganization
  });

  const {
    data: emailData,
    isLoading: loadingEmail
  } = useQuery({
    queryKey: ['settings', 'email'],
    queryFn: emailService.getSettings,
    enabled: canManageOrganization
  });

  const {
    data: posConfigData,
    isLoading: loadingPOSConfig
  } = useQuery({
    queryKey: ['settings', 'pos-config'],
    queryFn: settingsService.getPOSConfig,
    enabled: canManageOrganization
  });

  const {
    data: paymentCollectionData,
    isLoading: loadingPaymentCollection
  } = useQuery({
    queryKey: ['settings', 'payment-collection', activeTenant?.id],
    queryFn: settingsService.getPaymentCollectionSettings,
    enabled: canManageOrganization && !!activeTenant?.id,
    staleTime: QUERY_CACHE.STALE_TIME_VOLATILE,
    refetchOnMount: 'always'
  });

  const {
    data: paymentCollectionBanks = [],
    isLoading: loadingBanks,
    isError: banksLoadError,
    refetch: refetchBanks
  } = useQuery({
    queryKey: ['settings', 'payment-collection-banks', activeTenant?.id],
    queryFn: settingsService.getPaymentCollectionBanks,
    enabled: canManageOrganization && !!activeTenant?.id
  });

  useEffect(() => {
    setPaystackTxPage(1);
  }, [paystackTxFrom, paystackTxTo]);

  const {
    data: paystackTxPayload,
    isLoading: loadingPaystackTx,
    isError: paystackTxIsError,
    error: paystackTxError,
    refetch: refetchPaystackTx
  } = useQuery({
    queryKey: [
      'settings',
      'paystack-transactions',
      activeTenant?.id,
      paystackTxFrom,
      paystackTxTo,
      paystackTxPage
    ],
    queryFn: () =>
      settingsService.getPaystackWorkspaceTransactions({
        from: paystackTxFrom,
        to: paystackTxTo,
        page: paystackTxPage,
        perPage: 20
      }),
    enabled:
      canManageOrganization &&
      !!activeTenant?.id &&
      activeTab === 'billing' &&
      paymentsSubTab === 'settlements'
  });

  const { data: notificationChannelsData } = useQuery({
    queryKey: ['settings', 'notification-channels'],
    queryFn: settingsService.getNotificationChannels,
    enabled: canManageOrganization
  });

  const { data: quoteWorkflowData } = useQuery({
    queryKey: ['settings', 'quote-workflow'],
    queryFn: settingsService.getQuoteWorkflow,
    enabled: canManageOrganization
  });

  const updateQuoteWorkflowMutation = useMutation({
    mutationFn: settingsService.updateQuoteWorkflow,
    onSuccess: () => {
      dismissSavingToast();
      showSuccess('Quote workflow saved');
      queryClient.invalidateQueries({ queryKey: ['settings', 'quote-workflow'] });
    },
    onError: (error) => {
      dismissSavingToast();
      showError(error?.response?.data?.message || error?.message || 'Failed to save quote workflow');
    }
  });

  const { data: jobInvoiceData } = useQuery({
    queryKey: ['settings', 'job-invoice'],
    queryFn: settingsService.getJobInvoice,
    enabled: canManageOrganization
  });

  const updateJobInvoiceMutation = useMutation({
    mutationFn: settingsService.updateJobInvoice,
    onSuccess: () => {
      dismissSavingToast();
      showSuccess('Job invoice settings saved');
      queryClient.invalidateQueries({ queryKey: ['settings', 'job-invoice'] });
    },
    onError: (error) => {
      dismissSavingToast();
      showError(error?.response?.data?.message || error?.message || 'Failed to save job invoice settings');
    }
  });

  const updateCustomerNotificationPrefsMutation = useMutation({
    mutationFn: settingsService.updateCustomerNotificationPreferences,
    onSuccess: () => {
      dismissSavingToast();
      showSuccess('Auto-send preferences saved');
      queryClient.invalidateQueries({ queryKey: ['settings', 'notification-channels'] });
    },
    onError: (error) => {
      dismissSavingToast();
      showError(error?.response?.data?.message || error?.message || 'Failed to save preferences');
    },
  });

  const filteredBanksList = useMemo(() => {
    const list = Array.isArray(paymentCollectionBanks) ? paymentCollectionBanks : (paymentCollectionBanks?.data ?? []);
    const q = (bankSearchQuery || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter((b) => (b.name || '').toLowerCase().includes(q) || (b.code || '').toLowerCase().includes(q));
  }, [paymentCollectionBanks, bankSearchQuery]);

  useEffect(() => {
    if (whatsappData?.data && canManageOrganization) {
      whatsappForm.reset({
        enabled: whatsappData.data.enabled || false,
        phoneNumberId: whatsappData.data.phoneNumberId || '',
        accessToken: whatsappData.data.accessToken === '***' ? '' : (whatsappData.data.accessToken || ''),
        businessAccountId: whatsappData.data.businessAccountId || '',
        webhookVerifyToken: whatsappData.data.webhookVerifyToken || '',
        templateNamespace: whatsappData.data.templateNamespace || ''
      });
    }
  }, [whatsappData, whatsappForm, canManageOrganization]);

  useEffect(() => {
    if (smsData?.data && canManageOrganization) {
      smsForm.reset({
        enabled: smsData.data.enabled || false,
        provider: smsData.data.provider || 'termii',
        senderId: smsData.data.senderId || '',
        apiKey: smsData.data.apiKey === '***' ? '' : (smsData.data.apiKey || ''),
        accountSid: smsData.data.accountSid || '',
        authToken: smsData.data.authToken === '***' ? '' : (smsData.data.authToken || ''),
        fromNumber: smsData.data.fromNumber || '',
        username: smsData.data.username || ''
      });
    }
  }, [smsData, smsForm, canManageOrganization]);

  /** Merge saved email settings with organization (business name/email) for auto-fill. Only the app password cannot be guessed. */
  const getEmailFormValues = useCallback((ed, org, options = {}) => {
    const o = org || {};
    const orgEmail = (o.email || '').trim();
    const orgName = (o.name || '').trim();
    const isGmail = orgEmail.toLowerCase().endsWith('@gmail.com');
    return {
      enabled: ed?.enabled ?? false,
      provider: ed?.provider || 'smtp',
      smtpHost: (ed?.smtpHost || '').trim() || (isGmail ? 'smtp.gmail.com' : ''),
      smtpPort: ed?.smtpPort ?? 587,
      smtpUser: (ed?.smtpUser || '').trim() || orgEmail || '',
      smtpPassword: options.clearSecrets ? '' : (ed?.smtpPassword === '***' ? '' : (ed?.smtpPassword || '')),
      smtpRejectUnauthorized: ed?.smtpRejectUnauthorized !== false,
      fromEmail: (ed?.fromEmail || '').trim() || orgEmail || '',
      fromName: (ed?.fromName || '').trim() || orgName || '',
      sendgridApiKey: options.clearSecrets ? '' : (ed?.sendgridApiKey === '***' ? '' : (ed?.sendgridApiKey || '')),
      sesAccessKeyId: ed?.sesAccessKeyId || '',
      sesSecretAccessKey: options.clearSecrets ? '' : (ed?.sesSecretAccessKey === '***' ? '' : (ed?.sesSecretAccessKey || '')),
      sesRegion: ed?.sesRegion || 'us-east-1',
      sesHost: ed?.sesHost || ''
    };
  }, []);

  useEffect(() => {
    if (emailData?.data && canManageOrganization) {
      const org = organizationData?.data ?? organizationData ?? {};
      emailForm.reset(getEmailFormValues(emailData.data, org));
    }
  }, [emailData, organizationData, emailForm, canManageOrganization, getEmailFormValues]);

  useEffect(() => {
    const config = posConfigData?.data?.data ?? posConfigData?.data;
    if (config && canManageOrganization) {
      const mode = config.receipt?.mode || 'ask';
      let channels = config.receipt?.channels || ['sms', 'print'];
      if (mode === 'auto_print') {
        channels = ['print'];
      } else if (mode === 'auto_send') {
        channels = channels.filter((c) => ['sms', 'whatsapp', 'email'].includes(c));
        if (channels.length === 0) channels = ['sms'];
      }
      posConfigForm.reset({
        receipt: { mode, channels },
        print: {
          format: config.print?.format || 'a4',
          showLogo: config.print?.showLogo !== false,
          color: config.print?.color !== false,
          fontSize: config.print?.fontSize || 'normal',
        },
        customer: {
          phoneRequired: config.customer?.phoneRequired || false,
          nameRequired: config.customer?.nameRequired || false,
        },
      });
    }
  }, [posConfigData, posConfigForm, canManageOrganization]);

  useEffect(() => {
    const rawPc = paymentCollectionData?.data ?? paymentCollectionData;
    const pc = rawPc && typeof rawPc === 'object' && rawPc.data != null && (rawPc.success === true || rawPc.success === 'true') ? rawPc.data : rawPc;
    const org = organizationData?.data;
    if (pc && canManageOrganization) {
      const settlementType = pc.settlement_type || (pc.hasSubaccount ? 'bank' : (pc.momo_phone_masked || pc.momo_provider ? 'momo' : 'bank'));
      const businessName = pc.business_name?.trim() || org?.name?.trim() || org?.legalName?.trim() || '';
      const contactEmail = pc.primary_contact_email?.trim() || org?.email?.trim() || org?.supportEmail?.trim() || '';
      paymentCollectionForm.reset({
        settlement_type: settlementType,
        business_name: businessName,
        bank_code: pc.bank_code || '',
        bank_name: pc.bank_name || '',
        account_number: '',
        primary_contact_email: contactEmail,
        momo_phone: '',
        momo_provider: (pc.momo_provider || '').toUpperCase() || '',
      });
    }
  }, [paymentCollectionData, organizationData, canManageOrganization]);

  useEffect(() => {
    const rawPc = paymentCollectionData?.data ?? paymentCollectionData;
    const pcInner =
      rawPc && typeof rawPc === 'object' && rawPc.data != null && (rawPc.success === true || rawPc.success === 'true')
        ? rawPc.data
        : rawPc;
    const mc = pcInner?.mtn_collection;
    if (mc && canManageOrganization) {
      setMtnCredForm((f) => ({
        ...f,
        environment: mc.environment === 'production' ? 'production' : 'sandbox',
        collectionApiUrl: mc.collectionApiUrl || '',
        callbackUrl: mc.callbackUrl || ''
      }));
    }
  }, [paymentCollectionData, canManageOrganization]);

  useEffect(() => {
    if (organizationData?.data) {
      const organization = organizationData.data;
      organizationForm.reset({
        name: organization.name || '',
        legalName: organization.legalName || '',
        email: organization.email || '',
        phone: organization.phone || '',
        website: organization.website || '',
        logoUrl: organization.logoUrl || '',
        appName: organization.appName || '',
        primaryColor: organization.primaryColor || '',
        invoiceFooter: organization.invoiceFooter || '',
        paymentDetails: organization.paymentDetails || '',
        paymentDetailsEnabled: organization.paymentDetailsEnabled === true,
        defaultPaymentTerms: organization.defaultPaymentTerms || '',
        defaultTermsAndConditions: organization.defaultTermsAndConditions || '',
        supportEmail: organization.supportEmail || '',
        currency: organization.currency || 'GHS',
        address: {
          line1: organization.address?.line1 || '',
          line2: organization.address?.line2 || '',
          city: organization.address?.city || '',
          state: organization.address?.state || '',
          postalCode: organization.address?.postalCode || '',
          country: organization.address?.country || ''
        },
        tax: {
          vatNumber: organization.tax?.vatNumber || '',
          tin: organization.tax?.tin || '',
          enabled: organization.tax?.enabled === true,
          defaultRatePercent: parseFloat(organization.tax?.defaultRatePercent) || 0,
          pricesAreTaxInclusive: organization.tax?.pricesAreTaxInclusive === true,
          displayLabel: organization.tax?.displayLabel || 'Tax',
          otherCharges: {
            enabled: organization.tax?.otherCharges?.enabled === true,
            label: organization.tax?.otherCharges?.label || 'Transaction charge',
            ratePercent: parseFloat(organization.tax?.otherCharges?.ratePercent) || 0,
            customerBears: organization.tax?.otherCharges?.customerBears === true,
            appliesTo: organization.tax?.otherCharges?.appliesTo || 'online_payments',
          },
        },
        shopType: organization.shopType || ''
      });
      setOrganizationLogoPreview(organization.logoUrl || '');
      setOrganizationEditing(false);
    } else {
      setOrganizationLogoPreview('');
    }
  }, [organizationData, organizationForm]);

  // Fetch usage data (seat + storage) when workspace is known
  useEffect(() => {
    if (!activeTenant?.id) return;
    const fetchUsage = async () => {
      try {
        setLoadingUsage(true);
        const [seatResponse, storageResponse] = await Promise.all([
          inviteService.getSeatUsage(),
          inviteService.getStorageUsage(),
        ]);
        if (seatResponse?.success) {
          setSeatUsage(seatResponse.data);
        }
        if (storageResponse?.success) {
          setStorageUsage(storageResponse.data);
        }
      } catch (error) {
        console.error('Failed to fetch usage data:', error);
      } finally {
        setLoadingUsage(false);
      }
    };
    fetchUsage();
  }, [activeTenant?.id]);

  useEffect(() => {
    if (profileData?.data) {
      profileForm.reset({
        name: profileData.data.name || '',
        email: profileData.data.email || '',
        profilePicture: profileData.data.profilePicture || '',
      });
      setProfilePreview(profileData.data.profilePicture || '');
    }
  }, [profileData, profileForm]);

  useEffect(() => {
    const prefs = profileData?.data?.notificationPreferences;
    if (prefs?.categories) {
      setNotificationPrefsDraft({
        categories: JSON.parse(JSON.stringify(prefs.categories)),
      });
    }
  }, [profileData]);

  useEffect(() => {
    if (subscriptionData?.data) {
      const subscription = subscriptionData.data;
      const isTrial = subscription.plan === 'trial' || subscription.status === 'trialing';
      
      // Calculate currentPeriodEnd: if trial and no existing date, set to 30 days from now
      let currentPeriodEnd = null;
      if (subscription.currentPeriodEnd) {
        currentPeriodEnd = dayjs(subscription.currentPeriodEnd);
      } else if (isTrial) {
        // Auto-calculate 30 days from today for trial
        currentPeriodEnd = dayjs().add(30, 'days');
      }
      
      subscriptionForm.reset({
        plan: subscription.plan || 'trial',
        status: subscription.status || 'active',
        seats: subscription.seats || 5,
        currentPeriodEnd: currentPeriodEnd ? currentPeriodEnd.toDate() : null,
        notes: subscription.notes || ''
      });
    }
  }, [subscriptionData, subscriptionForm]);
  
  // Watch for plan/status changes to auto-calculate trial period end
  const planValue = subscriptionForm.watch('plan');
  const statusValue = subscriptionForm.watch('status');
  
  useEffect(() => {
    const isTrial = planValue === 'trial' || statusValue === 'trialing';
    const currentPeriodEnd = subscriptionForm.getValues('currentPeriodEnd');
    
    // If trial/trialing and no currentPeriodEnd set, auto-calculate 30 days from now
    if (isTrial && !currentPeriodEnd) {
      subscriptionForm.setValue('currentPeriodEnd', dayjs().add(30, 'days').toDate());
    }
  }, [planValue, statusValue, subscriptionForm]);

  const dismissSavingToast = useCallback(() => {
    if (savingToastDismissRef.current) {
      savingToastDismissRef.current();
      savingToastDismissRef.current = null;
    }
  }, []);

  const updateProfileMutation = useMutation({
    mutationFn: settingsService.updateProfile,
    onSuccess: (response) => {
      dismissSavingToast();
      showSuccess('Profile updated successfully');
      queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      if (response?.data) {
        profileForm.reset({
          name: response.data.name,
          email: response.data.email,
          profilePicture: response.data.profilePicture || '',
          currentPassword: '',
          newPassword: ''
        });
        setProfilePreview(response.data.profilePicture || '');
        updateUser(response.data);
        setProfileEditing(false);
        setShowChangePassword(false);
      }
    },
    onError: (error) => {
      dismissSavingToast();
      const errMsg = error?.response?.data?.message || 'Failed to update profile';
      showError(error, 'Failed to update profile. Please try again.');
    }
  });

  const updateNotificationPrefsMutation = useMutation({
    mutationFn: (categories) => authService.updateNotificationPreferences(categories),
    onSuccess: (body) => {
      showSuccess('Notification preferences saved');
      if (body?.data?.categories) {
        setNotificationPrefsDraft({
          categories: JSON.parse(JSON.stringify(body.data.categories)),
        });
      }
      queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      refreshAuthState();
    },
    onError: (error) => {
      showError(error, 'Failed to save notification preferences.');
    },
  });

  const setNotifChannel = useCallback((categoryKey, channel, value) => {
    setNotificationPrefsDraft((prev) => {
      if (!prev?.categories?.[categoryKey]) return prev;
      return {
        categories: {
          ...prev.categories,
          [categoryKey]: {
            ...prev.categories[categoryKey],
            [channel]: value,
          },
        },
      };
    });
  }, []);

  const updateOrganizationMutation = useMutation({
    mutationFn: settingsService.updateOrganization,
    onSuccess: (response) => {
      dismissSavingToast();
      showSuccess('Organization settings saved successfully');
      queryClient.invalidateQueries({ queryKey: ['settings', 'organization'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      if (response?.data) {
        organizationForm.reset(response.data);
        setOrganizationLogoPreview(response.data.logoUrl || '');
      }
      setOrganizationEditing(false);
    },
    onError: (error) => {
      dismissSavingToast();
      showError(error, 'Failed to update organization settings. Please try again.');
    }
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: settingsService.updateSubscription,
    onSuccess: () => {
      dismissSavingToast();
      showSuccess('Subscription settings saved successfully');
      queryClient.invalidateQueries({ queryKey: ['settings', 'subscription'] });
    },
    onError: (error) => {
      dismissSavingToast();
      const errMsg = error?.response?.data?.message || 'Failed to update subscription settings';
      showError(error, 'Failed to update profile. Please try again.');
    }
  });

  const updateWhatsAppMutation = useMutation({
    mutationFn: whatsappService.updateSettings,
    onSuccess: () => {
      dismissSavingToast();
      showSuccess('WhatsApp settings saved successfully');
      queryClient.invalidateQueries({ queryKey: ['settings', 'whatsapp'] });
    },
    onError: (error) => {
      dismissSavingToast();
      const errMsg = error?.response?.data?.message || 'Failed to update WhatsApp settings';
      showError(error, errMsg);
    }
  });

  const testWhatsAppMutation = useMutation({
    mutationFn: ({ accessToken, phoneNumberId }) => whatsappService.testConnection(accessToken, phoneNumberId),
    onSuccess: () => {
      showSuccess('WhatsApp connection test successful!');
    },
    onError: (error) => {
      const errMsg = error?.response?.data?.error || error?.response?.data?.message || 'Connection test failed';
      showError(error, errMsg);
    }
  });

  const updateSMSMutation = useMutation({
    mutationFn: smsService.updateSettings,
    onSuccess: () => {
      dismissSavingToast();
      showSuccess('SMS settings saved successfully');
      queryClient.invalidateQueries({ queryKey: ['settings', 'sms'] });
    },
    onError: (error) => {
      dismissSavingToast();
      const errMsg = error?.response?.data?.message || 'Failed to update SMS settings';
      showError(error, errMsg);
    }
  });

  const testSMSMutation = useMutation({
    mutationFn: (config) => smsService.testConnection(config),
    onSuccess: () => {
      showSuccess('SMS connection test successful!');
    },
    onError: (error) => {
      const errMsg = error?.response?.data?.error || error?.response?.data?.message || 'Connection test failed';
      showError(error, errMsg);
    }
  });

  const updateEmailMutation = useMutation({
    mutationFn: emailService.updateSettings,
    onSuccess: () => {
      dismissSavingToast();
      showSuccess('Email settings saved successfully');
      setEmailEditing(false);
      queryClient.invalidateQueries({ queryKey: ['settings', 'email'] });
      queryClient.invalidateQueries({ queryKey: ['settings', 'notification-channels'] });
    },
    onError: (error) => {
      dismissSavingToast();
      const errMsg = error?.response?.data?.message || 'Failed to update Email settings';
      showError(error, errMsg);
    }
  });

  const testEmailMutation = useMutation({
    mutationFn: (config) => emailService.testConnection(config),
    onSuccess: () => {
      showSuccess('Email connection test successful!');
    },
    onError: (error) => {
      const errMsg = error?.response?.data?.error || error?.response?.data?.message || 'Connection test failed';
      showError(error, errMsg);
    }
  });

  const updatePaymentCollectionMutation = useMutation({
    mutationFn: settingsService.updatePaymentCollectionSettings,
    onSuccess: async (response) => {
      dismissSavingToast();
      showSuccess(response?.message || 'Payment collection updated');
      setPaymentVerifyPassword('');
      setPaymentVerifyOtp('');
      setPaymentOtpSent(false);
      const data = response?.data ?? response;
      if (data && activeTenant?.id) {
        const payload = { success: true, data: { ...data, configured: true } };
        queryClient.setQueryData(['settings', 'payment-collection', activeTenant.id], payload);
      }
      await queryClient.invalidateQueries({ queryKey: ['settings', 'payment-collection'] });
    },
    onError: (error) => {
      dismissSavingToast();
      showError(error?.response?.data?.message || error?.message || 'Failed to update payment collection');
    },
  });

  const updatePOSConfigMutation = useMutation({
    mutationFn: settingsService.updatePOSConfig,
    onSuccess: async (response) => {
      dismissSavingToast();
      showSuccess('Configuration saved successfully');
      await queryClient.invalidateQueries({ queryKey: ['settings', 'pos-config'] });
      const data = response?.data ?? response;
      if (data) {
        posConfigForm.reset({
          receipt: { ...posConfigForm.getValues('receipt'), ...(data.receipt || {}) },
          print: { ...posConfigForm.getValues('print'), ...(data.print || {}) },
          customer: { ...posConfigForm.getValues('customer'), ...(data.customer || {}) },
        });
      }
      setPosConfigEditing(false);
    },
    onError: (error) => {
      dismissSavingToast();
      const errMsg = error?.response?.data?.message || 'Failed to update configuration';
      showError(error, errMsg);
    },
  });

  const onProfileSubmit = async (values) => {
    const payload = {
      name: values.name,
      profilePicture: values.profilePicture || undefined
    };

    if (values.newPassword) {
      payload.password = values.newPassword;
      payload.currentPassword = values.currentPassword;
    }

    savingToastDismissRef.current = showLoading('Saving...');
    updateProfileMutation.mutate(payload);
  };

  const onOrganizationSubmit = async (values) => {
    const payload = {
      name: values.name || '',
      legalName: values.legalName || '',
      email: values.email || '',
      phone: values.phone || '',
      website: values.website || '',
      // logoUrl is excluded - it should be uploaded separately via handleOrganizationLogoUpload
      // Only include logoUrl if it's a URL (not base64) to avoid "request too large" errors
      ...(values.logoUrl && !values.logoUrl.startsWith('data:') ? { logoUrl: values.logoUrl } : {}),
      invoiceFooter: values.invoiceFooter || '',
      paymentDetails: values.paymentDetails || '',
      paymentDetailsEnabled: values.paymentDetailsEnabled === true,
      defaultPaymentTerms: values.defaultPaymentTerms || '',
      defaultTermsAndConditions: values.defaultTermsAndConditions || '',
      supportEmail: values.supportEmail || '',
      address: {
        line1: values.address?.line1 || '',
        line2: values.address?.line2 || '',
        city: values.address?.city || '',
        state: values.address?.state || '',
        postalCode: values.address?.postalCode || '',
        country: values.address?.country || ''
      },
      tax: {
        vatNumber: values.tax?.vatNumber || '',
        tin: values.tax?.tin || '',
        enabled: values.tax?.enabled === true,
        defaultRatePercent: Number(values.tax?.defaultRatePercent) || 0,
        pricesAreTaxInclusive: values.tax?.pricesAreTaxInclusive === true,
        displayLabel: values.tax?.displayLabel || 'Tax',
        otherCharges: {
          enabled: values.tax?.otherCharges?.enabled === true,
          label: values.tax?.otherCharges?.label || 'Transaction charge',
          ratePercent: Number(values.tax?.otherCharges?.ratePercent) || 0,
          customerBears: values.tax?.otherCharges?.customerBears === true,
          appliesTo:
            values.tax?.otherCharges?.appliesTo === 'all_payments'
              ? 'all_payments'
              : 'online_payments',
        },
      },
      ...(values.shopType !== undefined ? { shopType: values.shopType || '' } : {}),
      ...(activeTenant?.plan === 'enterprise' ? {
        appName: (values.appName || '').trim() || '',
        primaryColor: (values.primaryColor || '').trim() || ''
      } : {})
    };

    savingToastDismissRef.current = showLoading('Saving...');
    updateOrganizationMutation.mutate(payload);
  };

  const onSubscriptionSubmit = async (values) => {
    const payload = {
      plan: values.plan,
      status: values.status,
      seats: values.seats,
      currentPeriodEnd: values.currentPeriodEnd ? values.currentPeriodEnd.toISOString() : null,
      notes: values.notes || ''
    };

    savingToastDismissRef.current = showLoading('Saving...');
    updateSubscriptionMutation.mutate(payload);
  };

  const onWhatsAppSubmit = async (values) => {
    const payload = {
      enabled: values.enabled || false,
      phoneNumberId: values.phoneNumberId || '',
      accessToken: values.accessToken || '', // Only send if changed
      businessAccountId: values.businessAccountId || '',
      webhookVerifyToken: values.webhookVerifyToken || '',
      templateNamespace: values.templateNamespace || ''
    };

    savingToastDismissRef.current = showLoading('Saving...');
    updateWhatsAppMutation.mutate(payload);
  };

  /** Build config for WhatsApp test. Returns null and shows error if validation fails. */
  const getWhatsAppTestConfig = (values) => {
    const hasStoredToken = whatsappData?.data?.accessTokenConfigured === true;
    if (!values?.phoneNumberId?.trim()) {
      showError(null, 'Please provide Phone Number ID to test connection');
      return null;
    }
    if (!values?.accessToken?.trim() && !hasStoredToken) {
      showError(null, 'Please provide Access Token or save WhatsApp settings with a token first');
      return null;
    }
    return {
      accessToken: values.accessToken?.trim() || '',
      phoneNumberId: values.phoneNumberId.trim()
    };
  };

  const handleTestWhatsApp = () => {
    const config = getWhatsAppTestConfig(whatsappForm.getValues());
    if (config) testWhatsAppMutation.mutate(config);
  };

  /** When Enable WhatsApp is toggled ON: run connection test; only enable if test succeeds. */
  const handleWhatsAppEnabledChange = (checked, fieldOnChange) => {
    if (!checked) {
      fieldOnChange(false);
      return;
    }
    const config = getWhatsAppTestConfig(whatsappForm.getValues());
    if (!config) return;
    testWhatsAppMutation
      .mutateAsync(config)
      .then(() => {
        fieldOnChange(true);
        showSuccess('Connection verified. WhatsApp is enabled.');
      })
      .catch(() => { /* Error already shown by testWhatsAppMutation.onError */ });
  };

  const onSMSSubmit = async (values) => {
    const payload = { ...values };
    savingToastDismissRef.current = showLoading('Saving...');
    updateSMSMutation.mutate(payload);
  };

  /** Build config for SMS test. Returns null and shows error if validation fails. */
  const getSMSTestConfig = (values) => {
    const provider = values?.provider || 'termii';
    let config = { provider };
    if (provider === 'termii') {
      if (!values?.apiKey?.trim()) {
        showError(null, 'Please provide API Key to test connection');
        return null;
      }
      config = { ...config, apiKey: values.apiKey.trim() };
    } else if (provider === 'twilio') {
      if (!values?.accountSid?.trim() || !values?.authToken) {
        showError(null, 'Please provide Account SID and Auth Token to test connection');
        return null;
      }
      config = { ...config, accountSid: values.accountSid.trim(), authToken: values.authToken };
    } else if (provider === 'africas_talking') {
      if (!values?.apiKey?.trim() || !values?.username?.trim()) {
        showError(null, 'Please provide API Key and Username to test connection');
        return null;
      }
      config = { ...config, apiKey: values.apiKey.trim(), username: values.username.trim() };
    }
    return config;
  };

  const handleTestSMS = () => {
    const config = getSMSTestConfig(smsForm.getValues());
    if (config) testSMSMutation.mutate(config);
  };

  /** When Enable SMS is toggled ON: run connection test; only enable if test succeeds. */
  const handleSMSEnabledChange = (checked, fieldOnChange) => {
    if (!checked) {
      fieldOnChange(false);
      return;
    }
    const config = getSMSTestConfig(smsForm.getValues());
    if (!config) return;
    testSMSMutation
      .mutateAsync(config)
      .then(() => {
        fieldOnChange(true);
        showSuccess('Connection verified. SMS is enabled.');
      })
      .catch(() => { /* Error already shown by testSMSMutation.onError */ });
  };

  const onEmailSubmit = async (values) => {
    const payload = { ...values };
    savingToastDismissRef.current = showLoading('Saving...');
    updateEmailMutation.mutate(payload);
  };

  const handleVerifyPaymentPassword = async () => {
    const pwd = (paymentVerifyPassword || '').trim();
    if (!isGoogleUser && !pwd) {
      showError(null, 'Enter your account password');
      return;
    }
    setPaymentPasswordVerifying(true);
    try {
      await settingsService.verifyPaymentCollectionPassword(isGoogleUser ? undefined : pwd);
      setPaymentVerifyOtp('');
      setPaymentPasswordVerified(true);
      setPaymentOtpSent(true);
      showSuccess('Verification code sent to your email. Enter it below.');
      settingsService.sendPaymentCollectionOtp(isGoogleUser ? undefined : pwd).catch((otpErr) => {
        showError(otpErr, otpErr?.response?.data?.message || 'Failed to send verification code');
      });
    } catch (err) {
      showError(err, err?.response?.data?.message || (isGoogleUser ? 'Verification failed' : 'Invalid password'));
    } finally {
      setPaymentPasswordVerifying(false);
    }
  };

  const onPaymentCollectionSubmit = async (values) => {
    const pwd = (paymentVerifyPassword || '').trim();
    const otpRaw = (paymentVerifyOtp || '').trim();
    const otp = otpRaw.replace(/\D/g, '');
    if ((!isGoogleUser && !pwd) || !otp || otp.length !== 6) {
      showError(null, isGoogleUser ? 'A 6-digit verification code is required' : 'Password and a 6-digit verification code are required');
      return;
    }
    const settlementType = values.settlement_type || 'bank';
    savingToastDismissRef.current = showLoading('Saving...');
    if (settlementType === 'momo') {
      const momoPhone = String(values.momo_phone || '').replace(/\s/g, '');
      const momoProvider = (values.momo_provider || '').toUpperCase().trim();
      updatePaymentCollectionMutation.mutate({
        settlement_type: 'momo',
        business_name: values.business_name.trim(),
        momo_phone: momoPhone,
        momo_provider: momoProvider,
        primary_contact_email: values.primary_contact_email?.trim() || undefined,
        ...(isGoogleUser ? {} : { password: pwd }),
        otp,
      });
    } else {
      const bank = Array.isArray(paymentCollectionBanks) ? paymentCollectionBanks.find((b) => b.code === values.bank_code) : (paymentCollectionBanks?.data ?? []).find((b) => b.code === values.bank_code);
      updatePaymentCollectionMutation.mutate({
        settlement_type: 'bank',
        business_name: values.business_name.trim(),
        bank_code: values.bank_code,
        bank_name: bank?.name || values.bank_name || '',
        account_number: String(values.account_number).replace(/\s/g, ''),
        primary_contact_email: values.primary_contact_email?.trim() || undefined,
        ...(isGoogleUser ? {} : { password: pwd }),
        otp,
      });
    }
  };

  const onPOSConfigSubmit = async (values) => {
    const mode = values.receipt?.mode || 'ask';
    let channels = values.receipt?.channels || [];
    if (mode === 'auto_print') {
      channels = ['print'];
    } else if (mode === 'auto_send') {
      channels = channels.filter((c) => ['sms', 'whatsapp', 'email'].includes(c));
      if (channels.length === 0) channels = ['sms'];
    }
    const payload = {
      receipt: { ...values.receipt, mode, channels },
      print: values.print || {},
      customer: values.customer || {}
    };
    savingToastDismissRef.current = showLoading('Saving...');
    updatePOSConfigMutation.mutate(payload);
  };

  /** Build config for email test from form values. Returns null and shows error if validation fails. */
  const getEmailTestConfig = (values) => {
    const provider = values?.provider || 'smtp';
    let config = { provider };
    if (provider === 'smtp') {
      if (!values?.smtpHost?.trim() || !values?.smtpUser?.trim() || !values?.smtpPassword) {
        showError(null, 'Please provide SMTP Host, User, and Password to test connection');
        return null;
      }
      config = {
        ...config,
        smtpHost: values.smtpHost.trim(),
        smtpPort: values.smtpPort || 587,
        smtpUser: values.smtpUser.trim(),
        smtpPassword: values.smtpPassword,
        smtpRejectUnauthorized: values.smtpRejectUnauthorized !== false
      };
    } else if (provider === 'sendgrid') {
      if (!values?.sendgridApiKey?.trim()) {
        showError(null, 'Please provide SendGrid API Key to test connection');
        return null;
      }
      config = { ...config, sendgridApiKey: values.sendgridApiKey.trim() };
    } else if (provider === 'ses') {
      if (!values?.sesAccessKeyId?.trim() || !values?.sesSecretAccessKey) {
        showError(null, 'Please provide AWS SES Access Key ID and Secret Access Key to test connection');
        return null;
      }
      config = {
        ...config,
        sesAccessKeyId: values.sesAccessKeyId.trim(),
        sesSecretAccessKey: values.sesSecretAccessKey,
        sesRegion: values.sesRegion || 'us-east-1',
        sesHost: values.sesHost?.trim()
      };
    }
    return config;
  };

  const handleTestEmail = () => {
    const config = getEmailTestConfig(emailForm.getValues());
    if (config) testEmailMutation.mutate(config);
  };

  /** When Enable email is toggled ON: run connection test; only enable if test succeeds. */
  const handleEmailEnabledChange = (checked, fieldOnChange) => {
    if (!checked) {
      fieldOnChange(false);
      return;
    }
    const config = getEmailTestConfig(emailForm.getValues());
    if (!config) return;
    testEmailMutation
      .mutateAsync(config)
      .then(() => {
        fieldOnChange(true);
        showSuccess('Connection verified. Email is enabled.');
      })
      .catch(() => { /* Error already shown by testEmailMutation.onError */ });
  };

  const handleProfileImageUpload = async ({ file }) => {
    if (!file) return;
    setProfileUploading(true);
    try {
      const response = await settingsService.uploadProfilePicture(file);
      const updatedUser = response?.data?.data || response?.data || response;
      
      if (!updatedUser) {
        throw new Error('Invalid response from server');
      }

      const imageUrl = updatedUser.profilePicture || '';
      
      if (!imageUrl) {
        throw new Error('Upload succeeded but no image URL returned');
      }

      profileForm.setValue('profilePicture', imageUrl);
      setProfilePreview(imageUrl);
      updateUser(updatedUser);
      await refreshAuthState();
      queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] });
      showSuccess('Profile picture updated successfully');
    } catch (error) {
      const errMsg = error?.response?.data?.message || error?.message || 'Failed to upload profile picture';
      showError(error, errMsg);
    } finally {
      setProfileUploading(false);
    }
  };

  const handleOrganizationLogoUpload = async ({ file }) => {
    if (!file) return;
    setOrganizationLogoUploading(true);
    try {
      const response = await settingsService.uploadOrganizationLogo(file);
      const result = response?.data || response;
      const organization = result?.data || result;
      organizationForm.setValue('logoUrl', organization.logoUrl || '');
      setOrganizationLogoPreview(organization.logoUrl || '');
      queryClient.invalidateQueries({ queryKey: ['settings', 'organization'] });
      showSuccess('Organization logo updated successfully');
    } catch (error) {
      showError(error, 'Failed to upload organization logo. Please try again.');
    } finally {
      setOrganizationLogoUploading(false);
    }
  };

  const subscriptionHistory = subscriptionData?.data?.history || [];

  const subscriptionSummary = useMemo(() => {
    if (!subscriptionData?.data) return null;
    const subscription = subscriptionData.data;
    const isTrialPlan = subscription.plan === 'trial';
    const statusColor = subscription.status === 'active' ? 'text-green-600' : subscription.status === 'trialing' ? 'text-yellow-600' : 'text-red-600';
    return (
      <div className="mb-2 md:mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
          <ShadcnCard className="border-0 shadow-none bg-transparent md:border md:bg-card">
            <CardContent className="pt-2 md:pt-6 px-0 md:px-6 pb-2 md:pb-6">
              <h4 className="text-sm md:text-lg font-semibold mb-1 md:mb-2">
                {subscription.plan?.toUpperCase() || 'FREE'}
              </h4>
              <p className={statusColor}>
                {subscription.status?.toUpperCase()}
              </p>
              {subscription.currentPeriodEnd && (
                <div className="mt-2 md:mt-3">
                  <p className="text-xs md:text-sm text-muted-foreground">Renews</p>
                  <div className="text-sm md:text-base font-medium">
                    {dayjs(subscription.currentPeriodEnd).format('MMM DD, YYYY')}
                  </div>
                </div>
              )}
              {isTrialPlan && (
                <div className="mt-2 md:mt-4">
                  <Button
                    className="w-full"
                    onClick={() => {
                      navigate('/checkout', {
                        state: {
                          plan: 'professional',
                          billingPeriod: 'monthly',
                          price: 199
                        }
                      });
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                      border: 'none',
                      fontWeight: 500,
                      color: 'white'
                    }}
                  >
                    Upgrade to Pro
                  </Button>
                </div>
              )}
            </CardContent>
          </ShadcnCard>
          <ShadcnCard className="border-0 shadow-none bg-transparent md:border md:bg-card">
            <CardContent className="pt-2 md:pt-6 px-0 md:px-6 pb-2 md:pb-6">
              <p className="text-xs text-muted-foreground">Notes</p>
              <div className="mt-1 md:mt-3">
                <p className="text-xs md:text-sm">{subscription.notes || '—'}</p>
              </div>
            </CardContent>
          </ShadcnCard>
        </div>
      </div>
    );
  }, [subscriptionData, navigate]);

  const { theme, setTheme } = useTheme();
  const { hintMode, setHintMode } = useHintMode();

  const organization = organizationData?.data || {};
  const organizationLogo = organizationLogoPreview || organization.logoUrl || '';
  const mockInvoice = useMemo(() => ({
    invoiceNumber: 'INV-2024-001',
    invoiceDate: new Date(),
    dueDate: dayjs().add(30, 'days').toDate(),
    customer: {
      name: 'Customer name',
      company: 'Company name',
      email: 'customer@example.com',
      phone: '+233 XX XXX XXXX',
      address: '123 Sample Street',
      city: 'Sample City',
      state: 'Sample State',
      zipCode: 'SAMPLE-123'
    },
    items: [
      { description: 'Sample Product/Service 1', quantity: 2, unitPrice: 100.00, total: 200.00 },
      { description: 'Sample Product/Service 2', quantity: 1, unitPrice: 150.00, total: 150.00 }
    ],
    subtotal: 350.00,
    taxRate: 12.5,
    taxAmount: 43.75,
    discountAmount: 0,
    totalAmount: 393.75,
    balance: 393.75,
    paymentTerms: organization.defaultPaymentTerms || 'Net 30',
    termsAndConditions: organization.defaultTermsAndConditions || 'Payment is due within 30 days of invoice date.'
  }), [organization.defaultPaymentTerms, organization.defaultTermsAndConditions]);

  const appearanceTab = (
    <ShadcnCard className="border-0 shadow-none bg-transparent md:border md:bg-card">
      <CardHeader className="p-0 md:p-6 pb-2 md:pb-6">
        <CardTitle className="text-base md:text-2xl">Appearance</CardTitle>
        <CardDescription className="mt-1 md:mt-0 text-xs md:text-sm">
          Customize how the app looks on your device.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 md:p-6 pt-0 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between py-1 md:py-0">
          <div className="flex items-center gap-3">
            <Moon className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="font-medium text-sm md:text-base">Dark mode</p>
              <p className="text-xs md:text-sm text-muted-foreground">
                Use dark theme for a more comfortable view in low light.
              </p>
            </div>
          </div>
          <Switch
            checked={theme === 'dark'}
            onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
          />
        </div>

        <div className="flex items-center justify-between py-1 md:py-0">
          <div className="flex items-center gap-3">
            <Lightbulb className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="font-medium text-sm md:text-base">Hint Mode</p>
              <p className="text-xs md:text-sm text-muted-foreground">
                Show hints when hovering over buttons, icons, and stats.
              </p>
            </div>
          </div>
          <Switch
            checked={hintMode}
            onCheckedChange={setHintMode}
          />
        </div>

        <Separator className="my-3 md:my-0" />

        <div>
          <h3 className="text-sm font-medium mb-2 md:mb-4">Invoice Preview</h3>
          <p className="text-xs md:text-sm text-muted-foreground mb-2 md:mb-4">
            Preview how your invoice will look with your current branding
          </p>
          <div className="border rounded-lg p-2 md:p-4 bg-card" style={{ maxHeight: '800px', overflow: 'auto' }}>
            <PrintableInvoice
              invoice={mockInvoice}
              organization={{
                ...organization,
                logoUrl: organizationLogo || organization.logoUrl
              }}
              maskAmounts
            />
          </div>
        </div>
      </CardContent>
    </ShadcnCard>
  );

  const notificationsTab = (
    <ShadcnCard className="border-0 shadow-none bg-transparent md:border md:bg-card">
      <CardHeader className="p-0 md:p-6 pb-2 md:pb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <CardTitle className="text-base md:text-2xl flex items-center gap-2">
              <Bell className="h-5 w-5 text-muted-foreground shrink-0" />
              Notifications
            </CardTitle>
            <CardDescription className="mt-1 md:mt-0 text-xs md:text-sm">
              Choose what appears in the notification bell and whether to also get a copy by email at{' '}
              <span className="font-medium text-foreground">{user?.email || 'your account email'}</span>.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <Button
              variant="secondaryStroke"
              type="button"
              disabled={loadingProfile || !notificationPrefsDraft}
              onClick={() => {
                const prefs = profileData?.data?.notificationPreferences;
                if (prefs?.categories) {
                  setNotificationPrefsDraft({
                    categories: JSON.parse(JSON.stringify(prefs.categories)),
                  });
                }
              }}
            >
              Reset
            </Button>
            <Button
              type="button"
              disabled={
                loadingProfile || !notificationPrefsDraft || updateNotificationPrefsMutation.isPending
              }
              onClick={() => {
                if (notificationPrefsDraft?.categories) {
                  updateNotificationPrefsMutation.mutate(notificationPrefsDraft.categories);
                }
              }}
            >
              {updateNotificationPrefsMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving…
                </>
              ) : (
                'Save preferences'
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 md:p-6 pt-0 space-y-4">
        <Alert>
          <AlertTitle>Security and account email</AlertTitle>
          <AlertDescription className="text-xs md:text-sm">
            Password reset, email verification, and workspace invitations are sent when required. They are not controlled by these toggles.
          </AlertDescription>
        </Alert>
        {loadingProfile || !notificationPrefsDraft ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            Loading preferences…
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 md:gap-4 px-3 py-2 md:px-4 md:py-3 bg-muted/50 text-xs md:text-sm font-medium border-b border-border">
              <span>Category</span>
              <span className="text-center w-[72px] md:w-24">In-app</span>
              <span className="text-center w-[72px] md:w-24">Email</span>
            </div>
            {NOTIFICATION_PREFERENCE_CATEGORY_ORDER.map((key) => {
              const row = notificationPrefsDraft.categories[key];
              if (!row) return null;
              const label = NOTIFICATION_PREFERENCE_CATEGORY_LABELS[key] || key;
              return (
                <div
                  key={key}
                  className="grid grid-cols-[1fr_auto_auto] gap-2 md:gap-4 px-3 py-3 md:px-4 md:py-3 border-b border-border last:border-b-0 items-center"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    {key === 'user' && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Invitation messages are always delivered.
                      </p>
                    )}
                  </div>
                  <div className="flex justify-center w-[72px] md:w-24">
                    <Switch
                      checked={row.in_app !== false}
                      onCheckedChange={(v) => setNotifChannel(key, 'in_app', v)}
                    />
                  </div>
                  <div className="flex justify-center w-[72px] md:w-24">
                    <Switch
                      checked={row.email === true}
                      onCheckedChange={(v) => setNotifChannel(key, 'email', v)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </ShadcnCard>
  );

  const profileTab = (
    <div className="w-full">
      <div className="w-full">
        <ShadcnCard className="border-0 shadow-none bg-transparent md:border md:bg-card">
          <CardHeader className="p-0 md:p-6 pb-2 md:pb-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-0">
              <CardTitle className="text-base md:text-xl">Personal Information</CardTitle>
              <div className="flex gap-1.5 md:gap-2 w-full md:w-auto">
                <Button
                  variant="secondaryStroke"
                  onClick={() => {
                    if (profileEditing) {
                      if (profileData?.data) {
                        profileForm.reset({
                          name: profileData.data.name,
                          email: profileData.data.email,
                          profilePicture: profileData.data.profilePicture || '',
                          currentPassword: '',
                          newPassword: ''
                        });
                        setProfilePreview(profileData.data.profilePicture || '');
                      }
                      setShowChangePassword(false);
                    }
                    setProfileEditing((prev) => !prev);
                  }}
                >
                  {profileEditing ? 'Cancel' : 'Edit Profile'}
                </Button>
                {profileEditing && (
                  <Button onClick={profileForm.handleSubmit(onProfileSubmit)} loading={updateProfileMutation.isLoading}>
                    Save
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 md:p-6 pt-2 md:pt-0 pb-0 md:pb-6">
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-3 md:space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <FormField
                  control={profileForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your full name" disabled={!profileEditing} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" disabled {...field} />
                      </FormControl>
                      {needsEmailVerification && (
                        <p className="text-xs text-muted-foreground">Verify your email to change your account email.</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={profileForm.control}
                name="profilePicture"
                render={({ field }) => (
                  <FormItem className="hidden">
                    <FormControl>
                      <Input type="hidden" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Separator />
              <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Profile Picture</h3>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-6 mb-4 md:mb-6">
                <div className="relative">
                  <Avatar 
                    className="h-24 w-24 aspect-square cursor-pointer" 
                    onClick={() => profilePreview && setProfilePreviewVisible(true)}
                  >
                    {profilePreview && <AvatarImage src={resolveFileUrl(profilePreview)} alt="Profile" />}
                    <AvatarFallback><User className="h-8 w-8" /></AvatarFallback>
                  </Avatar>
                  <label
                    htmlFor="profile-picture-upload"
                    className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 cursor-pointer hover:bg-primary/90 border-2 border-background"
                    title="Upload profile picture"
                    onClick={(e) => {
                      // Enable edit mode if not already enabled
                      if (!profileEditing) {
                        e.preventDefault();
                        setProfileEditing(true);
                        // Trigger file input after a brief delay to ensure edit mode is enabled
                        setTimeout(() => {
                          document.getElementById('profile-picture-upload')?.click();
                        }, 100);
                      }
                    }}
                  >
                    <Camera className="h-4 w-4" />
                    <input
                      id="profile-picture-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={profileUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Ensure edit mode is enabled before uploading
                          if (!profileEditing) {
                            setProfileEditing(true);
                          }
                          handleProfileImageUpload({ file });
                        }
                        // Reset input to allow selecting the same file again
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                <div className="flex-1">
                  {!profilePreview && (
                    <p className="text-sm text-muted-foreground">
                      {profileEditing ? 'Click the camera icon to upload a profile picture' : 'No profile picture uploaded yet'}
                    </p>
                  )}
                  {profilePreview && profileEditing && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          profileForm.setValue('profilePicture', '');
                          setProfilePreview('');
                        }}
                        disabled={profileUploading}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  )}
                  {profileUploading && (
                    <div className="flex items-center gap-2 mt-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Uploading...</span>
                    </div>
                  )}
                  {!profilePreview && (
                    <p className="text-sm text-muted-foreground mt-2">Upload a square image (PNG/JPG) for best results.</p>
                  )}
                </div>
              </div>

              <Separator />
              <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Change Password</h3>

              {!showChangePassword ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowChangePassword(true);
                    if (!profileEditing) setProfileEditing(true);
                  }}
                  className="w-full md:w-auto"
                >
                  Change Password
                </Button>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <FormField
                    control={profileForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Enter current password" disabled={!profileEditing} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Enter new password" disabled={!profileEditing} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="col-span-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowChangePassword(false);
                        profileForm.setValue('currentPassword', '');
                        profileForm.setValue('newPassword', '');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <Separator />
              <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Account Information</h3>
              <div className="grid grid-cols-1 gap-3 md:gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Role</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <UserCog className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm">{profileData?.data?.role?.toUpperCase() || '—'}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <StatusChip status={profileData?.data?.isActive ? 'active_flag' : 'inactive_flag'} />
                  </div>
                </div>
              </div>
            </form>
          </Form>
          </CardContent>
        </ShadcnCard>
      </div>
    </div>
  );

  // Map businessType to display names
  const getWorkspaceTypeDisplay = (businessType) => {
    const mapping = {
      shop: 'Shop',
      printing_press: 'Studio',
      pharmacy: 'Pharmacy'
    };
    return mapping[businessType] || 'Studio';
  };

  const getWorkspaceDescription = (businessType) => {
    const descriptions = {
      shop: 'Optimized for retail sales, inventory, and customer management',
      pharmacy: 'Optimized for pharmaceutical operations and inventory',
      printing_press: 'Optimized for jobs, services, quotes, and production workflows',
    };
    return descriptions[businessType] || descriptions.printing_press;
  };

  const workspaceType = activeTenant?.businessType || 'printing_press';
  const workspaceTypeDisplay = getWorkspaceTypeDisplay(workspaceType);
  const workspaceDescription = getWorkspaceDescription(workspaceType);
  const trackingEntityLabel = isStudioLike ? 'Job' : 'Order';
  const publicTrackingUrl = useMemo(() => {
    const slug = jobInvoiceData?.tenantSlug || activeTenant?.slug;
    if (!slug) return '';
    if (typeof window === 'undefined') return `/track/${slug}`;
    return `${window.location.origin}/track/${slug}`;
  }, [jobInvoiceData?.tenantSlug, activeTenant?.slug]);

  const handleCopyTrackingUrl = useCallback(async () => {
    if (!publicTrackingUrl) return;
    try {
      await navigator.clipboard.writeText(publicTrackingUrl);
      showSuccess(`${trackingEntityLabel} tracking link copied`);
    } catch (error) {
      showError(error, 'Failed to copy tracking link');
    }
  }, [publicTrackingUrl, trackingEntityLabel]);

  const organizationTab = organizationEditing && canManageOrganization ? (
    <ShadcnCard className="border-0 shadow-none bg-transparent md:border md:bg-card">
      <CardHeader className="p-0 md:p-6 pb-2 md:pb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <CardTitle className="text-base md:text-2xl">Organization Profile</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                organizationForm.reset();
                organizationForm.reset(organization);
                setOrganizationLogoPreview(organization.logoUrl || '');
                setOrganizationEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={organizationForm.handleSubmit(onOrganizationSubmit)} loading={updateOrganizationMutation.isLoading}>
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 md:p-6 pt-0 md:pt-0 pb-0 md:pb-6">
        <Form {...organizationForm}>
          <form onSubmit={organizationForm.handleSubmit(onOrganizationSubmit)} className="space-y-3 md:space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <FormField
                control={organizationForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Nexus Studio" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={organizationForm.control}
                name="legalName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Legal Name (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Legal registered name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={organizationForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (optional)</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="info@company.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={organizationForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (optional)</FormLabel>
                    <FormControl>
                      <PhoneNumberInput placeholder="Enter phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={organizationForm.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://nexuspress.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={organizationForm.control}
                name="logoUrl"
                render={({ field }) => (
                  <FormItem className="hidden">
                    <FormControl>
                      <Input type="hidden" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {activeTenant?.plan === 'enterprise' && (
              <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
                <h3 className="text-sm font-medium">Enterprise branding</h3>
                <p className="text-xs text-muted-foreground">
                  Customize the app name and primary color shown across the app (sidebar, theme).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={organizationForm.control}
                    name="appName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>App name (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. My Business Suite" {...field} />
                        </FormControl>
                        <FormDescription>Replaces the default app name in the sidebar and header.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={organizationForm.control}
                    name="primaryColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary color (optional)</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input
                              type="color"
                              className="h-10 w-16 p-1 cursor-pointer"
                              {...field}
                              value={field.value || '#166534'}
                            />
                          </FormControl>
                          <Input
                            type="text"
                            className="flex-1 font-mono text-sm"
                            placeholder="#166534"
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        </div>
                        <FormDescription>Brand color used for buttons, links, and accent areas.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      organizationForm.setValue('appName', '', { shouldDirty: true, shouldValidate: true });
                      organizationForm.setValue('primaryColor', '', { shouldDirty: true, shouldValidate: true });
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            )}

            {organization.businessType === 'shop' && (
              <FormField
                control={organizationForm.control}
                name="shopType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shop type (optional)</FormLabel>
                    <Select
                      value={field.value || ''}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select shop type" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SHOP_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Used for default product categories and product templates.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={organizationForm.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency (optional)</FormLabel>
                  <Select
                    value={field.value || 'GHS'}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((curr) => (
                        <SelectItem key={curr.code} value={curr.code}>
                          {curr.symbol} - {curr.name} ({curr.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Currency used for invoices, quotes, and all financial displays.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

        <div className="border-t border-border pt-4 mt-4 md:pt-6 md:mt-6 md:-mx-6 md:px-6">
          <h3 className="text-sm font-medium mb-2 md:mb-4">Branding</h3>
          <div className="mb-6">
          <FileUpload
            onFileSelect={handleOrganizationLogoUpload}
            disabled={false}
            uploading={organizationLogoUploading}
            accept="image/*"
            maxSizeMB={5}
            uploadedFiles={organizationLogoPreview || organization.logoUrl ? [{
              id: 'organization-logo',
              fileUrl: organizationLogoPreview || organization.logoUrl,
              originalName: 'Organization Logo',
              name: 'Organization Logo',
              url: resolveFileUrl(organizationLogoPreview || organization.logoUrl)
            }] : []}
            onFilePreview={() => setOrganizationLogoPreviewVisible(true)}
            onFileRemove={() => {
              organizationForm.setValue('logoUrl', '');
              setOrganizationLogoPreview('');
            }}
            showFileList={true}
            emptyMessage="No organization logo uploaded yet."
          />
          <p className="text-sm text-muted-foreground mt-2">Upload a high-resolution image for invoices and quotes.</p>
          </div>
        </div>

        <div className="border-t border-border pt-4 mt-4 md:pt-6 md:mt-6 md:-mx-6 md:px-6">
          <h3 className="text-sm font-medium mb-2 md:mb-4">Address</h3>
          <div className="space-y-3 md:space-y-4">
          <FormField
            control={organizationForm.control}
            name="address.line1"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Street Address (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="123 Main St" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={organizationForm.control}
            name="address.line2"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address Line 2 (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Suite / Landmark" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FormField
            control={organizationForm.control}
            name="address.city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City (optional)</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={organizationForm.control}
            name="address.state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State / Region (optional)</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={organizationForm.control}
            name="address.postalCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Postal Code (optional)</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={organizationForm.control}
            name="address.country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Ghana" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        </div>

        <div className="border-t border-border pt-4 mt-4 md:pt-6 md:mt-6 md:-mx-6 md:px-6">
          <h3 className="text-sm font-medium mb-2 md:mb-4">Tax & Compliance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <FormField
            control={organizationForm.control}
            name="tax.vatNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>VAT Number (optional)</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={organizationForm.control}
            name="tax.tin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>TIN (optional)</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={organizationForm.control}
            name="tax.enabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3 md:col-span-2">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Charge tax on sales</FormLabel>
                  <p className="text-sm text-muted-foreground">Apply your default rate to POS, quotes, and new invoices when enabled.</p>
                </div>
                <FormControl>
                  <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={organizationForm.control}
            name="tax.defaultRatePercent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default tax rate (%)</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    name={field.name}
                    ref={field.ref}
                    value={
                      field.value === '' || field.value === null || field.value === undefined
                        ? ''
                        : String(field.value)
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        field.onChange('');
                        return;
                      }
                      if (/^\d*\.?\d*$/.test(raw)) {
                        field.onChange(raw);
                      }
                    }}
                    onBlur={() => {
                      field.onBlur();
                      const v = field.value;
                      if (v === '' || v === undefined || v === null) {
                        field.onChange(0);
                        return;
                      }
                      const n = parseFloat(String(v));
                      field.onChange(Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={organizationForm.control}
            name="tax.pricesAreTaxInclusive"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Product prices include tax</FormLabel>
                  <p className="text-sm text-muted-foreground">Turn on if catalog and POS unit prices are tax-inclusive.</p>
                </div>
                <FormControl>
                  <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={organizationForm.control}
            name="tax.displayLabel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tax label on documents (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. VAT, NHIL, Sales tax" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={organizationForm.control}
            name="tax.otherCharges.enabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3 md:col-span-2">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Enable other charges</FormLabel>
                  <p className="text-sm text-muted-foreground">
                    Add a payment charge (for example Paystack 2%) to online checkouts.
                  </p>
                </div>
                <FormControl>
                  <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={organizationForm.control}
            name="tax.otherCharges.label"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Other charge label (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Transaction charge, Paystack fee" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={organizationForm.control}
            name="tax.otherCharges.ratePercent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Other charge rate (%)</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={field.value === '' || field.value === null || field.value === undefined ? '' : String(field.value)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        field.onChange('');
                        return;
                      }
                      if (/^\d*\.?\d*$/.test(raw)) field.onChange(raw);
                    }}
                    onBlur={() => {
                      field.onBlur();
                      const n = parseFloat(String(field.value || 0));
                      field.onChange(Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={organizationForm.control}
            name="tax.otherCharges.customerBears"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Customer bears this charge</FormLabel>
                  <p className="text-sm text-muted-foreground">When on, checkout amount includes this charge.</p>
                </div>
                <FormControl>
                  <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        </div>

        <div className="border-t border-border pt-4 mt-4 md:pt-6 md:mt-6 md:-mx-6 md:px-6">
          <h3 className="text-sm font-medium mb-2 md:mb-4">Automations</h3>
          <Alert className="border-border">
            <AlertTitle>Automation behavior moved</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                Configure rule triggers, conditions, and actions in the dedicated Automations page.
                Provider credentials stay in Settings.
              </p>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/automations')}
                >
                  Open Automations
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>

        <div className="border-t border-border pt-4 mt-4 md:pt-6 md:mt-6 md:-mx-6 md:px-6">
          <FormField
            control={organizationForm.control}
            name="invoiceFooter"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Invoice & Quote Footer (optional)</FormLabel>
                <FormControl>
                  <Textarea rows={4} placeholder="Enter your custom footer message" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={organizationForm.control}
            name="paymentDetails"
            render={({ field }) => (
              <FormItem className="mt-4">
                <FormLabel>Payment details (Pay to) (optional)</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    placeholder="Enter the bank or mobile money details customers should pay to. This will appear under “Pay to” on invoices and quotes."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={organizationForm.control}
            name="paymentDetailsEnabled"
            render={({ field }) => (
              <FormItem className="mt-4 flex flex-row items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Show Pay To on invoices and quotes</FormLabel>
                  <FormDescription>
                    Turn this on to display your saved payment details on customer documents.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <FormField
            control={organizationForm.control}
            name="defaultPaymentTerms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Payment Terms (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Net 30, Due on Receipt" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={organizationForm.control}
            name="defaultTermsAndConditions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Terms & Conditions (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Payment due within 30 days" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={organizationForm.control}
          name="supportEmail"
          render={({ field }) => (
            <FormItem className="mt-4">
              <FormLabel>Support / Contact Email (optional)</FormLabel>
              <FormControl>
                <Input type="email" placeholder="Used for Contact support link" {...field} />
              </FormControl>
              <FormDescription>Email address used when users click &quot;Contact support&quot;</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        </div>
          </form>
        </Form>
      </CardContent>
    </ShadcnCard>
  ) : (
    <ShadcnCard className="border-0 shadow-none bg-transparent md:border md:bg-card">
      <CardHeader className="p-0 md:p-6 pb-2 md:pb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <CardTitle className="text-base md:text-2xl">Organization Profile</CardTitle>
          {canManageOrganization && (
            <Button
              variant="secondaryStroke"
              size="sm"
              className="shrink-0"
              onClick={() => {
                organizationForm.reset(organization);
                setOrganizationLogoPreview(organization.logoUrl || '');
                setOrganizationEditing(true);
              }}
            >
              Edit Organization
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 md:p-6 pt-0">
        {loadingOrganization ? (
          <div className="flex items-center justify-center py-6 md:py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <ShadcnDescriptions>
              <DescriptionItem label="Display Name">{organization.name || '—'}</DescriptionItem>
              <DescriptionItem label="Legal Name">{organization.legalName || '—'}</DescriptionItem>
              <DescriptionItem label="Email">{organization.email || '—'}</DescriptionItem>
              <DescriptionItem label="Phone">{organization.phone || 'Not set'}</DescriptionItem>
              <DescriptionItem label="Website">{organization.website || 'Not set'}</DescriptionItem>
              {organization.businessType === 'shop' && (
                <DescriptionItem label="Shop type">
                  {organization.shopType ? (SHOP_TYPE_LABELS[organization.shopType] || organization.shopType) : 'Not set'}
                </DescriptionItem>
              )}
            </ShadcnDescriptions>

      <div className="border-t border-border pt-4 mt-4 md:pt-6 md:mt-6 md:-mx-6 md:px-6">
        <h3 className="text-sm font-medium mb-2 md:mb-4">Branding</h3>
        <div className="flex items-center gap-4 md:gap-6">
        <div
          style={{
            width: 120,
            height: 120,
            border: '1px dashed #d9d9d9',
            borderRadius: 8,
            background: '#fafafa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
        >
          {organizationLogoPreview || organization.logoUrl ? (
            <img
              src={resolveFileUrl(organizationLogoPreview || organization.logoUrl)}
              alt="Organization logo"
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8, cursor: 'pointer' }}
              onClick={() => setOrganizationLogoPreviewVisible(true)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No logo uploaded</p>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-2">This logo is displayed on invoices and quotes.</p>
          {canManageOrganization && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                document.getElementById('organization-logo-upload')?.click();
              }}
              loading={organizationLogoUploading}
            >
              {organizationLogoPreview || organization.logoUrl ? 'Update Logo' : 'Upload Logo'}
            </Button>
          )}
          <input
            id="organization-logo-upload"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleOrganizationLogoUpload({ file });
              }
              // Reset input so the same file can be selected again
              e.target.value = '';
            }}
          />
        </div>
        </div>
      </div>

      {activeTenant?.plan === 'enterprise' && (
        <div className="border-t border-border pt-4 mt-4 md:pt-6 md:mt-6 md:-mx-6 md:px-6">
          <h3 className="text-sm font-medium mb-2 md:mb-4">Enterprise branding</h3>
          <ShadcnDescriptions>
            <DescriptionItem label="App name">{organization.appName ? organization.appName : 'Default (ABS)'}</DescriptionItem>
            <DescriptionItem label="Primary color">
              {organization.primaryColor ? (
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block w-5 h-5 rounded border border-border"
                    style={{ backgroundColor: organization.primaryColor }}
                    aria-hidden
                  />
                  {organization.primaryColor}
                </span>
              ) : (
                'Default'
              )}
            </DescriptionItem>
          </ShadcnDescriptions>
          {canManageOrganization && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => {
                organizationForm.reset(organization);
                setOrganizationLogoPreview(organization.logoUrl || '');
                setOrganizationEditing(true);
              }}
            >
              Edit branding
            </Button>
          )}
        </div>
      )}

      <div className="border-t border-border pt-4 mt-4 md:pt-6 md:mt-6 md:-mx-6 md:px-6">
        <h3 className="text-sm font-medium mb-2 md:mb-4">Address</h3>
        <ShadcnDescriptions>
        <DescriptionItem label="Street Address">{organization.address?.line1 || 'Not set'}</DescriptionItem>
        {organization.address?.line2 && (
          <DescriptionItem label="Address Line 2">{organization.address.line2}</DescriptionItem>
        )}
        <DescriptionItem label="City">{organization.address?.city || 'Not set'}</DescriptionItem>
        <DescriptionItem label="State / Region">{organization.address?.state || 'Not set'}</DescriptionItem>
        <DescriptionItem label="Postal Code">{organization.address?.postalCode || 'Not set'}</DescriptionItem>
        <DescriptionItem label="Country">{organization.address?.country || 'Not set'}</DescriptionItem>
      </ShadcnDescriptions>
      </div>

      <div className="border-t border-border pt-4 mt-4 md:pt-6 md:mt-6 md:-mx-6 md:px-6">
        <h3 className="text-sm font-medium mb-2 md:mb-4">Tax & Compliance</h3>
        <ShadcnDescriptions>
        <DescriptionItem label="VAT Number">{organization.tax?.vatNumber || 'Not set'}</DescriptionItem>
        <DescriptionItem label="TIN">{organization.tax?.tin || 'Not set'}</DescriptionItem>
        <DescriptionItem label="Tax on sales">{organization.tax?.enabled ? 'Enabled' : 'Off'}</DescriptionItem>
        {organization.tax?.enabled && (
          <>
            <DescriptionItem label="Default rate">
              {parseFloat(organization.tax?.defaultRatePercent || 0).toFixed(2)}%
            </DescriptionItem>
            <DescriptionItem label="Prices">
              {organization.tax?.pricesAreTaxInclusive ? 'Tax-inclusive' : 'Tax-exclusive'}
            </DescriptionItem>
            <DescriptionItem label="Document label">{organization.tax?.displayLabel || 'Tax'}</DescriptionItem>
          </>
        )}
        <DescriptionItem label="Other charges">
          {organization.tax?.otherCharges?.enabled
            ? `${organization.tax?.otherCharges?.label || 'Transaction charge'} (${parseFloat(organization.tax?.otherCharges?.ratePercent || 0).toFixed(2)}%)`
            : 'Off'}
        </DescriptionItem>
        {organization.tax?.otherCharges?.enabled && (
          <DescriptionItem label="Who bears charge">
            {organization.tax?.otherCharges?.customerBears ? 'Customer' : 'Business'}
          </DescriptionItem>
        )}
      </ShadcnDescriptions>
      </div>

      <div className="border-t border-border pt-4 mt-4 md:pt-6 md:mt-6">
        <h3 className="text-sm font-medium mb-2 md:mb-4">Invoice & Quote Footer</h3>
        {organization.invoiceFooter ? (
        <p>{organization.invoiceFooter}</p>
      ) : (
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">Not set</p>
          {canManageOrganization && (
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                organizationForm.reset(organization);
                setOrganizationLogoPreview(organization.logoUrl || '');
                setOrganizationEditing(true);
              }}
            >
              Add Invoice & Quote Footer
            </Button>
          )}
        </div>
      )}
      </div>

      <div className="border-t border-border pt-4 mt-4 md:pt-6 md:mt-6 md:-mx-6 md:px-6">
        <h3 className="text-sm font-medium mb-2 md:mb-4">Business</h3>
        <div className="space-y-3 md:space-y-4">
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Business Type</Label>
          <div className="mt-2">
            <div className="text-base font-semibold">{workspaceTypeDisplay}</div>
            <p className="text-sm text-muted-foreground mt-1">{workspaceDescription}</p>
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Business Actions</h3>
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              onClick={() => {
                showError(null, 'This feature is coming soon. Contact support for assistance.');
              }}
              className="w-full sm:w-auto"
            >
              Add another business
            </Button>
            {(organization.supportEmail || organization.email) && (
              <Button
                variant="outline"
                onClick={() => {
                  const email = organization.supportEmail || organization.email;
                  window.open(`mailto:${email}?subject=Business Inquiry`, '_blank');
                }}
                className="w-full sm:w-auto"
              >
                Contact support
              </Button>
            )}
          </div>
        </div>
      </div>
      </div>
          </>
        )}
      </CardContent>
    </ShadcnCard>
  );

  const subscriptionTab = (
    <ShadcnCard className="border-0 shadow-none bg-transparent md:border md:bg-card">
      <CardHeader className="p-0 md:p-6 pb-2 md:pb-6">
        <CardTitle className="text-base md:text-2xl">Subscription & Billing</CardTitle>
      </CardHeader>
      <CardContent className="p-0 md:p-6 pt-2 md:pt-0 space-y-3 md:space-y-4">
        {/* Subscription Status */}
        {subscriptionData?.data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h4 className="text-base font-semibold">
                  PLAN {subscriptionData.data.plan?.toUpperCase() || 'FREE'}
                </h4>
                {subscriptionData.data.status !== 'trialing' && (
                  <span className={`text-sm ${subscriptionData.data.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                    {subscriptionData.data.status?.toUpperCase()}
                  </span>
                )}
              </div>
              {subscriptionData.data.currentPeriodEnd && (
                <p className="text-sm text-muted-foreground">
                  Renews: {dayjs(subscriptionData.data.currentPeriodEnd).format('MMM DD, YYYY')}
                </p>
              )}
              {subscriptionData.data.plan === 'trial' && (
                <Button
                  size="sm"
                  onClick={() => {
                    navigate('/checkout', {
                      state: {
                        plan: 'professional',
                        billingPeriod: 'monthly',
                        price: 199
                      }
                    });
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                    border: 'none',
                    fontWeight: 500,
                    color: 'white'
                  }}
                >
                  Upgrade to Pro
                </Button>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{subscriptionData.data.notes || '—'}</p>
            </div>
          </div>
        )}

        <Separator className="my-3 md:!-mx-6" />

        {/* Usage Information - Minimal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Team Seats</h4>
            {loadingUsage ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : seatUsage ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground" style={{ fontSize: '14px' }}>Active Users</span>
                  <span className="font-bold text-foreground" style={{ fontSize: '14px' }}>{seatUsage.current}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground" style={{ fontSize: '14px' }}>Total Seats</span>
                  <span className="font-bold text-foreground" style={{ fontSize: '14px' }}>{seatUsage.isUnlimited ? 'Unlimited' : `${seatUsage.limit} seats`}</span>
                </div>
                {!seatUsage.isUnlimited && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground" style={{ fontSize: '14px' }}>Available</span>
                      <span className="font-bold text-foreground" style={{ fontSize: '14px' }}>{seatUsage.remaining} seats</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground" style={{ fontSize: '14px' }}>Seat Usage</span>
                        <span className="font-bold text-foreground" style={{ fontSize: '14px' }}>{seatUsage.current} of {seatUsage.limit} ({seatUsage.percentageUsed}%)</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${seatUsage.percentageUsed}%`,
                            backgroundColor: seatUsage.isAtLimit ? '#ef4444' : seatUsage.isNearLimit ? '#eab308' : '#22c55e'
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Storage Usage</h4>
            {loadingUsage ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : storageUsage ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground" style={{ fontSize: '14px' }}>Used</span>
                  <span className="font-bold text-foreground" style={{ fontSize: '14px' }}>{parseFloat(storageUsage.currentGB || 0).toFixed(2)} GB</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground" style={{ fontSize: '14px' }}>Total Limit</span>
                  <span className="font-bold text-foreground" style={{ fontSize: '14px' }}>{storageUsage.isUnlimited ? 'Unlimited' : `${storageUsage.limitGB} GB`}</span>
                </div>
                {!storageUsage.isUnlimited && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground" style={{ fontSize: '14px' }}>Available</span>
                      <span className="font-bold text-foreground" style={{ fontSize: '14px' }}>{parseFloat(storageUsage.remainingGB || 0).toFixed(2)} GB</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground" style={{ fontSize: '14px' }}>Storage Usage</span>
                        <span className="font-bold text-foreground" style={{ fontSize: '14px' }}>{storageUsage.currentGB} GB of {storageUsage.limitGB} GB ({storageUsage.percentageUsed}%)</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${storageUsage.percentageUsed}%`,
                            backgroundColor: storageUsage.isAtLimit ? '#ef4444' : storageUsage.isNearLimit ? '#eab308' : '#22c55e'
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <Separator className="my-3 md:!-mx-6" />

        {/* Subscription Management */}
        {loadingSubscription ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Form {...subscriptionForm}>
            <form onSubmit={subscriptionForm.handleSubmit(onSubscriptionSubmit)} className="space-y-3 md:space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                  <FormField
                    control={subscriptionForm.control}
                    name="plan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plan</FormLabel>
                        <FormControl>
                          <Input placeholder="trial / starter / professional / enterprise" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={subscriptionForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <FormControl>
                          <Input placeholder="active / paused / cancelled" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={subscriptionForm.control}
                    name="seats"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Seats</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={1} 
                            {...field}
                            value={numberInputValue(field.value)}
                            onChange={(e) => handleIntegerChange(e, field.onChange)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <FormField
                    control={subscriptionForm.control}
                    name="currentPeriodEnd"
                    render={({ field }) => {
                      const isTrial = planValue === 'trial' || statusValue === 'trialing';
                      return (
                        <FormItem>
                          <FormLabel>
                            Current Period Ends
                            {isTrial && (
                              <span className="text-xs text-muted-foreground ml-2">
                                (Auto-calculated as 30 days from today for trial plans)
                              </span>
                            )}
                          </FormLabel>
                          <FormControl>
                            {isTrial ? (
                              <Input
                                value={field.value ? dayjs(field.value).format('MMMM DD, YYYY') : ''}
                                disabled
                                className="bg-muted cursor-not-allowed"
                              />
                            ) : (
                              <DatePicker
                                date={field.value}
                                onDateChange={(date) => field.onChange(date)}
                              />
                            )}
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </div>

                <FormField
                  control={subscriptionForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal Notes</FormLabel>
                      <FormControl>
                        <Textarea rows={4} placeholder="Add billing notes or context here" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {subscriptionHistory.length > 0 && (
                  <>
                    <Separator className="my-6">
                      <span className="text-sm font-medium">Billing History</span>
                    </Separator>
                    {subscriptionHistory.map((entry, index) => (
                      <div key={index} className="mb-3 p-4 border rounded-lg">
                        <div className="flex flex-col gap-1">
                          <p className="font-semibold">{entry.description || 'Subscription change'}</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.date ? dayjs(entry.date).format('MMM DD, YYYY HH:mm') : '—'}
                          </p>
                          {entry.amount && (
                            <p>Amount: ₵ {parseFloat(entry.amount).toFixed(2)}</p>
                          )}
                          {entry.metadata && (
                            <p className="text-sm text-muted-foreground">Details: {JSON.stringify(entry.metadata)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}

              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    subscriptionForm.reset();
                    if (subscriptionData?.data) {
                      const currentPeriodEnd = subscriptionData.data.currentPeriodEnd
                        ? dayjs(subscriptionData.data.currentPeriodEnd).toDate()
                        : null;
                      subscriptionForm.reset({
                        ...subscriptionData.data,
                        currentPeriodEnd
                      });
                    }
                  }}
                >
                  Reset
                </Button>
                <Button type="submit" loading={updateSubscriptionMutation.isLoading}>
                  Save
                </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </ShadcnCard>
  );

  const whatsappTab = canManageOrganization ? (
    <ShadcnCard className="border-0 shadow-none bg-transparent md:border md:bg-card">
      <CardHeader className="p-0 md:p-6 pb-0 md:pb-6">
        <CardTitle className="text-base md:text-2xl">WhatsApp Business API Configuration</CardTitle>
      </CardHeader>
      <CardContent className="p-0 md:p-6 pt-2 md:pt-0">
        {loadingWhatsApp ? (
          <div className="flex items-center justify-center py-6 md:py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <Alert className="mb-3 md:mb-6 py-2 px-3 md:py-4 md:px-4">
              <AlertTitle className="text-sm md:text-base">WhatsApp Integration</AlertTitle>
              <AlertDescription className="text-xs md:text-sm">
                Configure WhatsApp Business API to send automated notifications to customers. You'll need to set up a WhatsApp Business Account in Meta Business Manager first.
              </AlertDescription>
            </Alert>

            <Form {...whatsappForm}>
              <form onSubmit={whatsappForm.handleSubmit(onWhatsAppSubmit)} className="space-y-3 md:space-y-4">
                <FormField
                  control={whatsappForm.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-2 md:p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enable WhatsApp</FormLabel>
                        <FormDescription>
                          Enable WhatsApp Business API integration. When turned on, a connection test runs to verify your settings.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(checked) => handleWhatsAppEnabledChange(checked, field.onChange)}
                          disabled={testWhatsAppMutation.isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <FormField
                    control={whatsappForm.control}
                    name="phoneNumberId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm md:text-base">
                          Phone Number ID
                          <span className="text-xs text-muted-foreground ml-1 md:ml-2">
                            (Your WhatsApp Business Phone Number ID from Meta Business Manager)
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 123456789012345" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={whatsappForm.control}
                    name="businessAccountId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Business Account ID
                          <span className="text-xs text-muted-foreground ml-2">(Optional)</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 123456789012345" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={whatsappForm.control}
                  name="accessToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Access Token
                        <span className="text-xs text-muted-foreground ml-2">
                          (Your WhatsApp Business API Access Token - keep this secure)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter access token" {...field} />
                      </FormControl>
                      {whatsappData?.data?.accessTokenConfigured && !field.value?.trim() && (
                        <FormDescription>
                          A token is already stored in the database. Leave blank to keep using it.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <FormField
                    control={whatsappForm.control}
                    name="webhookVerifyToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Webhook Verify Token
                          <span className="text-xs text-muted-foreground ml-2">
                            (Set this in Meta Business Manager)
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Your verify token" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={whatsappForm.control}
                    name="templateNamespace"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Template Namespace
                          <span className="text-xs text-muted-foreground ml-2">(Optional)</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Optional" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-wrap gap-2 justify-end mt-3 md:mt-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      whatsappForm.reset();
                      if (whatsappData?.data) {
                        whatsappForm.reset({
                          enabled: whatsappData.data.enabled || false,
                          phoneNumberId: whatsappData.data.phoneNumberId || '',
                          accessToken: '',
                          businessAccountId: whatsappData.data.businessAccountId || '',
                          webhookVerifyToken: whatsappData.data.webhookVerifyToken || '',
                          templateNamespace: whatsappData.data.templateNamespace || ''
                        });
                      }
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestWhatsApp}
                    loading={testWhatsAppMutation.isLoading}
                  >
                    Test Connection
                  </Button>
                  <Button type="submit" size="sm" loading={updateWhatsAppMutation.isLoading}>
                    Save Settings
                  </Button>
                </div>
              </form>
            </Form>

            <Separator className="my-3 md:my-6">
              <span className="text-sm font-medium">Message Templates</span>
            </Separator>
            <Alert variant="destructive" className="mt-2 md:mt-4 py-2 px-3 md:py-4 md:px-4">
              <AlertTitle className="text-sm md:text-base">Template Setup Required</AlertTitle>
              <AlertDescription>
                <div className="space-y-3">
                  <p>
                    You need to create and approve the following message templates in Meta Business Manager before they can be used: invoice_notification, quote_delivery, order_confirmation, payment_reminder, low_stock_alert
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={() => setWhatsappTemplateLearnMoreOpen(true)}
                  >
                    <HelpCircle className="h-4 w-4" />
                    Learn More
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
            <Dialog open={whatsappTemplateLearnMoreOpen} onOpenChange={setWhatsappTemplateLearnMoreOpen}>
              <DialogContent className="sm:max-w-[32rem] sm:max-h-[85vh]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5" />
                    How to Set Up WhatsApp Templates
                  </DialogTitle>
                </DialogHeader>
                <DialogBody className="overflow-y-auto space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Create these templates in Meta Business Manager so your shop can send customers bills, receipts, quotes, and stock alerts via WhatsApp. Template approval usually takes 24–48 hours.
                  </p>
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Where to go</p>
                    <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                      <li>Go to <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">Meta for Developers</a></li>
                      <li>Open your WhatsApp app or create one</li>
                      <li>Go to WhatsApp → Message Templates</li>
                      <li>Create each template below (use exact names)</li>
                    </ol>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Template names</p>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li><strong>invoice_notification</strong> – Bill/receipt with Mobile Money link</li>
                      <li><strong>quote_delivery</strong> – Quote/proposal</li>
                      <li><strong>order_confirmation</strong> – Order confirmation for shop</li>
                      <li><strong>payment_reminder</strong> – Reminder for overdue bills</li>
                      <li><strong>low_stock_alert</strong> – Stock running low alert</li>
                    </ul>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Use Category: <strong>UTILITY</strong> and Language: <strong>English</strong> for all templates. Use the exact placeholder format (e.g. {'{{1}}'}, {'{{2}}'}) as shown in Meta.
                  </p>
                  <div className="rounded-lg border border-border bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">
                      Need help? Visit Meta&apos;s Business Help Centre for step-by-step guides.
                    </p>
                    <a
                      href="https://www.facebook.com/business/help"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open Meta Business Help Centre
                    </a>
                  </div>
                </DialogBody>
                <DialogFooter>
                  <Button onClick={() => setWhatsappTemplateLearnMoreOpen(false)}>
                    Got it
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </CardContent>
    </ShadcnCard>
  ) : (
    <ShadcnCard className="border-0 shadow-none bg-transparent md:border md:bg-card">
      <CardContent className="p-0 md:pt-6 md:px-6">
        <Alert variant="destructive" className="py-2 px-3 md:py-4 md:px-4">
          <AlertTitle>Access Restricted</AlertTitle>
          <AlertDescription>
            You need admin or manager permissions to configure WhatsApp settings.
          </AlertDescription>
        </Alert>
      </CardContent>
    </ShadcnCard>
  );

  const smsTab = canManageOrganization ? (
    <ShadcnCard className="border-0 shadow-none bg-transparent md:border md:bg-card">
      <CardHeader className="p-0 md:p-6 pb-0 md:pb-6">
        <CardTitle className="text-base md:text-2xl">SMS Service Configuration</CardTitle>
      </CardHeader>
      <CardContent className="p-0 md:p-6 pt-2 md:pt-0">
        {loadingSMS ? (
          <div className="flex items-center justify-center py-6 md:py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <Alert className="mb-3 md:mb-6 py-2 px-3 md:py-4 md:px-4">
              <AlertTitle className="text-sm md:text-base">SMS Integration</AlertTitle>
              <AlertDescription className="text-xs md:text-sm">
                Configure SMS service to send automated notifications to customers. Default: Termii. Also supports Twilio and Africa&apos;s Talking.
              </AlertDescription>
            </Alert>

            <Form {...smsForm}>
              <form onSubmit={smsForm.handleSubmit(onSMSSubmit)} className="space-y-3 md:space-y-4">
                <FormField
                  control={smsForm.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-2 md:p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enable SMS</FormLabel>
                        <FormDescription>
                          Enable SMS service integration. When turned on, a connection test runs to verify your settings.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(checked) => handleSMSEnabledChange(checked, field.onChange)}
                          disabled={testSMSMutation.isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={smsForm.control}
                  name="provider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SMS Provider</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="termii">Termii</SelectItem>
                            <SelectItem value="twilio">Twilio</SelectItem>
                            <SelectItem value="africas_talking">Africa&apos;s Talking</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {smsForm.watch('provider') === 'termii' && (
                  <>
                    <FormField
                      control={smsForm.control}
                      name="apiKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            API Key
                            <span className="text-xs text-muted-foreground ml-2">(Required)</span>
                          </FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Your Termii API key" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={smsForm.control}
                      name="senderId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Sender ID
                            <span className="text-xs text-muted-foreground ml-2">(Required, 3-11 characters)</span>
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. MyShop" maxLength={11} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {smsForm.watch('provider') === 'twilio' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      <FormField
                        control={smsForm.control}
                        name="accountSid"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Account SID
                              <span className="text-xs text-muted-foreground ml-2">(Required)</span>
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={smsForm.control}
                        name="fromNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              From Number
                              <span className="text-xs text-muted-foreground ml-2">(Required)</span>
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="+1234567890" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={smsForm.control}
                      name="authToken"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Auth Token
                            <span className="text-xs text-muted-foreground ml-2">(Required - keep this secure)</span>
                          </FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Enter auth token" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {smsForm.watch('provider') === 'africas_talking' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={smsForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Username
                              <span className="text-xs text-muted-foreground ml-2">(Required)</span>
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="sandbox" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={smsForm.control}
                        name="fromNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              From Number
                              <span className="text-xs text-muted-foreground ml-2">(Required)</span>
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="+1234567890" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={smsForm.control}
                      name="apiKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            API Key
                            <span className="text-xs text-muted-foreground ml-2">(Required - keep this secure)</span>
                          </FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Enter API key" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      smsForm.reset();
                      if (smsData?.data) {
                        smsForm.reset({
                          enabled: smsData.data.enabled || false,
                          provider: smsData.data.provider || 'termii',
                          senderId: smsData.data.senderId || '',
                          apiKey: '',
                          accountSid: smsData.data.accountSid || '',
                          authToken: '',
                          fromNumber: smsData.data.fromNumber || '',
                          username: smsData.data.username || ''
                        });
                      }
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestSMS}
                    loading={testSMSMutation.isLoading}
                  >
                    Test Connection
                  </Button>
                  <Button type="submit" loading={updateSMSMutation.isLoading}>
                    Save Settings
                  </Button>
                </div>
              </form>
            </Form>
          </>
        )}
      </CardContent>
    </ShadcnCard>
  ) : (
    <ShadcnCard className="border-0 shadow-none bg-transparent md:border md:bg-card">
      <CardContent className="p-0 md:pt-6 md:px-6">
        <Alert variant="destructive" className="py-2 px-3 md:py-4 md:px-4">
          <AlertTitle>Access Restricted</AlertTitle>
          <AlertDescription>
            You need admin or manager permissions to configure SMS settings.
          </AlertDescription>
        </Alert>
      </CardContent>
    </ShadcnCard>
  );

  const emailDataLoaded = emailData?.data;
  const emailSavedAndEnabled = !!(emailDataLoaded?.enabled && (emailDataLoaded?.fromEmail || emailDataLoaded?.smtpHost || emailDataLoaded?.sendgridApiKey || emailDataLoaded?.sesAccessKeyId));
  const showEmailSummary = emailSavedAndEnabled && !emailEditing;

  const emailTab = canManageOrganization ? (
    <ShadcnCard className="border-0 shadow-none bg-transparent md:border md:bg-card">
      <CardHeader className="p-0 md:p-6 pb-0 md:pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="text-base md:text-2xl">Email Service Configuration</CardTitle>
          {!loadingEmail && showEmailSummary && (
            <Button
              variant="secondaryStroke"
              size="sm"
              className="shrink-0"
              onClick={() => setEmailEditing(true)}
            >
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 md:p-6 pt-2 md:pt-0">
        {loadingEmail ? (
          <div className="flex items-center justify-center py-6 md:py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : showEmailSummary ? (
          <>
            <Alert className="mb-3 md:mb-6 py-2 px-3 md:py-4 md:px-4">
              <AlertTitle className="text-sm md:text-base">Email Integration</AlertTitle>
              <AlertDescription className="text-xs md:text-sm">
                Email is enabled. Notifications will be sent using your configured provider and from address.
              </AlertDescription>
            </Alert>
            <ShadcnDescriptions>
              <DescriptionItem label="Status">Enabled</DescriptionItem>
              <DescriptionItem label="Provider">
                {(emailDataLoaded?.provider || 'smtp').toUpperCase()}
              </DescriptionItem>
              <DescriptionItem label="From Email">{emailDataLoaded?.fromEmail || '—'}</DescriptionItem>
              <DescriptionItem label="From Name">{emailDataLoaded?.fromName || '—'}</DescriptionItem>
            </ShadcnDescriptions>
          </>
        ) : (
          <>
            {emailEditing && (
              <div className="mb-3 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setEmailEditing(false)}>
                  Cancel
                </Button>
              </div>
            )}
            <Alert className="mb-3 md:mb-6 py-2 px-3 md:py-4 md:px-4">
              <AlertTitle className="text-sm md:text-base">Email Integration</AlertTitle>
              <AlertDescription className="text-xs md:text-sm">
                Configure email service to send automated notifications to customers. Supports SMTP, SendGrid, and AWS SES providers.
              </AlertDescription>
            </Alert>

            <Form {...emailForm}>
              <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-3 md:space-y-4">
                <FormField
                  control={emailForm.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-2 md:p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enable Email</FormLabel>
                        <FormDescription>
                          Enable email service integration. When turned on, a connection test runs to verify your settings.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(checked) => handleEmailEnabledChange(checked, field.onChange)}
                          disabled={testEmailMutation.isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={emailForm.control}
                  name="provider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Provider</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="smtp">SMTP</SelectItem>
                            <SelectItem value="sendgrid">SendGrid</SelectItem>
                            <SelectItem value="ses">AWS SES</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {emailForm.watch('provider') === 'smtp' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={emailForm.control}
                        name="smtpHost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              SMTP Host
                              <span className="text-xs text-muted-foreground ml-2">(Required)</span>
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="smtp.gmail.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={emailForm.control}
                        name="smtpPort"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              SMTP Port
                              <span className="text-xs text-muted-foreground ml-2">(Required)</span>
                            </FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                placeholder="587" 
                                {...field}
                                value={field.value === '' || field.value == null ? '' : field.value}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  if (raw === '') {
                                    field.onChange('');
                                    return;
                                  }
                                  const n = parseInt(raw, 10);
                                  field.onChange(Number.isNaN(n) ? '' : n);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={emailForm.control}
                        name="smtpUser"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              SMTP User
                              <span className="text-xs text-muted-foreground ml-2">(Required)</span>
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="user@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={emailForm.control}
                        name="smtpPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              SMTP Password
                              <span className="text-xs text-muted-foreground ml-2">(Required - keep this secure)</span>
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showSmtpPassword ? 'text' : 'password'}
                                  placeholder={emailData?.data?.smtpPassword === '***' ? '•••••••• (saved in database)' : 'Enter password'}
                                  className="pr-10"
                                  {...field}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowSmtpPassword((p) => !p)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                  aria-label={showSmtpPassword ? 'Hide password' : 'Show password'}
                                >
                                  {showSmtpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </FormControl>
                            {(emailForm.watch('smtpHost') || '').toLowerCase().includes('gmail') && (
                              <FormDescription>
                                For Gmail with 2-Step Verification, use an App Password (Google Account → Security → App passwords), not your regular password.
                              </FormDescription>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={emailForm.control}
                      name="smtpRejectUnauthorized"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Reject Unauthorized Certificates</FormLabel>
                            <FormDescription>
                              Enable to reject unauthorized SSL certificates
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {emailForm.watch('provider') === 'sendgrid' && (
                  <FormField
                    control={emailForm.control}
                    name="sendgridApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          SendGrid API Key
                          <span className="text-xs text-muted-foreground ml-2">(Required - keep this secure)</span>
                        </FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {emailForm.watch('provider') === 'ses' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={emailForm.control}
                        name="sesAccessKeyId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              AWS Access Key ID
                              <span className="text-xs text-muted-foreground ml-2">(Required)</span>
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="AKIAIOSFODNN7EXAMPLE" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={emailForm.control}
                        name="sesRegion"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              AWS Region
                              <span className="text-xs text-muted-foreground ml-2">(Required)</span>
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="us-east-1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={emailForm.control}
                      name="sesSecretAccessKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            AWS Secret Access Key
                            <span className="text-xs text-muted-foreground ml-2">(Required - keep this secure)</span>
                          </FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Enter secret access key" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={emailForm.control}
                      name="sesHost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            SES Host
                            <span className="text-xs text-muted-foreground ml-2">(Optional - auto-generated if not provided)</span>
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="email-smtp.us-east-1.amazonaws.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <FormField
                    control={emailForm.control}
                    name="fromEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          From Email
                          <span className="text-xs text-muted-foreground ml-2">(Required)</span>
                        </FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="noreply@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={emailForm.control}
                    name="fromName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          From Name
                          <span className="text-xs text-muted-foreground ml-2">(Optional)</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Your Company Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-wrap gap-2 justify-end mt-3 md:mt-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const org = organizationData?.data ?? organizationData ?? {};
                      emailForm.reset(getEmailFormValues(emailData?.data, org, { clearSecrets: true }));
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestEmail}
                    loading={testEmailMutation.isLoading}
                  >
                    Test Connection
                  </Button>
                  <Button type="submit" size="sm" loading={updateEmailMutation.isLoading}>
                    Save Settings
                  </Button>
                </div>
              </form>
            </Form>
          </>
        ) }
      </CardContent>
    </ShadcnCard>
  ) : (
    <ShadcnCard className="border-0 shadow-none bg-transparent md:border md:bg-card">
      <CardContent className="p-0 md:pt-6 md:px-6">
        <Alert variant="destructive" className="py-2 px-3 md:py-4 md:px-4">
          <AlertTitle>Access Restricted</AlertTitle>
          <AlertDescription>
            You need admin or manager permissions to configure Email settings.
          </AlertDescription>
        </Alert>
      </CardContent>
    </ShadcnCard>
  );

  const configData = posConfigData?.data?.data ?? posConfigData?.data;
  const modeLabels = { ask: 'Ask staff', auto_send: 'Auto send', auto_print: 'Auto print', auto_both: 'Auto send + print' };
  const formatLabels = { a4: 'A4 (full page)', thermal_58: '58mm Thermal', thermal_80: '80mm Thermal' };
  const channelLabels = { sms: 'SMS', whatsapp: 'WhatsApp', email: 'Email', print: 'Print' };

  const notificationChannels = notificationChannelsData ?? {};
  const autoSendInvoice = notificationChannels.autoSendInvoiceToCustomer !== false;
  const autoSendReceipt = notificationChannels.autoSendReceiptToCustomer === true;
  const sendPaymentReminderEmail = notificationChannels.sendPaymentReminderEmail === true;
  const sendInvoicePaidConfirmationToCustomer = notificationChannels.sendInvoicePaidConfirmationToCustomer !== false;

  const configurationsTab = canManageOrganization ? (
    <ShadcnCard className="border-0 shadow-none bg-transparent md:border md:bg-card">
      <CardHeader className="p-0 md:p-6 pb-2 md:pb-6">
        <div>
          <CardTitle className="text-base md:text-2xl">Configurations</CardTitle>
          <CardDescription className="text-xs md:text-sm mt-1">
            Customer notifications, quote and job workflows, public customer tracking link (share with clients), and POS checkout (receipts, print, checkout fields).
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0 md:p-6 pt-0">
        <h2 className="text-base font-semibold mb-3">Configurations</h2>
        <div className="rounded-lg border border-border p-4 mb-4 md:mb-6">
          <h3 className="text-sm font-semibold mb-1">Auto-send to customers</h3>
          <p className="text-xs text-muted-foreground mb-4">
            When to automatically notify customers via Email, WhatsApp, or SMS (using your configured channels).
          </p>
          <div className="space-y-4">
            <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label className="text-base">Auto send invoice to customer</Label>
                <p className="text-xs text-muted-foreground">
                  When you send an invoice, notify the customer via configured channels (email, WhatsApp, SMS).
                </p>
              </div>
              <Switch
                checked={autoSendInvoice}
                disabled={updateCustomerNotificationPrefsMutation.isPending}
                onCheckedChange={(checked) => {
                  savingToastDismissRef.current = showLoading('Saving...');
                  updateCustomerNotificationPrefsMutation.mutate({ autoSendInvoiceToCustomer: checked });
                }}
              />
            </div>
            <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label className="text-base">Auto send receipt to customer</Label>
                <p className="text-xs text-muted-foreground">
                  When a sale is completed (e.g. POS), automatically send the receipt via configured channels.
                </p>
              </div>
              <Switch
                checked={autoSendReceipt}
                disabled={updateCustomerNotificationPrefsMutation.isPending}
                onCheckedChange={(checked) => {
                  savingToastDismissRef.current = showLoading('Saving...');
                  updateCustomerNotificationPrefsMutation.mutate({ autoSendReceiptToCustomer: checked });
                }}
              />
            </div>
            <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label className="text-base">Send payment reminder by email</Label>
                <p className="text-xs text-muted-foreground">
                  Include email when sending overdue payment reminders (in addition to WhatsApp/SMS if configured).
                </p>
              </div>
              <Switch
                checked={sendPaymentReminderEmail}
                disabled={updateCustomerNotificationPrefsMutation.isPending}
                onCheckedChange={(checked) => {
                  savingToastDismissRef.current = showLoading('Saving...');
                  updateCustomerNotificationPrefsMutation.mutate({ sendPaymentReminderEmail: checked });
                }}
              />
            </div>
            <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label className="text-base">Send invoice paid confirmation to customer</Label>
                <p className="text-xs text-muted-foreground">
                  When an invoice is paid, send a confirmation email (and SMS if configured) to the customer.
                </p>
              </div>
              <Switch
                checked={sendInvoicePaidConfirmationToCustomer}
                disabled={updateCustomerNotificationPrefsMutation.isPending}
                onCheckedChange={(checked) => {
                  savingToastDismissRef.current = showLoading('Saving...');
                  updateCustomerNotificationPrefsMutation.mutate({ sendInvoicePaidConfirmationToCustomer: checked });
                }}
              />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border p-4 mb-4 md:mb-6">
          <h3 className="text-sm font-semibold mb-1">Quote workflow</h3>
          <p className="text-xs text-muted-foreground mb-4">
            When a customer accepts a quote via the view-quote link, choose what happens next.
          </p>
          <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <Label className="text-base">Auto-create job and invoice when customer accepts</Label>
              <p className="text-xs text-muted-foreground">
                If on: accepting the quote creates a job and invoice, and the invoice is sent to the customer automatically. If off: only the acceptance is recorded.
              </p>
            </div>
            <Switch
              checked={(quoteWorkflowData?.onAccept || 'record_only') === 'create_job_invoice_and_send'}
              disabled={updateQuoteWorkflowMutation.isPending}
              onCheckedChange={(checked) => {
                savingToastDismissRef.current = showLoading('Saving...');
                updateQuoteWorkflowMutation.mutate({
                  onAccept: checked ? 'create_job_invoice_and_send' : 'record_only'
                });
              }}
            />
          </div>
        </div>
        <div className="rounded-lg border border-border p-4 mb-6 md:mb-8">
          <h3 className="text-sm font-semibold mb-1">
            {isStudioLike ? 'Jobs, invoices &amp; customer tracking' : 'Customer tracking (public)'}
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            {isStudioLike
              ? 'Control invoices created from jobs, optional emails, and the public page where customers check status with ID and phone (no login).'
              : 'Share one link with customers: they enter order ID and phone to see status — no login. Also used for token links from messages when enabled.'}
          </p>
          <div className="space-y-4">
            {isStudioLike ? (
              <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <Label className="text-base">Auto-send invoice when a job is created</Label>
                  <p className="text-xs text-muted-foreground">
                    After an invoice is auto-generated for a new job, mark it sent and notify the customer (email, WhatsApp, SMS) when channels are configured.
                  </p>
                </div>
                <Switch
                  checked={jobInvoiceData?.autoSendInvoiceOnJobCreation === true}
                  disabled={updateJobInvoiceMutation.isPending}
                  onCheckedChange={(checked) => {
                    savingToastDismissRef.current = showLoading('Saving...');
                    updateJobInvoiceMutation.mutate({ autoSendInvoiceOnJobCreation: checked });
                  }}
                />
              </div>
            ) : null}
            <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label className="text-base">
                  {isStudioLike ? 'Customer job tracking page' : 'Public tracking page (order / job lookup)'}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {isStudioLike
                    ? 'Allow customers to use a secure public page (no login): job number + phone, or links from messages. Turn off to disable public tracking for this workspace.'
                    : 'Allow customers to use a secure public page (no login) with order number + phone. Turn off to disable public tracking for this workspace.'}
                </p>
              </div>
              <Switch
                checked={jobInvoiceData?.customerJobTrackingEnabled === true}
                disabled={updateJobInvoiceMutation.isPending}
                onCheckedChange={(checked) => {
                  savingToastDismissRef.current = showLoading('Saving...');
                  updateJobInvoiceMutation.mutate(
                    checked
                      ? { customerJobTrackingEnabled: true }
                      : { customerJobTrackingEnabled: false, emailCustomerJobTrackingOnJobCreation: false }
                  );
                }}
              />
            </div>
            {jobInvoiceData?.customerJobTrackingEnabled === true && publicTrackingUrl ? (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium">Share with customers</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Send this link by SMS, WhatsApp, or email. Customers open it, then enter their{' '}
                  {isStudioLike ? 'job number' : 'order number'} and phone — no account required.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <Input value={publicTrackingUrl} readOnly className="font-mono text-xs sm:text-sm" />
                  <Button
                    type="button"
                    variant="secondaryStroke"
                    className="shrink-0"
                    onClick={handleCopyTrackingUrl}
                  >
                    Copy link
                  </Button>
                </div>
              </div>
            ) : jobInvoiceData?.customerJobTrackingEnabled === true && !publicTrackingUrl ? (
              <p className="text-xs text-amber-800 dark:text-amber-200 rounded-md border border-border bg-amber-50 dark:bg-amber-950/40 px-3 py-2">
                Public tracking is on, but your workspace slug is missing. Save organization settings or contact support so the share link can be generated.
              </p>
            ) : null}
            {isStudioLike ? (
              <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <Label className="text-base">Email customer tracking link when a job is created</Label>
                  <p className="text-xs text-muted-foreground">
                    Sends an email to the customer: job created, with a &quot;view &amp; track&quot; button. Requires a customer email and workspace email configured under Integration → Email.
                  </p>
                </div>
                <Switch
                  checked={jobInvoiceData?.emailCustomerJobTrackingOnJobCreation === true}
                  disabled={
                    updateJobInvoiceMutation.isPending ||
                    jobInvoiceData?.customerJobTrackingEnabled !== true
                  }
                  onCheckedChange={(checked) => {
                    savingToastDismissRef.current = showLoading('Saving...');
                    updateJobInvoiceMutation.mutate({ emailCustomerJobTrackingOnJobCreation: checked });
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-border p-4 mb-6 md:mb-8">
          <h3 className="text-sm font-semibold mb-1">Inventory &amp; cost automation</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Automatically log product cost as an expense when new products are added.
          </p>
          <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <Label className="text-base">Auto-create expense from product cost</Label>
              <p className="text-xs text-muted-foreground">
                When enabled, creating a product with cost price creates a paid and approved expense entry automatically.
              </p>
            </div>
            <Switch
              checked={jobInvoiceData?.autoCreateExpenseFromProductCost === true}
              disabled={updateJobInvoiceMutation.isPending}
              onCheckedChange={(checked) => {
                savingToastDismissRef.current = showLoading('Saving...');
                updateJobInvoiceMutation.mutate({ autoCreateExpenseFromProductCost: checked });
              }}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border p-4 mb-6 md:mb-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="min-w-0 space-y-1">
              <h3 className="text-sm font-semibold">POS &amp; checkout</h3>
              <p className="text-xs text-muted-foreground">
                Receipt delivery, print format, and customer fields at checkout.
              </p>
            </div>
            {!loadingPOSConfig && !posConfigEditing && (
              <Button
                variant="secondaryStroke"
                size="sm"
                className="shrink-0 self-start sm:self-auto"
                onClick={() => {
                  const cfg = configData;
                  if (cfg) {
                    const mode = cfg.receipt?.mode || 'ask';
                    let channels = cfg.receipt?.channels || ['sms', 'print'];
                    if (mode === 'auto_print') channels = ['print'];
                    else if (mode === 'auto_send') {
                      channels = channels.filter((c) => ['sms', 'whatsapp', 'email'].includes(c));
                      if (channels.length === 0) channels = ['sms'];
                    }
                    posConfigForm.reset({
                      receipt: { mode, channels },
                      print: { format: cfg.print?.format || 'a4', showLogo: cfg.print?.showLogo !== false, color: cfg.print?.color !== false, fontSize: cfg.print?.fontSize || 'normal' },
                      customer: { phoneRequired: cfg.customer?.phoneRequired || false, nameRequired: cfg.customer?.nameRequired || false },
                    });
                  }
                  setPosConfigEditing(true);
                }}
              >
                Edit
              </Button>
            )}
          </div>
          {loadingPOSConfig ? (
          <div className="flex items-center justify-center py-6 md:py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : posConfigEditing ? (
          <Form {...posConfigForm}>
            <form onSubmit={posConfigForm.handleSubmit(onPOSConfigSubmit)} className="space-y-6 md:space-y-8">
              <div>
                <p className="text-sm font-semibold mb-1">Receipt delivery</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Configure how receipts are sent or printed after a sale.
                </p>
                <div className="space-y-4">
                  <div className="rounded-lg border border-border p-3">
                    <FormField
                      control={posConfigForm.control}
                      name="receipt.mode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>After sale</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              if (value === 'auto_print') {
                                posConfigForm.setValue('receipt.channels', ['print']);
                              } else if (value === 'auto_send') {
                                const current = posConfigForm.getValues('receipt.channels') || [];
                                const sendChannels = current.filter((c) => ['sms', 'whatsapp', 'email'].includes(c));
                                posConfigForm.setValue('receipt.channels', sendChannels.length ? sendChannels : ['sms']);
                              }
                            }}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select behavior" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="ask">Ask staff</SelectItem>
                              <SelectItem value="auto_send">Auto send</SelectItem>
                              <SelectItem value="auto_print">Auto print</SelectItem>
                              <SelectItem value="auto_both">Auto send + print</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {{
                              ask: 'Staff will choose how to send or print the receipt after each sale.',
                              auto_send: 'Receipt will automatically be sent to customers via the enabled channels (SMS, WhatsApp, Email) after each sale.',
                              auto_print: 'Receipt will automatically be printed for the customer after each sale.',
                              auto_both: 'Receipt will automatically be sent to customers and printed for the customer after each sale.'
                            }[posConfigForm.watch('receipt.mode')] || 'Choose how receipts are handled after each sale.'}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <FormField
                      control={posConfigForm.control}
                      name="receipt.channels"
                      render={({ field }) => {
                        const mode = posConfigForm.watch('receipt.mode');
                        const allChannels = [
                          { id: 'sms', label: 'SMS' },
                          { id: 'whatsapp', label: 'WhatsApp' },
                          { id: 'email', label: 'Email' },
                          { id: 'print', label: 'Print' },
                        ];
                        const selectableChannels = mode === 'auto_print'
                          ? allChannels.filter((c) => c.id === 'print')
                          : mode === 'auto_send'
                            ? allChannels.filter((c) => ['sms', 'whatsapp', 'email'].includes(c.id))
                            : allChannels;
                        const channelDescription = mode === 'auto_print'
                          ? 'Print only — receipt will be printed automatically.'
                          : mode === 'auto_send'
                            ? 'Select channels for sending receipts automatically (SMS, WhatsApp, Email).'
                            : mode === 'auto_both'
                              ? 'Select channels for send + print (SMS, WhatsApp, Email, Print).'
                              : 'Select which channels staff can choose from.';
                        return (
                        <FormItem>
                          <div className="mb-2">
                            <FormLabel>Enabled channels</FormLabel>
                            <FormDescription>
                              {channelDescription}
                            </FormDescription>
                          </div>
                          <div className="flex flex-wrap gap-4">
                            {selectableChannels.map((item) => (
                              <div key={item.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`channel-${item.id}`}
                                  checked={field.value?.includes(item.id)}
                                  disabled={mode === 'auto_print'}
                                  onCheckedChange={(checked) => {
                                    const next = checked
                                      ? [...(field.value || []), item.id]
                                      : (field.value || []).filter((c) => c !== item.id);
                                    field.onChange(next);
                                  }}
                                />
                                <Label htmlFor={`channel-${item.id}`} className="font-normal cursor-pointer">
                                  {item.label}
                                </Label>
                              </div>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      );
                      }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold mb-1">Print</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Receipt and invoice print layout. Thermal printers use black and white, no logo, small font.
                </p>
                <div className="space-y-4">
                  <div className="rounded-lg border border-border p-3">
                    <FormField
                      control={posConfigForm.control}
                      name="print.format"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Format</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select format" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="a4">A4 (full page)</SelectItem>
                              <SelectItem value="thermal_58">58mm Thermal</SelectItem>
                              <SelectItem value="thermal_80">80mm Thermal</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            58mm/80mm: black and white, no logo, small font for thermal receipt printers
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold mb-1">Customer at checkout</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Require customer details before completing checkout.
                </p>
                <div className="space-y-4">
                  <FormField
                    control={posConfigForm.control}
                    name="customer.phoneRequired"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Require phone number</FormLabel>
                          <FormDescription>
                            Block checkout until customer phone is provided
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={posConfigForm.control}
                    name="customer.nameRequired"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Require customer name</FormLabel>
                          <FormDescription>
                            Block checkout until customer name is provided
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Alert>
                <AlertDescription>
                  For SMS, WhatsApp, or Email receipts, configure those channels under Settings → Integration.
                </AlertDescription>
              </Alert>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const cfg = configData;
                    if (cfg) {
                      const mode = cfg.receipt?.mode || 'ask';
                      let channels = cfg.receipt?.channels || ['sms', 'print'];
                      if (mode === 'auto_print') channels = ['print'];
                      else if (mode === 'auto_send') {
                        channels = channels.filter((c) => ['sms', 'whatsapp', 'email'].includes(c));
                        if (channels.length === 0) channels = ['sms'];
                      }
                      posConfigForm.reset({
                        receipt: { mode, channels },
                        print: { format: cfg.print?.format || 'a4', showLogo: cfg.print?.showLogo !== false, color: cfg.print?.color !== false, fontSize: cfg.print?.fontSize || 'normal' },
                        customer: { phoneRequired: cfg.customer?.phoneRequired || false, nameRequired: cfg.customer?.nameRequired || false },
                      });
                    }
                    setPosConfigEditing(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={updatePOSConfigMutation.isLoading}>
                  Save Configuration
                </Button>
              </div>
            </form>
          </Form>
          ) : (
          <div className="space-y-6 md:space-y-8">
            <div>
              <p className="text-sm font-semibold mb-1">Receipt delivery</p>
              <p className="text-xs text-muted-foreground mb-4">
                How receipts are sent or printed after each completed sale.
              </p>
              <div className="space-y-4">
                <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-base">After sale</Label>
                    <p className="text-xs text-muted-foreground">
                      What happens when a sale completes at the register or checkout.
                    </p>
                  </div>
                  <span className="text-sm font-medium shrink-0 text-right">
                    {modeLabels[configData?.receipt?.mode] || configData?.receipt?.mode || '—'}
                  </span>
                </div>
                <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enabled channels</Label>
                    <p className="text-xs text-muted-foreground">
                      Channels staff can use or that run automatically, depending on the mode above.
                    </p>
                  </div>
                  <span className="text-sm font-medium shrink-0 text-right max-w-[45%] break-words">
                    {(configData?.receipt?.channels || []).map((c) => channelLabels[c] || c).join(', ') || '—'}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-1">Print</p>
              <p className="text-xs text-muted-foreground mb-4">
                Layout for printed receipts and invoices from POS or checkout.
              </p>
              <div className="space-y-4">
                <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-base">Format</Label>
                    <p className="text-xs text-muted-foreground">
                      Page or roll width used when printing receipts and invoices.
                    </p>
                  </div>
                  <span className="text-sm font-medium shrink-0 text-right">
                    {formatLabels[configData?.print?.format] || configData?.print?.format || '—'}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-1">Customer at checkout</p>
              <p className="text-xs text-muted-foreground mb-4">
                Whether customers must provide contact details before completing checkout.
              </p>
              <div className="space-y-4">
                <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-base">Require phone number</Label>
                    <p className="text-xs text-muted-foreground">
                      Block checkout until a phone number is entered for the customer.
                    </p>
                  </div>
                  <span className="text-sm font-medium shrink-0">{configData?.customer?.phoneRequired ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-base">Require customer name</Label>
                    <p className="text-xs text-muted-foreground">
                      Block checkout until a name is entered for the customer.
                    </p>
                  </div>
                  <span className="text-sm font-medium shrink-0">{configData?.customer?.nameRequired ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
            <Alert>
              <AlertDescription>
                For SMS, WhatsApp, or Email receipts, configure those channels under Settings → Integration.
              </AlertDescription>
            </Alert>
          </div>
          )}
        </div>
      </CardContent>
    </ShadcnCard>
  ) : (
    <ShadcnCard className="border-0 shadow-none bg-transparent md:border md:bg-card">
      <CardContent className="p-0 md:pt-6 md:px-6">
        <Alert variant="destructive" className="py-2 px-3 md:py-4 md:px-4">
          <AlertTitle>Access Restricted</AlertTitle>
          <AlertDescription>
            You need admin or manager permissions to change configurations and POS settings.
          </AlertDescription>
        </Alert>
      </CardContent>
    </ShadcnCard>
  );

  const handleMtnSendOtp = async () => {
    if (!isGoogleUser && !mtnGatePassword.trim()) {
      showError('Enter your account password to receive a code.');
      return;
    }
    try {
      await settingsService.sendPaymentCollectionOtp(isGoogleUser ? undefined : mtnGatePassword);
      showSuccess('Verification code sent to your email');
    } catch (e) {
      showError(e, 'Could not send code');
    }
  };

  const buildMtnCredPayload = () => ({
    password: isGoogleUser ? undefined : mtnGatePassword,
    otp: (mtnOtp || '').replace(/\D/g, ''),
    subscriptionKey: mtnCredForm.subscriptionKey.trim(),
    apiUser: mtnCredForm.apiUser.trim(),
    apiKey: mtnCredForm.apiKey.trim(),
    environment: mtnCredForm.environment,
    collectionApiUrl: mtnCredForm.collectionApiUrl.trim() || undefined,
    callbackUrl: mtnCredForm.callbackUrl.trim() || undefined
  });

  const handleMtnTest = async () => {
    const p = buildMtnCredPayload();
    if (p.otp.length !== 6) {
      showError('Enter the 6-digit code from your email');
      return;
    }
    setMtnTesting(true);
    try {
      await settingsService.testMtnCollectionCredentials(p);
      showSuccess('MTN connection OK');
    } catch (e) {
      showError(e, e?.response?.data?.message || 'Test failed');
    } finally {
      setMtnTesting(false);
    }
  };

  const handleMtnSave = async () => {
    const p = buildMtnCredPayload();
    if (p.otp.length !== 6) {
      showError('Enter the 6-digit code from your email');
      return;
    }
    setMtnSaving(true);
    try {
      await settingsService.updateMtnCollectionCredentials(p);
      showSuccess('MTN credentials saved');
      setMtnOtp('');
      queryClient.invalidateQueries({ queryKey: ['settings', 'payment-collection', activeTenant?.id] });
    } catch (e) {
      showError(e, e?.response?.data?.message || 'Save failed');
    } finally {
      setMtnSaving(false);
    }
  };

  const handleMtnDisconnect = async () => {
    const p = buildMtnCredPayload();
    if (p.otp.length !== 6) {
      showError('Enter the 6-digit code from your email');
      return;
    }
    setMtnDisconnecting(true);
    try {
      await settingsService.disconnectMtnCollectionCredentials({
        password: p.password,
        otp: p.otp
      });
      showSuccess('Workspace MTN credentials removed');
      setMtnOtp('');
      setMtnCredForm((f) => ({ ...f, subscriptionKey: '', apiUser: '', apiKey: '' }));
      queryClient.invalidateQueries({ queryKey: ['settings', 'payment-collection', activeTenant?.id] });
    } catch (e) {
      showError(e, e?.response?.data?.message || 'Could not remove credentials');
    } finally {
      setMtnDisconnecting(false);
    }
  };

  const rawPc = paymentCollectionData?.data ?? paymentCollectionData;
  const pc = rawPc && typeof rawPc === 'object' && rawPc.data != null && (rawPc.success === true || rawPc.success === 'true') ? rawPc.data : rawPc;
  const hasPaymentSubaccount = pc?.hasSubaccount === true;
  const isMomoLinked = pc?.settlement_type === 'momo' && (pc?.momo_phone_masked || pc?.momo_provider || pc?.configured);
  const paymentAlreadyLinked = Boolean(pc?.hasSubaccount || pc?.configured || isMomoLinked);
  const banksList = Array.isArray(paymentCollectionBanks) ? paymentCollectionBanks : (paymentCollectionBanks?.data ?? []);

  const paymentsTab = canManageOrganization ? (
    <ShadcnCard className="border-0 shadow-none bg-transparent md:border md:bg-card">
      <CardHeader className="p-0 md:p-6 pb-2 md:pb-6">
        <CardTitle className="text-base md:text-2xl flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payments
        </CardTitle>
        <CardDescription className="mt-1 md:mt-0 text-xs md:text-sm">
          Switch between Paystack payout settings and optional workspace keys for direct MTN MoMo collection (POS and invoices).
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 md:p-6 pt-0">
        <Tabs
          value={paymentsSubTab}
          onValueChange={(key) => {
            setPaymentsSubTab(key);
            setSearchParams({ tab: 'billing', subtab: key });
          }}
        >
          {isMobile ? (
            <Select
              value={paymentsSubTab}
              onValueChange={(key) => {
                setPaymentsSubTab(key);
                setSearchParams({ tab: 'billing', subtab: key });
              }}
            >
              <SelectTrigger className="w-full mb-2 md:mb-4">
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="settlements">Paystack settlement</SelectItem>
                <SelectItem value="mtn-collection">MTN MoMo API (direct)</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="settlements" className="text-xs md:text-sm">
                Paystack settlement
              </TabsTrigger>
              <TabsTrigger value="mtn-collection" className="text-xs md:text-sm">
                MTN MoMo API
              </TabsTrigger>
            </TabsList>
          )}
          <TabsContent value="settlements" className="mt-0 md:mt-1 space-y-4">
            <p className="text-sm text-muted-foreground">
              Receive your share of card and MoMo payments from invoice and POS. Choose bank or MoMo payout. A small platform fee applies.
            </p>
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Paystack charges (this workspace)</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                    Successful Paystack card payments linked to this workspace (bank subaccount or invoice/POS metadata). Open Paystack for balances, settlements, and MoMo transfer history.
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="paystack-tx-from" className="text-xs">
                      From
                    </Label>
                    <Input
                      id="paystack-tx-from"
                      type="date"
                      value={paystackTxFrom}
                      onChange={(e) => setPaystackTxFrom(e.target.value)}
                      className="w-[11rem]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="paystack-tx-to" className="text-xs">
                      To
                    </Label>
                    <Input
                      id="paystack-tx-to"
                      type="date"
                      value={paystackTxTo}
                      onChange={(e) => setPaystackTxTo(e.target.value)}
                      className="w-[11rem]"
                    />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => refetchPaystackTx()}>
                    Refresh
                  </Button>
                </div>
              </div>
              {loadingPaystackTx ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : paystackTxIsError ? (
                <p className="text-sm text-destructive">
                  {paystackTxError?.response?.data?.message || paystackTxError?.message || 'Could not load Paystack data.'}
                </p>
              ) : (
                <>
                  {paystackTxPayload?.truncated ? (
                    <Alert>
                      <AlertTitle>Large result set</AlertTitle>
                      <AlertDescription>
                        Only part of Paystack&apos;s list was scanned. Use a shorter date range to include older charges.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  {paystackTxPayload?.summary ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs text-muted-foreground">Successful charges</p>
                        <p className="font-semibold tabular-nums">{paystackTxPayload.summary.successfulCount}</p>
                      </div>
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs text-muted-foreground">Gross volume</p>
                        <p className="font-semibold tabular-nums">
                          {paystackTxPayload.summary.currency} {Number(paystackTxPayload.summary.grossVolumeMain).toFixed(2)}
                        </p>
                      </div>
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs text-muted-foreground">Fees (Paystack)</p>
                        <p className="font-semibold tabular-nums">
                          {paystackTxPayload.summary.currency} {Number(paystackTxPayload.summary.feesMain).toFixed(2)}
                        </p>
                      </div>
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs text-muted-foreground">Net (after fees)</p>
                        <p className="font-semibold tabular-nums">
                          {paystackTxPayload.summary.currency} {Number(paystackTxPayload.summary.netEstimateMain).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {paystackTxPayload?.disclaimer ? (
                    <p className="text-xs text-muted-foreground">{paystackTxPayload.disclaimer}</p>
                  ) : null}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Paid</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Fees</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(paystackTxPayload?.transactions || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-muted-foreground text-center py-6">
                            No matching Paystack charges in this range. Card payments from invoice or POS (with workspace metadata or subaccount) show here.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paystackTxPayload.transactions.map((row, idx) => (
                          <TableRow key={`${row.reference}-${row.paidAt || idx}`}>
                            <TableCell className="whitespace-nowrap text-xs">
                              {row.paidAt ? dayjs(row.paidAt).format('MMM D, YYYY HH:mm') : '—'}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{row.reference}</TableCell>
                            <TableCell className="capitalize">{row.channel || '—'}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {paystackTxPayload.summary?.currency} {Number(row.amountMain).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {paystackTxPayload.summary?.currency} {Number(row.feesMain).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  {paystackTxPayload?.pagination &&
                  paystackTxPayload.pagination.totalFiltered > (paystackTxPayload.pagination.perPage || 20) ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      <p className="text-xs text-muted-foreground">
                        Page {paystackTxPayload.pagination.page} of{' '}
                        {Math.max(
                          1,
                          Math.ceil(
                            paystackTxPayload.pagination.totalFiltered / paystackTxPayload.pagination.perPage
                          )
                        )}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={paystackTxPage <= 1}
                          onClick={() => setPaystackTxPage((p) => Math.max(1, p - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            paystackTxPage >=
                            Math.ceil(
                              paystackTxPayload.pagination.totalFiltered / paystackTxPayload.pagination.perPage
                            )
                          }
                          onClick={() => setPaystackTxPage((p) => p + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
        {loadingPaymentCollection ? (
          <div className="flex items-center justify-center py-6 md:py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !hasPaymentSubaccount ? (
          <>
            <Dialog
              open={paymentVerifyModalOpen}
              onOpenChange={(open) => {
                setPaymentVerifyModalOpen(open);
                if (!open) {
                  setShowPaymentOtpEmailHint(false);
                  if (skipResetPaymentVerifyOnCloseRef.current) {
                    skipResetPaymentVerifyOnCloseRef.current = false;
                  } else {
                    setPaymentPasswordVerified(false);
                    setPaymentOtpSent(false);
                    setPaymentVerifyPassword('');
                    setPaymentVerifyOtp('');
                  }
                  setPaymentPasswordVerified(false);
                }
              }}
            >
              <DialogContent className="sm:max-w-[26rem]">
                <DialogDescription className="sr-only">Verify your identity to link bank or MoMo for receiving payments.</DialogDescription>
                {!paymentPasswordVerified ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Verify your identity</DialogTitle>
                    </DialogHeader>
                    <DialogBody className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        {isGoogleUser
                          ? 'We will send a verification code to your email to continue.'
                          : 'Verify your password to continue.'}
                      </p>
                      {!isGoogleUser && (
                        <div className="space-y-2">
                          <Label htmlFor="payment-verify-password-modal">Account password</Label>
                          <Input
                            id="payment-verify-password-modal"
                            name="payment-verification-password"
                            type="password"
                            value={paymentVerifyPassword}
                            onChange={(e) => setPaymentVerifyPassword(e.target.value)}
                            placeholder="•••••••••"
                            autoComplete="new-password"
                            data-form-type="other"
                            data-lpignore="true"
                          />
                        </div>
                      )}
                      <Button type="button" onClick={handleVerifyPaymentPassword} disabled={paymentPasswordVerifying || (!isGoogleUser && !paymentVerifyPassword.trim())} className="w-full mt-2">
                        {paymentPasswordVerifying ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
                        {isGoogleUser ? 'Send verification code' : 'Verify password'}
                      </Button>
                    </DialogBody>
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle>Enter verification code</DialogTitle>
                    </DialogHeader>
                    <DialogBody className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Verification code sent to your email. Enter the code below.
                      </p>
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Label id="payment-otp-label">Verification code</Label>
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto p-0 text-xs text-muted-foreground shrink-0"
                            onClick={() => setShowPaymentOtpEmailHint((v) => !v)}
                          >
                            {showPaymentOtpEmailHint ? 'Hide email' : 'Which email?'}
                          </Button>
                        </div>
                        {showPaymentOtpEmailHint && user?.email ? (
                          <p className="text-xs text-muted-foreground" aria-live="polite">
                            Code sent to {maskEmail(user.email)}
                          </p>
                        ) : null}
                        <div
                          className="flex gap-2 w-full"
                          role="group"
                          aria-labelledby="payment-otp-label"
                        >
                          {(() => {
                            const raw = (paymentVerifyOtp || '').replace(/\D/g, '').slice(0, 6);
                            const digits = Array(6).fill('').map((_, j) => raw[j] || '');
                            return Array.from({ length: 6 }, (_, i) => (
                              <div key={i} className="flex-1 min-w-0 aspect-square">
                                <Input
                                  ref={(el) => { paymentOtpInputRefs.current[i] = el; }}
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={1}
                                  value={digits[i]}
                                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                                  className="w-full h-full text-center text-lg font-semibold tabular-nums p-0"
                                onChange={(e) => {
                                  const v = e.target.value.replace(/\D/g, '').slice(-1);
                                  const next = [...digits];
                                  next[i] = v;
                                  setPaymentVerifyOtp(next.join(''));
                                  if (v && i < 5) paymentOtpInputRefs.current[i + 1]?.focus();
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Backspace' && !digits[i] && i > 0) {
                                    paymentOtpInputRefs.current[i - 1]?.focus();
                                  }
                                }}
                                onPaste={(e) => {
                                  e.preventDefault();
                                  const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
                                  const next = Array(6).fill('').map((_, j) => pasted[j] || '');
                                  setPaymentVerifyOtp(next.join(''));
                                  const focusIndex = Math.min(pasted.length, 5);
                                  paymentOtpInputRefs.current[focusIndex]?.focus();
                                }}
                                />
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </DialogBody>
                    {paymentOtpSent && (
                      <DialogFooter className="justify-end">
                        <Button
                          type="button"
                          onClick={async () => {
                            const otp = (paymentVerifyOtp || '').replace(/\D/g, '');
                            if (otp.length !== 6) return;
                            setPaymentVerifyOtpVerifying(true);
                            try {
                              await settingsService.verifyPaymentCollectionOtp({
                                ...(isGoogleUser ? {} : { password: paymentVerifyPassword.trim() }),
                                otp
                              });
                              skipResetPaymentVerifyOnCloseRef.current = true;
                              setPaymentVerifyModalOpen(false);
                              setPaymentVerificationDone(true);
                            } catch (err) {
                              showError(err, 'Invalid verification code. Please try again.');
                            } finally {
                              setPaymentVerifyOtpVerifying(false);
                            }
                          }}
                          disabled={(paymentVerifyOtp || '').replace(/\D/g, '').length !== 6 || paymentVerifyOtpVerifying}
                        >
                          {paymentVerifyOtpVerifying ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
                          Verify
                        </Button>
                      </DialogFooter>
                    )}
                  </>
                )}
              </DialogContent>
            </Dialog>
            {!paymentAlreadyLinked && !paymentVerificationDone ? (
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">To receive card and MoMo payments from customers, link a bank account or MoMo number. You will verify your identity in the next step.</p>
                <Button type="button" onClick={() => setPaymentVerifyModalOpen(true)}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Link payment account
                </Button>
              </div>
            ) : (
          <div className="space-y-4">
            {isMomoLinked && (
              <>
                <Alert>
                  <AlertTitle>MoMo number linked</AlertTitle>
                  <AlertDescription>
                    Your share of Paystack payments is sent to your MoMo number. Provider: {pc?.momo_provider || '—'}. Number: {pc?.momo_phone_masked || '—'}. You can update the number below or switch to a bank account.
                  </AlertDescription>
                </Alert>
                <p className="text-sm text-muted-foreground">
                  To update, verify your identity first.{' '}
                  <Button type="button" variant="link" className="h-auto p-0 text-primary" onClick={() => setPaymentVerifyModalOpen(true)}>
                    Verify identity
                  </Button>
                </p>
              </>
            )}
          <Form {...paymentCollectionForm}>
            <form onSubmit={paymentCollectionForm.handleSubmit(onPaymentCollectionSubmit)} className="space-y-4">
              <FormField
                control={paymentCollectionForm.control}
                name="settlement_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receive settlement via</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? 'bank'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Bank or MoMo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="bank">Bank account</SelectItem>
                        <SelectItem value="momo">MoMo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Choose where to receive your share of payments.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={paymentCollectionForm.control}
                name="business_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business / account name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Aseda Supermarket" />
                    </FormControl>
                    <FormDescription>Pre-filled from organization name when available.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {paymentCollectionForm.watch('settlement_type') === 'momo' ? (
                <>
                  <FormField
                    control={paymentCollectionForm.control}
                    name="momo_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>MoMo phone number *</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" inputMode="numeric" placeholder="0XXXXXXXXX or 233XXXXXXXXX" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={paymentCollectionForm.control}
                    name="momo_provider"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>MoMo provider *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ''}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select MoMo provider" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="MTN">MTN MoMo</SelectItem>
                            <SelectItem value="AIRTEL">AirtelTigo Money</SelectItem>
                            <SelectItem value="VODAFONE">Vodafone Cash</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              ) : (
                <>
                  <FormField
                    control={paymentCollectionForm.control}
                    name="bank_code"
                    render={({ field }) => {
                      const selectedBank = banksList.find((b) => b.code === field.value);
                      return (
                        <FormItem>
                          <FormLabel>Bank *</FormLabel>
                          <Popover open={bankSelectOpen} onOpenChange={(open) => { setBankSelectOpen(open); if (!open) setBankSearchQuery(''); }}>
                            <FormControl>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="w-full justify-between font-normal h-10 min-h-[44px] md:min-h-[40px]"
                                >
                                  <span className={field.value ? '' : 'text-muted-foreground'}>
                                    {selectedBank ? (selectedBank.name || selectedBank.code) : 'Select bank'}
                                  </span>
                                  <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                            </FormControl>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                              <div className="p-2 border-b border-border">
                                <Input
                                  placeholder="Search banks..."
                                  value={bankSearchQuery}
                                  onChange={(e) => setBankSearchQuery(e.target.value)}
                                  className="h-9"
                                  autoComplete="off"
                                />
                              </div>
                              <ScrollArea className="h-64">
                                <div className="p-1">
                                  {loadingBanks ? (
                                    <p className="py-4 text-center text-sm text-muted-foreground">Loading banks…</p>
                                  ) : banksLoadError || filteredBanksList.length === 0 ? (
                                    <div className="py-4 px-2 text-center text-sm text-muted-foreground">
                                      <p className="mb-2">
                                        {banksLoadError
                                          ? 'Could not load banks.'
                                          : bankSearchQuery
                                            ? 'No banks match your search.'
                                            : 'Bank list unavailable. Use MoMo to receive payments, or try again later.'}
                                      </p>
                                      <Button type="button" variant="outline" size="sm" onClick={() => refetchBanks()}>
                                        Try again
                                      </Button>
                                    </div>
                                  ) : (
                                    filteredBanksList.map((bank, idx) => (
                                      <button
                                        key={bank.id ?? `bank-${bank.code}-${idx}`}
                                        type="button"
                                        className="flex w-full cursor-pointer items-center rounded-sm py-2 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                                        onClick={() => {
                                          field.onChange(String(bank.code));
                                          paymentCollectionForm.setValue('bank_name', bank.name || '');
                                          setBankSelectOpen(false);
                                        }}
                                      >
                                        {bank.name || bank.code}
                                      </button>
                                    ))
                                  )}
                                </div>
                              </ScrollArea>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                  <FormField
                    control={paymentCollectionForm.control}
                    name="account_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account number *</FormLabel>
                        <FormControl>
                          <Input {...field} type="text" inputMode="numeric" placeholder="e.g. 0123456789" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              <FormField
                control={paymentCollectionForm.control}
                name="primary_contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact email (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="you@example.com" />
                    </FormControl>
                    <FormDescription>Pre-filled from business/organization details when available.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={
                  updatePaymentCollectionMutation.isPending ||
                  (!isGoogleUser && !paymentVerifyPassword.trim()) ||
                  !paymentOtpSent ||
                  (paymentVerifyOtp || '').replace(/\D/g, '').length !== 6
                }
              >
                {updatePaymentCollectionMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Linking…
                  </>
                ) : paymentCollectionForm.watch('settlement_type') === 'momo' ? (
                  'Link MoMo number'
                ) : (
                  'Link bank account'
                )}
              </Button>
            </form>
          </Form>
        </div>
        )}
          </>
        ) : pc?.settlement_type === 'momo' ? (
          <div className="space-y-4">
            <Alert>
              <AlertTitle>MoMo wallet linked</AlertTitle>
              <AlertDescription>
                Your share of card and MoMo payments from Paystack is settled to your linked mobile money wallet (Paystack
                subaccount).
                {pc?.business_name ? (
                  <> Business name: <strong>{pc.business_name}</strong>.</>
                ) : null}
                {pc?.momo_provider ? (
                  <> Provider: <strong>{pc.momo_provider}</strong>.</>
                ) : null}
                {pc?.momo_phone_masked ? (
                  <> Number: <strong>{pc.momo_phone_masked}</strong>.</>
                ) : null}
                {' '}To change payout details, contact support.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert>
              <AlertTitle>Bank account linked</AlertTitle>
              <AlertDescription>
                Your share of card and MoMo payments from Paystack is settled to your linked bank account.
                {pc?.business_name ? (
                  <> Business name: <strong>{pc.business_name}</strong>.</>
                ) : null}
                {pc?.account_number_masked ? (
                  <> Account number (last 4 digits): <strong>{pc.account_number_masked}</strong>.</>
                ) : null}
                {' '}To change the account, contact support.
              </AlertDescription>
            </Alert>
          </div>
        )}
          </TabsContent>
          <TabsContent value="mtn-collection" className="mt-0 md:mt-1 space-y-4">
            <p className="text-sm text-muted-foreground">
              Direct MTN Request-to-Pay for POS and invoice “Pay with MoMo”. Workspace keys override platform MTN environment variables when saved.
            </p>
        {loadingPaymentCollection ? (
          <div className="flex items-center justify-center py-6 md:py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {pc?.mtn_collection?.encryptionConfigured === false && (
              <Alert variant="destructive">
                <AlertTitle>Server not ready for workspace MTN keys</AlertTitle>
                <AlertDescription>
                  The host must set <code className="text-xs">MOMO_CREDENTIALS_ENCRYPTION_KEY</code> (64 hex characters, e.g.{' '}
                  <code className="text-xs">openssl rand -hex 32</code>) before credentials can be stored.
                </AlertDescription>
              </Alert>
            )}
            <Alert>
              <AlertTitle>Active MTN source</AlertTitle>
              <AlertDescription>
                {pc?.mtn_collection?.activeSource === 'tenant' && (
                  <>
                    This workspace&apos;s encrypted credentials are in use.
                    {pc.mtn_collection.subscriptionKeyMasked || pc.mtn_collection.apiUserMasked ? (
                      <>
                        {' '}
                        Subscription key: <strong>{pc.mtn_collection.subscriptionKeyMasked || '—'}</strong> · API user:{' '}
                        <strong>{pc.mtn_collection.apiUserMasked || '—'}</strong>
                      </>
                    ) : null}
                  </>
                )}
                {pc?.mtn_collection?.activeSource === 'platform' && (
                  <>Platform MTN env is active (no workspace keys or keys could not be read).</>
                )}
                {pc?.mtn_collection?.activeSource === 'none' && (
                  <>No MTN collection is configured. Add workspace keys below or configure platform MTN env.</>
                )}
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="mtn-subscription-key">Subscription Key</Label>
              <Input
                id="mtn-subscription-key"
                name="mtn-subscription-key"
                type="password"
                autoComplete="off"
                value={mtnCredForm.subscriptionKey}
                onChange={(e) => setMtnCredForm((f) => ({ ...f, subscriptionKey: e.target.value }))}
                placeholder="From MTN MoMo Developer portal"
                data-form-type="other"
                data-lpignore="true"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mtn-api-user">API User (UUID)</Label>
              <Input
                id="mtn-api-user"
                name="mtn-api-user"
                type="text"
                autoComplete="off"
                value={mtnCredForm.apiUser}
                onChange={(e) => setMtnCredForm((f) => ({ ...f, apiUser: e.target.value }))}
                placeholder="API user UUID"
                data-form-type="other"
                data-lpignore="true"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mtn-api-key">API Key</Label>
              <Input
                id="mtn-api-key"
                name="mtn-api-key"
                type="password"
                autoComplete="off"
                value={mtnCredForm.apiKey}
                onChange={(e) => setMtnCredForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder="API key"
                data-form-type="other"
                data-lpignore="true"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mtn-environment">Environment</Label>
              <Select
                value={mtnCredForm.environment}
                onValueChange={(v) => setMtnCredForm((f) => ({ ...f, environment: v }))}
              >
                <SelectTrigger id="mtn-environment">
                  <SelectValue placeholder="Sandbox or production" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mtn-collection-url">Collection API URL (optional)</Label>
              <Input
                id="mtn-collection-url"
                name="mtn-collection-url"
                type="url"
                autoComplete="off"
                value={mtnCredForm.collectionApiUrl}
                onChange={(e) => setMtnCredForm((f) => ({ ...f, collectionApiUrl: e.target.value }))}
                placeholder="Override collection base URL if needed"
                data-form-type="other"
                data-lpignore="true"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mtn-callback-url">Callback URL (optional)</Label>
              <Input
                id="mtn-callback-url"
                name="mtn-callback-url"
                type="url"
                autoComplete="off"
                value={mtnCredForm.callbackUrl}
                onChange={(e) => setMtnCredForm((f) => ({ ...f, callbackUrl: e.target.value }))}
                placeholder="Webhook callback if different from default"
                data-form-type="other"
                data-lpignore="true"
              />
            </div>
            {!isGoogleUser && (
              <div className="space-y-2">
                <Label htmlFor="mtn-gate-password">Account password</Label>
                <Input
                  id="mtn-gate-password"
                  name="mtn-gate-password"
                  type="password"
                  autoComplete="current-password"
                  value={mtnGatePassword}
                  onChange={(e) => setMtnGatePassword(e.target.value)}
                  placeholder="Required to send verification code"
                  data-form-type="other"
                  data-lpignore="true"
                />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleMtnSendOtp}>
                Send verification code
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mtn-otp">Verification code</Label>
              <Input
                id="mtn-otp"
                name="mtn-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={mtnOtp}
                onChange={(e) => setMtnOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code from email"
                className="max-w-[12rem] tabular-nums tracking-widest"
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {pc?.mtn_collection?.configured ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleMtnDisconnect}
                  disabled={mtnDisconnecting || pc?.mtn_collection?.encryptionConfigured === false}
                >
                  {mtnDisconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
                  Remove workspace keys
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={handleMtnTest}
                disabled={mtnTesting || pc?.mtn_collection?.encryptionConfigured === false}
              >
                {mtnTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
                Test connection
              </Button>
              <Button
                type="button"
                onClick={handleMtnSave}
                disabled={mtnSaving || pc?.mtn_collection?.encryptionConfigured === false}
              >
                {mtnSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
                Save credentials
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Test, save, and remove require the email verification code. Test and save need all three secrets each time; saving replaces any previously stored workspace keys.
            </p>
          </div>
        )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </ShadcnCard>
  ) : (
    <ShadcnCard>
      <CardHeader>
        <CardTitle>Payments</CardTitle>
        <CardDescription>You need admin or manager role to manage payment collection.</CardDescription>
      </CardHeader>
    </ShadcnCard>
  );

  const integrationTab = canManageOrganization ? (
    <ShadcnCard className="border-0 shadow-none bg-transparent md:border md:bg-card">
      <CardHeader className="p-0 md:p-6 pb-2 md:pb-6">
        <CardTitle className="text-lg md:text-2xl">Integration Settings</CardTitle>
        <CardDescription className="mt-1 md:mt-0">
          Configure communication channels (WhatsApp, SMS, Email). Saving a channel runs a connection test and marks it verified for Marketing — you only need to do that again if you change credentials. Use the Payments tab to link bank or MoMo for receiving settlements. Customer auto-send, quotes, and job options are under the Configurations tab.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 md:p-6 pt-0">
        <Tabs
          value={integrationSubTab}
          onValueChange={(key) => {
            setIntegrationSubTab(key);
            setSearchParams({ tab: 'messaging', subtab: key });
          }}
        >
          {isMobile ? (
            <Select
              value={integrationSubTab}
              onValueChange={(key) => {
                setIntegrationSubTab(key);
                setSearchParams({ tab: 'messaging', subtab: key });
              }}
            >
              <SelectTrigger className="w-full mb-2 md:mb-4">
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="whatsapp" className="w-full justify-center text-xs md:text-sm">
                WhatsApp
              </TabsTrigger>
              <TabsTrigger value="sms" className="w-full justify-center text-xs md:text-sm">
                SMS
              </TabsTrigger>
              <TabsTrigger value="email" className="w-full justify-center text-xs md:text-sm">
                Email
              </TabsTrigger>
            </TabsList>
          )}
          <TabsContent value="whatsapp" className="mt-2 md:mt-4">
            {whatsappTab}
          </TabsContent>
          <TabsContent value="sms" className="mt-2 md:mt-4">
            {smsTab}
          </TabsContent>
          <TabsContent value="email" className="mt-2 md:mt-4">
            {emailTab}
          </TabsContent>
        </Tabs>
      </CardContent>
    </ShadcnCard>
  ) : (
    <ShadcnCard className="border-0 shadow-none bg-transparent md:border md:bg-card">
      <CardContent className="p-0 md:pt-6 md:px-6">
        <Alert variant="destructive" className="py-2 px-3 md:py-4 md:px-4">
          <AlertTitle>Access Restricted</AlertTitle>
          <AlertDescription>
            You need admin or manager permissions to configure integration settings.
          </AlertDescription>
        </Alert>
      </CardContent>
    </ShadcnCard>
  );

  return (
    <div className="px-0 md:px-0">
      <div className="mb-3 md:mb-6">
        <h2 className="text-xl md:text-2xl font-semibold mb-1 md:mb-2">Settings</h2>
        <p className="text-xs md:text-sm text-muted-foreground">
          Manage your personal account, organization profile, and subscription information.
        </p>
      </div>

      {showOnboardingBanner && (
        <ShadcnCard className="mb-3 md:mb-6 border-0 md:border border-brand bg-green-50">
          <CardContent className="p-2 md:p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-base md:text-lg font-semibold text-foreground mb-0.5 md:mb-1">Complete onboarding</h3>
                <p className="text-xs md:text-sm text-gray-600">
                  Finish setting up your business to get the most out of African Business Suite.
                </p>
              </div>
              <Button
                onClick={() => navigate('/onboarding')}
                className="shrink-0 bg-brand text-primary-foreground hover:bg-brand-dark border border-brand"
              >
                Complete onboarding
              </Button>
            </div>
          </CardContent>
        </ShadcnCard>
      )}

      <Tabs value={activeTab} onValueChange={(key) => {
        setActiveTab(key);
        if (key === 'messaging') {
          const currentSubtab = searchParams.get('subtab') || integrationSubTab || 'whatsapp';
          setSearchParams({ tab: 'messaging', subtab: currentSubtab });
        } else if (key === 'billing') {
          const currentSubtab = searchParams.get('subtab') || paymentsSubTab || 'settlements';
          setSearchParams({ tab: 'billing', subtab: currentSubtab });
        } else {
          setSearchParams({ tab: key });
        }
      }}>
        {isMobile ? (
          <Select value={activeTab} onValueChange={(key) => {
            setActiveTab(key);
            if (key === 'messaging') {
              const currentSubtab = searchParams.get('subtab') || integrationSubTab || 'whatsapp';
              setSearchParams({ tab: 'messaging', subtab: currentSubtab });
            } else if (key === 'billing') {
              const currentSubtab = searchParams.get('subtab') || paymentsSubTab || 'settlements';
              setSearchParams({ tab: 'billing', subtab: currentSubtab });
            } else {
              setSearchParams({ tab: key });
            }
          }}>
            <SelectTrigger className="w-full mb-3 md:mb-4">
              <SelectValue placeholder="Select section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="profile">Profile</SelectItem>
              <SelectItem value="workspace">Workspace</SelectItem>
              <SelectItem value="operations">Operations</SelectItem>
              <SelectItem value="billing">Billing &amp; Payments</SelectItem>
              <SelectItem value="messaging">Messaging</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <TabsList className="w-full mb-3 md:mb-4 h-auto flex items-center justify-start gap-1 overflow-x-auto whitespace-nowrap">
            <TabsTrigger value="profile" className="text-xs md:text-sm shrink-0">
              Profile
            </TabsTrigger>
            <TabsTrigger value="workspace" className="text-xs md:text-sm shrink-0">
              Workspace
            </TabsTrigger>
            <TabsTrigger value="operations" className="text-xs md:text-sm shrink-0">
              Operations
            </TabsTrigger>
            <TabsTrigger value="billing" className="text-xs md:text-sm shrink-0">
              Billing &amp; Payments
            </TabsTrigger>
            <TabsTrigger value="messaging" className="text-xs md:text-sm shrink-0">
              Messaging
            </TabsTrigger>
          </TabsList>
        )}
        <TabsContent value="profile">{profileTab}</TabsContent>
        <TabsContent value="workspace">
          <div className="space-y-4 md:space-y-6">
            {canManageOrganization && jobInvoiceData?.customerJobTrackingEnabled === true && publicTrackingUrl ? (
              <Alert className="border-[#166534]/25 bg-[#166534]/5">
                <AlertTitle className="text-sm">Public customer tracking</AlertTitle>
                <AlertDescription className="text-xs mt-2 space-y-3 text-muted-foreground">
                  <p>
                    Share this link with clients so they can check status using their{' '}
                    {isStudioLike ? 'job' : 'order'} ID and phone — no login. Toggle and details:{' '}
                    <strong className="text-foreground">Operations</strong> → Configurations →{' '}
                    {isStudioLike ? 'Jobs, invoices & customer tracking' : 'Customer tracking (public)'}.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                    <Input value={publicTrackingUrl} readOnly className="font-mono text-xs sm:text-sm bg-background" />
                    <Button
                      type="button"
                      variant="secondaryStroke"
                      size="sm"
                      className="shrink-0"
                      onClick={handleCopyTrackingUrl}
                    >
                      Copy link
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}
            {canManageOrganization &&
            jobInvoiceData &&
            jobInvoiceData.customerJobTrackingEnabled === false ? (
              <Alert>
                <AlertTitle className="text-sm">Public customer tracking</AlertTitle>
                <AlertDescription className="text-xs mt-1 text-muted-foreground">
                  Enable <strong className="text-foreground">Public tracking page</strong> under{' '}
                  <strong className="text-foreground">Operations</strong> → Configurations to generate a link you can
                  share with customers (ID + phone lookup).
                </AlertDescription>
              </Alert>
            ) : null}
            {organizationTab}
            {appearanceTab}
          </div>
        </TabsContent>
        <TabsContent value="operations">{configurationsTab}</TabsContent>
        <TabsContent value="billing">
          <div className="space-y-4 md:space-y-6">
            {subscriptionTab}
            {paymentsTab}
          </div>
        </TabsContent>
        <TabsContent value="messaging">
          <div className="space-y-4 md:space-y-6">
            {notificationsTab}
            {integrationTab}
          </div>
        </TabsContent>
      </Tabs>

      <FilePreview
        open={profilePreviewVisible}
        onClose={() => setProfilePreviewVisible(false)}
        file={profilePreview ? {
          fileUrl: profilePreview,
          title: 'Profile Picture',
          type: profilePreview.startsWith('data:image/') ? 'image' : 'image',
          metadata: {
            mimeType: profilePreview.startsWith('data:') 
              ? profilePreview.match(/data:([^;]+)/)?.[1] || 'image/jpeg'
              : 'image/jpeg'
          }
        } : null}
      />

      <FilePreview
        open={organizationLogoPreviewVisible}
        onClose={() => setOrganizationLogoPreviewVisible(false)}
        file={organizationLogoPreview || organizationData?.data?.logoUrl ? {
          fileUrl: organizationLogoPreview || organizationData?.data?.logoUrl,
          title: 'Organization Logo',
          type: 'image',
          metadata: {
            mimeType: (organizationLogoPreview || organizationData?.data?.logoUrl)?.startsWith('data:') 
              ? (organizationLogoPreview || organizationData?.data?.logoUrl).match(/data:([^;]+)/)?.[1] || 'image/jpeg'
              : 'image/jpeg'
          }
        } : null}
      />
    </div>
  );
};

export default Settings;

