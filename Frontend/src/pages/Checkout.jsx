import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Button,
  Row,
  Col,
  Typography,
  Divider,
  Radio,
  Space,
  Alert,
  message,
  Spin
} from 'antd';
import {
  CreditCardOutlined,
  MobileOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useMutation } from '@tanstack/react-query';
import settingsService from '../services/settingsService';

const { Title, Text } = Typography;

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeTenant } = useAuth();
  const [form] = Form.useForm();
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [loading, setLoading] = useState(false);

  // Get plan details from navigation state
  const planData = location.state || {
    plan: 'starter',
    billingPeriod: 'monthly',
    price: 99
  };

  const { plan, billingPeriod, price } = planData;

  // Calculate prices
  const monthlyPrice = {
    starter: 99,
    professional: 199,
    enterprise: 299
  };

  const yearlyPrice = {
    starter: Math.round(monthlyPrice.starter * 12 * 0.8), // 950
    professional: Math.round(monthlyPrice.professional * 12 * 0.8), // 1910
    enterprise: Math.round(monthlyPrice.enterprise * 12 * 0.8) // 2870
  };

  const finalPrice = billingPeriod === 'yearly' ? yearlyPrice[plan] : monthlyPrice[plan];
  const planNames = {
    starter: 'Starter',
    professional: 'Professional',
    enterprise: 'Enterprise'
  };

  const upgradeMutation = useMutation({
    mutationFn: async (payload) => {
      return await settingsService.updateSubscription(payload);
    },
    onSuccess: () => {
      message.success('Subscription upgraded successfully!');
      navigate('/settings?tab=subscription');
    },
    onError: (error) => {
      message.error(error?.response?.data?.message || 'Failed to upgrade subscription');
    }
  });

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      
      // Calculate subscription end date
      const currentDate = new Date();
      const periodEnd = new Date(currentDate);
      
      if (billingPeriod === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      const payload = {
        plan: plan,
        status: 'active',
        billingPeriod: billingPeriod,
        currentPeriodEnd: periodEnd.toISOString(),
        paymentMethod: {
          type: paymentMethod,
          ...(paymentMethod === 'card' ? {
            brand: values.cardBrand || 'visa',
            last4: values.cardNumber?.slice(-4) || '0000',
            expMonth: values.expMonth || '12',
            expYear: values.expYear || '2025'
          } : {
            phone: values.phoneNumber || ''
          })
        },
        amount: finalPrice,
        currency: 'GHS'
      };

      await upgradeMutation.mutateAsync(payload);
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!plan || !billingPeriod) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <Alert
          message="No Plan Selected"
          description="Please select a plan from the pricing page to continue."
          type="warning"
          showIcon
          action={
            <Button onClick={() => navigate('/settings?tab=subscription')}>
              Go to Pricing
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px' }}>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 24 }}
      >
        Back
      </Button>

      <Title level={2} style={{ marginBottom: 8 }}>Checkout</Title>
      <Text type="secondary" style={{ marginBottom: 32, display: 'block' }}>
        Complete your subscription upgrade
      </Text>

      <Row gutter={24}>
        {/* Order Summary */}
        <Col xs={24} lg={10}>
          <Card title="Order Summary" style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text strong>Plan:</Text>
                <Text>{planNames[plan]}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text strong>Billing:</Text>
                <Text>{billingPeriod === 'yearly' ? 'Yearly' : 'Monthly'}</Text>
              </div>
              {billingPeriod === 'yearly' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text type="success">Savings:</Text>
                  <Text type="success">20% off</Text>
                </div>
              )}
              <Divider style={{ margin: '16px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text strong style={{ fontSize: 16 }}>Total:</Text>
                <Text strong style={{ fontSize: 20, color: '#1890ff' }}>
                  GHS {finalPrice}
                </Text>
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {billingPeriod === 'yearly' 
                  ? `Billed annually (GHS ${Math.round(finalPrice / 12)}/month)` 
                  : 'Billed monthly'}
              </Text>
            </div>

            <Alert
              message="14-Day Free Trial"
              description="Your subscription includes a 14-day free trial. You won't be charged until the trial period ends."
              type="info"
              showIcon
              style={{ marginTop: 16 }}
            />
          </Card>
        </Col>

        {/* Payment Form */}
        <Col xs={24} lg={14}>
          <Card title="Payment Information">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
            >
              <Form.Item label="Payment Method" required>
                <Radio.Group
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Radio value="card" style={{ width: '100%', padding: '12px', border: '1px solid #d9d9d9', borderRadius: 8 }}>
                      <Space>
                        <CreditCardOutlined />
                        <span>Credit/Debit Card</span>
                      </Space>
                    </Radio>
                    <Radio value="momo" style={{ width: '100%', padding: '12px', border: '1px solid #d9d9d9', borderRadius: 8 }}>
                      <Space>
                        <MobileOutlined />
                        <span>Mobile Money (MoMo)</span>
                      </Space>
                    </Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>

              {paymentMethod === 'card' && (
                <>
                  <Form.Item
                    name="cardNumber"
                    label="Card Number"
                    rules={[
                      { required: true, message: 'Please enter card number' },
                      { pattern: /^\d{13,19}$/, message: 'Invalid card number' }
                    ]}
                  >
                    <Input
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      prefix={<CreditCardOutlined />}
                    />
                  </Form.Item>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="expMonth"
                        label="Expiry Month"
                        rules={[{ required: true, message: 'Required' }]}
                      >
                        <Input placeholder="MM" maxLength={2} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="expYear"
                        label="Expiry Year"
                        rules={[{ required: true, message: 'Required' }]}
                      >
                        <Input placeholder="YYYY" maxLength={4} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    name="cardName"
                    label="Cardholder Name"
                    rules={[{ required: true, message: 'Please enter cardholder name' }]}
                  >
                    <Input placeholder="John Doe" />
                  </Form.Item>

                  <Form.Item
                    name="cvv"
                    label="CVV"
                    rules={[
                      { required: true, message: 'Please enter CVV' },
                      { pattern: /^\d{3,4}$/, message: 'Invalid CVV' }
                    ]}
                  >
                    <Input placeholder="123" maxLength={4} type="password" />
                  </Form.Item>
                </>
              )}

              {paymentMethod === 'momo' && (
                <Form.Item
                  name="phoneNumber"
                  label="Mobile Money Number"
                  rules={[
                    { required: true, message: 'Please enter MoMo number' },
                    { pattern: /^0\d{9}$/, message: 'Invalid MoMo number (e.g., 0244123456)' }
                  ]}
                >
                  <Input
                    placeholder="0244123456"
                    prefix={<MobileOutlined />}
                    maxLength={10}
                  />
                </Form.Item>
              )}

              <Divider />

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  size="large"
                  loading={loading || upgradeMutation.isLoading}
                  style={{
                    height: 48,
                    fontSize: 16,
                    fontWeight: 600,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none'
                  }}
                >
                  Complete Purchase - GHS {finalPrice}
                </Button>
              </Form.Item>

              <Text type="secondary" style={{ fontSize: 12, textAlign: 'center', display: 'block' }}>
                By completing this purchase, you agree to our Terms of Service and Privacy Policy
              </Text>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Checkout;

