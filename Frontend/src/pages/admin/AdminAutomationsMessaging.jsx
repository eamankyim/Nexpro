import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  RefreshCw,
  Workflow,
  PlayCircle,
  MessageSquare,
  Mail,
  Phone,
  AlertTriangle,
} from 'lucide-react';
import adminService from '../../services/adminService';
import { usePlatformAdminPermissions } from '../../context/PlatformAdminPermissionsContext';
import { useDebounce } from '../../hooks/useDebounce';
import { DEBOUNCE_DELAYS } from '../../constants';
import { formatInteger } from '../../utils/formatNumber';
import { showError, showSuccess, handleApiError } from '../../utils/toast';
import DashboardStatsCard from '../../components/DashboardStatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const defaultRange = [
  dayjs().subtract(29, 'day').startOf('day'),
  dayjs().endOf('day'),
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'active', label: 'Active' },
  { value: 'failed', label: 'Failing' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'paused', label: 'Paused' },
];

const statusBadgeClass = (status) => {
  switch (status) {
    case 'failed':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'active':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'paused':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'waiting':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    default:
      return 'bg-muted text-foreground border-border';
  }
};

const AdminAutomationsMessaging = () => {
  const { hasPermission, loading: permissionsLoading } = usePlatformAdminPermissions();
  const [loading, setLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(true);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [overview, setOverview] = useState(null);
  const [usage, setUsage] = useState(null);
  const [range, setRange] = useState(defaultRange);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, DEBOUNCE_DELAYS.SEARCH || 500);

  const rangeForPicker = useMemo(() => {
    if (!range || !range[0] || !range[1]) return undefined;
    return { from: range[0].toDate(), to: range[1].toDate() };
  }, [range]);

  const periodParams = useMemo(() => {
    if (!range || range.length !== 2) return {};
    return {
      from: range[0].startOf('day').toISOString(),
      to: range[1].endOf('day').toISOString(),
    };
  }, [range]);

  const handleRangeSelect = (newRange) => {
    if (!newRange?.from) return;
    const from = dayjs(newRange.from);
    const to = newRange.to ? dayjs(newRange.to) : from;
    setRange([from.startOf('day'), to.endOf('day')]);
  };

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminService.getAutomationsOverview({
        ...periodParams,
        status: status === 'all' ? undefined : status,
        q: debouncedSearch || undefined,
        page,
        limit: 25,
      });
      if (response?.success) setOverview(response.data);
    } catch (error) {
      console.error('Failed to load automations overview', error);
      handleApiError(error, 'Failed to load automations overview');
    } finally {
      setLoading(false);
    }
  }, [periodParams, status, debouncedSearch, page]);

  const loadUsage = useCallback(async ({ includeBalance = false } = {}) => {
    setUsageLoading(true);
    try {
      const response = await adminService.getMessagingUsage({
        ...periodParams,
        includeBalance: includeBalance ? 1 : 0,
      });
      if (response?.success) setUsage(response.data);
    } catch (error) {
      console.error('Failed to load messaging usage', error);
      handleApiError(error, 'Failed to load messaging usage');
    } finally {
      setUsageLoading(false);
    }
  }, [periodParams]);

  useEffect(() => {
    if (permissionsLoading || !hasPermission('automations.view')) return;
    loadOverview();
  }, [permissionsLoading, hasPermission, loadOverview]);

  useEffect(() => {
    if (permissionsLoading || !hasPermission('automations.view')) return;
    loadUsage({ includeBalance: false });
  }, [permissionsLoading, hasPermission, loadUsage]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, periodParams.from, periodParams.to]);

  const refreshBalance = async () => {
    setBalanceLoading(true);
    try {
      const response = await adminService.getMessagingUsage({
        ...periodParams,
        includeBalance: 1,
      });
      if (response?.success) {
        setUsage(response.data);
        if (response.data?.balance?.ok) {
          showSuccess('Arkesel balance refreshed');
        } else {
          showError(response.data?.balance?.message || 'Could not refresh Arkesel balance');
        }
      }
    } catch (error) {
      handleApiError(error, 'Failed to refresh Arkesel balance');
    } finally {
      setBalanceLoading(false);
    }
  };

  if (!permissionsLoading && !hasPermission('automations.view')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don&apos;t have permission to view Automations.
          </p>
        </div>
      </div>
    );
  }

  if (permissionsLoading && !overview) {
    return (
      <div className="flex justify-center py-20">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  const kpis = overview?.kpis;
  const channels = usage?.channels || kpis?.messaging || { sms: 0, email: 0, whatsapp: 0 };
  const platformSms = usage?.platformSms || null;
  const balance = usage?.balance?.balance;
  const pagination = overview?.pagination;
  const automations = overview?.automations || [];
  const smsRows = platformSms?.byTenant || [];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground mb-1">Automations</h2>
          <p className="text-sm text-muted-foreground">
            Cross-tenant rule health and messaging usage. Message bodies and full rule configs are not shown.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              loadOverview();
              loadUsage({ includeBalance: false });
            }}
            disabled={loading || usageLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${(loading || usageLoading) ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            type="button"
            onClick={refreshBalance}
            disabled={balanceLoading}
            className="bg-[#166534] hover:bg-[#14532d] text-white"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${balanceLoading ? 'animate-spin' : ''}`} />
            Refresh Arkesel balance
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <DateRangePicker
          range={rangeForPicker}
          onSelect={handleRangeSelect}
          className="w-auto min-w-[220px]"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="search"
            placeholder="Search rule or tenant…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-[240px]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <DashboardStatsCard
          title="Rules"
          value={kpis?.rules?.total ?? 0}
          subtitle={`${formatInteger(kpis?.rules?.enabled ?? 0)} enabled · ${formatInteger(kpis?.rules?.failing ?? 0)} failing`}
          icon={Workflow}
          iconBgColor="#dcfce7"
          iconColor="#166534"
          loading={loading}
        />
        <DashboardStatsCard
          title="Runs (period)"
          value={kpis?.runs?.total ?? 0}
          subtitle={`${formatInteger(kpis?.runs?.success ?? 0)} ok · ${formatInteger(kpis?.runs?.failed ?? 0)} failed`}
          icon={PlayCircle}
          iconBgColor="#eff6ff"
          iconColor="#2563eb"
          loading={loading}
        />
        <DashboardStatsCard
          title="Platform SMS (month)"
          value={platformSms?.totals?.sentCount ?? kpis?.platformSms?.sentCount ?? 0}
          subtitle={`${formatInteger(platformSms?.totals?.remaining ?? kpis?.platformSms?.remaining ?? 0)} remaining · limit ${formatInteger(platformSms?.monthlyLimit ?? kpis?.platformSms?.monthlyLimitPerTenant ?? 0)}/tenant`}
          icon={Phone}
          iconBgColor="#fef3c7"
          iconColor="#d97706"
          loading={usageLoading}
        />
        <DashboardStatsCard
          title="Email sent (period)"
          value={channels.email ?? 0}
          subtitle="Successful send_email_platform"
          icon={Mail}
          iconBgColor="#e0e7ff"
          iconColor="#4f46e5"
          loading={usageLoading || loading}
        />
        <DashboardStatsCard
          title="WhatsApp sent (period)"
          value={channels.whatsapp ?? 0}
          subtitle="Successful send_whatsapp"
          icon={MessageSquare}
          iconBgColor="#dcfce7"
          iconColor="#166534"
          loading={usageLoading || loading}
        />
        <DashboardStatsCard
          title="SMS actions (period)"
          value={channels.sms ?? 0}
          subtitle="Successful send_sms in runs"
          icon={Phone}
          iconBgColor="#fce7f3"
          iconColor="#db2777"
          loading={usageLoading || loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="border border-gray-200 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Messaging by channel (period)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'SMS', value: channels.sms, color: 'text-[#db2777]' },
                { label: 'Email', value: channels.email, color: 'text-[#4f46e5]' },
                { label: 'WhatsApp', value: channels.whatsapp, color: 'text-[#166534]' },
              ].map((item) => (
                <div key={item.label} className="rounded-md border border-gray-200 p-4">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className={`text-2xl font-semibold mt-1 ${item.color}`}>
                    {formatInteger(item.value ?? 0)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Arkesel balance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {balance ? (
              <>
                <p>
                  SMS balance:{' '}
                  <span className="font-semibold">{balance.smsBalance ?? '—'}</span>
                </p>
                <p>
                  Main balance:{' '}
                  <span className="font-semibold">{balance.mainBalance ?? '—'}</span>
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                Click &quot;Refresh Arkesel balance&quot; to check platform SMS credit.
              </p>
            )}
            {usage?.balance && !usage.balance.ok && (
              <p className="text-red-600">{usage.balance.message}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border border-gray-200 mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Automations</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : automations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No automation rules found.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Rule</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Enabled</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last run</TableHead>
                      <TableHead className="text-right">Runs</TableHead>
                      <TableHead className="text-right">Failed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {automations.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.tenantName || '—'}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell className="text-muted-foreground">{row.triggerType}</TableCell>
                        <TableCell>{row.enabled ? 'Yes' : 'No'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadgeClass(row.derivedStatus)}>
                            {row.derivedStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {row.lastRunAt ? dayjs(row.lastRunAt).format('DD MMM YYYY, HH:mm') : '—'}
                        </TableCell>
                        <TableCell className="text-right">{formatInteger(row.runsTotal)}</TableCell>
                        <TableCell className="text-right">{formatInteger(row.runsFailed)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 gap-2">
                  <p className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages} · {formatInteger(pagination.total)} rules
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={page >= pagination.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border border-gray-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Platform SMS usage
            {platformSms?.yearMonth ? ` · ${platformSms.yearMonth}` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usageLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : smsRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No platform SMS usage recorded this month.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Monthly limit</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-right">% used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {smsRows.map((row) => (
                    <TableRow key={row.tenantId}>
                      <TableCell className="font-medium">{row.tenantName}</TableCell>
                      <TableCell className="text-right">{formatInteger(row.sentCount)}</TableCell>
                      <TableCell className="text-right">{formatInteger(row.monthlyLimit)}</TableCell>
                      <TableCell className="text-right">{formatInteger(row.remaining)}</TableCell>
                      <TableCell className="text-right">
                        <span className={row.percentUsed >= 90 ? 'text-red-600 font-medium' : ''}>
                          {row.percentUsed}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAutomationsMessaging;
