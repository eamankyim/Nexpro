import { useEffect, useState, useMemo, useCallback } from 'react';
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
  Row,
  Col,
  Select,
  List,
  Empty,
  Alert,
} from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useDebounce } from '../../hooks/useDebounce';
import adminService from '../../services/adminService';
import StatusChip from '../../components/StatusChip';
import { useSmartSearch } from '../../context/SmartSearchContext';
import { SEARCH_PLACEHOLDERS, DEBOUNCE_DELAYS } from '../../constants';
import { showSuccess, showError, handleApiError } from '../../utils/toast';

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

const AdminTenants = () => {
  const { isMobile } = useResponsive();
  const { searchValue, setPageSearchConfig } = useSmartSearch();
  const debouncedSearch = useDebounce(searchValue, DEBOUNCE_DELAYS.SEARCH);
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
  });
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const fetchTenants = async (page = 1, pageSize = 20, overrideFilters = {}) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pageSize,
        ...filters,
        ...overrideFilters,
      };
      if (debouncedSearch) params.search = debouncedSearch;
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
      handleApiError(error, { context: 'load tenants' });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (tenantId, action) => {
    setStatusUpdating(true);
    try {
      await adminService.updateTenantStatus(tenantId, action);
      showSuccess(`Tenant ${action}d successfully`);
      await fetchTenantDetail(tenantId);
      await fetchTenants(pagination.current, pagination.pageSize);
    } catch (error) {
      handleApiError(error, { context: 'update tenant status' });
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
      }
    } catch (error) {
      handleApiError(error, { context: 'fetch tenant detail' });
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    setPageSearchConfig({ scope: 'admin_tenants', placeholder: SEARCH_PLACEHOLDERS.ADMIN_TENANTS });
    return () => setPageSearchConfig(null);
  }, [setPageSearchConfig]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, [searchValue]);

  useEffect(() => {
    fetchTenants(pagination.current, pagination.pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.current, pagination.pageSize, filters.plan, filters.status, debouncedSearch]);

  const handleFilterChange = (key, value) => {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    fetchTenants(1, pagination.pageSize, nextFilters);
  };

  const fetchTenantDetailMemo = useCallback((id) => {
    fetchTenantDetail(id);
  }, []);

  const columns = useMemo(() => [
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
      render: (status) => <StatusChip status={status} />,
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
        <Button type="link" onClick={() => fetchTenantDetailMemo(record.id)}>
          View
        </Button>
      ),
    },
  ], [fetchTenantDetailMemo]);

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
        </Row>

        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <Spin />
              </div>
            ) : tenants.length === 0 ? (
              <Empty description="No tenants found" />
            ) : (
              <>
                {tenants.map((tenant) => (
                  <Card key={tenant.id} size="small" style={{ border: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <Text strong>{tenant.name}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>{tenant.slug}</Text>
                      </div>
                      <StatusChip status={tenant.status} />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                      <Tag color={getPlanColor(tenant.plan)}>{tenant.plan}</Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>Users: {tenant.userCount ?? 0}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(tenant.createdAt).format('MMM D, YYYY')}</Text>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <Button type="link" size="small" onClick={() => fetchTenantDetailMemo(tenant.id)} style={{ padding: 0 }}>
                        View
                      </Button>
                    </div>
                  </Card>
                ))}
                {pagination.total > pagination.pageSize && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Page {pagination.current} of {Math.ceil(pagination.total / pagination.pageSize)}
                    </Text>
                    <Space>
                      <Button
                        size="small"
                        disabled={pagination.current <= 1}
                        onClick={() => fetchTenants(pagination.current - 1, pagination.pageSize)}
                      >
                        Previous
                      </Button>
                      <Button
                        size="small"
                        disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize)}
                        onClick={() => fetchTenants(pagination.current + 1, pagination.pageSize)}
                      >
                        Next
                      </Button>
                    </Space>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
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
        )}
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
                {selectedTenant.organizationSettings?.logoUrl ? (
                  <img
                    src={resolveImageUrl(selectedTenant.organizationSettings.logoUrl)}
                    alt="Organization logo"
                    loading="lazy"
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
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Appears on tenant-facing documents like invoices.
                </Text>
                <Alert
                  message="Branding Management"
                  description="Tenants manage their own branding through Settings → Organization. This is a read-only view of their current logo."
                  type="info"
                  showIcon
                  style={{ marginTop: 8 }}
                />
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
                <StatusChip status={selectedTenant.status} />
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

