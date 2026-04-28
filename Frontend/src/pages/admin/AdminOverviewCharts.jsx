import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { CHART_COLORS } from '@/constants';

dayjs.extend(relativeTime);

/**
 * Chart blocks for platform overview (recharts in a separate async chunk).
 * @param {React.ReactNode} alertsSlot — Alerts card (non-chart) rendered in the second column.
 */
export default function AdminOverviewCharts({ metrics, alertsSlot }) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-base">Tenant signups (last 30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics?.signupTrend?.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={metrics.signupTrend}>
                    <defs>
                      <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => dayjs(value).format('MMM D')}
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      labelFormatter={(value) => dayjs(value).format('MMMM D, YYYY')}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="var(--color-primary)"
                      fill="url(#colorSignups)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="No signups in the last 30 days" />
              )}
            </CardContent>
          </Card>
        </div>
        <div>
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-base">Plan distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics?.planDistribution?.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={metrics.planDistribution}
                      dataKey="count"
                      nameKey="plan"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                    >
                      {metrics.planDistribution.map((entry, index) => (
                        <Cell
                          key={entry.plan}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="No tenants yet" />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">Tenant status breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics?.statusDistribution?.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={metrics.statusDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="No tenant data yet" />
            )}
          </CardContent>
        </Card>
        {alertsSlot}
      </div>
    </>
  );
}
