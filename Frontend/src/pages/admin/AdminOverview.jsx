import { useEffect, useState, lazy, Suspense } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import adminService from '../../services/adminService';
import StatusChip from '../../components/StatusChip';
import { usePlatformAdminPermissions } from '../../context/PlatformAdminPermissionsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import DashboardStatsCard from '../../components/DashboardStatsCard';
import { Building2, Users, TrendingUp, UserCheck } from 'lucide-react';

dayjs.extend(relativeTime);

const AdminOverviewCharts = lazy(() => import('./AdminOverviewCharts'));

const AdminOverview = () => {
  const { hasPermission, loading: permissionsLoading } = usePlatformAdminPermissions();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState({ upcomingTrials: [], attentionRequired: [] });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [summaryRes, metricsRes, alertsRes] = await Promise.all([
          adminService.getSummary(),
          adminService.getTenantMetrics(),
          adminService.getAlerts(),
        ]);

        if (summaryRes?.success) setSummary(summaryRes.data);
        if (metricsRes?.success) setMetrics(metricsRes.data);
        if (alertsRes?.success) setAlerts(alertsRes.data);
      } catch (error) {
        console.error('Failed to load control center overview', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Check permission after hooks
  if (!permissionsLoading && !hasPermission('overview.view')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">Access Denied</h3>
          <p className="text-gray-600">You don't have permission to view this page.</p>
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
        <h2 className="text-2xl font-semibold text-foreground mb-1">Platform Overview</h2>
        <p className="text-sm text-muted-foreground">
          Monitor adoption, health, and upcoming events across the entire African Business Suite platform.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <DashboardStatsCard
          title="Total tenants"
          value={summary?.totalTenants ?? 0}
          icon={Building2}
          iconBgColor="#dcfce7"
          iconColor="#166534"
        />
        <DashboardStatsCard
          title="Active tenants"
          value={summary?.activeTenants ?? 0}
          icon={UserCheck}
          iconBgColor="#dbeafe"
          iconColor="#2563eb"
        />
        <DashboardStatsCard
          title="Trial tenants"
          value={summary?.trialTenants ?? 0}
          icon={Users}
          iconBgColor="#fef3c7"
          iconColor="#d97706"
        />
        <DashboardStatsCard
          title="Total users"
          value={summary?.totalUsers ?? 0}
          icon={Users}
          iconBgColor="#e0e7ff"
          iconColor="#4f46e5"
        />
        <DashboardStatsCard
          title="New tenants (7 days)"
          value={summary?.newTenantsLast7Days ?? 0}
          icon={TrendingUp}
          iconBgColor="#dcfce7"
          iconColor="#16a34a"
        />
        <DashboardStatsCard
          title="Avg. users per tenant"
          value={summary?.avgUsersPerTenant ?? 0}
          icon={Users}
          iconBgColor="#f3e8ff"
          iconColor="#7c3aed"
        />
      </div>

      <Suspense
        fallback={
          <div className="space-y-6 mb-6">
            <Skeleton className="h-[280px] w-full rounded-lg border border-gray-200" />
            <Skeleton className="h-[280px] w-full rounded-lg border border-gray-200" />
          </div>
        }
      >
        <AdminOverviewCharts
          metrics={metrics}
          alertsSlot={
            <Card className="border border-gray-200">
              <CardHeader>
                <CardTitle className="text-base">Alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Trials ending soon</h4>
                  {alerts.upcomingTrials?.length ? (
                    <ul className="space-y-2">
                      {alerts.upcomingTrials.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                        >
                          <div>
                            <span className="font-medium">{item.name}</span>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {item.trialEndsAt
                                ? `Trial ends ${dayjs(item.trialEndsAt).fromNow()}`
                                : 'Trial end date unavailable'}
                              , created {dayjs(item.createdAt).format('MMM D, YYYY')}
                            </p>
                          </div>
                          <Badge variant="secondary">{item.plan}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty description="No upcoming trial expirations" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Needs attention</h4>
                  {alerts.attentionRequired?.length ? (
                    <ul className="space-y-2">
                      {alerts.attentionRequired.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                        >
                          <div>
                            <span className="font-medium">{item.name}</span>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Last update {dayjs(item.updatedAt).fromNow()}
                            </p>
                          </div>
                          <StatusChip status={item.status} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty description="No tenants flagged" />
                  )}
                </div>
              </CardContent>
            </Card>
          }
        />
      </Suspense>
    </div>
  );
};

export default AdminOverview;
