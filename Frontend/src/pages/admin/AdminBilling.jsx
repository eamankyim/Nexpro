import { useEffect, useState } from 'react';
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
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useResponsive } from '../../hooks/useResponsive';
import adminService from '../../services/adminService';
import { usePlatformAdminPermissions } from '../../context/PlatformAdminPermissionsContext';
import StatusChip from '../../components/StatusChip';
import DashboardStatsCard from '../../components/DashboardStatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Currency, Users, CreditCard } from 'lucide-react';

dayjs.extend(relativeTime);

const PLAN_COLORS = ['#27ae60', '#2f80ed', '#9b51e0'];

const getPlanLabel = (plan) => {
  switch (plan) {
    case 'standard':
      return 'Standard';
    case 'pro':
      return 'Pro';
    default:
      return plan;
  }
};

const AdminBilling = () => {
  const { isMobile } = useResponsive();
  const { hasPermission, loading: permissionsLoading } = usePlatformAdminPermissions();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [tenants, setTenants] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [summaryRes, tenantsRes] = await Promise.all([
          adminService.getBillingSummary(),
          adminService.getBillingTenants(),
        ]);
        if (summaryRes?.success) setSummary(summaryRes.data);
        if (tenantsRes?.success) setTenants(tenantsRes.data || []);
      } catch (error) {
        console.error('Failed to load billing data', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Check permission after all hooks
  if (!permissionsLoading && !hasPermission('billing.view')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">Access Denied</h3>
          <p className="text-gray-600">You don't have permission to view billing.</p>
        </div>
      </div>
    );
  }

  if (loading || permissionsLoading) {
    return (
      <div className="flex justify-center py-20">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-foreground mb-1">Billing & Subscriptions</h2>
        <p className="text-sm text-muted-foreground">
          Track revenue performance, plan mix, and paid tenants across the platform.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <DashboardStatsCard
          title="Estimated MRR (₵)"
          value={
            typeof summary?.estimatedMRR === 'number'
              ? summary.estimatedMRR.toFixed(2)
              : summary?.estimatedMRR ?? 0
          }
          icon={Currency}
          iconBgColor="#dcfce7"
          iconColor="#166534"
        />
        <DashboardStatsCard
          title="Paying tenants"
          value={summary?.payingTenants ?? 0}
          icon={CreditCard}
          iconBgColor="#dbeafe"
          iconColor="#2563eb"
        />
        <DashboardStatsCard
          title="Trialing tenants"
          value={summary?.trialingTenants ?? 0}
          icon={Users}
          iconBgColor="#fef3c7"
          iconColor="#d97706"
        />
      </div>

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

      <Card className="border border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Paying tenants</CardTitle>
          <span className="text-sm text-muted-foreground">
            Showing {tenants.length} tenants on a paid plan
          </span>
        </CardHeader>
        <CardContent>
          {isMobile ? (
            <div className="flex flex-col gap-4">
              {tenants.length === 0 ? (
                <Empty description="No paying tenants" />
              ) : (
                tenants.map((tenant) => (
                  <Card key={tenant.id} className="border border-gray-200 p-4">
                    <div>
                      <p className="font-semibold text-foreground">{tenant.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {tenant.metadata?.billingCustomerId || tenant.slug}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                      <Badge variant={tenant.plan === 'pro' ? 'default' : 'secondary'}>
                        {getPlanLabel(tenant.plan)}
                      </Badge>
                      <StatusChip status={tenant.status} />
                      <span className="text-xs text-muted-foreground">
                        {tenant.metadata?.paymentMethod || 'Not on file'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {dayjs(tenant.updatedAt).fromNow()}
                      </span>
                    </div>
                  </Card>
                ))
              )}
            </div>
          ) : (
            <>
              {tenants.length === 0 ? (
                <Empty description="No paying tenants" className="py-12" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Billing Method</TableHead>
                      <TableHead>Last Update</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants.map((tenant) => (
                      <TableRow key={tenant.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{tenant.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {tenant.metadata?.billingCustomerId || tenant.slug}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={tenant.plan === 'pro' ? 'default' : 'secondary'}>
                            {getPlanLabel(tenant.plan)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <StatusChip status={tenant.status} />
                        </TableCell>
                        <TableCell>
                          {tenant.metadata?.paymentMethod || 'Not on file'}
                        </TableCell>
                        <TableCell>{dayjs(tenant.updatedAt).fromNow()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminBilling;
