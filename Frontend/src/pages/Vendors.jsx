import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Eye, Upload as UploadIcon, Loader2, Filter, RefreshCw, Building2, CheckCircle, XCircle, Users } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { useResponsive } from '../hooks/useResponsive';
import vendorService from '../services/vendorService';
import vendorPriceListService from '../services/vendorPriceListService';
import { useAuth } from '../context/AuthContext';
import { useSmartSearch } from '../context/SmartSearchContext';
import ActionColumn from '../components/ActionColumn';
import DetailsDrawer from '../components/DetailsDrawer';
import DrawerSectionCard from '../components/DrawerSectionCard';
import PhoneNumberInput from '../components/PhoneNumberInput';
import DashboardTable from '../components/DashboardTable';
import DashboardStatsCard from '../components/DashboardStatsCard';
import WelcomeSection from '../components/WelcomeSection';
import TableSkeleton from '../components/TableSkeleton';
import FileUpload from '../components/FileUpload';
import FilePreview from '../components/FilePreview';
import { showSuccess, showError } from '../utils/toast';
import { API_BASE_URL } from '../services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import MobileFormDialog from '../components/MobileFormDialog';
import FormFieldGrid from '../components/FormFieldGrid';
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
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Descriptions, DescriptionItem } from '@/components/ui/descriptions';
import { SEARCH_PLACEHOLDERS, DEBOUNCE_DELAYS } from '../constants';

const vendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  company: z.string().optional(),
  email: z.string().email('Please enter a valid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  category: z.string().min(1, 'Category is required'),
  address: z.string().optional(),
});

const priceListItemSchema = z.object({
  itemType: z.enum(['service', 'product']),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be at least 0'),
  unit: z.string().optional(),
  imageUrl: z.string().optional().nullable(),
});

// Helper function to resolve file URLs (handles base64, relative paths, and absolute URLs)
const resolveFileUrl = (url) => {
  if (!url) return '';
  // Base64 data URLs (data:image/png;base64,...)
  if (url.startsWith('data:')) return url;
  // Absolute URLs (http:// or https://)
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Relative paths - prepend API base URL
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  // Return as-is for other cases
  return url;
};

const Vendors = () => {
  const { isManager, activeTenantId } = useAuth();
  const { searchValue, setPageSearchConfig } = useSmartSearch();
  const debouncedSearch = useDebounce(searchValue, DEBOUNCE_DELAYS.SEARCH);
  const { isMobile } = useResponsive();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({
    category: 'all',
    isActive: 'all'
  });
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingVendor, setViewingVendor] = useState(null);
  const [priceList, setPriceList] = useState([]);
  const [loadingPriceList, setLoadingPriceList] = useState(false);
  const [priceListModalVisible, setPriceListModalVisible] = useState(false);
  const [editingPriceItem, setEditingPriceItem] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [refreshingVendors, setRefreshingVendors] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [deletePriceItemId, setDeletePriceItemId] = useState(null);
  const [deletePriceItemDialogOpen, setDeletePriceItemDialogOpen] = useState(false);
  const [deletingPriceItem, setDeletingPriceItem] = useState(false);

  const form = useForm({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      name: '',
      company: '',
      email: '',
      phone: '',
      website: '',
      category: '',
      address: '',
    },
  });

  const priceListForm = useForm({
    resolver: zodResolver(priceListItemSchema),
    defaultValues: {
      itemType: 'service',
      name: '',
      description: '',
      price: 0,
      unit: 'unit',
      imageUrl: null,
    },
  });

  useEffect(() => {
    setPageSearchConfig({ scope: 'vendors', placeholder: SEARCH_PLACEHOLDERS.VENDORS });
    return () => setPageSearchConfig(null);
  }, [setPageSearchConfig]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, [searchValue]);

  // Clear vendor list when tenant changes so we don't show another tenant's data
  useEffect(() => {
    setVendors([]);
  }, [activeTenantId]);

  useEffect(() => {
    if (!activeTenantId) return;
    fetchVendors();
  }, [activeTenantId, pagination.current, pagination.pageSize, filters, debouncedSearch]);

  const fetchVendors = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshingVendors(true);
    } else {
      setLoading(true);
    }
    try {
      const params = {
        page: pagination.current,
        limit: 1000, // Fetch more for client-side filtering
      };

      if (filters.category !== 'all') {
        params.category = filters.category;
      }

      if (filters.isActive !== 'all') {
        params.isActive = filters.isActive === 'true';
      }

      if (debouncedSearch) params.search = debouncedSearch;

      const response = await vendorService.getAll(params);
      
      // Handle response structure (API interceptor returns response.data)
      let allVendors = [];
      if (response?.success !== false && response?.data) {
        allVendors = Array.isArray(response.data) ? response.data : [];
      } else {
        allVendors = Array.isArray(response) ? response : [];
      }
      
      setVendors(allVendors);
    } catch (error) {
      showError(error, 'Failed to load vendors');
      setVendors([]);
    } finally {
      if (isRefresh) {
        setRefreshingVendors(false);
      } else {
        setLoading(false);
      }
    }
  };

  // Apply client-side filtering
  const filteredVendors = useMemo(() => {
    let filtered = vendors;
    
    // Filter by category
    if (filters.category !== 'all') {
      filtered = filtered.filter(v => v.category === filters.category);
    }
    
    // Filter by active status
    if (filters.isActive !== 'all') {
      const isActive = filters.isActive === 'true';
      filtered = filtered.filter(v => v.isActive === isActive);
    }
    
    return filtered;
  }, [vendors, filters]);

  // Paginate filtered vendors
  const paginatedVendors = useMemo(() => {
    const start = (pagination.current - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return filteredVendors.slice(start, end);
  }, [filteredVendors, pagination.current, pagination.pageSize]);

  const vendorsCount = filteredVendors.length;

  const onSubmit = async (values) => {
    try {
      let response;
      if (editingVendor) {
        response = await vendorService.update(editingVendor.id, values);
      } else {
        response = await vendorService.create(values);
      }
      
      // Check if response indicates success
      if (response && (response.success === true || response.data)) {
        showSuccess(editingVendor ? 'Vendor updated successfully' : 'Vendor created successfully');
        setModalVisible(false);
        form.reset();
        fetchVendors();
      } else if (response && response.success === false) {
        // Explicit failure response
        const errorMessage = response.error || response.message || 'Operation failed';
        showError(errorMessage);
      } else {
        // Unexpected response structure
        console.warn('Unexpected response structure:', response);
        showSuccess(editingVendor ? 'Vendor updated successfully' : 'Vendor created successfully');
        setModalVisible(false);
        form.reset();
        fetchVendors();
      }
    } catch (error) {
      // Only show error if it's a real error (not a false positive from interceptor)
      console.error('Vendor operation error:', error);
      const errorMessage = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Operation failed';
      showError(errorMessage);
    }
  };

  const handleDelete = async (id) => {
    try {
      await vendorService.delete(id);
      showSuccess('Vendor deleted successfully');
      fetchVendors();
    } catch (error) {
      showError(error, 'Failed to delete vendor');
    }
  };

  const handleView = async (vendor) => {
    setViewingVendor(vendor);
    setDrawerVisible(true);
    
    setLoadingPriceList(true);
    try {
      const response = await vendorPriceListService.getAll(vendor.id);
      setPriceList(response.data || []);
    } catch (error) {
      console.error('Failed to load vendor price list:', error);
      setPriceList([]);
    } finally {
      setLoadingPriceList(false);
    }
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setViewingVendor(null);
    setPriceList([]);
  };

  const printingItems = [
    'Black & White Printing',
    'Color Printing',
    'Large Format Printing',
    'Photocopying',
    'Digital Printing',
    'Offset Printing',
    'Screen Printing',
    '3D Printing',
    'DTF',
    'Business Cards',
    'Brochures',
    'Flyers',
    'Posters',
    'Banners',
    'Booklets',
    'Letterhead',
    'Envelopes',
    'Invitations',
    'Calendars',
    'Labels',
    'Stickers',
    'Signage',
    'Vehicle Wraps',
    'Window Graphics',
    'Floor Graphics',
    'One Way Vision Sticker',
    'Binding',
    'Lamination',
    'Scanning',
    'Cutting',
    'Folding',
    'Stapling',
    'Perforation',
    'Die Cutting',
    'Embossing',
    'Foil Stamping',
    'UV Coating',
    'Varnishing',
    'Design Services',
    'Pre-Press Services',
    'Color Correction',
    'Image Editing',
    'Layout Design',
    'Proofing',
  ];

  const isPrintingVendor = viewingVendor && (
    viewingVendor.category === 'Printing Services' ||
    viewingVendor.category === 'Printing Equipment' ||
    viewingVendor.category === 'Pre-Press Services' ||
    viewingVendor.category === 'Binding & Finishing' ||
    viewingVendor.category === 'Design Services'
  );

  const handleAddPriceItem = () => {
    setEditingPriceItem(null);
    priceListForm.reset({
      itemType: 'service',
      name: '',
      description: '',
      price: 0,
      unit: 'unit',
      imageUrl: null,
    });
    setImagePreview(null);
    setPriceListModalVisible(true);
  };

  const handleEditPriceItem = (item) => {
    setEditingPriceItem(item);
    priceListForm.reset({
      ...item,
      imageUrl: item.imageUrl || null,
    });
    setImagePreview(item.imageUrl || null);
    setPriceListModalVisible(true);
  };

  const handleImageUpload = async (file) => {
    try {
      setUploadingImage(true);
      
      if (editingPriceItem && editingPriceItem.id) {
        const response = await vendorPriceListService.uploadImage(
          viewingVendor.id,
          editingPriceItem.id,
          file
        );
        
        if (response.data?.imageUrl) {
          setImagePreview(response.data.imageUrl);
          priceListForm.setValue('imageUrl', response.data.imageUrl);
          showSuccess('Image uploaded successfully');
        } else {
          throw new Error('Upload failed - no image URL in response');
        }
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreview(e.target.result);
          priceListForm.setValue('imageUrl', e.target.result);
        };
        reader.onerror = (error) => {
          showError(error, 'Failed to read image file');
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      showError(error, error?.response?.data?.message || error?.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageRemove = () => {
    setImagePreview(null);
    priceListForm.setValue('imageUrl', null);
  };

  const handleDeletePriceItem = async () => {
    if (!deletePriceItemId) return;
    try {
      setDeletingPriceItem(true);
      await vendorPriceListService.delete(viewingVendor.id, deletePriceItemId);
      showSuccess('Price item deleted successfully');
      const response = await vendorPriceListService.getAll(viewingVendor.id);
      setPriceList(response.data || []);
      setDeletePriceItemDialogOpen(false);
      setDeletePriceItemId(null);
    } catch (error) {
      showError(error, 'Failed to delete price item');
    } finally {
      setDeletingPriceItem(false);
    }
  };

  const onPriceListSubmit = async (values) => {
    try {
      if (editingPriceItem) {
        await vendorPriceListService.update(viewingVendor.id, editingPriceItem.id, values);
        showSuccess('Price item updated successfully');
      } else {
        await vendorPriceListService.create(viewingVendor.id, values);
        showSuccess('Price item added successfully');
      }
      setPriceListModalVisible(false);
      setImagePreview(null);
      const response = await vendorPriceListService.getAll(viewingVendor.id);
      setPriceList(response.data || []);
    } catch (error) {
      showError(error, error.error || 'Operation failed');
    }
  };

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const totalVendors = vendors.length;
    const activeVendors = vendors.filter(v => v.isActive).length;
    const inactiveVendors = vendors.filter(v => !v.isActive).length;
    const uniqueCategories = new Set(vendors.map(v => v.category).filter(Boolean)).size;
    
    return {
      totals: {
        totalVendors,
        activeVendors,
        inactiveVendors,
        uniqueCategories
      }
    };
  }, [vendors]);

  // Table columns for DashboardTable
  const tableColumns = useMemo(() => [
    {
      key: 'name',
      label: 'Name',
      render: (_, record) => <span className="font-medium text-black">{record?.name || '—'}</span>
    },
    {
      key: 'company',
      label: 'Company',
      render: (_, record) => <span className="text-black">{record?.company || '—'}</span>
    },
    {
      key: 'email',
      label: 'Email',
      render: (_, record) => <span className="text-black">{record?.email || '—'}</span>
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (_, record) => <span className="text-black">{record?.phone || '—'}</span>
    },
    {
      key: 'category',
      label: 'Category',
      render: (_, record) => record?.category ? <Badge variant="outline">{record.category}</Badge> : <span>—</span>
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, record) => (
        <Badge variant={record?.isActive ? 'default' : 'destructive'}>
          {record?.isActive ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, record) => <ActionColumn onView={handleView} record={record} />
    }
  ], [handleView]);

  const handleClearFilters = () => {
    setFilters({
      category: 'all',
      isActive: 'all'
    });
    setPagination({ ...pagination, current: 1 });
  };

  const hasActiveFilters = filters.category !== 'all' || filters.isActive !== 'all';

  // Get unique categories for filter
  const uniqueCategories = useMemo(() => {
    const categories = new Set(vendors.map(v => v.category).filter(Boolean));
    return Array.from(categories).sort();
  }, [vendors]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <WelcomeSection
          welcomeMessage="Vendors"
          subText="Manage your vendor relationships and price lists."
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setFilterDrawerOpen(true)} size={isMobile ? "icon" : "default"}>
            <Filter className="h-4 w-4" />
            {!isMobile && <span className="ml-2">Filter</span>}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => fetchVendors(true)}
            disabled={refreshingVendors}
            size={isMobile ? "icon" : "default"}
          >
            {refreshingVendors ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {!isMobile && <span className="ml-2">Refresh</span>}
          </Button>
          {isManager && (
            <Button
              onClick={() => {
                setEditingVendor(null);
                form.reset();
                setModalVisible(true);
              }}
              size={isMobile ? "icon" : "default"}
            >
              <Plus className="h-4 w-4" />
              {!isMobile && <span className="ml-2">New Vendor</span>}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
        {/* Total Vendors Card */}
        <DashboardStatsCard
          title="Total Vendors"
          value={summaryStats?.totals?.totalVendors || 0}
          icon={Building2}
          iconBgColor="rgba(22, 101, 52, 0.1)"
          iconColor="#166534"
        />

        {/* Active Vendors Card */}
        <DashboardStatsCard
          title="Active"
          value={summaryStats?.totals?.activeVendors || 0}
          icon={CheckCircle}
          iconBgColor="rgba(132, 204, 22, 0.1)"
          iconColor="#84cc16"
        />

        {/* Inactive Vendors Card */}
        <DashboardStatsCard
          title="Inactive"
          value={summaryStats?.totals?.inactiveVendors || 0}
          icon={XCircle}
          iconBgColor="rgba(239, 68, 68, 0.1)"
          iconColor="#ef4444"
        />

        {/* Categories Card */}
        <DashboardStatsCard
          title="Categories"
          value={summaryStats?.totals?.uniqueCategories || 0}
          icon={Users}
          iconBgColor="rgba(59, 130, 246, 0.1)"
          iconColor="#166534"
        />
      </div>

      {/* Main Content Area */}
      <DashboardTable
        data={paginatedVendors}
        columns={tableColumns}
        loading={loading}
        title={null}
        emptyIcon={<Building2 className="h-12 w-12 text-muted-foreground" />}
        emptyDescription="No vendors found"
        pageSize={pagination.pageSize}
        onPageChange={(newPagination) => {
          setPagination(newPagination);
        }}
        externalPagination={{
          current: pagination.current,
          total: vendorsCount
        }}
      />

      {/* Filter Drawer */}
      <Sheet open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
        <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto" style={{ top: 8, bottom: 8, right: 8, height: 'calc(100vh - 16px)', borderRadius: 8 }}>
          <SheetHeader className="pb-4 border-b">
            <SheetTitle>Filter Vendors</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 md:space-y-6 mt-4 md:mt-6">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={filters.category}
                onValueChange={(value) => setFilters({ ...filters, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <Button variant="outline" onClick={handleClearFilters} className="w-full">
                Clear Filters
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <MobileFormDialog
        open={modalVisible}
        onOpenChange={setModalVisible}
        title={editingVendor ? 'Edit Vendor' : 'Add Vendor'}
        description={editingVendor ? 'Update vendor information' : 'Add a new vendor to your system'}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalVisible(false)}
            >
              Cancel
            </Button>
            <Button type="submit" form="vendor-form" loading={form.formState.isSubmitting}>
              {editingVendor ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <Form {...form}>
          <form id="vendor-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormFieldGrid columns={2}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter vendor name" />
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
                    <FormLabel>Company (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter company name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormFieldGrid>

            <FormFieldGrid columns={2}>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="vendor@example.com" />
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
                      <PhoneNumberInput {...field} placeholder="Enter phone number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormFieldGrid>

            <FormFieldGrid columns={2}>
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://www.example.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Paper Supplier">Paper Supplier</SelectItem>
                          <SelectItem value="Ink Supplier">Ink Supplier</SelectItem>
                          <SelectItem value="Equipment Supplier">Equipment Supplier</SelectItem>
                          <SelectItem value="Printing Equipment">Printing Equipment</SelectItem>
                          <SelectItem value="Printing Services">Printing Services</SelectItem>
                          <SelectItem value="Binding & Finishing">Binding & Finishing</SelectItem>
                          <SelectItem value="Design Services">Design Services</SelectItem>
                          <SelectItem value="Pre-Press Services">Pre-Press Services</SelectItem>
                          <SelectItem value="Packaging Materials">Packaging Materials</SelectItem>
                          <SelectItem value="Specialty Papers">Specialty Papers</SelectItem>
                          <SelectItem value="Maintenance & Repair">Maintenance & Repair</SelectItem>
                          <SelectItem value="Shipping & Logistics">Shipping & Logistics</SelectItem>
                          <SelectItem value="Software & Technology">Software & Technology</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                    )}
                  />
            </FormFieldGrid>

            <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} placeholder="Enter address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
          </form>
        </Form>
      </MobileFormDialog>

      <DetailsDrawer
        open={drawerVisible}
        onClose={handleCloseDrawer}
        title="Vendor Details"
        width={720}
        onEdit={isManager && viewingVendor ? () => {
          setEditingVendor(viewingVendor);
          form.reset(viewingVendor);
          setModalVisible(true);
          setDrawerVisible(false);
        } : null}
        onDelete={isManager && viewingVendor ? () => {
          handleDelete(viewingVendor.id);
          setDrawerVisible(false);
        } : null}
        deleteConfirmText="Are you sure you want to delete this vendor?"
        tabs={viewingVendor ? [
          {
            key: 'details',
            label: 'Details',
            content: (
              <div className="space-y-6">
                <DrawerSectionCard title="Contact details">
                  <Descriptions column={1} className="space-y-0">
                    <DescriptionItem label="Name">{viewingVendor.name || '—'}</DescriptionItem>
                    <DescriptionItem label="Company">{viewingVendor.company || '—'}</DescriptionItem>
                    <DescriptionItem label="Email">
                      {viewingVendor.email ? (
                        <a href={`mailto:${viewingVendor.email}`} className="text-primary hover:underline">
                          {viewingVendor.email}
                        </a>
                      ) : '—'}
                    </DescriptionItem>
                    <DescriptionItem label="Phone">
                      {viewingVendor.phone ? (
                        <a href={`tel:${viewingVendor.phone}`} className="text-primary hover:underline">
                          {viewingVendor.phone}
                        </a>
                      ) : '—'}
                    </DescriptionItem>
                    <DescriptionItem label="Website">
                      {viewingVendor.website ? (
                        <a href={viewingVendor.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {viewingVendor.website}
                        </a>
                      ) : '—'}
                    </DescriptionItem>
                    <DescriptionItem label="Category">
                      {viewingVendor.category ? (
                        <Badge variant="outline">{viewingVendor.category}</Badge>
                      ) : '—'}
                    </DescriptionItem>
                  </Descriptions>
                </DrawerSectionCard>
                <DrawerSectionCard title="Address & status">
                  <Descriptions column={1} className="space-y-0">
                    <DescriptionItem label="Address">{viewingVendor.address || '—'}</DescriptionItem>
                    <DescriptionItem label="Status">
                      <Badge variant={viewingVendor.isActive ? 'default' : 'destructive'}>
                        {viewingVendor.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </DescriptionItem>
                    <DescriptionItem label="Created At">
                      {viewingVendor.createdAt ? new Date(viewingVendor.createdAt).toLocaleString() : '—'}
                    </DescriptionItem>
                    <DescriptionItem label="Last Updated">
                      {viewingVendor.updatedAt ? new Date(viewingVendor.updatedAt).toLocaleString() : '—'}
                    </DescriptionItem>
                  </Descriptions>
                </DrawerSectionCard>
              </div>
            )
          },
          {
            key: 'pricelist',
            label: 'Price Lists',
            content: (
              <DrawerSectionCard title="Services & products">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">({priceList.length} items)</span>
                    {isManager && (
                      <Button onClick={handleAddPriceItem}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Item
                      </Button>
                    )}
                  </div>
                  {loadingPriceList ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : priceList.length > 0 ? (
                    <div className="space-y-3">
                      {priceList.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-4 p-4 border border-border/50 rounded-md bg-background"
                        >
                          {item.imageUrl ? (
                            <img
                              src={resolveFileUrl(item.imageUrl)}
                              alt={item.name}
                              loading="lazy"
                              className="w-16 h-16 object-cover rounded-lg cursor-pointer"
                              onClick={() => window.open(resolveFileUrl(item.imageUrl), '_blank')}
                            />
                          ) : (
                            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center text-xs text-muted-foreground text-center">
                              No Image
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold">{item.name}</span>
                              <Badge variant={item.itemType === 'service' ? 'default' : 'secondary'}>
                                {item.itemType}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {item.description || 'No description'}
                            </p>
                            <div className="flex items-center gap-4">
                              <span className="text-lg font-bold text-primary">
                                GHS {parseFloat(item.price || 0).toFixed(2)}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                per {item.unit || 'unit'}
                              </span>
                            </div>
                          </div>
                          {isManager && (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditPriceItem(item)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setDeletePriceItemId(item.id);
                                  setDeletePriceItemDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center p-8 text-muted-foreground">
                      No price list items found
                    </div>
                  )}
                </div>
              </DrawerSectionCard>
            )
          }
        ] : null}
      />

      <Dialog open={priceListModalVisible} onOpenChange={setPriceListModalVisible}>
        <DialogContent className="sm:w-[var(--modal-w-lg)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)]">
          <DialogHeader>
            <DialogTitle>{editingPriceItem ? 'Edit Price Item' : 'Add Price Item'}</DialogTitle>
            <DialogDescription>
              {editingPriceItem ? 'Update price item details' : 'Add a new service or product to the price list'}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
          <Form {...priceListForm}>
            <form onSubmit={priceListForm.handleSubmit(onPriceListSubmit)} className="space-y-4">
              <FormField
                control={priceListForm.control}
                name="itemType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="service">Service</SelectItem>
                        <SelectItem value="product">Product</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={priceListForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    {isPrintingVendor ? (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select printing item" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {printingItems.map(item => (
                            <SelectItem key={item} value={item}>{item}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <FormControl>
                        <Input {...field} placeholder="Enter item name" />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={priceListForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} placeholder="Enter description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={priceListForm.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">GHS</span>
                        <Input
                          type="number"
                          placeholder="0.00"
                          min={0}
                          step={0.01}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            field.onChange(value);
                          }}
                          className="pl-12"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={priceListForm.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., unit, hour, piece" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label>Image (Optional)</Label>
                <FileUpload
                  onFileSelect={handleImageUpload}
                  disabled={false}
                  uploading={uploadingImage}
                  accept="image/*"
                  maxSizeMB={10}
                  uploadedFiles={imagePreview ? [{
                    id: 'price-item-image',
                    fileUrl: imagePreview,
                    originalName: 'Price Item Image',
                    name: 'Price Item Image',
                    url: resolveFileUrl(imagePreview)
                  }] : []}
                  onFilePreview={() => setImagePreviewVisible(true)}
                  onFileRemove={handleImageRemove}
                  showFileList={true}
                  emptyMessage="No image uploaded yet."
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPriceListModalVisible(false);
                    setImagePreview(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={priceListForm.formState.isSubmitting}>
                  {priceListForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingPriceItem ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletePriceItemDialogOpen} onOpenChange={setDeletePriceItemDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Price Item?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the price item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeletePriceItem} 
              className="bg-destructive text-destructive-foreground"
              loading={deletingPriceItem}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FilePreview
        open={imagePreviewVisible}
        onClose={() => setImagePreviewVisible(false)}
        file={imagePreview ? {
          fileUrl: imagePreview,
          title: 'Price Item Image',
          metadata: {}
        } : null}
      />
    </div>
  );
};

export default Vendors;
