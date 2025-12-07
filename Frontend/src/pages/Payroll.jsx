import { useState, useMemo } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Drawer,
  Form,
  DatePicker,
  Select,
  Descriptions,
  Typography,
  Divider,
  App
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import payrollService from '../services/payrollService';
import employeeService from '../services/employeeService';

const { Title, Text } = Typography;
const { Option } = Select;

const Payroll = () => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [runModalVisible, setRunModalVisible] = useState(false);
  const [viewingRun, setViewingRun] = useState(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [form] = Form.useForm();

  const runsQuery = useQuery({
    queryKey: ['payrollRuns'],
    queryFn: () => payrollService.getRuns()
  });

  const employeesQuery = useQuery({
    queryKey: ['employees', 'payroll'],
    queryFn: () => employeeService.getEmployees({ status: 'active', limit: 1000 })
  });

  const createRunMutation = useMutation({
    mutationFn: payrollService.createRun,
    onSuccess: () => {
      message.success('Payroll run created');
      queryClient.invalidateQueries({ queryKey: ['payrollRuns'] });
      setRunModalVisible(false);
    },
    onError: (error) => {
      message.error(error?.response?.data?.message || 'Failed to create payroll run');
    }
  });

  const postRunMutation = useMutation({
    mutationFn: (id) => payrollService.postRun(id),
    onSuccess: (response) => {
      const run = response.data || response;
      message.success('Payroll run posted');
      queryClient.invalidateQueries({ queryKey: ['payrollRuns'] });
      setViewingRun(run);
    },
    onError: (error) => {
      message.error(error?.response?.data?.message || 'Failed to post payroll run');
    }
  });

  const runs = runsQuery.data?.data || [];
  const employees = employeesQuery.data?.data || [];

  const columns = useMemo(() => [
    {
      title: 'Period',
      key: 'period',
      render: (_, record) => `${dayjs(record.periodStart).format('MMM DD')} - ${dayjs(record.periodEnd).format('MMM DD, YYYY')}`
    },
    {
      title: 'Pay Date',
      dataIndex: 'payDate',
      key: 'payDate',
      render: (value) => dayjs(value).format('MMM DD, YYYY')
    },
    {
      title: 'Employees',
      dataIndex: 'totalEmployees',
      key: 'totalEmployees'
    },
    {
      title: 'Gross',
      dataIndex: 'totalGross',
      key: 'totalGross',
      render: (value) => `GHS ${parseFloat(value || 0).toFixed(2)}`
    },
    {
      title: 'Net',
      dataIndex: 'totalNet',
      key: 'totalNet',
      render: (value) => `GHS ${parseFloat(value || 0).toFixed(2)}`
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'approved' || status === 'paid' ? 'green' : status === 'processing' ? 'orange' : 'blue'}>
          {status.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => handleViewRun(record.id)}>
            View
          </Button>
          {record.status !== 'approved' && record.status !== 'paid' && (
            <Button type="link" onClick={() => handlePostRun(record.id)} loading={postRunMutation.isLoading}>
              Post
            </Button>
          )}
        </Space>
      )
    }
  ], [postRunMutation.isLoading]);

  const handleOpenRunModal = () => {
    form.resetFields();
    form.setFieldsValue({
      periodStart: dayjs().startOf('month'),
      periodEnd: dayjs().endOf('month'),
      payDate: dayjs().endOf('month'),
      employeeIds: employees.map((emp) => emp.id)
    });
    setRunModalVisible(true);
  };

  const handleViewRun = async (id) => {
    try {
      const response = await payrollService.getRun(id);
      setViewingRun(response.data || response);
      setViewModalVisible(true);
    } catch (error) {
      message.error('Failed to load payroll run');
    }
  };

  const handlePostRun = (id) => {
    postRunMutation.mutate(id);
  };

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>Payroll</Title>
          <Text type="secondary">Generate payroll runs, review summaries, and post to the ledger.</Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['payrollRuns'] })}>
              Refresh
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenRunModal}>
              Generate Payroll Run
            </Button>
          </Space>
        </Col>
      </Row>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={runs}
        loading={runsQuery.isLoading}
      />

      <Modal
        title="Generate Payroll Run"
        open={runModalVisible}
        onCancel={() => setRunModalVisible(false)}
        onOk={() => form.submit()}
        confirmLoading={createRunMutation.isLoading}
        width={600}
      >
        <Form
          layout="vertical"
          form={form}
          onFinish={(values) => {
            const payload = {
              periodStart: values.periodStart.format('YYYY-MM-DD'),
              periodEnd: values.periodEnd.format('YYYY-MM-DD'),
              payDate: values.payDate.format('YYYY-MM-DD'),
              employeeIds: values.employeeIds
            };
            createRunMutation.mutate(payload);
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="periodStart"
                label="Period Start"
                rules={[{ required: true, message: 'Period start is required' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="periodEnd"
                label="Period End"
                rules={[{ required: true, message: 'Period end is required' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="payDate"
            label="Pay Date"
            rules={[{ required: true, message: 'Pay date is required' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="employeeIds"
            label="Employees"
            rules={[{ required: true, message: 'Select at least one employee' }]}
          >
            <Select
              mode="multiple"
              placeholder="Select employees"
              options={employees.map((emp) => ({
                label: `${emp.firstName} ${emp.lastName} — ${emp.jobTitle || '—'}`,
                value: emp.id
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="Payroll Run Details"
        open={viewModalVisible}
        onClose={() => setViewModalVisible(false)}
        width={1200}
        extra={
          viewingRun && viewingRun.status !== 'approved' && viewingRun.status !== 'paid' ? (
            <Button
              type="primary"
              loading={postRunMutation.isLoading}
              onClick={() => handlePostRun(viewingRun.id)}
            >
              Post Payroll Run
            </Button>
          ) : null
        }
      >
        {viewingRun ? (
          <>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="Period" span={2}>
                {dayjs(viewingRun.periodStart).format('MMM DD, YYYY')} - {dayjs(viewingRun.periodEnd).format('MMM DD, YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Pay Date">{dayjs(viewingRun.payDate).format('MMM DD, YYYY')}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={viewingRun.status === 'approved' || viewingRun.status === 'paid' ? 'green' : viewingRun.status === 'processing' ? 'orange' : 'blue'}>
                  {viewingRun.status.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Total Employees">{viewingRun.totalEmployees}</Descriptions.Item>
              <Descriptions.Item label="Total Gross">
                <Text strong style={{ fontSize: 16 }}>GHS {parseFloat(viewingRun.totalGross || 0).toFixed(2)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Total Tax">
                <Text>GHS {parseFloat(viewingRun.totalTax || 0).toFixed(2)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Total Net">
                <Text strong style={{ fontSize: 16, color: '#52c41a' }}>GHS {parseFloat(viewingRun.totalNet || 0).toFixed(2)}</Text>
              </Descriptions.Item>
              {viewingRun.notes && (
                <Descriptions.Item label="Notes" span={2}>
                  {viewingRun.notes}
                </Descriptions.Item>
              )}
            </Descriptions>
            
            <Divider orientation="left">
              <Title level={4} style={{ margin: 0 }}>Employee Payroll Entries</Title>
            </Divider>
            
            <Table
              rowKey="id"
              dataSource={viewingRun.entries || []}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} employees`
              }}
              scroll={{ x: 'max-content' }}
              columns={[
                {
                  title: 'Employee',
                  key: 'employee',
                  fixed: 'left',
                  width: 200,
                  render: (_, entry) => (
                    <div>
                      <Text strong>{entry.employee?.firstName} {entry.employee?.lastName}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {entry.employee?.jobTitle || '—'} • {entry.employee?.department || '—'}
                      </Text>
                    </div>
                  )
                },
                {
                  title: 'Gross Pay',
                  dataIndex: 'grossPay',
                  key: 'gross',
                  align: 'right',
                  width: 120,
                  render: (value) => <Text strong>GHS {parseFloat(value || 0).toFixed(2)}</Text>
                },
                {
                  title: 'Allowances',
                  key: 'allowances',
                  align: 'right',
                  width: 150,
                  render: (_, entry) => {
                    const totalAllowances = (entry.allowances || []).reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
                    return totalAllowances > 0 ? (
                      <Text type="success">+ GHS {totalAllowances.toFixed(2)}</Text>
                    ) : (
                      <Text type="secondary">GHS 0.00</Text>
                    );
                  }
                },
                {
                  title: 'Deductions',
                  key: 'deductions',
                  align: 'right',
                  width: 150,
                  render: (_, entry) => {
                    const totalDeductions = (entry.deductions || []).reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
                    return totalDeductions > 0 ? (
                      <Text type="danger">- GHS {totalDeductions.toFixed(2)}</Text>
                    ) : (
                      <Text type="secondary">GHS 0.00</Text>
                    );
                  }
                },
                {
                  title: 'Taxes',
                  key: 'taxes',
                  align: 'right',
                  width: 150,
                  render: (_, entry) => {
                    const totalTaxes = (entry.taxes || []).reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
                    return totalTaxes > 0 ? (
                      <Text type="warning">GHS {totalTaxes.toFixed(2)}</Text>
                    ) : (
                      <Text type="secondary">GHS 0.00</Text>
                    );
                  }
                },
                {
                  title: 'Net Pay',
                  dataIndex: 'netPay',
                  key: 'net',
                  align: 'right',
                  width: 120,
                  fixed: 'right',
                  render: (value) => (
                    <Text strong style={{ fontSize: 14, color: '#52c41a' }}>
                      GHS {parseFloat(value || 0).toFixed(2)}
                    </Text>
                  )
                }
              ]}
              summary={(pageData) => {
                const totalGross = pageData.reduce((sum, entry) => sum + parseFloat(entry.grossPay || 0), 0);
                const totalNet = pageData.reduce((sum, entry) => sum + parseFloat(entry.netPay || 0), 0);
                const totalTaxes = pageData.reduce((sum, entry) => {
                  return sum + (entry.taxes || []).reduce((taxSum, t) => taxSum + parseFloat(t.amount || 0), 0);
                }, 0);
                
                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={1}>
                        <Text strong>Total ({pageData.length} employees)</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">
                        <Text strong>GHS {totalGross.toFixed(2)}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right">
                        <Text type="secondary">—</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right">
                        <Text type="secondary">—</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={4} align="right">
                        <Text strong type="warning">GHS {totalTaxes.toFixed(2)}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={5} align="right">
                        <Text strong style={{ fontSize: 16, color: '#52c41a' }}>
                          GHS {totalNet.toFixed(2)}
                        </Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                );
              }}
            />
          </>
        ) : (
          <Text type="secondary">Select a payroll run to view details.</Text>
        )}
      </Drawer>
    </div>
  );
};

export default Payroll;





