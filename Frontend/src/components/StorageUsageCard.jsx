import { useState, useEffect } from 'react';
import { Card, Progress, Statistic, Row, Col, Alert, Button, Tag, Tooltip, Space } from 'antd';
import { Cloud, Info, Rocket, Database } from 'lucide-react';
import inviteService from '../services/inviteService';

/**
 * Reusable component to display storage usage and limits
 */
function StorageUsageCard({ style, showUpgradeButton = true }) {
  const [storageUsage, setStorageUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStorageUsage = async () => {
      try {
        setLoading(true);
        const response = await inviteService.getStorageUsage();
        if (response?.success) {
          setStorageUsage(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch storage usage:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStorageUsage();
  }, []);

  if (loading) {
    return (
      <Card style={style} loading>
        <Statistic title="Storage Used" value={0} prefix={<DatabaseOutlined />} suffix="GB" />
      </Card>
    );
  }

  if (!storageUsage) {
    return null;
  }

  const {
    currentGB,
    limitGB,
    remainingGB,
    percentageUsed,
    isUnlimited,
    isNearLimit,
    isAtLimit,
    canUploadMore,
    planName,
    price100GB
  } = storageUsage;

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
          <Cloud className="h-4 w-4" />
          <span>Storage Usage</span>
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
          message="Unlimited Storage"
          description={`Your ${planName} plan includes unlimited file storage.`}
          type="success"
          showIcon
          icon={<Cloud className="h-4 w-4" />}
        />
      ) : (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Statistic
                title="Used"
                value={currentGB}
                suffix="GB"
                prefix={<Database className="h-4 w-4" />}
                valueStyle={{ color: isAtLimit ? '#cf1322' : '#3f8600' }}
                precision={2}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Total Limit"
                value={limitGB}
                suffix="GB"
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Available"
                value={remainingGB}
                suffix="GB"
                valueStyle={{ color: parseFloat(remainingGB) > 0 ? '#3f8600' : '#cf1322' }}
                precision={2}
              />
            </Col>
          </Row>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Storage Usage</span>
              <span>
                <strong>{currentGB} GB</strong> of <strong>{limitGB} GB</strong> ({percentageUsed}%)
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
              message="Storage Limit Reached"
              description={
                price100GB ? (
                  <span>
                    You've used {currentGB} GB of your {limitGB} GB limit. 
                    Add more storage for <strong>GHS {price100GB} per 100GB</strong> or upgrade your plan.
                  </span>
                ) : (
                  <span>
                    You've used {currentGB} GB of your {limitGB} GB limit. 
                    Please upgrade your plan for more storage.
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
              message="Storage Running Low"
              description={`Only ${remainingGB} GB remaining (${100 - percentageUsed}% available). Consider upgrading soon.`}
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {price100GB && canUploadMore && (
            <div style={{ 
              padding: 12, 
              background: '#f0f5ff', 
              borderRadius: 6,
              marginTop: 12 
            }}>
              <Tooltip title="Add storage beyond your base limit">
                <Info className="h-4 w-4" style={{ marginRight: 8, color: '#166534' }} />
                <span style={{ fontSize: 13 }}>
                  Need more storage? Add 100GB for <strong>GHS {price100GB}</strong>
                </span>
              </Tooltip>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export default StorageUsageCard;

