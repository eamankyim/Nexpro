import { useEffect, useState } from 'react';
import {
  Card,
  Col,
  Row,
  Spin,
  Statistic,
  Typography,
  List,
  Tag,
  Empty,
} from 'antd';
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import adminService from '../../services/adminService';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const PLAN_COLORS = ['#2f80ed', '#27ae60', '#9b51e0', '#e2b93b'];

const AdminOverview = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState({ upcomingTrials: [], attentionRequired: [] });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [summaryRes, metricsRes, alertsRes] = await Promise.all([
          adminService.getSummary(),
          adminService.getTenantMetrics(),
          adminService.getAlerts(),
        ]);

        if (summaryRes?.success) {
          setSummary(summaryRes.data);
        }
        if (metricsRes?.success) {
          setMetrics(metricsRes.data);
        }
        if (alertsRes?.success) {
          setAlerts(alertsRes.data);
        }
      } catch (error) {
        console.error('Failed to load control center overview', error);
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

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 8 }}>
          Platform Overview
        </Title>
        <Text type="secondary">
          Monitor adoption, health, and upcoming events across the entire NexPRO platform.
        </Text>
      </div>

      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic title="Total tenants" value={summary?.totalTenants ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic title="Active tenants" value={summary?.activeTenants ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic title="Trial tenants" value={summary?.trialTenants ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic title="Total users" value={summary?.totalUsers ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="New tenants (7 days)"
              value={summary?.newTenantsLast7Days ?? 0}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Avg. users per tenant"
              value={summary?.avgUsersPerTenant ?? 0}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card title="Tenant signups (last 30 days)">
            {metrics?.signupTrend?.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={metrics.signupTrend}>
                  <defs>
                    <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2f80ed" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#2f80ed" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => dayjs(value).format('MMM D')}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    labelFormatter={(value) => dayjs(value).format('MMMM D, YYYY')}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#2f80ed"
                    fill="url(#colorSignups)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="No signups in the last 30 days" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Plan distribution">
            {metrics?.planDistribution?.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={metrics.planDistribution}
                    dataKey="count"
                    nameKey="plan"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                  >
                    {metrics.planDistribution.map((entry, index) => (
                      <Cell
                        key={entry.plan}
                        fill={PLAN_COLORS[index % PLAN_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="No tenants yet" />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card title="Tenant status breakdown">
            {metrics?.statusDistribution?.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={metrics.statusDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#9b51e0" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="No tenant data yet" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Alerts">
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Title level={5} style={{ marginBottom: 8 }}>
                  Trials ending soon
                </Title>
                {alerts.upcomingTrials?.length ? (
                  <List
                    itemLayout="horizontal"
                    dataSource={alerts.upcomingTrials}
                    renderItem={(item) => (
                      <List.Item>
                        <List.Item.Meta
                          title={
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>{item.name}</span>
                              <Tag color="blue">{item.plan}</Tag>
                            </div>
                          }
                          description={`${item.trialEndsAt ? `Trial ends ${dayjs(item.trialEndsAt).fromNow()}` : 'Trial end date unavailable'}, created ${dayjs(item.createdAt).format('MMM D, YYYY')}`}
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty description="No upcoming trial expirations" />
                )}
              </Col>
              <Col span={24}>
                <Title level={5} style={{ marginBottom: 8 }}>
                  Needs attention
                </Title>
                {alerts.attentionRequired?.length ? (
                  <List
                    itemLayout="horizontal"
                    dataSource={alerts.attentionRequired}
                    renderItem={(item) => (
                      <List.Item>
                        <List.Item.Meta
                          title={
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>{item.name}</span>
                              <Tag color="orange">{item.status}</Tag>
                            </div>
                          }
                          description={`Last update ${dayjs(item.updatedAt).fromNow()}`}
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty description="No tenants flagged" />
                )}
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AdminOverview;

