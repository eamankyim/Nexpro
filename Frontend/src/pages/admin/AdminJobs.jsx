import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDebounce } from '../../hooks/useDebounce';
import { useResponsive } from '../../hooks/useResponsive';
import { useSmartSearch } from '../../context/SmartSearchContext';
import { usePlatformAdminPermissions } from '../../context/PlatformAdminPermissionsContext';
import adminService from '../../services/adminService';
import { showSuccess, showError } from '../../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import DashboardStatsCard from '../../components/DashboardStatsCard';
import DashboardTable from '../../components/DashboardTable';
import ViewToggle from '../../components/ViewToggle';
import DetailsDrawer from '../../components/DetailsDrawer';
import DrawerSectionCard from '../../components/DrawerSectionCard';
import StatusChip from '../../components/StatusChip';
import TableSkeleton from '../../components/TableSkeleton';
import {
  Plus,
  RefreshCw,
  Loader2,
  Filter,
  Edit,
  Briefcase,
  User,
  Clock,
  AlertCircle,
  CheckCircle,
  Calendar,
  Link as LinkIcon,
  Eye
} from 'lucide-react';
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
import { DatePicker } from '@/components/ui/date-picker';
import { Timeline, TimelineItem, TimelineIndicator, TimelineContent, TimelineTitle, TimelineDescription, TimelineTime } from '@/components/ui/timeline';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Descriptions, DescriptionItem } from '@/components/ui/descriptions';
import MobileFormDialog from '../../components/MobileFormDialog';
import { DEBOUNCE_DELAYS, PRIORITY_CHIP_CLASSES, STATUS_CHIP_CLASSES, STATUS_CHIP_DEFAULT_CLASS } from '../../constants';

const jobSchema = z.object({
  title: z.string().min(1, 'Job title is required'),
  description: z.string().optional(),
  status: z.enum(['new', 'in_progress', 'on_hold', 'completed', 'cancelled']).default('new'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  assignedTo: z.string().optional().nullable(),
  adminLeadId: z.string().optional().nullable(),
  startDate: z.date().optional().nullable(),
  dueDate: z.date().optional().nullable(),
  notes: z.string().optional()
});

const AdminJobs = () => {
  const { searchValue, setPageSearchConfig } = useSmartSearch();
  const { hasPermission, loading: permissionsLoading } = usePlatformAdminPermissions();
  const debouncedSearch = useDebounce(searchValue, DEBOUNCE_DELAYS.SEARCH);
  const { isMobile } = useResponsive();

  const [jobs, setJobs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [platformAdmins, setPlatformAdmins] = useState([]);
  const [adminLeads, setAdminLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshingJobs, setRefreshingJobs] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    assignedTo: '',
    adminLeadId: ''
  });
  const [jobModalVisible, setJobModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [viewingJob, setViewingJob] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [assigningJob, setAssigningJob] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [tableViewMode, setTableViewMode] = useState('table');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const jobForm = useForm({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'new',
      priority: 'medium',
      assignedTo: null,
      adminLeadId: null,
      startDate: null,
      dueDate: null,
      notes: ''
    }
  });

  const assignForm = useForm({
    resolver: zodResolver(z.object({
      assignedTo: z.string().optional().nullable()
    })),
    defaultValues: {
      assignedTo: null
    }
  });

  // Set page search config
  useEffect(() => {
    setPageSearchConfig({
      scope: 'admin-jobs',
      placeholder: 'Search jobs by title, description, job number...'
    });
  }, [setPageSearchConfig]);

  // Load platform admins and admin leads
  useEffect(() => {
    const loadData = async () => {
      try {
        const [adminsRes, leadsRes] = await Promise.all([
          adminService.getPlatformAdmins(),
          adminService.getAdminLeads({ limit: 1000, isActive: 'true' })
        ]);
        if (adminsRes?.success) {
          setPlatformAdmins(adminsRes.data || []);
        }
        if (leadsRes?.success) {
          setAdminLeads(leadsRes.data || []);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    loadData();
  }, []);

  // Fetch jobs
  const fetchJobs = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshingJobs(true);
    } else {
      setLoading(true);
    }

    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        search: debouncedSearch || undefined,
        status: filters.status || undefined,
        priority: filters.priority || undefined,
        assignedTo: filters.assignedTo || undefined,
        adminLeadId: filters.adminLeadId || undefined
      };

      const response = await adminService.getAdminJobs(params);
      if (response?.success) {
        setJobs(response.data || []);
        setPagination(prev => ({
          ...prev,
          total: response.count || 0,
          totalPages: response.pagination?.totalPages || 0
        }));
      }
    } catch (error) {
      console.error('Failed to fetch admin jobs:', error);
      showError(error, 'Failed to load jobs');
    } finally {
      setLoading(false);
      setRefreshingJobs(false);
    }
  }, [pagination.current, pagination.pageSize, debouncedSearch, filters]);

  // Fetch summary stats
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const response = await adminService.getAdminJobStats();
      if (response?.success) {
        setSummary(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch admin job stats:', error);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleAdd = () => {
    setEditingJob(null);
    jobForm.reset({
      title: '',
      description: '',
      status: 'new',
      priority: 'medium',
      assignedTo: null,
      adminLeadId: null,
      startDate: null,
      dueDate: null,
      notes: ''
    });
    setJobModalVisible(true);
  };

  const handleEdit = (job) => {
    setEditingJob(job);
    jobForm.reset({
      title: job.title || '',
      description: job.description || '',
      status: job.status || 'new',
      priority: job.priority || 'medium',
      assignedTo: job.assignedTo || null,
      adminLeadId: job.adminLeadId || null,
      startDate: job.startDate ? new Date(job.startDate) : null,
      dueDate: job.dueDate ? new Date(job.dueDate) : null,
      notes: job.notes || ''
    });
    setJobModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      const payload = {
        ...values,
        startDate: values.startDate ? values.startDate.toISOString() : null,
        dueDate: values.dueDate ? values.dueDate.toISOString() : null
      };
      if (editingJob) {
        await adminService.updateAdminJob(editingJob.id, payload);
        showSuccess('Job updated successfully');
      } else {
        await adminService.createAdminJob(payload);
        showSuccess('Job created successfully');
      }
      setJobModalVisible(false);
      fetchJobs();
      fetchSummary();
    } catch (error) {
      showError(error, editingJob ? 'Failed to update job' : 'Failed to create job');
    }
  };

  const handleDelete = async (job) => {
    try {
      await adminService.deleteAdminJob(job.id);
      showSuccess('Job deleted successfully');
      fetchJobs();
      fetchSummary();
    } catch (error) {
      showError(error, 'Failed to delete job');
    }
  };

  const handleAssign = async (job) => {
    setAssigningJob(job);
    assignForm.reset({
      assignedTo: job.assignedTo || null
    });
    setAssignModalVisible(true);
  };

  const handleAssignSubmit = async (values) => {
    if (!assigningJob) return;
    try {
      await adminService.assignAdminJob(assigningJob.id, values.assignedTo);
      showSuccess('Job assigned successfully');
      setAssignModalVisible(false);
      fetchJobs();
      fetchSummary();
      if (viewingJob && viewingJob.id === assigningJob.id) {
        const response = await adminService.getAdminJob(assigningJob.id);
        if (response?.success) {
          setViewingJob(response.data);
        }
      }
    } catch (error) {
      showError(error, 'Failed to assign job');
    }
  };

  const handleViewJob = async (job) => {
    try {
      const response = await adminService.getAdminJob(job.id);
      if (response?.success) {
        setViewingJob(response.data);
        setDrawerVisible(true);
      }
    } catch (error) {
      showError(error, 'Failed to load job details');
    }
  };

  const tableColumns = useMemo(() => [
    {
      key: 'jobNumber',
      title: 'Job #',
      dataIndex: 'jobNumber',
      render: (text) => <span className="font-mono text-sm">{text}</span>
    },
    {
      key: 'title',
      title: 'Title',
      dataIndex: 'title',
      render: (text) => <div className="font-medium">{text}</div>
    },
    {
      key: 'status',
      title: 'Status',
      dataIndex: 'status',
      mobileDashboardPlacement: 'headerEnd',
      render: (status) => <StatusChip status={status} />
    },
    {
      key: 'priority',
      title: 'Priority',
      dataIndex: 'priority',
      render: (priority) => (
        <Badge className={PRIORITY_CHIP_CLASSES[priority] || STATUS_CHIP_DEFAULT_CLASS}>
          {priority}
        </Badge>
      )
    },
    {
      key: 'assignedTo',
      title: 'Assigned To',
      render: (_, record) => (
        <div>
          {record.assignedUser ? (
            <div className="text-sm">
              <div className="font-medium">{record.assignedUser.name}</div>
              <div className="text-xs text-gray-500">{record.assignedUser.email}</div>
            </div>
          ) : (
            <span className="text-gray-400">Unassigned</span>
          )}
        </div>
      )
    },
    {
      key: 'dueDate',
      title: 'Due Date',
      dataIndex: 'dueDate',
      render: (date) => {
        if (!date) return '-';
        const isOverdue = new Date(date) < new Date() && date;
        return (
          <div className={isOverdue ? 'text-red-600' : ''}>
            {dayjs(date).format('MMM D, YYYY')}
          </div>
        );
      }
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleViewJob(record)}
          >
            <Eye className="h-4 w-4 mr-2" />
            View
          </Button>
          {hasPermission('jobs.manage') && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleEdit(record)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleAssign(record)}
              >
                <User className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      )
    }
  ], []);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground mb-1">Admin Jobs</h2>
          <p className="text-sm text-muted-foreground">
            Track software projects and assign them to team members
          </p>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0 sm:justify-end sm:ml-auto">
          <ViewToggle value={tableViewMode} onChange={setTableViewMode} />
          <Button
            variant="outline"
            onClick={() => setFilterDrawerOpen(true)}
            size={isMobile ? "icon" : "default"}
          >
            <Filter className="h-4 w-4" />
            {!isMobile && <span className="ml-2">Filter</span>}
          </Button>
          <Button
            variant="outline"
            onClick={() => fetchJobs(true)}
            disabled={refreshingJobs}
            size={isMobile ? "icon" : "default"}
          >
            {refreshingJobs ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <Button onClick={handleAdd} className="flex-1 min-w-0 md:flex-none">
            <Plus className="h-4 w-4" />
            <span className="ml-2">New Job</span>
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
        <DashboardStatsCard
          title="Total Jobs"
          value={summary?.total || 0}
          icon={Briefcase}
          iconBgColor="rgba(22, 101, 52, 0.1)"
          iconColor="#166534"
        />
        <DashboardStatsCard
          title="In Progress"
          value={summary?.byStatus?.in_progress || 0}
          icon={Clock}
          iconBgColor="rgba(59, 130, 246, 0.1)"
          iconColor="#3b82f6"
        />
        <DashboardStatsCard
          title="Completed"
          value={summary?.byStatus?.completed || 0}
          icon={CheckCircle}
          iconBgColor="rgba(132, 204, 22, 0.1)"
          iconColor="#84cc16"
        />
        <DashboardStatsCard
          title="Overdue"
          value={summary?.overdue || 0}
          icon={AlertCircle}
          iconBgColor="rgba(239, 68, 68, 0.1)"
          iconColor="#ef4444"
        />
      </div>

      {/* Check permission after hooks */}
      {!permissionsLoading && !hasPermission('jobs.view') ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground mb-2">Access Denied</h3>
            <p className="text-gray-600">You don't have permission to view jobs.</p>
          </div>
        </div>
      ) : loading && !refreshingJobs ? (
        <TableSkeleton />
      ) : (
        <DashboardTable
          data={jobs}
          columns={tableColumns}
          loading={refreshingJobs}
          title={null}
          emptyIcon={<Briefcase className="h-12 w-12 text-muted-foreground" />}
          emptyTitle="No jobs yet"
          emptyDescription="Create your first job to start tracking software projects"
          viewMode={tableViewMode}
          onViewModeChange={setTableViewMode}
        />
      )}

      {/* Create/Edit Job Modal */}
      <MobileFormDialog
        open={jobModalVisible}
        onOpenChange={setJobModalVisible}
        title={editingJob ? 'Edit Job' : 'Create New Job'}
        description="Track a software project and assign it to a team member"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setJobModalVisible(false)}>
              Cancel
            </Button>
            <Button type="submit" form="admin-job-form">
              {editingJob ? 'Update' : 'Create'} Job
            </Button>
          </>
        }
      >
        <Form {...jobForm}>
          <form id="admin-job-form" onSubmit={jobForm.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={jobForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Project title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={jobForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Project description..." rows={4} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={jobForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={jobForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
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
                control={jobForm.control}
                name="adminLeadId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link to Lead (Optional)</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === 'none' ? null : value)} 
                      value={field.value || 'none'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select lead" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {adminLeads.map(lead => (
                          <SelectItem key={lead.id} value={lead.id}>
                            {lead.company || lead.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={jobForm.control}
                name="assignedTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign To</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === 'unassigned' ? null : value)} 
                      value={field.value || 'unassigned'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select team member" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {platformAdmins.map(admin => (
                          <SelectItem key={admin.id} value={admin.id}>
                            {admin.name} ({admin.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={jobForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <DatePicker
                          date={field.value}
                          onDateChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={jobForm.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <DatePicker
                          date={field.value}
                          onDateChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={jobForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Project notes..." rows={4} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
          </form>
        </Form>
      </MobileFormDialog>

      {/* Assign Job Modal */}
      <MobileFormDialog
        open={assignModalVisible}
        onOpenChange={setAssignModalVisible}
        title="Assign Job"
        description="Assign this job to a team member"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setAssignModalVisible(false)}>
              Cancel
            </Button>
            <Button type="submit" form="admin-assign-job-form">
              Assign
            </Button>
          </>
        }
      >
        <Form {...assignForm}>
          <form id="admin-assign-job-form" onSubmit={assignForm.handleSubmit(handleAssignSubmit)} className="space-y-4">
              <FormField
                control={assignForm.control}
                name="assignedTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign To</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === 'unassigned' ? null : value)} 
                      value={field.value || 'unassigned'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select team member" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {platformAdmins.map(admin => (
                          <SelectItem key={admin.id} value={admin.id}>
                            {admin.name} ({admin.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
          </form>
        </Form>
      </MobileFormDialog>

      {/* Job Details Drawer */}
      <DetailsDrawer
        open={drawerVisible}
        onOpenChange={setDrawerVisible}
        title={viewingJob ? `${viewingJob.jobNumber} - ${viewingJob.title}` : ''}
        loading={!viewingJob}
        onDelete={viewingJob && hasPermission('jobs.manage') ? () => handleDelete(viewingJob) : undefined}
        deleteConfirmTitle="Delete this job?"
        deleteConfirmText="This can't be undone."
        deleteButtonLabel="Delete"
      >
        {viewingJob && (
          <>
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="history">Status History</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="mt-4">
                <DrawerSectionCard title="Job Information">
                  <Descriptions>
                    <DescriptionItem label="Job Number">{viewingJob.jobNumber}</DescriptionItem>
                    <DescriptionItem label="Title">{viewingJob.title}</DescriptionItem>
                    {viewingJob.description && (
                      <DescriptionItem label="Description">{viewingJob.description}</DescriptionItem>
                    )}
                    <DescriptionItem label="Status">
                      <StatusChip status={viewingJob.status} />
                    </DescriptionItem>
                    <DescriptionItem label="Priority">
                      <Badge className={PRIORITY_CHIP_CLASSES[viewingJob.priority] || STATUS_CHIP_DEFAULT_CLASS}>
                        {viewingJob.priority}
                      </Badge>
                    </DescriptionItem>
                    <DescriptionItem label="Assigned To">
                      {viewingJob.assignedUser ? (
                        <div>
                          <div>{viewingJob.assignedUser.name}</div>
                          <div className="text-sm text-gray-500">{viewingJob.assignedUser.email}</div>
                        </div>
                      ) : (
                        'Unassigned'
                      )}
                    </DescriptionItem>
                    {viewingJob.adminLead && (
                      <DescriptionItem label="Linked Lead">
                        <div className="flex items-center gap-2">
                          <LinkIcon className="h-4 w-4" />
                          {viewingJob.adminLead.company || viewingJob.adminLead.name}
                        </div>
                      </DescriptionItem>
                    )}
                    <DescriptionItem label="Start Date">
                      {viewingJob.startDate ? dayjs(viewingJob.startDate).format('MMM D, YYYY') : '-'}
                    </DescriptionItem>
                    <DescriptionItem label="Due Date">
                      {viewingJob.dueDate ? dayjs(viewingJob.dueDate).format('MMM D, YYYY') : '-'}
                    </DescriptionItem>
                    {viewingJob.completionDate && (
                      <DescriptionItem label="Completion Date">
                        {dayjs(viewingJob.completionDate).format('MMM D, YYYY')}
                      </DescriptionItem>
                    )}
                    {viewingJob.notes && (
                      <DescriptionItem label="Notes">{viewingJob.notes}</DescriptionItem>
                    )}
                  </Descriptions>
                </DrawerSectionCard>
              </TabsContent>
              <TabsContent value="history" className="mt-4">
                {viewingJob.statusHistory && viewingJob.statusHistory.length > 0 ? (
                  <DrawerSectionCard title="Status History">
                    <Timeline>
                      {viewingJob.statusHistory.map((history) => (
                        <TimelineItem key={history.id}>
                          <TimelineIndicator>
                            <CheckCircle className="h-4 w-4" />
                          </TimelineIndicator>
                          <TimelineContent>
                            <TimelineTitle>
                              <StatusChip status={history.status} />
                            </TimelineTitle>
                            {history.comment && <TimelineDescription>{history.comment}</TimelineDescription>}
                            <TimelineTime>{dayjs(history.createdAt).format('MMM D, YYYY h:mm A')}</TimelineTime>
                            {history.changedByUser && (
                              <div className="text-xs text-gray-500 mt-1">
                                by {history.changedByUser.name}
                              </div>
                            )}
                          </TimelineContent>
                        </TimelineItem>
                      ))}
                    </Timeline>
                  </DrawerSectionCard>
                ) : (
                  <DrawerSectionCard title="Status History">
                    <p className="text-sm text-muted-foreground">No status history yet.</p>
                  </DrawerSectionCard>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => handleEdit(viewingJob)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  handleAssign(viewingJob);
                  setDrawerVisible(false);
                }}
              >
                <User className="h-4 w-4 mr-2" />
                Assign
              </Button>
            </div>
          </>
        )}
      </DetailsDrawer>

      {/* Filter Drawer */}
      <Sheet open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
        <SheetContent side="right" className="w-full sm:w-[400px] md:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filter Jobs</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Status</Label>
              <Select
                value={filters.status || 'all'}
                onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === 'all' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select
                value={filters.priority || 'all'}
                onValueChange={(value) => setFilters(prev => ({ ...prev, priority: value === 'all' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assigned To</Label>
              <Select
                value={filters.assignedTo || 'all'}
                onValueChange={(value) => setFilters(prev => ({ ...prev, assignedTo: value === 'all' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {platformAdmins.map(admin => (
                    <SelectItem key={admin.id} value={admin.id}>
                      {admin.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Linked Lead</Label>
              <Select
                value={filters.adminLeadId || 'all'}
                onValueChange={(value) => setFilters(prev => ({ ...prev, adminLeadId: value === 'all' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {adminLeads.map(lead => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.company || lead.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                setFilters({
                  status: '',
                  priority: '',
                  assignedTo: '',
                  adminLeadId: ''
                });
                setFilterDrawerOpen(false);
              }}
            >
              Reset Filters
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminJobs;
