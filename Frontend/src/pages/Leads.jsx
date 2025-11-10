import { useEffect, useMemo, useState } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Table,
  Space,
  Button,
  Input,
  Select,
  Tag,
  message,
  Modal,
  Form,
  DatePicker,
  Typography,
  Divider,
  Timeline,
  Alert,
  Badge,
  Descriptions
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  PhoneOutlined,
  MailOutlined,
  TeamOutlined,
  UserSwitchOutlined,
  MessageOutlined,
  UserAddOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import DetailsDrawer from '../components/DetailsDrawer';
import ActionColumn from '../components/ActionColumn';
import leadService from '../services/leadService';
import userService from '../services/userService';

const { Title, Text } = Typography;
const { Option } = Select;

const statusColors = {
  new: 'blue',
  contacted: 'purple',
  qualified: 'green',
  converted: 'cyan',
  lost: 'red'
};

const priorityColors = {
  low: 'default',
  medium: 'gold',
  high: 'volcano'
};

const leadSourceOptions = [
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'event', label: 'Event' },
  { value: 'sign_board', label: 'Sign Board' },
  { value: 'outreach', label: 'Outreach' },
  { value: 'other', label: 'Other' }
];

const Leads = () => {
  const [leads, setLeads] = useState([]);
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    priority: 'all',
    source: 'all',
    assignedTo: '',
    isActive: 'true'
  });
  const [leadModalVisible, setLeadModalVisible] = useState(false);
  const [activityModalVisible, setActivityModalVisible] = useState(false);
  const [viewingLead, setViewingLead] = useState(null);
  const [editingLead, setEditingLead] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [convertingLead, setConvertingLead] = useState(false);
  const [leadForm] = Form.useForm();
  const [activityForm] = Form.useForm();

  useEffect(() => {
    fetchSummary();
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchUsers = async () => {
    try {
      const response = await userService.getAll({ limit: 100, isActive: true });
      const data = response?.data || response;
      setUsers(data?.data || data || []);
    } catch (error) {
      console.error('Failed to load users', error);
    }
  };

  const fetchSummary = async () => {
    setSummaryLoading(true);
    try {
      const response = await leadService.getSummary();
      setSummary(response?.data || {});
    } catch (error) {
      console.error('Failed to load lead summary', error);
      message.error('Failed to load lead summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        search: filters.search || undefined,
        status: filters.status,
        priority: filters.priority,
        source: filters.source === 'all' ? undefined : filters.source,
        assignedTo: filters.assignedTo || undefined,
        isActive: filters.isActive
      };

      const response = await leadService.getAll(params);
      const payload = response || {};
      const rows = Array.isArray(payload.data) ? payload.data : [];
      setLeads(rows);
      setPagination((prev) => ({
        ...prev,
        total: payload.count || rows.length || 0
      }));
    } catch (error) {
      console.error('Failed to load leads', error);
      message.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = (newPagination) => {
    setPagination((prev) => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize
    }));
  };

  const openLeadModal = (lead = null) => {
    setEditingLead(lead);
    if (lead) {
      leadForm.setFieldsValue({
        name: lead.name,
        company: lead.company,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        status: lead.status,
        priority: lead.priority,
        assignedTo: lead.assignee?.id || lead.assignedTo || undefined,
        nextFollowUp: lead.nextFollowUp ? dayjs(lead.nextFollowUp) : null,
        notes: lead.notes,
        tags: lead.tags || []
      });
    } else {
      leadForm.resetFields();
      leadForm.setFieldsValue({
        status: 'new',
        priority: 'medium',
        source: 'website'
      });
    }
    setLeadModalVisible(true);
  };

  const handleLeadSubmit = async (values) => {
    const payload = {
      ...values,
      nextFollowUp: values.nextFollowUp ? values.nextFollowUp.toISOString() : null
    };
    try {
      if (editingLead) {
        await leadService.update(editingLead.id, payload);
        message.success('Lead updated successfully');
      } else {
        await leadService.create(payload);
        message.success('Lead created successfully');
      }
      setLeadModalVisible(false);
      fetchLeads();
      fetchSummary();
    } catch (error) {
      console.error('Failed to save lead', error);
      const err = error?.response?.data?.message || 'Failed to save lead';
      message.error(err);
    }
  };

  const handleViewLead = async (record) => {
    try {
      const response = await leadService.getById(record.id);
      const data = response?.data || response;
      setViewingLead(data || record);
      setDrawerVisible(true);
    } catch (error) {
      console.error('Failed to fetch lead', error);
      message.error('Failed to load lead details');
      setViewingLead(record);
      setDrawerVisible(true);
    }
  };

  const handleConvertLead = (leadRecord = null) => {
    const targetLead = leadRecord || viewingLead;
    if (!targetLead) {
      return;
    }

    Modal.confirm({
      title: `Convert ${targetLead.name || 'Lead'} to customer`,
      content: 'This will create a customer record using the lead details. You can adjust the customer later if needed.',
      okText: 'Convert',
      cancelText: 'Cancel',
      okButtonProps: { type: 'primary' },
      async onOk() {
        try {
          setConvertingLead(true);
          const response = await leadService.convert(targetLead.id);
          const data = response?.data || response;
          if (data) {
            setViewingLead(data);
          }
          setDrawerVisible(true);
          message.success('Lead converted to customer');
          fetchLeads();
          fetchSummary();
        } catch (error) {
          console.error('Failed to convert lead', error);
          const errMsg = error?.response?.data?.message || 'Failed to convert lead';
          message.error(errMsg);
          throw error;
        } finally {
          setConvertingLead(false);
        }
      }
    });
  };

  useEffect(() => {
    if (viewingLead) {
      setActivityModalVisible(false);
    }
  }, [viewingLead]);

  const openActivityModal = () => {
    activityForm.resetFields();
    activityForm.setFieldsValue({
      type: 'note'
    });
    setActivityModalVisible(true);
  };

  const handleActivitySubmit = async (values) => {
    if (!viewingLead) return;
    try {
      await leadService.addActivity(viewingLead.id, {
        ...values,
        followUpDate: values.followUpDate ? values.followUpDate.toISOString() : null
      });
      message.success('Activity added successfully');
      setActivityModalVisible(false);
      handleViewLead({ id: viewingLead.id });
      fetchLeads();
      fetchSummary();
    } catch (error) {
      console.error('Failed to add activity', error);
      const err = error?.response?.data?.message || 'Failed to add activity';
      message.error(err);
    }
  };

  const handleArchiveLead = (record) => {
    Modal.confirm({
      title: 'Archive Lead',
      content: `Archive lead ${record.name}?`,
      okText: 'Archive',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await leadService.archive(record.id);
          message.success('Lead archived');
          fetchLeads();
          fetchSummary();
        } catch (error) {
          console.error('Failed to archive lead', error);
          const err = error?.response?.data?.message || 'Failed to archive lead';
          message.error(err);
        }
      }
    });
  };

  const columns = useMemo(() => [
    {
      title: 'Lead',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.name}</div>
          <div style={{ color: '#888', fontSize: 12 }}>
            {record.company || '—'}
          </div>
          <Space size={6} style={{ marginTop: 4 }}>
            {record.email && (
              <Tag icon={<MailOutlined />} color="blue">{record.email}</Tag>
            )}
            {record.phone && (
              <Tag icon={<PhoneOutlined />} color="green">{record.phone}</Tag>
            )}
          </Space>
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={statusColors[status] || 'default'}>{status?.toUpperCase()}</Tag>
      )
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => (
        <Tag color={priorityColors[priority] || 'default'}>{priority?.toUpperCase()}</Tag>
      )
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      render: (source) => {
        const matched = leadSourceOptions.find((option) => option.value === source);
        return matched ? matched.label : '—';
      }
    },
    {
      title: 'Assigned To',
      dataIndex: ['assignee', 'name'],
      key: 'assignedTo',
      render: (_, record) =>
        record.assignee?.name ||
        (record.assignedTo ? 'Unresolved' : 'Unassigned')
    },
    {
      title: 'Next Follow-up',
      dataIndex: 'nextFollowUp',
      key: 'nextFollowUp',
      render: (date) =>
        date ? dayjs(date).format('MMM DD, YYYY HH:mm') : '—'
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <ActionColumn
          record={record}
          onView={handleViewLead}
          extraActions={[
            record.status !== 'converted' && !record.convertedCustomerId && {
              label: 'Convert to Customer',
              onClick: () => handleConvertLead(record),
              icon: <UserAddOutlined />
            },
            {
              label: 'Edit',
              onClick: () => openLeadModal(record),
              icon: <UserSwitchOutlined />
            },
            {
              label: 'Archive',
              onClick: () => handleArchiveLead(record),
              icon: <TeamOutlined />,
              danger: true
            }
          ].filter(Boolean)}
        />
      )
    }
  ], [handleArchiveLead, handleConvertLead, convertingLead]);

  const summaryCards = [
    {
      title: 'Total Leads',
      value: summary?.totals?.totalLeads || 0,
      prefix: <TeamOutlined style={{ color: '#1890ff' }} />
    },
    {
      title: 'Qualified',
      value: summary?.totals?.qualifiedLeads || 0,
      prefix: <Badge status="processing" />
    },
    {
      title: 'Converted',
      value: summary?.totals?.convertedLeads || 0,
      prefix: <Badge status="success" />
    },
    {
      title: 'Lost',
      value: summary?.totals?.lostLeads || 0,
      prefix: <Badge status="error" />
    }
  ];

  const drawerTabs = useMemo(() => {
    if (!viewingLead) return [];
    const activities = viewingLead.activities || [];

    const timelineItems = activities.map((activity) => ({
      color:
        activity.type === 'call'
          ? 'green'
          : activity.type === 'email'
          ? 'blue'
          : activity.type === 'meeting'
          ? 'purple'
          : 'gray',
      children: (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {activity.type.toUpperCase()} {activity.subject ? `- ${activity.subject}` : ''}
          </div>
          <div style={{ color: '#888', fontSize: 12 }}>
            {dayjs(activity.createdAt).format('MMM DD, YYYY [at] h:mm A')}
            {activity.createdByUser ? ` • ${activity.createdByUser.name}` : ''}
          </div>
          {activity.notes && (
            <div style={{ marginTop: 4, color: '#555' }}>
              {activity.notes}
            </div>
          )}
          {activity.nextStep && (
            <div style={{ marginTop: 4, color: '#888' }}>
              Next Step: {activity.nextStep}
            </div>
          )}
          {activity.followUpDate && (
            <div style={{ marginTop: 4, color: '#888' }}>
              Follow-up: {dayjs(activity.followUpDate).format('MMM DD, YYYY hh:mm A')}
            </div>
          )}
        </div>
      )
    }));

    return [
      {
        key: 'overview',
        label: 'Overview',
        content: (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Divider orientation="left">Lead Details</Divider>

            {viewingLead.status === 'converted' && (
              <Alert
                type="success"
                message="Lead converted"
                description={
                  viewingLead.convertedCustomer
                    ? `Customer profile created for ${viewingLead.convertedCustomer.name}.`
                    : 'This lead has been converted.'
                }
                showIcon
              />
            )}

            <Row gutter={16}>
              <Col span={12}>
                <Card bordered={false}>
                  <Statistic
                    title="Status"
                    value={viewingLead.status?.toUpperCase()}
                    prefix={<Badge color={statusColors[viewingLead.status]} />}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card bordered={false}>
                  <Statistic
                    title="Priority"
                    value={viewingLead.priority?.toUpperCase()}
                    prefix={<Badge color={priorityColors[viewingLead.priority]} />}
                  />
                </Card>
              </Col>
            </Row>

            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Name">{viewingLead.name}</Descriptions.Item>
              <Descriptions.Item label="Company">{viewingLead.company || '—'}</Descriptions.Item>
              <Descriptions.Item label="Email">{viewingLead.email || '—'}</Descriptions.Item>
              <Descriptions.Item label="Phone">{viewingLead.phone || '—'}</Descriptions.Item>
              <Descriptions.Item label="Source">{viewingLead.source || '—'}</Descriptions.Item>
              <Descriptions.Item label="Assigned To">{viewingLead.assignee?.name || 'Unassigned'}</Descriptions.Item>
              <Descriptions.Item label="Next Follow-Up">
                {viewingLead.nextFollowUp ? dayjs(viewingLead.nextFollowUp).format('MMM DD, YYYY hh:mm A') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Last Contacted">
                {viewingLead.lastContactedAt ? dayjs(viewingLead.lastContactedAt).format('MMM DD, YYYY hh:mm A') : '—'}
              </Descriptions.Item>
              {viewingLead.convertedCustomer && (
                <Descriptions.Item label="Converted Customer">
                  <Space size="small">
                    <Tag color="cyan">{viewingLead.convertedCustomer.name}</Tag>
                    {viewingLead.convertedCustomer.company && (
                      <span style={{ color: '#888' }}>{viewingLead.convertedCustomer.company}</span>
                    )}
                  </Space>
                </Descriptions.Item>
              )}
              {viewingLead.convertedJob && (
                <Descriptions.Item label="Linked Job">
                  <Tag color="green">{viewingLead.convertedJob.jobNumber}</Tag>
                  <span style={{ marginLeft: 8 }}>{viewingLead.convertedJob.title}</span>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Tags">
                {(viewingLead.tags || []).length
                  ? viewingLead.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Notes">{viewingLead.notes || '—'}</Descriptions.Item>
            </Descriptions>
          </Space>
        )
      },
      {
        key: 'activities',
        label: 'Activity',
        content: timelineItems.length ? (
          <Timeline items={timelineItems} />
        ) : (
          <Alert type="info" message="No activity logged yet." />
        )
      }
    ];
  }, [viewingLead]);

  const statusOptions = ['all', 'new', 'contacted', 'qualified', 'converted', 'lost'];
  const priorityOptions = ['all', 'low', 'medium', 'high'];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>Leads</Title>
          <Text type="secondary">Track prospects and follow-ups for customer service and marketing.</Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchLeads(); fetchSummary(); }}>
              Refresh
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openLeadModal()}>
              New Lead
            </Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        {summaryCards.map((card) => (
          <Col xs={24} sm={12} md={6} key={card.title}>
            <Card loading={summaryLoading}>
              <Statistic
                title={card.title}
                value={card.value}
                prefix={card.prefix}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={24} md={12} lg={4}>
            <Input.Search
              placeholder="Search name, company, email, phone"
              allowClear
              onSearch={(value) => {
                setPagination((prev) => ({ ...prev, current: 1 }));
                setFilters((prev) => ({ ...prev, search: value }));
              }}
            />
          </Col>
          <Col xs={24} sm={24} md={12} lg={4}>
            <Select
              value={filters.status}
              onChange={(value) => {
                setPagination((prev) => ({ ...prev, current: 1 }));
                setFilters((prev) => ({ ...prev, status: value }));
              }}
              style={{ width: '100%' }}
            >
              {statusOptions.map((option) => (
                <Option key={option} value={option}>
                  {option.toUpperCase()}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={24} md={12} lg={4}>
            <Select
              value={filters.priority}
              onChange={(value) => {
                setPagination((prev) => ({ ...prev, current: 1 }));
                setFilters((prev) => ({ ...prev, priority: value }));
              }}
              style={{ width: '100%' }}
            >
              {priorityOptions.map((option) => (
                <Option key={option} value={option}>
                  {option.toUpperCase()}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={24} md={12} lg={4}>
            <Select
              value={filters.source}
              onChange={(value) => {
                setPagination((prev) => ({ ...prev, current: 1 }));
                setFilters((prev) => ({ ...prev, source: value }));
              }}
              style={{ width: '100%' }}
              placeholder="Filter by source"
            >
              <Option value="all">All Sources</Option>
              {leadSourceOptions.map((option) => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={24} md={12} lg={4}>
            <Select
              allowClear
              placeholder="Filter by assignee"
              value={filters.assignedTo || undefined}
              onChange={(value) => {
                setPagination((prev) => ({ ...prev, current: 1 }));
                setFilters((prev) => ({ ...prev, assignedTo: value || '' }));
              }}
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="children"
            >
              {users.map((user) => (
                <Option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={24} md={12} lg={4}>
            <Select
              value={filters.isActive}
              onChange={(value) => {
                setPagination((prev) => ({ ...prev, current: 1 }));
                setFilters((prev) => ({ ...prev, isActive: value }));
              }}
              style={{ width: '100%' }}
            >
              <Option value="true">Active</Option>
              <Option value="false">Archived</Option>
              <Option value="all">All</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={leads}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        scroll={{ x: 1000 }}
      />

      <DetailsDrawer
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setViewingLead(null);
        }}
        title={viewingLead ? viewingLead.name : 'Lead details'}
        width={720}
        onEdit={viewingLead ? () => openLeadModal(viewingLead) : null}
        extraActions={
          viewingLead
            ? [
                !viewingLead.convertedCustomerId && {
                  key: 'convert',
                  label: convertingLead ? 'Converting...' : 'Convert to Customer',
                  icon: <UserAddOutlined />,
                  onClick: () => handleConvertLead(viewingLead),
                },
                {
                  key: 'log-activity',
                  label: 'Log Activity',
                  icon: <MessageOutlined />,
                  onClick: openActivityModal
                }
              ].filter(Boolean)
            : []
        }
        tabs={drawerTabs}
      />

      <Modal
        title={editingLead ? `Edit Lead (${editingLead.name})` : 'New Lead'}
        open={leadModalVisible}
        onCancel={() => setLeadModalVisible(false)}
        onOk={() => leadForm.submit()}
        okText={editingLead ? 'Update Lead' : 'Create Lead'}
        width={720}
      >
        <Form layout="vertical" form={leadForm} onFinish={handleLeadSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Lead Name"
                rules={[{ required: true, message: 'Please enter lead name' }]}
              >
                <Input placeholder="Contact or company name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="company" label="Company">
                <Input placeholder="Company" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="email" label="Email">
                <Input type="email" placeholder="Email address" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Phone">
                <Input placeholder="Phone number" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="source" label="Lead Source">
              <Select placeholder="Select lead source">
                {leadSourceOptions.map((option) => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="assignedTo" label="Assigned To">
                <Select
                  allowClear
                  placeholder="Select team member"
                  showSearch
                  optionFilterProp="children"
                >
                  {users.map((user) => (
                    <Option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="Status">
                <Select>
                  {['new', 'contacted', 'qualified', 'converted', 'lost'].map((status) => (
                    <Option key={status} value={status}>
                      {status.toUpperCase()}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="Priority">
                <Select>
                  {['low', 'medium', 'high'].map((priority) => (
                    <Option key={priority} value={priority}>
                      {priority.toUpperCase()}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="nextFollowUp" label="Next Follow-up">
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tags" label="Tags">
                <Select mode="tags" placeholder="Add tags" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} placeholder="Internal notes or context" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Log Activity"
        open={activityModalVisible}
        onCancel={() => setActivityModalVisible(false)}
        onOk={() => activityForm.submit()}
        okText="Save Activity"
      >
        <Form layout="vertical" form={activityForm} onFinish={handleActivitySubmit}>
          <Form.Item name="type" label="Activity Type">
            <Select>
              <Option value="call">Call</Option>
              <Option value="email">Email</Option>
              <Option value="meeting">Meeting</Option>
              <Option value="note">Note</Option>
              <Option value="task">Task</Option>
            </Select>
          </Form.Item>
          <Form.Item name="subject" label="Subject">
            <Input placeholder="Short subject or summary" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} placeholder="Details of the interaction" />
          </Form.Item>
          <Form.Item name="nextStep" label="Next Step">
            <Input placeholder="Optional next step" />
          </Form.Item>
          <Form.Item name="followUpDate" label="Follow-up Date">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Leads;
