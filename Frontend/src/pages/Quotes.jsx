import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  message,
  Modal,
  Form,
  InputNumber,
  DatePicker,
  Row,
  Col,
  Divider,
  Tag,
  Typography,
  Card,
  Alert,
  Descriptions
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  FileTextOutlined,
  FileAddOutlined,
  CheckCircleOutlined,
  PrinterOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import quoteService from '../services/quoteService';
import customerService from '../services/customerService';
import ActionColumn from '../components/ActionColumn';
import DetailsDrawer from '../components/DetailsDrawer';
import PrintableInvoice from '../components/PrintableInvoice';

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const statusColors = {
  draft: 'default',
  sent: 'blue',
  accepted: 'green',
  declined: 'red',
  expired: 'orange'
};

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' }
];

const Quotes = () => {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ search: '', status: 'all', customerId: null });
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingQuote, setViewingQuote] = useState(null);
  const [quoteModalVisible, setQuoteModalVisible] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);
  const [form] = Form.useForm();
  const [customers, setCustomers] = useState([]);
  const [converting, setConverting] = useState(false);
  const navigate = useNavigate();
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [quotePrintable, setQuotePrintable] = useState(null);
  const [pendingDownload, setPendingDownload] = useState(false);

  const buildPrintableQuote = (quote) => {
    if (!quote) return null;
    return {
      ...quote,
      invoiceNumber: quote.quoteNumber,
      invoiceDate: quote.createdAt || quote.updatedAt || new Date(),
      dueDate: quote.validUntil || quote.createdAt || new Date(),
      subtotal: parseFloat(quote.subtotal || 0),
      taxAmount: parseFloat(quote.taxAmount || 0),
      taxRate: parseFloat(quote.taxRate || 0),
      discountAmount: parseFloat(quote.discountTotal || 0),
      discountType: quote.discountType || 'fixed',
      discountValue: parseFloat(quote.discountValue || 0),
      totalAmount: parseFloat(quote.totalAmount || 0),
      amountPaid: 0,
      balance: parseFloat(quote.totalAmount || 0),
      items: (quote.items || []).map((item) => ({
        ...item,
        description: item.description,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice || 0),
        total: parseFloat(item.total || (parseFloat(item.unitPrice || 0) * (item.quantity || 0))),
        discountAmount: parseFloat(item.discountAmount || 0)
      }))
    };
  };

  useEffect(() => {
    fetchQuotes();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        _ts: Date.now()
      };

      if (filters.status && filters.status !== 'all') {
        params.status = filters.status;
      }
      if (filters.customerId) {
        params.customerId = filters.customerId;
      }
      if (filters.search) {
        params.search = filters.search;
      }

      console.log('[Quotes] Fetch params:', params);
      const response = await quoteService.getAll(params);
      console.log('[Quotes] API response:', response);

      const quoteList = Array.isArray(response?.data) ? response.data : [];
      const totalCount = Number.isFinite(response?.count) ? response.count : quoteList.length;

      setQuotes(quoteList);
      setPagination((prev) => ({ ...prev, total: totalCount }));
    } catch (error) {
      console.error('Failed to load quotes:', error);
      message.error('Failed to load quotes');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuoteDetails = async (quoteId) => {
    try {
      const response = await quoteService.getById(quoteId);
      const data = response?.data ?? response;
      setViewingQuote(data);
      return data;
    } catch (error) {
      console.error(`Failed to fetch quote ${quoteId}:`, error);
      message.error('Failed to fetch quote details');
      return null;
    }
  };

  const handleView = async (quote) => {
    const details = await fetchQuoteDetails(quote.id);
    if (details) {
      setDrawerVisible(true);
    }
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setViewingQuote(null);
  };

  const handleAddQuote = async () => {
    form.resetFields();
    setEditingQuote(null);
    setQuoteModalVisible(true);
    try {
      const customersResponse = await customerService.getAll({ limit: 100 });
      setCustomers(customersResponse.data || []);
    } catch (error) {
      console.error('Failed to load customers for new quote:', error);
      message.error('Failed to load customers');
    }
  };

  const handleEditQuote = async (quote) => {
    setEditingQuote(quote);
    const details = await fetchQuoteDetails(quote.id);
    if (!details) {
      return;
    }
    try {
      const customersResponse = await customerService.getAll({ limit: 100 });
      setCustomers(customersResponse.data || []);
    } catch (error) {
      console.error('Failed to load customers for quote editing:', error);
      message.error('Failed to load customers');
    }

    form.setFieldsValue({
      customerId: details.customerId,
      title: details.title,
      description: details.description,
      status: details.status,
      validUntil: details.validUntil ? dayjs(details.validUntil) : null,
      notes: details.notes,
      items: (details.items || []).map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice),
        discountAmount: parseFloat(item.discountAmount || 0)
      }))
    });
    setQuoteModalVisible(true);
  };

  const handleDeleteQuote = async (quote) => {
    Modal.confirm({
      title: 'Delete Quote',
      content: `Are you sure you want to delete quote ${quote.quoteNumber}?`,
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await quoteService.delete(quote.id);
          message.success('Quote deleted successfully');
          fetchQuotes();
          if (viewingQuote?.id === quote.id) {
            handleCloseDrawer();
          }
        } catch (error) {
          message.error(error.error || 'Failed to delete quote');
        }
      }
    });
  };

  const handleSubmit = async (values) => {
    const payload = {
      customerId: values.customerId,
      title: values.title,
      description: values.description,
      status: values.status,
      validUntil: values.validUntil ? values.validUntil.format('YYYY-MM-DD') : null,
      notes: values.notes,
      items: (values.items || []).map((item) => ({
        description: item.description,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        discountAmount: Number(item.discountAmount || 0)
      }))
    };

    try {
      if (editingQuote) {
        await quoteService.update(editingQuote.id, payload);
        message.success('Quote updated successfully');
      } else {
        await quoteService.create(payload);
        message.success('Quote created successfully');
      }
      setQuoteModalVisible(false);
      fetchQuotes();
    } catch (error) {
      console.error('Failed to save quote:', error);
      message.error(error.error || 'Failed to save quote');
    }
  };

  const handleConvertToJob = async (quote) => {
    setConverting(true);
    try {
      const response = await quoteService.convertToJob(quote.id);
      const data = response?.data ?? response;
      const job = data?.data?.job ?? data?.job ?? data;
      message.success(`Quote converted to job ${job?.jobNumber || ''}`.trim());
      fetchQuotes();
      if (job) {
        navigate('/jobs');
      }
    } catch (error) {
      console.error('Failed to convert quote to job:', error);
      message.error(error.error || 'Failed to convert quote to job');
    } finally {
      setConverting(false);
    }
  };

  const openPrintableQuote = (quote, { autoDownload = false } = {}) => {
    setQuotePrintable(quote);
    setPrintModalVisible(true);
    if (autoDownload) {
      setPendingDownload(true);
    }
  };

  const closePrintableQuote = () => {
    setPrintModalVisible(false);
    setQuotePrintable(null);
    setPendingDownload(false);
  };

  const handleDownloadQuote = useCallback(async (quote, { silent = false } = {}) => {
    const target = quote || quotePrintable;
    if (!target) return;
    try {
      if (!silent) {
        message.loading({ content: 'Generating PDF...', key: 'download-quote', duration: 0 });
      }
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.querySelector('.printable-invoice');
      if (!element) {
        if (!silent) {
          message.destroy('download-quote');
        }
        message.error('Preview the quote before downloading');
        return;
      }
      const opt = {
        margin: 0,
        filename: `Quote_${target.quoteNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      await html2pdf().set(opt).from(element).save();
      if (!silent) {
        message.destroy('download-quote');
        message.success('Quote downloaded successfully');
      }
    } catch (error) {
      console.error('Error generating quote PDF:', error);
      if (!silent) {
        message.destroy('download-quote');
      }
      message.error('Failed to download quote');
    } finally {
      setPendingDownload(false);
    }
  }, [quotePrintable]);

  const handlePrintQuote = () => {
    window.print();
  };

  useEffect(() => {
    if (printModalVisible && pendingDownload && quotePrintable) {
      const timer = setTimeout(() => {
        handleDownloadQuote(quotePrintable, { silent: true });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [printModalVisible, pendingDownload, quotePrintable, handleDownloadQuote]);

  const columns = useMemo(() => [
    {
      title: 'Quote #',
      dataIndex: 'quoteNumber',
      key: 'quoteNumber',
      width: 160
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title'
    },
    {
      title: 'Customer',
      dataIndex: ['customer', 'name'],
      key: 'customer',
      render: (_, record) => record.customer?.name || 'N/A'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={statusColors[status]}>
          {status?.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Valid Until',
      dataIndex: 'validUntil',
      key: 'validUntil',
      render: (date) => date ? dayjs(date).format('MMM DD, YYYY') : '—'
    },
    {
      title: 'Total',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount) => `₵${parseFloat(amount || 0).toFixed(2)}`
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <ActionColumn
          record={record}
          onView={handleView}
          extraActions={[
            record.status !== 'accepted' && record.status !== 'declined' && record.status !== 'expired' && {
              label: 'Convert to Job',
              onClick: () => handleConvertToJob(record),
              icon: <FileAddOutlined />,
              disabled: converting
            },
            {
              label: 'Edit',
              onClick: () => handleEditQuote(record),
              icon: <FileTextOutlined />
            },
            {
              label: 'Delete',
              onClick: () => handleDeleteQuote(record),
              icon: <CheckCircleOutlined />,
              danger: true
            }
          ].filter(Boolean)}
        />
      )
    }
  ], [converting]);

  const drawerFields = useMemo(() => viewingQuote ? [
    { label: 'Quote Number', value: viewingQuote.quoteNumber },
    { label: 'Title', value: viewingQuote.title },
    {
      label: 'Customer',
      value: (
        <div>
          <div>{viewingQuote.customer?.name}</div>
          {viewingQuote.customer?.company && (
            <div style={{ fontSize: 12, color: '#888' }}>{viewingQuote.customer.company}</div>
          )}
        </div>
      )
    },
    {
      label: 'Status',
      value: (
        <Tag color={statusColors[viewingQuote.status]}>
          {viewingQuote.status?.toUpperCase()}
        </Tag>
      )
    },
    {
      label: 'Valid Until',
      value: viewingQuote.validUntil ? dayjs(viewingQuote.validUntil).format('MMM DD, YYYY') : '—'
    },
    {
      label: 'Total Amount',
      value: (
        <strong style={{ fontSize: 16, color: '#1890ff' }}>
          ₵{parseFloat(viewingQuote.totalAmount || 0).toFixed(2)}
        </strong>
      )
    },
    {
      label: 'Created By',
      value: viewingQuote.creator
        ? `${viewingQuote.creator.name} (${viewingQuote.creator.email})`
        : 'System'
    },
    viewingQuote.description && { label: 'Description', value: viewingQuote.description },
    viewingQuote.notes && { label: 'Notes', value: viewingQuote.notes }
  ].filter(Boolean) : [], [viewingQuote]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>Quotes</h1>
        <Space>
          <Input.Search
            placeholder="Search quotes..."
            allowClear
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            onSearch={(value) => setFilters((prev) => ({ ...prev, search: value }))}
          />
          <Select
            placeholder="Filter by status"
            value={filters.status}
            onChange={(value) => setFilters((prev) => ({ ...prev, status: value || 'all' }))}
            style={{ width: 150 }}
          >
            <Option value="all">All</Option>
            {statusOptions.map(option => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddQuote}>
            New Quote
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={quotes}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={(newPagination) => setPagination((prev) => ({ ...prev, ...newPagination }))}
      />

      <DetailsDrawer
        open={drawerVisible}
        onClose={handleCloseDrawer}
        title="Quote Details"
        width={720}
        onPrint={viewingQuote ? () => openPrintableQuote(viewingQuote) : null}
        onDownload={viewingQuote ? () => openPrintableQuote(viewingQuote, { autoDownload: true }) : null}
        tabs={viewingQuote ? [
          {
            key: 'details',
            label: 'Summary',
            content: (
              <div>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <div style={{
                    padding: 16,
                    borderRadius: 8,
                    background: '#f0f5ff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 600 }}>{viewingQuote.title}</div>
                      <div style={{ color: '#888' }}>{viewingQuote.quoteNumber}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, color: '#888' }}>Total Amount</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: '#1890ff' }}>
                        ₵{parseFloat(viewingQuote.totalAmount || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <Descriptions
                    column={1}
                    bordered
                    items={drawerFields.map((field) => ({
                      key: field.label,
                      label: field.label,
                      children: field.value || '—'
                    }))}
                  />
                </Space>
              </div>
            )
          },
          {
            key: 'items',
            label: 'Line Items',
            content: (
              <div style={{ padding: '16px 0' }}>
                {(viewingQuote.items || []).length ? (
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    {viewingQuote.items.map((item) => (
                      <Card key={item.id} size="small" variant="bordered">
                        <Row gutter={16}>
                          <Col span={12}>
                            <Text strong>{item.description}</Text>
                            {item.metadata && Object.keys(item.metadata || {}).length > 0 && (
                              <div style={{ color: '#888', marginTop: 4, fontSize: 12 }}>
                                {JSON.stringify(item.metadata)}
                              </div>
                            )}
                          </Col>
                          <Col span={4} style={{ textAlign: 'right' }}>
                            <div style={{ color: '#888' }}>Qty</div>
                            <div>{item.quantity}</div>
                          </Col>
                          <Col span={4} style={{ textAlign: 'right' }}>
                            <div style={{ color: '#888' }}>Unit Price</div>
                            <div>₵{parseFloat(item.unitPrice || 0).toFixed(2)}</div>
                          </Col>
                          <Col span={4} style={{ textAlign: 'right' }}>
                            <div style={{ color: '#888' }}>Total</div>
                            <div style={{ fontWeight: 600 }}>
                              ₵{parseFloat(item.total || 0).toFixed(2)}
                            </div>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                    <Card size="small" variant="bordered">
                      <Row gutter={16}>
                        <Col span={12}>
                          <Text strong>Subtotal</Text><br />
                          <Text strong>Total Discount</Text><br />
                          <Text strong>Grand Total</Text>
                        </Col>
                        <Col span={12} style={{ textAlign: 'right' }}>
                          <Text>₵{parseFloat(viewingQuote.subtotal || 0).toFixed(2)}</Text><br />
                          <Text>-₵{parseFloat(viewingQuote.discountTotal || 0).toFixed(2)}</Text><br />
                          <Text style={{ fontSize: 16, fontWeight: 700 }}>
                            ₵{parseFloat(viewingQuote.totalAmount || 0).toFixed(2)}
                          </Text>
                        </Col>
                      </Row>
                    </Card>
                  </Space>
                ) : (
                  <Alert type="info" message="No line items found for this quote." />
                )}
              </div>
            )
          }
        ] : []}
      />

      <Modal
        title={editingQuote ? `Edit Quote (${editingQuote.quoteNumber})` : 'Create Quote'}
        open={quoteModalVisible}
        onCancel={() => {
          setQuoteModalVisible(false);
          setEditingQuote(null);
        }}
        onOk={() => form.submit()}
        width={900}
        okText={editingQuote ? 'Update Quote' : 'Create Quote'}
        styles={{
        body: {
          maxHeight: '80vh',
          overflowY: 'auto',
          paddingRight: 24
        }
      }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            status: 'draft',
            items: [{ description: '', quantity: 1, unitPrice: 0, discountAmount: 0 }]
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
                  placeholder="Select customer"
                  showSearch
                  optionFilterProp="children"
                  size="large"
                >
                  {customers.map((customer) => (
                    <Option key={customer.id} value={customer.id}>
                      {customer.name} {customer.company ? `(${customer.company})` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="status"
                label="Status"
                rules={[{ required: true, message: 'Please select status' }]}
              >
                <Select size="large">
                  {statusOptions.map((option) => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="title"
                label="Quote Title"
                rules={[{ required: true, message: 'Please enter quote title' }]}
              >
                <Input placeholder="Quote title" size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="validUntil"
                label="Valid Until"
              >
                <DatePicker style={{ width: '100%' }} size="large" format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea rows={3} placeholder="Describe the work or specifications" />
          </Form.Item>

          <Divider>Quote Items</Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Card
                    key={key}
                    size="small"
                    style={{ marginBottom: 12 }}
                    variant="bordered"
                    title={`Item ${name + 1}`}
                    extra={
                      fields.length > 1 && (
                        <Button danger type="link" onClick={() => remove(name)}>
                          Remove
                        </Button>
                      )
                    }
                  >
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          {...restField}
                          name={[name, 'description']}
                          label="Description"
                          rules={[{ required: true, message: 'Please enter description' }]}
                        >
                          <Input placeholder="Item description" />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item
                          {...restField}
                          name={[name, 'quantity']}
                          label="Quantity"
                          rules={[{ required: true, message: 'Required' }]}
                          initialValue={1}
                        >
                          <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item
                          {...restField}
                          name={[name, 'unitPrice']}
                          label="Unit Price"
                          rules={[{ required: true, message: 'Required' }]}
                        >
                          <InputNumber
                            min={0}
                            prefix="₵"
                            style={{ width: '100%' }}
                            formatter={(value) => value ? `${value}` : ''}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item
                          {...restField}
                          name={[name, 'discountAmount']}
                          label="Discount"
                          initialValue={0}
                        >
                          <InputNumber
                            min={0}
                            prefix="₵"
                            style={{ width: '100%' }}
                            formatter={(value) => value ? `${value}` : ''}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Add Item
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Form.Item
            name="notes"
            label="Internal Notes"
          >
            <TextArea rows={3} placeholder="Notes for internal reference" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span>Quote Preview</span>
            <Space>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => handleDownloadQuote(quotePrintable)}
                disabled={!quotePrintable}
              >
                Download
              </Button>
              <Button
                type="primary"
                icon={<PrinterOutlined />}
                onClick={handlePrintQuote}
                disabled={!quotePrintable}
              >
                Print
              </Button>
            </Space>
          </div>
        }
        open={printModalVisible}
        onCancel={closePrintableQuote}
        footer={null}
        width="90%"
        style={{ maxWidth: '1200px' }}
        destroyOnClose
        styles={{
          body: {
            maxHeight: '70vh',
            overflowY: 'auto',
            padding: 20
          }
        }}
      >
        {quotePrintable && (
          <PrintableInvoice
            invoice={buildPrintableQuote(quotePrintable)}
            documentTitle="PROFORMA INVOICE"
            documentSubtitle={`Quote ${quotePrintable.quoteNumber}`}
          />
        )}
      </Modal>
    </div>
  );
};

export default Quotes;


