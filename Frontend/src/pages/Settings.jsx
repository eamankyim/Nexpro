import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  Row,
  Col,
  Descriptions,
  Upload,
  Form as AntdForm,
} from 'antd';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import settingsService from '../services/settingsService';
import whatsappService from '../services/whatsappService';
import { Camera, User, Mail, UserCog, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { showSuccess, showError } from '../utils/toast';
import StorageUsageCard from '../components/StorageUsageCard';
import SeatUsageCard from '../components/SeatUsageCard';
import PhoneNumberInput from '../components/PhoneNumberInput';
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
import { Descriptions as ShadcnDescriptions, DescriptionItem } from '@/components/ui/descriptions';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

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
});

const whatsappSchema = z.object({
  enabled: z.boolean().default(false),
  phoneNumberId: z.string().optional(),
  accessToken: z.string().optional(),
  businessAccountId: z.string().optional(),
  webhookVerifyToken: z.string().optional(),
  templateNamespace: z.string().optional(),
});

const Settings = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') || 'profile';
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  
  // Update tab when URL parameter changes
  useEffect(() => {
    const tab = searchParams.get('tab') || 'profile';
    setActiveTab(tab);
  }, [searchParams]);
  const [profilePreview, setProfilePreview] = useState('');
  const [profileEditing, setProfileEditing] = useState(false);
  const [organizationLogoPreview, setOrganizationLogoPreview] = useState('');
  const [organizationEditing, setOrganizationEditing] = useState(false);
  const { user, updateUser, activeTenant } = useAuth();
  const canManageOrganization = ['admin', 'manager'].includes(user?.role);

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

  const [subscriptionForm] = AntdForm.useForm();

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
        }
      });
      setOrganizationLogoPreview(organization.logoUrl || '');
      setOrganizationEditing(false);
    } else {
      setOrganizationLogoPreview('');
    }
  }, [organizationData, organizationForm]);

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
      
      subscriptionForm.setFieldsValue({
        plan: subscription.plan || 'free',
        status: subscription.status || 'active',
        seats: subscription.seats || 5,
        currentPeriodEnd: currentPeriodEnd,
        notes: subscription.notes || ''
      });
    }
  }, [subscriptionData, subscriptionForm]);
  
  // Watch for plan/status changes to auto-calculate trial period end
  const planValue = AntdForm.useWatch('plan', subscriptionForm);
  const statusValue = AntdForm.useWatch('status', subscriptionForm);
  
  useEffect(() => {
    if (!subscriptionForm) return;
    
    const isTrial = planValue === 'trial' || statusValue === 'trialing';
    const currentPeriodEnd = subscriptionForm.getFieldValue('currentPeriodEnd');
    
    // If trial/trialing and no currentPeriodEnd set, auto-calculate 30 days from now
    if (isTrial && !currentPeriodEnd) {
      subscriptionForm.setFieldsValue({
        currentPeriodEnd: dayjs().add(30, 'days')
      });
    }
  }, [planValue, statusValue, subscriptionForm]);

  const updateProfileMutation = useMutation({
    mutationFn: settingsService.updateProfile,
    onSuccess: (response) => {
      showSuccess('Profile updated successfully');
      queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      if (response?.data) {
        profileForm.setFieldsValue({
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
      if (response?.data) {
        organizationForm.setFieldsValue(response.data);
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
      }
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
    const values = whatsappForm.getFieldsValue();
    if (!values.accessToken || !values.phoneNumberId) {
      showError(null, 'Please provide Access Token and Phone Number ID to test connection');
      return;
    }
    testWhatsAppMutation.mutate({
      accessToken: values.accessToken,
      phoneNumberId: values.phoneNumberId
    });
  };

  const handleProfileImageUpload = async ({ file, onSuccess, onError }) => {
    try {
      console.log('[Profile Upload] Starting upload, file object:', file);
      
      // Ant Design Upload customRequest passes file object directly
      // The service will handle extracting the actual file
      const response = await settingsService.uploadProfilePicture(file);
      
      console.log('[Profile Upload] Response received:', response);
      
      // API interceptor returns response.data, so response is already the data object
      // Backend returns: { success: true, data: user }
      const updatedUser = response?.data || response;
      
      if (!updatedUser) {
        throw new Error('Invalid response from server');
      }

      const imageUrl = updatedUser.profilePicture || '';
      
      if (!imageUrl) {
        throw new Error('Upload succeeded but no image URL returned');
      }

      console.log('[Profile Upload] Image URL:', imageUrl.substring(0, 50) + '...');
      
      profileForm.setFieldsValue({ profilePicture: imageUrl });
      setProfilePreview(imageUrl);
      updateUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] });
      showSuccess('Profile picture updated successfully');
      if (onSuccess) onSuccess('ok');
    } catch (error) {
      console.error('[Profile Upload] Error:', error);
      console.error('[Profile Upload] Error response:', error?.response);
      const errMsg = error?.response?.data?.message || error?.message || 'Failed to upload profile picture';
      showError(error, errMsg);
      if (onError) onError(error);
    }
  };

  const handleOrganizationLogoUpload = async ({ file, onSuccess, onError }) => {
    try {
      const response = await settingsService.uploadOrganizationLogo(file);
      const result = response?.data || response;
      const organization = result?.data || result;
      organizationForm.setFieldsValue({ logoUrl: organization.logoUrl || '' });
      setOrganizationLogoPreview(organization.logoUrl || '');
      queryClient.invalidateQueries({ queryKey: ['settings', 'organization'] });
      showSuccess('Organization logo updated successfully');
      if (onSuccess) onSuccess('ok');
    } catch (error) {
      showError(error, 'Failed to upload organization logo. Please try again.');
      if (onError) onError(error);
    }
  };

  const subscriptionHistory = subscriptionData?.data?.history || [];

  const subscriptionSummary = useMemo(() => {
    if (!subscriptionData?.data) return null;
    const subscription = subscriptionData.data;
    const isTrialOrFree = subscription.plan === 'trial' || subscription.plan === 'free';
    return (
      <div style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Card bordered style={{ boxShadow: 'none' }}>
              <Title level={4} style={{ marginBottom: 0 }}>
                {subscription.plan?.toUpperCase() || 'FREE'}
              </Title>
              <Text type={subscription.status === 'active' ? 'success' : subscription.status === 'trialing' ? 'warning' : 'danger'}>
                {subscription.status?.toUpperCase()}
              </Text>
              {subscription.currentPeriodEnd && (
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">Renews</Text>
                  <div style={{ fontSize: 16, fontWeight: 500 }}>
                    {dayjs(subscription.currentPeriodEnd).format('MMM DD, YYYY')}
                  </div>
                </div>
              )}
              {isTrialOrFree && (
                <div style={{ marginTop: 16 }}>
                  <Button
                    type="primary"
                    block
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
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none',
                      fontWeight: 500
                    }}
                  >
                    Upgrade to Pro
                  </Button>
                </div>
              )}
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card bordered style={{ boxShadow: 'none' }}>
              <Text type="secondary">Notes</Text>
              <div style={{ marginTop: 12 }}>
                <Text>{subscription.notes || '—'}</Text>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    );
  }, [subscriptionData, navigate]);

  const profileTab = (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={16}>
        <Card
          title="Personal Information"
          loading={loadingProfile}
          style={{ boxShadow: 'none' }}
          extra={
            <div className="flex gap-2">
              <Button
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
                <Button onClick={profileForm.handleSubmit(onProfileSubmit)} disabled={updateProfileMutation.isLoading}>
                  {updateProfileMutation.isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save
                </Button>
              )}
            </div>
          }
        >
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
                <Avatar className="h-24 w-24">
                  {profilePreview && <AvatarImage src={profilePreview} alt="Profile" />}
                  <AvatarFallback><User className="h-8 w-8" /></AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    disabled={!profileEditing}
                    customRequest={handleProfileImageUpload}
                  >
                    <Button type="button" disabled={!profileEditing}>
                      <Camera className="h-4 w-4 mr-2" />
                      Upload New Photo
                    </Button>
                  </Upload>
                  {profilePreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={!profileEditing}
                      onClick={() => {
                        profileForm.setValue('profilePicture', '');
                        setProfilePreview('');
                      }}
                    >
                      Remove Photo
                    </Button>
                  )}
                  <p className="text-sm text-muted-foreground">Upload a square image (PNG/JPG) for best results.</p>
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
            </form>
          </Form>
        </Card>
      </Col>
      <Col xs={24} lg={8}>
        <Card title="Profile Visibility" style={{ boxShadow: 'none' }}>
          <Text type="secondary">This information is visible to your teammates.</Text>
          <Divider />
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Full Name">{profileData?.data?.name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Email">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {profileData?.data?.email || '—'}
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="Role">
              <div className="flex items-center gap-2">
                <UserCog className="h-4 w-4" />
                {profileData?.data?.role?.toUpperCase() || '—'}
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              {profileData?.data?.isActive ? 'Active' : 'Inactive'}
            </Descriptions.Item>
            <Descriptions.Item label="Member Since">
              {profileData?.data?.createdAt ? dayjs(profileData.data.createdAt).format('MMM DD, YYYY') : '—'}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </Col>
    </Row>
  );

  const organization = organizationData?.data || {};
  const organizationLogo = organizationLogoPreview || organization.logoUrl || '';

  const organizationTab = organizationEditing && canManageOrganization ? (
    <AntdForm
      form={organizationForm}
      layout="vertical"
      onFinish={handleOrganizationSubmit}
    >
      <Card
        title="Organization Profile"
        loading={loadingOrganization}
        style={{ boxShadow: 'none' }}
        extra={
          <div className="flex gap-2">
            <Button
              onClick={() => {
                organizationForm.resetFields();
                organizationForm.setFieldsValue(organization);
                setOrganizationLogoPreview(organization.logoUrl || '');
                setOrganizationEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button type="primary" onClick={() => organizationForm.submit()} loading={updateOrganizationMutation.isLoading}>
              Save
            </Button>
          </div>
        }
      >
        <Row gutter={16}>
          <Col span={12}>
            <AntdForm.Item
              name="name"
              label="Display Name"
              rules={[{ required: true, message: 'Organization name is required' }]}
            >
              <Input size="large" placeholder="Nexus Printing Press" />
            </AntdForm.Item>
          </Col>
          <Col span={12}>
            <AntdForm.Item
              name="legalName"
              label="Legal Name"
            >
              <Input size="large" placeholder="Legal registered name" />
            </AntdForm.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <AntdForm.Item
              name="email"
              label="Email"
              rules={[{ type: 'email', message: 'Enter a valid email' }]}
            >
              <Input size="large" placeholder="info@company.com" />
            </AntdForm.Item>
          </Col>
          <Col span={12}>
            <AntdForm.Item
              name="phone"
              label="Phone"
            >
              <PhoneNumberInput size="large" placeholder="Enter phone number" />
            </AntdForm.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <AntdForm.Item
              name="website"
              label="Website"
            >
              <Input size="large" placeholder="https://nexuspress.com" />
            </AntdForm.Item>
          </Col>
          <Col span={12}>
            <AntdForm.Item name="logoUrl" hidden>
              <Input type="hidden" />
            </AntdForm.Item>
          </Col>
        </Row>

        <Divider orientation="left">Branding</Divider>
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
                src={organizationLogoPreview || organization.logoUrl}
                alt="Organization logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }}
              />
            ) : (
              <Text type="secondary">No logo uploaded</Text>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Upload
              accept="image/*"
              showUploadList={false}
              customRequest={handleOrganizationLogoUpload}
            >
              <Button icon={<CameraOutlined />} type="primary">
                Upload Logo
              </Button>
            </Upload>
            {organizationLogoPreview && (
              <Button
                danger
                type="link"
                onClick={() => {
                  organizationForm.setFieldsValue({ logoUrl: '' });
                  setOrganizationLogoPreview('');
                }}
                style={{ padding: 0 }}
              >
                Remove Logo
              </Button>
            )}
            <Text type="secondary">Upload a high-resolution image for invoices and quotes.</Text>
          </div>
        </div>

        <Divider orientation="left">Address</Divider>
        <Row gutter={16}>
          <Col span={24}>
            <AntdForm.Item name={['address', 'line1']} label="Street Address">
              <Input size="large" placeholder="123 Printing Ave" />
            </AntdForm.Item>
          </Col>
          <Col span={24}>
            <AntdForm.Item name={['address', 'line2']} label="Address Line 2">
              <Input size="large" placeholder="Suite / Landmark" />
            </AntdForm.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={6}>
            <AntdForm.Item name={['address', 'city']} label="City">
              <Input size="large" />
            </AntdForm.Item>
          </Col>
          <Col span={6}>
            <AntdForm.Item name={['address', 'state']} label="State / Region">
              <Input size="large" />
            </AntdForm.Item>
          </Col>
          <Col span={6}>
            <AntdForm.Item name={['address', 'postalCode']} label="Postal Code">
              <Input size="large" />
            </AntdForm.Item>
          </Col>
          <Col span={6}>
            <AntdForm.Item name={['address', 'country']} label="Country">
              <Input size="large" placeholder="Ghana" />
            </AntdForm.Item>
          </Col>
        </Row>

        <Divider orientation="left">Tax & Compliance</Divider>
        <Row gutter={16}>
          <Col span={12}>
            <AntdForm.Item name={['tax', 'vatNumber']} label="VAT Number">
              <Input size="large" />
            </AntdForm.Item>
          </Col>
          <Col span={12}>
            <AntdForm.Item name={['tax', 'tin']} label="TIN">
              <Input size="large" />
            </AntdForm.Item>
          </Col>
        </Row>

        <AntdForm.Item name="invoiceFooter" label="Invoice & Quote Footer">
          <Input.TextArea rows={4} placeholder="Thank you for doing business with us." />
        </AntdForm.Item>
      </Card>
    </AntdForm>
  ) : (
    <Card
      title="Organization Profile"
      loading={loadingOrganization}
      style={{ boxShadow: 'none' }}
      extra={
        canManageOrganization
          ? (
              <Button
                type="primary"
                onClick={() => {
                  organizationForm.setFieldsValue(organization);
                  setOrganizationLogoPreview(organization.logoUrl || '');
                  setOrganizationEditing(true);
                }}
              >
                Edit Organization
              </Button>
            )
          : null
      }
    >
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="Display Name">{organization.name || '—'}</Descriptions.Item>
        <Descriptions.Item label="Legal Name">{organization.legalName || '—'}</Descriptions.Item>
        <Descriptions.Item label="Email">{organization.email || '—'}</Descriptions.Item>
        <Descriptions.Item label="Phone">{organization.phone || '—'}</Descriptions.Item>
        <Descriptions.Item label="Website">{organization.website || '—'}</Descriptions.Item>
      </Descriptions>

      <Divider orientation="left">Branding</Divider>
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
              src={organizationLogoPreview || organization.logoUrl}
              alt="Organization logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }}
            />
          ) : (
            <Text type="secondary">No logo uploaded</Text>
          )}
        </div>
        <div>
          <Text type="secondary">This logo is displayed on invoices and quotes.</Text>
        </div>
      </div>

      <Divider orientation="left">Address</Divider>
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="Street Address">{organization.address?.line1 || '—'}</Descriptions.Item>
        {organization.address?.line2 && (
          <Descriptions.Item label="Address Line 2">{organization.address.line2}</Descriptions.Item>
        )}
        <Descriptions.Item label="City">{organization.address?.city || '—'}</Descriptions.Item>
        <Descriptions.Item label="State / Region">{organization.address?.state || '—'}</Descriptions.Item>
        <Descriptions.Item label="Postal Code">{organization.address?.postalCode || '—'}</Descriptions.Item>
        <Descriptions.Item label="Country">{organization.address?.country || '—'}</Descriptions.Item>
      </Descriptions>

      <Divider orientation="left">Tax & Compliance</Divider>
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="VAT Number">
          {organization.tax?.vatNumber ? (
            organization.tax.vatNumber
          ) : (
            <div className="flex items-center gap-2">
              <Text type="secondary">Not set</Text>
              {canManageOrganization && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    organizationForm.setFieldsValue(organization);
                    setOrganizationLogoPreview(organization.logoUrl || '');
                    setOrganizationEditing(true);
                  }}
                >
                  Add VAT Number
                </Button>
              )}
            </div>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="TIN">
          {organization.tax?.tin ? (
            organization.tax.tin
          ) : (
            <div className="flex items-center gap-2">
              <Text type="secondary">Not set</Text>
              {canManageOrganization && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    organizationForm.setFieldsValue(organization);
                    setOrganizationLogoPreview(organization.logoUrl || '');
                    setOrganizationEditing(true);
                  }}
                >
                  Add TIN
                </Button>
              )}
            </div>
          )}
        </Descriptions.Item>
      </Descriptions>

      <Divider orientation="left">Invoice & Quote Footer</Divider>
      <Text>{organization.invoiceFooter || '—'}</Text>
    </Card>
  );

  const subscriptionTab = (
    <div>
      {subscriptionSummary}
      
      {/* Usage Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24}>
          <SeatUsageCard />
        </Col>
      </Row>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24}>
          <StorageUsageCard />
        </Col>
      </Row>

      <Card title="Subscription & Billing" loading={loadingSubscription} style={{ boxShadow: 'none' }}>
        <AntdForm
          form={subscriptionForm}
          layout="vertical"
          onFinish={handleSubscriptionSubmit}
        >
          <Row gutter={16}>
            <Col span={8}>
              <AntdForm.Item
                name="plan"
                label="Plan"
                rules={[{ required: true, message: 'Plan is required' }]}
              >
                <Input size="large" placeholder="free / pro / enterprise" />
              </AntdForm.Item>
            </Col>
            <Col span={8}>
              <AntdForm.Item
                name="status"
                label="Status"
                rules={[{ required: true, message: 'Status is required' }]}
              >
                <Input size="large" placeholder="active / paused / cancelled" />
              </AntdForm.Item>
            </Col>
            <Col span={8}>
              <AntdForm.Item
                name="seats"
                label="Seats"
                rules={[{ required: true, message: 'Seats count is required' }]}
              >
                <InputNumber min={1} size="large" style={{ width: '100%' }} />
              </AntdForm.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <AntdForm.Item
                name="currentPeriodEnd"
                label="Current Period Ends"
                tooltip={(planValue === 'trial' || statusValue === 'trialing') ? 'Automatically calculated as 30 days from today for trial plans' : undefined}
              >
                <DatePicker size="large" style={{ width: '100%' }} />
              </AntdForm.Item>
            </Col>
          </Row>

          <AntdForm.Item name="notes" label="Internal Notes">
            <Input.TextArea rows={4} placeholder="Add billing notes or context here" />
          </AntdForm.Item>

          {subscriptionHistory.length > 0 && (
            <>
              <Divider orientation="left">Billing History</Divider>
              {subscriptionHistory.map((entry, index) => (
                <div key={index} style={{ marginBottom: 12, padding: 16, border: '1px solid #f0f0f0', borderRadius: 8 }}>
                  <div className="flex flex-col gap-1">
                    <Text strong>{entry.description || 'Subscription change'}</Text>
                    <Text type="secondary">
                      {entry.date ? dayjs(entry.date).format('MMM DD, YYYY HH:mm') : '—'}
                    </Text>
                    {entry.amount && (
                      <Text>Amount: GHS {parseFloat(entry.amount).toFixed(2)}</Text>
                    )}
                    {entry.metadata && (
                      <Text type="secondary">Details: {JSON.stringify(entry.metadata)}</Text>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          <AntdForm.Item>
            <div className="flex gap-2">
              <Button type="primary" htmlType="submit" loading={updateSubscriptionMutation.isLoading}>
                Save Subscription
              </Button>
              <Button
                onClick={() => {
                  subscriptionForm.resetFields();
                  if (subscriptionData?.data) {
                    subscriptionForm.setFieldsValue({
                      ...subscriptionData.data,
                      currentPeriodEnd: subscriptionData.data.currentPeriodEnd
                        ? dayjs(subscriptionData.data.currentPeriodEnd)
                        : null
                    });
                  }
                }}
              >
                Reset
              </Button>
            </div>
          </AntdForm.Item>
        </AntdForm>
      </Card>

    </div>
  );

  const whatsappTab = canManageOrganization ? (
    <Card title="WhatsApp Business API Configuration" loading={loadingWhatsApp} style={{ boxShadow: 'none' }}>
      <Alert
        message="WhatsApp Integration"
        description="Configure WhatsApp Business API to send automated notifications to customers. You'll need to set up a WhatsApp Business Account in Meta Business Manager first."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <AntdForm
        form={whatsappForm}
        layout="vertical"
        onFinish={handleWhatsAppSubmit}
      >
        <AntdForm.Item
          name="enabled"
          valuePropName="checked"
        >
          <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
        </AntdForm.Item>

        <Row gutter={16}>
          <Col span={12}>
            <AntdForm.Item
              name="phoneNumberId"
              label="Phone Number ID"
              tooltip="Your WhatsApp Business Phone Number ID from Meta Business Manager"
              rules={[
                { required: true, message: 'Phone Number ID is required when enabled' }
              ]}
            >
              <Input size="large" placeholder="e.g., 123456789012345" />
            </AntdForm.Item>
          </Col>
          <Col span={12}>
            <AntdForm.Item
              name="businessAccountId"
              label="Business Account ID"
              tooltip="Your Meta Business Account ID (optional)"
            >
              <Input size="large" placeholder="e.g., 123456789012345" />
            </AntdForm.Item>
          </Col>
        </Row>

        <AntdForm.Item
          name="accessToken"
          label="Access Token"
          tooltip="Your WhatsApp Business API Access Token (keep this secure)"
        >
          <Input.Password size="large" placeholder="Enter access token" />
        </AntdForm.Item>

        <Row gutter={16}>
          <Col span={12}>
            <AntdForm.Item
              name="webhookVerifyToken"
              label="Webhook Verify Token"
              tooltip="Token for webhook verification (set this in Meta Business Manager)"
            >
              <Input size="large" placeholder="Your verify token" />
            </AntdForm.Item>
          </Col>
          <Col span={12}>
            <AntdForm.Item
              name="templateNamespace"
              label="Template Namespace"
              tooltip="Optional template namespace"
            >
              <Input size="large" placeholder="Optional" />
            </AntdForm.Item>
          </Col>
        </Row>

        <AntdForm.Item>
          <div className="flex gap-2">
            <Button type="primary" htmlType="submit" loading={updateWhatsAppMutation.isLoading}>
              Save Settings
            </Button>
            <Button
              onClick={handleTestWhatsApp}
              loading={testWhatsAppMutation.isLoading}
            >
              Test Connection
            </Button>
            <Button
              onClick={() => {
                whatsappForm.resetFields();
                if (whatsappData?.data) {
                  whatsappForm.setFieldsValue({
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
          </div>
        </AntdForm.Item>
      </AntdForm>

      <Divider orientation="left">Message Templates</Divider>
      <Alert
        message="Template Setup Required"
        description="You need to create and approve the following message templates in Meta Business Manager before they can be used: invoice_notification, quote_delivery, order_confirmation, payment_reminder, low_stock_alert"
        type="warning"
        showIcon
        style={{ marginTop: 16 }}
      />
    </Card>
  ) : (
    <Card>
      <Alert
        message="Access Restricted"
        description="You need admin or manager permissions to configure WhatsApp settings."
        type="warning"
      />
    </Card>
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
      shop: 'Optimized for inventory, POS, and sales',
      printing_press: 'Optimized for print jobs, quotes, and production workflows',
      pharmacy: 'Optimized for prescriptions, drug inventory, and patient records'
    };
    return descriptions[businessType] || descriptions.printing_press;
  };

  const workspaceType = activeTenant?.businessType || 'printing_press';
  const workspaceTypeDisplay = getWorkspaceTypeDisplay(workspaceType);
  const workspaceDescription = getWorkspaceDescription(workspaceType);

  const workspaceTab = (
    <ShadcnCard>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>
          Your workspace type and configuration. This cannot be changed after signup.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-500">Workspace Type</Label>
            <div className="mt-2">
              <div className="text-lg font-semibold text-gray-900">{workspaceTypeDisplay}</div>
              <p className="text-sm text-gray-600 mt-1">{workspaceDescription}</p>
            </div>
          </div>
        </div>
        <Separator />
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Workspace Actions</h3>
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              onClick={() => {
                // Future feature: Add another workspace
                showError(null, 'This feature is coming soon. Contact support for assistance.');
              }}
              className="w-full sm:w-auto"
            >
              Add another workspace
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                window.open('mailto:support@nexpro.com?subject=Workspace Inquiry', '_blank');
              }}
              className="w-full sm:w-auto"
            >
              Contact support
            </Button>
          </div>
        </div>
      </CardContent>
    </ShadcnCard>
  );

  const tabItems = [
    {
      key: 'workspace',
      label: 'Workspace',
      children: workspaceTab
    },
    {
      label: 'Profile',
      children: profileTab
    },
    {
      key: 'organization',
      label: 'Organization',
      children: organizationTab
    },
    {
      key: 'subscription',
      label: 'Subscription & Billing',
      children: subscriptionTab
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      children: whatsappTab
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Settings</Title>
        <Text type="secondary">
          Manage your personal account, organization profile, and subscription information.
        </Text>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key);
          setSearchParams({ tab: key });
        }}
        items={tabItems}
      />
    </div>
  );
};

export default Settings;

