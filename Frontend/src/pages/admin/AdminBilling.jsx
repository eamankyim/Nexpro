import { useEffect, useState, lazy, Suspense, useCallback } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useResponsive } from '../../hooks/useResponsive';
import adminService from '../../services/adminService';
import { usePlatformAdminPermissions } from '../../context/PlatformAdminPermissionsContext';
import { ENTERPRISE_TIER_OPTIONS, getEnterpriseTier } from '../../constants/enterpriseTiers';
import { handleApiError, showSuccess } from '../../utils/toast';
import StatusChip from '../../components/StatusChip';
import DashboardStatsCard from '../../components/DashboardStatsCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Currency, Users, CreditCard, Receipt } from 'lucide-react';

dayjs.extend(relativeTime);

const AdminBillingCharts = lazy(() => import('./AdminBillingCharts'));

const PLAN_ALIASES = {
  free: 'trial',
  standard: 'starter',
  pro: 'professional',
  launch: 'starter',
  scale: 'professional',
};

const normalizePlanId = (plan = '') => PLAN_ALIASES[String(plan).trim().toLowerCase()] || String(plan).trim().toLowerCase();

const getInitialPaymentForm = (tenant = null) => {
  const plan = normalizePlanId(tenant?.plan || 'enterprise');
  const enterpriseTier = tenant?.metadata?.entitlements?.enterpriseTier || 'business';
  const tier = getEnterpriseTier(enterpriseTier);
  return {
    plan: ['starter', 'professional', 'enterprise'].includes(plan) ? plan : 'enterprise',
    billingPeriod: plan === 'enterprise' ? 'yearly' : 'monthly',
    enterpriseTier,
    paymentType: 'enterprise_license',
    amount: plan === 'enterprise' && tier?.licenseFeeGhs ? String(tier.licenseFeeGhs) : '',
    paymentMethod: 'bank_transfer',
    providerReference: '',
    paymentDate: dayjs().format('YYYY-MM-DD'),
    status: 'success',
    notes: '',
  };
};

const getPaymentMethodLabel = (method) => {
  switch (method) {
    case 'bank_transfer':
      return 'Bank transfer';
    case 'mobile_money':
      return 'Mobile money';
    case 'card':
      return 'Card';
    case 'cash':
      return 'Cash';
    case 'cheque':
      return 'Cheque';
    default:
      return 'Other';
  }
};

const getPlanLabel = (plan) => {
  const normalized = normalizePlanId(plan);
  switch (normalized) {
    case 'trial':
      return 'Trial';
    case 'starter':
      return 'Starter';
    case 'professional':
      return 'Professional';
    case 'enterprise':
      return 'Enterprise';
    default:
      return normalized;
  }
};

const AdminBilling = () => {
  const { isMobile } = useResponsive();
  const { hasPermission, loading: permissionsLoading } = usePlatformAdminPermissions();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [paymentForm, setPaymentForm] = useState(getInitialPaymentForm());
  const [paymentSaving, setPaymentSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, tenantsRes] = await Promise.all([
        adminService.getBillingSummary(),
        adminService.getBillingTenants(),
      ]);
      if (summaryRes?.success) setSummary(summaryRes.data);
      if (tenantsRes?.success) setTenants(tenantsRes.data || []);
    } catch (error) {
      handleApiError(error, { context: 'load billing data' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openPaymentDialog = (tenant) => {
    setSelectedTenant(tenant);
    setPaymentForm(getInitialPaymentForm(tenant));
    setPaymentDialogOpen(true);
  };

  const handlePaymentFormChange = (key, value) => {
    setPaymentForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'plan') {
        next.billingPeriod = normalizePlanId(value) === 'enterprise' ? 'yearly' : prev.billingPeriod;
      }
      if (key === 'enterpriseTier' || key === 'paymentType' || key === 'plan') {
        const plan = key === 'plan' ? normalizePlanId(value) : normalizePlanId(next.plan);
        if (plan === 'enterprise') {
          const tier = getEnterpriseTier(key === 'enterpriseTier' ? value : next.enterpriseTier);
          next.amount = key === 'paymentType' && value === 'enterprise_cloud_renewal'
            ? String(tier?.cloudPlanAnnualGhs || '')
            : String(tier?.licenseFeeGhs || '');
        }
      }
      return next;
    });
  };

  const handleRecordPayment = async (event) => {
    event.preventDefault();
    if (!selectedTenant?.id) return;
    setPaymentSaving(true);
    try {
      const normalizedPlan = normalizePlanId(paymentForm.plan);
      await adminService.createTenantSubscriptionPayment(selectedTenant.id, {
        ...paymentForm,
        plan: normalizedPlan,
        enterpriseTier: normalizedPlan === 'enterprise' ? paymentForm.enterpriseTier : null,
        paymentType: normalizedPlan === 'enterprise' ? paymentForm.paymentType : null,
        amount: paymentForm.amount === '' ? undefined : paymentForm.amount,
        providerReference: paymentForm.providerReference.trim() || undefined,
        notes: paymentForm.notes.trim() || undefined,
      });
      showSuccess('Tenant billing payment recorded');
      setPaymentDialogOpen(false);
      setSelectedTenant(null);
      await loadData();
    } catch (error) {
      handleApiError(error, { context: 'record tenant billing payment' });
    } finally {
      setPaymentSaving(false);
    }
  };

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

      <Suspense
        fallback={
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Skeleton className="h-[280px] w-full rounded-lg border border-gray-200" />
            <Skeleton className="h-[280px] w-full rounded-lg border border-gray-200" />
          </div>
        }
      >
        <AdminBillingCharts summary={summary} getPlanLabel={getPlanLabel} />
      </Suspense>

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
                      <Badge variant={normalizePlanId(tenant.plan) === 'professional' ? 'default' : 'secondary'}>
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
                    {hasPermission('billing.manage') && (
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-3 w-full"
                        onClick={() => openPaymentDialog(tenant)}
                      >
                        <Receipt className="mr-2 h-4 w-4" />
                        Record payment
                      </Button>
                    )}
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
                      {hasPermission('billing.manage') && <TableHead className="text-right">Action</TableHead>}
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
                          <Badge variant={normalizePlanId(tenant.plan) === 'professional' ? 'default' : 'secondary'}>
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
                        {hasPermission('billing.manage') && (
                          <TableCell className="text-right">
                            <Button type="button" variant="outline" size="sm" onClick={() => openPaymentDialog(tenant)}>
                              Record payment
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-2xl [--modal-w:min(92vw,42rem)]">
          <form onSubmit={handleRecordPayment}>
            <DialogHeader>
              <DialogTitle>Record tenant billing payment</DialogTitle>
              <DialogDescription>
                Add a manual subscription payment for {selectedTenant?.name || 'this tenant'}.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Plan</Label>
                    <Select value={paymentForm.plan} onValueChange={(value) => handlePaymentFormChange('plan', value)}>
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
                      value={paymentForm.billingPeriod}
                      onValueChange={(value) => handlePaymentFormChange('billingPeriod', value)}
                      disabled={normalizePlanId(paymentForm.plan) === 'enterprise'}
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

                {normalizePlanId(paymentForm.plan) === 'enterprise' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Enterprise tier</Label>
                      <Select
                        value={paymentForm.enterpriseTier}
                        onValueChange={(value) => handlePaymentFormChange('enterpriseTier', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ENTERPRISE_TIER_OPTIONS.map((tier) => (
                            <SelectItem key={tier.id} value={tier.id}>
                              {tier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Enterprise payment type</Label>
                      <Select
                        value={paymentForm.paymentType}
                        onValueChange={(value) => handlePaymentFormChange('paymentType', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="enterprise_license">License fee</SelectItem>
                          <SelectItem value="enterprise_cloud_renewal">Cloud renewal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="tenant-payment-amount">Amount (GHS)</Label>
                    <Input
                      id="tenant-payment-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentForm.amount}
                      onChange={(event) => handlePaymentFormChange('amount', event.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Payment method</Label>
                    <Select
                      value={paymentForm.paymentMethod}
                      onValueChange={(value) => handlePaymentFormChange('paymentMethod', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['bank_transfer', 'mobile_money', 'card', 'cash', 'cheque', 'other'].map((method) => (
                          <SelectItem key={method} value={method}>
                            {getPaymentMethodLabel(method)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="tenant-payment-reference">Reference (optional)</Label>
                    <Input
                      id="tenant-payment-reference"
                      value={paymentForm.providerReference}
                      onChange={(event) => handlePaymentFormChange('providerReference', event.target.value)}
                      placeholder="Bank, MoMo, or invoice reference"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tenant-payment-date">Payment date</Label>
                    <Input
                      id="tenant-payment-date"
                      type="date"
                      value={paymentForm.paymentDate}
                      onChange={(event) => handlePaymentFormChange('paymentDate', event.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={paymentForm.status} onValueChange={(value) => handlePaymentFormChange('status', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Only successful payments activate or renew tenant billing.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tenant-payment-notes">Notes (optional)</Label>
                  <Textarea
                    id="tenant-payment-notes"
                    value={paymentForm.notes}
                    onChange={(event) => handlePaymentFormChange('notes', event.target.value)}
                    placeholder="Internal note for this payment"
                  />
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)} disabled={paymentSaving}>
                Cancel
              </Button>
              <Button type="submit" loading={paymentSaving}>
                Record payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBilling;
