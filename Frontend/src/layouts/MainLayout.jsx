import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Typography, theme, Space, Button, Modal, Card, Row, Col, Tag, Switch } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  ShopOutlined,
  FileTextOutlined,
  FileAddOutlined,
  FileDoneOutlined,
  DollarOutlined,
  ShoppingOutlined,
  TagOutlined,
  BarChartOutlined,
  TeamOutlined,
  LogoutOutlined,
  SettingOutlined,
  ContainerOutlined,
  UserSwitchOutlined,
  DownOutlined,
  AppstoreOutlined,
  WalletOutlined,
  DatabaseOutlined,
  FundOutlined,
  CrownOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import './MainLayout.css';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [pricingModalVisible, setPricingModalVisible] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState('monthly'); // 'monthly' or 'yearly'
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin, tenantMemberships = [], activeTenantId, setActiveTenant, activeTenant } = useAuth();
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const tenantMenuItems = tenantMemberships.map((membership) => ({
    key: membership.tenantId,
    label: (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Text strong>{membership.tenant?.name || 'Tenant'}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {(membership.role || 'member').replace(/_/g, ' ')}
        </Text>
      </div>
    ),
  }));

  const handleTenantSelect = ({ key }) => {
    if (key && key !== activeTenantId) {
      setActiveTenant(key);
    }
  };

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/jobs',
      icon: <FileTextOutlined />,
      label: 'Jobs',
    },
    {
      key: '/leads',
      icon: <FileAddOutlined />,
      label: 'Leads',
    },
    {
      key: '/customers',
      icon: <UserOutlined />,
      label: 'Customers',
    },
    {
      key: 'sales-operations',
      icon: <AppstoreOutlined />,
      label: 'Sales & Operations',
      children: [
        {
          key: '/vendors',
          icon: <ShopOutlined />,
          label: 'Vendors',
        },
      ],
    },
    {
      key: 'financial',
      icon: <WalletOutlined />,
      label: 'Financial',
      children: [
        {
          key: '/quotes',
          icon: <FileAddOutlined />,
          label: 'Quotes',
        },
        {
          key: '/invoices',
          icon: <FileDoneOutlined />,
          label: 'Invoices',
        },
        {
          key: '/expenses',
          icon: <ShoppingOutlined />,
          label: 'Expenses',
        },
        {
          key: '/pricing',
          icon: <TagOutlined />,
          label: 'Pricing',
        },
        {
          key: '/payroll',
          icon: <DollarOutlined />,
          label: 'Payroll',
        },
        {
          key: '/accounting',
          icon: <DollarOutlined />,
          label: 'Accounting',
        },
      ],
    },
    {
      key: 'resources',
      icon: <DatabaseOutlined />,
      label: 'Resources',
      children: [
        {
          key: '/inventory',
          icon: <ContainerOutlined />,
          label: 'Inventory',
        },
        {
          key: '/employees',
          icon: <UserSwitchOutlined />,
          label: 'Employees',
        },
      ],
    },
    {
      key: '/reports',
      icon: <BarChartOutlined />,
      label: 'Reports',
    },
    ...(isAdmin ? [{
      key: '/users',
      icon: <TeamOutlined />,
      label: 'Users',
    }] : []),
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Settings',
    },
  ];

  const userMenuItems = [
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
      onClick: () => navigate('/settings'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: () => {
        logout();
        navigate('/login');
      },
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div style={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '0 16px',
          overflow: 'hidden'
        }}>
          <div style={{
            fontSize: collapsed ? 24 : 32,
            fontWeight: 'bold',
            textAlign: 'center',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {collapsed ? (
              <span style={{ color: '#ffffff' }}>NP</span>
            ) : (
              <>
                <span style={{ color: '#ffffff' }}>Nex</span>
                <span style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, rgb(89, 0, 255) 30%, rgb(217, 0, 255) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  display: 'inline-block'
                }}>PRO</span>
              </>
            )}
          </div>
        </div>
        <div style={{ 
          paddingLeft: '16px', 
          paddingRight: '16px' 
        }}>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            defaultOpenKeys={[
              'financial', 
              'resources'
            ]}
            items={menuItems}
            onClick={({ key }) => {
              // Only navigate if it's a route, not a submenu key
              if (key && typeof key === 'string' && key.startsWith('/')) {
                navigate(key);
              }
            }}
          />
        </div>
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 200 }}>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center'
          }}
        >
          <Space align="center" size={16}>
            {/* Upgrade to Pro Button - Only show for trial/free plans */}
            {activeTenant && (activeTenant.plan === 'trial' || activeTenant.plan === 'free') && (
              <Button
                type="primary"
                size="small"
                icon={<CrownOutlined />}
                onClick={() => setPricingModalVisible(true)}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  fontWeight: 500,
                  boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                }}
              >
                Upgrade to Pro
              </Button>
            )}
            <NotificationBell />
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text>{user?.name}</Text>
                <Avatar src={user?.profilePicture} icon={<UserOutlined />} />
              </div>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: '24px 16px', overflow: 'initial' }}>
          <div style={{ 
            maxWidth: '2000px', 
            margin: '0 auto',
            padding: 24, 
            background: colorBgContainer, 
            minHeight: 360, 
            borderRadius: 8 
          }}>
            <Outlet />
          </div>
        </Content>
      </Layout>

      {/* Pricing Modal */}
      <Modal
        title={null}
        open={pricingModalVisible}
        onCancel={() => setPricingModalVisible(false)}
        footer={null}
        width={1200}
        style={{ top: 20, paddingBottom: 0 }}
        bodyStyle={{ padding: '32px 24px', marginBottom: 0 }}
        maskStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, marginBottom: 8, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Choose Your NexPRO Plan
          </h1>
          <p style={{ fontSize: 16, color: '#8c8c8c', margin: 0 }}>Select the perfect plan for your business needs</p>
        </div>

        {/* Billing Period Toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 32, gap: 16 }}>
          <span style={{ fontSize: 14, color: billingPeriod === 'monthly' ? '#667eea' : '#8c8c8c', fontWeight: billingPeriod === 'monthly' ? 600 : 400 }}>Monthly</span>
          <Button
            type={billingPeriod === 'yearly' ? 'primary' : 'default'}
            onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
            style={{
              width: 56,
              height: 32,
              borderRadius: 16,
              border: 'none',
              background: billingPeriod === 'yearly' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f0f0f0',
              position: 'relative',
              padding: 0
            }}
          >
            <div style={{
              position: 'absolute',
              left: billingPeriod === 'monthly' ? 4 : 28,
              top: 4,
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.3s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }} />
          </Button>
          <span style={{ fontSize: 14, color: billingPeriod === 'yearly' ? '#667eea' : '#8c8c8c', fontWeight: billingPeriod === 'yearly' ? 600 : 400 }}>Yearly</span>
          {billingPeriod === 'yearly' && (
            <Tag color="#1890ff" style={{ marginLeft: 8, borderRadius: 12, padding: '2px 8px' }}>
              Save 20%
            </Tag>
          )}
        </div>

        <Row gutter={[20, 20]} justify="center">
          {/* Starter Plan */}
          <Col xs={24} sm={12} lg={6}>
            <Card
              hoverable
              style={{
                height: '100%',
                borderRadius: 12,
                border: '1px solid #e8e8e8',
                textAlign: 'center',
                transition: 'all 0.3s ease',
                position: 'relative',
                boxShadow: 'none'
              }}
              bodyStyle={{ padding: '32px 24px' }}
            >
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 24, fontWeight: 700, margin: 0, marginBottom: 12 }}>Starter</h3>
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', justifyContent: 'center', flexWrap: 'nowrap' }}>
                  <span style={{ fontSize: 32, fontWeight: 700, color: '#262626', whiteSpace: 'nowrap' }}>GHS {billingPeriod === 'yearly' ? Math.round(99 * 12 * 0.8) : '99'}</span>
                  <span style={{ fontSize: 14, color: '#8c8c8c', marginLeft: 4, whiteSpace: 'nowrap' }}>/{billingPeriod === 'yearly' ? 'year' : 'month'}</span>
                </div>
              </div>
              <ul style={{ textAlign: 'left', padding: 0, listStyle: 'none', marginBottom: 32, minHeight: 240 }}>
                <li style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                  <span style={{ fontSize: 14 }}>Up to 5 team members</span>
                </li>
                <li style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                  <span style={{ fontSize: 14 }}>Basic CRM & Job Management</span>
                </li>
                <li style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                  <span style={{ fontSize: 14 }}>10 GB storage</span>
                </li>
                <li style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                  <span style={{ fontSize: 14 }}>Email support</span>
                </li>
                <li style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                  <span style={{ fontSize: 14 }}>Basic reporting</span>
                </li>
              </ul>
              <Button
                block
                size="large"
                style={{
                  height: 48,
                  borderRadius: 8,
                  border: '1px solid #d9d9d9',
                  fontWeight: 600,
                  background: '#fff'
                }}
                onClick={() => {
                  setPricingModalVisible(false);
                  navigate('/checkout', { 
                    state: { 
                      plan: 'starter', 
                      billingPeriod,
                      price: billingPeriod === 'yearly' ? Math.round(99 * 12 * 0.8) : 99
                    } 
                  });
                }}
              >
                Get Started
              </Button>
            </Card>
          </Col>

          {/* Professional Plan - Most Popular */}
          <Col xs={24} sm={12} lg={6}>
            <Card
              hoverable
              style={{
                height: '100%',
                borderRadius: 12,
                border: '2px solid #1890ff',
                textAlign: 'center',
                transition: 'all 0.3s ease',
                position: 'relative',
                boxShadow: '0 4px 12px rgba(24, 144, 255, 0.15)',
                transform: 'scale(1.02)'
              }}
              bodyStyle={{ padding: '32px 24px' }}
            >
              <Tag
                style={{
                  position: 'absolute',
                  top: -12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#1890ff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 12px',
                  fontWeight: 600,
                  fontSize: 11,
                  letterSpacing: '0.5px'
                }}
              >
                MOST POPULAR
              </Tag>
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 24, fontWeight: 700, margin: 0, marginBottom: 12, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Professional</h3>
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', justifyContent: 'center', flexWrap: 'nowrap' }}>
                  <span style={{ fontSize: 32, fontWeight: 700, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', whiteSpace: 'nowrap' }}>GHS {billingPeriod === 'yearly' ? Math.round(199 * 12 * 0.8) : '199'}</span>
                  <span style={{ fontSize: 14, color: '#8c8c8c', marginLeft: 4, whiteSpace: 'nowrap' }}>/{billingPeriod === 'yearly' ? 'year' : 'month'}</span>
                </div>
              </div>
              <ul style={{ textAlign: 'left', padding: 0, listStyle: 'none', marginBottom: 32, minHeight: 240 }}>
                <li style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                  <span style={{ fontSize: 14 }}>Up to 20 team members</span>
                </li>
                <li style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                  <span style={{ fontSize: 14 }}>Advanced CRM & Leads</span>
                </li>
                <li style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                  <span style={{ fontSize: 14 }}>50 GB storage</span>
                </li>
                <li style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                  <span style={{ fontSize: 14 }}>Invoicing & Quotes</span>
                </li>
                <li style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                  <span style={{ fontSize: 14 }}>Priority support</span>
                </li>
                <li style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                  <span style={{ fontSize: 14 }}>Advanced analytics</span>
                </li>
              </ul>
              <Button
                type="primary"
                block
                size="large"
                style={{
                  height: 48,
                  borderRadius: 8,
                  background: '#1890ff',
                  border: 'none',
                  fontWeight: 600
                }}
                onClick={() => {
                  setPricingModalVisible(false);
                  navigate('/checkout', { 
                    state: { 
                      plan: 'professional', 
                      billingPeriod,
                      price: billingPeriod === 'yearly' ? Math.round(199 * 12 * 0.8) : 199
                    } 
                  });
                }}
              >
                Get Started
              </Button>
            </Card>
          </Col>

          {/* Enterprise Plan */}
          <Col xs={24} sm={12} lg={6}>
            <Card
              hoverable
              style={{
                height: '100%',
                borderRadius: 12,
                border: '1px solid #e8e8e8',
                textAlign: 'center',
                transition: 'all 0.3s ease',
                position: 'relative',
                boxShadow: 'none'
              }}
              bodyStyle={{ padding: '32px 24px' }}
            >
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 24, fontWeight: 700, margin: 0, marginBottom: 12 }}>Enterprise</h3>
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', justifyContent: 'center', flexWrap: 'nowrap' }}>
                  <span style={{ fontSize: 32, fontWeight: 700, color: '#262626', whiteSpace: 'nowrap' }}>GHS {billingPeriod === 'yearly' ? Math.round(299 * 12 * 0.8) : '299'}</span>
                  <span style={{ fontSize: 14, color: '#8c8c8c', marginLeft: 4, whiteSpace: 'nowrap' }}>/{billingPeriod === 'yearly' ? 'year' : 'month'}</span>
                </div>
              </div>
              <ul style={{ textAlign: 'left', padding: 0, listStyle: 'none', marginBottom: 32, minHeight: 240 }}>
                <li style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                  <span style={{ fontSize: 14 }}>Unlimited team members</span>
                </li>
                <li style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                  <span style={{ fontSize: 14 }}>All Professional features</span>
                </li>
                <li style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                  <span style={{ fontSize: 14 }}>Unlimited storage</span>
                </li>
                <li style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                  <span style={{ fontSize: 14 }}>24/7 priority support</span>
                </li>
                <li style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                  <span style={{ fontSize: 14 }}>Custom integrations</span>
                </li>
                <li style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                  <span style={{ fontSize: 14 }}>Dedicated account manager</span>
                </li>
              </ul>
              <Button
                block
                size="large"
                style={{
                  height: 48,
                  borderRadius: 8,
                  border: '1px solid #d9d9d9',
                  fontWeight: 600,
                  background: '#fff'
                }}
                onClick={() => {
                  setPricingModalVisible(false);
                  navigate('/checkout', { 
                    state: { 
                      plan: 'enterprise', 
                      billingPeriod,
                      price: billingPeriod === 'yearly' ? Math.round(299 * 12 * 0.8) : 299
                    } 
                  });
                }}
              >
                Get Started
              </Button>
            </Card>
          </Col>
        </Row>
        
        {/* Security Message - Full width at bottom of modal */}
        <div style={{
          margin: '32px -24px -32px -24px',
          padding: '20px 24px',
          background: '#001529',
          color: '#fff',
          textAlign: 'center',
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8,
          width: 'calc(100% + 48px)'
        }}>
          <Text style={{ fontSize: 14, color: '#fff' }}>
            🔒 Secure payment with MoMo or Card • All plans include a 14-day free trial
          </Text>
        </div>
      </Modal>
    </Layout>
  );
};

export default MainLayout;


