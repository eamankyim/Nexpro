import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, message, Space, Tag, Descriptions, List, Spin, Empty, InputNumber, Select, Image, Popconfirm } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import vendorService from '../services/vendorService';
import vendorPriceListService from '../services/vendorPriceListService';
import { useAuth } from '../context/AuthContext';
import ActionColumn from '../components/ActionColumn';
import DetailsDrawer from '../components/DetailsDrawer';

const Vendors = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();
  const { isManager } = useAuth();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingVendor, setViewingVendor] = useState(null);
  const [priceList, setPriceList] = useState([]);
  const [loadingPriceList, setLoadingPriceList] = useState(false);
  const [priceListModalVisible, setPriceListModalVisible] = useState(false);
  const [editingPriceItem, setEditingPriceItem] = useState(null);
  const [priceListForm] = Form.useForm();

  useEffect(() => {
    fetchVendors();
  }, [pagination.current, pagination.pageSize, searchText]);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const response = await vendorService.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        search: searchText,
      });
      setVendors(response.data);
      setPagination({ ...pagination, total: response.count });
    } catch (error) {
      message.error('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingVendor) {
        await vendorService.update(editingVendor.id, values);
        message.success('Vendor updated successfully');
      } else {
        await vendorService.create(values);
        message.success('Vendor created successfully');
      }
      setModalVisible(false);
      fetchVendors();
    } catch (error) {
      message.error(error.error || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    try {
      await vendorService.delete(id);
      message.success('Vendor deleted successfully');
      fetchVendors();
    } catch (error) {
      message.error('Failed to delete vendor');
    }
  };

  const handleView = async (vendor) => {
    setViewingVendor(vendor);
    setDrawerVisible(true);
    
    // Fetch vendor price list
    setLoadingPriceList(true);
    try {
      const response = await vendorPriceListService.getAll(vendor.id);
      setPriceList(response.data || []);
    } catch (error) {
      console.error('Failed to load vendor price list:', error);
      setPriceList([]);
    } finally {
      setLoadingPriceList(false);
    }
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setViewingVendor(null);
    setPriceList([]);
  };

  const handleAddPriceItem = () => {
    setEditingPriceItem(null);
    priceListForm.resetFields();
    setPriceListModalVisible(true);
  };

  const handleEditPriceItem = (item) => {
    setEditingPriceItem(item);
    priceListForm.setFieldsValue(item);
    setPriceListModalVisible(true);
  };

  const handleDeletePriceItem = async (itemId) => {
    try {
      await vendorPriceListService.delete(viewingVendor.id, itemId);
      message.success('Price item deleted successfully');
      // Refresh price list
      const response = await vendorPriceListService.getAll(viewingVendor.id);
      setPriceList(response.data || []);
    } catch (error) {
      message.error('Failed to delete price item');
    }
  };

  const handlePriceListSubmit = async (values) => {
    try {
      if (editingPriceItem) {
        await vendorPriceListService.update(viewingVendor.id, editingPriceItem.id, values);
        message.success('Price item updated successfully');
      } else {
        await vendorPriceListService.create(viewingVendor.id, values);
        message.success('Price item added successfully');
      }
      setPriceListModalVisible(false);
      // Refresh price list
      const response = await vendorPriceListService.getAll(viewingVendor.id);
      setPriceList(response.data || []);
    } catch (error) {
      message.error(error.error || 'Operation failed');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Company', dataIndex: 'company', key: 'company' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone' },
    { 
      title: 'Category', 
      dataIndex: 'category', 
      key: 'category',
      render: (category) => category ? <Tag color="blue">{category}</Tag> : '-'
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
        <h1>Vendors</h1>
        <Space>
          <Input.Search
            placeholder="Search vendors..."
            allowClear
            onSearch={(value) => {
              setSearchText(value);
              setPagination({ ...pagination, current: 1 });
            }}
            style={{ width: 250 }}
            prefix={<SearchOutlined />}
          />
          {isManager && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingVendor(null);
                form.resetFields();
                setModalVisible(true);
              }}
            >
              Add Vendor
            </Button>
          )}
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={vendors}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={(newPagination) => setPagination(newPagination)}
      />

      <Modal
        title={editingVendor ? 'Edit Vendor' : 'Add Vendor'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please enter vendor name' }]}>
            <Input placeholder="Enter vendor name" size="large" />
          </Form.Item>
          <Form.Item name="company" label="Company">
            <Input placeholder="Enter company name" size="large" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Please enter a valid email' }]}>
            <Input placeholder="vendor@example.com" size="large" />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input placeholder="(123) 456-7890" size="large" />
          </Form.Item>
          <Form.Item name="website" label="Website (Optional)">
            <Input placeholder="https://www.example.com" size="large" />
          </Form.Item>
          <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Please select a category' }]}>
            <Select placeholder="Select category" size="large">
              <Select.Option value="Paper Supplier">Paper Supplier</Select.Option>
              <Select.Option value="Ink Supplier">Ink Supplier</Select.Option>
              <Select.Option value="Equipment Supplier">Equipment Supplier</Select.Option>
              <Select.Option value="Printing Equipment">Printing Equipment</Select.Option>
              <Select.Option value="Printing Services">Printing Services</Select.Option>
              <Select.Option value="Binding & Finishing">Binding & Finishing</Select.Option>
              <Select.Option value="Design Services">Design Services</Select.Option>
              <Select.Option value="Pre-Press Services">Pre-Press Services</Select.Option>
              <Select.Option value="Packaging Materials">Packaging Materials</Select.Option>
              <Select.Option value="Specialty Papers">Specialty Papers</Select.Option>
              <Select.Option value="Maintenance & Repair">Maintenance & Repair</Select.Option>
              <Select.Option value="Shipping & Logistics">Shipping & Logistics</Select.Option>
              <Select.Option value="Software & Technology">Software & Technology</Select.Option>
              <Select.Option value="Other">Other</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} placeholder="Enter address" size="large" />
          </Form.Item>
        </Form>
      </Modal>

      <DetailsDrawer
        open={drawerVisible}
        onClose={handleCloseDrawer}
        title="Vendor Details"
        width={900}
        onEdit={isManager && viewingVendor ? () => {
          setEditingVendor(viewingVendor);
          form.setFieldsValue(viewingVendor);
          setModalVisible(true);
          setDrawerVisible(false);
        } : null}
        onDelete={isManager && viewingVendor ? () => {
          handleDelete(viewingVendor.id);
          setDrawerVisible(false);
        } : null}
        deleteConfirmText="Are you sure you want to delete this vendor?"
        tabs={viewingVendor ? [
          {
            key: 'details',
            label: 'Details',
            content: (
              <Descriptions column={1} bordered>
                <Descriptions.Item label="Name">{viewingVendor.name || '-'}</Descriptions.Item>
                <Descriptions.Item label="Company">{viewingVendor.company || '-'}</Descriptions.Item>
                <Descriptions.Item label="Email">
                  {viewingVendor.email ? (
                    <a href={`mailto:${viewingVendor.email}`}>{viewingVendor.email}</a>
                  ) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Phone">
                  {viewingVendor.phone ? (
                    <a href={`tel:${viewingVendor.phone}`}>{viewingVendor.phone}</a>
                  ) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Website">
                  {viewingVendor.website ? (
                    <a href={viewingVendor.website} target="_blank" rel="noopener noreferrer">
                      {viewingVendor.website}
                    </a>
                  ) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Category">
                  {viewingVendor.category ? (
                    <Tag color="blue">{viewingVendor.category}</Tag>
                  ) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Address">{viewingVendor.address || '-'}</Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={viewingVendor.isActive ? 'green' : 'red'}>
                    {viewingVendor.isActive ? 'Active' : 'Inactive'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Created At">
                  {viewingVendor.createdAt ? new Date(viewingVendor.createdAt).toLocaleString() : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Last Updated">
                  {viewingVendor.updatedAt ? new Date(viewingVendor.updatedAt).toLocaleString() : '-'}
                </Descriptions.Item>
              </Descriptions>
            )
          },
          {
            key: 'pricelist',
            label: 'Price Lists',
            content: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h3>Services & Products ({priceList.length})</h3>
                  {isManager && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddPriceItem}>
                      Add Item
                    </Button>
                  )}
                </div>
                {loadingPriceList ? (
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <Spin size="large" />
                  </div>
                ) : priceList.length > 0 ? (
                  <List
                    dataSource={priceList}
                    renderItem={(item) => (
                      <List.Item
                        style={{
                          padding: '12px 16px',
                          background: '#fff',
                          border: '1px solid #f0f0f0',
                          borderRadius: 8,
                          marginBottom: 12
                        }}
                        actions={isManager ? [
                          <Button 
                            key="edit" 
                            type="text" 
                            icon={<EditOutlined />}
                            onClick={() => handleEditPriceItem(item)}
                          />,
                          <Popconfirm
                            key="delete"
                            title="Delete this item?"
                            onConfirm={() => handleDeletePriceItem(item.id)}
                            okText="Yes"
                            cancelText="No"
                          >
                            <Button 
                              type="text" 
                              danger 
                              icon={<DeleteOutlined />}
                            />
                          </Popconfirm>
                        ] : []}
                      >
                        <List.Item.Meta
                          avatar={
                            item.imageUrl ? (
                              <Image
                                src={item.imageUrl}
                                alt={item.name}
                                width={60}
                                height={60}
                                style={{ 
                                  objectFit: 'cover', 
                                  borderRadius: 8,
                                  cursor: 'pointer'
                                }}
                                preview={{
                                  mask: <EyeOutlined />
                                }}
                              />
                            ) : (
                              <div style={{
                                width: 60,
                                height: 60,
                                background: '#f0f0f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 8,
                                fontSize: 10,
                                color: '#999',
                                textAlign: 'center'
                              }}>
                                No Image
                              </div>
                            )
                          }
                          title={
                            <Space>
                              <span style={{ fontWeight: 600, fontSize: 15 }}>{item.name}</span>
                              <Tag color={item.itemType === 'service' ? 'blue' : 'green'}>
                                {item.itemType}
                              </Tag>
                            </Space>
                          }
                          description={
                            <div style={{ marginTop: 4 }}>
                              <div style={{ color: '#666', fontSize: 13, marginBottom: 8 }}>
                                {item.description || 'No description'}
                              </div>
                              <Space size={16}>
                                <span style={{ fontSize: 18, fontWeight: 'bold', color: '#1890ff' }}>
                                  ₵{parseFloat(item.price || 0).toFixed(2)}
                                </span>
                                <span style={{ color: '#999', fontSize: 13 }}>
                                  per {item.unit || 'unit'}
                                </span>
                              </Space>
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty description="No price list items found" />
                )}
              </div>
            )
          }
        ] : null}
      />

      <Modal
        title={editingPriceItem ? 'Edit Price Item' : 'Add Price Item'}
        open={priceListModalVisible}
        onCancel={() => setPriceListModalVisible(false)}
        onOk={() => priceListForm.submit()}
        width={600}
        zIndex={1050}
      >
        <Form
          form={priceListForm}
          layout="vertical"
          onFinish={handlePriceListSubmit}
          initialValues={{ itemType: 'service', unit: 'unit' }}
        >
          <Form.Item
            name="itemType"
            label="Type"
            rules={[{ required: true, message: 'Please select type' }]}
          >
            <Select size="large">
              <Select.Option value="service">Service</Select.Option>
              <Select.Option value="product">Product</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter name' }]}
          >
            <Input placeholder="Enter item name" size="large" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Enter description" size="large" />
          </Form.Item>

          <Form.Item
            name="price"
            label="Price"
            rules={[{ required: true, message: 'Please enter price' }]}
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

          <Form.Item name="unit" label="Unit">
            <Input placeholder="e.g., unit, hour, piece" size="large" />
          </Form.Item>

          <Form.Item name="imageUrl" label="Image URL (Optional)">
            <Input placeholder="Enter image URL" size="large" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Vendors;


