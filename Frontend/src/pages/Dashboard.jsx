import { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Spin, message } from 'antd';
import {
  DollarCircleOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  TeamOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons';
import dashboardService from '../services/dashboardService';
import dayjs from 'dayjs';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await dashboardService.getOverview();
      setOverview(response.data);
    } catch (error) {
      message.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    pending: 'orange',
    in_progress: 'blue',
    completed: 'green',
    cancelled: 'red',
    on_hold: 'gray',
  };

  const recentJobsColumns = [
    {
      title: 'Job Number',
      dataIndex: 'jobNumber',
      key: 'jobNumber',
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Customer',
      dataIndex: ['customer', 'name'],
      key: 'customer',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={statusColors[status]}>
          {status.replace('_', ' ').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('MMM DD, YYYY'),
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Dashboard</h1>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Revenue"
              value={overview?.allTime?.revenue || 0}
              prefix="₵"
              valueStyle={{ color: '#3f8600' }}
              suffix={<RiseOutlined />}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
              This month: ₵{overview?.thisMonth?.revenue || 0}
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Expenses"
              value={overview?.allTime?.expenses || 0}
              prefix="₵"
              valueStyle={{ color: '#cf1322' }}
              suffix={<FallOutlined />}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
              This month: ₵{overview?.thisMonth?.expenses || 0}
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Jobs"
              value={overview?.summary?.totalJobs || 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
              In progress: {overview?.summary?.inProgressJobs || 0}
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Customers"
              value={overview?.summary?.totalCustomers || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
              Active customers
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="Job Status Overview" bordered={false}>
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Statistic
                  title="Pending"
                  value={overview?.summary?.pendingJobs || 0}
                  valueStyle={{ color: '#faad14' }}
                />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic
                  title="In Progress"
                  value={overview?.summary?.inProgressJobs || 0}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic
                  title="Completed"
                  value={overview?.summary?.completedJobs || 0}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="Recent Jobs" bordered={false}>
            <Table
              dataSource={overview?.recentJobs || []}
              columns={recentJobsColumns}
              rowKey="id"
              pagination={{ pageSize: 5 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;


