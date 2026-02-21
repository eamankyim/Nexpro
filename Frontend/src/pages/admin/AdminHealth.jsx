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
import { Activity, Database, Bell, Users } from 'lucide-react';

dayjs.extend(relativeTime);

const AdminHealth = () => {
  const { hasPermission, loading: permissionsLoading } = usePlatformAdminPermissions();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

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

      <div className="mb-2 text-sm text-muted-foreground">
        Started {dayjs(data?.serverStartedAt).fromNow()}
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
