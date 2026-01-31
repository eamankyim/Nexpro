import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Tag, Row, Col } from 'antd';
import { useDebounce } from '../hooks/useDebounce';
import { useResponsive } from '../hooks/useResponsive';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import WelcomeSection from '../components/WelcomeSection';
import DashboardStatsCard from '../components/DashboardStatsCard';
import DashboardTable from '../components/DashboardTable';
import FloatingActionButton from '../components/FloatingActionButton';
import {
  Plus,
  RefreshCw,
  Phone,
  Mail,
  Users,
  UserCog,
  MessageSquare,
  UserPlus,
  Loader2,
  CheckCircle,
  XCircle,
  TrendingUp,
  Filter,
  X,
  MoreVertical,
  Edit,
  Archive
} from 'lucide-react';
import dayjs from 'dayjs';
import DetailsDrawer from '../components/DetailsDrawer';
import DrawerSectionCard from '../components/DrawerSectionCard';
import ActionColumn from '../components/ActionColumn';
import PhoneNumberInput from '../components/PhoneNumberInput';
import StatusChip from '../components/StatusChip';
import TableSkeleton from '../components/TableSkeleton';
import DetailSkeleton from '../components/DetailSkeleton';
import leadService from '../services/leadService';
import userService from '../services/userService';
import customDropdownService from '../services/customDropdownService';
import { useAuth } from '../context/AuthContext';
import { useSmartSearch } from '../context/SmartSearchContext';
import { showSuccess, showError, showWarning } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Timeline, TimelineItem, TimelineIndicator, TimelineContent, TimelineTitle, TimelineDescription, TimelineTime } from '@/components/ui/timeline';
import { Descriptions, DescriptionItem } from '@/components/ui/descriptions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import MobileFormDialog from '../components/MobileFormDialog';
import FormFieldGrid from '../components/FormFieldGrid';
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
  SheetFooter,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SEARCH_PLACEHOLDERS, DEBOUNCE_DELAYS, PRIORITY_CHIP_CLASSES, STATUS_CHIP_DEFAULT_CLASS } from '../constants';

const leadSourceOptions = [
  { value: 'Social Media - Facebook', label: 'Social Media - Facebook' },
  { value: 'Social Media - Instagram', label: 'Social Media - Instagram' },
  { value: 'Online - Google', label: 'Online - Google' },
  { value: 'Online - Website', label: 'Online - Website' },
  { value: 'Referral', label: 'Referral' },
  { value: 'Walk-in', label: 'Walk-in' },
  { value: 'Phone Call', label: 'Phone Call' },
  { value: 'Email', label: 'Email' },
  { value: 'Event/Exhibition', label: 'Event/Exhibition' },
  { value: 'Cold Call', label: 'Cold Call' }
];

const leadSchema = z.object({
  name: z.string().min(1, 'Lead name is required'),
  email: z.string().min(1, 'Email is required').email('Please enter a valid email'),
  company: z.string().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']).default('new'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  assignedTo: z.string().optional(),
  nextFollowUp: z.date().optional().nullable(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

const activitySchema = z.object({
  type: z.enum(['call', 'email', 'meeting', 'note', 'task']),
  subject: z.string().optional(),
  notes: z.string().optional(),
  nextStep: z.string().optional(),
  followUpDate: z.date().optional().nullable(),
});

const statusSchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']),
  statusComment: z.string().optional(),
});

const Leads = () => {
  const { activeTenant } = useAuth();
  const { searchValue, setPageSearchConfig } = useSmartSearch();
  const debouncedSearch = useDebounce(searchValue, DEBOUNCE_DELAYS.SEARCH);
  const { isMobile } = useResponsive();
  const businessType = activeTenant?.businessType || 'printing_press';
  const isPrintingPress = businessType === 'printing_press';

  const [leads, setLeads] = useState([]);
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshingLeads, setRefreshingLeads] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    source: 'all',
    assignedTo: '',
    isActive: 'true'
  });
  const [leadModalVisible, setLeadModalVisible] = useState(false);
  const [activityModalVisible, setActivityModalVisible] = useState(false);
  const [viewingLead, setViewingLead] = useState(null);
  const [editingLead, setEditingLead] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [convertingLead, setConvertingLead] = useState(false);
  const [customLeadSources, setCustomLeadSources] = useState([]);
  const [showLeadSourceOtherInput, setShowLeadSourceOtherInput] = useState(false);
  const [leadSourceOtherValue, setLeadSourceOtherValue] = useState('');
  const [archiveLeadId, setArchiveLeadId] = useState(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archivingLead, setArchivingLead] = useState(false);
  const [convertLeadId, setConvertLeadId] = useState(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [updateStatusDialogOpen, setUpdateStatusDialogOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [leadBeingUpdated, setLeadBeingUpdated] = useState(null);

  const statusForm = useForm({
    resolver: zodResolver(statusSchema),
    defaultValues: {
      status: 'new',
      statusComment: '',
    },
  });

  const leadForm = useForm({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: '',
      company: '',
      email: '',
      phone: '',
      source: '',
      status: 'new',
      priority: 'medium',
      assignedTo: '',
      nextFollowUp: null,
      notes: '',
      tags: [],
    },
  });

  const activityForm = useForm({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      type: 'note',
      subject: '',
      notes: '',
      nextStep: '',
      followUpDate: null,
    },
  });

  useEffect(() => {
    fetchSummary();
    fetchUsers();
  }, []);

  useEffect(() => {
    setPageSearchConfig({ scope: 'leads', placeholder: SEARCH_PLACEHOLDERS.LEADS });
    return () => setPageSearchConfig(null);
  }, [setPageSearchConfig]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, [searchValue]);

  useEffect(() => {
    const loadCustomSources = async () => {
      try {
        const options = await customDropdownService.getCustomOptions('lead_source');
        setCustomLeadSources(options || []);
      } catch (error) {
        console.error('Failed to load custom lead sources:', error);
      }
    };
    loadCustomSources();
  }, []);

  // Pull-to-refresh hook
  const { isRefreshing, pullDistance, containerProps } = usePullToRefresh(
    () => {
      fetchLeads(true);
      fetchSummary();
    },
    { enabled: isMobile }
  );

  useEffect(() => {
    fetchLeads();
  }, [pagination.current, pagination.pageSize, filters, debouncedSearch]);

  const fetchUsers = async () => {
    try {
      const response = await userService.getAll({ limit: 100, isActive: true });
      const data = response?.data || response;
      setUsers(data?.data || data || []);
    } catch (error) {
      console.error('Failed to load users', error);
    }
  };

  const fetchSummary = async () => {
    setSummaryLoading(true);
    try {
      const response = await leadService.getSummary();
      setSummary(response?.data || {});
    } catch (error) {
      console.error('Failed to load lead summary', error);
      showError(error, 'Failed to load lead summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchLeads = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshingLeads(true);
    } else {
      setLoading(true);
    }
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        status: filters.status,
        priority: filters.priority,
        source: filters.source === 'all' ? undefined : filters.source,
        assignedTo: filters.assignedTo && filters.assignedTo !== 'all' ? filters.assignedTo : undefined,
        isActive: filters.isActive,
      };
      if (debouncedSearch) params.search = debouncedSearch;

      const response = await leadService.getAll(params);
      const payload = response || {};
      const rows = Array.isArray(payload.data) ? payload.data : [];
      setLeads(rows);
      setPagination((prev) => ({
        ...prev,
        total: payload.count || rows.length || 0
      }));
    } catch (error) {
      console.error('Failed to load leads', error);
      showError(error, 'Failed to load leads');
    } finally {
      setLoading(false);
      if (isRefresh) {
        setRefreshingLeads(false);
      }
    }
  };


  const openLeadModal = (lead = null) => {
    setEditingLead(lead);
    setShowLeadSourceOtherInput(false);
    setLeadSourceOtherValue('');
    if (lead) {
      leadForm.reset({
        name: lead.name,
        company: lead.company || '',
        email: lead.email || '',
        phone: lead.phone || '',
        source: lead.source || '',
        status: lead.status || 'new',
        priority: lead.priority || 'medium',
        assignedTo: lead.assignee?.id || lead.assignedTo || '',
        nextFollowUp: lead.nextFollowUp ? new Date(lead.nextFollowUp) : null,
        notes: lead.notes || '',
        tags: lead.tags || [],
      });
    } else {
      leadForm.reset({
        name: '',
        company: '',
        email: '',
        phone: '',
        source: 'website',
        status: 'new',
        priority: 'medium',
        assignedTo: '',
        nextFollowUp: null,
        notes: '',
        tags: [],
      });
    }
    setLeadModalVisible(true);
  };

  const handleLeadSourceChange = (value) => {
    leadForm.setValue('source', value);
    if (value === '__OTHER__') {
      setShowLeadSourceOtherInput(true);
    } else {
      setShowLeadSourceOtherInput(false);
    }
  };

  const handleSaveCustomLeadSource = async () => {
    if (!leadSourceOtherValue || !leadSourceOtherValue.trim()) {
      showWarning('Please enter a source name');
      return;
    }

    try {
      setSavingLeadSource(true);
      const saved = await customDropdownService.saveCustomOption('lead_source', leadSourceOtherValue.trim());
      if (saved) {
        setCustomLeadSources(prev => {
          if (prev.find(s => s.value === saved.value)) {
            return prev;
          }
          return [...prev, saved];
        });
        
        leadForm.setValue('source', saved.value);
        setShowLeadSourceOtherInput(false);
        setLeadSourceOtherValue('');
        showSuccess(`"${saved.label}" added to sources`);
      }
    } catch (error) {
      showError(error, error.response?.data?.error || 'Failed to save custom source');
    } finally {
      setSavingLeadSource(false);
    }
  };

  const getMergedLeadSourceOptions = () => {
    const merged = [...leadSourceOptions];
    customLeadSources.forEach(source => {
      if (!merged.find(s => s.value === source.value)) {
        merged.push({ value: source.value, label: source.label });
      }
    });
    return merged;
  };

  const onLeadSubmit = async (values) => {
    const payload = {
      ...values,
      nextFollowUp: values.nextFollowUp ? values.nextFollowUp.toISOString() : null
    };
    try {
      if (editingLead) {
        await leadService.update(editingLead.id, payload);
        showSuccess('Lead updated successfully');
      } else {
        await leadService.create(payload);
        showSuccess('Lead created successfully');
      }
      setLeadModalVisible(false);
      leadForm.reset();
      fetchLeads();
      fetchSummary();
    } catch (error) {
      console.error('Failed to save lead', error);
      showError(error, error?.response?.data?.message || 'Failed to save lead');
    }
  };

  const handleViewLead = async (record) => {
    setViewingLead(record);
    setDrawerVisible(true);
    try {
      const response = await leadService.getById(record.id);
      const data = response?.data || response;
      setViewingLead(data || record);
    } catch (error) {
      console.error('Failed to fetch lead', error);
      showError(error, 'Failed to load lead details');
    }
  };

  const handleConvertLead = (leadRecord = null) => {
    const targetLead = leadRecord || viewingLead;
    if (!targetLead) {
      return;
    }
    setConvertLeadId(targetLead.id);
    setConvertDialogOpen(true);
  };

  const handleConvertConfirm = async () => {
    if (!convertLeadId) return;
        try {
          setConvertingLead(true);
      const response = await leadService.convert(convertLeadId);
          const data = response?.data || response;
          if (data) {
            setViewingLead(data);
          }
          setDrawerVisible(true);
      showSuccess('Lead converted to customer');
          fetchLeads();
          fetchSummary();
      setConvertDialogOpen(false);
      setConvertLeadId(null);
        } catch (error) {
          console.error('Failed to convert lead', error);
      showError(error, error?.response?.data?.message || 'Failed to convert lead');
        } finally {
          setConvertingLead(false);
        }
  };

  useEffect(() => {
    if (viewingLead) {
      setActivityModalVisible(false);
    }
  }, [viewingLead]);

  const openActivityModal = () => {
    activityForm.reset({
      type: 'note',
      subject: '',
      notes: '',
      nextStep: '',
      followUpDate: null,
    });
    setActivityModalVisible(true);
  };

  const onActivitySubmit = async (values) => {
    if (!viewingLead) return;
    try {
      await leadService.addActivity(viewingLead.id, {
        ...values,
        followUpDate: values.followUpDate ? values.followUpDate.toISOString() : null
      });
      showSuccess('Activity added successfully');
      setActivityModalVisible(false);
      handleViewLead({ id: viewingLead.id });
      fetchLeads();
      fetchSummary();
    } catch (error) {
      console.error('Failed to add activity', error);
      showError(error, error?.response?.data?.message || 'Failed to add activity');
    }
  };

  const handleArchiveLead = (record) => {
    setArchiveLeadId(record.id);
    setArchiveDialogOpen(true);
  };

  const handleArchiveConfirm = async () => {
    if (!archiveLeadId) return;
    try {
      setArchivingLead(true);
      await leadService.archive(archiveLeadId);
      showSuccess('Lead archived');
          await fetchLeads();
          fetchSummary();
      setArchiveDialogOpen(false);
      setArchiveLeadId(null);
        } catch (error) {
          console.error('Failed to archive lead', error);
      showError(error, error?.response?.data?.message || 'Failed to archive lead');
        } finally {
          setArchivingLead(false);
        }
  };

  const openStatusModal = (lead) => {
    setLeadBeingUpdated(lead);
    setUpdateStatusDialogOpen(true);
    statusForm.reset({
      status: lead.status || 'new',
      statusComment: '',
    });
  };

  const closeStatusModal = () => {
    setUpdateStatusDialogOpen(false);
    setLeadBeingUpdated(null);
    statusForm.reset();
  };

  const handleStatusSubmit = async ({ status, statusComment }) => {
    if (!leadBeingUpdated) {
      return;
    }

    const leadId = leadBeingUpdated.id;

    try {
      setUpdatingStatus(true);
      await leadService.update(leadId, {
        status,
        statusComment: statusComment || undefined
      });
      showSuccess('Lead status updated successfully');
      closeStatusModal();
      
      // Refresh lead details if drawer is open
      if (drawerVisible && viewingLead?.id === leadId) {
        handleViewLead({ id: leadId });
      }
      
      fetchLeads();
      fetchSummary();
    } catch (error) {
      console.error('Failed to update lead status', error);
      showError(error, error?.response?.data?.message || 'Failed to update lead status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const tableColumns = useMemo(() => [
    {
      key: 'name',
      label: 'Lead',
      render: (_, record) => (
        <div>
          <div className="font-semibold">{record.name || '—'}</div>
          <div className="text-muted-foreground text-sm">
            {record.company || '—'}
          </div>
        </div>
      )
    },
    {
      key: 'email',
      label: 'Email',
      render: (_, record) =>
        record.email ? (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-black" />
            <a href={`mailto:${record.email}`} className="text-black hover:underline">{record.email}</a>
          </div>
        ) : (
          '—'
        )
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (_, record) =>
        record.phone ? (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-black" />
            <span>{record.phone}</span>
          </div>
        ) : (
          '—'
        )
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, record) => (
        <StatusChip status={record.status} />
      )
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (_, record) => (
        <Badge
          variant="outline"
          className={PRIORITY_CHIP_CLASSES[record.priority] ?? STATUS_CHIP_DEFAULT_CLASS}
        >
          {record.priority?.toUpperCase()}
        </Badge>
      )
    },
    {
      key: 'source',
      label: 'Source',
      render: (_, record) => {
        const matched = leadSourceOptions.find((option) => option.value === record.source);
        return matched ? matched.label : record.source || '—';
      }
    },
    {
      key: 'assignedTo',
      label: 'Assigned To',
      render: (_, record) =>
        record.assignee?.name ||
        (record.assignedTo ? 'Unresolved' : 'Unassigned')
    },
    {
      key: 'nextFollowUp',
      label: 'Next Follow-up',
      render: (_, record) =>
        record.nextFollowUp ? dayjs(record.nextFollowUp).format('MMM DD, YYYY HH:mm') : '—'
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, record) => (
        <ActionColumn
          record={record}
          onView={handleViewLead}
          extraActions={[
            record.status !== 'converted' && !record.convertedCustomerId && {
              label: 'Convert to Customer',
              onClick: () => handleConvertLead(record),
              icon: <UserPlus className="h-4 w-4" />
            },
            {
              label: 'Edit',
              onClick: () => openLeadModal(record),
              icon: <UserCog className="h-4 w-4" />
            },
            {
              label: 'Archive',
              onClick: () => handleArchiveLead(record),
              icon: <Users className="h-4 w-4" />,
              danger: true
            }
          ].filter(Boolean)}
        />
      )
    }
  ], [handleViewLead, handleConvertLead, openLeadModal, handleArchiveLead]);


  const drawerTabs = useMemo(() => {
    if (!viewingLead) return [];
    const activities = viewingLead.activities || [];

    // Add creation activity at the beginning
    const creationActivity = {
      id: 'creation',
      type: 'creation',
      createdAt: viewingLead.createdAt,
      createdByUser: viewingLead.createdByUser || null
    };

    const allActivities = [creationActivity, ...activities];

    const timelineItems = allActivities.map((activity, index) => {
      const isLast = index === allActivities.length - 1;
      
      if (activity.type === 'creation') {
        return (
          <TimelineItem key={activity.id} isLast={isLast}>
            <TimelineIndicator />
            <TimelineContent>
              <TimelineTitle className="text-black">
                {activity.createdByUser 
                  ? `${activity.createdByUser.name} added a new lead, ${viewingLead.name}`
                  : `Added a new lead, ${viewingLead.name}`}
              </TimelineTitle>
              <TimelineTime className="text-black">
                {dayjs(activity.createdAt).format('MMM DD, YYYY [at] h:mm A')}
              </TimelineTime>
            </TimelineContent>
          </TimelineItem>
        );
      }

      return (
        <TimelineItem key={activity.id} isLast={isLast}>
          <TimelineIndicator />
          <TimelineContent>
            <TimelineTitle className="text-black">
              {activity.type.toUpperCase()} {activity.subject ? `- ${activity.subject}` : ''}
            </TimelineTitle>
            <TimelineTime className="text-black">
              {dayjs(activity.createdAt).format('MMM DD, YYYY [at] h:mm A')}
              {activity.createdByUser ? ` • ${activity.createdByUser.name}` : ''}
            </TimelineTime>
            {activity.notes && (
              <TimelineDescription className="text-black">{activity.notes}</TimelineDescription>
            )}
            {activity.nextStep && (
              <TimelineDescription className="text-black">Next Step: {activity.nextStep}</TimelineDescription>
            )}
            {activity.followUpDate && (
              <TimelineDescription className="text-black">
                Follow-up: {dayjs(activity.followUpDate).format('MMM DD, YYYY hh:mm A')}
              </TimelineDescription>
            )}
          </TimelineContent>
        </TimelineItem>
      );
    });

    return [
      {
        key: 'overview',
        label: 'Overview',
        content: (
          <DrawerSectionCard title="Lead details">
            <div className="space-y-4">
              {viewingLead.status === 'converted' && (
                <Alert>
                  <AlertTitle>Lead converted</AlertTitle>
                  <AlertDescription>
                    {viewingLead.convertedCustomer
                      ? `Customer profile created for ${viewingLead.convertedCustomer.name}.`
                      : 'This lead has been converted.'}
                  </AlertDescription>
                </Alert>
              )}
              <Descriptions column={1} className="space-y-0">
                <DescriptionItem label="Name">
                  <span className="text-black">{viewingLead.name}</span>
                </DescriptionItem>
                <DescriptionItem label="Status">
                  <StatusChip status={viewingLead.status} />
                </DescriptionItem>
                <DescriptionItem label="Priority">
                  <Badge
                    variant="outline"
                    className={PRIORITY_CHIP_CLASSES[viewingLead.priority] ?? STATUS_CHIP_DEFAULT_CLASS}
                  >
                    {viewingLead.priority?.toUpperCase()}
                  </Badge>
                </DescriptionItem>
                <DescriptionItem label="Company">
                  <span className="text-black">{viewingLead.company || '—'}</span>
                </DescriptionItem>
                <DescriptionItem label="Email">
                  <span className="text-black">{viewingLead.email || '—'}</span>
                </DescriptionItem>
                <DescriptionItem label="Phone">
                  <span className="text-black">{viewingLead.phone || '—'}</span>
                </DescriptionItem>
                <DescriptionItem label="Source">
                  <span className="text-black">{viewingLead.source || '—'}</span>
                </DescriptionItem>
                <DescriptionItem label="Assigned To">
                  <span className="text-black">{viewingLead.assignee?.name || 'Unassigned'}</span>
                </DescriptionItem>
                <DescriptionItem label="Next Follow-Up">
                  <span className="text-black">
                    {viewingLead.nextFollowUp ? dayjs(viewingLead.nextFollowUp).format('MMM DD, YYYY hh:mm A') : '—'}
                  </span>
                </DescriptionItem>
                <DescriptionItem label="Last Contacted">
                  <span className="text-black">
                    {viewingLead.lastContactedAt ? dayjs(viewingLead.lastContactedAt).format('MMM DD, YYYY hh:mm A') : '—'}
                  </span>
                </DescriptionItem>
                {viewingLead.convertedCustomer && (
                  <DescriptionItem label="Converted Customer">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{viewingLead.convertedCustomer.name}</Badge>
                      {viewingLead.convertedCustomer.company && (
                        <span className="text-black">{viewingLead.convertedCustomer.company}</span>
                      )}
                    </div>
                  </DescriptionItem>
                )}
                {viewingLead.convertedJob && isPrintingPress && (
                  <DescriptionItem label="Linked Job">
                    <div className="flex items-center gap-2">
                      <Badge variant="default">{viewingLead.convertedJob.jobNumber}</Badge>
                      <span className="text-black">{viewingLead.convertedJob.title}</span>
                    </div>
                  </DescriptionItem>
                )}
                <DescriptionItem label="Tags">
                  {(viewingLead.tags || []).length
                    ? viewingLead.tags.map((tag) => <Badge key={tag} variant="outline" className="mr-1">{tag}</Badge>)
                    : <span className="text-black">—</span>}
                </DescriptionItem>
                <DescriptionItem label="Notes">
                  <span className="text-black">{viewingLead.notes || '—'}</span>
                </DescriptionItem>
              </Descriptions>
            </div>
          </DrawerSectionCard>
        )
      },
      {
        key: 'activities',
        label: 'Activity',
        content: (
          <DrawerSectionCard title="Activity">
            {timelineItems.length ? (
              <Timeline>
                {timelineItems}
              </Timeline>
            ) : (
              <Alert>
                <AlertTitle>No activity logged yet.</AlertTitle>
              </Alert>
            )}
          </DrawerSectionCard>
        )
      }
    ];
  }, [viewingLead]);

  const statusOptions = ['all', 'new', 'contacted', 'qualified', 'converted', 'lost'];
  const priorityOptions = ['all', 'low', 'medium', 'high'];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        <WelcomeSection
          welcomeMessage="Leads"
          subText="Track prospects and follow-ups for customer service and marketing."
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setFilterDrawerOpen(true)} size={isMobile ? "icon" : "default"}>
            <Filter className="h-4 w-4" />
            {!isMobile && <span className="ml-2">Filter</span>}
          </Button>
          <Button 
            variant="outline" 
            onClick={async () => { 
              await fetchLeads(true); 
              fetchSummary(); 
            }}
            disabled={refreshingLeads}
            size={isMobile ? "icon" : "default"}
          >
            {refreshingLeads ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {!isMobile && <span className="ml-2">Refresh</span>}
          </Button>
          <Button onClick={() => openLeadModal()} size={isMobile ? "icon" : "default"}>
            <Plus className="h-4 w-4" />
            {!isMobile && <span className="ml-2">New Lead</span>}
          </Button>
        </div>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* Total Leads Card */}
        <Col xs={24} sm={12} lg={6}>
          <div style={{ opacity: summaryLoading ? 0.5 : 1 }}>
            <DashboardStatsCard
              title="Total Leads"
              value={summary?.totals?.totalLeads || 0}
              icon={Users}
              iconBgColor="rgba(22, 101, 52, 0.1)"
              iconColor="#166534"
            />
          </div>
        </Col>

        {/* Qualified Card */}
        <Col xs={24} sm={12} lg={6}>
          <div style={{ opacity: summaryLoading ? 0.5 : 1 }}>
            <DashboardStatsCard
              title="Qualified"
              value={summary?.totals?.qualifiedLeads || 0}
              icon={CheckCircle}
              iconBgColor="rgba(59, 130, 246, 0.1)"
              iconColor="#166534"
            />
          </div>
        </Col>

        {/* Converted Card */}
        <Col xs={24} sm={12} lg={6}>
          <div style={{ opacity: summaryLoading ? 0.5 : 1 }}>
            <DashboardStatsCard
              title="Converted"
              value={summary?.totals?.convertedLeads || 0}
              icon={TrendingUp}
              iconBgColor="rgba(132, 204, 22, 0.1)"
              iconColor="#84cc16"
            />
          </div>
        </Col>

        {/* Lost Card */}
        <Col xs={24} sm={12} lg={6}>
          <div style={{ opacity: summaryLoading ? 0.5 : 1 }}>
            <DashboardStatsCard
              title="Lost"
              value={summary?.totals?.lostLeads || 0}
              icon={XCircle}
              iconBgColor="rgba(239, 68, 68, 0.1)"
              iconColor="#ef4444"
            />
          </div>
        </Col>
      </Row>

      {/* Main Content Area with Pull-to-Refresh */}
      <div {...containerProps} className="relative">
        {/* Pull-to-refresh indicator */}
        {isMobile && pullDistance > 0 && (
          <div 
            className="absolute top-0 left-0 right-0 flex items-center justify-center z-10 transition-opacity"
            style={{
              height: `${Math.min(pullDistance, 80)}px`,
              opacity: Math.min(pullDistance / 80, 1),
            }}
          >
            {isRefreshing ? (
              <Loader2 className="h-6 w-6 animate-spin text-[#166534]" />
            ) : (
              <RefreshCw className="h-6 w-6 text-[#166534]" />
            )}
          </div>
        )}
        
        <DashboardTable
          data={leads}
          columns={tableColumns}
          loading={loading || (isMobile && isRefreshing)}
          title={null}
          emptyIcon={<Users className="h-12 w-12 text-muted-foreground" />}
          emptyDescription="No leads found"
          pageSize={pagination.pageSize}
          externalPagination={{ current: pagination.current, total: pagination.total }}
          onPageChange={(newPagination) => {
            setPagination(newPagination);
          }}
        />
      </div>

      {/* Floating Action Button for Mobile */}
      <FloatingActionButton
        onClick={() => openLeadModal()}
        icon={Plus}
        label="Add Lead"
        show={isMobile}
      />

      {/* Filter Drawer */}
      <Sheet open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-lg overflow-y-auto" 
          style={{ borderRadius: '8px', top: '8px', bottom: '8px', right: '8px', height: 'calc(100vh - 16px)' }}
        >
          <SheetHeader className="border-b pb-4 mb-4" style={{ marginLeft: '-24px', marginRight: '-24px', paddingLeft: '24px', paddingRight: '24px' }}>
            <SheetTitle className="text-lg font-semibold">Select filters below</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 md:space-y-6">
            {/* Status Filter */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Status</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, status: 'all' }));
                  }}
                >
                  Reset
                </Button>
              </div>
              <Select
                value={filters.status}
                onValueChange={(value) => {
                  setPagination((prev) => ({ ...prev, current: 1 }));
                  setFilters((prev) => ({ ...prev, status: value }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option === 'all' ? 'All Statuses' : option.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority Filter */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Priority</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, priority: 'all' }));
                  }}
                >
                  Reset
                </Button>
              </div>
              <Select
                value={filters.priority}
                onValueChange={(value) => {
                  setPagination((prev) => ({ ...prev, current: 1 }));
                  setFilters((prev) => ({ ...prev, priority: value }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option === 'all' ? 'All Priorities' : option.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Source Filter */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Source</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, source: 'all' }));
                  }}
                >
                  Reset
                </Button>
              </div>
              <Select
                value={filters.source}
                onValueChange={(value) => {
                  setPagination((prev) => ({ ...prev, current: 1 }));
                  setFilters((prev) => ({ ...prev, source: value }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {leadSourceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assigned To Filter */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Assigned To</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, assignedTo: 'all' }));
                  }}
                >
                  Reset
                </Button>
              </div>
              <Select
                value={filters.assignedTo || 'all'}
                onValueChange={(value) => {
                  setPagination((prev) => ({ ...prev, current: 1 }));
                  setFilters((prev) => ({ ...prev, assignedTo: value === 'all' ? '' : value }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Type Filter */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Status Type</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, isActive: 'true' }));
                  }}
                >
                  Reset
                </Button>
              </div>
              <Select
                value={filters.isActive}
                onValueChange={(value) => {
                  setPagination((prev) => ({ ...prev, current: 1 }));
                  setFilters((prev) => ({ ...prev, isActive: value }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Archived</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter className="border-t pt-4 mt-6">
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setPagination((prev) => ({ ...prev, current: 1 }));
                  setFilters({
                    status: 'all',
                    priority: 'all',
                    source: 'all',
                    assignedTo: 'all',
                    isActive: 'true'
                  });
                }}
              >
                Reset all
              </Button>
              <Button
                className="flex-1"
                onClick={() => setFilterDrawerOpen(false)}
              >
                Show results
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <DetailsDrawer
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setViewingLead(null);
        }}
        title={viewingLead ? viewingLead.name : 'Lead details'}
        width={720}
        extra={
          viewingLead && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  style={{ marginRight: '32px' }}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => openLeadModal(viewingLead)}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => openStatusModal(viewingLead)}
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Update Status
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleArchiveLead(viewingLead)}
                  className="flex items-center gap-2 text-destructive focus:text-destructive"
                >
                  <Archive className="h-4 w-4" />
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
        extraActions={
          viewingLead
            ? [
                !viewingLead.convertedCustomerId && {
                  key: 'convert',
                  label: convertingLead ? 'Converting...' : 'Convert to Customer',
                  icon: <UserPlus className="h-4 w-4" />,
                  onClick: () => handleConvertLead(viewingLead),
                  variant: 'secondary'
                },
                {
                  key: 'log-activity',
                  label: 'Log Activity',
                  icon: <MessageSquare className="h-4 w-4" />,
                  onClick: openActivityModal,
                  variant: 'default'
                }
              ].filter(Boolean)
            : []
        }
        tabs={drawerTabs}
      />

      {/* Update Status Dialog */}
      <MobileFormDialog
        open={updateStatusDialogOpen}
        onOpenChange={(open) => !open && closeStatusModal()}
        title={leadBeingUpdated ? `Update Status - ${leadBeingUpdated.name}` : 'Update Status'}
        description="Update the status of this lead and optionally add a comment."
        footer={
          <>
            <Button type="button" variant="outline" onClick={closeStatusModal}>
              Cancel
            </Button>
            <Button type="submit" form="status-form" loading={updatingStatus}>
              Update Status
            </Button>
          </>
        }
      >
        <Form {...statusForm}>
          <form id="status-form" onSubmit={statusForm.handleSubmit(handleStatusSubmit)} className="space-y-4">
            <FormField
              control={statusForm.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="converted">Converted</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={statusForm.control}
              name="statusComment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comment</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Add an optional comment for this status update" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </MobileFormDialog>

      <MobileFormDialog
        open={leadModalVisible}
        onOpenChange={setLeadModalVisible}
        title={editingLead ? `Edit Lead (${editingLead.name})` : 'New Lead'}
        description={editingLead ? 'Update lead information' : 'Add a new lead to your system'}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLeadModalVisible(false);
                setShowLeadSourceOtherInput(false);
                setLeadSourceOtherValue('');
              }}
            >
              Cancel
            </Button>
            <Button type="submit" form="lead-form" loading={leadForm.formState.isSubmitting}>
              {editingLead ? 'Update Lead' : 'Create Lead'}
            </Button>
          </>
        }
      >
        <Form {...leadForm}>
          <form id="lead-form" onSubmit={leadForm.handleSubmit(onLeadSubmit)} className="space-y-4">
            <FormFieldGrid columns={2}>
              <FormField
                control={leadForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Contact or company name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={leadForm.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Company" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormFieldGrid>

            <FormFieldGrid columns={2}>
              <FormField
                control={leadForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="Email address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={leadForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <PhoneNumberInput {...field} placeholder="Enter phone number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormFieldGrid>

            <FormFieldGrid columns={2}>
                <FormField
                  control={leadForm.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lead Source (optional)</FormLabel>
                      <Select value={field.value} onValueChange={handleLeadSourceChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select lead source" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                {getMergedLeadSourceOptions().map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                    {option.label}
                            </SelectItem>
                ))}
                          <SelectItem value="__OTHER__">Other (specify)</SelectItem>
                        </SelectContent>
              </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={leadForm.control}
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned To</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select team member" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name} ({user.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </FormFieldGrid>

            {showLeadSourceOtherInput && (
                <div className="flex gap-2">
                    <Input
                      placeholder="e.g., Trade Show, Partner Referral"
                      value={leadSourceOtherValue}
                      onChange={(e) => setLeadSourceOtherValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveCustomLeadSource();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button type="button" onClick={handleSaveCustomLeadSource} loading={savingLeadSource}>
                    Save
                  </Button>
                </div>
              )}

            <FormFieldGrid columns={2}>
              <FormField
                control={leadForm.control}
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
                        {['new', 'contacted', 'qualified', 'converted', 'lost'].map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={leadForm.control}
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
                        {['low', 'medium', 'high'].map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {priority.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormFieldGrid>

            <FormFieldGrid columns={2}>
                <FormField
                  control={leadForm.control}
                  name="nextFollowUp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Next Follow-up</FormLabel>
                      <FormControl>
                        <DatePicker
                          date={field.value}
                          onSelect={(date) => field.onChange(date)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={leadForm.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value?.join(', ') || ''}
                          onChange={(e) => {
                            const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                            field.onChange(tags);
                          }}
                          placeholder="Add tags separated by commas"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </FormFieldGrid>

            <FormField
                control={leadForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} placeholder="Internal notes or context" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

          </form>
        </Form>
      </MobileFormDialog>

      <MobileFormDialog
        open={activityModalVisible}
        onOpenChange={setActivityModalVisible}
        title="Log Activity"
        description="Record an interaction with this lead"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setActivityModalVisible(false)}
            >
              Cancel
            </Button>
            <Button type="submit" form="activity-form" loading={activityForm.formState.isSubmitting}>
              Save Activity
            </Button>
          </>
        }
      >
        <Form {...activityForm}>
          <form id="activity-form" onSubmit={activityForm.handleSubmit(onActivitySubmit)} className="space-y-4">
            <FormField
              control={activityForm.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Activity Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="note">Note</SelectItem>
                      <SelectItem value="task">Task</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={activityForm.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Short subject or summary" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={activityForm.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} placeholder="Details of the interaction" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={activityForm.control}
              name="nextStep"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Next Step</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Optional next step" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={activityForm.control}
              name="followUpDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Follow-up Date</FormLabel>
                  <FormControl>
                    <DatePicker
                      date={field.value}
                      onSelect={(date) => field.onChange(date)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </MobileFormDialog>

      <AlertDialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert Lead to Customer</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a customer record using the lead details. You can adjust the customer later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConvertConfirm} loading={convertingLead}>
              Convert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive this lead? You can restore it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleArchiveConfirm} 
              className="bg-destructive text-destructive-foreground"
              loading={archivingLead}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Leads;
