import { useEffect, useMemo, useState } from 'react';
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
import { Camera, User, Mail, UserCog, Loader2, Eye, Trash2, Moon, Lightbulb, ExternalLink, HelpCircle, CreditCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useHintMode } from '../context/HintModeContext';
import { showSuccess, showError } from '../utils/toast';
import inviteService from '../services/inviteService';
import PhoneNumberInput from '../components/PhoneNumberInput';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { SHOP_TYPE_LABELS, CURRENCIES } from '../constants';
import {
  Dialog,
  DialogBody,
  DialogContent,
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
  invoiceFooter: z.string().optional(),
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
  provider: z.enum(['twilio', 'africas_talking']).default('twilio'),
  accountSid: z.string().optional(),
  authToken: z.string().optional(),
  fromNumber: z.string().optional(),
  apiKey: z.string().optional(),
  username: z.string().optional(),
});

const emailSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.enum(['smtp', 'sendgrid', 'ses']).default('smtp'),
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
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
  seats: z.number().min(1, 'Seats count is required'),
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
  business_name: z.string().min(1, 'Business / account name is required'),
  bank_code: z.string().min(1, 'Bank is required'),
  bank_name: z.string().optional(),
  account_number: z.string().min(8, 'Account number must be at least 8 characters'),
  primary_contact_email: z.string().email().optional().or(z.literal('')),
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
  const tabFromUrl = searchParams.get('tab') || 'profile';
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [integrationSubTab, setIntegrationSubTab] = useState('whatsapp');
  
  // Update tab when URL parameter changes
  useEffect(() => {
    const tab = searchParams.get('tab') || 'profile';
    const subtab = searchParams.get('subtab');
    
    // Redirect workspace tab to organization
    if (tab === 'workspace') {
      setActiveTab('organization');
      setSearchParams({ tab: 'organization' });
    }
    // Handle backward compatibility: redirect old integration tabs to new structure
    else if (tab === 'whatsapp' || tab === 'sms' || tab === 'email') {
      setActiveTab('integration');
      setIntegrationSubTab(tab);
      setSearchParams({ tab: 'integration', subtab: tab });
    }
    // Handle integration tab with subtab
    else if (tab === 'integration') {
      setActiveTab('integration');
      if (subtab && ['whatsapp', 'sms', 'email'].includes(subtab)) {
        setIntegrationSubTab(subtab);
      } else {
        // Default to whatsapp if no valid subtab
        setIntegrationSubTab('whatsapp');
        setSearchParams({ tab: 'integration', subtab: 'whatsapp' });
      }
    }
    else {
      setActiveTab(tab);
    }
  }, [searchParams, setSearchParams]);
  const [profilePreview, setProfilePreview] = useState('');
  const [profileEditing, setProfileEditing] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [profilePreviewVisible, setProfilePreviewVisible] = useState(false);
  const [profileUploading, setProfileUploading] = useState(false);
  const [organizationLogoPreview, setOrganizationLogoPreview] = useState('');
  const [organizationEditing, setOrganizationEditing] = useState(false);
  const [organizationLogoPreviewVisible, setOrganizationLogoPreviewVisible] = useState(false);
  const [organizationLogoUploading, setOrganizationLogoUploading] = useState(false);
  const [posConfigEditing, setPosConfigEditing] = useState(false);
  const [seatUsage, setSeatUsage] = useState(null);
  const [storageUsage, setStorageUsage] = useState(null);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [whatsappTemplateLearnMoreOpen, setWhatsappTemplateLearnMoreOpen] = useState(false);
  const { user, updateUser, activeTenant } = useAuth();
  const canManageOrganization = ['admin', 'manager'].includes(user?.role);

  const onboardingCompleted = useMemo(
    () => !!activeTenant?.metadata?.onboarding?.completedAt,
    [activeTenant?.metadata?.onboarding?.completedAt]
  );
  const showOnboardingBanner = !onboardingCompleted;

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
      provider: 'twilio',
      accountSid: '',
      authToken: '',
      fromNumber: '',
      apiKey: '',
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
      plan: 'free',
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
      business_name: '',
      bank_code: '',
      bank_name: '',
      account_number: '',
      primary_contact_email: '',
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
    isLoading: loadingOrganization
  } = useQuery({
    queryKey: ['settings', 'organization'],
    queryFn: settingsService.getOrganization
  });

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
    queryKey: ['settings', 'payment-collection'],
    queryFn: settingsService.getPaymentCollectionSettings,
    enabled: canManageOrganization
  });

  const { data: paymentCollectionBanks = [] } = useQuery({
    queryKey: ['settings', 'payment-collection-banks'],
    queryFn: settingsService.getPaymentCollectionBanks,
    enabled: canManageOrganization
  });

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
        provider: smsData.data.provider || 'twilio',
        accountSid: smsData.data.accountSid || '',
        authToken: smsData.data.authToken === '***' ? '' : (smsData.data.authToken || ''),
        fromNumber: smsData.data.fromNumber || '',
        apiKey: smsData.data.apiKey === '***' ? '' : (smsData.data.apiKey || ''),
        username: smsData.data.username || ''
      });
    }
  }, [smsData, smsForm, canManageOrganization]);

  useEffect(() => {
    if (emailData?.data && canManageOrganization) {
      emailForm.reset({
        enabled: emailData.data.enabled || false,
        provider: emailData.data.provider || 'smtp',
        smtpHost: emailData.data.smtpHost || '',
        smtpPort: emailData.data.smtpPort || 587,
        smtpUser: emailData.data.smtpUser || '',
        smtpPassword: emailData.data.smtpPassword === '***' ? '' : (emailData.data.smtpPassword || ''),
        smtpRejectUnauthorized: emailData.data.smtpRejectUnauthorized !== false,
        fromEmail: emailData.data.fromEmail || '',
        fromName: emailData.data.fromName || '',
        sendgridApiKey: emailData.data.sendgridApiKey === '***' ? '' : (emailData.data.sendgridApiKey || ''),
        sesAccessKeyId: emailData.data.sesAccessKeyId || '',
        sesSecretAccessKey: emailData.data.sesSecretAccessKey === '***' ? '' : (emailData.data.sesSecretAccessKey || ''),
        sesRegion: emailData.data.sesRegion || 'us-east-1',
        sesHost: emailData.data.sesHost || ''
      });
    }
  }, [emailData, emailForm, canManageOrganization]);

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
    const pc = paymentCollectionData?.data ?? paymentCollectionData;
    if (pc && canManageOrganization && !pc.hasSubaccount) {
      paymentCollectionForm.reset({
        business_name: pc.business_name || '',
        bank_code: pc.bank_code || '',
        bank_name: pc.bank_name || '',
        account_number: '',
        primary_contact_email: pc.primary_contact_email || '',
      });
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
        invoiceFooter: organization.invoiceFooter || '',
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
          tin: organization.tax?.tin || ''
        },
        shopType: organization.shopType || ''
      });
      setOrganizationLogoPreview(organization.logoUrl || '');
      setOrganizationEditing(false);
    } else {
      setOrganizationLogoPreview('');
    }
  }, [organizationData, organizationForm]);

  // Fetch usage data
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        setLoadingUsage(true);
        const [seatResponse, storageResponse] = await Promise.all([
          inviteService.getSeatUsage(),
          inviteService.getStorageUsage()
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
  }, []);

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

  // Fetch usage data
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        setLoadingUsage(true);
        const [seatResponse, storageResponse] = await Promise.all([
          inviteService.getSeatUsage(),
          inviteService.getStorageUsage()
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
  }, []);

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
        plan: subscription.plan || 'free',
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

  const updateProfileMutation = useMutation({
    mutationFn: settingsService.updateProfile,
    onSuccess: (response) => {
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
      const errMsg = error?.response?.data?.message || 'Failed to update profile';
      showError(error, 'Failed to update profile. Please try again.');
    }
  });

  const updateOrganizationMutation = useMutation({
    mutationFn: settingsService.updateOrganization,
    onSuccess: (response) => {
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
      showError(error, 'Failed to update organization settings. Please try again.');
    }
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: settingsService.updateSubscription,
    onSuccess: () => {
      showSuccess('Subscription settings saved successfully');
      queryClient.invalidateQueries({ queryKey: ['settings', 'subscription'] });
    },
    onError: (error) => {
      const errMsg = error?.response?.data?.message || 'Failed to update subscription settings';
      showError(error, 'Failed to update profile. Please try again.');
    }
  });

  const updateWhatsAppMutation = useMutation({
    mutationFn: whatsappService.updateSettings,
    onSuccess: () => {
      showSuccess('WhatsApp settings saved successfully');
      queryClient.invalidateQueries({ queryKey: ['settings', 'whatsapp'] });
    },
    onError: (error) => {
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
      showSuccess('SMS settings saved successfully');
      queryClient.invalidateQueries({ queryKey: ['settings', 'sms'] });
    },
    onError: (error) => {
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
      showSuccess('Email settings saved successfully');
      queryClient.invalidateQueries({ queryKey: ['settings', 'email'] });
    },
    onError: (error) => {
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
      showSuccess(response?.message || 'Bank account linked successfully');
      await queryClient.invalidateQueries({ queryKey: ['settings', 'payment-collection'] });
    },
    onError: (error) => {
      showError(error?.response?.data?.message || error?.message || 'Failed to link bank account');
    },
  });

  const updatePOSConfigMutation = useMutation({
    mutationFn: settingsService.updatePOSConfig,
    onSuccess: async (response) => {
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
        tin: values.tax?.tin || ''
      },
      ...(values.shopType !== undefined ? { shopType: values.shopType || '' } : {})
    };

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

    updateWhatsAppMutation.mutate(payload);
  };

  const handleTestWhatsApp = () => {
    const values = whatsappForm.getValues();
    if (!values.accessToken || !values.phoneNumberId) {
      showError(null, 'Please provide Access Token and Phone Number ID to test connection');
      return;
    }
    testWhatsAppMutation.mutate({
      accessToken: values.accessToken,
      phoneNumberId: values.phoneNumberId
    });
  };

  const onSMSSubmit = async (values) => {
    const payload = { ...values };
    updateSMSMutation.mutate(payload);
  };

  const handleTestSMS = () => {
    const values = smsForm.getValues();
    const provider = values.provider || 'twilio';
    
    let config = { provider };
    if (provider === 'twilio') {
      if (!values.accountSid || !values.authToken) {
        showError(null, 'Please provide Account SID and Auth Token to test connection');
        return;
      }
      config = { ...config, accountSid: values.accountSid, authToken: values.authToken };
    } else if (provider === 'africas_talking') {
      if (!values.apiKey || !values.username) {
        showError(null, 'Please provide API Key and Username to test connection');
        return;
      }
      config = { ...config, apiKey: values.apiKey, username: values.username };
    }
    
    testSMSMutation.mutate(config);
  };

  const onEmailSubmit = async (values) => {
    const payload = { ...values };
    updateEmailMutation.mutate(payload);
  };

  const onPaymentCollectionSubmit = async (values) => {
    const bank = Array.isArray(paymentCollectionBanks) ? paymentCollectionBanks.find((b) => b.code === values.bank_code) : null;
    updatePaymentCollectionMutation.mutate({
      business_name: values.business_name.trim(),
      bank_code: values.bank_code,
      bank_name: bank?.name || values.bank_name || '',
      account_number: String(values.account_number).replace(/\s/g, ''),
      primary_contact_email: values.primary_contact_email?.trim() || undefined,
    });
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
    updatePOSConfigMutation.mutate(payload);
  };

  const handleTestEmail = () => {
    const values = emailForm.getValues();
    const provider = values.provider || 'smtp';
    
    let config = { provider };
    if (provider === 'smtp') {
      if (!values.smtpHost || !values.smtpUser || !values.smtpPassword) {
        showError(null, 'Please provide SMTP Host, User, and Password to test connection');
        return;
      }
      config = {
        ...config,
        smtpHost: values.smtpHost,
        smtpPort: values.smtpPort || 587,
        smtpUser: values.smtpUser,
        smtpPassword: values.smtpPassword,
        smtpRejectUnauthorized: values.smtpRejectUnauthorized !== false
      };
    } else if (provider === 'sendgrid') {
      if (!values.sendgridApiKey) {
        showError(null, 'Please provide SendGrid API Key to test connection');
        return;
      }
      config = { ...config, sendgridApiKey: values.sendgridApiKey };
    } else if (provider === 'ses') {
      if (!values.sesAccessKeyId || !values.sesSecretAccessKey) {
        showError(null, 'Please provide AWS SES Access Key ID and Secret Access Key to test connection');
        return;
      }
      config = {
        ...config,
        sesAccessKeyId: values.sesAccessKeyId,
        sesSecretAccessKey: values.sesSecretAccessKey,
        sesRegion: values.sesRegion || 'us-east-1',
        sesHost: values.sesHost
      };
    }
    
    testEmailMutation.mutate(config);
  };

  const handleProfileImageUpload = async ({ file }) => {
    if (!file) return;
    setProfileUploading(true);
    try {
      const response = await settingsService.uploadProfilePicture(file);
      const updatedUser = response?.data || response;
      
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
    const isTrialOrFree = subscription.plan === 'trial' || subscription.plan === 'free';
    const statusColor = subscription.status === 'active' ? 'text-green-600' : subscription.status === 'trialing' ? 'text-yellow-600' : 'text-red-600';
    return (
      <div className="mb-3 md:mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <ShadcnCard>
            <CardContent className="pt-4 md:pt-6 px-3 md:px-6 pb-4 md:pb-6">
              <h4 className="text-base md:text-lg font-semibold mb-2">
                {subscription.plan?.toUpperCase() || 'FREE'}
              </h4>
              <p className={statusColor}>
                {subscription.status?.toUpperCase()}
              </p>
              {subscription.currentPeriodEnd && (
                <div className="mt-3">
                  <p className="text-sm text-muted-foreground">Renews</p>
                  <div className="text-base font-medium">
                    {dayjs(subscription.currentPeriodEnd).format('MMM DD, YYYY')}
                  </div>
                </div>
              )}
              {isTrialOrFree && (
                <div className="mt-4">
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
          <ShadcnCard>
            <CardContent className="pt-4 md:pt-6 px-3 md:px-6 pb-4 md:pb-6">
              <p className="text-xs md:text-sm text-muted-foreground">Notes</p>
              <div className="mt-2 md:mt-3">
                <p className="text-sm">{subscription.notes || '—'}</p>
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
    <ShadcnCard>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Customize how the app looks on your device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Moon className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Dark mode</p>
              <p className="text-sm text-muted-foreground">
                Use dark theme for a more comfortable view in low light.
              </p>
            </div>
          </div>
          <Switch
            checked={theme === 'dark'}
            onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lightbulb className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Hint Mode</p>
              <p className="text-sm text-muted-foreground">
                Show hints when hovering over buttons, icons, and stats.
              </p>
            </div>
          </div>
          <Switch
            checked={hintMode}
            onCheckedChange={setHintMode}
          />
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-medium mb-4">Invoice Preview</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Preview how your invoice will look with your current branding
          </p>
          <div className="border rounded-lg p-4 bg-card" style={{ maxHeight: '800px', overflow: 'auto' }}>
            <PrintableInvoice
              invoice={mockInvoice}
              organization={{
                ...organization,
                logoUrl: organizationLogo || organization.logoUrl
              }}
            />
          </div>
        </div>
      </CardContent>
    </ShadcnCard>
  );

  const profileTab = (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
      <div className="lg:col-span-2">
        <ShadcnCard>
          <CardHeader className="px-3 md:px-6 pt-3 md:pt-6 pb-3 md:pb-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-0">
              <CardTitle className="text-lg md:text-xl">Personal Information</CardTitle>
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
          <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
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
                      {user && !user.emailVerifiedAt && (
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
                    className="h-24 w-24 cursor-pointer" 
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Role</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <UserCog className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm">{profileData?.data?.role?.toUpperCase() || '—'}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <p className="text-sm mt-1">{profileData?.data?.isActive ? 'Active' : 'Inactive'}</p>
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

  const organizationTab = organizationEditing && canManageOrganization ? (
    <ShadcnCard>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Organization Profile</CardTitle>
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
      <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
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

        <div className="border-t border-border pt-6 mt-6 -mx-6 px-6">
          <h3 className="text-sm font-medium mb-4">Branding</h3>
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

        <div className="border-t border-border pt-6 mt-6 -mx-6 px-6">
          <h3 className="text-sm font-medium mb-4">Address</h3>
          <div className="space-y-4">
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

        <div className="border-t border-border pt-6 mt-6 -mx-6 px-6">
          <h3 className="text-sm font-medium mb-4">Tax & Compliance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>
        </div>

        <div className="border-t border-border pt-6 mt-6 -mx-6 px-6">
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
    <ShadcnCard>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Organization Profile</CardTitle>
          {canManageOrganization && (
            <Button
              variant="secondaryStroke"
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
      <CardContent>
        {loadingOrganization ? (
          <div className="flex items-center justify-center py-12">
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

      <div className="border-t border-border pt-6 mt-6 -mx-6 px-6">
        <h3 className="text-sm font-medium mb-4">Branding</h3>
        <div className="flex items-center gap-6">
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
              Upload Logo
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

      <div className="border-t border-border pt-6 mt-6 -mx-6 px-6">
        <h3 className="text-sm font-medium mb-4">Address</h3>
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

      <div className="border-t border-border pt-6 mt-6 -mx-6 px-6">
        <h3 className="text-sm font-medium mb-4">Tax & Compliance</h3>
        <ShadcnDescriptions>
        <DescriptionItem label="VAT Number">{organization.tax?.vatNumber || 'Not set'}</DescriptionItem>
        <DescriptionItem label="TIN">{organization.tax?.tin || 'Not set'}</DescriptionItem>
      </ShadcnDescriptions>
      </div>

      <div className="border-t border-border pt-6 mt-6">
        <h3 className="text-sm font-medium mb-4">Invoice & Quote Footer</h3>
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

      <div className="border-t border-border pt-6 mt-6 -mx-6 px-6">
        <h3 className="text-sm font-medium mb-4">Business</h3>
        <div className="space-y-4">
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
    <ShadcnCard>
      <CardHeader className="pb-2">
        <CardTitle>Subscription & Billing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-3">
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
              {(subscriptionData.data.plan === 'trial' || subscriptionData.data.plan === 'free') && (
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

        <Separator className="!-mx-6" />

        {/* Usage Information - Minimal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        <Separator className="!-mx-6" />

        {/* Subscription Management */}
        {loadingSubscription ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Form {...subscriptionForm}>
            <form onSubmit={subscriptionForm.handleSubmit(onSubscriptionSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={subscriptionForm.control}
                    name="plan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plan</FormLabel>
                        <FormControl>
                          <Input placeholder="free / pro / enterprise" {...field} />
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
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    <ShadcnCard>
      <CardHeader>
        <CardTitle>WhatsApp Business API Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        {loadingWhatsApp ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <Alert className="mb-6">
              <AlertTitle>WhatsApp Integration</AlertTitle>
              <AlertDescription>
                Configure WhatsApp Business API to send automated notifications to customers. You'll need to set up a WhatsApp Business Account in Meta Business Manager first.
              </AlertDescription>
            </Alert>

            <Form {...whatsappForm}>
              <form onSubmit={whatsappForm.handleSubmit(onWhatsAppSubmit)} className="space-y-4">
                <FormField
                  control={whatsappForm.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enable WhatsApp</FormLabel>
                        <FormDescription>
                          Enable WhatsApp Business API integration
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={whatsappForm.control}
                    name="phoneNumberId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Phone Number ID
                          <span className="text-xs text-muted-foreground ml-2">
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
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
                    onClick={handleTestWhatsApp}
                    loading={testWhatsAppMutation.isLoading}
                  >
                    Test Connection
                  </Button>
                  <Button type="submit" loading={updateWhatsAppMutation.isLoading}>
                    Save Settings
                  </Button>
                </div>
              </form>
            </Form>

            <Separator className="my-6">
              <span className="text-sm font-medium">Message Templates</span>
            </Separator>
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Template Setup Required</AlertTitle>
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
    <ShadcnCard>
      <CardContent className="pt-6">
        <Alert variant="destructive">
          <AlertTitle>Access Restricted</AlertTitle>
          <AlertDescription>
            You need admin or manager permissions to configure WhatsApp settings.
          </AlertDescription>
        </Alert>
      </CardContent>
    </ShadcnCard>
  );

  const smsTab = canManageOrganization ? (
    <ShadcnCard>
      <CardHeader>
        <CardTitle>SMS Service Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        {loadingSMS ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <Alert className="mb-6">
              <AlertTitle>SMS Integration</AlertTitle>
              <AlertDescription>
                Configure SMS service to send automated notifications to customers. Supports Twilio and Africa's Talking providers.
              </AlertDescription>
            </Alert>

            <Form {...smsForm}>
              <form onSubmit={smsForm.handleSubmit(onSMSSubmit)} className="space-y-4">
                <FormField
                  control={smsForm.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enable SMS</FormLabel>
                        <FormDescription>
                          Enable SMS service integration
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
                            <SelectItem value="twilio">Twilio</SelectItem>
                            <SelectItem value="africas_talking">Africa's Talking</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {smsForm.watch('provider') === 'twilio' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          provider: smsData.data.provider || 'twilio',
                          accountSid: smsData.data.accountSid || '',
                          authToken: '',
                          fromNumber: smsData.data.fromNumber || '',
                          apiKey: '',
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
    <ShadcnCard>
      <CardContent className="pt-6">
        <Alert variant="destructive">
          <AlertTitle>Access Restricted</AlertTitle>
          <AlertDescription>
            You need admin or manager permissions to configure SMS settings.
          </AlertDescription>
        </Alert>
      </CardContent>
    </ShadcnCard>
  );

  const emailTab = canManageOrganization ? (
    <ShadcnCard>
      <CardHeader>
        <CardTitle>Email Service Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        {loadingEmail ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <Alert className="mb-6">
              <AlertTitle>Email Integration</AlertTitle>
              <AlertDescription>
                Configure email service to send automated notifications to customers. Supports SMTP, SendGrid, and AWS SES providers.
              </AlertDescription>
            </Alert>

            <Form {...emailForm}>
              <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
                <FormField
                  control={emailForm.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enable Email</FormLabel>
                        <FormDescription>
                          Enable email service integration
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
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 587)}
                                value={field.value || 587}
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
                              <Input type="password" placeholder="Enter password" {...field} />
                            </FormControl>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      emailForm.reset();
                      if (emailData?.data) {
                        emailForm.reset({
                          enabled: emailData.data.enabled || false,
                          provider: emailData.data.provider || 'smtp',
                          smtpHost: emailData.data.smtpHost || '',
                          smtpPort: emailData.data.smtpPort || 587,
                          smtpUser: emailData.data.smtpUser || '',
                          smtpPassword: '',
                          smtpRejectUnauthorized: emailData.data.smtpRejectUnauthorized !== false,
                          fromEmail: emailData.data.fromEmail || '',
                          fromName: emailData.data.fromName || '',
                          sendgridApiKey: '',
                          sesAccessKeyId: emailData.data.sesAccessKeyId || '',
                          sesSecretAccessKey: '',
                          sesRegion: emailData.data.sesRegion || 'us-east-1',
                          sesHost: emailData.data.sesHost || ''
                        });
                      }
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestEmail}
                    loading={testEmailMutation.isLoading}
                  >
                    Test Connection
                  </Button>
                  <Button type="submit" loading={updateEmailMutation.isLoading}>
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
    <ShadcnCard>
      <CardContent className="pt-6">
        <Alert variant="destructive">
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

  const configurationsTab = canManageOrganization ? (
    <ShadcnCard>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>POS & Checkout Configuration</CardTitle>
            <CardDescription>
              Configure receipt delivery, print format, and customer requirements for checkout
            </CardDescription>
          </div>
          {!loadingPOSConfig && !posConfigEditing && (
            <Button
              variant="secondaryStroke"
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
      </CardHeader>
      <CardContent>
        {loadingPOSConfig ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : posConfigEditing ? (
          <Form {...posConfigForm}>
            <form onSubmit={posConfigForm.handleSubmit(onPOSConfigSubmit)} className="space-y-6">
              <ShadcnCard className="border">
                <CardHeader>
                  <CardTitle className="text-base">Receipt Delivery</CardTitle>
                  <CardDescription>
                    Configure how receipts are sent or printed after a sale
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                          <FormLabel>Enable channels</FormLabel>
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
                </CardContent>
              </ShadcnCard>

              <ShadcnCard className="border">
                <CardHeader>
                  <CardTitle className="text-base">Print Format</CardTitle>
                  <CardDescription>
                    Receipt and invoice print layout. Thermal printers use black and white, no logo, small font.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={posConfigForm.control}
                    name="print.format"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Receipt/Invoice print format</FormLabel>
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
                </CardContent>
              </ShadcnCard>

              <ShadcnCard className="border">
                <CardHeader>
                  <CardTitle className="text-base">Customer at Checkout</CardTitle>
                  <CardDescription>
                    Require customer details before completing checkout
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={posConfigForm.control}
                    name="customer.phoneRequired"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
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
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
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
                </CardContent>
              </ShadcnCard>

              <Alert className="mb-4">
                <AlertDescription>
                  Ensure SMS, WhatsApp, and Email are configured in the Integration tab when using those channels.
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
          <div className="space-y-6">
            <ShadcnCard className="border">
              <CardHeader>
                <CardTitle className="text-base">Receipt Delivery</CardTitle>
              </CardHeader>
              <CardContent>
                <ShadcnDescriptions>
                  <DescriptionItem label="After sale">{modeLabels[configData?.receipt?.mode] || configData?.receipt?.mode || '—'}</DescriptionItem>
                  <DescriptionItem label="Enabled channels">
                    {(configData?.receipt?.channels || []).map((c) => channelLabels[c] || c).join(', ') || '—'}
                  </DescriptionItem>
                </ShadcnDescriptions>
              </CardContent>
            </ShadcnCard>
            <ShadcnCard className="border">
              <CardHeader>
                <CardTitle className="text-base">Print Format</CardTitle>
              </CardHeader>
              <CardContent>
                <ShadcnDescriptions>
                  <DescriptionItem label="Format">{formatLabels[configData?.print?.format] || configData?.print?.format || '—'}</DescriptionItem>
                </ShadcnDescriptions>
              </CardContent>
            </ShadcnCard>
            <ShadcnCard className="border">
              <CardHeader>
                <CardTitle className="text-base">Customer at Checkout</CardTitle>
              </CardHeader>
              <CardContent>
                <ShadcnDescriptions>
                  <DescriptionItem label="Require phone number">{configData?.customer?.phoneRequired ? 'Yes' : 'No'}</DescriptionItem>
                  <DescriptionItem label="Require customer name">{configData?.customer?.nameRequired ? 'Yes' : 'No'}</DescriptionItem>
                </ShadcnDescriptions>
              </CardContent>
            </ShadcnCard>
            <Alert>
              <AlertDescription>
                Ensure SMS, WhatsApp, and Email are configured in the Integration tab when using those channels.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </ShadcnCard>
  ) : (
    <ShadcnCard>
      <CardContent className="pt-6">
        <Alert variant="destructive">
          <AlertTitle>Access Restricted</AlertTitle>
          <AlertDescription>
            You need admin or manager permissions to configure POS settings.
          </AlertDescription>
        </Alert>
      </CardContent>
    </ShadcnCard>
  );

  const integrationTab = canManageOrganization ? (
    <ShadcnCard>
      <CardHeader>
        <CardTitle>Integration Settings</CardTitle>
        <CardDescription>
          Configure communication integrations for WhatsApp, SMS, and Email
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={integrationSubTab} onValueChange={(key) => {
          setIntegrationSubTab(key);
          setSearchParams({ tab: 'integration', subtab: key });
        }}>
          <TabsList className="overflow-x-auto w-full flex-nowrap">
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="sms">SMS</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
          </TabsList>
          <TabsContent value="whatsapp" className="mt-4">
            {whatsappTab}
          </TabsContent>
          <TabsContent value="sms" className="mt-4">
            {smsTab}
          </TabsContent>
          <TabsContent value="email" className="mt-4">
            {emailTab}
          </TabsContent>
        </Tabs>
      </CardContent>
    </ShadcnCard>
  ) : (
    <ShadcnCard>
      <CardContent className="pt-6">
        <Alert variant="destructive">
          <AlertTitle>Access Restricted</AlertTitle>
          <AlertDescription>
            You need admin or manager permissions to configure integration settings.
          </AlertDescription>
        </Alert>
      </CardContent>
    </ShadcnCard>
  );

  const pc = paymentCollectionData?.data ?? paymentCollectionData;
  const hasPaymentSubaccount = pc?.hasSubaccount === true;
  const banksList = Array.isArray(paymentCollectionBanks) ? paymentCollectionBanks : (paymentCollectionBanks?.data ?? []);

  const paymentsTab = canManageOrganization ? (
    <ShadcnCard>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Receive payments
        </CardTitle>
        <CardDescription>
          Link a bank account to receive your share of card and mobile money (MoMo) payments from invoice and POS. A small platform fee applies.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadingPaymentCollection ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : hasPaymentSubaccount ? (
          <div className="space-y-4">
            <Alert>
              <AlertTitle>Bank account linked</AlertTitle>
              <AlertDescription>
                Your share of Paystack payments is settled to your account. Business: {pc?.business_name || '—'}. Account: {pc?.account_number_masked || '—'}. Contact support to change.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <Form {...paymentCollectionForm}>
            <form onSubmit={paymentCollectionForm.handleSubmit(onPaymentCollectionSubmit)} className="space-y-4">
              <FormField
                control={paymentCollectionForm.control}
                name="business_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business / account name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Aseda Supermarket" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={paymentCollectionForm.control}
                name="bank_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bank *</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        const bank = banksList.find((b) => b.code === value);
                        if (bank) paymentCollectionForm.setValue('bank_name', bank.name || '');
                      }}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select bank" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {banksList.map((bank) => (
                          <SelectItem key={bank.code || bank.id} value={String(bank.code)}>
                            {bank.name || bank.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
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
              <FormField
                control={paymentCollectionForm.control}
                name="primary_contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact email (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="you@example.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={updatePaymentCollectionMutation.isPending}>
                {updatePaymentCollectionMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Linking…
                  </>
                ) : (
                  'Link bank account'
                )}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </ShadcnCard>
  ) : (
    <ShadcnCard>
      <CardContent className="pt-6">
        <Alert variant="destructive">
          <AlertTitle>Access Restricted</AlertTitle>
          <AlertDescription>
            You need admin or manager permissions to configure payment collection.
          </AlertDescription>
        </Alert>
      </CardContent>
    </ShadcnCard>
  );

  return (
    <div className="px-2 md:px-0">
      <div className="mb-4 md:mb-6">
        <h2 className="text-xl md:text-2xl font-semibold mb-1 md:mb-2">Settings</h2>
        <p className="text-xs md:text-sm text-muted-foreground">
          Manage your personal account, organization profile, and subscription information.
        </p>
      </div>

      {showOnboardingBanner && (
        <ShadcnCard className="mb-4 md:mb-6 border-[#166534] bg-green-50">
          <CardContent className="p-3 md:p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-foreground mb-1">Complete onboarding</h3>
                <p className="text-sm text-gray-600">
                  Finish setting up your business to get the most out of ShopWISE.
                </p>
              </div>
              <Button
                onClick={() => navigate('/onboarding')}
                className="shrink-0"
                style={{
                  backgroundColor: '#166534',
                  borderColor: '#166534',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#14532d';
                  e.currentTarget.style.borderColor = '#14532d';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#166534';
                  e.currentTarget.style.borderColor = '#166534';
                }}
              >
                Complete onboarding
              </Button>
            </div>
          </CardContent>
        </ShadcnCard>
      )}

      <Tabs value={activeTab} onValueChange={(key) => {
        setActiveTab(key);
        if (key === 'integration') {
          // When switching to integration tab, preserve current subtab or default to whatsapp
          const currentSubtab = searchParams.get('subtab') || 'whatsapp';
          setSearchParams({ tab: 'integration', subtab: currentSubtab });
        } else {
          setSearchParams({ tab: key });
        }
      }}>
        <TabsList className="overflow-x-auto w-full flex-nowrap mb-3 md:mb-4">
          <TabsTrigger value="profile" className="text-xs md:text-sm">Profile</TabsTrigger>
          <TabsTrigger value="appearance" className="text-xs md:text-sm">Appearance</TabsTrigger>
          <TabsTrigger value="organization" className="text-xs md:text-sm">Organization</TabsTrigger>
          <TabsTrigger value="subscription" className="text-xs md:text-sm">Subscription & Billing</TabsTrigger>
          <TabsTrigger value="configurations" className="text-xs md:text-sm">Configurations</TabsTrigger>
          <TabsTrigger value="payments" className="text-xs md:text-sm">Receive payments</TabsTrigger>
          <TabsTrigger value="integration" className="text-xs md:text-sm">Integration</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">{profileTab}</TabsContent>
        <TabsContent value="appearance">{appearanceTab}</TabsContent>
        <TabsContent value="organization">{organizationTab}</TabsContent>
        <TabsContent value="subscription">{subscriptionTab}</TabsContent>
        <TabsContent value="configurations">{configurationsTab}</TabsContent>
        <TabsContent value="payments">{paymentsTab}</TabsContent>
        <TabsContent value="integration">{integrationTab}</TabsContent>
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

