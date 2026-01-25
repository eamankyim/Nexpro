import { useState, useEffect } from 'react';
import { Card, Progress, Statistic, Row, Col, Alert, Button, Tag, Tooltip, Space } from 'antd';
import { Users, Info, Rocket } from 'lucide-react';
import inviteService from '../services/inviteService';

/**
 * Reusable component to display seat usage and limits
 */
function SeatUsageCard({ style, size = 'default', showUpgradeButton = true }) {
  const [seatUsage, setSeatUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSeatUsage = async () => {
      try {
        setLoading(true);
        const response = await inviteService.getSeatUsage();
        if (response?.success) {
          setSeatUsage(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch seat usage:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSeatUsage();
  }, []);

  if (loading) {
    return (
      <Card style={style} loading>
        <Statistic title="Team Members" value={0} prefix={<TeamOutlined />} />
      </Card>
    );
  }

  if (!seatUsage) {
    return null;
  }

  const {
    current,
    limit,
    remaining,
    percentageUsed,
    isUnlimited,
    isNearLimit,
    isAtLimit,
    canAddMore,
    planName,
    pricePerAdditional
  } = seatUsage;

  // Determine progress bar color
  const getProgressStatus = () => {
    if (isUnlimited) return 'normal';
    if (isAtLimit) return 'exception';
    if (isNearLimit) return 'warning';
    return 'success';
  };

  return (
    <Card 
      title={
        <Space>
          <Users className="h-4 w-4" />
          <span>Team Seats</span>
          {planName && (
            <Tag color="#166534" style={{ marginLeft: 8 }}>
              {planName} Plan
            </Tag>
          )}
        </Space>
      }
      style={style}
      extra={
        isUnlimited ? (
          <Tag color="green" icon={<Info className="h-4 w-4" />}>
            Unlimited
          </Tag>
        ) : null
      }
    >
      {isUnlimited ? (
        <Alert
          message="Unlimited Seats"
          description={`You can invite as many team members as needed on your ${planName} plan.`}
          type="success"
          showIcon
          icon={<TeamOutlined />}
        />
      ) : (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Statistic
                title="Active Users"
                value={current}
                prefix={<TeamOutlined />}
                valueStyle={{ color: isAtLimit ? '#cf1322' : '#3f8600' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Total Seats"
                value={limit}
                suffix="seats"
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Available"
                value={remaining}
                valueStyle={{ color: remaining > 0 ? '#3f8600' : '#cf1322' }}
                suffix="seats"
              />
            </Col>
          </Row>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Seat Usage</span>
              <span>
                <strong>{current}</strong> of <strong>{limit}</strong> ({percentageUsed}%)
              </span>
            </div>
            <Progress 
              percent={percentageUsed} 
              status={getProgressStatus()}
              showInfo={false}
            />
          </div>

          {isAtLimit && (
            <Alert
              message="Seat Limit Reached"
              description={
                pricePerAdditional ? (
                  <span>
                    You've reached your {limit}-seat limit. 
                    Add more seats for <strong>GHS {pricePerAdditional}</strong> per user or upgrade your plan.
                  </span>
                ) : (
                  <span>
                    You've reached your {limit}-seat limit. 
                    Please upgrade your plan to add more team members.
                  </span>
                )
              }
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
              action={
                showUpgradeButton && (
                  <Button size="small" type="primary" icon={<Rocket className="h-4 w-4" />}>
                    Upgrade Plan
                  </Button>
                )
              }
            />
          )}

          {isNearLimit && !isAtLimit && (
            <Alert
              message="Running Low on Seats"
              description={`Only ${remaining} seat${remaining > 1 ? 's' : ''} remaining. Consider upgrading soon.`}
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {pricePerAdditional && canAddMore && (
            <div style={{ 
              padding: 12, 
              background: '#f0f5ff', 
              borderRadius: 6,
              marginTop: 12 
            }}>
              <Tooltip title="Add seats beyond your base limit">
                <Info className="h-4 w-4" style={{ marginRight: 8, color: '#166534' }} />
                <span style={{ fontSize: 13 }}>
                  Need more seats? Add them for <strong>GHS {pricePerAdditional}</strong> per user
                </span>
              </Tooltip>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export default SeatUsageCard;

