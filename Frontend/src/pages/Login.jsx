import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Typography } from 'antd';
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { showSuccess, showError } from '../utils/toast';
import './Login.css';

const gradientLayerStyles = {
  position: 'fixed',
  inset: '-30vh -30vw 0 -30vw',
  background: 'var(--gradient-background)',
  zIndex: 0,
};

const glassPanelStyles = {
  width: 500,
  background: 'var(--color-surface)',
  border: '1px solid rgba(118, 125, 255, 0.2)',
  borderRadius: 24,
  padding: '40px 40px 32px',
  boxShadow: '0 40px 110px -60px rgba(5, 8, 20, 0.85)',
  backdropFilter: 'blur(22px)',
  position: 'relative',
  zIndex: 1,
};

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
      const response = await login(values);
      const payload = response?.data || response || {};
      showSuccess('Login successful!');
      const user = payload?.user;
      if (user?.isPlatformAdmin) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      // Show clear error message for login failures
      showError(error, 'Invalid email or password. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg)',
        position: 'relative',
        padding: '48px 16px',
        overflow: 'hidden',
        color: '#EEF2FF',
      }}
    >
      <div style={gradientLayerStyles} />

      <div style={glassPanelStyles}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          {logoUrl && !logoError ? (
            <div
              style={{
                height: 72,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <img
                src={logoUrl}
                alt="Logo"
                style={{ height: '100%', width: 'auto', objectFit: 'contain' }}
                onError={() => setLogoError(true)}
              />
            </div>
          ) : (
            <Title level={2} style={{ marginBottom: 8, color: '#EEF2FF' }}>
              NexPRO OS
            </Title>
          )}
          <Text style={{ color: 'var(--color-muted)', fontSize: 13 }}>
            Studio Management System
          </Text>
        </div>

        <Title level={3} style={{ marginBottom: 8, color: 'var(--color-on-dark)' }}>
          Welcome back
        </Title>
        <Text style={{ color: 'rgba(238,242,255,0.68)', display: 'block', marginBottom: 24 }}>
          Sign in to manage your workspace and keep every job on track.
        </Text>

        <Form
          name="login"
          onFinish={onFinish}
          layout="vertical"
          size="large"
          requiredMark={false}
        >
          <Form.Item
            label={<span style={{ color: 'rgba(238,242,255,0.8)' }}>Work email</span>}
            name="email"
            rules={[
              { required: true, message: 'Please input your email!' },
              { type: 'email', message: 'Please enter a valid email!' }
            ]}
          >
            <Input
              placeholder="you@company.com"
              style={{
                background: 'rgba(12, 16, 32, 0.5)',
                border: '1px solid rgba(118,125,255,0.35)',
                color: 'var(--color-on-dark)',
                borderRadius: 10,
              }}
              className="auth-input"
            />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: 'rgba(238,242,255,0.8)' }}>Password</span>}
            name="password"
            rules={[{ required: true, message: 'Please input your password!' }]}
          >
            <Input.Password
              placeholder="Enter password"
              style={{
                background: 'rgba(12, 16, 32, 0.5)',
                border: '1px solid rgba(118,125,255,0.35)',
                color: 'var(--color-on-dark)',
                borderRadius: 10,
              }}
              className="auth-input"
              iconRender={(visible) =>
                visible ? (
                  <EyeOutlined style={{ color: '#EEF2FF' }} />
                ) : (
                  <EyeInvisibleOutlined style={{ color: '#EEF2FF' }} />
                )
              }
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              style={{
                background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-strong))',
                border: 'none',
                height: 48,
                fontWeight: 600,
              }}
            >
              Log in
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Text style={{ color: 'rgba(238,242,255,0.6)', fontSize: 12 }}>
            Having trouble signing in? Contact your administrator.
          </Text>
          <div style={{ marginTop: 8 }}>
            <Text style={{ color: 'rgba(238,242,255,0.6)', fontSize: 12 }}>
              Don't have an account yet?{' '}
              <a href="/onboarding" style={{ color: '#A5B4FC' }}>
                Sign up here
              </a>
            </Text> `22222282``222`
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;


