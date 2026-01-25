import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
// Removed Ant Design imports - using shadcn/ui only
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  Upload as UploadIcon,
  DollarSign,
  ShoppingCart,
  FileText,
  Calendar,
  Send,
  CheckCircle,
  XCircle,
  MinusCircle,
  Loader2,
  Search
} from 'lucide-react';
import dayjs from 'dayjs';
import expenseService from '../services/expenseService';
import jobService from '../services/jobService';
import vendorService from '../services/vendorService';
import { useAuth } from '../context/AuthContext';
import { showSuccess, showError, showWarning } from '../utils/toast';
import DetailsDrawer from '../components/DetailsDrawer';
import TableSkeleton from '../components/TableSkeleton';
import StatusChip from '../components/StatusChip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { StatisticCard } from '@/components/ui/statistic-card';
import { Descriptions, DescriptionItem } from '@/components/ui/descriptions';
import { DatePicker } from '@/components/ui/date-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

// Schema definitions
const baseExpenseSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  expenseDate: z.date({ required_error: 'Expense date is required' }),
  description: z.string().optional(),
  vendorId: z.string().optional().nullable(),
  paymentMethod: z.string().optional(),
  status: z.string().optional(),
  receiptUrl: z.string().optional(),
  notes: z.string().optional(),
});

const expenseSchema = baseExpenseSchema.extend({
  jobId: z.string().optional().nullable(),
});

const multipleExpenseItemSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  description: z.string().optional(),
  jobId: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  paymentMethod: z.string().optional(),
  status: z.string().optional(),
  receiptUrl: z.string().optional(),
  notes: z.string().optional(),
});

const multipleExpenseSchema = z.object({
  expenseDate: z.date({ required_error: 'Expense date is required' }),
  expenses: z.array(multipleExpenseItemSchema).min(1, 'At least one expense is required'),
});

const rejectionSchema = z.object({
  rejectionReason: z.string().min(1, 'Rejection reason is required'),
});

const Expenses = () => {
  const { isAdmin, activeTenant } = useAuth();
  const businessType = activeTenant?.businessType || 'printing_press';
  const isPrintingPress = businessType === 'printing_press';
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [submittingForApproval, setSubmittingForApproval] = useState(false);
  const [approvingExpense, setApprovingExpense] = useState(false);
  const [rejectingExpense, setRejectingExpense] = useState(null);
  const [rejectingExpenseLoading, setRejectingExpenseLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [multipleMode, setMultipleMode] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    category: null,
    status: null,
    jobId: null
  });
  const [activeTab, setActiveTab] = useState('all');
  const [rejectionModalVisible, setRejectionModalVisible] = useState(false);

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
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingExpense, setViewingExpense] = useState(null);

  useEffect(() => {
    fetchExpenses();
    if (isPrintingPress) {
      fetchJobs();
    }
    fetchVendors();
    fetchStats();
  }, [pagination.current, pagination.pageSize, filters, activeTab, isPrintingPress]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters
      };
      
      // Filter by approvalStatus based on active tab
      if (activeTab === 'approved') {
        // Show only approved expenses
        params.approvalStatus = 'approved';
      }
      // For 'all' and 'requests' tabs, don't filter by approvalStatus - show all
      
      const response = await expenseService.getAll(params);
      
      // Use the data and count from backend response
      setExpenses(response.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.count || 0
      }));
    } catch (error) {
      showError(null, 'Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  };

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

  const fetchStats = async () => {
    try {
      const response = await expenseService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleCreate = () => {
    setEditingExpense(null);
    setMultipleMode(false);
    form.reset(multipleMode ? {
      expenseDate: new Date(),
      expenses: [{ category: '', amount: 0, description: '' }],
    } : {
      category: '',
      amount: 0,
      expenseDate: new Date(),
      description: '',
    });
    setModalVisible(true);
  };

  const handleView = (expense) => {
    setViewingExpense(expense);
    setDrawerVisible(true);
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setViewingExpense(null);
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setMultipleMode(false);
    form.reset({
      ...expense,
      amount: expense.amount || 0,
      expenseDate: expense.expenseDate ? dayjs(expense.expenseDate).toDate() : new Date(),
    });
    setModalVisible(true);
    // Close drawer if open
    if (drawerVisible) {
      setDrawerVisible(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await expenseService.delete(id);
      showSuccess('Expense deleted successfully');
      fetchExpenses();
      fetchStats();
    } catch (error) {
      showError(null, 'Failed to delete expense');
    }
  };

  const onSubmit = async (values) => {
    try {
      setSubmittingExpense(true);

      if (editingExpense) {
        // Single expense update
        const expenseData = {
          ...values,
          expenseDate: values.expenseDate ? dayjs(values.expenseDate).format('YYYY-MM-DD') : null
        };
        await expenseService.update(editingExpense.id, expenseData);
        showSuccess('Expense updated successfully');
        setModalVisible(false);
        fetchExpenses();
        fetchStats();
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
          status: values.status || null,
          notes: values.notes || null
        };

        // Use bulk create endpoint
        const response = await expenseService.createBulk(expensesToCreate, commonFields);
        showSuccess(`Successfully created ${response.data.count || expensesToCreate.length} expense(s)`);
        setModalVisible(false);
        fetchExpenses();
        fetchStats();
      } else {
        // Single expense creation
        const expenseData = {
          ...values,
          expenseDate: values.expenseDate ? dayjs(values.expenseDate).format('YYYY-MM-DD') : null
        };
        await expenseService.create(expenseData);
        showSuccess('Expense created successfully');
        setModalVisible(false);
        fetchExpenses();
        fetchStats();
      }
    } catch (error) {
      showError(null, 'Failed to save expense(s)');
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
      fetchExpenses();
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
      fetchExpenses();
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
      fetchExpenses();
      fetchStats();
    } catch (error) {
      showError(null, 'Failed to approve expense');
    } finally {
      setApprovingExpense(false);
    }
  };

  const handleRejectClick = (expense) => {
    setRejectingExpense(expense);
    rejectionForm.reset();
    setRejectionModalVisible(true);
  };

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);

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


  const columns = [
    {
      title: 'Expense #',
      dataIndex: 'expenseNumber',
      key: 'expenseNumber',
      width: 150
    },
    {
      title: 'Date',
      dataIndex: 'expenseDate',
      key: 'expenseDate',
      width: 140,
      render: (date) => dayjs(date).format('MMM DD, YYYY')
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 150,
      render: (category) => <Badge className="bg-green-700">{category}</Badge>
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: 240,
      ellipsis: true
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 140,
      render: (amount) => `GHS ${parseFloat(amount).toFixed(2)}`,
      sorter: (a, b) => parseFloat(a.amount) - parseFloat(b.amount)
    },
    {
      title: 'Job',
      dataIndex: ['job', 'jobNumber'],
      key: 'job',
      width: 150,
      render: (jobNumber, record) => (
        jobNumber ? (
          <Badge className="bg-green-600">{jobNumber}</Badge>
        ) : (
          <Badge variant="outline">General</Badge>
        )
      )
    },
    {
      title: 'Vendor',
      dataIndex: ['vendor', 'name'],
      key: 'vendor',
      width: 170,
      ellipsis: true
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        return <StatusChip status={status} />;
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleView(record)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(record)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setExpenseToDelete(record);
                    setDeleteConfirmOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )
    }
  ];

  // Columns for Expense Requests tab
  const requestColumns = [
    {
      title: 'Request #',
      dataIndex: 'expenseNumber',
      key: 'expenseNumber',
      width: 150
    },
    {
      title: 'Date',
      dataIndex: 'expenseDate',
      key: 'expenseDate',
      width: 120,
      render: (date) => dayjs(date).format('MMM DD, YYYY')
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 130,
      render: (category) => <Badge className="bg-green-700">{category}</Badge>
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (amount) => `GHS ${parseFloat(amount).toFixed(2)}`
    },
    {
      title: 'Submitted By',
      dataIndex: ['submitter', 'name'],
      key: 'submitter',
      width: 150,
      render: (name) => name || '-'
    },
    {
      title: 'Approval Status',
      dataIndex: 'approvalStatus',
      key: 'approvalStatus',
      width: 150,
      render: (status) => {
        return <StatusChip status={status} />;
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 240,
      fixed: 'right',
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleView(record)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {record.approvalStatus === 'draft' && !isAdmin && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    onClick={() => handleSubmitForApproval(record.id)}
                    disabled={submittingForApproval}
                  >
                    {submittingForApproval ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    Submit
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Submit for Approval</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {record.approvalStatus === 'pending_approval' && isAdmin && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(record.id)}
                      disabled={approvingExpense}
                    >
                      {approvingExpense ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      Approve
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Approve</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRejectClick(record)}
                      disabled={rejectingExpenseLoading}
                    >
                      {rejectingExpenseLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                      Reject
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reject</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
          {(record.approvalStatus === 'draft' || record.approvalStatus === 'rejected') && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(record)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {record.approvalStatus === 'rejected' && record.rejectionReason && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                  >
                    View Reason
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Rejection Reason: {record.rejectionReason}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    }
  ];

  const expenseCategories = [
    'Materials',
    'Labor',
    'Equipment',
    'Transportation',
    'Utilities',
    'Marketing',
    'Office Supplies',
    'Maintenance',
    'Other'
  ];

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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold m-0">Expenses {activeTab === 'requests' && '& Requests'}</h1>
        <Button
          onClick={handleCreate}
        >
          <Plus className="h-4 w-4 mr-2" />
          {activeTab === 'requests' ? 'New Request' : 'Add Expense'}
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-600">
                    GHS {parseFloat(stats.totalExpenses || 0).toFixed(2)}
                  </p>
                </div>
                <ShoppingCart className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Categories</p>
                  <p className="text-2xl font-bold text-green-700">
                    {stats.categoryStats ? stats.categoryStats.length : 0}
                  </p>
                </div>
                <FileText className="h-8 w-8 text-green-700" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">This Month</p>
                  <p className="text-2xl font-bold text-green-600">
                    GHS {parseFloat(stats.thisMonthExpenses || 0).toFixed(2)}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Select
            value={filters.category || '__all__'}
            onValueChange={(value) => handleFilterChange('category', value === '__all__' ? null : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Categories</SelectItem>
              {expenseCategories.map(category => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.status || '__all__'}
            onValueChange={(value) => handleFilterChange('status', value === '__all__' ? null : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Statuses</SelectItem>
              {statusOptions.map(status => (
                <SelectItem key={status} value={status}>{status.toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isPrintingPress && (
            <Select
              value={filters.jobId || '__all__'}
              onValueChange={(value) => handleFilterChange('jobId', value === '__all__' ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by Job" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Jobs</SelectItem>
                {jobs.map(job => (
                  <SelectItem key={job.id} value={job.id}>{job.jobNumber} - {job.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setFilters({ category: null, status: null, jobId: null });
              setPagination(prev => ({ ...prev, current: 1 }));
            }}
          >
            Clear Filters
          </Button>
        </div>
      </Card>

      {/* Expenses Table with Tabs */}
      <Card>
        <Tabs value={activeTab} onValueChange={(key) => {
          setActiveTab(key);
          fetchExpenses();
        }}>
          <TabsList className={isPrintingPress ? "grid w-full grid-cols-5" : "grid w-full grid-cols-3"}>
            <TabsTrigger value="all">All Expenses</TabsTrigger>
            <TabsTrigger value="approved">Approved Expenses</TabsTrigger>
            <TabsTrigger value="requests">Expense Requests</TabsTrigger>
            {isPrintingPress && (
              <>
                <TabsTrigger value="job-specific">Job-Specific Expenses</TabsTrigger>
                <TabsTrigger value="general">General Expenses</TabsTrigger>
              </>
            )}
          </TabsList>
          <TabsContent value="all">
            {loading ? (
              <div className="p-4">
                <TableSkeleton rows={8} cols={7} />
              </div>
            ) : (
              renderTable(columns, expenses, 'id')
            )}
          </TabsContent>
          <TabsContent value="approved">
            {loading ? (
              <div className="p-4">
                <TableSkeleton rows={8} cols={7} />
              </div>
            ) : (
              renderTable(columns, expenses, 'id')
            )}
          </TabsContent>
          <TabsContent value="requests">
            {loading ? (
              <div className="p-4">
                <TableSkeleton rows={8} cols={7} />
              </div>
            ) : (
              renderTable(requestColumns, expenses, 'id')
            )}
          </TabsContent>
          {isPrintingPress && (
            <>
              <TabsContent value="job-specific">
                <div className="space-y-4">
                    <Select
                      value={filters.jobId || '__all__'}
                      onValueChange={(jobId) => {
                        if (jobId && jobId !== '__all__') {
                          setFilters(prev => ({ ...prev, jobId }));
                        } else {
                          setFilters(prev => ({ ...prev, jobId: null }));
                        }
                      }}
                    >
                      <SelectTrigger className="w-[300px]">
                        <SelectValue placeholder="Select a job to view its expenses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All Jobs</SelectItem>
                      {jobs.map(job => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.jobNumber} - {job.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {loading ? (
                    <div className="p-4">
                      <TableSkeleton rows={8} cols={7} />
                    </div>
                  ) : (
                    renderTable(columns, expenses?.filter(expense => expense.jobId) || [], 'id')
                  )}
                </div>
              </TabsContent>
              <TabsContent value="general">
                {loading ? (
                  <div className="p-4">
                    <TableSkeleton rows={8} cols={7} />
                  </div>
                ) : (
                  renderTable(columns, expenses?.filter(expense => !expense.jobId) || [], 'id')
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={modalVisible} onOpenChange={(open) => {
        if (!open) {
          setModalVisible(false);
          setMultipleMode(false);
          form.reset();
        }
      }}>
        <DialogContent className={`max-w-[90vw] ${multipleMode ? 'max-w-6xl' : 'max-w-4xl'} max-h-[90vh] overflow-y-auto`}>
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? 'Edit Expense' : multipleMode ? 'Add Multiple Expenses' : 'Add New Expense'}
            </DialogTitle>
            <DialogDescription>
              {editingExpense ? 'Update expense details' : multipleMode ? 'Create multiple expenses at once' : 'Add a new expense to track'}
            </DialogDescription>
          </DialogHeader>
        {!editingExpense && (
          <div className="mb-4 text-right">
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
          </div>
        )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {multipleMode && !editingExpense ? (
            <>
              {/* Common fields for all expenses */}
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Common Fields (Applied to All Expenses)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        <Select value={field.value || undefined} onValueChange={(value) => field.onChange(value || null)}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment method (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="jobId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Associated Job (Optional)</FormLabel>
                        <Select value={field.value || undefined} onValueChange={(value) => field.onChange(value || null)}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select job (leave empty for general expense)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
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
                  <FormField
                    control={form.control}
                    name="vendorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor (Optional)</FormLabel>
                        <Select value={field.value || undefined} onValueChange={(value) => field.onChange(value || null)}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select vendor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {vendors.map(vendor => (
                              <SelectItem key={vendor.id} value={vendor.id}>
                                {vendor.name} {vendor.company ? `(${vendor.company})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Expense Items</h3>
                {expenseFields.map((field, index) => (
                  <Card key={field.id} className="p-4 bg-muted">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                      <FormField
                        control={form.control}
                        name={`expenses.${index}.category`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select value={field.value || undefined} onValueChange={(value) => field.onChange(value || null)}>
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
                                placeholder="0.00"
                                value={field.value || undefined}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                          <FormLabel>Description</FormLabel>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                      {isPrintingPress && (
                        <FormField
                          control={form.control}
                          name={`expenses.${index}.jobId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Job (Optional)</FormLabel>
                              <Select value={field.value || undefined} onValueChange={(value) => field.onChange(value || null)}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select job (optional)" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
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
                            <Select value={field.value || undefined} onValueChange={(value) => field.onChange(value || null)}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select vendor (optional)" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {vendors.map(vendor => (
                                  <SelectItem key={vendor.id} value={vendor.id}>
                                    {vendor.name} {vendor.company ? `(${vendor.company})` : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => removeExpense(index)}
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
              {/* Single expense form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={field.value || undefined}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      <Select value={field.value || undefined} onValueChange={(value) => field.onChange(value || null)}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment method (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="jobId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Associated Job (Optional)</FormLabel>
                      <Select value={field.value || undefined} onValueChange={(value) => field.onChange(value || null)}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select job (leave empty for general expense)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
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
                <FormField
                  control={form.control}
                  name="vendorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor (Optional)</FormLabel>
                      <Select value={field.value || undefined} onValueChange={(value) => field.onChange(value || null)}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vendor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vendors.map(vendor => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              {vendor.name} {vendor.company ? `(${vendor.company})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status (Optional)</FormLabel>
                      <Select value={field.value || undefined} onValueChange={(value) => field.onChange(value || null)}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
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
                <FormField
                  control={form.control}
                  name="receiptUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Receipt URL (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter receipt URL" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setModalVisible(false);
                  setMultipleMode(false);
                  form.reset();
                }} disabled={submittingExpense}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingExpense}>
                  {submittingExpense && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingExpense ? 'Update' : 'Create'} Expense
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={rejectionModalVisible} onOpenChange={(open) => {
        if (!open) {
          setRejectionModalVisible(false);
          setRejectingExpense(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Expense Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this expense request
            </DialogDescription>
          </DialogHeader>
          {rejectingExpense && (
            <div className="mb-4 p-4 bg-muted rounded-md">
              <div><strong>Expense:</strong> {rejectingExpense.expenseNumber}</div>
              <div><strong>Amount:</strong> GHS {parseFloat(rejectingExpense.amount).toFixed(2)}</div>
              <div><strong>Description:</strong> {rejectingExpense.description}</div>
            </div>
          )}
          <Form {...rejectionForm}>
            <form onSubmit={rejectionForm.handleSubmit(onReject)} className="space-y-4">
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
                <Button type="submit" variant="destructive" disabled={rejectingExpenseLoading}>
                  {rejectingExpenseLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Reject
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Expense Details Drawer */}
      <DetailsDrawer
        open={drawerVisible}
        onClose={handleCloseDrawer}
        title="Expense Details"
        width={700}
        onEdit={viewingExpense ? () => handleEdit(viewingExpense) : null}
        onDelete={viewingExpense ? () => {
          handleDelete(viewingExpense.id);
          setDrawerVisible(false);
        } : null}
        deleteConfirmText="Are you sure you want to delete this expense?"
        tabs={viewingExpense ? [
          {
            key: 'details',
            label: 'Details',
            content: (
              <Descriptions column={1} bordered>
                <DescriptionItem label="Expense Number">
                  <strong>{viewingExpense.expenseNumber}</strong>
                </DescriptionItem>
                <DescriptionItem label="Date">
                  {viewingExpense.expenseDate ? dayjs(viewingExpense.expenseDate).format('MMMM DD, YYYY') : '-'}
                </DescriptionItem>
                <DescriptionItem label="Category">
                  <Badge className="bg-blue-600">{viewingExpense.category}</Badge>
                </DescriptionItem>
                <DescriptionItem label="Description">
                  {viewingExpense.description || '-'}
                </DescriptionItem>
                <DescriptionItem label="Amount">
                  <strong style={{ fontSize: '18px', color: '#166534' }}>
                    GHS {parseFloat(viewingExpense.amount || 0).toFixed(2)}
                  </strong>
                </DescriptionItem>
                <DescriptionItem label="Payment Method">
                  {viewingExpense.paymentMethod ? formatPaymentMethod(viewingExpense.paymentMethod) : '-'}
                </DescriptionItem>
                <DescriptionItem label="Payment Status">
                  {viewingExpense.status ? (
                    <StatusChip status={viewingExpense.status} />
                  ) : '-'}
                </DescriptionItem>
                <DescriptionItem label="Approval Status">
                  {viewingExpense.approvalStatus ? (
                    <StatusChip status={viewingExpense.approvalStatus} />
                  ) : '-'}
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
                    <a href={viewingExpense.receiptUrl} target="_blank" rel="noopener noreferrer">
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
            )
          }
        ] : null}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the expense.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (expenseToDelete) {
                  handleDelete(expenseToDelete.id);
                  setExpenseToDelete(null);
                }
                setDeleteConfirmOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Expenses;


