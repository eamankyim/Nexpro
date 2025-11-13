import { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Tag,
  Typography,
  Drawer,
  Descriptions,
  Spin,
  Space,
  Button,
  message,
  Row,
  Col,
  Select,
  Input,
  List,
  Empty,
  Upload,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import adminService from '../../services/adminService';

const { Title, Text } = Typography;

dayjs.extend(relativeTime);

const getPlanColor = (plan) => {
  switch (plan) {
    case 'pro':
      return 'purple';
    case 'standard':
      return 'blue';
    case 'trial':
      return 'green';
    default:
      return 'default';
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'active':
      return 'success';
    case 'paused':
      return 'orange';
    case 'suspended':
      return 'red';
    default:
      return 'default';
  }
};

const AdminTenants = () => {
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [filters, setFilters] = useState({
    plan: undefined,
    status: undefined,
    search: '',
  });
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [logoUpdating, setLogoUpdating] = useState(false);
  const [logoPreview, setLogoPreview] = useState('');

  const fetchTenants = async (page = 1, pageSize = 20, overrideFilters = {}) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pageSize,
        ...filters,
        ...overrideFilters,
      };
      const response = await adminService.getTenants(params);
      if (response?.success) {
        setTenants(response.data || []);
        setPagination({
          current: page,
          pageSize,
          total: response.pagination?.total ?? 0,
        });
      }
    } catch (error) {
      console.error('Failed to load tenant directory', error);
      message.error('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (tenantId, action) => {
    setStatusUpdating(true);
    try {
      await adminService.updateTenantStatus(tenantId, action);
      message.success(`Tenant ${action}d successfully`);
      await fetchTenantDetail(tenantId);
      await fetchTenants(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('Failed to update tenant status', error);
      message.error('Failed to update tenant status');
    } finally {
      setStatusUpdating(false);
    }
  };

  const fetchTenantDetail = async (tenantId) => {
    setDetailLoading(true);
    try {
      const response = await adminService.getTenantDetail(tenantId);
      if (response?.success) {
        setSelectedTenant(response.data);
        setDrawerVisible(true);
        setLogoPreview(response.data?.metadata?.logoUrl || '');
      }
    } catch (error) {
      console.error('Failed to load tenant detail', error);
      message.error('Failed to fetch tenant detail');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (key, value) => {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    fetchTenants(1, pagination.pageSize, nextFilters);
  };

  const handleSearch = (value) => {
    const nextFilters = { ...filters, search: value };
    setFilters(nextFilters);
    fetchTenants(1, pagination.pageSize, nextFilters);
  };

  const columns = [
    {
      title: 'Organization',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.slug}
          </Text>
        </div>
      ),
    },
    {
      title: 'Plan',
      dataIndex: 'plan',
      key: 'plan',
      render: (plan) => <Tag color={getPlanColor(plan)}>{plan}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <Tag color={getStatusColor(status)}>{status}</Tag>,
    },
    {
      title: 'Users',
      dataIndex: 'userCount',
      key: 'userCount',
      render: (count) => count ?? 0,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('MMM D, YYYY'),
    },
    {
      title: 'Trial ends',
      dataIndex: 'trialEndsAt',
      key: 'trialEndsAt',
      render: (date) => (date ? dayjs(date).format('MMM D, YYYY') : '—'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button type="link" onClick={() => fetchTenantDetail(record.id)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Title level={4} style={{ marginBottom: 4 }}>
            Tenant Directory
          </Title>
          <Text type="secondary">
            Review every workspace, their status, and plan footprint across the platform.
          </Text>
        </div>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Select
              allowClear
              placeholder="Filter by plan"
              style={{ width: '100%' }}
              value={filters.plan}
              onChange={(value) => handleFilterChange('plan', value)}
              options={[
                { label: 'Trial', value: 'trial' },
                { label: 'Standard', value: 'standard' },
                { label: 'Pro', value: 'pro' },
              ]}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Select
              allowClear
              placeholder="Filter by status"
              style={{ width: '100%' }}
              value={filters.status}
              onChange={(value) => handleFilterChange('status', value)}
              options={[
                { label: 'Active', value: 'active' },
                { label: 'Paused', value: 'paused' },
                { label: 'Suspended', value: 'suspended' },
              ]}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Input.Search
              allowClear
              placeholder="Search by name or slug"
              onSearch={handleSearch}
              defaultValue={filters.search}
            />
          </Col>
        </Row>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={tenants}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: (page) => fetchTenants(page, pagination.pageSize),
            showSizeChanger: false,
          }}
        />
      </Card>

      <Drawer
        width={520}
        title="Tenant details"
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setSelectedTenant(null);
        }}
        destroyOnClose
      >
        {detailLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <Spin />
          </div>
        ) : selectedTenant ? (
          <Space direction="vertical" size={24} style={{ width: '100%' }}>
            <Card size="small" title="Control">
              <Space>
                <Button
                  type="primary"
                  loading={statusUpdating}
                  onClick={() => handleStatusUpdate(selectedTenant.id, 'activate')}
                  disabled={selectedTenant.status === 'active'}
                >
                  Activate
                </Button>
                <Button
                  loading={statusUpdating}
                  onClick={() => handleStatusUpdate(selectedTenant.id, 'pause')}
                  disabled={selectedTenant.status === 'paused'}
                >
                  Pause
                </Button>
                <Button
                  danger
                  loading={statusUpdating}
                  onClick={() => handleStatusUpdate(selectedTenant.id, 'suspend')}
                  disabled={selectedTenant.status === 'suspended'}
                >
                  Suspend
                </Button>
              </Space>
            </Card>

            <Card size="small" title="Branding">
              <Space direction="vertical">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Tenant logo"
                    style={{
                      width: 140,
                      height: 140,
                      objectFit: 'contain',
                      borderRadius: 12,
                      border: '1px solid #f0f0f0',
                      padding: 12,
                      background: '#fafafa',
                    }}
                  />
                ) : (
                  <Text type="secondary">No logo uploaded</Text>
                )}
                <Text type="secondary">
                  Appears on tenant-facing documents like invoices.
                </Text>
                <Space>
                  <Upload
                    accept="image/png,image/jpeg,image/svg+xml"
                    showUploadList={false}
                    beforeUpload={async (file) => {
                      const toBase64 = (f) =>
                        new Promise((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve(reader.result);
                          reader.onerror = (error) => reject(error);
                          reader.readAsDataURL(f);
                        });
                      try {
                        setLogoUpdating(true);
                        const base64 = await toBase64(file);
                        await adminService.updateTenantBranding(selectedTenant.id, {
                          logoUrl: base64,
                        });
                        message.success('Tenant logo updated');
                        setLogoPreview(base64);
                        await fetchTenantDetail(selectedTenant.id);
                      } catch (error) {
                        console.error('Failed to upload logo', error);
                        message.error('Failed to upload logo');
                      } finally {
                        setLogoUpdating(false);
                      }
                      return false;
                    }}
                  >
                    <Button icon={<UploadOutlined />} loading={logoUpdating}>
                      Upload logo
                    </Button>
                  </Upload>
                  {logoPreview && (
                    <Button
                      onClick={async () => {
                        try {
                          setLogoUpdating(true);
                          await adminService.updateTenantBranding(selectedTenant.id, {
                            logoUrl: '',
                          });
                          message.success('Tenant logo removed');
                          setLogoPreview('');
                          await fetchTenantDetail(selectedTenant.id);
                        } catch (error) {
                          console.error('Failed to remove logo', error);
                          message.error('Failed to remove logo');
                        } finally {
                          setLogoUpdating(false);
                        }
                      }}
                      loading={logoUpdating}
                    >
                      Remove
                    </Button>
                  )}
                </Space>
              </Space>
            </Card>

            <Descriptions
              column={1}
              size="small"
              title="Organization"
              labelStyle={{ width: '40%', textAlign: 'right', paddingRight: 16 }}
              contentStyle={{ width: '60%', textAlign: 'left' }}
            >
              <Descriptions.Item label="Name">{selectedTenant.name}</Descriptions.Item>
              <Descriptions.Item label="Slug">{selectedTenant.slug}</Descriptions.Item>
              <Descriptions.Item label="Plan">
                <Tag color={getPlanColor(selectedTenant.plan)}>{selectedTenant.plan}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getStatusColor(selectedTenant.status)}>
                  {selectedTenant.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {dayjs(selectedTenant.createdAt).format('MMM D, YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Trial ends">
                {selectedTenant.trialEndsAt
                  ? dayjs(selectedTenant.trialEndsAt).format('MMM D, YYYY')
                  : '—'}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions
              column={1}
              size="small"
              title="Metadata"
              labelStyle={{ width: '40%', textAlign: 'right', paddingRight: 16 }}
              contentStyle={{ width: '60%', textAlign: 'left' }}
            >
              <Descriptions.Item label="Website">
                {selectedTenant.metadata?.website || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {selectedTenant.metadata?.email || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                {selectedTenant.metadata?.phone || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Signup Source">
                {selectedTenant.metadata?.signupSource || '—'}
              </Descriptions.Item>
            </Descriptions>

            <Card title="Members" size="small">
              {Array.isArray(selectedTenant.memberships) &&
              selectedTenant.memberships.length > 0 ? (
                <List
                  itemLayout="horizontal"
                  dataSource={selectedTenant.memberships}
                  renderItem={(membership) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{membership.user?.name || membership.user?.email}</span>
                            <Tag color={membership.role === 'owner' ? 'gold' : 'default'}>
                              {membership.role}
                            </Tag>
                          </div>
                        }
                        description={
                          <>
                            <div>{membership.user?.email}</div>
                            <Text type="secondary">
                              Last login:{' '}
                              {membership.user?.lastLogin
                                ? dayjs(membership.user.lastLogin).fromNow()
                                : 'Never'}
                            </Text>
                          </>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="No members found" />
              )}
            </Card>
          </Space>
        ) : (
          <Empty description="Select a tenant to view details" />
        )}
      </Drawer>
    </>
  );
};

export default AdminTenants;

