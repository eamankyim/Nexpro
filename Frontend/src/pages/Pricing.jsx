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
    'Black & White Printing',
    'Color Printing',
    'Large Format Printing',
    'Business Cards',
    'Brochures',
    'Flyers',
    'Posters',
    'Banners',
    'Booklets',
    'Binding',
    'Lamination',
    'Photocopying',
    'Scanning',
    'Design Services',
    'Other'
  ];

  const paperSizes = ['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid', 'Custom', 'N/A'];

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
              <Option key={cat} value={cat}>{cat}</Option>
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
                    <Option key={cat} value={cat}>{cat}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="jobType" label="Job Type">
                <Input placeholder="e.g., Brochure, Flyer" size="large" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="paperType" label="Paper Type">
                <Input placeholder="e.g., Glossy, Matte" size="large" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="paperSize" label="Paper Size">
                <Select placeholder="Select paper size" size="large" allowClear>
                  {paperSizes.map(size => (
                    <Option key={size} value={size}>{size}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
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
          { label: 'Paper Type', value: viewingTemplate.paperType || '-' },
          { label: 'Paper Size', value: viewingTemplate.paperSize || '-' },
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
