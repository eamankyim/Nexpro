import { useEffect, useMemo, useState } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Table,
  Space,
  Button,
  Input,
  Select,
  Tag,
  message,
  Modal,
  Form,
  InputNumber,
  Typography,
  Divider,
  Alert,
  Timeline,
  Switch,
  Descriptions
} from 'antd';
import {
  AppstoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  InboxOutlined,
  AlertOutlined,
  DollarCircleOutlined,
  PlusCircleOutlined,
  EditOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import DetailsDrawer from '../components/DetailsDrawer';
import ActionColumn from '../components/ActionColumn';
import inventoryService from '../services/inventoryService';
import vendorService from '../services/vendorService';

const { Title, Text } = Typography;
const { Option } = Select;

const sortCategories = (list = []) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name));

const stockStatus = (item) => {
  const quantity = parseFloat(item.quantityOnHand || 0);
  const reorder = parseFloat(item.reorderLevel || 0);

  if (quantity <= 0) {
    return { color: 'red', label: 'Out of stock' };
  }
  if (quantity <= reorder) {
    return { color: 'orange', label: 'Low stock' };
  }
  return { color: 'green', label: 'In stock' };
};

const valueFormatter = (value) =>
  `₵${parseFloat(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const Inventory = () => {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [categoryModalContext, setCategoryModalContext] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [restockModalVisible, setRestockModalVisible] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    categoryId: 'all',
    status: 'active',
    lowStock: false
  });

  const [itemForm] = Form.useForm();
  const [restockForm] = Form.useForm();
  const [adjustForm] = Form.useForm();
  const [categoryForm] = Form.useForm();

  useEffect(() => {
    fetchCategories();
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchCategories = async () => {
    try {
      const response = await inventoryService.getCategories();
      const data = response?.data || [];
      setCategories(sortCategories(data));
    } catch (error) {
      console.error('Failed to load categories', error);
      message.error('Failed to load categories');
    }
  };

  const fetchSummary = async () => {
    setSummaryLoading(true);
    try {
      const response = await inventoryService.getSummary();
      setSummary(response?.data || {});
    } catch (error) {
      console.error('Failed to load inventory summary', error);
      message.error('Failed to load inventory summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      console.log('[Inventory] Fetch items params', {
        page: pagination.current,
        limit: pagination.pageSize,
        search: filters.search || undefined,
        categoryId: filters.categoryId !== 'all' ? filters.categoryId : undefined,
        status: filters.status !== 'all' ? filters.status : undefined,
        lowStock: filters.lowStock
      });
      const response = await inventoryService.getItems({
        page: pagination.current,
        limit: pagination.pageSize,
        search: filters.search || undefined,
        categoryId: filters.categoryId !== 'all' ? filters.categoryId : undefined,
        status: filters.status !== 'all' ? filters.status : undefined,
        lowStock: filters.lowStock
      });

      const payload = response || {};
      console.log('[Inventory] Items response', payload);
      const rows = Array.isArray(payload.data) ? payload.data : [];
      setItems(rows);
      setPagination((prev) => ({
        ...prev,
        total: payload.count || rows.length || 0
      }));
    } catch (error) {
      console.error('Failed to load inventory items', error);
      message.error('Failed to load inventory items');
    } finally {
      setLoading(false);
    }
  };

  const loadVendors = async () => {
    try {
      const response = await vendorService.getVendors({ limit: 100 });
      setVendors(response?.data || []);
    } catch (error) {
      console.error('Failed to load vendors', error);
    }
  };

  const openCategoryModal = (context = null) => {
    categoryForm.resetFields();
    setCategoryModalContext(context);
    setCategoryModalVisible(true);
  };

  const handleCategorySubmit = async (values) => {
    try {
      const payload = await inventoryService.createCategory(values);
      const newCategory = payload?.data || payload;
      if (!newCategory?.id) {
        throw new Error('Invalid category response');
      }
      setCategories((prev) => sortCategories([...prev, newCategory]));
      message.success('Category added successfully');
      setCategoryModalVisible(false);

      if (categoryModalContext === 'filter') {
        setFilters((prev) => ({ ...prev, categoryId: newCategory.id }));
        setPagination((prev) => ({ ...prev, current: 1 }));
      } else if (categoryModalContext === 'item') {
        itemForm.setFieldsValue({ categoryId: newCategory.id });
      }

      setCategoryModalContext(null);
      fetchSummary();
    } catch (error) {
      console.error('Failed to create category', error);
      const errorMsg = error?.response?.data?.message || 'Failed to create category';
      message.error(errorMsg);
    }
  };

  const handleTableChange = (newPagination) => {
    setPagination((prev) => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize
    }));
  };

  const handleSearch = (value) => {
    setPagination((prev) => ({ ...prev, current: 1 }));
    setFilters((prev) => ({ ...prev, search: value }));
  };

  const handleCategoryChange = (value) => {
    setPagination((prev) => ({ ...prev, current: 1 }));
    setFilters((prev) => ({ ...prev, categoryId: value }));
  };

  const handleStatusChange = (value) => {
    setPagination((prev) => ({ ...prev, current: 1 }));
    setFilters((prev) => ({ ...prev, status: value }));
  };

  const handleLowStockToggle = (checked) => {
    setPagination((prev) => ({ ...prev, current: 1 }));
    setFilters((prev) => ({ ...prev, lowStock: checked }));
  };

  const handleViewItem = async (record) => {
    try {
      const response = await inventoryService.getById(record.id);
      const data = response?.data || response;
      setViewingItem(data);
      setDrawerVisible(true);
    } catch (error) {
      console.error('Failed to fetch inventory item', error);
      message.error('Failed to load inventory details');
    }
  };

  const openItemModal = async (item = null) => {
    if (!vendors.length) {
      await loadVendors();
    }

    setEditingItem(item);
    if (item) {
      itemForm.setFieldsValue({
        name: item.name,
        sku: item.sku,
        categoryId: item.categoryId || undefined,
        unit: item.unit,
        quantityOnHand: parseFloat(item.quantityOnHand || 0),
        reorderLevel: parseFloat(item.reorderLevel || 0),
        preferredVendorId: item.preferredVendorId || undefined,
        unitCost: parseFloat(item.unitCost || 0),
        location: item.location,
        isActive: item.isActive
      });
    } else {
      itemForm.resetFields();
      itemForm.setFieldsValue({
        unit: 'pcs',
        quantityOnHand: 0,
        reorderLevel: 0,
        unitCost: 0,
        isActive: true
      });
    }

    setItemModalVisible(true);
  };

  const handleItemSubmit = async (values) => {
    try {
      if (editingItem) {
        await inventoryService.updateItem(editingItem.id, values);
        message.success('Inventory item updated successfully');
      } else {
        await inventoryService.createItem(values);
        message.success('Inventory item created successfully');
      }
      setItemModalVisible(false);
      fetchItems();
      fetchSummary();
    } catch (error) {
      console.error('Failed to save inventory item', error);
      const errorMsg = error?.response?.data?.message || 'Failed to save inventory item';
      message.error(errorMsg);
    }
  };

  const handleRestock = (record) => {
    restockForm.resetFields();
    restockForm.setFieldsValue({
      quantity: 1,
      unitCost: parseFloat(record.unitCost || 0)
    });
    setEditingItem(record);
    setRestockModalVisible(true);
  };

  const submitRestock = async (values) => {
    try {
      await inventoryService.restock(editingItem.id, values);
      message.success('Inventory restocked successfully');
      setRestockModalVisible(false);
      fetchItems();
      fetchSummary();
      if (drawerVisible) {
        handleViewItem(editingItem);
      }
    } catch (error) {
      console.error('Failed to restock inventory', error);
      const errorMsg = error?.response?.data?.message || 'Failed to restock inventory';
      message.error(errorMsg);
    }
  };

  const handleAdjust = (record) => {
    adjustForm.resetFields();
    adjustForm.setFieldsValue({
      adjustmentMode: 'set',
      newQuantity: parseFloat(record.quantityOnHand || 0)
    });
    setEditingItem(record);
    setAdjustModalVisible(true);
  };

  const submitAdjustment = async (values) => {
    try {
      const payload = values.adjustmentMode === 'delta'
        ? { quantityDelta: values.quantityDelta, reason: values.reason, notes: values.notes }
        : { newQuantity: values.newQuantity, reason: values.reason, notes: values.notes };

      await inventoryService.adjust(editingItem.id, payload);
      message.success('Inventory adjustment recorded');
      setAdjustModalVisible(false);
      fetchItems();
      fetchSummary();
      if (drawerVisible) {
        handleViewItem(editingItem);
      }
    } catch (error) {
      console.error('Failed to adjust inventory', error);
      const errorMsg = error?.response?.data?.message || 'Failed to adjust inventory';
      message.error(errorMsg);
    }
  };

  const handleToggleActive = async (record) => {
    if (record.isActive) {
      Modal.confirm({
        title: 'Deactivate Inventory Item',
        content: `Are you sure you want to deactivate ${record.name}?`,
        okText: 'Deactivate',
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await inventoryService.deleteItem(record.id);
            message.success('Inventory item deactivated');
            fetchItems();
            fetchSummary();
          } catch (error) {
            console.error('Failed to deactivate inventory item', error);
            const errorMsg = error?.response?.data?.message || 'Failed to deactivate inventory item';
            message.error(errorMsg);
          }
        }
      });
    } else {
      try {
        await inventoryService.updateItem(record.id, { isActive: true });
        message.success('Inventory item reactivated');
        fetchItems();
        fetchSummary();
      } catch (error) {
        console.error('Failed to activate inventory item', error);
        const errorMsg = error?.response?.data?.message || 'Failed to activate inventory item';
        message.error(errorMsg);
      }
    }
  };

  const columns = useMemo(() => [
    {
      title: 'Item',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => {
        const status = stockStatus(record);
        return (
          <div>
            <div style={{ fontWeight: 600 }}>{record.name}</div>
            <div style={{ color: '#888' }}>{record.sku || '—'}</div>
            <Tag color={status.color} style={{ marginTop: 4 }}>
              {status.label}
            </Tag>
          </div>
        );
      }
    },
    {
      title: 'Category',
      dataIndex: ['category', 'name'],
      key: 'category',
      render: (_, record) => record.category?.name || 'Uncategorized'
    },
    {
      title: 'Quantity',
      dataIndex: 'quantityOnHand',
      key: 'quantityOnHand',
      render: (value, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{parseFloat(value || 0).toFixed(2)} {record.unit}</div>
          <div style={{ color: '#888', fontSize: 12 }}>Reorder at {parseFloat(record.reorderLevel || 0).toFixed(2)}</div>
        </div>
      )
    },
    {
      title: 'Unit Cost',
      dataIndex: 'unitCost',
      key: 'unitCost',
      render: (value) => valueFormatter(value)
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      render: (value) => value || '—'
    },
    {
      title: 'Vendor',
      dataIndex: ['preferredVendor', 'name'],
      key: 'vendor',
      render: (_, record) => record.preferredVendor?.name || '—'
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 200,
      render: (_, record) => (
        <ActionColumn
          record={record}
          onView={handleViewItem}
          extraActions={[
            {
              label: 'Restock',
              icon: <PlusCircleOutlined />,
              onClick: () => handleRestock(record)
            },
            {
              label: 'Adjust',
              icon: <EditOutlined />,
              onClick: () => handleAdjust(record)
            },
            {
              label: record.isActive ? 'Deactivate' : 'Activate',
              danger: record.isActive,
              icon: record.isActive ? <ArrowDownOutlined /> : <ArrowUpOutlined />,
              onClick: () => handleToggleActive(record)
            }
          ]}
        />
      )
    }
  ], [handleAdjust, handleRestock, handleToggleActive]);

  const summaryCards = [
    {
      title: 'Total Items',
      value: summary?.totals?.totalItems || 0,
      prefix: <AppstoreOutlined style={{ color: '#1890ff' }} />
    },
    {
      title: 'Total Quantity',
      value: parseFloat(summary?.totals?.totalQuantity || 0).toFixed(2),
      prefix: <InboxOutlined style={{ color: '#52c41a' }} />
    },
    {
      title: 'Inventory Value',
      value: valueFormatter(summary?.totals?.inventoryValue || 0),
      prefix: <DollarCircleOutlined style={{ color: '#faad14' }} />
    },
    {
      title: 'Low Stock Items',
      value: summary?.totals?.lowStockCount || 0,
      prefix: <AlertOutlined style={{ color: '#ff4d4f' }} />
    }
  ];

  const drawerTabs = useMemo(() => {
    if (!viewingItem) return [];

    const movementItems = viewingItem.movements
      ?.sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
      .map((movement) => ({
        color: movement.type === 'purchase' ? 'green' : movement.type === 'usage' ? 'red' : 'blue',
        children: (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {movement.type.toUpperCase()} {movement.quantityDelta > 0 ? '+' : ''}{parseFloat(movement.quantityDelta).toFixed(2)} {viewingItem.unit}
            </div>
            <div style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>
              {dayjs(movement.occurredAt).format('MMM DD, YYYY [at] hh:mm A')} • New Qty: {parseFloat(movement.newQuantity).toFixed(2)}
            </div>
            {movement.reference && (
              <div style={{ color: '#555', fontSize: 12 }}>Reference: {movement.reference}</div>
            )}
            {movement.createdByUser && (
              <div style={{ color: '#555', fontSize: 12 }}>
                By: {movement.createdByUser.name} ({movement.createdByUser.email})
              </div>
            )}
            {movement.job && (
              <div style={{ color: '#555', fontSize: 12 }}>
                Job: {movement.job.jobNumber} — {movement.job.title}
              </div>
            )}
            {movement.notes && (
              <div style={{ color: '#888', fontStyle: 'italic', marginTop: 4 }}>
                Notes: {movement.notes}
              </div>
            )}
          </div>
        )
      }));

    return [
      {
        key: 'summary',
        label: 'Summary',
        content: (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Divider orientation="left">Stock</Divider>
            <Row gutter={16}>
              <Col span={12}>
                <Card bordered={false}>
                  <Statistic
                    title="Quantity on Hand"
                    value={`${parseFloat(viewingItem.quantityOnHand || 0).toFixed(2)} ${viewingItem.unit}`}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card bordered={false}>
                  <Statistic
                    title="Reorder Level"
                    value={`${parseFloat(viewingItem.reorderLevel || 0).toFixed(2)} ${viewingItem.unit}`}
                  />
                </Card>
              </Col>
            </Row>

            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="SKU">{viewingItem.sku || '—'}</Descriptions.Item>
              <Descriptions.Item label="Category">{viewingItem.category?.name || 'Uncategorized'}</Descriptions.Item>
              <Descriptions.Item label="Preferred Vendor">
                {viewingItem.preferredVendor?.name || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Unit Cost">{valueFormatter(viewingItem.unitCost)}</Descriptions.Item>
              <Descriptions.Item label="Total Value">
                {valueFormatter(parseFloat(viewingItem.unitCost || 0) * parseFloat(viewingItem.quantityOnHand || 0))}
              </Descriptions.Item>
              <Descriptions.Item label="Location">{viewingItem.location || '—'}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={viewingItem.isActive ? 'green' : 'red'}>
                  {viewingItem.isActive ? 'Active' : 'Inactive'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Description">{viewingItem.description || '—'}</Descriptions.Item>
            </Descriptions>
          </Space>
        )
      },
      {
        key: 'movements',
        label: 'Movement History',
        content: movementItems?.length ? (
          <Timeline items={movementItems} />
        ) : (
          <Alert type="info" message="No movement history yet" />
        )
      }
    ];
  }, [viewingItem]);

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>Inventory</Title>
          <Text type="secondary">Track and manage materials, stock levels, and movements.</Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchItems(); fetchSummary(); }}>
              Refresh
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openItemModal()}>
              New Item
            </Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        {summaryCards.map((card) => (
          <Col xs={24} sm={12} md={6} key={card.title}>
            <Card loading={summaryLoading}>
              <Statistic
                title={card.title}
                value={card.value}
                prefix={card.prefix}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Input.Search
              allowClear
              placeholder="Search by name, SKU, description"
              onSearch={handleSearch}
              defaultValue={filters.search}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              value={filters.categoryId}
              onChange={handleCategoryChange}
              style={{ width: '100%' }}
              placeholder="Filter by category"
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <Divider style={{ margin: '8px 0' }} />
                  <Button
                    type="link"
                    icon={<PlusOutlined />}
                    onClick={() => openCategoryModal('filter')}
                    block
                  >
                    Add category
                  </Button>
                </>
              )}
            >
              <Option value="all">All Categories</Option>
              {categories.map((category) => (
                <Option key={category.id} value={category.id}>
                  {category.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              value={filters.status}
              onChange={handleStatusChange}
              style={{ width: '100%' }}
            >
              <Option value="active">Active</Option>
              <Option value="inactive">Inactive</Option>
              <Option value="all">All</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Space>
              <Switch checked={filters.lowStock} onChange={handleLowStockToggle} />
              <Text>Show low stock only</Text>
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        scroll={{ x: 1000 }}
      />

      <DetailsDrawer
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        title={viewingItem ? `${viewingItem.name} (${viewingItem.sku || 'No SKU'})` : 'Item details'}
        width={720}
        onEdit={viewingItem ? () => openItemModal(viewingItem) : null}
        onRestock={viewingItem ? () => handleRestock(viewingItem) : null}
        onAdjust={viewingItem ? () => handleAdjust(viewingItem) : null}
        onPrint={null}
        showActions
        tabs={drawerTabs}
      />

      <Modal
        title={editingItem ? `Edit ${editingItem.name}` : 'New Inventory Item'}
        open={itemModalVisible}
        onCancel={() => setItemModalVisible(false)}
        onOk={() => itemForm.submit()}
        okText={editingItem ? 'Update' : 'Create'}
        width={720}
      >
        <Form
          layout="vertical"
          form={itemForm}
          onFinish={handleItemSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Item Name"
                rules={[{ required: true, message: 'Please enter the item name' }]}
              >
                <Input placeholder="e.g. A4 Paper Ream" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sku" label="SKU">
                <Input placeholder="Optional SKU" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="categoryId" label="Category">
                <Select
                  placeholder="Select category"
                  dropdownRender={(menu) => (
                    <>
                      {menu}
                      <Divider style={{ margin: '8px 0' }} />
                      <Button
                        type="link"
                        icon={<PlusOutlined />}
                        onClick={() => openCategoryModal('item')}
                        block
                      >
                        Add category
                      </Button>
                    </>
                  )}
                >
                  {categories.map((category) => (
                    <Option key={category.id} value={category.id}>
                      {category.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="unit"
                label="Unit"
                rules={[{ required: true, message: 'Please specify unit of measure' }]}
              >
                <Input placeholder="e.g. pcs, box, roll" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="quantityOnHand"
                label="Quantity on Hand"
                rules={[{ required: true, message: 'Enter current quantity' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="reorderLevel"
                label="Reorder Level"
                rules={[{ required: true, message: 'Enter reorder level' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="unitCost"
                label="Unit Cost"
                rules={[{ required: true, message: 'Enter unit cost' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} prefix="₵" step={0.01} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="preferredVendorId" label="Preferred Vendor">
                <Select
                  showSearch
                  optionFilterProp="children"
                  placeholder="Select vendor"
                  allowClear
                >
                  {vendors.map((vendor) => (
                    <Option key={vendor.id} value={vendor.id}>
                      {vendor.name || vendor.company || vendor.email}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="location" label="Storage Location">
                <Input placeholder="Shelf, warehouse, etc." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="isActive" label="Active" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Optional description or specifications" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Add Inventory Category"
        open={categoryModalVisible}
        onCancel={() => {
          setCategoryModalVisible(false);
          setCategoryModalContext(null);
        }}
        onOk={() => categoryForm.submit()}
        okText="Save Category"
      >
        <Form
          layout="vertical"
          form={categoryForm}
          onFinish={handleCategorySubmit}
        >
          <Form.Item
            name="name"
            label="Category Name"
            rules={[{ required: true, message: 'Please enter a category name' }]}
          >
            <Input placeholder="e.g. Specialty Papers" />
          </Form.Item>
          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea rows={3} placeholder="Optional description" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingItem ? `Restock ${editingItem.name}` : 'Restock'}
        open={restockModalVisible}
        onCancel={() => setRestockModalVisible(false)}
        onOk={() => restockForm.submit()}
        okText="Restock"
      >
        <Form
          layout="vertical"
          form={restockForm}
          onFinish={submitRestock}
        >
          <Form.Item
            name="quantity"
            label="Quantity to add"
            rules={[{ required: true, message: 'Enter quantity to add' }]}
          >
            <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="unitCost" label="Unit Cost">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} prefix="₵" />
          </Form.Item>
          <Form.Item name="reference" label="Reference">
            <Input placeholder="Invoice number, supplier reference, etc." />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} placeholder="Optional notes" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingItem ? `Adjust ${editingItem.name}` : 'Adjust Inventory'}
        open={adjustModalVisible}
        onCancel={() => setAdjustModalVisible(false)}
        onOk={() => adjustForm.submit()}
        okText="Record Adjustment"
      >
        <Form
          layout="vertical"
          form={adjustForm}
          onFinish={submitAdjustment}
          initialValues={{ adjustmentMode: 'set' }}
        >
          <Form.Item name="adjustmentMode" label="Adjustment Mode">
            <Select>
              <Option value="set">Set to specific quantity</Option>
              <Option value="delta">Increase / Decrease by amount</Option>
            </Select>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.adjustmentMode !== curr.adjustmentMode}>
            {({ getFieldValue }) => {
              const mode = getFieldValue('adjustmentMode');
              if (mode === 'delta') {
                return (
                  <Form.Item
                    name="quantityDelta"
                    label="Quantity Change"
                    rules={[{ required: true, message: 'Enter adjustment amount' }]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      step={0.01}
                      placeholder="Use positive to add, negative to subtract"
                    />
                  </Form.Item>
                );
              }
              return (
                <Form.Item
                  name="newQuantity"
                  label="New Quantity"
                  rules={[{ required: true, message: 'Enter the new quantity' }]}
                >
                  <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item name="reason" label="Reason">
            <Input placeholder="e.g. Damage, audit correction, sample usage" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} placeholder="Optional additional details" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Inventory;


