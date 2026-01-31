import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDebounce } from '../hooks/useDebounce';
import { useResponsive } from '../hooks/useResponsive';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Loader2, RefreshCw, Filter, Users, Repeat, XCircle, CheckCircle, Phone, Mail, Briefcase, Pencil } from 'lucide-react';
import customerService from '../services/customerService';
import jobService from '../services/jobService';
import invoiceService from '../services/invoiceService';
import customDropdownService from '../services/customDropdownService';
import { useAuth } from '../context/AuthContext';
import { useSmartSearch } from '../context/SmartSearchContext';
import ActionColumn from '../components/ActionColumn';
import DetailsDrawer from '../components/DetailsDrawer';
import DrawerSectionCard from '../components/DrawerSectionCard';
import PhoneNumberInput from '../components/PhoneNumberInput';
import StatusChip from '../components/StatusChip';
import TableSkeleton from '../components/TableSkeleton';
import DetailSkeleton from '../components/DetailSkeleton';
import DashboardTable from '../components/DashboardTable';
import DashboardStatsCard from '../components/DashboardStatsCard';
import WelcomeSection from '../components/WelcomeSection';
import FloatingActionButton from '../components/FloatingActionButton';
import { showSuccess, showError, showWarning, handleApiError } from '../utils/toast';
import dayjs from 'dayjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Descriptions, DescriptionItem } from '@/components/ui/descriptions';
import { Timeline, TimelineItem, TimelineIndicator, TimelineContent, TimelineTitle, TimelineDescription, TimelineTime } from '@/components/ui/timeline';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import MobileFormDialog from '../components/MobileFormDialog';
import FormFieldGrid from '../components/FormFieldGrid';
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
import { SEARCH_PLACEHOLDERS, DEBOUNCE_DELAYS } from '../constants';

const customerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  email: z.string().min(1, 'Email is required').email('Please enter a valid email'),
  company: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  howDidYouHear: z.string().optional().or(z.literal('')),
  referralName: z.string().optional(),
});

const Customers = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { searchValue, setPageSearchConfig } = useSmartSearch();
  const debouncedSearchText = useDebounce(searchValue, DEBOUNCE_DELAYS.SEARCH);
  const { isMobile } = useResponsive();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { isManager, user, activeTenant } = useAuth();
  const businessType = activeTenant?.businessType || 'printing_press';
  const isPrintingPress = businessType === 'printing_press';
  const [showReferralName, setShowReferralName] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingCustomerDetails, setLoadingCustomerDetails] = useState(false);
  const [customCustomerSources, setCustomCustomerSources] = useState([]);
  const [showCustomerSourceOtherInput, setShowCustomerSourceOtherInput] = useState(false);
  const [customerSourceOtherValue, setCustomerSourceOtherValue] = useState('');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [refreshingCustomers, setRefreshingCustomers] = useState(false);
  const [savingCustomerSource, setSavingCustomerSource] = useState(false);
  const [filters, setFilters] = useState({
    isActive: 'true',
    howDidYouHear: 'all',
    customerType: 'all', // 'all', 'new', 'returning'
  });

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
      howDidYouHear: '',
      referralName: '',
    },
  });

  const howDidYouHear = form.watch('howDidYouHear');

  useEffect(() => {
    setPageSearchConfig({ scope: 'customers', placeholder: SEARCH_PLACEHOLDERS.CUSTOMERS });
    return () => setPageSearchConfig(null);
  }, [setPageSearchConfig]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, [searchValue]);

  useEffect(() => {
    fetchCustomers();
  }, [pagination.current, pagination.pageSize, debouncedSearchText, filters]);

  useEffect(() => {
    const loadCustomOptions = async () => {
      try {
        const [sources, regions] = await Promise.all([
          customDropdownService.getCustomOptions('customer_source'),
          customDropdownService.getCustomOptions('region')
        ]);
        setCustomCustomerSources(sources || []);
      } catch (error) {
        console.error('Failed to load custom options:', error);
      }
    };
    loadCustomOptions();
  }, []);

  useEffect(() => {
    setShowReferralName(howDidYouHear === 'Referral');
    if (howDidYouHear !== 'Referral') {
      form.setValue('referralName', '');
    }
  }, [howDidYouHear, form]);

  useEffect(() => {
    if (searchParams.get('add') === '1') {
      setEditingCustomer(null);
      form.reset({
        name: '',
        company: '',
        email: '',
        phone: '',
        address: '',
        howDidYouHear: '',
        referralName: '',
      });
      setShowReferralName(false);
      setShowCustomerSourceOtherInput(false);
      setCustomerSourceOtherValue('');
      setModalVisible(true);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('add');
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams, form]);

  // Pull-to-refresh hook
  const { isRefreshing, pullDistance, containerProps } = usePullToRefresh(
    () => fetchCustomers(true),
    { enabled: isMobile }
  );

  const fetchCustomers = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshingCustomers(true);
    } else {
      setLoading(true);
    }
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        search: debouncedSearchText,
      };
      
      if (filters.isActive !== 'all') {
        params.isActive = filters.isActive === 'true';
      }
      
      if (filters.howDidYouHear !== 'all') {
        params.howDidYouHear = filters.howDidYouHear;
      }
      
      const response = await customerService.getAll(params);
      
      // Handle response structure (API interceptor returns response.data)
      let customersData = [];
      if (response?.success !== false && response?.data) {
        customersData = Array.isArray(response.data) ? response.data : [];
      } else {
        // If response structure is unexpected, try to extract data
        customersData = Array.isArray(response) ? response : [];
      }
      
      // Apply client-side filter for customer type (new vs returning)
      if (filters.customerType !== 'all') {
        customersData = customersData.filter(customer => {
          const balance = parseFloat(customer.balance || 0);
          if (filters.customerType === 'new') {
            return balance === 0;
          } else if (filters.customerType === 'returning') {
            return balance > 0;
          }
          return true;
        });
      }
      
      setCustomers(customersData);
      setPagination({ ...pagination, total: response?.count || customersData.length });
    } catch (error) {
      handleApiError(error, { context: 'load customers' });
      setCustomers([]);
    } finally {
      if (isRefresh) {
        setRefreshingCustomers(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleAdd = () => {
    setEditingCustomer(null);
    form.reset({
      name: '',
      company: '',
      email: '',
      phone: '',
      address: '',
      howDidYouHear: '',
      referralName: '',
    });
    setShowReferralName(false);
    setShowCustomerSourceOtherInput(false);
    setCustomerSourceOtherValue('');
    setModalVisible(true);
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    form.reset(customer);
    setShowReferralName(customer.howDidYouHear === 'Referral');
    setModalVisible(true);
  };

  const handleHowDidYouHearChange = (value) => {
    // Don't set form value here - it's already set by field.onChange
    if (value === '__OTHER__') {
      setShowCustomerSourceOtherInput(true);
      setShowReferralName(false);
      form.setValue('referralName', '');
    } else {
      setShowCustomerSourceOtherInput(false);
      setShowReferralName(value === 'Referral');
      if (value !== 'Referral') {
        form.setValue('referralName', '');
      }
    }
  };

  const handleSaveCustomCustomerSource = async () => {
    if (!customerSourceOtherValue || !customerSourceOtherValue.trim()) {
      showWarning('Please enter a source name');
      return;
    }

    try {
      setSavingCustomerSource(true);
      const saved = await customDropdownService.saveCustomOption('customer_source', customerSourceOtherValue.trim());
      if (saved && saved.value) {
        setCustomCustomerSources(prev => {
          if (prev.find(s => s.value === saved.value)) {
            return prev;
          }
          return [...prev, saved];
        });
        
        form.setValue('howDidYouHear', saved.value);
        setShowCustomerSourceOtherInput(false);
        setCustomerSourceOtherValue('');
        showSuccess(`"${saved.label || saved.value}" added to sources`);
      } else {
        showWarning('Saved option but received invalid response. Please try again.');
      }
    } catch (error) {
      handleApiError(error, { context: 'save custom source' });
    }
  };


  const handleView = async (customer) => {
    setViewingCustomer(customer);
    setDrawerVisible(true);
    setLoadingCustomerDetails(true);
    
    try {
      // Fetch full customer details with activities
      const customerResponse = await customerService.getById(customer.id);
      const fullCustomer = customerResponse?.data || customerResponse;
      if (fullCustomer) {
        setViewingCustomer(fullCustomer);
      }
    } catch (error) {
      console.error('Failed to load customer details:', error);
    } finally {
      setLoadingCustomerDetails(false);
    }

    setLoadingInvoices(true);
    try {
      const response = await invoiceService.getAll({
        customerId: customer.id,
        limit: 50
      });
      setCustomerInvoices(response.data || []);
    } catch (error) {
      console.error('Failed to load customer invoices:', error);
      setCustomerInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setViewingCustomer(null);
    setCustomerInvoices([]);
  };

  const handleCreateJob = () => {
    if (viewingCustomer) {
      setDrawerVisible(false);
      navigate(`/jobs?customerId=${viewingCustomer.id}`);
    }
  };

  const handleDelete = async (id) => {
    try {
      await customerService.delete(id);
      showSuccess('Customer deleted successfully');
      fetchCustomers();
      fetchSummaryStats();
    } catch (error) {
      handleApiError(error, { context: 'delete customer' });
    }
  };

  const onSubmit = async (values) => {
    try {
      if (values.howDidYouHear === '__OTHER__') {
        if (!customerSourceOtherValue || !customerSourceOtherValue.trim()) {
          showError('Please enter and save a custom source before submitting');
          return;
        }
        const saved = await customDropdownService.saveCustomOption('customer_source', customerSourceOtherValue.trim());
        if (saved) {
          values.howDidYouHear = saved.value;
          setCustomCustomerSources(prev => {
            if (prev.find(s => s.value === saved.value)) {
              return prev;
            }
            return [...prev, saved];
          });
        }
      }
      
      let response;
      if (editingCustomer) {
        response = await customerService.update(editingCustomer.id, values);
      } else {
        response = await customerService.create(values);
      }
      
      // Check if response indicates success
      if (response && (response.success === true || response.data)) {
        showSuccess(editingCustomer ? 'Customer updated successfully' : 'Customer created successfully');
        setModalVisible(false);
        form.reset();
        fetchCustomers();
        fetchSummaryStats();
      } else if (response && response.success === false) {
        // Explicit failure response
        const errorMessage = response.error || response.message || 'Operation failed';
        showError(errorMessage);
      } else {
        // Unexpected response structure
        console.warn('Unexpected response structure:', response);
        showSuccess(editingCustomer ? 'Customer updated successfully' : 'Customer created successfully');
        setModalVisible(false);
        form.reset();
        fetchCustomers();
        fetchSummaryStats();
      }
    } catch (error) {
      // Only show error if it's a real error (not a false positive from interceptor)
      console.error('Customer operation error:', error);
      handleApiError(error, { context: editingCustomer ? 'update customer' : 'create customer' });
    }
  };

  const tableColumns = useMemo(() => [
    {
      key: 'name',
      label: 'Name',
      render: (_, record) => <span className="font-medium">{record?.name || '—'}</span>
    },
    {
      key: 'company',
      label: 'Company',
      render: (_, record) => <span className="text-black">{record?.company || '—'}</span>
    },
    {
      key: 'email',
      label: 'Email',
      render: (_, record) => record?.email ? (
        <a href={`mailto:${record.email}`} className="text-black hover:underline flex items-center gap-1">
          <Mail className="h-4 w-4" />
          {record.email}
        </a>
      ) : <span className="text-black">—</span>
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (_, record) => record?.phone ? (
        <a href={`tel:${record.phone}`} className="text-black hover:underline flex items-center gap-1">
          <Phone className="h-4 w-4" />
          {record.phone}
        </a>
      ) : <span className="text-black">—</span>
    },
    {
      key: 'source',
      label: 'Source',
      render: (_, record) => record?.howDidYouHear ? (
        <Badge variant="outline">{record.howDidYouHear}</Badge>
      ) : <span className="text-black">—</span>
    },
    {
      key: 'balance',
      label: 'Balance',
      render: (_, record) => <span className="text-black">GHS {parseFloat(record?.balance || 0).toFixed(2)}</span>
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
  
  // Summary stats state - fetched from backend
  const [summaryStats, setSummaryStats] = useState({
    totalCustomers: 0,
    activeCustomers: 0,
    inactiveCustomers: 0,
    returningCustomers: 0,
  });

  // Fetch summary stats separately (all customers, not paginated)
  const fetchSummaryStats = useCallback(async () => {
    try {
      // Fetch all customers for accurate stats (with high limit)
      const response = await customerService.getCustomers({ limit: 10000 });
      const allCustomers = response?.data || response?.customers || [];
      
      const totalCustomers = allCustomers.length;
      const activeCustomers = allCustomers.filter(c => c.isActive).length;
      const inactiveCustomers = allCustomers.filter(c => !c.isActive).length;
      const returningCustomers = allCustomers.filter(c => c.isActive && parseFloat(c.balance || 0) > 0).length;
      
      setSummaryStats({
        totalCustomers,
        activeCustomers,
        inactiveCustomers,
        returningCustomers,
      });
    } catch (error) {
      console.error('Failed to fetch summary stats:', error);
    }
  }, []);

  // Fetch summary stats on mount
  useEffect(() => {
    fetchSummaryStats();
  }, [fetchSummaryStats]);
  
  // Calculate summary for display
  const summary = useMemo(() => {
    return {
      totals: summaryStats
    };
  }, [summaryStats]);

  const defaultSources = [
    { group: 'Social Media', items: ['Facebook', 'Instagram', 'Twitter', 'LinkedIn', 'TikTok', 'WhatsApp'] },
    { group: 'Online', items: ['Google Search', 'Website', 'Online Ad'] },
    { group: 'Physical', items: ['Signboard', 'Walk-in', 'Market Outreach', 'Flyer/Brochure'] },
    { group: 'Personal', items: ['Referral', 'Existing Customer'] },
    { group: 'Other', items: ['Radio', 'TV', 'Newspaper', 'Event/Trade Show'] },
  ];

  const handleClearFilters = () => {
    setFilters({
      isActive: 'true',
      howDidYouHear: 'all',
      customerType: 'all',
    });
    setPagination({ ...pagination, current: 1 });
  };

  const hasActiveFilters = filters.isActive !== 'true' || filters.howDidYouHear !== 'all' || filters.customerType !== 'all';

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <WelcomeSection
          welcomeMessage="Customers"
          subText="Manage your customer relationships and track interactions."
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setFilterDrawerOpen(true)} size={isMobile ? "icon" : "default"}>
            <Filter className="h-4 w-4" />
            {!isMobile && <span className="ml-2">Filter</span>}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => fetchCustomers(true)}
            disabled={refreshingCustomers}
            size={isMobile ? "icon" : "default"}
          >
            {refreshingCustomers ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {!isMobile && <span className="ml-2">Refresh</span>}
          </Button>
          {(isManager || user?.role === 'staff') && (
            <Button onClick={handleAdd} size={isMobile ? "icon" : "default"}>
              <Plus className="h-4 w-4" />
              {!isMobile && <span className="ml-2">New Customer</span>}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
        {/* Total Customers Card */}
        <DashboardStatsCard
          title="Total Customers"
          value={summary?.totals?.totalCustomers || 0}
          icon={Users}
          iconBgColor="rgba(22, 101, 52, 0.1)"
          iconColor="#166534"
        />

        {/* Active Customers Card */}
        <DashboardStatsCard
          title="Active"
          value={summary?.totals?.activeCustomers || 0}
          icon={CheckCircle}
          iconBgColor="rgba(59, 130, 246, 0.1)"
          iconColor="#166534"
        />

        {/* Returning Customers Card */}
        <DashboardStatsCard
          title="Returning Customers"
          value={summary?.totals?.returningCustomers || 0}
          icon={Repeat}
          iconBgColor="rgba(132, 204, 22, 0.1)"
          iconColor="#84cc16"
        />

        {/* Inactive Customers Card */}
        <DashboardStatsCard
          title="Inactive"
          value={summary?.totals?.inactiveCustomers || 0}
          icon={XCircle}
          iconBgColor="rgba(239, 68, 68, 0.1)"
          iconColor="#ef4444"
        />
      </div>

      {/* Main Content Area with Pull-to-Refresh */}
      <div {...containerProps} className="relative">
        {/* Pull-to-refresh indicator */}
        {isMobile && pullDistance > 0 && (
          <div 
            className="absolute top-0 left-0 right-0 flex items-center justify-center z-10 transition-opacity"
            style={{
              height: `${Math.min(pullDistance, 80)}px`,
              opacity: Math.min(pullDistance / 80, 1),
            }}
          >
            {isRefreshing ? (
              <Loader2 className="h-6 w-6 animate-spin text-[#166534]" />
            ) : (
              <RefreshCw className="h-6 w-6 text-[#166534]" />
            )}
          </div>
        )}
        
        <DashboardTable
          data={customers}
          columns={tableColumns}
          loading={loading || (isMobile && isRefreshing)}
          title={null}
          emptyIcon={<Users className="h-12 w-12 text-muted-foreground" />}
          emptyDescription="No customers found"
          pageSize={pagination.pageSize}
          externalPagination={{ current: pagination.current, total: pagination.total }}
          onPageChange={(newPagination) => {
            setPagination(newPagination);
          }}
        />
      </div>

      {/* Floating Action Button for Mobile */}
      <FloatingActionButton
        onClick={handleAdd}
        icon={Plus}
        label="Add Customer"
        show={isMobile}
      />

      <MobileFormDialog
        open={modalVisible}
        onOpenChange={setModalVisible}
        title={editingCustomer ? 'Edit Customer' : 'Add Customer'}
        description={editingCustomer ? 'Update customer information' : 'Add a new customer to your system'}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setModalVisible(false);
                setShowCustomerSourceOtherInput(false);
                setCustomerSourceOtherValue('');
              }}
            >
              Cancel
            </Button>
            <Button type="submit" form="customer-form" loading={form.formState.isSubmitting}>
              {editingCustomer ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <Form {...form}>
          <form id="customer-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormFieldGrid columns={2}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter customer name" />
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
                      <PhoneNumberInput {...field} placeholder="Enter phone number" />
                    </FormControl>
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
                      <Textarea {...field} rows={2} placeholder="Enter street address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="howDidYouHear" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>How did you hear about us? (optional)</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={(value) => {
                        field.onChange(value);
                        handleHowDidYouHearChange(value);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {defaultSources.map(group => (
                          <div key={group.group}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                              {group.group}
                            </div>
                            {group.items.map(item => (
                              <SelectItem key={item} value={item}>{item}</SelectItem>
                            ))}
                          </div>
                        ))}
                  {customCustomerSources.length > 0 && (
                          <div>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                              Custom Sources
                            </div>
                      {customCustomerSources.map(source => (
                              <SelectItem key={source.value} value={source.value}>
                                {source.label}
                              </SelectItem>
                            ))}
                          </div>
                        )}
                        <div>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            Other
                          </div>
                          <SelectItem value="__OTHER__">Other (specify)</SelectItem>
                        </div>
                      </SelectContent>
                </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {showCustomerSourceOtherInput && (
                <div className="flex gap-2">
                    <Input
                      placeholder="e.g., Billboard, Magazine Ad"
                      value={customerSourceOtherValue}
                      onChange={(e) => setCustomerSourceOtherValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveCustomCustomerSource();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    onClick={handleSaveCustomCustomerSource}
                    loading={savingCustomerSource}
                  >
                    Save
                  </Button>
                </div>
              )}

            {showReferralName && (
              <FormField
                control={form.control}
                name="referralName" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Referral Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter referral name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </form>
        </Form>
      </MobileFormDialog>

      {/* Filter Drawer */}
      <Sheet open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
        <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto" style={{ top: 8, bottom: 8, right: 8, height: 'calc(100vh - 16px)', borderRadius: 8 }}>
          <SheetHeader className="pb-4 border-b">
            <SheetTitle>Filter Customers</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 md:space-y-6 mt-4 md:mt-6">
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
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Customer Type</Label>
              <Select
                value={filters.customerType}
                onValueChange={(value) => setFilters({ ...filters, customerType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="returning">Returning</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Source</Label>
              <Select
                value={filters.howDidYouHear}
                onValueChange={(value) => setFilters({ ...filters, howDidYouHear: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {defaultSources.map(group => (
                    <div key={group.group}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {group.group}
                      </div>
                      {group.items.map(item => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </div>
                  ))}
                  {customCustomerSources.length > 0 && (
                    <div>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        Custom Sources
                      </div>
                      {customCustomerSources.map(source => (
                        <SelectItem key={source.value} value={source.value}>
                          {source.label}
                        </SelectItem>
                      ))}
                    </div>
                  )}
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

      <DetailsDrawer
        open={drawerVisible}
        onClose={handleCloseDrawer}
        title="Customer Details"
        width={720}
        extraActions={viewingCustomer ? [
          ...(isManager ? [{
            key: 'edit',
            label: 'Edit',
            variant: 'secondary',
            icon: <Pencil className="h-4 w-4" />,
            onClick: () => {
              handleEdit(viewingCustomer);
              setDrawerVisible(false);
            }
          }] : []),
          ...(isPrintingPress ? [{
            key: 'createJob',
            label: 'Create Job',
            variant: 'default',
            icon: <Briefcase className="h-4 w-4" />,
            onClick: handleCreateJob
          }] : [])
        ] : []}
        tabs={viewingCustomer ? [
          {
            key: 'overview',
            label: 'Overview',
            content: (
              <div className="space-y-6">
                <DrawerSectionCard title="Contact details">
                  <Descriptions column={1} className="space-y-0">
                    <DescriptionItem label="Name">
                      <span className="text-gray-900">{viewingCustomer.name || '—'}</span>
                    </DescriptionItem>
                    <DescriptionItem label="Company">
                      <span className="text-gray-900">{viewingCustomer.company || '—'}</span>
                    </DescriptionItem>
                    <DescriptionItem label="Email">
                      <span className="text-gray-900">{viewingCustomer.email || '—'}</span>
                    </DescriptionItem>
                    <DescriptionItem label="Phone">
                      <span className="text-gray-900">{viewingCustomer.phone || '—'}</span>
                    </DescriptionItem>
                  </Descriptions>
                </DrawerSectionCard>
                <DrawerSectionCard title="Address & info">
                  <Descriptions column={1} className="space-y-0">
                    <DescriptionItem label="Address">
                      <span className="text-gray-900">{viewingCustomer.address || '—'}</span>
                    </DescriptionItem>
                    <DescriptionItem label="City">
                      <span className="text-gray-900">{viewingCustomer.city || '—'}</span>
                    </DescriptionItem>
                    <DescriptionItem label="State">
                      <span className="text-gray-900">{viewingCustomer.state || '—'}</span>
                    </DescriptionItem>
                    <DescriptionItem label="Source">
                      {viewingCustomer.howDidYouHear ? (
                        <Badge variant="outline">{viewingCustomer.howDidYouHear}</Badge>
                      ) : <span className="text-gray-900">—</span>}
                    </DescriptionItem>
                    {viewingCustomer.howDidYouHear === 'Referral' && (
                      <DescriptionItem label="Referral Name">
                        <span className="text-gray-900">{viewingCustomer.referralName || '—'}</span>
                      </DescriptionItem>
                    )}
                    <DescriptionItem label="Type">
                      {parseFloat(viewingCustomer.balance || 0) > 0 ? (
                        <Badge variant="default">Returning</Badge>
                      ) : (
                        <Badge variant="outline">New</Badge>
                      )}
                    </DescriptionItem>
                    <DescriptionItem label="Balance">
                      <span className="text-gray-900">GHS {parseFloat(viewingCustomer.balance || 0).toFixed(2)}</span>
                    </DescriptionItem>
                    <DescriptionItem label="Status">
                      <Badge variant={viewingCustomer.isActive ? 'default' : 'destructive'}>
                        {viewingCustomer.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </DescriptionItem>
                    <DescriptionItem label="Created At">
                      <span className="text-gray-900">
                        {viewingCustomer.createdAt ? dayjs(viewingCustomer.createdAt).format('MMM DD, YYYY [at] h:mm A') : '—'}
                      </span>
                    </DescriptionItem>
                    <DescriptionItem label="Last Updated">
                      <span className="text-gray-900">
                        {viewingCustomer.updatedAt ? dayjs(viewingCustomer.updatedAt).format('MMM DD, YYYY [at] h:mm A') : '—'}
                      </span>
                    </DescriptionItem>
                  </Descriptions>
                </DrawerSectionCard>
              </div>
            )
          },
          {
            key: 'activities',
            label: 'Activity',
            content: (() => {
              if (!viewingCustomer) return null;
              
              const activities = viewingCustomer.activities || [];
              
              // Add creation activity
              const creationActivity = {
                id: 'creation',
                type: 'creation',
                createdAt: viewingCustomer.createdAt,
                createdByUser: null // Customer model doesn't have createdBy field
              };
              
              // Add invoice activities
              const invoiceActivities = (customerInvoices || []).map(invoice => ({
                id: `invoice-${invoice.id}`,
                type: 'invoice',
                subject: `Invoice ${invoice.invoiceNumber}`,
                notes: `Amount: GHS ${parseFloat(invoice.totalAmount || 0).toFixed(2)} | Status: ${invoice.status}`,
                createdAt: invoice.createdAt || invoice.invoiceDate,
                metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber }
              }));
              
              // Add job activities (if printing press)
              const jobActivities = isPrintingPress && viewingCustomer.jobs ? viewingCustomer.jobs.map(job => ({
                id: `job-${job.id}`,
                type: 'job',
                subject: `Job ${job.jobNumber}`,
                notes: `${job.title} | Status: ${job.status} | Amount: GHS ${parseFloat(job.finalPrice || 0).toFixed(2)}`,
                createdAt: job.createdAt,
                metadata: { jobId: job.id, jobNumber: job.jobNumber }
              })) : [];
              
              // Combine all activities and sort by date
              const allActivities = [
                creationActivity,
                ...activities,
                ...invoiceActivities,
                ...jobActivities
              ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
              
              const timelineItems = allActivities.map((activity, index) => {
                const isLast = index === allActivities.length - 1;
                
                if (activity.type === 'creation') {
                  return (
                    <TimelineItem key={activity.id} isLast={isLast}>
                      <TimelineIndicator />
                      <TimelineContent>
                        <TimelineTitle className="text-black">
                          {activity.createdByUser 
                            ? `${activity.createdByUser.name} added a new customer, ${viewingCustomer.name}`
                            : `Added a new customer, ${viewingCustomer.name}`}
                        </TimelineTitle>
                        <TimelineTime className="text-black">
                          {dayjs(activity.createdAt).format('MMM DD, YYYY [at] h:mm A')}
                        </TimelineTime>
                      </TimelineContent>
                    </TimelineItem>
                  );
                }
                
                if (activity.type === 'invoice') {
                  return (
                    <TimelineItem key={activity.id} isLast={isLast}>
                      <TimelineIndicator />
                      <TimelineContent>
                        <TimelineTitle className="text-black">
                          Invoice Created - {activity.metadata?.invoiceNumber || 'N/A'}
                        </TimelineTitle>
                        <TimelineTime className="text-black">
                          {dayjs(activity.createdAt).format('MMM DD, YYYY [at] h:mm A')}
                        </TimelineTime>
                        {activity.notes && (
                          <TimelineDescription className="text-black">{activity.notes}</TimelineDescription>
                        )}
                      </TimelineContent>
                    </TimelineItem>
                  );
                }
                
                if (activity.type === 'job') {
                  return (
                    <TimelineItem key={activity.id} isLast={isLast}>
                      <TimelineIndicator />
                      <TimelineContent>
                        <TimelineTitle className="text-black">
                          Job Created - {activity.metadata?.jobNumber || 'N/A'}
                        </TimelineTitle>
                        <TimelineTime className="text-black">
                          {dayjs(activity.createdAt).format('MMM DD, YYYY [at] h:mm A')}
                        </TimelineTime>
                        {activity.notes && (
                          <TimelineDescription className="text-black">{activity.notes}</TimelineDescription>
                        )}
                      </TimelineContent>
                    </TimelineItem>
                  );
                }
                
                // Regular activity
                return (
                  <TimelineItem key={activity.id} isLast={isLast}>
                    <TimelineIndicator />
                    <TimelineContent>
                      <TimelineTitle className="text-black">
                        {activity.type.toUpperCase()} {activity.subject ? `- ${activity.subject}` : ''}
                      </TimelineTitle>
                      <TimelineTime className="text-black">
                        {dayjs(activity.createdAt).format('MMM DD, YYYY [at] h:mm A')}
                        {activity.createdByUser ? ` • ${activity.createdByUser.name}` : ''}
                      </TimelineTime>
                      {activity.notes && (
                        <TimelineDescription className="text-black">{activity.notes}</TimelineDescription>
                      )}
                      {activity.nextStep && (
                        <TimelineDescription className="text-black">Next Step: {activity.nextStep}</TimelineDescription>
                      )}
                      {activity.followUpDate && (
                        <TimelineDescription className="text-black">
                          Follow-up: {dayjs(activity.followUpDate).format('MMM DD, YYYY hh:mm A')}
                        </TimelineDescription>
                      )}
                    </TimelineContent>
                  </TimelineItem>
                );
              });
              
              return (
                <DrawerSectionCard title="Activity">
                  {timelineItems.length ? (
                    <Timeline>
                      {timelineItems}
                    </Timeline>
                  ) : (
                    <Alert>
                      <AlertTitle>No activity logged yet.</AlertTitle>
                    </Alert>
                  )}
                </DrawerSectionCard>
              );
            })()
          },
          {
            key: 'invoices',
            label: 'Invoices',
            content: (
              <DrawerSectionCard title={`Invoices (${customerInvoices.length})`}>
                {loadingInvoices ? (
                  <div className="py-8">
                    <TableSkeleton rows={3} cols={4} />
                  </div>
                ) : customerInvoices.length > 0 ? (
                  <div className="space-y-3">
                    {customerInvoices.map((invoice) => (
                      <div key={invoice.id} className="flex items-center justify-between py-3 border-b border-gray-200 last:border-b-0">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900">{invoice.invoiceNumber}</div>
                          {isPrintingPress && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {invoice.job?.title || 'No job linked'}
                            </p>
                          )}
                          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                            <p>Due: {invoice.dueDate ? dayjs(invoice.dueDate).format('MMM DD, YYYY') : 'N/A'}</p>
                            <p>Balance: GHS {parseFloat(invoice.balance || 0).toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0 ml-4">
                          <StatusChip status={invoice.status} />
                          <div className="text-right">
                            <div className="font-semibold text-gray-900">GHS {parseFloat(invoice.totalAmount || 0).toFixed(2)}</div>
                            <div className="text-sm text-green-600">
                              Paid: GHS {parseFloat(invoice.amountPaid || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">No invoices found for this customer</div>
                )}
              </DrawerSectionCard>
            )
          }
        ] : null}
      />
    </div>
  );
};

export default Customers;
