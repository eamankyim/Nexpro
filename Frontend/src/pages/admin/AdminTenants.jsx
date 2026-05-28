import { useEffect, useState, useMemo, useCallback } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useNavigate } from 'react-router-dom';
import { Loader2, Building2, CreditCard, Zap, Crown, Eye, EyeOff, UserPlus, Trash2, Copy, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Textarea } from '@/components/ui/textarea';
import { useDebounce } from '../../hooks/useDebounce';
import { useResponsive } from '../../hooks/useResponsive';
import adminService from '../../services/adminService';
import { ENTERPRISE_TIER_OPTIONS } from '../../constants/enterpriseTiers';
import StatusChip from '../../components/StatusChip';
import { useSmartSearch } from '../../context/SmartSearchContext';
import { usePlatformAdminPermissions } from '../../context/PlatformAdminPermissionsContext';
import { SEARCH_PLACEHOLDERS, DEBOUNCE_DELAYS } from '../../constants';
import { formatInteger } from '../../utils/formatNumber';
import { formatStorageAmount, formatStoragePercentage } from '../../utils/storageFormat';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

dayjs.extend(relativeTime);

const PLAN_ALIASES = {
  free: 'trial',
  standard: 'starter',
  pro: 'professional',
  launch: 'starter',
  scale: 'professional',
};
const CANONICAL_PLAN_ORDER = ['trial', 'starter', 'professional', 'enterprise'];

const normalizePlanId = (plan = '') => PLAN_ALIASES[String(plan).trim().toLowerCase()] || String(plan).trim().toLowerCase();
const formatPlanLabel = (name = '') =>
  String(name || '')
    .replace(/\b(monthly|month|annually|annual|yearly|year)\b/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

const getPlanVariant = (plan) => {
  const normalizedPlan = normalizePlanId(plan);
  switch (normalizedPlan) {
    case 'professional':
      return 'default';
    case 'starter':
      return 'secondary';
    case 'trial':
      return 'outline';
    default:
      return 'outline';
  }
};

const AdminTenants = () => {
  const navigate = useNavigate();
  const { startSupportAccess } = useAuth();
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
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteEmailError, setInviteEmailError] = useState('');
  const [tenantInvites, setTenantInvites] = useState([]);
  const [inviteListVisible, setInviteListVisible] = useState(false);
  const [inviteListLoading, setInviteListLoading] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState(null);
  const [planCatalog, setPlanCatalog] = useState([]);
  const [featureCatalog, setFeatureCatalog] = useState([]);
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessAuditLoading, setAccessAuditLoading] = useState(false);
  const [accessAuditLogs, setAccessAuditLogs] = useState([]);
  const [accessForm, setAccessForm] = useState({
    plan: '',
    accessState: 'active',
    note: '',
    featureOverrides: {},
    enterpriseTier: 'business',
  });
  const [tenantDetailTab, setTenantDetailTab] = useState('overview');
  const [supportAccessOpen, setSupportAccessOpen] = useState(false);
  const [supportReason, setSupportReason] = useState('');
  const [supportStarting, setSupportStarting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState('');
  const [deletingTenant, setDeletingTenant] = useState(false);
  const [subscriptionPayments, setSubscriptionPayments] = useState([]);
  const [tenantBillingStatus, setTenantBillingStatus] = useState(null);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [manualPaymentSaving, setManualPaymentSaving] = useState(false);
  const [manualPaymentForm, setManualPaymentForm] = useState({
    plan: 'starter',
    billingPeriod: 'monthly',
    enterpriseTier: 'business',
    notes: '',
  });

  const canDeleteTenants = hasPermission('tenants.delete');

  const canonicalPlanCatalog = useMemo(() => {
    const fallbackLabels = {
      trial: 'Trial',
      starter: 'Starter',
      professional: 'Professional',
      enterprise: 'Enterprise',
    };
    const byCanonicalId = planCatalog.reduce((acc, plan) => {
      const planId = normalizePlanId(plan?.planId);
      if (!CANONICAL_PLAN_ORDER.includes(planId)) return acc;
      const existing = acc[planId];
      if (!existing || (plan?.isActive && !existing?.isActive)) {
        acc[planId] = {
          ...plan,
          planId,
          name: formatPlanLabel(plan?.name) || fallbackLabels[planId] || planId,
        };
      }
      return acc;
    }, {});
    // Always expose all canonical tiers: DB may omit trial (internal/default) while others exist.
    return CANONICAL_PLAN_ORDER.map((id) => {
      if (byCanonicalId[id]) return byCanonicalId[id];
      return {
        planId: id,
        name: fallbackLabels[id] || id,
        isActive: true,
      };
    });
  }, [planCatalog]);

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

  const handleDeleteTenant = async () => {
    if (!selectedTenant?.id) return;
    const slug = String(deleteConfirmSlug || '').trim();
    if (slug !== selectedTenant.slug) {
      showError('Type the tenant slug exactly to confirm deletion.');
      return;
    }

    setDeletingTenant(true);
    try {
      await adminService.deleteTenant(selectedTenant.id, slug);
      showSuccess(`Tenant "${selectedTenant.name}" was permanently deleted.`);
      setDeleteDialogOpen(false);
      setDeleteConfirmSlug('');
      setDrawerVisible(false);
      setSelectedTenant(null);
      await fetchTenants(pagination.current, pagination.pageSize);
    } catch (error) {
      handleApiError(error, { context: 'delete tenant' });
    } finally {
      setDeletingTenant(false);
    }
  };

  const fetchTenantDetail = useCallback(async (tenantId) => {
    setDetailLoading(true);
    try {
      const response = await adminService.getTenantDetail(tenantId);
      if (response?.success) {
        const tenantData = response.data;
        setSelectedTenant(tenantData);
        const normalizedPlan = normalizePlanId(tenantData.plan || '');
        const planForForm = CANONICAL_PLAN_ORDER.includes(normalizedPlan)
          ? normalizedPlan
          : tenantData.plan || '';
        setAccessForm({
          plan: planForForm,
          accessState: tenantData.accessControl?.accessState || 'active',
          note: tenantData.accessControl?.note || '',
          featureOverrides: tenantData.accessControl?.featureOverrides || {},
          enterpriseTier: tenantData.metadata?.entitlements?.enterpriseTier || 'business',
        });
        setDrawerVisible(true);
      }
    } catch (error) {
      handleApiError(error, { context: 'fetch tenant detail' });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const fetchTenantSubscriptionPayments = useCallback(async (tenantId) => {
    if (!tenantId) return;
    setPaymentsLoading(true);
    try {
      const response = await adminService.getTenantSubscriptionPayments(tenantId);
      if (response?.success) {
        setSubscriptionPayments(response.data?.payments || []);
        setTenantBillingStatus(response.data?.billing || null);
      }
    } catch (error) {
      handleApiError(error, { context: 'fetch subscription payments' });
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  const fetchTenantAccessAudit = useCallback(async (tenantId) => {
    setAccessAuditLoading(true);
    try {
      const response = await adminService.getTenantAccessAudit(tenantId);
      if (response?.success) {
        setAccessAuditLogs(Array.isArray(response.data) ? response.data : []);
      } else {
        setAccessAuditLogs([]);
      }
    } catch (error) {
      setAccessAuditLogs([]);
      handleApiError(error, { context: 'load access audit' });
    } finally {
      setAccessAuditLoading(false);
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
            const normalized = normalizePlanId(plan);
            acc[normalized] = (acc[normalized] || 0) + count;
            return acc;
          }, {});
          setPlanStats({
            total: res.data.total ?? 0,
            trial: byPlan.trial ?? 0,
            starter: byPlan.starter ?? 0,
            professional: byPlan.professional ?? 0,
          enterprise: byPlan.enterprise ?? 0,
          });
        }
      } catch {
        setPlanStats(null);
      }
    };
    loadMetrics();
  }, []);

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const [plansRes, featuresRes] = await Promise.all([
          adminService.getSubscriptionPlans(),
          adminService.getFeatureCatalog(),
        ]);
        const plans = Array.isArray(plansRes?.data) ? plansRes.data : (Array.isArray(plansRes) ? plansRes : []);
        const featurePayload = featuresRes?.data;
        const features = Array.isArray(featurePayload?.features)
          ? featurePayload.features
          : Array.isArray(featurePayload)
            ? featurePayload
            : Array.isArray(featuresRes)
              ? featuresRes
              : [];
        setPlanCatalog(plans);
        setFeatureCatalog(features);
      } catch (error) {
        showError('Could not load access catalog');
      }
    };
    loadCatalog();
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
    setTenantDetailTab('overview');
    setDrawerVisible(true);
    fetchTenantDetail(record.id);
    fetchTenantAccessAudit(record.id);
    fetchTenantSubscriptionPayments(record.id);
  }, [fetchTenantDetail, fetchTenantAccessAudit, fetchTenantSubscriptionPayments]);

  const handleRecordManualPayment = async () => {
    if (!selectedTenant?.id) return;
    setManualPaymentSaving(true);
    try {
      const normalizedPlan = normalizePlanId(manualPaymentForm.plan);
      await adminService.createTenantSubscriptionPayment(selectedTenant.id, {
        ...manualPaymentForm,
        enterpriseTier: normalizedPlan === 'enterprise' ? manualPaymentForm.enterpriseTier : null,
      });
      showSuccess('Subscription payment recorded');
      await fetchTenantSubscriptionPayments(selectedTenant.id);
      await fetchTenantDetail(selectedTenant.id);
      await fetchTenants(pagination.current, pagination.pageSize);
    } catch (error) {
      handleApiError(error, { context: 'record manual subscription payment' });
    } finally {
      setManualPaymentSaving(false);
    }
  };

  const handleInviteTenant = async (e) => {
    e?.preventDefault?.();
    const email = inviteEmail?.trim();
    setInviteEmailError('');
    if (!email) {
      setInviteEmailError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteEmailError('Enter a valid email address');
      return;
    }
    setInviteSubmitting(true);
    try {
      const res = await adminService.inviteTenant({ email, name: inviteName?.trim() || undefined });
      const data = res?.data ?? res;
      showSuccess(data?.inviteUrl ? 'Invite sent. They can sign up using the link.' : 'Invite sent.');
      setInviteModalOpen(false);
      setInviteEmail('');
      setInviteName('');
      setInviteEmailError('');
      fetchTenants(pagination.current, pagination.pageSize);
      fetchTenantInvites();
    } catch (err) {
      handleApiError(err, { context: 'invite tenant' });
    } finally {
      setInviteSubmitting(false);
    }
  };

  const fetchTenantInvites = useCallback(async () => {
    if (!hasPermission('tenants.create')) return;
    setInviteListLoading(true);
    try {
      const response = await adminService.getTenantInvites();
      if (response?.success) {
        setTenantInvites(Array.isArray(response.data) ? response.data : []);
      } else {
        setTenantInvites([]);
      }
    } catch (error) {
      setTenantInvites([]);
      handleApiError(error, { context: 'load tenant invites' });
    } finally {
      setInviteListLoading(false);
    }
  }, [hasPermission]);

  const handleToggleInvites = async () => {
    const nextVisible = !inviteListVisible;
    setInviteListVisible(nextVisible);
    if (nextVisible && tenantInvites.length === 0) {
      await fetchTenantInvites();
    }
  };

  const handleRevokeInvite = async (inviteId) => {
    setRevokingInviteId(inviteId);
    try {
      await adminService.revokeTenantInvite(inviteId);
      showSuccess('Invite revoked');
      setTenantInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
    } catch (error) {
      handleApiError(error, { context: 'revoke tenant invite' });
    } finally {
      setRevokingInviteId(null);
    }
  };

  const getTenantInviteLink = useCallback((invite) => {
    if (!invite) return '';
    if (invite.inviteUrl) return invite.inviteUrl;
    if (!invite.token) return '';
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/signup?token=${invite.token}`;
  }, []);

  const handleCopyTenantInviteLink = useCallback((invite) => {
    const link = getTenantInviteLink(invite);
    if (!link) {
      showError(null, 'Invite link is unavailable for this invite');
      return;
    }
    navigator.clipboard.writeText(link);
    showSuccess('Invite link copied');
  }, [getTenantInviteLink]);

  const handleSaveAccess = async () => {
    if (!selectedTenant?.id) return;
    setAccessSaving(true);
    try {
      const payload = {
        plan: accessForm.plan,
        accessState: accessForm.accessState,
        featureOverrides: accessForm.featureOverrides || {},
        note: accessForm.note || '',
        enterpriseTier:
          normalizePlanId(accessForm.plan) === 'enterprise' ? accessForm.enterpriseTier : null,
      };
      await adminService.updateTenantAccess(selectedTenant.id, payload);
      showSuccess('Tenant access updated');
      await fetchTenantDetail(selectedTenant.id);
      await fetchTenantAccessAudit(selectedTenant.id);
      await fetchTenants(pagination.current, pagination.pageSize);
    } catch (error) {
      handleApiError(error, { context: 'update tenant access' });
    } finally {
      setAccessSaving(false);
    }
  };

  const handleEnterSupportAccess = async () => {
    if (!selectedTenant?.id || !supportReason.trim()) {
      showError(null, 'Please enter a reason for support access');
      return;
    }
    setSupportStarting(true);
    try {
      await startSupportAccess(selectedTenant.id, { reason: supportReason.trim() });
      showSuccess('Support access started (read-only)');
      setSupportAccessOpen(false);
      setSupportReason('');
      setDrawerVisible(false);
      navigate('/dashboard');
    } catch (error) {
      handleApiError(error, { context: 'start support access' });
    } finally {
      setSupportStarting(false);
    }
  };

  const handleOverrideToggle = (featureKey, nextValue) => {
    setAccessForm((prev) => {
      const featureOverrides = { ...(prev.featureOverrides || {}) };
      if (nextValue === null) {
        delete featureOverrides[featureKey];
      } else {
        featureOverrides[featureKey] = nextValue;
      }
      return { ...prev, featureOverrides };
    });
  };

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
    { key: 'status', label: 'Status', mobileDashboardPlacement: 'headerEnd', render: (_, record) => <StatusChip status={record.status} /> },
    { key: 'primaryUserEmail', label: 'User email', render: (_, record) => (
      <span className="text-muted-foreground text-sm">{record.primaryUserEmail || '—'}</span>
    )},
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
        key: 'starter',
        label: 'Starter',
        value: planStats?.starter ?? '—',
        icon: CreditCard,
        iconBg: 'rgba(59, 130, 246, 0.15)',
        iconColor: '#2563eb',
      },
      {
        key: 'professional',
        label: 'Professional',
        value: planStats?.professional ?? '—',
        icon: Crown,
        iconBg: 'rgba(147, 51, 234, 0.15)',
        iconColor: '#7c3aed',
      },
      {
        key: 'enterprise',
        label: 'Enterprise',
        value: planStats?.enterprise ?? '—',
        icon: Building2,
        iconBg: 'rgba(236, 72, 153, 0.15)',
        iconColor: '#db2777',
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
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            {hasPermission('tenants.create') && (
              <>
                <Button variant="outline" onClick={handleToggleInvites}>
                  {inviteListVisible ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                  {inviteListVisible ? 'Hide invites' : 'Show invites'}
                </Button>
                <Button onClick={() => setInviteModalOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite tenant
                </Button>
              </>
            )}
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
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
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
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
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
                      {typeof value === 'number' ? formatInteger(value) : value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {inviteListVisible && hasPermission('tenants.create') && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Pending invites ({tenantInvites.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {inviteListLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : tenantInvites.length > 0 ? (
                <div className="space-y-3">
                  {tenantInvites.map((invite) => (
                    <div key={invite.id} className="flex items-start justify-between gap-3 border border-border rounded-md p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground break-all">{invite.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Name: {invite.name || '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Sent {invite.createdAt ? dayjs(invite.createdAt).fromNow() : '—'} by {invite.creator?.name || invite.creator?.email || 'System'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Expires {invite.expiresAt ? dayjs(invite.expiresAt).format('MMM D, YYYY h:mm A') : '—'}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <Input
                            readOnly
                            value={getTenantInviteLink(invite)}
                            className="h-8 font-mono text-xs"
                            placeholder="Invite link unavailable"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleCopyTenantInviteLink(invite)}
                            title="Copy invite link"
                            disabled={!getTenantInviteLink(invite)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRevokeInvite(invite.id)}
                        loading={revokingInviteId === invite.id}
                        disabled={revokingInviteId === invite.id}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Revoke
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty description="No pending tenant invites" />
              )}
            </CardContent>
          </Card>
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

      <Dialog
        open={supportAccessOpen}
        onOpenChange={(open) => {
          setSupportAccessOpen(open);
          if (!open) setSupportReason('');
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Start support access</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You will view <strong>{selectedTenant?.name}</strong> in read-only mode. All actions are audited.
          </p>
          <div className="space-y-2">
            <Label htmlFor="support-reason">Reason (required)</Label>
            <Textarea
              id="support-reason"
              rows={3}
              placeholder="e.g. Ticket #12 — POS barcode scan not working"
              value={supportReason}
              onChange={(e) => setSupportReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSupportAccessOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleEnterSupportAccess}
              disabled={supportStarting || !supportReason.trim()}
            >
              {supportStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enter workspace'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteModalOpen} onOpenChange={(open) => { setInviteModalOpen(open); if (!open) { setInviteEmail(''); setInviteName(''); setInviteEmailError(''); } }}>
        <DialogContent className="sm:max-w-[425px] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0 space-y-1">
            <DialogTitle>Invite tenant</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Send an invite link so they can create their workspace.
            </p>
          </DialogHeader>
          <form onSubmit={handleInviteTenant} noValidate className="px-6 pt-4 pb-0">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="e.g. owner@business.com"
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteEmailError(''); }}
                  aria-required="true"
                  aria-invalid={!!inviteEmailError}
                  aria-describedby={inviteEmailError ? 'invite-email-error' : undefined}
                  className={`h-9 ${inviteEmailError ? 'border-destructive' : ''}`}
                />
                {inviteEmailError && (
                  <p id="invite-email-error" className="text-sm text-destructive">
                    {inviteEmailError}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-name">Full name (optional)</Label>
                <Input
                  id="invite-name"
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <DialogFooter className="mt-4 -mx-6 px-6 py-4 border-t">
              <Button type="button" variant="outline" onClick={() => setInviteModalOpen(false)} disabled={inviteSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviteSubmitting} loading={inviteSubmitting}>
                Send invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={drawerVisible} onOpenChange={(open) => { setDrawerVisible(open); if (!open) setSelectedTenant(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-[520px] overflow-y-auto flex flex-col">
          <SheetHeader>
            <SheetTitle>Tenant details</SheetTitle>
          </SheetHeader>
          {detailLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : selectedTenant ? (
            <Tabs value={tenantDetailTab} onValueChange={setTenantDetailTab} className="mt-4 flex flex-col flex-1 min-h-0">
              <TabsList className="grid w-full grid-cols-3 shrink-0">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="access">Access control</TabsTrigger>
                <TabsTrigger value="billing">Billing</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-4 space-y-6 data-[state=inactive]:hidden">
              {hasPermission('tenants.support_access') && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Support access</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Open this tenant&apos;s workspace in read-only mode to troubleshoot without their password.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setSupportAccessOpen(true)}
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Enter workspace (read-only)
                    </Button>
                  </CardContent>
                </Card>
              )}

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
                  {canDeleteTenants && selectedTenant.slug !== 'platform' && (
                    <Button
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setDeleteConfirmSlug('');
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  )}
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
                <h4 className="font-semibold text-foreground mb-2">Usage &amp; limits</h4>
                <Descriptions column={1}>
                  <DescriptionItem label="Team seats">
                    {selectedTenant.seatUsage ? (
                      <span>
                        {selectedTenant.seatUsage.current}
                        {selectedTenant.seatUsage.isUnlimited
                          ? ' / unlimited'
                          : ` / ${selectedTenant.seatUsage.limit}`}
                        {selectedTenant.seatUsage.isAtLimit && (
                          <Badge variant="destructive" className="ml-2">At limit</Badge>
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                  </DescriptionItem>
                  <DescriptionItem label="Storage">
                    {selectedTenant.storageUsage ? (
                      <span>
                        {selectedTenant.storageUsage.isUnlimited
                          ? `${formatStorageAmount({ mb: selectedTenant.storageUsage.currentMB, gb: selectedTenant.storageUsage.currentGB })} (unlimited plan)`
                          : `${formatStorageAmount({ mb: selectedTenant.storageUsage.currentMB, gb: selectedTenant.storageUsage.currentGB })} / ${selectedTenant.storageUsage.limitGB} GB (${formatStoragePercentage(selectedTenant.storageUsage.percentageUsed, selectedTenant.storageUsage.currentMB)} used)`}
                        {selectedTenant.storageUsage.isAtLimit && (
                          <Badge variant="destructive" className="ml-2">At limit</Badge>
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                  </DescriptionItem>
                  {normalizePlanId(selectedTenant.plan) === 'enterprise' && (
                    <DescriptionItem label="Enterprise tier">
                      {selectedTenant.metadata?.entitlements?.enterpriseTier || '—'}
                    </DescriptionItem>
                  )}
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
                  <CardTitle className="text-base">Access audit trail</CardTitle>
                </CardHeader>
                <CardContent>
                  {accessAuditLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : accessAuditLogs.length > 0 ? (
                    <div className="space-y-3">
                      {accessAuditLogs.map((entry) => (
                        <div key={entry.id} className="rounded-md border border-border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {entry.actor?.name || entry.actor?.email || 'System'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {entry.createdAt ? dayjs(entry.createdAt).format('MMM D, YYYY h:mm A') : '—'}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {entry.action || 'tenant_access_updated'}
                          </p>
                          <div className="mt-2 text-xs text-muted-foreground">
                            Plan: <span className="text-foreground">{entry.before?.plan || '—'}</span>{' -> '}
                            <span className="text-foreground">{entry.after?.plan || '—'}</span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Access: <span className="text-foreground">{entry.before?.accessState || '—'}</span>{' -> '}
                            <span className="text-foreground">{entry.after?.accessState || '—'}</span>
                          </div>
                          {entry.reason ? (
                            <p className="mt-2 text-xs text-muted-foreground">Reason: {entry.reason}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty description="No access changes recorded yet" />
                  )}
                </CardContent>
              </Card>
              </TabsContent>

              <TabsContent value="members" className="mt-4 data-[state=inactive]:hidden">
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
              </TabsContent>

              <TabsContent value="billing" className="mt-4 space-y-4 data-[state=inactive]:hidden">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Billing status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {paymentsLoading ? (
                      <Skeleton className="h-8 w-full" />
                    ) : (
                      <>
                        <p>
                          Status:{' '}
                          <Badge variant="outline">
                            {tenantBillingStatus?.billingStatus || 'unknown'}
                          </Badge>
                        </p>
                        {tenantBillingStatus?.graceEndsAt && (
                          <p className="text-muted-foreground">
                            Grace ends {dayjs(tenantBillingStatus.graceEndsAt).format('MMM D, YYYY')}
                          </p>
                        )}
                        {tenantBillingStatus?.trialEndsAt && (
                          <p className="text-muted-foreground">
                            Trial ends {dayjs(tenantBillingStatus.trialEndsAt).format('MMM D, YYYY')}
                          </p>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                {hasPermission('billing.manage') && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Record manual payment</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Plan</Label>
                          <Select
                            value={manualPaymentForm.plan}
                            onValueChange={(value) =>
                              setManualPaymentForm((prev) => ({
                                ...prev,
                                plan: value,
                                enterpriseTier: normalizePlanId(value) === 'enterprise'
                                  ? prev.enterpriseTier || 'business'
                                  : prev.enterpriseTier,
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="starter">Starter</SelectItem>
                              <SelectItem value="professional">Professional</SelectItem>
                              <SelectItem value="enterprise">Enterprise</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Billing period</Label>
                          <Select
                            value={manualPaymentForm.billingPeriod}
                            onValueChange={(value) =>
                              setManualPaymentForm((prev) => ({ ...prev, billingPeriod: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="yearly">Yearly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {normalizePlanId(manualPaymentForm.plan) === 'enterprise' && (
                        <div className="space-y-1.5">
                          <Label>Enterprise tier</Label>
                          <Select
                            value={manualPaymentForm.enterpriseTier || 'business'}
                            onValueChange={(value) =>
                              setManualPaymentForm((prev) => ({ ...prev, enterpriseTier: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select enterprise tier" />
                            </SelectTrigger>
                            <SelectContent>
                              {ENTERPRISE_TIER_OPTIONS.map((tier) => (
                                <SelectItem key={tier.id} value={tier.id}>
                                  {tier.name} ({tier.seatLimit} users, {tier.storageLimitGB} GB)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            This also sets the tenant&apos;s Enterprise limits after payment is recorded.
                          </p>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label htmlFor="manual-payment-notes">Notes (optional)</Label>
                        <Input
                          id="manual-payment-notes"
                          value={manualPaymentForm.notes}
                          onChange={(e) =>
                            setManualPaymentForm((prev) => ({ ...prev, notes: e.target.value }))
                          }
                          placeholder="Bank transfer reference, invoice #, etc."
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={handleRecordManualPayment} loading={manualPaymentSaving}>
                          Record payment
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Payment ledger</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {paymentsLoading ? (
                      <Skeleton className="h-24 w-full" />
                    ) : subscriptionPayments.length === 0 ? (
                      <Empty description="No subscription payments recorded" />
                    ) : (
                      <div className="space-y-2">
                        {subscriptionPayments.map((payment) => (
                          <div key={payment.id} className="border rounded-md p-3 text-sm">
                            <div className="flex justify-between gap-2 flex-wrap">
                              <span className="font-medium capitalize">
                                {payment.plan} · {payment.billingPeriod}
                              </span>
                              <span>
                                ₵{(Number(payment.amount) / 100).toFixed(2)} · {payment.provider}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {dayjs(payment.periodStart).format('MMM D, YYYY')} –{' '}
                              {dayjs(payment.periodEnd).format('MMM D, YYYY')}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="access" className="mt-4 space-y-4 data-[state=inactive]:hidden">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Plan &amp; access control</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Assigned plan</Label>
                      <Select
                        value={accessForm.plan || ''}
                        onValueChange={(value) => setAccessForm((prev) => ({ ...prev, plan: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select plan" />
                        </SelectTrigger>
                        <SelectContent>
                          {canonicalPlanCatalog.map((plan) => (
                            <SelectItem key={plan.id || plan.planId} value={plan.planId}>
                              {plan.name} ({plan.planId})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {normalizePlanId(accessForm.plan) === 'enterprise' && (
                      <div className="space-y-1.5">
                        <Label>Enterprise tier</Label>
                        <Select
                          value={accessForm.enterpriseTier || 'business'}
                          onValueChange={(value) =>
                            setAccessForm((prev) => ({ ...prev, enterpriseTier: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select enterprise tier" />
                          </SelectTrigger>
                          <SelectContent>
                            {ENTERPRISE_TIER_OPTIONS.map((tier) => (
                              <SelectItem key={tier.id} value={tier.id}>
                                {tier.name} ({tier.seatLimit} users, {tier.storageLimitGB} GB)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Sets seat and storage limits per ABS Enterprise Terms for this workspace.
                        </p>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label>Access mode</Label>
                      <Select
                        value={accessForm.accessState}
                        onValueChange={(value) => setAccessForm((prev) => ({ ...prev, accessState: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select access mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active (normal)</SelectItem>
                          <SelectItem value="read_only">Read only</SelectItem>
                          <SelectItem value="restricted">Restricted</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Feature overrides (optional)</Label>
                      <p className="text-xs text-muted-foreground">
                        Force-enable or force-disable features for this tenant. Leave unchanged to follow the plan.
                      </p>
                      <div className="space-y-2 max-h-56 overflow-y-auto border rounded-md p-3">
                        {featureCatalog.map((feature) => {
                          const current = accessForm.featureOverrides?.[feature.key];
                          return (
                            <div key={feature.key} className="flex items-start justify-between gap-3 border-b border-border last:border-0 pb-2 last:pb-0">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground">{feature.name}</p>
                                <p className="text-xs text-muted-foreground break-all">{feature.key}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={current === true ? 'default' : 'outline'}
                                  onClick={() => handleOverrideToggle(feature.key, current === true ? null : true)}
                                >
                                  Allow
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={current === false ? 'destructive' : 'outline'}
                                  onClick={() => handleOverrideToggle(feature.key, current === false ? null : false)}
                                >
                                  Deny
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="tenant-access-note">Admin note (optional)</Label>
                      <Input
                        id="tenant-access-note"
                        value={accessForm.note}
                        onChange={(e) => setAccessForm((prev) => ({ ...prev, note: e.target.value }))}
                        placeholder="Reason for this access profile"
                      />
                    </div>

                    <div className="flex items-center justify-end">
                      <Button onClick={handleSaveAccess} loading={accessSaving} disabled={!hasPermission('tenants.update')}>
                        Save access
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Empty description="Select a tenant to view details" className="py-12" />
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tenant permanently?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  This will delete <strong className="text-foreground">{selectedTenant?.name}</strong> and
                  all workspace data. User accounts that belong only to this tenant will also be removed.
                </p>
                <p>
                  Type <strong className="text-foreground">{selectedTenant?.slug}</strong> below to confirm.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="delete-tenant-slug">Tenant slug</Label>
            <Input
              id="delete-tenant-slug"
              value={deleteConfirmSlug}
              onChange={(e) => setDeleteConfirmSlug(e.target.value)}
              placeholder={selectedTenant?.slug || 'tenant-slug'}
              className="mt-1.5"
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingTenant}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteTenant();
              }}
              disabled={
                deletingTenant ||
                deleteConfirmSlug.trim() !== (selectedTenant?.slug || '')
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingTenant ? 'Deleting…' : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AdminTenants;
