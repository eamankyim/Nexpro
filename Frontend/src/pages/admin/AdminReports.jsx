import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Col,
  Row,
  Spin,
  Statistic,
  Typography,
  DatePicker,
  Space,
  Table,
  Tabs,
  Tag,
} from 'antd';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
} from 'recharts';
import dayjs from 'dayjs';
import adminService from '../../services/adminService';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const defaultRange = [
  dayjs().subtract(29, 'day').startOf('day'),
  dayjs().endOf('day'),
];

const AdminReports = () => {
  const [loading, setLoading] = useState(true);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [kpis, setKpis] = useState(null);
  const [revenueSeries, setRevenueSeries] = useState([]);
  const [expenseSeries, setExpenseSeries] = useState([]);
  const [pipeline, setPipeline] = useState(null);
  const [topCustomers, setTopCustomers] = useState([]);
  const [range, setRange] = useState(defaultRange);

  const dateParams = useMemo(() => {
    if (!range || range.length !== 2) return {};
    return {
      startDate: range[0].startOf('day').toISOString(),
      endDate: range[1].endOf('day').toISOString(),
    };
  }, [range]);

  const loadKpis = async () => {
    const response = await adminService.getReportKpis(dateParams);
    if (response?.success) {
      setKpis(response.data);
    }
  };

  const loadPipeline = async () => {
    const response = await adminService.getReportPipeline();
    if (response?.success) {
      setPipeline(response.data);
    }
  };

  const loadTopCustomers = async () => {
    const response = await adminService.getReportTopCustomers({
      ...dateParams,
      limit: 5,
    });
    if (response?.success) {
      setTopCustomers(response.data || []);
    }
  };

  const loadRevenueSeries = async () => {
    setRevenueLoading(true);
    try {
      const response = await adminService.getReportRevenue({
        ...dateParams,
        groupBy: 'day',
      });
      if (response?.success) {
        const data = (response.data?.byPeriod || []).map((item) => ({
          date: item.date,
          revenue: Number(item.totalRevenue || 0),
        }));
        setRevenueSeries(data);
      }
    } finally {
      setRevenueLoading(false);
    }
  };

  const loadExpenseSeries = async () => {
    setExpenseLoading(true);
    try {
      const response = await adminService.getReportExpenses({
        ...dateParams,
      });
      if (response?.success) {
        const data = (response.data?.byDate || []).map((item) => ({
          date: item.date,
          expenses: Number(item.totalAmount || 0),
        }));
        setExpenseSeries(data);
      }
    } finally {
      setExpenseLoading(false);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadKpis(),
        loadRevenueSeries(),
        loadExpenseSeries(),
        loadPipeline(),
        loadTopCustomers(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading) {
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateParams.startDate, dateParams.endDate]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <Title level={3} style={{ marginBottom: 8 }}>
            Reports
          </Title>
          <Text type="secondary">
            Analyze revenue trends, spending, and pipeline health across tenants.
          </Text>
        </div>
        <RangePicker
          allowClear={false}
          value={range}
          onChange={(value) => setRange(value)}
        />
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Revenue"
              value={kpis?.totalRevenue ?? 0}
              precision={2}
              prefix="GHS "
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Expenses"
              value={kpis?.totalExpenses ?? 0}
              precision={2}
              prefix="GHS "
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Gross profit"
              value={kpis?.grossProfit ?? 0}
              precision={2}
              prefix="GHS "
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Pending invoices"
              value={kpis?.pendingInvoices ?? 0}
              precision={2}
              prefix="GHS "
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Revenue trend">
            {revenueLoading ? (
              <Spin />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={revenueSeries}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2f80ed" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#2f80ed" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(value) => dayjs(value).format('MMM D')} />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    formatter={(value) => `GHS ${Number(value).toLocaleString()}`}
                    labelFormatter={(value) => dayjs(value).format('MMMM D, YYYY')}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#2f80ed"
                    fill="url(#colorRevenue)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Expense trend">
            {expenseLoading ? (
              <Spin />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={expenseSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(value) => dayjs(value).format('MMM D')} />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    formatter={(value) => `GHS ${Number(value).toLocaleString()}`}
                    labelFormatter={(value) => dayjs(value).format('MMMM D, YYYY')}
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke="#eb5757"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={8}>
          <Card title="Pipeline">
            {pipeline ? (
              <BarChart width={360} height={260} data={[
                { name: 'Active jobs', value: pipeline.activeJobs },
                { name: 'Open leads', value: pipeline.openLeads },
                { name: 'Pending invoices', value: pipeline.pendingInvoices },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#9b51e0" radius={[6, 6, 0, 0]} />
              </BarChart>
            ) : (
              <Text type="secondary">No pipeline data available.</Text>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card title="Top customers">
            <Table
              rowKey={(record) => record.customer?.id || record.customerId}
              dataSource={topCustomers}
              pagination={false}
              columns={[
                {
                  title: 'Customer',
                  dataIndex: ['customer', 'name'],
                  key: 'customer',
                  render: (_, record) => (
                    <div>
                      <Text strong>{record.customer?.name || '—'}</Text>
                      <br />
                      <Text type="secondary">{record.customer?.company || '—'}</Text>
                    </div>
                  ),
                },
                {
                  title: 'Revenue',
                  dataIndex: 'totalRevenue',
                  key: 'revenue',
                  render: (value) => `GHS ${Number(value || 0).toLocaleString()}`,
                },
                {
                  title: 'Payments',
                  dataIndex: 'paymentCount',
                  key: 'payments',
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Detailed reports" style={{ marginTop: 24 }}>
        <Tabs
          items={[
            {
              key: 'revenue',
              label: 'Revenue by customer',
              children: (
                <Table
                  rowKey={(record) => record.customer?.id || record.customerId}
                  size="small"
                  dataSource={revenueSeries.filter((item) => item.revenue > 0)}
                  columns={[
                    {
                      title: 'Date',
                      dataIndex: 'date',
                      render: (value) => dayjs(value).format('MMM D, YYYY'),
                    },
                    {
                      title: 'Revenue',
                      dataIndex: 'revenue',
                      render: (value) => `GHS ${Number(value || 0).toLocaleString()}`,
                    },
                  ]}
                  pagination={false}
                  locale={{ emptyText: 'Select a shorter range to view daily revenue entries.' }}
                />
              ),
            },
            {
              key: 'expenses',
              label: 'Expenses by date',
              children: (
                <Table
                  rowKey="date"
                  size="small"
                  dataSource={expenseSeries}
                  columns={[
                    {
                      title: 'Date',
                      dataIndex: 'date',
                      render: (value) => dayjs(value).format('MMM D, YYYY'),
                    },
                    {
                      title: 'Expenses',
                      dataIndex: 'expenses',
                      render: (value) => `GHS ${Number(value || 0).toLocaleString()}`,
                    },
                  ]}
                  pagination={false}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default AdminReports;


