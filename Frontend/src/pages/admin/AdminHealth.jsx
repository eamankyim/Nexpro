import { useEffect, useState } from 'react';
import {
  Card,
  Col,
  Row,
  Spin,
  Statistic,
  Typography,
  Timeline,
  List,
  Tag,
} from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import StatusChip from '../../components/StatusChip';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const statusColor = (status) => {
  switch (status) {
    case 'online':
      return 'green';
    case 'warning':
      return 'orange';
    default:
      return 'red';
  }
};

const AdminHealth = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchHealth = async () => {
      setLoading(true);
      try {
        const response = await adminService.getSystemHealth();
        if (response?.success) {
          setData(response.data);
        }
      } catch (error) {
        console.error('Failed to load system health', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
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
          System Health
        </Title>
        <Text type="secondary">
          Monitor backend uptime, database responsiveness, and recent events.
        </Text>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Server uptime"
              value={data?.uptimeHuman || '—'}
            />
            <Text type="secondary">
              Started {dayjs(data?.serverStartedAt).fromNow()}
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Database latency"
              value={data?.database?.latencyMs ?? 0}
              suffix="ms"
            />
            <StatusChip status={data?.database?.status || 'online'} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Pending notifications"
              value={data?.counts?.pendingNotifications ?? 0}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Platform admins"
              value={data?.counts?.activeAdmins ?? 0}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Tenant status alerts">
            {data?.recentTenants?.length ? (
              <Timeline
                items={data.recentTenants.map((tenant) => ({
                  color: tenant.status === 'active' ? 'green' : tenant.status === 'paused' ? 'orange' : 'red',
                  children: (
                    <div>
                      <Text strong>{tenant.name}</Text>{' '}
                      <Tag>{tenant.plan}</Tag>
                      <div>
                        <Text type="secondary">
                          {tenant.status} • {dayjs(tenant.createdAt).fromNow()}
                        </Text>
                      </div>
                    </div>
                  ),
                }))}
              />
            ) : (
              <Text type="secondary">No recent tenants recorded.</Text>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Recent notifications">
            {data?.recentNotifications?.length ? (
              <List
                itemLayout="horizontal"
                dataSource={data.recentNotifications}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{item.title}</span>
                          <Tag color={item.isRead ? 'default' : 'blue'}>
                            {item.type}
                          </Tag>
                        </div>
                      }
                      description={
                        <Text type="secondary">
                          Triggered {dayjs(item.createdAt).fromNow()}
                        </Text>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">No recent notifications logged.</Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AdminHealth;


