import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDebounce } from '../../hooks/useDebounce';
import { useResponsive } from '../../hooks/useResponsive';
import { useSmartSearch } from '../../context/SmartSearchContext';
import { usePlatformAdminPermissions } from '../../context/PlatformAdminPermissionsContext';
import adminService from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';
import { showError, showSuccess } from '../../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import DashboardStatsCard from '../../components/DashboardStatsCard';
import DashboardTable from '../../components/DashboardTable';
import ViewToggle from '../../components/ViewToggle';
import DetailsDrawer from '../../components/DetailsDrawer';
import DrawerSectionCard from '../../components/DrawerSectionCard';
import StatusChip from '../../components/StatusChip';
import TableSkeleton from '../../components/TableSkeleton';
import {
  RefreshCw,
  Loader2,
  Filter,
  ShoppingCart,
  Calendar,
  Currency,
  TrendingUp,
  Plus,
  Eye
} from 'lucide-react';
import dayjs from 'dayjs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { DatePicker } from '@/components/ui/date-picker';
import { Timeline, TimelineItem, TimelineIndicator, TimelineContent, TimelineTitle, TimelineDescription, TimelineTime } from '@/components/ui/timeline';
import { Descriptions, DescriptionItem } from '@/components/ui/descriptions';
import { DEBOUNCE_DELAYS } from '../../constants';
import { numberInputValue, handleNumberChange, numberOrEmptySchema } from '../../utils/formUtils';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import MobileFormDialog from '../../components/MobileFormDialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const addExpenseSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  amount: numberOrEmptySchema(z).refine((v) => v >= 0.01, 'Amount must be greater than 0'),
  expenseDate: z.date({ required_error: 'Expense date is required' }),
  description: z.string().optional().default(''),
  paymentMethod: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

const AdminExpenses = () => {
  const { activeTenantId } = useAuth();
  const { searchValue, setPageSearchConfig } = useSmartSearch();
  const { hasPermission, loading: permissionsLoading } = usePlatformAdminPermissions();
  const debouncedSearch = useDebounce(searchValue, DEBOUNCE_DELAYS.SEARCH);
  const { isMobile } = useResponsive();

  const [expenses, setExpenses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({
    category: '',
    status: '',
    approvalStatus: '',
    startDate: null,
    endDate: null
  });
  const [tableViewMode, setTableViewMode] = useState('table');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingExpense, setViewingExpense] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const addExpenseForm = useForm({
    resolver: zodResolver(addExpenseSchema),
    defaultValues: {
      category: '',
      amount: 0,
      expenseDate: new Date(),
      description: '',
      paymentMethod: 'cash',
      status: 'paid',
      notes: '',
    },
  });

  // Admin-specific expense categories (platform internal expenses, not tenant-dependent)
  const { data: adminCategories = [] } = useQuery({
    queryKey: ['admin', 'expenses', 'categories'],
    queryFn: () => adminService.getAdminExpenseCategories(),
    staleTime: 5 * 60 * 1000,
  });
  const expenseCategoriesApi = Array.isArray(adminCategories) ? adminCategories : [];

  // Configure smart search for this page
  useEffect(() => {
    setPageSearchConfig({
      placeholder: 'Search expenses by number, description, or category...',
      scope: 'admin-expenses'
    });
  }, [setPageSearchConfig]);

  // Fetch expenses
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        search: debouncedSearch || undefined,
        category: filters.category || undefined,
        status: filters.status || undefined,
        approvalStatus: filters.approvalStatus || undefined,
        startDate: filters.startDate ? dayjs(filters.startDate).format('YYYY-MM-DD') : undefined,
        endDate: filters.endDate ? dayjs(filters.endDate).format('YYYY-MM-DD') : undefined
      };
      
      const response = await adminService.getAdminExpenses(params);
      if (response?.success) {
        setExpenses(response.data?.data || response.data || []);
        setPagination(prev => ({
          ...prev,
          total: response.data?.count || response.data?.data?.length || 0
        }));
      }
    } catch (error) {
      showError(error, 'Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, debouncedSearch, filters]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params = {
        startDate: filters.startDate ? dayjs(filters.startDate).format('YYYY-MM-DD') : undefined,
        endDate: filters.endDate ? dayjs(filters.endDate).format('YYYY-MM-DD') : undefined
      };
      const response = await adminService.getAdminExpenseStats(params);
      if (response?.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch expense stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, [filters.startDate, filters.endDate]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchExpenses(), fetchStats()]);
    setRefreshing(false);
  };

  const handleViewExpense = async (expense) => {
    try {
      const response = await adminService.getAdminExpense(expense.id);
      if (response?.success) {
        setViewingExpense(response.data);
        setDrawerVisible(true);
      }
    } catch (error) {
      showError(error, 'Failed to load expense details');
    }
  };

  const handleAddExpenseSubmit = useCallback(async (values) => {
    try {
      setSubmitting(true);
      const payload = {
        category: values.category,
        amount: Number(values.amount),
        expenseDate: dayjs(values.expenseDate).format('YYYY-MM-DD'),
        description: (values.description || '').trim() || 'No description',
        paymentMethod: values.paymentMethod || 'cash',
        status: values.status || 'paid',
        notes: values.notes || null,
      };
      const response = await adminService.createAdminExpense(payload);
      if (response?.success) {
        showSuccess('Expense created successfully');
        setAddModalOpen(false);
        addExpenseForm.reset();
        handleRefresh();
      }
    } catch (error) {
      showError(error, 'Failed to create expense');
    } finally {
      setSubmitting(false);
    }
  }, [addExpenseForm, handleRefresh]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleClearFilters = () => {
    setFilters({
      category: '',
      status: '',
      approvalStatus: '',
      startDate: null,
      endDate: null
    });
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const hasActiveFilters = filters.category || filters.status || filters.approvalStatus || filters.startDate || filters.endDate;

  const expenseCategories = useMemo(() => {
    const fromApi = Array.isArray(expenseCategoriesApi) ? expenseCategoriesApi : [];
    const fallback = ['Salaries & Wages', 'Office Supplies', 'Software & Subscriptions', 'Marketing & Advertising', 'Travel & Accommodation', 'Utilities', 'Rent', 'Other'];
    return fromApi.length > 0 ? fromApi : fallback;
  }, [expenseCategoriesApi]);

  const statusOptions = ['pending', 'paid', 'overdue'];
  const approvalStatusOptions = ['draft', 'pending_approval', 'approved', 'rejected'];

  const formatCurrency = (value) => {
    const numValue = typeof value === 'number' ? value : parseFloat(value || 0);
    return `₵ ${numValue.toFixed(2)}`;
  };

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
      render: (_, record) => <span className="text-foreground font-medium">{formatCurrency(record?.amount)}</span>
    },
    {
      key: 'status',
      label: 'Status',
      mobileDashboardPlacement: 'headerEnd',
      render: (_, record) => <StatusChip status={record?.status} />
    },
    {
      key: 'approvalStatus',
      label: 'Approval',
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
            onClick={() => handleViewExpense(record)}
          >
            <Eye className="h-4 w-4 mr-2" />
            View
          </Button>
        </div>
      )
    }
  ], [handleViewExpense]);

  // Check permission
  if (!permissionsLoading && !hasPermission('expenses.view')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">Access Denied</h3>
          <p className="text-gray-600">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground mb-1">Expenses</h2>
          <p className="text-sm text-muted-foreground">
            Track platform operating expenses (office, infrastructure, etc.).
          </p>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0 sm:justify-end sm:ml-auto">
          <ViewToggle value={tableViewMode} onChange={setTableViewMode} />
          <Button variant="outline" onClick={() => setFilterDrawerOpen(true)} size={isMobile ? "icon" : "default"}>
            <Filter className="h-4 w-4" />
            {!isMobile && <span className="ml-2">Filter</span>}
          </Button>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            size={isMobile ? "icon" : "default"}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          {hasPermission('expenses.manage') && (
            <Button
              onClick={() => {
                addExpenseForm.reset({
                  category: '',
                  amount: 0,
                  expenseDate: new Date(),
                  description: '',
                  paymentMethod: 'cash',
                  status: 'paid',
                  notes: '',
                });
                setAddModalOpen(true);
              }}
              className="flex-1 min-w-0 md:flex-none"
            >
              <Plus className="h-4 w-4" />
              <span className="ml-2">Add Expense</span>
            </Button>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <DashboardStatsCard
          title="Total Expenses"
          value={stats?.totals?.totalExpenses ? formatCurrency(stats.totals.totalExpenses) : formatCurrency(0)}
          icon={ShoppingCart}
          iconBgColor="rgba(239, 68, 68, 0.1)"
          iconColor="#ef4444"
        />
        <DashboardStatsCard
          title="This Month"
          value={stats?.totals?.thisMonth ? formatCurrency(stats.totals.thisMonth) : formatCurrency(0)}
          icon={Calendar}
          iconBgColor="rgba(132, 204, 22, 0.1)"
          iconColor="#84cc16"
        />
        <DashboardStatsCard
          title="Pending Requests"
          value={stats?.totals?.pendingRequests || 0}
          icon={TrendingUp}
          iconBgColor="rgba(249, 115, 22, 0.1)"
          iconColor="#f97316"
        />
        <DashboardStatsCard
          title="Total Count"
          value={stats?.totals?.totalCount || 0}
          icon={Currency}
          iconBgColor="var(--color-primary-light)"
          iconColor="var(--color-primary)"
        />
      </div>

      {/* Expenses Table */}
      <DashboardTable
          data={expenses}
          columns={tableColumns}
          loading={loading}
          title={null}
          emptyIcon={<ShoppingCart className="h-12 w-12 text-muted-foreground" />}
          emptyDescription="No platform expenses yet. Track internal spending and operational costs."
          emptyAction={
            hasPermission('expenses.manage') && (
              <Button onClick={() => {
                addExpenseForm.reset({
                  category: '',
                  amount: '',
                  date: new Date(),
                  description: '',
                  paymentMethod: 'cash',
                  status: 'paid',
                  notes: '',
                });
                setAddModalOpen(true);
              }}>
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
            total: pagination.total
          }}
          viewMode={tableViewMode}
          onViewModeChange={setTableViewMode}
        />

      {/* Filter Drawer */}
      <Sheet open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
        <SheetContent side="right" className="w-full sm:w-[400px] md:w-[540px] overflow-y-auto">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle>Filter Expenses</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 md:space-y-6 mt-4 md:mt-6">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={filters.category || '__all__'}
                onValueChange={(value) => handleFilterChange('category', value === '__all__' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Categories</SelectItem>
                  {expenseCategories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={filters.status || '__all__'}
                onValueChange={(value) => handleFilterChange('status', value === '__all__' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Statuses</SelectItem>
                  {statusOptions.map(status => (
                    <SelectItem key={status} value={status}>{status.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Approval Status</Label>
              <Select
                value={filters.approvalStatus || '__all__'}
                onValueChange={(value) => handleFilterChange('approvalStatus', value === '__all__' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All approval statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Approval Statuses</SelectItem>
                  {approvalStatusOptions.map(status => (
                    <SelectItem key={status} value={status}>{status.replace('_', ' ').toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <DatePicker
                date={filters.startDate}
                onDateChange={(date) => handleFilterChange('startDate', date)}
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <DatePicker
                date={filters.endDate}
                onDateChange={(date) => handleFilterChange('endDate', date)}
              />
            </div>

            {hasActiveFilters && (
              <Button variant="outline" onClick={handleClearFilters} className="w-full">
                Clear Filters
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Add Expense Modal */}
      <MobileFormDialog
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        title="Add Internal Expense"
        description="Record a platform operating expense (office, infrastructure, etc.). It will be auto-approved."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setAddModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="admin-add-expense-form" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitting ? ' Creating...' : 'Create Expense'}
            </Button>
          </>
        }
      >
        <Form {...addExpenseForm}>
          <form id="admin-add-expense-form" onSubmit={addExpenseForm.handleSubmit(handleAddExpenseSubmit)} className="space-y-4">
              <FormField
                control={addExpenseForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {expenseCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addExpenseForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (₵) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        {...field}
                        value={numberInputValue(field.value)}
                        onChange={(e) => handleNumberChange(e, field.onChange)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addExpenseForm.control}
                name="expenseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <DatePicker date={field.value} onDateChange={field.onChange} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addExpenseForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Expense description" rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addExpenseForm.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="mobile_money">Mobile Money</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="credit_card">Credit Card</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addExpenseForm.control}
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
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addExpenseForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Optional notes" rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </form>
            </Form>
      </MobileFormDialog>

      {/* Expense Details Drawer */}
      <DetailsDrawer
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setViewingExpense(null);
        }}
        title="Expense Details"
        width={720}
        tabs={viewingExpense ? [
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
                      {formatCurrency(viewingExpense.amount)}
                    </strong>
                  </DescriptionItem>
                  <DescriptionItem label="Status">
                    <StatusChip status={viewingExpense.status} />
                  </DescriptionItem>
                  <DescriptionItem label="Approval Status">
                    <StatusChip status={viewingExpense.approvalStatus} />
                  </DescriptionItem>
                  {viewingExpense.submitter && (
                    <DescriptionItem label="Submitted By">
                      {viewingExpense.submitter.name} ({viewingExpense.submitter.email})
                    </DescriptionItem>
                  )}
                  {viewingExpense.approver && (
                    <DescriptionItem label="Approved By">
                      {viewingExpense.approver.name} ({viewingExpense.approver.email})
                    </DescriptionItem>
                  )}
                  {viewingExpense.rejectionReason && (
                    <DescriptionItem label="Rejection Reason">
                      <span style={{ color: '#ff4d4f' }}>{viewingExpense.rejectionReason}</span>
                    </DescriptionItem>
                  )}
                  <DescriptionItem label="Created At">
                    {viewingExpense.createdAt ? dayjs(viewingExpense.createdAt).format('MMMM DD, YYYY [at] hh:mm A') : '-'}
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
                {viewingExpense.activities && viewingExpense.activities.length > 0 ? (
                  <Timeline>
                    {viewingExpense.activities.map((activity, index) => (
                      <TimelineItem key={activity.id} isLast={index === viewingExpense.activities.length - 1}>
                        <TimelineIndicator />
                        <TimelineContent>
                          <TimelineTitle className="text-foreground">
                            {activity.createdByUser ? `${activity.createdByUser.name} — ${activity.subject || activity.type}` : activity.subject || activity.type}
                          </TimelineTitle>
                          <TimelineTime className="text-foreground">
                            {dayjs(activity.createdAt).format('MMM DD, YYYY [at] h:mm A')}
                          </TimelineTime>
                          {activity.notes && (
                            <TimelineDescription className="text-foreground">{activity.notes}</TimelineDescription>
                          )}
                        </TimelineContent>
                      </TimelineItem>
                    ))}
                  </Timeline>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No activities found
                  </div>
                )}
              </DrawerSectionCard>
            )
          }
        ] : null}
      />
    </div>
  );
};

export default AdminExpenses;
