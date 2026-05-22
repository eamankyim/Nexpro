import {
  AlertTriangle,
  BarChart3,
  Package,
  PackageX,
  RefreshCw,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OVERVIEW_CARD_BORDER, formatOverviewCurrency, formatPercentChange } from '../overview/overviewUtils';
import DonutBreakdownCard from './DonutBreakdownCard';
import SmartReportKpiRow from './SmartReportKpiRow';
import SmartReportSectionHeader from './SmartReportSectionHeader';
import { formatInteger } from '../../../utils/formatNumber';

/**
 * Inventory tab — matches mockup.
 */
export default function SmartReportInventoryTab({ snapshot, periodLabel }) {
  const detail = snapshot.inventoryDetail || {
    kpis: {
      totalValue: { value: 0, change: 0, sparkline: [] },
      totalItems: { value: 0, change: 0, sparkline: [] },
      lowStock: { value: 0, change: 0, sparkline: [] },
      outOfStock: { value: 0, change: 0, sparkline: [] },
      turnover: { value: 0, change: 0, sparkline: [], valueFormatter: (v) => `${Number(v).toFixed(1)}x` },
    },
    valueTrend: [],
    categoryDonut: { slices: [], total: 0 },
    healthDonut: { slices: [], total: 0 },
    lowStockItems: [],
    outOfStockItems: [],
    movementSummary: [],
  };

  const {
    kpis,
    valueTrend,
    categoryDonut,
    healthDonut,
    lowStockItems,
    outOfStockItems,
    movementSummary,
  } = detail;
  const comparisonLabel = snapshot.comparisonLabel;

  const kpiItems = [
    { label: 'Total Inventory Value', value: kpis.totalValue?.value, change: kpis.totalValue?.change, sparklineData: kpis.totalValue?.sparkline, icon: Package, iconBgColor: '#dcfce7', iconColor: '#166534', comparisonLabel },
    { label: 'Total Items', value: kpis.totalItems?.value, change: kpis.totalItems?.change, sparklineData: kpis.totalItems?.sparkline, valueFormatter: (v) => formatInteger(v), icon: BarChart3, iconBgColor: '#dbeafe', iconColor: '#1d4ed8', comparisonLabel },
    { label: 'Low Stock Items', value: kpis.lowStock?.value, change: kpis.lowStock?.change, sparklineData: kpis.lowStock?.sparkline, invertTrend: true, valueFormatter: (v) => formatInteger(v), icon: AlertTriangle, iconBgColor: '#ffedd5', iconColor: '#c2410c', comparisonLabel },
    { label: 'Out of Stock Items', value: kpis.outOfStock?.value, change: kpis.outOfStock?.change, sparklineData: kpis.outOfStock?.sparkline, invertTrend: true, valueFormatter: (v) => formatInteger(v), icon: PackageX, iconBgColor: '#fee2e2', iconColor: '#b91c1c', comparisonLabel },
    { label: 'Stock Turnover Rate', value: kpis.turnover?.value, change: kpis.turnover?.change, sparklineData: kpis.turnover?.sparkline, valueFormatter: kpis.turnover?.valueFormatter || ((v) => `${Number(v).toFixed(1)}x`), icon: RefreshCw, iconBgColor: '#dcfce7', iconColor: '#166534', comparisonLabel },
  ];

  return (
    <div className="space-y-6">
      <SmartReportSectionHeader
        title="Inventory Overview"
        description="Sales and movements reflect the selected period; stock KPIs are a current snapshot."
        periodLabel={periodLabel}
      />
      {detail.summary?.snapshotLabel && (
        <p className="text-xs text-muted-foreground -mt-2">{detail.summary.snapshotLabel}</p>
      )}
      <SmartReportKpiRow items={kpiItems} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card style={OVERVIEW_CARD_BORDER} className="bg-card xl:col-span-1">
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">Inventory Value Trend</CardTitle>
            <Button variant="link" className="h-auto p-0 text-xs text-primary">View Detailed Trend</Button>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {valueTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={valueTrend}>
                  <defs>
                    <linearGradient id="inventoryValueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#166534" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#166534" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip formatter={(v) => formatOverviewCurrency(v)} />
                  <Area type="monotone" dataKey="value" stroke="#166534" fill="url(#inventoryValueGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground">No inventory trend data</div>
            )}
          </CardContent>
        </Card>

        <DonutBreakdownCard
          title="Inventory by Category"
          slices={categoryDonut.slices}
          total={categoryDonut.total}
          centerLabel="Total Value"
          viewLabel="View Category Analysis"
          emptyMessage="No inventory category data"
        />

        <DonutBreakdownCard
          title="Inventory Health"
          slices={healthDonut.slices}
          total={healthDonut.total}
          centerLabel="Total Items"
          formatCenterValue={(v) => formatInteger(v)}
          viewLabel="View Inventory Health"
          emptyMessage="No inventory health data"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card style={OVERVIEW_CARD_BORDER} className="bg-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base font-semibold">Top Low Stock Items</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {lowStockItems.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">Min.</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockItems.map((item) => (
                    <TableRow key={item.name}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right">{item.currentStock} {item.unit}</TableCell>
                      <TableCell className="text-right">{item.minStock} {item.unit}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">Low</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">No low stock items</div>
            )}
            <Button variant="link" className="h-auto p-0 text-xs text-primary mt-3">View All Low Stock Items</Button>
          </CardContent>
        </Card>

        <Card style={OVERVIEW_CARD_BORDER} className="bg-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base font-semibold">Top Out of Stock Items</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {outOfStockItems.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Last Sold</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outOfStockItems.map((item) => (
                    <TableRow key={item.name}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{item.lastSold}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">Out of Stock</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">No out of stock items</div>
            )}
            <Button variant="link" className="h-auto p-0 text-xs text-primary mt-3">View All Out of Stock Items</Button>
          </CardContent>
        </Card>

        <Card style={OVERVIEW_CARD_BORDER} className="bg-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base font-semibold">Inventory Movement Summary</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {movementSummary.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movementSummary.map((row) => (
                    <TableRow key={row.type}>
                      <TableCell>{row.type}</TableCell>
                      <TableCell className="text-right">{formatInteger(row.quantity)}</TableCell>
                      <TableCell className="text-right">{formatOverviewCurrency(row.value)}</TableCell>
                      <TableCell className="text-right text-xs">{formatPercentChange(row.change)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">No movement data</div>
            )}
            <Button variant="link" className="h-auto p-0 text-xs text-primary mt-3">View Full Movement Report</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
