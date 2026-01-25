import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Table, Tag, Card as AntdCard, Row, Col } from 'antd';
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
  TrendingUp
} from 'lucide-react';
import dayjs from 'dayjs';
import DetailsDrawer from '../components/DetailsDrawer';
import ActionColumn from '../components/ActionColumn';
import PhoneNumberInput from '../components/PhoneNumberInput';
import StatusChip from '../components/StatusChip';
import TableSkeleton from '../components/TableSkeleton';
import DetailSkeleton from '../components/DetailSkeleton';
import leadService from '../services/leadService';
import userService from '../services/userService';
import customDropdownService from '../services/customDropdownService';
import { useAuth } from '../context/AuthContext';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';


const priorityColors = {
  low: 'secondary',
  medium: 'default',
  high: 'destructive'
};

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
  company: z.string().optional(),
  email: z.string().email('Please enter a valid email').optional().or(z.literal('')),
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

const Leads = () => {
  const { activeTenant } = useAuth();
  const businessType = activeTenant?.businessType || 'printing_press';
  const isPrintingPress = businessType === 'printing_press';
  
  const [leads, setLeads] = useState([]);
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
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
  const [convertLeadId, setConvertLeadId] = useState(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);

  const leadForm = useForm({
    resolver: zodResolver(leadSchema),
    defaultValues: {
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

  useEffect(() => {
    fetchLeads();
  }, [pagination.current, pagination.pageSize, filters]);

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

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        status: filters.status,
        priority: filters.priority,
        source: filters.source === 'all' ? undefined : filters.source,
        assignedTo: filters.assignedTo || undefined,
        isActive: filters.isActive
      };

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
    }
  };

  const handleTableChange = (newPagination) => {
    setPagination((prev) => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize
    }));
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
      await leadService.archive(archiveLeadId);
      showSuccess('Lead archived');
          fetchLeads();
          fetchSummary();
      setArchiveDialogOpen(false);
      setArchiveLeadId(null);
        } catch (error) {
          console.error('Failed to archive lead', error);
      showError(error, error?.response?.data?.message || 'Failed to archive lead');
        }
  };

  const columns = useMemo(() => [
    {
      title: 'Lead',
      dataIndex: 'name',
      key: 'name',
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
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email) =>
        email ? (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <a href={`mailto:${email}`} className="text-primary hover:underline">{email}</a>
          </div>
        ) : (
          '—'
        )
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone) =>
        phone ? (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-green-500" />
            <span>{phone}</span>
          </div>
        ) : (
          '—'
        )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <StatusChip status={status} />
      )
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => (
        <Badge variant={priorityColors[priority] || 'default'}>{priority?.toUpperCase()}</Badge>
      )
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      render: (source) => {
        const matched = leadSourceOptions.find((option) => option.value === source);
        return matched ? matched.label : source || '—';
      }
    },
    {
      title: 'Assigned To',
      dataIndex: ['assignee', 'name'],
      key: 'assignedTo',
      render: (_, record) =>
        record.assignee?.name ||
        (record.assignedTo ? 'Unresolved' : 'Unassigned')
    },
    {
      title: 'Next Follow-up',
      dataIndex: 'nextFollowUp',
      key: 'nextFollowUp',
      render: (date) =>
        date ? dayjs(date).format('MMM DD, YYYY HH:mm') : '—'
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
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
  ], []);


  const drawerTabs = useMemo(() => {
    if (!viewingLead) return [];
    const activities = viewingLead.activities || [];

    const timelineItems = activities.map((activity) => (
      <TimelineItem key={activity.id}>
        <TimelineIndicator className={
          activity.type === 'call' ? 'bg-green-500' :
          activity.type === 'email' ? 'bg-[#166534]' :
          activity.type === 'meeting' ? 'bg-purple-500' : 'bg-gray-500'
        } />
        <TimelineContent>
          <TimelineTitle>
            {activity.type.toUpperCase()} {activity.subject ? `- ${activity.subject}` : ''}
          </TimelineTitle>
          <TimelineTime>
            {dayjs(activity.createdAt).format('MMM DD, YYYY [at] h:mm A')}
            {activity.createdByUser ? ` • ${activity.createdByUser.name}` : ''}
          </TimelineTime>
          {activity.notes && (
            <TimelineDescription>{activity.notes}</TimelineDescription>
          )}
          {activity.nextStep && (
            <TimelineDescription>Next Step: {activity.nextStep}</TimelineDescription>
          )}
          {activity.followUpDate && (
            <TimelineDescription>
              Follow-up: {dayjs(activity.followUpDate).format('MMM DD, YYYY hh:mm A')}
            </TimelineDescription>
          )}
        </TimelineContent>
      </TimelineItem>
    ));

    return [
      {
        key: 'overview',
        label: 'Overview',
        content: (
          <div className="space-y-6">
            <Separator />

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

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    <StatusChip status={viewingLead.status} />
                  </div>
                </CardContent>
                </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Priority</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    <Badge variant={priorityColors[viewingLead.priority]}>{viewingLead.priority?.toUpperCase()}</Badge>
                  </div>
                </CardContent>
                </Card>
            </div>

            <Descriptions column={1}>
              <DescriptionItem label="Name">{viewingLead.name}</DescriptionItem>
              <DescriptionItem label="Company">{viewingLead.company || '—'}</DescriptionItem>
              <DescriptionItem label="Email">{viewingLead.email || '—'}</DescriptionItem>
              <DescriptionItem label="Phone">{viewingLead.phone || '—'}</DescriptionItem>
              <DescriptionItem label="Source">{viewingLead.source || '—'}</DescriptionItem>
              <DescriptionItem label="Assigned To">{viewingLead.assignee?.name || 'Unassigned'}</DescriptionItem>
              <DescriptionItem label="Next Follow-Up">
                {viewingLead.nextFollowUp ? dayjs(viewingLead.nextFollowUp).format('MMM DD, YYYY hh:mm A') : '—'}
              </DescriptionItem>
              <DescriptionItem label="Last Contacted">
                {viewingLead.lastContactedAt ? dayjs(viewingLead.lastContactedAt).format('MMM DD, YYYY hh:mm A') : '—'}
              </DescriptionItem>
              {viewingLead.convertedCustomer && (
                <DescriptionItem label="Converted Customer">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{viewingLead.convertedCustomer.name}</Badge>
                    {viewingLead.convertedCustomer.company && (
                      <span className="text-muted-foreground">{viewingLead.convertedCustomer.company}</span>
                    )}
                  </div>
                </DescriptionItem>
              )}
              {viewingLead.convertedJob && isPrintingPress && (
                <DescriptionItem label="Linked Job">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{viewingLead.convertedJob.jobNumber}</Badge>
                    <span>{viewingLead.convertedJob.title}</span>
                  </div>
                </DescriptionItem>
              )}
              <DescriptionItem label="Tags">
                {(viewingLead.tags || []).length
                  ? viewingLead.tags.map((tag) => <Badge key={tag} variant="outline" className="mr-1">{tag}</Badge>)
                  : '—'}
              </DescriptionItem>
              <DescriptionItem label="Notes">{viewingLead.notes || '—'}</DescriptionItem>
            </Descriptions>
          </div>
        )
      },
      {
        key: 'activities',
        label: 'Activity',
        content: timelineItems.length ? (
          <Timeline>
            {timelineItems}
          </Timeline>
        ) : (
          <Alert>
            <AlertTitle>No activity logged yet.</AlertTitle>
          </Alert>
        )
      }
    ];
  }, [viewingLead]);

  const statusOptions = ['all', 'new', 'contacted', 'qualified', 'converted', 'lost'];
  const priorityOptions = ['all', 'low', 'medium', 'high'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground">Track prospects and follow-ups for customer service and marketing.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { fetchLeads(); fetchSummary(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          <Button onClick={() => openLeadModal()}>
            <Plus className="h-4 w-4 mr-2" />
              New Lead
            </Button>
        </div>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* Total Leads Card */}
        <Col xs={24} sm={12} lg={6}>
          <AntdCard
            bodyStyle={{ padding: 20 }}
            style={{
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              backgroundColor: 'white',
              opacity: summaryLoading ? 0.5 : 1
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: '#666', fontWeight: 700 }}>Total Leads</div>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: 'rgba(22, 101, 52, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Users className="h-5 w-5" style={{ color: '#166534' }} />
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.2 }}>
                {summary?.totals?.totalLeads || 0}
              </div>
            </div>
          </AntdCard>
        </Col>

        {/* Qualified Card */}
        <Col xs={24} sm={12} lg={6}>
          <AntdCard
            bodyStyle={{ padding: 20 }}
            style={{
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              backgroundColor: 'white',
              opacity: summaryLoading ? 0.5 : 1
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: '#666', fontWeight: 700 }}>Qualified</div>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CheckCircle className="h-5 w-5" style={{ color: '#166534' }} />
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.2 }}>
                {summary?.totals?.qualifiedLeads || 0}
              </div>
            </div>
          </AntdCard>
          </Col>

        {/* Converted Card */}
        <Col xs={24} sm={12} lg={6}>
          <AntdCard
            bodyStyle={{ padding: 20 }}
            style={{
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              backgroundColor: 'white',
              opacity: summaryLoading ? 0.5 : 1
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: '#666', fontWeight: 700 }}>Converted</div>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: 'rgba(132, 204, 22, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <TrendingUp className="h-5 w-5" style={{ color: '#84cc16' }} />
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.2 }}>
                {summary?.totals?.convertedLeads || 0}
              </div>
            </div>
          </AntdCard>
          </Col>

        {/* Lost Card */}
        <Col xs={24} sm={12} lg={6}>
          <AntdCard
            bodyStyle={{ padding: 20 }}
            style={{
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              backgroundColor: 'white',
              opacity: summaryLoading ? 0.5 : 1
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: '#666', fontWeight: 700 }}>Lost</div>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <XCircle className="h-5 w-5" style={{ color: '#ef4444' }} />
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.2 }}>
                {summary?.totals?.lostLeads || 0}
              </div>
            </div>
          </AntdCard>
        </Col>
      </Row>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
                  {option.toUpperCase()}
                  </SelectItem>
              ))}
              </SelectContent>
            </Select>
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
                  {option.toUpperCase()}
                  </SelectItem>
              ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.source}
              onValueChange={(value) => {
                setPagination((prev) => ({ ...prev, current: 1 }));
                setFilters((prev) => ({ ...prev, source: value }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by source" />
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
            <Select
              value={filters.assignedTo || undefined}
              onValueChange={(value) => {
                setPagination((prev) => ({ ...prev, current: 1 }));
                setFilters((prev) => ({ ...prev, assignedTo: value || '' }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by assignee" />
              </SelectTrigger>
              <SelectContent>
              {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                  {user.name} ({user.email})
                  </SelectItem>
              ))}
              </SelectContent>
            </Select>
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
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <div className="p-4">
            <TableSkeleton rows={8} cols={7} />
          </div>
        </Card>
      ) : (
        <Table
          columns={columns}
          dataSource={leads}
          rowKey="id"
          pagination={pagination}
          onChange={handleTableChange}
          scroll={{ x: 1000 }}
        />
      )}

      <DetailsDrawer
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setViewingLead(null);
        }}
        title={viewingLead ? viewingLead.name : 'Lead details'}
        width={720}
        onEdit={viewingLead ? () => openLeadModal(viewingLead) : null}
        extraActions={
          viewingLead
            ? [
                !viewingLead.convertedCustomerId && {
                  key: 'convert',
                  label: convertingLead ? 'Converting...' : 'Convert to Customer',
                  icon: <UserPlus className="h-4 w-4" />,
                  onClick: () => handleConvertLead(viewingLead),
                },
                {
                  key: 'log-activity',
                  label: 'Log Activity',
                  icon: <MessageSquare className="h-4 w-4" />,
                  onClick: openActivityModal
                }
              ].filter(Boolean)
            : []
        }
        tabs={drawerTabs}
      />

      <Dialog open={leadModalVisible} onOpenChange={setLeadModalVisible}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLead ? `Edit Lead (${editingLead.name})` : 'New Lead'}</DialogTitle>
            <DialogDescription>
              {editingLead ? 'Update lead information' : 'Add a new lead to your system'}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...leadForm}>
            <form onSubmit={leadForm.handleSubmit(onLeadSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={leadForm.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lead Source</FormLabel>
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
              </div>

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
                  <Button type="button" onClick={handleSaveCustomLeadSource}>
                      Save
                    </Button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              </div>

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

              <DialogFooter>
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
                <Button type="submit" disabled={leadForm.formState.isSubmitting}>
                  {leadForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingLead ? 'Update Lead' : 'Create Lead'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={activityModalVisible} onOpenChange={setActivityModalVisible}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Activity</DialogTitle>
            <DialogDescription>Record an interaction with this lead</DialogDescription>
          </DialogHeader>
          
          <Form {...activityForm}>
            <form onSubmit={activityForm.handleSubmit(onActivitySubmit)} className="space-y-4">
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
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActivityModalVisible(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={activityForm.formState.isSubmitting}>
                  {activityForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Activity
                </Button>
              </DialogFooter>
            </form>
        </Form>
        </DialogContent>
      </Dialog>

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
            <AlertDialogAction onClick={handleConvertConfirm} disabled={convertingLead}>
              {convertingLead && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
            <AlertDialogAction onClick={handleArchiveConfirm} className="bg-destructive text-destructive-foreground">
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Leads;
