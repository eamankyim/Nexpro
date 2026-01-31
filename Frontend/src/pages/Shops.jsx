import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Store, Plus, Search, MoreHorizontal, Edit, Trash2, MapPin, Phone, Mail, User, RefreshCw } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { useResponsive } from '../hooks/useResponsive';

import { Button } from '@/components/ui/button';
import { SecondaryButton } from '@/components/ui/secondary-button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
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
import DashboardStatsCard from '../components/DashboardStatsCard';
import TableSkeleton from '../components/TableSkeleton';
import { showSuccess, showError } from '../utils/toast';
import api from '../services/api';
import { STATUS_CHIP_CLASSES } from '../constants';

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
  
  // State
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState(null);
  const [deleteShop, setDeleteShop] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const debouncedSearch = useDebounce(searchText, 500);
  
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
      
      if (response.data.success) {
        setShops(response.data.data);
        setPagination(prev => ({
          ...prev,
          total: response.data.count,
        }));
      }
    } catch (error) {
      console.error('Error fetching shops:', error);
      showError('Failed to fetch shops');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, debouncedSearch]);
  
  useEffect(() => {
    fetchShops();
  }, [fetchShops]);
  
  // Stats
  const stats = useMemo(() => {
    const total = shops.length;
    const active = shops.filter(s => s.isActive).length;
    const inactive = total - active;
    const cities = [...new Set(shops.map(s => s.city).filter(Boolean))].length;
    
    return { total, active, inactive, cities };
  }, [shops]);
  
  // Table columns
  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Shop Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <Store className="h-4 w-4 text-green-700" />
          </div>
          <div>
            <div className="font-medium">{row.original.name}</div>
            {row.original.code && (
              <div className="text-xs text-gray-500">{row.original.code}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'city',
      header: 'Location',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-gray-600">
          <MapPin className="h-3 w-3" />
          <span>{row.original.city || '-'}</span>
        </div>
      ),
    },
    {
      accessorKey: 'managerName',
      header: 'Manager',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-gray-600">
          <User className="h-3 w-3" />
          <span>{row.original.managerName || '-'}</span>
        </div>
      ),
    },
    {
      accessorKey: 'phone',
      header: 'Contact',
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original.phone && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3 text-gray-400" />
              {row.original.phone}
            </div>
          )}
          {row.original.email && (
            <div className="flex items-center gap-1 text-gray-500">
              <Mail className="h-3 w-3 text-gray-400" />
              {row.original.email}
            </div>
          )}
          {!row.original.phone && !row.original.email && '-'}
        </div>
      ),
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
          row.original.isActive ? STATUS_CHIP_CLASSES.active_flag : STATUS_CHIP_CLASSES.inactive_flag
        }`}>
          {row.original.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(row.original)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setDeleteShop(row.original)}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], []);
  
  // Handlers
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
  
  const handleEdit = (shop) => {
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
  
  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };
  
  const handlePageSizeChange = (newPageSize) => {
    setPagination(prev => ({ ...prev, pageSize: newPageSize, page: 1 }));
  };
  
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Shops</h1>
          <p className="text-gray-600 mt-1">Manage your shop locations and branches</p>
        </div>
        <Button onClick={handleCreate} className="bg-green-700 hover:bg-green-800">
          <Plus className="h-4 w-4 mr-2" />
          Add Shop
        </Button>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DashboardStatsCard
          title="Total Shops"
          value={stats.total}
          subtitle={`${stats.total} locations`}
          icon={Store}
        />
        <DashboardStatsCard
          title="Active"
          value={stats.active}
          subtitle={`${stats.active} operational`}
          icon={Store}
        />
        <DashboardStatsCard
          title="Inactive"
          value={stats.inactive}
          subtitle={`${stats.inactive} closed`}
          icon={Store}
        />
        <DashboardStatsCard
          title="Cities"
          value={stats.cities}
          subtitle={`${stats.cities} locations`}
          icon={MapPin}
        />
      </div>
      
      {/* Search and Filters */}
      <Card className="border border-gray-200">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search shops..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-10"
              />
            </div>
            <SecondaryButton onClick={fetchShops} size={isMobile ? 'icon' : 'default'}>
              <RefreshCw className="h-4 w-4" />
              {!isMobile && <span className="ml-2">Refresh</span>}
            </SecondaryButton>
          </div>
        </CardContent>
      </Card>
      
      {/* Data Table */}
      <Card className="border border-gray-200">
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton columns={6} rows={5} />
          ) : (
            <DashboardTable
              columns={columns}
              data={shops}
              pagination={{
                page: pagination.page,
                pageSize: pagination.pageSize,
                total: pagination.total,
              }}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              emptyMessage="No shops found"
            />
          )}
        </CardContent>
      </Card>
      
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <p className="text-sm text-gray-500">
                        Set whether this shop is currently operational
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
              
              {/* Form Buttons */}
              <div className="flex justify-end gap-2 pt-4 sticky bottom-0 bg-white pb-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-green-700 hover:bg-green-800"
                  loading={isSubmitting}
                >
                  {editingShop ? 'Update Shop' : 'Create Shop'}
                </Button>
              </div>
            </form>
          </Form>
          </DialogBody>
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
