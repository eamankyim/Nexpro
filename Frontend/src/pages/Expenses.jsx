import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Upload,
  message,
  Space,
  Tag,
  Popconfirm,
  Row,
  Col,
  Statistic,
  Divider,
  Tabs,
  Empty,
  Spin,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  UploadOutlined,
  DollarCircleOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import expenseService from '../services/expenseService';
import jobService from '../services/jobService';
import vendorService from '../services/vendorService';

const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [form] = Form.useForm();
  const [jobs, setJobs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    category: null,
    status: null,
    jobId: null
  });
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchExpenses();
    fetchJobs();
    fetchVendors();
    fetchStats();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters
      };
      const response = await expenseService.getAll(params);
      setExpenses(response.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.count || 0
      }));
    } catch (error) {
      message.error('Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async () => {
    try {
      const response = await jobService.getAll();
      setJobs(response.data || []);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await vendorService.getAll();
      setVendors(response.data || []);
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await expenseService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleCreate = () => {
    setEditingExpense(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    form.setFieldsValue({
      ...expense,
      expenseDate: expense.expenseDate ? dayjs(expense.expenseDate) : null
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await expenseService.delete(id);
      message.success('Expense deleted successfully');
      fetchExpenses();
      fetchStats();
    } catch (error) {
      message.error('Failed to delete expense');
    }
  };

  const handleSubmit = async (values) => {
    try {
      const expenseData = {
        ...values,
        expenseDate: values.expenseDate ? values.expenseDate.format('YYYY-MM-DD') : null
      };

      if (editingExpense) {
        await expenseService.update(editingExpense.id, expenseData);
        message.success('Expense updated successfully');
      } else {
        await expenseService.create(expenseData);
        message.success('Expense created successfully');
      }

      setModalVisible(false);
      fetchExpenses();
      fetchStats();
    } catch (error) {
      message.error('Failed to save expense');
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setPagination(prev => ({
      ...prev,
      current: 1
    }));
  };

  const columns = [
    {
      title: 'Expense #',
      dataIndex: 'expenseNumber',
      key: 'expenseNumber',
      width: 150
    },
    {
      title: 'Date',
      dataIndex: 'expenseDate',
      key: 'expenseDate',
      width: 140,
      render: (date) => dayjs(date).format('MMM DD, YYYY')
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 150,
      render: (category) => <Tag color="blue">{category}</Tag>
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: 240,
      ellipsis: true
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 140,
      render: (amount) => `GHS ${parseFloat(amount).toFixed(2)}`,
      sorter: (a, b) => parseFloat(a.amount) - parseFloat(b.amount)
    },
    {
      title: 'Job',
      dataIndex: ['job', 'jobNumber'],
      key: 'job',
      width: 150,
      render: (jobNumber, record) => (
        jobNumber ? (
          <Tag color="green">{jobNumber}</Tag>
        ) : (
          <Tag color="default">General</Tag>
        )
      )
    },
    {
      title: 'Vendor',
      dataIndex: ['vendor', 'name'],
      key: 'vendor',
      width: 170,
      ellipsis: true
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const colors = {
          pending: 'orange',
          paid: 'green',
          overdue: 'red'
        };
        return <Tag color={colors[status]}>{status.toUpperCase()}</Tag>;
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Are you sure you want to delete this expense?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const expenseCategories = [
    'Materials',
    'Labor',
    'Equipment',
    'Transportation',
    'Utilities',
    'Marketing',
    'Office Supplies',
    'Maintenance',
    'Other'
  ];

  const paymentMethods = [
    'cash',
    'check',
    'credit_card',
    'bank_transfer',
    'other'
  ];

  const statusOptions = [
    'pending',
    'paid',
    'overdue'
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Expenses</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreate}
        >
          Add Expense
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Total Expenses"
                value={stats.totalExpenses || 0}
                prefix="GHS "
                valueStyle={{ color: '#cf1322' }}
                suffix={<ShoppingCartOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Categories"
                value={stats.categoryStats ? stats.categoryStats.length : 0}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="This Month"
                value={stats.thisMonthExpenses || 0}
                prefix="GHS "
                valueStyle={{ color: '#52c41a' }}
                suffix={<CalendarOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={6}>
            <Select
              placeholder="Filter by Category"
              allowClear
              style={{ width: '100%' }}
              value={filters.category}
              onChange={(value) => handleFilterChange('category', value)}
            >
              {expenseCategories.map(category => (
                <Option key={category} value={category}>{category}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={6}>
            <Select
              placeholder="Filter by Status"
              allowClear
              style={{ width: '100%' }}
              value={filters.status}
              onChange={(value) => handleFilterChange('status', value)}
            >
              {statusOptions.map(status => (
                <Option key={status} value={status}>{status.toUpperCase()}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={6}>
            <Select
              placeholder="Filter by Job"
              allowClear
              style={{ width: '100%' }}
              value={filters.jobId}
              onChange={(value) => handleFilterChange('jobId', value)}
            >
              {jobs.map(job => (
                <Option key={job.id} value={job.id}>{job.jobNumber} - {job.title}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={6}>
            <Button
              onClick={() => {
                setFilters({ category: null, status: null, jobId: null });
                setPagination(prev => ({ ...prev, current: 1 }));
              }}
            >
              Clear Filters
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Expenses Table with Tabs */}
      <Card>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={[
            {
              key: 'all',
              label: 'All Expenses',
              children: (
                <Table
                  columns={columns}
                  dataSource={expenses}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    current: pagination.current,
                    pageSize: pagination.pageSize,
                    total: pagination.total,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} expenses`,
                    onChange: (page, pageSize) => {
                      setPagination(prev => ({
                        ...prev,
                        current: page,
                        pageSize: pageSize || prev.pageSize
                      }));
                    }
                  }}
                />
              )
            },
            {
              key: 'job-specific',
              label: 'Job-Specific Expenses',
              children: (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <Select
                      placeholder="Select a job to view its expenses"
                      style={{ width: 300 }}
                      onChange={(jobId) => {
                        if (jobId) {
                          setFilters(prev => ({ ...prev, jobId }));
                        } else {
                          setFilters(prev => ({ ...prev, jobId: null }));
                        }
                      }}
                      allowClear
                    >
                      {jobs.map(job => (
                        <Option key={job.id} value={job.id}>
                          {job.jobNumber} - {job.title}
                        </Option>
                      ))}
                    </Select>
                  </div>
                  <Table
                    columns={columns}
                    dataSource={expenses?.filter(expense => expense.jobId) || []}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                      current: pagination.current,
                      pageSize: pagination.pageSize,
                      total: pagination.total,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} job expenses`,
                      onChange: (page, pageSize) => {
                        setPagination(prev => ({
                          ...prev,
                          current: page,
                          pageSize: pageSize || prev.pageSize
                        }));
                      }
                    }}
                  />
                </div>
              )
            },
            {
              key: 'general',
              label: 'General Expenses',
              children: (
                <Table
                  columns={columns}
                  dataSource={expenses?.filter(expense => !expense.jobId) || []}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    current: pagination.current,
                    pageSize: pagination.pageSize,
                    total: pagination.total,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} general expenses`,
                    onChange: (page, pageSize) => {
                      setPagination(prev => ({
                        ...prev,
                        current: page,
                        pageSize: pageSize || prev.pageSize
                      }));
                    }
                  }}
                />
              )
            }
          ]}
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        title={editingExpense ? 'Edit Expense' : 'Add New Expense'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="category"
                label="Category"
                rules={[{ required: true, message: 'Please select a category' }]}
              >
                <Select placeholder="Select category">
                  {expenseCategories.map(category => (
                    <Option key={category} value={category}>{category}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="amount"
                label="Amount"
                rules={[{ required: true, message: 'Please enter amount' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  precision={2}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter description' }]}
          >
            <TextArea rows={3} placeholder="Enter expense description" />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="expenseDate"
                label="Expense Date"
                rules={[{ required: true, message: 'Please select date' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="paymentMethod"
                label="Payment Method"
                rules={[{ required: true, message: 'Please select payment method' }]}
              >
                <Select placeholder="Select payment method">
                  {paymentMethods.map(method => (
                    <Option key={method} value={method}>
                      {method.replace('_', ' ').toUpperCase()}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="jobId"
                label="Associated Job (Optional)"
              >
                <Select
                  placeholder="Select job (leave empty for general expense)"
                  allowClear
                >
                  {jobs.map(job => (
                    <Option key={job.id} value={job.id}>
                      {job.jobNumber} - {job.title}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="vendorId"
                label="Vendor (Optional)"
              >
                <Select
                  placeholder="Select vendor"
                  allowClear
                >
                  {vendors.map(vendor => (
                    <Option key={vendor.id} value={vendor.id}>
                      {vendor.name} {vendor.company ? `(${vendor.company})` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="status"
                label="Status"
                rules={[{ required: true, message: 'Please select status' }]}
              >
                <Select placeholder="Select status">
                  {statusOptions.map(status => (
                    <Option key={status} value={status}>
                      {status.toUpperCase()}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="receiptUrl"
                label="Receipt URL (Optional)"
              >
                <Input placeholder="Enter receipt URL" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="notes"
            label="Notes (Optional)"
          >
            <TextArea rows={2} placeholder="Additional notes" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingExpense ? 'Update' : 'Create'} Expense
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Expenses;


