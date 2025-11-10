import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Typography, theme } from 'antd';
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
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const {
    token: { colorBgContainer },
  } = theme.useToken();

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
          padding: '0 0px',
          paddingLeft: collapsed ? '8px' : '16px',
          paddingRight: collapsed ? '8px' : '16px',
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
          paddingLeft: collapsed ? '8px' : '16px', 
          paddingRight: collapsed ? '8px' : '16px' 
        }}>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
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


