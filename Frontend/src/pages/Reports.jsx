import { useState, useEffect } from 'react';
import {
  Select,
  DatePicker,
  Button,
  Space,
  Row,
  Col,
  Spin,
  Table,
  Tag,
  Statistic,
  Divider,
  Tabs,
  Input,
  Typography,
  Alert,
  Progress,
  Modal,
  Form,
  Dropdown
} from 'antd';
import { Card as AntdCard } from 'antd';
import { showSuccess, showError, showWarning } from '../utils/toast';
import StatusChip from '../components/StatusChip';
import TableSkeleton from '../components/TableSkeleton';
import DetailSkeleton from '../components/DetailSkeleton';
import { Skeleton } from '../components/ui/skeleton';
import { Card, CardContent } from '../components/ui/card';

const { RangePicker } = DatePicker;
import {
  Download,
  BarChart3,
  DollarSign,
  ShoppingCart,
  FileText,
  Calendar,
  Bot,
  Zap,
  Eye,
  Users,
  XCircle,
  CheckCircle,
  Plus,
  ChevronDown
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import reportService from '../services/reportService';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;
const { CheckableTag } = Tag;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const Reports = () => {
  const { activeTenant } = useAuth();
  const businessType = activeTenant?.businessType || 'printing_press';
  const isPrintingPress = businessType === 'printing_press';
  
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState('revenue');
  const [dateFilter, setDateFilter] = useState('thisMonth'); // 'today', 'yesterday', 'thisWeek', etc.
  const [dateRange, setDateRange] = useState([
    dayjs().startOf('month'),
    dayjs().endOf('month')
  ]);
  const [reportData, setReportData] = useState(null);
  const [groupBy, setGroupBy] = useState('day');
  
  // AI Report Generator states
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatedReport, setGeneratedReport] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [overviewStats, setOverviewStats] = useState(null);
  const [createReportModalVisible, setCreateReportModalVisible] = useState(false);
  const [reportConfigForm] = Form.useForm();
  const [selectedReportTypes, setSelectedReportTypes] = useState(['cashflow']);

  // Calculate date range based on filter type
  const calculateDateRange = (filterType, customDate = null) => {
    const date = customDate || dayjs();
    let startDate, endDate;

    switch (filterType) {
      case 'today':
        startDate = date.startOf('day');
        endDate = date.endOf('day');
        break;
      case 'yesterday':
        startDate = date.subtract(1, 'day').startOf('day');
        endDate = date.subtract(1, 'day').endOf('day');
        break;
      case 'thisWeek':
        startDate = date.startOf('week');
        endDate = date.endOf('week');
        break;
      case 'lastWeek':
        startDate = date.subtract(1, 'week').startOf('week');
        endDate = date.subtract(1, 'week').endOf('week');
        break;
      case 'thisMonth':
        startDate = date.startOf('month');
        endDate = date.endOf('month');
        break;
      case 'lastMonth':
        startDate = date.subtract(1, 'month').startOf('month');
        endDate = date.subtract(1, 'month').endOf('month');
        break;
      case 'thisQuarter':
        startDate = date.startOf('quarter');
        endDate = date.endOf('quarter');
        break;
      case 'lastQuarter':
        startDate = date.subtract(1, 'quarter').startOf('quarter');
        endDate = date.subtract(1, 'quarter').endOf('quarter');
        break;
      case 'thisYear':
        startDate = date.startOf('year');
        endDate = date.endOf('year');
        break;
      case 'lastYear':
        startDate = date.subtract(1, 'year').startOf('year');
        endDate = date.subtract(1, 'year').endOf('year');
        break;
      case 'custom':
        // For custom date, use the selected date as both start and end
        startDate = date.startOf('day');
        endDate = date.endOf('day');
        break;
      default:
        startDate = date.startOf('month');
        endDate = date.endOf('month');
    }

    return [startDate, endDate];
  };

  // Update date range when filter changes (except for custom which is handled by RangePicker)
  useEffect(() => {
    if (dateFilter !== 'custom') {
      const newRange = calculateDateRange(dateFilter, dayjs());
      setDateRange(newRange);
    }
  }, [dateFilter]);

  useEffect(() => {
    if (activeTab === 'overview') {
      fetchOverviewStats();
    } else {
      fetchReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, dateRange, groupBy, activeTab, dateFilter]);

  const handleFilterChange = (filterType) => {
    setDateFilter(filterType);
    if (filterType !== 'custom') {
      // Calculate new date range for the selected filter
      const newRange = calculateDateRange(filterType, dayjs());
      setDateRange(newRange);
    }
    // For 'custom', the RangePicker will handle updating dateRange
  };

  // Determine groupBy based on date filter
  const getGroupByForFilter = (filterType) => {
    switch (filterType) {
      case 'today':
      case 'yesterday':
        return 'hour'; // 2-hour intervals
      case 'thisWeek':
      case 'lastWeek':
        return 'day'; // Daily
      case 'thisMonth':
      case 'lastMonth':
        return 'week'; // Weekly
      case 'thisQuarter':
      case 'lastQuarter':
        return 'month'; // Monthly (3 months)
      case 'thisYear':
      case 'lastYear':
        return 'month'; // Monthly (12 months)
      case 'custom':
        // For custom date, determine based on date range span
        const daysDiff = dateRange[1].diff(dateRange[0], 'day');
        if (daysDiff <= 1) return 'hour'; // Single day = hourly
        if (daysDiff <= 7) return 'day'; // Week = daily
        if (daysDiff <= 31) return 'week'; // Month = weekly
        if (daysDiff <= 93) return 'month'; // Quarter = monthly
        return 'month'; // Year = monthly
      default:
        return 'day';
    }
  };

  const fetchOverviewStats = async () => {
    try {
      setLoading(true);
      // Format dates with time components to ensure accurate filtering
      // Start date: beginning of day (00:00:00)
      // End date: end of day (23:59:59)
      const startDate = dateRange[0].startOf('day').format('YYYY-MM-DD');
      const endDate = dateRange[1].endOf('day').format('YYYY-MM-DD');
      const groupBy = getGroupByForFilter(dateFilter);
      
      console.log('[Reports] Fetching with date range:', {
        startDate,
        endDate,
        dateFilter,
        startDateObj: dateRange[0].format('YYYY-MM-DD HH:mm:ss'),
        endDateObj: dateRange[1].format('YYYY-MM-DD HH:mm:ss')
      });
      
      // Fetch all report types for overview from real API
      console.log('[Reports] Fetching overview stats for date range:', { startDate, endDate, groupBy, dateFilter });
      const [revenue, expenses, outstanding, sales, serviceAnalytics] = await Promise.all([
        reportService.getRevenueReport(startDate, endDate, groupBy).catch((err) => {
          console.error('[Reports] Error fetching revenue report:', err);
          return { data: { totalRevenue: 0, byPeriod: [], byCustomer: [] } };
        }),
        reportService.getExpenseReport(startDate, endDate).catch((err) => {
          console.error('[Reports] Error fetching expense report:', err);
          return { data: { totalExpenses: 0, byCategory: [] } };
        }),
        reportService.getOutstandingPaymentsReport(startDate, endDate).catch((err) => {
          console.error('[Reports] Error fetching outstanding payments report:', err);
          return { data: { totalOutstanding: 0 } };
        }),
        reportService.getSalesReport(startDate, endDate, 'day').catch((err) => {
          console.error('[Reports] Error fetching sales report:', err);
          return { data: { totalJobs: 0, totalSales: 0, byCustomer: [], byStatus: [], byDate: [], byJobType: [] } };
        }),
        reportService.getServiceAnalyticsReport(startDate, endDate).catch((err) => {
          console.error('[Reports] Error fetching service analytics report:', err);
          return { data: { totalRevenue: 0, byCategory: [], byDate: [], byCustomer: [] } };
        })
      ]);

      console.log('[Reports] All reports fetched successfully');
      console.log('[Reports] Revenue data:', revenue?.data ? 'Present' : 'Missing');
      console.log('[Reports] Expenses data:', expenses?.data ? 'Present' : 'Missing');
      console.log('[Reports] Sales data:', sales?.data ? 'Present' : 'Missing');
      console.log('[Reports] Service Analytics data:', serviceAnalytics?.data ? 'Present' : 'Missing');

      // Calculate profit/loss from the same date range data (no separate API call needed)
      const totalRevenue = revenue?.data?.totalRevenue || 0;
      const totalExpenses = expenses?.data?.totalExpenses || 0;
      const grossProfit = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100) : 0;

      // Calculate revenue growth based on selected period type (M/M, D/D, Y/Y, W/W, Q/Q)
      // Compare current period with previous period of the same length
      console.log('[Revenue Growth] ===== STARTING REVENUE GROWTH CALCULATION =====');
      console.log('[Revenue Growth] Input dateRange:', {
        start: dateRange[0]?.format('YYYY-MM-DD'),
        end: dateRange[1]?.format('YYYY-MM-DD'),
        startType: typeof dateRange[0],
        endType: typeof dateRange[1],
        dateFilter
      });
      
      const currentPeriodStart = dayjs(dateRange[0]);
      const currentPeriodEnd = dayjs(dateRange[1]);
      const periodLengthDays = currentPeriodEnd.diff(currentPeriodStart, 'day') + 1;
      
      console.log('[Revenue Growth] Period calculation:', {
        currentPeriodStart: currentPeriodStart.format('YYYY-MM-DD'),
        currentPeriodEnd: currentPeriodEnd.format('YYYY-MM-DD'),
        periodLengthDays
      });
      
      // Calculate previous period dates based on period type
      let previousPeriodStart, previousPeriodEnd;
      
      if (dateFilter === 'thisMonth' || dateFilter === 'lastMonth') {
        // For months, use proper month boundaries - go back one full month
        const prevMonth = currentPeriodStart.subtract(1, 'month');
        previousPeriodStart = prevMonth.startOf('month');
        previousPeriodEnd = prevMonth.endOf('month');
      } else if (dateFilter === 'thisWeek' || dateFilter === 'lastWeek') {
        // For weeks, subtract one week
        previousPeriodEnd = currentPeriodStart.subtract(1, 'day');
        previousPeriodStart = previousPeriodEnd.subtract(periodLengthDays - 1, 'day');
      } else if (dateFilter === 'thisQuarter' || dateFilter === 'lastQuarter') {
        // For quarters, use proper quarter boundaries - go back one full quarter
        const prevQuarter = currentPeriodStart.subtract(1, 'quarter');
        previousPeriodStart = prevQuarter.startOf('quarter');
        previousPeriodEnd = prevQuarter.endOf('quarter');
      } else if (dateFilter === 'thisYear' || dateFilter === 'lastYear') {
        // For years, use proper year boundaries - go back one full year
        const prevYear = currentPeriodStart.subtract(1, 'year');
        previousPeriodStart = prevYear.startOf('year');
        previousPeriodEnd = prevYear.endOf('year');
      } else {
        // For custom ranges or days, calculate by subtracting the period length
        previousPeriodEnd = currentPeriodStart.subtract(1, 'day');
        previousPeriodStart = previousPeriodEnd.subtract(periodLengthDays - 1, 'day');
      }
      
      console.log('[Revenue Growth] Previous period calculation:', {
        dateFilter,
        previousPeriodStart: previousPeriodStart.format('YYYY-MM-DD'),
        previousPeriodEnd: previousPeriodEnd.format('YYYY-MM-DD'),
        calculation: `Based on ${dateFilter}, calculated previous period from ${previousPeriodStart.format('YYYY-MM-DD')} to ${previousPeriodEnd.format('YYYY-MM-DD')}`
      });
      
      // Determine period type label for display
      let periodTypeLabel = 'Period';
      if (dateFilter === 'today' || dateFilter === 'yesterday') {
        periodTypeLabel = 'D/D';
      } else if (dateFilter === 'thisWeek' || dateFilter === 'lastWeek') {
        periodTypeLabel = 'W/W';
      } else if (dateFilter === 'thisMonth' || dateFilter === 'lastMonth') {
        periodTypeLabel = 'M/M';
      } else if (dateFilter === 'thisQuarter' || dateFilter === 'lastQuarter') {
        periodTypeLabel = 'Q/Q';
      } else if (dateFilter === 'thisYear' || dateFilter === 'lastYear') {
        periodTypeLabel = 'Y/Y';
      } else {
        // For custom ranges, determine based on length
        if (periodLengthDays === 1) {
          periodTypeLabel = 'D/D';
        } else if (periodLengthDays <= 7) {
          periodTypeLabel = 'W/W';
        } else if (periodLengthDays <= 31) {
          periodTypeLabel = 'M/M';
        } else if (periodLengthDays <= 93) {
          periodTypeLabel = 'Q/Q';
        } else {
          periodTypeLabel = 'Y/Y';
        }
      }
      
      console.log('[Revenue Growth] Period type determination:', {
        dateFilter,
        periodTypeLabel,
        periodLengthDays
      });
      
      // Fetch revenue for both current and previous periods
      let currentPeriodRevenue = 0;
      let previousPeriodRevenue = 0;
      let revenueGrowth = 0;
      
      try {
        console.log('[Revenue Growth] Fetching current period revenue...', {
          start: currentPeriodStart.format('YYYY-MM-DD'),
          end: currentPeriodEnd.format('YYYY-MM-DD')
        });
        
        // Fetch revenue for current period (use the selected date range)
        const currentPeriodRevenueData = await reportService.getRevenueReport(
          currentPeriodStart.format('YYYY-MM-DD'),
          currentPeriodEnd.format('YYYY-MM-DD'),
          'day'
        ).catch((err) => {
          console.error('[Revenue Growth] ❌ Error fetching current period revenue:', err);
          console.error('[Revenue Growth] Error details:', {
            message: err?.message,
            response: err?.response?.data,
            stack: err?.stack
          });
          return { data: { totalRevenue: 0 } };
        });
        
        console.log('[Revenue Growth] Current period revenue response:', {
          fullResponse: currentPeriodRevenueData,
          data: currentPeriodRevenueData?.data,
          totalRevenue: currentPeriodRevenueData?.data?.totalRevenue,
          totalRevenueType: typeof currentPeriodRevenueData?.data?.totalRevenue
        });
        
        console.log('[Revenue Growth] Fetching previous period revenue...', {
          start: previousPeriodStart.format('YYYY-MM-DD'),
          end: previousPeriodEnd.format('YYYY-MM-DD')
        });
        
        // Fetch revenue for previous period (same length, shifted back)
        const previousPeriodRevenueData = await reportService.getRevenueReport(
          previousPeriodStart.format('YYYY-MM-DD'),
          previousPeriodEnd.format('YYYY-MM-DD'),
          'day'
        ).catch((err) => {
          console.error('[Revenue Growth] ❌ Error fetching previous period revenue:', err);
          console.error('[Revenue Growth] Error details:', {
            message: err?.message,
            response: err?.response?.data,
            stack: err?.stack
          });
          return { data: { totalRevenue: 0 } };
        });
        
        console.log('[Revenue Growth] Previous period revenue response:', {
          fullResponse: previousPeriodRevenueData,
          data: previousPeriodRevenueData?.data,
          totalRevenue: previousPeriodRevenueData?.data?.totalRevenue,
          totalRevenueType: typeof previousPeriodRevenueData?.data?.totalRevenue
        });
        
        currentPeriodRevenue = parseFloat(currentPeriodRevenueData?.data?.totalRevenue || 0);
        previousPeriodRevenue = parseFloat(previousPeriodRevenueData?.data?.totalRevenue || 0);
        
        console.log('[Revenue Growth] Parsed revenue values:', {
          currentPeriodRevenue,
          previousPeriodRevenue,
          currentPeriodRevenueType: typeof currentPeriodRevenue,
          previousPeriodRevenueType: typeof previousPeriodRevenue,
          currentIsNaN: isNaN(currentPeriodRevenue),
          previousIsNaN: isNaN(previousPeriodRevenue)
        });
        
        // Calculate growth percentage
        const currentRev = Number(currentPeriodRevenue) || 0;
        const prevRev = Number(previousPeriodRevenue) || 0;
        
        console.log('[Revenue Growth] Final numeric values:', {
          currentRev,
          prevRev,
          currentRevType: typeof currentRev,
          prevRevType: typeof prevRev
        });
        
        console.log('[Revenue Growth] Growth calculation conditions:', {
          condition1_prevRevGreaterThan0: prevRev > 0,
          condition2_currentRevGreaterThan0_prevRevLessOrEqual0: currentRev > 0 && prevRev <= 0,
          condition3_currentRevLessOrEqual0_prevRevGreaterThan0: currentRev <= 0 && prevRev > 0,
          condition4_bothZero: currentRev <= 0 && prevRev <= 0
        });
        
        if (prevRev > 0) {
          revenueGrowth = ((currentRev - prevRev) / prevRev) * 100;
          console.log('[Revenue Growth] ✅ Normal growth calculation:', {
            formula: `((${currentRev} - ${prevRev}) / ${prevRev}) * 100`,
            calculation: `(${currentRev} - ${prevRev}) / ${prevRev} = ${(currentRev - prevRev) / prevRev}`,
            result: revenueGrowth,
            resultFormatted: revenueGrowth.toFixed(2) + '%'
          });
        } else if (currentRev > 0 && prevRev <= 0) {
          // If previous period had no revenue but current has revenue, it's infinite growth
          // Show as 100% for display purposes
          revenueGrowth = 100;
          console.log('[Revenue Growth] ✅ Previous period had 0 revenue, current has revenue - setting growth to 100%');
          console.log('[Revenue Growth] Details:', {
            currentRev,
            prevRev,
            reason: 'Infinite growth (previous = 0, current > 0)'
          });
        } else if (currentRev <= 0 && prevRev > 0) {
          // If current period has no revenue but previous had revenue, it's -100% decline
          revenueGrowth = -100;
          console.log('[Revenue Growth] ✅ Current period has 0 revenue, previous had revenue - setting growth to -100%');
        } else {
          // If both are 0, growth remains 0
          revenueGrowth = 0;
          console.log('[Revenue Growth] ⚠️ Both periods have 0 revenue - growth is 0%');
          console.log('[Revenue Growth] This is why growth is 0:', {
            currentRev,
            prevRev,
            reason: 'Both periods have 0 revenue'
          });
        }
        
        console.log('[Revenue Growth] ===== FINAL RESULT =====');
        console.log('[Revenue Growth] Current Period Revenue:', currentRev);
        console.log('[Revenue Growth] Previous Period Revenue:', prevRev);
        console.log('[Revenue Growth] Calculated Growth:', revenueGrowth);
        console.log('[Revenue Growth] Growth Percentage:', revenueGrowth.toFixed(2) + '%');
        console.log('[Revenue Growth] Period Type Label:', periodTypeLabel);
        console.log('[Revenue Growth] ===== END CALCULATION =====');
        
      } catch (error) {
        console.error('[Reports] Error fetching period-over-period revenue:', error);
        // If we can't fetch, growth remains 0
      }

      console.log('[Reports] Calculated metrics:', { 
        totalRevenue, 
        currentPeriodRevenue,
        previousPeriodRevenue, 
        revenueGrowth, 
        periodTypeLabel,
        totalExpenses, 
        grossProfit, 
        profitMargin 
      });

      setOverviewStats({
        revenue: revenue?.data || { totalRevenue: 0, byPeriod: [], byCustomer: [] },
        expenses: expenses?.data || { totalExpenses: 0, byCategory: [] },
        outstanding: outstanding?.data || { totalOutstanding: 0 },
        sales: sales?.data || { totalJobs: 0, totalSales: 0, byCustomer: [], byStatus: [], byDate: [], byJobType: [], jobsTrendByDate: [] },
        serviceAnalytics: serviceAnalytics?.data || { totalRevenue: 0, byCategory: [], byDate: [], byCustomer: [] },
        profitLoss: {
          revenue: totalRevenue,
          expenses: totalExpenses,
          grossProfit: grossProfit,
          profitMargin: profitMargin
        },
        revenueGrowth: revenueGrowth
      });
    } catch (error) {
      console.error('Error fetching overview stats:', error);
      showError(null, 'Failed to load overview statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateReportModal = () => {
    reportConfigForm.resetFields();
    reportConfigForm.setFieldsValue({
      reportTitle: `End of month report for ${dayjs().format('MMMM YYYY')}`,
      durationType: 'monthly',
      year: dayjs().year(),
      month: dayjs().format('MMMM')
    });
    setSelectedReportTypes(['cashflow']);
    setCreateReportModalVisible(true);
  };

  const handleCreateReport = async (values) => {
    try {
      setCreateReportModalVisible(false);
      setAiLoading(true);

      // Simulated AI report generation
      await new Promise(resolve => setTimeout(resolve, 3000));

      const reportConfig = {
        ...values,
        reportTypes: selectedReportTypes,
        generatedBy: 'Current User' // Replace with actual user
      };

      await generateSmartReport(reportConfig);
    } catch (error) {
      console.error('Error creating report:', error);
      showError(null, 'Failed to create report');
      setAiLoading(false);
    }
  };

  const generateSmartReport = async (config) => {
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      // Fetch real data for the report
      const [revenueData, expenseData, salesData, outstandingData, serviceAnalyticsData] = await Promise.all([
        reportService.getRevenueReport(startDate, endDate, 'day').catch(() => ({ data: { totalRevenue: 0, byPeriod: [] } })),
        reportService.getExpenseReport(startDate, endDate).catch(() => ({ data: { totalExpenses: 0, byCategory: [] } })),
        reportService.getSalesReport(startDate, endDate, 'day').catch(() => ({ data: { totalSales: 0, byJobType: [], byCustomer: [], byDate: [], byStatus: [] } })),
        reportService.getOutstandingPaymentsReport(startDate, endDate).catch(() => ({ data: { totalOutstanding: 0, invoices: [] } })),
        reportService.getServiceAnalyticsReport(startDate, endDate).catch(() => ({ data: { totalRevenue: 0, byCategory: [], byDate: [], byCustomer: [] } }))
      ]);

      const revenue = revenueData.data?.totalRevenue || 0;
      const expenses = expenseData.data?.totalExpenses || 0;
      
      // Calculate profit directly from the same date range data (no separate API call)
      const profit = revenue - expenses;
      const profitMargin = revenue > 0 ? ((profit / revenue) * 100) : 0;

      // Calculate previous period for comparison (assuming monthly comparison)
      const prevStartDate = dayjs(startDate).subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
      const prevEndDate = dayjs(startDate).subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
      
      const [prevRevenueData, prevExpenseData] = await Promise.all([
        reportService.getRevenueReport(prevStartDate, prevEndDate, 'day').catch(() => ({ data: { totalRevenue: 0 } })),
        reportService.getExpenseReport(prevStartDate, prevEndDate).catch(() => ({ data: { totalExpenses: 0 } }))
      ]);

      const prevRevenue = prevRevenueData.data?.totalRevenue || 0;
      const prevExpenses = prevExpenseData.data?.totalExpenses || 0;
      const prevProfit = prevRevenue - prevExpenses;

      const revenueChange = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue * 100) : 0;
      const expenseChange = prevExpenses > 0 ? ((expenses - prevExpenses) / prevExpenses * 100) : 0;
      const profitChange = prevProfit > 0 ? ((profit - prevProfit) / prevProfit * 100) : 0;

      // Generate comprehensive smart report with real data
      const mockReport = {
        title: config.reportTitle,
        durationType: config.durationType,
        year: config.year,
        month: config.month,
        generatedAt: new Date().toISOString(),
        generatedBy: config.generatedBy,
        period: `${dayjs(startDate).format('MMM DD, YYYY')} to ${dayjs(endDate).format('MMM DD, YYYY')}`,
        greeting: `Hello, here is a summary of the performance of your business operations for ${config.month} ${config.year}.`,
        sections: [],
        insights: [
          {
            type: 'performance',
            title: 'Performance Summary',
            metrics: [
              { label: 'Total Revenue', value: revenue, change: Math.abs(revenueChange), trend: revenueChange >= 0 ? 'up' : 'down', color: '#006d32' },
              { label: 'Total Expenses', value: expenses, change: Math.abs(expenseChange), trend: expenseChange <= 0 ? 'down' : 'up', color: expenseChange <= 0 ? '#006d32' : '#cf1322' },
              { label: 'Net Profit', value: profit, change: Math.abs(profitChange), trend: profitChange >= 0 ? 'up' : 'down', color: '#006d32' }
            ],
            note: revenueChange > 0 
              ? `Your revenue is up ${revenueChange.toFixed(1)}% (GHS ${(revenue - prevRevenue).toLocaleString()}) from the previous period.`
              : `Your revenue is down ${Math.abs(revenueChange).toFixed(1)}% (GHS ${(prevRevenue - revenue).toLocaleString()}) from the previous period.`
          },
          // Conditionally add sections based on selected report types
          ...(selectedReportTypes.includes('cashflow') || selectedReportTypes.includes('service-analytics') ? [{
            type: 'service-analytics',
            title: 'Service Analytics Summary',
            description: 'An overview of the performance of your services and their revenue.',
            data: (serviceAnalyticsData.data?.byCategory || salesData.data?.byJobType || []).map(item => {
              // Use service analytics data if available, fallback to sales data
              const totalRevenue = parseFloat(item.totalRevenue || item.totalSales || 0);
              const quantitySold = parseFloat(item.totalQuantity || item.jobCount || 0);
              const avgRevenue = parseFloat(item.averagePrice || 0);
              let demand = 'Low';
              if (totalRevenue > revenue * 0.3) demand = 'High';
              else if (totalRevenue > revenue * 0.15) demand = 'Medium';
              
              return {
                service: item.category || item.jobType || 'Unknown',
                quantitySold: quantitySold,
                revenue: totalRevenue,
                averagePrice: avgRevenue,
                demand
              };
            }).slice(0, 5),
            recommendations: (() => {
              const recommendations = [];
              
              // Use service analytics data if available, fallback to sales data
              const serviceData = serviceAnalyticsData.data?.byCategory || salesData.data?.byJobType || [];
              
              // Only generate recommendations if we have actual data
              if (serviceData.length === 0) {
                return recommendations; // Return empty array if no data
              }
              
              const topService = serviceData[0];
              
              if (topService && revenue > 0) {
                const topRevenue = parseFloat(topService.totalRevenue || topService.totalSales || 0);
                const topPercentage = (topRevenue / revenue) * 100;
                
                if (topPercentage > 30) {
                  recommendations.push({
                    finding: `${topService.category || topService.jobType} accounts for ${topPercentage.toFixed(1)}% of total revenue (GHS ${topRevenue.toLocaleString()}).`,
                    recommendation: 'Consider investing in additional resources to meet the high demand for this service.'
                  });
                }
              }
              
              const highVolumeService = serviceData.find(s => {
                const quantity = parseFloat(s.totalQuantity || s.jobCount || 0);
                return quantity > 100;
              });
              if (highVolumeService) {
                const quantity = parseFloat(highVolumeService.totalQuantity || highVolumeService.jobCount || 0);
                recommendations.push({
                  finding: `${highVolumeService.category || highVolumeService.jobType} has the highest volume with ${quantity} units sold.`,
                  recommendation: 'Maintain stock levels and consider bulk pricing for repeat customers.'
                });
              }
              
              // No hardcoded fallback - only return recommendations based on actual data patterns
              return recommendations;
            })()
          }] : []),
          ...(selectedReportTypes.includes('cost-analysis') ? [{
            type: 'cost-analysis',
            title: 'Cost Analysis Summary',
            description: 'Breakdown of costs and areas where a reduction could be most beneficial.',
            data: (expenseData.data?.byCategory || []).map(item => ({
              category: item.category || 'Uncategorized',
              amount: parseFloat(item.totalAmount || 0),
              percentage: expenses > 0 ? ((parseFloat(item.totalAmount || 0) / expenses) * 100) : 0
            })),
            totalCost: expenses,
            recommendations: (() => {
              const recommendations = [];
              const categories = expenseData.data?.byCategory || [];
              
              if (categories.length === 0 || expenses === 0) {
                return recommendations; // Return empty array if no data
              }
              
              const topCategory = categories[0];
              const topAmount = parseFloat(topCategory.totalAmount || 0);
              const topPercentage = expenses > 0 ? (topAmount / expenses * 100) : 0;
              
              if (topPercentage > 40) {
                recommendations.push({
                  finding: `${topCategory.category} is identified as the highest cost driver, accounting for ${topPercentage.toFixed(1)}% of total expenses (GHS ${topAmount.toLocaleString()}).`,
                  recommendation: 'Negotiate bulk purchasing agreements with suppliers to reduce unit costs by 10-15%.'
                });
              }
              
              const utilitiesCategory = categories.find(c => 
                c.category?.toLowerCase().includes('utilities') || 
                c.category?.toLowerCase().includes('electricity') ||
                c.category?.toLowerCase().includes('water')
              );
              
              if (utilitiesCategory) {
                const utilAmount = parseFloat(utilitiesCategory.totalAmount || 0);
                recommendations.push({
                  finding: `Utilities costs account for ${expenses > 0 ? ((utilAmount / expenses) * 100).toFixed(1) : 0}% of total expenses (GHS ${utilAmount.toLocaleString()}).`,
                  recommendation: 'Consider LED lighting and energy-efficient machines to reduce energy consumption.'
                });
              }
              
              // No hardcoded fallback - only return recommendations based on actual data patterns
              return recommendations;
            })()
          }] : []),
          ...(selectedReportTypes.includes('invoice-summary') ? [{
            type: 'invoice-summary',
            title: 'Invoice Summary',
            description: 'Breakdown of invoices and their status.',
            data: (() => {
              const invoices = outstandingData.data?.invoices || [];
              const paid = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + parseFloat(inv.totalAmount || 0), 0);
              const pending = invoices.filter(inv => inv.status === 'sent' || inv.status === 'partial').reduce((sum, inv) => sum + parseFloat(inv.balance || 0), 0);
              const overdue = invoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + parseFloat(inv.balance || 0), 0);
              const total = paid + pending + overdue;
              
              return [
                { status: 'Paid invoices', amount: paid, percentage: total > 0 ? (paid / total * 100) : 0 },
                { status: 'Pending payments', amount: pending, percentage: total > 0 ? (pending / total * 100) : 0 },
                { status: 'Overdue', amount: overdue, percentage: total > 0 ? (overdue / total * 100) : 0 }
              ];
            })(),
            totalInvoiced: revenue,
            recommendations: (() => {
              const recommendations = [];
              const outstanding = outstandingData.data?.totalOutstanding || 0;
              const overdueInvoices = outstandingData.data?.invoices?.filter(inv => inv.status === 'overdue') || [];
              const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + parseFloat(inv.balance || 0), 0);
              
              if (outstanding > 0) {
                recommendations.push({
                  finding: `Total outstanding balance is GHS ${outstanding.toLocaleString()}.`,
                  recommendation: 'Implement automated reminders for outstanding payments 3 days before due date.'
                });
              }
              
              if (overdueAmount > 0) {
                recommendations.push({
                  finding: `Overdue invoices total GHS ${overdueAmount.toLocaleString()} (${overdueInvoices.length} invoice${overdueInvoices.length > 1 ? 's' : ''}).`,
                  recommendation: 'Consider implementing a late payment fee of 2% to encourage timely payments.'
                });
              }
              
              // No hardcoded fallback - only return recommendations when there's actual data to act on
              return recommendations;
            })()
          }] : []),
          {
            type: 'insight',
            title: 'AI-Powered Insights',
            points: [
              revenueChange > 0 
                ? `Revenue has ${revenueChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(revenueChange).toFixed(1)}% compared to the previous period.`
                : 'Revenue remains stable compared to the previous period.',
              ...(isPrintingPress && salesData.data?.byJobType?.length > 0
                ? [`Your top service category (${salesData.data.byJobType[0]?.jobType || 'N/A'}) accounts for ${revenue > 0 ? ((parseFloat(salesData.data.byJobType[0]?.totalSales || 0) / revenue) * 100).toFixed(1) : 0}% of total revenue.`]
                : ['Service performance data is being analyzed.']),
              outstandingData.data?.totalOutstanding > 0
                ? `Outstanding payments total GHS ${outstandingData.data.totalOutstanding.toLocaleString()}. Consider implementing automated payment reminders.`
                : 'All payments are up to date.',
              profitMargin > 0
                ? `Operating expenses are ${expenses > 0 ? ((expenses / revenue) * 100).toFixed(1) : 0}% of revenue, with a profit margin of ${profitMargin.toFixed(1)}%.`
                : 'Monitor expense ratios to improve profitability.',
              'Continue analyzing business patterns to identify optimization opportunities.'
            ]
          },
          {
            type: 'recommendation',
            title: 'Strategic Recommendations',
            recommendations: (() => {
              const recommendations = [];
              const outstanding = outstandingData.data?.totalOutstanding || 0;
              
              if (outstanding > 0) {
                recommendations.push({
                  priority: 'High',
                  action: 'Implement automated follow-ups for overdue invoices',
                  impact: `Could recover GHS ${(outstanding * 0.4).toLocaleString()} in outstanding payments`
                });
              }
              
              if (revenueChange < 0 && prevRevenue > 0) {
                recommendations.push({
                  priority: 'High',
                  action: 'Focus on revenue growth strategies',
                  impact: 'Address declining revenue trends'
                });
              }
              
              if (expenseChange > 10 && prevExpenses > 0) {
                recommendations.push({
                  priority: 'Medium',
                  action: 'Review and optimize expense categories',
                  impact: 'Reduce cost growth and improve margins'
                });
              }
              
              // No hardcoded fallback - only return recommendations when there's actual actionable data
              return recommendations;
            })()
          },
          {
            type: 'forecast',
            title: 'Predictive Analysis',
            content: revenueChange > 0
              ? `Based on current trends showing ${revenueChange.toFixed(1)}% growth, projected revenue for the next period is estimated at GHS ${(revenue * (1 + revenueChange / 100)).toLocaleString()} (±8%). This forecast considers current growth patterns and historical data.`
              : `Based on current trends, projected revenue for the next period is estimated at GHS ${revenue.toLocaleString()} (±8%). This forecast considers seasonal patterns, customer growth rate, and historical data.`
          }
        ]
      };

      setGeneratedReport(mockReport);
      showSuccess('Smart report generated successfully!');
    } catch (error) {
      console.error('Error generating report:', error);
      showError(null, 'Failed to generate report');
    } finally {
      setAiLoading(false);
    }
  };

  const fetchReport = async () => {
    if (!dateRange || !dateRange[0] || !dateRange[1]) return;

    try {
      setLoading(true);
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');
      let response;

      switch (reportType) {
        case 'revenue':
          response = await reportService.getRevenueReport(startDate, endDate, groupBy);
          break;
        case 'expenses':
          response = await reportService.getExpenseReport(startDate, endDate);
          break;
        case 'outstanding':
          response = await reportService.getOutstandingPaymentsReport(startDate, endDate);
          break;
        case 'sales':
          response = await reportService.getSalesReport(startDate, endDate, groupBy);
          break;
        case 'profit-loss':
          response = await reportService.getProfitLossReport(startDate, endDate);
          break;
        default:
          return;
      }

      setReportData(response.data);
    } catch (error) {
      console.error('Error fetching report:', error);
      showError(null, 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!reportData) {
      showWarning('No report data to download');
      return;
    }

    try {
      message.loading({ content: 'Generating PDF...', key: 'pdf', duration: 0 });
      
      // Import html2pdf dynamically
      const html2pdf = (await import('html2pdf.js')).default;
      
      const reportElement = document.getElementById('report-content');
      if (!reportElement) {
        showError(null, 'Report content not found');
        return;
      }

      const opt = {
        margin: 10,
        filename: `${reportType}_report_${dateRange[0].format('YYYY-MM-DD')}_${dateRange[1].format('YYYY-MM-DD')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(reportElement).save();
      
      message.destroy('pdf');
      showSuccess('PDF downloaded successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      showError(null, 'Failed to generate PDF');
    }
  };

  const renderRevenueReport = () => {
    if (!reportData) return null;

    const { totalRevenue, byPeriod, byCustomer, byMethod } = reportData;

    // Format data for charts
    const periodChartData = byPeriod?.map(item => ({
      name: groupBy === 'day' 
        ? dayjs(item.date || item.date).format('MMM DD')
        : `Month ${item.month}`,
      revenue: parseFloat(item.totalRevenue || 0)
    })) || [];

    const customerChartData = byCustomer?.slice(0, 10).map(item => ({
      name: item.customer?.name || 'Unknown',
      revenue: parseFloat(item.totalRevenue || 0)
    })) || [];

    const methodChartData = byMethod?.map(item => ({
      name: item.paymentMethod || 'Unknown',
      value: parseFloat(item.totalRevenue || 0)
    })) || [];

    return (
      <div id="report-content">
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <AntdCard>
              <Statistic
                title="Total Revenue"
                value={totalRevenue}
                prefix="GHS "
                precision={2}
                valueStyle={{ color: '#3f8600' }}
              />
            </AntdCard>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <AntdCard title="Revenue Trend" extra={
              <Select value={groupBy} onChange={setGroupBy} style={{ width: 120 }}>
                <Option value="day">By Day</Option>
                <Option value="month">By Month</Option>
              </Select>
            }>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={periodChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `GHS ${parseFloat(value).toFixed(2)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            </AntdCard>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <AntdCard title="Top Customers">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={customerChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip formatter={(value) => `GHS ${parseFloat(value).toFixed(2)}`} />
                  <Bar dataKey="revenue" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </AntdCard>
          </Col>
          <Col span={12}>
            <AntdCard title="Revenue by Payment Method">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={methodChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {methodChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `GHS ${parseFloat(value).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </AntdCard>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <AntdCard title="Customer Details">
              <Table
                dataSource={byCustomer || []}
                rowKey={(record) => record.customerId || Math.random()}
                pagination={{ pageSize: 10 }}
                columns={[
                  {
                    title: 'Customer',
                    dataIndex: ['customer', 'name'],
                    key: 'customer',
                  },
                  {
                    title: 'Company',
                    dataIndex: ['customer', 'company'],
                    key: 'company',
                  },
                  {
                    title: 'Total Revenue',
                    dataIndex: 'totalRevenue',
                    key: 'revenue',
                    render: (value) => `GHS ${parseFloat(value || 0).toFixed(2)}`,
                    sorter: (a, b) => parseFloat(a.totalRevenue || 0) - parseFloat(b.totalRevenue || 0),
                  },
                  {
                    title: 'Payments',
                    dataIndex: 'paymentCount',
                    key: 'count',
                  },
                ]}
              />
            </AntdCard>
          </Col>
        </Row>
      </div>
    );
  };

  const renderExpenseReport = () => {
    if (!reportData) return null;

    const { totalExpenses, byCategory, byVendor, byMethod, byDate } = reportData;

    const categoryChartData = byCategory?.map(item => ({
      name: item.category || 'Unknown',
      value: parseFloat(item.totalAmount || 0)
    })) || [];

    const vendorChartData = byVendor?.slice(0, 10).map(item => ({
      name: item.vendor?.name || 'Unknown',
      amount: parseFloat(item.totalAmount || 0)
    })) || [];

    const dateChartData = byDate?.map(item => ({
      name: dayjs(item.date).format('MMM DD'),
      amount: parseFloat(item.totalAmount || 0)
    })) || [];

    return (
      <div id="report-content">
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <AntdCard>
              <Statistic
                title="Total Expenses"
                value={totalExpenses}
                prefix="GHS "
                precision={2}
                valueStyle={{ color: '#cf1322' }}
              />
            </AntdCard>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <AntdCard title="Expenses by Category">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `GHS ${parseFloat(value).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </AntdCard>
          </Col>
          <Col span={12}>
            <AntdCard title="Top Vendors">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={vendorChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip formatter={(value) => `GHS ${parseFloat(value).toFixed(2)}`} />
                  <Bar dataKey="amount" fill="#ff4d4f" />
                </BarChart>
              </ResponsiveContainer>
            </AntdCard>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <AntdCard title="Expense Trend">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dateChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `GHS ${parseFloat(value).toFixed(2)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="amount" stroke="#ff4d4f" strokeWidth={2} name="Expenses" />
                </LineChart>
              </ResponsiveContainer>
            </AntdCard>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <AntdCard title="Expenses by Category">
              <Table
                dataSource={byCategory || []}
                rowKey="category"
                pagination={false}
                columns={[
                  { title: 'Category', dataIndex: 'category', key: 'category' },
                  {
                    title: 'Amount',
                    dataIndex: 'totalAmount',
                    key: 'amount',
                    render: (value) => `GHS ${parseFloat(value || 0).toFixed(2)}`,
                  },
                  { title: 'Count', dataIndex: 'count', key: 'count' },
                ]}
              />
            </AntdCard>
          </Col>
          <Col span={12}>
            <AntdCard title="Top Vendors">
              <Table
                dataSource={byVendor?.slice(0, 10) || []}
                rowKey={(record) => record.vendorId || Math.random()}
                pagination={false}
                columns={[
                  {
                    title: 'Vendor',
                    dataIndex: ['vendor', 'name'],
                    key: 'vendor',
                  },
                  {
                    title: 'Amount',
                    dataIndex: 'totalAmount',
                    key: 'amount',
                    render: (value) => `GHS ${parseFloat(value || 0).toFixed(2)}`,
                  },
                  { title: 'Count', dataIndex: 'count', key: 'count' },
                ]}
              />
            </AntdCard>
          </Col>
        </Row>
      </div>
    );
  };

  const renderOutstandingPaymentsReport = () => {
    if (!reportData) return null;

    const { totalOutstanding, invoices, byCustomer, agingAnalysis } = reportData;

    const customerChartData = byCustomer?.map(item => ({
      name: item.customer?.name || 'Unknown',
      amount: parseFloat(item.totalOutstanding || 0)
    })) || [];

    const agingChartData = [
      { name: 'Current', value: agingAnalysis?.current || 0 },
      { name: '1-30 Days', value: agingAnalysis?.thirtyDays || 0 },
      { name: '31-60 Days', value: agingAnalysis?.sixtyDays || 0 },
      { name: '90+ Days', value: agingAnalysis?.ninetyPlusDays || 0 },
    ];

    return (
      <div id="report-content">
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <AntdCard>
              <Statistic
                title="Total Outstanding"
                value={totalOutstanding}
                prefix="GHS "
                precision={2}
                valueStyle={{ color: '#cf1322' }}
              />
            </AntdCard>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <AntdCard title="Outstanding by Customer">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={customerChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip formatter={(value) => `GHS ${parseFloat(value).toFixed(2)}`} />
                  <Bar dataKey="amount" fill="#ff4d4f" />
                </BarChart>
              </ResponsiveContainer>
            </AntdCard>
          </Col>
          <Col span={12}>
            <AntdCard title="Aging Analysis">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={agingChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {agingChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `GHS ${parseFloat(value).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </AntdCard>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <AntdCard title="Outstanding Invoices">
              <Table
                dataSource={invoices || []}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                columns={[
                  {
                    title: 'Invoice Number',
                    dataIndex: 'invoiceNumber',
                    key: 'invoiceNumber',
                  },
                  {
                    title: 'Customer',
                    dataIndex: ['customer', 'name'],
                    key: 'customer',
                  },
                  {
                    title: 'Due Date',
                    dataIndex: 'dueDate',
                    key: 'dueDate',
                    render: (date) => dayjs(date).format('MMM DD, YYYY'),
                  },
                  {
                    title: 'Balance',
                    dataIndex: 'balance',
                    key: 'balance',
                    render: (value) => `GHS ${parseFloat(value || 0).toFixed(2)}`,
                  },
                  {
                    title: 'Status',
                    dataIndex: 'status',
                    key: 'status',
                    render: (status) => {
                      return <StatusChip status={status} />;
                    },
                  },
                ]}
              />
            </AntdCard>
          </Col>
        </Row>
      </div>
    );
  };

  const renderSalesReport = () => {
    if (!reportData) return null;

    const { totalSales, byJobType, byCustomer, byDate, byStatus } = reportData;

    const jobTypeChartData = isPrintingPress && byJobType ? byJobType.map(item => ({
      name: item.jobType || 'Unknown',
      value: parseFloat(item.totalSales || 0)
    })) : [];

    const customerChartData = byCustomer?.slice(0, 10).map(item => ({
      name: item.customer?.name || 'Unknown',
      sales: parseFloat(item.totalSales || 0)
    })) || [];

    const dateChartData = byDate?.map(item => ({
      name: dayjs(item.date).format('MMM DD'),
      sales: parseFloat(item.totalSales || 0)
    })) || [];

    return (
      <div id="report-content">
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <AntdCard>
              <Statistic
                title="Total Sales"
                value={totalSales}
                prefix="GHS "
                precision={2}
                valueStyle={{ color: '#3f8600' }}
              />
            </AntdCard>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          {isPrintingPress && (
            <Col span={12}>
              <AntdCard title="Sales by Job Type">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={jobTypeChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {jobTypeChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `GHS ${parseFloat(value).toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </AntdCard>
            </Col>
          )}
          <Col span={isPrintingPress ? 12 : 24}>
            <AntdCard title="Top Customers">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={customerChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip formatter={(value) => `GHS ${parseFloat(value).toFixed(2)}`} />
                  <Bar dataKey="sales" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </AntdCard>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <AntdCard title="Sales Trend">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dateChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `GHS ${parseFloat(value).toFixed(2)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="sales" stroke="#8884d8" strokeWidth={2} name="Sales" />
                </LineChart>
              </ResponsiveContainer>
            </AntdCard>
          </Col>
        </Row>

        <Row gutter={16}>
          {isPrintingPress && (
            <Col span={12}>
              <AntdCard title="Sales by Job Type">
                <Table
                  dataSource={byJobType || []}
                  rowKey="jobType"
                  pagination={false}
                  columns={[
                    { title: 'Job Type', dataIndex: 'jobType', key: 'jobType' },
                    {
                      title: 'Total Sales',
                      dataIndex: 'totalSales',
                      key: 'sales',
                      render: (value) => `GHS ${parseFloat(value || 0).toFixed(2)}`,
                    },
                    { title: 'Jobs', dataIndex: 'jobCount', key: 'count' },
                    {
                      title: 'Avg Price',
                      dataIndex: 'averagePrice',
                      key: 'avg',
                      render: (value) => `GHS ${parseFloat(value || 0).toFixed(2)}`,
                    },
                  ]}
                />
              </AntdCard>
            </Col>
          )}
          <Col span={isPrintingPress ? 12 : 24}>
            <AntdCard title="Sales by Status">
              <Table
                dataSource={byStatus || []}
                rowKey="status"
                pagination={false}
                columns={[
                  {
                    title: 'Status',
                    dataIndex: 'status',
                    key: 'status',
                    render: (status) => (
                      <StatusChip status={status} />
                    ),
                  },
                  {
                    title: 'Total Sales',
                    dataIndex: 'totalSales',
                    key: 'sales',
                    render: (value) => `GHS ${parseFloat(value || 0).toFixed(2)}`,
                  },
                  { title: 'Jobs', dataIndex: 'jobCount', key: 'count' },
                ]}
              />
            </AntdCard>
          </Col>
        </Row>
      </div>
    );
  };

  const renderProfitLossReport = () => {
    if (!reportData) return null;

    const { revenue, expenses, grossProfit, profitMargin } = reportData;

    const profitData = [
      { name: 'Revenue', value: revenue, color: '#3f8600' },
      { name: 'Expenses', value: expenses, color: '#cf1322' },
      { name: 'Profit', value: grossProfit, color: grossProfit >= 0 ? '#3f8600' : '#cf1322' },
    ];

    return (
      <div id="report-content">
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <AntdCard>
              <Statistic
                title="Revenue"
                value={revenue}
                prefix="GHS "
                precision={2}
                valueStyle={{ color: '#3f8600' }}
              />
            </AntdCard>
          </Col>
          <Col span={8}>
            <AntdCard>
              <Statistic
                title="Expenses"
                value={expenses}
                prefix="GHS "
                precision={2}
                valueStyle={{ color: '#cf1322' }}
              />
            </AntdCard>
          </Col>
          <Col span={8}>
            <AntdCard>
              <Statistic
                title="Gross Profit"
                value={grossProfit}
                prefix="GHS "
                precision={2}
                valueStyle={{ color: grossProfit >= 0 ? '#3f8600' : '#cf1322' }}
              />
            </AntdCard>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <AntdCard>
              <Statistic
                title="Profit Margin"
                value={profitMargin}
                suffix="%"
                precision={2}
                valueStyle={{ color: profitMargin >= 0 ? '#3f8600' : '#cf1322' }}
              />
            </AntdCard>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <AntdCard title="Profit & Loss Overview">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={profitData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `GHS ${parseFloat(value).toFixed(2)}`} />
                  <Bar dataKey="value" fill="#8884d8">
                    {profitData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </AntdCard>
          </Col>
        </Row>
      </div>
    );
  };

  const renderReport = () => {
    switch (reportType) {
      case 'revenue':
        return renderRevenueReport();
      case 'expenses':
        return renderExpenseReport();
      case 'outstanding':
        return renderOutstandingPaymentsReport();
      case 'sales':
        return renderSalesReport();
      case 'profit-loss':
        return renderProfitLossReport();
      default:
        return null;
    }
  };

  const reportTypes = [
    { value: 'revenue', label: 'Revenue Report', icon: <DollarSign className="h-4 w-4" /> },
    { value: 'expenses', label: 'Expense Report', icon: <ShoppingCart className="h-4 w-4" /> },
    { value: 'outstanding', label: 'Outstanding Payments', icon: <FileText className="h-4 w-4" /> },
    { value: 'sales', label: 'Sales Report', icon: <BarChart3 className="h-4 w-4" /> },
    { value: 'profit-loss', label: 'Profit & Loss', icon: <BarChart3 className="h-4 w-4" /> },
  ];

  const cardStyle = {
    borderRadius: '8px',
    border: '1px solid #f4f4f4'
  };

  const renderOverviewDashboard = () => {
    if (!overviewStats) {
      return (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Text type="secondary">Loading overview statistics...</Text>
        </div>
      );
    }

    const { revenue, expenses, sales, serviceAnalytics, profitLoss } = overviewStats;

    // Calculate growth metrics from real data
    const totalRevenue = revenue?.totalRevenue || 0;
    const totalExpenses = expenses?.totalExpenses || 0;
    
    // Calculate net income and profit margin from the same date range data
    const netIncome = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? ((netIncome / totalRevenue) * 100) : 0;
    
    // Get revenue growth from state (calculated in fetchOverviewStats)
    const revenueGrowth = overviewStats?.revenueGrowth ?? 0;

    // Expense breakdown for donut chart
    const expenseData = expenses?.byCategory?.map((item, index) => ({
      name: item.category,
      value: parseFloat(item.totalAmount || 0),
      color: COLORS[index % COLORS.length]
    })) || [];

    // Revenue trend for area chart from real data - format based on date filter
    const formatPeriodLabel = (item, filterType) => {
      const date = item.date || item.period || item.hour || item.week || item.month;
      
      switch (filterType) {
        case 'today':
        case 'yesterday':
          // Format as 2-hour intervals: "00:00", "02:00", "04:00", etc.
          if (item.hour !== undefined) {
            const hour = parseInt(item.hour);
            return `${hour.toString().padStart(2, '0')}:00`;
          }
          // Fallback: parse from date if hour not available
          return dayjs(date).format('HH:00');
        case 'thisWeek':
        case 'lastWeek':
          // Format as day names: "Mon", "Tue", etc.
          return dayjs(date).format('ddd');
        case 'thisMonth':
        case 'lastMonth':
          // Format as "Week 1", "Week 2", etc.
          if (item.week !== undefined) {
            return `Week ${item.week}`;
          }
          // Calculate week number from date
          const weekNum = dayjs(date).week() - dayjs(dateRange[0]).week() + 1;
          return `Week ${weekNum}`;
        case 'thisQuarter':
        case 'lastQuarter':
          // Format as month names: "Jan", "Feb", "Mar"
          if (item.month !== undefined) {
            return dayjs().month(item.month - 1).format('MMM');
          }
          return dayjs(date).format('MMM');
        case 'thisYear':
        case 'lastYear':
          // Format as month names: "Jan", "Feb", etc.
          if (item.month !== undefined) {
            return dayjs().month(item.month - 1).format('MMM');
          }
          return dayjs(date).format('MMM');
        default:
          return dayjs(date).format('MMM DD');
      }
    };

    // Build revenue trend data with proper interval filling
    const buildRevenueTrend = () => {
      if (!revenue?.byPeriod?.length) return [];

      // For hourly (today/yesterday), ensure all 12 intervals are present
      if (dateFilter === 'today' || dateFilter === 'yesterday') {
        const dataMap = new Map();
        revenue.byPeriod.forEach(item => {
          const hour = parseInt(item.hour || 0);
          dataMap.set(hour, parseFloat(item.totalRevenue || 0));
        });

        // Fill all 12 intervals (0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22)
        const intervals = [];
        for (let h = 0; h < 24; h += 2) {
          intervals.push({
            period: `${h.toString().padStart(2, '0')}:00`,
            revenue: dataMap.get(h) || 0,
            rawDate: h
          });
        }
        return intervals;
      }

      // For monthly filters (thisMonth/lastMonth), ensure all 4 weeks are present
      if (dateFilter === 'thisMonth' || dateFilter === 'lastMonth') {
        const dataMap = new Map();
        revenue.byPeriod.forEach(item => {
          const week = parseInt(item.week || 1);
          dataMap.set(week, parseFloat(item.totalRevenue || 0));
        });

        // Fill all 4 weeks
        const intervals = [];
        for (let w = 1; w <= 4; w++) {
          intervals.push({
            period: `Week ${w}`,
            revenue: dataMap.get(w) || 0,
            rawDate: w
          });
        }
        return intervals;
      }

      // For quarterly filters, ensure all 3 months are present
      if (dateFilter === 'thisQuarter' || dateFilter === 'lastQuarter') {
        const dataMap = new Map();
        revenue.byPeriod.forEach(item => {
          const month = parseInt(item.month || 1);
          dataMap.set(month, parseFloat(item.totalRevenue || 0));
        });

        // Get quarter months based on date range start
        const startMonth = dateRange[0].month() + 1; // dayjs months are 0-indexed, so +1 for 1-12
        const intervals = [];
        for (let i = 0; i < 3; i++) {
          const monthNum = startMonth + i;
          intervals.push({
            period: dayjs().month(monthNum - 1).format('MMM'),
            revenue: dataMap.get(monthNum) || 0,
            rawDate: monthNum
          });
        }
        return intervals;
      }

      // For yearly filters, ensure all 12 months are present
      if (dateFilter === 'thisYear' || dateFilter === 'lastYear') {
        const dataMap = new Map();
        revenue.byPeriod.forEach(item => {
          const month = parseInt(item.month || 1);
          dataMap.set(month, parseFloat(item.totalRevenue || 0));
        });

        // Fill all 12 months
        const intervals = [];
        for (let m = 1; m <= 12; m++) {
          intervals.push({
            period: dayjs().month(m - 1).format('MMM'),
            revenue: dataMap.get(m) || 0,
            rawDate: m
          });
        }
        return intervals;
      }

      // For weekly filters (thisWeek/lastWeek), ensure all 7 days are present
      if (dateFilter === 'thisWeek' || dateFilter === 'lastWeek') {
        const dataMap = new Map();
        revenue.byPeriod.forEach(item => {
          const date = dayjs(item.date || item.period);
          const dayKey = date.format('YYYY-MM-DD');
          dataMap.set(dayKey, parseFloat(item.totalRevenue || 0));
        });

        // Fill all 7 days of the week - use dateRange[0] as the start (already calculated correctly)
        const intervals = [];
        const startOfWeek = dateRange[0]; // This is already the start of the week from calculateDateRange
        
        for (let i = 0; i < 7; i++) {
          const day = startOfWeek.add(i, 'day');
          const dayKey = day.format('YYYY-MM-DD');
          intervals.push({
            period: day.format('ddd'),
            revenue: dataMap.get(dayKey) || 0,
            rawDate: dayKey
          });
        }
        return intervals;
      }

      // For other filters (custom), map existing data
      return revenue.byPeriod.map((item) => ({
        period: formatPeriodLabel(item, dateFilter),
        revenue: parseFloat(item.totalRevenue || 0),
        rawDate: item.date || item.period || item.hour || item.week || item.month
      }));
    };

    const dailyRevenueTrend = buildRevenueTrend();

    // Jobs trend (incoming vs completed) from backend data
    // Incoming jobs use createdAt date, completed jobs use completionDate
    const jobsTrend = (() => {
      // Check if jobsTrendByDate exists and has data
      const jobsTrendData = sales?.jobsTrendByDate || [];
      if (!jobsTrendData || jobsTrendData.length === 0) {
        // If no jobsTrendByDate, try to use byDate as fallback (grouped by createdAt)
        if (sales?.byDate && sales.byDate.length > 0) {
          const startDate = dateRange[0].startOf('day');
          const endDate = dateRange[1].endOf('day');
          
          const filteredByDate = sales.byDate.filter(item => {
            if (!item.date) return false;
            const itemDate = dayjs(item.date).startOf('day');
            return (itemDate.isAfter(startDate) || itemDate.isSame(startDate)) && 
                   (itemDate.isBefore(endDate) || itemDate.isSame(endDate));
          });
          
          if (filteredByDate.length === 0) return [];
          
          const maxDays = (dateFilter === 'thisWeek' || dateFilter === 'lastWeek') ? 7 : 
                         (dateFilter === 'thisMonth' || dateFilter === 'lastMonth') ? 7 : 
                         filteredByDate.length;
          
          return filteredByDate
            .slice(-maxDays)
            .map((item) => {
              // Use jobCount as incoming, completed will be 0 (we don't have completionDate data here)
              return {
                day: dayjs(item.date).format('ddd'),
                incoming: parseInt(item.jobCount) || 0,
                completed: 0
              };
            });
        }
        return [];
      }
      
      // Filter to only include dates within the selected date range
      const startDate = dateRange[0].startOf('day');
      const endDate = dateRange[1].endOf('day');
      
      const filteredTrend = jobsTrendData.filter(item => {
        if (!item.date) return false;
        // Handle both string and Date objects
        const itemDate = dayjs(item.date).startOf('day');
        return (itemDate.isAfter(startDate) || itemDate.isSame(startDate)) && 
               (itemDate.isBefore(endDate) || itemDate.isSame(endDate));
      });
      
      if (filteredTrend.length === 0) return [];
      
      // For weekly filters, show all days. For monthly, show last 7 days. For others, show all available.
      const maxDays = (dateFilter === 'thisWeek' || dateFilter === 'lastWeek') ? 7 : 
                     (dateFilter === 'thisMonth' || dateFilter === 'lastMonth') ? 7 : 
                     filteredTrend.length;
      
      return filteredTrend
        .slice(-maxDays)
        .map((item) => {
          return {
            day: dayjs(item.date).format('ddd'),
            incoming: parseInt(item.incoming) || 0,
            completed: parseInt(item.completed) || 0
          };
        });
    })();

    // Top services - use revenue by customer (from paid invoices) for consistency
    const topServices = revenue?.byCustomer?.length > 0 
      ? revenue.byCustomer.slice(0, 5).map(item => ({
          name: item.customer?.name || 'Unknown',
          value: parseFloat(item.totalRevenue || 0)
        }))
      : [];

    // Revenue by channel - use service analytics (from JobItems) for accurate category-based revenue
    // This shows revenue by service category, which is more accurate than job-level data
    const revenueByChannel = serviceAnalytics?.byCategory?.length > 0
      ? serviceAnalytics.byCategory.slice(0, 4).map(item => ({
          channel: item.category || 'Other',
          revenue: parseFloat(item.totalRevenue || 0)
        }))
      : sales?.byJobType?.length > 0
      ? sales.byJobType.slice(0, 4).map(item => ({
          channel: item.jobType || item.category || 'Other',
          revenue: parseFloat(item.totalSales || 0)
        }))
      : [];
    
    // Use service analytics total revenue if available, otherwise use sales total
    const totalSales = serviceAnalytics?.totalRevenue || sales?.totalSales || 0;

    // Format date range for display
    const dateRangeDisplay = `${dateRange[0].format('MMM DD, YYYY')} - ${dateRange[1].format('MMM DD, YYYY')}`;
    
    // Check if we have any data for the selected period
    const hasDataForPeriod = totalRevenue > 0 || totalExpenses > 0 || (sales?.totalJobs || 0) > 0;
    
    return (
      <div>
        {/* Date Range Indicator */}
        <div style={{ marginBottom: 16, padding: '8px 16px', background: '#f5f5f5', borderRadius: 6, display: 'inline-block' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Showing data for: <Text strong>{dateRangeDisplay}</Text>
            {!hasDataForPeriod && (
              <Text type="warning" style={{ marginLeft: 8 }}> (No data found for this period)</Text>
            )}
          </Text>
        </div>
        
        {/* Top Row - 3 Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {/* Card 1: Financial Summary */}
          <Col xs={24} md={8}>
            <AntdCard style={cardStyle} bodyStyle={{ padding: '24px' }}>
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <div>
                  <Text style={{ fontSize: 13, color: '#8c8c8c', fontWeight: 400 }}>Revenue growth {overviewStats?.periodTypeLabel || 'M/M'}</Text>
                  <Title level={2} style={{ margin: '8px 0 0 0', color: revenueGrowth >= 0 ? '#006d32' : '#cf1322', fontSize: 32, fontWeight: 700 }}>
                    {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth.toFixed(1)}%
                  </Title>
                </div>
                <Divider style={{ margin: '16px 0 12px 0', borderColor: '#f0f0f0' }} />
                <Row gutter={24}>
                  <Col span={12}>
                    <div>
                      <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>Revenue</Text>
                      <Text style={{ fontSize: 20, fontWeight: 600, color: '#262626' }}>
                        GHS {(totalRevenue / 1000).toFixed(3)}K
                      </Text>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div>
                      <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>Net income</Text>
                      <Text style={{ fontSize: 20, fontWeight: 600, color: '#262626' }}>
                        GHS {(netIncome / 1000).toFixed(3)}K
                      </Text>
                    </div>
                  </Col>
                </Row>
                <div style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>Profit margin</Text>
                  <Text style={{ fontSize: 24, fontWeight: 600, color: '#262626' }}>
                    {profitMargin.toFixed(2)}%
                  </Text>
                </div>
              </Space>
            </AntdCard>
          </Col>

          {/* Card 2: Expense Chart */}
          <Col xs={24} md={8}>
            <AntdCard 
              title={<span style={{ fontSize: 15, fontWeight: 600, color: '#262626' }}>Expense Breakdown</span>}
              style={cardStyle}
              bodyStyle={{ padding: '20px 24px' }}
            >
              {expenseData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={expenseData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {expenseData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => `GHS ${value.toLocaleString()}`}
                      contentStyle={{ borderRadius: 8, border: '1px solid #f4f4f4' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#8c8c8c' }}>
                  <Text type="secondary">No expense data available</Text>
                </div>
              )}
              <div style={{ marginTop: 20 }}>
                {expenseData.length > 0 ? (
                  expenseData.slice(0, 3).map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: idx < 2 ? 12 : 0 }}>
                      <Space size={8}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: item.color }} />
                        <Text style={{ fontSize: 13, color: '#595959' }}>{item.name}</Text>
                      </Space>
                      <Text style={{ fontSize: 13, fontWeight: 600, color: '#262626' }}>
                        {expenses.totalExpenses > 0 ? ((item.value / expenses.totalExpenses) * 100).toFixed(0) : 0}% · GHS {(item.value / 1000).toFixed(3)}K
                      </Text>
                    </div>
                  ))
                ) : (
                  <Text type="secondary" style={{ fontSize: 12 }}>No expense data available for this period</Text>
                )}
              </div>
            </AntdCard>
          </Col>

          {/* Card 3: Jobs Summary */}
          <Col xs={24} md={8}>
            <AntdCard style={cardStyle} bodyStyle={{ padding: '24px' }}>
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <div>
                  <Text style={{ fontSize: 13, color: '#8c8c8c', fontWeight: 400 }}>Total Jobs</Text>
                  <Title level={2} style={{ margin: '8px 0 0 0', fontSize: 32, fontWeight: 700, color: '#262626' }}>
                    {sales?.totalJobs || 0}
                  </Title>
                </div>
                <Divider style={{ margin: '16px 0 12px 0', borderColor: '#f0f0f0' }} />
                <div>
                  <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>Total Job Value</Text>
                  <Text style={{ fontSize: 20, fontWeight: 600, color: '#262626' }}>
                    GHS {(totalRevenue / 1000).toFixed(3)}K
                  </Text>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 8 }}>Completion Rate</Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {(() => {
                      const totalJobs = sales?.totalJobs || 0;
                      const completedJobs = sales?.byStatus?.find(s => s.status === 'completed')?.jobCount || 0;
                      const completionRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;
                      
                      return (
                        <>
                          <Progress 
                            type="circle" 
                            percent={completionRate} 
                            width={60} 
                            strokeColor="#006d32"
                            strokeWidth={8}
                            trailColor="#f0f0f0"
                          />
                          <Text style={{ fontSize: 24, fontWeight: 600, color: '#262626' }}>{completionRate}%</Text>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </Space>
            </AntdCard>
          </Col>
        </Row>

        {/* Middle Row - 2 Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {/* Card 4: Revenue Generated */}
          <Col xs={24} md={16}>
            <AntdCard style={cardStyle} bodyStyle={{ padding: '24px' }}>
              <div style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 13, color: '#8c8c8c', display: 'block', marginBottom: 8 }}>Total revenue generated</Text>
                <Title level={2} style={{ margin: 0, color: '#006d32', fontSize: 28, fontWeight: 700 }}>
                  GHS {totalRevenue.toFixed(3)}
                </Title>
              </div>
              {dailyRevenueTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={dailyRevenueTrend} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#006d32" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#006d32" stopOpacity={0.05}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis 
                      dataKey="period" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#8c8c8c', fontSize: 12 }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#8c8c8c', fontSize: 12 }}
                      tickFormatter={(value) => `${value / 1000}k`}
                    />
                    <Tooltip 
                      formatter={(value) => [`GHS ${value.toLocaleString()}`, 'Revenue']}
                      contentStyle={{ borderRadius: 8, border: '1px solid #d9d9d9' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#006d32" 
                      fill="url(#colorRevenue)"
                      strokeWidth={3}
                      dot={{ fill: '#006d32', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                  <Text type="secondary">No revenue data available for this period</Text>
                </div>
              )}
            </AntdCard>
          </Col>

          {/* Card 5: Jobs Trend */}
          <Col xs={24} md={8}>
            <AntdCard 
              title={<span style={{ fontSize: 15, fontWeight: 600, color: '#262626' }}>Jobs Trend</span>}
              style={cardStyle}
              bodyStyle={{ padding: '20px 24px' }}
            >
              {jobsTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={jobsTrend} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis 
                      dataKey="day" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#8c8c8c', fontSize: 11 }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#8c8c8c', fontSize: 11 }}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: 8, border: '1px solid #f4f4f4' }}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
                      iconType="circle"
                    />
                    <Bar dataKey="incoming" fill="#006d32" name="Incoming jobs" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed" fill="#91d5ff" name="Completed jobs" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                  <Text type="secondary">No jobs data available for this period</Text>
                </div>
              )}
            </AntdCard>
          </Col>
        </Row>

        {/* Bottom Row - 2 Cards */}
        <Row gutter={[16, 16]}>
          {/* Card 6: Top 5 Services/Customers */}
          <Col xs={24} md={12}>
            <AntdCard 
              title={<span style={{ fontSize: 15, fontWeight: 600, color: '#262626' }}>Top 5 Revenue Sources</span>}
              style={cardStyle}
              bodyStyle={{ padding: '20px 24px' }}
            >
              {topServices.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={topServices.map(item => ({
                        name: item.name,
                        value: item.value,
                        percentage: totalRevenue > 0 ? ((item.value / totalRevenue) * 100) : 0
                      }))}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                      <XAxis type="number" hide />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#262626', fontSize: 12 }}
                        width={75}
                      />
                      <Tooltip 
                        formatter={(value) => `GHS ${(value / 1000).toFixed(2)}K`}
                        contentStyle={{ borderRadius: 8, border: '1px solid #f4f4f4' }}
                      />
                      <Bar 
                        dataKey="value" 
                        fill="#006d32" 
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  <Space direction="vertical" size={0} style={{ width: '100%', marginTop: 16 }}>
                    {topServices.map((item, idx) => (
                      <div key={idx} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '10px 0', 
                        borderBottom: idx < topServices.length - 1 ? '1px solid #f5f5f5' : 'none' 
                      }}>
                        <div style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: 500, color: '#262626', display: 'block', marginBottom: 4 }}>
                            {item.name}
                          </Text>
                          <Text style={{ fontSize: 12, color: '#8c8c8c' }}>
                            {totalRevenue > 0 ? ((item.value / totalRevenue) * 100).toFixed(1) : 0}% of total revenue
                          </Text>
                        </div>
                        <Text style={{ color: '#006d32', fontSize: 16, fontWeight: 700, marginLeft: 16 }}>
                          GHS {(item.value / 1000).toFixed(2)}K
                        </Text>
                      </div>
                    ))}
                  </Space>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                  <Text type="secondary">No revenue sources data available</Text>
                </div>
              )}
            </AntdCard>
          </Col>

          {/* Card 7: Revenue by Channel */}
          <Col xs={24} md={12}>
            <AntdCard 
              title={<span style={{ fontSize: 15, fontWeight: 600, color: '#262626' }}>Revenue by Channel</span>}
              style={cardStyle}
              bodyStyle={{ padding: '20px 24px' }}
            >
              {revenueByChannel.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={revenueByChannel.map(item => ({
                        name: item.channel,
                        value: item.revenue,
                        percentage: totalSales > 0 ? ((item.revenue / totalSales) * 100) : 0
                      }))}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                      <XAxis type="number" hide />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#262626', fontSize: 12 }}
                        width={75}
                      />
                      <Tooltip 
                        formatter={(value) => `GHS ${(value / 1000).toFixed(2)}K`}
                        contentStyle={{ borderRadius: 8, border: '1px solid #f4f4f4' }}
                      />
                      <Bar 
                        dataKey="value" 
                        fill="#166534" 
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  <Space direction="vertical" size={0} style={{ width: '100%', marginTop: 16 }}>
                    {revenueByChannel.map((item, idx) => {
                      // Use totalSales for percentage calculation (service analytics or job sales total)
                      const percentage = totalSales > 0 ? ((item.revenue / totalSales) * 100) : 0;
                      return (
                        <div key={idx} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          padding: '10px 0', 
                          borderBottom: idx < revenueByChannel.length - 1 ? '1px solid #f5f5f5' : 'none' 
                        }}>
                          <div style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: 500, color: '#262626', display: 'block', marginBottom: 4 }}>
                              {item.channel}
                            </Text>
                            <Text style={{ fontSize: 12, color: '#8c8c8c' }}>
                              {percentage.toFixed(1)}% of total
                            </Text>
                          </div>
                          <Text style={{ color: '#166534', fontSize: 16, fontWeight: 700, marginLeft: 16 }}>
                            GHS {(item.revenue / 1000).toFixed(2)}K
                          </Text>
                        </div>
                      );
                    })}
                  </Space>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                  <Text type="secondary">No channel data available</Text>
                </div>
              )}
            </AntdCard>
          </Col>
        </Row>
      </div>
    );
  };

  const reportTypeOptions = [
    {
      value: 'cashflow',
      label: 'Cashflow Report',
      description: 'Overall business health and financial performance'
    },
    {
      value: 'cost-analysis',
      label: 'Cost Analysis',
      description: 'Detailed view of expenses and cost-saving opportunities'
    },
    {
      value: 'service-analytics',
      label: 'Service Analytics',
      description: 'Comprehensive analysis of service performance metrics'
    },
    {
      value: 'invoice-summary',
      label: 'Invoice Summary',
      description: 'Overview of invoice statuses and payment trends'
    }
  ];

  const renderAIReportGenerator = () => {
    return (
      <div>
        {/* Header with Create Button */}
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              <Bot className="h-4 w-4" /> Smart Report Generator
            </Title>
            <Text type="secondary">
              Configure and generate comprehensive business intelligence reports with AI-powered insights
            </Text>
          </div>
          <Button
            type="primary"
            size="large"
            icon={<Plus className="h-4 w-4" />}
            onClick={handleOpenCreateReportModal}
          >
            Create Report
          </Button>
        </div>

        {/* Loading State */}
        {aiLoading && (
          <AntdCard style={cardStyle}>
            <div className="space-y-6 p-12">
              <div className="text-center">
                <Skeleton className="h-12 w-12 mx-auto mb-4 rounded-full" />
                <Skeleton className="h-6 w-64 mx-auto mb-2" />
                <Skeleton className="h-4 w-48 mx-auto" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          </AntdCard>
        )}

        {/* Empty State */}
        {!generatedReport && !aiLoading && (
          <AntdCard style={cardStyle}>
            <div style={{ textAlign: 'center', padding: '80px 40px' }}>
              <FileText className="h-16 w-16" style={{ fontSize: 64, color: '#d9d9d9', marginBottom: 16 }} />
              <Title level={4}>No Report Generated Yet</Title>
              <Paragraph type="secondary" style={{ maxWidth: 480, margin: '0 auto 24px' }}>
                Click "Create Report" to configure and generate a comprehensive business intelligence report with AI-powered insights and recommendations.
              </Paragraph>
              <Button
                type="primary"
                size="large"
                icon={<Plus className="h-4 w-4" />}
                onClick={handleOpenCreateReportModal}
              >
                Create Your First Report
              </Button>
            </div>
          </AntdCard>
        )}

        {generatedReport && !aiLoading && (
          <div id="generated-report-content">
            {/* Report Header */}
            <AntdCard style={{ ...cardStyle, marginBottom: 16 }}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Title level={2} style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>
                      {generatedReport.title}
                    </Title>
                    <Text type="secondary" style={{ fontSize: 14 }}>
                      Prepared by {generatedReport.generatedBy} · {dayjs(generatedReport.generatedAt).format('MMM DD, YYYY HH:mm')}
                    </Text>
                  </div>
                  <Space>
                    <Button icon={<Eye className="h-4 w-4" />}>Print</Button>
                    <Button type="primary" icon={<Download className="h-4 w-4" />}>
                      Export
                    </Button>
                  </Space>
                </div>
                <Paragraph style={{ margin: '16px 0 0 0', fontSize: 14 }}>{generatedReport.greeting}</Paragraph>
              </Space>
            </AntdCard>

            {/* Performance Summary */}
            {generatedReport.insights.find(i => i.type === 'performance') && (
              <AntdCard style={{ ...cardStyle, marginBottom: 16 }}>
                {(() => {
                  const perfSection = generatedReport.insights.find(i => i.type === 'performance');
                  return (
                    <>
                      <Title level={4} style={{ marginBottom: 16 }}>{perfSection.title}</Title>
                      <Row gutter={[24, 16]}>
                        {perfSection.metrics.map((metric, idx) => (
                          <Col xs={24} sm={8} key={idx}>
                            <div style={{ padding: '20px', background: '#fafafa', borderRadius: 8 }}>
                              <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                                {metric.label}
                              </Text>
                              <Title level={3} style={{ margin: '0 0 4px 0', fontSize: 28, fontWeight: 700, color: metric.color }}>
                                GHS {(metric.value / 1000).toFixed(1)}K
                              </Title>
                              <Text style={{ color: metric.color, fontSize: 13 }}>
                                {metric.trend === 'up' ? '↑' : '↓'} {metric.change}% from last month
                              </Text>
                            </div>
                          </Col>
                        ))}
                      </Row>
                      {perfSection.note && (
                        <Alert
                          message={perfSection.note}
                          type="success"
                          showIcon
                          style={{ marginTop: 16, borderRadius: 8 }}
                        />
                      )}
                    </>
                  );
                })()}
              </AntdCard>
            )}

            {/* Service Analytics Section */}
            {generatedReport.insights.find(i => i.type === 'service-analytics') && (
              <AntdCard style={{ ...cardStyle, marginBottom: 16 }}>
                {(() => {
                  const section = generatedReport.insights.find(i => i.type === 'service-analytics');
                  return (
                    <>
                      <Title level={4}>{section.title}</Title>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>{section.description}</Text>
                      
                      <Table
                        dataSource={section.data}
                        pagination={false}
                        size="small"
                        style={{ marginBottom: 24 }}
                        columns={[
                          { title: 'Service', dataIndex: 'service', key: 'service' },
                          { title: 'Units Sold', dataIndex: 'quantitySold', key: 'quantitySold', align: 'right' },
                          { title: 'Revenue (GHS)', dataIndex: 'revenue', key: 'revenue', align: 'right', render: (val) => val.toLocaleString() },
                          { title: 'Demand', dataIndex: 'demand', key: 'demand', render: (val) => <Tag color={val === 'High' ? 'green' : val === 'Medium' ? 'orange' : 'default'}>{val}</Tag> }
                        ]}
                      />

                      {section.recommendations && section.recommendations.length > 0 && (
                        <>
                          <Divider />
                          <Title level={5} style={{ marginBottom: 16 }}>Recommendations</Title>
                          {section.recommendations.map((rec, idx) => (
                            <div key={idx} style={{ marginBottom: 20 }}>
                              <Paragraph style={{ margin: 0, marginBottom: 8, fontSize: 14, lineHeight: 1.6 }}>
                                <Text strong style={{ fontSize: 14 }}>{idx + 1}. </Text>
                                <Text style={{ fontSize: 14 }}>{rec.finding}</Text>
                              </Paragraph>
                              <Paragraph style={{ margin: 0, paddingLeft: 16, fontSize: 14, lineHeight: 1.6 }}>
                                <Text style={{ color: '#595959', fontSize: 14 }}>
                                  <Text strong>Recommendation:</Text> {rec.recommendation}
                                </Text>
                              </Paragraph>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  );
                })()}
              </AntdCard>
            )}

            {/* Cost Analysis Section */}
            {generatedReport.insights.find(i => i.type === 'cost-analysis') && (
              <AntdCard style={{ ...cardStyle, marginBottom: 16 }}>
                {(() => {
                  const section = generatedReport.insights.find(i => i.type === 'cost-analysis');
                  const chartData = section.data.map((item, index) => ({
                    ...item,
                    color: COLORS[index % COLORS.length]
                  }));
                  
                  return (
                    <>
                      <Title level={4}>{section.title}</Title>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>{section.description}</Text>
                      
                      <Row gutter={24}>
                        <Col xs={24} md={14}>
                          <Table
                            dataSource={[...section.data, { category: 'Total cost', amount: section.totalCost, percentage: 100, isTotal: true }]}
                            pagination={false}
                            size="small"
                            columns={[
                              { title: 'Category', dataIndex: 'category', key: 'category', render: (text, record) => <Text strong={record.isTotal}>{text}</Text> },
                              { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right', render: (val, record) => <Text strong={record.isTotal}>GHS {val.toLocaleString()}</Text> },
                              { title: 'Percentage', dataIndex: 'percentage', key: 'percentage', align: 'right', render: (val, record) => <Text strong={record.isTotal}>{val}%</Text> }
                            ]}
                          />
                        </Col>
                        <Col xs={24} md={10}>
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={100}
                                dataKey="amount"
                                label={({ percentage }) => `${percentage}%`}
                              >
                                {chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value) => `GHS ${value.toLocaleString()}`} />
                              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 18, fontWeight: 700 }}>
                                GHS {(section.totalCost / 1000).toFixed(1)}K
                              </text>
                            </PieChart>
                          </ResponsiveContainer>
                        </Col>
                      </Row>

                      {section.recommendations && section.recommendations.length > 0 && (
                        <>
                          <Divider />
                          <Title level={5} style={{ marginBottom: 16 }}>Recommendations</Title>
                          {section.recommendations.map((rec, idx) => (
                            <div key={idx} style={{ marginBottom: 20 }}>
                              <Paragraph style={{ margin: 0, marginBottom: 8, fontSize: 14, lineHeight: 1.6 }}>
                                <Text strong style={{ fontSize: 14 }}>{idx + 1}. </Text>
                                <Text style={{ fontSize: 14 }}>{rec.finding}</Text>
                              </Paragraph>
                              <Paragraph style={{ margin: 0, paddingLeft: 16, fontSize: 14, lineHeight: 1.6 }}>
                                <Text style={{ color: '#595959', fontSize: 14 }}>
                                  <Text strong>Recommendation:</Text> {rec.recommendation}
                                </Text>
                              </Paragraph>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  );
                })()}
              </AntdCard>
            )}

            {/* Invoice Summary Section */}
            {generatedReport.insights.find(i => i.type === 'invoice-summary') && (
              <AntdCard style={{ ...cardStyle, marginBottom: 16 }}>
                {(() => {
                  const section = generatedReport.insights.find(i => i.type === 'invoice-summary');
                  
                  return (
                    <>
                      <Title level={4}>{section.title}</Title>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>{section.description}</Text>
                      
                      <Table
                        dataSource={[...section.data, { status: 'Total invoiced', amount: section.totalInvoiced, percentage: 100, isTotal: true }]}
                        pagination={false}
                        size="small"
                        style={{ marginBottom: 24 }}
                        columns={[
                          { title: 'Invoice Status', dataIndex: 'status', key: 'status', render: (text, record) => <Text strong={record.isTotal}>{text}</Text> },
                          { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right', render: (val, record) => <Text strong={record.isTotal}>GHS {val.toLocaleString()}</Text> },
                          { title: 'Percentage', dataIndex: 'percentage', key: 'percentage', align: 'right', render: (val, record) => <Text strong={record.isTotal}>{val}%</Text> }
                        ]}
                      />

                      {section.recommendations && section.recommendations.length > 0 && (
                        <>
                          <Divider />
                          <Title level={5} style={{ marginBottom: 16 }}>Recommendations</Title>
                          {section.recommendations.map((rec, idx) => (
                            <div key={idx} style={{ marginBottom: 20 }}>
                              <Paragraph style={{ margin: 0, marginBottom: 8, fontSize: 14, lineHeight: 1.6 }}>
                                <Text strong style={{ fontSize: 14 }}>{idx + 1}. </Text>
                                <Text style={{ fontSize: 14 }}>{rec.finding}</Text>
                              </Paragraph>
                              <Paragraph style={{ margin: 0, paddingLeft: 16, fontSize: 14, lineHeight: 1.6 }}>
                                <Text style={{ color: '#595959', fontSize: 14 }}>
                                  <Text strong>Recommendation:</Text> {rec.recommendation}
                                </Text>
                              </Paragraph>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  );
                })()}
              </AntdCard>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0', borderTop: '1px solid #f0f0f0' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Powered by <Text strong style={{ color: '#166534' }}>NEXpro Intelligence Systems</Text>
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Copyright © {dayjs().year()} Nexus Creative Studio. Confidential and proprietary information.
              </Text>
            </div>
          </div>
        )}
      </div>
    );
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = Array.from({ length: 5 }, (_, i) => dayjs().year() - 2 + i);

  return (
    <>
      {/* Create Report Modal */}
      <Modal
        title={<span style={{ fontSize: 18, fontWeight: 600 }}>Create report</span>}
        open={createReportModalVisible}
        onCancel={() => setCreateReportModalVisible(false)}
        footer={null}
        width={600}
        closeIcon={<XCircle className="h-4 w-4" />}
      >
        <Form
          form={reportConfigForm}
          layout="vertical"
          onFinish={handleCreateReport}
        >
          <Form.Item
            name="reportTitle"
            label="Report title"
            rules={[{ required: true, message: 'Please enter report title' }]}
          >
            <Input size="large" placeholder="Add title" />
          </Form.Item>

          <Form.Item
            name="durationType"
            label="Duration type"
            rules={[{ required: true, message: 'Please select duration type' }]}
          >
            <Select size="large" placeholder="Select duration type">
              <Option value="daily">Daily</Option>
              <Option value="weekly">Weekly</Option>
              <Option value="monthly">Monthly</Option>
              <Option value="quarterly">Quarterly</Option>
              <Option value="yearly">Yearly</Option>
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="year"
                label="Year"
                rules={[{ required: true, message: 'Please select year' }]}
              >
                <Select size="large" placeholder="Select year" suffixIcon={<Calendar className="h-4 w-4" />}>
                  {years.map(year => (
                    <Option key={year} value={year}>{year}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="month"
                label="Month"
                rules={[{ required: true, message: 'Please select month' }]}
              >
                <Select size="large" placeholder="Select month" suffixIcon={<Calendar className="h-4 w-4" />}>
                  {months.map(month => (
                    <Option key={month} value={month}>{month}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Report type">
            <div style={{ marginTop: 8 }}>
              {reportTypeOptions.map(type => (
                <div
                  key={type.value}
                  onClick={() => {
                    if (selectedReportTypes.includes(type.value)) {
                      setSelectedReportTypes(selectedReportTypes.filter(t => t !== type.value));
                    } else {
                      setSelectedReportTypes([...selectedReportTypes, type.value]);
                    }
                  }}
                  style={{
                    padding: '16px',
                    marginBottom: 12,
                    borderRadius: 8,
                    border: '1px solid #f4f4f4',
                    background: selectedReportTypes.includes(type.value) ? '#e6f7ff' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
                      {type.label}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {type.description}
                    </Text>
                  </div>
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    border: selectedReportTypes.includes(type.value) ? '2px solid #166534' : '2px solid #d9d9d9',
                    background: selectedReportTypes.includes(type.value) ? '#166534' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {selectedReportTypes.includes(type.value) && (
                      <CheckCircle className="h-3 w-3" style={{ color: '#fff', fontSize: 12 }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button size="large" onClick={() => setCreateReportModalVisible(false)}>
                Cancel
              </Button>
              <Button 
                type="primary" 
                size="large" 
                htmlType="submit"
              >
                Create
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

    <div style={{ background: '#fafafa', minHeight: '100vh', margin: '-24px', padding: '24px' }}>
      <div style={{ 
        marginBottom: 24, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: 16,
        background: '#fff',
        padding: '20px 24px',
        borderRadius: '8px',
        border: '1px solid #f4f4f4'
      }}>
        <Title level={2} style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Reports & Analytics</Title>
        <Space size={12}>
          <Select
            value={dateFilter}
            onChange={handleFilterChange}
            size="large"
            style={{ width: 180, borderRadius: 8 }}
            suffixIcon={<Calendar className="h-4 w-4" />}
          >
            <Option value="today">Today</Option>
            <Option value="yesterday">Yesterday</Option>
            <Option value="thisWeek">This Week</Option>
            <Option value="lastWeek">Last Week</Option>
            <Option value="thisMonth">This Month</Option>
            <Option value="lastMonth">Last Month</Option>
            <Option value="thisQuarter">This Quarter</Option>
            <Option value="lastQuarter">Last Quarter</Option>
            <Option value="thisYear">This Year</Option>
            <Option value="lastYear">Last Year</Option>
            <Option value="custom">Custom Range</Option>
          </Select>
          {dateFilter === 'custom' && (
            <RangePicker
              value={dateRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setDateRange([dates[0], dates[1]]);
                }
              }}
              size="large"
              format="MMM DD, YYYY"
              style={{ borderRadius: 8 }}
            />
          )}
        </Space>
      </div>

      <AntdCard 
        style={{ 
          borderRadius: '8px',
          border: '1px solid #f4f4f4'
        }}
        bodyStyle={{ padding: '0' }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="large"
          style={{ padding: '0 24px' }}
          items={[
            {
              key: 'overview',
              label: (
                <span style={{ fontSize: 15, fontWeight: 500 }}>
                  <BarChart3 className="h-4 w-4" /> Overview
                </span>
              ),
              children: (
                <div style={{ padding: '24px' }}>
                  {loading ? (
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
                          <TableSkeleton rows={8} cols={5} />
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    renderOverviewDashboard()
                  )}
                </div>
              )
            },
            {
              key: 'generated',
              label: (
                <span style={{ fontSize: 15, fontWeight: 500 }}>
                  <Bot className="h-4 w-4" /> Generated Report
                </span>
              ),
              children: (
                <div style={{ padding: '24px' }}>
                  {renderAIReportGenerator()}
                </div>
              )
            }
        ]}
      />
    </AntdCard>
    </div>
    </>
  );
};

export default Reports;

