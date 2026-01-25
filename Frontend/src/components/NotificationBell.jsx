import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Empty, List, Popover, Space, Spin, Tag, Typography } from 'antd';
import { Bell, CheckCircle, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import notificationService from '../services/notificationService';
import { useAuth } from '../context/AuthContext';

dayjs.extend(relativeTime);

const { Text } = Typography;
const PAGE_SIZE = 10;

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState({ total: 0, unread: 0, recent: 0 });
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const { activeTenantId } = useAuth();

  const navigate = useNavigate();

  const hasUnread = Boolean(summary?.unread);
  const hasMore = useMemo(() => {
    const totalPages = pagination?.totalPages ?? 1;
    const currentPage = pagination?.page ?? 1;
    return currentPage < totalPages;
  }, [pagination]);

  const fetchSummary = useCallback(async () => {
    if (!activeTenantId) {
      setSummary({ total: 0, unread: 0, recent: 0 });
      return;
    }

    setLoadingSummary(true);
    try {
      const response = await notificationService.getSummary();
      if (response?.success && response?.data) {
        setSummary({
          total: response.data.total ?? 0,
          unread: response.data.unread ?? 0,
          recent: response.data.recent ?? 0,
        });
      } else {
        setSummary({ total: 0, unread: 0, recent: 0 });
      }
    } catch (error) {
      // Silently handle network errors (backend unavailable)
      const isNetworkError = error?.code === 'ERR_NETWORK' || error?.message === 'Network Error';
      if (!isNetworkError) {
        console.error('Failed to load notification summary', error);
      }
      setSummary({ total: 0, unread: 0, recent: 0 });
    } finally {
      setLoadingSummary(false);
    }
  }, [activeTenantId]);

  const fetchNotifications = useCallback(
    async (pageToLoad = 1, append = false) => {
      if (!activeTenantId) {
        setNotifications([]);
        setPagination({ page: 1, totalPages: 1 });
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoadingList(true);
      }
      try {
        const response = await notificationService.getNotifications({ page: pageToLoad, limit: PAGE_SIZE });
        if (response?.success) {
          const items = Array.isArray(response.data) ? response.data : [];
          setNotifications((prev) => (append ? [...prev, ...items] : items));
          setPagination({
            page: response.pagination?.page ?? pageToLoad,
            totalPages: response.pagination?.totalPages ?? 1,
          });
        } else if (!append) {
          setNotifications([]);
          setPagination({ page: 1, totalPages: 1 });
        }
      } catch (error) {
        // Silently handle network errors (backend unavailable)
        const isNetworkError = error?.code === 'ERR_NETWORK' || error?.message === 'Network Error';
        if (!isNetworkError) {
          console.error('Failed to load notifications', error);
        }
        if (!append) {
          setNotifications([]);
          setPagination({ page: 1, totalPages: 1 });
        }
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoadingList(false);
        }
      }
    },
    [activeTenantId]
  );

  const markNotificationRead = useCallback(
    async (notification) => {
      if (!notification || notification.isRead) {
        return;
      }

      try {
        const response = await notificationService.markRead(notification.id);
        if (response?.success) {
          setNotifications((prev) =>
            prev.map((item) =>
              item.id === notification.id
                ? { ...item, isRead: true, readAt: response.data?.readAt || new Date().toISOString() }
                : item
            )
          );
          setSummary((prev) => ({
            ...prev,
            unread: Math.max(0, (prev.unread ?? 0) - 1)
          }));
        }
      } catch (error) {
        // Silently handle network errors (backend unavailable)
        const isNetworkError = error?.code === 'ERR_NETWORK' || error?.message === 'Network Error';
        if (!isNetworkError) {
          console.error('Failed to mark notification as read', error);
        }
      }
    },
    []
  );

  const markAllRead = useCallback(async () => {
    if (!hasUnread) {
      return;
    }
    try {
      const response = await notificationService.markAllRead();
      if (response?.success) {
        setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true, readAt: item.readAt ?? new Date().toISOString() })));
        setSummary((prev) => ({ ...prev, unread: 0 }));
      }
    } catch (error) {
      // Silently handle network errors (backend unavailable)
      const isNetworkError = error?.code === 'ERR_NETWORK' || error?.message === 'Network Error';
      if (!isNetworkError) {
        console.error('Failed to mark all notifications as read', error);
      }
    }
  }, [hasUnread]);

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

  const handleOpenChange = useCallback(
    (nextOpen) => {
      setOpen(nextOpen);
      if (nextOpen) {
        fetchNotifications(1, false);
      }
    },
    [fetchNotifications]
  );

  const handleLoadMore = useCallback(() => {
    const nextPage = (pagination?.page ?? 1) + 1;
    fetchNotifications(nextPage, true);
  }, [fetchNotifications, pagination]);

  useEffect(() => {
    fetchSummary();
    const interval = activeTenantId ? setInterval(fetchSummary, 60000) : null;
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [fetchSummary, activeTenantId]);

  useEffect(() => {
    setNotifications([]);
    setPagination({ page: 1, totalPages: 1 });
    if (open && activeTenantId) {
      fetchNotifications(1, false);
    }
  }, [activeTenantId, fetchNotifications, open]);

  const popoverContent = (
    <div style={{ width: 360, maxHeight: 400, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
        <div>
          <Text strong>Notifications</Text>
          <div style={{ fontSize: 12, color: '#888' }}>
            {hasUnread ? `${summary.unread} unread` : 'All caught up'}
          </div>
        </div>
        <Space>
          <Button size="small" type="text" icon={<CheckCircle className="h-4 w-4" />} onClick={markAllRead} disabled={!hasUnread}>
            Mark all read
          </Button>
        </Space>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        {loadingList ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <Spin />
          </div>
        ) : notifications.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No notifications yet"
            style={{ margin: '24px 0' }}
          />
        ) : (
          <List
            itemLayout="vertical"
            dataSource={notifications}
            renderItem={(item) => (
              <List.Item
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                style={{
                  cursor: 'pointer',
                  backgroundColor: item.isRead ? 'transparent' : 'rgba(22, 101, 52, 0.08)',
                  borderRadius: 8,
                  margin: '4px 8px',
                  padding: '12px 16px'
                }}
              >
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      <Zap className="h-4 w-4" style={{ color: '#166534' }} />
                      <Text strong>{item.title}</Text>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.createdAt ? dayjs(item.createdAt).fromNow() : ''}
                    </Text>
                  </Space>
                  {item.message && (
                    <Text style={{ color: item.isRead ? '#555' : '#2c2c2c' }}>
                      {item.message}
                    </Text>
                  )}
                  <Space size={8} wrap>
                    {item.type && <Tag color="#166534">{item.type}</Tag>}
                    {item.priority && item.priority !== 'normal' && (
                      <Tag color={item.priority === 'high' ? 'red' : '#166534'}>{item.priority}</Tag>
                    )}
                    {!item.isRead && <Tag color="green">New</Tag>}
                  </Space>
                  {item.actor && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      From {item.actor?.name || item.actor?.email || 'System'}
                    </Text>
                  )}
                </Space>
              </List.Item>
            )}
          />
        )}
      </div>
      {hasMore && (
        <div style={{ paddingTop: 8, borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'center' }}>
          <Button type="link" onClick={handleLoadMore} loading={loadingMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <Popover
      placement="bottomRight"
      trigger="click"
      open={open}
      onOpenChange={handleOpenChange}
      content={popoverContent}
    >
      <Badge
        size="small"
        count={summary.unread}
        overflowCount={99}
        offset={[-2, 6]}
      >
        <Button
          type="text"
          icon={<Bell className="h-5 w-5" />}
          loading={loadingSummary}
          className="bg-gray-100 hover:bg-gray-200"
          style={{ padding: '0 8px' }}
        />
      </Badge>
    </Popover>
  );
};

export default NotificationBell;



