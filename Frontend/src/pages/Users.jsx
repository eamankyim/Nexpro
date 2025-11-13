import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Space,
  Tag,
  Popconfirm,
  Row,
  Col,
  Statistic,
  Divider,
  Tabs,
  Empty,
  Spin,
  Tooltip,
  Descriptions,
  Alert,
  Switch,
  Avatar,
  Upload,
  Drawer
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  UserOutlined,
  TeamOutlined,
  CrownOutlined,
  SettingOutlined,
  UploadOutlined,
  LockOutlined,
  UnlockOutlined,
  MailOutlined,
  PhoneOutlined,
  CalendarOutlined,
  LinkOutlined,
  CopyOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import userService from '../services/userService';
import inviteService from '../services/inviteService';
import { useAuth } from '../context/AuthContext';
import ActionColumn from '../components/ActionColumn';
import DetailsDrawer from '../components/DetailsDrawer';
import SeatUsageCard from '../components/SeatUsageCard';
import StorageUsageCard from '../components/StorageUsageCard';

const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    role: null,
    isActive: null,
    search: ''
  });
  const [activeTab, setActiveTab] = useState('all');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordForm] = Form.useForm();
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileForm] = Form.useForm();
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteForm] = Form.useForm();
  const [generatedInviteLink, setGeneratedInviteLink] = useState(null);
  const [isExistingInvite, setIsExistingInvite] = useState(false);
  const { user, isAdmin, isManager } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, [pagination.current, pagination.pageSize, filters]);

  // Calculate stats whenever users data changes
  useEffect(() => {
    if (users && users.length > 0) {
      const totalUsers = users.length;
      const activeUsers = users.filter(u => u.isActive).length;
      const adminUsers = users.filter(u => u.role === 'admin').length;
      const managerUsers = users.filter(u => u.role === 'manager').length;
      const staffUsers = users.filter(u => u.role === 'staff').length;
      
      setStats({
        totalUsers,
        activeUsers,
        adminUsers,
        managerUsers,
        staffUsers
      });
    }
  }, [users]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters
      };
      const response = await userService.getAll(params);
      setUsers(response.data.data || response.data);
      setPagination(prev => ({
        ...prev,
        total: response.data.count || response.count
      }));
    } catch (error) {
      message.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({
      role: 'staff',
      isActive: true
    });
    setModalVisible(true);
  };

  const handleInviteUser = () => {
    inviteForm.resetFields();
    inviteForm.setFieldsValue({
      role: 'staff'
    });
    setGeneratedInviteLink(null);
    setIsExistingInvite(false);
    setInviteModalVisible(true);
  };

  const handleInviteSubmit = async (values) => {
    try {
      const response = await inviteService.generateInvite(values);
      setGeneratedInviteLink(response.data.inviteUrl);
      setIsExistingInvite(false);
      message.success('Invite link generated successfully!');
    } catch (error) {
      console.log('Invite error object:', error);
      console.log('Invite error.response:', error.response);
      console.log('Invite error.response.data:', error.response?.data);
      // If there's an existing invite, show the link instead of error
      if (error.response?.data?.data?.inviteUrl) {
        setGeneratedInviteLink(error.response.data.data.inviteUrl);
        setIsExistingInvite(true);
        message.info('This user has already been invited! Showing the existing invite link.');
      } else {
        message.error(error.response?.data?.message || 'Failed to generate invite link');
      }
    }
  };

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(generatedInviteLink);
    message.success('Invite link copied to clipboard!');
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    form.setFieldsValue({
      ...user,
      // Don't include password in edit form
      password: undefined
    });
    setModalVisible(true);
  };

  const handleView = (user) => {
    setViewingUser(user);
    setDrawerVisible(true);
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setViewingUser(null);
  };

  const handleDelete = async (id) => {
    try {
      await userService.delete(id);
      message.success('User deleted successfully');
      fetchUsers();
      fetchStats();
    } catch (error) {
      message.error('Failed to delete user');
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      await userService.toggleStatus(id);
      message.success('User status updated successfully');
      fetchUsers();
      fetchStats();
    } catch (error) {
      message.error('Failed to update user status');
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingUser) {
        // Don't update password through this form
        const { password, ...updateData } = values;
        await userService.update(editingUser.id, updateData);
        message.success('User updated successfully');
      } else {
        // Create new user with default password
        const userData = {
          ...values,
          password: 'default123' // Default password
        };
        await userService.create(userData);
        message.success('User created successfully with default password "default123"');
      }

      setModalVisible(false);
      fetchUsers();
      fetchStats();
    } catch (error) {
      message.error('Failed to save user');
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setPagination(prev => ({
      ...prev,
      current: 1
    }));
  };

  const handleChangePassword = (user) => {
    setViewingUser(user);
    passwordForm.resetFields();
    setPasswordModalVisible(true);
  };

  const handlePasswordSubmit = async (values) => {
    try {
      await userService.update(viewingUser.id, {
        password: values.newPassword
      });
      message.success('Password updated successfully');
      setPasswordModalVisible(false);
      fetchUsers();
    } catch (error) {
      message.error('Failed to update password');
    }
  };

  const handleProfileUpdate = (user) => {
    setViewingUser(user);
    profileForm.setFieldsValue({
      name: user.name,
      email: user.email,
      profilePicture: user.profilePicture
    });
    setProfileModalVisible(true);
  };

  const handleProfileSubmit = async (values) => {
    try {
      await userService.update(viewingUser.id, values);
      message.success('Profile updated successfully');
      setProfileModalVisible(false);
      fetchUsers();
    } catch (error) {
      message.error('Failed to update profile');
    }
  };

  const columns = [
    {
      title: 'Avatar',
      dataIndex: 'profilePicture',
      key: 'avatar',
      width: 80,
      render: (profilePicture, record) => (
        <Avatar
          size={40}
          src={profilePicture}
          icon={<UserOutlined />}
        />
      )
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (name, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{name}</div>
          {record.email && (
            <div style={{ fontSize: 12, color: '#888' }}>{record.email}</div>
          )}
        </div>
      )
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role) => {
        const colors = {
          admin: 'red',
          manager: 'blue',
          staff: 'green'
        };
        const icons = {
          admin: <CrownOutlined />,
          manager: <SettingOutlined />,
          staff: <UserOutlined />
        };
        return (
          <Tag color={colors[role]} icon={icons[role]}>
            {role.toUpperCase()}
          </Tag>
        );
      }
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive, record) => (
        <Switch
          checked={isActive}
          onChange={() => handleToggleStatus(record.id)}
          checkedChildren={<UnlockOutlined />}
          unCheckedChildren={<LockOutlined />}
        />
      )
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date) => dayjs(date).format('MMM DD, YYYY')
    },
    {
      title: 'Last Login',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      width: 120,
      render: (date) => date ? dayjs(date).format('MMM DD, YYYY') : 'Never'
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            />
          </Tooltip>
          {isAdmin && (
            <Tooltip title="Edit User">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              />
            </Tooltip>
          )}
          {isAdmin && (
            <Tooltip title="Change Password">
              <Button
                type="text"
                icon={<LockOutlined />}
                onClick={() => handleChangePassword(record)}
              />
            </Tooltip>
          )}
          {isAdmin && record.id !== user?.id && (
            <Popconfirm
              title="Are you sure you want to delete this user?"
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Tooltip title="Delete User">
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  const roleOptions = [
    { value: 'admin', label: 'Admin', icon: <CrownOutlined /> },
    { value: 'manager', label: 'Manager', icon: <SettingOutlined /> },
    { value: 'staff', label: 'Staff', icon: <UserOutlined /> }
  ];

  const statusOptions = [
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Inactive' }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Users Management</h1>
        {isAdmin && (
          <Space>
            <Button
              icon={<LinkOutlined />}
              onClick={handleInviteUser}
            >
              Invite User
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              Add User
            </Button>
          </Space>
        )}
      </div>

      {/* Usage Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <SeatUsageCard />
        </Col>
        <Col xs={24} lg={12}>
          <StorageUsageCard />
        </Col>
      </Row>

      {/* Statistics Cards */}
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="Total Users"
                value={stats.totalUsers || 0}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="Admins"
                value={stats.adminUsers || 0}
                prefix={<CrownOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="Managers"
                value={stats.managerUsers || 0}
                prefix={<SettingOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={6}>
            <Input.Search
              placeholder="Search users..."
              allowClear
              style={{ width: '100%' }}
              onSearch={(value) => handleFilterChange('search', value)}
            />
          </Col>
          <Col xs={24} sm={6}>
            <Select
              placeholder="Filter by Role"
              allowClear
              style={{ width: '100%' }}
              value={filters.role}
              onChange={(value) => handleFilterChange('role', value)}
            >
              {roleOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.icon} {option.label}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={6}>
            <Select
              placeholder="Filter by Status"
              allowClear
              style={{ width: '100%' }}
              value={filters.isActive}
              onChange={(value) => handleFilterChange('isActive', value)}
            >
              {statusOptions.map(option => (
                <Option key={option.value} value={option.value}>{option.label}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={6}>
            <Button
              onClick={() => {
                setFilters({ role: null, isActive: null, search: '' });
                setPagination(prev => ({ ...prev, current: 1 }));
              }}
            >
              Clear Filters
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Users Table with Tabs */}
      <Card>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={[
            {
              key: 'all',
              label: 'All Users',
              children: (
                <Table
                  columns={columns}
                  dataSource={users}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    current: pagination.current,
                    pageSize: pagination.pageSize,
                    total: pagination.total,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} users`,
                    onChange: (page, pageSize) => {
                      setPagination(prev => ({
                        ...prev,
                        current: page,
                        pageSize: pageSize || prev.pageSize
                      }));
                    }
                  }}
                  scroll={{ x: 1000 }}
                />
              )
            },
            {
              key: 'active',
              label: 'Active Users',
              children: (
                <Table
                  columns={columns}
                  dataSource={users?.filter(user => user.isActive) || []}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    current: pagination.current,
                    pageSize: pagination.pageSize,
                    total: pagination.total,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} active users`,
                    onChange: (page, pageSize) => {
                      setPagination(prev => ({
                        ...prev,
                        current: page,
                        pageSize: pageSize || prev.pageSize
                      }));
                    }
                  }}
                  scroll={{ x: 1000 }}
                />
              )
            },
            {
              key: 'admins',
              label: 'Admins',
              children: (
                <Table
                  columns={columns}
                  dataSource={users?.filter(user => user.role === 'admin') || []}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    current: pagination.current,
                    pageSize: pagination.pageSize,
                    total: pagination.total,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} admins`,
                    onChange: (page, pageSize) => {
                      setPagination(prev => ({
                        ...prev,
                        current: page,
                        pageSize: pageSize || prev.pageSize
                      }));
                    }
                  }}
                  scroll={{ x: 1000 }}
                />
              )
            }
          ]}
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        title={editingUser ? 'Edit User' : 'Add New User'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="name"
                label="Full Name"
                rules={[{ required: true, message: 'Please enter full name' }]}
              >
                <Input placeholder="Enter full name" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Please enter email' },
                  { type: 'email', message: 'Please enter valid email' }
                ]}
              >
                <Input placeholder="Enter email address" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="role"
                label="Role"
                rules={[{ required: true, message: 'Please select role' }]}
              >
                <Select placeholder="Select role">
                  {roleOptions.map(option => (
                    <Option key={option.value} value={option.value}>
                      {option.icon} {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="isActive"
                label="Status"
                valuePropName="checked"
              >
                <Switch 
                  checkedChildren="Active" 
                  unCheckedChildren="Inactive" 
                />
              </Form.Item>
            </Col>
          </Row>

          {!editingUser && (
            <Alert
              message="Default Password"
              description="New users will be created with default password 'default123'. They will be required to change it on first login."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingUser ? 'Update' : 'Create'} User
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        title="Change Password"
        open={passwordModalVisible}
        onCancel={() => setPasswordModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handlePasswordSubmit}
        >
          <Form.Item
            name="newPassword"
            label="New Password"
            rules={[
              { required: true, message: 'Please enter new password' },
              { min: 6, message: 'Password must be at least 6 characters' }
            ]}
          >
            <Input.Password placeholder="Enter new password" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirm Password"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Please confirm password' },
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
            <Input.Password placeholder="Confirm new password" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Update Password
              </Button>
              <Button onClick={() => setPasswordModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* User Details Drawer */}
      <DetailsDrawer
        open={drawerVisible}
        onClose={handleCloseDrawer}
        title="User Details"
        width={800}
        onEdit={isAdmin && viewingUser ? () => {
          handleEdit(viewingUser);
          setDrawerVisible(false);
        } : null}
        onDelete={isAdmin && viewingUser && viewingUser.id !== user?.id ? () => {
          handleDelete(viewingUser.id);
          setDrawerVisible(false);
        } : null}
        deleteConfirmText="Are you sure you want to delete this user?"
        extraActions={[
          isAdmin && viewingUser ? {
            label: 'Change Password',
            onClick: () => {
              handleChangePassword(viewingUser);
              setDrawerVisible(false);
            },
            icon: <LockOutlined />
          } : null,
          isAdmin && viewingUser ? {
            label: 'Update Profile',
            onClick: () => {
              handleProfileUpdate(viewingUser);
              setDrawerVisible(false);
            },
            icon: <UserOutlined />
          } : null
        ].filter(Boolean)}
        fields={viewingUser ? [
          { 
            label: 'Avatar', 
            value: viewingUser.profilePicture,
            render: (picture) => (
              <Avatar
                size={80}
                src={picture}
                icon={<UserOutlined />}
              />
            )
          },
          { label: 'Full Name', value: viewingUser.name },
          { label: 'Email', value: viewingUser.email },
          { 
            label: 'Role', 
            value: viewingUser.role,
            render: (role) => {
              const colors = { admin: 'red', manager: 'blue', staff: 'green' };
              const icons = { admin: <CrownOutlined />, manager: <SettingOutlined />, staff: <UserOutlined /> };
              return <Tag color={colors[role]} icon={icons[role]}>{role.toUpperCase()}</Tag>;
            }
          },
          { 
            label: 'Status', 
            value: viewingUser.isActive,
            render: (isActive) => (
              <Tag color={isActive ? 'green' : 'red'}>
                {isActive ? 'ACTIVE' : 'INACTIVE'}
              </Tag>
            )
          },
          { 
            label: 'Created At', 
            value: viewingUser.createdAt,
            render: (date) => dayjs(date).format('MMMM DD, YYYY HH:mm')
          },
          { 
            label: 'Last Updated', 
            value: viewingUser.updatedAt,
            render: (date) => dayjs(date).format('MMMM DD, YYYY HH:mm')
          },
          { 
            label: 'Last Login', 
            value: viewingUser.lastLogin,
            render: (date) => date ? dayjs(date).format('MMMM DD, YYYY HH:mm') : 'Never'
          }
        ] : []}
      />

      {/* Invite User Modal */}
      <Modal
        title="Invite New User"
        open={inviteModalVisible}
        onCancel={() => {
          setInviteModalVisible(false);
          setGeneratedInviteLink(null);
        }}
        footer={null}
        width={600}
      >
        {!generatedInviteLink ? (
          <Form
            form={inviteForm}
            layout="vertical"
            onFinish={handleInviteSubmit}
          >
            <Form.Item
              name="email"
              label="Email Address"
              rules={[
                { required: true, message: 'Please enter email address' },
                { type: 'email', message: 'Please enter valid email' }
              ]}
            >
              <Input 
                placeholder="user@example.com"
                prefix={<MailOutlined />}
              />
            </Form.Item>

            <Form.Item
              name="name"
              label="Name (Optional)"
              help="Pre-fills the signup form for the user"
            >
              <Input 
                placeholder="John Doe"
                prefix={<UserOutlined />}
              />
            </Form.Item>

            <Form.Item
              name="role"
              label="Role"
              rules={[{ required: true, message: 'Please select role' }]}
            >
              <Select placeholder="Select role">
                {roleOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.icon} {option.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Alert
              message="How It Works"
              description="An invite link will be generated that you can share with the user. They'll click the link to complete registration."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  Generate Invite Link
                </Button>
                <Button onClick={() => {
                  setInviteModalVisible(false);
                  setGeneratedInviteLink(null);
                }}>
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        ) : (
          <div>
            <Alert
              message={isExistingInvite ? "Existing Invite Found!" : "Invite Link Generated!"}
              description={isExistingInvite 
                ? "This user has already been invited. You can copy the existing invite link below."
                : "Copy the link below and share it with the user. The link will expire in 7 days."}
              type={isExistingInvite ? "warning" : "success"}
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Input.Group compact>
              <Input
                value={generatedInviteLink}
                readOnly
                style={{ width: 'calc(100% - 100px)' }}
              />
              <Button
                type="primary"
                icon={<CopyOutlined />}
                onClick={handleCopyInviteLink}
                style={{ width: '100px' }}
              >
                Copy
              </Button>
            </Input.Group>

            <Space style={{ marginTop: 16, width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setInviteModalVisible(false);
                setGeneratedInviteLink(null);
                setIsExistingInvite(false);
              }}>
                Close
              </Button>
            </Space>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Users;


