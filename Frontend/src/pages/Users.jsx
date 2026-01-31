import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { useResponsive } from '../hooks/useResponsive';
import { useSmartSearch } from '../context/SmartSearchContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { showSuccess, showError, showInfo, handleApiError } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { SecondaryButton } from '@/components/ui/secondary-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogBody,
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
  Trash2,
  User,
  Users as UsersIcon,
  Crown,
  Settings,
  Upload as UploadIcon,
  Unlock,
  Mail,
  Phone,
  Calendar,
  Link,
  Copy,
  Filter,
  RefreshCw,
  Shield,
  Loader2
} from 'lucide-react';
import dayjs from 'dayjs';
import userService from '../services/userService';
import inviteService from '../services/inviteService';
import { useAuth } from '../context/AuthContext';
import ActionColumn from '../components/ActionColumn';
import DetailsDrawer from '../components/DetailsDrawer';
import DashboardTable from '../components/DashboardTable';
import DashboardStatsCard from '../components/DashboardStatsCard';
import WelcomeSection from '../components/WelcomeSection';
import { Descriptions, DescriptionItem } from '@/components/ui/descriptions';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { SEARCH_PLACEHOLDERS, DEBOUNCE_DELAYS, ROLE_CHIP_CLASSES, STATUS_CHIP_DEFAULT_CLASS } from '../constants';
import { resolveImageUrl } from '../utils/fileUtils';

const Users = () => {
  const { searchValue, setPageSearchConfig } = useSmartSearch();
  const debouncedSearch = useDebounce(searchValue, DEBOUNCE_DELAYS.SEARCH);
  const { isMobile } = useResponsive();
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
    role: 'all',
    isActive: 'all'
  });
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState(null);
  const [isExistingInvite, setIsExistingInvite] = useState(false);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(null);
  const [refreshingUsers, setRefreshingUsers] = useState(false);
  const { user, isAdmin, isManager } = useAuth();

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

  const fetchPendingInvites = useCallback(async () => {
    try {
      setLoadingInvites(true);
      const response = await inviteService.getAllInvites({ used: 'false' });
      const data = response.data?.data ?? response.data ?? [];
      setPendingInvites(Array.isArray(data) ? data : []);
    } catch (error) {
      handleApiError(error, { context: 'fetch pending invites' });
      setPendingInvites([]);
    } finally {
      setLoadingInvites(false);
    }
  }, []);

  useEffect(() => {
    setPageSearchConfig({ scope: 'users', placeholder: SEARCH_PLACEHOLDERS.USERS });
    return () => setPageSearchConfig(null);
  }, [setPageSearchConfig]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, [searchValue]);

  useEffect(() => {
    fetchUsers();
  }, [pagination.current, pagination.pageSize, filters.role, filters.isActive, debouncedSearch]);

  useEffect(() => {
    if (isAdmin) {
      fetchPendingInvites();
    }
  }, [isAdmin, fetchPendingInvites]);

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

  const fetchUsers = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshingUsers(true);
      } else {
        setLoading(true);
      }
      const params = {
        page: pagination.current,
        limit: 1000, // Fetch more for client-side filtering
      };
      
      if (filters.role !== 'all') {
        params.role = filters.role;
      }
      if (filters.isActive !== 'all') {
        params.isActive = filters.isActive === 'true';
      }
      if (debouncedSearch) params.search = debouncedSearch;

      const response = await userService.getAll(params);
      setUsers(response.data.data || response.data || []);
    } catch (error) {
      handleApiError(error, { context: 'fetch users' });
      setUsers([]);
    } finally {
      if (isRefresh) {
        setRefreshingUsers(false);
      } else {
        setLoading(false);
      }
    }
  };

  // Apply client-side filtering
  const filteredUsers = useMemo(() => {
    return users; // Backend already filters
  }, [users, filters]);

  // Paginate filtered users
  const paginatedUsers = useMemo(() => {
    const start = (pagination.current - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return filteredUsers.slice(start, end);
  }, [filteredUsers, pagination.current, pagination.pageSize]);

  const usersCount = filteredUsers.length;

  // Calculate summary stats
  const calculatedStats = useMemo(() => {
    const totalUsers = users.length;
    const adminUsers = users.filter(u => u.role === 'admin').length;
    const managerUsers = users.filter(u => u.role === 'manager').length;
    const staffUsers = users.filter(u => u.role === 'staff').length;
    
    return {
      totals: {
        totalUsers,
        adminUsers,
        managerUsers,
        staffUsers
      }
    };
  }, [users]);

  const handleInviteUser = () => {
    inviteForm.reset({
      email: '',
      role: 'staff',
    });
    setGeneratedInviteLink(null);
    setIsExistingInvite(false);
    setInviteModalVisible(true);
  };

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(generatedInviteLink);
    showSuccess('Invite link copied to clipboard!');
  };

  const getInviteUrl = (token) => {
    return `${window.location.origin}/signup?token=${token}`;
  };

  const handleCopyPendingInviteLink = (invite) => {
    const url = getInviteUrl(invite.token);
    navigator.clipboard.writeText(url);
    showSuccess('Invite link copied to clipboard!');
  };

  const handleRevokeInvite = useCallback(async (id) => {
    try {
      setRevokingInviteId(id);
      await inviteService.revokeInvite(id);
      showSuccess('Invite revoked successfully');
      await fetchPendingInvites();
    } catch (error) {
      handleApiError(error, { context: 'revoke invite' });
    } finally {
      setRevokingInviteId(null);
    }
  }, [fetchPendingInvites]);

  const handleView = useCallback((user) => {
    setViewingUser(user);
    setDrawerVisible(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setDrawerVisible(false);
    setViewingUser(null);
  }, []);

  const handleDelete = useCallback(async (id) => {
    try {
      setDeletingUser(true);
      await userService.delete(id);
      showSuccess('User deleted successfully');
      await fetchUsers();
    } catch (error) {
      handleApiError(error, { context: 'delete user' });
    } finally {
      setDeletingUser(false);
    }
  }, []);

  const handleToggleStatus = useCallback(async (id) => {
    try {
      setTogglingStatus(id);
      await userService.toggleStatus(id);
      showSuccess('User status updated successfully');
      await fetchUsers();
    } catch (error) {
      handleApiError(error, { context: 'update user status' });
    } finally {
      setTogglingStatus(null);
    }
  }, []);

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
      setSubmittingInvite(true);
      const response = await inviteService.generateInvite(values);
      const inviteUrl = response.data?.data?.inviteUrl ?? response.data?.inviteUrl;
      setGeneratedInviteLink(inviteUrl);
      setIsExistingInvite(false);
      showSuccess('Invite link generated successfully!');
      await fetchPendingInvites();
    } catch (error) {
      if (error?.response?.data?.message?.includes('already exists') ||
          error?.response?.data?.message?.includes('already invited') ||
          error?.response?.data?.data?.inviteUrl) {
        const url = error?.response?.data?.data?.inviteUrl ?? error?.response?.data?.inviteUrl;
        if (url) {
          setGeneratedInviteLink(url);
          setIsExistingInvite(true);
          showInfo('User already has an active invite. Showing existing invite link.');
        } else {
          handleApiError(error, { context: 'generate invite' });
        }
      } else {
        handleApiError(error, { context: 'generate invite' });
      }
    } finally {
      setSubmittingInvite(false);
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

  const handleProfileUpdate = (user) => {
    setViewingUser(user);
    profileForm.reset({
      name: user.name,
      email: user.email,
      profilePicture: user.profilePicture || '',
    });
    setProfileModalVisible(true);
  };

  // Table columns for DashboardTable
  const tableColumns = useMemo(() => [
    {
      key: 'avatar',
      label: 'Avatar',
      render: (_, record) => (
        <ShadcnAvatar>
          <AvatarImage src={resolveImageUrl(record?.profilePicture || '') || undefined} />
          <AvatarFallback>
            <User className="h-4 w-4" />
          </AvatarFallback>
        </ShadcnAvatar>
      )
    },
    {
      key: 'name',
      label: 'Name',
      render: (_, record) => (
        <div>
          <div className="font-bold text-black">{record?.name || '—'}</div>
          {record?.email && (
            <div className="text-muted-foreground text-xs">{record.email}</div>
          )}
        </div>
      )
    },
    {
      key: 'role',
      label: 'Role',
      render: (_, record) => {
        const roleIcons = {
          admin: <Crown className="h-3 w-3 mr-1" />,
          manager: <Settings className="h-3 w-3 mr-1" />,
          staff: <User className="h-3 w-3 mr-1" />,
          employee: <User className="h-3 w-3 mr-1" />
        };
        return (
          <Badge
            variant="outline"
            className={ROLE_CHIP_CLASSES[record?.role] ?? STATUS_CHIP_DEFAULT_CLASS}
          >
            {roleIcons[record?.role]}
            {record?.role?.toUpperCase() || '—'}
          </Badge>
        );
      }
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (_, record) => isAdmin ? (
        <Switch
          checked={record?.isActive}
          onCheckedChange={() => handleToggleStatus(record.id)}
          disabled={togglingStatus === record.id}
        />
      ) : (
        <Badge variant={record?.isActive ? 'default' : 'destructive'}>
          {record?.isActive ? 'ACTIVE' : 'INACTIVE'}
        </Badge>
      )
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (_, record) => <span className="text-black">{record?.createdAt ? dayjs(record.createdAt).format('MMM DD, YYYY') : '—'}</span>
    },
    {
      key: 'lastLogin',
      label: 'Last Login',
      render: (_, record) => <span className="text-black">{record?.lastLogin ? dayjs(record.lastLogin).format('MMM DD, YYYY') : 'Never'}</span>
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <SecondaryButton
            size="sm"
            onClick={() => handleView(record)}
          >
            View
          </SecondaryButton>
        </div>
      )
    }
  ], [isAdmin, user, handleView, handleToggleStatus]);

  const roleOptions = [
    { value: 'admin', label: 'Admin', icon: <Crown className="h-4 w-4" /> },
    { value: 'manager', label: 'Manager', icon: <Settings className="h-4 w-4" /> },
    { value: 'staff', label: 'Staff', icon: <User className="h-4 w-4" /> }
  ];

  const statusOptions = [
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Inactive' }
  ];

  const handleClearFilters = () => {
    setFilters({
      role: 'all',
      isActive: 'all'
    });
    setPagination({ ...pagination, current: 1 });
  };

  const hasActiveFilters = filters.role !== 'all' || filters.isActive !== 'all';

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <WelcomeSection
          welcomeMessage="Users Management"
          subText="Manage user accounts, roles, and permissions."
        />
        {isAdmin && (
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={() => setFilterDrawerOpen(true)} size={isMobile ? "icon" : "default"}>
              <Filter className="h-4 w-4" />
              {!isMobile && <span className="ml-2">Filter</span>}
            </SecondaryButton>
            <SecondaryButton onClick={() => fetchUsers(true)} disabled={refreshingUsers} size={isMobile ? "icon" : "default"}>
              {refreshingUsers ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {!isMobile && <span className="ml-2">Refresh</span>}
            </SecondaryButton>
            <Button onClick={handleInviteUser}>
              <Link className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <DashboardStatsCard
          title="Total Users"
          value={calculatedStats?.totals?.totalUsers || 0}
          icon={UsersIcon}
          iconBgColor="rgba(22, 101, 52, 0.1)"
          iconColor="#166534"
        />
        <DashboardStatsCard
          title="Admins"
          value={calculatedStats?.totals?.adminUsers || 0}
          icon={Crown}
          iconBgColor="rgba(239, 68, 68, 0.1)"
          iconColor="#ef4444"
        />
        <DashboardStatsCard
          title="Managers"
          value={calculatedStats?.totals?.managerUsers || 0}
          icon={Settings}
          iconBgColor="rgba(139, 92, 246, 0.1)"
          iconColor="#8b5cf6"
        />
        <DashboardStatsCard
          title="Staff"
          value={calculatedStats?.totals?.staffUsers || 0}
          icon={Shield}
          iconBgColor="rgba(132, 204, 22, 0.1)"
          iconColor="#84cc16"
        />
      </div>

      {/* Pending Invites – only show when there are invites or still loading */}
      {isAdmin && (loadingInvites || pendingInvites.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Pending Invites
            </CardTitle>
            <CardDescription>
              People who have been invited but have not completed signup yet. Share the invite link or revoke.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingInvites ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left font-medium py-3 px-4">Email</th>
                      <th className="text-left font-medium py-3 px-4">Role</th>
                      <th className="text-left font-medium py-3 px-4">Invited</th>
                      <th className="text-left font-medium py-3 px-4">Expires</th>
                      <th className="text-right font-medium py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingInvites.map((invite) => (
                      <tr key={invite.id} className="border-b border-gray-100 last:border-0">
                        <td className="py-3 px-4">{invite.email}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={ROLE_CHIP_CLASSES[invite.role] ?? STATUS_CHIP_DEFAULT_CLASS}>
                            {invite.role?.toUpperCase() ?? '—'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {invite.createdAt ? dayjs(invite.createdAt).format('MMM DD, YYYY') : '—'}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {invite.expiresAt ? dayjs(invite.expiresAt).format('MMM DD, YYYY') : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <SecondaryButton
                              size="sm"
                              onClick={() => handleCopyPendingInviteLink(invite)}
                            >
                              <Copy className="h-4 w-4 mr-1" />
                              Copy link
                            </SecondaryButton>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRevokeInvite(invite.id)}
                              disabled={revokingInviteId === invite.id}
                            >
                              {revokingInviteId === invite.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 mr-1" />
                              )}
                              Revoke
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <DashboardTable
        data={paginatedUsers}
        columns={tableColumns}
        loading={loading}
        title={null}
        emptyIcon={<UsersIcon className="h-12 w-12 text-muted-foreground" />}
        emptyDescription="No users found"
        pageSize={pagination.pageSize}
        onPageChange={(newPagination) => {
          setPagination(newPagination);
        }}
        externalPagination={{
          current: pagination.current,
          total: usersCount
        }}
      />

      {/* Filter Drawer */}
      <Sheet open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
        <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto" style={{ top: 8, bottom: 8, right: 8, height: 'calc(100vh - 16px)', borderRadius: 8 }}>
          <SheetHeader className="pb-4 border-b">
            <SheetTitle>Filter Users</SheetTitle>
          </SheetHeader>
          <div className="space-y-6 mt-6">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={filters.role}
                onValueChange={(value) => setFilters({ ...filters, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {roleOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={filters.isActive}
                onValueChange={(value) => setFilters({ ...filters, isActive: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {statusOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <SecondaryButton onClick={handleClearFilters} className="w-full">
                Clear Filters
              </SecondaryButton>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false);
              setDeletingUserId(null);
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingUserId) {
                  handleDelete(deletingUserId);
                  setDeleteDialogOpen(false);
                  setDeletingUserId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              loading={deletingUser}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* User Details Drawer */}
      <DetailsDrawer
        open={drawerVisible}
        onClose={handleCloseDrawer}
        title="User Details"
        width={720}
        onEdit={null}
        onDelete={null}
        deleteConfirmText="Are you sure you want to delete this user?"
        extraActions={[]}
        fields={viewingUser ? [
          { 
            label: 'Avatar', 
            value: viewingUser.profilePicture,
            render: (picture) => (
              <ShadcnAvatar className="h-20 w-20">
                <AvatarImage src={resolveImageUrl(picture || '') || undefined} />
                <AvatarFallback>
                  <User className="h-10 w-10" />
                </AvatarFallback>
              </ShadcnAvatar>
            )
          },
          { label: 'Full Name', value: viewingUser.name },
          { label: 'Email', value: viewingUser.email },
          { 
            label: 'Role', 
            value: viewingUser.role,
            render: (role) => {
              const icons = { admin: <Crown className="h-3 w-3 mr-1" />, manager: <Settings className="h-3 w-3 mr-1" />, staff: <User className="h-3 w-3 mr-1" /> };
              return (
                <Badge variant="secondary" className="gap-1">
                  {icons[role]}
                  {role?.toUpperCase() || '—'}
                </Badge>
              );
            }
          },
          { 
            label: 'Status', 
            value: viewingUser.isActive,
            render: (isActive) => (
              <Badge variant={isActive ? 'default' : 'destructive'}>
                {isActive ? 'ACTIVE' : 'INACTIVE'}
              </Badge>
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
        <DialogContent className="sm:w-[var(--modal-w-lg)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)]">
          <DialogHeader>
            <DialogTitle>Invite New User</DialogTitle>
            <DialogDescription>
              Generate an invite link to share with a new user
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
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
                  <SecondaryButton type="button" onClick={() => {
                  setInviteModalVisible(false);
                  setGeneratedInviteLink(null);
                }} disabled={submittingInvite}>
                  Cancel
                </SecondaryButton>
                  <Button type="submit" loading={submittingInvite}>
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
                Copy invitation link
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
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users;


