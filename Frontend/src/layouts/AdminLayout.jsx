import { Layout, Menu, Typography, Space, Avatar, Dropdown, Button } from 'antd';
import {
  BarChart3,
  Users,
  Settings,
  DollarSign,
  AlertTriangle,
  FileSearch,
  Link as LinkIcon,
  Search,
} from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SmartSearchProvider, useSmartSearch } from '../context/SmartSearchContext';
import { Input } from '@/components/ui/input';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

function AdminHeaderSearch() {
  const { placeholder, scope, searchValue, setSearchValue } = useSmartSearch();
  return (
    <div className="relative flex-1 max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        key={scope}
        type="search"
        placeholder={placeholder}
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        className="pl-10 w-full"
        style={{ borderRadius: '32px' }}
      />
    </div>
  );
}

const menuItems = [
  {
    key: '/admin',
    icon: <BarChart3 className="h-4 w-4" />,
    label: 'Overview',
  },
  {
    key: '/admin/tenants',
    icon: <Users className="h-4 w-4" />,
    label: 'Tenants',
  },
  {
    key: '/admin/billing',
    icon: <DollarSign className="h-4 w-4" />,
    label: 'Billing',
  },
  {
    key: '/admin/reports',
    icon: <FileSearch className="h-4 w-4" />,
    label: 'Reports',
  },
  {
    key: '/admin/health',
    icon: <AlertTriangle className="h-4 w-4" />,
    label: 'System Health',
  },
  {
    key: '/admin/settings',
    icon: <Settings className="h-4 w-4" />,
    label: 'Settings',
  },
];

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleNavigateToSabito = () => {
    const token = localStorage.getItem('token');
    const sabitoUrl = import.meta.env.VITE_SABITO_URL || 'http://localhost:5175';
    const url = token 
      ? `${sabitoUrl}?nexproToken=${token}`
      : sabitoUrl;
    // Navigate to Sabito in the same window
    window.location.href = url;
  };

  const handleMenuClick = ({ key }) => {
    if (key === 'profile') {
      navigate('/profile');
    }
    if (key === 'sabito') {
      handleNavigateToSabito();
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
      key: 'sabito',
      label: 'Open Sabito',
      icon: <LinkIcon className="h-4 w-4" />,
      onClick: handleNavigateToSabito,
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
          ShopWISE Control Center
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
      <SmartSearchProvider>
        <Layout style={{ marginLeft: 220 }}>
          <Header
            style={{
              padding: '0 24px',
              background: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
              borderBottom: '1px solid #f0f0f0',
            }}
          >
            <div style={{ flex: 1, maxWidth: 400, minWidth: 200 }}>
              <AdminHeaderSearch />
            </div>
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
      </SmartSearchProvider>
    </Layout>
  );
};

export default AdminLayout;

 