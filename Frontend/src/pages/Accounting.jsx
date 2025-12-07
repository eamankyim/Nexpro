import { useMemo, useState } from 'react';
import {
  Row,
  Col,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Tabs,
  Descriptions,
  Typography,
  Divider,
  Drawer,
  App
} from 'antd';
import { PlusOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import accountingService from '../services/accountingService';

const { Title, Text } = Typography;

const accountTypeLabels = {
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expense',
  cogs: 'Cost of Goods Sold',
  other: 'Other'
};

const AccountForm = ({ form }) => (
  <>
    <Row gutter={16}>
      <Col span={12}>
        <Form.Item
          name="code"
          label="Account Code"
          rules={[{ required: true, message: 'Account code is required' }]}
        >
          <Input placeholder="1000" />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item
          name="name"
          label="Account Name"
          rules={[{ required: true, message: 'Account name is required' }]}
        >
          <Input placeholder="Cash at Bank" />
        </Form.Item>
      </Col>
    </Row>
    <Row gutter={16}>
      <Col span={12}>
        <Form.Item
          name="type"
          label="Type"
          rules={[{ required: true, message: 'Account type is required' }]}
        >
          <Select placeholder="Select account type">
            {Object.entries(accountTypeLabels).map(([value, label]) => (
              <Select.Option key={value} value={value}>
                {label}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name="category" label="Category">
          <Input placeholder="Current Assets / Operating Expenses" />
        </Form.Item>
      </Col>
    </Row>
    <Form.Item name="description" label="Description">
      <Input.TextArea rows={3} placeholder="Optional description of the account" />
    </Form.Item>
  </>
);

const JournalLineForm = ({ field, remove, accountOptions }) => (
  <Row gutter={16} align="middle" wrap>
    <Col xs={24} md={8}>
      <Form.Item
        {...field}
        name={[field.name, 'accountId']}
        fieldKey={[field.fieldKey, 'accountId']}
        rules={[{ required: true, message: 'Account is required' }]}
      >
        <Select placeholder="Select account" showSearch optionFilterProp="children">
          {accountOptions.map((option) => (
            <Select.Option key={option.value} value={option.value}>
              {option.label}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>
    </Col>
    <Col xs={12} md={4}>
      <Form.Item {...field} name={[field.name, 'debit']} fieldKey={[field.fieldKey, 'debit']}>
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          parser={(value) => value.replace(/[^0-9.]/g, '')}
          prefix="GHS "
        />
      </Form.Item>
    </Col>
    <Col xs={12} md={4}>
      <Form.Item {...field} name={[field.name, 'credit']} fieldKey={[field.fieldKey, 'credit']}>
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          parser={(value) => value.replace(/[^0-9.]/g, '')}
          prefix="GHS "
        />
      </Form.Item>
    </Col>
    <Col xs={24} md={7}>
      <Form.Item {...field} name={[field.name, 'description']} fieldKey={[field.fieldKey, 'description']}>
        <Input placeholder="Line description" />
      </Form.Item>
    </Col>
    <Col xs={24} md={1} style={{ textAlign: 'right' }}>
      <Button danger type="link" style={{ padding: 0 }} onClick={() => remove(field.name)}>
        Remove
      </Button>
    </Col>
  </Row>
);

const Accounting = () => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [journalModalVisible, setJournalModalVisible] = useState(false);
  const [accountForm] = Form.useForm();
  const [journalForm] = Form.useForm();
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountDrawerVisible, setAccountDrawerVisible] = useState(false);
  const [selectedJournalEntry, setSelectedJournalEntry] = useState(null);
  const [journalDrawerVisible, setJournalDrawerVisible] = useState(false);

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountingService.getAccounts()
  });

  const journalQuery = useQuery({
    queryKey: ['journalEntries'],
    queryFn: () => accountingService.getJournalEntries()
  });

  const trialBalanceQuery = useQuery({
    queryKey: ['trialBalance'],
    queryFn: () => accountingService.getTrialBalance()
  });

  const createAccountMutation = useMutation({
    mutationFn: accountingService.createAccount,
    onSuccess: () => {
      message.success('Account created');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setAccountModalVisible(false);
    },
    onError: (error) => {
      message.error(error?.response?.data?.message || 'Failed to create account');
    }
  });

  const createJournalMutation = useMutation({
    mutationFn: accountingService.createJournalEntry,
    onSuccess: () => {
      message.success('Journal entry created');
      queryClient.invalidateQueries({ queryKey: ['journalEntries'] });
      queryClient.invalidateQueries({ queryKey: ['trialBalance'] });
      setJournalModalVisible(false);
    },
    onError: (error) => {
      message.error(error?.response?.data?.message || 'Failed to create journal entry');
    }
  });

  const accounts = accountsQuery.data?.data || [];
  const journalEntries = journalQuery.data?.data || [];
  const trialBalance = trialBalanceQuery.data?.data || [];
  const totals = trialBalanceQuery.data?.summary || { debit: 0, credit: 0 };

  const handleViewAccount = (account) => {
    setSelectedAccount(account);
    setAccountDrawerVisible(true);
  };

  const accountColumns = useMemo(() => [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      width: 120
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (value) => accountTypeLabels[value] || value
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (value) => value || '—'
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (value) => <Tag color={value ? 'green' : 'red'}>{value ? 'Active' : 'Inactive'}</Tag>
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleViewAccount(record);
          }}
        >
          View
        </Button>
      )
    }
  ], []);

  const handleViewJournalEntry = async (id) => {
    try {
      const response = await accountingService.getJournalEntry(id);
      setSelectedJournalEntry(response.data || response);
      setJournalDrawerVisible(true);
    } catch (error) {
      message.error('Failed to load journal entry');
    }
  };

  const journalColumns = useMemo(() => [
    {
      title: 'Date',
      dataIndex: 'entryDate',
      key: 'entryDate',
      render: (value) => dayjs(value).format('MMM DD, YYYY')
    },
    {
      title: 'Reference',
      dataIndex: 'reference',
      key: 'reference'
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (value) => <Tag color={value === 'posted' ? 'green' : 'default'}>{value.toUpperCase()}</Tag>
    },
    {
      title: 'Lines',
      dataIndex: 'lines',
      key: 'lines',
      render: (lines) => (
        <div>
          {lines && lines.length > 0 ? (
            <>
              {lines.slice(0, 2).map((line) => (
                <div key={line.id}>
                  <Text strong>{line.account?.code}</Text> — {line.account?.name}{' '}
                  <Text type="secondary">
                    {line.debit > 0 ? `Debit GHS ${parseFloat(line.debit).toFixed(2)}` : `Credit GHS ${parseFloat(line.credit).toFixed(2)}`}
                  </Text>
                </div>
              ))}
              {lines.length > 2 && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  +{lines.length - 2} more line{lines.length - 2 > 1 ? 's' : ''}
                </Text>
              )}
            </>
          ) : (
            <Text type="secondary">No lines</Text>
          )}
        </div>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleViewJournalEntry(record.id);
          }}
        >
          View
        </Button>
      )
    }
  ], []);

  const trialColumns = useMemo(() => [
    {
      title: 'Account',
      key: 'account',
      render: (_, record) => (
        <div>
          <Text strong>{record.account?.code}</Text> — {record.account?.name}
        </div>
      )
    },
    {
      title: 'Debit',
      dataIndex: 'debit',
      key: 'debit',
      align: 'right',
      render: (value) => (value ? `GHS ${parseFloat(value).toFixed(2)}` : '—')
    },
    {
      title: 'Credit',
      dataIndex: 'credit',
      key: 'credit',
      align: 'right',
      render: (value) => (value ? `GHS ${parseFloat(value).toFixed(2)}` : '—')
    },
    {
      title: 'Balance',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right',
      render: (value) => `GHS ${parseFloat(value || 0).toFixed(2)}`
    }
  ], []);

  const accountOptions = accounts.map((account) => ({
    label: `${account.code} — ${account.name}`,
    value: account.id
  }));

  const handleOpenJournalModal = () => {
    journalForm.resetFields();
    journalForm.setFieldsValue({
      entryDate: dayjs(),
      lines: [
        { debit: 0, credit: 0 },
        { debit: 0, credit: 0 }
      ]
    });
    setJournalModalVisible(true);
  };

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>Accounting</Title>
          <Text type="secondary">Manage your chart of accounts, journal entries, and trial balance.</Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['accounts'] });
              queryClient.invalidateQueries({ queryKey: ['journalEntries'] });
              queryClient.invalidateQueries({ queryKey: ['trialBalance'] });
            }}>
              Refresh
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
              accountForm.resetFields();
              setAccountModalVisible(true);
            }}>
              New Account
            </Button>
            <Button onClick={handleOpenJournalModal} icon={<PlusOutlined />}>
              New Journal Entry
            </Button>
          </Space>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="accounts"
        items={[
          {
            key: 'accounts',
            label: 'Accounts',
            children: (
              <Table
                rowKey="id"
                columns={accountColumns}
                dataSource={accounts}
                loading={accountsQuery.isLoading}
              />
            )
          },
          {
            key: 'journal',
            label: 'Journal',
            children: (
              <Table
                rowKey="id"
                columns={journalColumns}
                dataSource={journalEntries}
                loading={journalQuery.isLoading}
              />
            )
          },
          {
            key: 'trial',
            label: 'Trial Balance',
            children: (
              <>
                <Table
                  rowKey="id"
                  columns={trialColumns}
                  dataSource={trialBalance}
                  loading={trialBalanceQuery.isLoading}
                  pagination={false}
                  summary={() => (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0}><Text strong>Total</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">
                        <Text strong>GHS {parseFloat(totals.debit || 0).toFixed(2)}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right">
                        <Text strong>GHS {parseFloat(totals.credit || 0).toFixed(2)}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} />
                    </Table.Summary.Row>
                  )}
                />
                <Divider />
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label="Total Debit">GHS {parseFloat(totals.debit || 0).toFixed(2)}</Descriptions.Item>
                  <Descriptions.Item label="Total Credit">GHS {parseFloat(totals.credit || 0).toFixed(2)}</Descriptions.Item>
                  <Descriptions.Item label="Balanced?">
                    <Tag color={Math.abs((totals.debit || 0) - (totals.credit || 0)) < 0.01 ? 'green' : 'red'}>
                      {Math.abs((totals.debit || 0) - (totals.credit || 0)) < 0.01 ? 'Yes' : 'No'}
                    </Tag>
                  </Descriptions.Item>
                </Descriptions>
              </>
            )
          }
        ]}
      />

      <Drawer
        title={
          selectedAccount
            ? `${selectedAccount.code} — ${selectedAccount.name}`
            : 'Account'
        }
        open={accountDrawerVisible}
        onClose={() => {
          setAccountDrawerVisible(false);
          setSelectedAccount(null);
        }}
        width={520}
        destroyOnClose
      >
        {selectedAccount ? (
          <Descriptions
            bordered
            column={1}
            size="small"
            styles={{
              label: { width: '40%', flexBasis: '40%' },
              content: { width: '60%', flexBasis: '60%' }
            }}
          >
            <Descriptions.Item label="Code">{selectedAccount.code}</Descriptions.Item>
            <Descriptions.Item label="Name">{selectedAccount.name}</Descriptions.Item>
            <Descriptions.Item label="Type">{accountTypeLabels[selectedAccount.type] || selectedAccount.type}</Descriptions.Item>
            <Descriptions.Item label="Category">{selectedAccount.category || '—'}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={selectedAccount.isActive ? 'green' : 'red'}>
                {selectedAccount.isActive ? 'Active' : 'Inactive'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Description">{selectedAccount.description || '—'}</Descriptions.Item>
            <Descriptions.Item label="Created At">
              {selectedAccount.createdAt ? dayjs(selectedAccount.createdAt).format('MMM DD, YYYY HH:mm') : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Updated At">
              {selectedAccount.updatedAt ? dayjs(selectedAccount.updatedAt).format('MMM DD, YYYY HH:mm') : '—'}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Text type="secondary">Select an account to view details.</Text>
        )}
      </Drawer>

      <Drawer
        title="Journal Entry Details"
        open={journalDrawerVisible}
        onClose={() => {
          setJournalDrawerVisible(false);
          setSelectedJournalEntry(null);
        }}
        width={1000}
        destroyOnClose
      >
        {selectedJournalEntry ? (
          <>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="Reference" span={2}>
                <Text strong>{selectedJournalEntry.reference || '—'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Date">
                {dayjs(selectedJournalEntry.entryDate).format('MMM DD, YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={selectedJournalEntry.status === 'posted' ? 'green' : 'default'}>
                  {selectedJournalEntry.status?.toUpperCase() || 'DRAFT'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Source">
                {selectedJournalEntry.source || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Description" span={2}>
                {selectedJournalEntry.description || '—'}
              </Descriptions.Item>
              {selectedJournalEntry.creator && (
                <Descriptions.Item label="Created By">
                  {selectedJournalEntry.creator?.name || '—'}
                </Descriptions.Item>
              )}
              {selectedJournalEntry.approver && (
                <Descriptions.Item label="Approved By">
                  {selectedJournalEntry.approver?.name || '—'}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Divider orientation="left">
              <Title level={4} style={{ margin: 0 }}>Journal Entry Lines</Title>
            </Divider>

            <Table
              rowKey="id"
              dataSource={selectedJournalEntry.lines || []}
              pagination={false}
              columns={[
                {
                  title: 'Account',
                  key: 'account',
                  width: 300,
                  render: (_, line) => (
                    <div>
                      <Text strong>{line.account?.code || '—'}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {line.account?.name || '—'}
                      </Text>
                    </div>
                  )
                },
                {
                  title: 'Description',
                  dataIndex: 'description',
                  key: 'description',
                  ellipsis: true
                },
                {
                  title: 'Debit',
                  dataIndex: 'debit',
                  key: 'debit',
                  align: 'right',
                  width: 150,
                  render: (value) => (
                    value > 0 ? (
                      <Text strong style={{ color: '#52c41a' }}>
                        GHS {parseFloat(value || 0).toFixed(2)}
                      </Text>
                    ) : (
                      <Text type="secondary">GHS 0.00</Text>
                    )
                  )
                },
                {
                  title: 'Credit',
                  dataIndex: 'credit',
                  key: 'credit',
                  align: 'right',
                  width: 150,
                  render: (value) => (
                    value > 0 ? (
                      <Text strong style={{ color: '#ff4d4f' }}>
                        GHS {parseFloat(value || 0).toFixed(2)}
                      </Text>
                    ) : (
                      <Text type="secondary">GHS 0.00</Text>
                    )
                  )
                }
              ]}
              summary={(pageData) => {
                const totalDebit = pageData.reduce((sum, line) => sum + parseFloat(line.debit || 0), 0);
                const totalCredit = pageData.reduce((sum, line) => sum + parseFloat(line.credit || 0), 0);
                
                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={2}>
                        <Text strong>Total</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right">
                        <Text strong style={{ color: '#52c41a' }}>
                          GHS {totalDebit.toFixed(2)}
                        </Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right">
                        <Text strong style={{ color: '#ff4d4f' }}>
                          GHS {totalCredit.toFixed(2)}
                        </Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                );
              }}
            />
          </>
        ) : (
          <Text type="secondary">Select a journal entry to view details.</Text>
        )}
      </Drawer>

      <Modal
        title="New Account"
        open={accountModalVisible}
        onCancel={() => setAccountModalVisible(false)}
        onOk={() => accountForm.submit()}
        confirmLoading={createAccountMutation.isLoading}
        width={600}
      >
        <Form layout="vertical" form={accountForm} onFinish={(values) => createAccountMutation.mutate(values)}>
          <AccountForm form={accountForm} />
        </Form>
      </Modal>

      <Modal
        title="New Journal Entry"
        open={journalModalVisible}
        onCancel={() => setJournalModalVisible(false)}
        onOk={() => journalForm.submit()}
        confirmLoading={createJournalMutation.isLoading}
        width={860}
      >
        <Form
          layout="vertical"
          form={journalForm}
          onFinish={(values) => {
            const payload = {
              reference: values.reference,
              description: values.description,
              entryDate: values.entryDate ? values.entryDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
              status: 'posted',
              lines: values.lines.map((line) => ({
                accountId: line.accountId,
                description: line.description,
                debit: parseFloat(line.debit || 0),
                credit: parseFloat(line.credit || 0)
              }))
            };
            createJournalMutation.mutate(payload);
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="reference" label="Reference">
                <Input placeholder="AUTOMATIC" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="entryDate" label="Date" initialValue={dayjs()}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Narration" />
          </Form.Item>

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%' }}>
                {fields.map((field) => (
                  <JournalLineForm key={field.key} field={field} remove={remove} accountOptions={accountOptions} />
                ))}
                <Button
                  type="dashed"
                  onClick={() => add({ debit: 0, credit: 0 })}
                  block
                  icon={<PlusOutlined />}
                >
                  Add Line
                </Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
};

export default Accounting;

