import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import adminService from '../../services/adminService';
import { usePlatformAdminPermissions } from '../../context/PlatformAdminPermissionsContext';
import { showSuccess, showError } from '../../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import DashboardTable from '../../components/DashboardTable';
import ViewToggle from '../../components/ViewToggle';
import TableSkeleton from '../../components/TableSkeleton';
import {
  Plus,
  RefreshCw,
  Loader2,
  Edit,
  Trash2,
  Shield,
  Users,
  CheckSquare,
  Square,
  UserPlus,
  Eye
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import MobileFormDialog from '../../components/MobileFormDialog';

const roleSchema = z.object({
  name: z.string().min(1, 'Role name is required'),
  department: z.string().min(1, 'Department is required'),
  description: z.string().optional(),
  permissionIds: z.array(z.string()).default([])
});

const departments = [
  'Operations',
  'Marketing',
  'Engineering',
  'Sales',
  'Support',
  'Finance',
  'Other'
];

const AdminRoles = () => {
  const { hasPermission, hasAnyPermission, loading: permissionsLoading } = usePlatformAdminPermissions();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [platformAdmins, setPlatformAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [assignRoleModalVisible, setAssignRoleModalVisible] = useState(false);
  const [viewingRole, setViewingRole] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [assigningUser, setAssigningUser] = useState(null);
  const [userRoles, setUserRoles] = useState({});
  const [tableViewMode, setTableViewMode] = useState('table');

  const roleForm = useForm({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: '',
      department: '',
      description: '',
      permissionIds: []
    }
  });

  const assignForm = useForm({
    resolver: zodResolver(z.object({
      roleId: z.string().min(1, 'Role is required')
    })),
    defaultValues: {
      roleId: ''
    }
  });

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [rolesRes, permissionsRes, adminsRes] = await Promise.all([
          adminService.getPlatformAdminRoles(),
          adminService.getPlatformAdminPermissions(),
          adminService.getPlatformAdmins()
        ]);

        if (rolesRes?.success) setRoles(rolesRes.data || []);
        if (permissionsRes?.success) setPermissions(permissionsRes.data || []);
        if (adminsRes?.success) setPlatformAdmins(adminsRes.data || []);

        // Load roles for each admin
        if (adminsRes?.success && adminsRes.data) {
          const userRolesMap = {};
          for (const admin of adminsRes.data) {
            try {
              const userRolesRes = await adminService.getUserRoles(admin.id);
              if (userRolesRes?.success) {
                userRolesMap[admin.id] = userRolesRes.data || [];
              }
            } catch (error) {
              console.error(`Failed to load roles for user ${admin.id}:`, error);
            }
          }
          setUserRoles(userRolesMap);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
        showError(error, 'Failed to load roles');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Check permission after all hooks
  if (!permissionsLoading && !hasPermission('roles.view')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">Access Denied</h3>
          <p className="text-gray-600">You don't have permission to view roles.</p>
        </div>
      </div>
    );
  }

  const handleAdd = () => {
    setEditingRole(null);
    roleForm.reset({
      name: '',
      department: '',
      description: '',
      permissionIds: []
    });
    setRoleModalVisible(true);
  };

  const handleEdit = (role) => {
    setEditingRole(role);
    roleForm.reset({
      name: role.name,
      department: role.department,
      description: role.description || '',
      permissionIds: (role.permissions || []).map(p => p.id)
    });
    setRoleModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      if (editingRole) {
        await adminService.updatePlatformAdminRole(editingRole.id, {
          name: values.name,
          department: values.department,
          description: values.description
        });
        if (values.permissionIds.length > 0) {
          await adminService.assignPermissionsToRole(editingRole.id, values.permissionIds);
        }
        showSuccess('Role updated successfully');
      } else {
        const response = await adminService.createPlatformAdminRole({
          name: values.name,
          department: values.department,
          description: values.description,
          permissionIds: values.permissionIds
        });
        if (response?.success) {
          showSuccess('Role created successfully');
        }
      }
      setRoleModalVisible(false);
      // Reload data
      const rolesRes = await adminService.getPlatformAdminRoles();
      if (rolesRes?.success) setRoles(rolesRes.data || []);
    } catch (error) {
      showError(error, editingRole ? 'Failed to update role' : 'Failed to create role');
    }
  };

  const handleDelete = async (role) => {
    if (!confirm(`Are you sure you want to delete the role "${role.name}"?`)) {
      return;
    }
    try {
      await adminService.deletePlatformAdminRole(role.id);
      showSuccess('Role deleted successfully');
      // Reload data
      const rolesRes = await adminService.getPlatformAdminRoles();
      if (rolesRes?.success) setRoles(rolesRes.data || []);
    } catch (error) {
      showError(error, 'Failed to delete role');
    }
  };

  const handleAssignRole = async (user) => {
    setAssigningUser(user);
    assignForm.reset({ roleId: '' });
    setAssignRoleModalVisible(true);
  };

  const handleAssignSubmit = async (values) => {
    if (!assigningUser) return;
    try {
      await adminService.assignRoleToUser(assigningUser.id, values.roleId);
      showSuccess('Role assigned successfully');
      setAssignRoleModalVisible(false);
      // Reload user roles
      const userRolesRes = await adminService.getUserRoles(assigningUser.id);
      if (userRolesRes?.success) {
        setUserRoles(prev => ({
          ...prev,
          [assigningUser.id]: userRolesRes.data || []
        }));
      }
    } catch (error) {
      showError(error, 'Failed to assign role');
    }
  };

  const handleRemoveRole = async (user, role) => {
    if (!confirm(`Remove role "${role.name}" from ${user.name}?`)) {
      return;
    }
    try {
      await adminService.removeRoleFromUser(user.id, role.id);
      showSuccess('Role removed successfully');
      // Reload user roles
      const userRolesRes = await adminService.getUserRoles(user.id);
      if (userRolesRes?.success) {
        setUserRoles(prev => ({
          ...prev,
          [user.id]: userRolesRes.data || []
        }));
      }
    } catch (error) {
      showError(error, 'Failed to remove role');
    }
  };

  // Group permissions by category
  const permissionsByCategory = useMemo(() => {
    return permissions.reduce((acc, perm) => {
      if (!acc[perm.category]) {
        acc[perm.category] = [];
      }
      acc[perm.category].push(perm);
      return acc;
    }, {});
  }, [permissions]);

  const tableColumns = useMemo(() => [
    {
      key: 'name',
      title: 'Role Name',
      dataIndex: 'name',
      render: (text, record) => (
        <div>
          <div className="font-medium">{text}</div>
          {record.isDefault && (
            <Badge variant="secondary" className="text-xs mt-1">Default</Badge>
          )}
        </div>
      )
    },
    {
      key: 'department',
      title: 'Department',
      dataIndex: 'department'
    },
    {
      key: 'description',
      title: 'Description',
      dataIndex: 'description',
      render: (text) => text || '-'
    },
    {
      key: 'permissions',
      title: 'Permissions',
      render: (_, record) => (
        <div className="text-sm text-gray-600">
          {(record.permissions || []).length} permission(s)
        </div>
      )
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewingRole(record)}
          >
            <Eye className="h-4 w-4 mr-2" />
            View
          </Button>
          {hasPermission('roles.manage') && !record.isDefault && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleEdit(record)}
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      )
    }
  ], []);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground mb-1">Platform Admin Roles</h2>
          <p className="text-sm text-muted-foreground">
            Manage roles and permissions for platform administrators
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle value={tableViewMode} onChange={setTableViewMode} />
          {hasPermission('roles.manage') && (
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              New Role
            </Button>
          )}
        </div>
      </div>

      {/* Roles Table */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <DashboardTable
          data={roles}
          columns={tableColumns}
          loading={false}
          title={null}
          emptyIcon={<Shield className="h-12 w-12 text-muted-foreground" />}
          emptyTitle="No roles yet"
          emptyDescription="Create your first role to start managing permissions"
          viewMode={tableViewMode}
          onViewModeChange={setTableViewMode}
        />
      )}

      {/* User Role Assignment Section */}
      {hasPermission('roles.manage') && (
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle>Assign Roles to Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {platformAdmins.map(user => (
                <div key={user.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(userRoles[user.id] || []).map(role => (
                        <Badge key={role.id} variant="secondary" className="flex items-center gap-1">
                          {role.name}
                          <button
                            onClick={() => handleRemoveRole(user, role)}
                            className="ml-1 hover:text-red-600"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAssignRole(user)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Assign Role
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Role Modal */}
      <MobileFormDialog
        open={roleModalVisible}
        onOpenChange={setRoleModalVisible}
        title={editingRole ? 'Edit Role' : 'Create New Role'}
        description="Define a role and assign permissions"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setRoleModalVisible(false)}>
              Cancel
            </Button>
            <Button type="submit" form="admin-role-form">
              {editingRole ? 'Update' : 'Create'} Role
            </Button>
          </>
        }
      >
        <Form {...roleForm}>
          <form id="admin-role-form" onSubmit={roleForm.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={roleForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Marketing Manager" disabled={editingRole?.isDefault} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={roleForm.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={editingRole?.isDefault}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departments.map(dept => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={roleForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Role description..." rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <Label className="mb-2 block">Permissions</Label>
                <div className="space-y-4 max-h-[400px] overflow-y-auto border border-gray-200 rounded-lg p-4">
                  {Object.entries(permissionsByCategory).map(([category, perms]) => (
                    <div key={category}>
                      <h4 className="font-medium text-sm mb-2 capitalize">{category}</h4>
                      <div className="space-y-2 ml-4">
                        {perms.map(perm => (
                          <FormField
                            key={perm.id}
                            control={roleForm.control}
                            name="permissionIds"
                            render={({ field }) => {
                              return (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(perm.id)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...field.value, perm.id])
                                          : field.onChange(
                                              field.value?.filter((value) => value !== perm.id)
                                            );
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal cursor-pointer">
                                    <div className="font-medium">{perm.name}</div>
                                    {perm.description && (
                                      <div className="text-xs text-gray-500">{perm.description}</div>
                                    )}
                                  </FormLabel>
                                </FormItem>
                              );
                            }}
                          />
                        ))}
                      </div>
                      <Separator className="my-4" />
                    </div>
                  ))}
                </div>
              </div>
            </form>
          </Form>
      </MobileFormDialog>

      {/* Assign Role Modal */}
      <MobileFormDialog
        open={assignRoleModalVisible}
        onOpenChange={setAssignRoleModalVisible}
        title={`Assign Role to ${assigningUser?.name || ''}`}
        description="Select a role to assign to this user"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setAssignRoleModalVisible(false)}>
              Cancel
            </Button>
            <Button type="submit" form="admin-assign-role-form">
              Assign Role
            </Button>
          </>
        }
      >
        <Form {...assignForm}>
          <form id="admin-assign-role-form" onSubmit={assignForm.handleSubmit(handleAssignSubmit)} className="space-y-4">
              <FormField
                control={assignForm.control}
                name="roleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roles.map(role => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name} ({role.department})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
          </form>
        </Form>
      </MobileFormDialog>

      {/* View Role Sheet */}
      {viewingRole && (
        <Sheet open={!!viewingRole} onOpenChange={(open) => !open && setViewingRole(null)}>
          <SheetContent side="right" className="w-full sm:w-[400px] md:w-[600px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{viewingRole.name}</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              <div>
                <Label className="text-sm text-gray-500">Department</Label>
                <div className="font-medium">{viewingRole.department}</div>
              </div>
              {viewingRole.description && (
                <div>
                  <Label className="text-sm text-gray-500">Description</Label>
                  <div>{viewingRole.description}</div>
                </div>
              )}
              <div>
                <Label className="text-sm text-gray-500 mb-2 block">Permissions ({(viewingRole.permissions || []).length})</Label>
                <div className="space-y-2">
                  {Object.entries(permissionsByCategory).map(([category, perms]) => {
                    const rolePerms = (viewingRole.permissions || []).filter(p => 
                      perms.some(perm => perm.id === p.id)
                    );
                    if (rolePerms.length === 0) return null;
                    return (
                      <div key={category} className="border border-gray-200 rounded-lg p-3">
                        <h4 className="font-medium text-sm mb-2 capitalize">{category}</h4>
                        <div className="space-y-1">
                          {rolePerms.map(perm => (
                            <div key={perm.id} className="text-sm text-gray-700">
                              • {perm.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {hasPermission('roles.manage') && !viewingRole.isDefault && (
                <div className="pt-4 border-t mt-4">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Role
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this role?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This can't be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            handleDelete(viewingRole);
                            setViewingRole(null);
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
};

export default AdminRoles;
