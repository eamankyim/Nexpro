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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Platform admin report charts (async chunk).
 * @param {React.ReactNode} topCustomersSlot — second column (lg:col-span-2), non-recharts table/cards.
 */
export default function AdminReportsCharts({
  revenueLoading,
  expenseLoading,
  revenueSeries,
  expenseSeries,
  pipeline,
  topCustomersSlot,
}) {
  return (
    <>
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
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.1} />
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
                  stroke="var(--color-primary)"
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
                  stroke="hsl(var(--destructive))"
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
            <BarChart
              width={360}
              height={260}
              data={[
                { name: 'Paying tenants', value: pipeline.activeJobs },
                { name: 'Trialing tenants', value: pipeline.openLeads },
                { name: 'New this month', value: pipeline.pendingInvoices },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          ) : (
            <p className="text-sm text-muted-foreground">No pipeline data available.</p>
          )}
        </CardContent>
      </Card>
      {topCustomersSlot}
    </div>
    </>
  );
}
