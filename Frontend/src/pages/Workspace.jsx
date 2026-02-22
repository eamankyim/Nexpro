import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Check, Pause, Circle } from 'lucide-react';

import userWorkspaceService from '../services/userWorkspaceService';
import { showError } from '../utils/toast';
import { useAuth } from '../context/AuthContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DatePicker } from '@/components/ui/date-picker';

const STORAGE_KEY = 'workspace-page-expanded'; // reserved for future section toggles

const getWeekStart = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
};

const Workspace = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [focusInput, setFocusInput] = useState('');
  const [taskInput, setTaskInput] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const selectedWeekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate]);

  const { data: focusData, isLoading: focusLoading } = useQuery({
    queryKey: ['user-workspace', 'week-focus', selectedWeekStart],
    queryFn: async () => {
      const res = await userWorkspaceService.getWeekFocus(selectedWeekStart);
      return res?.data ?? { weekStart: selectedWeekStart, items: [] };
    }
  });

  const focusItems = (focusData?.items ?? []).slice(0, 10);

  const {
    data: tasksData,
    isLoading: tasksLoading
  } = useQuery({
    queryKey: ['user-workspace', 'tasks', taskStatusFilter],
    queryFn: async () => {
      const params = {};
      if (taskStatusFilter !== 'all') {
        params.status = taskStatusFilter;
      }
      const res = await userWorkspaceService.getTasks(params);
      return res?.data ?? [];
    }
  });

  const tasks = Array.isArray(tasksData) ? tasksData : [];

  const updateFocusMutation = useMutation({
    mutationFn: (items) => userWorkspaceService.updateWeekFocus({ weekStart: selectedWeekStart, items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-workspace', 'week-focus', selectedWeekStart] });
      setFocusInput('');
    },
    onError: (err) => showError(err?.response?.data?.message || 'Failed to update focus')
  });

  const createTaskMutation = useMutation({
    mutationFn: (payload) => userWorkspaceService.createTask(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-workspace', 'tasks'] });
      setTaskInput('');
    },
    onError: (err) => showError(err?.response?.data?.message || 'Failed to create task')
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, payload }) => userWorkspaceService.updateTask(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-workspace', 'tasks'] });
    },
    onError: (err) => showError(err?.response?.data?.message || 'Failed to update task')
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id) => userWorkspaceService.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-workspace', 'tasks'] });
    },
    onError: (err) => showError(err?.response?.data?.message || 'Failed to delete task')
  });

  const handleAddFocus = useCallback(() => {
    const text = focusInput.trim();
    if (!text || updateFocusMutation.isPending) return;
    const next = [...(focusData?.items ?? []), { text, order: (focusData?.items ?? []).length }];
    updateFocusMutation.mutate(next);
  }, [focusInput, focusData?.items, updateFocusMutation]);

  const handleFocusKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') handleAddFocus();
    },
    [handleAddFocus]
  );

  const handleAddTask = useCallback(
    (isPrivate = false) => {
      const title = taskInput.trim();
      if (!title || createTaskMutation.isPending) return;
      createTaskMutation.mutate({
        title,
        status: 'todo',
        isPrivate
      });
    },
    [taskInput, createTaskMutation]
  );

  const handleTaskKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') handleAddTask(false);
    },
    [handleAddTask]
  );

  const handleToggleTaskStatus = useCallback(
    (task) => {
      const nextStatus =
        task.status === 'todo'
          ? 'in_progress'
          : task.status === 'in_progress'
          ? 'on_hold'
          : task.status === 'on_hold'
          ? 'completed'
          : 'todo';
      updateTaskMutation.mutate({ id: task.id, payload: { status: nextStatus } });
    },
    [updateTaskMutation]
  );

  const handleTaskDueDateChange = useCallback(
    (task, date) => {
      const payload = {
        dueDate: date ? date.toISOString().slice(0, 10) : null
      };
      updateTaskMutation.mutate({ id: task.id, payload });
    },
    [updateTaskMutation]
  );

  const handleAssignTaskToMe = useCallback(
    (task) => {
      if (!user?.id) return;
      updateTaskMutation.mutate({ id: task.id, payload: { assigneeId: user.id } });
    },
    [updateTaskMutation, user?.id]
  );

  const handleConvertFocusToTask = useCallback(
    (item) => {
      if (!item?.text || createTaskMutation.isPending) return;
      const fromWeek = focusData?.weekStart || selectedWeekStart;
      createTaskMutation.mutate({
        title: item.text,
        status: 'todo',
        isPrivate: false,
        description: `From focus for week of ${fromWeek}`
      });
    },
    [createTaskMutation, focusData, selectedWeekStart]
  );

  return (
    <div className="flex flex-col gap-6 px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Workspace</h1>
        <p className="mt1 text-sm text-muted-foreground max-w-2xl">
          Keep track of your weekly focus, tasks, and checklists for this workspace.
        </p>
      </div>

      <Tabs defaultValue="focus" className="space-y-4 md:space-y-6">
        <TabsList className="overflow-x-auto w-full flex-nowrap mb-3 md:mb-4">
          <TabsTrigger value="focus" className="text-xs md:text-sm">
            Focus for the week
          </TabsTrigger>
          <TabsTrigger value="tasks" className="text-xs md:text-sm">
            Tasks
          </TabsTrigger>
          <TabsTrigger value="checklist" className="text-xs md:text-sm">
            Checklist
          </TabsTrigger>
        </TabsList>

        <TabsContent value="focus">
          <Card>
            <CardHeader className="pb-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Focus this week</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Weekly focus – top things you want to achieve in the selected week.
                  </p>
                </div>
                <div className="w-full max-w-xs md:w-auto">
                  <DatePicker
                    date={selectedDate}
                    onDateChange={(date) => {
                      if (date) setSelectedDate(date);
                    }}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Week of {selectedWeekStart}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
            {focusLoading ? (
              <div className="flex items-center gap-2 py-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Loading...</span>
              </div>
            ) : (
              <>
                {focusItems.length === 0 && !focusInput ? (
                  <p className="text-sm text-muted-foreground py-1">
                    What&apos;s your focus for this week?
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {focusItems.map((item, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-muted-foreground flex-shrink-0">{i + 1}.</span>
                        <div className="flex-1 flex items-center justify-between gap-2">
                          <span className="truncate">{item.text}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px] flex items-center gap-1 flex-shrink-0"
                            onClick={() => handleConvertFocusToTask(item)}
                            disabled={createTaskMutation.isPending}
                          >
                            <Plus className="h-3 w-3" />
                            <span>Convert to task</span>
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {focusItems.length < 5 && (
                  <div className="flex gap-2 pt-1">
                    <Input
                      placeholder="Add focus..."
                      value={focusInput}
                      onChange={(e) => setFocusInput(e.target.value)}
                      onKeyDown={handleFocusKeyDown}
                      className="h-9 text-sm"
                      disabled={updateFocusMutation.isPending}
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 flex-shrink-0"
                      onClick={handleAddFocus}
                      disabled={!focusInput.trim() || updateFocusMutation.isPending}
                    >
                      {updateFocusMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks and Checklist tabs will be implemented next using the new APIs */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tasks</CardTitle>
              <p className="text-xs text-muted-foreground">
                ClickUp-style tasks with status and optional privacy. Shared by default with your workspace.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {['all', 'todo', 'in_progress', 'on_hold', 'completed'].map((status) => (
                  <Button
                    key={status}
                    type="button"
                    size="sm"
                    variant={taskStatusFilter === status ? 'default' : 'outline'}
                    className="h-8 px-3 text-xs"
                    onClick={() => setTaskStatusFilter(status)}
                  >
                    {status === 'all'
                      ? 'All'
                      : status === 'in_progress'
                      ? 'In progress'
                      : status === 'on_hold'
                      ? 'On hold'
                      : status === 'todo'
                      ? 'Todo'
                      : 'Completed'}
                  </Button>
                ))}
              </div>

              {tasksLoading ? (
                <div className="flex items-center gap-2 py-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Loading tasks...</span>
                </div>
              ) : tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-1">
                  No tasks yet. Add one below to get started.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 py-1.5 min-h-[36px]"
                    >
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 flex-shrink-0"
                        onClick={() => handleToggleTaskStatus(task)}
                        disabled={updateTaskMutation.isPending}
                      >
                        {task.status === 'completed' ? (
                          <Check className="h-4 w-4" />
                        ) : task.status === 'in_progress' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : task.status === 'on_hold' ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Circle className="h-4 w-4" />
                        )}
                      </Button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'text-sm truncate',
                              task.status === 'completed' && 'line-through text-muted-foreground'
                            )}
                          >
                            {task.title}
                          </span>
                          {task.isPrivate && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                              Private
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <p className="text-[11px] text-muted-foreground">
                            {task.dueDate ? `Due: ${task.dueDate}` : 'No due date'}
                          </p>
                          <DatePicker
                            date={task.dueDate ? new Date(task.dueDate) : undefined}
                            onDateChange={(date) => handleTaskDueDateChange(task, date)}
                            className="h-7 text-[11px] w-auto"
                          />
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>
                            {task.assigneeId
                              ? task.assigneeId === user?.id
                                ? 'Assigned to you'
                                : 'Assigned'
                              : 'Unassigned'}
                          </span>
                          {!task.assigneeId && user?.id && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[11px]"
                              onClick={() => handleAssignTaskToMe(task)}
                              disabled={updateTaskMutation.isPending}
                            >
                              Assign to me
                            </Button>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 flex-shrink-0 text-muted-foreground"
                        onClick={() => deleteTaskMutation.mutate(task.id)}
                        disabled={deleteTaskMutation.isPending}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Input
                  placeholder="Add task..."
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  onKeyDown={handleTaskKeyDown}
                  className="h-9 text-sm max-w-xs"
                  disabled={createTaskMutation.isPending}
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 px-3"
                    onClick={() => handleAddTask(false)}
                    disabled={!taskInput.trim() || createTaskMutation.isPending}
                  >
                    Add task
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 px-3"
                    onClick={() => handleAddTask(true)}
                    disabled={!taskInput.trim() || createTaskMutation.isPending}
                  >
                    Add as private
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checklist">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Checklist</CardTitle>
              <p className="text-xs text-muted-foreground">
                Shared workspace checklists with optional private items for your own notes.
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Checklist UI is wired to the backend but kept minimal here. We can expand it with
                multiple lists and richer interactions as a follow-up.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Workspace;

