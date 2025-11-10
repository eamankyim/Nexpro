import { useEffect, useMemo, useState } from 'react';
import {
  Tabs,
  Card,
  Form,
  Input,
  Button,
  Row,
  Col,
  Space,
  Typography,
  Divider,
  message,
  DatePicker,
  InputNumber,
  Alert,
  Upload,
  Avatar,
  Descriptions
} from 'antd';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import settingsService from '../services/settingsService';
import { CameraOutlined, UserOutlined, MailOutlined, UserSwitchOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

const Settings = () => {
  const [profileForm] = Form.useForm();
  const [organizationForm] = Form.useForm();
  const [subscriptionForm] = Form.useForm();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');
  const [profilePreview, setProfilePreview] = useState('');
  const [profileEditing, setProfileEditing] = useState(false);
  const [organizationLogoPreview, setOrganizationLogoPreview] = useState('');
  const [organizationEditing, setOrganizationEditing] = useState(false);
  const { user, updateUser } = useAuth();
  const canManageOrganization = ['admin', 'manager'].includes(user?.role);

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

  useEffect(() => {
    if (profileData?.data) {
      profileForm.setFieldsValue({
        name: profileData.data.name,
        email: profileData.data.email,
        profilePicture: profileData.data.profilePicture || ''
      });
      setProfilePreview(profileData.data.profilePicture || '');
      setProfileEditing(false);
    }
  }, [profileData, profileForm]);

  useEffect(() => {
    if (organizationData?.data) {
      const organization = organizationData.data;
      organizationForm.setFieldsValue({
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
    if (subscriptionData?.data) {
      const subscription = subscriptionData.data;
      subscriptionForm.setFieldsValue({
        plan: subscription.plan || 'free',
        status: subscription.status || 'active',
        seats: subscription.seats || 5,
        currentPeriodEnd: subscription.currentPeriodEnd ? dayjs(subscription.currentPeriodEnd) : null,
        paymentMethod: subscription.paymentMethod || {
          brand: '',
          last4: '',
          expMonth: '',
          expYear: ''
        },
        notes: subscription.notes || ''
      });
    }
  }, [subscriptionData, subscriptionForm]);

  const updateProfileMutation = useMutation({
    mutationFn: settingsService.updateProfile,
    onSuccess: (response) => {
      message.success('Profile updated');
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
      message.error(errMsg);
    }
  });

  const updateOrganizationMutation = useMutation({
    mutationFn: settingsService.updateOrganization,
    onSuccess: (response) => {
      message.success('Organization settings saved');
      queryClient.invalidateQueries({ queryKey: ['settings', 'organization'] });
      if (response?.data) {
        organizationForm.setFieldsValue(response.data);
        setOrganizationLogoPreview(response.data.logoUrl || '');
      }
      setOrganizationEditing(false);
    },
    onError: (error) => {
      const errMsg = error?.response?.data?.message || 'Failed to update organization settings';
      message.error(errMsg);
    }
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: settingsService.updateSubscription,
    onSuccess: () => {
      message.success('Subscription settings saved');
      queryClient.invalidateQueries({ queryKey: ['settings', 'subscription'] });
    },
    onError: (error) => {
      const errMsg = error?.response?.data?.message || 'Failed to update subscription settings';
      message.error(errMsg);
    }
  });

  const handleProfileSubmit = (values) => {
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

  const handleOrganizationSubmit = (values) => {
    const payload = {
      name: values.name || '',
      legalName: values.legalName || '',
      email: values.email || '',
      phone: values.phone || '',
      website: values.website || '',
      logoUrl: values.logoUrl || '',
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

  const handleSubscriptionSubmit = (values) => {
    const payload = {
      plan: values.plan,
      status: values.status,
      seats: values.seats,
      currentPeriodEnd: values.currentPeriodEnd ? values.currentPeriodEnd.toISOString() : null,
      paymentMethod: values.paymentMethod,
      notes: values.notes || ''
    };

    updateSubscriptionMutation.mutate(payload);
  };

  const handleProfileImageUpload = async ({ file, onSuccess, onError }) => {
    try {
      const response = await settingsService.uploadProfilePicture(file);
      const result = response?.data || response;
      const updatedUser = result?.data || result;
      const imageUrl = updatedUser?.profilePicture || '';
      profileForm.setFieldsValue({ profilePicture: imageUrl });
      setProfilePreview(imageUrl);
      updateUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] });
      message.success('Profile picture updated');
      if (onSuccess) onSuccess('ok');
    } catch (error) {
      const errMsg = error?.response?.data?.message || 'Failed to upload profile picture';
      message.error(errMsg);
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
      message.success('Organization logo updated');
      if (onSuccess) onSuccess('ok');
    } catch (error) {
      const errMsg = error?.response?.data?.message || 'Failed to upload organization logo';
      message.error(errMsg);
      if (onError) onError(error);
    }
  };

  const subscriptionHistory = subscriptionData?.data?.history || [];

  const subscriptionSummary = useMemo(() => {
    if (!subscriptionData?.data) return null;
    const subscription = subscriptionData.data;
    return (
      <div style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Card bordered style={{ boxShadow: 'none' }}>
              <Title level={4} style={{ marginBottom: 0 }}>
                {subscription.plan?.toUpperCase() || 'FREE'}
              </Title>
              <Text type={subscription.status === 'active' ? 'success' : 'danger'}>
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
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card bordered style={{ boxShadow: 'none' }}>
              <Text type="secondary">Payment Method</Text>
              <div style={{ marginTop: 12 }}>
                {subscription.paymentMethod ? (
                  <div>
                    <div style={{ fontWeight: 500 }}>
                      {subscription.paymentMethod.brand?.toUpperCase() || 'CARD'} ••••{' '}
                      {subscription.paymentMethod.last4 || '0000'}
                    </div>
                    <Text type="secondary">
                      Expires {subscription.paymentMethod.expMonth}/{subscription.paymentMethod.expYear}
                    </Text>
                  </div>
                ) : (
                  <Text type="warning">No payment method on file</Text>
                )}
              </div>
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
  }, [subscriptionData]);

  const profileTab = (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={16}>
        <Card
          title="Personal Information"
          loading={loadingProfile}
          style={{ boxShadow: 'none' }}
          extra={
            <Space>
              <Button
                onClick={() => {
                  if (profileEditing) {
                    profileForm.resetFields();
                    if (profileData?.data) {
                      profileForm.setFieldsValue({
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
                <Button type="primary" onClick={() => profileForm.submit()} loading={updateProfileMutation.isLoading}>
                  Save
                </Button>
              )}
            </Space>
          }
        >
          <Form
            form={profileForm}
            layout="vertical"
            onFinish={handleProfileSubmit}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="name"
                  label="Full Name"
                  rules={[{ required: true, message: 'Please enter your name' }]}
                >
                  <Input size="large" placeholder="Enter your full name" disabled={!profileEditing} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="email"
                  label="Email"
                >
                  <Input size="large" disabled />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="profilePicture" hidden>
              <Input type="hidden" />
            </Form.Item>

            <Divider orientation="left">Profile Picture</Divider>
            <Space align="center" size="large" style={{ marginBottom: 24 }}>
              <Avatar
                size={96}
                src={profilePreview}
                icon={<UserOutlined />}
                style={{ backgroundColor: '#f0f0f0' }}
              />
              <Space direction="vertical" size={8}>
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  disabled={!profileEditing}
                  customRequest={handleProfileImageUpload}
                >
                  <Button icon={<CameraOutlined />} type="primary" disabled={!profileEditing}>
                    Upload New Photo
                  </Button>
                </Upload>
                {profilePreview && (
                  <Button
                    danger
                    type="link"
                    disabled={!profileEditing}
                    onClick={() => {
                      profileForm.setFieldsValue({ profilePicture: '' });
                      setProfilePreview('');
                    }}
                    style={{ padding: 0 }}
                  >
                    Remove Photo
                  </Button>
                )}
                <Text type="secondary">Upload a square image (PNG/JPG) for best results.</Text>
              </Space>
            </Space>

            <Divider orientation="left">Change Password</Divider>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="currentPassword"
                  label="Current Password"
                  rules={[
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!getFieldValue('newPassword') || value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('Enter current password to set a new password'));
                      }
                    })
                  ]}
                >
                  <Input.Password size="large" placeholder="Enter current password" disabled={!profileEditing} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="newPassword"
                  label="New Password"
                  rules={[
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || (value && getFieldValue('currentPassword'))) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('Enter your current password to change password'));
                      }
                    })
                  ]}
                >
                  <Input.Password size="large" placeholder="Enter new password" disabled={!profileEditing} />
                </Form.Item>
              </Col>
            </Row>
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
              <Space size="small">
                <MailOutlined />
                {profileData?.data?.email || '—'}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Role">
              <Space size="small">
                <UserSwitchOutlined />
                {profileData?.data?.role?.toUpperCase() || '—'}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              {profileData?.data?.isActive ? 'Active' : 'Inactive'}
            </Descriptions.Item>
            <Descriptions.Item label="Member Since">
              {profileData?.data?.createdAt ? dayjs(profileData.data.createdAt).format('MMM DD, YYYY') : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Last Login">
              {profileData?.data?.lastLogin ? dayjs(profileData.data.lastLogin).format('MMM DD, YYYY HH:mm') : '—'}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </Col>
    </Row>
  );

  const organization = organizationData?.data || {};
  const organizationLogo = organizationLogoPreview || organization.logoUrl || '';

  const organizationTab = organizationEditing && canManageOrganization ? (
    <Form
      form={organizationForm}
      layout="vertical"
      onFinish={handleOrganizationSubmit}
    >
      <Card
        title="Organization Profile"
        loading={loadingOrganization}
        style={{ boxShadow: 'none' }}
        extra={
          <Space>
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
          </Space>
        }
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="name"
              label="Display Name"
              rules={[{ required: true, message: 'Organization name is required' }]}
            >
              <Input size="large" placeholder="Nexus Printing Press" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="legalName"
              label="Legal Name"
            >
              <Input size="large" placeholder="Legal registered name" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="email"
              label="Email"
              rules={[{ type: 'email', message: 'Enter a valid email' }]}
            >
              <Input size="large" placeholder="info@company.com" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="phone"
              label="Phone"
            >
              <Input size="large" placeholder="+233 000 000 000" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="website"
              label="Website"
            >
              <Input size="large" placeholder="https://nexuspress.com" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="logoUrl" hidden>
              <Input type="hidden" />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left">Branding</Divider>
        <Space align="center" size="large" style={{ marginBottom: 24 }}>
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
          <Space direction="vertical" size={8}>
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
          </Space>
        </Space>

        <Divider orientation="left">Address</Divider>
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item name={['address', 'line1']} label="Street Address">
              <Input size="large" placeholder="123 Printing Ave" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name={['address', 'line2']} label="Address Line 2">
              <Input size="large" placeholder="Suite / Landmark" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name={['address', 'city']} label="City">
              <Input size="large" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name={['address', 'state']} label="State / Region">
              <Input size="large" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name={['address', 'postalCode']} label="Postal Code">
              <Input size="large" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name={['address', 'country']} label="Country">
              <Input size="large" placeholder="Ghana" />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left">Tax & Compliance</Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name={['tax', 'vatNumber']} label="VAT Number">
              <Input size="large" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name={['tax', 'tin']} label="TIN">
              <Input size="large" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="invoiceFooter" label="Invoice & Quote Footer">
          <Input.TextArea rows={4} placeholder="Thank you for doing business with us." />
        </Form.Item>
      </Card>
    </Form>
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
      <Space align="center" size="large" style={{ marginBottom: 24 }}>
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
      </Space>

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
        <Descriptions.Item label="VAT Number">{organization.tax?.vatNumber || '—'}</Descriptions.Item>
        <Descriptions.Item label="TIN">{organization.tax?.tin || '—'}</Descriptions.Item>
      </Descriptions>

      <Divider orientation="left">Invoice & Quote Footer</Divider>
      <Text>{organization.invoiceFooter || '—'}</Text>
    </Card>
  );

  const subscriptionTab = (
    <div>
      {subscriptionSummary}
      <Card title="Subscription & Billing" loading={loadingSubscription} style={{ boxShadow: 'none' }}>
        <Form
          form={subscriptionForm}
          layout="vertical"
          onFinish={handleSubscriptionSubmit}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="plan"
                label="Plan"
                rules={[{ required: true, message: 'Plan is required' }]}
              >
                <Input size="large" placeholder="free / pro / enterprise" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="status"
                label="Status"
                rules={[{ required: true, message: 'Status is required' }]}
              >
                <Input size="large" placeholder="active / paused / cancelled" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="seats"
                label="Seats"
                rules={[{ required: true, message: 'Seats count is required' }]}
              >
                <InputNumber min={1} size="large" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="currentPeriodEnd"
                label="Current Period Ends"
              >
                <DatePicker size="large" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['paymentMethod', 'brand']}
                label="Payment Method Brand"
              >
                <Input size="large" placeholder="Visa" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name={['paymentMethod', 'last4']}
                label="Last 4 Digits"
              >
                <Input size="large" placeholder="1234" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name={['paymentMethod', 'expMonth']}
                label="Exp Month"
              >
                <Input size="large" placeholder="09" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name={['paymentMethod', 'expYear']}
                label="Exp Year"
              >
                <Input size="large" placeholder="2026" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Internal Notes">
            <Input.TextArea rows={4} placeholder="Add billing notes or context here" />
          </Form.Item>

          {subscriptionHistory.length > 0 && (
            <>
              <Divider orientation="left">Billing History</Divider>
              {subscriptionHistory.map((entry, index) => (
                <div key={index} style={{ marginBottom: 12, padding: 16, border: '1px solid #f0f0f0', borderRadius: 8 }}>
                  <Space direction="vertical" size={4}>
                    <Text strong>{entry.description || 'Subscription change'}</Text>
                    <Text type="secondary">
                      {entry.date ? dayjs(entry.date).format('MMM DD, YYYY HH:mm') : '—'}
                    </Text>
                    {entry.amount && (
                      <Text>Amount: ₵{parseFloat(entry.amount).toFixed(2)}</Text>
                    )}
                    {entry.metadata && (
                      <Text type="secondary">Details: {JSON.stringify(entry.metadata)}</Text>
                    )}
                  </Space>
                </div>
              ))}
            </>
          )}

          <Form.Item>
            <Space>
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
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Alert
        style={{ marginTop: 16 }}
        message="Note"
        description="Subscription updates here will change what the team sees in-app. Integration with an external billing provider (Stripe, Paystack, etc.) can replace this manual control later."
        type="info"
        showIcon
      />
    </div>
  );

  const tabItems = [
    {
      key: 'profile',
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
        onChange={setActiveTab}
        items={tabItems}
      />
    </div>
  );
};

export default Settings;

