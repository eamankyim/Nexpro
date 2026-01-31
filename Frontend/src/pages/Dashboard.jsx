import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Row, Col, Statistic, Tag, Spin, DatePicker, Space, Button, Divider, Tooltip, Alert, Modal } from 'antd';
import { useResponsive } from '../hooks/useResponsive';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import StatusChip from '../components/StatusChip';
import TableSkeleton from '../components/TableSkeleton';
import DetailSkeleton from '../components/DetailSkeleton';
import WelcomeSection from '../components/WelcomeSection';
import DateFilterButtons from '../components/DateFilterButtons';
import DashboardStatsCards from '../components/DashboardStatsCards';
import DashboardJobsTable from '../components/DashboardJobsTable';
import { showSuccess, showError, showWarning } from '../utils/toast';
import {
  DollarSign,
  ShoppingCart,
  FileText,
  Users,
  TrendingUp,
  TrendingDown,
  Filter,
  Calendar,
  Plus,
  Clock,
  Upload as UploadIcon,
  ChevronRight,
  ChevronLeft,
  Briefcase,
  Inbox,
  AlertTriangle,
  Info,
  Wallet,
  UserPlus,
  Loader2,
  RefreshCw,
  Package,
  Sparkles,
} from 'lucide-react';
import { Empty } from '../components/ui/empty';
import { Skeleton } from '../components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import dashboardService from '../services/dashboardService';
import productService from '../services/productService';
import notificationService from '../services/notificationService';
import settingsService from '../services/settingsService';
import reportService from '../services/reportService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getPreviousPeriod, calculateComparison, formatComparisonText } from '../utils/periodComparison';
import { CURRENCY } from '../constants';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import relativeTime from 'dayjs/plugin/relativeTime';

// Extend dayjs with plugins
dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.extend(relativeTime);

const { RangePicker } = DatePicker;

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, activeTenant, activeTenantId, tenantRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const { isMobile } = useResponsive();
  const [overview, setOverview] = useState(null);
  const todayRange = useMemo(() => {
    const today = dayjs();
    return [today, today];
  }, []);
  const [dateRange, setDateRange] = useState(todayRange);
  const [activeFilter, setActiveFilter] = useState('today');
  const [jobsPagination, setJobsPagination] = useState({ current: 1, pageSize: 5 });
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [comparisonData, setComparisonData] = useState(null);
  const queryClient = useQueryClient();

  // Fetch organization settings to check for logo (when onboarding not yet completed)
  const { data: organizationData } = useQuery({
    queryKey: ['settings', 'organization'],
    queryFn: () => settingsService.getOrganizationSettings(),
    enabled: !activeTenant?.metadata?.onboarding?.completedAt,
  });

  // Define fetchDashboardData BEFORE useEffect that uses it
  const fetchDashboardData = useCallback(async (startDate = null, endDate = null, filterType = null) => {
    try {
      const response = await dashboardService.getOverview(startDate, endDate);
      setOverview(response.data);

      // Fetch comparison data if we have a filter type and date range
      if (filterType && startDate && endDate) {
        try {
          const previousPeriod = getPreviousPeriod(filterType, [
            dayjs(startDate),
            dayjs(endDate)
          ]);

          // Fetch previous period data
          const [prevRevenue, prevExpenses] = await Promise.all([
            reportService.getRevenueReport(previousPeriod.startDate, previousPeriod.endDate, 'day')
              .catch(() => ({ data: { totalRevenue: 0 } })),
            reportService.getExpenseReport(previousPeriod.startDate, previousPeriod.endDate)
              .catch(() => ({ data: { totalExpenses: 0 } }))
          ]);

          const prevRevenueValue = prevRevenue?.data?.totalRevenue || 0;
          const prevExpenseValue = prevExpenses?.data?.totalExpenses || 0;
          const currentRevenueValue = response.data?.thisMonth?.revenue || 0;
          const currentExpenseValue = response.data?.thisMonth?.expenses || 0;
          const currentProfitValue = currentRevenueValue - currentExpenseValue;
          const prevProfitValue = prevRevenueValue - prevExpenseValue;

          setComparisonData({
            revenue: calculateComparison(currentRevenueValue, prevRevenueValue),
            expenses: calculateComparison(currentExpenseValue, prevExpenseValue),
            profit: calculateComparison(currentProfitValue, prevProfitValue),
            label: previousPeriod.label,
            periodLabel: previousPeriod.label
          });
        } catch (error) {
          console.error('Failed to fetch comparison data:', error);
          setComparisonData(null);
        }
      } else {
        setComparisonData(null);
      }
    } catch (error) {
      showError(null, 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setIsRefetching(false);
    }
  }, []);

  // Keep current filter in ref so pull-to-refresh uses it
  const dateFilterRef = useRef({ dateRange, activeFilter });
  dateFilterRef.current = { dateRange, activeFilter };
  const refreshWithCurrentFilter = useCallback(() => {
    const { dateRange: range, activeFilter: filter } = dateFilterRef.current;
    if (range && range[0] && range[1] && filter) {
      return fetchDashboardData(range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD'), filter);
    }
    return fetchDashboardData();
  }, [fetchDashboardData]);

  // Pull-to-refresh hook for dashboard (refetches with current date filter)
  const { isRefreshing, pullDistance, containerProps } = usePullToRefresh(
    refreshWithCurrentFilter,
    { enabled: isMobile }
  );

  useEffect(() => {
    // Fetch today's data by default and notifications in parallel
    const loadInitialData = async () => {
      setLoading(true);
      setLoadingNotifications(true);
      const today = dayjs();
      const startDate = today.format('YYYY-MM-DD');
      const endDate = today.format('YYYY-MM-DD');

      await Promise.all([
        fetchDashboardData(startDate, endDate, 'today'),
        (async () => {
          try {
            const response = await notificationService.getNotifications({ page: 1, limit: 5 });
            if (response?.success && Array.isArray(response.data)) {
              setNotifications(response.data);
            }
          } catch (error) {
            console.error('Failed to load notifications', error);
          } finally {
            setLoadingNotifications(false);
          }
        })()
      ]);
    };
    loadInitialData();
  }, [fetchDashboardData]);

  const handleDateRangeChange = useCallback(async (dates) => {
    setIsRefetching(true);
    setDateRange(dates);
    setActiveFilter(null); // Clear active filter when custom date range is used
    if (dates && dates[0] && dates[1]) {
      const startDate = dates[0].format('YYYY-MM-DD');
      const endDate = dates[1].format('YYYY-MM-DD');
      await fetchDashboardData(startDate, endDate, 'custom');
    } else {
      // If no date range selected, fetch all data
      await fetchDashboardData();
    }
  }, [fetchDashboardData]);

  const clearFilters = useCallback(async () => {
    setIsRefetching(true);
    setDateRange(null);
    setActiveFilter(null);
    setComparisonData(null);
    await fetchDashboardData();
  }, [fetchDashboardData]);

  // Quick date filter functions
  const setTodayFilter = useCallback(async () => {
    setIsRefetching(true);
    const today = dayjs();
    const range = [today, today];
    setDateRange(range);
    setActiveFilter('today');
    await fetchDashboardData(today.format('YYYY-MM-DD'), today.format('YYYY-MM-DD'), 'today');
  }, [fetchDashboardData]);

  const setYesterdayFilter = useCallback(async () => {
    setIsRefetching(true);
    const yesterday = dayjs().subtract(1, 'day');
    const range = [yesterday, yesterday];
    setDateRange(range);
    setActiveFilter('yesterday');
    await fetchDashboardData(yesterday.format('YYYY-MM-DD'), yesterday.format('YYYY-MM-DD'), 'yesterday');
  }, [fetchDashboardData]);

  const setThisWeekFilter = useCallback(async () => {
    setIsRefetching(true);
    const startOfWeek = dayjs().startOf('isoWeek');
    const endOfWeek = dayjs().endOf('isoWeek');
    const range = [startOfWeek, endOfWeek];
    setDateRange(range);
    setActiveFilter('week');
    await fetchDashboardData(startOfWeek.format('YYYY-MM-DD'), endOfWeek.format('YYYY-MM-DD'), 'thisWeek');
  }, [fetchDashboardData]);

  const setThisMonthFilter = useCallback(async () => {
    setIsRefetching(true);
    const startOfMonth = dayjs().startOf('month');
    const endOfMonth = dayjs().endOf('month');
    const range = [startOfMonth, endOfMonth];
    setDateRange(range);
    setActiveFilter('month');
    await fetchDashboardData(startOfMonth.format('YYYY-MM-DD'), endOfMonth.format('YYYY-MM-DD'), 'thisMonth');
  }, [fetchDashboardData]);

  const setThisQuarterFilter = useCallback(async () => {
    setIsRefetching(true);
    const currentQuarter = Math.floor(dayjs().month() / 3);
    const startOfQuarter = dayjs().startOf('year').add(currentQuarter * 3, 'months');
    const endOfQuarter = startOfQuarter.add(2, 'months').endOf('month');
    const range = [startOfQuarter, endOfQuarter];
    setDateRange(range);
    setActiveFilter('quarter');
    await fetchDashboardData(startOfQuarter.format('YYYY-MM-DD'), endOfQuarter.format('YYYY-MM-DD'), 'thisQuarter');
  }, [fetchDashboardData]);

  const setThisYearFilter = useCallback(async () => {
    setIsRefetching(true);
    const startOfYear = dayjs().startOf('year');
    const endOfYear = dayjs().endOf('year');
    const range = [startOfYear, endOfYear];
    setDateRange(range);
    setActiveFilter('year');
    await fetchDashboardData(startOfYear.format('YYYY-MM-DD'), endOfYear.format('YYYY-MM-DD'), 'thisYear');
  }, [fetchDashboardData]);


  const getDueDateStatus = useCallback((dueDate) => {
    if (!dueDate) {
      return {
        color: 'default',
        label: 'No due date set',
        formatted: '—'
      };
    }

    const due = dayjs(dueDate);
    const now = dayjs();

    const formatted = due.format('MMM DD, YYYY');

    if (!due.isValid()) {
      return {
        color: 'default',
        label: 'Invalid due date',
        formatted: '—'
      };
    }

    const diffHours = due.diff(now, 'hour', true);

    if (diffHours < 0) {
      return {
        color: 'red',
        label: `Overdue · was due ${due.fromNow()}`,
        formatted
      };
    }

    if (diffHours <= 24) {
      return {
        color: 'red',
        label: `Due ${due.fromNow()}`,
        formatted
      };
    }

    if (diffHours <= 72) {
      return {
        color: 'orange',
        label: `Upcoming · due ${due.fromNow()}`,
        formatted
      };
    }

    return {
      color: 'default',
      label: `Due ${due.fromNow()}`,
      formatted
    };
  }, []);

  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  // Use filtered data if available, otherwise use overview data
  const displayData = useMemo(() => overview, [overview]);
  
  // Calculate pagination values (after displayData is defined)
  // For shops/pharmacies, use recent sales from shopData; otherwise use recentJobs
  const recentJobs = useMemo(() => {
    if (activeTenant?.businessType === 'shop' || activeTenant?.businessType === 'pharmacy') {
      // Transform sales data to match the expected format for the table
      const recentSales = displayData?.shopData?.recentSales || [];
      return recentSales.map(sale => ({
        id: sale.id,
        jobNumber: sale.saleNumber,
        title: `GHS ${sale.total?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        customer: sale.customer ? { name: sale.customer.name } : null,
        status: 'completed',
        createdAt: sale.createdAt,
        dueDate: null, // Sales don't have due dates
        paymentMethod: sale.paymentMethod
      }));
    }
    return displayData?.recentJobs || [];
  }, [displayData, activeTenant?.businessType]);
  const totalJobs = useMemo(() => recentJobs.length, [recentJobs]);
  const totalPages = useMemo(() => Math.ceil(totalJobs / jobsPagination.pageSize), [totalJobs, jobsPagination.pageSize]);
  const startIndex = useMemo(() => (jobsPagination.current - 1) * jobsPagination.pageSize + 1, [jobsPagination.current, jobsPagination.pageSize]);
  const endIndex = useMemo(() => Math.min(jobsPagination.current * jobsPagination.pageSize, totalJobs), [jobsPagination.current, jobsPagination.pageSize, totalJobs]);
  const paginatedJobs = useMemo(() => recentJobs.slice(
    (jobsPagination.current - 1) * jobsPagination.pageSize,
    jobsPagination.current * jobsPagination.pageSize
  ), [recentJobs, jobsPagination.current, jobsPagination.pageSize]);
  const isFiltered = useMemo(() => Boolean(dateRange && dateRange[0] && dateRange[1]), [dateRange]);
  const thisMonthSummary = useMemo(() => displayData?.thisMonth || {}, [displayData]);
  const revenueValue = useMemo(() => Number(thisMonthSummary.revenue ?? 0), [thisMonthSummary.revenue]);
  const expenseValue = useMemo(() => Number(thisMonthSummary.expenses ?? 0), [thisMonthSummary.expenses]);
  const revenueTitle = useMemo(() => isFiltered ? 'Selected Revenue' : "This Month's Revenue", [isFiltered]);
  const expenseTitle = useMemo(() => isFiltered ? 'Selected Expenses' : "This Month's Expenses", [isFiltered]);
  const profitTitle = useMemo(() => isFiltered ? 'Selected Profit' : "This Month's Profit", [isFiltered]);
  const profitValue = useMemo(() => Number(thisMonthSummary.profit ?? (revenueValue - expenseValue)), [thisMonthSummary.profit, revenueValue, expenseValue]);
  const allTimeProfit = useMemo(() => Number(displayData?.allTime?.profit ?? ((displayData?.allTime?.revenue ?? 0) - (displayData?.allTime?.expenses ?? 0))), [displayData]);
  const thisMonthRange = useMemo(() => thisMonthSummary.range, [thisMonthSummary.range]);

  // Get business type from activeTenant (preferred) or overview response (fallback)
  const businessType = useMemo(() => activeTenant?.businessType || overview?.businessType || 'printing_press', [activeTenant?.businessType, overview?.businessType]);
  const isShop = useMemo(() => businessType === 'shop', [businessType]);
  const isPharmacy = useMemo(() => businessType === 'pharmacy', [businessType]);
  const isStudio = useMemo(() => businessType === 'printing_press', [businessType]);
  const isStaffShopOrPharmacy = useMemo(
    () => (isShop || isPharmacy) && tenantRole === 'staff',
    [isShop, isPharmacy, tenantRole]
  );

  const { data: staffProductsRaw, isLoading: staffProductsLoading } = useQuery({
    queryKey: ['products', 'active', activeTenantId],
    queryFn: () => productService.getAllActiveProducts(),
    enabled: isStaffShopOrPharmacy,
    staleTime: 60 * 1000,
  });
  const staffProducts = useMemo(
    () => (Array.isArray(staffProductsRaw) ? staffProductsRaw : (staffProductsRaw?.products ?? [])),
    [staffProductsRaw]
  );

  const organization = useMemo(() => organizationData?.data || {}, [organizationData]);

  // Check for tax settings
  const hasTaxSettings = useMemo(() => !!(organization?.tax?.vatNumber || organization?.tax?.tin), [organization?.tax]);
  
  // Check if tenant has a name (not default)
  const hasBusinessName = useMemo(() => {
    const name = activeTenant?.name;
    return !!(name && name.trim() && name !== 'My Workspace');
  }, [activeTenant?.name]);

  // Check if onboarding is incomplete
  // Onboarding is considered complete if:
  // 1. completedAt exists in metadata, OR
  // 2. All required items are present (name, tax settings). Logo is optional.
  const onboardingCompleted = useMemo(() => {
    // Explicitly marked as complete
    if (activeTenant?.metadata?.onboarding?.completedAt) {
      return true;
    }
    // Implicitly complete if required setup items are present (logo is optional)
    return hasBusinessName && hasTaxSettings;
  }, [activeTenant?.metadata?.onboarding?.completedAt, hasBusinessName, hasTaxSettings]);
  
  const showSetupBanner = useMemo(() => !onboardingCompleted, [onboardingCompleted]);

  // Welcome messages based on mode
  const welcomeMessages = useMemo(() => ({
    shop: "Welcome to ShopWISE for Shops 👋",
    pharmacy: "Welcome to ShopWISE for Pharmacies 👋",
    printing_press: "Welcome to ShopWISE for Studios 👋"
  }), []);

  const welcomeMessage = useMemo(() => welcomeMessages[businessType] || welcomeMessages.printing_press, [welcomeMessages, businessType]);

  // Full-page skeletons only on initial load when we have no data yet
  if (loading && !overview) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <TableSkeleton rows={5} cols={6} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div {...containerProps} style={{ position: 'relative' }}>
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
      
      {/* Unified Dashboard for all business types */}
      <>
      {/* Setup Checklist Banner */}
      {showSetupBanner && (
        <div
          data-setup-banner
          className="mb-6 rounded-lg border border-gray-200 p-6"
          style={{ backgroundColor: '#060A00' }}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#a3e635]">
                <Sparkles className="h-5 w-5 text-[#166534]" />
              </div>
              <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-white mb-1">Finish setting up your workspace</h3>
              <p className="text-base text-gray-300">Complete your business profile to get the most out of ShopWISE.</p>
            </div>
            <Button
              onClick={() => navigate('/onboarding')}
              className="shrink-0 text-black"
              style={{
                backgroundColor: '#a3e635',
                borderColor: '#a3e635',
                color: '#000000',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#84cc16';
                e.currentTarget.style.borderColor = '#84cc16';
                e.currentTarget.style.color = '#000000';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#a3e635';
                e.currentTarget.style.borderColor = '#a3e635';
                e.currentTarget.style.color = '#000000';
              }}
            >
              Complete Setup
            </Button>
          </div>
        </div>
      )}

      {/* Greeting Section */}
      <WelcomeSection
        welcomeMessage={welcomeMessage}
        subText={`Here is the summary of what is happening presently at ${activeTenant?.name || 'your business'}.`}
      />

      {/* Date Filter Buttons */}
      <DateFilterButtons
        activeFilter={activeFilter}
        onTodayClick={setTodayFilter}
        onWeekClick={setThisWeekFilter}
        onMonthClick={setThisMonthFilter}
        onYearClick={setThisYearFilter}
        onDateRangeChange={handleDateRangeChange}
        dateRange={dateRange}
        onAddClick={() => navigate(isShop || isPharmacy ? '/pos' : '/jobs', { state: { openModal: true } })}
        addButtonLabel={isShop || isPharmacy ? 'Add sale' : 'Add job'}
      />

      {/* Non-blocking refetch indicator */}
      {isRefetching && (
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
          <Loader2 className="h-4 w-4 animate-spin text-[#166534]" />
          <span>Updating…</span>
        </div>
      )}

      {/* KPI Cards */}
      <DashboardStatsCards
        revenueValue={revenueValue}
        expenseValue={expenseValue}
        profitValue={profitValue}
        newCustomers={displayData?.summary?.newCustomers || 0}
        isShop={isShop}
        isPharmacy={isPharmacy}
        comparisonData={comparisonData}
        activeFilter={activeFilter}
      />

      {isStaffShopOrPharmacy ? (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick sale – tap a product to sell</h2>
          {staffProductsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="border border-gray-200">
                  <CardContent className="pt-6">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-6 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !staffProducts || staffProducts.length === 0 ? (
            <Card className="border border-gray-200">
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600">No products to sell</p>
                <p className="text-sm text-gray-500 mt-1">Add products in Products, or go to POS to search and scan.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {staffProducts.map((product) => (
                <Card
                  key={product.id}
                  className="border border-gray-200 cursor-pointer transition-colors hover:border-green-500 hover:bg-green-50"
                  onClick={() => navigate('/pos', { state: { addProductId: product.id } })}
                >
                  <CardContent className="p-4 flex flex-col items-center justify-center min-h-[100px]">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mb-2">
                      <Package className="h-5 w-5 text-gray-500" />
                    </div>
                    <p className="font-medium text-gray-900 text-center line-clamp-2 text-sm">{product.name}</p>
                    <p className="text-green-700 font-semibold text-sm mt-1">
                      {CURRENCY.SYMBOL} {Number(product.sellingPrice ?? 0).toFixed(CURRENCY.DECIMAL_PLACES)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
      <Row gutter={[16, 16]} style={{ marginTop: 32 }}>
        <Col span={16}>
          <DashboardJobsTable
            jobs={recentJobs}
            loading={loading}
            title={isShop || isPharmacy ? "Recent Sales" : "Jobs In Progress"}
            getDueDateStatus={getDueDateStatus}
            pageSize={jobsPagination.pageSize}
            isSalesTable={isShop || isPharmacy}
          />
        </Col>
        <Col span={8}>
          <Card style={{ height: '100%' }}>
            <CardHeader>
              <CardTitle>Notice board</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingNotifications ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : notifications.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                  No notifications
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {notifications.map((notification) => {
                    // Parse notification text to bold numbers, percentages, status terms, and key phrases
                    let text = notification.message || notification.title || '';
                    
                    // Helper function to escape HTML
                    const escapeHtml = (str) => {
                      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    };
                    
                    // First, escape the entire text to prevent XSS
                    text = escapeHtml(text);
                    
                    // Mark already wrapped content to prevent double-wrapping
                    const WRAP_MARKER = '___WRAP_MARKER___';
                    
                    // Bold currency patterns: GH¢12,500 or ¢7,200
                    text = text.replace(/(GH¢|¢)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g, (match, currency, number) => {
                      return `${currency}${WRAP_MARKER}<strong>${number}</strong>${WRAP_MARKER}`;
                    });
                    
                    // Bold percentages: 4.3%, 34% (but not if already wrapped)
                    text = text.replace(new RegExp(`(?!${WRAP_MARKER})(\\d+(?:\\.\\d+)?%)`, 'g'), `${WRAP_MARKER}<strong>$1</strong>${WRAP_MARKER}`);
                    
                    // Bold standalone numbers with units: "3 new leads", "2,400 views", "1 profile click"
                    text = text.replace(new RegExp(`(?!${WRAP_MARKER})(\\d{1,3}(?:,\\d{3})*)\\s+(new leads|views|profile click|profile clicks)`, 'gi'), `${WRAP_MARKER}<strong>$1 $2</strong>${WRAP_MARKER}`);
                    
                    // Bold status and action terms: "due today", "paid", "submitted", "reached", "recorded"
                    text = text.replace(/\b(due today|paid|submitted|reached|recorded|follow up|retarget|well below|strong engagement|improve conversion|tailored offers)\b/gi, `${WRAP_MARKER}<strong>$1</strong>${WRAP_MARKER}`);
                    
                    // Bold time phrases: "in 4 hours", "after 5 hours"
                    text = text.replace(/\b(in|after)\s+(\d+)\s+(hours?|days?)\b/gi, `$1 ${WRAP_MARKER}<strong>$2 $3</strong>${WRAP_MARKER}`);
                    
                    // Bold company/business names (capitalized words ending with Ltd, Inc, etc.)
                    text = text.replace(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Ltd|Inc|LLC|Corp|Co))\.?\b/g, `${WRAP_MARKER}<strong>$1</strong>${WRAP_MARKER}`);
                    
                    // Bold important descriptive phrases
                    text = text.replace(/\b(including|via|from|so far|promptly|well below usual)\b/gi, `${WRAP_MARKER}<strong>$1</strong>${WRAP_MARKER}`);
                    
                    // Bold phrases like "returning visitor rate is 34%"
                    text = text.replace(/(returning visitor rate is)\s+(\d+(?:\.\d+)?%)/gi, `$1 ${WRAP_MARKER}<strong>$2</strong>${WRAP_MARKER}`);
                    
                    // Bold phrases like "has a 4.3% open rate"
                    text = text.replace(/(has a)\s+(\d+(?:\.\d+)?%)\s+(open rate)/gi, `$1 ${WRAP_MARKER}<strong>$2</strong>${WRAP_MARKER} $3`);
                    
                    // Remove markers
                    text = text.replace(new RegExp(WRAP_MARKER, 'g'), '');
                    
                    return (
                      <div
                        key={notification.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                        }}
                      >
                        <ChevronRight className="h-4 w-4" style={{ color: '#4CAF50', marginTop: 2, flexShrink: 0 }} />
                        <div 
                          style={{ 
                            flex: 1, 
                            fontSize: 14, 
                            color: '#666', 
                            lineHeight: 1.6,
                            fontWeight: 400
                          }}
                          dangerouslySetInnerHTML={{ __html: text }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </Col>
      </Row>
      )}
      </>
    </div>
  );
};

export default Dashboard;


