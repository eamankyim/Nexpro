import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle, Loader2, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import notificationService from '../services/notificationService';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Empty } from '@/components/ui/empty';
import { cn } from '@/lib/utils';

const NOTIFICATION_SUMMARY_KEY = ['notifications', 'summary'];
/** Shared with Dashboard so list is fetched once and cached */
export const NOTIFICATION_LIST_QUERY_KEY = ['notifications', 'list'];
const SUMMARY_STALE_MS = 60 * 1000;
const SUMMARY_REFETCH_MS = 60 * 1000;
const LIST_STALE_MS = 60 * 1000;

dayjs.extend(relativeTime);

const PAGE_SIZE = 10;

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [extraPages, setExtraPages] = useState([]);
  const { activeTenantId } = useAuth();
  const queryClient = useQueryClient();

  const navigate = useNavigate();

  const {
    data: summaryResponse,
    isLoading: loadingSummary,
    isError: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: [...NOTIFICATION_SUMMARY_KEY, activeTenantId],
    queryFn: () => notificationService.getSummary(),
    enabled: !!activeTenantId,
    staleTime: SUMMARY_STALE_MS,
    refetchInterval: SUMMARY_REFETCH_MS,
    retry: (failureCount, error) => {
      const isNetworkError = error?.code === 'ERR_NETWORK' || error?.message === 'Network Error';
      return !isNetworkError && failureCount < 2;
    },
  });

  const {
    data: listQueryData,
    isLoading: loadingList,
    isFetched: listFetched,
    isError: listError,
    refetch: refetchList,
  } = useQuery({
    queryKey: [...NOTIFICATION_LIST_QUERY_KEY, activeTenantId, 1],
    queryFn: () => notificationService.getNotifications({ page: 1, limit: PAGE_SIZE }),
    enabled: !!activeTenantId && open,
    staleTime: LIST_STALE_MS,
    refetchOnWindowFocus: false,
  });

  const summary = useMemo(() => {
    if (!activeTenantId || summaryError) {
      return { total: 0, unread: 0, recent: 0 };
    }
    const d = summaryResponse?.data;
    return {
      total: d?.total ?? 0,
      unread: d?.unread ?? 0,
      recent: d?.recent ?? 0,
    };
  }, [activeTenantId, summaryError, summaryResponse?.data]);

  const hasUnread = Boolean(summary?.unread);

  const page1Items = useMemo(() => {
    if (!listQueryData?.success || !Array.isArray(listQueryData?.data)) return [];
    return listQueryData.data;
  }, [listQueryData]);

  const displayedNotifications = useMemo(() => {
    if (extraPages.length === 0) return page1Items;
    return [...page1Items, ...extraPages];
  }, [page1Items, extraPages]);

  const listPagination = useMemo(() => ({
    page: listQueryData?.pagination?.page ?? 1,
    totalPages: listQueryData?.pagination?.totalPages ?? 1,
  }), [listQueryData?.pagination]);

  const hasMore = useMemo(() => {
    const totalPages = listPagination?.totalPages ?? 1;
    const loadedPages = extraPages.length === 0 ? 1 : 1 + Math.ceil(extraPages.length / PAGE_SIZE);
    return loadedPages < totalPages;
  }, [listPagination?.totalPages, extraPages.length]);

  useEffect(() => {
    if (!open) setExtraPages([]);
  }, [open]);

  const fetchMoreNotifications = useCallback(
    async () => {
      if (!activeTenantId) return;
      const nextPage = extraPages.length === 0 ? 2 : (listPagination?.page ?? 1) + Math.ceil(extraPages.length / PAGE_SIZE) + 1;
      setLoadingMore(true);
      try {
        const response = await notificationService.getNotifications({ page: nextPage, limit: PAGE_SIZE });
        if (response?.success && Array.isArray(response.data)) {
          setExtraPages((prev) => [...prev, ...response.data]);
        }
      } catch (error) {
        const isNetworkError = error?.code === 'ERR_NETWORK' || error?.message === 'Network Error';
        if (!isNetworkError) console.error('Failed to load more notifications', error);
      } finally {
        setLoadingMore(false);
      }
    },
    [activeTenantId, extraPages.length, listPagination?.page]
  );

  const markNotificationRead = useCallback(
    async (notification) => {
      if (!notification || notification.isRead) {
        return;
      }

      try {
        const response = await notificationService.markRead(notification.id);
        if (response?.success) {
          const readAt = response.data?.readAt || new Date().toISOString();
          queryClient.setQueryData(
            [...NOTIFICATION_LIST_QUERY_KEY, activeTenantId, 1],
            (old) => {
              if (!old?.data) return old;
              return {
                ...old,
                data: old.data.map((item) =>
                  item.id === notification.id ? { ...item, isRead: true, readAt } : item
                ),
              };
            }
          );
          setExtraPages((prev) =>
            prev.map((item) =>
              item.id === notification.id ? { ...item, isRead: true, readAt } : item
            )
          );
          queryClient.invalidateQueries({ queryKey: NOTIFICATION_SUMMARY_KEY });
        }
      } catch (error) {
        const isNetworkError = error?.code === 'ERR_NETWORK' || error?.message === 'Network Error';
        if (!isNetworkError) {
          console.error('Failed to mark notification as read', error);
        }
      }
    },
    [queryClient, activeTenantId]
  );

  const markAllRead = useCallback(async () => {
    if (!hasUnread) {
      return;
    }
    try {
      const response = await notificationService.markAllRead();
      if (response?.success) {
        const now = new Date().toISOString();
        queryClient.setQueryData(
          [...NOTIFICATION_LIST_QUERY_KEY, activeTenantId, 1],
          (old) => {
            if (!old?.data) return old;
            return {
              ...old,
              data: old.data.map((item) => ({ ...item, isRead: true, readAt: item.readAt ?? now })),
            };
          }
        );
        setExtraPages((prev) => prev.map((item) => ({ ...item, isRead: true, readAt: item.readAt ?? now })));
        queryClient.invalidateQueries({ queryKey: NOTIFICATION_SUMMARY_KEY });
      }
    } catch (error) {
      const isNetworkError = error?.code === 'ERR_NETWORK' || error?.message === 'Network Error';
      if (!isNetworkError) {
        console.error('Failed to mark all notifications as read', error);
      }
    }
  }, [hasUnread, queryClient, activeTenantId]);

  const handleNotificationClick = useCallback(
    async (notification) => {
      if (!notification) {
        return;
      }

      await markNotificationRead(notification);

      if (notification.link) {
        setOpen(false);
        navigate(notification.link);
      }
    },
    [markNotificationRead, navigate]
  );

  const handleOpenChange = useCallback((nextOpen) => {
    setOpen(nextOpen);
    if (!nextOpen) setExtraPages([]);
  }, []);

  const handleLoadMore = useCallback(() => {
    fetchMoreNotifications();
  }, [fetchMoreNotifications]);

  const popoverContent = (
    <div className="w-[min(360px,calc(100vw-24px))] max-h-[min(400px,70vh)] flex flex-col">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 pb-3 border-b pl-4 pr-3">
        <div className="min-w-0">
          <p className="font-semibold text-foreground truncate">Notifications</p>
          <p className="text-xs text-muted-foreground">
            {hasUnread ? `${summary.unread} unread` : 'All caught up'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={markAllRead}
          disabled={!hasUnread}
          className="h-9 min-h-[44px] sm:min-h-0 shrink-0 self-start sm:self-auto"
        >
          <CheckCircle className="h-4 w-4 mr-1 shrink-0" />
          <span className="truncate">Mark all read</span>
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto py-3">
        {(summaryError || listError) && (
          <div className="mx-2 mb-2 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm flex flex-col gap-2">
            <span>Notifications could not be loaded.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { refetchSummary(); if (open) refetchList(); }}
              className="w-fit"
            >
              Try again
            </Button>
          </div>
        )}
        {loadingList ? (
          <div className="flex justify-center items-center h-[200px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : displayedNotifications.length === 0 ? (
          <Empty description="No notifications yet" className="py-6 sm:py-8" />
        ) : (
          <div className="flex flex-col gap-1">
            {displayedNotifications.map((item) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => handleNotificationClick(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleNotificationClick(item);
                  }
                }}
                className={cn(
                  'cursor-pointer rounded-lg mx-1 sm:mx-2 px-3 sm:px-4 py-3 min-h-[44px] transition-colors',
                  item.isRead ? 'bg-transparent hover:bg-muted/50' : 'bg-primary/5 hover:bg-primary/10'
                )}
              >
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="flex justify-between items-start gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Zap className="h-4 w-4 shrink-0 text-primary" />
                      <span className="font-semibold text-foreground truncate">{item.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                      {item.createdAt ? dayjs(item.createdAt).fromNow() : ''}
                    </span>
                  </div>
                  {item.message && (
                    <p className={cn(
                      'text-sm break-words',
                      item.isRead ? 'text-muted-foreground' : 'text-foreground'
                    )}>
                      {item.message}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {item.type && (
                      <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                        {item.type}
                      </Badge>
                    )}
                    {item.priority && item.priority !== 'normal' && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          item.priority === 'high' ? 'border-red-300 text-red-600' : 'border-primary/30 text-primary'
                        )}
                      >
                        {item.priority}
                      </Badge>
                    )}
                    {!item.isRead && (
                      <Badge variant="default" className="text-xs">New</Badge>
                    )}
                  </div>
                  {item.actor && (
                    <p className="text-xs text-muted-foreground">
                      From {item.actor?.name || item.actor?.email || 'System'}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {hasMore && (
        <div className="pt-2 border-t flex justify-center">
          <Button
            variant="link"
            size="sm"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="h-9 min-h-[44px] sm:min-h-8 px-4"
          >
            {loadingMore ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Load more
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenChange(!open);
          }}
          disabled={loadingSummary}
          className={cn(
            'relative bg-muted hover:bg-muted/80 rounded-full',
            'h-11 w-11 min-h-[44px] min-w-[44px]',
            'flex items-center justify-center'
          )}
        >
          {loadingSummary ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {summary.unread > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold"
            >
              {summary.unread > 99 ? '99+' : summary.unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="p-0 w-auto max-w-[calc(100vw-24px)]">
        {popoverContent}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
