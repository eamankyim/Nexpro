import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  message,
  Row,
  Typography,
  Space,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './TenantOnboarding.css';

const { Title, Text } = Typography;

const TenantOnboarding = () => {
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, tenantSignup } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const steps = useMemo(
    () => [
      {
        title: 'Get Started',
        description: 'Use your work email to spin up a dedicated NexPRO workspace.',
        fields: ['adminEmail'],
      },
      {
        title: 'Account Owner',
        description: 'Tell us who will manage this workspace day-to-day.',
        fields: ['adminName'],
      },
      {
        title: 'Security',
        description: 'Secure your account with a password.',
        fields: ['password', 'confirmPassword'],
      },
    ],
    []
  );

  const allFields = useMemo(() => steps.flatMap((step) => step.fields), [steps]);
  
  // Set default plan to 'trial' (free plan) for all new signups
  useEffect(() => {
    form.setFieldsValue({ plan: 'trial' });
  }, [form]);

  const heroMessage =
    'NexPRO keeps your entire printing operation connected—from CRM and job tickets to payroll, accounting, and reporting—so every team works from the same, up-to-date truth.';

  const formItemStyle = { marginBottom: 0 };
  const inputStyle = {
    background: 'transparent',
    color: '#EEF2FF',
  };

  // Removed plan selection - all users default to 'trial' plan

  const handleNext = async () => {
    const stepFields = steps[currentStep]?.fields || [];
    try {
      if (stepFields.length > 0) {
        await form.validateFields(stepFields);
      }
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    } catch (error) {
      // validation handled by antd
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  // Plan fetching removed - all users get 'trial' plan by default

  const handleSubmit = async () => {
    try {
      await form.validateFields(allFields);
      const values = form.getFieldsValue(true);
      setSubmitting(true);

      const payload = {
        // Company details are now optional - users can complete profile in Settings
        companyName: values.companyName || 'My Workspace',
        companyEmail: values.companyEmail || values.adminEmail,
        companyPhone: values.companyPhone || '',
        companyWebsite: values.companyWebsite || '',
        plan: values.plan || 'trial', // Default to 'trial' (free plan) if not set
        adminName: values.adminName,
        adminEmail: values.adminEmail,
        password: values.password,
      };

      await tenantSignup(payload);

      message.success('Workspace created! Redirecting to your dashboard...');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (error?.response?.data?.message) {
        message.error(error.response.data.message);
      } else if (error?.message) {
        message.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Removed company details step - users complete profile in Settings after signup

  const renderStepForm = () => {
    switch (currentStep) {
      case 0:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
            <Form.Item
              label={
                <span style={{ color: '#EEF2FF', fontSize: 13, letterSpacing: 0.4 }}>Work email</span>
              }
              name="adminEmail"
              rules={[
                { required: true, message: 'Please enter your work email address' },
                { type: 'email', message: 'Please provide a valid email address' },
              ]}
              style={formItemStyle}
            >
              <Input
                size="large"
                placeholder="alex@nexpro.app"
                autoComplete="email"
                style={inputStyle}
                className="tenant-onboarding-input"
              />
            </Form.Item>

            <Button type="primary" onClick={handleNext} size="large" style={{ width: '100%' }}>
              Continue
            </Button>

            <Text style={{ color: 'rgba(238,242,255,0.65)', fontSize: 13, textAlign: 'center' }}>
              Already have a workspace?{' '}
              <a href="/login" style={{ color: '#A5B4FC' }}>
                Sign in
              </a>
            </Text>
          </div>
        );
      case 1:
        return (
          <>
            <Form.Item
              label={
                <span style={{ color: '#EEF2FF', fontSize: 13, letterSpacing: 0.4 }}>Full name</span>
              }
              name="adminName"
              rules={[
                { required: true, message: 'Please enter your full name' },
                { min: 2, message: 'Name must be at least 2 characters' },
              ]}
              style={formItemStyle}
            >
              <Input
                size="large"
                placeholder="Jane Doe"
                autoComplete="name"
                style={inputStyle}
                className="tenant-onboarding-input"
              />
            </Form.Item>
          </>
        );
      case 2:
        return (
          <>
            <Form.Item
              label={<span style={{ color: '#EEF2FF', fontSize: 13, letterSpacing: 0.4 }}>Password</span>}
              name="password"
              rules={[
                { required: true, message: 'Please create a password' },
                { min: 8, message: 'Password must be at least 8 characters long' },
              ]}
              style={formItemStyle}
            >
              <Input.Password
                size="large"
                placeholder="••••••••"
                autoComplete="new-password"
                style={inputStyle}
                className="tenant-onboarding-input"
              />
            </Form.Item>

            <Form.Item
              label={
                <span style={{ color: '#EEF2FF', fontSize: 13, letterSpacing: 0.4 }}>Confirm password</span>
              }
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Please confirm your password' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Passwords do not match'));
                  },
                }),
              ]}
              style={formItemStyle}
            >
              <Input.Password
                size="large"
                placeholder="Re-enter password"
                autoComplete="new-password"
                style={inputStyle}
                className="tenant-onboarding-input"
              />
            </Form.Item>
          </>
        );
      default:
        return null;
    }
  };

  const totalSteps = steps.length;
  const stepNumbers = useMemo(() => Array.from({ length: totalSteps }, (_, i) => i), [totalSteps]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--color-bg)',
        position: 'relative',
        color: '#EEF2FF',
      }}
    >
      <div
        style={{
          position: 'fixed',
          inset: '-30vh -30vw 0 -30vw',
          background: 'var(--gradient-background)',
          zIndex: 0,
        }}
      />

      <div style={{ padding: '24px 32px' }}>
        <Button
          type="link"
          onClick={() => navigate('/')}
          style={{ padding: 0, color: 'rgba(238,242,255,0.65)' }}
        >
          ← Back to NexPRO
        </Button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {stepNumbers.map((stepIndex) => {
            const isActive = stepIndex === currentStep;
            const isCompleted = stepIndex < currentStep;
            return (
              <div
                key={stepIndex}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: 16,
                  color: '#EEF2FF',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(99,102,241,0.85), rgba(129,140,248,0.45))'
                    : isCompleted
                    ? 'rgba(99,102,241,0.4)'
                    : 'rgba(255,255,255,0.08)',
                  border: isActive
                    ? '1px solid rgba(188, 197, 255, 0.9)'
                    : '1px solid rgba(118,125,255,0.3)',
                  boxShadow: isActive ? '0 12px 30px rgba(99,102,241,0.35)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {stepIndex + 1}
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 16px 48px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Card
          style={{
            width: '100%',
            maxWidth: 960,
            background: 'var(--color-surface)',
            border: '1px solid rgba(118, 125, 255, 0.2)',
            borderRadius: 28,
            padding: '32px 40px',
            boxShadow: '0 40px 140px rgba(5,5,25,0.65)',
          }}
          bodyStyle={{ padding: 0 }}
        >
          <Row gutter={[48, 32]}>
            {(
              <Col xs={24} md={10}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          background: 'rgba(99,102,241,0.16)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 22,
                          fontWeight: 600,
                          color: '#EEF2FF',
                        }}
                      >
                        NP
                      </div>
                      <div>
                        <Text style={{ color: 'rgba(238,242,255,0.7)', fontSize: 13 }}>
                          NexPRO Tenant Onboarding
                        </Text>
                        <Title level={3} style={{ color: '#EEF2FF', margin: 0 }}>
                          Sign up your workspace
                        </Title>
                      </div>
                    </div>

                    <Space direction="vertical" size={18} style={{ width: '100%' }}>
                      <div
                        style={{
                          padding: '18px 20px',
                          borderRadius: 16,
                          border: '1px solid rgba(118,125,255,0.15)',
                          background: 'rgba(18,21,43,0.55)',
                          backdropFilter: 'blur(16px)',
                          color: 'rgba(238,242,255,0.75)',
                          lineHeight: 1.7,
                        }}
                      >
                        {heroMessage}
                      </div>
                    </Space>
                  </div>

                  <div
                    style={{
                      marginTop: 'auto',
                      padding: '16px 18px',
                      borderRadius: 18,
                      border: '1px solid rgba(118,125,255,0.15)',
                      background: 'rgba(18, 21, 43, 0.6)',
                      color: 'rgba(238,242,255,0.7)',
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}
                  >
                    By creating a workspace, you acknowledge you’ve read and agree to our{' '}
                    <a href="/terms" style={{ color: '#A5B4FC' }}>
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a href="/privacy" style={{ color: '#A5B4FC' }}>
                      Privacy Policy
                    </a>
                    .
                  </div>
                </div>
              </Col>
            )}

            <Col xs={24} md={14}>
              <div
                style={{
                  background: 'rgba(6, 9, 26, 0.82)',
                  borderRadius: 18,
                  border: '1px solid rgba(118,125,255,0.18)',
                  padding: 32,
                  minHeight: 360,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 24,
                  color: '#EEF2FF',
                }}
              >
                <div>
                  <Title level={4} style={{ marginBottom: 6, color: '#EEF2FF' }}>
                    {steps[currentStep].title}
                  </Title>
                  <Text style={{ color: 'rgba(238,242,255,0.65)' }}>
                    {steps[currentStep].description}
                  </Text>
                </div>

                <Form
                  form={form}
                  layout="vertical"
                  initialValues={{
                    plan: 'trial',
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    position: 'relative',
                    paddingBottom: 72,
                  }}
                >
                  {renderStepForm()}

                  {currentStep > 0 && (
                    <Button
                      type="text"
                      onClick={handlePrev}
                      style={{
                        position: 'absolute',
                        left: 0,
                        bottom: 16,
                        padding: 0,
                        color: 'rgba(238,242,255,0.65)',
                      }}
                    >
                      ← Back
                    </Button>
                  )}

                  {currentStep > 0 && (
                    <div
                      style={{
                        marginTop: 16,
                        marginBottom: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                      }}
                    >
                      {currentStep < steps.length - 1 ? (
                        <Button
                          type="primary"
                          onClick={handleNext}
                          size="large"
                          style={{ width: '100%' }}
                        >
                          Continue
                        </Button>
                      ) : (
                        <Button
                          type="primary"
                          onClick={handleSubmit}
                          loading={submitting}
                          size="large"
                          style={{ width: '100%' }}
                        >
                          Create workspace
                        </Button>
                      )}
                    </div>
                  )}
                </Form>
              </div>
            </Col>
          </Row>
        </Card>
      </div>

      <div
        style={{
          padding: '16px 32px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'rgba(238,242,255,0.45)',
          fontSize: 12,
          flexWrap: 'wrap',
          gap: 12,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <span>© {new Date().getFullYear()} NexPRO. All rights reserved.</span>
        <span>Need help? support@nexpro.app</span>
      </div>
    </div>
  );
};

export default TenantOnboarding;

