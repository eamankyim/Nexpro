import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Loader2, Inbox } from 'lucide-react';
import dayjs from 'dayjs';
import deliveryService from '../services/deliveryService';
import { useAuth } from '../context/AuthContext';
import { useSmartSearch } from '../context/SmartSearchContext';
import { useDebounce } from '../hooks/useDebounce';
import { useResponsive } from '../hooks/useResponsive';
import WelcomeSection from '../components/WelcomeSection';
import TableSkeleton from '../components/TableSkeleton';
import { showSuccess, showError, handleApiError } from '../utils/toast';
import {
  DEBOUNCE_DELAYS,
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_ORDER,
  SEARCH_PLACEHOLDERS,
  STUDIO_LIKE_TYPES
} from '../constants';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';

function rowKey(row) {
  return `${row.entityType}:${row.id}`;
}

function DeliveryStatusSelect({ row, loading, onChange }) {
  const value = row.deliveryStatus || '__none__';
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(row, v)}
      disabled={loading}
    >
      <SelectTrigger className="h-9 w-full max-w-[220px] border border-border" aria-label="Delivery status">
        <SelectValue placeholder="Delivery" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">Not set</SelectItem>
        {DELIVERY_STATUS_ORDER.map((key) => (
          <SelectItem key={key} value={key}>
            {DELIVERY_STATUS_LABELS[key]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function Deliveries() {
  const { user, activeTenant } = useAuth();
  const queryClient = useQueryClient();
  const { searchValue, setPageSearchConfig } = useSmartSearch();
  const { isMobile } = useResponsive();
  const [scope, setScope] = useState('active');
  /** Active tab: all | not_set | ready_for_delivery | out_for_delivery | delivered | returned. Done tab: all | delivered | returned */
  const [statusFilter, setStatusFilter] = useState('all');
  const debouncedSearch = useDebounce(searchValue, DEBOUNCE_DELAYS.SEARCH);
  const [selected, setSelected] = useState(() => new Set());
  const [updatingKey, setUpdatingKey] = useState(null);

  const tenantId = activeTenant?.id;
  const businessType = activeTenant?.businessType || '';
  const isStudioLike = STUDIO_LIKE_TYPES.includes(businessType);

  const isActiveTerminalFilter =
    scope === 'active' && (statusFilter === 'delivered' || statusFilter === 'returned');

  useEffect(() => {
    setPageSearchConfig({
      scope: 'deliveries',
      placeholder: isStudioLike ? SEARCH_PLACEHOLDERS.JOBS : SEARCH_PLACEHOLDERS.SALES
    });
    return () => setPageSearchConfig(null);
  }, [setPageSearchConfig, isStudioLike]);

  const activeQueueQuery = useQuery({
    queryKey: ['deliveries-queue', 'active', tenantId],
    queryFn: async () => {
      const res = await deliveryService.getQueue('active');
      return res?.data ?? res;
    },
    enabled: Boolean(tenantId) && scope === 'active' && !isActiveTerminalFilter
  });

  const doneQueueQuery = useQuery({
    queryKey: ['deliveries-queue', 'done', tenantId],
    queryFn: async () => {
      const res = await deliveryService.getQueue('done');
      return res?.data ?? res;
    },
    enabled: Boolean(tenantId) && (scope === 'done' || isActiveTerminalFilter)
  });

  const queueRes = scope === 'done' || isActiveTerminalFilter ? doneQueueQuery.data : activeQueueQuery.data;
  const isLoading =
    scope === 'done' || isActiveTerminalFilter ? doneQueueQuery.isLoading : activeQueueQuery.isLoading;
  const isFetching = activeQueueQuery.isFetching || doneQueueQuery.isFetching;
  const error = scope === 'done' || isActiveTerminalFilter ? doneQueueQuery.error : activeQueueQuery.error;
  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['deliveries-queue'] });
  }, [queryClient]);

  const rows = queueRes?.rows ?? [];

  /** Studio-like workspaces: jobs only. Shop / pharmacy / other: sales (orders) only. */
  const tenantScopedRows = useMemo(() => {
    if (isStudioLike) return rows.filter((r) => r.entityType === 'job');
    return rows.filter((r) => r.entityType === 'sale');
  }, [rows, isStudioLike]);

  const statusFilteredRows = useMemo(() => {
    if (scope === 'active') {
      if (isActiveTerminalFilter) {
        if (statusFilter === 'delivered') {
          return tenantScopedRows.filter((r) => r.deliveryStatus === 'delivered');
        }
        if (statusFilter === 'returned') {
          return tenantScopedRows.filter((r) => r.deliveryStatus === 'returned');
        }
        return tenantScopedRows;
      }
      if (statusFilter === 'all') return tenantScopedRows;
      if (statusFilter === 'not_set') {
        return tenantScopedRows.filter((r) => !r.deliveryStatus);
      }
      if (statusFilter === 'ready_for_delivery') {
        return tenantScopedRows.filter((r) => r.deliveryStatus === 'ready_for_delivery');
      }
      if (statusFilter === 'out_for_delivery') {
        return tenantScopedRows.filter((r) => r.deliveryStatus === 'out_for_delivery');
      }
      return tenantScopedRows;
    }
    if (statusFilter === 'all') return tenantScopedRows;
    if (statusFilter === 'delivered') {
      return tenantScopedRows.filter((r) => r.deliveryStatus === 'delivered');
    }
    if (statusFilter === 'returned') {
      return tenantScopedRows.filter((r) => r.deliveryStatus === 'returned');
    }
    return tenantScopedRows;
  }, [tenantScopedRows, scope, statusFilter, isActiveTerminalFilter]);

  const filteredRows = useMemo(() => {
    const q = (debouncedSearch || '').trim().toLowerCase();
    if (!q) return statusFilteredRows;
    return statusFilteredRows.filter((r) => {
      const blob = [r.reference, r.title, r.customerName, r.customerPhone, r.addressSummary]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [statusFilteredRows, debouncedSearch]);

  const mutation = useMutation({
    mutationFn: (updates) => deliveryService.patchStatuses(updates),
    onSuccess: (res) => {
      const results = res?.data?.results ?? [];
      const failed = results.filter((r) => !r.ok);
      if (failed.length) {
        showError(failed[0]?.message || 'Some updates failed');
      } else {
        showSuccess('Delivery status updated');
      }
      queryClient.invalidateQueries({ queryKey: ['deliveries-queue'] });
      setSelected(new Set());
    },
    onError: (err) => handleApiError(err, { context: 'deliveries' })
  });

  const handleStatusChange = useCallback(
    (row, selectValue) => {
      const deliveryStatus = selectValue === '__none__' ? null : selectValue;
      const k = rowKey(row);
      setUpdatingKey(k);
      mutation.mutate([{ entityType: row.entityType, id: row.id, deliveryStatus }], {
        onSettled: () => setUpdatingKey(null)
      });
    },
    [mutation]
  );

  const toggleRow = useCallback((row, checked) => {
    const k = rowKey(row);
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(k);
      else next.delete(k);
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback(
    (checked) => {
      if (!checked) {
        setSelected(new Set());
        return;
      }
      setSelected(new Set(filteredRows.map(rowKey)));
    },
    [filteredRows]
  );

  const selectedRows = useMemo(
    () => filteredRows.filter((r) => selected.has(rowKey(r))),
    [filteredRows, selected]
  );

  const markSelectedReady = useCallback(() => {
    if (!selectedRows.length) return;
    const updates = selectedRows.map((r) => ({
      entityType: r.entityType,
      id: r.id,
      deliveryStatus: 'ready_for_delivery'
    }));
    mutation.mutate(updates);
  }, [selectedRows, mutation]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const welcomeMessage = useMemo(() => {
    const first = user?.name?.split?.(' ')?.[0] || 'there';
    return `Hi ${first}`;
  }, [user?.name]);

  const allVisibleSelected =
    filteredRows.length > 0 && filteredRows.every((r) => selected.has(rowKey(r)));
  const someSelected = selected.size > 0;
  const hasAnyScopedRows = tenantScopedRows.length > 0;
  const filtersExcludeAll =
    hasAnyScopedRows && statusFilteredRows.length === 0 && statusFilter !== 'all';
  const searchFilteredOut =
    statusFilteredRows.length > 0 && filteredRows.length === 0 && Boolean((debouncedSearch || '').trim());

  if (error && !queueRes) {
    return (
      <div className="p-4 md:p-6">
        <WelcomeSection
          welcomeMessage={welcomeMessage}
          subText={
            isStudioLike
              ? 'Completed jobs ready for delivery.'
              : 'Completed sales and orders ready for delivery.'
          }
        />
        <p className="text-sm text-destructive">Could not load deliveries. Try again.</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <WelcomeSection
        welcomeMessage={welcomeMessage}
        subText={
          isStudioLike
            ? 'Completed jobs you can move through delivery. Customers see progress when tracking is on.'
            : 'Completed sales and orders you can move through delivery. Customers see progress when tracking is on.'
        }
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Tabs
          value={scope}
          onValueChange={(v) => {
            setScope(v);
            setStatusFilter('all');
          }}
          className="w-auto shrink-0"
        >
          <TabsList className="border border-border bg-muted/40">
            <TabsTrigger value="active" className="text-xs sm:text-sm">
              To deliver
            </TabsTrigger>
            <TabsTrigger value="done" className="text-xs sm:text-sm">
              Done (90 days)
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-9 shrink-0 border border-border"
        >
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>

        <div className="flex items-center gap-2 min-w-0">
          <Label htmlFor="deliveries-status-filter" className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            Delivery status
          </Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="deliveries-status-filter" className="h-9 w-[min(100vw-10rem,13.5rem)] sm:w-[13.5rem] border border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scope === 'active' ? (
                <>
                  <SelectItem value="all">All in queue</SelectItem>
                  <SelectItem value="not_set">Not set yet</SelectItem>
                  <SelectItem value="ready_for_delivery">{DELIVERY_STATUS_LABELS.ready_for_delivery}</SelectItem>
                  <SelectItem value="out_for_delivery">{DELIVERY_STATUS_LABELS.out_for_delivery}</SelectItem>
                  <SelectItem value="delivered">{DELIVERY_STATUS_LABELS.delivered}</SelectItem>
                  <SelectItem value="returned">{DELIVERY_STATUS_LABELS.returned}</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="all">All done</SelectItem>
                  <SelectItem value="delivered">{DELIVERY_STATUS_LABELS.delivered}</SelectItem>
                  <SelectItem value="returned">{DELIVERY_STATUS_LABELS.returned}</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {scope === 'active' && someSelected && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={clearSelection} className="h-9 shrink-0 border border-border">
              Clear selection
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => markSelectedReady()}
              disabled={mutation.isPending}
              className="h-9 shrink-0 bg-brand hover:bg-brand-dark text-white"
            >
              Mark ready for delivery
            </Button>
          </>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : filteredRows.length === 0 ? (
        <Card className="border border-border">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
            <Inbox className="h-10 w-10 opacity-60" />
            <p className="text-sm font-medium text-foreground">
              {searchFilteredOut ? 'No matches' : filtersExcludeAll ? 'No matches for filters' : 'Nothing here yet'}
            </p>
            <p className="text-xs max-w-sm">
              {searchFilteredOut
                ? 'Try another term in the search box at the top of the page.'
                : filtersExcludeAll
                  ? 'Change the type or delivery status filters above.'
                  : scope === 'active'
                    ? isStudioLike
                      ? 'When jobs are completed, they appear here so you can set delivery status.'
                      : 'When sales are completed, they appear here so you can set delivery status.'
                    : 'Delivered or returned items from the last 90 days will show in this tab.'}
            </p>
          </CardContent>
        </Card>
      ) : isMobile ? (
        <div className="space-y-3">
          {filteredRows.map((row) => {
            const k = rowKey(row);
            const checked = selected.has(k);
            return (
              <Card key={k} className="border border-border">
                <CardContent className="p-4 space-y-3">
                  {scope === 'active' && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggleRow(row, Boolean(v))}
                        aria-label={`Select ${row.reference}`}
                      />
                      <span className="text-sm text-muted-foreground">Select</span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="border border-border">
                      {row.entityType === 'job' ? 'Job' : 'Sale'}
                    </Badge>
                    <span className="font-medium">{row.reference}</span>
                  </div>
                  {row.title && <p className="text-sm text-muted-foreground line-clamp-2">{row.title}</p>}
                  <p className="text-sm">{row.customerName || '—'}</p>
                  {row.customerPhone && <p className="text-xs text-muted-foreground">{row.customerPhone}</p>}
                  {row.addressSummary && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{row.addressSummary}</p>
                  )}
                  {row.total != null && (
                    <p className="text-sm">
                      Total: ₵ {Number(row.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {row.completedAt ? dayjs(row.completedAt).format('MMM D, YYYY h:mm A') : '—'}
                  </p>
                  <DeliveryStatusSelect
                    row={row}
                    loading={updatingKey === k || mutation.isPending}
                    onChange={handleStatusChange}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border hover:bg-transparent">
                {scope === 'active' && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={(v) => toggleAllVisible(Boolean(v))}
                      aria-label="Select all visible"
                    />
                  </TableHead>
                )}
                <TableHead>Type</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead className="min-w-[200px]">Delivery</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => {
                const k = rowKey(row);
                const checked = selected.has(k);
                return (
                  <TableRow key={k} className="border-b border-border">
                    {scope === 'active' && (
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleRow(row, Boolean(v))}
                          aria-label={`Select ${row.reference}`}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant="secondary" className="border border-border">
                        {row.entityType === 'job' ? 'Job' : 'Sale'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{row.reference}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span>{row.customerName || '—'}</span>
                        {row.title && <span className="text-xs text-muted-foreground line-clamp-1">{row.title}</span>}
                        {row.addressSummary && (
                          <span className="text-xs text-muted-foreground line-clamp-1">{row.addressSummary}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.customerPhone || '—'}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {row.completedAt ? dayjs(row.completedAt).format('MMM D, YYYY') : '—'}
                    </TableCell>
                    <TableCell>
                      <DeliveryStatusSelect
                        row={row}
                        loading={updatingKey === k || mutation.isPending}
                        onChange={handleStatusChange}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
