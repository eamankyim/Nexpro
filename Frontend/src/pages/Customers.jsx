import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDebounce } from '../hooks/useDebounce';
import { useResponsive } from '../hooks/useResponsive';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Loader2, RefreshCw, Filter, Users, Repeat, XCircle, CheckCircle, Phone, Mail, Briefcase, Pencil, Printer, Download, Receipt, Cloud, CloudOff } from 'lucide-react';
import customerService from '../services/customerService';
import offlineQueueService from '../services/offlineQueueService';
import { 
  cacheCustomers, 
  getCachedCustomers, 
  searchCustomersOffline,
  setLastCustomerSyncTime,
  getLastCustomerSyncTime 
} from '../utils/posDb';
import jobService from '../services/jobService';
import invoiceService from '../services/invoiceService';
import saleService from '../services/saleService';
import customDropdownService from '../services/customDropdownService';
import settingsService from '../services/settingsService';
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
import ViewToggle from '../components/ViewToggle';
import DashboardStatsCard from '../components/DashboardStatsCard';
import WelcomeSection from '../components/WelcomeSection';
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
import { Sheet } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ResponsiveSheet from '../components/ResponsiveSheet';
import { SEARCH_PLACEHOLDERS, DEBOUNCE_DELAYS } from '../constants';
import { generatePDF, openPrintDialog } from '../utils/pdfUtils';
import PrintableReceipt from '../components/PrintableReceipt';
import PrintableInvoice from '../components/PrintableInvoice';

/** API often returns null for empty optional fields; forms need strings for controlled inputs. */
const customerString = z.preprocess(
  (val) => (val === null || val === undefined ? '' : val),
  z.string()
);

const customerSchema = z.object({
  name: z.preprocess(
    (val) => (val === null || val === undefined ? '' : val),
    z.string().min(1, 'Enter customer name')
  ),
  email: z.preprocess(
    (val) => (val === null || val === undefined ? '' : val),
    z.union([z.literal(''), z.string().email('Enter a valid email')])
  ),
  company: customerString,
  phone: customerString,
  address: customerString,
  city: customerString,
  state: customerString,
  howDidYouHear: customerString,
  referralName: customerString,
});

const Customers = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { searchValue, setPageSearchConfig } = useSmartSearch();
  const debouncedSearchText = useDebounce(searchValue, DEBOUNCE_DELAYS.SEARCH);
  const { isMobile } = useResponsive();
  const [customers, setCustomers] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { isManager, user, activeTenant, activeTenantId } = useAuth();
  const queryClient = useQueryClient();
  const businessType = activeTenant?.businessType || 'printing_press';
  const isPrintingPress = businessType === 'printing_press';
  const [showReferralName, setShowReferralName] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [customerReceipts, setCustomerReceipts] = useState([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [printConfig, setPrintConfig] = useState({});
  const [loadingCustomerDetails, setLoadingCustomerDetails] = useState(false);
  const [customCustomerSources, setCustomCustomerSources] = useState([]);
  const [showCustomerSourceOtherInput, setShowCustomerSourceOtherInput] = useState(false);
  const [customerSourceOtherValue, setCustomerSourceOtherValue] = useState('');
  const [tableViewMode, setTableViewMode] = useState('table');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [refreshingCustomers, setRefreshingCustomers] = useState(false);
  const [savingCustomerSource, setSavingCustomerSource] = useState(false);
  const [filters, setFilters] = useState({
    isActive: 'true',
    howDidYouHear: 'all',
    customerType: 'all', // 'all', 'new', 'returning'
  });
  const [cachedCustomers, setCachedCustomers] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const initialCacheLoaded = useRef(false);

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

  // Load cached customers on mount (instant load)
  useEffect(() => {
    const loadCachedData = async () => {
      try {
        const cached = await getCachedCustomers();
        const lastSync = await getLastCustomerSyncTime();
        if (cached.length > 0 && !initialCacheLoaded.current) {
          setCachedCustomers(cached);
          setLastSynced(lastSync ? new Date(lastSync).getTime() : null);
          initialCacheLoaded.current = true;
        }
      } catch (err) {
        console.error('[Customers] Failed to load cached data:', err);
      }
    };
    loadCachedData();
  }, []);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, [searchValue]);

  const customersQueryParams = useMemo(() => {
    const params = {
      page: pagination.current,
      limit: pagination.pageSize,
      search: debouncedSearchText,
    };
    if (filters.isActive !== 'all') params.isActive = filters.isActive === 'true';
    if (filters.howDidYouHear !== 'all') params.howDidYouHear = filters.howDidYouHear;
    return params;
  }, [pagination.current, pagination.pageSize, debouncedSearchText, filters.isActive, filters.howDidYouHear]);

  const {
    data: customersResponse,
    isLoading: loading,
    refetch: refetchCustomers,
  } = useQuery({
    queryKey: ['customers', customersQueryParams],
    queryFn: () => customerService.getAll(customersQueryParams),
    enabled: !!activeTenantId,
  });

  const { data: statsResponse } = useQuery({
    queryKey: ['customers', 'stats'],
    queryFn: () => customerService.getStats(),
    enabled: !!activeTenantId,
  });

  const createMutation = useMutation({
    mutationFn: async (values) => {
      if (!navigator.onLine) {
        await offlineQueueService.queueAction(
          offlineQueueService.OFFLINE_ACTION_TYPES.CUSTOMER,
          'create',
          values
        );
        return { _offline: true };
      }
      return customerService.create(values);
    },
    onSuccess: (data) => {
      // If backend returns { success: false, error: ... } with 200 status, treat as error and avoid conflicting toasts
      if (data && data.success === false) {
        handleApiError(
          { response: { data } },
          {
            defaultMessage: 'Failed to save customer. Please try again.',
            context: 'create customer',
            logError: false,
          }
        );
        return;
      }
      showSuccess(
        data?._offline ? 'Saved offline. Will sync when connected.' : 'Customer created successfully'
      );
      setModalVisible(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error) => handleApiError(error, { context: 'create customer' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }) => {
      if (!navigator.onLine) {
        await offlineQueueService.queueAction(
          offlineQueueService.OFFLINE_ACTION_TYPES.CUSTOMER,
          'update',
          { ...values, id }
        );
        return { _offline: true };
      }
      return customerService.update(id, values);
    },
    onSuccess: (data) => {
      showSuccess(data?._offline ? 'Saved offline. Will sync when connected.' : 'Customer updated successfully');
      setModalVisible(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error) => handleApiError(error, { context: 'update customer' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      if (!navigator.onLine) {
        await offlineQueueService.queueAction(
          offlineQueueService.OFFLINE_ACTION_TYPES.CUSTOMER,
          'delete',
          { id }
        );
        return { _offline: true };
      }
      return customerService.delete(id);
    },
    onSuccess: (data) => {
      showSuccess(data?._offline ? 'Saved offline. Will sync when connected.' : 'Customer deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error) => handleApiError(error, { context: 'delete customer' }),
  });

  useEffect(() => {
    if (!customersResponse) return;
    let customersData = [];
    if (customersResponse?.success !== false && customersResponse?.data) {
      customersData = Array.isArray(customersResponse.data) ? customersResponse.data : [];
    } else {
      customersData = Array.isArray(customersResponse) ? customersResponse : [];
    }
    
    // Cache customers for offline access (only cache full list, not filtered)
    if (customersData.length > 0 && !debouncedSearchText && filters.isActive === 'true' && filters.howDidYouHear === 'all') {
      const cacheData = async () => {
        try {
          setIsSyncing(true);
          await cacheCustomers(customersData);
          await setLastCustomerSyncTime(new Date().toISOString());
          setCachedCustomers(customersData);
          setLastSynced(Date.now());
        } catch (err) {
          console.error('[Customers] Failed to cache:', err);
        } finally {
          setIsSyncing(false);
        }
      };
      cacheData();
    }
    
    if (filters.customerType !== 'all') {
      customersData = customersData.filter((customer) => {
        const balance = parseFloat(customer.balance || 0);
        if (filters.customerType === 'new') return balance === 0;
        if (filters.customerType === 'returning') return balance > 0;
        return true;
      });
    }
    setCustomers(customersData);
    setPagination((prev) => ({
      ...prev,
      total: customersResponse?.count ?? customersData.length,
    }));
  }, [customersResponse, filters.customerType, debouncedSearchText, filters.isActive, filters.howDidYouHear]);

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

  const handleRefresh = useCallback(() => {
    setRefreshingCustomers(true);
    queryClient.invalidateQueries({ queryKey: ['customers'] }).finally(() => {
      setRefreshingCustomers(false);
    });
  }, [queryClient]);

  const { isRefreshing, pullDistance, containerProps } = usePullToRefresh(
    handleRefresh,
    { enabled: isMobile }
  );

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


  const handleView = (customer) => {
    setViewingCustomer(customer);
    setDrawerVisible(true);
    setLoadingCustomerDetails(true);
    setLoadingReceipts(true);
    customerService.getById(customer.id)
      .then((customerResponse) => {
        const fullCustomer = customerResponse?.data || customerResponse;
        setViewingCustomer((prev) => (prev?.id === customer.id ? (fullCustomer || prev) : prev));
      })
      .catch((error) => console.error('Failed to load customer details:', error))
      .finally(() => setLoadingCustomerDetails(false));
    saleService.getSales({ customerId: customer.id, limit: 50 })
      .then((response) => {
        const sales = response?.data?.data ?? response?.data ?? [];
        setCustomerReceipts(Array.isArray(sales) ? sales : []);
      })
      .catch((error) => {
        console.error('Failed to load customer receipts:', error);
        setCustomerReceipts([]);
      })
      .finally(() => setLoadingReceipts(false));
    
    // Load organization settings for receipt printing
    settingsService.getOrganization()
      .then((response) => {
        const body = response?.data || response;
        const org = body?.data || body;
        setOrganization(org);
      })
      .catch((error) => console.error('Failed to load organization:', error));
    
    settingsService.getPrintConfig()
      .then((response) => {
        const config = response?.data || response || {};
        setPrintConfig(config);
      })
      .catch((error) => console.error('Failed to load print config:', error));
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setViewingCustomer(null);
    setCustomerReceipts([]);
  };

  const handlePrintReceipt = useCallback(async (sale) => {
    setReceiptData(sale);
    setPrintModalVisible(true);
  }, []);

  const handleCreateJob = () => {
    if (viewingCustomer) {
      setDrawerVisible(false);
      navigate(`/jobs?customerId=${viewingCustomer.id}`);
    }
  };

  const handleDelete = (id) => {
    deleteMutation.mutate(id);
  };

  const onSubmit = async (values) => {
    if (values.howDidYouHear === '__OTHER__') {
      if (!customerSourceOtherValue || !customerSourceOtherValue.trim()) {
        showError('Please enter and save a custom source before submitting');
        return;
      }
      try {
        const saved = await customDropdownService.saveCustomOption('customer_source', customerSourceOtherValue.trim());
        if (saved) {
          values.howDidYouHear = saved.value;
          setCustomCustomerSources(prev => {
            if (prev.find(s => s.value === saved.value)) return prev;
            return [...prev, saved];
          });
        }
      } catch (error) {
        handleApiError(error, { context: 'save custom source' });
        return;
      }
    }

    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, values });
    } else {
      createMutation.mutate(values);
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
      render: (_, record) => <span className="text-foreground">{record?.company || '—'}</span>
    },
    {
      key: 'email',
      label: 'Email',
      render: (_, record) => record?.email ? (
        <a href={`mailto:${record.email}`} className="text-foreground hover:underline flex items-center gap-1">
          <Mail className="h-4 w-4" />
          {record.email}
        </a>
      ) : <span className="text-foreground">—</span>
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (_, record) => record?.phone ? (
        <a href={`tel:${record.phone}`} className="text-foreground hover:underline flex items-center gap-1">
          <Phone className="h-4 w-4" />
          {record.phone}
        </a>
      ) : <span className="text-foreground">—</span>
    },
    {
      key: 'source',
      label: 'Source',
      render: (_, record) => record?.howDidYouHear ? (
        <Badge variant="outline">{record.howDidYouHear}</Badge>
      ) : <span className="text-foreground">—</span>
    },
    {
      key: 'balance',
      label: 'Balance',
      render: (_, record) => <span className="text-foreground">₵ {parseFloat(record?.balance || 0).toFixed(2)}</span>
    },
    {
      key: 'status',
      label: 'Status',
      mobileDashboardPlacement: 'headerEnd',
      render: (_, record) => (
        <StatusChip status={record?.isActive ? 'active_flag' : 'inactive_flag'} />
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, record) => <ActionColumn onView={handleView} record={record} />
    }
  ], [handleView]);
  
  // Summary stats state - fetched from backend
  const summary = useMemo(() => {
    const data = statsResponse?.data ?? statsResponse ?? {};
    return {
      totals: {
        totalCustomers: data?.totalCustomers ?? 0,
        activeCustomers: data?.activeCustomers ?? 0,
        inactiveCustomers: data?.inactiveCustomers ?? 0,
        returningCustomers: data?.returningCustomers ?? 0,
      },
    };
  }, [statsResponse]);

  const { data: customerSourceOptionsApi = [] } = useQuery({
    queryKey: ['settings', 'customer-sources', activeTenantId],
    queryFn: () => settingsService.getCustomerSources(),
    enabled: !!activeTenantId,
    staleTime: 5 * 60 * 1000,
  });

  const defaultSources = useMemo(() => {
    const apiOpts = Array.isArray(customerSourceOptionsApi) ? customerSourceOptionsApi : [];
    const mapped = apiOpts.map(s => ({ value: s.value, label: s.label || s.value }));
    return mapped.length > 0 ? mapped : [
      { value: 'Walk-in', label: 'Walk-in' },
      { value: 'Referral', label: 'Referral' },
      { value: 'Website', label: 'Website' },
      { value: 'Social Media', label: 'Social Media' }
    ];
  }, [customerSourceOptionsApi]);

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
        <div className="flex items-center gap-2 flex-1 min-w-0 sm:justify-end sm:ml-auto">
          {/* Sync status indicator */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                isOffline 
                  ? 'bg-orange-50 text-orange-600' 
                  : isSyncing 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'bg-green-50 text-green-600'
              }`}>
                {isOffline ? (
                  <>
                    <CloudOff className="h-3 w-3" />
                    <span className="hidden sm:inline">Offline</span>
                  </>
                ) : isSyncing ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    <span className="hidden sm:inline">Syncing</span>
                  </>
                ) : (
                  <>
                    <Cloud className="h-3 w-3" />
                    <span className="hidden sm:inline">Synced</span>
                  </>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {isOffline 
                ? `Offline - showing ${cachedCustomers.length} cached customers` 
                : lastSynced 
                  ? `Last synced ${Math.round((Date.now() - lastSynced) / 60000)}m ago` 
                  : 'Customer data synced'
              }
            </TooltipContent>
          </Tooltip>
          <ViewToggle value={tableViewMode} onChange={setTableViewMode} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={() => setFilterDrawerOpen(true)}
                size={isMobile ? 'icon' : 'default'}
              >
                <Filter className="h-4 w-4" />
                {!isMobile && <span className="ml-2">Filter</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Filter by status, source, or customer type</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={refreshingCustomers}
                size={isMobile ? 'icon' : 'default'}
              >
                {refreshingCustomers ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reload customer list</TooltipContent>
          </Tooltip>
          {(isManager || user?.role === 'staff') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleAdd}
                  className="min-h-[44px] flex-1 min-w-0 md:flex-none"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  <span>Add Customer</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add a new customer to your database</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
        {/* Total Customers Card */}
        <DashboardStatsCard
          tooltip="Total number of customers in your database"
          title="Total Customers"
          value={summary?.totals?.totalCustomers || 0}
          icon={Users}
          iconBgColor="rgba(22, 101, 52, 0.1)"
          iconColor="#166534"
        />

        {/* Active Customers Card */}
        <DashboardStatsCard
          tooltip="Customers who have made a purchase or interacted recently"
          title="Active"
          value={summary?.totals?.activeCustomers || 0}
          icon={CheckCircle}
          iconBgColor="rgba(59, 130, 246, 0.1)"
          iconColor="#166534"
        />

        {/* Returning Customers Card */}
        <DashboardStatsCard
          tooltip="Customers with more than one transaction"
          title="Returning Customers"
          value={summary?.totals?.returningCustomers || 0}
          icon={Repeat}
          iconBgColor="rgba(132, 204, 22, 0.1)"
          iconColor="#84cc16"
        />

        {/* Inactive Customers Card */}
        <DashboardStatsCard
          tooltip="Customers with no recent activity"
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
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
            ) : (
              <RefreshCw className="h-6 w-6 text-brand" />
            )}
          </div>
        )}
        
        <DashboardTable
          data={customers}
          columns={tableColumns}
          loading={loading || (isMobile && isRefreshing)}
          title={null}
          emptyIcon={<Users className="h-12 w-12 text-muted-foreground" />}
          emptyDescription="No customers found. Add your first customer to get started."
          emptyAction={
            (isManager || user?.role === 'staff') && (
              <Button onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Customer
              </Button>
            )
          }
          pageSize={pagination.pageSize}
          externalPagination={{ current: pagination.current, total: pagination.total }}
          onPageChange={(newPagination) => {
            setPagination(newPagination);
          }}
          viewMode={tableViewMode}
          onViewModeChange={setTableViewMode}
        />
      </div>

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
                    <FormLabel>Phone (optional)</FormLabel>
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
                    <FormLabel>Address (optional)</FormLabel>
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
                        {defaultSources.map(source => (
                          <SelectItem key={source.value} value={source.value}>{source.label}</SelectItem>
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
                    <FormLabel>Referral Name (optional)</FormLabel>
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
      <ResponsiveSheet
        open={filterDrawerOpen}
        onOpenChange={setFilterDrawerOpen}
        title="Filter Customers"
        contentClassName="space-y-4 md:space-y-6 mt-4 md:mt-6"
      >
          <div className="space-y-4 md:space-y-6 mt-0">
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
                  {defaultSources.map(source => (
                    <SelectItem key={source.value} value={source.value}>{source.label}</SelectItem>
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
      </ResponsiveSheet>

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
                      <span className="text-foreground">{viewingCustomer.name || '—'}</span>
                    </DescriptionItem>
                    <DescriptionItem label="Company">
                      <span className="text-foreground">{viewingCustomer.company || '—'}</span>
                    </DescriptionItem>
                    <DescriptionItem label="Email">
                      <span className="text-foreground">{viewingCustomer.email || '—'}</span>
                    </DescriptionItem>
                    <DescriptionItem label="Phone">
                      <span className="text-foreground">{viewingCustomer.phone || '—'}</span>
                    </DescriptionItem>
                  </Descriptions>
                </DrawerSectionCard>
                <DrawerSectionCard title="Address & info">
                  <Descriptions column={1} className="space-y-0">
                    <DescriptionItem label="Address">
                      <span className="text-foreground">{viewingCustomer.address || '—'}</span>
                    </DescriptionItem>
                    <DescriptionItem label="City">
                      <span className="text-foreground">{viewingCustomer.city || '—'}</span>
                    </DescriptionItem>
                    <DescriptionItem label="State">
                      <span className="text-foreground">{viewingCustomer.state || '—'}</span>
                    </DescriptionItem>
                    <DescriptionItem label="Source">
                      {viewingCustomer.howDidYouHear ? (
                        <Badge variant="outline">{viewingCustomer.howDidYouHear}</Badge>
                      ) : <span className="text-foreground">—</span>}
                    </DescriptionItem>
                    {viewingCustomer.howDidYouHear === 'Referral' && (
                      <DescriptionItem label="Referral Name">
                        <span className="text-foreground">{viewingCustomer.referralName || '—'}</span>
                      </DescriptionItem>
                    )}
                    <DescriptionItem label="Type">
                      <StatusChip
                        status={parseFloat(viewingCustomer.balance || 0) > 0 ? 'returning' : 'new'}
                      />
                    </DescriptionItem>
                    <DescriptionItem label="Balance">
                      <span className="text-foreground">₵ {parseFloat(viewingCustomer.balance || 0).toFixed(2)}</span>
                    </DescriptionItem>
                    <DescriptionItem label="Status">
                      <StatusChip status={viewingCustomer.isActive ? 'active_flag' : 'inactive_flag'} />
                    </DescriptionItem>
                    <DescriptionItem label="Created At">
                      <span className="text-foreground">
                        {viewingCustomer.createdAt ? dayjs(viewingCustomer.createdAt).format('MMM DD, YYYY [at] h:mm A') : '—'}
                      </span>
                    </DescriptionItem>
                    <DescriptionItem label="Last Updated">
                      <span className="text-foreground">
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
              
              // Add receipt activities
              const receiptActivities = (customerReceipts || []).map(sale => ({
                id: `receipt-${sale.id}`,
                type: 'receipt',
                subject: `Receipt ${sale.saleNumber}`,
                notes: `Amount: ₵ ${parseFloat(sale.total || 0).toFixed(2)} | Payment: ${sale.paymentMethod}`,
                createdAt: sale.createdAt,
                metadata: { saleId: sale.id, saleNumber: sale.saleNumber }
              }));
              
              // Add job activities (if printing press)
              const jobActivities = isPrintingPress && viewingCustomer.jobs ? viewingCustomer.jobs.map(job => ({
                id: `job-${job.id}`,
                type: 'job',
                subject: `Job ${job.jobNumber}`,
                notes: `${job.title} | Status: ${job.status} | Amount: ₵ ${parseFloat(job.finalPrice || 0).toFixed(2)}`,
                createdAt: job.createdAt,
                metadata: { jobId: job.id, jobNumber: job.jobNumber }
              })) : [];
              
              // Combine all activities and sort by date
              const allActivities = [
                creationActivity,
                ...activities,
                ...receiptActivities,
                ...jobActivities
              ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
              
              const timelineItems = allActivities.map((activity, index) => {
                const isLast = index === allActivities.length - 1;
                
                if (activity.type === 'creation') {
                  return (
                    <TimelineItem key={activity.id} isLast={isLast}>
                      <TimelineIndicator />
                      <TimelineContent>
                        <TimelineTitle className="text-foreground">
                          {activity.createdByUser 
                            ? `${activity.createdByUser.name} added a new customer, ${viewingCustomer.name}`
                            : `Added a new customer, ${viewingCustomer.name}`}
                        </TimelineTitle>
                        <TimelineTime className="text-foreground">
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
                        <TimelineTitle className="text-foreground">
                          Invoice Created - {activity.metadata?.invoiceNumber || 'N/A'}
                        </TimelineTitle>
                        <TimelineTime className="text-foreground">
                          {dayjs(activity.createdAt).format('MMM DD, YYYY [at] h:mm A')}
                        </TimelineTime>
                        {activity.notes && (
                          <TimelineDescription className="text-foreground">{activity.notes}</TimelineDescription>
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
                        <TimelineTitle className="text-foreground">
                          Job Created - {activity.metadata?.jobNumber || 'N/A'}
                        </TimelineTitle>
                        <TimelineTime className="text-foreground">
                          {dayjs(activity.createdAt).format('MMM DD, YYYY [at] h:mm A')}
                        </TimelineTime>
                        {activity.notes && (
                          <TimelineDescription className="text-foreground">{activity.notes}</TimelineDescription>
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
                      <TimelineTitle className="text-foreground">
                        {activity.type.toUpperCase()} {activity.subject ? `- ${activity.subject}` : ''}
                      </TimelineTitle>
                      <TimelineTime className="text-foreground">
                        {dayjs(activity.createdAt).format('MMM DD, YYYY [at] h:mm A')}
                        {activity.createdByUser ? ` • ${activity.createdByUser.name}` : ''}
                      </TimelineTime>
                      {activity.notes && (
                        <TimelineDescription className="text-foreground">{activity.notes}</TimelineDescription>
                      )}
                      {activity.nextStep && (
                        <TimelineDescription className="text-foreground">Next Step: {activity.nextStep}</TimelineDescription>
                      )}
                      {activity.followUpDate && (
                        <TimelineDescription className="text-foreground">
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
            key: 'receipts',
            label: 'Receipts',
            content: (
              <DrawerSectionCard title={`Receipts (${customerReceipts.length})`}>
                {loadingReceipts ? (
                  <div className="py-8">
                    <TableSkeleton rows={3} cols={4} />
                  </div>
                ) : customerReceipts.length > 0 ? (
                  <div className="space-y-3">
                    {customerReceipts.map((sale) => (
                      <div key={sale.id} className="flex items-center justify-between py-3 border-b border-gray-200 last:border-b-0">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground">{sale.saleNumber}</div>
                          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                            <p>Date: {dayjs(sale.createdAt).format('MMM DD, YYYY')}</p>
                            <p>Payment: {sale.paymentMethod || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0 ml-4">
                          <StatusChip status={sale.status === 'completed' ? 'completed' : sale.status} />
                          <div className="text-right">
                            <div className="font-semibold text-foreground">₵ {parseFloat(sale.total || 0).toFixed(2)}</div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-1 text-xs"
                              onClick={() => handlePrintReceipt(sale)}
                            >
                              <Receipt className="h-3 w-3 mr-1" />
                              View Receipt
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">No receipts found for this customer</div>
                )}
              </DrawerSectionCard>
            )
          }
        ] : null}
      />

      {/* Receipt Print Modal */}
      <Dialog open={printModalVisible} onOpenChange={setPrintModalVisible}>
        <DialogContent className="max-w-[95vw] sm:max-w-[920px] max-h-[90vh] flex flex-col p-0 rounded-2xl">
          <DialogHeader className="px-4 sm:px-6 py-4 border-b flex-shrink-0 text-left no-print">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
              <div>
                <DialogTitle>Receipt Preview</DialogTitle>
                <DialogDescription>
                  Review the receipt before downloading
                </DialogDescription>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-initial"
                  onClick={() => {
                    const wrapper = document.querySelector(
                      receiptData?.invoice ? '.printable-invoice' : '.printable-receipt'
                    )?.parentElement;
                    if (wrapper && receiptData) {
                      openPrintDialog(wrapper, `Receipt-${receiptData.saleNumber || 'receipt'}`);
                    }
                  }}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button 
                  className="flex-1 sm:flex-initial"
                  onClick={async () => {
                    const element = document.querySelector(
                      receiptData?.invoice ? '.printable-invoice' : '.printable-receipt'
                    );
                    if (element && receiptData) {
                      try {
                        await generatePDF(element, {
                          filename: `Receipt-${receiptData.saleNumber || 'receipt'}.pdf`,
                          format: 'a4',
                          orientation: 'portrait',
                        });
                        showSuccess('Receipt downloaded successfully');
                      } catch (error) {
                        console.error('PDF generation error:', error);
                        showError(null, 'Failed to generate PDF');
                      }
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overflow-x-hidden bg-muted/50 p-2 sm:p-4 md:p-8">
            <div className="max-w-full sm:max-w-[900px] mx-auto w-full" id="receipt-pdf-content">
              {receiptData && (
                receiptData.invoice ? (
                  <PrintableInvoice
                    key={receiptData.invoice.id || 'receipt'}
                    invoice={receiptData.invoice}
                    documentTitle="RECEIPT"
                    saleNumber={receiptData.saleNumber}
                    organization={organization || {}}
                    printConfig={printConfig}
                  />
                ) : (
                  <PrintableReceipt
                    key={receiptData.id || 'receipt'}
                    sale={receiptData}
                    organization={organization || {}}
                    printConfig={printConfig}
                  />
                )
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Customers;
