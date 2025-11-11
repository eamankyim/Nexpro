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
  Form,
  DatePicker,
  Select,
  message,
  Descriptions,
  Typography,
  Divider
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import payrollService from '../services/payrollService';
import employeeService from '../services/employeeService';

const { Title, Text } = Typography;
const { Option } = Select;

const Payroll = () => {
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
      render: (value) => `₵${parseFloat(value || 0).toFixed(2)}`
    },
    {
      title: 'Net',
      dataIndex: 'totalNet',
      key: 'totalNet',
      render: (value) => `₵${parseFloat(value || 0).toFixed(2)}`
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'posted' ? 'green' : 'blue'}>
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
          {record.status !== 'posted' && (
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

      <Modal
        title="Payroll Run"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        width={800}
        footer={null}
      >
        {viewingRun ? (
          <>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Period">
                {dayjs(viewingRun.periodStart).format('MMM DD')} - {dayjs(viewingRun.periodEnd).format('MMM DD, YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Pay Date">{dayjs(viewingRun.payDate).format('MMM DD, YYYY')}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={viewingRun.status === 'posted' ? 'green' : 'blue'}>{viewingRun.status.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Employees">{viewingRun.totalEmployees}</Descriptions.Item>
              <Descriptions.Item label="Total Gross">₵{parseFloat(viewingRun.totalGross || 0).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="Total Net">₵{parseFloat(viewingRun.totalNet || 0).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="Total Tax">₵{parseFloat(viewingRun.totalTax || 0).toFixed(2)}</Descriptions.Item>
            </Descriptions>
            <Divider />
            <Table
              rowKey="id"
              dataSource={viewingRun.entries || []}
              pagination={false}
              columns={[
                {
                  title: 'Employee',
                  key: 'employee',
                  render: (_, entry) => `${entry.employee?.firstName} ${entry.employee?.lastName}`
                },
                {
                  title: 'Gross',
                  dataIndex: 'grossPay',
                  key: 'gross',
                  render: (value) => `₵${parseFloat(value || 0).toFixed(2)}`
                },
                {
                  title: 'Net Pay',
                  dataIndex: 'netPay',
                  key: 'net',
                  render: (value) => `₵${parseFloat(value || 0).toFixed(2)}`
                },
                {
                  title: 'PAYE',
                  key: 'paye',
                  render: (_, entry) =>
                    `₵${parseFloat(entry.taxes.find((t) => t.type === 'income_tax')?.amount || 0).toFixed(2)}`
                },
                {
                  title: 'SSNIT (Emp.)',
                  key: 'ssnit',
                  render: (_, entry) =>
                    `₵${parseFloat(entry.taxes.find((t) => t.type === 'ssnit_employee')?.amount || 0).toFixed(2)}`
                }
              ]}
            />
            {viewingRun.status !== 'posted' && (
              <Button
                type="primary"
                style={{ marginTop: 16 }}
                loading={postRunMutation.isLoading}
                onClick={() => handlePostRun(viewingRun.id)}
              >
                Post Payroll Run
              </Button>
            )}
          </>
        ) : (
          <Text type="secondary">Select a payroll run to view details.</Text>
        )}
      </Modal>
    </div>
  );
};

export default Payroll;



