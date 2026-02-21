import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
} from 'recharts';
import dayjs from 'dayjs';
import { Loader2 } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';
import adminService from '../../services/adminService';
import { usePlatformAdminPermissions } from '../../context/PlatformAdminPermissionsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const defaultRange = [
  dayjs().subtract(29, 'day').startOf('day'),
  dayjs().endOf('day'),
];

const AdminReports = () => {
  const { isMobile } = useResponsive();
  const { hasPermission, loading: permissionsLoading } = usePlatformAdminPermissions();
  const [loading, setLoading] = useState(true);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [kpis, setKpis] = useState(null);
  const [revenueSeries, setRevenueSeries] = useState([]);
  const [expenseSeries, setExpenseSeries] = useState([]);
  const [pipeline, setPipeline] = useState(null);
  const [topCustomers, setTopCustomers] = useState([]);
  const [range, setRange] = useState(defaultRange);

  const rangeForPicker = useMemo(() => {
    if (!range || !range[0] || !range[1]) return undefined;
    return { from: range[0].toDate(), to: range[1].toDate() };
  }, [range]);

  const handleRangeSelect = (newRange) => {
    if (!newRange?.from) return;
    const from = dayjs(newRange.from);
    const to = newRange.to ? dayjs(newRange.to) : from;
    setRange([from, to]);
  };

  const dateParams = useMemo(() => {
    if (!range || range.length !== 2) return {};
    return {
      startDate: range[0].startOf('day').toISOString(),
      endDate: range[1].endOf('day').toISOString(),
    };
  }, [range]);

  const loadKpis = async () => {
    const response = await adminService.getReportKpis(dateParams);
    if (response?.success) {
      setKpis(response.data);
    }
  };

  const loadPipeline = async () => {
    const response = await adminService.getReportPipeline();
    if (response?.success) {
      setPipeline(response.data);
    }
  };

  const loadTopCustomers = async () => {
    const response = await adminService.getReportTopCustomers({
      ...dateParams,
      limit: 5,
    });
    if (response?.success) {
      setTopCustomers(response.data || []);
    }
  };

  const loadRevenueSeries = async () => {
    setRevenueLoading(true);
    try {
      const response = await adminService.getReportRevenue({
        ...dateParams,
        groupBy: 'day',
      });
      if (response?.success) {
        const data = (response.data?.byPeriod || []).map((item) => ({
          date: item.date,
          revenue: Number(item.totalRevenue || 0),
        }));
        setRevenueSeries(data);
      }
    } finally {
      setRevenueLoading(false);
    }
  };

  const loadExpenseSeries = async () => {
    setExpenseLoading(true);
    try {
      const response = await adminService.getReportExpenses({
        ...dateParams,
      });
      if (response?.success) {
        const data = (response.data?.byDate || []).map((item) => ({
          date: item.date,
          expenses: Number(item.totalAmount || 0),
        }));
        setExpenseSeries(data);
      }
    } finally {
      setExpenseLoading(false);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadKpis(),
        loadRevenueSeries(),
        loadExpenseSeries(),
        loadPipeline(),
        loadTopCustomers(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading) {
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateParams.startDate, dateParams.endDate]);

  // Check permission after all hooks
  if (!permissionsLoading && !hasPermission('reports.view')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">Access Denied</h3>
          <p className="text-muted-foreground">You don&apos;t have permission to view reports.</p>
        </div>
      </div>
    );
  }

  if (loading || permissionsLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Reports</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Platform operations: subscription revenue, tenant growth, and pipeline health.
          </p>
        </div>
        <DateRangePicker range={rangeForPicker} onSelect={handleRangeSelect} className="w-auto min-w-[220px]" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Subscription revenue (MRR)</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              ₵ {(kpis?.totalRevenue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Paying tenants</p>
            <p className="text-2xl font-bold text-foreground mt-1">{kpis?.payingTenants ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Trialing tenants</p>
            <p className="text-2xl font-bold text-foreground mt-1">{kpis?.trialingTenants ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">New tenants (period)</p>
            <p className="text-2xl font-bold text-foreground mt-1">{kpis?.newTenants ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>New signups trend</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <div className="flex justify-center h-[280px] items-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={revenueSeries}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2f80ed" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#2f80ed" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(value) => dayjs(value).format('MMM D')} />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    formatter={(value) => `${Number(value).toLocaleString()} signups`}
                    labelFormatter={(value) => dayjs(value).format('MMMM D, YYYY')}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#2f80ed"
                    fill="url(#colorRevenue)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Platform expenses</CardTitle>
          </CardHeader>
          <CardContent>
            {expenseLoading ? (
              <div className="flex justify-center h-[280px] items-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : expenseSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={expenseSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(value) => dayjs(value).format('MMM D')} />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    formatter={(value) => `₵ ${Number(value).toLocaleString()}`}
                    labelFormatter={(value) => dayjs(value).format('MMMM D, YYYY')}
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke="#eb5757"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8">No platform expenses tracked yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            {pipeline ? (
              <BarChart width={360} height={260} data={[
                { name: 'Paying tenants', value: pipeline.activeJobs },
                { name: 'Trialing tenants', value: pipeline.openLeads },
                { name: 'New this month', value: pipeline.pendingInvoices },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#9b51e0" radius={[6, 6, 0, 0]} />
              </BarChart>
            ) : (
              <p className="text-sm text-muted-foreground">No pipeline data available.</p>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top paying tenants</CardTitle>
          </CardHeader>
          <CardContent>
            {isMobile ? (
              <div className="flex flex-col gap-3">
                {topCustomers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No paying tenants</p>
                ) : (
                  topCustomers.map((record) => (
                    <div
                      key={record.tenant?.id || record.tenantId}
                      className="rounded-lg border border-border p-4"
                    >
                      <p className="font-semibold text-foreground">{record.tenant?.name || '—'}</p>
                      <p className="text-xs text-muted-foreground">{record.tenant?.company || record.tenant?.plan || '—'}</p>
                      <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                        <span className="font-medium text-foreground">₵ {Number(record.totalRevenue || 0).toLocaleString()}/mo</span>
                        <span className="text-xs text-muted-foreground">{record.tenant?.plan || '—'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Plan value (₵/mo)</TableHead>
                    <TableHead>Plan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCustomers.map((record) => (
                    <TableRow key={record.tenant?.id || record.tenantId}>
                      <TableCell>
                        <div>
                          <p className="font-semibold text-foreground">{record.tenant?.name || '—'}</p>
                          <p className="text-xs text-muted-foreground">{record.tenant?.company || record.tenant?.plan || '—'}</p>
                        </div>
                      </TableCell>
                      <TableCell>₵ {Number(record.totalRevenue || 0).toLocaleString()}</TableCell>
                      <TableCell>{record.tenant?.plan || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detailed reports</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signups">
            <TabsList>
              <TabsTrigger value="signups">Signups by date</TabsTrigger>
              <TabsTrigger value="expenses">Platform expenses</TabsTrigger>
            </TabsList>
            <TabsContent value="signups" className="mt-4">
              {isMobile ? (
                <div className="flex flex-col gap-2">
                  {revenueSeries.filter((item) => item.revenue > 0).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No signups in selected period.</p>
                  ) : (
                    revenueSeries.filter((item) => item.revenue > 0).map((item) => (
                      <div key={item.date} className="rounded-lg border border-border p-3 flex justify-between items-center">
                        <span className="text-sm text-foreground">{dayjs(item.date).format('MMM D, YYYY')}</span>
                        <span className="font-semibold text-foreground">{Number(item.revenue || 0)} signups</span>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Signups</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenueSeries.filter((item) => item.revenue > 0).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          No signups in selected period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      revenueSeries.filter((item) => item.revenue > 0).map((item) => (
                        <TableRow key={item.date}>
                          <TableCell>{dayjs(item.date).format('MMM D, YYYY')}</TableCell>
                          <TableCell>{Number(item.revenue || 0)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
            <TabsContent value="expenses" className="mt-4">
              {isMobile ? (
                <div className="flex flex-col gap-2">
                  {expenseSeries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No platform expenses tracked yet.</p>
                  ) : (
                    expenseSeries.map((item) => (
                      <div key={item.date} className="rounded-lg border border-border p-3 flex justify-between items-center">
                        <span className="text-sm text-foreground">{dayjs(item.date).format('MMM D, YYYY')}</span>
                        <span className="font-semibold text-foreground">₵ {Number(item.expenses || 0).toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Expenses</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseSeries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          No platform expenses tracked yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      expenseSeries.map((item) => (
                        <TableRow key={item.date}>
                          <TableCell>{dayjs(item.date).format('MMM D, YYYY')}</TableCell>
                          <TableCell>₵ {Number(item.expenses || 0).toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminReports;
