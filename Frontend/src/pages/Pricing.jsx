import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, message, Space, Tag, Select, InputNumber, Switch, Card, Row, Col, Divider, List } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import pricingService from '../services/pricingService';
import { useAuth } from '../context/AuthContext';
import ActionColumn from '../components/ActionColumn';
import DetailsDrawer from '../components/DetailsDrawer';

const { Option } = Select;
const { TextArea } = Input;

const Pricing = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ category: '', isActive: '' });
  const [form] = Form.useForm();
  const { isManager, isAdmin } = useAuth();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingTemplate, setViewingTemplate] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      console.log('Fetching pricing templates...', { pagination, filters });
      
      // Clean up empty filter values
      const cleanFilters = {};
      if (filters.category) cleanFilters.category = filters.category;
      if (filters.isActive) cleanFilters.isActive = filters.isActive;
      
      const response = await pricingService.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        ...cleanFilters,
      });
      console.log('Pricing templates response:', response);
      setTemplates(response.data);
      setPagination(prev => ({ ...prev, total: response.count }));
    } catch (error) {
      console.error('Error fetching pricing templates:', error);
      message.error('Failed to load pricing templates');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, filters]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates, refreshTrigger]);

  const handleAdd = () => {
    setEditingTemplate(null);
    form.resetFields();
    form.setFieldsValue({
      isActive: true,
      minimumQuantity: 1,
      setupFee: 0,
      colorType: 'black_white'
    });
    setModalVisible(true);
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    form.setFieldsValue({
      ...template,
      discountTiers: template.discountTiers || [],
      additionalOptions: template.additionalOptions || []
    });
    setModalVisible(true);
  };

  const handleView = (template) => {
    setViewingTemplate(template);
    setDrawerVisible(true);
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setViewingTemplate(null);
  };

  const handleDelete = async (id) => {
    try {
      await pricingService.delete(id);
      message.success('Pricing template deleted successfully');
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      message.error('Failed to delete pricing template');
    }
  };

  const handleSubmit = async (values) => {
    try {
      // Clean up custom dimension fields (these are only used in job creation, not template)
      values.customHeight = undefined;
      values.customWidth = undefined;
      values.customUnit = undefined;
      
      // For Design Services, set default values for hidden fields
      if (values.category === 'Design Services') {
        values.pricingMethod = 'unit';
        values.materialSize = 'N/A';
        values.basePrice = values.basePrice || 0;
        values.setupFee = values.setupFee || 0;
        values.pricePerUnit = values.pricePerUnit || 0;
        values.pricePerSquareFoot = 0;
        values.minimumQuantity = 1;
        values.maximumQuantity = undefined;
        if (!values.colorType) {
          values.colorType = 'color';
        }
      }
      
      // For square-foot pricing materials, set default values for hidden fields
      const isSquareFootPricing = values.pricingMethod === 'square_foot' || 
                                  ['SAV (Self-Adhesive Vinyl)', 'Banner', 'One Way Vision'].includes(values.materialType);
      
      if (isSquareFootPricing && values.category !== 'Design Services') {
        values.pricingMethod = 'square_foot';
        values.basePrice = values.basePrice || 0;
        values.setupFee = values.setupFee || 0;
        values.pricePerUnit = 0;
        values.minimumQuantity = 1;
        values.maximumQuantity = undefined;
        if (!values.colorType) {
          values.colorType = 'color';
        }
      }
      
      if (editingTemplate) {
        await pricingService.update(editingTemplate.id, values);
        message.success('Pricing template updated successfully');
      } else {
        await pricingService.create(values);
        message.success('Pricing template created successfully');
      }
      setModalVisible(false);
      form.resetFields();
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      message.error(error.error || 'Operation failed');
    }
  };

  const categories = [
    { value: 'Black & White Printing', label: 'Black & White Printing' },
    { value: 'Color Printing', label: 'Color Printing' },
    { value: 'Large Format Printing', label: 'Large Format Printing' },
    { value: 'Business Cards', label: 'Business Cards' },
    { value: 'Brochures', label: 'Brochures' },
    { value: 'Flyers', label: 'Flyers' },
    { value: 'Posters', label: 'Posters' },
    { value: 'Banners', label: 'Banners' },
    { value: 'Booklets', label: 'Booklets' },
    { value: 'Binding', label: 'Binding' },
    { value: 'Lamination', label: 'Lamination' },
    { value: 'Photocopying', label: 'Photocopying' },
    { value: 'Scanning', label: 'Scanning' },
    { value: 'Printing', label: 'Printing' },
    { value: 'Design Services', label: 'Design Services' },
    { value: 'Other', label: 'Other' }
  ];

  const materialTypes = [
    'Plain Paper',
    'Photo Paper',
    'SAV (Self-Adhesive Vinyl)',
    'Banner',
    'One Way Vision',
    'Canvas',
    'Cardstock',
    'Sticker Paper',
    'Vinyl',
    'Foam Board',
    'Corrugated Board',
    'Bond Paper',
    'Glossy Paper',
    'Matte Paper',
    'Satin Paper',
    'Transparent Vinyl',
    'Mesh Material',
    'Fabric',
    'Other'
  ];

  const materialSizes = ['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid', 'Custom', 'N/A'];

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category) => <Tag color="blue">{category}</Tag>,
    },
    {
      title: 'Base Price',
      dataIndex: 'basePrice',
      key: 'basePrice',
      render: (price) => `₵${parseFloat(price || 0).toFixed(2)}`,
    },
    {
      title: 'Price/Unit',
      dataIndex: 'pricePerUnit',
      key: 'pricePerUnit',
      render: (price) => price ? `₵${parseFloat(price).toFixed(2)}` : '-',
    },
    {
      title: 'Setup Fee',
      dataIndex: 'setupFee',
      key: 'setupFee',
      render: (fee) => `₵${parseFloat(fee || 0).toFixed(2)}`,
    },
    {
      title: 'Color Type',
      dataIndex: 'colorType',
      key: 'colorType',
      render: (type) => {
        const colors = {
          black_white: 'default',
          color: 'blue',
          spot_color: 'purple'
        };
        const labels = {
          black_white: 'B&W',
          color: 'Color',
          spot_color: 'Spot Color'
        };
        return type ? <Tag color={colors[type]}>{labels[type]}</Tag> : '-';
      },
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
      <h1>Pricing Templates</h1>
        <Space>
          <Select
            placeholder="Filter by category"
            allowClear
            style={{ width: 200 }}
            onChange={(value) => setFilters({ ...filters, category: value || '' })}
          >
            {categories.map(cat => (
              <Option key={cat.value} value={cat.value}>{cat.label}</Option>
            ))}
          </Select>
          <Select
            placeholder="Filter by status"
            allowClear
            style={{ width: 150 }}
            onChange={(value) => setFilters({ ...filters, isActive: value || '' })}
          >
            <Option value="true">Active</Option>
            <Option value="false">Inactive</Option>
          </Select>
          {isManager && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              Add Template
            </Button>
          )}
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={templates}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={(newPagination) => setPagination(newPagination)}
        scroll={{ x: 1000 }}
      />

      <Modal
        title={editingTemplate ? 'Edit Pricing Template' : 'Add Pricing Template'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={1000}
        okText={editingTemplate ? 'Update' : 'Create'}
        style={{ top: 20 }}
        bodyStyle={{
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
          padding: '24px'
        }}
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
                label="Template Name"
                rules={[{ required: true, message: 'Please enter template name' }]}
              >
                <Input placeholder="Enter template name" size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="category"
                label="Category"
                rules={[{ required: true, message: 'Please select category' }]}
              >
                <Select placeholder="Select category" size="large">
                  {categories.map(cat => (
                    <Option key={cat.value} value={cat.value}>{cat.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* Show different fields based on category */}
          <Form.Item shouldUpdate={(prevValues, currentValues) => prevValues.category !== currentValues.category}>
            {({ getFieldValue }) => {
              const category = getFieldValue('category');
              const isDesignService = category === 'Design Services';
              
              if (isDesignService) {
                // For Design Services: Show design type and standard/premium
                return (
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item 
                        name="jobType" 
                        label="Design Type"
                        rules={[{ required: true, message: 'Please select design type' }]}
                      >
                        <Select placeholder="Select design type" size="large" allowClear showSearch>
                          <Option value="Logo Design">Logo Design</Option>
                          <Option value="Label Design">Label Design</Option>
                          <Option value="Flyer Design">Flyer Design</Option>
                          <Option value="Brochure Design">Brochure Design</Option>
                          <Option value="Business Card Design">Business Card Design</Option>
                          <Option value="Poster Design">Poster Design</Option>
                          <Option value="Banner Design">Banner Design</Option>
                          <Option value="Package Design">Package Design</Option>
                          <Option value="Brand Identity Design">Brand Identity Design</Option>
                          <Option value="Social Media Design">Social Media Design</Option>
                          <Option value="Website Design">Website Design</Option>
                          <Option value="Other Design">Other Design</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item 
                        name="materialType" 
                        label="Service Type"
                        rules={[{ required: true, message: 'Please select service type' }]}
                      >
                        <Select placeholder="Select service type" size="large" allowClear>
                          <Option value="Standard">Standard</Option>
                          <Option value="Premium">Premium</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    {/* Hidden fields for design services */}
                    <Form.Item name="materialSize" hidden initialValue="N/A">
                      <Input value="N/A" />
                    </Form.Item>
                    <Form.Item name="pricingMethod" hidden initialValue="unit">
                      <Input value="unit" />
                    </Form.Item>
                    <Form.Item name="colorType" hidden initialValue="color">
                      <Select value="color" />
                    </Form.Item>
                    <Form.Item name="basePrice" hidden initialValue={0}>
                      <InputNumber value={0} />
                    </Form.Item>
                    <Form.Item name="setupFee" hidden initialValue={0}>
                      <InputNumber value={0} />
                    </Form.Item>
                    <Form.Item name="pricePerUnit" hidden>
                      <InputNumber />
                    </Form.Item>
                    <Form.Item name="pricePerSquareFoot" hidden>
                      <InputNumber />
                    </Form.Item>
                    <Form.Item name="minimumQuantity" hidden initialValue={1}>
                      <InputNumber value={1} />
                    </Form.Item>
                    <Form.Item name="maximumQuantity" hidden>
                      <InputNumber />
                    </Form.Item>
                  </Row>
                );
              } else {
                // For other categories: Show standard fields
                return (
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item name="jobType" label="Job Type">
                        <Input placeholder="e.g., Brochure, Flyer" size="large" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item 
                        name="materialType" 
                        label="Material Type"
                      >
                        <Select 
                          placeholder="Select material type" 
                          size="large" 
                          allowClear 
                          showSearch
                          onChange={(value) => {
                            // Auto-set pricing method for SAV, Banner, One Way Vision
                            if (['SAV (Self-Adhesive Vinyl)', 'Banner', 'One Way Vision'].includes(value)) {
                              form.setFieldsValue({ pricingMethod: 'square_foot' });
                            } else if (value) {
                              // For other materials, default to unit pricing
                              const currentPricingMethod = form.getFieldValue('pricingMethod');
                              if (!currentPricingMethod || currentPricingMethod === 'square_foot') {
                                form.setFieldsValue({ pricingMethod: 'unit' });
                              }
                            }
                          }}
                        >
                          {materialTypes.map(type => (
                            <Option key={type} value={type}>{type}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="materialSize" label="Material Size">
                        <Select 
                          placeholder="Select material size" 
                          size="large" 
                          allowClear
                        >
                          {materialSizes.map(size => (
                            <Option key={size} value={size}>{size}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                );
              }
            }}
          </Form.Item>


          {/* Show different fields based on pricing method and category */}
          <Form.Item shouldUpdate={(prevValues, currentValues) => 
            prevValues.pricingMethod !== currentValues.pricingMethod ||
            prevValues.materialType !== currentValues.materialType ||
            prevValues.category !== currentValues.category
          }>
            {({ getFieldValue }) => {
              const pricingMethod = getFieldValue('pricingMethod');
              const materialType = getFieldValue('materialType');
              const category = getFieldValue('category');
              
              // Skip pricing fields for Design Services (they only need basePrice/pricePerUnit)
              if (category === 'Design Services') {
                return (
                  <Row gutter={16}>
                    <Col span={6}>
                      <Form.Item
                        name="basePrice"
                        label="Price"
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
                    {/* Hidden fields for design services */}
                    <Form.Item name="pricingMethod" hidden initialValue="unit">
                      <Input value="unit" />
                    </Form.Item>
                    <Form.Item name="setupFee" hidden initialValue={0}>
                      <InputNumber value={0} />
                    </Form.Item>
                    <Form.Item name="pricePerUnit" hidden>
                      <InputNumber value={0} />
                    </Form.Item>
                    <Form.Item name="pricePerSquareFoot" hidden>
                      <InputNumber value={0} />
                    </Form.Item>
                    <Form.Item name="colorType" hidden initialValue="color">
                      <Select value="color" />
                    </Form.Item>
                  </Row>
                );
              }
              
              // Auto-detect square-foot pricing for SAV, Banner, One Way Vision
              const isSquareFootPricing = pricingMethod === 'square_foot' || 
                                        ['SAV (Self-Adhesive Vinyl)', 'Banner', 'One Way Vision'].includes(materialType);
              
              if (isSquareFootPricing) {
                // For square-foot pricing: Only show Price Per Square Foot (no other pricing fields)
                return (
                  <Row gutter={16}>
                    <Col span={6}>
                      <Form.Item 
                        name="pricePerSquareFoot" 
                        label="Price Per Square Foot"
                        rules={[{ required: true, message: 'Required for square foot pricing' }]}
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
                    {/* Hidden fields for square-foot pricing */}
                    <Form.Item name="pricingMethod" hidden initialValue="square_foot">
                      <Input value="square_foot" />
                    </Form.Item>
                    <Form.Item name="basePrice" hidden initialValue={0}>
                      <InputNumber value={0} />
                    </Form.Item>
                    <Form.Item name="setupFee" hidden initialValue={0}>
                      <InputNumber value={0} />
                    </Form.Item>
                    <Form.Item name="pricePerUnit" hidden>
                      <InputNumber value={0} />
                    </Form.Item>
                    <Form.Item name="colorType" hidden>
                      <Select value="color" />
                    </Form.Item>
                    <Form.Item name="minimumQuantity" hidden initialValue={1}>
                      <InputNumber value={1} />
                    </Form.Item>
                    <Form.Item name="maximumQuantity" hidden>
                      <InputNumber />
                    </Form.Item>
                  </Row>
                );
              } else {
                // For unit-based pricing: Show all standard fields
                return (
                  <>
                    <Row gutter={16}>
                      <Col span={6}>
                        <Form.Item
                          name="pricingMethod"
                          label="Pricing Method"
                          initialValue="unit"
                        >
                          <Select placeholder="Select pricing method" size="large">
                            <Option value="unit">By Unit (Quantity × Price)</Option>
                            <Option value="square_foot">By Square Foot (Size × Price/Sqft)</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item
                          name="colorType"
                          label="Color Type"
                        >
                          <Select placeholder="Select color type" size="large">
                            <Option value="black_white">Black & White</Option>
                            <Option value="color">Color</Option>
                            <Option value="spot_color">Spot Color</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item
                          name="basePrice"
                          label="Base Price"
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
                      <Col span={6}>
                        <Form.Item name="setupFee" label="Setup Fee">
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
                    </Row>
                    <Row gutter={16}>
                      <Col span={6}>
                        <Form.Item name="pricePerUnit" label="Price Per Unit">
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
                    </Row>
                  </>
                );
              }
            }}
          </Form.Item>

          {/* Show quantity fields based on category and pricing method */}
          <Form.Item shouldUpdate={(prevValues, currentValues) => 
            prevValues.pricingMethod !== currentValues.pricingMethod ||
            prevValues.materialType !== currentValues.materialType ||
            prevValues.category !== currentValues.category
          }>
            {({ getFieldValue }) => {
              const pricingMethod = getFieldValue('pricingMethod');
              const materialType = getFieldValue('materialType');
              const category = getFieldValue('category');
              
              // Skip quantity fields for Design Services
              if (category === 'Design Services') {
                return (
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item name="isActive" label="Status" valuePropName="checked">
                        <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                      </Form.Item>
                    </Col>
                    {/* Hidden quantity fields */}
                    <Form.Item name="minimumQuantity" hidden initialValue={1}>
                      <InputNumber value={1} />
                    </Form.Item>
                    <Form.Item name="maximumQuantity" hidden>
                      <InputNumber />
                    </Form.Item>
                  </Row>
                );
              }
              
              const isSquareFootPricing = pricingMethod === 'square_foot' || 
                                        ['SAV (Self-Adhesive Vinyl)', 'Banner', 'One Way Vision'].includes(materialType);
              
              if (!isSquareFootPricing) {
                // Show quantity fields for unit-based pricing
                return (
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item name="minimumQuantity" label="Min Quantity">
                        <InputNumber
                          style={{ width: '100%' }}
                          placeholder="1"
                          min={1}
                          size="large"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="maximumQuantity" label="Max Quantity">
                        <InputNumber
                          style={{ width: '100%' }}
                          placeholder="Optional"
                          min={1}
                          size="large"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="isActive" label="Status" valuePropName="checked">
                        <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                      </Form.Item>
                    </Col>
                  </Row>
                );
              } else {
                // For square-foot pricing: Only show status
                return (
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item name="isActive" label="Status" valuePropName="checked">
                        <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                      </Form.Item>
                    </Col>
                  </Row>
                );
              }
            }}
          </Form.Item>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="description" label="Description">
                <TextArea rows={3} placeholder="Enter template description" size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>Discount Tiers (Optional)</Divider>

          <Form.List name="discountTiers">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Card key={key} size="small" style={{ marginBottom: 16, background: '#f9f9f9' }}>
                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item
                          {...restField}
                          name={[name, 'minQuantity']}
                          label="Min Quantity"
                          rules={[{ required: true, message: 'Required' }]}
                        >
                          <InputNumber
                            style={{ width: '100%' }}
                            placeholder="100"
                            min={1}
                            size="large"
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item
                          {...restField}
                          name={[name, 'maxQuantity']}
                          label="Max Quantity"
                        >
                          <InputNumber
                            style={{ width: '100%' }}
                            placeholder="Optional"
                            min={1}
                            size="large"
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item
                          {...restField}
                          name={[name, 'discountPercent']}
                          label="Discount %"
                          rules={[{ required: true, message: 'Required' }]}
                        >
                          <InputNumber
                            style={{ width: '100%' }}
                            placeholder="10"
                            min={0}
                            max={100}
                            size="large"
                            suffix="%"
                          />
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
                      Remove Tier
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
                    Add Discount Tier
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Divider>Additional Options (Optional)</Divider>

          <Form.List name="additionalOptions">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Card key={key} size="small" style={{ marginBottom: 16, background: '#f9f9f9' }}>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          {...restField}
                          name={[name, 'name']}
                          label="Option Name"
                          rules={[{ required: true, message: 'Required' }]}
                        >
                          <Input placeholder="e.g., Lamination, Binding" size="large" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          {...restField}
                          name={[name, 'price']}
                          label="Additional Price"
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
                    </Row>
                    <Button
                      type="dashed"
                      danger
                      onClick={() => remove(name)}
                      icon={<MinusCircleOutlined />}
                      block
                    >
                      Remove Option
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
                    Add Additional Option
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      <DetailsDrawer
        open={drawerVisible}
        onClose={handleCloseDrawer}
        title="Pricing Template Details"
        width={800}
        onEdit={isManager && viewingTemplate ? () => {
          handleEdit(viewingTemplate);
          setDrawerVisible(false);
        } : null}
        onDelete={isAdmin && viewingTemplate ? () => {
          handleDelete(viewingTemplate.id);
          setDrawerVisible(false);
        } : null}
        deleteConfirmText="Are you sure you want to delete this pricing template?"
        fields={viewingTemplate ? [
          { label: 'Template Name', value: viewingTemplate.name },
          { 
            label: 'Category', 
            value: viewingTemplate.category,
            render: (cat) => <Tag color="blue">{cat}</Tag>
          },
          { label: 'Job Type', value: viewingTemplate.jobType || '-' },
          { label: 'Material Type', value: viewingTemplate.materialType || viewingTemplate.paperType || '-' },
          { label: 'Material Size', value: viewingTemplate.materialSize || viewingTemplate.paperSize || '-' },
          ...(viewingTemplate.materialSize === 'Custom' || (viewingTemplate.materialSize === undefined && viewingTemplate.paperSize === 'Custom') ? [
            { label: 'Custom Height', value: viewingTemplate.customHeight ? `${viewingTemplate.customHeight} ${viewingTemplate.customUnit || ''}` : '-' },
            { label: 'Custom Width', value: viewingTemplate.customWidth ? `${viewingTemplate.customWidth} ${viewingTemplate.customUnit || ''}` : '-' },
            { label: 'Price per Square Foot', value: viewingTemplate.pricePerSquareFoot ? `₵${parseFloat(viewingTemplate.pricePerSquareFoot).toFixed(2)}` : '-' },
          ] : []),
          { 
            label: 'Color Type', 
            value: viewingTemplate.colorType,
            render: (type) => {
              const labels = {
                black_white: 'Black & White',
                color: 'Color',
                spot_color: 'Spot Color'
              };
              return type ? labels[type] : '-';
            }
          },
          { 
            label: 'Base Price', 
            value: viewingTemplate.basePrice,
            render: (price) => `₵${parseFloat(price || 0).toFixed(2)}`
          },
          { 
            label: 'Price Per Unit', 
            value: viewingTemplate.pricePerUnit,
            render: (price) => price ? `₵${parseFloat(price).toFixed(2)}` : '-'
          },
          { 
            label: 'Setup Fee', 
            value: viewingTemplate.setupFee,
            render: (fee) => `₵${parseFloat(fee || 0).toFixed(2)}`
          },
          { label: 'Min Quantity', value: viewingTemplate.minimumQuantity || 1 },
          { label: 'Max Quantity', value: viewingTemplate.maximumQuantity || 'Unlimited' },
          { label: 'Description', value: viewingTemplate.description || '-' },
          {
            label: 'Discount Tiers',
            value: viewingTemplate.discountTiers,
            render: (tiers) => {
              if (!tiers || tiers.length === 0) return '-';
              return (
                <List
                  size="small"
                  dataSource={tiers}
                  renderItem={(tier) => (
                    <List.Item>
                      <Space>
                        <Tag color="green">{tier.discountPercent}% off</Tag>
                        <span>
                          for {tier.minQuantity} - {tier.maxQuantity || '∞'} units
                        </span>
                      </Space>
                    </List.Item>
                  )}
                />
              );
            }
          },
          {
            label: 'Additional Options',
            value: viewingTemplate.additionalOptions,
            render: (options) => {
              if (!options || options.length === 0) return '-';
              return (
                <List
                  size="small"
                  dataSource={options}
                  renderItem={(option) => (
                    <List.Item>
                      <Space>
                        <Tag color="blue">{option.name}</Tag>
                        <span>₵{parseFloat(option.price || 0).toFixed(2)}</span>
                      </Space>
                    </List.Item>
                  )}
                />
              );
            }
          },
          { 
            label: 'Status', 
            value: viewingTemplate.isActive,
            render: (isActive) => (
              <Tag color={isActive ? 'green' : 'red'}>
                {isActive ? 'Active' : 'Inactive'}
              </Tag>
            )
          },
          { 
            label: 'Created At', 
            value: viewingTemplate.createdAt,
            render: (value) => value ? new Date(value).toLocaleString() : '-'
          },
          { 
            label: 'Last Updated', 
            value: viewingTemplate.updatedAt,
            render: (value) => value ? new Date(value).toLocaleString() : '-'
          },
        ] : []}
      />
    </div>
  );
};

export default Pricing;
