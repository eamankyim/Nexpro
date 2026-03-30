import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Pill, Plus, Search, MoreHorizontal, Edit, Trash2, AlertTriangle, 
  RefreshCw, Package, Currency, Calendar 
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { useResponsive } from '../hooks/useResponsive';
import { PRODUCT_UNITS } from '../constants';
import { numberInputValue, handleNumberChange, numberOrEmptySchema } from '../utils/formUtils';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { SecondaryButton } from '@/components/ui/secondary-button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import DashboardTable from '../components/DashboardTable';
import DashboardStatsCard from '../components/DashboardStatsCard';
import TableSkeleton from '../components/TableSkeleton';
import { showSuccess, showError } from '../utils/toast';
import api from '../services/api';
import { CHIP_RED, CHIP_ORANGE, CHIP_GREEN } from '../constants';

const DRUG_TYPES = [
  { value: 'otc', label: 'Over-the-Counter' },
  { value: 'prescription', label: 'Prescription Only' },
  { value: 'controlled', label: 'Controlled Substance' },
  { value: 'herbal', label: 'Herbal Medicine' },
  { value: 'supplement', label: 'Supplement' },
];

const DRUG_FORMS = [
  'Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Ointment', 
  'Drops', 'Inhaler', 'Patch', 'Powder', 'Suspension', 'Other'
];

// Validation schema
const drugSchema = z.object({
  name: z.string().min(1, 'Drug name is required'),
  genericName: z.string().optional(),
  brandName: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  description: z.string().optional(),
  drugType: z.string().default('otc'),
  costPrice: numberOrEmptySchema(z),
  sellingPrice: numberOrEmptySchema(z),
  quantityOnHand: numberOrEmptySchema(z),
  reorderLevel: numberOrEmptySchema(z),
  unit: z.string().default('pcs'),
  strength: z.string().optional(),
  form: z.string().optional(),
  manufacturer: z.string().optional(),
  expiryDate: z.string().optional(),
  batchNumber: z.string().optional(),
  isActive: z.boolean().default(true),
});

const Drugs = () => {
  const { activeTenant } = useAuth();
  const { isMobile } = useResponsive();
  
  // State
  const [drugs, setDrugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDrug, setEditingDrug] = useState(null);
  const [deleteDrug, setDeleteDrug] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const debouncedSearch = useDebounce(searchText, 500);
  
  // Form
  const form = useForm({
    resolver: zodResolver(drugSchema),
    defaultValues: {
      name: '',
      genericName: '',
      brandName: '',
      sku: '',
      barcode: '',
      description: '',
      drugType: 'otc',
      costPrice: 0,
      sellingPrice: 0,
      quantityOnHand: 0,
      reorderLevel: 10,
      unit: 'pcs',
      strength: '',
      form: '',
      manufacturer: '',
      expiryDate: '',
      batchNumber: '',
      isActive: true,
    },
  });
  
  // Fetch drugs
  const fetchDrugs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/drugs', {
        params: {
          page: pagination.page,
          limit: pagination.pageSize,
          search: debouncedSearch,
          drugType: typeFilter === 'all' ? undefined : typeFilter,
        },
      });
      
      if (response.data.success) {
        setDrugs(response.data.data);
        setPagination(prev => ({
          ...prev,
          total: response.data.count,
        }));
      }
    } catch (error) {
      console.error('Error fetching drugs:', error);
      showError('Failed to fetch drugs');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, debouncedSearch, typeFilter]);
  
  useEffect(() => {
    fetchDrugs();
  }, [fetchDrugs]);
  
  // Stats
  const stats = useMemo(() => {
    const total = drugs.length;
    const lowStock = drugs.filter(d => 
      parseFloat(d.quantityOnHand) <= parseFloat(d.reorderLevel) && parseFloat(d.quantityOnHand) > 0
    ).length;
    const outOfStock = drugs.filter(d => parseFloat(d.quantityOnHand) <= 0).length;
    
    // Check for expiring drugs (within 30 days)
    const today = new Date();
    const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringSoon = drugs.filter(d => {
      if (!d.expiryDate) return false;
      const expiry = new Date(d.expiryDate);
      return expiry <= thirtyDaysLater && expiry > today;
    }).length;
    
    return { total, lowStock, outOfStock, expiringSoon };
  }, [drugs]);
  
  // Table columns
  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Drug',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <Pill className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
          </div>
          <div>
            <div className="font-medium">{row.original.name}</div>
            {row.original.genericName && (
              <div className="text-xs text-gray-500">{row.original.genericName}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'drugType',
      header: 'Type',
      cell: ({ row }) => {
        const type = DRUG_TYPES.find(t => t.value === row.original.drugType);
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
            row.original.drugType === 'prescription' ? CHIP_RED :
            row.original.drugType === 'controlled' ? CHIP_ORANGE : CHIP_GREEN
          }`}>
            {type?.label || row.original.drugType}
          </span>
        );
      },
    },
    {
      accessorKey: 'strength',
      header: 'Strength/Form',
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original.strength || '-'}
          {row.original.form && (
            <div className="text-xs text-gray-500">{row.original.form}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'quantityOnHand',
      header: 'Stock',
      cell: ({ row }) => {
        const qty = parseFloat(row.original.quantityOnHand) || 0;
        const reorder = parseFloat(row.original.reorderLevel) || 0;
        const isLow = qty <= reorder && qty > 0;
        const isOut = qty <= 0;
        
        return (
          <div className={`font-medium ${isOut ? 'text-red-600' : isLow ? 'text-orange-600' : 'text-foreground'}`}>
            {qty} {row.original.unit}
            {(isLow || isOut) && <AlertTriangle className="h-3 w-3 inline ml-1" />}
          </div>
        );
      },
    },
    {
      accessorKey: 'sellingPrice',
      header: 'Price',
      cell: ({ row }) => (
        <span className="font-medium">
          ₵ {parseFloat(row.original.sellingPrice || 0).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: 'expiryDate',
      header: 'Expiry',
      cell: ({ row }) => {
        if (!row.original.expiryDate) return <span className="text-gray-400">-</span>;
        
        const expiry = new Date(row.original.expiryDate);
        const today = new Date();
        const isExpired = expiry < today;
        const isExpiringSoon = expiry <= new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
        
        return (
          <span className={`${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-orange-600' : 'text-gray-600'}`}>
            {expiry.toLocaleDateString()}
            {isExpired && <span className="ml-1 text-xs">(Expired)</span>}
          </span>
        );
      },
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
              onClick={() => setDeleteDrug(row.original)}
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
    setEditingDrug(null);
    form.reset({
      name: '',
      genericName: '',
      brandName: '',
      sku: '',
      barcode: '',
      description: '',
      drugType: 'otc',
      costPrice: 0,
      sellingPrice: 0,
      quantityOnHand: 0,
      reorderLevel: 10,
      unit: 'pcs',
      strength: '',
      form: '',
      manufacturer: '',
      expiryDate: '',
      batchNumber: '',
      isActive: true,
    });
    setIsModalOpen(true);
  };
  
  const handleEdit = (drug) => {
    setEditingDrug(drug);
    form.reset({
      name: drug.name || '',
      genericName: drug.genericName || '',
      brandName: drug.brandName || '',
      sku: drug.sku || '',
      barcode: drug.barcode || '',
      description: drug.description || '',
      drugType: drug.drugType || 'otc',
      costPrice: parseFloat(drug.costPrice) || 0,
      sellingPrice: parseFloat(drug.sellingPrice) || 0,
      quantityOnHand: parseFloat(drug.quantityOnHand) || 0,
      reorderLevel: parseFloat(drug.reorderLevel) || 10,
      unit: drug.unit || 'pcs',
      strength: drug.strength || '',
      form: drug.form || '',
      manufacturer: drug.manufacturer || '',
      expiryDate: drug.expiryDate ? drug.expiryDate.split('T')[0] : '',
      batchNumber: drug.batchNumber || '',
      isActive: drug.isActive ?? true,
    });
    setIsModalOpen(true);
  };
  
  const onSubmit = async (data) => {
    try {
      setIsSubmitting(true);
      
      if (editingDrug) {
        await api.put(`/drugs/${editingDrug.id}`, data);
        showSuccess('Drug updated successfully');
      } else {
        await api.post('/drugs', data);
        showSuccess('Drug created successfully');
      }
      
      setIsModalOpen(false);
      fetchDrugs();
    } catch (error) {
      console.error('Error saving drug:', error);
      showError(error.response?.data?.message || 'Failed to save drug');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDelete = async () => {
    if (!deleteDrug) return;
    
    try {
      await api.delete(`/drugs/${deleteDrug.id}`);
      showSuccess('Drug deleted successfully');
      setDeleteDrug(null);
      fetchDrugs();
    } catch (error) {
      console.error('Error deleting drug:', error);
      showError(error.response?.data?.message || 'Failed to delete drug');
    }
  };
  
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Drugs</h1>
          <p className="text-gray-600 mt-1">Manage your drug catalog with expiry tracking</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={handleCreate} className="bg-brand hover:bg-brand-dark text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Drug
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add a new drug to catalog</TooltipContent>
        </Tooltip>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DashboardStatsCard
          tooltip="Total drugs in catalog"
          title="Total Drugs"
          value={stats.total}
          subtitle={`${stats.total} in catalog`}
          icon={Pill}
        />
        <DashboardStatsCard
          tooltip="Drugs below minimum stock"
          title="Low Stock"
          value={stats.lowStock}
          subtitle={`${stats.lowStock} items`}
          icon={Package}
        />
        <DashboardStatsCard
          tooltip="Drugs with zero stock"
          title="Out of Stock"
          value={stats.outOfStock}
          subtitle={`${stats.outOfStock} items`}
          icon={AlertTriangle}
        />
        <DashboardStatsCard
          tooltip="Drugs expiring within 30 days"
          title="Expiring Soon"
          value={stats.expiringSoon}
          subtitle="Within 30 days"
          icon={Calendar}
        />
      </div>
      
      {/* Filters */}
      <Card className="border border-gray-200">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search drugs..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {DRUG_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <SecondaryButton onClick={fetchDrugs} size={isMobile ? 'icon' : 'default'}>
                  <RefreshCw className="h-4 w-4" />
                </SecondaryButton>
              </TooltipTrigger>
              <TooltipContent>Refresh drugs list</TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>
      
      {/* Data Table */}
      <Card className="border border-gray-200">
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton columns={7} rows={5} />
          ) : (
            <DashboardTable
              columns={columns}
              data={drugs}
              pagination={{
                page: pagination.page,
                pageSize: pagination.pageSize,
                total: pagination.total,
              }}
              onPageChange={(p) => setPagination(prev => ({ ...prev, page: p }))}
              onPageSizeChange={(s) => setPagination(prev => ({ ...prev, pageSize: s, page: 1 }))}
              emptyMessage="No drugs found"
            />
          )}
        </CardContent>
      </Card>
      
      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:w-[var(--modal-w-md)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)]">
          <DialogHeader>
            <DialogTitle>{editingDrug ? 'Edit Drug' : 'Add New Drug'}</DialogTitle>
            <DialogDescription>
              {editingDrug ? 'Update drug details' : 'Add a new drug to your catalog'}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
          <Form {...form}>
            <form id="drug-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Drug Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Paracetamol" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="genericName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Generic Name (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Acetaminophen" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="brandName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand Name (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Tylenol" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="drugType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Drug Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DRUG_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
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
                  name="form"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Form (optional)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select form" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DRUG_FORMS.map(f => (
                            <SelectItem key={f} value={f}>{f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="strength"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Strength (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="500mg" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRODUCT_UNITS.map((u) => (
                            <SelectItem key={u.value} value={u.value}>
                              {u.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="costPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost Price (₵)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          value={numberInputValue(field.value)}
                          onChange={(e) => handleNumberChange(e, field.onChange)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="sellingPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selling Price (₵)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          value={numberInputValue(field.value)}
                          onChange={(e) => handleNumberChange(e, field.onChange)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="quantityOnHand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={numberInputValue(field.value)}
                          onChange={(e) => handleNumberChange(e, field.onChange)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="reorderLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reorder Level</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={numberInputValue(field.value)}
                          onChange={(e) => handleNumberChange(e, field.onChange)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="expiryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiry Date (optional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="batchNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Batch Number (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="BATCH-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="manufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manufacturer (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Manufacturer name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <FormLabel className="text-base">Active</FormLabel>
                      <p className="text-sm text-gray-500">Is this drug available for sale?</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
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
            <Button 
              type="submit" 
              form="drug-form"
              className="bg-brand hover:bg-brand-dark text-white"
              loading={isSubmitting}
            >
              {editingDrug ? 'Update Drug' : 'Create Drug'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDrug} onOpenChange={() => setDeleteDrug(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Drug</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDrug?.name}"? This action cannot be undone.
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

export default Drugs;
