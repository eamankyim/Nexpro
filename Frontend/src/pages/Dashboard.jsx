import { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Spin, message, DatePicker, Space, Button, Divider, Tooltip } from 'antd';
import {
  DollarCircleOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  TeamOutlined,
  RiseOutlined,
  FallOutlined,
  FilterOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import dashboardService from '../services/dashboardService';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import relativeTime from 'dayjs/plugin/relativeTime';

// Extend dayjs with plugins
dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.extend(relativeTime);

const { RangePicker } = DatePicker;

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [dateRange, setDateRange] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Handle window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Fetch overall data by default
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async (startDate = null, endDate = null) => {
    try {
      setLoading(true);
      const response = await dashboardService.getOverview(startDate, endDate);
      setOverview(response.data);
    } catch (error) {
      message.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
    setActiveFilter(null); // Clear active filter when custom date range is used
    if (dates && dates[0] && dates[1]) {
      const startDate = dates[0].format('YYYY-MM-DD');
      const endDate = dates[1].format('YYYY-MM-DD');
      fetchDashboardData(startDate, endDate);
    } else {
      // If no date range selected, fetch all data
      fetchDashboardData();
    }
  };

  const clearFilters = () => {
    setDateRange(null);
    setActiveFilter(null);
    fetchDashboardData();
  };

  // Quick date filter functions
  const setTodayFilter = () => {
    const today = dayjs();
    const range = [today, today];
    setDateRange(range);
    setActiveFilter('today');
    fetchDashboardData(today.format('YYYY-MM-DD'), today.format('YYYY-MM-DD'));
  };

  const setYesterdayFilter = () => {
    const yesterday = dayjs().subtract(1, 'day');
    const range = [yesterday, yesterday];
    setDateRange(range);
    setActiveFilter('yesterday');
    fetchDashboardData(yesterday.format('YYYY-MM-DD'), yesterday.format('YYYY-MM-DD'));
  };

  const setThisWeekFilter = () => {
    const startOfWeek = dayjs().startOf('isoWeek');
    const endOfWeek = dayjs().endOf('isoWeek');
    const range = [startOfWeek, endOfWeek];
    setDateRange(range);
    setActiveFilter('week');
    fetchDashboardData(startOfWeek.format('YYYY-MM-DD'), endOfWeek.format('YYYY-MM-DD'));
  };

  const setThisMonthFilter = () => {
    const startOfMonth = dayjs().startOf('month');
    const endOfMonth = dayjs().endOf('month');
    const range = [startOfMonth, endOfMonth];
    setDateRange(range);
    setActiveFilter('month');
    fetchDashboardData(startOfMonth.format('YYYY-MM-DD'), endOfMonth.format('YYYY-MM-DD'));
  };

  const setThisQuarterFilter = () => {
    const currentQuarter = Math.floor(dayjs().month() / 3);
    const startOfQuarter = dayjs().startOf('year').add(currentQuarter * 3, 'months');
    const endOfQuarter = startOfQuarter.add(2, 'months').endOf('month');
    const range = [startOfQuarter, endOfQuarter];
    setDateRange(range);
    setActiveFilter('quarter');
    fetchDashboardData(startOfQuarter.format('YYYY-MM-DD'), endOfQuarter.format('YYYY-MM-DD'));
  };

  const setThisYearFilter = () => {
    const startOfYear = dayjs().startOf('year');
    const endOfYear = dayjs().endOf('year');
    const range = [startOfYear, endOfYear];
    setDateRange(range);
    setActiveFilter('year');
    fetchDashboardData(startOfYear.format('YYYY-MM-DD'), endOfYear.format('YYYY-MM-DD'));
  };

  const statusColors = {
    pending: 'orange',
    in_progress: 'blue',
    completed: 'green',
    cancelled: 'red',
    on_hold: 'gray',
  };

  const getDueDateStatus = (dueDate) => {
    if (!dueDate) {
      return {
        color: 'default',
        label: 'No due date set',
        formatted: '—'
      };
    }

    const due = dayjs(dueDate);
    const now = dayjs();

    const formatted = due.format('MMM DD, YYYY');

    if (!due.isValid()) {
      return {
        color: 'default',
        label: 'Invalid due date',
        formatted: '—'
      };
    }

    const diffHours = due.diff(now, 'hour', true);

    if (diffHours < 0) {
      return {
        color: 'red',
        label: `Overdue · was due ${due.fromNow()}`,
        formatted
      };
    }

    if (diffHours <= 24) {
      return {
        color: 'red',
        label: `Due ${due.fromNow()}`,
        formatted
      };
    }

    if (diffHours <= 72) {
      return {
        color: 'orange',
        label: `Upcoming · due ${due.fromNow()}`,
        formatted
      };
    }

    return {
      color: 'default',
      label: `Due ${due.fromNow()}`,
      formatted
    };
  };

  const recentJobsColumns = [
    {
      title: 'Job Number',
      dataIndex: 'jobNumber',
      key: 'jobNumber',
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Customer',
      dataIndex: ['customer', 'name'],
      key: 'customer',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={statusColors[status]}>
          {status.replace('_', ' ').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('MMM DD, YYYY'),
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (dueDate) => {
        const { color, label, formatted } = getDueDateStatus(dueDate);
        return (
          <Space direction="vertical" size={0}>
            <span>{formatted}</span>
            {label && (
              <Tag color={color} style={{ marginTop: 4 }}>
                {label}
              </Tag>
            )}
          </Space>
        );
      }
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  // Use filtered data if available, otherwise use overview data
  const displayData = overview;
  const isFiltered = Boolean(dateRange && dateRange[0] && dateRange[1]);
  const thisMonthSummary = displayData?.thisMonth || {};
  const revenueValue = Number(thisMonthSummary.revenue ?? 0);
  const expenseValue = Number(thisMonthSummary.expenses ?? 0);
  const revenueTitle = isFiltered ? 'Selected Revenue' : "This Month's Revenue";
  const expenseTitle = isFiltered ? 'Selected Expenses' : "This Month's Expenses";
  const thisMonthRange = thisMonthSummary.range;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        {/* Title */}
        <h1 style={{ marginBottom: 16, textAlign: isMobile ? 'center' : 'left' }}>Dashboard</h1>
        
        {/* Quick Date Filter Buttons */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: isMobile ? 'center' : 'space-between',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: 8,
              alignItems: isMobile ? 'stretch' : 'center',
            }}
          >
            <span
              style={{
                fontWeight: 500,
                color: '#666',
                fontSize: isMobile ? '14px' : '16px',
                whiteSpace: 'nowrap',
              }}
            >
              Quick filters:
            </span>
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                justifyContent: isMobile ? 'center' : 'flex-start',
              }}
            >
              <Tooltip title="Show data for today only">
                <Button
                  size={isMobile ? 'middle' : 'small'}
                  onClick={setTodayFilter}
                  type={activeFilter === 'today' ? 'primary' : 'default'}
                >
                  Today
                </Button>
              </Tooltip>
              <Tooltip title="Show data for yesterday only">
                <Button
                  size={isMobile ? 'middle' : 'small'}
                  onClick={setYesterdayFilter}
                  type={activeFilter === 'yesterday' ? 'primary' : 'default'}
                >
                  Yesterday
                </Button>
              </Tooltip>
              <Tooltip title="Show data for this week (Monday to Sunday)">
                <Button
                  size={isMobile ? 'middle' : 'small'}
                  onClick={setThisWeekFilter}
                  type={activeFilter === 'week' ? 'primary' : 'default'}
                >
                  This Week
                </Button>
              </Tooltip>
              <Tooltip title="Show data for this month">
                <Button
                  size={isMobile ? 'middle' : 'small'}
                  onClick={setThisMonthFilter}
                  type={activeFilter === 'month' ? 'primary' : 'default'}
                >
                  This Month
                </Button>
              </Tooltip>
              <Tooltip title="Show data for this quarter">
                <Button
                  size={isMobile ? 'middle' : 'small'}
                  onClick={setThisQuarterFilter}
                  type={activeFilter === 'quarter' ? 'primary' : 'default'}
                >
                  This Quarter
                </Button>
              </Tooltip>
              <Tooltip title="Show data for this year">
                <Button
                  size={isMobile ? 'middle' : 'small'}
                  onClick={setThisYearFilter}
                  type={activeFilter === 'year' ? 'primary' : 'default'}
                >
                  This Year
                </Button>
              </Tooltip>
            </div>
          </div>
          <Space
            direction={isMobile ? 'vertical' : 'horizontal'}
            size={8}
            style={{
              width: isMobile ? '100%' : 'auto',
              justifyContent: 'flex-end',
            }}
          >
            <RangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              allowClear
              style={{ width: isMobile ? '100%' : 260 }}
              format="YYYY-MM-DD"
            />
            <Button icon={<FilterOutlined />} onClick={clearFilters}>
              Clear Filters
            </Button>
          </Space>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={revenueTitle}
              value={revenueValue}
              prefix="₵"
              valueStyle={{ color: '#3f8600' }}
              precision={2}
              suffix={<RiseOutlined />}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
              All-time: ₵{Number(displayData?.allTime?.revenue ?? 0).toFixed(2)}
              {thisMonthRange && (
                <div>
                  <Tooltip
                    title={`Range: ${dayjs(thisMonthRange.start).format('MMM DD, YYYY')} → ${dayjs(
                      thisMonthRange.end
                    ).format('MMM DD, YYYY')}`}
                  >
                    <span>
                      Period: {dayjs(thisMonthRange.start).format('MMM DD')} -{' '}
                      {dayjs(thisMonthRange.end).format('MMM DD')}
                    </span>
                  </Tooltip>
                </div>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={expenseTitle}
              value={expenseValue}
              prefix="₵"
              valueStyle={{ color: '#cf1322' }}
              precision={2}
              suffix={<FallOutlined />}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
              All-time: ₵{Number(displayData?.allTime?.expenses ?? 0).toFixed(2)}
              {thisMonthRange && (
                <div>
                  <Tooltip
                    title={`Range: ${dayjs(thisMonthRange.start).format('MMM DD, YYYY')} → ${dayjs(
                      thisMonthRange.end
                    ).format('MMM DD, YYYY')}`}
                  >
                    <span>
                      Period: {dayjs(thisMonthRange.start).format('MMM DD')} -{' '}
                      {dayjs(thisMonthRange.end).format('MMM DD')}
                    </span>
                  </Tooltip>
                </div>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Jobs"
              value={displayData?.summary?.totalJobs || 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
              In progress: {displayData?.summary?.inProgressJobs || 0}
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Customers"
              value={displayData?.summary?.totalCustomers || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
              Active customers
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="Job Status Overview">
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Statistic
                  title="Pending"
                  value={displayData?.summary?.pendingJobs || 0}
                  valueStyle={{ color: '#faad14' }}
                />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic
                  title="In Progress"
                  value={displayData?.summary?.inProgressJobs || 0}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic
                  title="Completed"
                  value={displayData?.summary?.completedJobs || 0}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="Jobs In Progress">
            <Table
              dataSource={displayData?.recentJobs || []}
              columns={recentJobsColumns}
              rowKey="id"
              pagination={{ pageSize: 5 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;


