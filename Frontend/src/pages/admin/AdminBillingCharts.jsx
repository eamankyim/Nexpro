import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';

const PLAN_COLORS = ['#27ae60', '#2f80ed', '#9b51e0'];

/**
 * Billing charts (async chunk — recharts not on admin shell critical path).
 */
export default function AdminBillingCharts({ summary, getPlanLabel }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="text-base">Revenue by plan (₵)</CardTitle>
        </CardHeader>
        <CardContent>
          {summary?.planBreakdown?.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={summary.planBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="plan" tickFormatter={getPlanLabel} />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(value) => `₵ ${value}`} />
                <Bar dataKey="mrr" fill="#2f80ed" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty description="No paying tenants yet" />
          )}
        </CardContent>
      </Card>
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="text-base">Plan mix</CardTitle>
        </CardHeader>
        <CardContent>
          {summary?.planBreakdown?.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={summary.planBreakdown}
                  dataKey="count"
                  nameKey="plan"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                >
                  {summary.planBreakdown.map((entry, index) => (
                    <Cell
                      key={entry.plan}
                      fill={PLAN_COLORS[index % PLAN_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name, props) => [
                    `${value} tenants`,
                    getPlanLabel(props.payload.plan),
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <Empty description="No data yet" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
