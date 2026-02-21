import { useEffect, useState, useMemo, useCallback } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Loader2, Building2, CreditCard, Zap, Crown, Eye } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { useResponsive } from '../../hooks/useResponsive';
import adminService from '../../services/adminService';
import StatusChip from '../../components/StatusChip';
import { useSmartSearch } from '../../context/SmartSearchContext';
import { usePlatformAdminPermissions } from '../../context/PlatformAdminPermissionsContext';
import { SEARCH_PLACEHOLDERS, DEBOUNCE_DELAYS } from '../../constants';
import { showSuccess, showError, handleApiError } from '../../utils/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Empty } from '@/components/ui/empty';
import { Descriptions, DescriptionItem } from '@/components/ui/descriptions';
import DashboardTable from '../../components/DashboardTable';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

dayjs.extend(relativeTime);

const getPlanVariant = (plan) => {
  switch (plan) {
    case 'pro':
      return 'default';
    case 'standard':
      return 'secondary';
    case 'trial':
      return 'outline';
    default:
      return 'outline';
  }
};

const AdminTenants = () => {
  const { isMobile } = useResponsive();
  const { searchValue, setPageSearchConfig } = useSmartSearch();
  const { hasPermission, loading: permissionsLoading } = usePlatformAdminPermissions();
  const debouncedSearch = useDebounce(searchValue, DEBOUNCE_DELAYS.SEARCH);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [filters, setFilters] = useState({
    plan: undefined,
    status: undefined,
  });
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [planStats, setPlanStats] = useState(null);

  const fetchTenants = async (page = 1, pageSize = 20, overrideFilters = {}) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pageSize,
        ...filters,
        ...overrideFilters,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      const response = await adminService.getTenants(params);
      if (response?.success) {
        setTenants(response.data || []);
        setPagination({
          current: page,
          pageSize,
          total: response.pagination?.total ?? 0,
        });
      }
    } catch (error) {
      handleApiError(error, { context: 'load tenants' });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (tenantId, action) => {
    setStatusUpdating(true);
    try {
      await adminService.updateTenantStatus(tenantId, action);
      showSuccess(`Tenant ${action}d successfully`);
      await fetchTenantDetail(tenantId);
      await fetchTenants(pagination.current, pagination.pageSize);
    } catch (error) {
      handleApiError(error, { context: 'update tenant status' });
    } finally {
      setStatusUpdating(false);
    }
  };

  const fetchTenantDetail = useCallback(async (tenantId) => {
    setDetailLoading(true);
    try {
      const response = await adminService.getTenantDetail(tenantId);
      if (response?.success) {
        setSelectedTenant(response.data);
        setDrawerVisible(true);
      }
    } catch (error) {
      handleApiError(error, { context: 'fetch tenant detail' });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    setPageSearchConfig({ scope: 'admin_tenants', placeholder: SEARCH_PLACEHOLDERS.ADMIN_TENANTS });
    return () => setPageSearchConfig(null);
  }, [setPageSearchConfig]);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const res = await adminService.getTenantMetrics();
        if (res?.success && res?.data?.planDistribution) {
          const byPlan = (res.data.planDistribution || []).reduce((acc, { plan, count }) => {
            acc[plan] = count;
            return acc;
          }, {});
          setPlanStats({
            total: res.data.total ?? 0,
            trial: byPlan.trial ?? 0,
            standard: byPlan.standard ?? 0,
            pro: byPlan.pro ?? 0,
          });
        }
      } catch {
        setPlanStats(null);
      }
    };
    loadMetrics();
  }, []);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, [searchValue]);

  useEffect(() => {
    fetchTenants(pagination.current, pagination.pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.current, pagination.pageSize, filters.plan, filters.status, debouncedSearch]);

  // Check permission after all hooks
  if (!permissionsLoading && !hasPermission('tenants.view')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">Access Denied</h3>
          <p className="text-muted-foreground">You don&apos;t have permission to view tenants.</p>
        </div>
      </div>
    );
  }

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const handleViewTenant = useCallback((record) => {
    setSelectedTenant(record);
    setDrawerVisible(true);
    fetchTenantDetail(record.id);
  }, [fetchTenantDetail]);

  const tableColumns = useMemo(() => [
    { key: 'name', label: 'Organization', render: (_, record) => (
      <div>
        <p className="font-semibold text-foreground">{record.name}</p>
        <p className="text-xs text-muted-foreground">{record.slug}</p>
      </div>
    )},
    { key: 'plan', label: 'Plan', render: (_, record) => (
      <Badge variant={getPlanVariant(record.plan)}>{record.plan}</Badge>
    )},
    { key: 'status', label: 'Status', render: (_, record) => <StatusChip status={record.status} /> },
    { key: 'userCount', label: 'Users', render: (_, record) => record.userCount ?? 0 },
    { key: 'createdAt', label: 'Created', render: (_, record) => dayjs(record.createdAt).format('MMM D, YYYY') },
    { key: 'trialEndsAt', label: 'Trial ends', render: (_, record) => (record.trialEndsAt ? dayjs(record.trialEndsAt).format('MMM D, YYYY') : '—') },
    { key: 'actions', label: 'Actions', render: (_, record) => (
      <Button variant="outline" size="sm" onClick={() => handleViewTenant(record)}>
        <Eye className="h-4 w-4 mr-2" />
        View
      </Button>
    )},
  ], []);

  const statCards = [
      {
        key: 'total',
        label: 'Total workspaces',
        value: planStats?.total ?? '—',
        icon: Building2,
        iconBg: 'rgba(22, 101, 52, 0.1)',
        iconColor: '#166534',
      },
      {
        key: 'trial',
        label: 'Trial',
        value: planStats?.trial ?? '—',
        icon: Zap,
        iconBg: 'rgba(234, 179, 8, 0.15)',
        iconColor: '#ca8a04',
      },
      {
        key: 'standard',
        label: 'Standard',
        value: planStats?.standard ?? '—',
        icon: CreditCard,
        iconBg: 'rgba(59, 130, 246, 0.15)',
        iconColor: '#2563eb',
      },
      {
        key: 'pro',
        label: 'Pro',
        value: planStats?.pro ?? '—',
        icon: Crown,
        iconBg: 'rgba(147, 51, 234, 0.15)',
        iconColor: '#7c3aed',
      },
    ];

  return (
    <>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground mb-1">Tenant Directory</h2>
            <p className="text-sm text-muted-foreground">
              Review every workspace, their status, and plan footprint across the platform.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={filters.plan ?? 'all'}
              onValueChange={(v) => handleFilterChange('plan', v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All plans</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.status ?? 'all'}
              onValueChange={(v) => handleFilterChange('status', v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {planStats && (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {statCards.map(({ key, label, value, icon: Icon, iconBg, iconColor }) => (
                <div key={key} className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-lg shrink-0"
                    style={{ backgroundColor: iconBg }}
                  >
                    <Icon className="h-5 w-5" style={{ color: iconColor }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-xl font-semibold text-foreground tabular-nums">
                      {typeof value === 'number' ? value.toLocaleString() : value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DashboardTable
          data={tenants}
          columns={tableColumns}
          loading={loading}
          title={null}
          emptyIcon={<Building2 className="h-12 w-12 text-muted-foreground" />}
          emptyDescription="No businesses registered yet. Tenants will appear here when users sign up."
          pageSize={pagination.pageSize}
          externalPagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
          }}
          onPageChange={(next) => setPagination((p) => ({ ...p, ...next }))}
        />
      </div>

      <Sheet open={drawerVisible} onOpenChange={(open) => { setDrawerVisible(open); if (!open) setSelectedTenant(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-[520px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Tenant details</SheetTitle>
          </SheetHeader>
          {detailLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : selectedTenant ? (
            <div className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Control</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => handleStatusUpdate(selectedTenant.id, 'activate')}
                    disabled={selectedTenant.status === 'active'}
                    loading={statusUpdating}
                  >
                    Activate
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleStatusUpdate(selectedTenant.id, 'pause')}
                    disabled={selectedTenant.status === 'paused'}
                    loading={statusUpdating}
                  >
                    Pause
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleStatusUpdate(selectedTenant.id, 'suspend')}
                    disabled={selectedTenant.status === 'suspended'}
                    loading={statusUpdating}
                  >
                    Suspend
                  </Button>
                </CardContent>
              </Card>

              <div>
                <h4 className="font-semibold text-foreground mb-2">Organization</h4>
                <Descriptions column={1}>
                  <DescriptionItem label="Name">{selectedTenant.name}</DescriptionItem>
                  <DescriptionItem label="Slug">{selectedTenant.slug}</DescriptionItem>
                  <DescriptionItem label="Plan">
                    <Badge variant={getPlanVariant(selectedTenant.plan)}>{selectedTenant.plan}</Badge>
                  </DescriptionItem>
                  <DescriptionItem label="Status">
                    <StatusChip status={selectedTenant.status} />
                  </DescriptionItem>
                  <DescriptionItem label="Created">
                    {dayjs(selectedTenant.createdAt).format('MMM D, YYYY')}
                  </DescriptionItem>
                  <DescriptionItem label="Trial ends">
                    {selectedTenant.trialEndsAt ? dayjs(selectedTenant.trialEndsAt).format('MMM D, YYYY') : '—'}
                  </DescriptionItem>
                </Descriptions>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">Metadata</h4>
                <Descriptions column={1}>
                  <DescriptionItem label="Website">{selectedTenant.metadata?.website || '—'}</DescriptionItem>
                  <DescriptionItem label="Email">{selectedTenant.metadata?.email || '—'}</DescriptionItem>
                  <DescriptionItem label="Phone">{selectedTenant.metadata?.phone || '—'}</DescriptionItem>
                  <DescriptionItem label="Signup Source">{selectedTenant.metadata?.signupSource || '—'}</DescriptionItem>
                </Descriptions>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Members</CardTitle>
                </CardHeader>
                <CardContent>
                  {Array.isArray(selectedTenant.memberships) && selectedTenant.memberships.length > 0 ? (
                    <div className="space-y-3">
                      {selectedTenant.memberships.map((membership) => (
                        <div key={membership.id || membership.user?.id} className="flex justify-between items-start gap-2 py-2 border-b border-border last:border-0">
                          <div>
                            <p className="font-medium text-foreground">{membership.user?.name || membership.user?.email}</p>
                            <p className="text-sm text-muted-foreground">{membership.user?.email}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Last login: {membership.user?.lastLogin ? dayjs(membership.user.lastLogin).fromNow() : 'Never'}
                            </p>
                          </div>
                          <Badge variant="outline">{membership.role}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty description="No members found" />
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Empty description="Select a tenant to view details" className="py-12" />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default AdminTenants;
