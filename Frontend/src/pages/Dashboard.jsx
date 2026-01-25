import { useState, useEffect, useMemo, useCallback } from 'react';
import { Row, Col, Statistic, Table, Tag, Spin, DatePicker, Space, Button, Divider, Tooltip, Alert, Modal } from 'antd';
import { Card as AntdCard } from 'antd';
import StatusChip from '../components/StatusChip';
import TableSkeleton from '../components/TableSkeleton';
import DetailSkeleton from '../components/DetailSkeleton';
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
  Briefcase,
  Inbox,
  AlertTriangle,
  Info,
  Wallet,
  UserPlus,
} from 'lucide-react';
import { Empty } from '../components/ui/empty';
import { Skeleton } from '../components/ui/skeleton';
import { Card, CardContent } from '../components/ui/card';
import { useNavigate } from 'react-router-dom';
import dashboardService from '../services/dashboardService';
import notificationService from '../services/notificationService';
import settingsService from '../services/settingsService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
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
  const { user, activeTenant, activeTenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [dateRange, setDateRange] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [jobsPagination, setJobsPagination] = useState({ current: 1, pageSize: 5 });
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const queryClient = useQueryClient();

  // Fetch organization settings to check for logo (when onboarding not yet completed)
  const { data: organizationData } = useQuery({
    queryKey: ['settings', 'organization'],
    queryFn: () => settingsService.getOrganizationSettings(),
    enabled: !activeTenant?.metadata?.onboarding?.completedAt,
  });

  // Define fetchDashboardData BEFORE useEffect that uses it
  const fetchDashboardData = useCallback(async (startDate = null, endDate = null) => {
    try {
      const response = await dashboardService.getOverview(startDate, endDate);
      setOverview(response.data);
    } catch (error) {
      showError(null, 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Fetch overall data by default
    const loadInitialData = async () => {
      setLoading(true);
      await fetchDashboardData();
    };
    loadInitialData();
  }, [fetchDashboardData]);

  useEffect(() => {
    // Fetch notifications for notice board
    const fetchNotifications = async () => {
      setLoadingNotifications(true);
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
    };
    fetchNotifications();
  }, []);

  const handleDateRangeChange = useCallback(async (dates) => {
    setLoading(true);
    setDateRange(dates);
    setActiveFilter(null); // Clear active filter when custom date range is used
    if (dates && dates[0] && dates[1]) {
      const startDate = dates[0].format('YYYY-MM-DD');
      const endDate = dates[1].format('YYYY-MM-DD');
      await fetchDashboardData(startDate, endDate);
    } else {
      // If no date range selected, fetch all data
      await fetchDashboardData();
    }
  }, [fetchDashboardData]);

  const clearFilters = useCallback(async () => {
    setLoading(true);
    setDateRange(null);
    setActiveFilter(null);
    await fetchDashboardData();
  }, [fetchDashboardData]);

  // Quick date filter functions
  const setTodayFilter = useCallback(async () => {
    setLoading(true);
    const today = dayjs();
    const range = [today, today];
    setDateRange(range);
    setActiveFilter('today');
    await fetchDashboardData(today.format('YYYY-MM-DD'), today.format('YYYY-MM-DD'));
  }, [fetchDashboardData]);

  const setYesterdayFilter = useCallback(async () => {
    setLoading(true);
    const yesterday = dayjs().subtract(1, 'day');
    const range = [yesterday, yesterday];
    setDateRange(range);
    setActiveFilter('yesterday');
    await fetchDashboardData(yesterday.format('YYYY-MM-DD'), yesterday.format('YYYY-MM-DD'));
  }, [fetchDashboardData]);

  const setThisWeekFilter = useCallback(async () => {
    setLoading(true);
    const startOfWeek = dayjs().startOf('isoWeek');
    const endOfWeek = dayjs().endOf('isoWeek');
    const range = [startOfWeek, endOfWeek];
    setDateRange(range);
    setActiveFilter('week');
    await fetchDashboardData(startOfWeek.format('YYYY-MM-DD'), endOfWeek.format('YYYY-MM-DD'));
  }, [fetchDashboardData]);

  const setThisMonthFilter = useCallback(async () => {
    setLoading(true);
    const startOfMonth = dayjs().startOf('month');
    const endOfMonth = dayjs().endOf('month');
    const range = [startOfMonth, endOfMonth];
    setDateRange(range);
    setActiveFilter('month');
    await fetchDashboardData(startOfMonth.format('YYYY-MM-DD'), endOfMonth.format('YYYY-MM-DD'));
  }, [fetchDashboardData]);

  const setThisQuarterFilter = useCallback(async () => {
    setLoading(true);
    const currentQuarter = Math.floor(dayjs().month() / 3);
    const startOfQuarter = dayjs().startOf('year').add(currentQuarter * 3, 'months');
    const endOfQuarter = startOfQuarter.add(2, 'months').endOf('month');
    const range = [startOfQuarter, endOfQuarter];
    setDateRange(range);
    setActiveFilter('quarter');
    await fetchDashboardData(startOfQuarter.format('YYYY-MM-DD'), endOfQuarter.format('YYYY-MM-DD'));
  }, [fetchDashboardData]);

  const setThisYearFilter = useCallback(async () => {
    setLoading(true);
    const startOfYear = dayjs().startOf('year');
    const endOfYear = dayjs().endOf('year');
    const range = [startOfYear, endOfYear];
    setDateRange(range);
    setActiveFilter('year');
    await fetchDashboardData(startOfYear.format('YYYY-MM-DD'), endOfYear.format('YYYY-MM-DD'));
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

  const recentJobsColumns = useMemo(() => [
    {
      title: 'Job Number',
      dataIndex: 'jobNumber',
      key: 'jobNumber',
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Customer',
      dataIndex: ['customer', 'name'],
      key: 'customer',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <StatusChip status={status} />
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('MMM DD, YYYY'),
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (dueDate) => {
        const { color, label, formatted } = getDueDateStatus(dueDate);
        return (
          <Space direction="vertical" size={0}>
            <span>{formatted}</span>
            {label && (
              <Tag color={color} style={{ marginTop: 4 }}>
                {label}
              </Tag>
            )}
          </Space>
        );
      }
    },
  ], [getDueDateStatus]);

  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  // Use filtered data if available, otherwise use overview data
  const displayData = useMemo(() => overview, [overview]);
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

  // Check for logo in both locations: tenant metadata and organization settings
  const organization = useMemo(() => organizationData?.data || {}, [organizationData]);
  const hasLogo = useMemo(() => !!(activeTenant?.metadata?.logo || organization?.logoUrl), [activeTenant?.metadata?.logo, organization?.logoUrl]);

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
  // 2. All required items are present (name, logo, tax settings)
  const onboardingCompleted = useMemo(() => {
    // Explicitly marked as complete
    if (activeTenant?.metadata?.onboarding?.completedAt) {
      return true;
    }
    // Implicitly complete if all setup items are present
    return hasBusinessName && hasLogo && hasTaxSettings;
  }, [activeTenant?.metadata?.onboarding?.completedAt, hasBusinessName, hasLogo, hasTaxSettings]);
  
  const showSetupBanner = useMemo(() => !onboardingCompleted, [onboardingCompleted]);

  // Welcome messages based on mode
  const welcomeMessages = useMemo(() => ({
    shop: "Welcome to Nexpro for Shops 👋",
    pharmacy: "Welcome to Nexpro for Pharmacies 👋",
    printing_press: "Welcome to Nexpro for Studios 👋"
  }), []);

  const welcomeMessage = useMemo(() => welcomeMessages[businessType] || welcomeMessages.printing_press, [welcomeMessages, businessType]);

  // Early return AFTER all hooks
  if (loading) {
    return (
      <div className="space-y-6">
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
    <div style={{ position: 'relative' }}>
      {/* Unified Dashboard for all business types */}
      <>
      {/* Setup Checklist Banner */}
      {showSetupBanner && (
        <Card className="mb-6 border-[#166534] bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Finish setting up your workspace</h3>
                <p className="text-sm text-gray-600 mb-4">Complete these steps to get the most out of Nexpro:</p>
                <ul className="space-y-2 text-sm text-gray-700">
                  {!activeTenant?.name && (
                    <li className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300"></div>
                      Add business name
                    </li>
                  )}
                  {!hasLogo && (
                    <li className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300"></div>
                      Upload logo
                    </li>
                  )}
                  {!hasTaxSettings && (
                    <li className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300"></div>
                      Configure tax settings
                    </li>
                  )}
                </ul>
              </div>
              <Button
                onClick={() => navigate('/onboarding')}
                className="bg-[#166534] hover:bg-[#14532d] text-white"
              >
                Complete Setup
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Greeting Section */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 8px 0', color: '#1a1a1a' }}>
          {welcomeMessage}
        </h1>
        <p style={{ fontSize: 16, color: '#666', margin: 0 }}>
          Here is the summary of how what is happening presently at {activeTenant?.name || 'your business'}.
        </p>
        </div>

      {/* Date Filter Buttons */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 32, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
          <Button
            onClick={setTodayFilter}
          style={{
              backgroundColor: activeFilter === 'today' ? '#166534' : 'white',
              color: activeFilter === 'today' ? 'white' : '#666',
              border: activeFilter === 'today' ? 'none' : '1px solid #e5e7eb',
              borderRadius: 0,
              borderTopLeftRadius: 8,
              borderBottomLeftRadius: 8,
              fontWeight: activeFilter === 'today' ? 600 : 400,
              padding: '8px 16px',
              height: 'auto',
              margin: 0,
              borderRight: 'none'
            }}
                >
                  Today
                </Button>
                <Button
                  onClick={setThisWeekFilter}
                          style={{
              backgroundColor: activeFilter === 'week' ? '#166534' : 'white',
              color: activeFilter === 'week' ? 'white' : '#666',
              border: activeFilter === 'week' ? 'none' : '1px solid #e5e7eb',
              borderRadius: 0,
              fontWeight: activeFilter === 'week' ? 600 : 400,
              padding: '8px 16px',
              height: 'auto',
              margin: 0,
              borderRight: 'none'
            }}
          >
            This week
                </Button>
            <Button
                  onClick={setThisMonthFilter}
            style={{
              backgroundColor: activeFilter === 'month' ? '#166534' : 'white',
              color: activeFilter === 'month' ? 'white' : '#666',
              border: activeFilter === 'month' ? 'none' : '1px solid #e5e7eb',
              borderRadius: 0,
              fontWeight: activeFilter === 'month' ? 600 : 400,
              padding: '8px 16px',
              height: 'auto',
              margin: 0,
              borderRight: 'none'
            }}
          >
            This month
            </Button>
            <Button
            onClick={setThisYearFilter}
            style={{
              backgroundColor: activeFilter === 'year' ? '#166534' : 'white',
              color: activeFilter === 'year' ? 'white' : '#666',
              border: activeFilter === 'year' ? 'none' : '1px solid #e5e7eb',
              borderRadius: 0,
              borderTopRightRadius: 8,
              borderBottomRightRadius: 8,
              fontWeight: activeFilter === 'year' ? 600 : 400,
              padding: '8px 16px',
              height: 'auto',
              margin: 0
            }}
          >
            This year
            </Button>
            <Button 
            icon={<Calendar className="h-4 w-4" />}
              onClick={() => {
              // Open date picker
              const rangePicker = document.querySelector('.ant-picker');
              if (rangePicker) {
                rangePicker.click();
              }
            }}
          style={{
              backgroundColor: 'white',
              color: '#666',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '8px 16px',
              height: 'auto',
              marginLeft: 8,
            display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            Select date
                </Button>
            </div>
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => navigate(isShop || isPharmacy ? '/sales/new' : '/jobs', { state: { openModal: true } })}
            style={{
            backgroundColor: '#166534',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            height: 'auto',
            fontWeight: 600,
              display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          {isShop || isPharmacy ? 'Add sale' : 'Add job'}
                </Button>
            </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        {/* Total Revenue Card */}
        <Col xs={24} sm={12} lg={6}>
          <Card 
            styles={{ body: { padding: 20 } }}
            style={{
              borderRadius: 12, 
              border: '1px solid #e5e7eb', 
              backgroundColor: 'white'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: '#666', fontWeight: 700 }}>{isShop || isPharmacy ? 'Total sales:' : 'Total revenue:'}</div>
              <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: '50%', 
                backgroundColor: 'rgba(139, 92, 246, 0.1)', 
                display: 'flex',
                alignItems: 'center', 
                justifyContent: 'center'
              }}>
                {isShop || isPharmacy ? <ShoppingCart className="h-5 w-5" style={{ color: '#8b5cf6' }} /> : <DollarSign className="h-5 w-5" style={{ color: '#8b5cf6' }} />}
        </div>
      </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.2 }}>
                GHS {revenueValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
              </div>
            <div style={{ fontSize: 12, color: '#166534', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
              <span>↑ GHS {(revenueValue * 0.2).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} vrs yesterday</span>
            </div>
          </Card>
        </Col>

        {/* Total Expenses Card */}
        <Col xs={24} sm={12} lg={6}>
          <Card 
            styles={{ body: { padding: 20 } }}
            style={{
              borderRadius: 12, 
              border: '1px solid #e5e7eb', 
              backgroundColor: 'white'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: '#666', fontWeight: 700 }}>Total expense:</div>
              <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: '50%', 
                backgroundColor: 'rgba(249, 115, 22, 0.1)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center'
              }}>
                <ShoppingCart className="h-5 w-5" style={{ color: '#f97316' }} />
                  </div>
              </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.2 }}>
                GHS {expenseValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
              </div>
            <div style={{ fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
              <span>↑ GHS {(expenseValue * 0.25).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} vrs yesterday</span>
            </div>
          </Card>
        </Col>

        {/* Profit Made Card */}
        <Col xs={24} sm={12} lg={6}>
          <Card 
            bodyStyle={{ padding: 20 }}
            style={{ 
              borderRadius: 12, 
              border: '1px solid #e5e7eb', 
              backgroundColor: 'white'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: '#666', fontWeight: 700 }}>Profit made:</div>
              <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: '50%', 
                backgroundColor: 'rgba(132, 204, 22, 0.1)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center'
              }}>
                <TrendingUp className="h-5 w-5" style={{ color: '#84cc16' }} />
                  </div>
              </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.2 }}>
                GHS {profitValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
              </div>
            <div style={{ fontSize: 12, color: '#166534', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
              <span>↑ GHS {(profitValue * 0.15).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} vrs yesterday</span>
            </div>
          </Card>
        </Col>

        {/* New Customers Card */}
        <Col xs={24} sm={12} lg={6}>
      <Card
            bodyStyle={{ padding: 20 }}
                style={{
                  borderRadius: 12,
              border: '1px solid #e5e7eb', 
              backgroundColor: 'white'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: '#666', fontWeight: 700 }}>New customers:</div>
              <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: '50%', 
                backgroundColor: 'rgba(22, 101, 52, 0.1)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center'
              }}>
                <Users className="h-5 w-5" style={{ color: '#166534' }} />
                  </div>
                  </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.2 }}>
                {displayData?.summary?.newCustomers || 0}
            </div>
              </div>
            <div style={{ fontSize: 12, color: '#166534', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
              <span>↑ {Math.floor((displayData?.summary?.newCustomers || 0) * 0.25)} vrs yesterday</span>
                </div>
              </Card>
            </Col>
        </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 32 }}>
        <Col span={16}>
          <Card title={isShop || isPharmacy ? "Recent Sales" : "Jobs In Progress"}>
            <Table
              dataSource={displayData?.recentJobs || []}
              columns={recentJobsColumns}
              rowKey="id"
              locale={{
                emptyText: (
                  <Empty
                    description="No jobs found"
                    image={<Briefcase className="h-12 w-12 text-muted-foreground" />}
                  />
                )
              }}
              pagination={{ 
                current: jobsPagination.current,
                pageSize: jobsPagination.pageSize,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} jobs`,
                pageSizeOptions: ['5', '10', '20', '50'],
                onChange: (page, pageSize) => {
                  setJobsPagination({ current: page, pageSize: pageSize || jobsPagination.pageSize });
                }
              }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Notice board" style={{ height: '100%' }}>
            {loadingNotifications ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                <Spin />
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                No notifications
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {notifications.map((notification, index) => (
                  <div
                    key={notification.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      paddingBottom: index < notifications.length - 1 ? 16 : 0,
                      paddingTop: index > 0 ? 16 : 0,
                      borderBottom: index < notifications.length - 1 ? '1px solid #f0f0f0' : 'none',
                    }}
                  >
                    <ChevronRight className="h-4 w-4" style={{ color: '#166534', marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 14, color: '#1a1a1a', lineHeight: 1.5 }}>
                      {notification.message || notification.title}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>
      </>
    </div>
  );
};

export default Dashboard;


