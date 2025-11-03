import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Typography, theme } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  ShopOutlined,
  FileTextOutlined,
  FileDoneOutlined,
  DollarOutlined,
  ShoppingOutlined,
  TagOutlined,
  TeamOutlined,
  LogoutOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);
  const [logoError, setLogoError] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  useEffect(() => {
    // Load the logo for dark background (sidebar has dark theme)
    import('../assets/nexus logo for dark bg.png')
      .then((module) => {
        if (module && module.default) {
          setLogoUrl(module.default);
        } else {
          setLogoError(true);
        }
      })
      .catch(() => {
        console.warn('Logo PNG not found. Please ensure nexus logo for dark bg.png is in src/assets/ folder.');
        setLogoError(true);
      });
  }, []);

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/customers',
      icon: <UserOutlined />,
      label: 'Customers',
    },
    {
      key: '/vendors',
      icon: <ShopOutlined />,
      label: 'Vendors',
    },
    {
      key: '/jobs',
      icon: <FileTextOutlined />,
      label: 'Jobs',
    },
    {
      key: '/invoices',
      icon: <FileDoneOutlined />,
      label: 'Invoices',
    },
    {
      key: '/payments',
      icon: <DollarOutlined />,
      label: 'Payments',
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
    ...(isAdmin ? [{
      key: '/users',
      icon: <TeamOutlined />,
      label: 'Users',
    }] : []),
  ];

  const userMenuItems = [
    {
      key: 'profile',
      icon: <SettingOutlined />,
      label: 'Profile',
      onClick: () => navigate('/profile'),
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
          padding: '12px',
          overflow: 'hidden'
        }}>
          {logoUrl && !logoError ? (
            collapsed ? (
              <div style={{
                height: 40,
                width: 40,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <img 
                  src={logoUrl} 
                  alt="NexPRO" 
                  style={{
                    height: '160%',
                    width: 'auto',
                    objectFit: 'contain',
                    objectPosition: 'center',
                    transform: 'translateY(-20%)',
                    marginTop: '-5px',
                    marginBottom: '-5px'
                  }}
                  onError={() => setLogoError(true)}
                />
              </div>
            ) : (
              <div style={{
                height: 50,
                width: '100%',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <img 
                  src={logoUrl} 
                  alt="NexPRO" 
                  style={{
                    height: '160%',
                    width: 'auto',
                    objectFit: 'contain',
                    objectPosition: 'center',
                    transform: 'translateY(-20%)',
                    marginTop: '-8px',
                    marginBottom: '-8px'
                  }}
                  onError={() => setLogoError(true)}
                />
              </div>
            )
          ) : (
            <div style={{
              color: 'white',
              fontSize: collapsed ? 14 : 18,
              fontWeight: 'bold'
            }}>
              {collapsed ? 'NP' : 'NexPRO'}
            </div>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 200 }}>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            boxShadow: '0 1px 4px rgba(0,21,41,.08)',
          }}
        >
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text>{user?.name}</Text>
              <Avatar icon={<UserOutlined />} />
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: '24px 16px', overflow: 'initial' }}>
          <div style={{ padding: 24, background: colorBgContainer, minHeight: 360, borderRadius: 8 }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;


