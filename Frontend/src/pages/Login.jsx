import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const { Text, Title } = Typography;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);
  const [logoError, setLogoError] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    // Load the logo for light background (login page has light card)
    import('../assets/nexus logo for dark bg.png')
      .then((module) => {
        if (module && module.default) {
          setLogoUrl(module.default);
        } else {
          setLogoError(true);
        }
      })
      .catch(() => {
        console.warn('Logo PNG not found. Please ensure nexus logo for light bg.png is in src/assets/ folder.');
        setLogoError(true);
      });
  }, []);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await login(values);
      message.success('Login successful!');
      navigate('/dashboard');
    } catch (error) {
      message.error(error.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(60deg,rgb(15, 30, 100) 0%,rgb(0, 59, 131) 100%)',
    }}>
      <Card style={{ width: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {logoUrl && !logoError ? (
            <div style={{
              height: 80,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
              position: 'relative'
            }}>
              <img 
                src={logoUrl} 
                alt="NexPRO Logo" 
                style={{
                  height: '160%',
                  width: 'auto',
                  objectFit: 'contain',
                  objectPosition: 'center',
                  transform: 'translateY(-20%)',
                  marginTop: '10px',
                  marginBottom: '-60px'
                }}
                onError={() => setLogoError(true)}
              />
            </div>
          ) : (
            <Title level={2} style={{ marginBottom: 0 }}>
              <span style={{ color: '#003366', fontWeight: 'bold' }}>Nex</span>
              <span style={{ 
                background: 'linear-gradient(135deg, #ff1493 0%, #8a2be2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontWeight: 'bold'
              }}>PRO</span>
            </Title>
          )}
          <Text type="secondary">Studio Management System</Text>
        </div>

        <Form
          name="login"
          onFinish={onFinish}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Please input your email!' },
              { type: 'email', message: 'Please enter a valid email!' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please input your password!' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Password"
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Log in
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Having issue login? Contact your administrator.
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default Login;


