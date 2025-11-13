import { Layout, Menu, Typography, Space, Avatar, Dropdown, Button } from 'antd';
import {
  BarChartOutlined,
  TeamOutlined,
  SettingOutlined,
  DollarOutlined,
  AlertOutlined,
  FileSearchOutlined
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  {
    key: '/admin',
    icon: <BarChartOutlined />,
    label: 'Overview',
  },
  {
    key: '/admin/tenants',
    icon: <TeamOutlined />,
    label: 'Tenants',
  },
  {
    key: '/admin/billing',
    icon: <DollarOutlined />,
    label: 'Billing',
  },
  {
    key: '/admin/reports',
    icon: <FileSearchOutlined />,
    label: 'Reports',
  },
  {
    key: '/admin/health',
    icon: <AlertOutlined />,
    label: 'System Health',
  },
  {
    key: '/admin/settings',
    icon: <SettingOutlined />,
    label: 'Settings',
  },
];

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleMenuClick = ({ key }) => {
    if (key === 'profile') {
      navigate('/profile');
    }
    if (key === 'logout') {
      logout();
      navigate('/login');
    }
  };

  const userMenuItems = [
    {
      key: 'profile',
      label: 'Profile',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      label: 'Logout',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={220}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div
          style={{
            height: 64,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            color: '#fff',
            fontWeight: 600,
            fontSize: 18,
            letterSpacing: 0.5,
          }}
        >
          NexPRO Control Center
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderInlineEnd: 'none' }}
        />
      </Sider>
      <Layout style={{ marginLeft: 220 }}>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <div />
          <Space size={12}>
            <Dropdown
              menu={{ items: userMenuItems, onClick: handleMenuClick }}
              placement="bottomRight"
            >
              <Button
                type="text"
                style={{ padding: 0, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Avatar src={user?.profilePicture}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
                </Avatar>
              </Button>
            </Dropdown>
            <Text strong>{user?.name}</Text>
          </Space>
        </Header>
        <Content style={{ margin: '24px', overflow: 'initial' }}>
          <div style={{ padding: 24, background: '#fff', minHeight: 360, borderRadius: 8 }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;

 