import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Plus,
  Calendar,
  BarChart3,
  Clock,
  Filter,
  RefreshCw,
  Percent,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty } from '@/components/ui/empty';
import DateFilterButtons from '../components/DateFilterButtons';
import TableSkeleton from '../components/TableSkeleton';
import DashboardTable from '../components/DashboardTable';
import ViewToggle from '../components/ViewToggle';
import { showSuccess, showError } from '../utils/toast';
import footTrafficService from '../services/footTrafficService';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import dayjs from 'dayjs';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

import { CHIP_BLUE, CHIP_PURPLE, CHIP_ORANGE, CHIP_GREEN } from '../constants';

const COLORS = ['#166534', '#22c55e', '#86efac', '#dcfce7', '#f0fdf4'];
const ENTRY_METHODS = {
  manual: { label: 'Manual Entry', color: CHIP_BLUE },
  iot_counter: { label: 'IoT Counter', color: CHIP_PURPLE },
  camera: { label: 'Camera', color: CHIP_ORANGE },
  mobile_checkin: { label: 'Mobile Check-in', color: CHIP_GREEN }
};

/**
 * FootTraffic Page
 * Displays customer traffic analytics and allows manual traffic entry
 */
const FootTraffic = () => {
  const { activeTenant } = useAuth();
  const businessType = activeTenant?.businessType || 'shop';

  // Only show for shop/pharmacy business types
  const isShopOrPharmacy = businessType === 'shop' || businessType === 'pharmacy';

  // State
  const [dateRange, setDateRange] = useState(null);
  const [activeFilter, setActiveFilter] = useState('month');
  const [groupBy, setGroupBy] = useState('day');
  const [tableViewMode, setTableViewMode] = useState('table');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    visitorCount: '',
    periodStart: dayjs().startOf('day').format('YYYY-MM-DDTHH:mm'),
    periodEnd: dayjs().endOf('day').format('YYYY-MM-DDTHH:mm'),
    periodType: 'daily',
    entryMethod: 'manual',
    weather: '',
    notes: ''
  });

  // Calculate date range based on active filter
  const { startDate, endDate } = useMemo(() => {
    if (dateRange && dateRange[0] && dateRange[1]) {
      return {
        startDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD')
      };
    }
    
    const now = dayjs();
    switch (activeFilter) {
      case 'today':
        return { startDate: now.format('YYYY-MM-DD'), endDate: now.format('YYYY-MM-DD') };
      case 'week':
        return { startDate: now.subtract(7, 'day').format('YYYY-MM-DD'), endDate: now.format('YYYY-MM-DD') };
      case 'month':
        return { startDate: now.subtract(30, 'day').format('YYYY-MM-DD'), endDate: now.format('YYYY-MM-DD') };
      case 'quarter':
        return { startDate: now.subtract(90, 'day').format('YYYY-MM-DD'), endDate: now.format('YYYY-MM-DD') };
      case 'year':
        return { startDate: now.subtract(365, 'day').format('YYYY-MM-DD'), endDate: now.format('YYYY-MM-DD') };
      default:
        return { startDate: now.subtract(30, 'day').format('YYYY-MM-DD'), endDate: now.format('YYYY-MM-DD') };
    }
  }, [dateRange, activeFilter]);

  // Fetch today's summary
  const { data: todaySummary, isLoading: todayLoading, refetch: refetchToday } = useQuery({
    queryKey: ['footTraffic', 'today'],
    queryFn: () => footTrafficService.getTodaySummary(),
    select: (res) => res.data,
    enabled: isShopOrPharmacy
  });

  // Fetch analytics
  const { data: analytics, isLoading: analyticsLoading, refetch: refetchAnalytics } = useQuery({
    queryKey: ['footTraffic', 'analytics', startDate, endDate, groupBy],
    queryFn: () => footTrafficService.getAnalytics({ startDate, endDate, groupBy }),
    select: (res) => res.data,
    enabled: isShopOrPharmacy
  });

  // Fetch traffic records
  const { data: trafficData, isLoading: trafficLoading, refetch: refetchTraffic } = useQuery({
    queryKey: ['footTraffic', 'list', startDate, endDate],
    queryFn: () => footTrafficService.getFootTraffic({ startDate, endDate, limit: 50 }),
    select: (res) => res.data,
    enabled: isShopOrPharmacy
  });

  // Handle filter change
  const handleFilterChange = useCallback((filter, dates) => {
    setActiveFilter(filter);
    setDateRange(dates);
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetchToday();
    refetchAnalytics();
    refetchTraffic();
  }, [refetchToday, refetchAnalytics, refetchTraffic]);

  // Handle form change
  const handleFormChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Handle create traffic record
  const handleCreateRecord = useCallback(async () => {
    if (!formData.visitorCount || parseInt(formData.visitorCount) < 0) {
      showError(null, 'Please enter a valid visitor count');
      return;
    }

    setIsSubmitting(true);
    try {
      await footTrafficService.createFootTraffic({
        visitorCount: parseInt(formData.visitorCount),
        periodStart: formData.periodStart,
        periodEnd: formData.periodEnd,
        periodType: formData.periodType,
        entryMethod: formData.entryMethod,
        weather: formData.weather || null,
        notes: formData.notes || null
      });
      showSuccess('Traffic record created successfully');
      setIsAddDialogOpen(false);
      setFormData({
        visitorCount: '',
        periodStart: dayjs().startOf('day').format('YYYY-MM-DDTHH:mm'),
        periodEnd: dayjs().endOf('day').format('YYYY-MM-DDTHH:mm'),
        periodType: 'daily',
        entryMethod: 'manual',
        weather: '',
        notes: ''
      });
      handleRefresh();
    } catch (error) {
      showError(error, 'Failed to create traffic record');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, handleRefresh]);

  // Handle quick check-in
  const handleQuickCheckIn = useCallback(async () => {
    try {
      const response = await footTrafficService.recordCheckIn();
      showSuccess(`Check-in recorded. Today's count: ${response.data.todayCount}`);
      handleRefresh();
    } catch (error) {
      showError(error, 'Failed to record check-in');
    }
  }, [handleRefresh]);

  // Format currency
  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  }, []);

  // Table columns for Recent Traffic Records (DashboardTable shows cards on mobile)
  const trafficTableColumns = useMemo(() => [
    { key: 'periodStart', label: 'Date', render: (_, record) => dayjs(record.periodStart).format('MMM D, YYYY') },
    { key: 'periodType', label: 'Period', render: (_, record) => <Badge variant="outline">{record.periodType}</Badge> },
    { key: 'visitorCount', label: 'Visitors', render: (val) => <span className="font-medium">{Number(val).toLocaleString()}</span> },
    { key: 'purchaseCount', label: 'Purchases', render: (val) => val },
    {
      key: 'conversion',
      label: 'Conversion',
      render: (_, record) => record.visitorCount > 0
        ? `${((record.purchaseCount / record.visitorCount) * 100).toFixed(1)}%`
        : '0%'
    },
    {
      key: 'entryMethod',
      label: 'Method',
      render: (_, record) => (
        <Badge className={ENTRY_METHODS[record.entryMethod]?.color || 'bg-muted text-muted-foreground'}>
          {ENTRY_METHODS[record.entryMethod]?.label || record.entryMethod}
        </Badge>
      )
    }
  ], []);

  // If not shop/pharmacy, show message
  if (!isShopOrPharmacy) {
    return (
      <div className="p-6">
        <Empty
          icon={<Users className="h-12 w-12 text-gray-400" />}
          title="Not Available"
          description="Customer traffic tracking is only available for Shop and Pharmacy business types."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Traffic</h1>
          <p className="text-gray-500 mt-1">Track and analyze customer visits to your shop</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleQuickCheckIn}>
            <Plus className="h-4 w-4 mr-2" />
            Quick Check-in
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Traffic Record
          </Button>
        </div>
      </div>

      {/* Today's Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Visitors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {todayLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{todaySummary?.visitors || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {todayLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{todaySummary?.purchases || 0}</div>
                <p className="text-xs text-muted-foreground">Completed transactions</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {todayLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{todaySummary?.conversionRate || 0}%</div>
                <p className="text-xs text-muted-foreground">Visitors who purchased</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. per Visitor</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {todayLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {todaySummary?.visitors > 0 
                    ? formatCurrency(todaySummary?.revenue / todaySummary?.visitors)
                    : formatCurrency(0)}
                </div>
                <p className="text-xs text-muted-foreground">Revenue per visitor</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Date Filter and Group By */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <DateFilterButtons
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
        />
        <div className="flex items-center gap-2">
          <ViewToggle value={tableViewMode} onChange={setTableViewMode} />
          <span className="text-sm text-gray-500">Group by:</span>
          <Select value={groupBy} onValueChange={setGroupBy}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hour">Hour</SelectItem>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Analytics Summary */}
      {analyticsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : analytics?.summary ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-500">Total Visitors</p>
              <p className="text-2xl font-bold">{analytics.summary.totalVisitors.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-500">Total Sales</p>
              <p className="text-2xl font-bold">{analytics.summary.actualSales.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-500">Conversion Rate</p>
              <p className="text-2xl font-bold">{analytics.summary.conversionRate}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-500">Avg. Visitors/Day</p>
              <p className="text-2xl font-bold">{analytics.summary.avgVisitorsPerDay.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Traffic Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Traffic Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : analytics?.trafficByPeriod?.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.trafficByPeriod}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="period" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      if (groupBy === 'day') return dayjs(value).format('MMM D');
                      if (groupBy === 'hour') return value.split(' ')[1] || value;
                      return value;
                    }}
                  />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="visitors" 
                    stroke="#166534" 
                    strokeWidth={2}
                    name="Visitors"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="purchases" 
                    stroke="#22c55e" 
                    strokeWidth={2}
                    name="Purchases"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Empty
                icon={<BarChart3 className="h-12 w-12 text-gray-400" />}
                title="No Data"
                description="No traffic data available for the selected period."
              />
            )}
          </CardContent>
        </Card>

        {/* Peak Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Peak Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : analytics?.peakHours?.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.peakHours}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="hour" 
                    tickFormatter={(h) => `${h}:00`}
                  />
                  <YAxis />
                  <RechartsTooltip 
                    formatter={(value) => [Math.round(value), 'Avg Visitors']}
                    labelFormatter={(h) => `${h}:00 - ${h}:59`}
                  />
                  <Bar dataKey="avgVisitors" fill="#166534" name="Avg Visitors" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty
                icon={<Clock className="h-12 w-12 text-gray-400" />}
                title="No Peak Hour Data"
                description="Record hourly traffic to see peak hours analysis."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Traffic Records - table on desktop, cards on mobile */}
      {trafficData?.length === 0 && !trafficLoading ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Recent Traffic Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Empty
              description="Start tracking customer traffic by adding records or using quick check-in."
              image={<Users className="h-12 w-12 text-gray-400" />}
            />
            <div className="flex justify-center mt-4">
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Record
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <DashboardTable
          data={trafficData || []}
          columns={trafficTableColumns}
          loading={trafficLoading}
          title="Recent Traffic Records"
          emptyIcon={<Users className="h-12 w-12 text-gray-400" />}
          emptyDescription="No foot traffic recorded yet. Start tracking customer visits to analyze patterns."
          emptyAction={
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Record First Visit
            </Button>
          }
          pageSize={10}
          viewMode={tableViewMode}
          onViewModeChange={setTableViewMode}
        />
      )}

      {/* Add Traffic Record Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:w-[min(92vw,620px)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)]">
          <DialogHeader>
            <DialogTitle>Add Traffic Record</DialogTitle>
            <DialogDescription>
              Manually record customer traffic for a specific time period.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="visitorCount">Visitor Count *</Label>
                <Input
                  id="visitorCount"
                  type="number"
                  min="0"
                  placeholder="e.g., 50"
                  value={formData.visitorCount}
                  onChange={(e) => handleFormChange('visitorCount', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodType">Period Type</Label>
                <Select 
                  value={formData.periodType} 
                  onValueChange={(v) => handleFormChange('periodType', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="periodStart">Period Start *</Label>
                <Input
                  id="periodStart"
                  type="datetime-local"
                  value={formData.periodStart}
                  onChange={(e) => handleFormChange('periodStart', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodEnd">Period End *</Label>
                <Input
                  id="periodEnd"
                  type="datetime-local"
                  value={formData.periodEnd}
                  onChange={(e) => handleFormChange('periodEnd', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="entryMethod">Entry Method</Label>
                <Select 
                  value={formData.entryMethod} 
                  onValueChange={(v) => handleFormChange('entryMethod', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Entry</SelectItem>
                    <SelectItem value="iot_counter">IoT Counter</SelectItem>
                    <SelectItem value="camera">Camera</SelectItem>
                    <SelectItem value="mobile_checkin">Mobile Check-in</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="weather">Weather (optional)</Label>
                <Input
                  id="weather"
                  placeholder="e.g., Sunny, Rainy"
                  value={formData.weather}
                  onChange={(e) => handleFormChange('weather', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes about this traffic period..."
                value={formData.notes}
                onChange={(e) => handleFormChange('notes', e.target.value)}
              />
            </div>
          </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRecord} loading={isSubmitting}>
              Create Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FootTraffic;
