import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usePlatformAdminPermissions } from '../../context/PlatformAdminPermissionsContext';
import adminService from '../../services/adminService';
import { showError, showSuccess } from '../../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import DashboardTable from '../../components/DashboardTable';
import ViewToggle from '../../components/ViewToggle';
import { useResponsive } from '../../hooks/useResponsive';
import { useSmartSearch } from '../../context/SmartSearchContext';
import {
  RefreshCw,
  Loader2,
  Plus,
  UserCog,
  Pencil,
  Mail
} from 'lucide-react';
import dayjs from 'dayjs';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import MobileFormDialog from '../../components/MobileFormDialog';

const adminUserSchema = z.object({
  name: z.string().min(1, 'Enter name'),
  email: z.string().email('Enter a valid email'),
  password: z.string().optional(),
  isActive: z.boolean().default(true),
});

const AdminUsers = () => {
  const { setPageSearchConfig } = useSmartSearch();
  const { hasPermission, loading: permissionsLoading } = usePlatformAdminPermissions();
  const { isMobile } = useResponsive();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [tableViewMode, setTableViewMode] = useState('table');
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    resolver: zodResolver(adminUserSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      isActive: true,
    },
  });

  useEffect(() => {
    setPageSearchConfig({
      placeholder: 'Search internal users by name or email...',
      scope: 'admin-users',
    });
  }, [setPageSearchConfig]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminService.getPlatformAdmins();
      if (response?.success) {
        const list = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setUsers(list);
      } else {
        setUsers([]);
      }
    } catch (error) {
      showError(error, 'Failed to load internal users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  };

  const handleOpenCreate = () => {
    setEditingUser(null);
    form.reset({
      name: '',
      email: '',
      password: '',
      isActive: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = useCallback((user) => {
    setEditingUser(user);
    form.reset({
      name: user.name || '',
      email: user.email || '',
      password: '',
      isActive: user.isActive !== false,
    });
    setModalOpen(true);
  }, [form]);

  const handleSubmit = useCallback(async (values) => {
    if (!editingUser && (!values.password || values.password.length < 6)) {
      form.setError('password', { message: 'Password must be at least 6 characters' });
      return;
    }
    try {
      setSubmitting(true);
      if (editingUser) {
        await adminService.updatePlatformAdmin(editingUser.id, {
          name: values.name,
          isActive: values.isActive,
          ...(values.password ? { password: values.password } : {}),
        });
        showSuccess('Internal user updated successfully');
      } else {
        await adminService.createPlatformAdmin({
          name: values.name,
          email: values.email,
          password: values.password,
          isActive: values.isActive,
        });
        showSuccess('Internal user created successfully');
      }
      setModalOpen(false);
      await fetchUsers();
    } catch (error) {
      showError(error, editingUser ? 'Failed to update user' : 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  }, [editingUser, fetchUsers, form]);

  const tableColumns = useMemo(() => [
    {
      key: 'name',
      label: 'Name',
      render: (_, record) => (
        <span className="font-medium text-foreground">{record?.name || '—'}</span>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      render: (_, record) => (
        <span className="text-foreground">{record?.email || '—'}</span>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (_, record) => (
        <Badge
          className={
            record?.isActive
              ? 'bg-green-700 text-white'
              : 'bg-gray-500 text-white'
          }
        >
          {record?.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'lastLogin',
      label: 'Last Login',
      render: (_, record) => (
        <span className="text-foreground">
          {record?.lastLogin
            ? dayjs(record.lastLogin).format('MMM DD, YYYY')
            : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, record) =>
        hasPermission('users.manage') ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenEdit(record)}
            >
              <Pencil className="h-4 w-4" />
              {!isMobile && <span className="ml-2">Edit</span>}
            </Button>
          </div>
        ) : null,
    },
  ], [hasPermission, handleOpenEdit, isMobile]);

  if (!permissionsLoading && !hasPermission('users.view')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">Access Denied</h3>
          <p className="text-gray-600">You don&apos;t have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground mb-1">Internal Users</h2>
          <p className="text-sm text-muted-foreground">
            Manage platform administrators with access to the Control Center.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle value={tableViewMode} onChange={setTableViewMode} />
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            size={isMobile ? 'icon' : 'default'}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          {hasPermission('users.manage') && (
            <Button onClick={handleOpenCreate} size={isMobile ? 'icon' : 'default'}>
              <Plus className="h-4 w-4" />
              {!isMobile && <span className="ml-2">Add User</span>}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: 'rgba(22, 101, 52, 0.1)' }}
            >
              <UserCog className="h-5 w-5" style={{ color: '#166534' }} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Users</p>
              <p className="text-2xl font-semibold text-foreground">{users.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}
            >
              <Mail className="h-5 w-5" style={{ color: '#22c55e' }} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-semibold text-foreground">
                {users.filter((u) => u.isActive).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <DashboardTable
        data={users}
        columns={tableColumns}
        loading={loading}
        title={null}
        emptyIcon={<UserCog className="h-12 w-12 text-muted-foreground" />}
        emptyDescription="No platform administrators yet. Add internal users to manage the platform."
        emptyAction={
          hasPermission('users.manage') && (
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Admin
            </Button>
          )
        }
        pageSize={20}
        viewMode={tableViewMode}
        onViewModeChange={setTableViewMode}
      />

      <MobileFormDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingUser ? 'Edit Internal User' : 'Add Internal User'}
        description={
          editingUser
            ? 'Update the user details. Leave password blank to keep the current password.'
            : 'Create a new platform administrator. They will have access to the Control Center.'
        }
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="admin-user-form" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitting ? ' Saving...' : editingUser ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <Form {...form}>
          <form id="admin-user-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="John Doe" />
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
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="john@example.com"
                          disabled={!!editingUser}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {editingUser
                          ? 'Password (leave blank to keep current)'
                          : 'Password *'}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder={editingUser ? '••••••••' : 'Min 6 characters'}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div>
                        <FormLabel>Active</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Inactive users cannot sign in.
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </form>
            </Form>
      </MobileFormDialog>
    </div>
  );
};

export default AdminUsers;
