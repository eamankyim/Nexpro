import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dayjs from 'dayjs';
import adminService from '../../services/adminService';
import { usePlatformAdminPermissions } from '../../context/PlatformAdminPermissionsContext';
import DashboardStatsCard from '../../components/DashboardStatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { showError, showSuccess } from '../../utils/toast';
import {
  AlertTriangle,
  CalendarClock,
  Eye,
  Plus,
  Server,
  Globe,
  Archive,
  RefreshCw,
  UserPlus,
} from 'lucide-react';

const ASSET_TYPES = [
  { value: 'domain', label: 'Domain' },
  { value: 'server', label: 'Server' },
  { value: 'service', label: 'Service' },
  { value: 'other', label: 'Other' },
];

const assetSchema = z.object({
  type: z.enum(['domain', 'server', 'service', 'other']),
  name: z.string().min(1, 'Name is required'),
  expiresOn: z.string().optional().or(z.literal('')),
  loginUrl: z.string().optional().or(z.literal('')),
  username: z.string().optional().or(z.literal('')),
  password: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  registrar: z.string().optional().or(z.literal('')),
  provider: z.string().optional().or(z.literal('')),
  hostOrIp: z.string().optional().or(z.literal('')),
  vendor: z.string().optional().or(z.literal('')),
  customerId: z.string().optional().or(z.literal('')),
});

const quickCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  company: z.string().optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
});

const typeBadgeClass = {
  domain: 'bg-blue-50 text-blue-900 border-blue-200',
  server: 'bg-violet-50 text-violet-900 border-violet-200',
  service: 'bg-amber-50 text-amber-900 border-amber-200',
  other: 'bg-muted text-foreground border-border',
};

/** Days ahead that count as “expired soon” (inclusive of today). */
const EXPIRED_SOON_DAYS = 30;

/**
 * Derive display status from expiry date.
 * @param {string|null|undefined} expiresOn
 * @returns {{ key: 'active' | 'expired_soon' | 'expired', label: string, className: string }}
 */
const getExpiryStatus = (expiresOn) => {
  if (!expiresOn) {
    return {
      key: 'active',
      label: 'Active',
      className: 'bg-green-50 text-green-800 border-green-200',
    };
  }
  const today = dayjs().startOf('day');
  const expiry = dayjs(expiresOn).startOf('day');
  if (expiry.isBefore(today)) {
    return {
      key: 'expired',
      label: 'Expired',
      className: 'bg-red-50 text-red-800 border-red-200',
    };
  }
  if (expiry.diff(today, 'day') <= EXPIRED_SOON_DAYS) {
    return {
      key: 'expired_soon',
      label: 'Expired soon',
      className: 'bg-orange-50 text-orange-800 border-orange-200',
    };
  }
  return {
    key: 'active',
    label: 'Active',
    className: 'bg-green-50 text-green-800 border-green-200',
  };
};

/**
 * @param {{ company?: string|null, name?: string|null }} customer
 * @returns {string}
 */
const formatCustomerLabel = (customer) => {
  if (!customer) return '';
  const company = String(customer.company || '').trim();
  const name = String(customer.name || '').trim();
  if (company && name && company !== name) return `${company} (${name})`;
  return company || name || 'Customer';
};

const AdminOpsAssets = () => {
  const { hasPermission, loading: permissionsLoading } = usePlatformAdminPermissions();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [assets, setAssets] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealAsset, setRevealAsset] = useState(null);
  const [revealCode, setRevealCode] = useState('');
  const [revealSecret, setRevealSecret] = useState(null);
  const [revealBusy, setRevealBusy] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [emailedTo, setEmailedTo] = useState('');
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerSaving, setCustomerSaving] = useState(false);

  const form = useForm({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      type: 'domain',
      name: '',
      expiresOn: '',
      loginUrl: '',
      username: '',
      password: '',
      notes: '',
      registrar: '',
      provider: '',
      hostOrIp: '',
      vendor: '',
      customerId: '',
    },
  });

  const customerForm = useForm({
    resolver: zodResolver(quickCustomerSchema),
    defaultValues: {
      name: '',
      company: '',
      email: '',
      phone: '',
    },
  });

  const watchType = form.watch('type');

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => window.clearTimeout(t);
  }, [search]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (typeFilter !== 'all') params.type = typeFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (expiryFilter !== 'all') params.expiryWindow = expiryFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const [statsRes, assetsRes, customersRes] = await Promise.all([
        adminService.getOpsStats(),
        adminService.getOpsAssets(params),
        adminService.getOpsCustomers(),
      ]);
      if (statsRes?.success) setStats(statsRes.data);
      if (assetsRes?.success) setAssets(assetsRes.data || []);
      if (customersRes?.success) setCustomers(customersRes.data || []);
    } catch (error) {
      console.error('Failed to load IT Ops assets', error);
      showError(null, 'Failed to load IT Ops assets');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, expiryFilter, debouncedSearch]);

  useEffect(() => {
    if (!permissionsLoading && hasPermission('ops.view')) {
      loadData();
    }
  }, [permissionsLoading, hasPermission, loadData]);

  const openCreate = () => {
    setEditing(null);
    form.reset({
      type: 'domain',
      name: '',
      expiresOn: '',
      loginUrl: '',
      username: '',
      password: '',
      notes: '',
      registrar: '',
      provider: '',
      hostOrIp: '',
      vendor: '',
      customerId: '',
    });
    setEditorOpen(true);
  };

  const openEdit = (asset) => {
    setEditing(asset);
    form.reset({
      type: asset.type || 'other',
      name: asset.name || '',
      expiresOn: asset.expiresOn || '',
      loginUrl: asset.loginUrl || '',
      username: asset.username || '',
      password: '',
      notes: asset.notes || '',
      registrar: asset.details?.registrar || '',
      provider: asset.details?.provider || '',
      hostOrIp: asset.details?.hostOrIp || '',
      vendor: asset.details?.vendor || '',
      customerId: asset.customerId || asset.customer?.id || '',
    });
    setEditorOpen(true);
  };

  const onSubmit = async (values) => {
    setSaving(true);
    try {
      const payload = {
        type: values.type,
        name: values.name,
        expiresOn: values.expiresOn || null,
        loginUrl: values.loginUrl || null,
        username: values.username || null,
        notes: values.notes || null,
        registrar: values.registrar || undefined,
        provider: values.provider || undefined,
        hostOrIp: values.hostOrIp || undefined,
        vendor: values.vendor || undefined,
        customerId: values.customerId || null,
      };
      if (values.password) payload.password = values.password;
      if (editing) {
        await adminService.updateOpsAsset(editing.id, payload);
        showSuccess('Asset updated');
      } else {
        await adminService.createOpsAsset(payload);
        showSuccess('Asset created');
      }
      setEditorOpen(false);
      await loadData();
    } catch (error) {
      showError(error?.response?.data?.message || null, 'Failed to save asset');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (asset) => {
    if (!window.confirm(`Archive “${asset.name}”?`)) return;
    try {
      await adminService.archiveOpsAsset(asset.id);
      showSuccess('Asset archived');
      await loadData();
    } catch (error) {
      showError(null, 'Failed to archive asset');
    }
  };

  const openCreateCustomer = () => {
    customerForm.reset({ name: '', company: '', email: '', phone: '' });
    setCustomerModalOpen(true);
  };

  const onCreateCustomer = async (values) => {
    setCustomerSaving(true);
    try {
      const res = await adminService.createOpsCustomer({
        name: values.name,
        company: values.company || undefined,
        email: values.email || undefined,
        phone: values.phone || undefined,
      });
      if (res?.success && res.data?.id) {
        const created = res.data;
        setCustomers((prev) => {
          const next = [...prev.filter((c) => c.id !== created.id), created];
          next.sort((a, b) =>
            formatCustomerLabel(a).localeCompare(formatCustomerLabel(b), undefined, { sensitivity: 'base' })
          );
          return next;
        });
        form.setValue('customerId', created.id);
        setCustomerModalOpen(false);
        showSuccess('Customer created and linked');
      }
    } catch (error) {
      showError(error?.response?.data?.message || null, 'Failed to create customer');
    } finally {
      setCustomerSaving(false);
    }
  };

  const openReveal = (asset) => {
    setRevealAsset(asset);
    setRevealCode('');
    setRevealSecret(null);
    setCodeSent(false);
    setEmailedTo('');
    setRevealOpen(true);
  };

  const sendRevealCode = async () => {
    if (!revealAsset) return;
    setRevealBusy(true);
    try {
      const res = await adminService.challengeOpsReveal(revealAsset.id, {});
      if (res?.success) {
        setCodeSent(true);
        setEmailedTo(res.data?.emailedTo || '');
        showSuccess(`Code sent to ${res.data?.emailedTo || 'the secret email'}`);
      }
    } catch (error) {
      showError(error?.response?.data?.message || null, 'Failed to send reveal code');
    } finally {
      setRevealBusy(false);
    }
  };

  const confirmReveal = async () => {
    if (!revealAsset) return;
    setRevealBusy(true);
    try {
      const res = await adminService.confirmOpsReveal(revealAsset.id, {
        code: revealCode,
      });
      if (res?.success) {
        setRevealSecret(res.data?.secret || '');
        showSuccess('Password revealed. It will stay on screen until you close this dialog.');
      }
    } catch (error) {
      showError(error?.response?.data?.message || null, 'Reveal failed');
    } finally {
      setRevealBusy(false);
    }
  };

  const copySecret = async () => {
    if (!revealSecret) return;
    try {
      await navigator.clipboard.writeText(revealSecret);
      showSuccess('Copied to clipboard');
    } catch {
      showError(null, 'Could not copy');
    }
  };

  const rows = useMemo(() => assets || [], [assets]);

  if (!permissionsLoading && !hasPermission('ops.view')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">Access Denied</h3>
          <p className="text-muted-foreground">You don't have permission to view IT Ops.</p>
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
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-foreground mb-1">IT Ops</h2>
          <p className="text-sm text-muted-foreground">
            Domains, servers, and services for the platform team — passwords stay masked until step-up verification.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondaryStroke" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add asset
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <DashboardStatsCard
          title="Overdue"
          value={stats?.overdue ?? 0}
          icon={AlertTriangle}
          iconBgColor="#fef2f2"
          iconColor="#dc2626"
        />
        <DashboardStatsCard
          title="Expiring this month"
          value={stats?.thisMonth ?? 0}
          icon={CalendarClock}
          iconBgColor="#fff7ed"
          iconColor="#ea580c"
        />
        <DashboardStatsCard
          title="Expiring next month"
          value={stats?.nextMonth ?? 0}
          icon={Globe}
          iconBgColor="#eff6ff"
          iconColor="#2563eb"
        />
        <DashboardStatsCard
          title="Active assets"
          value={stats?.totalActive ?? 0}
          subtitle={`D ${stats?.byType?.domain ?? 0} · S ${stats?.byType?.server ?? 0} · V ${stats?.byType?.service ?? 0}`}
          icon={Server}
          iconBgColor="#dcfce7"
          iconColor="#166534"
        />
      </div>

      <Card className="border border-gray-200 mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            <div className="w-full sm:w-48">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {ASSET_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All assets</SelectItem>
                  <SelectItem value="active">Active only</SelectItem>
                  <SelectItem value="archived">Archived only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-52">
              <Select value={expiryFilter} onValueChange={setExpiryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Expiry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All expiry</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="this_month">This month</SelectItem>
                  <SelectItem value="next_month">Next month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search name, username, notes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="text-base">Assets</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No assets yet. Add a domain, server, or service to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Customer</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Expires</th>
                    <th className="py-2 pr-3 font-medium">Username</th>
                    <th className="py-2 pr-3 font-medium">Password</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((asset) => {
                    const expiryStatus = getExpiryStatus(asset.expiresOn);
                    const isArchived = asset.status === 'archived';
                    return (
                    <tr key={asset.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-3 pr-3">
                        <div className="font-medium text-foreground">{asset.name}</div>
                        {asset.details?.hostOrIp || asset.details?.registrar || asset.details?.vendor ? (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {asset.details.hostOrIp || asset.details.registrar || asset.details.vendor}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3">
                        {asset.customer ? (
                          <div>
                            <div className="text-foreground">
                              {asset.customer.company || asset.customer.name}
                            </div>
                            {asset.customer.company && asset.customer.name && asset.customer.company !== asset.customer.name ? (
                              <div className="text-xs text-muted-foreground mt-0.5">{asset.customer.name}</div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <Badge variant="outline" className={typeBadgeClass[asset.type] || ''}>
                          {asset.type}
                        </Badge>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap gap-1.5">
                          {isArchived ? (
                            <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                              Archived
                            </Badge>
                          ) : (
                            <Badge variant="outline" className={expiryStatus.className}>
                              {expiryStatus.label}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        {asset.expiresOn ? (
                          <span
                            className={
                              !isArchived && expiryStatus.key === 'expired'
                                ? 'text-red-700'
                                : !isArchived && expiryStatus.key === 'expired_soon'
                                  ? 'text-orange-700'
                                  : ''
                            }
                          >
                            {dayjs(asset.expiresOn).format('MMM D, YYYY')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-3">{asset.username || '—'}</td>
                      <td className="py-3 pr-3 font-mono">
                        {asset.hasPassword ? asset.passwordMasked : '—'}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          {asset.hasPassword ? (
                            <Button type="button" size="sm" variant="secondaryStroke" onClick={() => openReveal(asset)}>
                              <Eye className="h-4 w-4 mr-1" />
                              Reveal
                            </Button>
                          ) : null}
                          <Button type="button" size="sm" variant="secondaryStroke" onClick={() => openEdit(asset)}>
                            Edit
                          </Button>
                          {!isArchived ? (
                            <Button type="button" size="sm" variant="secondaryStroke" onClick={() => handleArchive(asset)}>
                              <Archive className="h-4 w-4 mr-1" />
                              Archive
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg [--modal-w:min(92vw,32rem)]">
          <DialogHeader className="pb-3 sm:pb-4">
            <DialogTitle>{editing ? 'Edit asset' : 'Add asset'}</DialogTitle>
            <DialogDescription>
              Store domains, servers, and services for the platform team.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
              <DialogBody>
                <div className="space-y-5">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ASSET_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. africanbusinesssuite.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer (optional)</FormLabel>
                        <div className="flex gap-2">
                          <Select
                            value={field.value || 'none'}
                            onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                          >
                            <FormControl>
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Link a customer" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No customer</SelectItem>
                              {customers.map((customer) => (
                                <SelectItem key={customer.id} value={customer.id}>
                                  {formatCustomerLabel(customer)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="secondaryStroke"
                            className="shrink-0"
                            onClick={openCreateCustomer}
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            New
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {watchType === 'domain' && (
                    <FormField
                      control={form.control}
                      name="registrar"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Registrar (optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Namecheap, GoDaddy…" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {watchType === 'server' && (
                    <>
                      <FormField
                        control={form.control}
                        name="provider"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Provider (optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Google Cloud, Contabo…" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="hostOrIp"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Host / IP (optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="203.0.113.10" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                  {watchType === 'service' && (
                    <FormField
                      control={form.control}
                      name="vendor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vendor (optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="SendGrid, Mnotify…" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="expiresOn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expires on (optional)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="loginUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Login URL (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://…" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {editing?.hasPassword ? 'Password (optional — leave blank to keep)' : 'Password (optional)'}
                        </FormLabel>
                        <FormControl>
                          <Input type="password" autoComplete="new-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (optional)</FormLabel>
                        <FormControl>
                          <Textarea rows={3} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="secondaryStroke" onClick={() => setEditorOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={saving}>
                  {editing ? 'Save' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={customerModalOpen} onOpenChange={setCustomerModalOpen}>
        <DialogContent className="max-w-md [--modal-w:min(92vw,28rem)]">
          <DialogHeader className="pb-3 sm:pb-4">
            <DialogTitle>New customer</DialogTitle>
            <DialogDescription>
              Create a customer in the Customers folder and link them to this asset.
            </DialogDescription>
          </DialogHeader>
          <Form {...customerForm}>
            <form onSubmit={customerForm.handleSubmit(onCreateCustomer)} className="flex flex-col flex-1 min-h-0">
              <DialogBody>
                <div className="space-y-5">
                  <FormField
                    control={customerForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Customer name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={customerForm.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Company name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={customerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (optional)</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="email@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={customerForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Phone number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="secondaryStroke" onClick={() => setCustomerModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={customerSaving}>
                  Create customer
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revealOpen}
        onOpenChange={(open) => {
          setRevealOpen(open);
          if (!open) {
            setRevealSecret(null);
            setRevealCode('');
            setCodeSent(false);
            setEmailedTo('');
          }
        }}
      >
        <DialogContent className="max-w-md [--modal-w:min(92vw,28rem)]">
          <DialogHeader className="pb-3 sm:pb-4">
            <DialogTitle>Reveal password</DialogTitle>
            <DialogDescription>
              {revealAsset
                ? `A one-time code will be sent to the secret ops email to reveal the password for ${revealAsset.name}.`
                : 'A one-time code will be sent to the secret ops email.'}
            </DialogDescription>
          </DialogHeader>

          {revealSecret != null ? (
            <>
              <DialogBody>
                <div className="rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm break-all">
                  {revealSecret || '(empty)'}
                </div>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="secondaryStroke" onClick={() => setRevealOpen(false)}>
                  Close
                </Button>
                <Button type="button" onClick={copySecret}>
                  Copy
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogBody>
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="secondaryStroke"
                      loading={revealBusy}
                      onClick={sendRevealCode}
                    >
                      {codeSent ? 'Resend code' : 'Send code to secret email'}
                    </Button>
                    {codeSent && emailedTo ? (
                      <p className="text-xs text-muted-foreground">
                        Code sent to {emailedTo}. Check that inbox, then enter the code below.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        The code is emailed to the configured secret ops inbox (OPS_ASSETS_SECRET_EMAIL), not your login email.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">One-time code</label>
                    <Input
                      inputMode="numeric"
                      placeholder="6-digit code"
                      value={revealCode}
                      onChange={(e) => setRevealCode(e.target.value)}
                    />
                  </div>
                </div>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="secondaryStroke" onClick={() => setRevealOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  loading={revealBusy}
                  onClick={confirmReveal}
                  disabled={!revealCode}
                >
                  Reveal
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOpsAssets;
