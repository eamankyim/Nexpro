import { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  message,
  Upload,
  Avatar,
  Space,
  Typography,
  Alert,
  Divider
} from 'antd';
import {
  LockOutlined,
  UserOutlined,
  UploadOutlined,
  CameraOutlined
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';

const { Title, Text } = Typography;

const ForcePasswordChange = ({ visible, onComplete }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const { user, updateUser } = useAuth();

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      
      const updateData = {
        password: values.newPassword,
        profilePicture: profilePicture,
        isFirstLogin: false
      };

      await userService.update(user.id, updateData);
      
      // Update user context
      updateUser({
        ...user,
        isFirstLogin: false,
        profilePicture: profilePicture
      });

      message.success('Profile updated successfully! Welcome to NexPro!');
      onComplete();
    } catch (error) {
      message.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (info) => {
    if (info.file.status === 'done') {
      setProfilePicture(info.file.response?.url || info.file.url);
    }
  };

  const uploadProps = {
    name: 'file',
    action: '/api/upload', // You'll need to implement this endpoint
    headers: {
      authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    onChange: handleImageUpload,
    showUploadList: false,
  };

  return (
    <Modal
      title={
        <Space>
          <LockOutlined />
          <span>Complete Your Profile</span>
        </Space>
      }
      open={visible}
      closable={false}
      maskClosable={false}
      footer={null}
      width={600}
      centered
    >
      <Alert
        message="Welcome to NexPro!"
        description="Please complete your profile setup by changing your password and adding a profile picture."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          name: user?.name,
          email: user?.email
        }}
      >
        {/* Profile Picture Section */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={4}>Profile Picture</Title>
          <Space direction="vertical" align="center">
            <Avatar
              size={100}
              src={profilePicture}
              icon={<UserOutlined />}
              style={{ marginBottom: 16 }}
            />
            <Upload {...uploadProps}>
              <Button icon={<CameraOutlined />}>
                Upload Profile Picture
              </Button>
            </Upload>
            <Text type="secondary">
              Click to upload a profile picture (optional)
            </Text>
          </Space>
        </div>

        <Divider />

        {/* Password Change Section */}
        <Title level={4}>Change Your Password</Title>
        <Text type="secondary" style={{ marginBottom: 16, display: 'block' }}>
          You must change your default password for security reasons.
        </Text>

        <Form.Item
          name="newPassword"
          label="New Password"
          rules={[
            { required: true, message: 'Please enter new password' },
            { min: 6, message: 'Password must be at least 6 characters' },
            {
              pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
              message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
            }
          ]}
        >
          <Input.Password 
            placeholder="Enter new password"
            prefix={<LockOutlined />}
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="Confirm New Password"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: 'Please confirm new password' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('Passwords do not match'));
              },
            }),
          ]}
        >
          <Input.Password 
            placeholder="Confirm new password"
            prefix={<LockOutlined />}
          />
        </Form.Item>

        <Form.Item>
          <Button 
            type="primary" 
            htmlType="submit" 
            loading={loading}
            block
            size="large"
          >
            Complete Setup & Continue
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ForcePasswordChange;
