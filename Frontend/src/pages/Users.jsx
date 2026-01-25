import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  Table,
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
  Avatar,
  Upload,
  Drawer,
  Input as AntdInput,
  Select as AntdSelect,
} from 'antd';
import { showSuccess, showError, showInfo, handleApiError } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card as ShadcnCard, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar as ShadcnAvatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const userSchema = z.object({
  name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Please enter a valid email'),
  role: z.enum(['admin', 'manager', 'staff']),
  isActive: z.boolean().default(true),
});

const passwordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Please confirm password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match!",
  path: ["confirmPassword"],
});

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Please enter a valid email'),
  profilePicture: z.string().optional(),
});

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  role: z.enum(['admin', 'manager', 'staff']),
});
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  User,
  Users as UsersIcon,
  Crown,
  Settings,
  Upload as UploadIcon,
  Lock,
  Unlock,
  Mail,
  Phone,
  Calendar,
  Link,
  Copy
} from 'lucide-react';
import dayjs from 'dayjs';
import userService from '../services/userService';
import inviteService from '../services/inviteService';
import { useAuth } from '../context/AuthContext';
import ActionColumn from '../components/ActionColumn';
import DetailsDrawer from '../components/DetailsDrawer';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
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
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState(null);
  const [isExistingInvite, setIsExistingInvite] = useState(false);
  const { user, isAdmin, isManager } = useAuth();

  const form = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'staff',
      isActive: true,
    },
  });

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      email: '',
      profilePicture: '',
    },
  });

  const inviteForm = useForm({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'staff',
    },
  });

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
      handleApiError(error, { context: 'fetch users' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingUser(null);
    form.reset({
      name: '',
      email: '',
      role: 'staff',
      isActive: true,
    });
    setModalVisible(true);
  };

  const handleInviteUser = () => {
    inviteForm.reset({
      email: '',
      role: 'staff',
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
      showSuccess('Invite link generated successfully!');
    } catch (error) {
      // If there's an existing invite, show the link instead of error
      if (error.response?.data?.data?.inviteUrl) {
        setGeneratedInviteLink(error.response.data.data.inviteUrl);
        setIsExistingInvite(true);
        showInfo('This user has already been invited! Showing the existing invite link.');
      } else {
        handleApiError(error, { context: 'generate invite link' });
      }
    }
  };

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(generatedInviteLink);
    showSuccess('Invite link copied to clipboard!');
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    form.reset({
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
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
      showSuccess('User deleted successfully');
      fetchUsers();
    } catch (error) {
      handleApiError(error, { context: 'delete user' });
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      await userService.toggleStatus(id);
      showSuccess('User status updated successfully');
      fetchUsers();
    } catch (error) {
      handleApiError(error, { context: 'update user status' });
    }
  };

  const onSubmit = async (values) => {
    try {
      if (editingUser) {
        await userService.update(editingUser.id, values);
        showSuccess('User updated successfully');
      } else {
        const userData = {
          ...values,
          password: 'default123'
        };
        await userService.create(userData);
        showSuccess('User created successfully with default password "default123"');
      }
      setModalVisible(false);
      fetchUsers();
    } catch (error) {
      handleApiError(error, { context: editingUser ? 'update user' : 'create user' });
    }
  };

  const onPasswordSubmit = async (values) => {
    try {
      await userService.update(viewingUser.id, {
        password: values.newPassword
      });
      showSuccess('Password updated successfully');
      setPasswordModalVisible(false);
      fetchUsers();
    } catch (error) {
      showError(null, 'Failed to update password');
    }
  };

  const onProfileSubmit = async (values) => {
    try {
      await userService.update(viewingUser.id, values);
      showSuccess('Profile updated successfully');
      setProfileModalVisible(false);
      fetchUsers();
    } catch (error) {
      showError(null, 'Failed to update profile');
    }
  };

  const onInviteSubmit = async (values) => {
    try {
      const response = await inviteService.generateInvite(values);
      setGeneratedInviteLink(response.data.inviteUrl);
      setIsExistingInvite(false);
      showSuccess('Invite link generated successfully!');
    } catch (error) {
      if (error?.response?.data?.message?.includes('already exists') || 
          error?.response?.data?.message?.includes('already invited')) {
        setGeneratedInviteLink(error.response.data.inviteUrl);
        setIsExistingInvite(true);
        showInfo('User already has an active invite. Showing existing invite link.');
      } else {
        handleApiError(error, { context: 'generate invite' });
      }
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
    passwordForm.reset({
      newPassword: '',
      confirmPassword: '',
    });
    setPasswordModalVisible(true);
  };

  const handleProfileUpdate = (user) => {
    setViewingUser(user);
    profileForm.reset({
      name: user.name,
      email: user.email,
      profilePicture: user.profilePicture || '',
    });
    setProfileModalVisible(true);
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
          icon={<User className="h-4 w-4" />}
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
          manager: '#166534',
          staff: 'green'
        };
        const icons = {
          admin: <Crown className="h-4 w-4" />,
          manager: <Settings className="h-4 w-4" />,
          staff: <User className="h-4 w-4" />
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
          checkedChildren={<Unlock className="h-4 w-4" />}
          unCheckedChildren={<Lock className="h-4 w-4" />}
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
        <div className="flex items-center gap-2">
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<Eye className="h-4 w-4" />}
              onClick={() => handleView(record)}
            />
          </Tooltip>
          {isAdmin && (
            <Tooltip title="Edit User">
              <Button
                type="text"
                icon={<Pencil className="h-4 w-4" />}
                onClick={() => handleEdit(record)}
              />
            </Tooltip>
          )}
          {isAdmin && (
            <Tooltip title="Change Password">
              <Button
                type="text"
                icon={<Lock className="h-4 w-4" />}
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
                  icon={<Trash2 className="h-4 w-4" />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </div>
      )
    }
  ];

  const roleOptions = [
    { value: 'admin', label: 'Admin', icon: <Crown className="h-4 w-4" /> },
    { value: 'manager', label: 'Manager', icon: <Settings className="h-4 w-4" /> },
    { value: 'staff', label: 'Staff', icon: <User className="h-4 w-4" /> }
  ];

  const statusOptions = [
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Inactive' }
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="m-0">Users Management</h1>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              icon={<Link className="h-4 w-4" />}
              onClick={handleInviteUser}
            >
              Invite User
            </Button>
            <Button
              type="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={handleCreate}
            >
              Add User
            </Button>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="Total Users"
                value={stats.totalUsers || 0}
                prefix={<UsersIcon className="h-4 w-4" />}
                valueStyle={{ color: '#166534' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="Admins"
                value={stats.adminUsers || 0}
                prefix={<Crown className="h-4 w-4" />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="Managers"
                value={stats.managerUsers || 0}
                prefix={<Settings className="h-4 w-4" />}
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
            <AntdInput.Search
              placeholder="Search users..."
              allowClear
              style={{ width: '100%' }}
              onSearch={(value) => handleFilterChange('search', value)}
            />
          </Col>
          <Col xs={24} sm={6}>
            <AntdSelect
              placeholder="Filter by Role"
              allowClear
              style={{ width: '100%' }}
              value={filters.role}
              onChange={(value) => handleFilterChange('role', value)}
            >
              {roleOptions.map(option => (
                <AntdSelect.Option key={option.value} value={option.value}>
                  {option.icon} {option.label}
                </AntdSelect.Option>
              ))}
            </AntdSelect>
          </Col>
          <Col xs={24} sm={6}>
            <AntdSelect
              placeholder="Filter by Status"
              allowClear
              style={{ width: '100%' }}
              value={filters.isActive}
              onChange={(value) => handleFilterChange('isActive', value)}
            >
              {statusOptions.map(option => (
                <AntdSelect.Option key={option.value} value={option.value}>{option.label}</AntdSelect.Option>
              ))}
            </AntdSelect>
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

      {/* Add/Edit Dialog */}
      <Dialog open={modalVisible} onOpenChange={(open) => {
        if (!open) setModalVisible(false);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Update user information' : 'Create a new user account'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Enter email address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                  {roleOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              <span className="flex items-center gap-2">
                      {option.icon} {option.label}
                              </span>
                            </SelectItem>
                  ))}
                        </SelectContent>
                </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-col space-y-2 pt-7">
                      <FormLabel>Status</FormLabel>
                      <FormControl>
                        <div className="flex items-center space-x-2">
                <Switch 
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                          <span className="text-sm text-muted-foreground">
                            {field.value ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {!editingUser && (
                <Alert>
                  <AlertTitle>Default Password</AlertTitle>
                  <AlertDescription>
                    New users will be created with default password 'default123'. They will be required to change it on first login.
                  </AlertDescription>
                </Alert>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
                <Button type="submit">
                  {editingUser ? 'Update' : 'Create'} User
                </Button>
              </DialogFooter>
            </form>
        </Form>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={passwordModalVisible} onOpenChange={(open) => {
        if (!open) setPasswordModalVisible(false);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Update password for {viewingUser?.name || 'user'}
            </DialogDescription>
          </DialogHeader>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
              <FormField
                control={passwordForm.control}
            name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter new password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
            name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Confirm new password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPasswordModalVisible(false)}>
                Cancel
              </Button>
                <Button type="submit">
                  Update Password
                </Button>
              </DialogFooter>
            </form>
        </Form>
        </DialogContent>
      </Dialog>

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
            icon: <Lock className="h-4 w-4" />
          } : null,
          isAdmin && viewingUser ? {
            label: 'Update Profile',
            onClick: () => {
              handleProfileUpdate(viewingUser);
              setDrawerVisible(false);
            },
            icon: <User className="h-4 w-4" />
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
                icon={<User className="h-4 w-4" />}
              />
            )
          },
          { label: 'Full Name', value: viewingUser.name },
          { label: 'Email', value: viewingUser.email },
          { 
            label: 'Role', 
            value: viewingUser.role,
            render: (role) => {
              const colors = { admin: 'red', manager: '#166534', staff: 'green' };
              const icons = { admin: <Crown className="h-4 w-4" />, manager: <Settings className="h-4 w-4" />, staff: <User className="h-4 w-4" /> };
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

      {/* Invite User Dialog */}
      <Dialog open={inviteModalVisible} onOpenChange={(open) => {
        if (!open) {
          setInviteModalVisible(false);
          setGeneratedInviteLink(null);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invite New User</DialogTitle>
            <DialogDescription>
              Generate an invite link to share with a new user
            </DialogDescription>
          </DialogHeader>
        {!generatedInviteLink ? (
            <Form {...inviteForm}>
              <form onSubmit={inviteForm.handleSubmit(onInviteSubmit)} className="space-y-4">
                <FormField
                  control={inviteForm.control}
              name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                            type="email"
                placeholder="user@example.com"
                            className="pl-9"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={inviteForm.control}
              name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                {roleOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              <span className="flex items-center gap-2">
                    {option.icon} {option.label}
                              </span>
                            </SelectItem>
                ))}
                        </SelectContent>
              </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Alert>
                  <AlertTitle>How It Works</AlertTitle>
                  <AlertDescription>
                    An invite link will be generated that you can share with the user. They'll click the link to complete registration.
                  </AlertDescription>
                </Alert>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => {
                  setInviteModalVisible(false);
                  setGeneratedInviteLink(null);
                }}>
                  Cancel
                </Button>
                  <Button type="submit">
                    Generate Invite Link
                  </Button>
                </DialogFooter>
              </form>
          </Form>
        ) : (
            <div className="space-y-4">
              <Alert variant={isExistingInvite ? 'default' : 'default'}>
                <AlertTitle>{isExistingInvite ? "Existing Invite Found!" : "Invite Link Generated!"}</AlertTitle>
                <AlertDescription>
                  {isExistingInvite 
                ? "This user has already been invited. You can copy the existing invite link below."
                : "Copy the link below and share it with the user. The link will expire in 7 days."}
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
              <Input
                value={generatedInviteLink}
                readOnly
                  className="flex-1"
              />
              <Button
                onClick={handleCopyInviteLink}
              >
                  <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              </div>
              <DialogFooter>
              <Button onClick={() => {
                setInviteModalVisible(false);
                setGeneratedInviteLink(null);
                setIsExistingInvite(false);
              }}>
                Close
              </Button>
              </DialogFooter>
          </div>
        )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users;


