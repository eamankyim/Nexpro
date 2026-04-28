import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { REPORT_CHART_COLORS as COLORS, createReportSchema, STUDIO_TYPES, getBusinessTerminology } from './reports/reportConstants';
import { useSmartSearch } from '../context/SmartSearchContext';
import { showSuccess, showError, showWarning, showLoading } from '../utils/toast';
import StatusChip from '../components/StatusChip';
import TableSkeleton from '../components/TableSkeleton';
import DetailSkeleton from '../components/DetailSkeleton';
import { Skeleton } from '../components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table as ShadcnTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import ReportsTableWithCards from '../components/ReportsTableWithCards';
import { Button as ShadcnButton } from '../components/ui/button';
import { Select as ShadcnSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Input as ShadcnInput } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import {
  Download,
  BarChart3,
  Currency,
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
  ChevronDown,
  Search,
  SlidersHorizontal,
  MoreVertical,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Check,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import reportService from '../services/reportService';
import materialsService from '../services/materialsService';
import { useAuth } from '../context/AuthContext';
import { useResponsive } from '../hooks/useResponsive';
import { SEARCH_PLACEHOLDERS } from '../constants';
import { getPreviousPeriod } from '../utils/periodComparison';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import { RechartsModuleProvider, useRechartsModule } from '@/components/charts/RechartsModuleContext';

function ReportsInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const { searchValue, setPageSearchConfig } = useSmartSearch();
  const { activeTenant, user } = useAuth();
  const { isMobile } = useResponsive();
  const rc = useRechartsModule();

  // Declare first so it's never in TDZ when used below
  const [generatedReport, setGeneratedReport] = useState(null);

  const businessType = activeTenant?.businessType || 'printing_press';
  const metadata = activeTenant?.metadata || {};
  const isStudio = useMemo(() => STUDIO_TYPES.includes(businessType) || businessType === 'studio', [businessType]);
  const isPrintingPress = businessType === 'printing_press';
  const isShop = businessType === 'shop';
  const isPharmacy = businessType === 'pharmacy';
  const isRestaurant =
    isShop &&
    ((metadata?.businessSubType || metadata?.shopType) === 'restaurant');
  const terminology = useMemo(
    () =>
      getBusinessTerminology(businessType, {
        ...metadata,
        shopType: metadata?.shopType || metadata?.businessSubType || null,
      }),
    [businessType, metadata]
  );

  // Compact empty state padding for restaurant (many empty sections when no data)
  const emptyStateClass = isRestaurant ? 'py-3 text-sm text-muted-foreground' : 'py-6 text-muted-foreground';
  const emptyStateClassLarge = isRestaurant ? 'py-4 text-sm text-muted-foreground' : 'py-10 text-muted-foreground';
  const emptyStateClassXL = isRestaurant ? 'py-6 text-sm text-muted-foreground' : 'py-16 text-muted-foreground';

  // Determine which view to show based on route (Overview, Smart Report, Compliance)
  const isSmartReport = location.pathname === '/reports/smart-report';
  const isCompliance = location.pathname === '/reports/compliance';
  const showSmartReportList = isSmartReport && !generatedReport;

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
  const [aiLoading, setAiLoading] = useState(false);
  const [overviewStats, setOverviewStats] = useState(null);
  const [createReportModalVisible, setCreateReportModalVisible] = useState(false);
  const reportConfigForm = useForm({
    resolver: zodResolver(createReportSchema),
    defaultValues: {
      reportTitle: `End of month report for ${dayjs().format('MMMM YYYY')}`,
      durationType: 'monthly',
      year: dayjs().year(),
      month: dayjs().format('MMMM'),
    },
  });
  const [selectedReportTypes, setSelectedReportTypes] = useState(['cashflow']);
  const [reportDateFilter, setReportDateFilter] = useState('last6months');

  // Compliance view: statement type and data
  const [complianceStatementType, setComplianceStatementType] = useState('income-expenditure');
  const [complianceData, setComplianceData] = useState(null);
  const [complianceSource, setComplianceSource] = useState(null);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceError, setComplianceError] = useState(null);
  const compliancePrintRef = useRef(null);
  
  // VAT report data
  const [vatData, setVatData] = useState(null);
  const [vatLoading, setVatLoading] = useState(false);


  useEffect(() => {
    setPageSearchConfig({ scope: 'reports', placeholder: SEARCH_PLACEHOLDERS.REPORTS });
    return () => setPageSearchConfig(null);
  }, [setPageSearchConfig]);

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

  const [savedReports, setSavedReports] = useState([]);

  // Storage key for saved reports (scoped by tenant)
  const reportsStorageKey = useMemo(
    () => (activeTenant?.id ? `shopwise_saved_reports_${activeTenant.id}` : null),
    [activeTenant?.id]
  );

  // Load saved reports from localStorage for current tenant (migrate from legacy key if needed)
  useEffect(() => {
    if (!reportsStorageKey || !activeTenant?.id) {
      setSavedReports([]);
      return;
    }
    try {
      let saved = localStorage.getItem(reportsStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const forTenant = Array.isArray(parsed)
          ? parsed.filter((r) => r.tenantId === activeTenant?.id || !r.tenantId)
          : [];
        setSavedReports(forTenant);
        return;
      }
      // One-time migration from legacy key so existing reports show up
      const legacyKey = 'shopwise_saved_reports';
      const legacySaved = localStorage.getItem(legacyKey);
      if (legacySaved) {
        const parsed = JSON.parse(legacySaved);
        const list = Array.isArray(parsed) ? parsed : [];
        if (list.length > 0) {
          const migrated = list.map((r) => ({
            ...r,
            tenantId: activeTenant.id,
            businessType: r.businessType || activeTenant?.businessType || 'printing_press'
          }));
          setSavedReports(migrated);
          localStorage.setItem(reportsStorageKey, JSON.stringify(migrated));
          try {
            localStorage.removeItem(legacyKey);
          } catch (_) {}
          return;
        }
      }
      setSavedReports([]);
    } catch (e) {
      console.warn('Failed to load saved reports from localStorage:', e);
      setSavedReports([]);
    }
  }, [reportsStorageKey, activeTenant?.id, activeTenant?.businessType]);

  // Filter reports based on header search (when on Smart Report list view)
  const filteredReports = useMemo(() => {
    if (!showSmartReportList) return [];
    return savedReports.filter(report => {
      const matchesSearch = !searchValue ||
        report.title?.toLowerCase().includes(searchValue.toLowerCase()) ||
        report.generatedBy?.toLowerCase().includes(searchValue.toLowerCase());
      return matchesSearch;
    });
  }, [savedReports, searchValue, showSmartReportList]);

  useEffect(() => {
    if (!isSmartReport && !isCompliance) {
      fetchOverviewStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, dateRange, groupBy, isSmartReport, isCompliance, dateFilter]);

  // Fetch compliance report when on Compliance view and statement type or date changes
  useEffect(() => {
    if (!isCompliance || !dateRange?.[0] || !dateRange?.[1]) return;
    const startDate = dateRange[0].format('YYYY-MM-DD');
    const endDate = dateRange[1].format('YYYY-MM-DD');
    let cancelled = false;
    
    // Handle VAT report separately
    if (complianceStatementType === 'vat') {
      setVatLoading(true);
      const fetchVat = async () => {
        try {
          const res = await reportService.getVatReport(startDate, endDate, 'month');
          if (!cancelled && res?.data) {
            setVatData(res.data);
          }
        } catch (err) {
          if (!cancelled) {
            setVatData(null);
            showError(null, 'Failed to load VAT report');
          }
        } finally {
          if (!cancelled) setVatLoading(false);
        }
      };
      fetchVat();
      return () => { cancelled = true; };
    }
    
    setComplianceLoading(true);
    setComplianceError(null);
    const fetchCompliance = async () => {
      try {
        let res;
        if (complianceStatementType === 'income-expenditure') {
          res = await reportService.getIncomeExpenditureReport(startDate, endDate);
        } else if (complianceStatementType === 'profit-loss') {
          res = await reportService.getProfitLossComplianceReport(startDate, endDate);
        } else if (complianceStatementType === 'financial-position') {
          res = await reportService.getFinancialPositionReport(endDate);
        } else {
          res = await reportService.getCashFlowReport(startDate, endDate);
        }
        if (!cancelled && res?.data) {
          setComplianceData(res.data);
          setComplianceSource(res.source || null);
        }
      } catch (err) {
        if (!cancelled) {
          setComplianceError(err?.response?.data?.error || 'Failed to load report');
          setComplianceData(null);
          setComplianceSource(null);
        }
      } finally {
        if (!cancelled) setComplianceLoading(false);
      }
    };
    fetchCompliance();
    return () => { cancelled = true; };
  }, [isCompliance, complianceStatementType, dateRange]);

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
      
      // Batched overview: 2 requests instead of 13 for faster loading
      const businessType = activeTenant?.businessType || 'printing_press';
      const isShopOrPharmacy = businessType === 'shop' || businessType === 'pharmacy';

      // Phase 1: Single batched request (revenue, expenses, outstanding, sales, serviceAnalytics, productSales)
      const phase1Res = await reportService.getOverviewPhase1(startDate, endDate, groupBy, isShopOrPharmacy).catch((err) => {
        console.error('[Reports] Error fetching overview phase1:', err);
        return { data: null };
      });
      const phase1 = phase1Res?.data || {};
      const revenue = { data: phase1.revenue ?? { totalRevenue: 0, byPeriod: [], byCustomer: [] } };
      const expenses = { data: phase1.expenses ?? { totalExpenses: 0, byCategory: [] } };
      const outstanding = { data: phase1.outstanding ?? { totalOutstanding: 0 } };
      const sales = { data: phase1.sales ?? { totalJobs: 0, totalSales: 0, byCustomer: [], byStatus: [], byDate: [], byJobType: [], jobsTrendByDate: [] } };
      const serviceAnalytics = { data: phase1.serviceAnalytics ?? { totalRevenue: 0, byCategory: [], byDate: [], byCustomer: [] } };
      const productSalesData = { data: phase1.productSales ?? { products: [], totalRevenue: 0, totalQuantitySold: 0 } };

      const totalRevenuePhase1 = revenue?.data?.totalRevenue || 0;
      const totalExpensesPhase1 = expenses?.data?.totalExpenses || 0;
      setOverviewStats({
        revenue: revenue?.data || { totalRevenue: 0, byPeriod: [], byCustomer: [] },
        expenses: expenses?.data || { totalExpenses: 0, byCategory: [] },
        outstanding: outstanding?.data || { totalOutstanding: 0 },
        sales: sales?.data || { totalJobs: 0, totalSales: 0, byCustomer: [], byStatus: [], byDate: [], byJobType: [], jobsTrendByDate: [] },
        serviceAnalytics: serviceAnalytics?.data || { totalRevenue: 0, byCategory: [], byDate: [], byCustomer: [] },
        productSales: productSalesData?.data || { products: [], totalRevenue: 0, totalQuantitySold: 0 },
        productStockSummary: { totalStocks: 0, totalStockValue: 0, stockAvailabilityRate: 0 },
        materialsSummary: { totalStocks: 0, totalStockValue: 0, stockAvailabilityRate: 0 },
        materialsMovements: [],
        fastestMovingItems: [],
        revenueByChannel: [],
        kpiSummary: { totalRevenue: 0, totalExpenses: 0, grossProfit: 0, activeCustomers: 0, pendingInvoices: 0 },
        topCustomers: [],
        pipelineSummary: { activeJobs: 0, openLeads: 0, pendingInvoices: 0 },
        profitLoss: { revenue: totalRevenuePhase1, expenses: totalExpensesPhase1, grossProfit: totalRevenuePhase1 - totalExpensesPhase1, profitMargin: totalRevenuePhase1 > 0 ? ((totalRevenuePhase1 - totalExpensesPhase1) / totalRevenuePhase1 * 100) : 0 },
        revenueGrowth: 0,
        periodTypeLabel: '—'
      });
      setLoading(false);

      // Phase 2: Single batched request (inventory, KPI, top customers, pipeline, revenue by channel)
      const phase2Res = await reportService.getOverviewPhase2(startDate, endDate, 5).catch((err) => {
        console.error('[Reports] Error fetching overview phase2:', err);
        return { data: null };
      });
      const phase2 = phase2Res?.data || {};
      const productStockSummary = { data: phase2.productStockSummary ?? { totalStocks: 0, totalStockValue: 0, stockAvailabilityRate: 0 } };
      const materialsSummary = { data: phase2.materialsSummary ?? { totalStocks: 0, totalStockValue: 0, stockAvailabilityRate: 0 } };
      const materialsMovements = { data: phase2.materialsMovements ?? [] };
      const fastestMovingItems = { data: phase2.fastestMovingItems ?? [] };
      const revenueByChannel = { data: phase2.revenueByChannel ?? [] };
      const kpiSummary = { data: phase2.kpiSummary ?? { totalRevenue: 0, totalExpenses: 0, grossProfit: 0, activeCustomers: 0, pendingInvoices: 0 } };
      const topCustomers = { data: phase2.topCustomers ?? [] };
      const pipelineSummary = { data: phase2.pipelineSummary ?? { activeJobs: 0, openLeads: 0, pendingInvoices: 0 } };

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
      
      // Calculate previous period dates using utility function
      const previousPeriod = getPreviousPeriod(dateFilter || 'custom', [currentPeriodStart, currentPeriodEnd]);
      
      console.log('[Revenue Growth] Previous period calculation:', {
        dateFilter,
        previousPeriodStart: previousPeriod.startDate,
        previousPeriodEnd: previousPeriod.endDate,
        label: previousPeriod.label,
        calculation: `Based on ${dateFilter}, calculated previous period from ${previousPeriod.startDate} to ${previousPeriod.endDate}`
      });
      
      // Determine period type label for display based on comparison label
      let periodTypeLabel = previousPeriod.label || 'vs previous period';
      
      // Map labels to short format for display
      if (periodTypeLabel.includes('yesterday')) {
        periodTypeLabel = 'D/D';
      } else if (periodTypeLabel.includes('week')) {
        periodTypeLabel = 'W/W';
      } else if (periodTypeLabel.includes('month')) {
        periodTypeLabel = 'M/M';
      } else if (periodTypeLabel.includes('quarter')) {
        periodTypeLabel = 'Q/Q';
      } else if (periodTypeLabel.includes('year')) {
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
          start: previousPeriod.startDate,
          end: previousPeriod.endDate,
          label: previousPeriod.label
        });
        
        // Fetch revenue for previous period using utility-calculated dates
        const previousPeriodRevenueData = await reportService.getRevenueReport(
          previousPeriod.startDate,
          previousPeriod.endDate,
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
        productStockSummary: productStockSummary?.data || { totalStocks: 0, totalStockValue: 0, stockAvailabilityRate: 0 },
        materialsSummary: materialsSummary?.data || { totalStocks: 0, totalStockValue: 0, stockAvailabilityRate: 0 },
        materialsMovements: materialsMovements?.data || [],
        fastestMovingItems: fastestMovingItems?.data || [],
        revenueByChannel: revenueByChannel?.data || [],
        kpiSummary: kpiSummary?.data || { totalRevenue: 0, totalExpenses: 0, grossProfit: 0, activeCustomers: 0, pendingInvoices: 0 },
        topCustomers: topCustomers?.data || [],
        pipelineSummary: pipelineSummary?.data || { activeJobs: 0, openLeads: 0, pendingInvoices: 0 },
        productSales: productSalesData?.data || { products: [], totalRevenue: 0, totalQuantitySold: 0 },
        profitLoss: {
          revenue: totalRevenue,
          expenses: totalExpenses,
          grossProfit: grossProfit,
          profitMargin: profitMargin
        },
        revenueGrowth: revenueGrowth,
        periodTypeLabel: periodTypeLabel
      });
    } catch (error) {
      console.error('Error fetching overview stats:', error);
      showError(null, 'Failed to load overview statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateReportModal = () => {
    reportConfigForm.reset({
      reportTitle: `End of month report for ${dayjs().format('MMMM YYYY')}`,
      durationType: 'monthly',
      year: dayjs().year(),
      month: dayjs().format('MMMM'),
    });
    setSelectedReportTypes(['cashflow']);
    setCreateReportModalVisible(true);
  };

  const handleCreateReport = async (values) => {
    // End-of-month reports: only allow on the last day of that month or after
    if (values.durationType === 'monthly') {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthIndex = monthNames.indexOf(values.month);
      if (monthIndex === -1 || values.year == null) {
        showError(null, 'Please select a valid month and year.');
        return;
      }
      const lastDayOfReportMonth = dayjs().year(values.year).month(monthIndex).endOf('month');
      const today = dayjs().startOf('day');
      if (today.isBefore(lastDayOfReportMonth, 'day')) {
        showError(null, 'End of month reports can only be generated on the last day of the month or after the month has ended.');
        return;
      }
    }

    try {
      setCreateReportModalVisible(false);

      const reportConfig = {
        ...values,
        reportTypes: selectedReportTypes,
        generatedBy: user?.name || user?.first_name || 'System User'
      };

      // Create a temporary report entry with "processing" status (scoped to tenant and business type)
      const tenantId = activeTenant?.id;
      const tempReport = {
        title: reportConfig.reportTitle,
        generatedAt: new Date().toISOString(),
        generatedBy: reportConfig.generatedBy,
        reportTypes: reportConfig.reportTypes,
        status: 'processing',
        id: Date.now().toString(),
        tenantId,
        businessType
      };

      // Add to saved reports immediately with processing status
      const updatedReports = [tempReport, ...savedReports];
      setSavedReports(updatedReports);
      if (reportsStorageKey) {
        localStorage.setItem(reportsStorageKey, JSON.stringify(updatedReports));
      }

      // Navigate to Smart Report list view
      navigate('/reports/smart-report');

      // Show success message
      showSuccess('Report generation started in the background');

      // Generate the report in the background
      generateSmartReportInBackground(reportConfig, tempReport.id, tenantId);
    } catch (error) {
      console.error('Error creating report:', error);
      showError(null, 'Failed to create report');
    }
  };

  const generateSmartReportInBackground = async (config, reportId, tenantId) => {
    const storageKey = tenantId ? `shopwise_saved_reports_${tenantId}` : null;
    try {
      // Generate the report (this will take time)
      const report = await generateSmartReport(config);

      // Update the report status to 'ready' and add the full report data
      setSavedReports((prevReports) => {
        const updatedReports = prevReports.map((r) =>
          r.id === reportId ? { ...r, ...report, status: 'ready', tenantId, businessType } : r
        );
        if (storageKey) {
          localStorage.setItem(storageKey, JSON.stringify(updatedReports));
        }
        return updatedReports;
      });

      showSuccess('Report generated successfully!');
    } catch (error) {
      console.error('Error generating report:', error);
      setSavedReports((prevReports) => {
        const updatedReports = prevReports.map((r) =>
          r.id === reportId ? { ...r, status: 'failed' } : r
        );
        if (storageKey) {
          localStorage.setItem(storageKey, JSON.stringify(updatedReports));
        }
        return updatedReports;
      });
      showError(null, 'Report generation failed');
    }
  };

  const generateSmartReport = async (config) => {
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');

      // Fetch real data for the report - conditionally fetch product/inventory data for shop/pharmacy
      const fetchPromises = [
        reportService.getRevenueReport(startDate, endDate, 'day').catch(() => ({ data: { totalRevenue: 0, byPeriod: [] } })),
        reportService.getExpenseReport(startDate, endDate).catch(() => ({ data: { totalExpenses: 0, byCategory: [] } })),
        reportService.getSalesReport(startDate, endDate, 'day').catch(() => ({ data: { totalSales: 0, byJobType: [], byCustomer: [], byDate: [], byStatus: [] } })),
        reportService.getOutstandingPaymentsReport(startDate, endDate).catch(() => ({ data: { totalOutstanding: 0, invoices: [] } })),
        reportService.getServiceAnalyticsReport(startDate, endDate).catch(() => ({ data: { totalRevenue: 0, byCategory: [], byDate: [], byCustomer: [] } }))
      ];

      // Add product sales and inventory data for shop/pharmacy
      if (isShop || isPharmacy) {
        fetchPromises.push(
          reportService.getProductSalesReport(startDate, endDate).catch(() => ({ data: { products: [], totalProducts: 0, totalRevenue: 0, totalQuantitySold: 0 } })),
          materialsService.getItems().catch(() => ({ data: { data: [] } }))
        );
      } else {
        fetchPromises.push(Promise.resolve(null), Promise.resolve(null));
      }
      // Add prescription report for pharmacy
      if (isPharmacy) {
        fetchPromises.push(
          reportService.getPrescriptionReport(startDate, endDate).catch(() => ({ data: { byStatus: {}, totalPrescriptions: 0, prescriptionRevenue: 0, fulfillmentRate: 0, topDrugs: [] } }))
        );
      } else {
        fetchPromises.push(Promise.resolve(null));
      }
      // Phase 2: top customers, pipeline, materials (for customer-summary, pipeline, materials-summary)
      fetchPromises.push(reportService.getOverviewPhase2(startDate, endDate, 10).catch(() => ({ data: {} })));

      const [revenueData, expenseData, salesData, outstandingData, serviceAnalyticsData, productSalesData, materialsData, prescriptionData, phase2Data] = await Promise.all(fetchPromises);
      const phase2 = phase2Data?.data || {};

      const revenue = revenueData.data?.totalRevenue || 0;
      const expenses = expenseData.data?.totalExpenses || 0;
      
      // Calculate profit directly from the same date range data (no separate API call)
      const profit = revenue - expenses;
      const profitMargin = revenue > 0 ? ((profit / revenue) * 100) : 0;

      // Calculate previous period for comparison using utility
      const previousPeriodForComparison = getPreviousPeriod(dateFilter || 'custom', [
        dayjs(startDate),
        dayjs(endDate)
      ]);
      
      const [prevRevenueData, prevExpenseData] = await Promise.all([
        reportService.getRevenueReport(previousPeriodForComparison.startDate, previousPeriodForComparison.endDate, 'day').catch(() => ({ data: { totalRevenue: 0 } })),
        reportService.getExpenseReport(previousPeriodForComparison.startDate, previousPeriodForComparison.endDate).catch(() => ({ data: { totalExpenses: 0 } }))
      ]);

      const prevRevenue = prevRevenueData.data?.totalRevenue || 0;
      const prevExpenses = prevExpenseData.data?.totalExpenses || 0;
      const prevProfit = prevRevenue - prevExpenses;

      const revenueChange = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue * 100) : 0;
      const expenseChange = prevExpenses > 0 ? ((expenses - prevExpenses) / prevExpenses * 100) : 0;
      const profitChange = prevProfit > 0 ? ((profit - prevProfit) / prevProfit * 100) : 0;

      // Prepare report data for AI analysis
      const reportDataForAI = {
        revenue,
        expenses,
        profit,
        profitMargin,
        revenueChange,
        expenseChange,
        profitChange,
        topItems: (() => {
          if (isShop || isPharmacy) {
            return (productSalesData?.data?.products || []).slice(0, 5).map(item => ({
              name: item.productName,
              revenue: parseFloat(item.revenue || 0),
              quantity: parseFloat(item.quantitySold || 0)
            }));
          }
          return (serviceAnalyticsData.data?.byCategory || salesData.data?.byJobType || []).slice(0, 5).map(item => ({
            name: item.category || item.jobType,
            revenue: parseFloat(item.totalRevenue || item.totalSales || 0),
            quantity: parseFloat(item.totalQuantity || 0)
          }));
        })(),
        expenseBreakdown: (expenseData.data?.byCategory || []).map(cat => ({
          category: cat.category,
          amount: parseFloat(cat.totalAmount || 0)
        })),
        materials: materialsData?.data?.data ? {
          totalStocks: materialsData.data.data.length,
          stockAvailabilityRate: materialsData.data.data.filter(item => parseFloat(item.quantity || 0) > 0).length / materialsData.data.data.length * 100
        } : null,
        outstandingPayments: outstandingData.data?.totalOutstanding || 0
      };

      // Fetch AI analysis
      let aiAnalysis = null;
      try {
        const aiResponse = await reportService.generateAIAnalysis(reportDataForAI, {
          businessType: activeTenant?.businessType || 'printing_press',
          studioType: activeTenant?.metadata?.studioType,
          period: config.durationType || 'monthly',
          startDate,
          endDate
        });
        aiAnalysis = aiResponse.data?.data || null;
      } catch (aiError) {
        console.warn('AI analysis failed, using fallback insights:', aiError);
      }

      // Generate comprehensive smart report with real data (build array via push to avoid JSX parse issue)
      const reportInsights = [
          {
            type: 'performance',
            title: 'Performance Summary',
            prevRevenue,
            prevExpenses,
            prevProfit,
            metrics: [
              { label: 'Total Revenue', value: revenue, prevValue: prevRevenue, change: Math.abs(revenueChange), trend: revenueChange >= 0 ? 'up' : 'down', color: 'var(--color-primary)' },
              { label: 'Total Expenses', value: expenses, prevValue: prevExpenses, change: Math.abs(expenseChange), trend: expenseChange <= 0 ? 'down' : 'up', color: expenseChange <= 0 ? 'var(--color-primary)' : 'hsl(var(--destructive))' },
              { label: 'Net Profit', value: profit, prevValue: prevProfit, change: Math.abs(profitChange), trend: profitChange >= 0 ? 'up' : 'down', color: 'var(--color-primary)' }
            ],
            note: (revenueChange > 0)
              ? `Your revenue is up ${revenueChange.toFixed(1)}% (₵ ${(revenue - prevRevenue).toLocaleString()}) from the previous period.`
              : `Your revenue is down ${Math.abs(revenueChange).toFixed(1)}% (₵ ${(prevRevenue - revenue).toLocaleString()}) from the previous period.`
          }
      ];
      const conditionalSections = selectedReportTypes.length > 0 ? [
            ...(isShop || isPharmacy ? [{
              type: 'product-analytics',
              title: 'Product Sales',
              description: 'Sales performance by product (quantity sold and revenue). Tenant-isolated.',
              data: (productSalesData?.data?.products || []).map(item => ({
                productName: item.productName || 'Unknown',
                quantitySold: parseFloat(item.quantitySold || 0),
                revenue: parseFloat(item.revenue || 0),
                unit: item.unit || 'pcs',
                sku: item.sku,
                currentStock: parseFloat(item.currentStock || 0),
                safetyStock: parseFloat(item.safetyStock || 0),
                isLowStock: item.isLowStock,
                isHighRisk: item.isHighRisk,
                stockPercentage: parseFloat(item.stockPercentage || 0)
              })).slice(0, 10),
              recommendations: (() => {
                const recs = [];
                const products = productSalesData?.data?.products || [];
                const top = products[0];
                if (top && (revenue > 0)) {
                  const topRev = parseFloat(top.revenue || 0);
                  const pct = (topRev / revenue) * 100;
                  if (pct > 30) recs.push({ finding: `${top.productName} accounts for ${pct.toFixed(1)}% of revenue.`, recommendation: 'Maintain stock levels for this top-performing product.' });
                }
                return recs;
              })()
            }] : []),
            ...(isShop || isPharmacy ? [{
              type: 'inventory-status',
              title: 'Materials Status',
              description: 'Current stock levels by product. Tenant-isolated.',
              data: (productSalesData?.data?.products || []).map(item => ({
                productName: item.productName || 'Unknown',
                currentStock: parseFloat(item.currentStock || 0),
                safetyStock: parseFloat(item.safetyStock || 0),
                unit: item.unit || 'pcs',
                sku: item.sku,
                isLowStock: item.isLowStock,
                isHighRisk: item.isHighRisk,
                stockPercentage: parseFloat(item.stockPercentage || 0)
              })).slice(0, 10),
              recommendations: (() => {
                const recs = [];
                const products = productSalesData?.data?.products || [];
                const lowStock = products.filter(p => p.isLowStock);
                const highRisk = products.filter(p => p.isHighRisk);
                if (lowStock.length > 0) {
                  const critical = lowStock.find(p => p.currentStock < (p.safetyStock * 0.5));
                  recs.push({
                    finding: critical ? `${critical.productName} stock is critically low.` : `${lowStock.length} product(s) below safety stock.`,
                    recommendation: 'Review and reorder low stock items.'
                  });
                }
                if (highRisk.length > 0) {
                  recs.push({
                    finding: `${highRisk[0].productName} is overstocked.`,
                    recommendation: 'Consider promotions or archive to free up capital.'
                  });
                }
                return recs;
              })()
            }] : []),
            // Service analytics (printing press/studio)
            ...(!isShop && !isPharmacy ? [{
              type: 'service-analytics',
              title: terminology.analyticsTitle,
              description: terminology.analyticsDescription,
              data: (serviceAnalyticsData.data?.byCategory || salesData.data?.byJobType || []).map(item => {
                const totalRevenue = parseFloat(item.totalRevenue || item.totalSales || 0);
                const quantitySold = parseFloat(item.totalQuantity || item.jobCount || 0);
                const avgRevenue = parseFloat(item.averagePrice || 0);
                let demand = 'Low';
                if ((totalRevenue > revenue * 0.3)) demand = 'High';
                else if ((totalRevenue > revenue * 0.15)) demand = 'Medium';
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
              
              // For shop/pharmacy, generate product-based recommendations
              if (isShop || isPharmacy) {
                const products = productSalesData?.data?.products || [];
                if (products.length === 0) {
                  return recommendations;
                }
                
                const topProduct = products[0];
                if (topProduct && revenue > 0) {
                  const topRevenue = parseFloat(topProduct.revenue || 0);
                  const topPercentage = (topRevenue / revenue) * 100;
                  
                  if (topPercentage > 30) {
                    recommendations.push({
                      finding: `${topProduct.productName} dominates sales with ${topPercentage.toFixed(1)}% of total revenue (₵ ${topRevenue.toLocaleString()}).`,
                      recommendation: 'Consider maintaining higher stock levels for this top-performing product.'
                    });
                  }
                }
                
                // Check for low stock items
                const lowStockProducts = products.filter(p => p.isLowStock);
                if (lowStockProducts.length > 0) {
                  const criticalProduct = lowStockProducts.find(p => p.currentStock < (p.safetyStock * 0.5));
                  if (criticalProduct) {
                    recommendations.push({
                      finding: `${criticalProduct.productName} stock is critically low (${criticalProduct.currentStock} ${criticalProduct.unit} remaining, safety level: ${criticalProduct.safetyStock} ${criticalProduct.unit}).`,
                      recommendation: 'Consider an urgent reorder to avoid stockout.'
                    });
                  } else {
                    recommendations.push({
                      finding: `${lowStockProducts.length} product(s) are below safety stock levels.`,
                      recommendation: 'Review and reorder low stock items to maintain inventory levels.'
                    });
                  }
                }
                
                // Check for high inventory risk (overstocked)
                const highRiskProducts = products.filter(p => p.isHighRisk);
                if (highRiskProducts.length > 0) {
                  recommendations.push({
                    finding: `${highRiskProducts[0].productName} is in high inventory risk, currently ${highRiskProducts[0].currentStock} ${highRiskProducts[0].unit} in stock (safety level: ${highRiskProducts[0].safetyStock} ${highRiskProducts[0].unit}).`,
                    recommendation: 'Consider re-ordering or moving into an archive/sale to free up capital.'
                  });
                }
                
                return recommendations;
              }
              
              // For printing press, use service analytics data
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
                    finding: `${topService.category || topService.jobType} accounts for ${topPercentage.toFixed(1)}% of total revenue (₵ ${topRevenue.toLocaleString()}).`,
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
                  finding: `${topCategory.category} is identified as the highest cost driver, accounting for ${topPercentage.toFixed(1)}% of total expenses (₵ ${topAmount.toLocaleString()}).`,
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
                  finding: `Utilities costs account for ${expenses > 0 ? ((utilAmount / expenses) * 100).toFixed(1) : 0}% of total expenses (₵ ${utilAmount.toLocaleString()}).`,
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
                  finding: `Total outstanding balance is ₵ ${outstanding.toLocaleString()}.`,
                  recommendation: 'Implement automated reminders for outstanding payments 3 days before due date.'
                });
              }
              
              if (overdueAmount > 0) {
                recommendations.push({
                  finding: `Overdue invoices total ₵ ${overdueAmount.toLocaleString()} (${overdueInvoices.length} invoice${overdueInvoices.length > 1 ? 's' : ''}).`,
                  recommendation: 'Consider implementing a late payment fee of 2% to encourage timely payments.'
                });
              }
              
              // No hardcoded fallback - only return recommendations when there's actual data to act on
              return recommendations;
            })()
          }] : []),
          ...(selectedReportTypes.includes('outstanding-payments') ? [{
            type: 'outstanding-payments',
            title: 'Outstanding Payments',
            description: 'Accounts receivable and overdue amounts.',
            data: (() => {
              const inv = outstandingData.data?.invoices || [];
              const total = outstandingData.data?.totalOutstanding ?? 0;
              const overdue = inv.filter((i) => i.status === 'overdue');
              const overdueAmount = overdue.reduce((s, i) => s + parseFloat(i.balance || 0), 0);
              return { totalOutstanding: total, overdueCount: overdue.length, overdueAmount, invoices: inv.slice(0, 10) };
            })(),
            recommendations: (() => {
              const total = outstandingData.data?.totalOutstanding ?? 0;
              if (total <= 0) return [];
              return [{ finding: `Total outstanding is ₵ ${total.toLocaleString()}.`, recommendation: 'Send payment reminders and follow up on overdue invoices.' }];
            })()
          }] : []),
          ...(selectedReportTypes.includes('customer-summary') ? [{
            type: 'customer-summary',
            title: 'Customer Summary',
            description: 'Top customers by revenue in the period.',
            data: (phase2.topCustomers || revenueData.data?.byCustomer || []).slice(0, 10).map((c) => ({
              name: c.customerName || c.customer?.name || c.name || 'Unknown',
              revenue: parseFloat(c.totalRevenue || c.revenue || 0),
              count: c.jobCount || c.transactionCount || c.count || 0
            })),
            recommendations: []
          }] : []),
          ...(selectedReportTypes.includes('sales-summary') ? [{
            type: 'sales-summary',
            title: isStudio ? 'Jobs Summary' : 'Sales Summary',
            description: isStudio ? 'Job volume and status in the period.' : 'Sales volume and status in the period.',
            data: (() => {
              const byStatus = salesData.data?.byStatus || [];
              const byDate = salesData.data?.byDate || [];
              return {
                totalJobs: salesData.data?.totalJobs ?? 0,
                totalSales: salesData.data?.totalSales ?? 0,
                byStatus: byStatus.map((s) => ({ status: s.status || s.name, count: s.count ?? s.jobCount ?? 0, total: parseFloat(s.totalSales || s.totalAmount || 0) })),
                byDate: byDate.slice(0, 14).map((d) => ({ date: d.date, count: d.count ?? 0, total: parseFloat(d.totalSales || d.totalRevenue || 0) }))
              };
            })(),
            recommendations: []
          }] : []),
          ...(isStudio && selectedReportTypes.includes('materials-summary') ? [{
            type: 'materials-summary',
            title: 'Materials Summary',
            description: 'Stock levels and recent movements.',
            data: {
              summary: phase2.materialsSummary || { totalStocks: 0, totalStockValue: 0, stockAvailabilityRate: 0 },
              movements: (phase2.materialsMovements || []).slice(0, 10)
            },
            recommendations: []
          }] : []),
          ...(selectedReportTypes.includes('pipeline') ? [{
            type: 'pipeline',
            title: 'Pipeline',
            description: 'Active jobs, open leads, and pending invoices.',
            data: phase2.pipelineSummary || { activeJobs: 0, openLeads: 0, pendingInvoices: 0 },
            recommendations: []
          }] : []),
          ...(isPharmacy && selectedReportTypes.includes('prescription-summary') && prescriptionData?.data ? [{
            type: 'prescription-summary',
            title: 'Prescription Summary',
            description: 'Prescription volume, status, and revenue.',
            data: (() => {
              const d = prescriptionData.data;
              const byStatus = d.byStatus || {};
              return [
                { status: 'Pending', count: byStatus.pending || 0 },
                { status: 'Filled', count: byStatus.filled || 0 },
                { status: 'Partially filled', count: byStatus.partially_filled || 0 },
                { status: 'Cancelled', count: byStatus.cancelled || 0 },
                { status: 'Expired', count: byStatus.expired || 0 }
              ];
            })(),
            totalPrescriptions: prescriptionData.data.totalPrescriptions || 0,
            prescriptionRevenue: prescriptionData.data.prescriptionRevenue || 0,
            fulfillmentRate: prescriptionData.data.fulfillmentRate || 0,
            topDrugs: prescriptionData.data.topDrugs || [],
            recommendations: (() => {
              const recommendations = [];
              const rate = prescriptionData.data.fulfillmentRate || 0;
              if (rate < 80 && prescriptionData.data.totalPrescriptions > 0) {
                recommendations.push({
                  finding: `Prescription fulfillment rate is ${rate.toFixed(1)}%.`,
                  recommendation: 'Review stock levels and ordering to improve fill rate.'
                });
              }
              const rev = prescriptionData.data.prescriptionRevenue || 0;
              if (revenue > 0 && rev > 0) {
                const pct = (rev / revenue) * 100;
                recommendations.push({
                  finding: `Prescription revenue is ₵ ${rev.toLocaleString()} (${pct.toFixed(1)}% of total revenue).`,
                  recommendation: 'Continue tracking prescription vs OTC mix.'
                });
              }
              return recommendations;
            })()
          }] : [])
      ] : [];
      reportInsights.push(...conditionalSections, {
            type: 'insight',
            title: 'AI-Powered Insights',
            points: [
              (revenueChange > 0)
                ? `Revenue has ${(revenueChange > 0) ? 'increased' : 'decreased'} by ${Math.abs(revenueChange).toFixed(1)}% compared to the previous period.`
                : 'Revenue remains stable compared to the previous period.',
              ...((isStudio && salesData.data?.byJobType?.length > 0)
                ? [`Your top ${terminology.topCategoryInsightLabel} (${salesData.data.byJobType[0]?.jobType || 'N/A'}) accounts for ${(revenue > 0) ? ((parseFloat(salesData.data.byJobType[0]?.totalSales || 0) / revenue) * 100).toFixed(1) : 0}% of total revenue.`]
                : ((isShop || isPharmacy) && productSalesData?.data?.products?.length > 0)
                ? [`Your top ${terminology.topCategoryInsightLabel} (${productSalesData.data.products[0]?.productName || 'N/A'}) accounts for ${(revenue > 0) ? ((parseFloat(productSalesData.data.products[0]?.revenue || 0) / revenue) * 100).toFixed(1) : 0}% of total revenue.`]
                : [`${terminology.analytics} data is being analyzed.`]),
              (outstandingData.data?.totalOutstanding > 0)
                ? `Outstanding payments total ₵ ${outstandingData.data.totalOutstanding.toLocaleString()}. Consider implementing automated payment reminders.`
                : 'All payments are up to date.',
              (profitMargin > 0)
                ? `Operating expenses are ${(expenses > 0) ? ((expenses / revenue) * 100).toFixed(1) : 0}% of revenue, with a profit margin of ${profitMargin.toFixed(1)}%.`
                : 'Monitor expense ratios to improve profitability.',
              'Continue analyzing business patterns to identify optimization opportunities.'
            ]
          },
          {
            type: 'recommendation',
            title: 'Strategic Recommendations',
            recommendations: aiAnalysis?.recommendations?.length > 0
              ? aiAnalysis.recommendations
              : (() => {
                  const recommendations = [];
                  const outstanding = outstandingData.data?.totalOutstanding || 0;
                  
                  if (outstanding > 0) {
                    recommendations.push({
                      priority: 'High',
                      action: 'Implement automated follow-ups for overdue invoices',
                      impact: `Could recover ₵ ${(outstanding * 0.4).toLocaleString()} in outstanding payments`
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
          ...(aiAnalysis?.riskAssessment?.length > 0 ? [{
            type: 'risk',
            title: 'Risk Assessment',
            risks: aiAnalysis.riskAssessment
          }] : []),
          ...(aiAnalysis?.growthOpportunities?.length > 0 ? [{
            type: 'opportunity',
            title: 'Growth Opportunities',
            opportunities: aiAnalysis.growthOpportunities
          }] : []),
          ...(aiAnalysis?.strategicSuggestions?.length > 0 ? [{
            type: 'strategy',
            title: 'Strategic Suggestions',
            suggestions: aiAnalysis.strategicSuggestions
          }] : []),
          {
            type: 'forecast',
            title: 'Predictive Analysis',
            content: (revenueChange > 0)
              ? 'Based on current trends, projected revenue for the next period is estimated (see metrics).'
              : 'Based on current trends, projected revenue is estimated (see metrics).'
          }
      );
      const mockReport = {
        title: config.reportTitle,
        durationType: config.durationType,
        year: config.year,
        month: config.month,
        generatedAt: new Date().toISOString(),
        generatedBy: config.generatedBy,
        reportTypes: config.reportTypes || selectedReportTypes,
        period: `${dayjs(startDate).format('MMM DD, YYYY')} to ${dayjs(endDate).format('MMM DD, YYYY')}`,
        greeting: `Hello${user?.first_name ? ` ${user.first_name}` : ''}, here is a summary of the performance of your business operations for ${config.month} ${config.year}.`,
        sections: [],
        insights: reportInsights
      };

      // Return the report data instead of saving it
      setAiLoading(false);
      return mockReport;
    } catch (error) {
      console.error('Error generating report:', error);
      setAiLoading(false);
      throw error;
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

    const dismissLoading = showLoading('Generating PDF...', 0);
    try {
      // Import html2pdf dynamically
      const html2pdf = (await import('html2pdf.js')).default;
      
      const reportElement = document.getElementById('report-content');
      if (!reportElement) {
        dismissLoading();
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
      
      dismissLoading();
      showSuccess('PDF downloaded successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      dismissLoading();
      showError(null, 'Failed to generate PDF');
    }
  };

  // Memoize chart data transformations for revenue report
  const revenueChartData = useMemo(() => {
    if (!reportData || reportType !== 'revenue') return { periodChartData: [], customerChartData: [], methodChartData: [] };
    
    const { byPeriod, byCustomer, byMethod } = reportData;

    return {
      periodChartData: byPeriod?.map(item => ({
        name: groupBy === 'day' 
          ? dayjs(item.date || item.date).format('MMM DD')
          : `Month ${item.month}`,
        revenue: parseFloat(item.totalRevenue || 0)
      })) || [],
      customerChartData: byCustomer?.slice(0, 10).map(item => ({
        name: item.customer?.name || 'Unknown',
        revenue: parseFloat(item.totalRevenue || 0)
      })) || [],
      methodChartData: byMethod?.map(item => ({
        name: item.paymentMethod || 'Unknown',
        value: parseFloat(item.totalRevenue || 0)
      })) || []
    };
  }, [reportData, reportType, groupBy]);

  const renderRevenueReport = () => {
    if (!reportData) return null;

    const { totalRevenue } = reportData;
    const { periodChartData, customerChartData, methodChartData } = revenueChartData;

    const customerData = [...(byCustomer || [])].sort((a, b) => parseFloat(a.totalRevenue || 0) - parseFloat(b.totalRevenue || 0));

    return (
      <div id="report-content">
        <div className="grid grid-cols-1 gap-3 md:gap-4 mb-4 md:mb-6">
          <Card>
            <CardContent className="pt-4 md:pt-6 px-4 md:px-6 pb-4 md:pb-6">
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-semibold text-primary">₵ {parseFloat(totalRevenue || 0).toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Revenue Trend</CardTitle>
              <ShadcnSelect value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">By Day</SelectItem>
                  <SelectItem value="month">By Month</SelectItem>
                </SelectContent>
              </ShadcnSelect>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={periodChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip formatter={(value) => `₵ ${parseFloat(value).toFixed(2)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2} name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={customerChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <RechartsTooltip formatter={(value) => `₵ ${parseFloat(value).toFixed(2)}`} />
                  <Bar dataKey="revenue" fill="var(--color-primary)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={methodChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="var(--color-primary)"
                    dataKey="value"
                  >
                    {methodChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => `₵ ${parseFloat(value).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Details</CardTitle>
            </CardHeader>
            <CardContent>
              <ReportsTableWithCards
                title="Customer details"
                columns={[
                  { key: 'customer', label: 'Customer', render: (_, r) => r.customer?.name || '-' },
                  { key: 'company', label: 'Company', render: (_, r) => r.customer?.company || '-' },
                  { key: 'totalRevenue', label: 'Total Revenue', render: (_, r) => `₵ ${parseFloat(r.totalRevenue || 0).toFixed(2)}` },
                  { key: 'paymentCount', label: 'Payments', render: (_, r) => r.paymentCount ?? '-' },
                ]}
                data={customerData.slice(0, 10)}
              />
            </CardContent>
          </Card>
        </div>
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
        <div className="grid grid-cols-1 gap-3 md:gap-4 mb-4 md:mb-6">
          <Card>
            <CardContent className="pt-4 md:pt-6 px-4 md:px-6 pb-4 md:pb-6">
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-2xl font-semibold text-red-700">₵ {parseFloat(totalExpenses || 0).toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Expenses by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="var(--color-primary)"
                    dataKey="value"
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => `₵ ${parseFloat(value).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Top Vendors</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={vendorChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <RechartsTooltip formatter={(value) => `₵ ${parseFloat(value).toFixed(2)}`} />
                  <Bar dataKey="amount" fill="hsl(var(--destructive))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Expense Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dateChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip formatter={(value) => `₵ ${parseFloat(value).toFixed(2)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="amount" stroke="hsl(var(--destructive))" strokeWidth={2} name="Expenses" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Expenses by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ReportsTableWithCards
                title="Expenses by category"
                columns={[
                  { key: 'category', label: 'Category', render: (v) => <Badge className="border-transparent bg-brand text-white hover:bg-brand-dark">{v || '—'}</Badge> },
                  { key: 'totalAmount', label: 'Amount', render: (v) => `₵ ${parseFloat(v || 0).toFixed(2)}` },
                  { key: 'count', label: 'Count' },
                ]}
                data={byCategory || []}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Top Vendors</CardTitle>
            </CardHeader>
            <CardContent>
              <ReportsTableWithCards
                title="Top vendors"
                columns={[
                  { key: 'vendor', label: 'Vendor', render: (_, r) => r.vendor?.name || '-' },
                  { key: 'totalAmount', label: 'Amount', render: (v) => `₵ ${parseFloat(v || 0).toFixed(2)}` },
                  { key: 'count', label: 'Count' },
                ]}
                data={byVendor?.slice(0, 10) || []}
              />
            </CardContent>
          </Card>
        </div>
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

    const invoicesList = (invoices || []).slice(0, 10);

    return (
      <div id="report-content">
        <div className="grid grid-cols-1 gap-3 md:gap-4 mb-4 md:mb-6">
          <Card>
            <CardContent className="pt-4 md:pt-6 px-4 md:px-6 pb-4 md:pb-6">
              <p className="text-sm text-muted-foreground">Total Outstanding</p>
              <p className="text-2xl font-semibold text-red-700">₵ {parseFloat(totalOutstanding || 0).toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Outstanding by Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={customerChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <RechartsTooltip formatter={(value) => `₵ ${parseFloat(value).toFixed(2)}`} />
                  <Bar dataKey="amount" fill="hsl(var(--destructive))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Aging Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={agingChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="var(--color-primary)"
                    dataKey="value"
                  >
                    {agingChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => `₵ ${parseFloat(value).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Outstanding Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <ReportsTableWithCards
                columns={[
                  { key: 'invoiceNumber', label: 'Invoice Number' },
                  { key: 'customer', label: 'Customer', render: (_, r) => r.customer?.name || '-' },
                  { key: 'dueDate', label: 'Due Date', render: (v) => dayjs(v).format('MMM DD, YYYY') },
                  { key: 'balance', label: 'Balance', render: (v) => `₵ ${parseFloat(v || 0).toFixed(2)}` },
                  { key: 'status', label: 'Status', mobileDashboardPlacement: 'headerEnd', render: (_, r) => <StatusChip status={r.status} /> },
                ]}
                data={invoicesList}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderSalesReport = () => {
    if (!reportData) return null;

    const { totalSales, byJobType, byCustomer, byDate, byStatus } = reportData;

    const jobTypeChartData = isStudio && byJobType ? byJobType.map(item => ({
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
        <div className="grid grid-cols-1 gap-3 md:gap-4 mb-4 md:mb-6">
          <Card>
            <CardContent className="pt-4 md:pt-6 px-4 md:px-6 pb-4 md:pb-6">
              <p className="text-sm text-muted-foreground">{terminology.salesLabel}</p>
              <p className="text-2xl font-semibold text-primary">₵ {parseFloat(totalSales || 0).toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {isStudio && (
            <Card>
              <CardHeader>
                <CardTitle>{terminology.salesByTypeLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={jobTypeChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="var(--color-primary)"
                      dataKey="value"
                    >
                      {jobTypeChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value) => `₵ ${parseFloat(value).toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Top Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={customerChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <RechartsTooltip formatter={(value) => `₵ ${parseFloat(value).toFixed(2)}`} />
                  <Bar dataKey="sales" fill="var(--color-primary)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>{terminology.trendLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dateChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip formatter={(value) => `₵ ${parseFloat(value).toFixed(2)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="sales" stroke="var(--color-primary)" strokeWidth={2} name={terminology.revenue} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isStudio && (
            <Card>
              <CardHeader>
                <CardTitle>{terminology.salesByTypeLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <ShadcnTable className="min-w-[400px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{terminology.typeColumnLabel}</TableHead>
                      <TableHead>Total Sales</TableHead>
                      <TableHead>{terminology.countColumnLabel}</TableHead>
                      <TableHead>Avg Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(byJobType || []).map((item) => (
                      <TableRow key={item.jobType}>
                        <TableCell>{item.jobType || '-'}</TableCell>
                        <TableCell>₵ {parseFloat(item.totalSales || 0).toFixed(2)}</TableCell>
                        <TableCell>{item.jobCount ?? '-'}</TableCell>
                        <TableCell>₵ {parseFloat(item.averagePrice || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </ShadcnTable>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Sales by Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <ShadcnTable className="min-w-[400px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Total Sales</TableHead>
                    <TableHead>{terminology.countColumnLabel}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(byStatus || []).map((item) => (
                    <TableRow key={item.status}>
                      <TableCell><StatusChip status={item.status} /></TableCell>
                      <TableCell>₵ {parseFloat(item.totalSales || 0).toFixed(2)}</TableCell>
                      <TableCell>{item.jobCount ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </ShadcnTable>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // Memoize profit/loss chart data
  const profitLossChartData = useMemo(() => {
    if (!reportData || reportType !== 'profit-loss') return [];
    
    const { revenue, expenses, grossProfit } = reportData;
    return [
      { name: 'Revenue', value: revenue, color: 'var(--color-primary)' },
      { name: 'Expenses', value: expenses, color: 'hsl(var(--destructive))' },
      { name: 'Profit', value: grossProfit, color: grossProfit >= 0 ? '#16a34a' : 'hsl(var(--destructive))' },
    ];
  }, [reportData, reportType]);

  const renderProfitLossReport = () => {
    if (!reportData) return null;

    const { revenue, expenses, grossProfit, profitMargin } = reportData;
    const profitData = profitLossChartData;

    return (
      <div id="report-content">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="text-2xl font-semibold text-primary">₵ {parseFloat(revenue || 0).toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Expenses</p>
              <p className="text-2xl font-semibold text-red-700">₵ {parseFloat(expenses || 0).toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Gross Profit</p>
              <p className={cn("text-2xl font-semibold", grossProfit >= 0 ? "text-green-700" : "text-red-700")}>₵ {parseFloat(grossProfit || 0).toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Profit Margin</p>
              <p className={cn("text-2xl font-semibold", profitMargin >= 0 ? "text-green-700" : "text-red-700")}>{parseFloat(profitMargin || 0).toFixed(2)}%</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Profit & Loss Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={profitData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip formatter={(value) => `₵ ${parseFloat(value).toFixed(2)}`} />
                  <Bar dataKey="value" fill="var(--color-primary)">
                    {profitData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
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

  const reportTypes = useMemo(() => [
    { value: 'revenue', label: 'Revenue Report', icon: <Currency className="h-4 w-4" /> },
    { value: 'expenses', label: 'Expense Report', icon: <ShoppingCart className="h-4 w-4" /> },
    { value: 'outstanding', label: 'Outstanding Payments', icon: <FileText className="h-4 w-4" /> },
    { value: 'sales', label: terminology.reportLabel, icon: <BarChart3 className="h-4 w-4" /> },
    { value: 'profit-loss', label: 'Profit & Loss', icon: <BarChart3 className="h-4 w-4" /> },
  ], [terminology.reportLabel]);

  const cardStyle = {
    borderRadius: '8px',
    border: '1px solid #f4f4f4'
  };

  const formatComplianceCurrency = (num) => `₵ ${Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const renderComplianceView = () => {
    const statementTabs = [
      { value: 'income-expenditure', label: 'Income and expenditure' },
      { value: 'profit-loss', label: 'Profit or loss' },
      { value: 'financial-position', label: 'Statement of financial position' },
      { value: 'cashflow', label: 'Statement of cash flows' },
      { value: 'vat', label: 'VAT Summary' }
    ];

    const handlePrint = () => {
      if (compliancePrintRef.current) {
        const printContent = compliancePrintRef.current.innerHTML;
        const win = window.open('', '_blank');
        win.document.write(`
          <html><head><title>Compliance Report</title>
          <style>body{font-family:system-ui,sans-serif;padding:24px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #e5e7eb;padding:8px 12px;text-align:left;} th{background:#f9fafb;}</style>
          </head><body>${printContent}</body></html>`);
        win.document.close();
        win.print();
        win.close();
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Compliance reports</h3>
            <p className="text-sm text-muted-foreground">For submission to revenue centers and tax authorities. Prepared in accordance with International Accounting Standards (IAS) and International Financial Reporting Standards (IFRS).</p>
          </div>
          <div className="flex items-center gap-2">
            <DateRangePicker
              range={dateRange?.[0] && dateRange?.[1] ? { from: dateRange[0].toDate(), to: dateRange[1].toDate() } : undefined}
              onSelect={(r) => r?.from && r?.to && setDateRange([dayjs(r.from), dayjs(r.to)])}
              className="w-auto min-w-[240px]"
            />
            <ShadcnButton variant="outline" size="sm" onClick={handlePrint}>
              <FileText className="h-4 w-4 mr-2" />
              Print
            </ShadcnButton>
            <ShadcnButton className="bg-brand hover:bg-brand-dark text-white" size="sm" onClick={handlePrint}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </ShadcnButton>
          </div>
        </div>
        <Tabs value={complianceStatementType} onValueChange={setComplianceStatementType}>
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
            {statementTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div ref={compliancePrintRef} className="mt-4 border border-border rounded-lg p-4 md:p-6 bg-card">
            {complianceSource === 'accounting' && complianceData && (
              <p className="text-xs text-muted-foreground mb-2">
                From Accounting — figures reflect posted journal entries and chart of accounts.
                {complianceStatementType === 'income-expenditure' && (complianceData.income?.total ?? 0) === 0 && (complianceData.expenditure?.total ?? 0) === 0 && (
                  <span className="block mt-1">No income or expenditure in this period. This report only includes revenue (income) and expense accounts. Post journal entries that affect those accounts to see figures here; asset/liability/equity movements (e.g. buying furniture) do not appear here.</span>
                )}
                {complianceStatementType === 'profit-loss' && (complianceData.revenue ?? 0) === 0 && (complianceData.expenses ?? 0) === 0 && (
                  <span className="block mt-1">No revenue or expenses in this period. Post journal entries that affect income or expense accounts to see figures here.</span>
                )}
                {complianceStatementType === 'cashflow' && (complianceData.operating?.cashReceivedFromCustomers ?? 0) === 0 && (complianceData.operating?.cashPaidToSuppliersAndExpenses ?? 0) === 0 && (
                  <span className="block mt-1">No operating cash in/out in this period from income or expense accounts. Post journal entries that affect those accounts to see figures here.</span>
                )}
              </p>
            )}
            {complianceLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            {complianceError && !complianceLoading && (
              <Alert variant="destructive">
                <AlertDescription>{complianceError}</AlertDescription>
              </Alert>
            )}
            {!complianceLoading && !complianceError && complianceData && complianceStatementType === 'income-expenditure' && (
              <>
                <h4 className="text-base font-semibold mb-3">Income and expenditure report (IAS/IFRS)</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Period: {dateRange?.[0]?.format('DD MMM YYYY')} to {dateRange?.[1]?.format('DD MMM YYYY')}
                </p>
                <div className="space-y-4">
                  <div>
                    <p className="font-medium">Income</p>
                    <p className="text-lg">{formatComplianceCurrency(complianceData.income?.total ?? 0)}</p>
                  </div>
                  <div>
                    <p className="font-medium mb-2">Expenditure by category</p>
                    <ShadcnTable>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(complianceData.expenditure?.byCategory || []).map((row, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Badge className="border-transparent bg-brand text-white hover:bg-brand-dark">{row.category}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatComplianceCurrency(row.amount)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-medium">
                          <TableCell>Total expenditure</TableCell>
                          <TableCell className="text-right">{formatComplianceCurrency(complianceData.expenditure?.total ?? 0)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </ShadcnTable>
                  </div>
                  <div>
                    <p className="font-medium">Surplus / (Deficit)</p>
                    <p className="text-lg">{formatComplianceCurrency(complianceData.surplusDeficit ?? 0)}</p>
                  </div>
                  {complianceSource === 'accounting' && (complianceData.openingStockValue != null || complianceData.closingStockValue != null) && (
                    <div>
                      <p className="font-medium mb-2">Stock (from accounting)</p>
                      <p className="text-sm">Opening stock: {formatComplianceCurrency(complianceData.openingStockValue ?? 0)}</p>
                      <p className="text-sm">Closing stock: {formatComplianceCurrency(complianceData.closingStockValue ?? 0)}</p>
                    </div>
                  )}
                </div>
              </>
            )}
            {!complianceLoading && !complianceError && complianceData && complianceStatementType === 'profit-loss' && (
              <>
                <h4 className="text-base font-semibold mb-3">Profit or loss (IAS 1)</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Period: {dateRange?.[0]?.format('DD MMM YYYY')} to {dateRange?.[1]?.format('DD MMM YYYY')}
                </p>
                <div className="space-y-4">
                  <div>
                    <p className="font-medium">Revenue</p>
                    <p className="text-lg">{formatComplianceCurrency(complianceData.revenue ?? 0)}</p>
                  </div>
                  <div>
                    <p className="font-medium mb-2">Expenses by category</p>
                    <ShadcnTable>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(complianceData.expensesByCategory || []).map((row, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Badge className="border-transparent bg-brand text-white hover:bg-brand-dark">{row.category}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatComplianceCurrency(row.amount)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-medium">
                          <TableCell>Total expenses</TableCell>
                          <TableCell className="text-right">{formatComplianceCurrency(complianceData.expenses ?? 0)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </ShadcnTable>
                  </div>
                  <div>
                    <p className="font-medium">Gross profit</p>
                    <p className="text-lg">{formatComplianceCurrency(complianceData.grossProfit ?? 0)}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">Profit margin: {(complianceData.profitMargin ?? 0).toFixed(2)}%</p>
                  {complianceSource === 'accounting' && (complianceData.openingStockValue != null || complianceData.closingStockValue != null) && (
                    <div>
                      <p className="font-medium mb-2">Stock (from accounting)</p>
                      <p className="text-sm">Opening stock: {formatComplianceCurrency(complianceData.openingStockValue ?? 0)}</p>
                      <p className="text-sm">Closing stock: {formatComplianceCurrency(complianceData.closingStockValue ?? 0)}</p>
                    </div>
                  )}
                </div>
              </>
            )}
            {!complianceLoading && !complianceError && complianceData && complianceStatementType === 'financial-position' && (
              <>
                <h4 className="text-base font-semibold mb-3">Statement of financial position (IAS 1)</h4>
                <p className="text-sm text-muted-foreground mb-4">As at {complianceData.asAtDate || dateRange?.[1]?.format('YYYY-MM-DD')}</p>
                <div className="space-y-4">
                  <div>
                    <p className="font-medium mb-2">Assets</p>
                    <ShadcnTable>
                      <TableBody>
                        <TableRow>
                          <TableCell>Debtors (trade receivables)</TableCell>
                          <TableCell className="text-right">{formatComplianceCurrency(complianceData.assets?.debtors ?? complianceData.assets?.receivables ?? 0)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Product inventory</TableCell>
                          <TableCell className="text-right">{formatComplianceCurrency(complianceData.assets?.productInventory ?? 0)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Materials</TableCell>
                          <TableCell className="text-right">{formatComplianceCurrency(complianceData.assets?.materials ?? 0)}</TableCell>
                        </TableRow>
                        <TableRow className="font-medium">
                          <TableCell>Total assets</TableCell>
                          <TableCell className="text-right">{formatComplianceCurrency(complianceData.totalAssets ?? 0)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </ShadcnTable>
                  </div>
                  <div>
                    <p className="font-medium mb-2">Liabilities</p>
                    <p className="text-sm">Total liabilities: {formatComplianceCurrency(complianceData.liabilities?.total ?? 0)}</p>
                  </div>
                  <div>
                    <p className="font-medium mb-2">Equity</p>
                    <p className="text-sm">Retained earnings: {formatComplianceCurrency(complianceData.equity?.retainedEarnings ?? 0)}</p>
                  </div>
                </div>
              </>
            )}
            {!complianceLoading && !complianceError && complianceData && complianceStatementType === 'cashflow' && (
              <>
                <h4 className="text-base font-semibold mb-3">Statement of cash flows (IAS 7)</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Period: {dateRange?.[0]?.format('DD MMM YYYY')} to {dateRange?.[1]?.format('DD MMM YYYY')}
                </p>
                <div className="space-y-4">
                  <div>
                    <p className="font-medium mb-2">Operating activities</p>
                    <ShadcnTable>
                      <TableBody>
                        <TableRow>
                          <TableCell>Cash received from customers</TableCell>
                          <TableCell className="text-right">{formatComplianceCurrency(complianceData.operating?.cashReceivedFromCustomers ?? 0)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Cash paid to suppliers and expenses</TableCell>
                          <TableCell className="text-right">({formatComplianceCurrency(complianceData.operating?.cashPaidToSuppliersAndExpenses ?? 0)})</TableCell>
                        </TableRow>
                        <TableRow className="font-medium">
                          <TableCell>Net cash from operating activities</TableCell>
                          <TableCell className="text-right">{formatComplianceCurrency(complianceData.operating?.netCashFromOperatingActivities ?? 0)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </ShadcnTable>
                  </div>
                  <div>
                    <p className="font-medium">Net change in cash</p>
                    <p className="text-lg">{formatComplianceCurrency(complianceData.netChangeInCash ?? 0)}</p>
                  </div>
                </div>
              </>
            )}
            {complianceStatementType === 'vat' && vatLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            {complianceStatementType === 'vat' && !vatLoading && vatData && (
              <>
                <h4 className="text-base font-semibold mb-3">VAT Summary Report</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Period: {dateRange?.[0]?.format('DD MMM YYYY')} to {dateRange?.[1]?.format('DD MMM YYYY')}
                </p>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Total VAT Collected</p>
                        <p className="text-2xl font-bold text-primary">
                          {formatComplianceCurrency(vatData.summary?.totalVatCollected ?? 0)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          From {vatData.summary?.invoiceCount ?? 0} invoices + {vatData.summary?.saleCount ?? 0} sales
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Taxable Amount</p>
                        <p className="text-2xl font-bold">
                          {formatComplianceCurrency(vatData.summary?.totalTaxableAmount ?? 0)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Total sales before tax</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Effective Tax Rate</p>
                        <p className="text-2xl font-bold">
                          {vatData.summary?.effectiveTaxRate ?? 0}%
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Average across all transactions</p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div>
                    <p className="font-medium mb-2">VAT Breakdown by Source</p>
                    <ShadcnTable>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source</TableHead>
                          <TableHead className="text-right">Transactions</TableHead>
                          <TableHead className="text-right">VAT Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>Invoices</TableCell>
                          <TableCell className="text-right">{vatData.summary?.invoiceCount ?? 0}</TableCell>
                          <TableCell className="text-right">{formatComplianceCurrency(vatData.summary?.invoiceVat ?? 0)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>POS Sales</TableCell>
                          <TableCell className="text-right">{vatData.summary?.saleCount ?? 0}</TableCell>
                          <TableCell className="text-right">{formatComplianceCurrency(vatData.summary?.saleVat ?? 0)}</TableCell>
                        </TableRow>
                        <TableRow className="font-medium bg-muted/50">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right">{(vatData.summary?.invoiceCount ?? 0) + (vatData.summary?.saleCount ?? 0)}</TableCell>
                          <TableCell className="text-right">{formatComplianceCurrency(vatData.summary?.totalVatCollected ?? 0)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </ShadcnTable>
                  </div>

                  {vatData.byPeriod && vatData.byPeriod.length > 0 && (
                    <div>
                      <p className="font-medium mb-2">VAT by Period</p>
                      <ShadcnTable>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Period</TableHead>
                            <TableHead className="text-right">Invoice VAT</TableHead>
                            <TableHead className="text-right">Sales VAT</TableHead>
                            <TableHead className="text-right">Total VAT</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {vatData.byPeriod.map((row, i) => (
                            <TableRow key={i}>
                              <TableCell>{row.period}</TableCell>
                              <TableCell className="text-right">{formatComplianceCurrency(row.invoiceVat ?? 0)}</TableCell>
                              <TableCell className="text-right">{formatComplianceCurrency(row.saleVat ?? 0)}</TableCell>
                              <TableCell className="text-right font-medium">{formatComplianceCurrency(row.totalVat ?? 0)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </ShadcnTable>
                    </div>
                  )}

                  <Alert>
                    <AlertDescription>
                      This VAT summary is for internal reporting purposes. For official tax filings, please verify all figures with your accountant and ensure compliance with local tax regulations.
                    </AlertDescription>
                  </Alert>
                </div>
              </>
            )}
            {complianceStatementType === 'vat' && !vatLoading && !vatData && (
              <p className="text-sm text-muted-foreground">No VAT data available for the selected period.</p>
            )}
            {!complianceLoading && !complianceError && !complianceData && complianceStatementType !== 'vat' && (
              <p className="text-sm text-muted-foreground">Select a statement type and date range to view the report.</p>
            )}
          </div>
        </Tabs>
      </div>
    );
  };

  const renderOverviewDashboard = () => {
    if (!overviewStats) {
      return (
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <Skeleton className="h-4 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-32 mx-auto" />
          </div>
        </div>
      );
    }

    const { 
      revenue, 
      expenses, 
      profitLoss, 
      revenueGrowth,
      periodTypeLabel,
      productStockSummary,
      materialsSummary,
      materialsMovements,
      fastestMovingItems,
      revenueByChannel: revenueByChannelFromApi,
      serviceAnalytics,
      sales,
      productSales,
      kpiSummary,
      topCustomers,
      pipelineSummary
    } = overviewStats;

    // Calculate growth metrics from real data
    const totalRevenue = revenue?.totalRevenue || 0;
    const totalExpenses = expenses?.totalExpenses || 0;
    
    // Calculate net income and profit margin from the same date range data
    const netIncome = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? ((netIncome / totalRevenue) * 100) : 0;
    
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

    // Top revenue entities:
    // - For shop/pharmacy: use top products by revenue
    // - Otherwise (studio-like): use top customers by revenue
    let topServices = [];
    if ((isShop || isPharmacy) && (productSales?.products || []).length > 0) {
      topServices = productSales.products.slice(0, 5).map((item) => ({
        name: item.productName || 'Unknown',
        value: parseFloat(item.revenue || 0)
      }));
    } else if (revenue?.byCustomer?.length > 0) {
      topServices = revenue.byCustomer.slice(0, 5).map((item) => ({
        name: item.customer?.name || 'Unknown',
        value: parseFloat(item.totalRevenue || 0)
      }));
    }

    // Revenue by channel - prefer API (payment method), then service analytics / job type / sales by payment method
    const paymentMethodLabel = (method) =>
      method === 'cash' ? 'Cash' : method === 'mobile_money' ? 'MoMo' : method === 'card' ? 'Card'
        : method === 'credit' ? 'Credit' : method === 'bank_transfer' ? 'Bank' : (method || 'Other');
    const channelFromPaymentMethod = sales?.byPaymentMethod?.length > 0 && !serviceAnalytics?.byCategory?.length && !sales?.byJobType?.length;
    const revenueByChannel = (revenueByChannelFromApi?.length > 0)
      ? revenueByChannelFromApi.map((item) => ({ channel: item.channel || 'Other', revenue: parseFloat(item.revenue || 0) }))
      : serviceAnalytics?.byCategory?.length > 0
      ? serviceAnalytics.byCategory.slice(0, 4).map(item => ({
          channel: item.category || 'Other',
          revenue: parseFloat(item.totalRevenue || 0)
        }))
      : sales?.byJobType?.length > 0
      ? sales.byJobType.slice(0, 4).map(item => ({
          channel: item.jobType || item.category || 'Other',
          revenue: parseFloat(item.totalSales || 0)
        }))
      : sales?.byPaymentMethod?.length > 0
      ? sales.byPaymentMethod.slice(0, 6).map(item => ({
          channel: paymentMethodLabel(item.paymentMethod),
          revenue: parseFloat(item.totalAmount || 0)
        }))
      : [];

    // When no channel data: for shop/pharmacy show Revenue by Product (top performing products)
    const revenueByProduct = (revenueByChannel.length === 0 && (isShop || isPharmacy) && (productSales?.products || []).length > 0)
      ? (productSales.products || []).slice(0, 8).map(item => ({
          channel: item.productName || 'Unknown',
          revenue: parseFloat(item.revenue || 0)
        }))
      : [];
    const showRevenueByProduct = revenueByProduct.length > 0;
    
    // Use service analytics total revenue if available, otherwise use sales total
    const totalSales = serviceAnalytics?.totalRevenue || sales?.totalSales || 0;

    // Format date range for display
    const dateRangeDisplay = `${dateRange[0].format('MMM DD, YYYY')} - ${dateRange[1].format('MMM DD, YYYY')}`;
    
    // Check if we have any data for the selected period
    const hasDataForPeriod = totalRevenue > 0 || totalExpenses > 0 || (sales?.totalJobs || 0) > 0;
    
    return (
      <div>
        {/* Date Range Indicator */}
        <div className="mb-4 py-2 px-4 bg-muted rounded-md inline-block">
          <span className="text-xs text-muted-foreground">
            Showing data for: <span className="font-semibold">{dateRangeDisplay}</span>
            {!hasDataForPeriod && (
              <span className="text-amber-600 ml-2"> (No data found for this period)</span>
            )}
          </span>
        </div>
        
        {/* Top Row - 3 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-3 md:mb-4">
          {/* Card 1: Financial Summary */}
          <Card style={cardStyle}>
            <CardContent className="pt-4 md:pt-6 space-y-3 md:space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Revenue growth {overviewStats?.periodTypeLabel || 'M/M'}</p>
                <h2 className={cn("text-3xl font-bold mt-2", revenueGrowth >= 0 ? "text-primary" : "text-red-700")}>
                  {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth.toFixed(1)}%
                </h2>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Revenue</p>
                  <p className="text-xl font-semibold text-foreground">₵ {(totalRevenue / 1000).toFixed(3)}K</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Net income</p>
                  <p className="text-xl font-semibold text-foreground">₵ {(netIncome / 1000).toFixed(3)}K</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Profit margin</p>
                <p className="text-2xl font-semibold text-foreground">{profitMargin.toFixed(2)}%</p>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Expense Chart */}
          <Card style={cardStyle}>
            <CardHeader className="pb-2 px-4 md:px-6 pt-4 md:pt-6">
              <CardTitle className="text-base font-semibold">Expense Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-4 md:px-6 pb-4 md:pb-6">
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
                    <RechartsTooltip 
                      formatter={(value) => `₵ ${value.toLocaleString()}`}
                      contentStyle={{ borderRadius: 8, border: '1px solid #f4f4f4' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className={`text-center ${emptyStateClassXL}`}>No expense data available</div>
              )}
              <div className="mt-5">
                {expenseData.length > 0 ? (
                  expenseData.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center mb-3 last:mb-0">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-sm text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-foreground">
                        {expenses.totalExpenses > 0 ? ((item.value / expenses.totalExpenses) * 100).toFixed(0) : 0}% · ₵ {(item.value / 1000).toFixed(3)}K
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No expense data available for this period</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Jobs/Sales Summary */}
          <Card style={cardStyle}>
            <CardContent className="pt-4 md:pt-6 space-y-3 md:space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">{terminology.salesLabel}</p>
                <h2 className="text-3xl font-bold mt-2 text-foreground">
                  {isShop || isPharmacy ? (sales?.totalJobs ?? 0) : (sales?.totalJobs ?? 0)}
                </h2>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1">{terminology.salesValueLabel}</p>
                <p className="text-xl font-semibold text-foreground">
                  ₵ {((isShop || isPharmacy ? (totalRevenue || parseFloat(sales?.totalSales) || 0) : totalRevenue) / 1000).toFixed(3)}K
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">{terminology.rateLabel}</p>
                <div className="flex flex-col gap-1">
                  {(() => {
                    if (isShop || isPharmacy) {
                      const totalValue = parseFloat(sales?.totalSales) || 0;
                      const byPayment = sales?.byPaymentMethod ?? [];
                      const paymentLabels = { cash: 'Cash', card: 'Card', credit_card: 'Card', mobile_money: 'MoMo', bank_transfer: 'Bank', credit: 'Credit', other: 'Other' };
                      const cashAmount = byPayment.find(p => (p.paymentMethod || '').toLowerCase() === 'cash')?.totalAmount ?? 0;
                      const cashValue = parseFloat(cashAmount);
                      const cashRate = totalValue > 0 ? Math.round((cashValue / totalValue) * 100) : 0;
                      const sortedByValue = [...byPayment]
                        .map(p => ({ ...p, totalAmount: parseFloat(p.totalAmount || 0) }))
                        .filter(p => p.totalAmount > 0)
                        .sort((a, b) => b.totalAmount - a.totalAmount);
                      return (
                        <>
                          <span className="text-2xl font-semibold text-foreground">{cashRate}%</span>
                          {sortedByValue.length > 0 && (
                            <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                              {sortedByValue.map((m) => {
                                const label = paymentLabels[(m.paymentMethod || '').toLowerCase()] || m.paymentMethod || 'Other';
                                const val = parseFloat(m.totalAmount || 0);
                                const pct = totalValue > 0 ? Math.round((val / totalValue) * 100) : 0;
                                return (
                                  <div key={m.paymentMethod || label} className="flex justify-between items-center gap-2">
                                    <span>{label}</span>
                                    <span className="font-medium text-foreground">₵ {val.toLocaleString()} ({pct}%)</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      );
                    } else {
                      const totalJobs = sales?.totalJobs || 0;
                      const completedJobs = sales?.byStatus?.find(s => s.status === 'completed')?.jobCount || 0;
                      const completionRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;
                      return <span className="text-2xl font-semibold text-foreground">{completionRate}%</span>;
                    }
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* KPI, Top Customers, Pipeline Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-3 md:mb-4">
          <Card style={cardStyle}>
            <CardHeader className="py-3 md:py-4 px-4 md:px-6">
              <CardTitle className="text-base font-semibold">KPI Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-4 md:px-6 pb-4 md:pb-6 space-y-2 md:space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Active customers</span>
                <span className="text-lg font-semibold text-foreground">{kpiSummary?.activeCustomers ?? 0}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pending invoices</span>
                <span className="text-lg font-semibold text-foreground">₵ {(kpiSummary?.pendingInvoices ?? 0).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
          <Card style={cardStyle}>
            <CardHeader className="py-3 md:py-4 px-4 md:px-6">
              <CardTitle className="text-base font-semibold">Top Customers by Revenue</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-4 md:px-6 pb-4 md:pb-6">
              {(topCustomers && topCustomers.length > 0) ? (
                <div className="space-y-2">
                  {topCustomers.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
                      <span className="text-sm text-foreground flex-1 truncate">{item.customer?.name || item.customer?.company || 'Unknown'}</span>
                      <span className="text-sm font-semibold text-primary ml-2">₵ {parseFloat(item.totalRevenue || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`text-center ${emptyStateClass}`}>No customer data for this period</div>
              )}
            </CardContent>
          </Card>
          <Card style={cardStyle}>
            <CardHeader className="py-3 md:py-4 px-4 md:px-6">
              <CardTitle className="text-base font-semibold">{isStudio ? 'Pipeline Summary' : 'Outstanding'}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-4 md:px-6 pb-4 md:pb-6 space-y-2 md:space-y-3">
              {isStudio && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Active jobs</span>
                    <span className="text-lg font-semibold text-foreground">{pipelineSummary?.activeJobs ?? 0}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Open leads</span>
                    <span className="text-lg font-semibold text-foreground">{pipelineSummary?.openLeads ?? 0}</span>
                  </div>
                  <Separator />
                </>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pending invoices (count)</span>
                <span className="text-lg font-semibold text-foreground">{pipelineSummary?.pendingInvoices ?? 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Middle Row - 2 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-3 md:mb-4">
          {/* Card 4: Revenue Generated */}
          <div className="md:col-span-2">
            <Card style={cardStyle}>
              <CardContent className="pt-4 md:pt-6 px-4 md:px-6 pb-4 md:pb-6">
                <div className="mb-4 md:mb-5">
                  <p className="text-sm text-muted-foreground mb-2">Total revenue generated</p>
                  <h2 className="text-2xl font-bold text-primary">₵ {totalRevenue.toFixed(3)}</h2>
                </div>
                {dailyRevenueTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={dailyRevenueTrend} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.05}/>
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
                      <RechartsTooltip 
                        formatter={(value) => [`₵ ${value.toLocaleString()}`, 'Revenue']}
                        contentStyle={{ borderRadius: 8, border: '1px solid #d9d9d9' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="var(--color-primary)" 
                        fill="url(#colorRevenue)"
                        strokeWidth={3}
                        dot={{ fill: 'var(--color-primary)', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className={`text-center ${emptyStateClassLarge}`}>No revenue data available for this period</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Card 5: Jobs/Sales Trend */}
          <Card 
            style={cardStyle}
          >
            <CardHeader className="py-3 md:py-4 px-4 md:px-6">
              <CardTitle className="text-base font-semibold">{terminology.trendLabel}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-4 md:px-6 pb-4 md:pb-6">
              {isShop ? (
                // For shop: show payment method breakdown or sales by day
                (() => {
                  const paymentMethodData = sales?.byPaymentMethod || [];
                  if (paymentMethodData.length > 0) {
                    const chartData = paymentMethodData.map(item => ({
                      name: item.paymentMethod === 'cash' ? 'Cash' :
                            item.paymentMethod === 'credit' ? 'Credit' :
                            item.paymentMethod === 'card' ? 'Card' :
                            item.paymentMethod === 'mobile_money' ? 'Mobile' :
                            item.paymentMethod === 'bank_transfer' ? 'Bank' : 'Other',
                      value: parseFloat(item.totalAmount || item.count || 0),
                      count: parseInt(item.count || 0)
                    }));
                    
                    const PAYMENT_COLORS = COLORS;
                    
                    return (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="count"
                            nameKey="name"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            formatter={(value, name) => [`${value} sales`, name]}
                            contentStyle={{ borderRadius: 8, border: '1px solid #f4f4f4' }}
                          />
                          <Legend 
                            wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                            iconType="circle"
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    );
                  }
                  // Fallback to daily sales trend if no payment method data
                  return (
                    <div className={`text-center ${emptyStateClassLarge}`}>No sales data available for this period</div>
                  );
                })()
              ) : (
                // For printing press: show jobs trend
                jobsTrend.length > 0 ? (
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
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: 8, border: '1px solid #f4f4f4' }}
                      />
                      <Legend 
                        wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
                        iconType="circle"
                      />
                      <Bar dataKey="incoming" fill="var(--color-primary)" name={terminology.incomingLabel} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="completed" fill="hsl(var(--primary) / 0.42)" name={terminology.completedLabel} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className={`text-center ${emptyStateClassLarge}`}>No {terminology.sales.toLowerCase()} data available for this period</div>
                )
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row - 2 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {/* Card 6: Top 5 Services/Customers */}
          <Card style={cardStyle}>
            <CardHeader className="py-3 md:py-4 px-4 md:px-6">
              <CardTitle className="text-base font-semibold">{terminology.topRevenueLabel}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-4 md:px-6 pb-4 md:pb-6">
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
                      <RechartsTooltip 
                        formatter={(value) => `₵ ${(value / 1000).toFixed(2)}K`}
                        contentStyle={{ borderRadius: 8, border: '1px solid #f4f4f4' }}
                      />
                      <Bar 
                        dataKey="value" 
                        fill="var(--color-primary)" 
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="space-y-0 mt-4">
                    {topServices.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2.5 border-b border-border last:border-0">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground mb-1">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {totalRevenue > 0 ? ((item.value / totalRevenue) * 100).toFixed(1) : 0}% of total revenue
                          </p>
                        </div>
                        <span className="text-primary font-bold ml-4">₵ {(item.value / 1000).toFixed(2)}K</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className={`text-center ${emptyStateClassLarge}`}>No revenue sources data available</div>
              )}
            </CardContent>
          </Card>

          {/* Card 7: Revenue by Channel, or by payment method, or Revenue by Product (top products) when no channel data */}
          <Card style={cardStyle}>
            <CardHeader className="py-3 md:py-4 px-4 md:px-6">
              <CardTitle className="text-base font-semibold">
                {showRevenueByProduct ? 'Revenue by Product' : 'Revenue by Channel'}
                {revenueByChannel.length > 0 && channelFromPaymentMethod && (
                  <span className="text-muted-foreground text-xs font-normal ml-1.5">(by payment method)</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-4 md:px-6 pb-4 md:pb-6">
              {(revenueByChannel.length > 0 || showRevenueByProduct) ? (
                (() => {
                  const chartData = revenueByChannel.length > 0 ? revenueByChannel : revenueByProduct;
                  const totalForPct = revenueByChannel.length > 0 ? totalSales : (productSales?.totalRevenue || 0);
                  return (
                    <>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                          data={chartData.map(item => ({
                            name: item.channel,
                            value: item.revenue,
                            percentage: totalForPct > 0 ? ((item.revenue / totalForPct) * 100) : 0
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
                          <RechartsTooltip 
                            formatter={(value) => `₵ ${(value / 1000).toFixed(2)}K`}
                            contentStyle={{ borderRadius: 8, border: '1px solid #f4f4f4' }}
                          />
                          <Bar 
                            dataKey="value" 
                            fill="var(--color-primary)" 
                            radius={[0, 4, 4, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="space-y-0 mt-4">
                        {chartData.map((item, idx) => {
                          const percentage = totalForPct > 0 ? ((item.revenue / totalForPct) * 100) : 0;
                          return (
                            <div key={idx} className="flex justify-between items-center py-2.5 border-b border-border last:border-0">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground mb-1 truncate">{item.channel}</p>
                                <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}% of total</p>
                              </div>
                              <span className="text-brand font-bold ml-4">₵ {(item.revenue / 1000).toFixed(2)}K</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()
              ) : (
                <div className={`text-center ${emptyStateClassLarge}`}>No data available for this period</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // Report type options grouped and filtered by business type
  const reportTypeOptionsGrouped = useMemo(() => {
    const financial = [
      { value: 'cashflow', label: 'Cashflow overview', description: 'Overall business health and financial performance' },
      { value: 'cost-analysis', label: 'Cost analysis', description: 'Detailed view of expenses and cost-saving opportunities' },
      { value: 'invoice-summary', label: 'Invoice summary', description: 'Overview of invoice statuses and payment trends' },
      { value: 'outstanding-payments', label: 'Outstanding payments', description: 'AR total, aging, and overdue amounts' },
    ];
    const salesAndPerformance = [
      { value: 'customer-summary', label: 'Customer summary', description: 'Top customers by revenue and activity' },
      { value: 'sales-summary', label: isStudio ? 'Jobs summary' : 'Sales summary', description: isStudio ? 'Job volume, status, and trends' : 'Sales volume, status, and trends' },
    ];
    if (isStudio) {
      salesAndPerformance.push({ value: 'service-analytics', label: terminology.analytics, description: terminology.analyticsDescription });
      salesAndPerformance.push({ value: 'materials-summary', label: 'Materials summary', description: 'Stock levels and movements' });
    }
    if (isPharmacy) {
      salesAndPerformance.push({ value: 'product-analytics', label: 'Drug Analytics', description: 'Drug and prescription performance' });
      salesAndPerformance.push({ value: 'prescription-summary', label: 'Prescription summary', description: 'Prescription volume, status, and revenue' });
    }
    if (isShop && !isPharmacy) {
      salesAndPerformance.push({ value: 'product-analytics', label: 'Product Analytics', description: 'Product sales and inventory performance' });
    }
    const operations = [
      { value: 'pipeline', label: 'Pipeline', description: 'Active jobs, open leads, and pending invoices' },
    ];
    const groups = [
      { groupLabel: 'Financial', options: financial },
      { groupLabel: 'Sales & performance', options: salesAndPerformance },
      { groupLabel: 'Operations', options: operations },
    ];
    return groups;
  }, [isStudio, isPharmacy, isShop, terminology.analytics, terminology.analyticsDescription]);

  // Flat list of all report types (for backward compatibility and iteration)
  const reportTypeOptions = useMemo(
    () => reportTypeOptionsGrouped.flatMap((g) => g.options),
    [reportTypeOptionsGrouped]
  );

  if (!rc) {
    return (
      <div className="space-y-4 md:space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
          <span>Loading charts…</span>
        </div>
        <Skeleton className="h-10 w-full max-w-lg" />
        <Skeleton className="h-[320px] w-full rounded-md border border-border" />
        <Skeleton className="h-[220px] w-full rounded-md border border-border" />
      </div>
    );
  }

  const {
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
    Tooltip: RechartsTooltip,
    Legend,
    ResponsiveContainer,
  } = rc;

  const renderGeneratedReports = () => {
    // Map report types to display names and icons
    const getReportTypeDisplay = (reportType, report = null) => {
      const businessType = report?.businessType || activeTenant?.businessType || 'printing_press';
      const productLabel = businessType === 'pharmacy' ? 'Drug overview' : 'Product overview';
      const typeMap = {
        'cost-analysis': { label: 'Cost analysis', icon: BarChart3 },
        'service-analytics': { label: 'Service overview', icon: Zap },
        'cashflow': { label: 'Cashflow overview', icon: Currency },
        'invoice-summary': { label: 'Invoice overview', icon: FileText },
        'outstanding-payments': { label: 'Outstanding payments', icon: FileText },
        'customer-summary': { label: 'Customer summary', icon: Users },
        'sales-summary': { label: businessType === 'pharmacy' || businessType === 'shop' ? 'Sales summary' : 'Jobs summary', icon: BarChart3 },
        'materials-summary': { label: 'Materials summary', icon: Zap },
        'pipeline': { label: 'Pipeline', icon: BarChart3 },
        'product-analytics': { label: productLabel, icon: Zap },
        'prescription-summary': { label: 'Prescription summary', icon: FileText },
        'inventory': { label: 'Materials overview', icon: Zap },
        'fleet': { label: 'Fleet overview', icon: Zap }
      };
      return typeMap[reportType] || { label: reportType, icon: FileText };
    };

    // Get report types from insights or default
    const getReportTypes = (report) => {
      if (report.reportTypes && Array.isArray(report.reportTypes)) {
        return report.reportTypes;
      }
      // Extract types from insights
      const types = [];
      if (report.insights) {
        report.insights.forEach(insight => {
          if (insight.type === 'cost-analysis') types.push('cost-analysis');
          else if (insight.type === 'service-analytics' || insight.type === 'product-analytics') {
            types.push(insight.type === 'product-analytics' ? 'product-analytics' : 'service-analytics');
          }
          else if (insight.type === 'invoice-summary') types.push('invoice-summary');
          else if (insight.type === 'prescription-summary') types.push('prescription-summary');
          else if (['outstanding-payments', 'customer-summary', 'sales-summary', 'materials-summary', 'pipeline'].includes(insight.type)) types.push(insight.type);
        });
      }
      // Default if no types found
      return types.length > 0 ? types : ['cost-analysis'];
    };

    // Determine status from actual status field (default to 'ready' if not set for backward compatibility)
    const getReportStatus = (report) => {
      return report.status || 'ready';
    };

    return (
      <div className={isMobile ? "space-y-4" : "space-y-6"}>
        {/* Loading State */}
        {aiLoading && (
          <Card>
            <CardContent className={isMobile ? "p-4" : "p-6 md:p-12"}>
              <div className="space-y-4 md:space-y-6">
                <div className="text-center">
                  <Skeleton className="h-12 w-12 mx-auto mb-4 rounded-full" />
                  <Skeleton className="h-6 w-64 mx-auto mb-2" />
                  <Skeleton className="h-4 w-48 mx-auto" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {savedReports.length === 0 && !aiLoading && (
          <Card>
            <CardContent className={isMobile ? "p-4" : "p-8 md:p-20"}>
              <div className="text-center">
                <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h4 className="text-lg font-semibold">No Reports Created Yet</h4>
                <p className="text-muted-foreground max-w-[480px] mx-auto my-4">
                  Create custom reports with specific date ranges, report types, and configurations. These reports will be saved for future reference.
                </p>
                <ShadcnButton
                  onClick={handleOpenCreateReportModal}
                  className="bg-brand hover:bg-brand-dark text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Report
                </ShadcnButton>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reports Table - table on desktop, cards on mobile */}
        {filteredReports.length > 0 && !aiLoading && (
          isMobile ? (
            <div className="space-y-2">
              {filteredReports.map((report, index) => {
                const reportTypesList = getReportTypes(report);
                const status = getReportStatus(report);
                return (
                  <div key={index} className="border border-border rounded-lg p-4 bg-card">
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{report.title}</p>
                              <p className="text-muted-foreground text-xs mt-0.5">{dayjs(report.generatedAt).format('D/MM/YYYY')}</p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <ShadcnButton
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 shrink-0 min-h-[44px] min-w-[44px]"
                                >
                                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                </ShadcnButton>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => status === 'ready' && setGeneratedReport(report)}
                                  disabled={status !== 'ready'}
                                  className={status !== 'ready' ? 'opacity-50 cursor-not-allowed' : ''}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    showSuccess('Download feature coming soon');
                                  }}
                                  disabled={status !== 'ready'}
                                  className={status !== 'ready' ? 'opacity-50 cursor-not-allowed' : ''}
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {reportTypesList.slice(0, 2).map((type, idx) => {
                              const typeDisplay = getReportTypeDisplay(type, report);
                              const Icon = typeDisplay.icon;
                              return (
                                <Badge
                                  key={idx}
                                  variant="secondary"
                                  className="bg-muted text-foreground border-0 flex items-center gap-1 px-2 py-1"
                                >
                                  <Icon className="h-3 w-3" />
                                  {typeDisplay.label}
                                </Badge>
                              );
                            })}
                            {reportTypesList.length > 2 && (
                              <Badge
                                variant="secondary"
                                className="bg-muted text-muted-foreground border-0 flex items-center gap-1 px-2 py-1"
                                title={reportTypesList.slice(2).map((t) => getReportTypeDisplay(t, report).label).join(', ')}
                              >
                                +{reportTypesList.length - 2}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                            <span className="text-xs text-muted-foreground">{report.generatedBy}</span>
                            <Badge
                              className={
                                status === 'ready'
                                  ? 'bg-primary/15 text-primary border-0 px-2 py-1 hover:bg-primary/15 cursor-default'
                                  : status === 'processing'
                                  ? 'bg-orange-100 text-orange-700 border-0 px-2 py-1 hover:bg-orange-100 cursor-default'
                                  : 'bg-red-100 text-red-700 border-0 px-2 py-1 hover:bg-red-100 cursor-default'
                              }
                            >
                              {status === 'ready' ? 'Ready' : status === 'processing' ? 'Processing' : 'Failed'}
                            </Badge>
                          </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Card className="border border-border rounded-lg overflow-hidden">
              <CardContent className="p-0">
                <ShadcnTable className="min-w-[400px]">
                  <TableHeader>
                    <TableRow className="border-b border-border bg-muted/50">
                      <TableHead className="font-semibold text-foreground py-4 px-6">Report name</TableHead>
                      <TableHead className="font-semibold text-foreground py-4 px-6">Date created</TableHead>
                      <TableHead className="font-semibold text-foreground py-4 px-6">Type</TableHead>
                      <TableHead className="font-semibold text-foreground py-4 px-6">Created by</TableHead>
                      <TableHead className="font-semibold text-foreground py-4 px-6">Status</TableHead>
                      <TableHead className="font-semibold text-foreground py-4 px-6 w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map((report, index) => {
                      const reportTypesList = getReportTypes(report);
                      const status = getReportStatus(report);
                      return (
                        <TableRow key={index} className="border-b border-border hover:bg-muted/50">
                          <TableCell className="font-medium py-4 px-6">{report.title}</TableCell>
                          <TableCell className="text-muted-foreground py-4 px-6">
                            {dayjs(report.generatedAt).format('D/MM/YYYY')}
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <div className="flex flex-wrap gap-2">
                              {reportTypesList.slice(0, 2).map((type, idx) => {
                                const typeDisplay = getReportTypeDisplay(type, report);
                                const Icon = typeDisplay.icon;
                                return (
                                  <Badge
                                    key={idx}
                                    variant="secondary"
                                    className="bg-muted text-foreground border-0 flex items-center gap-1 px-2 py-1"
                                  >
                                    <Icon className="h-3 w-3" />
                                    {typeDisplay.label}
                                  </Badge>
                                );
                              })}
                              {reportTypesList.length > 2 && (
                                <Badge
                                  variant="secondary"
                                  className="bg-muted text-muted-foreground border-0 flex items-center gap-1 px-2 py-1"
                                  title={reportTypesList.slice(2).map((t) => getReportTypeDisplay(t, report).label).join(', ')}
                                >
                                  +{reportTypesList.length - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground py-4 px-6">{report.generatedBy}</TableCell>
                          <TableCell className="py-4 px-6">
                            <Badge
                              className={
                                status === 'ready'
                                  ? 'bg-primary/15 text-primary border-0 px-2 py-1 hover:bg-primary/15 cursor-default'
                                  : status === 'processing'
                                  ? 'bg-orange-100 text-orange-700 border-0 px-2 py-1 hover:bg-orange-100 cursor-default'
                                  : 'bg-red-100 text-red-700 border-0 px-2 py-1 hover:bg-red-100 cursor-default'
                              }
                            >
                              {status === 'ready' ? 'Ready' : status === 'processing' ? 'Processing' : 'Failed'}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <ShadcnButton
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-muted"
                                >
                                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                </ShadcnButton>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => status === 'ready' && setGeneratedReport(report)}
                                  disabled={status !== 'ready'}
                                  className={status !== 'ready' ? 'opacity-50 cursor-not-allowed' : ''}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    showSuccess('Download feature coming soon');
                                  }}
                                  disabled={status !== 'ready'}
                                  className={status !== 'ready' ? 'opacity-50 cursor-not-allowed' : ''}
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </ShadcnTable>
              </CardContent>
            </Card>
          )
        )}
      </div>
    );
  };

  const renderAIReportGenerator = () => {
    return (
      <div>
        {/* Header */}
        <div className="mb-4 md:mb-6">
          <h4 className="text-lg font-semibold flex items-center gap-2">
            <Bot className="h-4 w-4" /> Smart Report
          </h4>
          <p className="text-muted-foreground text-sm mt-1">
            Auto-generated monthly business intelligence report with AI-powered insights
          </p>
        </div>

        {/* Loading State */}
        {aiLoading && (
          <Card style={cardStyle}>
            <div className="space-y-4 md:space-y-6 p-6 md:p-12">
              <div className="text-center">
                <Skeleton className="h-12 w-12 mx-auto mb-4 rounded-full" />
                <Skeleton className="h-6 w-64 mx-auto mb-2" />
                <Skeleton className="h-4 w-48 mx-auto" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          </Card>
        )}

        {/* Report Content */}
        {generatedReport && !aiLoading && (
          <div id="generated-report-content">
            {/* Back to list */}
            <div style={{ marginBottom: 16 }}>
              <ShadcnButton
                variant="outline"
                size="sm"
                onClick={() => setGeneratedReport(null)}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to list
              </ShadcnButton>
            </div>
            {/* Report Header */}
            <Card style={{ ...cardStyle, marginBottom: 12 }}>
              <CardContent className="space-y-2 p-4 md:p-6">
                {/* Mobile: title row, subtitle row, buttons row. Desktop: title+subtitle left, buttons right */}
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start sm:gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="text-sm sm:text-2xl font-semibold sm:font-bold truncate whitespace-nowrap block" title={generatedReport.title}>
                      {generatedReport.title}
                    </h2>
                    <p className="text-muted-foreground text-sm block">
                      Prepared by {generatedReport.generatedBy} · {dayjs(generatedReport.generatedAt).format('MMM DD, YYYY HH:mm')}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 sm:self-start">
                    <ShadcnButton
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const el = document.getElementById('generated-report-content');
                        if (el) {
                          const win = window.open('', '_blank');
                          win.document.write(
                            '<!DOCTYPE html><html><head><title>' +
                              (generatedReport?.title || 'Smart Report') +
                              '</title><style>body{font-family:system-ui,sans-serif;padding:1rem;max-width:800px;margin:0 auto}</style></head><body>' +
                              el.innerHTML +
                              '</body></html>'
                          );
                          win.document.close();
                          win.print();
                          win.close();
                        }
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Print
                    </ShadcnButton>
                    <ShadcnButton
                      className="bg-brand hover:bg-brand-dark text-white"
                      size="sm"
                      onClick={() => {
                        if (!generatedReport) return;
                        const brandHex = (typeof window !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim()) || '#166534';
                        const html = [
                          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + (generatedReport.title || 'Smart Report') + '</title>',
                          '<style>body{font-family:system-ui,sans-serif;padding:1rem;max-width:800px;margin:0 auto}h1,h2{color:' + brandHex + '}</style></head><body>',
                          '<h1>' + (generatedReport.title || 'Smart Report') + '</h1>',
                          '<p>' + (generatedReport.greeting || '') + '</p>',
                          ...(generatedReport.insights || []).map((s) => {
                            const title = s.title || '';
                            const bullets = (s.items || []).map((i) => '<li>' + (typeof i === 'string' ? i : i.text || i.label || JSON.stringify(i)) + '</li>').join('');
                            return '<h2>' + title + '</h2>' + (bullets ? '<ul>' + bullets + '</ul>' : '');
                          }),
                          '</body></html>'
                        ].join('');
                        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = (generatedReport.title || 'smart-report').replace(/[^a-z0-9-_]/gi, '_') + '_' + dayjs().format('YYYY-MM-DD') + '.html';
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </ShadcnButton>
                  </div>
                </div>
                <p className="text-sm mt-4">{generatedReport.greeting}</p>
              </CardContent>
            </Card>

            {/* Performance Summary */}
            {generatedReport.insights.find(i => i.type === 'performance') && (
              <Card style={{ ...cardStyle, marginBottom: 12 }}>
                <CardContent className="p-4 md:p-6">
                {(() => {
                  const perfSection = generatedReport.insights.find(i => i.type === 'performance');
                  
                  return (
                    <>
                      <h4 className="text-base font-semibold mb-3 md:mb-4">{perfSection.title}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                        {perfSection.metrics.map((metric, idx) => {
                          const prevValue = metric.prevValue || 0;
                          const changeAmount = Math.abs(metric.value - prevValue);
                          
                          return (
                            <div key={idx} className="col-span-1">
                              <div 
                                className="p-4 md:p-5 bg-muted rounded-lg cursor-help"
                                title={`Full Amount: ₵ ${metric.value.toLocaleString()}\nPrevious Period: ₵ ${prevValue.toLocaleString()}\nChange Amount: ₵ ${changeAmount.toLocaleString()}\nChange %: ${metric.trend === 'up' ? '+' : '-'}${metric.change.toFixed(2)}%\nPeriod: ${generatedReport.period}`}
                              >
                                <p className="text-sm text-muted-foreground mb-2">{metric.label}</p>
                                <h3 className="text-2xl font-bold mb-1" style={{ color: metric.color }}>
                                  ₵ {(metric.value / 1000).toFixed(1)}K
                                </h3>
                                <p className="text-sm flex items-center gap-1" style={{ color: metric.color }}>
                                  {metric.trend === 'up' ? <TrendingUp className="h-4 w-4 shrink-0" /> : <TrendingDown className="h-4 w-4 shrink-0" />}
                                  {metric.change.toFixed(2)}% from last month
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {perfSection.note && (
                        <Alert className="mt-4">
                          <AlertDescription>{perfSection.note}</AlertDescription>
                        </Alert>
                      )}
                    </>
                  );
                })()}
                </CardContent>
              </Card>
            )}

            {/* Service/Product Analytics Section */}
            {(generatedReport.insights.find(i => i.type === 'service-analytics') || generatedReport.insights.find(i => i.type === 'product-analytics')) && (
              <Card style={{ ...cardStyle, marginBottom: 12 }}>
                <CardContent className="p-4 md:p-6">
                {(() => {
                  const section = generatedReport.insights.find(i => i.type === 'service-analytics' || i.type === 'product-analytics');
                  const isProductAnalytics = section.type === 'product-analytics';
                  
                  return (
                    <>
                      <h4 className="text-base font-semibold">{section.title}</h4>
                      <p className="text-muted-foreground text-sm mb-5">{section.description}</p>
                      
                      <div className="overflow-x-auto mb-6">
                      <ShadcnTable className="min-w-[500px]">
                        <TableHeader>
                          <TableRow>
                            {isProductAnalytics ? (
                              <>
                                <TableHead>Product Name</TableHead>
                                <TableHead className="text-right">Quantity Sold</TableHead>
                                <TableHead className="text-right">Revenue (₵)</TableHead>
                              </>
                            ) : (
                              <>
                                <TableHead>Service</TableHead>
                                <TableHead className="text-right">Units Sold</TableHead>
                                <TableHead className="text-right">Revenue (₵)</TableHead>
                                <TableHead>Demand</TableHead>
                              </>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(section.data || []).map((record, idx) => (
                            <TableRow key={idx}>
                              {isProductAnalytics ? (
                                <>
                                  <TableCell title={`SKU: ${record.sku || 'N/A'}\nUnit: ${record.unit}`} className="cursor-help">{record.productName}</TableCell>
                                  <TableCell className="text-right">{record.quantitySold?.toLocaleString()} {record.unit || ''}</TableCell>
                                  <TableCell className="text-right">{record.revenue?.toLocaleString()}</TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell title={`Revenue: ₵ ${record.revenue?.toLocaleString()}\nAvg Price: ₵ ${record.averagePrice?.toLocaleString() || 'N/A'}\nDemand: ${record.demand}`} className="cursor-help">{record.service}</TableCell>
                                  <TableCell className="text-right">{record.quantitySold}</TableCell>
                                  <TableCell className="text-right">{record.revenue?.toLocaleString()}</TableCell>
                                  <TableCell>
                                    <Badge variant={record.demand === 'High' ? 'default' : record.demand === 'Medium' ? 'secondary' : 'outline'}>{record.demand}</Badge>
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </ShadcnTable>
                      </div>
                      
                      {/* Revenue Bar Chart for Product Sales (no inventory in this section) */}
                      {isProductAnalytics && section.data && section.data.length > 0 && (
                        <div className="mt-6 mb-6">
                          <h5 className="text-sm font-semibold mb-4">Revenue by Product</h5>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={section.data.slice(0, 10)}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="productName" 
                                angle={-45} 
                                textAnchor="end" 
                                height={100}
                                interval={0}
                              />
                              <YAxis />
                              <RechartsTooltip 
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                      <div className="bg-card border border-border rounded p-3">
                                        <p className="font-bold mb-2">{data.productName}</p>
                                        <p className="my-1"><strong>Quantity Sold:</strong> {data.quantitySold} {data.unit}</p>
                                        <p className="my-1"><strong>Revenue:</strong> ₵ {data.revenue?.toLocaleString()}</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Legend />
                              <Bar dataKey="revenue" fill="var(--color-primary)" name="Revenue (₵)" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {section.recommendations && section.recommendations.length > 0 && (
                        <>
                          <Separator className="my-4" />
                          <h5 className="text-sm font-semibold mb-4">Recommendations</h5>
                          {section.recommendations.map((rec, idx) => (
                            <div key={idx} className="mb-5">
                              <p className="text-sm leading-relaxed mb-2">
                                <span className="font-semibold">{idx + 1}. </span>
                                {rec.finding}
                              </p>
                              <p className="text-sm text-muted-foreground pl-4 leading-relaxed">
                                <span className="font-semibold">Recommendation:</span> {rec.recommendation}
                              </p>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  );
                })()}
                </CardContent>
              </Card>
            )}

            {/* Materials Status Section (separate from Product Sales) */}
            {generatedReport.insights.find(i => i.type === 'inventory-status') && (
              <Card style={{ ...cardStyle, marginBottom: 12 }}>
                <CardContent className="p-4 md:p-6">
                  {(() => {
                  const section = generatedReport.insights.find(i => i.type === 'inventory-status');
                  const inventoryData = section.data || [];
                  
                  return (
                    <>
                      <h4 className="text-base font-semibold">{section.title}</h4>
                      <p className="text-muted-foreground text-sm mb-5">{section.description}</p>
                      
                      <div className="overflow-x-auto mb-6">
                      <ShadcnTable className="min-w-[400px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product Name</TableHead>
                            <TableHead className="text-right">Stock</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {inventoryData.map((record, idx) => (
                            <TableRow key={idx}>
                              <TableCell title={`SKU: ${record.sku || 'N/A'}\nUnit: ${record.unit}\nSafety: ${record.safetyStock} ${record.unit}`} className="cursor-help">{record.productName}</TableCell>
                              <TableCell className="text-right">
                                <span className={cn("cursor-help", record.isLowStock && "text-red-600", record.isHighRisk && "text-amber-600")} title={`Current: ${record.currentStock} ${record.unit}\nSafety: ${record.safetyStock} ${record.unit}\nStock %: ${record.stockPercentage}%`}>
                                  {record.currentStock} {record.unit}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant={record.isLowStock ? 'destructive' : record.isHighRisk ? 'secondary' : 'outline'}>
                                  {record.isLowStock ? 'Low Stock' : record.isHighRisk ? 'Overstocked' : 'Normal'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </ShadcnTable>
                      </div>
                      
                      {/* Inventory Bar Chart */}
                      {inventoryData.length > 0 && (
                        <div className="mt-6 mb-6">
                          <h5 className="text-sm font-semibold mb-4">Stock vs Safety Level</h5>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={inventoryData.slice(0, 10)}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="productName" 
                                angle={-45} 
                                textAnchor="end" 
                                height={100}
                                interval={0}
                              />
                              <YAxis />
                              <RechartsTooltip 
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                      <div className="bg-card border border-border rounded p-3">
                                        <p className="font-bold mb-2">{data.productName}</p>
                                        <p className="my-1"><strong>Current Stock:</strong> {data.currentStock} {data.unit}</p>
                                        <p className="my-1"><strong>Safety Level:</strong> {data.safetyStock} {data.unit}</p>
                                        <p className="my-1"><strong>Stock %:</strong> {data.stockPercentage}%</p>
                                        <p className={`my-1 flex items-center gap-1.5 ${data.isLowStock ? 'text-destructive' : data.isHighRisk ? 'text-amber-600 dark:text-amber-400' : 'text-primary'}`}>
                                          <strong>Status:</strong>
                                          {data.isLowStock ? <><AlertTriangle className="h-4 w-4 shrink-0" /> Low Stock</> : data.isHighRisk ? <><AlertTriangle className="h-4 w-4 shrink-0" /> Overstocked</> : <><Check className="h-4 w-4 shrink-0" /> Normal</>}
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Legend />
                              <Bar dataKey="currentStock" fill="var(--color-primary)" name="Current Stock" />
                              <Bar dataKey="safetyStock" fill="hsl(var(--primary) / 0.45)" name="Safety Quantity" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {section.recommendations && section.recommendations.length > 0 && (
                        <>
                          <Separator className="my-4" />
                          <h5 className="text-sm font-semibold mb-4">Recommendations</h5>
                          {section.recommendations.map((rec, idx) => (
                            <div key={idx} className="mb-5">
                              <p className="text-sm leading-relaxed mb-2">
                                <span className="font-semibold">{idx + 1}. </span>
                                {rec.finding}
                              </p>
                              <p className="text-sm text-muted-foreground pl-4 leading-relaxed">
                                <span className="font-semibold">Recommendation:</span> {rec.recommendation}
                              </p>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  );
                })()}
                </CardContent>
              </Card>
            )}

            {/* Cost Analysis Section */}
            {generatedReport.insights.find(i => i.type === 'cost-analysis') && (
              <Card style={{ ...cardStyle, marginBottom: 12 }}>
                <CardContent className="p-4 md:p-6">
                {(() => {
                  const section = generatedReport.insights.find(i => i.type === 'cost-analysis');
                  const chartData = section.data.map((item, index) => ({
                    ...item,
                    color: COLORS[index % COLORS.length]
                  }));
                  
                  const costData = [...section.data, { category: 'Total cost', amount: section.totalCost, percentage: 100, isTotal: true }];
                  
                  return (
                    <>
                      <h4 className="text-base font-semibold">{section.title}</h4>
                      <p className="text-muted-foreground text-sm mb-5">{section.description}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                        <div className="md:col-span-2 overflow-x-auto">
                          <ShadcnTable className="min-w-[400px]">
                            <TableHeader>
                              <TableRow>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Percentage</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {costData.map((record, idx) => (
                                <TableRow key={idx} className={record.isTotal ? 'bg-muted/50 font-semibold' : ''}>
                                  <TableCell title={!record.isTotal ? `Category: ${record.category}\nAmount: ₵ ${record.amount?.toLocaleString()}\nPercentage: ${record.percentage?.toFixed(1)}%` : undefined} className={!record.isTotal ? "cursor-help" : ""}>
                                    {record.isTotal ? record.category : <Badge className="border-transparent bg-brand text-white hover:bg-brand-dark">{record.category}</Badge>}
                                  </TableCell>
                                  <TableCell className={cn("text-right", !record.isTotal && "cursor-help")} title={!record.isTotal ? `Full amount: ₵ ${record.amount?.toLocaleString()}` : undefined}>₵ {record.amount?.toLocaleString()}</TableCell>
                                  <TableCell className={cn("text-right", !record.isTotal && "cursor-help")} title={!record.isTotal ? `Represents ${record.percentage?.toFixed(1)}% of total` : undefined}>{record.percentage?.toFixed(1)}%</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </ShadcnTable>
                        </div>
                        <div>
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={100}
                                dataKey="amount"
                                label={({ percentage }) => `${percentage.toFixed(1)}%`}
                              >
                                {chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <RechartsTooltip 
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    const total = section.totalCost;
                                    const percentage = total > 0 ? ((data.amount / total) * 100).toFixed(1) : 0;
                                    return (
                                      <div className="bg-card border border-border rounded p-3">
                                        <p className="font-bold mb-2">{data.category}</p>
                                        <p className="my-1"><strong>Amount:</strong> ₵ {data.amount.toLocaleString()}</p>
                                        <p className="my-1"><strong>Percentage:</strong> {percentage}%</p>
                                        <p className="my-1"><strong>Total Cost:</strong> ₵ {total.toLocaleString()}</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 18, fontWeight: 700 }}>
                                ₵ {(section.totalCost / 1000).toFixed(1)}K
                              </text>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {section.recommendations && section.recommendations.length > 0 && (
                        <>
                          <Separator className="my-4" />
                          <h5 className="text-sm font-semibold mb-4">Recommendations</h5>
                          {section.recommendations.map((rec, idx) => (
                            <div key={idx} className="mb-5">
                              <p className="text-sm leading-relaxed mb-2">
                                <span className="font-semibold">{idx + 1}. </span>
                                {rec.finding}
                              </p>
                              <p className="text-sm text-muted-foreground pl-4 leading-relaxed">
                                <span className="font-semibold">Recommendation:</span> {rec.recommendation}
                              </p>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  );
                })()}
                </CardContent>
              </Card>
            )}

            {/* Invoice Summary Section */}
            {generatedReport.insights.find(i => i.type === 'invoice-summary') && (
              <Card style={{ ...cardStyle, marginBottom: 12 }}>
                <CardContent className="p-4 md:p-6">
                {(() => {
                  const section = generatedReport.insights.find(i => i.type === 'invoice-summary');
                  
                  return (
                    <>
                      <h4 className="text-base font-semibold">{section.title}</h4>
                      <p className="text-muted-foreground text-sm mb-5">{section.description}</p>
                      
                      <div className="overflow-x-auto mb-6">
                      <ShadcnTable className="min-w-[500px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Invoice Status</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Percentage</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...section.data, { status: 'Total invoiced', amount: section.totalInvoiced, percentage: 100, isTotal: true }].map((record, idx) => (
                            <TableRow key={idx} className={record.isTotal ? 'bg-muted/50 font-semibold' : ''}>
                              <TableCell>{record.status}</TableCell>
                              <TableCell className="text-right">₵ {record.amount?.toLocaleString()}</TableCell>
                              <TableCell className="text-right">{record.percentage}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </ShadcnTable>
                      </div>

                      {section.recommendations && section.recommendations.length > 0 && (
                        <>
                          <Separator className="my-4" />
                          <h5 className="text-sm font-semibold mb-4">Recommendations</h5>
                          {section.recommendations.map((rec, idx) => (
                            <div key={idx} className="mb-5">
                              <p className="text-sm leading-relaxed mb-2">
                                <span className="font-semibold">{idx + 1}. </span>
                                {rec.finding}
                              </p>
                              <p className="text-sm text-muted-foreground pl-4 leading-relaxed">
                                <span className="font-semibold">Recommendation:</span> {rec.recommendation}
                              </p>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  );
                })()}
                </CardContent>
              </Card>
            )}

            {/* Outstanding Payments Section */}
            {generatedReport.insights.find(i => i.type === 'outstanding-payments') && (() => {
              const section = generatedReport.insights.find(i => i.type === 'outstanding-payments');
              const d = section.data || {};
              return (
                <Card key="outstanding-payments" style={{ ...cardStyle, marginBottom: 12 }}>
                  <CardContent className="p-4 md:p-6">
                    <h4 className="text-base font-semibold">{section.title}</h4>
                    <p className="text-muted-foreground text-sm mb-5">{section.description}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                      <div className="rounded-lg border p-4">
                        <p className="text-sm text-muted-foreground">Total outstanding</p>
                        <p className="text-xl font-semibold">₵ {(d.totalOutstanding ?? 0).toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-sm text-muted-foreground">Overdue invoices</p>
                        <p className="text-xl font-semibold">{d.overdueCount ?? 0}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-sm text-muted-foreground">Overdue amount</p>
                        <p className="text-xl font-semibold">₵ {(d.overdueAmount ?? 0).toLocaleString()}</p>
                      </div>
                    </div>
                    {section.recommendations?.length > 0 && (
                      <>
                        <Separator className="my-4" />
                        <h5 className="text-sm font-semibold mb-2">Recommendations</h5>
                        {section.recommendations.map((rec, idx) => (
                          <p key={idx} className="text-sm text-muted-foreground">{rec.finding} {rec.recommendation}</p>
                        ))}
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Customer Summary Section */}
            {generatedReport.insights.find(i => i.type === 'customer-summary') && (() => {
              const section = generatedReport.insights.find(i => i.type === 'customer-summary');
              const rows = section.data || [];
              return (
                <Card key="customer-summary" style={{ ...cardStyle, marginBottom: 12 }}>
                  <CardContent className="p-4 md:p-6">
                    <h4 className="text-base font-semibold">{section.title}</h4>
                    <p className="text-muted-foreground text-sm mb-5">{section.description}</p>
                    {rows.length > 0 ? (
                      <ShadcnTable className="min-w-[400px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Customer</TableHead>
                            <TableHead className="text-right">Revenue (₵)</TableHead>
                            <TableHead className="text-right">Count</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{row.name}</TableCell>
                              <TableCell className="text-right">{row.revenue?.toLocaleString()}</TableCell>
                              <TableCell className="text-right">{row.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </ShadcnTable>
                    ) : (
                      <p className="text-sm text-muted-foreground">No customer data in this period.</p>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Sales / Jobs Summary Section */}
            {generatedReport.insights.find(i => i.type === 'sales-summary') && (() => {
              const section = generatedReport.insights.find(i => i.type === 'sales-summary');
              const d = section.data || {};
              return (
                <Card key="sales-summary" style={{ ...cardStyle, marginBottom: 12 }}>
                  <CardContent className="p-4 md:p-6">
                    <h4 className="text-base font-semibold">{section.title}</h4>
                    <p className="text-muted-foreground text-sm mb-5">{section.description}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div className="rounded-lg border p-4">
                        <p className="text-sm text-muted-foreground">{isStudio ? 'Total jobs' : 'Total sales'}</p>
                        <p className="text-xl font-semibold">{d.totalJobs ?? d.totalSales ?? 0}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-sm text-muted-foreground">Total amount (₵)</p>
                        <p className="text-xl font-semibold">₵ {(d.totalSales ?? 0).toLocaleString()}</p>
                      </div>
                    </div>
                    {Array.isArray(d.byStatus) && d.byStatus.length > 0 && (
                      <ShadcnTable className="min-w-[300px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Count</TableHead>
                            <TableHead className="text-right">Total (₵)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {d.byStatus.map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{row.status}</TableCell>
                              <TableCell className="text-right">{row.count}</TableCell>
                              <TableCell className="text-right">{row.total?.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </ShadcnTable>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Materials Summary Section (studio) */}
            {generatedReport.insights.find(i => i.type === 'materials-summary') && (() => {
              const section = generatedReport.insights.find(i => i.type === 'materials-summary');
              const d = section.data || {};
              const summary = d.summary || {};
              const movements = d.movements || [];
              return (
                <Card key="materials-summary" style={{ ...cardStyle, marginBottom: 12 }}>
                  <CardContent className="p-4 md:p-6">
                    <h4 className="text-base font-semibold">{section.title}</h4>
                    <p className="text-muted-foreground text-sm mb-5">{section.description}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                      <div className="rounded-lg border p-4">
                        <p className="text-sm text-muted-foreground">Total stock items</p>
                        <p className="text-xl font-semibold">{summary.totalStocks ?? 0}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-sm text-muted-foreground">Stock value (₵)</p>
                        <p className="text-xl font-semibold">₵ {(summary.totalStockValue ?? 0).toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-sm text-muted-foreground">Availability rate</p>
                        <p className="text-xl font-semibold">{summary.stockAvailabilityRate ?? 0}%</p>
                      </div>
                    </div>
                    {movements.length > 0 && (
                      <ShadcnTable className="min-w-[400px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Movement</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {movements.slice(0, 10).map((m, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{m.itemName || m.name || m.type || '—'}</TableCell>
                              <TableCell className="text-right">{m.quantity ?? m.count ?? '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </ShadcnTable>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Pipeline Section */}
            {generatedReport.insights.find(i => i.type === 'pipeline') && (() => {
              const section = generatedReport.insights.find(i => i.type === 'pipeline');
              const d = section.data || {};
              return (
                <Card key="pipeline" style={{ ...cardStyle, marginBottom: 12 }}>
                  <CardContent className="p-4 md:p-6">
                    <h4 className="text-base font-semibold">{section.title}</h4>
                    <p className="text-muted-foreground text-sm mb-5">{section.description}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="rounded-lg border p-4">
                        <p className="text-sm text-muted-foreground">Active jobs</p>
                        <p className="text-xl font-semibold">{d.activeJobs ?? 0}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-sm text-muted-foreground">Open leads</p>
                        <p className="text-xl font-semibold">{d.openLeads ?? 0}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-sm text-muted-foreground">Pending invoices</p>
                        <p className="text-xl font-semibold">{d.pendingInvoices ?? 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Prescription Summary Section (pharmacy) */}
            {generatedReport.insights.find(i => i.type === 'prescription-summary') && (
              <Card style={{ ...cardStyle, marginBottom: 12 }}>
                <CardContent className="p-4 md:p-6">
                {(() => {
                  const section = generatedReport.insights.find(i => i.type === 'prescription-summary');
                  const data = section.data || [];
                  return (
                    <>
                      <h4 className="text-base font-semibold">{section.title}</h4>
                      <p className="text-muted-foreground text-sm mb-5">{section.description}</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
                        <Card>
                          <CardContent className="pt-4 md:pt-6 px-4 md:px-6 pb-4 md:pb-6">
                            <p className="text-sm text-muted-foreground">Total prescriptions</p>
                            <p className="text-2xl font-semibold">{section.totalPrescriptions || 0}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-6">
                            <p className="text-sm text-muted-foreground">Prescription revenue</p>
                            <p className="text-2xl font-semibold">₵ {Number(section.prescriptionRevenue || 0).toLocaleString()}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-6">
                            <p className="text-sm text-muted-foreground">Fulfillment rate</p>
                            <p className="text-2xl font-semibold">{section.fulfillmentRate || 0}%</p>
                          </CardContent>
                        </Card>
                      </div>
                      {data.length > 0 && (
                        <ShadcnTable className="mb-6 min-w-[500px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Count</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.map((record, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{record.status}</TableCell>
                                <TableCell className="text-right">{record.count}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </ShadcnTable>
                      )}
                      {section.topDrugs && section.topDrugs.length > 0 && (
                        <>
                          <h5 className="text-sm font-semibold mb-3">Top drugs by quantity filled</h5>
                          <ShadcnTable className="mb-6 min-w-[500px]">
                            <TableHeader>
                              <TableRow>
                                <TableHead>Drug</TableHead>
                                <TableHead className="text-right">Quantity filled</TableHead>
                                <TableHead className="text-right">Prescriptions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {section.topDrugs.map((record, idx) => (
                                <TableRow key={idx}>
                                  <TableCell>{record.drugName}</TableCell>
                                  <TableCell className="text-right">{record.quantityFilled}</TableCell>
                                  <TableCell className="text-right">{record.prescriptionCount}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </ShadcnTable>
                        </>
                      )}
                      {section.recommendations && section.recommendations.length > 0 && (
                        <>
                          <Separator className="my-4" />
                          <h5 className="text-sm font-semibold mb-4">Recommendations</h5>
                          {section.recommendations.map((rec, idx) => (
                            <div key={idx} className="mb-5">
                              <p className="text-sm leading-relaxed mb-2">
                                <span className="font-semibold">{idx + 1}. </span>
                                {rec.finding}
                              </p>
                              <p className="text-sm text-muted-foreground pl-4 leading-relaxed">
                                <span className="font-semibold">Recommendation:</span> {rec.recommendation}
                              </p>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  );
                })()}
                </CardContent>
              </Card>
            )}

            {/* Footer */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-0 py-4 md:py-5 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Powered by <span className="font-semibold text-primary">African Business Suite</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Copyright © {dayjs().year()} Nexus Creative Studio. Confidential and proprietary information.
              </p>
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
      {/* Create Report Modal - shadcn Dialog + Form */}
      <Dialog open={createReportModalVisible} onOpenChange={setCreateReportModalVisible}>
        <DialogContent className="sm:max-w-[600px] p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="text-lg font-semibold">Create report</DialogTitle>
          </DialogHeader>
          <Form {...reportConfigForm}>
            <form onSubmit={reportConfigForm.handleSubmit(handleCreateReport)} className="flex flex-col max-h-[85vh]">
              <div className="px-6 space-y-5 overflow-y-auto max-h-[60vh] min-h-0">
              <FormField
                control={reportConfigForm.control}
                name="reportTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Report title</FormLabel>
                    <FormControl>
                      <ShadcnInput placeholder="Add title" className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={reportConfigForm.control}
                name="durationType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration type</FormLabel>
                    <ShadcnSelect value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select duration type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </ShadcnSelect>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={reportConfigForm.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year</FormLabel>
                      <ShadcnSelect
                        value={field.value != null ? String(field.value) : undefined}
                        onValueChange={(v) => field.onChange(v ? parseInt(v, 10) : undefined)}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {years.map((y) => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </ShadcnSelect>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={reportConfigForm.control}
                  name="month"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Month</FormLabel>
                      <ShadcnSelect value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select month" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {months.map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </ShadcnSelect>
                      {reportConfigForm.watch('durationType') === 'monthly' && (
                        <p className="text-xs text-muted-foreground mt-1.5">
                          End of month reports can only be generated on the last day of the month or after.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="space-y-4 pt-1">
                <Label className="text-sm font-medium">Report type</Label>
                <div className="space-y-4">
                  {reportTypeOptionsGrouped.map((group) => (
                    <div key={group.groupLabel}>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        {group.groupLabel}
                      </p>
                      <div className="space-y-2">
                        {group.options.map((type) => (
                          <div
                            key={type.value}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              if (selectedReportTypes.includes(type.value)) {
                                setSelectedReportTypes(selectedReportTypes.filter((t) => t !== type.value));
                              } else {
                                setSelectedReportTypes([...selectedReportTypes, type.value]);
                              }
                            }}
                            onKeyDown={(e) =>
                              e.key === 'Enter' &&
                              (document.activeElement === e.currentTarget
                                ? selectedReportTypes.includes(type.value)
                                  ? setSelectedReportTypes(selectedReportTypes.filter((t) => t !== type.value))
                                  : setSelectedReportTypes([...selectedReportTypes, type.value])
                                : null)
                            }
                            className={cn(
                              'flex items-center justify-between rounded-lg border p-4 cursor-pointer transition-colors',
                              selectedReportTypes.includes(type.value) ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'
                            )}
                          >
                            <div>
                              <p className="font-medium text-sm">{type.label}</p>
                              <p className="text-xs text-muted-foreground">{type.description}</p>
                            </div>
                            <div
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2"
                              style={{
                                borderColor: selectedReportTypes.includes(type.value) ? 'var(--color-primary)' : '#d9d9d9',
                                background: selectedReportTypes.includes(type.value) ? 'var(--color-primary)' : undefined,
                              }}
                            >
                              {selectedReportTypes.includes(type.value) && (
                                <CheckCircle className="h-3 w-3 text-white" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              </div>
              <DialogFooter className="gap-2 pt-4 pb-6 px-6 flex-shrink-0 border-t border-border mt-0">
                <ShadcnButton type="button" variant="outline" size="lg" onClick={() => setCreateReportModalVisible(false)}>
                  Cancel
                </ShadcnButton>
                <ShadcnButton type="submit" size="lg" disabled={aiLoading} className="bg-brand hover:bg-brand-dark">
                  {aiLoading ? 'Creating...' : 'Create'}
                </ShadcnButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

    <div className="bg-background min-h-screen px-0 py-2 md:px-6 md:py-4">
      <div className="flex flex-wrap items-center justify-between gap-3 md:gap-4 mb-3 md:mb-6 bg-card p-2 md:p-5 rounded-lg border border-border">
        <h2 className="text-2xl font-semibold">Reports & Analytics</h2>
        {showSmartReportList && (
          <div className="flex items-center gap-3">
            {/* Date Filter */}
            <Tooltip>
              <TooltipTrigger asChild>
                <ShadcnButton
                  variant="outline"
                  className="border-border bg-card"
                  onClick={() => {
                    // Date filter handler
                  }}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Last 6 months
                </ShadcnButton>
              </TooltipTrigger>
              <TooltipContent>Change date range for reports</TooltipContent>
            </Tooltip>

            {/* Filter/Sort Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <ShadcnButton
                  variant="outline"
                  className="border-border bg-card"
                  onClick={() => {
                    // Filter/sort handler
                  }}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </ShadcnButton>
              </TooltipTrigger>
              <TooltipContent>Filter or sort reports</TooltipContent>
            </Tooltip>

            {/* All Badge with Count */}
            <div className="flex items-center gap-2 border border-border rounded-md px-3 py-2 bg-card">
              <span className="text-sm text-foreground">All</span>
              <Badge variant="secondary" className="bg-muted text-foreground">
                {savedReports.length}
              </Badge>
            </div>

            {/* Create Report Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <ShadcnButton
                  onClick={handleOpenCreateReportModal}
                  className="bg-brand hover:bg-brand-dark text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create report
                </ShadcnButton>
              </TooltipTrigger>
              <TooltipContent>Create a new report</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {isMobile && showSmartReportList ? (
        <div className="mt-0">
          {renderGeneratedReports()}
        </div>
      ) : (
        <Card className="rounded-lg border border-border">
          <CardContent className="p-0">
          {isCompliance ? (
            <div className="p-4 md:p-6">
              {renderComplianceView()}
            </div>
          ) : isSmartReport && generatedReport ? (
            <div className="p-4 md:p-6">
              {renderAIReportGenerator()}
            </div>
          ) : showSmartReportList ? (
            <div className="p-0 md:p-6">
              {renderGeneratedReports()}
            </div>
          ) : (
            <div className="p-4 md:p-6">
              {loading ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Card key={i}>
                        <CardContent className="pt-4 md:pt-6 px-4 md:px-6 pb-4 md:pb-6">
                          <Skeleton className="h-4 w-24 mb-2" />
                          <Skeleton className="h-8 w-32" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Card>
                    <CardContent className="pt-4 md:pt-6 px-4 md:px-6 pb-4 md:pb-6">
                      <TableSkeleton rows={8} cols={5} />
                    </CardContent>
                  </Card>
                </div>
              ) : (
                renderOverviewDashboard()
              )}
            </div>
          )}
          </CardContent>
        </Card>
      )}
    </div>
    </>
  );
}

function Reports() {
  return (
    <RechartsModuleProvider>
      <ReportsInner />
    </RechartsModuleProvider>
  );
}

export default Reports;

