import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, message, Space, Tag, Select, InputNumber, DatePicker, Row, Col, Descriptions, Statistic, Card, Divider } from 'antd';
import { PlusOutlined, DollarCircleOutlined, FileTextOutlined, ClockCircleOutlined, CheckCircleOutlined, PrinterOutlined, DownloadOutlined } from '@ant-design/icons';
import invoiceService from '../services/invoiceService';
import { useAuth } from '../context/AuthContext';
import ActionColumn from '../components/ActionColumn';
import DetailsDrawer from '../components/DetailsDrawer';
import PrintableInvoice from '../components/PrintableInvoice';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [paymentForm] = Form.useForm();
  const [stats, setStats] = useState(null);
  const { isManager } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const cleanFilters = {};
      if (filters.search) cleanFilters.search = filters.search;
      if (filters.status) cleanFilters.status = filters.status;

      const response = await invoiceService.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        ...cleanFilters,
      });
      setInvoices(response.data);
      setPagination(prev => ({ ...prev, total: response.count }));
    } catch (error) {
      message.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await invoiceService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load invoice stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
    fetchStats();
  }, [fetchInvoices, fetchStats, refreshTrigger]);

  const handleView = (invoice) => {
    setViewingInvoice(invoice);
    setDrawerVisible(true);
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setViewingInvoice(null);
  };

  const handlePrint = (invoice) => {
    setViewingInvoice(invoice);
    setPrintModalVisible(true);
  };

  const handlePrintInvoice = () => {
    window.print();
  };

  const handleDownloadInvoice = async () => {
    if (!viewingInvoice) return;
    
    try {
      message.loading({ content: 'Generating PDF...', key: 'download', duration: 0 });
      
      // Import html2pdf dynamically
      const html2pdf = (await import('html2pdf.js')).default;
      
      // Find the invoice element
      const invoiceElement = document.querySelector('.printable-invoice');
      
      if (!invoiceElement) {
        message.error({ content: 'Invoice not found', key: 'download' });
        return;
      }
      
      // Configure PDF options
      const opt = {
        margin: 0,
        filename: `Invoice_${viewingInvoice.invoiceNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      // Generate PDF and save it
      await html2pdf()
        .set(opt)
        .from(invoiceElement)
        .save();
      
      message.destroy('download');
      message.success({ content: 'PDF downloaded successfully!', key: 'download-success', duration: 3 });
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      message.error({ content: 'Failed to generate PDF. Please try again.', key: 'download' });
    }
  };

  const handleRecordPayment = (invoice) => {
    setViewingInvoice(invoice);
    paymentForm.resetFields();
    paymentForm.setFieldsValue({
      amount: parseFloat(invoice.balance),
      paymentMethod: 'cash',
      paymentDate: dayjs()
    });
    setPaymentModalVisible(true);
  };

  const handleMarkAsPaid = async (invoice) => {
    try {
      const response = await invoiceService.markAsPaid(invoice.id);
      const updatedInvoice = response?.data;

      if (updatedInvoice && viewingInvoice?.id === updatedInvoice.id) {
        setViewingInvoice(updatedInvoice);
      }

      message.success(response?.message || 'Invoice marked as paid');
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.error ||
        error?.message ||
        'Failed to mark invoice as paid';
      message.error(errorMessage);
    }
  };

  const handlePaymentSubmit = async (values) => {
    try {
      await invoiceService.recordPayment(viewingInvoice.id, {
        ...values,
        paymentDate: values.paymentDate.format('YYYY-MM-DD')
      });
      message.success('Payment recorded successfully');
      setPaymentModalVisible(false);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      message.error(error.error || 'Failed to record payment');
    }
  };

  const handleSendInvoice = async (id) => {
    try {
      await invoiceService.send(id);
      message.success('Invoice marked as sent');
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      message.error('Failed to send invoice');
    }
  };

  const handleCancelInvoice = async (id) => {
    try {
      await invoiceService.cancel(id);
      message.success('Invoice cancelled');
      setRefreshTrigger(prev => prev + 1);
      if (drawerVisible) handleCloseDrawer();
    } catch (error) {
      message.error('Failed to cancel invoice');
    }
  };

  const statusColors = {
    draft: 'default',
    sent: 'blue',
    paid: 'green',
    partial: 'orange',
    overdue: 'red',
    cancelled: 'gray',
  };

  const columns = [
    {
      title: 'Invoice #',
      dataIndex: 'invoiceNumber',
      key: 'invoiceNumber',
      width: 150,
      fixed: 'left',
    },
    {
      title: 'Customer',
      dataIndex: ['customer', 'name'],
      key: 'customer',
      render: (name, record) => (
        <div>
          <div>{name}</div>
          {record.customer?.company && (
            <div style={{ fontSize: 12, color: '#888' }}>{record.customer.company}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Job',
      dataIndex: ['job', 'jobNumber'],
      key: 'job',
      render: (jobNumber) => jobNumber || '-',
    },
    {
      title: 'Invoice Date',
      dataIndex: 'invoiceDate',
      key: 'invoiceDate',
      render: (date) => dayjs(date).format('MMM DD, YYYY'),
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (date) => dayjs(date).format('MMM DD, YYYY'),
    },
    {
      title: 'Total',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount) => `₵${parseFloat(amount || 0).toFixed(2)}`,
    },
    {
      title: 'Balance',
      dataIndex: 'balance',
      key: 'balance',
      render: (balance) => (
        <span style={{ fontWeight: 'bold', color: balance > 0 ? '#ff4d4f' : '#52c41a' }}>
          ₵{parseFloat(balance || 0).toFixed(2)}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={statusColors[status]}>
          {status?.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 100,
      render: (_, record) => (
        <ActionColumn 
          onView={handleView} 
          record={record}
          extraActions={[
            record.status !== 'paid' && record.status !== 'cancelled' && isManager && {
              label: 'Record Payment',
              onClick: () => handleRecordPayment(record),
              type: 'primary'
            },
            parseFloat(record.balance || 0) > 0 && record.status !== 'cancelled' && isManager && {
              label: 'Mark as Paid',
              onClick: () => handleMarkAsPaid(record)
            },
            record.status === 'draft' && isManager && {
              label: 'Send',
              onClick: () => handleSendInvoice(record.id)
            }
          ].filter(Boolean)}
        />
      ),
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Invoices</h1>

      {/* Statistics Cards */}
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total Revenue"
                value={stats.totalRevenue || 0}
                prefix="₵"
                valueStyle={{ color: '#3f8600' }}
                suffix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Outstanding"
                value={stats.outstandingAmount || 0}
                prefix="₵"
                valueStyle={{ color: '#ff4d4f' }}
                suffix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Paid Invoices"
                value={stats.paidInvoices || 0}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Overdue"
                value={stats.overdueInvoices || 0}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Input.Search
            placeholder="Search invoices..."
            allowClear
            style={{ width: 250 }}
            onSearch={(value) => setFilters({ ...filters, search: value })}
          />
          <Select
            placeholder="Filter by status"
            allowClear
            style={{ width: 150 }}
            onChange={(value) => setFilters({ ...filters, status: value || '' })}
          >
            <Option value="draft">Draft</Option>
            <Option value="sent">Sent</Option>
            <Option value="paid">Paid</Option>
            <Option value="partial">Partial</Option>
            <Option value="overdue">Overdue</Option>
            <Option value="cancelled">Cancelled</Option>
          </Select>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={invoices}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={(newPagination) => setPagination(newPagination)}
        scroll={{ x: 1200 }}
      />

      {/* Invoice Details Drawer */}
      <DetailsDrawer
        open={drawerVisible}
        onClose={handleCloseDrawer}
        title="Invoice Details"
        width={900}
        onPrint={viewingInvoice ? () => handlePrint(viewingInvoice) : null}
        onMarkPaid={
          isManager &&
          viewingInvoice &&
          viewingInvoice.status !== 'paid' &&
          viewingInvoice.status !== 'cancelled'
            ? () => handleMarkAsPaid(viewingInvoice)
            : null
        }
        onCancel={isManager && viewingInvoice && viewingInvoice.status !== 'paid' && viewingInvoice.status !== 'cancelled' ? () => {
          handleCancelInvoice(viewingInvoice.id);
        } : null}
        cancelButtonText="Cancel Invoice"
        deleteConfirmText="Are you sure you want to cancel this invoice?"
        fields={viewingInvoice ? [
          { label: 'Invoice Number', value: viewingInvoice.invoiceNumber },
          { 
            label: 'Status', 
            value: viewingInvoice.status,
            render: (status) => (
              <Tag color={statusColors[status]} style={{ fontSize: 14, padding: '4px 12px' }}>
                {status?.toUpperCase()}
              </Tag>
            )
          },
          { label: 'Customer', value: viewingInvoice.customer?.name },
          { label: 'Company', value: viewingInvoice.customer?.company || '-' },
          { label: 'Email', value: viewingInvoice.customer?.email || '-' },
          { label: 'Phone', value: viewingInvoice.customer?.phone || '-' },
          { label: 'Job Number', value: viewingInvoice.job?.jobNumber },
          { label: 'Job Title', value: viewingInvoice.job?.title },
          { 
            label: 'Invoice Date', 
            value: viewingInvoice.invoiceDate,
            render: (date) => dayjs(date).format('MMMM DD, YYYY')
          },
          { 
            label: 'Due Date', 
            value: viewingInvoice.dueDate,
            render: (date) => dayjs(date).format('MMMM DD, YYYY')
          },
          { label: 'Payment Terms', value: viewingInvoice.paymentTerms },
          {
            label: 'Invoice Items',
            value: viewingInvoice.items,
            render: (items) => {
              if (!items || items.length === 0) return '-';
              return (
                <div style={{ marginTop: 8 }}>
                  {items.map((item, idx) => (
                    <Card key={idx} size="small" style={{ marginBottom: 8 }}>
                      <Row gutter={16}>
                        <Col span={12}>
                          <strong>{item.description || item.category}</strong>
                          {item.paperSize && <div style={{ fontSize: 12, color: '#888' }}>Size: {item.paperSize}</div>}
                        </Col>
                        <Col span={4} style={{ textAlign: 'right' }}>
                          Qty: {item.quantity}
                        </Col>
                        <Col span={4} style={{ textAlign: 'right' }}>
                          ₵{parseFloat(item.unitPrice || 0).toFixed(2)}
                        </Col>
                        <Col span={4} style={{ textAlign: 'right' }}>
                          <strong>₵{parseFloat(item.total || 0).toFixed(2)}</strong>
                        </Col>
                      </Row>
                    </Card>
                  ))}
                </div>
              );
            }
          },
          { 
            label: 'Subtotal', 
            value: viewingInvoice.subtotal,
            render: (val) => `₵${parseFloat(val || 0).toFixed(2)}`
          },
          { 
            label: 'Tax', 
            value: viewingInvoice.taxAmount,
            render: (val) => `₵${parseFloat(val || 0).toFixed(2)} (${viewingInvoice.taxRate || 0}%)`
          },
          { 
            label: 'Discount', 
            value: viewingInvoice.discountAmount,
            render: (val) => {
              if (!val || val == 0) return '-';
              return `₵${parseFloat(val || 0).toFixed(2)} ${viewingInvoice.discountType === 'percentage' ? `(${viewingInvoice.discountValue}%)` : ''}`;
            }
          },
          { 
            label: 'Total Amount', 
            value: viewingInvoice.totalAmount,
            render: (val) => <strong style={{ fontSize: 16, color: '#1890ff' }}>₵{parseFloat(val || 0).toFixed(2)}</strong>
          },
          { 
            label: 'Amount Paid', 
            value: viewingInvoice.amountPaid,
            render: (val) => <span style={{ color: '#52c41a' }}>₵{parseFloat(val || 0).toFixed(2)}</span>
          },
          { 
            label: 'Balance Due', 
            value: viewingInvoice.balance,
            render: (val) => <strong style={{ fontSize: 16, color: val > 0 ? '#ff4d4f' : '#52c41a' }}>₵{parseFloat(val || 0).toFixed(2)}</strong>
          },
          { label: 'Notes', value: viewingInvoice.notes || '-' },
          { label: 'Terms & Conditions', value: viewingInvoice.termsAndConditions || '-' },
          { 
            label: 'Sent Date', 
            value: viewingInvoice.sentDate,
            render: (date) => date ? dayjs(date).format('MMMM DD, YYYY') : '-'
          },
          { 
            label: 'Paid Date', 
            value: viewingInvoice.paidDate,
            render: (date) => date ? dayjs(date).format('MMMM DD, YYYY') : '-'
          },
          { 
            label: 'Created At', 
            value: viewingInvoice.createdAt,
            render: (date) => dayjs(date).format('MMMM DD, YYYY HH:mm')
          },
        ] : []}
      />

      {/* Record Payment Modal */}
      <Modal
        title="Record Payment"
        open={paymentModalVisible}
        onCancel={() => setPaymentModalVisible(false)}
        onOk={() => paymentForm.submit()}
        width={600}
      >
        {viewingInvoice && (
          <>
            <Descriptions column={2} bordered style={{ marginBottom: 24 }}>
              <Descriptions.Item label="Invoice">{viewingInvoice.invoiceNumber}</Descriptions.Item>
              <Descriptions.Item label="Customer">{viewingInvoice.customer?.name}</Descriptions.Item>
              <Descriptions.Item label="Total Amount">₵{parseFloat(viewingInvoice.totalAmount).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="Amount Paid">₵{parseFloat(viewingInvoice.amountPaid || 0).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="Balance Due" span={2}>
                <strong style={{ fontSize: 16, color: '#ff4d4f' }}>
                  ₵{parseFloat(viewingInvoice.balance).toFixed(2)}
                </strong>
              </Descriptions.Item>
            </Descriptions>

            <Form
              form={paymentForm}
              layout="vertical"
              onFinish={handlePaymentSubmit}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="amount"
                    label="Payment Amount"
                    rules={[
                      { required: true, message: 'Please enter payment amount' },
                      {
                        validator: (_, value) => {
                          if (value > parseFloat(viewingInvoice.balance)) {
                            return Promise.reject('Amount exceeds balance due');
                          }
                          return Promise.resolve();
                        }
                      }
                    ]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="0.00"
                      prefix="₵"
                      min={0}
                      max={parseFloat(viewingInvoice.balance)}
                      precision={2}
                      size="large"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="paymentMethod"
                    label="Payment Method"
                    rules={[{ required: true, message: 'Please select payment method' }]}
                  >
                    <Select size="large">
                      <Option value="cash">Cash</Option>
                      <Option value="check">Check</Option>
                      <Option value="credit_card">Credit Card</Option>
                      <Option value="bank_transfer">Bank Transfer</Option>
                      <Option value="momo">Mobile Money</Option>
                      <Option value="other">Other</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="paymentDate"
                    label="Payment Date"
                    rules={[{ required: true, message: 'Please select payment date' }]}
                  >
                    <DatePicker 
                      style={{ width: '100%' }}
                      size="large"
                      format="YYYY-MM-DD"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="referenceNumber" label="Reference Number">
                    <Input placeholder="Transaction ref. number" size="large" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </>
        )}
      </Modal>

      {/* Print Invoice Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span>Print Invoice</span>
            <Space>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownloadInvoice}
              >
                Download
              </Button>
              <Button
                type="primary"
                icon={<PrinterOutlined />}
                onClick={handlePrintInvoice}
                style={{ marginRight: 24 }}
              >
                Print
              </Button>
            </Space>
          </div>
        }
        open={printModalVisible}
        onCancel={() => {
          setPrintModalVisible(false);
          // Don't clear viewingInvoice if drawer is still open
          if (!drawerVisible) {
            setViewingInvoice(null);
          }
        }}
        footer={null}
        width="90%"
        style={{ maxWidth: '1200px' }}
        destroyOnClose
        bodyStyle={{ 
          maxHeight: '70vh', 
          overflowY: 'auto',
          padding: '20px'
        }}
      >
        {viewingInvoice && (
          <PrintableInvoice
            invoice={viewingInvoice}
            onClose={() => {
              setPrintModalVisible(false);
              // Don't clear viewingInvoice if drawer is still open
              if (!drawerVisible) {
                setViewingInvoice(null);
              }
            }}
          />
        )}
      </Modal>
    </div>
  );
};

export default Invoices;







