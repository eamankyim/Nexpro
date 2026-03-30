import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, CheckCircle2, Clock3, Eye, Filter, MessageSquare, MoreVertical, PauseCircle, Plus, UserRound } from 'lucide-react';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';

import { useAuth } from '../context/AuthContext';
import { useSmartSearch } from '../context/SmartSearchContext';
import userWorkspaceService from '../services/userWorkspaceService';
import { resolveImageUrl } from '../utils/fileUtils';
import { showError, showSuccess } from '../utils/toast';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

const STATUS_OPTIONS = ['todo', 'in_progress', 'on_hold', 'completed'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];

const STATUS_LABELS = {
  todo: 'To do',
  in_progress: 'In progress',
  on_hold: 'On hold',
  completed: 'Completed'
};

const STATUS_ICON = {
  todo: Clock3,
  in_progress: Calendar,
  on_hold: PauseCircle,
  completed: CheckCircle2
};

const SOURCE_LABEL = {
  lead: 'Lead follow-up',
  invoice: 'Invoice collection',
  quote: 'Quote follow-up',
  stock: 'Restock'
};

const STATUS_BADGE_CLASS = {
  todo: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  on_hold: 'bg-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-green-100 text-green-700 border-green-200'
};

const PRIORITY_BADGE_CLASS = {
  low: 'bg-slate-100 text-slate-700 border-slate-200',
  medium: 'bg-blue-100 text-blue-700 border-blue-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  urgent: 'bg-red-100 text-red-700 border-red-200'
};

const SOURCE_BADGE_CLASS = {
  lead: 'bg-purple-100 text-purple-700 border-purple-200',
  invoice: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  quote: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  stock: 'bg-teal-100 text-teal-700 border-teal-200',
  manual: 'bg-slate-100 text-slate-700 border-slate-200'
};

function getDueState(task) {
  if (!task?.dueDate) return 'none';
  const today = new Date().toISOString().slice(0, 10);
  const due = String(task.dueDate).slice(0, 10);
  if (task.status === 'completed') return 'none';
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  const dueTs = new Date(`${due}T00:00:00`).getTime();
  const todayTs = new Date(`${today}T00:00:00`).getTime();
  const diffDays = Math.floor((dueTs - todayTs) / (1000 * 60 * 60 * 24));
  if (diffDays <= 2) return 'soon';
  return 'none';
}

const DUE_BORDER_CLASS = {
  overdue: '',
  today: '',
  soon: '',
  none: ''
};

function formatDate(value) {
  if (!value) return 'No due date';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'No due date';
  return d.toLocaleDateString();
}

function getInitials(name) {
  const value = String(name || '').trim();
  if (!value) return 'U';
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U';
}

const initialForm = {
  id: null,
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  startDate: '',
  dueDate: '',
  isPrivate: false,
  assigneeId: ''
};

const Tasks = () => {
  const { user } = useAuth();
  const { searchValue, setPageSearchConfig } = useSmartSearch();
  const queryClient = useQueryClient();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [privacyFilter, setPrivacyFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [openDetails, setOpenDetails] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [createForm, setCreateForm] = useState(initialForm);
  const [form, setForm] = useState(initialForm);
  const [isDetailsEditing, setIsDetailsEditing] = useState(false);
  const [detailsTab, setDetailsTab] = useState('overview');
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const taskCardRefs = useRef({});

  useEffect(() => {
    setPageSearchConfig({
      scope: 'tasks',
      placeholder: 'Search tasks by title, description, assignee...'
    });
    return () => setPageSearchConfig(null);
  }, [setPageSearchConfig]);

  const { data: tasksData = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['user-workspace', 'tasks'],
    queryFn: async () => {
      const res = await userWorkspaceService.getTasks();
      return Array.isArray(res?.data) ? res.data : [];
    }
  });

  const { data: membersData = [] } = useQuery({
    queryKey: ['user-workspace', 'task-members'],
    queryFn: async () => {
      const res = await userWorkspaceService.getTaskMembers();
      return Array.isArray(res?.data) ? res.data : [];
    }
  });

  const { data: taskDetailResponse, isLoading: detailLoading } = useQuery({
    queryKey: ['user-workspace', 'task-detail', selectedTaskId],
    enabled: Boolean(selectedTaskId && openDetails),
    queryFn: () => userWorkspaceService.getTaskDetail(selectedTaskId),
  });

  const { data: taskActivityResponse, isLoading: activityLoading } = useQuery({
    queryKey: ['user-workspace', 'task-activity', selectedTaskId],
    enabled: Boolean(selectedTaskId && openDetails),
    queryFn: () => userWorkspaceService.getTaskActivity(selectedTaskId),
  });
  const { data: taskCommentsResponse, isLoading: commentsLoading } = useQuery({
    queryKey: ['user-workspace', 'task-comments', selectedTaskId],
    enabled: Boolean(selectedTaskId && openDetails),
    queryFn: () => userWorkspaceService.getTaskComments(selectedTaskId),
  });

  const saveTaskMutation = useMutation({
    mutationFn: async (payload) => userWorkspaceService.updateTask(payload.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-workspace', 'tasks'] });
      if (selectedTaskId) {
        queryClient.invalidateQueries({ queryKey: ['user-workspace', 'task-detail', selectedTaskId] });
      }
      setIsDetailsEditing(false);
      showSuccess('Task saved');
    },
    onError: (err) => {
      showError(err?.response?.data?.message || 'Failed to save task');
    }
  });

  const createTaskMutation = useMutation({
    mutationFn: async (payload) => userWorkspaceService.createTask(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-workspace', 'tasks'] });
      setOpenCreateModal(false);
      setCreateForm(initialForm);
      showSuccess('Task created');
    },
    onError: (err) => {
      showError(err?.response?.data?.message || 'Failed to create task');
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id) => userWorkspaceService.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-workspace', 'tasks'] });
      if (selectedTaskId) {
        queryClient.invalidateQueries({ queryKey: ['user-workspace', 'task-detail', selectedTaskId] });
        queryClient.invalidateQueries({ queryKey: ['user-workspace', 'task-activity', selectedTaskId] });
        queryClient.invalidateQueries({ queryKey: ['user-workspace', 'task-comments', selectedTaskId] });
      }
      setOpenDetails(false);
      setConfirmDeleteOpen(false);
      setSelectedTaskId(null);
      setCommentText('');
      showSuccess('Task deleted');
    },
    onError: (err) => {
      showError(err?.response?.data?.message || 'Failed to delete task');
    }
  });

  const quickStatusMutation = useMutation({
    mutationFn: ({ id, status }) => userWorkspaceService.updateTask(id, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['user-workspace', 'tasks'] });
      const previousTasks = queryClient.getQueryData(['user-workspace', 'tasks']);
      queryClient.setQueryData(['user-workspace', 'tasks'], (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((task) => (task.id === id ? { ...task, status } : task));
      });
      return { previousTasks };
    },
    onError: (err, _vars, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['user-workspace', 'tasks'], context.previousTasks);
      }
      showError(err?.response?.data?.message || 'Failed to update task status');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-workspace', 'tasks'] });
    }
  });

  const addCommentMutation = useMutation({
    mutationFn: ({ taskId, text }) => userWorkspaceService.addTaskComment(taskId, { text }),
    onSuccess: () => {
      if (selectedTaskId) {
        queryClient.invalidateQueries({ queryKey: ['user-workspace', 'task-activity', selectedTaskId] });
        queryClient.invalidateQueries({ queryKey: ['user-workspace', 'task-comments', selectedTaskId] });
        queryClient.invalidateQueries({ queryKey: ['user-workspace', 'task-detail', selectedTaskId] });
        queryClient.invalidateQueries({ queryKey: ['user-workspace', 'tasks'] });
      }
      setCommentText('');
      showSuccess('Comment added');
    },
    onError: (err) => {
      showError(err?.response?.data?.message || 'Failed to add comment');
    }
  });

  const openCreate = useCallback(() => {
    setCreateForm({
      ...initialForm,
      assigneeId: user?.id || '',
      startDate: new Date().toISOString().slice(0, 10)
    });
    setOpenCreateModal(true);
  }, [user?.id]);

  const openEdit = useCallback((task) => {
    setForm({
      id: task.id,
      title: task.title || '',
      description: task.description || '',
      status: task.status || 'todo',
      priority: task.priority || 'medium',
      startDate: task.startDate
        ? String(task.startDate).slice(0, 10)
        : (task.createdAt ? String(task.createdAt).slice(0, 10) : ''),
      dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : '',
      isPrivate: task.isPrivate === true,
      assigneeId: task.assigneeId || ''
    });
    setSelectedTaskId(task.id);
    setIsDetailsEditing(true);
    setDetailsTab('overview');
    setOpenDetails(true);
  }, []);

  const openTaskDetails = useCallback((taskId) => {
    setSelectedTaskId(taskId);
    const task = tasksData.find((t) => t.id === taskId);
    if (task) {
      setForm({
        id: task.id,
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'todo',
        priority: task.priority || 'medium',
        startDate: task.startDate
          ? String(task.startDate).slice(0, 10)
          : (task.createdAt ? String(task.createdAt).slice(0, 10) : ''),
        dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : '',
        isPrivate: task.isPrivate === true,
        assigneeId: task.assigneeId || ''
      });
    } else {
      setForm(initialForm);
    }
    setIsDetailsEditing(false);
    setDetailsTab('overview');
    setOpenDetails(true);
  }, [tasksData]);

  const filteredTasks = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    return tasksData.filter((task) => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (scopeFilter === 'assigned_to_me' && task.assigneeId !== user?.id) return false;
      if (scopeFilter === 'created_by_me' && task.userId !== user?.id) return false;
      if (scopeFilter === 'automated_only' && !task.sourceType) return false;
      if (scopeFilter === 'manual_only' && task.sourceType) return false;
      if (priorityFilter !== 'all' && (task.priority || 'medium') !== priorityFilter) return false;
      if (sourceFilter === 'manual' && task.sourceType) return false;
      if (sourceFilter === 'automated' && !task.sourceType) return false;
      if (['lead', 'invoice', 'quote', 'stock'].includes(sourceFilter) && task.sourceType !== sourceFilter) return false;
      if (assigneeFilter === 'me' && task.assigneeId !== user?.id) return false;
      if (assigneeFilter === 'unassigned' && task.assigneeId) return false;
      if (!['all', 'me', 'unassigned'].includes(assigneeFilter) && task.assigneeId !== assigneeFilter) return false;
      if (privacyFilter === 'private' && task.isPrivate !== true) return false;
      if (privacyFilter === 'public' && task.isPrivate === true) return false;
      if (!q) return true;
      return (
        String(task.title || '').toLowerCase().includes(q) ||
        String(task.description || '').toLowerCase().includes(q) ||
        String(task.assignee?.name || '').toLowerCase().includes(q)
      );
    });
  }, [
    tasksData,
    searchValue,
    statusFilter,
    scopeFilter,
    priorityFilter,
    sourceFilter,
    assigneeFilter,
    privacyFilter,
    user?.id
  ]);

  const tasksByStatus = useMemo(() => {
    return STATUS_OPTIONS.reduce((acc, status) => {
      acc[status] = filteredTasks.filter((t) => t.status === status);
      return acc;
    }, {});
  }, [filteredTasks]);

  const dueTodayTasks = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return filteredTasks.filter((task) => {
      if (!task?.dueDate) return false;
      return String(task.dueDate).slice(0, 10) === today;
    });
  }, [filteredTasks]);

  const overdueTasks = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return filteredTasks.filter((task) => {
      if (!task?.dueDate) return false;
      const due = String(task.dueDate).slice(0, 10);
      if (due >= today) return false;
      return task.status !== 'completed';
    });
  }, [filteredTasks]);

  const onSubmit = useCallback(() => {
    const title = form.title.trim();
    if (!title) {
      showError('Task title is required');
      return;
    }
    if (!form.id) return;
    saveTaskMutation.mutate({
      id: form.id,
      title,
      description: form.description?.trim() || '',
      status: form.status || 'todo',
      priority: form.priority || 'medium',
      startDate: form.startDate || null,
      dueDate: form.dueDate || null,
      isPrivate: form.isPrivate === true,
      assigneeId: form.assigneeId || null
    });
  }, [form, saveTaskMutation]);

  const onCreateSubmit = useCallback(() => {
    const title = createForm.title.trim();
    if (!title) {
      showError('Task title is required');
      return;
    }
    createTaskMutation.mutate({
      title,
      description: createForm.description?.trim() || '',
      status: createForm.status || 'todo',
      priority: createForm.priority || 'medium',
      startDate: createForm.startDate || new Date().toISOString().slice(0, 10),
      dueDate: createForm.dueDate || null,
      isPrivate: createForm.isPrivate === true,
      assigneeId: createForm.assigneeId || null
    });
  }, [createForm, createTaskMutation]);

  const taskDetail = taskDetailResponse?.data || null;
  const taskActivity = Array.isArray(taskActivityResponse?.data) ? taskActivityResponse.data : [];
  const taskComments = Array.isArray(taskCommentsResponse?.data) ? taskCommentsResponse.data : [];
  const selectedAssignee = membersData.find((m) => m.id === form.assigneeId) || taskDetail?.assignee || null;
  const selectedAssigneeName = selectedAssignee?.name || 'Unassigned';
  const selectedAssigneeImage = resolveImageUrl(selectedAssignee?.profilePicture || '') || undefined;
  const activityItems = useMemo(() => {
    const normalizeText = (value) => String(value || '').trim().toLowerCase();
    const activity = taskActivity.map((entry) => ({
      id: entry.id,
      type: entry.type || 'activity',
      createdAt: entry.createdAt,
      userName: entry.userName || 'User',
      summary: entry.summary || 'Activity updated',
      source: 'activity'
    }));
    const activityCommentTextSet = new Set(
      activity
        .filter((entry) => entry.type === 'comment')
        .map((entry) => normalizeText(String(entry.summary || '').replace(/^Commented:\s*/i, '')))
        .filter(Boolean)
    );
    const legacyComments = taskComments
      .filter((comment) => !activityCommentTextSet.has(normalizeText(comment.text || comment.comment || comment.content || '')))
      .map((comment) => ({
      id: `legacy-comment-${comment.id}`,
      type: 'comment',
      createdAt: comment.createdAt,
      userName: comment.userName || comment.userEmail || 'User',
      summary: 'Commented',
      body: comment.text || comment.comment || comment.content || '',
      source: 'comment'
      }));
    const hasCreatedEvent = activity.some((entry) => entry.type === 'created');
    const createdByName = taskDetail?.user?.name || taskDetail?.user?.email || 'User';
    const createdAt = taskDetail?.createdAt || null;
    const createdEvent =
      !hasCreatedEvent && createdAt
        ? [
            {
              id: `synthetic-created-${taskDetail?.id || 'task'}`,
              type: 'created',
              createdAt,
              userName: createdByName,
              summary: 'Task created',
              source: 'system'
            }
          ]
        : [];
    return [...createdEvent, ...activity, ...legacyComments]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [taskActivity, taskComments, taskDetail]);
  const hasActivity = activityItems.length > 0;

  const jumpToTask = useCallback((taskId) => {
    const el = taskCardRefs.current?.[taskId];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedTaskId(taskId);
      window.setTimeout(() => setHighlightedTaskId((prev) => (prev === taskId ? null : prev)), 1800);
    }
  }, []);

  const handleDragEnd = useCallback(
    (result) => {
      const { destination, source, draggableId } = result || {};
      if (!destination) return;
      if (destination.droppableId === source.droppableId) return;
      const task = filteredTasks.find((t) => t.id === draggableId);
      if (!task) return;
      const nextStatus = destination.droppableId;
      if (!STATUS_OPTIONS.includes(nextStatus)) return;
      quickStatusMutation.mutate({ id: task.id, status: nextStatus });
    },
    [filteredTasks, quickStatusMutation]
  );

  return (
    <div className="flex flex-col gap-2 px-0 py-1.5 sm:gap-4 sm:px-4 sm:py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Track meetings, follow-ups, due work, and automated tasks in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="sm:hidden flex items-center gap-1 rounded-md border border-border p-1">
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              onClick={() => setViewMode('list')}
            >
              List
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              onClick={() => setViewMode('kanban')}
            >
              Kanban
            </Button>
          </div>
          <div className="hidden sm:flex items-center gap-1 rounded-md border border-border p-1">
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              onClick={() => setViewMode('list')}
            >
              List
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              onClick={() => setViewMode('kanban')}
            >
              Kanban
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={() => setFiltersOpen(true)}
            size="icon"
            className="sm:w-auto sm:px-3 sm:gap-2"
            aria-label="Open task filters"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            New task
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-3 sm:pt-6 px-2.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">Status: {statusFilter === 'all' ? 'All' : STATUS_LABELS[statusFilter]}</Badge>
            <Badge variant="outline">
              Scope:{' '}
              {scopeFilter === 'all'
                ? 'All'
                : scopeFilter === 'assigned_to_me'
                  ? 'Assigned to me'
                  : scopeFilter === 'created_by_me'
                    ? 'Created by me'
                    : scopeFilter === 'automated_only'
                      ? 'Automated'
                      : 'Manual'}
            </Badge>
            <Badge variant="outline">Priority: {priorityFilter === 'all' ? 'All' : priorityFilter}</Badge>
            <Badge variant="outline">
              Results: {filteredTasks.length}/{tasksData.length}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-1.5 sm:gap-3">
        {tasksLoading ? (
          <Card>
            <CardContent className="pt-3 sm:pt-6 px-2.5 sm:px-6 text-sm text-muted-foreground">Loading tasks...</CardContent>
          </Card>
        ) : filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="pt-3 sm:pt-6 px-2.5 sm:px-6 text-sm text-muted-foreground">
              No tasks match your filters.
            </CardContent>
          </Card>
        ) : viewMode === 'list' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 space-y-2 sm:space-y-3">
              {filteredTasks.map((task) => {
                const Icon = STATUS_ICON[task.status] || Clock3;
                return (
                  <Card
                    key={task.id}
                    ref={(node) => {
                      if (node) {
                        taskCardRefs.current[task.id] = node;
                      } else {
                        delete taskCardRefs.current[task.id];
                      }
                    }}
                    className={`${DUE_BORDER_CLASS[getDueState(task)] || ''} ${
                      highlightedTaskId === task.id ? 'ring-2 ring-primary/40 border-primary/40 transition-colors' : ''
                    }`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="text-base">{task.title}</CardTitle>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <UserRound className="h-3 w-3" />
                              {task.assignee?.name || 'Unassigned'}
                            </span>
                            <span>Due: {formatDate(task.dueDate)}</span>
                            {task.sourceType ? (
                              <Badge
                                variant="outline"
                                className={SOURCE_BADGE_CLASS[task.sourceType] || SOURCE_BADGE_CLASS.manual}
                              >
                                {SOURCE_LABEL[task.sourceType] || task.sourceType}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className={SOURCE_BADGE_CLASS.manual}>
                                Manual
                              </Badge>
                            )}
                            {task.isPrivate && <Badge variant="outline">Private</Badge>}
                            <Badge
                              variant="outline"
                              className={PRIORITY_BADGE_CLASS[task.priority || 'medium'] || PRIORITY_BADGE_CLASS.medium}
                            >
                              {String(task.priority || 'medium').toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`capitalize ${STATUS_BADGE_CLASS[task.status] || STATUS_BADGE_CLASS.todo}`}
                          >
                            <Icon className="mr-1 h-3 w-3" />
                            {STATUS_LABELS[task.status] || task.status}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {task.description ? (
                        <p className="mb-3 text-sm text-muted-foreground">{task.description}</p>
                      ) : null}
                      <div className="flex items-center justify-end">
                        <Button size="sm" variant="outline" onClick={() => openTaskDetails(task.id)} className="gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="hidden lg:block lg:col-span-1 min-w-0">
              <Card className="h-full min-h-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Task timeline</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 min-w-0 overflow-hidden">
                  {dueTodayTasks.length === 0 && overdueTasks.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No due-today or overdue tasks
                    </div>
                  ) : (
                    <div className="flex flex-col gap-5 min-w-0">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                          Due today ({dueTodayTasks.length})
                        </p>
                        {dueTodayTasks.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No tasks due today</p>
                        ) : (
                          <div className="flex flex-col gap-3 min-w-0">
                            {dueTodayTasks.map((task) => (
                              <button
                                type="button"
                                key={`due-${task.id}`}
                                className="w-full text-left flex items-start justify-between gap-2 min-w-0 rounded-md hover:bg-muted/40 p-1 transition-colors"
                                onClick={() => jumpToTask(task.id)}
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {task.assignee?.name || 'Unassigned'}
                                  </p>
                                </div>
                                <Badge variant="outline" className="capitalize shrink-0">
                                  {STATUS_LABELS[task.status] || task.status}
                                </Badge>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                          Overdue ({overdueTasks.length})
                        </p>
                        {overdueTasks.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No overdue tasks</p>
                        ) : (
                          <div className="flex flex-col gap-3 min-w-0">
                            {overdueTasks.map((task) => (
                              <button
                                type="button"
                                key={`overdue-${task.id}`}
                                className="w-full text-left flex items-start justify-between gap-2 min-w-0 rounded-md hover:bg-muted/40 p-1 transition-colors"
                                onClick={() => jumpToTask(task.id)}
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    Due {formatDate(task.dueDate)} • {task.assignee?.name || 'Unassigned'}
                                  </p>
                                </div>
                                <Badge variant="destructive" className="capitalize shrink-0">
                                  Overdue
                                </Badge>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
              {STATUS_OPTIONS.map((statusKey) => (
                <Card key={statusKey} className="min-h-[420px]">
                  <CardHeader className="pb-1.5 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                    <CardTitle className="text-sm">
                      {STATUS_LABELS[statusKey]} ({tasksByStatus[statusKey]?.length || 0})
                    </CardTitle>
                  </CardHeader>
                    <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                    <Droppable droppableId={statusKey}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`space-y-2 rounded-md p-1 ${snapshot.isDraggingOver ? 'bg-muted/60' : ''}`}
                        >
                          {(tasksByStatus[statusKey] || []).map((task, index) => (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  className={`rounded-md border border-border p-2 bg-card ${
                                    dragSnapshot.isDragging ? 'ring-2 ring-primary/30' : ''
                                  }`}
                                >
                                  <p className="text-sm font-medium leading-tight">{task.title}</p>
                                  <p className="mt-1 text-[11px] text-muted-foreground">
                                    {task.assignee?.name || 'Unassigned'} • {formatDate(task.dueDate)}
                                  </p>
                                  <div className="mt-2 flex flex-wrap items-center gap-1">
                                    {task.sourceType ? (
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] ${SOURCE_BADGE_CLASS[task.sourceType] || SOURCE_BADGE_CLASS.manual}`}
                                      >
                                        {SOURCE_LABEL[task.sourceType] || task.sourceType}
                                      </Badge>
                                    ) : null}
                                    {task.isPrivate ? (
                                      <Badge variant="outline" className="text-[10px]">
                                        Private
                                      </Badge>
                                    ) : null}
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] ${PRIORITY_BADGE_CLASS[task.priority || 'medium'] || PRIORITY_BADGE_CLASS.medium}`}
                                    >
                                      {String(task.priority || 'medium').toUpperCase()}
                                    </Badge>
                                  </div>
                                  <div className="mt-2 flex items-center justify-end gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="gap-1"
                                      onClick={() => openTaskDetails(task.id)}
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      View
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          {(tasksByStatus[statusKey] || []).length === 0 ? (
                            <p className="text-xs text-muted-foreground">No tasks</p>
                          ) : null}
                        </div>
                      )}
                    </Droppable>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DragDropContext>
        )}
      </div>

      <Dialog open={openCreateModal} onOpenChange={setOpenCreateModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create task</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="task-title-create">Title</Label>
                <Input
                  id="task-title-create"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Call customer after meeting"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="task-description-create">Description (optional)</Label>
                <Textarea
                  id="task-description-create"
                  rows={4}
                  value={createForm.description}
                  onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={createForm.status}
                  onValueChange={(v) => setCreateForm((p) => ({ ...p, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select
                  value={createForm.priority || 'medium'}
                  onValueChange={(v) => setCreateForm((p) => ({ ...p, priority: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label>Start date</Label>
                  <DatePicker
                    date={createForm.startDate ? new Date(createForm.startDate) : undefined}
                    onDateChange={(d) =>
                      setCreateForm((p) => ({
                        ...p,
                        startDate: d ? d.toISOString().slice(0, 10) : ''
                      }))
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <Label>Due date</Label>
                  <DatePicker
                    date={createForm.dueDate ? new Date(createForm.dueDate) : undefined}
                    onDateChange={(d) =>
                      setCreateForm((p) => ({
                        ...p,
                        dueDate: d ? d.toISOString().slice(0, 10) : ''
                      }))
                    }
                    className="w-full"
                  />
                </div>
              </div>
              <div className="md:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label>Assignee</Label>
                  <Select
                    value={createForm.assigneeId || 'unassigned'}
                    onValueChange={(v) => setCreateForm((p) => ({ ...p, assigneeId: v === 'unassigned' ? '' : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {membersData.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Visibility</Label>
                  <Select
                    value={createForm.isPrivate ? 'private' : 'public'}
                    onValueChange={(v) => setCreateForm((p) => ({ ...p, isPrivate: v === 'private' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={onCreateSubmit} disabled={createTaskMutation.isPending}>
              Create task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet
        open={openDetails}
        onOpenChange={(open) => {
          setOpenDetails(open);
          if (!open) {
            setSelectedTaskId(null);
            setCommentText('');
            setIsDetailsEditing(false);
            setDetailsTab('overview');
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-3xl h-full sm:h-[calc(100%-2rem)] flex flex-col sm:rounded-xl sm:mt-4 sm:mb-4 sm:mr-4 px-3 sm:px-6">
          <SheetHeader>
            <SheetTitle>Task details</SheetTitle>
          </SheetHeader>
          <div className="mt-3 sm:mt-4 flex-1 overflow-y-auto pr-0 sm:pr-1">
            {detailLoading ? (
              <p className="text-sm text-muted-foreground">Loading task...</p>
            ) : !taskDetail && form.id ? (
              <p className="text-sm text-muted-foreground">Task not found.</p>
            ) : (
              <Tabs value={detailsTab} onValueChange={setDetailsTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="activities">Activities</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-3 sm:mt-4 space-y-2.5 sm:space-y-3">
                  {isDetailsEditing ? (
                    <div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                          <Label htmlFor="task-title-inline">Title</Label>
                          <Input
                            id="task-title-inline"
                            value={form.title}
                            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                            placeholder="Call customer after meeting"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label htmlFor="task-description-inline">Description (optional)</Label>
                          <Textarea
                            id="task-description-inline"
                            rows={4}
                            value={form.description}
                            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label>Status</Label>
                          <Select
                            value={form.status}
                            onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {STATUS_LABELS[s]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Priority</Label>
                          <Select
                            value={form.priority || 'medium'}
                            onValueChange={(v) => setForm((p) => ({ ...p, priority: v }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent>
                              {PRIORITY_OPTIONS.map((p) => (
                                <SelectItem key={p} value={p}>
                                  {p.charAt(0).toUpperCase() + p.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <Label>Start date</Label>
                            <DatePicker
                              date={form.startDate ? new Date(form.startDate) : undefined}
                              onDateChange={(d) =>
                                setForm((p) => ({
                                  ...p,
                                  startDate: d ? d.toISOString().slice(0, 10) : ''
                                }))
                              }
                              className="w-full"
                            />
                          </div>
                          <div>
                            <Label>Due date</Label>
                            <DatePicker
                              date={form.dueDate ? new Date(form.dueDate) : undefined}
                              onDateChange={(d) =>
                                setForm((p) => ({
                                  ...p,
                                  dueDate: d ? d.toISOString().slice(0, 10) : ''
                                }))
                              }
                              className="w-full"
                            />
                          </div>
                        </div>
                        <div className="md:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <Label>Assignee</Label>
                            <Select
                              value={form.assigneeId || 'unassigned'}
                              onValueChange={(v) => setForm((p) => ({ ...p, assigneeId: v === 'unassigned' ? '' : v }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select assignee" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {membersData.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Visibility</Label>
                            <Select
                              value={form.isPrivate ? 'private' : 'public'}
                              onValueChange={(v) => setForm((p) => ({ ...p, isPrivate: v === 'private' }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Visibility" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="public">Public</SelectItem>
                                <SelectItem value="private">Private</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-md border border-border p-3 sm:p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Description</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                          {form.description || taskDetail?.description || 'No description'}
                        </p>
                      </div>
                      <div className="space-y-2 rounded-md border border-border p-2.5 sm:p-3">
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-sm text-muted-foreground">Title</p>
                          <p className="text-sm font-medium text-foreground text-right">{form.title || taskDetail?.title || '-'}</p>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-sm text-muted-foreground">Status</p>
                          <Badge variant="outline" className={`capitalize ${STATUS_BADGE_CLASS[form.status] || STATUS_BADGE_CLASS.todo}`}>
                            {STATUS_LABELS[form.status] || form.status}
                          </Badge>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-sm text-muted-foreground">Priority</p>
                          <Badge variant="outline" className={PRIORITY_BADGE_CLASS[form.priority || 'medium'] || PRIORITY_BADGE_CLASS.medium}>
                            {String(form.priority || 'medium').toUpperCase()}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-x-4">
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-sm text-muted-foreground">Start date</p>
                            <Badge variant="outline">
                              {formatDate(form.startDate || taskDetail?.startDate || taskDetail?.createdAt)}
                            </Badge>
                          </div>
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-sm text-muted-foreground">Due date</p>
                            <Badge variant="outline">
                              {formatDate(form.dueDate || taskDetail?.dueDate)}
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-x-4">
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-sm text-muted-foreground">Assignee</p>
                            <Badge variant="outline" className="gap-1.5">
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={selectedAssigneeImage} alt={selectedAssigneeName} />
                                <AvatarFallback className="text-[10px]">{getInitials(selectedAssigneeName)}</AvatarFallback>
                              </Avatar>
                              <span>{selectedAssigneeName}</span>
                            </Badge>
                          </div>
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-sm text-muted-foreground">Visibility</p>
                            <p className="text-sm text-foreground text-right">
                              {form.isPrivate ? 'Private' : 'Public'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="task-comment">Add comment</Label>
                    <Textarea
                      id="task-comment"
                      rows={3}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write an update, question, or note..."
                    />
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          const text = commentText.trim();
                          if (!text || !selectedTaskId) return;
                          addCommentMutation.mutate({ taskId: selectedTaskId, text });
                        }}
                        disabled={addCommentMutation.isPending || !commentText.trim()}
                        className="gap-2 w-full sm:w-auto"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Add comment
                      </Button>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="activities" className="mt-3 sm:mt-4">
                  {activityLoading || commentsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading activity...</p>
                  ) : !hasActivity ? (
                    <p className="text-sm text-muted-foreground">No activities yet.</p>
                  ) : (
                    <div className="max-h-[460px] overflow-y-auto pr-0 sm:pr-1">
                      <ol className="relative border-l-2 border-muted-foreground/30 pl-6 space-y-4">
                        {activityItems.map((entry) => {
                          const toneClass =
                            entry.type === 'comment'
                              ? 'bg-blue-500'
                              : entry.type === 'created'
                                ? 'bg-green-500'
                                : 'bg-muted-foreground';
                          return (
                            <li key={entry.id} className="relative">
                              <span className={`absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background ${toneClass}`} />
                              <div className="rounded-md border border-border p-2.5 sm:p-3">
                                <p className="text-xs text-muted-foreground">
                                  {entry.userName || 'User'} • {formatDate(entry.createdAt)}
                                </p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                                  {entry.summary || 'Activity updated'}
                                </p>
                                {entry.body ? (
                                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                                    {entry.body}
                                  </p>
                                ) : null}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  )}
                  <div className="mt-3 sm:mt-4 space-y-2">
                    <Label htmlFor="task-comment-activities">Add comment</Label>
                    <Textarea
                      id="task-comment-activities"
                      rows={3}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write an update, question, or note..."
                    />
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          const text = commentText.trim();
                          if (!text || !selectedTaskId) return;
                          addCommentMutation.mutate({ taskId: selectedTaskId, text });
                        }}
                        disabled={addCommentMutation.isPending || !commentText.trim()}
                        className="gap-2 w-full sm:w-auto"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Add comment
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>
          <div className="mt-3 sm:mt-4 flex items-center justify-end gap-2 border-t border-border pt-3 sm:pt-4 mt-auto bg-background">
            {form.id ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More actions">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsDetailsEditing((prev) => !prev)}>
                    {isDetailsEditing ? 'Cancel edit' : 'Edit details'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setConfirmDeleteOpen(true)}
                  >
                    Delete task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <Button onClick={onSubmit} disabled={saveTaskMutation.isPending || !isDetailsEditing}>
              Update task
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The task and its comments will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (form.id) {
                  deleteTaskMutation.mutate(form.id);
                }
              }}
            >
              Delete task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Task Filters</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Scope</Label>
              <Select value={scopeFilter} onValueChange={setScopeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tasks</SelectItem>
                  <SelectItem value="assigned_to_me">Assigned to me</SelectItem>
                  <SelectItem value="created_by_me">Created by me</SelectItem>
                  <SelectItem value="automated_only">Automated only</SelectItem>
                  <SelectItem value="manual_only">Manual only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Task source</Label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="automated">Automated</SelectItem>
                  <SelectItem value="lead">Lead follow-up</SelectItem>
                  <SelectItem value="invoice">Invoice collection</SelectItem>
                  <SelectItem value="quote">Quote follow-up</SelectItem>
                  <SelectItem value="stock">Restock</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All assignees</SelectItem>
                  <SelectItem value="me">Me</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {membersData.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Privacy</Label>
              <Select value={privacyFilter} onValueChange={setPrivacyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Privacy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-2 flex items-center justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setStatusFilter('all');
                  setScopeFilter('all');
                  setPriorityFilter('all');
                  setSourceFilter('all');
                  setAssigneeFilter('all');
                  setPrivacyFilter('all');
                }}
              >
                Reset filters
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
};

export default Tasks;
