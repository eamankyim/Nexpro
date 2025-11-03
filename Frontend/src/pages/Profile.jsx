import { useState } from 'react';
import { Card, Descriptions, Tag, Avatar, Row, Col, Upload, Button, message } from 'antd';
import { UserOutlined, MailOutlined, CrownOutlined, CheckCircleOutlined, CameraOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import dayjs from 'dayjs';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (info) => {
    try {
      setUploading(true);
      const file = info.file.originFileObj;
      
      if (!file) {
        setUploading(false);
        return;
      }

      // Convert file to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = reader.result;
          await userService.update(user.id, { profilePicture: base64String });
          updateUser({ ...user, profilePicture: base64String });
          message.success('Profile picture updated!');
        } catch (error) {
          message.error('Failed to update profile picture');
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      message.error('Failed to upload image');
      setUploading(false);
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return 'red';
      case 'manager':
        return 'blue';
      case 'staff':
        return 'green';
      default:
        return 'default';
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <CrownOutlined />;
      case 'manager':
        return <UserOutlined />;
      case 'staff':
        return <UserOutlined />;
      default:
        return <UserOutlined />;
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Profile</h1>
      
      <Row gutter={[24, 24]}>
        <Col xs={24} md={8}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <Upload
                name="avatar"
                showUploadList={false}
                beforeUpload={() => false}
                onChange={handleImageUpload}
                accept="image/*"
              >
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <Avatar 
                    size={120} 
                    icon={<UserOutlined />}
                    src={user?.profilePicture}
                    style={{ marginBottom: 16, cursor: 'pointer' }}
                  />
                  <Button
                    type="primary"
                    shape="circle"
                    icon={<CameraOutlined />}
                    size="large"
                    style={{
                      position: 'absolute',
                      bottom: 20,
                      right: 0,
                      cursor: 'pointer'
                    }}
                    loading={uploading}
                  />
                </div>
              </Upload>
              <h2 style={{ margin: '8px 0' }}>{user?.name}</h2>
              <Tag color={getRoleColor(user?.role)} icon={getRoleIcon(user?.role)} style={{ fontSize: 14 }}>
                {user?.role?.toUpperCase()}
              </Tag>
            </div>
          </Card>
        </Col>
        
        <Col xs={24} md={16}>
          <Card title="Account Information">
            <Descriptions bordered column={1}>
              <Descriptions.Item label="Full Name">
                <strong>{user?.name}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                <MailOutlined style={{ marginRight: 8 }} />
                {user?.email}
              </Descriptions.Item>
              <Descriptions.Item label="Role">
                <Tag color={getRoleColor(user?.role)} icon={getRoleIcon(user?.role)}>
                  {user?.role?.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={user?.isActive ? 'green' : 'red'} icon={<CheckCircleOutlined />}>
                  {user?.isActive ? 'Active' : 'Inactive'}
                </Tag>
              </Descriptions.Item>
              {user?.profilePicture && (
                <Descriptions.Item label="Profile Picture">
                  <img 
                    src={user.profilePicture} 
                    alt="Profile" 
                    style={{ width: 80, height: 80, borderRadius: 4 }}
                  />
                </Descriptions.Item>
              )}
              {user?.createdAt && (
                <Descriptions.Item label="Member Since">
                  {dayjs(user.createdAt).format('MMMM DD, YYYY')}
                </Descriptions.Item>
              )}
              {user?.lastLogin && (
                <Descriptions.Item label="Last Login">
                  {dayjs(user.lastLogin).format('MMMM DD, YYYY [at] h:mm A')}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Profile;


