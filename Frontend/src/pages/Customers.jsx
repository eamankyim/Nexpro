import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, message, Space, Tag, Row, Col, Select, Descriptions, List, Spin, Empty } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import customerService from '../services/customerService';
import jobService from '../services/jobService';
import invoiceService from '../services/invoiceService';
import { useAuth } from '../context/AuthContext';
import ActionColumn from '../components/ActionColumn';
import DetailsDrawer from '../components/DetailsDrawer';
import dayjs from 'dayjs';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();
  const { isManager, user } = useAuth();
  const [showReferralName, setShowReferralName] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [customerJobs, setCustomerJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, [pagination.current, pagination.pageSize, searchText]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await customerService.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        search: searchText,
      });
      setCustomers(response.data);
      setPagination({ ...pagination, total: response.count });
    } catch (error) {
      message.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingCustomer(null);
    form.resetFields();
    setShowReferralName(false);
    setModalVisible(true);
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    form.setFieldsValue(customer);
    setShowReferralName(customer.howDidYouHear === 'Referral');
    setModalVisible(true);
  };

  const handleHowDidYouHearChange = (value) => {
    setShowReferralName(value === 'Referral');
    if (value !== 'Referral') {
      form.setFieldsValue({ referralName: undefined });
    }
  };

  const handleView = async (customer) => {
    setViewingCustomer(customer);
    setDrawerVisible(true);
    
    // Fetch customer jobs
    setLoadingJobs(true);
    try {
      const response = await jobService.getAll({
        customerId: customer.id,
        limit: 50
      });
      setCustomerJobs(response.data || []);
    } catch (error) {
      console.error('Failed to load customer jobs:', error);
      setCustomerJobs([]);
    } finally {
      setLoadingJobs(false);
    }

    // Fetch customer invoices
    setLoadingInvoices(true);
    try {
      const response = await invoiceService.getAll({
        customerId: customer.id,
        limit: 50
      });
      setCustomerInvoices(response.data || []);
    } catch (error) {
      console.error('Failed to load customer invoices:', error);
      setCustomerInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setViewingCustomer(null);
    setCustomerJobs([]);
    setCustomerInvoices([]);
  };

  const handleDelete = async (id) => {
    try {
      await customerService.delete(id);
      message.success('Customer deleted successfully');
      fetchCustomers();
    } catch (error) {
      message.error('Failed to delete customer');
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingCustomer) {
        await customerService.update(editingCustomer.id, values);
        message.success('Customer updated successfully');
      } else {
        await customerService.create(values);
        message.success('Customer created successfully');
      }
      setModalVisible(false);
      fetchCustomers();
    } catch (error) {
      message.error(error.error || 'Operation failed');
    }
  };

  const handleSearch = (value) => {
    setSearchText(value);
    setPagination({ ...pagination, current: 1 });
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Company',
      dataIndex: 'company',
      key: 'company',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: 'Source',
      dataIndex: 'howDidYouHear',
      key: 'howDidYouHear',
      render: (source) => {
        if (!source) return '-';
        const colors = {
          'Signboard': 'blue',
          'Referral': 'green',
          'Social Media': 'purple',
          'Market Outreach': 'orange'
        };
        return <Tag color={colors[source]}>{source}</Tag>;
      }
    },
    {
      title: 'Balance',
      dataIndex: 'balance',
      key: 'balance',
      render: (balance) => `₵${parseFloat(balance).toFixed(2)}`,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => <ActionColumn onView={handleView} record={record} />,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>Customers</h1>
        <Space>
          <Input.Search
            placeholder="Search customers..."
            allowClear
            onSearch={handleSearch}
            style={{ width: 250 }}
            prefix={<SearchOutlined />}
          />
          {(isManager || user?.role === 'staff') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              Add Customer
            </Button>
          )}
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={customers}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={(newPagination) => setPagination(newPagination)}
      />

      <Modal
        title={editingCustomer ? 'Edit Customer' : 'Add Customer'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={800}
        okText={editingCustomer ? 'Update' : 'Create'}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 24 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Name"
                rules={[{ required: true, message: 'Please enter customer name' }]}
              >
                <Input placeholder="Enter customer name" size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="company" label="Company">
                <Input placeholder="Enter company name" size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[{ type: 'email', message: 'Please enter a valid email' }]}
              >
                <Input placeholder="email@example.com" size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Phone">
                <Input placeholder="(123) 456-7890" size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="address" label="Address">
                <Input.TextArea 
                  rows={2} 
                  placeholder="Enter street address" 
                  size="large"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="city" label="City">
                <Input placeholder="Enter city" size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item 
                name="howDidYouHear" 
                label="How did you hear about us?"
                rules={[{ required: true, message: 'Please select an option' }]}
              >
                <Select 
                  placeholder="Select an option" 
                  size="large"
                  onChange={handleHowDidYouHearChange}
                >
                  <Select.Option value="Signboard">Signboard</Select.Option>
                  <Select.Option value="Referral">Referral</Select.Option>
                  <Select.Option value="Social Media">Social Media</Select.Option>
                  <Select.Option value="Market Outreach">Market Outreach</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {showReferralName && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item 
                  name="referralName" 
                  label="Referral Name"
                  rules={[{ required: true, message: 'Please enter referral name' }]}
                >
                  <Input placeholder="Enter referral name" size="large" />
                </Form.Item>
              </Col>
            </Row>
          )}
        </Form>
      </Modal>

      <DetailsDrawer
        open={drawerVisible}
        onClose={handleCloseDrawer}
        title="Customer Details"
        width={800}
        onEdit={isManager && viewingCustomer ? () => {
          handleEdit(viewingCustomer);
          setDrawerVisible(false);
        } : null}
        onDelete={isManager && viewingCustomer ? () => {
          handleDelete(viewingCustomer.id);
          setDrawerVisible(false);
        } : null}
        deleteConfirmText="Are you sure you want to delete this customer?"
        tabs={viewingCustomer ? [
          {
            key: 'details',
            label: 'Details',
            content: (
              <Descriptions column={1} bordered>
                <Descriptions.Item label="Name">{viewingCustomer.name || '-'}</Descriptions.Item>
                <Descriptions.Item label="Company">{viewingCustomer.company || '-'}</Descriptions.Item>
                <Descriptions.Item label="Email">{viewingCustomer.email || '-'}</Descriptions.Item>
                <Descriptions.Item label="Phone">{viewingCustomer.phone || '-'}</Descriptions.Item>
                <Descriptions.Item label="Address">{viewingCustomer.address || '-'}</Descriptions.Item>
                <Descriptions.Item label="City">{viewingCustomer.city || '-'}</Descriptions.Item>
                <Descriptions.Item label="How did you hear about us?">
                  {viewingCustomer.howDidYouHear ? (
                    <Tag color={{
                      'Signboard': 'blue',
                      'Referral': 'green',
                      'Social Media': 'purple',
                      'Market Outreach': 'orange'
                    }[viewingCustomer.howDidYouHear]}>
                      {viewingCustomer.howDidYouHear}
                    </Tag>
                  ) : '-'}
                </Descriptions.Item>
                {viewingCustomer.howDidYouHear === 'Referral' && (
                  <Descriptions.Item label="Referral Name">
                    {viewingCustomer.referralName || '-'}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Balance">
                  ₵{parseFloat(viewingCustomer.balance || 0).toFixed(2)}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={viewingCustomer.isActive ? 'green' : 'red'}>
                    {viewingCustomer.isActive ? 'Active' : 'Inactive'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Created At">
                  {viewingCustomer.createdAt ? new Date(viewingCustomer.createdAt).toLocaleString() : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Last Updated">
                  {viewingCustomer.updatedAt ? new Date(viewingCustomer.updatedAt).toLocaleString() : '-'}
                </Descriptions.Item>
              </Descriptions>
            )
          },
          {
            key: 'activities',
            label: 'Activities',
            content: (
              <div>
                <h3 style={{ marginBottom: 16 }}>Jobs ({customerJobs.length})</h3>
                {loadingJobs ? (
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <Spin size="large" />
                  </div>
                ) : customerJobs.length > 0 ? (
                  <List
                    dataSource={customerJobs}
                    renderItem={(job) => (
                      <List.Item
                        key={job.id}
                        actions={[
                          <Tag color={{
                            'new': 'gold',
                            'in_progress': 'blue',
                            'on_hold': 'orange',
                            'cancelled': 'red',
                            'completed': 'green'
                          }[job.status]}>
                            {job.status?.replace('_', ' ').toUpperCase()}
                          </Tag>
                        ]}
                      >
                        <List.Item.Meta
                          title={`${job.jobNumber} - ${job.title}`}
                          description={
                            <Space direction="vertical" size={0}>
                              <span>{job.description}</span>
                              <span style={{ fontSize: 12, color: '#999' }}>
                                Due: {job.dueDate ? new Date(job.dueDate).toLocaleDateString() : 'N/A'}
                              </span>
                            </Space>
                          }
                        />
                        <div style={{ fontWeight: 'bold' }}>
                          ₵{parseFloat(job.finalPrice || 0).toFixed(2)}
                        </div>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty description="No jobs found for this customer" />
                )}
              </div>
            )
          },
          {
            key: 'invoices',
            label: 'Invoices',
            content: (
              <div>
                <h3 style={{ marginBottom: 16 }}>Invoices ({customerInvoices.length})</h3>
                {loadingInvoices ? (
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <Spin size="large" />
                  </div>
                ) : customerInvoices.length > 0 ? (
                  <List
                    dataSource={customerInvoices}
                    renderItem={(invoice) => (
                      <List.Item
                        key={invoice.id}
                        actions={[
                          <Tag color={{
                            'draft': 'default',
                            'sent': 'blue',
                            'paid': 'green',
                            'partial': 'orange',
                            'overdue': 'red',
                            'cancelled': 'gray'
                          }[invoice.status]}>
                            {invoice.status?.toUpperCase()}
                          </Tag>
                        ]}
                      >
                        <List.Item.Meta
                          title={invoice.invoiceNumber}
                          description={
                            <Space direction="vertical" size={0}>
                              <span>{invoice.job?.title || 'No job linked'}</span>
                              <span style={{ fontSize: 12, color: '#999' }}>
                                Due: {invoice.dueDate ? dayjs(invoice.dueDate).format('MMM DD, YYYY') : 'N/A'}
                              </span>
                              <span style={{ fontSize: 12, color: '#999' }}>
                                Balance: ₵{parseFloat(invoice.balance || 0).toFixed(2)}
                              </span>
                            </Space>
                          }
                        />
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 'bold', fontSize: 16 }}>
                            ₵{parseFloat(invoice.totalAmount || 0).toFixed(2)}
                          </div>
                          <div style={{ fontSize: 12, color: '#52c41a' }}>
                            Paid: ₵{parseFloat(invoice.amountPaid || 0).toFixed(2)}
                          </div>
                        </div>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty description="No invoices found for this customer" />
                )}
              </div>
            )
          }
        ] : null}
      />
    </div>
  );
};

export default Customers;


