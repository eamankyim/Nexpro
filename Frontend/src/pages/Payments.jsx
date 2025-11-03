import { useState, useEffect, useCallback } from 'react';
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
  Descriptions,
  Alert
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  DollarCircleOutlined,
  CreditCardOutlined,
  MobileOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import paymentService from '../services/paymentService';
import customerService from '../services/customerService';
import jobService from '../services/jobService';
import { useAuth } from '../context/AuthContext';
import ActionColumn from '../components/ActionColumn';
import DetailsDrawer from '../components/DetailsDrawer';

const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [form] = Form.useForm();
  const [customers, setCustomers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    type: null,
    status: null,
    paymentMethod: null
  });
  const [activeTab, setActiveTab] = useState('all');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingPayment, setViewingPayment] = useState(null);
  const { isManager, isAdmin } = useAuth();

  useEffect(() => {
    fetchPayments();
    fetchCustomers();
    fetchJobs();
    fetchStats();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters
      };
      const response = await paymentService.getAll(params);
      setPayments(response.data.data);
      setPagination(prev => ({
        ...prev,
        total: response.data.count
      }));
    } catch (error) {
      message.error('Failed to fetch payments');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await customerService.getAll();
      setCustomers(response.data || []);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
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

  const fetchStats = async () => {
    try {
      const response = await paymentService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleCreate = () => {
    setEditingPayment(null);
    form.resetFields();
    form.setFieldsValue({
      type: 'income',
      status: 'completed',
      paymentDate: dayjs(),
      paymentMethod: 'cash'
    });
    setModalVisible(true);
  };

  const handleEdit = (payment) => {
    setEditingPayment(payment);
    form.setFieldsValue({
      ...payment,
      paymentDate: payment.paymentDate ? dayjs(payment.paymentDate) : null
    });
    setModalVisible(true);
  };

  const handleView = (payment) => {
    setViewingPayment(payment);
    setDrawerVisible(true);
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setViewingPayment(null);
  };

  const handleDelete = async (id) => {
    try {
      await paymentService.delete(id);
      message.success('Payment deleted successfully');
      fetchPayments();
      fetchStats();
    } catch (error) {
      message.error('Failed to delete payment');
    }
  };

  const handleSubmit = async (values) => {
    try {
      const paymentData = {
        ...values,
        paymentDate: values.paymentDate ? values.paymentDate.format('YYYY-MM-DD') : null
      };

      if (editingPayment) {
        await paymentService.update(editingPayment.id, paymentData);
        message.success('Payment updated successfully');
      } else {
        await paymentService.create(paymentData);
        message.success('Payment recorded successfully');
      }

      setModalVisible(false);
      fetchPayments();
      fetchStats();
    } catch (error) {
      message.error('Failed to save payment');
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
      title: 'Payment #',
      dataIndex: 'paymentNumber',
      key: 'paymentNumber',
      width: 120,
      fixed: 'left'
    },
    {
      title: 'Date',
      dataIndex: 'paymentDate',
      key: 'paymentDate',
      width: 100,
      render: (date) => dayjs(date).format('MMM DD, YYYY')
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type) => {
        const colors = {
          income: 'green',
          expense: 'red'
        };
        const labels = {
          income: 'INCOME',
          expense: 'EXPENSE'
        };
        return <Tag color={colors[type]}>{labels[type]}</Tag>;
      }
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (amount) => `₵${parseFloat(amount).toFixed(2)}`,
      sorter: (a, b) => parseFloat(a.amount) - parseFloat(b.amount)
    },
    {
      title: 'Method',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 120,
      render: (method) => {
        const colors = {
          cash: 'green',
          mobile_money: 'blue',
          bank_transfer: 'purple',
          check: 'orange',
          credit_card: 'cyan'
        };
        const labels = {
          cash: 'Cash',
          mobile_money: 'Mobile Money',
          bank_transfer: 'Bank Transfer',
          check: 'Check',
          credit_card: 'Credit Card'
        };
        return <Tag color={colors[method]}>{labels[method]}</Tag>;
      }
    },
    {
      title: 'Customer',
      dataIndex: ['customer', 'name'],
      key: 'customer',
      width: 150,
      ellipsis: true,
      render: (name, record) => (
        <div>
          <div>{name || '-'}</div>
          {record.customer?.company && (
            <div style={{ fontSize: 12, color: '#888' }}>{record.customer.company}</div>
          )}
        </div>
      )
    },
    {
      title: 'Job',
      dataIndex: ['job', 'jobNumber'],
      key: 'job',
      width: 120,
      render: (jobNumber, record) => (
        jobNumber ? (
          <Tag color="blue">{jobNumber}</Tag>
        ) : (
          <Tag color="default">General</Tag>
        )
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const colors = {
          pending: 'orange',
          completed: 'green',
          failed: 'red',
          cancelled: 'gray'
        };
        return <Tag color={colors[status]}>{status.toUpperCase()}</Tag>;
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <ActionColumn 
          onView={handleView} 
          onEdit={isManager ? handleEdit : null}
          onDelete={isAdmin ? handleDelete : null}
          record={record}
        />
      )
    }
  ];

  const paymentMethods = [
    { value: 'cash', label: 'Cash', icon: <DollarCircleOutlined /> },
    { value: 'mobile_money', label: 'Mobile Money', icon: <MobileOutlined /> },
    { value: 'bank_transfer', label: 'Bank Transfer', icon: <CreditCardOutlined /> },
    { value: 'check', label: 'Check', icon: <CreditCardOutlined /> },
    { value: 'credit_card', label: 'Credit Card', icon: <CreditCardOutlined /> }
  ];

  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  const typeOptions = [
    { value: 'income', label: 'Income (Customer Payment)' },
    { value: 'expense', label: 'Expense (Vendor Payment)' }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Payments</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreate}
        >
          Record Payment
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total Income"
                value={stats.find(s => s.type === 'income')?.totalAmount || 0}
                prefix="₵"
                valueStyle={{ color: '#3f8600' }}
                suffix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total Expenses"
                value={stats.find(s => s.type === 'expense')?.totalAmount || 0}
                prefix="₵"
                valueStyle={{ color: '#cf1322' }}
                suffix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Income Count"
                value={stats.find(s => s.type === 'income')?.count || 0}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Expense Count"
                value={stats.find(s => s.type === 'expense')?.count || 0}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
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
              placeholder="Filter by Type"
              allowClear
              style={{ width: '100%' }}
              value={filters.type}
              onChange={(value) => handleFilterChange('type', value)}
            >
              {typeOptions.map(option => (
                <Option key={option.value} value={option.value}>{option.label}</Option>
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
              {statusOptions.map(option => (
                <Option key={option.value} value={option.value}>{option.label}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={6}>
            <Select
              placeholder="Filter by Method"
              allowClear
              style={{ width: '100%' }}
              value={filters.paymentMethod}
              onChange={(value) => handleFilterChange('paymentMethod', value)}
            >
              {paymentMethods.map(method => (
                <Option key={method.value} value={method.value}>{method.label}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={6}>
            <Button
              onClick={() => {
                setFilters({ type: null, status: null, paymentMethod: null });
                setPagination(prev => ({ ...prev, current: 1 }));
              }}
            >
              Clear Filters
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Payments Table with Tabs */}
      <Card>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={[
            {
              key: 'all',
              label: 'All Payments',
              children: (
                <Table
                  columns={columns}
                  dataSource={payments}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    current: pagination.current,
                    pageSize: pagination.pageSize,
                    total: pagination.total,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} payments`,
                    onChange: (page, pageSize) => {
                      setPagination(prev => ({
                        ...prev,
                        current: page,
                        pageSize: pageSize || prev.pageSize
                      }));
                    }
                  }}
                  scroll={{ x: 1200 }}
                />
              )
            },
            {
              key: 'income',
              label: 'Income Payments',
              children: (
                <Table
                  columns={columns}
                  dataSource={payments?.filter(payment => payment.type === 'income') || []}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    current: pagination.current,
                    pageSize: pagination.pageSize,
                    total: pagination.total,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} income payments`,
                    onChange: (page, pageSize) => {
                      setPagination(prev => ({
                        ...prev,
                        current: page,
                        pageSize: pageSize || prev.pageSize
                      }));
                    }
                  }}
                  scroll={{ x: 1200 }}
                />
              )
            },
            {
              key: 'expense',
              label: 'Expense Payments',
              children: (
                <Table
                  columns={columns}
                  dataSource={payments?.filter(payment => payment.type === 'expense') || []}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    current: pagination.current,
                    pageSize: pagination.pageSize,
                    total: pagination.total,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} expense payments`,
                    onChange: (page, pageSize) => {
                      setPagination(prev => ({
                        ...prev,
                        current: page,
                        pageSize: pageSize || prev.pageSize
                      }));
                    }
                  }}
                  scroll={{ x: 1200 }}
                />
              )
            }
          ]}
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        title={editingPayment ? 'Edit Payment' : 'Record New Payment'}
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
                name="type"
                label="Payment Type"
                rules={[{ required: true, message: 'Please select payment type' }]}
              >
                <Select placeholder="Select payment type">
                  {typeOptions.map(option => (
                    <Option key={option.value} value={option.value}>{option.label}</Option>
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
                  prefix="₵"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="paymentMethod"
                label="Payment Method"
                rules={[{ required: true, message: 'Please select payment method' }]}
              >
                <Select placeholder="Select payment method">
                  {paymentMethods.map(method => (
                    <Option key={method.value} value={method.value}>
                      {method.icon} {method.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="status"
                label="Status"
                rules={[{ required: true, message: 'Please select status' }]}
              >
                <Select placeholder="Select status">
                  {statusOptions.map(option => (
                    <Option key={option.value} value={option.value}>{option.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="paymentDate"
                label="Payment Date"
                rules={[{ required: true, message: 'Please select date' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="customerId"
                label="Customer (for Income)"
                dependencies={['type']}
              >
                <Select
                  placeholder="Select customer"
                  allowClear
                  disabled={form.getFieldValue('type') === 'expense'}
                >
                  {customers.map(customer => (
                    <Option key={customer.id} value={customer.id}>
                      {customer.name} {customer.company ? `(${customer.company})` : ''}
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
                  placeholder="Select job"
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
                name="referenceNumber"
                label="Reference Number (Optional)"
              >
                <Input placeholder="Transaction reference number" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter description' }]}
          >
            <TextArea rows={3} placeholder="Enter payment description" />
          </Form.Item>

          <Form.Item
            name="notes"
            label="Notes (Optional)"
          >
            <TextArea rows={2} placeholder="Additional notes" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingPayment ? 'Update' : 'Record'} Payment
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Payment Details Drawer */}
      <DetailsDrawer
        open={drawerVisible}
        onClose={handleCloseDrawer}
        title="Payment Details"
        width={800}
        onEdit={isManager && viewingPayment ? () => {
          handleEdit(viewingPayment);
          setDrawerVisible(false);
        } : null}
        onDelete={isAdmin && viewingPayment ? () => {
          handleDelete(viewingPayment.id);
          setDrawerVisible(false);
        } : null}
        deleteConfirmText="Are you sure you want to delete this payment?"
        fields={viewingPayment ? [
          { label: 'Payment Number', value: viewingPayment.paymentNumber },
          { 
            label: 'Type', 
            value: viewingPayment.type,
            render: (type) => {
              const colors = { income: 'green', expense: 'red' };
              const labels = { income: 'INCOME', expense: 'EXPENSE' };
              return <Tag color={colors[type]}>{labels[type]}</Tag>;
            }
          },
          { 
            label: 'Amount', 
            value: viewingPayment.amount,
            render: (amount) => <strong style={{ fontSize: 16, color: '#1890ff' }}>₵{parseFloat(amount).toFixed(2)}</strong>
          },
          { 
            label: 'Payment Method', 
            value: viewingPayment.paymentMethod,
            render: (method) => {
              const colors = {
                cash: 'green',
                mobile_money: 'blue',
                bank_transfer: 'purple',
                check: 'orange',
                credit_card: 'cyan'
              };
              const labels = {
                cash: 'Cash',
                mobile_money: 'Mobile Money',
                bank_transfer: 'Bank Transfer',
                check: 'Check',
                credit_card: 'Credit Card'
              };
              return <Tag color={colors[method]}>{labels[method]}</Tag>;
            }
          },
          { 
            label: 'Status', 
            value: viewingPayment.status,
            render: (status) => {
              const colors = {
                pending: 'orange',
                completed: 'green',
                failed: 'red',
                cancelled: 'gray'
              };
              return <Tag color={colors[status]}>{status.toUpperCase()}</Tag>;
            }
          },
          { 
            label: 'Payment Date', 
            value: viewingPayment.paymentDate,
            render: (date) => dayjs(date).format('MMMM DD, YYYY')
          },
          { label: 'Customer', value: viewingPayment.customer?.name || '-' },
          { label: 'Company', value: viewingPayment.customer?.company || '-' },
          { label: 'Job Number', value: viewingPayment.job?.jobNumber || '-' },
          { label: 'Job Title', value: viewingPayment.job?.title || '-' },
          { label: 'Reference Number', value: viewingPayment.referenceNumber || '-' },
          { label: 'Description', value: viewingPayment.description },
          { label: 'Notes', value: viewingPayment.notes || '-' },
          { 
            label: 'Created At', 
            value: viewingPayment.createdAt,
            render: (date) => dayjs(date).format('MMMM DD, YYYY HH:mm')
          }
        ] : []}
      />
    </div>
  );
};

export default Payments;


