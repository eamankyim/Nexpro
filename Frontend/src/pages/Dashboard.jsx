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

// Extend dayjs with plugins
dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);

const { RangePicker } = DatePicker;

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [dateRange, setDateRange] = useState(() => {
    const today = dayjs();
    return [today, today];
  });
  const [filteredData, setFilteredData] = useState(null);
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
    // Fetch today's data by default
    const today = dayjs();
    fetchDashboardData(today.format('YYYY-MM-DD'), today.format('YYYY-MM-DD'));
  }, []);

  const fetchDashboardData = async (startDate = null, endDate = null) => {
    try {
      setLoading(true);
      const response = await dashboardService.getOverview(startDate, endDate);
      setOverview(response.data);
      setFilteredData(response.data);
    } catch (error) {
      message.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
    if (dates && dates[0] && dates[1]) {
      const startDate = dates[0].format('YYYY-MM-DD');
      const endDate = dates[1].format('YYYY-MM-DD');
      fetchDashboardData(startDate, endDate);
    } else {
      // If no date range selected, fetch all data
      setFilteredData(null);
      fetchDashboardData();
    }
  };

  const clearFilters = () => {
    setDateRange(null);
    setFilteredData(null);
    fetchDashboardData();
  };

  // Quick date filter functions
  const setTodayFilter = () => {
    const today = dayjs();
    const dateRange = [today, today];
    setDateRange(dateRange);
    fetchDashboardData(today.format('YYYY-MM-DD'), today.format('YYYY-MM-DD'));
  };

  const setYesterdayFilter = () => {
    const yesterday = dayjs().subtract(1, 'day');
    const dateRange = [yesterday, yesterday];
    setDateRange(dateRange);
    fetchDashboardData(yesterday.format('YYYY-MM-DD'), yesterday.format('YYYY-MM-DD'));
  };

  const setThisWeekFilter = () => {
    const startOfWeek = dayjs().startOf('isoWeek');
    const endOfWeek = dayjs().endOf('isoWeek');
    const dateRange = [startOfWeek, endOfWeek];
    setDateRange(dateRange);
    fetchDashboardData(startOfWeek.format('YYYY-MM-DD'), endOfWeek.format('YYYY-MM-DD'));
  };

  const setThisMonthFilter = () => {
    const startOfMonth = dayjs().startOf('month');
    const endOfMonth = dayjs().endOf('month');
    const dateRange = [startOfMonth, endOfMonth];
    setDateRange(dateRange);
    fetchDashboardData(startOfMonth.format('YYYY-MM-DD'), endOfMonth.format('YYYY-MM-DD'));
  };

  const setThisQuarterFilter = () => {
    const currentQuarter = Math.floor(dayjs().month() / 3);
    const startOfQuarter = dayjs().startOf('year').add(currentQuarter * 3, 'months');
    const endOfQuarter = startOfQuarter.add(2, 'months').endOf('month');
    const dateRange = [startOfQuarter, endOfQuarter];
    setDateRange(dateRange);
    fetchDashboardData(startOfQuarter.format('YYYY-MM-DD'), endOfQuarter.format('YYYY-MM-DD'));
  };

  const setThisYearFilter = () => {
    const startOfYear = dayjs().startOf('year');
    const endOfYear = dayjs().endOf('year');
    const dateRange = [startOfYear, endOfYear];
    setDateRange(dateRange);
    fetchDashboardData(startOfYear.format('YYYY-MM-DD'), endOfYear.format('YYYY-MM-DD'));
  };

  const statusColors = {
    pending: 'orange',
    in_progress: 'blue',
    completed: 'green',
    cancelled: 'red',
    on_hold: 'gray',
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
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  // Use filtered data if available, otherwise use overview data
  const displayData = filteredData || overview;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        {/* Title */}
        <h1 style={{ marginBottom: 16, textAlign: isMobile ? 'center' : 'left' }}>Dashboard</h1>
        
        {/* Quick Date Filter Buttons */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8, 
          flexWrap: 'wrap',
          justifyContent: isMobile ? 'center' : 'flex-start',
          marginBottom: 16
        }}>
          <span style={{ 
            fontWeight: 500, 
            color: '#666',
            fontSize: isMobile ? '14px' : '16px',
            whiteSpace: 'nowrap'
          }}>
            Quick filters:
          </span>
          <div style={{ 
            display: 'flex', 
            gap: 8, 
            flexWrap: 'wrap',
            justifyContent: isMobile ? 'center' : 'flex-start'
          }}>
            <Tooltip title="Show data for today only">
              <Button 
                size={isMobile ? 'middle' : 'small'}
                onClick={setTodayFilter}
                type={(dateRange && dayjs().isSame(dateRange[0], 'day') && dayjs().isSame(dateRange[1], 'day')) || (!dateRange && !filteredData) ? 'primary' : 'default'}
              >
                Today
              </Button>
            </Tooltip>
            <Tooltip title="Show data for yesterday only">
              <Button 
                size={isMobile ? 'middle' : 'small'}
                onClick={setYesterdayFilter}
                type={dateRange && dayjs().subtract(1, 'day').isSame(dateRange[0], 'day') && dayjs().subtract(1, 'day').isSame(dateRange[1], 'day') ? 'primary' : 'default'}
              >
                Yesterday
              </Button>
            </Tooltip>
            <Tooltip title="Show data for this week (Monday to Sunday)">
              <Button 
                size={isMobile ? 'middle' : 'small'}
                onClick={setThisWeekFilter}
                type={dateRange && dayjs().startOf('isoWeek').isSame(dateRange[0], 'day') && dayjs().endOf('isoWeek').isSame(dateRange[1], 'day') ? 'primary' : 'default'}
              >
                This Week
              </Button>
            </Tooltip>
            <Tooltip title="Show data for this month">
              <Button 
                size={isMobile ? 'middle' : 'small'}
                onClick={setThisMonthFilter}
                type={dateRange && dayjs().startOf('month').isSame(dateRange[0], 'day') && dayjs().endOf('month').isSame(dateRange[1], 'day') ? 'primary' : 'default'}
              >
                This Month
              </Button>
            </Tooltip>
            <Tooltip title="Show data for this quarter">
              <Button 
                size={isMobile ? 'middle' : 'small'}
                onClick={setThisQuarterFilter}
                type={dateRange && dayjs().startOf('quarter').isSame(dateRange[0], 'day') && dayjs().endOf('quarter').isSame(dateRange[1], 'day') ? 'primary' : 'default'}
              >
                This Quarter
              </Button>
            </Tooltip>
            <Tooltip title="Show data for this year">
              <Button 
                size={isMobile ? 'middle' : 'small'}
                onClick={setThisYearFilter}
                type={dateRange && dayjs().startOf('year').isSame(dateRange[0], 'day') && dayjs().endOf('year').isSame(dateRange[1], 'day') ? 'primary' : 'default'}
              >
                This Year
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={dateRange ? "Revenue" : "Today's Revenue"}
              value={dateRange ? (displayData?.filteredPeriod?.revenue || 0) : (displayData?.filteredPeriod?.revenue || 0)}
              prefix="₵"
              valueStyle={{ color: '#3f8600' }}
              suffix={<RiseOutlined />}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
              All-time: ₵{displayData?.allTime?.revenue || 0}
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={dateRange ? "Expenses" : "Today's Expenses"}
              value={dateRange ? (displayData?.filteredPeriod?.expenses || 0) : (displayData?.filteredPeriod?.expenses || 0)}
              prefix="₵"
              valueStyle={{ color: '#cf1322' }}
              suffix={<FallOutlined />}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
              All-time: ₵{displayData?.allTime?.expenses || 0}
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
          <Card title="Job Status Overview" bordered={false}>
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
          <Card title="Recent Jobs" bordered={false}>
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


