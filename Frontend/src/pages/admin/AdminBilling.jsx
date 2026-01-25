import { useEffect, useState } from 'react';
import {
  Card,
  Col,
  Row,
  Spin,
  Statistic,
  Typography,
  Table,
  Tag,
  Empty,
} from 'antd';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import adminService from '../../services/adminService';
import StatusChip from '../../components/StatusChip';

const { Title, Text } = Typography;
const PLAN_COLORS = ['#27ae60', '#2f80ed', '#9b51e0'];

dayjs.extend(relativeTime);

const getPlanLabel = (plan) => {
  switch (plan) {
    case 'standard':
      return 'Standard';
    case 'pro':
      return 'Pro';
    default:
      return plan;
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

const AdminBilling = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [tenants, setTenants] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [summaryRes, tenantsRes] = await Promise.all([
          adminService.getBillingSummary(),
          adminService.getBillingTenants(),
        ]);

        if (summaryRes?.success) {
          setSummary(summaryRes.data);
        }
        if (tenantsRes?.success) {
          setTenants(tenantsRes.data || []);
        }
      } catch (error) {
        console.error('Failed to load billing data', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

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
            {record.metadata?.billingCustomerId || record.slug}
          </Text>
        </div>
      ),
    },
    {
      title: 'Plan',
      dataIndex: 'plan',
      key: 'plan',
      render: (plan) => (
        <Tag color={plan === 'pro' ? 'purple' : 'blue'}>{getPlanLabel(plan)}</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <StatusChip status={status} />,
    },
    {
      title: 'Billing Method',
      dataIndex: ['metadata', 'paymentMethod'],
      key: 'paymentMethod',
      render: (_, record) => record.metadata?.paymentMethod || 'Not on file',
    },
    {
      title: 'Last Update',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date) => dayjs(date).fromNow(),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 8 }}>
          Billing & Subscriptions
        </Title>
        <Text type="secondary">
          Track revenue performance, plan mix, and paid tenants across the platform.
        </Text>
      </div>

      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Estimated MRR (GHS)"
              value={summary?.estimatedMRR ?? 0}
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Paying tenants"
              value={summary?.payingTenants ?? 0}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Trialing tenants"
              value={summary?.trialingTenants ?? 0}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Revenue by plan (GHS)">
            {summary?.planBreakdown?.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={summary.planBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="plan" tickFormatter={getPlanLabel} />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value) => `GHS ${value}`} />
                  <Bar dataKey="mrr" fill="#2f80ed" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="No paying tenants yet" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Plan mix">
            {summary?.planBreakdown?.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={summary.planBreakdown}
                    dataKey="count"
                    nameKey="plan"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                  >
                    {summary.planBreakdown.map((entry, index) => (
                      <Cell
                        key={entry.plan}
                        fill={PLAN_COLORS[index % PLAN_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name, props) => [`${value} tenants`, getPlanLabel(props.payload.plan)]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="No data yet" />
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title="Paying tenants"
        extra={
          <Text type="secondary">
            Showing {tenants.length} tenants on a paid plan
          </Text>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={tenants}
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default AdminBilling;

