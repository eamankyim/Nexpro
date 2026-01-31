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
import { Camera, User, Mail, UserCog, Loader2, Eye, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
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
import { SHOP_TYPE_LABELS } from '../constants';

const profileSchema = z.object({
  name: z.string().min(1, 'Please enter your name'),
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
  message: 'Enter current password to set a new password',
  path: ['currentPassword'],
});

const organizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  legalName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  logoUrl: z.string().optional(),
  invoiceFooter: z.string().optional(),
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
  const [profilePreviewVisible, setProfilePreviewVisible] = useState(false);
  const [profileUploading, setProfileUploading] = useState(false);
  const [organizationLogoPreview, setOrganizationLogoPreview] = useState('');
  const [organizationEditing, setOrganizationEditing] = useState(false);
  const [organizationLogoPreviewVisible, setOrganizationLogoPreviewVisible] = useState(false);
  const [organizationLogoUploading, setOrganizationLogoUploading] = useState(false);
  const [seatUsage, setSeatUsage] = useState(null);
  const [storageUsage, setStorageUsage] = useState(null);
  const [loadingUsage, setLoadingUsage] = useState(true);
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
          profilePicture: response.data.profilePicture || ''
        });
        setProfilePreview(response.data.profilePicture || '');
        updateUser(response.data);
        setProfileEditing(false);
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
      <div className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ShadcnCard>
            <CardContent className="pt-6">
              <h4 className="text-lg font-semibold mb-2">
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
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Notes</p>
              <div className="mt-3">
                <p>{subscription.notes || '—'}</p>
              </div>
            </CardContent>
          </ShadcnCard>
        </div>
      </div>
    );
  }, [subscriptionData, navigate]);

  const profileTab = (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <ShadcnCard>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Personal Information</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (profileEditing) {
                      if (profileData?.data) {
                        profileForm.reset({
                          name: profileData.data.name,
                          email: profileData.data.email,
                          profilePicture: profileData.data.profilePicture || ''
                        });
                        setProfilePreview(profileData.data.profilePicture || '');
                      }
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
          <CardContent>
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
              <h3 className="text-lg font-semibold mb-4">Profile Picture</h3>
              <div className="flex items-center gap-6 mb-6">
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
                    className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 cursor-pointer hover:bg-primary/90 border-2 border-background shadow-sm"
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
              <h3 className="text-lg font-semibold mb-4">Change Password</h3>

              <div className="grid grid-cols-2 gap-4">
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
              </div>

              <Separator />
              <h3 className="text-lg font-semibold mb-4">Account Information</h3>
              <div className="grid grid-cols-2 gap-4">
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

  const organization = organizationData?.data || {};
  const organizationLogo = organizationLogoPreview || organization.logoUrl || '';

  // Mock invoice data for preview
  const mockInvoice = useMemo(() => ({
    invoiceNumber: 'INV-2024-001',
    invoiceDate: new Date(),
    dueDate: dayjs().add(30, 'days').toDate(),
    customer: {
      name: 'Sample Customer',
      company: 'Sample Company Ltd.',
      email: 'customer@example.com',
      phone: '+233 XX XXX XXXX',
      address: '123 Sample Street',
      city: 'Sample City',
      state: 'Sample State',
      zipCode: 'SAMPLE-123'
    },
    items: [
      {
        description: 'Sample Product/Service 1',
        quantity: 2,
        unitPrice: 100.00,
        total: 200.00
      },
      {
        description: 'Sample Product/Service 2',
        quantity: 1,
        unitPrice: 150.00,
        total: 150.00
      }
    ],
    subtotal: 350.00,
    taxRate: 12.5,
    taxAmount: 43.75,
    discountAmount: 0,
    totalAmount: 393.75,
    balance: 393.75,
    paymentTerms: 'Net 30',
    termsAndConditions: 'Payment is due within 30 days of invoice date.'
  }), []);

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
      printing_press: 'Optimized for print jobs, quotes, and production workflows',
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
      <CardContent>
        <Form {...organizationForm}>
          <form onSubmit={organizationForm.handleSubmit(onOrganizationSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={organizationForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Nexus Printing Press" {...field} />
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
                    <FormLabel>Legal Name</FormLabel>
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
                    <FormLabel>Email</FormLabel>
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
                    <FormLabel>Phone</FormLabel>
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
                    <FormLabel>Website</FormLabel>
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
                    <FormLabel>Shop type</FormLabel>
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

        <Separator className="my-6">
          <span className="text-sm font-medium">Branding</span>
        </Separator>
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

        <Separator className="my-6">
          <span className="text-sm font-medium">Address</span>
        </Separator>
        <div className="space-y-4">
          <FormField
            control={organizationForm.control}
            name="address.line1"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Street Address</FormLabel>
                <FormControl>
                  <Input placeholder="123 Printing Ave" {...field} />
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
                <FormLabel>Address Line 2</FormLabel>
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
                <FormLabel>City</FormLabel>
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
                <FormLabel>State / Region</FormLabel>
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
                <FormLabel>Postal Code</FormLabel>
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
                <FormLabel>Country</FormLabel>
                <FormControl>
                  <Input placeholder="Ghana" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator className="my-6">
          <span className="text-sm font-medium">Tax & Compliance</span>
        </Separator>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={organizationForm.control}
            name="tax.vatNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>VAT Number</FormLabel>
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
                <FormLabel>TIN</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={organizationForm.control}
          name="invoiceFooter"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Invoice & Quote Footer</FormLabel>
              <FormControl>
                <Textarea rows={4} placeholder="Thank you for doing business with us." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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

      <Separator className="my-6">
        <span className="text-sm font-medium">Branding</span>
      </Separator>
      <div className="flex items-center gap-6 mb-6">
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

      <Separator className="my-6">
        <span className="text-sm font-medium">Address</span>
      </Separator>
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

      <Separator className="my-6">
        <span className="text-sm font-medium">Tax & Compliance</span>
      </Separator>
      <ShadcnDescriptions>
        <DescriptionItem label="VAT Number">{organization.tax?.vatNumber || 'Not set'}</DescriptionItem>
        <DescriptionItem label="TIN">{organization.tax?.tin || 'Not set'}</DescriptionItem>
      </ShadcnDescriptions>

      <Separator className="my-6">
        <span className="text-sm font-medium">Invoice & Quote Footer</span>
      </Separator>
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

      <Separator className="my-6">
        <span className="text-sm font-medium">Invoice Preview</span>
      </Separator>
      <div className="mb-6">
        <p className="text-sm text-muted-foreground mb-4">
          Preview how your invoice will look with your current branding
        </p>
        <div className="border rounded-lg p-4 bg-white" style={{ maxHeight: '800px', overflow: 'auto' }}>
          <PrintableInvoice
            invoice={mockInvoice}
            organization={{
              ...organization,
              logoUrl: organizationLogo || organization.logoUrl
            }}
          />
        </div>
      </div>

      <Separator className="my-6">
        <span className="text-sm font-medium">Workspace</span>
      </Separator>
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Workspace Type</Label>
          <div className="mt-2">
            <div className="text-base font-semibold">{workspaceTypeDisplay}</div>
            <p className="text-sm text-muted-foreground mt-1">{workspaceDescription}</p>
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Workspace Actions</h3>
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              onClick={() => {
                showError(null, 'This feature is coming soon. Contact support for assistance.');
              }}
              className="w-full sm:w-auto"
            >
              Add another workspace
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                window.open('mailto:support@shopwise.com?subject=Workspace Inquiry', '_blank');
              }}
              className="w-full sm:w-auto"
            >
              Contact support
            </Button>
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
                  <span className="font-bold text-black" style={{ fontSize: '14px' }}>{seatUsage.current}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground" style={{ fontSize: '14px' }}>Total Seats</span>
                  <span className="font-bold text-black" style={{ fontSize: '14px' }}>{seatUsage.isUnlimited ? 'Unlimited' : `${seatUsage.limit} seats`}</span>
                </div>
                {!seatUsage.isUnlimited && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground" style={{ fontSize: '14px' }}>Available</span>
                      <span className="font-bold text-black" style={{ fontSize: '14px' }}>{seatUsage.remaining} seats</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground" style={{ fontSize: '14px' }}>Seat Usage</span>
                        <span className="font-bold text-black" style={{ fontSize: '14px' }}>{seatUsage.current} of {seatUsage.limit} ({seatUsage.percentageUsed}%)</span>
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
                  <span className="font-bold text-black" style={{ fontSize: '14px' }}>{parseFloat(storageUsage.currentGB || 0).toFixed(2)} GB</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground" style={{ fontSize: '14px' }}>Total Limit</span>
                  <span className="font-bold text-black" style={{ fontSize: '14px' }}>{storageUsage.isUnlimited ? 'Unlimited' : `${storageUsage.limitGB} GB`}</span>
                </div>
                {!storageUsage.isUnlimited && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground" style={{ fontSize: '14px' }}>Available</span>
                      <span className="font-bold text-black" style={{ fontSize: '14px' }}>{parseFloat(storageUsage.remainingGB || 0).toFixed(2)} GB</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground" style={{ fontSize: '14px' }}>Storage Usage</span>
                        <span className="font-bold text-black" style={{ fontSize: '14px' }}>{storageUsage.currentGB} GB of {storageUsage.limitGB} GB ({storageUsage.percentageUsed}%)</span>
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
                            <p>Amount: GHS {parseFloat(entry.amount).toFixed(2)}</p>
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
                You need to create and approve the following message templates in Meta Business Manager before they can be used: invoice_notification, quote_delivery, order_confirmation, payment_reminder, low_stock_alert
              </AlertDescription>
            </Alert>
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
          <TabsList>
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

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage your personal account, organization profile, and subscription information.
        </p>
      </div>

      {showOnboardingBanner && (
        <ShadcnCard className="mb-6 border-[#166534] bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Complete onboarding</h3>
                <p className="text-sm text-gray-600">
                  Finish setting up your workspace to get the most out of ShopWISE.
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
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="subscription">Subscription & Billing</TabsTrigger>
          <TabsTrigger value="integration">Integration</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">{profileTab}</TabsContent>
        <TabsContent value="organization">{organizationTab}</TabsContent>
        <TabsContent value="subscription">{subscriptionTab}</TabsContent>
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

