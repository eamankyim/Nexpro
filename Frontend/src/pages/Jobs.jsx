import { useState, useEffect } from 'react';
import { Table, Button, Tag, Space, Input, Select, message, Modal, Form, InputNumber, DatePicker, Row, Col, Divider, Card, Alert } from 'antd';
import { PlusOutlined, SearchOutlined, DeleteOutlined, MinusCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import jobService from '../services/jobService';
import customerService from '../services/customerService';
import invoiceService from '../services/invoiceService';
import pricingService from '../services/pricingService';
import dayjs from 'dayjs';
import ActionColumn from '../components/ActionColumn';
import DetailsDrawer from '../components/DetailsDrawer';

const { Option } = Select;
const { TextArea } = Input;

const Jobs = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingJob, setViewingJob] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [form] = Form.useForm();
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [invoiceForm] = Form.useForm();
  const [jobInvoices, setJobInvoices] = useState({});
  const [pricingTemplates, setPricingTemplates] = useState([]);
  const [selectedJobType, setSelectedJobType] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Job type configurations
  const jobTypeConfig = {
    'Instant Service': {
      types: ['Photocopying', 'Scanning', 'Lamination', 'Binding'],
      hideFields: ['startDate', 'dueDate', 'priority'],
      defaultValues: { priority: 'urgent', status: 'in_progress' },
      titleFormat: (type, customer) => `${type} for ${customer?.name || 'Customer'}`,
      descriptionFormat: (type) => `Quick ${type.toLowerCase()} service`,
      isInstant: true
    },
    'Standard Printing': {
      types: ['Business Cards', 'Flyers', 'Brochures', 'Posters', 'Banners', 'Booklets'],
      hideFields: [],
      defaultValues: { priority: 'medium', status: 'pending' },
      titleFormat: (type, customer) => `${type} - ${customer?.name || 'Customer'}`,
      descriptionFormat: (type, customer) => `${type} printing for ${customer?.company || customer?.name || 'customer'}`,
      isInstant: false
    },
    'Large Format': {
      types: ['Large Format Printing', 'Banners', 'Posters'],
      hideFields: [],
      defaultValues: { priority: 'medium', status: 'pending' },
      titleFormat: (type, customer) => `${type} - ${customer?.name || 'Customer'}`,
      descriptionFormat: (type) => `Large format ${type.toLowerCase()} project`,
      isInstant: false
    },
    'Design & Custom': {
      types: ['Design Services', 'Custom Work', 'Other'],
      hideFields: [],
      defaultValues: { priority: 'high', status: 'pending' },
      titleFormat: (type, customer) => `${type} for ${customer?.name || 'Customer'}`,
      descriptionFormat: (type, customer) => `Custom ${type.toLowerCase()} project for ${customer?.company || customer?.name || 'customer'}`,
      isInstant: false
    }
  };

  const getJobTypeCategory = (jobType) => {
    for (const [category, config] of Object.entries(jobTypeConfig)) {
      if (config.types.includes(jobType)) {
        return config;
      }
    }
    return jobTypeConfig['Standard Printing']; // default
  };

  useEffect(() => {
    fetchJobs();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const response = await jobService.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        search: filters.search,
        status: filters.status,
      });
      setJobs(response.data);
      setPagination({ ...pagination, total: response.count });
    } catch (error) {
      message.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (job) => {
    setViewingJob(job);
    setDrawerVisible(true);
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setViewingJob(null);
  };

  const checkJobInvoice = async (jobId) => {
    try {
      const response = await invoiceService.getAll({ jobId, limit: 1 });
      if (response.data && response.data.length > 0) {
        setJobInvoices(prev => ({ ...prev, [jobId]: response.data[0] }));
        return response.data[0];
      }
      return null;
    } catch (error) {
      console.error('Failed to check job invoice:', error);
      return null;
    }
  };

  const handleGenerateInvoice = (job) => {
    setViewingJob(job);
    invoiceForm.resetFields();
    const dueDate = dayjs().add(30, 'days');
    invoiceForm.setFieldsValue({
      dueDate,
      paymentTerms: 'Net 30',
      taxRate: 0,
      discountType: 'fixed',
      discountValue: 0
    });
    setInvoiceModalVisible(true);
  };

  const handleInvoiceSubmit = async (values) => {
    try {
      const invoiceData = {
        jobId: viewingJob.id,
        dueDate: values.dueDate.format('YYYY-MM-DD'),
        paymentTerms: values.paymentTerms,
        taxRate: values.taxRate || 0,
        discountType: values.discountType || 'fixed',
        discountValue: values.discountValue || 0,
        notes: values.notes,
        termsAndConditions: values.termsAndConditions
      };

      await invoiceService.create(invoiceData);
      message.success('Invoice generated successfully');
      setInvoiceModalVisible(false);
      
      // Navigate to invoices page
      navigate('/invoices');
    } catch (error) {
      message.error(error.error || 'Failed to generate invoice');
    }
  };

  const handleAddJob = async () => {
    form.resetFields();
    setSelectedJobType(null);
    setSelectedCustomer(null);
    setModalVisible(true);
    
    // Fetch customers and pricing templates
    try {
      const [customersResponse, templatesResponse] = await Promise.all([
        customerService.getAll({ limit: 100 }),
        pricingService.getAll({ limit: 100, isActive: 'true' })
      ]);
      setCustomers(customersResponse.data || []);
      setPricingTemplates(templatesResponse.data || []);
    } catch (error) {
      message.error('Failed to load data');
    }
  };

  const handleCustomerChange = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    setSelectedCustomer(customer);
    updateJobTitleAndDescription(selectedJobType, customer);
  };

  const handleJobTypeChange = (jobType) => {
    setSelectedJobType(jobType);
    const config = getJobTypeCategory(jobType);
    
    // Apply default values
    form.setFieldsValue({
      priority: config.defaultValues.priority,
      status: config.defaultValues.status
    });
    
    // Auto-set due date for instant services (today)
    if (config.isInstant) {
      form.setFieldValue('dueDate', dayjs());
      message.info('Instant service - Due date set to today');
    }
    
    updateJobTitleAndDescription(jobType, selectedCustomer);
  };

  const updateJobTitleAndDescription = (jobType, customer) => {
    if (!jobType || !customer) return;
    
    const config = getJobTypeCategory(jobType);
    const title = config.titleFormat(jobType, customer);
    const description = config.descriptionFormat(jobType, customer);
    
    form.setFieldsValue({
      title,
      description
    });
  };

  const handleTemplateSelect = (templateId, itemIndex) => {
    const template = pricingTemplates.find(t => t.id === templateId);
    if (!template) return;

    const items = form.getFieldValue('items') || [];
    const currentItem = items[itemIndex] || {};
    
    // Auto-populate fields from template
    const updatedItems = [...items];
    updatedItems[itemIndex] = {
      ...currentItem,
      category: template.category,
      paperSize: template.paperSize || currentItem.paperSize,
      description: template.description || currentItem.description,
      unitPrice: parseFloat(template.pricePerUnit || template.basePrice || 0)
    };
    
    form.setFieldsValue({ items: updatedItems });
    
    // Smart auto-fill for job-level fields if first item
    if (itemIndex === 0 && items.length === 1) {
      const currentTitle = form.getFieldValue('title');
      const currentDescription = form.getFieldValue('description');
      
      // Only auto-fill if fields are empty
      if (!currentTitle || currentTitle.trim() === '') {
        form.setFieldValue('title', template.name);
      }
      if (!currentDescription || currentDescription.trim() === '') {
        form.setFieldValue('description', template.description || template.name);
      }
    }
    
    message.success(`Applied pricing template: ${template.name}`);
  };

  const handleSubmit = async (values) => {
    try {
      // Calculate total from items
      let calculatedTotal = 0;
      if (values.items && values.items.length > 0) {
        calculatedTotal = values.items.reduce((sum, item) => {
          return sum + (parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0));
        }, 0);
        
        // Copy job description to each item if item description is empty
        values.items = values.items.map(item => ({
          ...item,
          description: item.description || values.description || item.category
        }));
      }

      // Format dates
      const jobData = {
        ...values,
        startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : null,
        dueDate: values.dueDate ? values.dueDate.format('YYYY-MM-DD') : null,
        finalPrice: calculatedTotal || values.finalPrice || 0,
      };

      await jobService.create(jobData);
      message.success('Job created successfully');
      setModalVisible(false);
      setSelectedJobType(null);
      setSelectedCustomer(null);
      fetchJobs();
    } catch (error) {
      message.error(error.error || 'Failed to create job');
    }
  };

  const statusColors = {
    pending: 'orange',
    in_progress: 'blue',
    completed: 'green',
    cancelled: 'red',
    on_hold: 'gray',
  };

  const priorityColors = {
    low: 'default',
    medium: 'blue',
    high: 'orange',
    urgent: 'red',
  };

  const columns = [
    { title: 'Job Number', dataIndex: 'jobNumber', key: 'jobNumber', width: 150 },
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { 
      title: 'Customer', 
      dataIndex: ['customer', 'name'], 
      key: 'customer',
      render: (name, record) => record.customer?.name || 'N/A'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={statusColors[status]}>
          {status?.replace('_', ' ').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => (
        <Tag color={priorityColors[priority]}>
          {priority?.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Price',
      dataIndex: 'finalPrice',
      key: 'finalPrice',
      render: (price) => `₵${parseFloat(price || 0).toFixed(2)}`,
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (date) => date ? dayjs(date).format('MMM DD, YYYY') : 'N/A',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <ActionColumn 
          onView={async (job) => {
            await checkJobInvoice(job.id);
            handleView(job);
          }} 
          record={record}
          extraActions={[
            record.status === 'completed' && !jobInvoices[record.id] && {
              label: 'Generate Invoice',
              onClick: () => handleGenerateInvoice(record),
              icon: <FileTextOutlined />
            }
          ].filter(Boolean)}
        />
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>Jobs</h1>
        <Space>
          <Input.Search
            placeholder="Search jobs..."
            allowClear
            onSearch={(value) => setFilters({ ...filters, search: value })}
            style={{ width: 200 }}
            prefix={<SearchOutlined />}
          />
          <Select
            placeholder="Filter by status"
            allowClear
            style={{ width: 150 }}
            onChange={(value) => setFilters({ ...filters, status: value || '' })}
          >
            <Option value="pending">Pending</Option>
            <Option value="in_progress">In Progress</Option>
            <Option value="completed">Completed</Option>
            <Option value="on_hold">On Hold</Option>
            <Option value="cancelled">Cancelled</Option>
          </Select>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddJob}>
            Add Job
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={jobs}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={(newPagination) => setPagination(newPagination)}
      />

      <DetailsDrawer
        open={drawerVisible}
        onClose={handleCloseDrawer}
        title="Job Details"
        width={700}
        showActions={false}
        fields={viewingJob ? [
          { label: 'Job Number', value: viewingJob.jobNumber },
          { label: 'Title', value: viewingJob.title },
          { label: 'Customer', value: viewingJob.customer?.name },
          { label: 'Job Type', value: viewingJob.jobType || '-' },
          { label: 'Description', value: viewingJob.description },
          { 
            label: 'Status', 
            value: viewingJob.status,
            render: (status) => (
              <Tag color={statusColors[status]}>
                {status?.replace('_', ' ').toUpperCase()}
              </Tag>
            )
          },
          { 
            label: 'Priority', 
            value: viewingJob.priority,
            render: (priority) => (
              <Tag color={priorityColors[priority]}>
                {priority?.toUpperCase()}
              </Tag>
            )
          },
          {
            label: 'Job Items / Services',
            value: viewingJob.items,
            render: (items) => {
              if (!items || items.length === 0) return '-';
              return (
                <div style={{ marginTop: 8 }}>
                  {items.map((item, idx) => (
                    <Card key={idx} size="small" style={{ marginBottom: 8 }}>
                      <Row gutter={16}>
                        <Col span={12}>
                          <strong>{item.category}</strong>
                          {item.paperSize && item.paperSize !== 'N/A' && (
                            <div style={{ fontSize: 12, color: '#888' }}>Paper Size: {item.paperSize}</div>
                          )}
                          {item.description && (
                            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{item.description}</div>
                          )}
                        </Col>
                        <Col span={4} style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, color: '#888' }}>Qty</div>
                          <div style={{ fontWeight: 'bold' }}>{item.quantity}</div>
                        </Col>
                        <Col span={4} style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, color: '#888' }}>Unit Price</div>
                          <div>₵{parseFloat(item.unitPrice || 0).toFixed(2)}</div>
                        </Col>
                        <Col span={4} style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, color: '#888' }}>Total</div>
                          <div style={{ fontWeight: 'bold', color: '#1890ff' }}>
                            ₵{(parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0)).toFixed(2)}
                          </div>
                        </Col>
                      </Row>
                    </Card>
                  ))}
                </div>
              );
            }
          },
          { 
            label: 'Final Price', 
            value: viewingJob.finalPrice,
            render: (price) => <strong style={{ fontSize: 16, color: '#1890ff' }}>₵{parseFloat(price || 0).toFixed(2)}</strong>
          },
          { 
            label: 'Start Date', 
            value: viewingJob.startDate,
            render: (date) => date ? dayjs(date).format('MMM DD, YYYY') : 'N/A'
          },
          { 
            label: 'Due Date', 
            value: viewingJob.dueDate,
            render: (date) => date ? dayjs(date).format('MMM DD, YYYY') : 'N/A'
          },
          { 
            label: 'Completion Date', 
            value: viewingJob.completionDate,
            render: (date) => date ? dayjs(date).format('MMM DD, YYYY') : 'N/A'
          },
          { label: 'Notes', value: viewingJob.notes || '-' },
          {
            label: 'Invoice',
            value: jobInvoices[viewingJob.id],
            render: (invoice) => {
              if (!invoice) {
                return viewingJob.status === 'completed' ? (
                  <Button 
                    type="primary" 
                    icon={<FileTextOutlined />}
                    onClick={() => handleGenerateInvoice(viewingJob)}
                  >
                    Generate Invoice
                  </Button>
                ) : (
                  <Tag color="default">No Invoice (Job not completed)</Tag>
                );
              }
              return (
                <Space direction="vertical">
                  <Tag color={invoice.status === 'paid' ? 'green' : 'orange'}>
                    {invoice.invoiceNumber} - {invoice.status?.toUpperCase()}
                  </Tag>
                  <Button 
                    size="small"
                    onClick={() => {
                      navigate('/invoices');
                      handleCloseDrawer();
                    }}
                  >
                    View Invoice
                  </Button>
                </Space>
              );
            }
          },
          { 
            label: 'Created At', 
            value: viewingJob.createdAt,
            render: (value) => value ? new Date(value).toLocaleString() : '-'
          },
        ] : []}
      />

      <Modal
        title="Add New Job"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={1000}
        okText="Create Job"
        style={{ top: 20 }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 24 }}
          initialValues={{
            status: 'pending',
            priority: 'medium'
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="customerId"
                label="Customer"
                rules={[{ required: true, message: 'Please select a customer' }]}
              >
                <Select 
                  placeholder="Select customer first" 
                  size="large"
                  showSearch
                  filterOption={(input, option) =>
                    option.children.toLowerCase().includes(input.toLowerCase())
                  }
                  onChange={handleCustomerChange}
                >
                  {customers.map(customer => (
                    <Option key={customer.id} value={customer.id}>
                      {customer.name} {customer.company ? `(${customer.company})` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="jobType"
                label="Job Type"
                rules={[{ required: true, message: 'Please select job type' }]}
              >
                <Select 
                  placeholder="Select job type" 
                  size="large"
                  onChange={handleJobTypeChange}
                  disabled={!selectedCustomer}
                >
                  <Select.OptGroup label="Instant Service (No dates needed)">
                    <Option value="Photocopying">Photocopying</Option>
                    <Option value="Scanning">Scanning</Option>
                    <Option value="Lamination">Lamination</Option>
                    <Option value="Binding">Binding</Option>
                  </Select.OptGroup>
                  <Select.OptGroup label="Standard Printing">
                    <Option value="Business Cards">Business Cards</Option>
                    <Option value="Flyers">Flyers</Option>
                    <Option value="Brochures">Brochures</Option>
                    <Option value="Posters">Posters</Option>
                    <Option value="Booklets">Booklets</Option>
                  </Select.OptGroup>
                  <Select.OptGroup label="Large Format">
                    <Option value="Large Format Printing">Large Format Printing</Option>
                    <Option value="Banners">Banners</Option>
                  </Select.OptGroup>
                  <Select.OptGroup label="Design & Custom">
                    <Option value="Design Services">Design Services</Option>
                    <Option value="Custom Work">Custom Work</Option>
                    <Option value="Other">Other</Option>
                  </Select.OptGroup>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="title"
                label="Job Title (Auto-generated, editable)"
                rules={[{ required: true, message: 'Please enter job title' }]}
              >
                <Input placeholder="Will be auto-filled when you select job type" size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="description"
                label="Job Description (Auto-generated, editable)"
              >
                <TextArea rows={3} placeholder="Will be auto-filled when you select job type" size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={selectedJobType && getJobTypeCategory(selectedJobType).hideFields.includes('priority') ? 24 : 12}>
              <Form.Item
                name="status"
                label="Status"
                rules={[{ required: true, message: 'Please select status' }]}
              >
                <Select placeholder="Select status" size="large">
                  <Option value="pending">Pending</Option>
                  <Option value="in_progress">In Progress</Option>
                  <Option value="completed">Completed</Option>
                  <Option value="on_hold">On Hold</Option>
                  <Option value="cancelled">Cancelled</Option>
                </Select>
              </Form.Item>
            </Col>
            {(!selectedJobType || !getJobTypeCategory(selectedJobType).hideFields.includes('priority')) && (
              <Col span={12}>
                <Form.Item
                  name="priority"
                  label="Priority"
                  rules={[{ required: true, message: 'Please select priority' }]}
                >
                  <Select placeholder="Select priority" size="large">
                    <Option value="low">Low</Option>
                    <Option value="medium">Medium</Option>
                    <Option value="high">High</Option>
                    <Option value="urgent">Urgent</Option>
                  </Select>
                </Form.Item>
              </Col>
            )}
          </Row>

          {(!selectedJobType || !getJobTypeCategory(selectedJobType).isInstant) && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="startDate"
                  label="Start Date"
                >
                  <DatePicker 
                    style={{ width: '100%' }} 
                    size="large"
                    format="YYYY-MM-DD"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="dueDate"
                  label="Due Date"
                >
                  <DatePicker 
                    style={{ width: '100%' }} 
                    size="large"
                    format="YYYY-MM-DD"
                  />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Divider>Job Items / Services</Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Card 
                    key={key} 
                    size="small" 
                    style={{ marginBottom: 16, background: '#fafafa' }}
                  >
                    {pricingTemplates.length > 0 && (
                      <Row gutter={16} style={{ marginBottom: 16 }}>
                        <Col span={24}>
                          <Form.Item label="Apply Pricing Template">
                            <Select
                              placeholder="Select a pricing template to auto-fill prices"
                              style={{ width: '100%' }}
                              size="large"
                              allowClear
                              showSearch
                              optionFilterProp="children"
                              onChange={(value) => handleTemplateSelect(value, name)}
                            >
                              {pricingTemplates.map(template => (
                                <Option key={template.id} value={template.id}>
                                  {template.name} - {template.category} 
                                  {template.pricePerUnit && ` (₵${parseFloat(template.pricePerUnit).toFixed(2)}/unit)`}
                                  {!template.pricePerUnit && template.basePrice && ` (₵${parseFloat(template.basePrice).toFixed(2)})`}
                                </Option>
                              ))}
                            </Select>
                          </Form.Item>
                        </Col>
                      </Row>
                    )}

                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          {...restField}
                          name={[name, 'category']}
                          label="Category"
                          rules={[{ required: true, message: 'Please select category' }]}
                        >
                          <Select placeholder="Select category" size="large">
                            <Option value="Black & White Printing">Black & White Printing</Option>
                            <Option value="Color Printing">Color Printing</Option>
                            <Option value="Large Format Printing">Large Format Printing</Option>
                            <Option value="Business Cards">Business Cards</Option>
                            <Option value="Brochures">Brochures</Option>
                            <Option value="Flyers">Flyers</Option>
                            <Option value="Posters">Posters</Option>
                            <Option value="Banners">Banners</Option>
                            <Option value="Booklets">Booklets</Option>
                            <Option value="Binding">Binding</Option>
                            <Option value="Lamination">Lamination</Option>
                            <Option value="Photocopying">Photocopying</Option>
                            <Option value="Scanning">Scanning</Option>
                            <Option value="Design Services">Design Services</Option>
                            <Option value="Other">Other</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          {...restField}
                          name={[name, 'paperSize']}
                          label="Paper Size"
                        >
                          <Select placeholder="Select paper size" size="large">
                            <Option value="A4">A4 (210 x 297mm)</Option>
                            <Option value="A3">A3 (297 x 420mm)</Option>
                            <Option value="A5">A5 (148 x 210mm)</Option>
                            <Option value="Letter">Letter (8.5 x 11 in)</Option>
                            <Option value="Legal">Legal (8.5 x 14 in)</Option>
                            <Option value="Tabloid">Tabloid (11 x 17 in)</Option>
                            <Option value="Custom">Custom Size</Option>
                            <Option value="N/A">N/A</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item
                          {...restField}
                          name={[name, 'quantity']}
                          label="Quantity"
                          rules={[{ required: true, message: 'Required' }]}
                          initialValue={1}
                        >
                          <InputNumber
                            style={{ width: '100%' }}
                            placeholder="1"
                            min={1}
                            size="large"
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item
                          {...restField}
                          name={[name, 'unitPrice']}
                          label="Unit Price"
                          rules={[{ required: true, message: 'Required' }]}
                        >
                          <InputNumber
                            style={{ width: '100%' }}
                            placeholder="0.00"
                            prefix="₵"
                            min={0}
                            precision={2}
                            size="large"
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item shouldUpdate noStyle>
                          {() => {
                            const items = form.getFieldValue('items') || [];
                            const currentItem = items[name] || {};
                            const qty = parseFloat(currentItem.quantity || 1);
                            const price = parseFloat(currentItem.unitPrice || 0);
                            const total = qty * price;
                            
                            return (
                              <Form.Item label="Total">
                                <div style={{ 
                                  padding: '8px 11px', 
                                  background: '#fff', 
                                  border: '1px solid #d9d9d9',
                                  borderRadius: 8,
                                  fontSize: 16,
                                  fontWeight: 'bold',
                                  color: '#1890ff',
                                  height: 40,
                                  display: 'flex',
                                  alignItems: 'center'
                                }}>
                                  ₵{total.toFixed(2)}
                                </div>
                              </Form.Item>
                            );
                          }}
                        </Form.Item>
                      </Col>
                    </Row>

                    <Button 
                      type="dashed" 
                      danger 
                      onClick={() => remove(name)} 
                      icon={<MinusCircleOutlined />}
                      block
                    >
                      Remove Item
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
                    Add Job Item
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Form.Item shouldUpdate noStyle>
            {() => {
              const items = form.getFieldValue('items') || [];
              const total = items.reduce((sum, item) => {
                const qty = parseFloat(item?.quantity || 1);
                const price = parseFloat(item?.unitPrice || 0);
                return sum + (qty * price);
              }, 0);
              
              return (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Calculated Total">
                      <div style={{ 
                        padding: '12px 16px', 
                        background: '#f0f5ff', 
                        border: '2px solid #1890ff',
                        borderRadius: 8,
                        fontSize: 20,
                        fontWeight: 'bold',
                        color: '#1890ff'
                      }}>
                        ₵{total.toFixed(2)}
                      </div>
                    </Form.Item>
                  </Col>
                </Row>
              );
            }}
          </Form.Item>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="notes" label="Notes">
                <TextArea rows={3} placeholder="Enter any additional notes" size="large" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Generate Invoice Modal */}
      <Modal
        title="Generate Invoice"
        open={invoiceModalVisible}
        onCancel={() => setInvoiceModalVisible(false)}
        onOk={() => invoiceForm.submit()}
        width={700}
        okText="Generate Invoice"
      >
        {viewingJob && (
          <>
            <Alert
              message={`Generating invoice for Job: ${viewingJob.jobNumber} - ${viewingJob.title}`}
              type="info"
              style={{ marginBottom: 16 }}
            />
            <Form
              form={invoiceForm}
              layout="vertical"
              onFinish={handleInvoiceSubmit}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="dueDate"
                    label="Due Date"
                    rules={[{ required: true, message: 'Please select due date' }]}
                  >
                    <DatePicker 
                      style={{ width: '100%' }}
                      size="large"
                      format="YYYY-MM-DD"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="paymentTerms"
                    label="Payment Terms"
                    rules={[{ required: true, message: 'Please enter payment terms' }]}
                  >
                    <Select size="large">
                      <Option value="Due on Receipt">Due on Receipt</Option>
                      <Option value="Net 15">Net 15</Option>
                      <Option value="Net 30">Net 30</Option>
                      <Option value="Net 60">Net 60</Option>
                      <Option value="Net 90">Net 90</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="taxRate" label="Tax Rate (%)">
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="0"
                      min={0}
                      max={100}
                      precision={2}
                      size="large"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="discountType" label="Discount Type">
                    <Select size="large">
                      <Option value="fixed">Fixed Amount</Option>
                      <Option value="percentage">Percentage</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="discountValue" label="Discount Value">
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="0"
                      min={0}
                      precision={2}
                      size="large"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item name="notes" label="Invoice Notes">
                    <TextArea rows={3} placeholder="Enter invoice notes" size="large" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item name="termsAndConditions" label="Terms & Conditions">
                    <TextArea 
                      rows={3} 
                      placeholder="Enter terms and conditions" 
                      size="large"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
};

export default Jobs;


