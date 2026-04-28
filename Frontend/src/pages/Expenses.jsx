import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
// Removed Ant Design imports - using shadcn/ui only
import {
  Plus,
  Pencil,
  Upload as UploadIcon,
  Currency,
  Eye,
  ShoppingCart,
  FileText,
  Send,
  CheckCircle,
  XCircle,
  MinusCircle,
  Loader2,
  Filter,
  RefreshCw,
  Receipt,
  Archive
} from 'lucide-react';
import dayjs from 'dayjs';
import expenseService from '../services/expenseService';
import jobService from '../services/jobService';
import vendorService from '../services/vendorService';
import { useAuth } from '../context/AuthContext';
import { STUDIO_LIKE_TYPES } from '../constants';
import { useResponsive } from '../hooks/useResponsive';
import { showSuccess, showError, showWarning } from '../utils/toast';
import { resolveImageUrl } from '../utils/fileUtils';
import { numberInputValue, handleNumberChange, numberOrEmptySchema } from '../utils/formUtils';
import DetailsDrawer from '../components/DetailsDrawer';
import DrawerSectionCard from '../components/DrawerSectionCard';
import TableSkeleton from '../components/TableSkeleton';
import StatusChip from '../components/StatusChip';
import DashboardTable from '../components/DashboardTable';
import ViewToggle from '../components/ViewToggle';
import DashboardStatsCard from '../components/DashboardStatsCard';
import WelcomeSection from '../components/WelcomeSection';
import { Button } from '@/components/ui/button';
import { SecondaryButton } from '@/components/ui/secondary-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
import FileUpload from '../components/FileUpload';
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
import { Timeline, TimelineItem, TimelineIndicator, TimelineContent, TimelineTitle, TimelineDescription, TimelineTime } from '@/components/ui/timeline';

// Coerce optional string fields from null/undefined to '' so form validation passes (Select "None" and API nulls)
const optionalString = () => z.union([z.string(), z.null(), z.undefined()]).transform(v => v ?? '');

const baseExpenseSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  amount: numberOrEmptySchema(z).refine((v) => v >= 0.01, 'Amount must be greater than 0'),
  expenseDate: z.date({ required_error: 'Expense date is required' }),
  description: optionalString(),
  vendorId: z.string().optional().nullable(),
  paymentMethod: optionalString(),
  status: optionalString(),
  receiptUrl: optionalString(),
  notes: optionalString(),
});

const expenseSchema = baseExpenseSchema.extend({
  jobId: z.string().optional().nullable(),
});

const multipleExpenseItemSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  amount: numberOrEmptySchema(z).refine((v) => v >= 0.01, 'Amount must be greater than 0'),
  description: z.string().optional(),
  jobId: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  paymentMethod: z.string().optional(),
  status: z.string().optional(),
  receiptUrl: z.string().optional(),
  notes: z.string().optional(),
});

const quickVendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  company: z.string().optional(),
  phone: z.string().optional()
});

const multipleExpenseSchema = z.object({
  expenseDate: z.date({ required_error: 'Expense date is required' }),
  expenses: z.array(multipleExpenseItemSchema).min(1, 'At least one expense is required'),
});

const rejectionSchema = z.object({
  rejectionReason: z.string().min(1, 'Rejection reason is required'),
});

// Sentinel for optional Select "None" option (Radix Select forbids value="")
const SELECT_NONE_VALUE = '__none__';

const Expenses = () => {
  const { isAdmin, activeTenant, activeTenantId } = useAuth();
  const { isMobile } = useResponsive();
  const businessType = activeTenant?.businessType || 'printing_press';
  const isPrintingPress = businessType === 'printing_press';
  const isStudioLike = STUDIO_LIKE_TYPES.includes(businessType);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [submittingForApproval, setSubmittingForApproval] = useState(false);
  const [approvingExpense, setApprovingExpense] = useState(false);
  const [rejectingExpense, setRejectingExpense] = useState(null);
  const [rejectingExpenseLoading, setRejectingExpenseLoading] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(null);
  const [archivingExpense, setArchivingExpense] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [multipleMode, setMultipleMode] = useState(false);
  const [isExpenseRequest, setIsExpenseRequest] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [stats, setStats] = useState(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // Clear vendor and job lists when tenant changes so we don't show another tenant's data
  useEffect(() => {
    setVendors([]);
    setJobs([]);
  }, [activeTenantId]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    category: 'all',
    status: 'all',
    jobId: 'all',
    viewType: 'all'
  });
  const [tableViewMode, setTableViewMode] = useState('table');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [removingCategoryName, setRemovingCategoryName] = useState(null);

  const form = useForm({
    resolver: zodResolver(multipleMode ? multipleExpenseSchema : expenseSchema),
    defaultValues: multipleMode ? {
      expenseDate: new Date(),
      expenses: [{ category: '', amount: 0, description: '' }],
    } : {
      category: '',
      amount: 0,
      expenseDate: new Date(),
      description: '',
    },
  });

  const { fields: expenseFields, append: appendExpense, remove: removeExpense } = useFieldArray({
    control: form.control,
    name: 'expenses',
  });

  const rejectionForm = useForm({
    resolver: zodResolver(rejectionSchema),
    defaultValues: {
      rejectionReason: '',
    },
  });

  const [vendorAddModalOpen, setVendorAddModalOpen] = useState(false);
  const [addingVendor, setAddingVendor] = useState(false);
  const vendorForm = useForm({
    resolver: zodResolver(quickVendorSchema),
    defaultValues: { name: '', company: '', phone: '' },
  });

  /** Controlled so SelectContent closes when opening the nested Create Vendor dialog (Radix keeps it open otherwise). */
  const [vendorSelectBatchOpen, setVendorSelectBatchOpen] = useState(false);
  const [vendorSelectSingleOpen, setVendorSelectSingleOpen] = useState(false);
  const [vendorSelectRowOpen, setVendorSelectRowOpen] = useState(null);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingExpense, setViewingExpense] = useState(null);
  const [expenseActivities, setExpenseActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!modalVisible) {
      setVendorSelectBatchOpen(false);
      setVendorSelectSingleOpen(false);
      setVendorSelectRowOpen(null);
    }
  }, [modalVisible]);

  // Fetch expense categories (business-type, shop-type, and custom)
  const { data: expenseCategoriesResponse } = useQuery({
    queryKey: ['expenses', 'categories', activeTenantId],
    queryFn: () => expenseService.getCategories(),
    enabled: !!activeTenantId,
    staleTime: 5 * 60 * 1000,
  });
  const categoriesFromApi = Array.isArray(expenseCategoriesResponse) ? expenseCategoriesResponse : (expenseCategoriesResponse?.data ?? []);
  const customCategoriesFromApi = Array.isArray(expenseCategoriesResponse?.custom) ? expenseCategoriesResponse.custom : (expenseCategoriesResponse?.custom ?? []);

  const invalidateCategories = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['expenses', 'categories', activeTenantId] });
  }, [queryClient, activeTenantId]);

  const addCategoryMutation = useMutation({
    mutationFn: (name) => expenseService.addCustomCategory(name),
    onSuccess: () => {
      invalidateCategories();
      setNewCategoryName('');
      showSuccess('Custom category added');
    },
    onError: (err) => {
      showError(err?.response?.data?.error || err?.message || 'Failed to add category');
    }
  });

  const removeCategoryMutation = useMutation({
    mutationFn: (name) => expenseService.removeCustomCategory(name),
    onSuccess: () => {
      invalidateCategories();
      setRemovingCategoryName(null);
      showSuccess('Custom category removed');
    },
    onError: (err) => {
      setRemovingCategoryName(null);
      showError(err?.response?.data?.error || err?.message || 'Failed to remove category');
    }
  });

  const handleAddCustomCategory = () => {
    const name = newCategoryName.trim();
    if (!name) {
      showWarning('Enter a category name');
      return;
    }
    if (expenseCategories.some(c => c.toLowerCase() === name.toLowerCase())) {
      showWarning('This category already exists');
      return;
    }
    addCategoryMutation.mutate(name);
  };

  const handleRemoveCustomCategory = (name) => {
    setRemovingCategoryName(name);
    removeCategoryMutation.mutate(name);
  };

  // Use React Query for expenses
  const {
    data: expensesResponse,
    isLoading: expensesLoading,
    error: expensesError,
    refetch: refetchExpenses,
    isFetching: expensesRefetching,
  } = useQuery({
    queryKey: ['expenses', activeTenantId, pagination.current, pagination.pageSize, filters],
    queryFn: async () => {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
      };
      if (filters.category !== 'all') params.category = filters.category;
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.jobId !== 'all') params.jobId = filters.jobId;
      if (filters.viewType === 'approved') params.approvalStatus = 'approved';
      if (filters.viewType === 'requests') params.approvalStatus = 'pending_approval';
      if (filters.viewType === 'general' || filters.viewType === 'job-specific') params.viewType = filters.viewType;
      const response = await expenseService.getAll(params);
      return response;
    },
    enabled: !!activeTenantId,
    keepPreviousData: true,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const expenses = useMemo(() => {
    const data = expensesResponse?.data || expensesResponse;
    return Array.isArray(data) ? data : [];
  }, [expensesResponse]);

  const invalidateExpenses = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
  }, [queryClient]);

  useEffect(() => {
    if (!activeTenantId) return;
    if (isPrintingPress) {
      fetchJobs();
    }
    fetchVendors();
    fetchStats();
  }, [activeTenantId, isPrintingPress]);

  useEffect(() => {
    const total = expensesResponse?.count ?? expenses.length;
    setPagination((prev) => (prev.total === total ? prev : { ...prev, total }));
  }, [expensesResponse, expenses.length]);

  useEffect(() => {
    if (expensesError) showError(null, 'Failed to fetch expenses');
  }, [expensesError]);

  // Backend handles filtering via params; use data directly
  const paginatedExpenses = expenses;
  const expensesCount = expensesResponse?.count ?? expenses.length;

  // Use stats from API (accurate totals); fallback to 0
  const summaryStats = useMemo(() => ({
    totals: {
      totalExpenses: stats?.totals?.totalExpenses ?? stats?.totalExpenses ?? 0,
      categoryCount: stats?.totals?.categoryCount ?? stats?.categoryCount ?? 0,
      pendingRequests: stats?.totals?.pendingRequests ?? stats?.pendingRequests ?? 0,
      approvedCount: stats?.totals?.approvedCount ?? stats?.approvedCount ?? 0,
    },
  }), [stats]);

  const fetchJobs = async () => {
    try {
      const response = await jobService.getAll();
      setJobs(response.data || []);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await vendorService.getAll();
      setVendors(response.data || []);
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
    }
  };

  const handleAddVendorSubmit = async (values) => {
    setAddingVendor(true);
    try {
      const response = await vendorService.create({ name: values.name, company: values.company || undefined, phone: values.phone || undefined });
      const newVendor = response?.data ?? response;
      if (!newVendor?.id) throw new Error('Invalid vendor response');
      await fetchVendors();
      setVendorAddModalOpen(false);
      vendorForm.reset({ name: '', company: '', phone: '' });
      showSuccess('Vendor created successfully');
      if (!multipleMode) form.setValue('vendorId', newVendor.id);
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to create vendor');
    } finally {
      setAddingVendor(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await expenseService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleCreate = (isRequest = false) => {
    setEditingExpense(null);
    setMultipleMode(false);
    setIsExpenseRequest(isRequest);
    form.reset({
      category: '',
      amount: 0,
      expenseDate: new Date(),
      description: '',
    });
    setModalVisible(true);
  };

  const loadExpenseActivities = async (expenseId) => {
    if (!expenseId) return;
    try {
      setLoadingActivities(true);
      const response = await expenseService.getActivities(expenseId);
      // API returns { success, data: activities }; axios interceptor returns response.data so we get { success, data }
      const raw = response?.data ?? response;
      const list = Array.isArray(raw) ? raw : (Array.isArray(response?.data?.data) ? response.data.data : []);
      setExpenseActivities(list);
    } catch (err) {
      console.error('Failed to load expense activities:', err);
      setExpenseActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleView = (expense) => {
    setViewingExpense(expense);
    setDrawerVisible(true);
    loadExpenseActivities(expense?.id);
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setViewingExpense(null);
    setExpenseActivities([]);
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setMultipleMode(false);
    setIsExpenseRequest(false);
    form.reset({
      ...expense,
      amount: expense.amount != null ? Number(expense.amount) : 0,
      expenseDate: expense.expenseDate ? dayjs(expense.expenseDate).toDate() : new Date(),
      description: expense.description ?? '',
      paymentMethod: expense.paymentMethod ?? SELECT_NONE_VALUE,
      status: expense.status ?? SELECT_NONE_VALUE,
      receiptUrl: expense.receiptUrl ?? '',
      notes: expense.notes ?? '',
      vendorId: expense.vendorId ?? SELECT_NONE_VALUE,
      jobId: expense.jobId ?? SELECT_NONE_VALUE,
    });
    setModalVisible(true);
    if (drawerVisible) {
      setDrawerVisible(false);
    }
  };

  const handleArchive = async (expense) => {
    try {
      setArchivingExpense(expense.id);
      await expenseService.archive(expense.id);
      showSuccess('Expense archived successfully');
      invalidateExpenses();
      fetchStats();
      if (drawerVisible && viewingExpense?.id === expense.id) {
        setDrawerVisible(false);
        setViewingExpense(null);
      }
    } catch (error) {
      showError(null, 'Failed to archive expense');
    } finally {
      setArchivingExpense(null);
    }
  };

  const onSubmit = async (values) => {
    try {
      setSubmittingExpense(true);

      if (editingExpense) {
        // Single expense update – normalize optional strings and Select sentinels for API
        const expenseData = {
          category: values.category,
          amount: Number(values.amount),
          expenseDate: values.expenseDate ? dayjs(values.expenseDate).format('YYYY-MM-DD') : null,
          description: values.description ?? '',
          paymentMethod: values.paymentMethod && values.paymentMethod !== SELECT_NONE_VALUE ? values.paymentMethod : null,
          status: values.status && values.status !== SELECT_NONE_VALUE ? values.status : null,
          vendorId: values.vendorId && values.vendorId !== SELECT_NONE_VALUE ? values.vendorId : null,
          jobId: values.jobId && values.jobId !== SELECT_NONE_VALUE ? values.jobId : null,
          receiptUrl: values.receiptUrl ?? '',
          notes: values.notes ?? '',
        };
        await expenseService.update(editingExpense.id, expenseData);
        showSuccess('Expense updated successfully');
        setModalVisible(false);
        setEditingExpense(null);
        invalidateExpenses();
        fetchStats();
        // Refetch details and activities when the drawer is open for this expense so "Expense Updated" shows
        if (drawerVisible && viewingExpense?.id === editingExpense.id) {
          const updated = await expenseService.getById(editingExpense.id);
          setViewingExpense(updated?.data ?? updated);
          await loadExpenseActivities(editingExpense.id);
        }
      } else if (multipleMode && values.expenses && Array.isArray(values.expenses)) {
        // Multiple expenses creation using bulk endpoint
        const expensesToCreate = values.expenses
          .filter(exp => exp.category && exp.amount && exp.description)
          .map(expense => ({
            ...expense,
            expenseDate: expense.expenseDate ? dayjs(expense.expenseDate).format('YYYY-MM-DD') : dayjs(values.expenseDate).format('YYYY-MM-DD')
          }));
        
        if (expensesToCreate.length === 0) {
          showWarning('Please add at least one expense');
          return;
        }

        // Common fields that apply to all expenses
        const commonFields = {
          expenseDate: values.expenseDate ? dayjs(values.expenseDate).format('YYYY-MM-DD') : null,
          jobId: values.jobId || null,
          vendorId: values.vendorId || null,
          paymentMethod: values.paymentMethod || null,
          status: isExpenseRequest ? 'pending' : (values.status || 'paid'),
          approvalStatus: isExpenseRequest ? 'pending_approval' : 'approved',
          notes: values.notes || null
        };

        // Use bulk create endpoint
        const response = await expenseService.createBulk(expensesToCreate, commonFields);
        showSuccess(`Successfully created ${response.data.count || expensesToCreate.length} expense(s)`);
        setModalVisible(false);
        setIsExpenseRequest(false);
        invalidateExpenses();
        fetchStats();
      } else {
        // Single expense creation – normalize payload for API (description required, optional UUIDs as null)
        const expenseData = {
          category: values.category,
          amount: Number(values.amount),
          expenseDate: values.expenseDate ? dayjs(values.expenseDate).format('YYYY-MM-DD') : null,
          description: values.description ?? '',
          vendorId: values.vendorId && values.vendorId !== '' ? values.vendorId : null,
          jobId: values.jobId && values.jobId !== '' && values.jobId !== SELECT_NONE_VALUE ? values.jobId : null,
          paymentMethod: values.paymentMethod && values.paymentMethod !== '' ? values.paymentMethod : null,
          receiptUrl: values.receiptUrl || undefined,
          notes: values.notes || undefined,
        };
        
        if (isExpenseRequest) {
          expenseData.status = 'pending';
          expenseData.approvalStatus = 'pending_approval';
        } else {
          expenseData.status = 'paid';
          expenseData.approvalStatus = 'approved';
        }
        
        await expenseService.create(expenseData);
        showSuccess(isExpenseRequest ? 'Expense request created successfully' : 'Expense created successfully');
        setModalVisible(false);
        setIsExpenseRequest(false);
        invalidateExpenses();
        fetchStats();
      }
    } catch (error) {
      const message = error?.response?.data?.message || error?.response?.data?.error || 'Failed to save expense(s)';
      showError(null, message);
    } finally {
      setSubmittingExpense(false);
    }
  };

  const onReject = async (values) => {
    try {
      setRejectingExpenseLoading(true);
      await expenseService.reject(rejectingExpense.id, { rejectionReason: values.rejectionReason });
      showSuccess('Expense rejected successfully');
      setRejectionModalVisible(false);
      setRejectingExpense(null);
      invalidateExpenses();
    } catch (error) {
      showError(null, 'Failed to reject expense');
    } finally {
      setRejectingExpenseLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setPagination(prev => ({
      ...prev,
      current: 1
    }));
  };

  const handleSubmitForApproval = async (expenseId) => {
    try {
      setSubmittingForApproval(true);
      await expenseService.submit(expenseId);
      showSuccess('Expense submitted for approval');
      invalidateExpenses();
    } catch (error) {
      showError(null, 'Failed to submit expense');
    } finally {
      setSubmittingForApproval(false);
    }
  };

  const handleApprove = async (expenseId) => {
    try {
      setApprovingExpense(true);
      await expenseService.approve(expenseId);
      showSuccess('Expense approved successfully');
      invalidateExpenses();
      fetchStats();
      if (drawerVisible && viewingExpense?.id === expenseId) {
        // Refresh the viewing expense
        const response = await expenseService.getById(expenseId);
        setViewingExpense(response.data || response);
      }
    } catch (error) {
      showError(null, 'Failed to approve expense');
    } finally {
      setApprovingExpense(false);
    }
  };

  const handleMarkPaid = async (expenseId) => {
    try {
      setMarkingPaid(expenseId);
      await expenseService.markPaid(expenseId);
      showSuccess('Expense marked as paid successfully');
      invalidateExpenses();
      fetchStats();
      if (drawerVisible && viewingExpense?.id === expenseId) {
        // Refresh the viewing expense
        const response = await expenseService.getById(expenseId);
        setViewingExpense(response.data || response);
      }
    } catch (error) {
      showError(null, 'Failed to mark expense as paid');
    } finally {
      setMarkingPaid(null);
    }
  };

  const handleRejectClick = (expense) => {
    setRejectingExpense(expense);
    rejectionForm.reset();
    setRejectionModalVisible(true);
  };

  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [expenseToArchive, setExpenseToArchive] = useState(null);

  // Helper function to render table from columns and dataSource
  const renderTable = (columns, dataSource, rowKey = 'id') => {
    const startIndex = (pagination.current - 1) * pagination.pageSize;
    const endIndex = startIndex + pagination.pageSize;
    const paginatedData = dataSource?.slice(startIndex, endIndex) || [];

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key || col.dataIndex} style={{ width: col.width }}>
                  {col.title}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((record) => (
                <TableRow key={record[rowKey]}>
                  {columns.map((col) => {
                    const value = col.dataIndex 
                      ? (Array.isArray(col.dataIndex) 
                          ? col.dataIndex.reduce((obj, key) => obj?.[key], record)
                          : record[col.dataIndex])
                      : null;
                    const renderedValue = col.render ? col.render(value, record) : value;
                    return (
                      <TableCell key={col.key || col.dataIndex}>
                        {renderedValue}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {pagination.total > pagination.pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(endIndex, pagination.total)} of {pagination.total} entries
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination(prev => ({ ...prev, current: prev.current - 1 }))}
                disabled={pagination.current === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination(prev => ({ ...prev, current: prev.current + 1 }))}
                disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };


  // Table columns for DashboardTable
  const tableColumns = useMemo(() => [
    {
      key: 'expenseNumber',
      label: 'Expense #',
      render: (_, record) => <span className="font-medium text-foreground">{record?.expenseNumber || '—'}</span>
    },
    {
      key: 'expenseDate',
      label: 'Date',
      render: (_, record) => <span className="text-foreground">{record?.expenseDate ? dayjs(record.expenseDate).format('MMM DD, YYYY') : '—'}</span>
    },
    {
      key: 'category',
      label: 'Category',
      render: (_, record) => <Badge className="border-transparent bg-brand text-white hover:bg-brand-dark">{record?.category || '—'}</Badge>
    },
    {
      key: 'description',
      label: 'Description',
      render: (_, record) => <span className="text-foreground">{record?.description || '—'}</span>
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (_, record) => <span className="text-foreground font-medium">₵ {parseFloat(record?.amount || 0).toFixed(2)}</span>
    },
    ...(isPrintingPress ? [{
      key: 'job',
      label: 'Job',
      render: (_, record) => (
        record?.job?.jobNumber ? (
          <Badge variant="default">{record.job.jobNumber}</Badge>
        ) : (
          <Badge variant="outline">General</Badge>
        )
      )
    }] : []),
    {
      key: 'vendor',
      label: 'Vendor',
      render: (_, record) => <span className="text-foreground">{record?.vendor?.name || '—'}</span>
    },
    {
      key: 'status',
      label: 'Status',
      mobileDashboardPlacement: 'headerEnd',
      render: (_, record) => <StatusChip status={record?.status} />
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleView(record)}
          >
            <Eye className="h-4 w-4 mr-2" />
            View
          </Button>
        </div>
      )
    }
  ], [isPrintingPress, handleView, handleEdit]);

  // Table columns for Expense Requests tab
  const requestTableColumns = useMemo(() => [
    {
      key: 'expenseNumber',
      label: 'Request #',
      render: (_, record) => <span className="font-medium text-foreground">{record?.expenseNumber || '—'}</span>
    },
    {
      key: 'expenseDate',
      label: 'Date',
      render: (_, record) => <span className="text-foreground">{record?.expenseDate ? dayjs(record.expenseDate).format('MMM DD, YYYY') : '—'}</span>
    },
    {
      key: 'category',
      label: 'Category',
      render: (_, record) => <Badge className="border-transparent bg-brand text-white hover:bg-brand-dark">{record?.category || '—'}</Badge>
    },
    {
      key: 'description',
      label: 'Description',
      render: (_, record) => <span className="text-foreground">{record?.description || '—'}</span>
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (_, record) => <span className="text-foreground font-medium">₵ {parseFloat(record?.amount || 0).toFixed(2)}</span>
    },
    {
      key: 'submitter',
      label: 'Submitted By',
      render: (_, record) => <span className="text-foreground">{record?.submitter?.name || '—'}</span>
    },
    {
      key: 'approvalStatus',
      label: 'Approval Status',
      mobileDashboardPlacement: 'headerEnd',
      render: (_, record) => <StatusChip status={record?.approvalStatus} />
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleView(record)}
          >
            <Eye className="h-4 w-4 mr-2" />
            View
          </Button>
        </div>
      )
    }
  ], [isAdmin, handleView, handleSubmitForApproval, handleApprove, handleRejectClick, handleEdit, submittingForApproval, approvingExpense, rejectingExpenseLoading]);

  // Merge API categories with existing expense categories (for filter dropdown)
  const expenseCategories = useMemo(() => {
    const fromExpenses = new Set((expensesResponse?.data ?? []).map(e => e.category).filter(Boolean));
    const fromApiSet = new Set(Array.isArray(categoriesFromApi) ? categoriesFromApi : []);
    const merged = new Set([...fromApiSet, ...fromExpenses]);
    return Array.from(merged).sort();
  }, [expensesResponse?.data, categoriesFromApi]);

  const paymentMethods = [
    'cash',
    'mobile_money',
    'check',
    'credit_card',
    'bank_transfer',
    'other'
  ];

  const formatPaymentMethod = (method) => {
    const methodMap = {
      'cash': 'Cash',
      'mobile_money': 'Mobile Money',
      'check': 'Check',
      'credit_card': 'Credit Card',
      'bank_transfer': 'Bank Transfer',
      'other': 'Other'
    };
    return methodMap[method] || method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const statusOptions = [
    'pending',
    'paid',
    'overdue'
  ];

  const handleClearFilters = () => {
    setFilters({
      category: 'all',
      status: 'all',
      jobId: 'all',
      viewType: 'all'
    });
    setPagination({ ...pagination, current: 1 });
  };

  const hasActiveFilters = filters.category !== 'all' || filters.status !== 'all' || filters.jobId !== 'all' || filters.viewType !== 'all';

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <WelcomeSection
          welcomeMessage="Expenses"
          subText="Track and manage your business expenses and expense requests."
        />
        <div className="flex items-center gap-2 flex-1 min-w-0 sm:justify-end sm:ml-auto">
          <ViewToggle value={tableViewMode} onChange={setTableViewMode} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={() => setFilterDrawerOpen(true)} size={isMobile ? "icon" : "default"}>
                <Filter className="h-4 w-4" />
                {!isMobile && <span className="ml-2">Filter</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Filter by category, status, or job</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                onClick={async () => { 
                  await refetchExpenses(); 
                  fetchStats(); 
                }}
                disabled={expensesRefetching}
              >
                {expensesRefetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {!isMobile && <span className="ml-2">Refresh</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reload expense list</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <SecondaryButton 
                onClick={() => handleCreate(true)}
              >
                <Plus className="h-4 w-4" />
                {!isMobile && <span className="ml-2">Expense Request</span>}
              </SecondaryButton>
            </TooltipTrigger>
            <TooltipContent>Create an expense request that needs approval</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => handleCreate(false)} className="flex-1 min-w-0 md:flex-none">
                <Plus className="h-4 w-4" />
                <span className="ml-2">Add Expense</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add a new expense (marked as paid and approved)</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Statistics Cards - all-time totals, no date filtering */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <DashboardStatsCard
          tooltip="Total approved expenses recorded"
          title="Total Expenses"
          value={summaryStats?.totals?.totalExpenses || 0}
          icon={ShoppingCart}
          iconBgColor="rgba(239, 68, 68, 0.1)"
          iconColor="#ef4444"
        />
        <DashboardStatsCard
          tooltip="Number of expense categories you use"
          title="Categories"
          value={summaryStats?.totals?.categoryCount || 0}
          icon={FileText}
          iconBgColor="var(--color-primary-light)"
          iconColor="var(--color-primary)"
        />
        <DashboardStatsCard
          tooltip="Expense requests awaiting approval"
          title="Pending Requests"
          value={summaryStats?.totals?.pendingRequests || 0}
          icon={Send}
          iconBgColor="rgba(249, 115, 22, 0.1)"
          iconColor="#f97316"
        />
        <DashboardStatsCard
          tooltip="Expenses that have been approved"
          title="Approved"
          value={summaryStats?.totals?.approvedCount || 0}
          icon={CheckCircle}
          iconBgColor="var(--color-primary-light)"
          iconColor="var(--color-primary)"
        />
      </div>

      {/* DashboardTable already wraps desktop table in Card; no extra Card (avoids double border). */}
      <DashboardTable
        data={paginatedExpenses}
        columns={filters.viewType === 'requests' ? requestTableColumns : tableColumns}
        loading={expensesLoading}
        title={null}
        emptyIcon={
          filters.viewType === 'approved' ? <CheckCircle className="h-12 w-12 text-muted-foreground" /> :
          filters.viewType === 'requests' ? <Send className="h-12 w-12 text-muted-foreground" /> :
          <ShoppingCart className="h-12 w-12 text-muted-foreground" />
        }
        emptyDescription={
          filters.viewType === 'approved' ? 'No approved expenses found' :
          filters.viewType === 'requests' ? 'No expense requests found' :
          filters.viewType === 'job-specific' ? 'No job-specific expenses found' :
          filters.viewType === 'general' ? 'No general expenses found' :
          'No expenses yet. Track your business spending by adding your first expense.'
        }
        emptyAction={
          filters.viewType === 'all' && (
            <Button onClick={() => handleCreate(false)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Expense
            </Button>
          )
        }
        pageSize={pagination.pageSize}
        onPageChange={(newPagination) => {
          setPagination(newPagination);
        }}
        externalPagination={{
          current: pagination.current,
          total: expensesCount
        }}
        viewMode={tableViewMode}
        onViewModeChange={setTableViewMode}
      />

      {/* Filter Drawer */}
      <Sheet open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
        <SheetContent
          side="right"
          className="w-full sm:w-[400px] md:w-[540px] overflow-y-auto"
          style={{ top: 8, bottom: 8, right: 8, height: 'calc(100dvh - 16px)', borderRadius: 8 }}
        >
          <SheetHeader className="pb-4 border-b">
            <SheetTitle>Filter Expenses</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 md:space-y-6 mt-4 md:mt-6">
            <div className="space-y-2">
              <Label className="text-base font-semibold">View Type</Label>
              <Select
                value={filters.viewType || 'all'}
                onValueChange={(value) => {
                  setFilters({ ...filters, viewType: value });
                  setPagination({ ...pagination, current: 1 });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select view type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Expenses</SelectItem>
                  <SelectItem value="approved">Approved Expenses</SelectItem>
                  <SelectItem value="requests">Expense Requests</SelectItem>
                  {isPrintingPress && (
                    <>
                      <SelectItem value="job-specific">Job-Specific Expenses</SelectItem>
                      <SelectItem value="general">General Expenses</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

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
                  {expenseCategories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                  {statusOptions.map(status => (
                    <SelectItem key={status} value={status}>{status.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isPrintingPress && (
              <div className="space-y-2">
                <Label>Job</Label>
                <Select
                  value={filters.jobId}
                  onValueChange={(value) => setFilters({ ...filters, jobId: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Jobs</SelectItem>
                    {jobs.map(job => (
                      <SelectItem key={job.id} value={job.id}>{job.jobNumber} - {job.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {hasActiveFilters && (
              <Button variant="outline" onClick={handleClearFilters} className="w-full">
                Clear Filters
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Manage expense categories dialog */}
      <Dialog open={manageCategoriesOpen} onOpenChange={setManageCategoriesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Expense categories</DialogTitle>
            <DialogDescription>
              Default categories depend on your business and shop type. Add custom categories below; they will appear in the category dropdown when creating expenses.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="New custom category"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomCategory())}
              />
              <Button
                onClick={handleAddCustomCategory}
                disabled={addCategoryMutation.isPending || !newCategoryName.trim()}
              >
                {addCategoryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
              </Button>
            </div>
            {customCategoriesFromApi.length > 0 && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Custom categories</Label>
                <ul className="space-y-1 border border-border rounded-md divide-y divide-border">
                  {customCategoriesFromApi.map((cat) => (
                    <li key={cat} className="flex items-center justify-between px-3 py-2">
                      <span>{cat}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemoveCustomCategory(cat)}
                        disabled={removingCategoryName !== null}
                      >
                        {removingCategoryName === cat ? <Loader2 className="h-4 w-4 animate-spin" /> : <MinusCircle className="h-4 w-4" />}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <MobileFormDialog
        open={modalVisible}
        onOpenChange={(open) => {
          if (!open) {
            setModalVisible(false);
            setMultipleMode(false);
            setIsExpenseRequest(false);
            form.reset();
          }
        }}
        title={editingExpense ? 'Edit Expense' : multipleMode ? 'Add Multiple Expenses' : isExpenseRequest ? 'Create Expense Request' : 'Add New Expense'}
        description={editingExpense ? 'Update expense details' : multipleMode ? 'Create multiple expenses at once' : isExpenseRequest ? 'Create an expense request that requires approval' : 'Add a new expense (will be marked as paid and approved)'}
        footer={
          multipleMode && !editingExpense ? null : (
            <>
              <Button type="button" variant="outline" onClick={() => {
                setModalVisible(false);
                setMultipleMode(false);
                form.reset();
              }} disabled={submittingExpense}>
                Cancel
              </Button>
              <Button type="submit" form="expense-form" loading={submittingExpense}>
                {editingExpense ? 'Update' : 'Create'} Expense
              </Button>
            </>
          )
        }
        className={multipleMode ? 'sm:w-[var(--modal-w-3xl)]' : 'sm:w-[var(--modal-w-2xl)]'}
      >
        {!editingExpense && (
          <div className="mb-4 text-right">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={multipleMode ? 'default' : 'outline'}
                  onClick={() => {
                    setMultipleMode(!multipleMode);
                    form.reset();
                  }}
                >
                  {multipleMode ? <Pencil className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  {multipleMode ? 'Switch to Single' : 'Switch to Multiple'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {multipleMode ? 'Create one expense at a time' : 'Create multiple expenses in one form'}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
        <Form {...form}>
          <form id="expense-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 md:space-y-4">
              {multipleMode && !editingExpense ? (
            <>
              {/* Common fields for all expenses */}
              <Separator />
              <div className="space-y-3 md:space-y-4">
                <h3 className="text-lg font-semibold">Common Fields (Applied to All Expenses)</h3>
                <FormFieldGrid columns={2}>
                  <FormField
                    control={form.control}
                    name="expenseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expense Date</FormLabel>
                        <FormControl>
                          <DatePicker
                            date={field.value}
                            onDateChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method (Optional)</FormLabel>
                        <Select value={field.value ?? SELECT_NONE_VALUE} onValueChange={(value) => field.onChange(value === SELECT_NONE_VALUE ? null : value)}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment method (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                            {paymentMethods.map(method => (
                              <SelectItem key={method} value={method}>
                                {formatPaymentMethod(method)}
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
                  {isStudioLike && (
                    <FormField
                      control={form.control}
                      name="jobId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Associated Job (Optional)</FormLabel>
                          <Select value={field.value ?? SELECT_NONE_VALUE} onValueChange={(value) => field.onChange(value === SELECT_NONE_VALUE ? null : value)}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select job (leave empty for general expense)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                              {jobs.map(job => (
                                <SelectItem key={job.id} value={job.id}>
                                  {job.jobNumber} - {job.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="vendorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor (Optional)</FormLabel>
                        <Select
                          open={vendorSelectBatchOpen}
                          onOpenChange={setVendorSelectBatchOpen}
                          value={field.value ?? SELECT_NONE_VALUE}
                          onValueChange={(value) => field.onChange(value === SELECT_NONE_VALUE ? null : value)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select vendor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                            {vendors.map(vendor => (
                              <SelectItem key={vendor.id} value={vendor.id}>
                                {vendor.name} {vendor.company ? `(${vendor.company})` : ''}
                              </SelectItem>
                            ))}
                            <SelectSeparator className="my-2" />
                            <div className="px-2 py-1.5" onPointerDown={(e) => e.preventDefault()}>
                              <Button
                                type="button"
                                variant="ghost"
                                className="w-full justify-start"
                                onClick={() => {
                                  setVendorSelectBatchOpen(false);
                                  setVendorAddModalOpen(true);
                                }}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Create vendor
                              </Button>
                            </div>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </FormFieldGrid>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Common Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={2}
                          placeholder="Notes that apply to all expenses"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />
              <div className="space-y-3 md:space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold">Expense Items</h3>
                  <Button
                    type="button"
                    variant="link"
                    className="text-muted-foreground h-auto p-0 text-xs"
                    onClick={() => setManageCategoriesOpen(true)}
                  >
                    Manage categories
                  </Button>
                </div>
                {expenseFields.map((field, index) => (
                  <Card key={field.id} className="p-4 bg-muted">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-4 mb-3 md:mb-4">
                      <FormField
                        control={form.control}
                        name={`expenses.${index}.category`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select value={field.value ?? ''} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {expenseCategories.map(category => (
                                  <SelectItem key={category} value={category}>{category}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`expenses.${index}.amount`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
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
                        name={`expenses.${index}.expenseDate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date (Optional)</FormLabel>
                            <FormControl>
                              <DatePicker
                                date={field.value}
                                onDateChange={field.onChange}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name={`expenses.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              rows={2}
                              placeholder="Enter expense description"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormFieldGrid columns={2} className="mt-4">
                      {isStudioLike && (
                        <FormField
                          control={form.control}
                          name={`expenses.${index}.jobId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Job (Optional)</FormLabel>
                              <Select value={field.value ?? SELECT_NONE_VALUE} onValueChange={(value) => field.onChange(value === SELECT_NONE_VALUE ? null : value)}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select job (optional)" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                                  {jobs.map(job => (
                                    <SelectItem key={job.id} value={job.id}>
                                      {job.jobNumber} - {job.title}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      <FormField
                        control={form.control}
                        name={`expenses.${index}.vendorId`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vendor (Optional)</FormLabel>
                            <Select
                              open={vendorSelectRowOpen === index}
                              onOpenChange={(open) => {
                                if (open) setVendorSelectRowOpen(index);
                                else if (vendorSelectRowOpen === index) setVendorSelectRowOpen(null);
                              }}
                              value={field.value ?? SELECT_NONE_VALUE}
                              onValueChange={(value) => field.onChange(value === SELECT_NONE_VALUE ? null : value)}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select vendor (optional)" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                                {vendors.map(vendor => (
                                  <SelectItem key={vendor.id} value={vendor.id}>
                                    {vendor.name} {vendor.company ? `(${vendor.company})` : ''}
                                  </SelectItem>
                                ))}
                                <SelectSeparator className="my-2" />
                                <div className="px-2 py-1.5" onPointerDown={(e) => e.preventDefault()}>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="w-full justify-start"
                                    onClick={() => {
                                      setVendorSelectRowOpen(null);
                                      setVendorAddModalOpen(true);
                                    }}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create vendor
                                  </Button>
                                </div>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </FormFieldGrid>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => {
                        setVendorSelectRowOpen(null);
                        removeExpense(index);
                      }}
                      className="w-full mt-4"
                    >
                      <MinusCircle className="h-4 w-4 mr-2" />
                      Remove Expense
                    </Button>
                  </Card>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => appendExpense({ category: '', amount: 0, description: '' })}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another Expense
                </Button>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setModalVisible(false);
                      setMultipleMode(false);
                      form.reset();
                    }}
                    disabled={submittingExpense}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submittingExpense}>
                    {submittingExpense && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create {expenseFields.length} Expense(s)
                  </Button>
                </div>
              </div>
              </>
              ) : (
              <>
              {/* Single expense form: fixed label height + same spacing so Category and Amount inputs align */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <div className="grid grid-cols-1 gap-y-2" style={{ gridTemplateRows: '1.25rem auto auto' }}>
                      <div className="flex h-5 items-center justify-between gap-2 overflow-hidden">
                        <FormLabel className="mb-0 shrink-0 leading-none">Category</FormLabel>
                        <Button
                          type="button"
                          variant="link"
                          className="text-muted-foreground h-5 min-h-0 shrink-0 p-0 text-xs leading-none"
                          onClick={() => setManageCategoriesOpen(true)}
                        >
                          Manage categories
                        </Button>
                      </div>
                      <Select value={field.value ?? ''} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="mt-0">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {expenseCategories.map(category => (
                            <SelectItem key={category} value={category}>{category}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </div>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <div className="grid grid-cols-1 gap-y-2" style={{ gridTemplateRows: '1.25rem auto auto' }}>
                      <div className="flex h-5 items-center overflow-hidden">
                        <FormLabel className="mb-0 leading-none">Amount</FormLabel>
                      </div>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={field.value === '' ? '' : field.value}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === '') field.onChange('');
                            else { const n = parseFloat(raw); field.onChange(Number.isNaN(n) ? '' : n); }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </div>
                  )}
                />
              </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="Enter expense description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4">
                <FormField
                  control={form.control}
                  name="expenseDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expense Date</FormLabel>
                      <FormControl>
                        <DatePicker
                          date={field.value}
                          onDateChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method (Optional)</FormLabel>
                      <Select value={field.value ?? SELECT_NONE_VALUE} onValueChange={(value) => field.onChange(value === SELECT_NONE_VALUE ? null : value)}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment method (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                          {paymentMethods.map(method => (
                            <SelectItem key={method} value={method}>
                              {formatPaymentMethod(method)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

                <FormFieldGrid columns={2}>
                  {isStudioLike && (
                    <FormField
                      control={form.control}
                      name="jobId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Associated Job (Optional)</FormLabel>
                          <Select value={field.value ?? SELECT_NONE_VALUE} onValueChange={(value) => field.onChange(value === SELECT_NONE_VALUE ? null : value)}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select job (leave empty for general expense)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                              {jobs.map(job => (
                                <SelectItem key={job.id} value={job.id}>
                                  {job.jobNumber} - {job.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="vendorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor (Optional)</FormLabel>
                        <Select
                          open={vendorSelectSingleOpen}
                          onOpenChange={setVendorSelectSingleOpen}
                          value={field.value ?? SELECT_NONE_VALUE}
                          onValueChange={(value) => field.onChange(value === SELECT_NONE_VALUE ? null : value)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select vendor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                            {vendors.map(vendor => (
                              <SelectItem key={vendor.id} value={vendor.id}>
                                {vendor.name} {vendor.company ? `(${vendor.company})` : ''}
                              </SelectItem>
                            ))}
                            <SelectSeparator className="my-2" />
                            <div className="px-2 py-1.5" onPointerDown={(e) => e.preventDefault()}>
                              <Button
                                type="button"
                                variant="ghost"
                                className="w-full justify-start"
                                onClick={() => {
                                  setVendorSelectSingleOpen(false);
                                  setVendorAddModalOpen(true);
                                }}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Create vendor
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
                        <FormLabel>Status (Optional)</FormLabel>
                        <Select value={field.value ?? SELECT_NONE_VALUE} onValueChange={(value) => field.onChange(value === SELECT_NONE_VALUE ? null : value)}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                            {statusOptions.map(status => (
                              <SelectItem key={status} value={status}>
                                {status.toUpperCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </FormFieldGrid>

                <FormFieldGrid columns={1}>
                <FormField
                  control={form.control}
                  name="receiptUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Receipt (Optional)</FormLabel>
                      <FormControl>
                        <FileUpload
                          accept="image/*,.pdf"
                          maxSizeMB={10}
                          uploading={uploadingReceipt}
                          onFileSelect={async ({ file }) => {
                            setUploadingReceipt(true);
                            try {
                              const res = await expenseService.uploadReceipt(file);
                              const receiptUrl = res?.receiptUrl;
                              if (receiptUrl) {
                                field.onChange(receiptUrl);
                                showSuccess('Receipt uploaded');
                              } else {
                                showError('Upload succeeded but receipt URL was not returned');
                              }
                            } catch (err) {
                              showError(err, 'Failed to upload receipt');
                            } finally {
                              setUploadingReceipt(false);
                            }
                          }}
                          onFileRemove={() => field.onChange('')}
                          uploadedFiles={field.value ? [{ url: field.value, originalName: 'Receipt' }] : []}
                          emptyMessage="No receipt uploaded yet."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </FormFieldGrid>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="Additional notes"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </>
              )}
            </form>
          </Form>
      </MobileFormDialog>

      {/* Create Vendor Dialog (from expense form) */}
      <Dialog open={vendorAddModalOpen} onOpenChange={(open) => {
        if (!open) { setVendorAddModalOpen(false); vendorForm.reset({ name: '', company: '', phone: '' }); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Vendor</DialogTitle>
            <DialogDescription>Add a new vendor without leaving the form.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Form {...vendorForm}>
              <form onSubmit={vendorForm.handleSubmit(handleAddVendorSubmit)} className="space-y-4">
                <FormField
                  control={vendorForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Acme Supplies" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={vendorForm.control}
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
                  control={vendorForm.control}
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
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setVendorAddModalOpen(false); vendorForm.reset({ name: '', company: '', phone: '' }); }}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addingVendor}>
                    {addingVendor ? 'Creating...' : 'Create Vendor'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={rejectionModalVisible} onOpenChange={(open) => {
        if (!open) {
          setRejectionModalVisible(false);
          setRejectingExpense(null);
        }
      }}>
        <DialogContent className="sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)]">
          <DialogHeader>
            <DialogTitle>Reject Expense Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this expense request
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
          {rejectingExpense && (
            <div className="mb-4 p-4 bg-muted rounded-md">
              <div><strong>Expense:</strong> {rejectingExpense.expenseNumber}</div>
              <div><strong>Amount:</strong> ₵ {parseFloat(rejectingExpense.amount).toFixed(2)}</div>
              <div><strong>Description:</strong> {rejectingExpense.description}</div>
            </div>
          )}
          <Form {...rejectionForm}>
            <form onSubmit={rejectionForm.handleSubmit(onReject)} className="space-y-3 md:space-y-4">
              <FormField
                control={rejectionForm.control}
                name="rejectionReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Rejection</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={4}
                        placeholder="Explain why this expense request is being rejected..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setRejectionModalVisible(false);
                  setRejectingExpense(null);
                }}>
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" loading={rejectingExpenseLoading}>
                  Reject
                </Button>
              </DialogFooter>
            </form>
          </Form>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Expense Details Drawer */}
      <DetailsDrawer
        open={drawerVisible}
        onClose={handleCloseDrawer}
        title="Expense Details"
        width={720}
        onEdit={viewingExpense ? () => handleEdit(viewingExpense) : null}
        onDelete={viewingExpense ? () => {
          handleArchive(viewingExpense);
          setDrawerVisible(false);
        } : null}
        deleteConfirmText="Are you sure you want to archive this expense?"
        tabs={viewingExpense ? (() => {
          // Prepare activities for timeline
          const activities = expenseActivities || [];
          
          // Add creation activity at the beginning
          const creationActivity = {
            id: 'creation',
            type: 'creation',
            createdAt: viewingExpense.createdAt,
            createdByUser: viewingExpense.submitter || null
          };

          const allActivities = [creationActivity, ...activities];

          const timelineItems = allActivities.map((activity, index) => {
            const isLast = index === allActivities.length - 1;
            
            if (activity.type === 'creation') {
              const byLine = activity.createdByUser ? ` by ${activity.createdByUser.name}` : '';
              return (
                <TimelineItem key={activity.id} isLast={isLast}>
                  <TimelineIndicator />
                  <TimelineContent>
                    <TimelineTitle className="text-foreground">
                      {activity.createdByUser
                        ? `${activity.createdByUser.name} created expense ${viewingExpense.expenseNumber}`
                        : `Expense ${viewingExpense.expenseNumber} was created`}
                    </TimelineTitle>
                    <TimelineTime className="text-foreground">
                      {dayjs(activity.createdAt).format('MMM DD, YYYY [at] h:mm A')}
                      {byLine}
                    </TimelineTime>
                  </TimelineContent>
                </TimelineItem>
              );
            }

            const typeLabels = {
              'update': 'Expense Updated',
              'submission': 'Submitted for Approval',
              'approval': 'Approved',
              'rejection': 'Rejected',
              'status_change': 'Status Changed',
              'payment': 'Payment Recorded',
              'note': 'Note Added'
            };
            const actionTitle = activity.subject || typeLabels[activity.type] || activity.type;
            const byWho = activity.createdByUser ? activity.createdByUser.name : null;

            return (
              <TimelineItem key={activity.id} isLast={isLast}>
                <TimelineIndicator />
                <TimelineContent>
                  <TimelineTitle className="text-foreground">
                    {byWho ? `${byWho} — ${actionTitle}` : actionTitle}
                  </TimelineTitle>
                  <TimelineTime className="text-foreground">
                    {dayjs(activity.createdAt).format('MMM DD, YYYY [at] h:mm A')}
                  </TimelineTime>
                  {activity.notes && (
                    <TimelineDescription className="text-foreground">{activity.notes}</TimelineDescription>
                  )}
                  {activity.metadata?.rejectionReason && (
                    <TimelineDescription className="text-foreground" style={{ color: '#ff4d4f' }}>
                      Rejection Reason: {activity.metadata.rejectionReason}
                    </TimelineDescription>
                  )}
                </TimelineContent>
              </TimelineItem>
            );
          });

          return [
            {
              key: 'details',
              label: 'Details',
              content: (
                <DrawerSectionCard title="Expense details">
                  <Descriptions column={1} className="space-y-0">
                  <DescriptionItem label="Expense Number">
                    <strong>{viewingExpense.expenseNumber}</strong>
                  </DescriptionItem>
                  <DescriptionItem label="Date">
                    {viewingExpense.expenseDate ? dayjs(viewingExpense.expenseDate).format('MMMM DD, YYYY') : '-'}
                  </DescriptionItem>
                  <DescriptionItem label="Category">
                    <Badge className="border-transparent bg-brand text-white hover:bg-brand-dark">{viewingExpense.category}</Badge>
                  </DescriptionItem>
                  <DescriptionItem label="Description">
                    {viewingExpense.description || '-'}
                  </DescriptionItem>
                  <DescriptionItem label="Amount">
                    <strong style={{ fontSize: '18px', color: 'var(--color-primary)' }}>
                      ₵ {parseFloat(viewingExpense.amount || 0).toFixed(2)}
                    </strong>
                  </DescriptionItem>
                  <DescriptionItem label="Payment Method">
                    {viewingExpense.paymentMethod ? formatPaymentMethod(viewingExpense.paymentMethod) : '-'}
                  </DescriptionItem>
                  <DescriptionItem label="Payment Status" className="relative">
                    <div className="flex items-center justify-end w-full gap-2">
                      {viewingExpense.status !== 'paid' && (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => handleMarkPaid(viewingExpense.id)}
                          disabled={markingPaid === viewingExpense.id}
                          className="text-brand hover:underline font-medium h-auto p-0 flex-shrink-0 order-first"
                        >
                          {markingPaid === viewingExpense.id && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          Mark as Paid
                        </Button>
                      )}
                      <div className="flex-shrink-0">
                        {viewingExpense.status ? (
                          <StatusChip status={viewingExpense.status} />
                        ) : '-'}
                      </div>
                    </div>
                  </DescriptionItem>
                  <DescriptionItem label="Approval Status" className="relative">
                    <div className="flex items-center justify-end w-full gap-2">
                      {viewingExpense.approvalStatus !== 'approved' && viewingExpense.approvalStatus !== 'rejected' && (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => handleApprove(viewingExpense.id)}
                          disabled={approvingExpense}
                          className="text-brand hover:underline font-medium h-auto p-0 flex-shrink-0 order-first"
                        >
                          {approvingExpense && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          {approvingExpense ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin inline" />
                              Approving...
                            </>
                          ) : (
                            'Approve'
                          )}
                        </Button>
                      )}
                      <div className="flex-shrink-0">
                        {viewingExpense.approvalStatus ? (
                          <StatusChip status={viewingExpense.approvalStatus} />
                        ) : '-'}
                      </div>
                    </div>
                  </DescriptionItem>
                  <DescriptionItem label="Vendor">
                    {viewingExpense.vendor ? (
                      <span>{viewingExpense.vendor.name} {viewingExpense.vendor.company ? `(${viewingExpense.vendor.company})` : ''}</span>
                    ) : '-'}
                  </DescriptionItem>
                  {isPrintingPress && (
                    <DescriptionItem label="Job">
                      {viewingExpense.job ? (
                        <span>{viewingExpense.job.jobNumber} - {viewingExpense.job.title}</span>
                      ) : 'General Expense'}
                    </DescriptionItem>
                  )}
                  <DescriptionItem label="Submitted By">
                    {viewingExpense.submitter ? (
                      <span>{viewingExpense.submitter.name} ({viewingExpense.submitter.email})</span>
                    ) : '-'}
                  </DescriptionItem>
                  {viewingExpense.approver && (
                    <DescriptionItem label="Approved By">
                      <span>{viewingExpense.approver.name} ({viewingExpense.approver.email})</span>
                    </DescriptionItem>
                  )}
                  {viewingExpense.approvedAt && (
                    <DescriptionItem label="Approved At">
                      {dayjs(viewingExpense.approvedAt).format('MMMM DD, YYYY [at] hh:mm A')}
                    </DescriptionItem>
                  )}
                  {viewingExpense.rejectionReason && (
                    <DescriptionItem label="Rejection Reason">
                      <span style={{ color: '#ff4d4f' }}>{viewingExpense.rejectionReason}</span>
                    </DescriptionItem>
                  )}
                  {viewingExpense.receiptUrl && (
                    <DescriptionItem label="Receipt">
                      <a href={resolveImageUrl(viewingExpense.receiptUrl)} target="_blank" rel="noopener noreferrer">
                        View Receipt
                      </a>
                    </DescriptionItem>
                  )}
                  {viewingExpense.isRecurring && (
                    <DescriptionItem label="Recurring">
                      <Badge className="bg-purple-600">Yes</Badge>
                      {viewingExpense.recurringFrequency && (
                        <Badge variant="outline" className="ml-2">
                          {viewingExpense.recurringFrequency.charAt(0).toUpperCase() + 
                           viewingExpense.recurringFrequency.slice(1)}
                        </Badge>
                      )}
                    </DescriptionItem>
                  )}
                  <DescriptionItem label="Notes">
                    {viewingExpense.notes || '-'}
                  </DescriptionItem>
                  <DescriptionItem label="Created At">
                    {viewingExpense.createdAt ? dayjs(viewingExpense.createdAt).format('MMMM DD, YYYY [at] hh:mm A') : '-'}
                  </DescriptionItem>
                  <DescriptionItem label="Last Updated">
                    {viewingExpense.updatedAt ? dayjs(viewingExpense.updatedAt).format('MMMM DD, YYYY [at] hh:mm A') : '-'}
                  </DescriptionItem>
                </Descriptions>
                </DrawerSectionCard>
              )
            },
            {
              key: 'activities',
              label: 'Activity',
              content: (
                <DrawerSectionCard title="Activity">
                  {loadingActivities ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : timelineItems.length ? (
                    <Timeline>
                      {timelineItems}
                    </Timeline>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No activities found
                    </div>
                  )}
                </DrawerSectionCard>
              )
            }
          ];
        })() : null}
      />

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive the expense. Archived expenses are hidden from the main list but can be viewed by including archived items in filters.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (expenseToArchive) {
                  handleArchive(expenseToArchive);
                  setExpenseToArchive(null);
                }
                setArchiveConfirmOpen(false);
              }}
              className="bg-orange-600 text-white hover:bg-orange-700"
              loading={archivingExpense === expenseToArchive?.id}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Expenses;


