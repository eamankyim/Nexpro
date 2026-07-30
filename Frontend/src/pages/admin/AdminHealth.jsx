import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import adminService from '../../services/adminService';
import { usePlatformAdminPermissions } from '../../context/PlatformAdminPermissionsContext';
import StatusChip from '../../components/StatusChip';
import PlanBadge from '../../components/PlanBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  Activity,
  Database,
  Bell,
  Users,
  Gauge,
  Timer,
  AlertTriangle,
  CheckCircle2,
  Mail,
  MessageSquare,
  Settings2,
} from 'lucide-react';

dayjs.extend(relativeTime);

/** Truncate UUID for secondary display next to email/name. */
const shortId = (value) => {
  if (!value || typeof value !== 'string') return null;
  return value.length > 8 ? `${value.slice(0, 8)}…` : value;
};

/**
 * Build a readable identity segment for slow ops (email preferred, UUID secondary).
 * @param {{ label: string, email?: string|null, name?: string|null, id?: string|null }} parts
 */
const formatIdentity = ({ label, email, name, id }) => {
  const primary = email || name || null;
  const idSuffix = shortId(id);
  if (primary && idSuffix) return `${label} ${primary} (${idSuffix})`;
  if (primary) return `${label} ${primary}`;
  if (idSuffix) return `${label} ${idSuffix}`;
  return `${label} n/a`;
};

/**
 * One-line tenant + user context for a slow operation row.
 * @param {object} item
 * @returns {string}
 */
const formatSlowOpContext = (item) => {
  const parts = [dayjs(item.recordedAt).fromNow()];
  if (item.tenantName) parts.push(item.tenantName);
  parts.push(
    formatIdentity({
      label: 'tenant',
      email: item.tenantEmail,
      id: item.tenantId,
    })
  );
  parts.push(
    formatIdentity({
      label: 'user',
      email: item.userEmail,
      name: item.userName,
      id: item.userId,
    })
  );
  return parts.join(' • ');
};

const overallBannerClass = (status) => {
  if (status === 'critical') return 'border-red-300 bg-red-50 text-red-900';
  if (status === 'degraded') return 'border-amber-300 bg-amber-50 text-amber-900';
  return 'border-green-300 bg-green-50 text-green-900';
};

const severityBadgeVariant = (severity) => {
  if (severity === 'critical') return 'destructive';
  if (severity === 'warning') return 'outline';
  return 'secondary';
};

const AdminHealth = () => {
  const { hasPermission, loading: permissionsLoading } = usePlatformAdminPermissions();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [actionId, setActionId] = useState(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminService.getSystemHealth();
      if (response?.success) setData(response.data);
    } catch (error) {
      console.error('Failed to load system health', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const handleAcknowledge = useCallback(async (id) => {
    setActionId(id);
    try {
      await adminService.acknowledgeSystemHealthIssue(id);
      await fetchHealth();
    } catch (error) {
      console.error('Failed to acknowledge issue', error);
    } finally {
      setActionId(null);
    }
  }, [fetchHealth]);

  const handleResolve = useCallback(async (id) => {
    setActionId(id);
    try {
      await adminService.resolveSystemHealthIssue(id);
      await fetchHealth();
    } catch (error) {
      console.error('Failed to resolve issue', error);
    } finally {
      setActionId(null);
    }
  }, [fetchHealth]);

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
  const openIssues = data?.openIssues || [];
  const channels = data?.channels || {};
  const recentFailures = data?.recentFailures || [];
  const configChecks = data?.configChecks || [];
  const overallStatus = data?.overallStatus || 'healthy';

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-foreground mb-1">System Health</h2>
          <p className="text-sm text-muted-foreground">
            Monitor delivery failures, config readiness, uptime, and slow requests.
          </p>
        </div>
        <Button type="button" variant="secondaryStroke" onClick={fetchHealth}>
          Refresh
        </Button>
      </div>

      <div
        className={`mb-6 rounded-lg border px-4 py-3 flex flex-wrap items-center gap-3 ${overallBannerClass(overallStatus)}`}
      >
        {overallStatus === 'healthy' ? (
          <CheckCircle2 className="h-5 w-5 shrink-0" />
        ) : (
          <AlertTriangle className="h-5 w-5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold capitalize">{overallStatus} system status</p>
          <p className="text-sm opacity-90">
            {openIssues.length
              ? `${openIssues.length} open issue${openIssues.length === 1 ? '' : 's'} (${data?.openCriticalCount || 0} critical)`
              : 'No open delivery or config issues'}
          </p>
        </div>
      </div>

      {openIssues.length > 0 && (
        <Card className="border border-gray-200 mb-6">
          <CardHeader>
            <CardTitle className="text-base">Open issues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {openIssues.map((issue) => (
              <div
                key={issue.id}
                className="border border-gray-200 rounded-lg p-3 space-y-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={severityBadgeVariant(issue.severity)}>
                    {issue.severity}
                  </Badge>
                  <Badge variant="outline">{issue.category}</Badge>
                  <Badge variant="secondary">{issue.status}</Badge>
                  <span className="font-medium text-sm">{issue.title}</span>
                </div>
                <p className="text-sm text-muted-foreground">{issue.summary}</p>
                {issue.lastErrorMessage ? (
                  <p className="text-xs text-red-700 break-words">{issue.lastErrorMessage}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {issue.tenantName || 'Platform'}
                  {' • '}
                  Seen {issue.occurrenceCount}×
                  {' • '}
                  Last {dayjs(issue.lastSeenAt).fromNow()}
                  {issue.notifiedAt ? ` • Notified ${dayjs(issue.notifiedAt).fromNow()}` : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  {issue.status === 'open' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondaryStroke"
                      loading={actionId === issue.id}
                      disabled={!!actionId}
                      onClick={() => handleAcknowledge(issue.id)}
                    >
                      Acknowledge
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    loading={actionId === issue.id}
                    disabled={!!actionId}
                    onClick={() => handleResolve(issue.id)}
                  >
                    Resolve
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {['email', 'sms', 'whatsapp'].map((channel) => {
          const stats = channels[channel] || { success24h: 0, failed24h: 0, lastFailureAt: null };
          const Icon = channel === 'email' ? Mail : MessageSquare;
          return (
            <Card key={channel} className="border border-gray-200">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {channel} (24h)
                    </p>
                    <p className="text-2xl font-bold mt-1">
                      {stats.success24h}
                      <span className="text-sm font-normal text-muted-foreground"> ok</span>
                    </p>
                    <p className={`text-sm mt-1 ${stats.failed24h ? 'text-red-700' : 'text-muted-foreground'}`}>
                      {stats.failed24h} failed
                      {stats.lastFailureAt ? ` • last ${dayjs(stats.lastFailureAt).fromNow()}` : ''}
                    </p>
                  </div>
                  <div className="rounded-md p-2 bg-muted">
                    <Icon className="h-5 w-5 text-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-base">Recent failures</CardTitle>
          </CardHeader>
          <CardContent>
            {recentFailures.length ? (
              <div className="space-y-3">
                {recentFailures.map((ev) => (
                  <div key={ev.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{ev.channel}</Badge>
                      {ev.errorCode ? <Badge variant="destructive">{ev.errorCode}</Badge> : null}
                      <span className="text-sm font-medium">{ev.subjectOrContext || ev.source || 'Delivery'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {ev.tenantName || 'Platform'} • {ev.recipientMasked || '—'} • {dayjs(ev.createdAt).fromNow()}
                    </p>
                    {ev.errorMessage ? (
                      <p className="text-xs text-red-700 mt-1 break-words line-clamp-2">{ev.errorMessage}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent delivery failures recorded.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Config checks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {configChecks.length ? (
              configChecks.map((check) => (
                <div
                  key={check.key}
                  className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium">{check.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{check.detail}</p>
                  </div>
                  <Badge variant={check.ok ? 'secondary' : 'destructive'}>
                    {check.ok ? 'OK' : 'Issue'}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No config checks available.</p>
            )}
            <p className="text-xs text-muted-foreground pt-1">
              Manage providers in{' '}
              <Link to="/admin/settings" className="text-primary underline-offset-2 hover:underline">
                Admin Settings
              </Link>
              .
            </p>
          </CardContent>
        </Card>
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
              <div className="rounded-md p-2 bg-blue-100">
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
                      {formatSlowOpContext(item)}
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
                        <PlanBadge plan={tenant.plan} />
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
