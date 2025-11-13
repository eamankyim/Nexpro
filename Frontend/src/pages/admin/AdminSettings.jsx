import { useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Tabs,
  Switch,
  message,
  Typography,
  Table,
  Modal,
  Upload,
  Space,
  Row,
  Col,
  Tag,
  Popconfirm,
  InputNumber,
  Alert,
  Collapse,
  Checkbox,
  Divider,
} from 'antd';
import { UploadOutlined, EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import adminService from '../../services/adminService';

const { Text } = Typography;

const defaultFormValues = {
  branding: {},
  featureFlags: {},
  communications: {},
};

const AdminSettings = () => {
  const [form] = Form.useForm();
  const [adminForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState([]);
  const [adminModalVisible, setAdminModalVisible] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [adminSaving, setAdminSaving] = useState(false);
  const [brandingLogoPreview, setBrandingLogoPreview] = useState('');
  
  // Subscription Plans state
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm] = Form.useForm();
  
  // Feature Catalog state (legacy)
  const [featureCatalog, setFeatureCatalog] = useState([]);
  const [featureCategories, setFeatureCategories] = useState({});
  const [featuresByCategory, setFeaturesByCategory] = useState({});
  
  // Modules state (new)
  const [modules, setModules] = useState([]);
  const [allFeatures, setAllFeatures] = useState([]);

  const loadPlatformSettings = async () => {
    setLoading(true);
    try {
      const response = await adminService.getPlatformSettings();
      if (response?.success) {
        const {
          'platform:branding': branding = {},
          'platform:featureFlags': featureFlags = {},
          'platform:communications': communications = {},
        } = response.data || {};
        form.setFieldsValue({
          branding,
          featureFlags,
          communications,
        });
        setBrandingLogoPreview(branding.logoUrl || '');
      } else {
        form.setFieldsValue(defaultFormValues);
        setBrandingLogoPreview('');
      }
    } catch (error) {
      console.error('Failed to load platform settings', error);
      message.error('Failed to load settings');
      form.setFieldsValue(defaultFormValues);
      setBrandingLogoPreview('');
    } finally {
      setLoading(false);
    }
  };

  const loadPlatformAdmins = async () => {
    try {
      const response = await adminService.getPlatformAdmins();
      if (response?.success) {
        setAdmins(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load platform admins', error);
      message.error('Failed to load admins');
    }
  };

  useEffect(() => {
    loadPlatformSettings();
    loadPlatformAdmins();
    loadSubscriptionPlans();
    loadFeatureCatalog();
    loadModules();
  }, []);

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      await adminService.updatePlatformSettings(values);
      message.success('Platform settings updated');
    } catch (error) {
      console.error('Failed to update platform settings', error);
      message.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoBeforeUpload = async (file) => {
    const toBase64 = (f) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(f);
      });

    try {
      const base64 = await toBase64(file);
      const currentBranding = form.getFieldValue('branding') || {};
      form.setFieldsValue({
        branding: {
          ...currentBranding,
          logoUrl: base64,
        },
      });
      setBrandingLogoPreview(base64);
      message.success('Logo uploaded');
    } catch (error) {
      console.error('Failed to read file', error);
      message.error('Failed to upload logo');
    }

    return false; // prevent default upload
  };

  const openCreateAdminModal = () => {
    setEditingAdmin(null);
    adminForm.resetFields();
    setAdminModalVisible(true);
  };

  const openEditAdminModal = (record) => {
    setEditingAdmin(record);
    adminForm.setFieldsValue({
      name: record.name,
      email: record.email,
      isActive: record.isActive,
      password: '',
    });
    setAdminModalVisible(true);
  };

  const handleAdminSubmit = async () => {
    try {
      const values = await adminForm.validateFields();
      setAdminSaving(true);

      if (editingAdmin) {
        await adminService.updatePlatformAdmin(editingAdmin.id, {
          name: values.name,
          isActive: values.isActive,
          ...(values.password ? { password: values.password } : {}),
        });
        message.success('Platform admin updated');
      } else {
        await adminService.createPlatformAdmin({
          name: values.name,
          email: values.email,
          password: values.password,
          isActive: values.isActive,
        });
        message.success('Platform admin created');
      }

      setAdminModalVisible(false);
      await loadPlatformAdmins();
    } catch (error) {
      if (error?.errorFields) {
        return;
      }
      console.error('Failed to save platform admin', error);
      message.error('Failed to save admin');
    } finally {
      setAdminSaving(false);
    }
  };

  const adminColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text) => text || '—',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) =>
        isActive ? <Text type="success">Active</Text> : <Text type="secondary">Inactive</Text>,
    },
    {
      title: 'Last login',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      render: (date) => (date ? new Date(date).toLocaleDateString() : 'Never'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button type="link" onClick={() => openEditAdminModal(record)}>
          Edit
        </Button>
      ),
    },
  ];

  // ============================================================
  // Subscription Plans Handlers
  // ============================================================

  const loadFeatureCatalog = async () => {
    try {
      const response = await adminService.getFeatureCatalog();
      if (response?.success) {
        setFeatureCatalog(response.data.features || []);
        setFeatureCategories(response.data.categories || {});
        setFeaturesByCategory(response.data.featuresByCategory || {});
      }
    } catch (error) {
      console.error('Failed to load feature catalog', error);
    }
  };

  const loadModules = async () => {
    try {
      const response = await adminService.getModules();
      if (response?.success) {
        setModules(response.data.modules || []);
        setAllFeatures(response.data.allFeatures || []);
      }
    } catch (error) {
      console.error('Failed to load modules', error);
    }
  };

  const loadSubscriptionPlans = async () => {
    setPlansLoading(true);
    try {
      const response = await adminService.getSubscriptionPlans();
      if (response?.success) {
        setPlans(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load subscription plans', error);
      message.error('Failed to load subscription plans');
    } finally {
      setPlansLoading(false);
    }
  };

  const openCreatePlanModal = () => {
    setEditingPlan(null);
    planForm.resetFields();
    planForm.setFieldsValue({
      isActive: true,
      order: 0,
      price: { currency: 'GHS' },
      highlights: [],
      marketing: { enabled: true, perks: [], featureFlags: {} },
      onboarding: { enabled: true },
    });
    setPlanModalVisible(true);
  };

  const openEditPlanModal = (plan) => {
    setEditingPlan(plan);
    
    // Convert feature flags object to checkbox values
    const featureFlags = plan.marketing?.featureFlags || {};
    
    planForm.setFieldsValue({
      planId: plan.planId,
      order: plan.order,
      name: plan.name,
      description: plan.description,
      priceAmount: plan.price?.amount,
      priceCurrency: plan.price?.currency || 'GHS',
      priceDisplay: plan.price?.display,
      priceBillingDescription: plan.price?.billingDescription,
      seatLimit: plan.seatLimit,
      seatPricePerAdditional: plan.seatPricePerAdditional,
      storageLimitMB: plan.storageLimitMB,
      storagePrice100GB: plan.storagePrice100GB,
      highlights: plan.highlights?.join('\n') || '',
      marketingEnabled: plan.marketing?.enabled,
      marketingPerks: plan.marketing?.perks?.join('\n') || '',
      marketingPopular: plan.marketing?.popular,
      marketingBadgeLabel: plan.marketing?.badgeLabel,
      onboardingEnabled: plan.onboarding?.enabled,
      onboardingSubtitle: plan.onboarding?.subtitle,
      onboardingIsDefault: plan.onboarding?.isDefault,
      isActive: plan.isActive,
      ...featureFlags, // Spread feature flags as individual form fields
    });
    setPlanModalVisible(true);
  };

  const toggleModule = (moduleKey, checked) => {
    const module = modules.find(m => m.key === moduleKey);
    if (!module) return;

    // Set all features in this module
    const updates = {};
    module.features.forEach(feature => {
      updates[feature.key] = checked;
    });

    planForm.setFieldsValue(updates);
    
    message.success(`${checked ? 'Enabled' : 'Disabled'} ${module.name} module`);
  };

  const generateMarketingCopy = () => {
    const values = planForm.getFieldsValue(true);
    
    // Get enabled features from ALL_FEATURES list
    const enabledFeatures = allFeatures.filter(feature => values[feature.key] === true);
    
    // Generate highlights
    const highlights = enabledFeatures
      .map(f => f.marketingCopy?.highlight)
      .filter(Boolean)
      .join('\n');
    
    // Generate perks
    const perks = enabledFeatures
      .map(f => f.marketingCopy?.perk)
      .filter(Boolean)
      .join('\n');
    
    // Update form fields
    planForm.setFieldsValue({
      highlights: highlights,
      marketingPerks: perks
    });
    
    message.success(`Generated ${enabledFeatures.length} highlights and perks from enabled features!`);
  };

  const handlePlanSubmit = async () => {
    try {
      const values = await planForm.validateFields();

      // Extract feature flags from form values (use allFeatures from modules)
      const featureFlags = {};
      allFeatures.forEach(feature => {
        featureFlags[feature.key] = values[feature.key] === true;
      });

      const planData = {
        planId: values.planId,
        order: values.order || 0,
        name: values.name,
        description: values.description,
        price: {
          amount: values.priceAmount,
          currency: values.priceCurrency || 'GHS',
          display: values.priceDisplay,
          billingDescription: values.priceBillingDescription,
        },
        seatLimit: values.seatLimit || null,
        seatPricePerAdditional: values.seatPricePerAdditional || null,
        storageLimitMB: values.storageLimitMB || null,
        storagePrice100GB: values.storagePrice100GB || null,
        highlights: values.highlights ? values.highlights.split('\n').filter(Boolean) : [],
        marketing: {
          enabled: values.marketingEnabled !== false,
          perks: values.marketingPerks ? values.marketingPerks.split('\n').filter(Boolean) : [],
          popular: values.marketingPopular || false,
          badgeLabel: values.marketingBadgeLabel || null,
          featureFlags: featureFlags,
        },
        onboarding: {
          enabled: values.onboardingEnabled !== false,
          subtitle: values.onboardingSubtitle || null,
          isDefault: values.onboardingIsDefault || false,
        },
        isActive: values.isActive !== false,
      };

      if (editingPlan) {
        await adminService.updateSubscriptionPlan(editingPlan.id, planData);
        message.success('Subscription plan updated successfully');
      } else {
        await adminService.createSubscriptionPlan(planData);
        message.success('Subscription plan created successfully');
      }

      setPlanModalVisible(false);
      await loadSubscriptionPlans();
    } catch (error) {
      if (error?.errorFields) return;
      console.error('Failed to save subscription plan', error);
      message.error(error?.response?.data?.message || 'Failed to save subscription plan');
    }
  };

  const handleDeletePlan = async (planId) => {
    try {
      await adminService.deleteSubscriptionPlan(planId);
      message.success('Subscription plan deleted successfully');
      await loadSubscriptionPlans();
    } catch (error) {
      console.error('Failed to delete subscription plan', error);
      message.error('Failed to delete subscription plan');
    }
  };

  const planColumns = [
    {
      title: 'Order',
      dataIndex: 'order',
      key: 'order',
      width: 80,
      sorter: (a, b) => a.order - b.order,
    },
    {
      title: 'Plan ID',
      dataIndex: 'planId',
      key: 'planId',
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Price',
      dataIndex: ['price', 'display'],
      key: 'price',
      render: (display) => display || '—',
    },
    {
      title: 'Seats',
      key: 'seats',
      render: (_, record) => {
        if (record.seatLimit === null) {
          return <Tag color="green">Unlimited</Tag>;
        }
        return (
          <span>
            {record.seatLimit} seats
            {record.seatPricePerAdditional && (
              <Tag color="blue" style={{ marginLeft: 4 }}>
                +GHS {record.seatPricePerAdditional}/seat
              </Tag>
            )}
          </span>
        );
      },
    },
    {
      title: 'Storage',
      key: 'storage',
      render: (_, record) => {
        if (record.storageLimitMB === null) {
          return <Tag color="green">Unlimited</Tag>;
        }
        const storageGB = (record.storageLimitMB / 1024).toFixed(0);
        return (
          <span>
            {storageGB} GB
            {record.storagePrice100GB && (
              <Tag color="purple" style={{ marginLeft: 4 }}>
                +GHS {record.storagePrice100GB}/100GB
              </Tag>
            )}
          </span>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) =>
        isActive ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag>,
    },
    {
      title: 'Marketing',
      key: 'marketing',
      render: (_, record) => (
        <Space>
          {record.marketing?.enabled && <Tag color="blue">Enabled</Tag>}
          {record.marketing?.popular && <Tag color="purple">Popular</Tag>}
        </Space>
      ),
    },
    {
      title: 'Onboarding',
      key: 'onboarding',
      render: (_, record) => (
        <Space>
          {record.onboarding?.enabled && <Tag color="cyan">Enabled</Tag>}
          {record.onboarding?.isDefault && <Tag color="gold">Default</Tag>}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditPlanModal(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete this plan?"
            description="This action cannot be undone."
            onConfirm={() => handleDeletePlan(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card title="Platform Settings">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={defaultFormValues}
        >
          <Tabs
            defaultActiveKey="branding"
            items={[
              {
                key: 'branding',
                label: 'Branding',
                children: (
                  <>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="Application name" name={['branding', 'appName']}>
                          <Input placeholder="NexPRO" size="large" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="Primary color" name={['branding', 'primaryColor']}>
                          <Input placeholder="#2f80ed" size="large" />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="Secondary color" name={['branding', 'secondaryColor']}>
                          <Input placeholder="#9b51e0" size="large" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="Logo">
                          <Space direction="vertical" size="small">
                            {brandingLogoPreview ? (
                              <img
                                src={brandingLogoPreview}
                                alt="Brand logo"
                                style={{ width: 120, height: 120, objectFit: 'contain', borderRadius: 8, border: '1px solid #d9d9d9', padding: 8, background: '#fafafa' }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 120,
                                  height: 120,
                                  border: '1px dashed #d9d9d9',
                                  borderRadius: 8,
                                  background: '#fafafa',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <Text type="secondary">No logo uploaded</Text>
                              </div>
                            )}
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              This logo is displayed on invoices and quotes.
                            </Text>
                            <Space>
                              <Upload
                                accept="image/png,image/jpeg,image/svg+xml"
                                showUploadList={false}
                                beforeUpload={handleLogoBeforeUpload}
                              >
                                <Button icon={<UploadOutlined />} size="small">Upload logo</Button>
                              </Upload>
                              {brandingLogoPreview && (
                                <Button
                                  size="small"
                                  onClick={() => {
                                    const currentBranding = form.getFieldValue('branding') || {};
                                    form.setFieldsValue({
                                      branding: {
                                        ...currentBranding,
                                        logoUrl: '',
                                      },
                                    });
                                    setBrandingLogoPreview('');
                                  }}
                                >
                                  Remove
                                </Button>
                              )}
                            </Space>
                          </Space>
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col span={24}>
                        <Form.Item
                          label="Email footer"
                          name={['branding', 'emailFooter']}
                          extra="Appears at the bottom of all system emails."
                        >
                          <Input.TextArea rows={3} placeholder="Thank you for using NexPRO." />
                        </Form.Item>
                      </Col>
                    </Row>
                  </>
                ),
              },
              {
                key: 'featureFlags',
                label: 'Feature Flags',
                children: (
                  <>
                    <Form.Item
                      label="Advanced analytics"
                      name={['featureFlags', 'advancedAnalytics']}
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                    <Form.Item
                      label="Automatic billing"
                      name={['featureFlags', 'autoBilling']}
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                    <Form.Item
                      label="Public signup"
                      name={['featureFlags', 'publicSignup']}
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                    <Text type="secondary">
                      These toggles control global availability of features across all tenants.
                    </Text>
                  </>
                ),
              },
              {
                key: 'communications',
                label: 'Communications',
                children: (
                  <>
                    <Form.Item
                      label="Support email"
                      name={['communications', 'supportEmail']}
                      rules={[{ type: 'email', message: 'Enter a valid email' }]}
                    >
                      <Input placeholder="support@nexpro.app" />
                    </Form.Item>
                    <Form.Item
                      label="Marketing email"
                      name={['communications', 'marketingEmail']}
                      rules={[{ type: 'email', message: 'Enter a valid email' }]}
                    >
                      <Input placeholder="marketing@nexpro.app" />
                    </Form.Item>
                    <Form.Item
                      label="SMS sender ID"
                      name={['communications', 'smsSender']}
                      extra="ID used for SMS notifications, if configured."
                    >
                      <Input placeholder="NEXPRO" />
                    </Form.Item>
                  </>
                ),
              },
              {
                key: 'subscriptionPlans',
                label: 'Subscription Plans',
                children: (
                  <>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                      Manage subscription plans that appear on your marketing site and tenant onboarding flow.
                    </Text>
                    
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={openCreatePlanModal}
                      style={{ marginBottom: 16 }}
                    >
                      Create Plan
                    </Button>

                    <Table
                      rowKey="id"
                      columns={planColumns}
                      dataSource={plans}
                      loading={plansLoading}
                      pagination={{ pageSize: 10 }}
                    />
                  </>
                ),
              },
            ]}
          />

          <Form.Item style={{ marginTop: 24 }}>
            <Button type="primary" htmlType="submit" loading={saving} disabled={loading}>
              Save settings
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card
        title="Platform administrators"
        extra={
          <Button type="primary" onClick={openCreateAdminModal}>
            Invite admin
          </Button>
        }
        style={{ marginTop: 24 }}
      >
        <Table
          rowKey="id"
          columns={adminColumns}
          dataSource={admins}
          pagination={false}
        />
      </Card>

      <Modal
        title={editingAdmin ? 'Edit platform admin' : 'Create platform admin'}
        open={adminModalVisible}
        onCancel={() => setAdminModalVisible(false)}
        onOk={handleAdminSubmit}
        confirmLoading={adminSaving}
        okText="Save"
      >
        <Form layout="vertical" form={adminForm} initialValues={{ isActive: true }}>
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: 'Please enter an email' },
              { type: 'email', message: 'Enter a valid email' },
            ]}
          >
            <Input disabled={Boolean(editingAdmin)} />
          </Form.Item>
          <Form.Item
            label={editingAdmin ? 'Password (leave blank to keep current)' : 'Password'}
            name="password"
            rules={
              editingAdmin
                ? []
                : [{ required: true, message: 'Please enter a password' }, { min: 6 }]
            }
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            label="Active"
            name="isActive"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingPlan ? 'Edit Subscription Plan' : 'Create Subscription Plan'}
        open={planModalVisible}
        onCancel={() => setPlanModalVisible(false)}
        onOk={handlePlanSubmit}
        width={800}
        okText="Save"
      >
        <Form layout="vertical" form={planForm}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Plan ID"
                name="planId"
                rules={[{ required: true, message: 'Please enter plan ID' }]}
                extra="Unique identifier (e.g., trial, launch, scale)"
              >
                <Input placeholder="trial" disabled={Boolean(editingPlan)} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Display Name"
                name="name"
                rules={[{ required: true, message: 'Please enter plan name' }]}
              >
                <Input placeholder="Free Trial" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Order" name="order" extra="For sorting (lower = first)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Status" name="isActive" valuePropName="checked">
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} placeholder="Brief description of the plan" />
          </Form.Item>

          <Text strong>Pricing</Text>
          <Row gutter={16} style={{ marginTop: 8 }}>
            <Col span={8}>
              <Form.Item label="Amount" name="priceAmount">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="799" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Currency" name="priceCurrency">
                <Input placeholder="GHS" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Display" name="priceDisplay">
                <Input placeholder="GHS 799/mo" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Billing Description" name="priceBillingDescription">
            <Input placeholder="GHS 799 per month, billed annually" />
          </Form.Item>

          <Text strong style={{ display: 'block', marginTop: 16 }}>Seat Limits</Text>
          <Row gutter={16} style={{ marginTop: 8 }}>
            <Col span={12}>
              <Form.Item 
                label="Maximum Seats" 
                name="seatLimit"
                extra="Leave empty for unlimited seats"
              >
                <InputNumber 
                  min={1} 
                  max={1000}
                  style={{ width: '100%' }} 
                  placeholder="e.g., 5, 15, or leave empty" 
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item 
                label="Price Per Additional Seat" 
                name="seatPricePerAdditional"
                extra="Cost to add seats beyond base limit"
              >
                <InputNumber 
                  min={0} 
                  precision={2}
                  style={{ width: '100%' }} 
                  placeholder="e.g., 25.00" 
                  addonBefore="GHS"
                />
              </Form.Item>
            </Col>
          </Row>

          <Text strong style={{ display: 'block', marginTop: 16 }}>Storage Limits</Text>
          <Row gutter={16} style={{ marginTop: 8 }}>
            <Col span={12}>
              <Form.Item 
                label="Storage Limit (MB)" 
                name="storageLimitMB"
                extra="Leave empty for unlimited storage (1024 MB = 1 GB)"
              >
                <InputNumber 
                  min={100} 
                  max={1000000}
                  step={1024}
                  style={{ width: '100%' }} 
                  placeholder="e.g., 1024 (1GB), 10240 (10GB)" 
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item 
                label="Price Per 100GB" 
                name="storagePrice100GB"
                extra="Cost to add 100GB beyond base limit"
              >
                <InputNumber 
                  min={0} 
                  precision={2}
                  style={{ width: '100%' }} 
                  placeholder="e.g., 15.00" 
                  addonBefore="GHS"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label={
              <Space>
                <span>Highlights</span>
                <Button 
                  type="link" 
                  size="small" 
                  onClick={generateMarketingCopy}
                  style={{ padding: 0, height: 'auto' }}
                >
                  Auto-generate from features
                </Button>
              </Space>
            }
            name="highlights"
            extra="One highlight per line (or click auto-generate)"
          >
            <Input.TextArea rows={3} placeholder="Unlimited invoices & jobs&#10;Up to 5 team members" />
          </Form.Item>

          <Text strong>Marketing Settings</Text>
          <Row gutter={16} style={{ marginTop: 8 }}>
            <Col span={8}>
              <Form.Item label="Enabled on Marketing Site" name="marketingEnabled" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Popular Badge" name="marketingPopular" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Badge Label" name="marketingBadgeLabel">
                <Input placeholder="Recommended" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label={
              <Space>
                <span>Marketing Perks</span>
                <Button 
                  type="link" 
                  size="small" 
                  onClick={generateMarketingCopy}
                  style={{ padding: 0, height: 'auto' }}
                >
                  Auto-generate from features
                </Button>
              </Space>
            }
            name="marketingPerks"
            extra="One perk per line (or click auto-generate)"
          >
            <Input.TextArea rows={3} placeholder="Up to 5 seats&#10;Email support" />
          </Form.Item>

          <Alert
            message="Module-Based Pricing"
            description={
              <div>
                <p style={{ marginBottom: 8 }}>
                  <strong>Step 1:</strong> Toggle entire modules ON/OFF below (or expand to toggle individual features)<br/>
                  <strong>Step 2:</strong> Click "Auto-generate" buttons above to create marketing copy<br/>
                  <strong>Step 3:</strong> Customize the generated text as needed
                </p>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Tip: Modules group related features - toggle a whole module to enable all its features at once!
                </Text>
              </div>
            }
            type="info"
            showIcon
            style={{ marginTop: 24, marginBottom: 24 }}
          />

          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            Feature Modules
          </Text>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
            Toggle modules to include/exclude groups of features. Click on a module to see individual features.
          </Text>

          <Collapse
            ghost
            style={{ background: '#fafafa', borderRadius: 8, marginBottom: 16 }}
          >
            {modules.map((module) => {
              const values = planForm.getFieldsValue(true);
              const moduleFeatures = module.features || [];
              const enabledCount = moduleFeatures.filter(f => values[f.key] === true).length;
              const allEnabled = enabledCount === moduleFeatures.length;
              const someEnabled = enabledCount > 0 && !allEnabled;

              return (
                <Collapse.Panel
                  key={module.key}
                  header={
                    <Space size="middle" style={{ width: '100%' }} onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={allEnabled}
                        indeterminate={someEnabled}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleModule(module.key, e.target.checked);
                        }}
                      />
                      <span style={{ fontSize: 16 }}>
                        <strong>{module.name}</strong>
                      </span>
                      <Tag color={allEnabled ? 'green' : someEnabled ? 'orange' : 'default'}>
                        {enabledCount}/{moduleFeatures.length} features
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        {module.description}
                      </Text>
                    </Space>
                  }
                >
                  <div style={{ paddingLeft: 32, paddingTop: 12 }}>
                    <Row gutter={[16, 16]}>
                      {moduleFeatures.map((feature) => (
                        <Col span={24} key={feature.key}>
                          <Form.Item
                            name={feature.key}
                            valuePropName="checked"
                            style={{ marginBottom: 8 }}
                          >
                            <Space direction="vertical" size={2} style={{ width: '100%' }}>
                              <Space>
                                <Switch size="small" />
                                <Text strong style={{ fontSize: 14 }}>{feature.name}</Text>
                                {feature.limits && (
                                  <Tag color="blue" style={{ fontSize: 11 }}>
                                    Has usage limits
                                  </Tag>
                                )}
                              </Space>
                              <Text type="secondary" style={{ fontSize: 12, paddingLeft: 40 }}>
                                {feature.description}
                              </Text>
                              {feature.marketingCopy && (
                                <Text type="secondary" style={{ fontSize: 11, paddingLeft: 40, fontStyle: 'italic' }}>
                                  Marketing: "{feature.marketingCopy.perk}"
                                </Text>
                              )}
                            </Space>
                          </Form.Item>
                        </Col>
                      ))}
                    </Row>
                  </div>
                </Collapse.Panel>
              );
            })}
          </Collapse>

          <Text strong>Onboarding Settings</Text>
          <Row gutter={16} style={{ marginTop: 8 }}>
            <Col span={8}>
              <Form.Item label="Enabled on Onboarding" name="onboardingEnabled" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Default Plan" name="onboardingIsDefault" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Subtitle" name="onboardingSubtitle">
                <Input placeholder="Recommended" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
};

export default AdminSettings;

