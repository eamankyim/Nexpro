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
  Tooltip,
  Descriptions
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
  CalendarOutlined,
  SendOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import expenseService from '../services/expenseService';
import jobService from '../services/jobService';
import vendorService from '../services/vendorService';
import { useAuth } from '../context/AuthContext';
import DetailsDrawer from '../components/DetailsDrawer';

const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

const Expenses = () => {
  const { isAdmin } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [submittingForApproval, setSubmittingForApproval] = useState(false);
  const [approvingExpense, setApprovingExpense] = useState(false);
  const [rejectingExpense, setRejectingExpense] = useState(null);
  const [rejectingExpenseLoading, setRejectingExpenseLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [multipleMode, setMultipleMode] = useState(false);
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
  const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
  const [rejectionForm] = Form.useForm();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingExpense, setViewingExpense] = useState(null);

  useEffect(() => {
    fetchExpenses();
    fetchJobs();
    fetchVendors();
    fetchStats();
  }, [pagination.current, pagination.pageSize, filters, activeTab]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters
      };
      
      // Filter by approvalStatus based on active tab
      if (activeTab === 'approved') {
        // Show only approved expenses
        params.approvalStatus = 'approved';
      }
      // For 'all' and 'requests' tabs, don't filter by approvalStatus - show all
      
      const response = await expenseService.getAll(params);
      
      // Use the data and count from backend response
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
    setMultipleMode(false);
    form.resetFields();
    setModalVisible(true);
  };

  const handleView = (expense) => {
    setViewingExpense(expense);
    setDrawerVisible(true);
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setViewingExpense(null);
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    form.setFieldsValue({
      ...expense,
      expenseDate: expense.expenseDate ? dayjs(expense.expenseDate) : null
    });
    setModalVisible(true);
    // Close drawer if open
    if (drawerVisible) {
      setDrawerVisible(false);
    }
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
      setSubmittingExpense(true);

      if (editingExpense) {
        // Single expense update
        const expenseData = {
          ...values,
          expenseDate: values.expenseDate ? values.expenseDate.format('YYYY-MM-DD') : null
        };
        await expenseService.update(editingExpense.id, expenseData);
        message.success('Expense updated successfully');
        setModalVisible(false);
        fetchExpenses();
        fetchStats();
      } else if (multipleMode && values.expenses && Array.isArray(values.expenses)) {
        // Multiple expenses creation using bulk endpoint
        const expensesToCreate = values.expenses
          .filter(exp => exp.category && exp.amount && exp.description)
          .map(expense => ({
            ...expense,
            expenseDate: expense.expenseDate ? expense.expenseDate.format('YYYY-MM-DD') : null
          }));
        
        if (expensesToCreate.length === 0) {
          message.warning('Please add at least one expense');
          return;
        }

        // Common fields that apply to all expenses
        const commonFields = {
          expenseDate: values.expenseDate ? values.expenseDate.format('YYYY-MM-DD') : null,
          jobId: values.jobId || null,
          vendorId: values.vendorId || null,
          paymentMethod: values.paymentMethod || null,
          status: values.status || null,
          notes: values.notes || null
        };

        // Use bulk create endpoint
        const response = await expenseService.createBulk(expensesToCreate, commonFields);
        message.success(`Successfully created ${response.data.count || expensesToCreate.length} expense(s)`);
        setModalVisible(false);
        fetchExpenses();
        fetchStats();
      } else {
        // Single expense creation
        const expenseData = {
          ...values,
          expenseDate: values.expenseDate ? values.expenseDate.format('YYYY-MM-DD') : null
        };
        await expenseService.create(expenseData);
        message.success('Expense created successfully');
        setModalVisible(false);
        fetchExpenses();
        fetchStats();
      }
    } catch (error) {
      message.error('Failed to save expense(s)');
    } finally {
      setSubmittingExpense(false);
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

  const handleSubmitForApproval = async (expenseId) => {
    try {
      setSubmittingForApproval(true);
      await expenseService.submit(expenseId);
      message.success('Expense submitted for approval');
      fetchExpenses();
    } catch (error) {
      message.error('Failed to submit expense');
    } finally {
      setSubmittingForApproval(false);
    }
  };

  const handleApprove = async (expenseId) => {
    try {
      setApprovingExpense(true);
      await expenseService.approve(expenseId);
      message.success('Expense approved successfully');
      fetchExpenses();
      fetchStats();
    } catch (error) {
      message.error('Failed to approve expense');
    } finally {
      setApprovingExpense(false);
    }
  };

  const handleRejectClick = (expense) => {
    setRejectingExpense(expense);
    rejectionForm.resetFields();
    setRejectionModalVisible(true);
  };

  const handleRejectSubmit = async (values) => {
    try {
      setRejectingExpenseLoading(true);
      await expenseService.reject(rejectingExpense.id, values.rejectionReason);
      message.success('Expense rejected');
      setRejectionModalVisible(false);
      setRejectingExpense(null);
      fetchExpenses();
    } catch (error) {
      message.error('Failed to reject expense');
    } finally {
      setRejectingExpenseLoading(false);
    }
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
      width: 180,
      render: (_, record) => (
        <Space>
          <Tooltip title="View">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            />
          </Tooltip>
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

  // Columns for Expense Requests tab
  const requestColumns = [
    {
      title: 'Request #',
      dataIndex: 'expenseNumber',
      key: 'expenseNumber',
      width: 150
    },
    {
      title: 'Date',
      dataIndex: 'expenseDate',
      key: 'expenseDate',
      width: 120,
      render: (date) => dayjs(date).format('MMM DD, YYYY')
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 130,
      render: (category) => <Tag color="blue">{category}</Tag>
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (amount) => `GHS ${parseFloat(amount).toFixed(2)}`
    },
    {
      title: 'Submitted By',
      dataIndex: ['submitter', 'name'],
      key: 'submitter',
      width: 150,
      render: (name) => name || '-'
    },
    {
      title: 'Approval Status',
      dataIndex: 'approvalStatus',
      key: 'approvalStatus',
      width: 150,
      render: (status) => {
        const colors = {
          draft: 'default',
          pending_approval: 'orange',
          approved: 'green',
          rejected: 'red'
        };
        const labels = {
          draft: 'DRAFT',
          pending_approval: 'PENDING',
          approved: 'APPROVED',
          rejected: 'REJECTED'
        };
        return <Tag color={colors[status]}>{labels[status]}</Tag>;
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 240,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="View">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            />
          </Tooltip>
          {record.approvalStatus === 'draft' && !isAdmin && (
            <Tooltip title="Submit for Approval">
                <Button
                  type="primary"
                  size="small"
                  icon={<SendOutlined />}
                  onClick={() => handleSubmitForApproval(record.id)}
                  loading={submittingForApproval}
                >
                  Submit
                </Button>
            </Tooltip>
          )}
          {record.approvalStatus === 'pending_approval' && isAdmin && (
            <>
              <Tooltip title="Approve">
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleApprove(record.id)}
                  loading={approvingExpense}
                >
                  Approve
                </Button>
              </Tooltip>
              <Tooltip title="Reject">
                <Button
                  danger
                  size="small"
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleRejectClick(record)}
                  loading={rejectingExpenseLoading}
                >
                  Reject
                </Button>
              </Tooltip>
            </>
          )}
          {(record.approvalStatus === 'draft' || record.approvalStatus === 'rejected') && (
            <Tooltip title="Edit">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              />
            </Tooltip>
          )}
          {record.approvalStatus === 'rejected' && record.rejectionReason && (
            <Tooltip title={`Rejection Reason: ${record.rejectionReason}`}>
              <Button
                type="text"
                size="small"
                danger
              >
                View Reason
              </Button>
            </Tooltip>
          )}
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
    'mobile_money',
    'check',
    'credit_card',
    'bank_transfer',
    'other'
  ];

  const formatPaymentMethod = (method) => {
    const methodMap = {
      'cash': 'Cash',
      'mobile_money': 'Mobile Money',
      'check': 'Check',
      'credit_card': 'Credit Card',
      'bank_transfer': 'Bank Transfer',
      'other': 'Other'
    };
    return methodMap[method] || method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const statusOptions = [
    'pending',
    'paid',
    'overdue'
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Expenses {activeTab === 'requests' && '& Requests'}</h1>
        {!isAdmin && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            {activeTab === 'requests' ? 'New Request' : 'Add Expense'}
          </Button>
        )}
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
          onChange={(key) => {
            setActiveTab(key);
            fetchExpenses();
          }}
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
              key: 'approved',
              label: 'Approved Expenses',
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
              key: 'requests',
              label: 'Expense Requests',
              children: (
                <Table
                  columns={requestColumns}
                  dataSource={expenses}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    current: pagination.current,
                    pageSize: pagination.pageSize,
                    total: pagination.total,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} requests`,
                    onChange: (page, pageSize) => {
                      setPagination(prev => ({
                        ...prev,
                        current: page,
                        pageSize: pageSize || prev.pageSize
                      }));
                    }
                  }}
                  scroll={{ x: 1400 }}
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
        title={editingExpense ? 'Edit Expense' : multipleMode ? 'Add Multiple Expenses' : 'Add New Expense'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setMultipleMode(false);
          form.resetFields();
        }}
        footer={null}
        width={multipleMode ? 1000 : 800}
      >
        {!editingExpense && (
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button
              type={multipleMode ? 'default' : 'dashed'}
              onClick={() => {
                setMultipleMode(!multipleMode);
                form.resetFields();
              }}
              icon={multipleMode ? <EditOutlined /> : <PlusOutlined />}
            >
              {multipleMode ? 'Switch to Single' : 'Switch to Multiple'}
            </Button>
          </div>
        )}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={multipleMode ? { expenses: [{}] } : {}}
        >
          {multipleMode && !editingExpense ? (
            <>
              {/* Common fields for all expenses */}
              <Divider orientation="left">Common Fields (Applied to All Expenses)</Divider>
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
                    label="Payment Method (Optional)"
                  >
                    <Select placeholder="Select payment method (optional)">
                      {paymentMethods.map(method => (
                        <Option key={method} value={method}>
                          {formatPaymentMethod(method)}
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

              <Form.Item
                name="notes"
                label="Common Notes (Optional)"
              >
                <TextArea rows={2} placeholder="Notes that apply to all expenses" />
              </Form.Item>

              <Divider orientation="left">Expense Items</Divider>

              {/* Multiple expenses list */}
              <Form.List name="expenses">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Card key={key} size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
                        <Row gutter={16}>
                          <Col xs={24} sm={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'category']}
                              label="Category"
                              rules={[{ required: true, message: 'Required' }]}
                            >
                              <Select placeholder="Select category">
                                {expenseCategories.map(category => (
                                  <Option key={category} value={category}>{category}</Option>
                                ))}
                              </Select>
                            </Form.Item>
                          </Col>
                          <Col xs={24} sm={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'amount']}
                              label="Amount"
                              rules={[{ required: true, message: 'Required' }]}
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
                          <Col xs={24} sm={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'expenseDate']}
                              label="Date (Optional)"
                              tooltip="Leave empty to use common date"
                            >
                              <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Form.Item
                          {...restField}
                          name={[name, 'description']}
                          label="Description"
                          rules={[{ required: true, message: 'Required' }]}
                        >
                          <TextArea rows={2} placeholder="Enter expense description" />
                        </Form.Item>
                        <Row gutter={16}>
                          <Col xs={24} sm={12}>
                            <Form.Item
                              {...restField}
                              name={[name, 'jobId']}
                              label="Job (Optional)"
                              tooltip="Leave empty to use common job"
                            >
                              <Select
                                placeholder="Select job (optional)"
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
                              {...restField}
                              name={[name, 'vendorId']}
                              label="Vendor (Optional)"
                              tooltip="Leave empty to use common vendor"
                            >
                              <Select
                                placeholder="Select vendor (optional)"
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
                        <Button
                          type="dashed"
                          danger
                          onClick={() => remove(name)}
                          icon={<MinusCircleOutlined />}
                          block
                          style={{ marginTop: 8 }}
                        >
                          Remove Expense
                        </Button>
                      </Card>
                    ))}
                    <Form.Item>
                      <Button
                        type="dashed"
                        onClick={() => add()}
                        block
                        icon={<PlusOutlined />}
                        size="large"
                      >
                        Add Another Expense
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>

              <Form.Item shouldUpdate={(prevValues, currentValues) => prevValues.expenses?.length !== currentValues.expenses?.length}>
                {({ getFieldValue }) => (
                  <Space>
                    <Button type="primary" htmlType="submit" loading={submittingExpense}>
                      Create {getFieldValue('expenses')?.length || 0} Expense(s)
                    </Button>
                    <Button onClick={() => {
                      setModalVisible(false);
                      setMultipleMode(false);
                      form.resetFields();
                    }} disabled={submittingExpense}>
                      Cancel
                    </Button>
                  </Space>
                )}
              </Form.Item>
            </>
          ) : (
            <>
              {/* Single expense form */}
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
                    label="Payment Method (Optional)"
                    tooltip="Only needed when expense is approved and ready for payment"
                  >
                    <Select placeholder="Select payment method (optional)">
                      {paymentMethods.map(method => (
                        <Option key={method} value={method}>
                          {formatPaymentMethod(method)}
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
                    label="Status (Optional)"
                    tooltip="Payment status - only relevant after expense is approved and paid"
                  >
                    <Select placeholder="Select status (optional)" allowClear>
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
                  <Button type="primary" htmlType="submit" loading={submittingExpense}>
                    {editingExpense ? 'Update' : 'Create'} Expense
                  </Button>
                  <Button onClick={() => {
                    setModalVisible(false);
                    setMultipleMode(false);
                    form.resetFields();
                  }} disabled={submittingExpense}>
                    Cancel
                  </Button>
                </Space>
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* Rejection Modal */}
      <Modal
        title="Reject Expense Request"
        open={rejectionModalVisible}
        onCancel={() => {
          setRejectionModalVisible(false);
          setRejectingExpense(null);
        }}
        onOk={() => rejectionForm.submit()}
        okText="Reject"
        okButtonProps={{ danger: true }}
        confirmLoading={rejectingExpenseLoading}
      >
        {rejectingExpense && (
          <>
            <div style={{ marginBottom: 16 }}>
              <strong>Expense:</strong> {rejectingExpense.expenseNumber}
              <br />
              <strong>Amount:</strong> GHS {parseFloat(rejectingExpense.amount).toFixed(2)}
              <br />
              <strong>Description:</strong> {rejectingExpense.description}
            </div>
            <Form
              form={rejectionForm}
              layout="vertical"
              onFinish={handleRejectSubmit}
            >
              <Form.Item
                name="rejectionReason"
                label="Reason for Rejection"
                rules={[{ required: true, message: 'Please provide a reason for rejection' }]}
              >
                <TextArea
                  rows={4}
                  placeholder="Explain why this expense request is being rejected..."
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* Expense Details Drawer */}
      <DetailsDrawer
        open={drawerVisible}
        onClose={handleCloseDrawer}
        title="Expense Details"
        width={700}
        onEdit={viewingExpense ? () => handleEdit(viewingExpense) : null}
        onDelete={viewingExpense ? () => {
          handleDelete(viewingExpense.id);
          setDrawerVisible(false);
        } : null}
        deleteConfirmText="Are you sure you want to delete this expense?"
        tabs={viewingExpense ? [
          {
            key: 'details',
            label: 'Details',
            content: (
              <Descriptions column={1} bordered>
                <Descriptions.Item label="Expense Number">
                  <strong>{viewingExpense.expenseNumber}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Date">
                  {viewingExpense.expenseDate ? dayjs(viewingExpense.expenseDate).format('MMMM DD, YYYY') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Category">
                  <Tag color="blue">{viewingExpense.category}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Description">
                  {viewingExpense.description || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Amount">
                  <strong style={{ fontSize: '18px', color: '#1890ff' }}>
                    GHS {parseFloat(viewingExpense.amount || 0).toFixed(2)}
                  </strong>
                </Descriptions.Item>
                <Descriptions.Item label="Payment Method">
                  {viewingExpense.paymentMethod ? formatPaymentMethod(viewingExpense.paymentMethod) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Payment Status">
                  {viewingExpense.status ? (
                    <Tag color={{
                      pending: 'orange',
                      paid: 'green',
                      overdue: 'red'
                    }[viewingExpense.status]}>
                      {viewingExpense.status.toUpperCase()}
                    </Tag>
                  ) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Approval Status">
                  {viewingExpense.approvalStatus ? (
                    <Tag color={{
                      draft: 'default',
                      pending_approval: 'orange',
                      approved: 'green',
                      rejected: 'red'
                    }[viewingExpense.approvalStatus]}>
                      {viewingExpense.approvalStatus === 'pending_approval' ? 'PENDING APPROVAL' : 
                       viewingExpense.approvalStatus.toUpperCase()}
                    </Tag>
                  ) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Vendor">
                  {viewingExpense.vendor ? (
                    <span>{viewingExpense.vendor.name} {viewingExpense.vendor.company ? `(${viewingExpense.vendor.company})` : ''}</span>
                  ) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Job">
                  {viewingExpense.job ? (
                    <span>{viewingExpense.job.jobNumber} - {viewingExpense.job.title}</span>
                  ) : 'General Expense'}
                </Descriptions.Item>
                <Descriptions.Item label="Submitted By">
                  {viewingExpense.submitter ? (
                    <span>{viewingExpense.submitter.name} ({viewingExpense.submitter.email})</span>
                  ) : '-'}
                </Descriptions.Item>
                {viewingExpense.approver && (
                  <Descriptions.Item label="Approved By">
                    <span>{viewingExpense.approver.name} ({viewingExpense.approver.email})</span>
                  </Descriptions.Item>
                )}
                {viewingExpense.approvedAt && (
                  <Descriptions.Item label="Approved At">
                    {dayjs(viewingExpense.approvedAt).format('MMMM DD, YYYY [at] hh:mm A')}
                  </Descriptions.Item>
                )}
                {viewingExpense.rejectionReason && (
                  <Descriptions.Item label="Rejection Reason">
                    <span style={{ color: '#ff4d4f' }}>{viewingExpense.rejectionReason}</span>
                  </Descriptions.Item>
                )}
                {viewingExpense.receiptUrl && (
                  <Descriptions.Item label="Receipt">
                    <a href={viewingExpense.receiptUrl} target="_blank" rel="noopener noreferrer">
                      View Receipt
                    </a>
                  </Descriptions.Item>
                )}
                {viewingExpense.isRecurring && (
                  <Descriptions.Item label="Recurring">
                    <Tag color="purple">Yes</Tag>
                    {viewingExpense.recurringFrequency && (
                      <Tag style={{ marginLeft: 8 }}>
                        {viewingExpense.recurringFrequency.charAt(0).toUpperCase() + 
                         viewingExpense.recurringFrequency.slice(1)}
                      </Tag>
                    )}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Notes">
                  {viewingExpense.notes || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Created At">
                  {viewingExpense.createdAt ? dayjs(viewingExpense.createdAt).format('MMMM DD, YYYY [at] hh:mm A') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Last Updated">
                  {viewingExpense.updatedAt ? dayjs(viewingExpense.updatedAt).format('MMMM DD, YYYY [at] hh:mm A') : '-'}
                </Descriptions.Item>
              </Descriptions>
            )
          }
        ] : null}
      />
    </div>
  );
};

export default Expenses;


