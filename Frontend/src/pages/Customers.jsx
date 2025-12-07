import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Space, Tag, Row, Col, Select, Descriptions, List, Spin, Empty } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import customerService from '../services/customerService';
import jobService from '../services/jobService';
import invoiceService from '../services/invoiceService';
import customDropdownService from '../services/customDropdownService';
import { useAuth } from '../context/AuthContext';
import ActionColumn from '../components/ActionColumn';
import DetailsDrawer from '../components/DetailsDrawer';
import { showSuccess, showError, showWarning, handleApiError } from '../utils/toast';
import dayjs from 'dayjs';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submittingCustomer, setSubmittingCustomer] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState(false);
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
  const [customCustomerSources, setCustomCustomerSources] = useState([]);
  const [showCustomerSourceOtherInput, setShowCustomerSourceOtherInput] = useState(false);
  const [customerSourceOtherValue, setCustomerSourceOtherValue] = useState('');
  const [customRegions, setCustomRegions] = useState([]);
  const [showRegionOtherInput, setShowRegionOtherInput] = useState(false);
  const [regionOtherValue, setRegionOtherValue] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, [pagination.current, pagination.pageSize, searchText]);

  // Load custom customer sources and regions on mount
  useEffect(() => {
    const loadCustomOptions = async () => {
      try {
        const [sources, regions] = await Promise.all([
          customDropdownService.getCustomOptions('customer_source'),
          customDropdownService.getCustomOptions('region')
        ]);
        setCustomCustomerSources(sources || []);
        setCustomRegions(regions || []);
      } catch (error) {
        console.error('Failed to load custom options:', error);
      }
    };
    loadCustomOptions();
  }, []);

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
      handleApiError(error, { context: 'load customers' });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingCustomer(null);
    form.resetFields();
    setShowReferralName(false);
    setShowCustomerSourceOtherInput(false);
    setCustomerSourceOtherValue('');
    setShowRegionOtherInput(false);
    setRegionOtherValue('');
    setModalVisible(true);
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    form.setFieldsValue(customer);
    setShowReferralName(customer.howDidYouHear === 'Referral');
    setModalVisible(true);
  };

  const handleHowDidYouHearChange = (value) => {
    if (value === '__OTHER__') {
      setShowCustomerSourceOtherInput(true);
      setShowReferralName(false);
      form.setFieldsValue({ referralName: undefined });
    } else {
      setShowCustomerSourceOtherInput(false);
      setShowReferralName(value === 'Referral');
      if (value !== 'Referral') {
        form.setFieldsValue({ referralName: undefined });
      }
    }
  };

  // Save custom customer source
  const handleSaveCustomCustomerSource = async () => {
    if (!customerSourceOtherValue || !customerSourceOtherValue.trim()) {
      showWarning('Please enter a source name');
      return;
    }

    try {
      const saved = await customDropdownService.saveCustomOption('customer_source', customerSourceOtherValue.trim());
      if (saved && saved.value) {
        // Add to custom sources
        setCustomCustomerSources(prev => {
          if (prev.find(s => s.value === saved.value)) {
            return prev;
          }
          return [...prev, saved];
        });
        
        // Set the value in the form
        form.setFieldValue('howDidYouHear', saved.value);
        
        // Clear the "Other" input
        setShowCustomerSourceOtherInput(false);
        setCustomerSourceOtherValue('');
        
        showSuccess(`"${saved.label || saved.value}" added to sources`);
      } else {
        showWarning('Saved option but received invalid response. Please try again.');
      }
    } catch (error) {
      handleApiError(error, { context: 'save custom source' });
    }
  };

  // Handle region change (including "Other")
  const handleRegionChange = (value) => {
    if (value === '__OTHER__') {
      setShowRegionOtherInput(true);
    } else {
      setShowRegionOtherInput(false);
    }
  };

  // Save custom region
  const handleSaveCustomRegion = async () => {
    if (!regionOtherValue || !regionOtherValue.trim()) {
      showWarning('Please enter a region name');
      return;
    }

    try {
      const saved = await customDropdownService.saveCustomOption('region', regionOtherValue.trim());
      if (saved) {
        // Add to custom regions
        setCustomRegions(prev => {
          if (prev.find(r => r.value === saved.value)) {
            return prev;
          }
          return [...prev, saved];
        });
        
        // Set the value in the form
        form.setFieldValue('state', saved.value);
        
        // Clear the "Other" input
        setShowRegionOtherInput(false);
        setRegionOtherValue('');
        
        showSuccess(`"${saved.label}" added to regions`);
      }
    } catch (error) {
      handleApiError(error, { context: 'save custom region' });
    }
  };

  // Get merged region options
  const getMergedRegionOptions = () => {
    const defaultRegions = [
      'Greater Accra', 'Ashanti', 'Western', 'Western North', 'Central', 'Eastern',
      'Volta', 'Oti', 'Bono', 'Bono East', 'Ahafo', 'Northern', 'Savannah',
      'North East', 'Upper East', 'Upper West'
    ];
    const merged = [...defaultRegions];
    customRegions.forEach(region => {
      if (!merged.includes(region.value)) {
        merged.push(region.value);
      }
    });
    return merged;
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
      setDeletingCustomer(true);
      await customerService.delete(id);
      showSuccess('Customer deleted successfully');
      fetchCustomers();
    } catch (error) {
      handleApiError(error, { context: 'delete customer' });
    } finally {
      setDeletingCustomer(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      setSubmittingCustomer(true);
      
      // If "Other" is selected for howDidYouHear, save the custom value first
      if (values.howDidYouHear === '__OTHER__') {
        if (!customerSourceOtherValue || !customerSourceOtherValue.trim()) {
          showError('Please enter and save a custom source before submitting');
          setSubmittingCustomer(false);
          return;
        }
        // Save the custom source and update the form value
        const saved = await customDropdownService.saveCustomOption('customer_source', customerSourceOtherValue.trim());
        if (saved) {
          values.howDidYouHear = saved.value;
          setCustomCustomerSources(prev => {
            if (prev.find(s => s.value === saved.value)) {
              return prev;
            }
            return [...prev, saved];
          });
        }
      }
      
      // If "Other" is selected for region, save the custom value first
      if (values.state === '__OTHER__') {
        if (!regionOtherValue || !regionOtherValue.trim()) {
          showError('Please enter and save a custom region before submitting');
          setSubmittingCustomer(false);
          return;
        }
        // Save the custom region and update the form value
        const saved = await customDropdownService.saveCustomOption('region', regionOtherValue.trim());
        if (saved) {
          values.state = saved.value;
          setCustomRegions(prev => {
            if (prev.find(r => r.value === saved.value)) {
              return prev;
            }
            return [...prev, saved];
          });
        }
      }
      
      if (editingCustomer) {
        await customerService.update(editingCustomer.id, values);
        showSuccess('Customer updated successfully');
      } else {
        await customerService.create(values);
        showSuccess('Customer created successfully');
      }
      setModalVisible(false);
      fetchCustomers();
    } catch (error) {
      handleApiError(error, { context: editingCustomer ? 'update customer' : 'create customer' });
    } finally {
      setSubmittingCustomer(false);
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
      render: (balance) => `GHS ${parseFloat(balance).toFixed(2)}`,
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
        confirmLoading={submittingCustomer}
        onCancel={() => {
          setModalVisible(false);
          setShowCustomerSourceOtherInput(false);
          setCustomerSourceOtherValue('');
          setShowRegionOtherInput(false);
          setRegionOtherValue('');
        }}
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
              <Form.Item name="city" label="Town">
                <Input placeholder="e.g., Accra, Kumasi, Takoradi" size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="state" label="Region">
                <Select 
                  placeholder="Select region" 
                  size="large" 
                  showSearch
                  onChange={handleRegionChange}
                >
                  {getMergedRegionOptions().map((region) => (
                    <Select.Option key={region} value={region}>{region}</Select.Option>
                  ))}
                  <Select.Option value="__OTHER__">Other (specify)</Select.Option>
                </Select>
              </Form.Item>
              {showRegionOtherInput && (
                <Form.Item
                  label="Enter Region Name"
                  style={{ marginTop: 8 }}
                >
                  <Input.Group compact>
                    <Input
                      style={{ width: 'calc(100% - 80px)' }}
                      placeholder="e.g., New Region, District"
                      value={regionOtherValue}
                      onChange={(e) => setRegionOtherValue(e.target.value)}
                      onPressEnter={handleSaveCustomRegion}
                    />
                    <Button
                      type="primary"
                      style={{ width: 80 }}
                      onClick={handleSaveCustomRegion}
                    >
                      Save
                    </Button>
                  </Input.Group>
                </Form.Item>
              )}
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item 
                name="howDidYouHear" 
                label="How did you hear about us?"
                rules={[{ required: true, message: 'Please select an option' }]}
              >
                <Select 
                  placeholder="Select an option" 
                  size="large"
                  showSearch
                  onChange={handleHowDidYouHearChange}
                >
                  <Select.OptGroup label="Social Media">
                    <Select.Option value="Facebook">Facebook</Select.Option>
                    <Select.Option value="Instagram">Instagram</Select.Option>
                    <Select.Option value="Twitter">Twitter</Select.Option>
                    <Select.Option value="LinkedIn">LinkedIn</Select.Option>
                    <Select.Option value="TikTok">TikTok</Select.Option>
                    <Select.Option value="WhatsApp">WhatsApp</Select.Option>
                  </Select.OptGroup>
                  <Select.OptGroup label="Online">
                    <Select.Option value="Google Search">Google Search</Select.Option>
                    <Select.Option value="Website">Website</Select.Option>
                    <Select.Option value="Online Ad">Online Ad</Select.Option>
                  </Select.OptGroup>
                  <Select.OptGroup label="Physical">
                    <Select.Option value="Signboard">Signboard</Select.Option>
                    <Select.Option value="Walk-in">Walk-in</Select.Option>
                    <Select.Option value="Market Outreach">Market Outreach</Select.Option>
                    <Select.Option value="Flyer/Brochure">Flyer/Brochure</Select.Option>
                  </Select.OptGroup>
                  <Select.OptGroup label="Personal">
                    <Select.Option value="Referral">Referral (Word of Mouth)</Select.Option>
                    <Select.Option value="Existing Customer">Existing Customer</Select.Option>
                  </Select.OptGroup>
                  <Select.OptGroup label="Other">
                    <Select.Option value="Radio">Radio</Select.Option>
                    <Select.Option value="TV">TV</Select.Option>
                    <Select.Option value="Newspaper">Newspaper</Select.Option>
                    <Select.Option value="Event/Trade Show">Event/Trade Show</Select.Option>
                  </Select.OptGroup>
                  {customCustomerSources.length > 0 && (
                    <Select.OptGroup label="Custom Sources">
                      {customCustomerSources.map(source => (
                        <Select.Option key={source.value} value={source.value}>{source.label}</Select.Option>
                      ))}
                    </Select.OptGroup>
                  )}
                  <Select.OptGroup label="Other">
                    <Select.Option value="__OTHER__">Other (specify)</Select.Option>
                  </Select.OptGroup>
                </Select>
              </Form.Item>
              {showCustomerSourceOtherInput && (
                <Form.Item
                  label="Enter Source Name"
                  style={{ marginTop: 8 }}
                >
                  <Input.Group compact>
                    <Input
                      style={{ width: 'calc(100% - 80px)' }}
                      placeholder="e.g., Billboard, Magazine Ad"
                      value={customerSourceOtherValue}
                      onChange={(e) => setCustomerSourceOtherValue(e.target.value)}
                      onPressEnter={handleSaveCustomCustomerSource}
                    />
                    <Button
                      type="primary"
                      style={{ width: 80 }}
                      onClick={handleSaveCustomCustomerSource}
                    >
                      Save
                    </Button>
                  </Input.Group>
                </Form.Item>
              )}
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
                  GHS {parseFloat(viewingCustomer.balance || 0).toFixed(2)}
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
                          GHS {parseFloat(job.finalPrice || 0).toFixed(2)}
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
                                Balance: GHS {parseFloat(invoice.balance || 0).toFixed(2)}
                              </span>
                            </Space>
                          }
                        />
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 'bold', fontSize: 16 }}>
                            GHS {parseFloat(invoice.totalAmount || 0).toFixed(2)}
                          </div>
                          <div style={{ fontSize: 12, color: '#52c41a' }}>
                            Paid: GHS {parseFloat(invoice.amountPaid || 0).toFixed(2)}
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


