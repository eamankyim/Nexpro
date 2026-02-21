import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, ChevronDown, ChevronRight, Plus, Loader2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import userWorkspaceService from '@/services/userWorkspaceService';
import { showError } from '@/utils/toast';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'personal-list-expanded';

const getWeekStart = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
};

/**
 * PersonalListSidebarSection - My Workspace with todos and weekly focus.
 * Collapsible section for the sidebar; expand/collapse state persisted in localStorage.
 * @param {boolean} collapsed - Sidebar is collapsed (narrow)
 * @param {boolean} compact - Show only icon
 * @param {boolean} inSheet - Rendered inside Sheet (no Collapsible wrapper, always show content)
 */
export default function PersonalListSidebarSection({ collapsed: sidebarCollapsed, compact = false, inSheet = false }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  const [todoInput, setTodoInput] = useState('');
  const [focusInput, setFocusInput] = useState('');

  const weekStart = useMemo(() => getWeekStart(new Date()), []);

  const handleOpenChange = useCallback((value) => {
    setOpen(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {}
  }, []);

  const { data: todosData, isLoading: todosLoading } = useQuery({
    queryKey: ['user-workspace', 'todos'],
    queryFn: async () => {
      const res = await userWorkspaceService.getTodos();
      return res?.data ?? [];
    }
  });

  const { data: focusData, isLoading: focusLoading } = useQuery({
    queryKey: ['user-workspace', 'week-focus', weekStart],
    queryFn: async () => {
      const res = await userWorkspaceService.getWeekFocus(weekStart);
      return res?.data ?? { weekStart, items: [] };
    }
  });

  const todos = Array.isArray(todosData) ? todosData : [];
  const focusItems = (focusData?.items ?? []).slice(0, 5);

  const createTodoMutation = useMutation({
    mutationFn: (title) => userWorkspaceService.createTodo({ title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-workspace', 'todos'] });
      setTodoInput('');
    },
    onError: (err) => showError(err?.response?.data?.message || 'Failed to add todo')
  });

  const updateTodoMutation = useMutation({
    mutationFn: ({ id, payload }) => userWorkspaceService.updateTodo(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-workspace', 'todos'] }),
    onError: (err) => showError(err?.response?.data?.message || 'Failed to update todo')
  });

  const updateFocusMutation = useMutation({
    mutationFn: (items) => userWorkspaceService.updateWeekFocus({ weekStart, items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-workspace', 'week-focus', weekStart] });
      setFocusInput('');
    },
    onError: (err) => showError(err?.response?.data?.message || 'Failed to add focus')
  });

  const incompleteTodos = todos.filter((t) => !t.done);
  const displayTodos = incompleteTodos.slice(0, 5);

  const handleAddTodo = useCallback(() => {
    const title = todoInput.trim();
    if (!title || createTodoMutation.isPending) return;
    createTodoMutation.mutate(title);
  }, [todoInput, createTodoMutation]);

  const handleTodoKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') handleAddTodo();
    },
    [handleAddTodo]
  );

  const handleToggleTodo = useCallback(
    (todo) => {
      updateTodoMutation.mutate({ id: todo.id, payload: { done: !todo.done } });
    },
    [updateTodoMutation]
  );

  const handleAddFocus = useCallback(() => {
    const text = focusInput.trim();
    if (!text || updateFocusMutation.isPending) return;
    const next = [...focusItems, { text, order: focusItems.length }];
    updateFocusMutation.mutate(next);
  }, [focusInput, focusItems, updateFocusMutation]);

  const handleFocusKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') handleAddFocus();
    },
    [handleAddFocus]
  );

  if (compact) {
    return (
      <div className="flex items-center justify-center py-2">
        <CheckSquare className="h-5 w-5 text-muted-foreground" aria-hidden />
      </div>
    );
  }

  const content = (
    <div className={inSheet ? 'space-y-4' : 'space-y-3'}>
      {/* Todos */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Todos
              </p>
              {todosLoading ? (
                <div className="flex items-center gap-2 py-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Loading...</span>
                </div>
              ) : displayTodos.length === 0 && !todoInput ? (
                <p className="text-xs text-muted-foreground py-1">Add a todo</p>
              ) : (
                <div className="space-y-1">
                  {displayTodos.map((todo) => (
                    <label
                      key={todo.id}
                      className="flex items-center gap-2 py-1.5 cursor-pointer group min-h-[36px]"
                    >
                      <Checkbox
                        checked={!!todo.done}
                        onCheckedChange={() => handleToggleTodo(todo)}
                        disabled={updateTodoMutation.isPending}
                        className="flex-shrink-0"
                      />
                      <span
                        className={cn(
                          'text-sm flex-1 truncate',
                          todo.done && 'line-through text-muted-foreground'
                        )}
                      >
                        {todo.title}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <div className="flex gap-1 mt-1.5">
                <Input
                  placeholder="Add todo..."
                  value={todoInput}
                  onChange={(e) => setTodoInput(e.target.value)}
                  onKeyDown={handleTodoKeyDown}
                  className="h-8 text-xs"
                  disabled={createTodoMutation.isPending}
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={handleAddTodo}
                  disabled={!todoInput.trim() || createTodoMutation.isPending}
                >
                  {createTodoMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Weekly Focus */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Focus this week
              </p>
              {focusLoading ? (
                <div className="flex items-center gap-2 py-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Loading...</span>
                </div>
              ) : (
                <>
                  {focusItems.length === 0 && !focusInput ? (
                    <p className="text-xs text-muted-foreground py-1">What&apos;s your focus?</p>
                  ) : (
                    <ul className="space-y-1 mb-1.5">
                      {focusItems.map((item, i) => (
                        <li key={i} className="text-xs flex items-start gap-2">
                          <span className="text-muted-foreground flex-shrink-0">{i + 1}.</span>
                          <span className="truncate">{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {focusItems.length < 5 && (
                    <div className="flex gap-1">
                      <Input
                        placeholder="Add focus..."
                        value={focusInput}
                        onChange={(e) => setFocusInput(e.target.value)}
                        onKeyDown={handleFocusKeyDown}
                        className="h-8 text-xs"
                        disabled={updateFocusMutation.isPending}
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 flex-shrink-0"
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
            </div>
          </div>
  );

  if (inSheet) {
    return <div className="px-1">{content}</div>;
  }

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange} className="border-t border-border pt-2">
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            'w-full flex items-center gap-2 px-4 py-2 rounded-md hover:bg-muted transition-colors text-left min-h-[44px]',
            sidebarCollapsed && 'justify-center px-2'
          )}
          aria-expanded={open}
        >
          <CheckSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          {!sidebarCollapsed && (
            <>
              <span className="text-sm font-medium flex-1">My Workspace</span>
              {open ? (
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              )}
            </>
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {open && !sidebarCollapsed && (
          <div className="px-4 pb-3">
            {content}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
