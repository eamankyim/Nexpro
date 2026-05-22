import {
  Briefcase,
  RefreshCw,
  ShoppingCart,
  Tag,
  UserPlus,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp } from 'lucide-react';
import { OVERVIEW_CARD_BORDER, formatOverviewCurrency, formatPercentChange } from '../overview/overviewUtils';
import DonutBreakdownCard from './DonutBreakdownCard';
import SmartReportKpiRow from './SmartReportKpiRow';
import SmartReportSectionHeader from './SmartReportSectionHeader';

/**
 * Sales & Customers tab — matches mockup.
 */
export default function SmartReportSalesTab({ snapshot, periodLabel, isStudio }) {
  const {
    kpis,
    salesByDate,
    salesByCategory,
    topCustomers,
    customerSegments,
    customerInsights,
    comparisonLabel,
  } = snapshot;
  const revenue = kpis.revenue.value;
  const ordersLabel = isStudio ? 'Total Orders / Jobs' : 'Total Orders';

  const kpiItems = [
    { label: 'Total Sales', value: kpis.totalSales.value, change: kpis.totalSales.change, sparklineData: kpis.totalSales.sparkline, icon: ShoppingCart, iconBgColor: '#dcfce7', iconColor: '#166534', comparisonLabel },
    { label: ordersLabel, value: kpis.orderCount.value, change: kpis.orderCount.change, sparklineData: kpis.orderCount.sparkline, icon: Briefcase, iconBgColor: '#dbeafe', iconColor: '#1d4ed8', comparisonLabel },
    { label: 'Average Order Value', value: kpis.avgOrderValue.value, change: kpis.avgOrderValue.change, sparklineData: kpis.avgOrderValue.sparkline, icon: Tag, iconBgColor: '#f3e8ff', iconColor: '#7c3aed', comparisonLabel },
    { label: 'New Customers', value: kpis.newCustomers.value, change: kpis.newCustomers.change, sparklineData: kpis.newCustomers.sparkline, icon: UserPlus, iconBgColor: '#ffedd5', iconColor: '#c2410c', comparisonLabel },
    { label: 'Returning Customers', value: kpis.returningCustomers.value, change: kpis.returningCustomers.change, sparklineData: kpis.returningCustomers.sparkline, icon: RefreshCw, iconBgColor: '#ccfbf1', iconColor: '#0f766e', comparisonLabel },
  ];

  const categoryDonut = salesByCategory.map((c) => ({ name: c.name, value: c.value, color: c.color }));

  return (
    <div className="space-y-6">
      <SmartReportSectionHeader
        title="Sales & Customers Overview"
        description="Track your sales performance and customer behavior."
        periodLabel={periodLabel}
      />
      <SmartReportKpiRow items={kpiItems} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card style={OVERVIEW_CARD_BORDER} className="bg-card xl:col-span-1">
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">Sales Trend</CardTitle>
            <Button variant="link" className="h-auto p-0 text-xs text-primary">View Detailed Sales Analysis</Button>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {salesByDate.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={salesByDate} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v, name) => [name === 'orders' ? v : formatOverviewCurrency(v), name === 'orders' ? 'Orders' : 'Sales']} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="left" type="monotone" dataKey="sales" name="Sales (₵)" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="orders" name="Orders" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground">No sales trend data</div>
            )}
          </CardContent>
        </Card>

        <Card style={OVERVIEW_CARD_BORDER} className="bg-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base font-semibold">Top Customers by Revenue</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {topCustomers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCustomers.slice(0, 5).map((c, idx) => (
                    <TableRow key={c.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">{c.initials}</span>
                          <span className="font-medium truncate">{c.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatOverviewCurrency(c.revenue)}</TableCell>
                      <TableCell className="text-right text-primary">{c.percent.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">No customer data</div>
            )}
            <Button variant="link" className="h-auto p-0 text-xs text-primary mt-2">View All Customers</Button>
          </CardContent>
        </Card>

        <DonutBreakdownCard
          title="Sales by Category / Service"
          slices={categoryDonut}
          total={revenue}
          centerLabel="Total Sales"
          viewLabel="View Category Analysis"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card style={OVERVIEW_CARD_BORDER} className="bg-card">
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">Customer Segmentation</CardTitle>
            <Button variant="link" className="h-auto p-0 text-xs text-primary">View Full Segmentation</Button>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Segment</TableHead>
                  <TableHead className="text-right">Customers</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerSegments.map((s) => (
                  <TableRow key={s.segment}>
                    <TableCell className="text-sm">{s.segment}</TableCell>
                    <TableCell className="text-right">{s.customers}</TableCell>
                    <TableCell className="text-right">{formatOverviewCurrency(s.revenue)}</TableCell>
                      <TableCell className="text-right text-green-700">
                        <span className="inline-flex items-center justify-end gap-1">
                          <TrendingUp className="h-3.5 w-3.5" />
                          {formatPercentChange(s.trend)}
                        </span>
                      </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card style={OVERVIEW_CARD_BORDER} className="bg-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base font-semibold">Customer Acquisition</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 text-sm text-muted-foreground">
            <p>New customers: <span className="font-medium text-foreground">{kpis.newCustomers.value}</span></p>
            <p className="mt-2">Returning customers: <span className="font-medium text-foreground">{kpis.returningCustomers.value}</span></p>
            <Button variant="link" className="h-auto p-0 text-xs text-primary mt-4">View Acquisition Report</Button>
          </CardContent>
        </Card>

        <Card style={OVERVIEW_CARD_BORDER} className="bg-card">
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">Customer Insights</CardTitle>
            <Button variant="link" className="h-auto p-0 text-xs text-primary">View All Insights</Button>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ul className="space-y-3 text-sm text-muted-foreground">
              {customerInsights.map((item, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="text-primary shrink-0">•</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
