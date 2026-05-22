import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Building2,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStudioLocation } from '../context/StudioLocationContext';
import { useSmartSearch } from '../context/SmartSearchContext';
import { useDebounce } from '../hooks/useDebounce';
import { useResponsive } from '../hooks/useResponsive';
import studioLocationService from '../services/studioLocationService';
import userService from '../services/userService';
import { resolveImageUrl } from '../utils/fileUtils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { SecondaryButton } from '@/components/ui/secondary-button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import DashboardTable from '../components/DashboardTable';
import StatusChip from '../components/StatusChip';
import DashboardStatsCard from '../components/DashboardStatsCard';
import { showSuccess, showError } from '../utils/toast';
import { DEBOUNCE_DELAYS } from '../constants';

const locationSchema = z.object({
  name: z.string().min(1, 'Studio name is required'),
  code: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default('Ghana'),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  managerUserId: z.string().optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().optional(),
});

const StudioLocations = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isManager } = useAuth();
  const { refreshLocations } = useStudioLocation();
  const { isMobile } = useResponsive();
  const { searchValue, setPageSearchConfig } = useSmartSearch();
  const debouncedSearch = useDebounce(searchValue, DEBOUNCE_DELAYS.SEARCH);

  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const logoInputRef = useRef(null);

  const form = useForm({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: '',
      code: '',
      address: '',
      city: '',
      state: '',
      country: 'Ghana',
      postalCode: '',
      phone: '',
      email: '',
      managerUserId: '',
      isActive: true,
      isDefault: false,
    },
  });

  const loadTeamMembers = useCallback(async () => {
    try {
      const response = await userService.getAll({ limit: 200, isActive: 'true' });
      const list = Array.isArray(response?.data) ? response.data : response?.data?.data || [];
      setTeamMembers(list.filter((u) => u.isActive !== false));
    } catch {
      setTeamMembers([]);
    }
  }, []);

  useEffect(() => {
    if (isModalOpen) loadTeamMembers();
  }, [isModalOpen, loadTeamMembers]);

  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await studioLocationService.getAll({
        page: pagination.page,
        limit: pagination.pageSize,
        search: debouncedSearch,
      });
      const list = Array.isArray(response?.data) ? response.data : [];
      setLocations(list);
      setPagination((prev) => ({ ...prev, total: response?.count ?? list.length }));
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to load studio locations');
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, debouncedSearch]);

  useEffect(() => {
    setPageSearchConfig({ scope: 'studio-locations', placeholder: 'Search studios by name or city…' });
  }, [setPageSearchConfig]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const stats = useMemo(() => {
    const active = locations.filter((l) => l.isActive).length;
    return {
      total: pagination.total,
      active,
      inactive: locations.length - active,
      cities: [...new Set(locations.map((l) => l.city).filter(Boolean))].length,
    };
  }, [locations, pagination.total]);

  const handleEdit = useCallback(
    (row) => {
      setEditing(row);
      form.reset({
        name: row.name || '',
        code: row.code || '',
        address: row.address || '',
        city: row.city || '',
        state: row.state || '',
        country: row.country || 'Ghana',
        postalCode: row.postalCode || '',
        phone: row.phone || '',
        email: row.email || '',
        managerUserId: row.managerUserId || row.manager?.id || '',
        isActive: row.isActive ?? true,
        isDefault: row.isDefault ?? false,
      });
      setLogoPreview(row.logoUrl ? resolveImageUrl(row.logoUrl) : '');
      setLogoFile(null);
      setIsModalOpen(true);
    },
    [form]
  );

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Studio',
        render: (_, record) => (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-green-700" />
            </div>
            <div>
              <div className="font-medium">{record?.name || '—'}</div>
              {record?.code && <div className="text-xs text-gray-500">{record.code}</div>}
            </div>
          </div>
        ),
      },
      {
        key: 'city',
        label: 'City',
        render: (_, record) => (
          <span className="flex items-center gap-1 text-gray-600">
            <MapPin className="h-3 w-3" />
            {record?.city || '—'}
          </span>
        ),
      },
      {
        key: 'manager',
        label: 'Manager',
        render: (_, record) => record?.manager?.name || record?.manager?.email || '—',
      },
      {
        key: 'isActive',
        label: 'Status',
        render: (_, record) => (
          <StatusChip status={record?.isActive ? 'active_flag' : 'inactive_flag'} />
        ),
      },
      ...(isManager
        ? [
            {
              key: 'actions',
              label: 'Actions',
              render: (_, record) => (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(record)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteTarget(record)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
            },
          ]
        : []),
    ],
    [handleEdit, isManager]
  );

  const handleCreate = useCallback(() => {
    setEditing(null);
    form.reset({
      name: '',
      code: '',
      address: '',
      city: '',
      state: '',
      country: 'Ghana',
      postalCode: '',
      phone: '',
      email: '',
      managerUserId: '',
      isActive: true,
      isDefault: false,
    });
    setLogoPreview('');
    setLogoFile(null);
    setIsModalOpen(true);
  }, [form]);

  useEffect(() => {
    if (searchParams.get('add') !== '1') return;
    handleCreate();
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('add');
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams, handleCreate]);

  const onSubmit = async (data) => {
    try {
      setIsSubmitting(true);
      const payload = {
        ...data,
        managerUserId: data.managerUserId || null,
        email: data.email || null,
        phone: data.phone || null,
      };
      let savedId = editing?.id;
      if (editing) {
        const res = await studioLocationService.update(editing.id, payload);
        savedId = res?.data?.id || res?.id || editing.id;
        showSuccess('Studio updated');
      } else {
        const res = await studioLocationService.create(payload);
        savedId = res?.data?.id || res?.id;
        showSuccess('Studio added');
      }
      if (logoFile && savedId) {
        await studioLocationService.uploadLogo(savedId, logoFile);
      }
      setIsModalOpen(false);
      setLogoFile(null);
      fetchLocations();
      refreshLocations();
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to save studio');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogoSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showError('Please choose an image file');
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await studioLocationService.remove(deleteTarget.id);
      showSuccess('Studio removed');
      setDeleteTarget(null);
      fetchLocations();
      refreshLocations();
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to delete studio');
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Studios</h1>
          <p className="text-muted-foreground mt-1">
            Manage branches like Accra or Kumasi. Customers and jobs are scoped to the active studio.
          </p>
        </div>
        {isManager && (
          <div className="flex gap-2">
            <SecondaryButton onClick={fetchLocations} size={isMobile ? 'icon' : 'default'}>
              <RefreshCw className="h-4 w-4" />
            </SecondaryButton>
            <Button onClick={handleCreate} className="bg-brand hover:bg-brand-dark">
              <Plus className="h-4 w-4 mr-2" />
              Add studio
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DashboardStatsCard title="Total" value={stats.total} icon={Building2} />
        <DashboardStatsCard title="Active" value={stats.active} icon={Building2} />
        <DashboardStatsCard title="Inactive" value={stats.inactive} icon={Building2} />
        <DashboardStatsCard title="Cities" value={stats.cities} icon={MapPin} />
      </div>

      <DashboardTable
        data={locations}
        columns={columns}
        loading={loading}
        emptyDescription="No studio locations yet. Add your first branch to separate customers and jobs."
        emptyAction={
          isManager ? (
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add studio
            </Button>
          ) : null
        }
        pageSize={pagination.pageSize}
        externalPagination={{ current: pagination.page, total: pagination.total }}
        onPageChange={(p) =>
          setPagination((prev) => ({
            ...prev,
            page: typeof p === 'number' ? p : p?.current ?? prev.page,
            pageSize: typeof p === 'object' ? p?.pageSize ?? prev.pageSize : prev.pageSize,
          }))
        }
      />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit studio' : 'Add studio'}</DialogTitle>
            <DialogDescription>
              Each studio has its own customers and jobs. Use the header switcher to work in a location.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Form {...form}>
              <form id="studio-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Studio name</FormLabel>
                      <FormControl>
                        <Input placeholder="Accra Branch" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="ACC-01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="rounded-lg border border-border p-4 space-y-3">
                  <FormLabel>Studio logo (optional)</FormLabel>
                  <p className="text-sm text-muted-foreground">
                    Used on invoices and customer documents for this studio.
                  </p>
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Studio logo"
                      className="max-h-20 max-w-[180px] object-contain border border-border rounded-md p-2"
                    />
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoSelect}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                      {logoPreview ? 'Change logo' : 'Upload logo'}
                    </Button>
                    {logoPreview ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setLogoFile(null);
                          setLogoPreview('');
                        }}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Street address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                        <FormLabel>Phone (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business email (optional)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="studio@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="managerUserId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manager (optional)</FormLabel>
                      <Select
                        value={field.value || '__none__'}
                        onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select team member" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">No manager assigned</SelectItem>
                          {teamMembers.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name || member.email}
                              {member.role ? ` (${member.role})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {editing && !editing.isDefault ? (
                  <FormField
                    control={form.control}
                    name="isDefault"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between border rounded-lg p-4">
                        <FormLabel>Default studio</FormLabel>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormItem>
                    )}
                  />
                ) : null}
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between border rounded-lg p-4">
                      <FormLabel>Active</FormLabel>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="studio-form" loading={isSubmitting} className="bg-brand hover:bg-brand-dark">
              {editing ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete studio</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{deleteTarget?.name}&quot;? Existing customers and jobs remain linked to this studio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StudioLocations;
