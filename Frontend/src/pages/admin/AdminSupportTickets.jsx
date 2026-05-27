import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDebounce } from '../../hooks/useDebounce';
import { useSmartSearch } from '../../context/SmartSearchContext';
import { usePlatformAdminPermissions } from '../../context/PlatformAdminPermissionsContext';
import adminService from '../../services/adminService';
import { showSuccess } from '../../utils/toast';
import { handleApiError } from '../../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import DashboardTable from '../../components/DashboardTable';
import DetailsDrawer from '../../components/DetailsDrawer';
import StatusChip from '../../components/StatusChip';
import { Plus, Loader2, Eye } from 'lucide-react';
import dayjs from 'dayjs';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Descriptions, DescriptionItem } from '@/components/ui/descriptions';
import { DEBOUNCE_DELAYS } from '../../constants';

const ticketSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  tenantId: z.string().min(1, 'Tenant is required'),
  status: z.enum(['open', 'in_progress', 'waiting', 'resolved', 'closed']).default('open'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  category: z.string().optional(),
  assignedTo: z.string().optional().nullable(),
});

const statusVariant = (status) => {
  if (status === 'resolved' || status === 'closed') return 'success';
  if (status === 'in_progress') return 'info';
  if (status === 'waiting') return 'warning';
  return 'default';
};

const AdminSupportTickets = () => {
  const { searchValue, setPageSearchConfig } = useSmartSearch();
  const { hasPermission, loading: permissionsLoading } = usePlatformAdminPermissions();
  const debouncedSearch = useDebounce(searchValue, DEBOUNCE_DELAYS.SEARCH);

  const [tickets, setTickets] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [platformAdmins, setPlatformAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({ status: 'all', priority: 'all' });
  const [formOpen, setFormOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [viewingTicket, setViewingTicket] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: '',
      description: '',
      tenantId: '',
      status: 'open',
      priority: 'medium',
      category: '',
      assignedTo: null,
    },
  });

  useEffect(() => {
    setPageSearchConfig({
      scope: 'admin-support-tickets',
      placeholder: 'Search tickets by title, description, category...',
    });
    return () => setPageSearchConfig(null);
  }, [setPageSearchConfig]);

  useEffect(() => {
    adminService.getTenants({ limit: 200 }).then((res) => {
      if (res?.success) setTenants(res.data || []);
    }).catch(() => {});
    adminService.getPlatformAdmins().then((res) => {
      if (res?.success) setPlatformAdmins(res.data || []);
    }).catch(() => {});
  }, []);

  const fetchTickets = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const response = await adminService.getSupportTickets({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        status: filters.status !== 'all' ? filters.status : undefined,
        priority: filters.priority !== 'all' ? filters.priority : undefined,
      });
      if (response?.success) {
        setTickets(response.data || []);
        setPagination({
          current: page,
          pageSize,
          total: response.count ?? 0,
        });
      }
    } catch (error) {
      handleApiError(error, { context: 'load support tickets' });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filters.status, filters.priority]);

  useEffect(() => {
    setPagination((p) => ({ ...p, current: 1 }));
  }, [debouncedSearch, filters.status, filters.priority]);

  useEffect(() => {
    fetchTickets(pagination.current, pagination.pageSize);
  }, [fetchTickets, pagination.current, pagination.pageSize]);

  if (!permissionsLoading && !hasPermission('tickets.view')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">You do not have permission to view support tickets.</p>
      </div>
    );
  }

  const openCreate = () => {
    setEditingTicket(null);
    form.reset({
      title: '',
      description: '',
      tenantId: '',
      status: 'open',
      priority: 'medium',
      category: '',
      assignedTo: null,
    });
    setFormOpen(true);
  };

  const openEdit = (ticket) => {
    setEditingTicket(ticket);
    form.reset({
      title: ticket.title || '',
      description: ticket.description || '',
      tenantId: ticket.tenantId || '',
      status: ticket.status || 'open',
      priority: ticket.priority || 'medium',
      category: ticket.category || '',
      assignedTo: ticket.assignedTo || null,
    });
    setFormOpen(true);
  };

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      if (editingTicket?.id) {
        await adminService.updateSupportTicket(editingTicket.id, values);
        showSuccess('Ticket updated');
      } else {
        await adminService.createSupportTicket(values);
        showSuccess('Ticket created');
      }
      setFormOpen(false);
      fetchTickets(pagination.current, pagination.pageSize);
    } catch (error) {
      handleApiError(error, { context: 'save support ticket' });
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: 'title',
        label: 'Ticket',
        render: (_, row) => (
          <div>
            <p className="font-medium text-foreground">{row.title}</p>
            <p className="text-xs text-muted-foreground">{row.tenant?.name || '—'}</p>
          </div>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        render: (_, row) => <StatusChip status={row.status} variant={statusVariant(row.status)} />,
      },
      {
        key: 'priority',
        label: 'Priority',
        render: (_, row) => <Badge variant="outline">{row.priority}</Badge>,
      },
      {
        key: 'assignee',
        label: 'Assigned',
        render: (_, row) => row.assignee?.name || row.assignee?.email || '—',
      },
      {
        key: 'updatedAt',
        label: 'Updated',
        render: (_, row) => (row.updatedAt ? dayjs(row.updatedAt).format('MMM D, YYYY') : '—'),
      },
      {
        key: 'actions',
        label: '',
        render: (_, row) => (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setViewingTicket(row);
              setDrawerOpen(true);
            }}
          >
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-2xl font-semibold text-foreground mb-1">Support Tickets</h2>
          <p className="text-sm text-muted-foreground">
            Record customer issues and link troubleshooting to tenant workspaces.
          </p>
        </div>
        {hasPermission('tickets.manage') && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New ticket
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="waiting">Waiting</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.priority} onValueChange={(v) => setFilters((f) => ({ ...f, priority: v }))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DashboardTable
        data={tickets}
        columns={columns}
        loading={loading}
        title={null}
        pageSize={pagination.pageSize}
        externalPagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
        }}
        onPageChange={(next) => setPagination((p) => ({ ...p, ...next }))}
        emptyDescription="No support tickets yet. Create one when a tenant reports an issue."
      />

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingTicket ? 'Edit ticket' : 'New support ticket'}</SheetTitle>
          </SheetHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
              <FormField
                control={form.control}
                name="tenantId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tenant</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={!!editingTicket}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select tenant" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tenants.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea rows={4} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. POS, billing, login" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In progress</SelectItem>
                          <SelectItem value="waiting">Waiting</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="assignedTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign to (optional)</FormLabel>
                    <Select
                      value={field.value || 'none'}
                      onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {platformAdmins.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name || a.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                </Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <DetailsDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setViewingTicket(null);
        }}
        title={viewingTicket?.title || 'Ticket'}
        footer={
          hasPermission('tickets.manage') && viewingTicket ? (
            <Button variant="outline" onClick={() => openEdit(viewingTicket)}>
              Edit ticket
            </Button>
          ) : null
        }
      >
        {viewingTicket && (
          <Descriptions column={1}>
            <DescriptionItem label="Tenant">{viewingTicket.tenant?.name || '—'}</DescriptionItem>
            <DescriptionItem label="Status">
              <StatusChip status={viewingTicket.status} variant={statusVariant(viewingTicket.status)} />
            </DescriptionItem>
            <DescriptionItem label="Priority">{viewingTicket.priority}</DescriptionItem>
            <DescriptionItem label="Category">{viewingTicket.category || '—'}</DescriptionItem>
            <DescriptionItem label="Assigned">
              {viewingTicket.assignee?.name || viewingTicket.assignee?.email || '—'}
            </DescriptionItem>
            <DescriptionItem label="Description">{viewingTicket.description || '—'}</DescriptionItem>
            <DescriptionItem label="Created">
              {viewingTicket.createdAt ? dayjs(viewingTicket.createdAt).format('MMM D, YYYY h:mm A') : '—'}
            </DescriptionItem>
          </Descriptions>
        )}
      </DetailsDrawer>
    </div>
  );
};

export default AdminSupportTickets;
