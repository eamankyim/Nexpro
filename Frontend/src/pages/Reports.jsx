import { useState, useEffect } from 'react';
import {
  Card,
  Select,
  DatePicker,
  Button,
  Space,
  Row,
  Col,
  Spin,
  message,
  Table,
  Tag,
  Statistic,
  Divider,
  Tabs
} from 'antd';
import {
  DownloadOutlined,
  BarChartOutlined,
  DollarOutlined,
  ShoppingOutlined,
  FileTextOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import reportService from '../services/reportService';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const Reports = () => {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState('revenue');
  const [dateRange, setDateRange] = useState([
    dayjs().startOf('month'),
    dayjs().endOf('month')
  ]);
  const [reportData, setReportData] = useState(null);
  const [groupBy, setGroupBy] = useState('day');

  useEffect(() => {
    fetchReport();
  }, [reportType, dateRange, groupBy]);

  const fetchReport = async () => {
    if (!dateRange || !dateRange[0] || !dateRange[1]) return;

    try {
      setLoading(true);
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');
      let response;

      switch (reportType) {
        case 'revenue':
          response = await reportService.getRevenueReport(startDate, endDate, groupBy);
          break;
        case 'expenses':
          response = await reportService.getExpenseReport(startDate, endDate);
          break;
        case 'outstanding':
          response = await reportService.getOutstandingPaymentsReport(startDate, endDate);
          break;
        case 'sales':
          response = await reportService.getSalesReport(startDate, endDate, groupBy);
          break;
        case 'profit-loss':
          response = await reportService.getProfitLossReport(startDate, endDate);
          break;
        default:
          return;
      }

      setReportData(response.data);
    } catch (error) {
      console.error('Error fetching report:', error);
      message.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!reportData) {
      message.warning('No report data to download');
      return;
    }

    try {
      message.loading({ content: 'Generating PDF...', key: 'pdf', duration: 0 });
      
      // Import html2pdf dynamically
      const html2pdf = (await import('html2pdf.js')).default;
      
      const reportElement = document.getElementById('report-content');
      if (!reportElement) {
        message.error({ content: 'Report content not found', key: 'pdf' });
        return;
      }

      const opt = {
        margin: 10,
        filename: `${reportType}_report_${dateRange[0].format('YYYY-MM-DD')}_${dateRange[1].format('YYYY-MM-DD')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(reportElement).save();
      
      message.destroy('pdf');
      message.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      message.error({ content: 'Failed to generate PDF', key: 'pdf' });
    }
  };

  const renderRevenueReport = () => {
    if (!reportData) return null;

    const { totalRevenue, byPeriod, byCustomer, byMethod } = reportData;

    // Format data for charts
    const periodChartData = byPeriod?.map(item => ({
      name: groupBy === 'day' 
        ? dayjs(item.date || item.date).format('MMM DD')
        : `Month ${item.month}`,
      revenue: parseFloat(item.totalRevenue || 0)
    })) || [];

    const customerChartData = byCustomer?.slice(0, 10).map(item => ({
      name: item.customer?.name || 'Unknown',
      revenue: parseFloat(item.totalRevenue || 0)
    })) || [];

    const methodChartData = byMethod?.map(item => ({
      name: item.paymentMethod || 'Unknown',
      value: parseFloat(item.totalRevenue || 0)
    })) || [];

    return (
      <div id="report-content">
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card>
              <Statistic
                title="Total Revenue"
                value={totalRevenue}
                prefix="₵"
                precision={2}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card title="Revenue Trend" extra={
              <Select value={groupBy} onChange={setGroupBy} style={{ width: 120 }}>
                <Option value="day">By Day</Option>
                <Option value="month">By Month</Option>
              </Select>
            }>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={periodChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `₵${parseFloat(value).toFixed(2)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <Card title="Top Customers">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={customerChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip formatter={(value) => `₵${parseFloat(value).toFixed(2)}`} />
                  <Bar dataKey="revenue" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col span={12}>
            <Card title="Revenue by Payment Method">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={methodChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {methodChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `₵${parseFloat(value).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Card title="Customer Details">
              <Table
                dataSource={byCustomer || []}
                rowKey={(record) => record.customerId || Math.random()}
                pagination={{ pageSize: 10 }}
                columns={[
                  {
                    title: 'Customer',
                    dataIndex: ['customer', 'name'],
                    key: 'customer',
                  },
                  {
                    title: 'Company',
                    dataIndex: ['customer', 'company'],
                    key: 'company',
                  },
                  {
                    title: 'Total Revenue',
                    dataIndex: 'totalRevenue',
                    key: 'revenue',
                    render: (value) => `₵${parseFloat(value || 0).toFixed(2)}`,
                    sorter: (a, b) => parseFloat(a.totalRevenue || 0) - parseFloat(b.totalRevenue || 0),
                  },
                  {
                    title: 'Payments',
                    dataIndex: 'paymentCount',
                    key: 'count',
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  const renderExpenseReport = () => {
    if (!reportData) return null;

    const { totalExpenses, byCategory, byVendor, byMethod, byDate } = reportData;

    const categoryChartData = byCategory?.map(item => ({
      name: item.category || 'Unknown',
      value: parseFloat(item.totalAmount || 0)
    })) || [];

    const vendorChartData = byVendor?.slice(0, 10).map(item => ({
      name: item.vendor?.name || 'Unknown',
      amount: parseFloat(item.totalAmount || 0)
    })) || [];

    const dateChartData = byDate?.map(item => ({
      name: dayjs(item.date).format('MMM DD'),
      amount: parseFloat(item.totalAmount || 0)
    })) || [];

    return (
      <div id="report-content">
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card>
              <Statistic
                title="Total Expenses"
                value={totalExpenses}
                prefix="₵"
                precision={2}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <Card title="Expenses by Category">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `₵${parseFloat(value).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col span={12}>
            <Card title="Top Vendors">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={vendorChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip formatter={(value) => `₵${parseFloat(value).toFixed(2)}`} />
                  <Bar dataKey="amount" fill="#ff4d4f" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card title="Expense Trend">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dateChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `₵${parseFloat(value).toFixed(2)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="amount" stroke="#ff4d4f" strokeWidth={2} name="Expenses" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Card title="Expenses by Category">
              <Table
                dataSource={byCategory || []}
                rowKey="category"
                pagination={false}
                columns={[
                  { title: 'Category', dataIndex: 'category', key: 'category' },
                  {
                    title: 'Amount',
                    dataIndex: 'totalAmount',
                    key: 'amount',
                    render: (value) => `₵${parseFloat(value || 0).toFixed(2)}`,
                  },
                  { title: 'Count', dataIndex: 'count', key: 'count' },
                ]}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card title="Top Vendors">
              <Table
                dataSource={byVendor?.slice(0, 10) || []}
                rowKey={(record) => record.vendorId || Math.random()}
                pagination={false}
                columns={[
                  {
                    title: 'Vendor',
                    dataIndex: ['vendor', 'name'],
                    key: 'vendor',
                  },
                  {
                    title: 'Amount',
                    dataIndex: 'totalAmount',
                    key: 'amount',
                    render: (value) => `₵${parseFloat(value || 0).toFixed(2)}`,
                  },
                  { title: 'Count', dataIndex: 'count', key: 'count' },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  const renderOutstandingPaymentsReport = () => {
    if (!reportData) return null;

    const { totalOutstanding, invoices, byCustomer, agingAnalysis } = reportData;

    const customerChartData = byCustomer?.map(item => ({
      name: item.customer?.name || 'Unknown',
      amount: parseFloat(item.totalOutstanding || 0)
    })) || [];

    const agingChartData = [
      { name: 'Current', value: agingAnalysis?.current || 0 },
      { name: '1-30 Days', value: agingAnalysis?.thirtyDays || 0 },
      { name: '31-60 Days', value: agingAnalysis?.sixtyDays || 0 },
      { name: '90+ Days', value: agingAnalysis?.ninetyPlusDays || 0 },
    ];

    return (
      <div id="report-content">
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card>
              <Statistic
                title="Total Outstanding"
                value={totalOutstanding}
                prefix="₵"
                precision={2}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <Card title="Outstanding by Customer">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={customerChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip formatter={(value) => `₵${parseFloat(value).toFixed(2)}`} />
                  <Bar dataKey="amount" fill="#ff4d4f" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col span={12}>
            <Card title="Aging Analysis">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={agingChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {agingChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `₵${parseFloat(value).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Card title="Outstanding Invoices">
              <Table
                dataSource={invoices || []}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                columns={[
                  {
                    title: 'Invoice Number',
                    dataIndex: 'invoiceNumber',
                    key: 'invoiceNumber',
                  },
                  {
                    title: 'Customer',
                    dataIndex: ['customer', 'name'],
                    key: 'customer',
                  },
                  {
                    title: 'Due Date',
                    dataIndex: 'dueDate',
                    key: 'dueDate',
                    render: (date) => dayjs(date).format('MMM DD, YYYY'),
                  },
                  {
                    title: 'Balance',
                    dataIndex: 'balance',
                    key: 'balance',
                    render: (value) => `₵${parseFloat(value || 0).toFixed(2)}`,
                  },
                  {
                    title: 'Status',
                    dataIndex: 'status',
                    key: 'status',
                    render: (status) => {
                      const colors = {
                        sent: 'blue',
                        partial: 'orange',
                        overdue: 'red',
                      };
                      return <Tag color={colors[status]}>{status?.toUpperCase()}</Tag>;
                    },
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  const renderSalesReport = () => {
    if (!reportData) return null;

    const { totalSales, byJobType, byCustomer, byDate, byStatus } = reportData;

    const jobTypeChartData = byJobType?.map(item => ({
      name: item.jobType || 'Unknown',
      value: parseFloat(item.totalSales || 0)
    })) || [];

    const customerChartData = byCustomer?.slice(0, 10).map(item => ({
      name: item.customer?.name || 'Unknown',
      sales: parseFloat(item.totalSales || 0)
    })) || [];

    const dateChartData = byDate?.map(item => ({
      name: dayjs(item.date).format('MMM DD'),
      sales: parseFloat(item.totalSales || 0)
    })) || [];

    return (
      <div id="report-content">
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card>
              <Statistic
                title="Total Sales"
                value={totalSales}
                prefix="₵"
                precision={2}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <Card title="Sales by Job Type">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={jobTypeChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {jobTypeChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `₵${parseFloat(value).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col span={12}>
            <Card title="Top Customers">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={customerChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip formatter={(value) => `₵${parseFloat(value).toFixed(2)}`} />
                  <Bar dataKey="sales" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card title="Sales Trend">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dateChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `₵${parseFloat(value).toFixed(2)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="sales" stroke="#8884d8" strokeWidth={2} name="Sales" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Card title="Sales by Job Type">
              <Table
                dataSource={byJobType || []}
                rowKey="jobType"
                pagination={false}
                columns={[
                  { title: 'Job Type', dataIndex: 'jobType', key: 'jobType' },
                  {
                    title: 'Total Sales',
                    dataIndex: 'totalSales',
                    key: 'sales',
                    render: (value) => `₵${parseFloat(value || 0).toFixed(2)}`,
                  },
                  { title: 'Jobs', dataIndex: 'jobCount', key: 'count' },
                  {
                    title: 'Avg Price',
                    dataIndex: 'averagePrice',
                    key: 'avg',
                    render: (value) => `₵${parseFloat(value || 0).toFixed(2)}`,
                  },
                ]}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card title="Sales by Status">
              <Table
                dataSource={byStatus || []}
                rowKey="status"
                pagination={false}
                columns={[
                  {
                    title: 'Status',
                    dataIndex: 'status',
                    key: 'status',
                    render: (status) => (
                      <Tag color={status === 'completed' ? 'green' : status === 'in_progress' ? 'blue' : 'orange'}>
                        {status?.toUpperCase()}
                      </Tag>
                    ),
                  },
                  {
                    title: 'Total Sales',
                    dataIndex: 'totalSales',
                    key: 'sales',
                    render: (value) => `₵${parseFloat(value || 0).toFixed(2)}`,
                  },
                  { title: 'Jobs', dataIndex: 'jobCount', key: 'count' },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  const renderProfitLossReport = () => {
    if (!reportData) return null;

    const { revenue, expenses, grossProfit, profitMargin } = reportData;

    const profitData = [
      { name: 'Revenue', value: revenue, color: '#3f8600' },
      { name: 'Expenses', value: expenses, color: '#cf1322' },
      { name: 'Profit', value: grossProfit, color: grossProfit >= 0 ? '#3f8600' : '#cf1322' },
    ];

    return (
      <div id="report-content">
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card>
              <Statistic
                title="Revenue"
                value={revenue}
                prefix="₵"
                precision={2}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Expenses"
                value={expenses}
                prefix="₵"
                precision={2}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Gross Profit"
                value={grossProfit}
                prefix="₵"
                precision={2}
                valueStyle={{ color: grossProfit >= 0 ? '#3f8600' : '#cf1322' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card>
              <Statistic
                title="Profit Margin"
                value={profitMargin}
                suffix="%"
                precision={2}
                valueStyle={{ color: profitMargin >= 0 ? '#3f8600' : '#cf1322' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Card title="Profit & Loss Overview">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={profitData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `₵${parseFloat(value).toFixed(2)}`} />
                  <Bar dataKey="value" fill="#8884d8">
                    {profitData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  const renderReport = () => {
    switch (reportType) {
      case 'revenue':
        return renderRevenueReport();
      case 'expenses':
        return renderExpenseReport();
      case 'outstanding':
        return renderOutstandingPaymentsReport();
      case 'sales':
        return renderSalesReport();
      case 'profit-loss':
        return renderProfitLossReport();
      default:
        return null;
    }
  };

  const reportTypes = [
    { value: 'revenue', label: 'Revenue Report', icon: <DollarOutlined /> },
    { value: 'expenses', label: 'Expense Report', icon: <ShoppingOutlined /> },
    { value: 'outstanding', label: 'Outstanding Payments', icon: <FileTextOutlined /> },
    { value: 'sales', label: 'Sales Report', icon: <BarChartOutlined /> },
    { value: 'profit-loss', label: 'Profit & Loss', icon: <BarChartOutlined /> },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <h1>Reports</h1>
        <Space>
          <Select
            value={reportType}
            onChange={setReportType}
            style={{ width: 200 }}
            size="large"
          >
            {reportTypes.map(type => (
              <Option key={type.value} value={type.value}>
                {type.icon} {type.label}
              </Option>
            ))}
          </Select>
          <RangePicker
            value={dateRange}
            onChange={setDateRange}
            size="large"
            format="MMM DD, YYYY"
          />
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleDownloadPDF}
            size="large"
            disabled={!reportData}
          >
            Download PDF
          </Button>
        </Space>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <Spin size="large" />
        </div>
      ) : (
        reportData && renderReport()
      )}
    </div>
  );
};

export default Reports;

