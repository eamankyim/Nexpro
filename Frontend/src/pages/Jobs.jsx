import { useState, useEffect } from 'react';
import { Table, Button, Tag, Space, Input, Select, message, Modal, Form, InputNumber, DatePicker, Row, Col, Divider, Card, Alert, Descriptions, Timeline } from 'antd';
import { PlusOutlined, SearchOutlined, DeleteOutlined, MinusCircleOutlined, FileTextOutlined, ClockCircleOutlined, CheckCircleOutlined, UserOutlined, EditOutlined } from '@ant-design/icons';
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
  const [selectedTemplates, setSelectedTemplates] = useState({});
  const [customJobType, setCustomJobType] = useState('');

  // Job type configurations
  const jobTypeConfig = {
    'Instant Service': {
      types: ['Photocopying', 'Scanning', 'Printing', 'Lamination', 'Binding'],
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
      types: ['Design & Print', 'Design Services', 'Custom Work', 'Other'],
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
    setSelectedTemplates({});
    setCustomJobType('');
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
    const baseJobType = selectedJobType === 'Other' ? 'Other' : selectedJobType;
    const labelOverride = selectedJobType === 'Other' ? customJobType : undefined;
    updateJobTitleAndDescription(baseJobType, customer, labelOverride);
  };

  const handleJobTypeChange = (jobType) => {
    setSelectedJobType(jobType);
    const config = getJobTypeCategory(jobType);
    
    if (jobType !== 'Other') {
      setCustomJobType('');
      form.setFieldsValue({ customJobType: undefined });
    }
    
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
    
    const labelOverride = jobType === 'Other' ? customJobType : undefined;
    updateJobTitleAndDescription(jobType, selectedCustomer, labelOverride);
  };

  const handleCustomJobTypeChange = (event) => {
    const value = event.target.value;
    setCustomJobType(value);
    updateJobTitleAndDescription('Other', selectedCustomer, value);
  };

  const updateJobTitleAndDescription = (jobType, customer, customLabel) => {
    if (!jobType || !customer) return;

    const effectiveLabel = (customLabel && customLabel.trim().length > 0) ? customLabel.trim() : jobType;
    if (!effectiveLabel) return;

    const configKey = jobType === 'Other' ? 'Other' : jobType;
    const config = getJobTypeCategory(configKey);
    const title = config.titleFormat(effectiveLabel, customer);
    const description = config.descriptionFormat(effectiveLabel, customer);

    form.setFieldsValue({
      title,
      description
    });
  };

  const resolveTemplateUnitPrice = (template) => {
    if (!template) return 0;
    const parseMoney = (value) => {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const pricePerUnit = parseMoney(template.pricePerUnit);
    const basePrice = parseMoney(template.basePrice);
    const pricePerSquareFoot = parseMoney(template.pricePerSquareFoot);

    if (pricePerUnit > 0) return pricePerUnit;
    if (pricePerSquareFoot > 0) return pricePerSquareFoot;

    return basePrice;
  };

  // Helper function to calculate discount based on quantity
  const calculateDiscount = (template, quantity, unitPriceOverride) => {
    if (!template || !quantity) return { discountPercent: 0, discountAmount: 0 };

    const unitPrice = unitPriceOverride ?? resolveTemplateUnitPrice(template);
    const subtotal = unitPrice * quantity;

    // Apply discount tiers if available
    if (template.discountTiers && Array.isArray(template.discountTiers) && template.discountTiers.length > 0) {
      for (const tier of template.discountTiers) {
        const minQty = tier.minQuantity || 0;
        const maxQty = tier.maxQuantity || Infinity;
        
        if (quantity >= minQty && quantity <= maxQty) {
          const discountPercent = parseFloat(tier.discountPercent || 0);
          const discountAmount = (subtotal * discountPercent) / 100;
          
          if (discountPercent > 0) {
            message.info(`${discountPercent}% discount applied for quantity ${quantity}!`, 3);
          }
          
          return { discountPercent, discountAmount };
        }
      }
    }

    return { discountPercent: 0, discountAmount: 0 };
  };

  const handleTemplateSelect = (templateId, itemIndex) => {
    const template = pricingTemplates.find(t => t.id === templateId);
    
    if (!templateId || !template) {
      // Clear template selection for this item
      setSelectedTemplates(prev => {
        const updated = { ...prev };
        delete updated[itemIndex];
        return updated;
      });
      return;
    }

    // Store the selected template for this item
    setSelectedTemplates(prev => ({
      ...prev,
      [itemIndex]: template
    }));

    const items = form.getFieldValue('items') || [];
    const currentItem = items[itemIndex] || {};
    
    // Check if template uses square-foot pricing
    const isSquareFootPricing = template.pricingMethod === 'square_foot' || 
                                ['SAV (Self-Adhesive Vinyl)', 'Banner', 'One Way Vision'].includes(template.materialType);
    
    if (isSquareFootPricing) {
      // For square-foot pricing, set up dimensions fields
      const updatedItems = [...items];
      updatedItems[itemIndex] = {
        ...currentItem,
        category: template.category,
        materialType: template.materialType,
        materialSize: template.materialSize || 'Custom',
        description: template.description || currentItem.description,
        pricingMethod: 'square_foot',
        pricePerSquareFoot: parseFloat(template.pricePerSquareFoot || 0),
        itemHeight: currentItem.itemHeight,
        itemWidth: currentItem.itemWidth,
        itemUnit: currentItem.itemUnit || 'feet',
        quantity: 1, // Always 1 for square-foot pricing
        unitPrice: 0, // Will be calculated when dimensions are entered
        discountPercent: 0,
        discountAmount: 0
      };
      form.setFieldsValue({ items: updatedItems });
    } else {
      // Standard unit-based pricing
      const quantity = currentItem.quantity || 1;
      const unitPrice = resolveTemplateUnitPrice(template);
      const { discountPercent, discountAmount } = calculateDiscount(template, quantity, unitPrice);
      
      const updatedItems = [...items];
      updatedItems[itemIndex] = {
        ...currentItem,
        category: template.category,
        paperSize: template.paperSize || currentItem.paperSize,
        materialType: template.materialType,
        materialSize: template.materialSize,
        description: template.description || currentItem.description,
        quantity: quantity,
        unitPrice: unitPrice,
        pricingMethod: 'unit',
        discountPercent: discountPercent,
        discountAmount: discountAmount
      };
      form.setFieldsValue({ items: updatedItems });
    }
    
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

  // Handle quantity change with real-time discount recalculation
  const handleQuantityChange = (itemIndex, newQuantity) => {
    const template = selectedTemplates[itemIndex];
    
    if (!template) {
      return; // No template selected, just use the quantity as-is
    }

    const items = form.getFieldValue('items') || [];
    const currentItem = items[itemIndex] || {};
    
    // Recalculate discount with new quantity (unit price stays same)
    const currentPrice = parseFloat(currentItem.unitPrice ?? resolveTemplateUnitPrice(template) ?? 0);
    const { discountPercent, discountAmount } = calculateDiscount(template, newQuantity, currentPrice);
    
    // Update the item with new quantity and recalculated discount
    const updatedItems = [...items];
    updatedItems[itemIndex] = {
      ...currentItem,
      quantity: newQuantity,
      discountPercent: discountPercent,
      discountAmount: discountAmount
    };
    
    form.setFieldsValue({ items: updatedItems });
  };

  const handleSubmit = async (values) => {
    try {
      // Calculate total from items (with discounts)
      let calculatedTotal = 0;
      if (values.items && values.items.length > 0) {
        // Process items - calculate square-foot pricing if needed
        values.items = values.items.map(item => {
          // If square-foot pricing, ensure unitPrice is calculated
          if ((item.pricingMethod === 'square_foot' || item.itemHeight || item.itemWidth) && 
              item.itemHeight && item.itemWidth && item.pricePerSquareFoot) {
            const height = parseFloat(item.itemHeight);
            const width = parseFloat(item.itemWidth);
            const unit = item.itemUnit || 'feet';
            const pricePerSqft = parseFloat(item.pricePerSquareFoot);
            
            if (unit === 'feet') {
              item.unitPrice = height * width * pricePerSqft;
            } else if (unit === 'inches') {
              item.unitPrice = (height * width * pricePerSqft) / 144;
            }
            item.quantity = 1; // Always 1 for square-foot pricing
          }
          
          return item;
        });
        
        calculatedTotal = values.items.reduce((sum, item) => {
          const subtotal = parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0);
          const discount = parseFloat(item.discountAmount || 0);
          return sum + (subtotal - discount);
        }, 0);
        
        // Copy job description to each item if item description is empty
        values.items = values.items.map(item => ({
          ...item,
          description: item.description || values.description || item.category
        }));
      }

      const finalJobType = values.jobType === 'Other' && values.customJobType
        ? values.customJobType.trim()
        : values.jobType;

      values.jobType = finalJobType;
      delete values.customJobType;

      if (!values.jobType) {
        message.error('Please specify the job type');
        return;
      }

      // Format dates
      const jobData = {
        ...values,
        startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : null,
        dueDate: values.dueDate ? values.dueDate.format('YYYY-MM-DD') : null,
        finalPrice: calculatedTotal || values.finalPrice || 0,
      };

      const response = await jobService.create(jobData);
      
      // Check if invoice was auto-generated
      if (response.invoice) {
        message.success(`Job created successfully! Invoice ${response.invoice.invoiceNumber} was automatically generated.`, 5);
      } else {
      message.success('Job created successfully');
      }
      
      setModalVisible(false);
      setSelectedJobType(null);
      setSelectedCustomer(null);
      setSelectedTemplates({});
      setCustomJobType('');
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
            !jobInvoices[record.id] && {
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
        tabs={viewingJob ? [
          {
            key: 'details',
            label: 'Details',
            content: (
              <Descriptions column={1} bordered>
                <Descriptions.Item label="Job Number">
                  {viewingJob.jobNumber}
                </Descriptions.Item>
                <Descriptions.Item label="Title">
                  {viewingJob.title}
                </Descriptions.Item>
                <Descriptions.Item label="Customer">
                  {viewingJob.customer?.name}
                </Descriptions.Item>
                <Descriptions.Item label="Job Type">
                  {viewingJob.jobType || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Description">
                  {viewingJob.description}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={statusColors[viewingJob.status]}>
                    {viewingJob.status?.replace('_', ' ').toUpperCase()}
              </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Priority">
                  <Tag color={priorityColors[viewingJob.priority]}>
                    {viewingJob.priority?.toUpperCase()}
              </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Final Price">
                  <strong style={{ fontSize: 16, color: '#1890ff' }}>
                    ₵{parseFloat(viewingJob.finalPrice || 0).toFixed(2)}
                  </strong>
                </Descriptions.Item>
                <Descriptions.Item label="Start Date">
                  {viewingJob.startDate ? dayjs(viewingJob.startDate).format('MMM DD, YYYY') : 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Due Date">
                  {viewingJob.dueDate ? dayjs(viewingJob.dueDate).format('MMM DD, YYYY') : 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Completion Date">
                  {viewingJob.completionDate ? dayjs(viewingJob.completionDate).format('MMM DD, YYYY') : 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Notes">
                  {viewingJob.notes || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Invoice">
                  {(() => {
                    const invoice = jobInvoices[viewingJob.id];
                    if (!invoice) {
                      return (
                        <Space direction="vertical" size="small">
                          <Button 
                            type="primary" 
                            icon={<FileTextOutlined />}
                            onClick={() => handleGenerateInvoice(viewingJob)}
                          >
                            Generate Invoice
                          </Button>
                          <div style={{ fontSize: 12, color: '#999' }}>
                            {viewingJob.status === 'completed' 
                              ? 'Create invoice for completed job' 
                              : 'Create proforma/advance invoice'}
                          </div>
                        </Space>
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
                  })()}
                </Descriptions.Item>
                <Descriptions.Item label="Created At">
                  {viewingJob.createdAt ? new Date(viewingJob.createdAt).toLocaleString() : '-'}
                </Descriptions.Item>
              </Descriptions>
            )
          },
          {
            key: 'services',
            label: 'Services',
            content: (
              <div>
                {(!viewingJob.items || viewingJob.items.length === 0) ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#999' }}>
                    No services/items added to this job
                  </div>
                ) : (
                  <div>
                    {viewingJob.items.map((item, idx) => (
                      <Card key={idx} size="small" style={{ marginBottom: 12 }}>
                        <Row gutter={16}>
                          <Col span={12}>
                            <div style={{ marginBottom: 8 }}>
                              <strong style={{ fontSize: 14 }}>{item.category}</strong>
                            </div>
                            {item.paperSize && item.paperSize !== 'N/A' && (
                              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
                                Paper Size: {item.paperSize}
                              </div>
                            )}
                            {item.description && (
                              <div style={{ fontSize: 12, color: '#666' }}>
                                {item.description}
                              </div>
                            )}
                          </Col>
                          <Col span={4} style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Quantity</div>
                            <div style={{ fontWeight: 'bold', fontSize: 14 }}>{item.quantity}</div>
                          </Col>
                          <Col span={4} style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Unit Price</div>
                            <div style={{ fontSize: 14 }}>₵{parseFloat(item.unitPrice || 0).toFixed(2)}</div>
                          </Col>
                          <Col span={4} style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Total</div>
                            <div style={{ fontWeight: 'bold', color: '#1890ff', fontSize: 14 }}>
                              ₵{(parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0)).toFixed(2)}
                            </div>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                    <div style={{ 
                      marginTop: 16, 
                      padding: '12px 16px', 
                      background: '#f0f5ff', 
                      borderRadius: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <strong style={{ fontSize: 16 }}>Total:</strong>
                      <strong style={{ fontSize: 18, color: '#1890ff' }}>
                        ₵{parseFloat(viewingJob.finalPrice || 0).toFixed(2)}
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            )
          },
          {
            key: 'activities',
            label: 'Activities',
            content: (
              <div style={{ padding: '16px 0' }}>
                <Timeline
                  items={[
                    {
                      color: 'green',
                      dot: <CheckCircleOutlined style={{ fontSize: '16px' }} />,
                      children: (
                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                            Job Created
                          </div>
                          <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>
                            {viewingJob.createdAt ? new Date(viewingJob.createdAt).toLocaleString() : '-'}
                          </div>
                          <div style={{ color: '#888', fontSize: 12 }}>
                            <UserOutlined /> Created by: {viewingJob.assignedUser?.name || 'System'}
                          </div>
                        </div>
                      )
                    },
                    ...(viewingJob.assignedUser ? [{
                      color: 'blue',
                      dot: <UserOutlined style={{ fontSize: '16px' }} />,
                      children: (
                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                            Assigned To
                          </div>
                          <div style={{ color: '#666', fontSize: 12 }}>
                            {viewingJob.assignedUser.name}
                          </div>
                          <div style={{ color: '#888', fontSize: 12 }}>
                            {viewingJob.assignedUser.email}
                          </div>
                        </div>
                      )
                    }] : []),
                    {
                      color: statusColors[viewingJob.status] || 'blue',
                      dot: <ClockCircleOutlined style={{ fontSize: '16px' }} />,
                      children: (
                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                            Current Status
                          </div>
                          <div style={{ marginBottom: 4 }}>
                            <Tag color={statusColors[viewingJob.status]}>
                              {viewingJob.status?.replace('_', ' ').toUpperCase()}
                            </Tag>
                          </div>
                          <div style={{ color: '#888', fontSize: 12 }}>
                            Priority: <Tag color={priorityColors[viewingJob.priority]} size="small">
                              {viewingJob.priority?.toUpperCase()}
                            </Tag>
                          </div>
                        </div>
                      )
                    },
                    ...(viewingJob.completionDate ? [{
                      color: 'green',
                      dot: <CheckCircleOutlined style={{ fontSize: '16px' }} />,
                      children: (
                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                            Job Completed
                          </div>
                          <div style={{ color: '#666', fontSize: 12 }}>
                            {dayjs(viewingJob.completionDate).format('MMM DD, YYYY [at] h:mm A')}
                          </div>
                        </div>
                      )
                    }] : []),
                    ...(viewingJob.updatedAt && viewingJob.updatedAt !== viewingJob.createdAt ? [{
                      color: 'gray',
                      dot: <EditOutlined style={{ fontSize: '16px' }} />,
                      children: (
                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                            Last Updated
                          </div>
                          <div style={{ color: '#666', fontSize: 12 }}>
                            {new Date(viewingJob.updatedAt).toLocaleString()}
                          </div>
                        </div>
                      )
                    }] : [])
                  ]}
                />
              </div>
            )
          }
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
        bodyStyle={{
          maxHeight: '70vh',
          overflowY: 'auto'
        }}
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
                    <Option value="Printing">Printing</Option>
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
                    <Option value="Design & Print">Design & Print</Option>
                    <Option value="Design Services">Design Services</Option>
                    <Option value="Custom Work">Custom Work</Option>
                    <Option value="Other">Other</Option>
                  </Select.OptGroup>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {selectedJobType === 'Other' && (
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item
                  name="customJobType"
                  label="Describe Job Type"
                  rules={[{ required: true, message: 'Please describe the job type' }]}
                >
                  <Input
                    placeholder="e.g., Vehicle Wrap Design"
                    size="large"
                    onChange={handleCustomJobTypeChange}
                  />
                </Form.Item>
              </Col>
            </Row>
          )}

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
                              {pricingTemplates.map(template => {
                                const resolvedPrice = resolveTemplateUnitPrice(template);
                                const hasUnitPricing = Number.isFinite(parseFloat(template.pricePerUnit)) && parseFloat(template.pricePerUnit) > 0;
                                const hasSquareFootPricing = Number.isFinite(parseFloat(template.pricePerSquareFoot)) && parseFloat(template.pricePerSquareFoot) > 0;
                                const priceLabel = (() => {
                                  if (resolvedPrice <= 0) return '';
                                  if (hasUnitPricing) return ` (₵${resolvedPrice.toFixed(2)}/unit)`;
                                  if (hasSquareFootPricing) return ` (₵${resolvedPrice.toFixed(2)}/sq ft)`;
                                  return ` (₵${resolvedPrice.toFixed(2)})`;
                                })();
                                return (
                                  <Option key={template.id} value={template.id}>
                                    {template.name} - {template.category}
                                    {priceLabel}
                                  </Option>
                                );
                              })}
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
                            <Option value="Printing">Printing</Option>
                            <Option value="Design Services">Design Services</Option>
                          <Option value="Design & Print">Design & Print</Option>
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

                    {/* Show different fields based on pricing method */}
                    <Form.Item shouldUpdate={(prevValues, currentValues) => {
                      const prevItems = prevValues.items || [];
                      const currentItems = currentValues.items || [];
                      const prevItem = prevItems[name];
                      const currentItem = currentItems[name];
                      return prevItem?.pricingMethod !== currentItem?.pricingMethod ||
                             prevItem?.itemHeight !== currentItem?.itemHeight ||
                             prevItem?.itemWidth !== currentItem?.itemWidth ||
                             prevItem?.itemUnit !== currentItem?.itemUnit ||
                             prevItem?.pricePerSquareFoot !== currentItem?.pricePerSquareFoot;
                    }}>
                      {({ getFieldValue }) => {
                        const items = getFieldValue('items') || [];
                        const currentItem = items[name] || {};
                        const template = selectedTemplates[name];
                        const isSquareFootPricing = currentItem.pricingMethod === 'square_foot' || 
                                                   (template && (template.pricingMethod === 'square_foot' || 
                                                   ['SAV (Self-Adhesive Vinyl)', 'Banner', 'One Way Vision'].includes(template.materialType)));
                        
                        if (isSquareFootPricing) {
                          // Square foot pricing - show height, width, unit inputs
                          const height = parseFloat(currentItem.itemHeight || 0);
                          const width = parseFloat(currentItem.itemWidth || 0);
                          const unit = currentItem.itemUnit || 'feet';
                          const pricePerSqft = parseFloat(currentItem.pricePerSquareFoot || template?.pricePerSquareFoot || 0);
                          
                          let calculatedPrice = 0;
                          if (height && width && pricePerSqft) {
                            if (unit === 'feet') {
                              calculatedPrice = height * width * pricePerSqft;
                            } else if (unit === 'inches') {
                              calculatedPrice = (height * width * pricePerSqft) / 144;
                            }
                          }
                          
                          return (
                            <>
                              <Row gutter={16}>
                                <Col span={6}>
                                  <Form.Item
                                    {...restField}
                                    name={[name, 'itemHeight']}
                                    label="Height"
                                    rules={[{ required: true, message: 'Required' }]}
                                  >
                                    <InputNumber
                                      style={{ width: '100%' }}
                                      placeholder="Enter height"
                                      min={0}
                                      precision={2}
                                      size="large"
                                      onChange={() => {
                                        // Recalculate price when dimensions change
                                        const items = form.getFieldValue('items') || [];
                                        const item = items[name] || {};
                                        const h = parseFloat(item.itemHeight || 0);
                                        const w = parseFloat(item.itemWidth || 0);
                                        const u = item.itemUnit || 'feet';
                                        const psf = parseFloat(item.pricePerSquareFoot || template?.pricePerSquareFoot || 0);
                                        
                                        let price = 0;
                                        if (h && w && psf) {
                                          price = u === 'feet' ? h * w * psf : (h * w * psf) / 144;
                                        }
                                        
                                        const updatedItems = [...items];
                                        updatedItems[name] = { ...item, unitPrice: price };
                                        form.setFieldsValue({ items: updatedItems });
                                      }}
                                    />
                                  </Form.Item>
                                </Col>
                                <Col span={6}>
                                  <Form.Item
                                    {...restField}
                                    name={[name, 'itemWidth']}
                                    label="Width/Length"
                                    rules={[{ required: true, message: 'Required' }]}
                                  >
                                    <InputNumber
                                      style={{ width: '100%' }}
                                      placeholder="Enter width"
                                      min={0}
                                      precision={2}
                                      size="large"
                                      onChange={() => {
                                        const items = form.getFieldValue('items') || [];
                                        const item = items[name] || {};
                                        const h = parseFloat(item.itemHeight || 0);
                                        const w = parseFloat(item.itemWidth || 0);
                                        const u = item.itemUnit || 'feet';
                                        const psf = parseFloat(item.pricePerSquareFoot || template?.pricePerSquareFoot || 0);
                                        
                                        let price = 0;
                                        if (h && w && psf) {
                                          price = u === 'feet' ? h * w * psf : (h * w * psf) / 144;
                                        }
                                        
                                        const updatedItems = [...items];
                                        updatedItems[name] = { ...item, unitPrice: price };
                                        form.setFieldsValue({ items: updatedItems });
                                      }}
                                    />
                                  </Form.Item>
                                </Col>
                                <Col span={6}>
                                  <Form.Item
                                    {...restField}
                                    name={[name, 'itemUnit']}
                                    label="Unit"
                                    rules={[{ required: true, message: 'Required' }]}
                                    initialValue="feet"
                                  >
                                    <Select 
                                      placeholder="Select unit" 
                                      size="large"
                                      onChange={() => {
                                        const items = form.getFieldValue('items') || [];
                                        const item = items[name] || {};
                                        const h = parseFloat(item.itemHeight || 0);
                                        const w = parseFloat(item.itemWidth || 0);
                                        const u = item.itemUnit || 'feet';
                                        const psf = parseFloat(item.pricePerSquareFoot || template?.pricePerSquareFoot || 0);
                                        
                                        let price = 0;
                                        if (h && w && psf) {
                                          price = u === 'feet' ? h * w * psf : (h * w * psf) / 144;
                                        }
                                        
                                        const updatedItems = [...items];
                                        updatedItems[name] = { ...item, unitPrice: price };
                                        form.setFieldsValue({ items: updatedItems });
                                      }}
                                    >
                                      <Option value="feet">Feet</Option>
                                      <Option value="inches">Inches</Option>
                                    </Select>
                                  </Form.Item>
                                </Col>
                                <Col span={6}>
                                  <Form.Item label="Calculated Price">
                                    <div style={{ 
                                      padding: '8px 11px', 
                                      background: '#f0f9ff', 
                                      border: '1px solid #91d5ff',
                                      borderRadius: 4,
                                      fontSize: 14,
                                      fontWeight: 600,
                                      color: '#1890ff',
                                      height: 40,
                                      display: 'flex',
                                      alignItems: 'center'
                                    }}>
                                      ₵{calculatedPrice.toFixed(2)}
                                    </div>
                                  </Form.Item>
                                </Col>
                              </Row>
                              {pricePerSqft > 0 && (
                                <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                                  Price per sqft: ₵{pricePerSqft.toFixed(2)} | 
                                  {height && width && unit && (
                                    <span> {height}{unit === 'feet' ? 'ft' : 'in'} × {width}{unit === 'feet' ? 'ft' : 'in'}{unit === 'inches' ? ' ÷ 144' : ''} = ₵{calculatedPrice.toFixed(2)}</span>
                                  )}
                                </div>
                              )}
                              {/* Hidden field to store calculated unitPrice */}
                              <Form.Item {...restField} name={[name, 'unitPrice']} hidden>
                                <InputNumber value={calculatedPrice} />
                              </Form.Item>
                              <Form.Item {...restField} name={[name, 'quantity']} hidden initialValue={1}>
                                <InputNumber value={1} />
                              </Form.Item>
                              <Form.Item {...restField} name={[name, 'pricingMethod']} hidden initialValue="square_foot">
                                <Input value="square_foot" />
                              </Form.Item>
                              <Form.Item {...restField} name={[name, 'pricePerSquareFoot']} hidden>
                                <InputNumber value={pricePerSqft} />
                              </Form.Item>
                            </>
                          );
                        } else {
                          // Standard unit-based pricing
                          return (
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
                                    onChange={(value) => handleQuantityChange(name, value)}
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
                                    const discountAmount = parseFloat(currentItem.discountAmount || 0);
                                    const subtotal = qty * price;
                                    const total = subtotal - discountAmount;
                                    
                                    return (
                                      <Form.Item label="Total">
                                        <div style={{ 
                                          padding: '8px 11px', 
                                          background: '#fff', 
                                          border: '1px solid #d9d9d9',
                                          borderRadius: 4,
                                          fontSize: 14,
                                          fontWeight: 600,
                                          color: '#000',
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
                          );
                        }
                      }}
                    </Form.Item>

                    {/* Discount and Total Breakdown */}
                    <Form.Item shouldUpdate noStyle>
                      {() => {
                        const items = form.getFieldValue('items') || [];
                        const currentItem = items[name] || {};
                        const qty = parseFloat(currentItem.quantity || 1);
                        const price = parseFloat(currentItem.unitPrice || 0);
                        const discountPercent = parseFloat(currentItem.discountPercent || 0);
                        const discountAmount = parseFloat(currentItem.discountAmount || 0);
                        const subtotal = qty * price;
                        const total = subtotal - discountAmount;

                        if (discountAmount > 0) {
                          return (
                            <div style={{ 
                              padding: '8px 10px', 
                              background: '#f5f5f5', 
                              borderRadius: 4,
                              marginTop: 8,
                              marginBottom: 8
                            }}>
                              <Row justify="space-between" style={{ marginBottom: 2 }}>
                                <Col style={{ color: '#666', fontSize: 13 }}>Subtotal:</Col>
                                <Col style={{ fontWeight: 500, fontSize: 13 }}>₵{subtotal.toFixed(2)}</Col>
                              </Row>
                              <Row justify="space-between" style={{ marginBottom: 2 }}>
                                <Col style={{ color: '#666', fontSize: 13 }}>Discount ({discountPercent}%):</Col>
                                <Col style={{ fontWeight: 500, fontSize: 13 }}>-₵{discountAmount.toFixed(2)}</Col>
                              </Row>
                              <Divider style={{ margin: '4px 0', borderColor: '#d9d9d9' }} />
                              <Row justify="space-between">
                                <Col style={{ fontSize: 14, fontWeight: 600 }}>Total:</Col>
                                <Col style={{ fontSize: 14, fontWeight: 600, color: '#000' }}>₵{total.toFixed(2)}</Col>
                              </Row>
                            </div>
                          );
                        }
                        return null;
                      }}
                    </Form.Item>

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
              const subtotal = items.reduce((sum, item) => {
                const qty = parseFloat(item?.quantity || 1);
                const price = parseFloat(item?.unitPrice || 0);
                return sum + (qty * price);
              }, 0);
              
              const totalDiscount = items.reduce((sum, item) => {
                const discount = parseFloat(item?.discountAmount || 0);
                return sum + discount;
              }, 0);
              
              const total = subtotal - totalDiscount;
              
              return (
                <div style={{
                  padding: '10px 12px',
                  background: '#f5f5f5',
                  border: '1px solid #d9d9d9',
                  borderRadius: 4,
                  marginBottom: 12
                }}>
                  <Row justify="space-between" style={{ marginBottom: 4 }}>
                    <Col style={{ fontSize: 14, color: '#666' }}>Subtotal:</Col>
                    <Col style={{ fontSize: 14, fontWeight: 500 }}>₵{subtotal.toFixed(2)}</Col>
                  </Row>
                  {totalDiscount > 0 && (
                    <Row justify="space-between" style={{ marginBottom: 4 }}>
                      <Col style={{ fontSize: 14, color: '#666' }}>Total Discount:</Col>
                      <Col style={{ fontSize: 14, fontWeight: 500 }}>-₵{totalDiscount.toFixed(2)}</Col>
                    </Row>
                  )}
                  <Divider style={{ margin: '6px 0', borderColor: '#d9d9d9' }} />
                  <Row justify="space-between">
                    <Col style={{ fontSize: 16, fontWeight: 'bold' }}>Grand Total:</Col>
                    <Col style={{ fontSize: 18, fontWeight: 'bold', color: '#000' }}>₵{total.toFixed(2)}</Col>
                  </Row>
                </div>
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
        title={viewingJob?.status === 'completed' ? 'Generate Invoice' : 'Generate Proforma/Advance Invoice'}
        open={invoiceModalVisible}
        onCancel={() => setInvoiceModalVisible(false)}
        onOk={() => invoiceForm.submit()}
        width={700}
        okText="Generate Invoice"
      >
        {viewingJob && (
          <>
            <Alert
              message={`Generating ${viewingJob.status === 'completed' ? 'invoice' : 'proforma/advance invoice'} for Job: ${viewingJob.jobNumber} - ${viewingJob.title}`}
              description={viewingJob.status !== 'completed' ? 'This invoice can be used for customer approval or advance payment before job completion.' : null}
              type={viewingJob.status === 'completed' ? 'info' : 'warning'}
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


