import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Building2, Plus, Search, MoreHorizontal, Edit, Trash2, 
  MapPin, Phone, Mail, User, RefreshCw 
} from 'lucide-react';

import { useDebounce } from '../hooks/useDebounce';
import { useResponsive } from '../hooks/useResponsive';

import { Button } from '@/components/ui/button';
import { SecondaryButton } from '@/components/ui/secondary-button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import DashboardTable from '../components/DashboardTable';
import DashboardStatsCard from '../components/DashboardStatsCard';
import TableSkeleton from '../components/TableSkeleton';
import { showSuccess, showError } from '../utils/toast';
import api from '../services/api';

const pharmacySchema = z.object({
  name: z.string().min(1, 'Pharmacy name is required'),
  code: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default('Ghana'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  pharmacistName: z.string().optional(),
  licenseNumber: z.string().optional(),
  isActive: z.boolean().default(true),
});

const Pharmacies = () => {
  const { isMobile } = useResponsive();
  
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPharmacy, setEditingPharmacy] = useState(null);
  const [deletePharmacy, setDeletePharmacy] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const debouncedSearch = useDebounce(searchText, 500);
  
  const form = useForm({
    resolver: zodResolver(pharmacySchema),
    defaultValues: {
      name: '', code: '', address: '', city: '', state: '', country: 'Ghana',
      phone: '', email: '', pharmacistName: '', licenseNumber: '', isActive: true,
    },
  });
  
  const fetchPharmacies = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/pharmacies', {
        params: { page: pagination.page, limit: pagination.pageSize, search: debouncedSearch },
      });
      // API interceptor returns response.data (body) directly
      const list = Array.isArray(response?.data) ? response.data : [];
      const total = response?.count ?? list.length;
      setPharmacies(list);
      setPagination(prev => ({ ...prev, total }));
    } catch (error) {
      showError('Failed to fetch pharmacies');
      setPharmacies([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, debouncedSearch]);
  
  useEffect(() => { fetchPharmacies(); }, [fetchPharmacies]);
  
  const stats = useMemo(() => {
    const total = pharmacies.length;
    const active = pharmacies.filter(p => p.isActive).length;
    return { total, active, inactive: total - active };
  }, [pharmacies]);
  
  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Pharmacy',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <Building2 className="h-4 w-4" style={{ color: '#166534' }} />
          </div>
          <div>
            <div className="font-medium">{row.original.name}</div>
            {row.original.code && <div className="text-xs text-gray-500">{row.original.code}</div>}
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
      accessorKey: 'pharmacistName',
      header: 'Pharmacist',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-gray-600">
          <User className="h-3 w-3" />
          <span>{row.original.pharmacistName || '-'}</span>
        </div>
      ),
    },
    {
      accessorKey: 'licenseNumber',
      header: 'License #',
      cell: ({ row }) => row.original.licenseNumber || '-',
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
            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(row.original)}>
              <Edit className="h-4 w-4 mr-2" />Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDeletePharmacy(row.original)} className="text-red-600">
              <Trash2 className="h-4 w-4 mr-2" />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], []);
  
  const handleCreate = () => {
    setEditingPharmacy(null);
    form.reset();
    setIsModalOpen(true);
  };
  
  const handleEdit = (pharmacy) => {
    setEditingPharmacy(pharmacy);
    form.reset(pharmacy);
    setIsModalOpen(true);
  };
  
  const onSubmit = async (data) => {
    try {
      setIsSubmitting(true);
      if (editingPharmacy) {
        await api.put(`/pharmacies/${editingPharmacy.id}`, data);
        showSuccess('Pharmacy updated');
      } else {
        await api.post('/pharmacies', data);
        showSuccess('Pharmacy created');
      }
      setIsModalOpen(false);
      fetchPharmacies();
    } catch (error) {
      showError(error.response?.data?.message || 'Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDelete = async () => {
    try {
      await api.delete(`/pharmacies/${deletePharmacy.id}`);
      showSuccess('Pharmacy deleted');
      setDeletePharmacy(null);
      fetchPharmacies();
    } catch (error) {
      showError('Failed to delete');
    }
  };
  
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Pharmacies</h1>
          <p className="text-gray-600 mt-1">Manage your pharmacy locations</p>
        </div>
        <Button onClick={handleCreate} className="bg-[#166534] hover:bg-[#14532d] text-white">
          <Plus className="h-4 w-4 mr-2" />Add Pharmacy
        </Button>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <DashboardStatsCard title="Total" value={stats.total} subtitle={`${stats.total} pharmacies`} icon={Building2} />
        <DashboardStatsCard title="Active" value={stats.active} subtitle={`${stats.active} operational`} icon={Building2} />
        <DashboardStatsCard title="Inactive" value={stats.inactive} subtitle={`${stats.inactive} closed`} icon={Building2} />
      </div>
      
      <Card className="border border-gray-200">
        <CardContent className="p-4">
          <div className="flex gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="pl-10" />
            </div>
            <SecondaryButton onClick={fetchPharmacies} size={isMobile ? 'icon' : 'default'}>
              <RefreshCw className="h-4 w-4" />{!isMobile && <span className="ml-2">Refresh</span>}
            </SecondaryButton>
          </div>
        </CardContent>
      </Card>
      
      <Card className="border border-gray-200">
        <CardContent className="p-0">
          {loading ? <TableSkeleton columns={6} rows={5} /> : (
            <DashboardTable
              columns={columns}
              data={pharmacies}
              pagination={pagination}
              onPageChange={(p) => setPagination(prev => ({ ...prev, page: p }))}
              onPageSizeChange={(s) => setPagination(prev => ({ ...prev, pageSize: s, page: 1 }))}
              emptyMessage="No pharmacies found"
            />
          )}
        </CardContent>
      </Card>
      
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:w-[var(--modal-w-md)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)]">
          <DialogHeader>
            <DialogTitle>{editingPharmacy ? 'Edit Pharmacy' : 'Add Pharmacy'}</DialogTitle>
            <DialogDescription>Enter pharmacy details below</DialogDescription>
          </DialogHeader>
          <DialogBody>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl><Input placeholder="Pharmacy name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="code" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code (optional)</FormLabel>
                    <FormControl><Input placeholder="PH-001" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="licenseNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>License # (optional)</FormLabel>
                    <FormControl><Input placeholder="License number" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
              
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl><Input placeholder="Street address" {...field} /></FormControl>
                </FormItem>
              )} />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem>
                    <FormLabel>City (optional)</FormLabel>
                    <FormControl><Input placeholder="Accra" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="state" render={({ field }) => (
                  <FormItem>
                    <FormLabel>State/Region (optional)</FormLabel>
                    <FormControl><Input placeholder="Greater Accra" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
              
              <FormField control={form.control} name="pharmacistName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Pharmacist Name (optional)</FormLabel>
                  <FormControl><Input placeholder="Dr. John Doe" {...field} /></FormControl>
                </FormItem>
              )} />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input placeholder="+233 24 123 4567" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (optional)</FormLabel>
                    <FormControl><Input placeholder="pharmacy@example.com" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
              
              <FormField control={form.control} name="isActive" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <FormLabel className="text-base">Active</FormLabel>
                    <p className="text-sm text-gray-500">Is this pharmacy operational?</p>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              
              <div className="flex justify-end gap-2 pt-4">
                <SecondaryButton type="button" onClick={() => setIsModalOpen(false)}>Cancel</SecondaryButton>
                <Button type="submit" className="bg-[#166534] hover:bg-[#14532d] text-white" loading={isSubmitting}>
                  {editingPharmacy ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </Form>
          </DialogBody>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!deletePharmacy} onOpenChange={() => setDeletePharmacy(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pharmacy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletePharmacy?.name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Pharmacies;
