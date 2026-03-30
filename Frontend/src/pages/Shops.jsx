import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Store, Plus, MoreHorizontal, Edit, Trash2, MapPin, Phone, Mail, User, RefreshCw } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useSmartSearch } from '../context/SmartSearchContext';
import { useDebounce } from '../hooks/useDebounce';
import { useResponsive } from '../hooks/useResponsive';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
import api from '../services/api';
import { SEARCH_PLACEHOLDERS, DEBOUNCE_DELAYS } from '../constants';

// Validation schema
const shopSchema = z.object({
  name: z.string().min(1, 'Shop name is required'),
  code: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default('Ghana'),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  managerName: z.string().optional(),
  isActive: z.boolean().default(true),
});

const Shops = () => {
  const { activeTenant } = useAuth();
  const { isMobile } = useResponsive();
  const { searchValue, setPageSearchConfig } = useSmartSearch();
  const debouncedSearch = useDebounce(searchValue, DEBOUNCE_DELAYS.SEARCH);

  // State
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState(null);
  const [deleteShop, setDeleteShop] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form
  const form = useForm({
    resolver: zodResolver(shopSchema),
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
      managerName: '',
      isActive: true,
    },
  });
  
  // Fetch shops
  const fetchShops = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/shops', {
        params: {
          page: pagination.page,
          limit: pagination.pageSize,
          search: debouncedSearch,
        },
      });
      
      // Handle different response structures
      const shopsData = Array.isArray(response?.data) 
        ? response.data 
        : (response?.data?.data || response?.data?.shops || []);
      const total = response?.data?.count ?? response?.count ?? shopsData.length;
      
      setShops(shopsData);
      setPagination(prev => ({
        ...prev,
        total: total,
      }));
    } catch (error) {
      console.error('Error fetching shops:', error);
      showError('Failed to fetch shops');
      setShops([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, debouncedSearch]);
  
  useEffect(() => {
    setPageSearchConfig({ scope: 'shops', placeholder: SEARCH_PLACEHOLDERS.SHOPS });
  }, [setPageSearchConfig]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  // Stats
  const stats = useMemo(() => {
    const total = pagination.total;
    const active = shops.filter(s => s.isActive).length;
    const inactive = shops.filter(s => !s.isActive).length;
    const cities = [...new Set(shops.map(s => s.city).filter(Boolean))].length;
    
    return { total, active, inactive, cities };
  }, [shops, pagination.total]);

  // Handlers (must be defined before columns that reference them)
  const handleEdit = useCallback((shop) => {
    setEditingShop(shop);
    form.reset({
      name: shop.name || '',
      code: shop.code || '',
      address: shop.address || '',
      city: shop.city || '',
      state: shop.state || '',
      country: shop.country || 'Ghana',
      postalCode: shop.postalCode || '',
      phone: shop.phone || '',
      email: shop.email || '',
      managerName: shop.managerName || '',
      isActive: shop.isActive ?? true,
    });
    setIsModalOpen(true);
  }, [form]);
  
  // Table columns - DashboardTable format: { key, label, render }
  const columns = useMemo(() => [
    {
      key: 'name',
      label: 'Shop Name',
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <Store className="h-4 w-4 text-green-700" />
          </div>
          <div>
            <div className="font-medium">{record?.name || '—'}</div>
            {record?.code && (
              <div className="text-xs text-gray-500">{record.code}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'city',
      label: 'Location',
      render: (_, record) => (
        <div className="flex items-center gap-1 text-gray-600">
          <MapPin className="h-3 w-3" />
          <span>{record?.city || '—'}</span>
        </div>
      ),
    },
    {
      key: 'managerName',
      label: 'Manager',
      render: (_, record) => (
        <div className="flex items-center gap-1 text-gray-600">
          <User className="h-3 w-3" />
          <span>{record?.managerName || '—'}</span>
        </div>
      ),
    },
    {
      key: 'phone',
      label: 'Contact',
      render: (_, record) => (
        <div className="text-sm">
          {record?.phone && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3 text-gray-400" />
              {record.phone}
            </div>
          )}
          {record?.email && (
            <div className="flex items-center gap-1 text-gray-500">
              <Mail className="h-3 w-3 text-gray-400" />
              {record.email}
            </div>
          )}
          {!record?.phone && !record?.email && '—'}
        </div>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      mobileDashboardPlacement: 'headerEnd',
      render: (_, record) => (
        <StatusChip status={record?.isActive ? 'active_flag' : 'inactive_flag'} />
      ),
    },
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
              onClick={() => setDeleteShop(record)}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [handleEdit]);
  
  const handleCreate = () => {
    setEditingShop(null);
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
      managerName: '',
      isActive: true,
    });
    setIsModalOpen(true);
  };
  
  const onSubmit = async (data) => {
    try {
      setIsSubmitting(true);
      
      if (editingShop) {
        await api.put(`/shops/${editingShop.id}`, data);
        showSuccess('Shop updated successfully');
      } else {
        await api.post('/shops', data);
        showSuccess('Shop created successfully');
      }
      
      setIsModalOpen(false);
      fetchShops();
    } catch (error) {
      console.error('Error saving shop:', error);
      showError(error.response?.data?.message || 'Failed to save shop');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDelete = async () => {
    if (!deleteShop) return;
    
    try {
      await api.delete(`/shops/${deleteShop.id}`);
      showSuccess('Shop deleted successfully');
      setDeleteShop(null);
      fetchShops();
    } catch (error) {
      console.error('Error deleting shop:', error);
      showError(error.response?.data?.message || 'Failed to delete shop');
    }
  };
  
  const handlePageChange = (newPagination) => {
    // DashboardTable passes { current, pageSize } or just a number
    if (typeof newPagination === 'number') {
      setPagination(prev => ({ ...prev, page: newPagination }));
    } else {
      setPagination(prev => ({
        ...prev,
        page: newPagination.current ?? prev.page,
        pageSize: newPagination.pageSize ?? prev.pageSize,
      }));
    }
  };
  
  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Shops</h1>
          <p className="text-gray-600 mt-1">Manage your shop locations and branches</p>
        </div>
        <div className="flex flex-row gap-2 w-full md:w-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <SecondaryButton onClick={fetchShops} size={isMobile ? 'icon' : 'default'}>
                <RefreshCw className="h-4 w-4" />
              </SecondaryButton>
            </TooltipTrigger>
            <TooltipContent>Refresh shops list</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleCreate}
                className="bg-green-700 hover:bg-green-800 flex-1 md:flex-none"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Shop
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add a new shop location</TooltipContent>
          </Tooltip>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DashboardStatsCard
          tooltip="Total number of shop locations"
          title="Total Shops"
          value={stats.total}
          subtitle={`${stats.total} locations`}
          icon={Store}
        />
        <DashboardStatsCard
          tooltip="Operational shop locations"
          title="Active"
          value={stats.active}
          subtitle={`${stats.active} operational`}
          icon={Store}
        />
        <DashboardStatsCard
          tooltip="Closed shop locations"
          title="Inactive"
          value={stats.inactive}
          subtitle={`${stats.inactive} closed`}
          icon={Store}
        />
        <DashboardStatsCard
          tooltip="Number of cities with shops"
          title="Cities"
          value={stats.cities}
          subtitle={`${stats.cities} locations`}
          icon={MapPin}
        />
      </div>
      
      {/* Data Table */}
      <DashboardTable
        data={shops}
        columns={columns}
        loading={loading}
        title={null}
        emptyDescription="No shop locations yet. Set up your shop locations to manage inventory and sales."
        emptyAction={
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Shop
          </Button>
        }
        pageSize={pagination.pageSize}
        externalPagination={{ current: pagination.page, total: pagination.total }}
        onPageChange={handlePageChange}
      />
      
      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:w-[var(--modal-w-md)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)]">
          <DialogHeader>
            <DialogTitle>{editingShop ? 'Edit Shop' : 'Add New Shop'}</DialogTitle>
            <DialogDescription>
              {editingShop 
                ? 'Update the shop details below' 
                : 'Fill in the details to create a new shop location'}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
          <Form {...form}>
            <form id="shop-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shop Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Main Branch" {...field} />
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
                    <FormLabel>Shop Code (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="MAIN-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Business Street" {...field} />
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
                        <Input placeholder="Accra" {...field} />
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
                      <FormLabel>State/Region (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Greater Accra" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="Ghana" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="00233" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="managerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manager Name (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="+233 24 123 4567" {...field} />
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
                      <FormLabel>Email (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="shop@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-lg border p-4">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <p className="text-sm text-gray-500">
                        Set whether this shop is currently operational
                      </p>
                    </div>
                    <FormControl>
                      <div className="min-h-[44px] min-w-[44px] flex items-center justify-end shrink-0">
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            </form>
          </Form>
          </DialogBody>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              form="shop-form"
              className="bg-green-700 hover:bg-green-800"
              loading={isSubmitting}
            >
              {editingShop ? 'Update Shop' : 'Create Shop'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteShop} onOpenChange={() => setDeleteShop(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shop</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteShop?.name}"? This action cannot be undone.
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

export default Shops;
