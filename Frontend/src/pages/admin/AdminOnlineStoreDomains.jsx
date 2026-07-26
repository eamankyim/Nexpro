import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Globe, Loader2, RefreshCw, ShieldOff, XCircle } from 'lucide-react';
import dayjs from 'dayjs';

import adminService from '../../services/adminService';
import { useDebounce } from '../../hooks/useDebounce';
import { useSmartSearch } from '../../context/SmartSearchContext';
import { usePlatformAdminPermissions } from '../../context/PlatformAdminPermissionsContext';
import { showError, showSuccess } from '../../utils/toast';
import { DEBOUNCE_DELAYS } from '../../constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const StatusBadge = ({ status }) => {
  if (status === 'verified') {
    return (
      <Badge className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-800" variant="outline">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Verified
      </Badge>
    );
  }
  if (status === 'pending') {
    return (
      <Badge className="gap-1.5 border-amber-200 bg-amber-50 text-amber-800" variant="outline">
        <Globe className="h-3.5 w-3.5" />
        Pending
      </Badge>
    );
  }
  return (
    <Badge className="gap-1.5 border-slate-200 bg-slate-50 text-slate-600" variant="outline">
      <ShieldOff className="h-3.5 w-3.5" />
      None
    </Badge>
  );
};

/**
 * Platform admin queue for Online Store custom domain verification.
 */
const AdminOnlineStoreDomains = () => {
  const { searchValue, setPageSearchConfig } = useSmartSearch();
  const { hasPermission, loading: permissionsLoading } = usePlatformAdminPermissions();
  const canManage = hasPermission('settings.view');
  const debouncedSearch = useDebounce(searchValue, DEBOUNCE_DELAYS.SEARCH);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [actionId, setActionId] = useState(null);

  useEffect(() => {
    setPageSearchConfig({
      scope: 'admin-online-store-domains',
      placeholder: 'Search domain, slug, or store name…',
    });
    return () => setPageSearchConfig(null);
  }, [setPageSearchConfig]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.getOnlineStoreDomains({
        status: statusFilter,
        search: debouncedSearch || undefined,
        page: pagination.page,
        limit: pagination.limit,
      });
      if (res?.success) {
        setRows(Array.isArray(res.data) ? res.data : []);
        setPagination((prev) => ({
          ...prev,
          total: res.pagination?.total ?? 0,
          page: res.pagination?.page ?? prev.page,
          limit: res.pagination?.limit ?? prev.limit,
        }));
      }
    } catch (error) {
      showError(error?.response?.data?.message || error?.message || 'Failed to load domains');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch, pagination.page, pagination.limit]);

  useEffect(() => {
    if (!permissionsLoading && canManage) load();
  }, [permissionsLoading, canManage, load]);

  useEffect(() => {
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [statusFilter, debouncedSearch]);

  const handleAction = useCallback(async (id, action) => {
    setActionId(id);
    try {
      await adminService.updateOnlineStoreDomainStatus(id, action);
      const messages = {
        verify: 'Domain marked verified. Confirm it is added in Vercel before customers rely on HTTPS.',
        reject: 'Domain disconnected / rejected',
        pending: 'Domain moved back to pending',
      };
      showSuccess(messages[action] || 'Updated');
      await load();
    } catch (error) {
      showError(error?.response?.data?.message || error?.message || 'Could not update domain');
    } finally {
      setActionId(null);
    }
  }, [load]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((pagination.total || 0) / pagination.limit)),
    [pagination.total, pagination.limit],
  );

  if (!permissionsLoading && !canManage) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Custom domains</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to manage Online Store domains.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Custom domains</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Merchants submit domains from Online Store → Connect Domain. Verify after DNS points at the
            storefront CNAME target. Verified domains are added to API CORS automatically.
          </p>
          <p className="mt-2 max-w-2xl rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Vercel: you must still add each domain manually in the Vercel project (Domains) so TLS and
            routing work. Marking Verified here does not provision the domain on Vercel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="all">All with domain</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead>Business</TableHead>
              <TableHead>Store slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No custom domain requests{statusFilter === 'pending' ? ' pending' : ''}.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <span className="font-mono text-sm font-medium">{row.customDomain}</span>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.tenantName || '—'}</p>
                      {row.displayName ? (
                        <p className="truncate text-xs text-muted-foreground">{row.displayName}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{row.slug || '—'}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.customDomainStatus} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {row.updatedAt ? dayjs(row.updatedAt).format('MMM D, YYYY h:mm A') : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={actionId === row.id}
                        onClick={() => handleAction(row.id, 'reject')}
                      >
                        <XCircle className="mr-1.5 h-3.5 w-3.5" />
                        Disconnect
                      </Button>
                      {row.customDomainStatus === 'verified' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={actionId === row.id}
                          onClick={() => handleAction(row.id, 'pending')}
                        >
                          Re-queue
                        </Button>
                      ) : null}
                      {row.customDomainStatus !== 'verified' ? (
                        <Button
                          type="button"
                          size="sm"
                          className="bg-[#166534] text-white hover:bg-[#14532d]"
                          disabled={actionId === row.id}
                          onClick={() => handleAction(row.id, 'verify')}
                        >
                          {actionId === row.id ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Verify
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination.total > pagination.limit ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">
            {pagination.total} total · page {pagination.page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1 || loading}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page >= totalPages || loading}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminOnlineStoreDomains;
