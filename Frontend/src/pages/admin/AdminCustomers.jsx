import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usePlatformAdminPermissions } from '../../context/PlatformAdminPermissionsContext';
import { useDebounce } from '../../hooks/useDebounce';
import adminService from '../../services/adminService';
import { showError, showSuccess, handleApiError } from '../../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import DashboardTable from '../../components/DashboardTable';
import ViewToggle from '../../components/ViewToggle';
import { useResponsive } from '../../hooks/useResponsive';
import { useSmartSearch } from '../../context/SmartSearchContext';
import { RefreshCw, Loader2, Users, Plus, Pencil } from 'lucide-react';
import dayjs from 'dayjs';
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
import { DEBOUNCE_DELAYS } from '../../constants';

const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  company: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  notes: z.string().optional(),
});

const AdminCustomers = () => {
  const { searchValue, setPageSearchConfig } = useSmartSearch();
  const { hasPermission, loading: permissionsLoading } = usePlatformAdminPermissions();
  const debouncedSearch = useDebounce(searchValue, DEBOUNCE_DELAYS.SEARCH);
  const { isMobile } = useResponsive();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tableViewMode, setTableViewMode] = useState('table');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);

  const form = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      company: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      notes: '',
    },
  });

  useEffect(() => {
    setPageSearchConfig({
      placeholder: 'Search customers by name, company, email, or phone...',
      scope: 'admin-customers',
    });
  }, [setPageSearchConfig]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      };
      const res = await adminService.getAdminCustomers(params);
      if (res?.success) {
        setCustomers(Array.isArray(res.data) ? res.data : []);
        const p = res.pagination || {};
        setPagination((prev) => ({
          ...prev,
          total: res.count ?? prev.total,
          totalPages: p.totalPages ?? (Math.ceil((res.count ?? 0) / prev.pageSize) || 1),
        }));
      } else {
        setCustomers([]);
      }
    } catch (error) {
      showError(error, 'Failed to load customers');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, debouncedSearch]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    setPagination((p) => ({ ...p, current: 1 }));
  }, [debouncedSearch]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setPagination((p) => ({ ...p, current: 1 }));
    await fetchCustomers();
    setRefreshing(false);
  };

  const handleAdd = () => {
    setEditingCustomer(null);
    form.reset({
      name: '',
      company: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      notes: '',
    });
    setModalOpen(true);
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    form.reset({
      name: customer.name ?? '',
      company: customer.company ?? '',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      address: customer.address ?? '',
      city: customer.city ?? '',
      state: customer.state ?? '',
      notes: customer.notes ?? '',
    });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingCustomer(null);
  };

  const onSubmit = async (values) => {
    setSaving(true);
    try {
      if (editingCustomer) {
        await adminService.updateAdminCustomer(editingCustomer.id, values);
        showSuccess('Customer updated');
      } else {
        await adminService.createAdminCustomer(values);
        showSuccess('Customer created');
      }
      handleCloseModal();
      fetchCustomers();
    } catch (error) {
      handleApiError(error, { context: editingCustomer ? 'update customer' : 'create customer' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (customer) => setDeleteId(customer.id);

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      await adminService.deleteAdminCustomer(deleteId);
      showSuccess('Customer deleted');
      setDeleteId(null);
      fetchCustomers();
    } catch (error) {
      handleApiError(error, { context: 'delete customer' });
    }
  };

  const tableColumns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Name',
        render: (_, record) => (
          <span className="font-medium text-foreground">{record?.name ?? '—'}</span>
        ),
      },
      {
        key: 'company',
        label: 'Company',
        render: (_, record) => (
          <span className="text-foreground">{record?.company ?? '—'}</span>
        ),
      },
      {
        key: 'email',
        label: 'Email',
        render: (_, record) => (
          <span className="text-foreground">{record?.email ?? '—'}</span>
        ),
      },
      {
        key: 'phone',
        label: 'Phone',
        render: (_, record) => (
          <span className="text-foreground">{record?.phone ?? '—'}</span>
        ),
      },
      {
        key: 'createdAt',
        label: 'Created',
        render: (_, record) => (
          <span className="text-muted-foreground">
            {record?.createdAt ? dayjs(record.createdAt).format('MMM DD, YYYY') : '—'}
          </span>
        ),
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (_, record) => (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEdit(record)}
              aria-label="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  if (!permissionsLoading && !hasPermission('tenants.view')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">Access Denied</h3>
          <p className="text-muted-foreground">You don&apos;t have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground mb-1">Customers</h2>
          <p className="text-sm text-muted-foreground">
            Manage your own customers. Create customers and create jobs for them (e.g. website design).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleAdd} size={isMobile ? 'icon' : 'default'}>
            <Plus className="h-4 w-4" />
            {!isMobile && <span className="ml-2">Add customer</span>}
          </Button>
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
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: 'rgba(22, 101, 52, 0.1)' }}
          >
            <Users className="h-5 w-5" style={{ color: '#166534' }} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total customers</p>
            <p className="text-2xl font-semibold text-foreground">{pagination.total}</p>
          </div>
        </div>
      </div>

      <DashboardTable
        data={customers}
        columns={tableColumns}
        loading={loading}
        title={null}
        emptyIcon={<Users className="h-12 w-12 text-muted-foreground" />}
        emptyDescription="No customers yet. Add a customer to get started."
        pageSize={pagination.pageSize}
        viewMode={tableViewMode}
        onViewModeChange={setTableViewMode}
        externalPagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
        }}
        onPageChange={(next) => setPagination((p) => ({ ...p, ...next }))}
      />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Edit customer' : 'Add customer'}</DialogTitle>
            <DialogDescription>
              {editingCustomer
                ? 'Update customer details.'
                : 'Create a new customer.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Customer name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Company name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="email@example.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Phone number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Street address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="City" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="State / Region" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Notes" rows={3} className="resize-none" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {saving ? ' Saving...' : editingCustomer ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The customer will be removed from your list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminCustomers;
