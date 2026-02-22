import { useEffect, useState, useMemo, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDebounce } from '../hooks/useDebounce';
import { useResponsive } from '../hooks/useResponsive';
import { useAuth } from '../context/AuthContext';
import { useSmartSearch } from '../context/SmartSearchContext';
import {
  Plus,
  FileText,
  FilePlus,
  CheckCircle,
  Printer,
  Download,
  Loader2,
  X,
  Filter,
  RefreshCw,
  Receipt,
  MessageSquare
} from 'lucide-react';
import { generatePDF } from '../utils/pdfUtils';
import dayjs from 'dayjs';
import { useNavigate, useSearchParams } from 'react-router-dom';
import quoteService from '../services/quoteService';
import customerService from '../services/customerService';
import settingsService from '../services/settingsService';
import { useQuery } from '@tanstack/react-query';
import ActionColumn from '../components/ActionColumn';
import DetailsDrawer from '../components/DetailsDrawer';
import DrawerSectionCard from '../components/DrawerSectionCard';
import PrintableInvoice from '../components/PrintableInvoice';
import StatusChip from '../components/StatusChip';
import TableSkeleton from '../components/TableSkeleton';
import DetailSkeleton from '../components/DetailSkeleton';
import DashboardTable from '../components/DashboardTable';
import ViewToggle from '../components/ViewToggle';
import DashboardStatsCard from '../components/DashboardStatsCard';
import WelcomeSection from '../components/WelcomeSection';
import { showSuccess, showError } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Timeline, TimelineItem, TimelineIndicator, TimelineContent, TimelineTitle, TimelineDescription, TimelineTime } from '@/components/ui/timeline';
import { Descriptions, DescriptionItem } from '@/components/ui/descriptions';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
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
import { SEARCH_PLACEHOLDERS, DEBOUNCE_DELAYS } from '../constants';

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' }
];

const quoteItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0, 'Unit price must be at least 0'),
  discountAmount: z.number().min(0, 'Discount must be at least 0').default(0),
});

const quickCustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  company: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
});

const quoteSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  title: z.string().min(1, 'Quote title is required'),
  description: z.string().optional(),
  status: z.enum(['draft', 'sent', 'accepted', 'declined', 'expired']).default('draft'),
  validUntil: z.date().optional().nullable(),
  notes: z.string().optional(),
  items: z.array(quoteItemSchema).min(1, 'At least one item is required'),
});

const Quotes = () => {
  const { searchValue, setPageSearchConfig } = useSmartSearch();
  const debouncedSearch = useDebounce(searchValue, DEBOUNCE_DELAYS.SEARCH);
  const { isMobile } = useResponsive();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ status: 'all', customerId: 'all' });
  const [tableViewMode, setTableViewMode] = useState('table');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingQuote, setViewingQuote] = useState(null);
  const [quoteModalVisible, setQuoteModalVisible] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [converting, setConverting] = useState(false);
  const [refreshingQuotes, setRefreshingQuotes] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [quotePrintable, setQuotePrintable] = useState(null);
  const [pendingDownload, setPendingDownload] = useState(false);
  const [deleteQuoteId, setDeleteQuoteId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quoteActivities, setQuoteActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [customerAddModalOpen, setCustomerAddModalOpen] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);

  // Organization branding for printable quotes
  const { data: organizationData } = useQuery({
    queryKey: ['settings', 'organization'],
    queryFn: () => settingsService.getOrganization(),
    staleTime: 5 * 60 * 1000,
  });

  const organization = organizationData?.data?.data || organizationData?.data || {};

  const form = useForm({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      customerId: '',
      title: '',
      description: '',
      status: 'draft',
      validUntil: null,
      notes: '',
      items: [{ description: '', quantity: 1, unitPrice: 0, discountAmount: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const customerForm = useForm({
    resolver: zodResolver(quickCustomerSchema),
    defaultValues: { name: '', company: '', email: '', phone: '' },
  });

  const fetchCustomers = useCallback(async () => {
    try {
      const customersResponse = await customerService.getAll({ limit: 100 });
      setCustomers(customersResponse.data || []);
    } catch (error) {
      console.error('Failed to load customers', error);
      showError(error, 'Failed to load customers');
    }
  }, []);

  const handleAddCustomerSubmit = useCallback(async (values) => {
    setAddingCustomer(true);
    try {
      const response = await customerService.create({
        name: values.name,
        company: values.company || undefined,
        email: values.email || undefined,
        phone: values.phone || undefined,
      });
      const newCustomer = response?.data ?? response;
      if (!newCustomer?.id) throw new Error('Invalid customer response');
      await fetchCustomers();
      setCustomerAddModalOpen(false);
      customerForm.reset({ name: '', company: '', email: '', phone: '' });
      showSuccess('Customer created successfully');
      form.setValue('customerId', newCustomer.id);
    } catch (error) {
      showError(error, error?.response?.data?.message || 'Failed to create customer');
    } finally {
      setAddingCustomer(false);
    }
  }, [form, fetchCustomers, customerForm]);

  const buildPrintableQuote = (quote) => {
    if (!quote) return null;
    return {
      ...quote,
      invoiceNumber: quote.quoteNumber,
      invoiceDate: quote.createdAt || quote.updatedAt || new Date(),
      dueDate: quote.validUntil || quote.createdAt || new Date(),
      subtotal: parseFloat(quote.subtotal || 0),
      taxAmount: parseFloat(quote.taxAmount || 0),
      taxRate: parseFloat(quote.taxRate || 0),
      discountAmount: parseFloat(quote.discountTotal || 0),
      discountType: quote.discountType || 'fixed',
      discountValue: parseFloat(quote.discountValue || 0),
      totalAmount: parseFloat(quote.totalAmount || 0),
      amountPaid: 0,
      balance: parseFloat(quote.totalAmount || 0),
      // Show quote notes in the printable as Terms & Conditions / notes section
      termsAndConditions: quote.notes || quote.description || '',
      items: (quote.items || []).map((item) => ({
        ...item,
        description: item.description,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice || 0),
        total: parseFloat(item.total || (parseFloat(item.unitPrice || 0) * (item.quantity || 0))),
        discountAmount: parseFloat(item.discountAmount || 0)
      }))
    };
  };

  useEffect(() => {
    setPageSearchConfig({ scope: 'quotes', placeholder: SEARCH_PLACEHOLDERS.QUOTES });
    return () => setPageSearchConfig(null);
  }, [setPageSearchConfig]);

  // Handle ?add=1 query param from quick actions
  useEffect(() => {
    if (searchParams.get('add') === '1') {
      setEditingQuote(null);
      form.reset({
        customerId: '',
        title: '',
        description: '',
        status: 'draft',
        validUntil: null,
        notes: '',
        items: [{ description: '', quantity: 1, unitPrice: 0, discountAmount: 0 }],
      });
      setQuoteModalVisible(true);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('add');
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams, form]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, [searchValue]);

  useEffect(() => {
    fetchQuotes();
  }, [pagination.current, pagination.pageSize, filters, debouncedSearch]);

  const fetchQuotes = async (isRefresh = false) => {
    if (isRefresh) setRefreshingQuotes(true);
    else setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize, // Backend pagination
        _ts: Date.now(),
      };

      if (filters.status && filters.status !== 'all') {
        params.status = filters.status;
      }
      if (filters.customerId && filters.customerId !== 'all') {
        params.customerId = filters.customerId;
      }
      if (debouncedSearch) params.search = debouncedSearch;

      const response = await quoteService.getAll(params);
      const quoteList = Array.isArray(response?.data) ? response.data : [];

      setQuotes(quoteList);
    } catch (error) {
      console.error('Failed to load quotes:', error);
      showError(error, 'Failed to load quotes');
      setQuotes([]);
    } finally {
      if (isRefresh) setRefreshingQuotes(false);
      else setLoading(false);
    }
  };

  // Apply client-side filtering
  const filteredQuotes = useMemo(() => {
    return quotes; // Backend already filters by status and customerId
  }, [quotes, filters]);

  // Paginate filtered quotes
  const paginatedQuotes = useMemo(() => {
    const start = (pagination.current - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return filteredQuotes.slice(start, end);
  }, [filteredQuotes, pagination.current, pagination.pageSize]);

  const quotesCount = filteredQuotes.length;

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const totalQuotes = quotes.length;
    const draftQuotes = quotes.filter(q => q.status === 'draft').length;
    const sentQuotes = quotes.filter(q => q.status === 'sent').length;
    const acceptedQuotes = quotes.filter(q => q.status === 'accepted').length;
    
    return {
      totals: {
        totalQuotes,
        draftQuotes,
        sentQuotes,
        acceptedQuotes
      }
    };
  }, [quotes]);

  const fetchQuoteDetails = async (quoteId) => {
    try {
      const response = await quoteService.getById(quoteId);
      const data = response?.data ?? response;
      setViewingQuote((prev) => (prev?.id === quoteId ? data : prev));
      try {
        setLoadingActivities(true);
        const activitiesResponse = await quoteService.getActivities(quoteId);
        const activitiesData = activitiesResponse?.data ?? activitiesResponse;
        setQuoteActivities(Array.isArray(activitiesData) ? activitiesData : []);
      } catch (activityError) {
        console.error('Failed to fetch quote activities:', activityError);
        setQuoteActivities([]);
      } finally {
        setLoadingActivities(false);
      }
      // Return full quote details so callers (e.g. edit flow) can use them
      return data;
    } catch (error) {
      console.error(`Failed to fetch quote ${quoteId}:`, error);
      showError(error, 'Failed to fetch quote details');
      return null;
    }
  };

  const handleView = (quote) => {
    setViewingQuote(quote);
    setDrawerVisible(true);
    fetchQuoteDetails(quote.id);
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setViewingQuote(null);
  };

  const handleAddQuote = async () => {
    form.reset({
      customerId: '',
      title: '',
      description: '',
      status: 'draft',
      validUntil: null,
      notes: '',
      items: [{ description: '', quantity: 1, unitPrice: 0, discountAmount: 0 }],
    });
    setEditingQuote(null);
    setQuoteModalVisible(true);
    try {
      const customersResponse = await customerService.getAll({ limit: 100 });
      setCustomers(customersResponse.data || []);
    } catch (error) {
      console.error('Failed to load customers for new quote:', error);
      showError(error, 'Failed to load customers');
    }
  };

  const handleEditQuote = async (quote) => {
    setEditingQuote(quote);
    const details = await fetchQuoteDetails(quote.id);
    if (!details) {
      return;
    }
    try {
      const customersResponse = await customerService.getAll({ limit: 100 });
      setCustomers(customersResponse.data || []);
    } catch (error) {
      console.error('Failed to load customers for quote editing:', error);
      showError(error, 'Failed to load customers');
    }

    form.reset({
      // Prefer explicit customerId from API; fall back to nested customer.id
      customerId: details.customerId || details.customer?.id || '',
      title: details.title,
      description: details.description || '',
      status: details.status,
      validUntil: details.validUntil ? new Date(details.validUntil) : null,
      notes: details.notes || '',
      items: (details.items || []).map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice),
        discountAmount: parseFloat(item.discountAmount || 0)
      }))
    });
    setQuoteModalVisible(true);
  };

  const handleDeleteQuote = async (quote) => {
    setDeleteQuoteId(quote.id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteQuoteId) return;
    try {
      await quoteService.delete(deleteQuoteId);
      showSuccess('Quote deleted successfully');
      fetchQuotes();
      if (viewingQuote?.id === deleteQuoteId) {
        handleCloseDrawer();
      }
      setDeleteDialogOpen(false);
      setDeleteQuoteId(null);
    } catch (error) {
      showError(error, error.error || 'Failed to delete quote');
    }
  };

  const onSubmit = async (values) => {
    const payload = {
      customerId: values.customerId,
      title: values.title,
      description: values.description,
      status: values.status,
      validUntil: values.validUntil ? dayjs(values.validUntil).format('YYYY-MM-DD') : null,
      notes: values.notes,
      items: (values.items || []).map((item) => ({
        description: item.description,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        discountAmount: Number(item.discountAmount || 0)
      }))
    };

    try {
      if (editingQuote) {
        await quoteService.update(editingQuote.id, payload);
        showSuccess('Quote updated successfully');
      } else {
        await quoteService.create(payload);
        showSuccess('Quote created successfully');
      }
      setQuoteModalVisible(false);
      form.reset();
      fetchQuotes();
    } catch (error) {
      console.error('Failed to save quote:', error);
      showError(error, error.error || 'Failed to save quote');
    }
  };

  const { activeTenant } = useAuth();
  const businessType = activeTenant?.businessType || 'printing_press';
  const isShop = businessType === 'shop';

  const handleConvertToJob = async (quote) => {
    setConverting(true);
    try {
      const response = await quoteService.convertToJob(quote.id);
      const data = response?.data ?? response;
      const job = data?.data?.job ?? data?.job ?? data;
      showSuccess(`Quote converted to job ${job?.jobNumber || ''}`.trim());
      fetchQuotes();
      if (job) {
        navigate('/jobs');
      }
    } catch (error) {
      console.error('Failed to convert quote to job:', error);
      showError(error, error.error || 'Failed to convert quote to job');
    } finally {
      setConverting(false);
    }
  };

  const handleConvertToSale = async (quote) => {
    setConverting(true);
    try {
      const response = await quoteService.convertToSale(quote.id, 'credit');
      const data = response?.data ?? response;
      const sale = data?.data?.sale ?? data?.sale ?? data;
      showSuccess(`Quote converted to sale ${sale?.saleNumber || ''}`.trim());
      fetchQuotes();
      if (sale) {
        navigate('/sales');
      }
    } catch (error) {
      console.error('Failed to convert quote to sale:', error);
      showError(error, error.error || 'Failed to convert quote to sale');
    } finally {
      setConverting(false);
    }
  };

  const openPrintableQuote = (quote, { autoDownload = false } = {}) => {
    setQuotePrintable(quote);
    setPrintModalVisible(true);
    if (autoDownload) {
      setPendingDownload(true);
    }
  };

  const closePrintableQuote = () => {
    setPrintModalVisible(false);
    setQuotePrintable(null);
    setPendingDownload(false);
  };

  const handleDownloadQuote = useCallback(async (quote, { silent = false } = {}) => {
    const target = quote || quotePrintable;
    if (!target) return;
    try {
      const element = document.querySelector('.printable-invoice');
      if (!element) {
        if (!silent) {
          showError(null, 'Preview the quote before downloading');
        }
        return;
      }
      await generatePDF(element, {
        filename: `Quote-${target.quoteNumber}.pdf`,
        format: 'a4',
        orientation: 'portrait',
      });
      if (!silent) {
        showSuccess('Quote PDF downloaded successfully');
      }
    } catch (error) {
      console.error('Error generating quote PDF:', error);
      if (!silent) {
        showError(error, 'Failed to download quote');
      }
    } finally {
      setPendingDownload(false);
    }
  }, [quotePrintable]);

  const handlePrintQuote = () => {
    if (!quotePrintable) return;
    const wrapper = document.querySelector('.printable-invoice')?.parentElement;
    if (wrapper) {
      openPrintDialog(wrapper, `Quote-${quotePrintable.quoteNumber}`);
    }
  };

  useEffect(() => {
    if (printModalVisible && pendingDownload && quotePrintable) {
      const timer = setTimeout(() => {
        handleDownloadQuote(quotePrintable, { silent: true });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [printModalVisible, pendingDownload, quotePrintable, handleDownloadQuote]);

  // Table columns for DashboardTable
  const tableColumns = useMemo(() => [
    {
      key: 'quoteNumber',
      label: 'Quote #',
      render: (_, record) => <span className="font-medium text-foreground">{record?.quoteNumber || '—'}</span>
    },
    {
      key: 'title',
      label: 'Title',
      render: (_, record) => <span className="text-foreground">{record?.title || '—'}</span>
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (_, record) => <span className="text-foreground">{record?.customer?.name || '—'}</span>
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, record) => <StatusChip status={record?.status} />
    },
    {
      key: 'validUntil',
      label: 'Valid Until',
      render: (_, record) => <span className="text-foreground">{record?.validUntil ? dayjs(record.validUntil).format('MMM DD, YYYY') : '—'}</span>
    },
    {
      key: 'totalAmount',
      label: 'Total',
      render: (_, record) => <span className="text-foreground font-medium">₵ {parseFloat(record?.totalAmount || 0).toFixed(2)}</span>
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, record) => (
        <ActionColumn
          record={record}
          onView={handleView}
          extraActions={[
            record.status !== 'accepted' && record.status !== 'declined' && record.status !== 'expired' && !isShop && {
              key: 'convert-job',
              label: 'Convert to Job',
              variant: 'default',
              icon: <FilePlus className="h-4 w-4" />,
              onClick: () => handleConvertToJob(record),
              disabled: converting
            },
            record.status !== 'accepted' && record.status !== 'declined' && record.status !== 'expired' && isShop && {
              key: 'convert-sale',
              label: 'Convert to Sale',
              variant: 'default',
              icon: <FilePlus className="h-4 w-4" />,
              onClick: () => handleConvertToSale(record),
              disabled: converting
            },
            {
              key: 'edit',
              label: 'Edit',
              variant: 'secondary',
              icon: <FileText className="h-4 w-4" />,
              onClick: () => handleEditQuote(record)
            }
          ].filter(Boolean)}
        />
      )
    }
  ], [converting, handleView, handleConvertToJob, handleConvertToSale, handleEditQuote, isShop]);

  const handleClearFilters = () => {
    setFilters({
      status: 'all',
      customerId: 'all'
    });
    setPagination({ ...pagination, current: 1 });
  };

  const hasActiveFilters = filters.status !== 'all' || filters.customerId !== 'all';

  const drawerFields = useMemo(() => viewingQuote ? [
    { label: 'Quote Number', value: viewingQuote.quoteNumber },
    { label: 'Title', value: viewingQuote.title },
    {
      label: 'Customer',
      value: (
        <div>
          <div>{viewingQuote.customer?.name}</div>
          {viewingQuote.customer?.company && (
            <div className="text-muted-foreground text-sm">{viewingQuote.customer.company}</div>
          )}
        </div>
      )
    },
    {
      label: 'Status',
      value: (
        <StatusChip status={viewingQuote.status} />
      )
    },
    {
      label: 'Valid Until',
      value: viewingQuote.validUntil ? dayjs(viewingQuote.validUntil).format('MMM DD, YYYY') : '—'
    },
    {
      label: 'Total Amount',
      value: (
        <strong className="text-lg text-primary">
          ₵ {parseFloat(viewingQuote.totalAmount || 0).toFixed(2)}
        </strong>
      )
    },
    {
      label: 'Created By',
      value: viewingQuote.creator
        ? `${viewingQuote.creator.name} (${viewingQuote.creator.email})`
        : 'System'
    },
    viewingQuote.description && { label: 'Description', value: viewingQuote.description },
    viewingQuote.notes && { label: 'Notes', value: viewingQuote.notes }
  ].filter(Boolean) : [], [viewingQuote]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <WelcomeSection
          welcomeMessage="Quotes"
          subText="Create and manage quotes for your customers."
        />
        <div className="flex items-center gap-2">
          <ViewToggle value={tableViewMode} onChange={setTableViewMode} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={() => setFilterDrawerOpen(true)} size={isMobile ? "icon" : "default"}>
                <Filter className="h-4 w-4" />
                {!isMobile && <span className="ml-2">Filter</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Filter quotes by status or customer</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                onClick={() => fetchQuotes(true)}
                disabled={refreshingQuotes}
                size={isMobile ? "icon" : "default"}
              >
                {refreshingQuotes ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh quotes list</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleAddQuote} size={isMobile ? "icon" : "default"}>
                <Plus className="h-4 w-4" />
                {!isMobile && <span className="ml-2">New Quote</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Create a new quote</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
        {/* Total Quotes Card */}
        <DashboardStatsCard
          tooltip="Total number of quotes created"
          title="Total Quotes"
          value={summaryStats?.totals?.totalQuotes || 0}
          icon={FileText}
          iconBgColor="rgba(22, 101, 52, 0.1)"
          iconColor="#166534"
        />

        {/* Draft Card */}
        <DashboardStatsCard
          tooltip="Quotes that are still in draft"
          title="Draft"
          value={summaryStats?.totals?.draftQuotes || 0}
          icon={FilePlus}
          iconBgColor="rgba(59, 130, 246, 0.1)"
          iconColor="#166534"
        />

        {/* Sent Card */}
        <DashboardStatsCard
          tooltip="Quotes sent to customers"
          title="Sent"
          value={summaryStats?.totals?.sentQuotes || 0}
          icon={CheckCircle}
          iconBgColor="rgba(132, 204, 22, 0.1)"
          iconColor="#84cc16"
        />

        {/* Accepted Card */}
        <DashboardStatsCard
          tooltip="Quotes accepted by customers"
          title="Accepted"
          value={summaryStats?.totals?.acceptedQuotes || 0}
          icon={Receipt}
          iconBgColor="rgba(132, 204, 22, 0.1)"
          iconColor="#84cc16"
        />
      </div>

      {/* Main Content Area */}
      <DashboardTable
        data={paginatedQuotes}
        columns={tableColumns}
        loading={loading}
        title={null}
        emptyIcon={<FileText className="h-12 w-12 text-muted-foreground" />}
        emptyDescription="No quotes yet. Create quotes to send pricing estimates to customers."
        emptyAction={
          <Button onClick={handleAddQuote}>
            <Plus className="h-4 w-4 mr-2" />
            Create First Quote
          </Button>
        }
        pageSize={pagination.pageSize}
        onPageChange={(newPagination) => {
          setPagination(newPagination);
        }}
        externalPagination={{
          current: pagination.current,
          total: quotesCount
        }}
        viewMode={tableViewMode}
        onViewModeChange={setTableViewMode}
      />

      {/* Filter Drawer */}
      <Sheet open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
        <SheetContent side="right" className="w-full sm:w-[400px] md:w-[540px] overflow-y-auto" style={{ top: 8, bottom: 8, right: 8, height: 'calc(100vh - 16px)', borderRadius: 8 }}>
          <SheetHeader className="pb-4 border-b">
            <SheetTitle>Filter Quotes</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 md:space-y-6 mt-4 md:mt-6">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({ ...filters, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statusOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Customer</Label>
              <Select
                value={filters.customerId}
                onValueChange={(value) => setFilters({ ...filters, customerId: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
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
        title="Quote Details"
        width={720}
        onPrint={viewingQuote ? () => openPrintableQuote(viewingQuote) : null}
        onEdit={viewingQuote ? () => handleEditQuote(viewingQuote) : null}
        onDelete={viewingQuote ? () => handleDeleteQuote(viewingQuote) : null}
        deleteConfirmTitle="Delete this quote?"
        deleteConfirmText="This can't be undone."
        deleteButtonLabel="Delete"
        extraActions={viewingQuote && viewingQuote.status !== 'accepted' && viewingQuote.status !== 'declined' && viewingQuote.status !== 'expired' ? [
          !isShop && {
            key: 'convert-job',
            label: 'Convert to Job',
            variant: 'default',
            icon: <FilePlus className="h-4 w-4" />,
            onClick: () => handleConvertToJob(viewingQuote),
            disabled: converting
          },
          isShop && {
            key: 'convert-sale',
            label: 'Convert to Sale',
            variant: 'default',
            icon: <FilePlus className="h-4 w-4" />,
            onClick: () => handleConvertToSale(viewingQuote),
            disabled: converting
          }
        ].filter(Boolean) : []}
        tabs={viewingQuote ? [
          {
            key: 'details',
            label: 'Summary',
            content: (
              <div className="space-y-6">
                <DrawerSectionCard title="Quote summary">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <div className="text-lg font-semibold text-foreground">{viewingQuote.title}</div>
                      <div className="text-muted-foreground text-sm">{viewingQuote.quoteNumber}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Total Amount</div>
                      <div className="text-2xl font-bold text-primary">
                        ₵ {parseFloat(viewingQuote.totalAmount || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <Descriptions column={1} className="space-y-0">
                    {drawerFields.map((field) => (
                      <DescriptionItem key={field.label} label={field.label}>
                        {field.value || '—'}
                      </DescriptionItem>
                    ))}
                  </Descriptions>
                </DrawerSectionCard>
              </div>
            )
          },
          {
            key: 'items',
            label: 'Line Items',
            content: (
              <DrawerSectionCard title="Line items">
                {(viewingQuote.items || []).length ? (
                  <div className="space-y-0">
                    <div className="grid grid-cols-12 gap-2 pb-2 border-b border-gray-200 text-sm font-semibold text-foreground">
                      <div className="col-span-6">Description</div>
                      <div className="col-span-2 text-right">Qty</div>
                      <div className="col-span-2 text-right">Unit price (₵)</div>
                      <div className="col-span-2 text-right">Total (₵)</div>
                    </div>
                    {viewingQuote.items.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-12 gap-2 py-3 border-b border-gray-200/80 last:border-b-0 text-sm"
                      >
                        <div className="col-span-6">
                          <div className="font-medium text-foreground">{item.description}</div>
                          {item.metadata && Object.keys(item.metadata || {}).length > 0 && (
                            <div className="text-muted-foreground text-xs mt-0.5">
                              {JSON.stringify(item.metadata)}
                            </div>
                          )}
                        </div>
                        <div className="col-span-2 text-right text-gray-700">{item.quantity}</div>
                        <div className="col-span-2 text-right text-gray-700">{parseFloat(item.unitPrice || 0).toFixed(2)}</div>
                        <div className="col-span-2 text-right font-medium text-foreground">{parseFloat(item.total || 0).toFixed(2)}</div>
                      </div>
                    ))}
                    <div className="pt-3 mt-2 border-t border-gray-200 space-y-1 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span className="text-foreground font-medium">₵ {parseFloat(viewingQuote.subtotal || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Total Discount</span>
                        <span className="text-foreground">-₵ {parseFloat(viewingQuote.discountTotal || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-base font-semibold text-foreground pt-2">
                        <span>Grand Total</span>
                        <span>₵ {parseFloat(viewingQuote.totalAmount || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>No line items found for this quote.</AlertDescription>
                  </Alert>
                )}
              </DrawerSectionCard>
            )
          },
          {
            key: 'activities',
            label: 'Activity',
            content: (() => {
              const activities = quoteActivities || [];
              
              const creationActivity = viewingQuote ? {
                id: 'creation',
                type: 'creation',
                createdAt: viewingQuote.createdAt,
                createdByUser: viewingQuote.creator || null
              } : null;
              
              const allActivities = creationActivity ? [creationActivity, ...activities] : activities;
              
              if (loadingActivities) {
                return (
                  <DrawerSectionCard title="Activity">
                    <div className="text-center py-8 text-muted-foreground text-sm">Loading activities...</div>
                  </DrawerSectionCard>
                );
              }
              
              if (allActivities.length === 0) {
                return (
                  <DrawerSectionCard title="Activity">
                    <Alert>
                      <AlertTitle>No activity logged yet.</AlertTitle>
                    </Alert>
                  </DrawerSectionCard>
                );
              }
              
              const timelineItems = allActivities.map((activity, index) => {
                const isLast = index === allActivities.length - 1;
                
                if (activity.type === 'creation') {
                  return (
                    <TimelineItem key={activity.id} isLast={isLast}>
                      <TimelineIndicator />
                      <TimelineContent>
                        <TimelineTitle className="text-foreground">
                          {activity.createdByUser 
                            ? `${activity.createdByUser.name} created quote ${viewingQuote.quoteNumber}`
                            : `Quote ${viewingQuote.quoteNumber} created`}
                        </TimelineTitle>
                        <TimelineTime className="text-foreground">
                          {dayjs(activity.createdAt).format('MMM DD, YYYY [at] h:mm A')}
                        </TimelineTime>
                      </TimelineContent>
                    </TimelineItem>
                  );
                }
                
                const activityTypeLabels = {
                  note: 'Note',
                  status_change: 'Status Changed',
                  conversion: 'Conversion'
                };
                
                return (
                  <TimelineItem key={activity.id} isLast={isLast}>
                    <TimelineIndicator />
                    <TimelineContent>
                      <TimelineTitle className="text-foreground">
                        {activityTypeLabels[activity.type] || activity.type.toUpperCase()} {activity.subject ? `- ${activity.subject}` : ''}
                      </TimelineTitle>
                      <TimelineTime className="text-foreground">
                        {dayjs(activity.createdAt).format('MMM DD, YYYY [at] h:mm A')}
                        {activity.createdByUser ? ` • ${activity.createdByUser.name}` : ''}
                      </TimelineTime>
                      {activity.notes && (
                        <TimelineDescription className="text-foreground">{activity.notes}</TimelineDescription>
                      )}
                      {activity.metadata?.oldStatus && activity.metadata?.newStatus && (
                        <TimelineDescription className="text-foreground">
                          Status: {activity.metadata.oldStatus} → {activity.metadata.newStatus}
                        </TimelineDescription>
                      )}
                      {activity.metadata?.jobNumber && (
                        <TimelineDescription className="text-foreground">
                          Converted to job: {activity.metadata.jobNumber}
                        </TimelineDescription>
                      )}
                      {activity.metadata?.saleNumber && (
                        <TimelineDescription className="text-foreground">
                          Converted to sale: {activity.metadata.saleNumber}
                        </TimelineDescription>
                      )}
                    </TimelineContent>
                  </TimelineItem>
                );
              });
              
              return (
                <DrawerSectionCard title="Activity">
                  <Timeline>
                    {timelineItems}
                  </Timeline>
                </DrawerSectionCard>
              );
            })()
          }
        ] : []}
      />

      <MobileFormDialog
        open={quoteModalVisible}
        onOpenChange={setQuoteModalVisible}
        title={editingQuote ? `Edit Quote (${editingQuote.quoteNumber})` : 'Create Quote'}
        description={editingQuote ? 'Update quote details' : 'Create a new quote for a customer'}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQuoteModalVisible(false);
                setEditingQuote(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" form="quote-form" loading={form.formState.isSubmitting}>
              {editingQuote ? 'Update Quote' : 'Create Quote'}
            </Button>
          </>
        }
        className="sm:w-[var(--modal-w-2xl)]"
      >
        <Form {...form}>
          <form id="quote-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormFieldGrid columns={2}>
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name} {customer.company ? `(${customer.company})` : ''}
                          </SelectItem>
                        ))}
                        <SelectSeparator className="my-2" />
                        <div className="px-2 py-1.5" onPointerDown={(e) => e.preventDefault()}>
                          <Button type="button" variant="ghost" className="w-full justify-start" onClick={() => setCustomerAddModalOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create customer
                          </Button>
                        </div>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormFieldGrid>

            <FormFieldGrid columns={2}>
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quote Title</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Quote title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="validUntil"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valid Until (optional)</FormLabel>
                      <FormControl>
                        <DatePicker
                          date={field.value}
                          onSelect={(date) => field.onChange(date)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                    )}
                  />
            </FormFieldGrid>

            <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} placeholder="Describe the work or specifications" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-2 pb-1">
                <Separator className="mb-3" />
                <div className="text-sm font-medium text-muted-foreground">Quote Items</div>
              </div>

              {fields.map((field, index) => (
                <Card key={field.id}>
                  <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <CardTitle className="text-base">Item {index + 1}</CardTitle>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Item description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-3 gap-2 md:gap-4">
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                value={field.value || ''}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 1;
                                  field.onChange(value);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.unitPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit Price</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">GHS</span>
                                <Input
                                  type="number"
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
                        control={form.control}
                        name={`items.${index}.discountAmount`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Discount (optional)</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">GHS</span>
                                <Input
                                  type="number"
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
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button
                type="button"
                variant="dashed"
                onClick={() => append({ description: '', quantity: 1, unitPrice: 0, discountAmount: 0 })}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} placeholder="Notes for internal reference" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

          </form>
        </Form>
      </MobileFormDialog>

      <Dialog open={printModalVisible} onOpenChange={setPrintModalVisible}>
        <DialogContent className="!inset-0 !translate-x-0 !translate-y-0 !max-w-none w-screen h-screen flex flex-col p-0 !rounded-none">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0 no-print">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Quote Preview</DialogTitle>
                <DialogDescription>
                  Review the quote before printing or downloading
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadQuote(quotePrintable)}
                  disabled={!quotePrintable}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  size="sm"
                  onClick={handlePrintQuote}
                  disabled={!quotePrintable}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto bg-muted/50 p-4 md:p-8 print-content-wrapper">
            <div className="max-w-[850px] mx-auto bg-card rounded-lg border border-border">
              {quotePrintable && (
                <PrintableInvoice
                  invoice={buildPrintableQuote(quotePrintable)}
                  documentTitle="PROFORMA INVOICE"
                  documentSubtitle={`Quote ${quotePrintable.quoteNumber}`}
                  organization={organization}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={customerAddModalOpen} onOpenChange={(open) => {
        if (!open) { setCustomerAddModalOpen(false); customerForm.reset({ name: '', company: '', email: '', phone: '' }); }
      }}>
        <DialogContent>
          <Form {...customerForm}>
            <form onSubmit={customerForm.handleSubmit(handleAddCustomerSubmit)} className="flex flex-col min-h-0 flex-1">
              <DialogHeader>
                <DialogTitle>Create Customer</DialogTitle>
                <DialogDescription>Add a new customer without leaving the form.</DialogDescription>
              </DialogHeader>
              <DialogBody>
                <div className="space-y-4">
                  <FormField
                    control={customerForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g. John Doe" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={customerForm.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Company name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={customerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (optional)</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} placeholder="email@example.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={customerForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Phone number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setCustomerAddModalOpen(false); customerForm.reset({ name: '', company: '', email: '', phone: '' }); }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addingCustomer}>
                  {addingCustomer ? 'Creating...' : 'Create Customer'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quote</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this quote? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Quotes;
