import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import adminService from '../../services/adminService';
import { usePlatformAdminPermissions } from '../../context/PlatformAdminPermissionsContext';
import StatusChip from '../../components/StatusChip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Timeline,
  TimelineItem,
  TimelineIndicator,
  TimelineContent,
  TimelineTitle,
  TimelineDescription,
} from '@/components/ui/timeline';
import DashboardStatsCard from '../../components/DashboardStatsCard';
import { Activity, Database, Bell, Users, Gauge, Timer } from 'lucide-react';

dayjs.extend(relativeTime);

const AdminHealth = () => {
  const { hasPermission, loading: permissionsLoading } = usePlatformAdminPermissions();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchHealth = async () => {
      setLoading(true);
      try {
        const response = await adminService.getSystemHealth();
        if (response?.success) setData(response.data);
      } catch (error) {
        console.error('Failed to load system health', error);
      } finally {
        setLoading(false);
      }
    };
    fetchHealth();
  }, []);

  // Check permission after all hooks
  if (!permissionsLoading && !hasPermission('health.view')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">Access Denied</h3>
          <p className="text-gray-600">You don't have permission to view system health.</p>
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

  const indicatorColor = (status) => {
    if (status === 'active') return 'bg-green-500';
    if (status === 'paused') return 'bg-amber-500';
    return 'bg-red-500';
  };

  const slowOperations = data?.performance?.operations || [];
  const hotPaths = data?.performance?.hotPaths || [];
  const thresholdMs = data?.performance?.thresholdMs || 0;
  const slowestOperation = slowOperations.reduce(
    (max, item) => Math.max(max, Number(item.durationMs || 0)),
    0
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-foreground mb-1">System Health</h2>
        <p className="text-sm text-muted-foreground">
          Monitor backend uptime, database responsiveness, and recent events.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <DashboardStatsCard
          title="Server uptime"
          value={data?.uptimeHuman || '—'}
          icon={Activity}
          iconBgColor="#dcfce7"
          iconColor="#166534"
        />
        <Card className="border border-gray-200">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Database latency</p>
                <p className="text-2xl font-bold mt-1">
                  {data?.database?.latencyMs ?? 0} ms
                </p>
                <StatusChip status={data?.database?.status || 'online'} />
              </div>
              <div className="rounded-full p-2 bg-blue-100">
                <Database className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <DashboardStatsCard
          title="Pending notifications"
          value={data?.counts?.pendingNotifications ?? 0}
          icon={Bell}
          iconBgColor="#fef3c7"
          iconColor="#d97706"
        />
        <DashboardStatsCard
          title="Platform admins"
          value={data?.counts?.activeAdmins ?? 0}
          icon={Users}
          iconBgColor="#e0e7ff"
          iconColor="#4f46e5"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <DashboardStatsCard
          title="Slow requests retained"
          value={slowOperations.length}
          subtitle={`Threshold ${thresholdMs} ms`}
          icon={Timer}
          iconBgColor="#fef2f2"
          iconColor="#dc2626"
        />
        <DashboardStatsCard
          title="Hot paths"
          value={hotPaths.length}
          subtitle="Grouped by label, method, and path"
          icon={Gauge}
          iconBgColor="#fff7ed"
          iconColor="#ea580c"
        />
        <DashboardStatsCard
          title="Slowest recent request"
          value={slowestOperation}
          suffix=" ms"
          subtitle={slowOperations[0]?.label || 'No slow requests captured'}
          icon={Activity}
          iconBgColor="#eff6ff"
          iconColor="#2563eb"
        />
      </div>

      <div className="mb-2 text-sm text-muted-foreground">
        Started {dayjs(data?.serverStartedAt).fromNow()}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">Slow hot paths</CardTitle>
          </CardHeader>
          <CardContent>
            {hotPaths.length ? (
              <div className="space-y-3">
                {hotPaths.map((item) => (
                  <div key={`${item.label}-${item.method}-${item.path}`} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{item.label}</span>
                      <Badge variant="secondary">{item.method || 'ANY'}</Badge>
                      <Badge variant="outline">{item.count}x</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 break-all">{item.path || 'No path'}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Avg {item.avgDurationMs} ms • Max {item.maxDurationMs} ms • Last {dayjs(item.lastSeenAt).fromNow()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No slow hot paths captured since the server started.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">Recent slow operations</CardTitle>
          </CardHeader>
          <CardContent>
            {slowOperations.length ? (
              <div className="space-y-3">
                {slowOperations.slice(0, 8).map((item, index) => (
                  <div key={`${item.recordedAt}-${item.label}-${index}`} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-sm">{item.label}</span>
                      <Badge variant="destructive">{item.durationMs} ms</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 break-all">
                      {item.method || 'ANY'} {item.path || 'No path'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {dayjs(item.recordedAt).fromNow()} • tenant {item.tenantId || 'n/a'} • user {item.userId || 'n/a'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent slow operations captured.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">Recent tenants</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.recentTenants?.length ? (
              <Timeline>
                {data.recentTenants.map((tenant, idx) => (
                  <TimelineItem key={tenant.id} isLast={idx === data.recentTenants.length - 1}>
                    <TimelineIndicator
                      className={indicatorColor(tenant.status)}
                    />
                    <TimelineContent>
                      <TimelineTitle className="flex items-center gap-2">
                        {tenant.name}
                        <Badge variant="secondary">{tenant.plan}</Badge>
                      </TimelineTitle>
                      <TimelineDescription>
                        {tenant.status} • {dayjs(tenant.createdAt).fromNow()}
                      </TimelineDescription>
                    </TimelineContent>
                  </TimelineItem>
                ))}
              </Timeline>
            ) : (
              <p className="text-sm text-muted-foreground">No recent tenants recorded.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">Recent notifications</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.recentNotifications?.length ? (
              <ul className="space-y-3">
                {data.recentNotifications.map((item) => (
                  <li
                    key={item.id}
                    className="py-2 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-medium">{item.title}</span>
                      <Badge variant={item.isRead ? 'secondary' : 'default'}>
                        {item.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Triggered {dayjs(item.createdAt).fromNow()}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No recent notifications logged.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminHealth;
