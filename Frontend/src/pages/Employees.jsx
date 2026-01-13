import { useEffect, useMemo, useState } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Table,
  Tag,
  Input,
  Select,
  Space,
  Modal,
  Form,
  DatePicker,
  InputNumber,
  message,
  Descriptions,
  Divider,
  Upload,
  Tabs,
  Typography,
  Popconfirm,
  Timeline,
  Badge,
  Drawer,
  Steps,
  Image,
  Spin
} from 'antd';
import PhoneNumberInput from '../components/PhoneNumberInput';
import {
  PlusOutlined,
  TeamOutlined,
  FileAddOutlined,
  DeleteOutlined,
  UploadOutlined,
  ApartmentOutlined,
  DollarCircleOutlined,
  HistoryOutlined,
  MailOutlined,
  PhoneOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import employeeService from '../services/employeeService';
import customDropdownService from '../services/customDropdownService';
import { API_BASE_URL } from '../services/api';
import ActionColumn from '../components/ActionColumn';

const { Title, Text } = Typography;
const { Option } = Select;

const resolveFileUrl = (path = '') => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  if (path.startsWith('/')) {
    return `${API_BASE_URL}${path}`;
  }
  return `${API_BASE_URL}/${path}`;
};

const statusColors = {
  active: 'green',
  on_leave: 'gold',
  terminated: 'red',
  probation: 'blue'
};

const employmentTypes = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Intern' },
  { value: 'temporary', label: 'Temporary' },
  { value: 'national_service', label: 'National Service' }
];

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'probation', label: 'Probation' },
  { value: 'terminated', label: 'Terminated' }
];

const ghanaBanks = [
  'Absa Bank Ghana',
  'Access Bank Ghana',
  'Agricultural Development Bank (ADB)',
  'CalBank',
  'Ecobank Ghana',
  'Fidelity Bank Ghana',
  'GCB Bank',
  'Guarantee Trust Bank (GTBank)',
  'National Investment Bank (NIB)',
  'Prudential Bank',
  'Stanbic Bank Ghana',
  'Standard Chartered Bank Ghana',
  'Societe Generale Ghana',
  'United Bank for Africa (UBA)',
  'Zenith Bank Ghana',
  'Mobile Money',
  'Other'
];

const relationshipOptions = [
  'Spouse',
  'Parent',
  'Father',
  'Mother',
  'Son',
  'Daughter',
  'Brother',
  'Sister',
  'Sibling',
  'Child',
  'Grandparent',
  'Uncle',
  'Aunt',
  'Cousin',
  'Friend',
  'Partner',
  'Guardian',
  'Other'
];

const EmployeeForm = ({ currentStep, form }) => {
  const [customRelationships, setCustomRelationships] = useState([]);
  const [showRelationshipOtherInputs, setShowRelationshipOtherInputs] = useState({});
  const [relationshipOtherValues, setRelationshipOtherValues] = useState({});
  const [customBanks, setCustomBanks] = useState([]);
  const [showBankOtherInput, setShowBankOtherInput] = useState(false);

  // Load custom relationships and banks on mount
  useEffect(() => {
    const loadCustomOptions = async () => {
      try {
        const [relationships, banks] = await Promise.all([
          customDropdownService.getCustomOptions('employee_relationship'),
          customDropdownService.getCustomOptions('employee_bank')
        ]);
        setCustomRelationships(relationships || []);
        setCustomBanks(banks || []);
      } catch (error) {
        console.error('Failed to load custom options:', error);
      }
    };
    loadCustomOptions();
  }, []);

  // Handle relationship change (including "Other")
  const handleRelationshipChange = (value, fieldPath) => {
    if (value === '__OTHER__') {
      setShowRelationshipOtherInputs(prev => ({ ...prev, [fieldPath]: true }));
    } else {
      setShowRelationshipOtherInputs(prev => {
        const newState = { ...prev };
        delete newState[fieldPath];
        return newState;
      });
    }
  };

  // Save custom relationship
  const handleSaveCustomRelationship = async (customValue, fieldPath) => {
    if (!customValue || !customValue.trim()) {
      message.warning('Please enter a relationship name');
      return;
    }

    try {
      const saved = await customDropdownService.saveCustomOption('employee_relationship', customValue.trim());
      if (saved) {
        // Add to custom relationships
        setCustomRelationships(prev => {
          if (prev.find(r => r.value === saved.value)) {
            return prev;
          }
          return [...prev, saved];
        });
        
        // Set the value in the form
        form.setFieldValue(fieldPath, saved.value);
        
        // Clear the "Other" input
        setShowRelationshipOtherInputs(prev => {
          const newState = { ...prev };
          delete newState[fieldPath];
          return newState;
        });
        setRelationshipOtherValues(prev => {
          const newState = { ...prev };
          delete newState[fieldPath];
          return newState;
        });
        
        message.success(`"${saved.label}" added to relationships`);
      }
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to save custom relationship');
    }
  };

  // Get merged relationship options
  const getMergedRelationshipOptions = () => {
    const merged = [...relationshipOptions];
    customRelationships.forEach(rel => {
      if (!merged.includes(rel.value)) {
        merged.push(rel.value);
      }
    });
    return merged;
  };

  // Get merged bank options
  const getMergedBankOptions = () => {
    const merged = [...ghanaBanks.filter(b => b !== 'Other')];
    customBanks.forEach(bank => {
      if (!merged.includes(bank.value)) {
        merged.push(bank.value);
      }
    });
    return merged;
  };

  // Handle bank change (including "Other")
  const handleBankChange = (value) => {
    if (value === '__OTHER__') {
      setShowBankOtherInput(true);
    } else {
      setShowBankOtherInput(false);
    }
  };

  // Save custom bank
  const handleSaveCustomBank = async (customValue) => {
    if (!customValue || !customValue.trim()) {
      message.warning('Please enter a bank name');
      return;
    }

    try {
      const saved = await customDropdownService.saveCustomOption('employee_bank', customValue.trim());
      if (saved) {
        // Add to custom banks
        setCustomBanks(prev => {
          if (prev.find(b => b.value === saved.value)) {
            return prev;
          }
          return [...prev, saved];
        });
        
        // Set the value in the form
        form.setFieldValue('bankName', saved.value);
        
        // Clear the "Other" input
        setShowBankOtherInput(false);
        form.setFieldValue('customBankName', undefined);
        
        message.success(`"${saved.label}" added to banks`);
      }
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to save custom bank');
    }
  };

  return (
    <>
    {currentStep === 0 && (
      <>
        <Row gutter={16}>
      <Col span={12}>
        <Form.Item
          name="firstName"
          label="First Name"
          rules={[{ required: true, message: 'First name is required' }]}
        >
          <Input placeholder="First Name" />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item
          name="lastName"
          label="Last Name"
          rules={[{ required: true, message: 'Last name is required' }]}
        >
          <Input placeholder="Last Name" />
        </Form.Item>
      </Col>
    </Row>
    <Row gutter={16}>
      <Col span={12}>
        <Form.Item name="preferredName" label="Preferred Name">
          <Input placeholder="Preferred Name" />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item
          name="email"
          label="Email"
          rules={[{ type: 'email', message: 'Enter a valid email' }]}
        >
          <Input placeholder="email@company.com" />
        </Form.Item>
      </Col>
    </Row>
    <Row gutter={16}>
      <Col span={12}>
        <Form.Item name="phone" label="Phone">
          <PhoneNumberInput placeholder="Enter phone number" />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name="department" label="Department">
          <Input placeholder="Department" />
        </Form.Item>
      </Col>
    </Row>
    <Row gutter={16}>
      <Col span={12}>
        <Form.Item name="jobTitle" label="Job Title">
          <Input placeholder="Job Title" />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name="employmentType" label="Employment Type" initialValue="full_time">
          <Select placeholder="Select type">
            {employmentTypes.map((type) => (
              <Option key={type.value} value={type.value}>
                {type.label}
              </Option>
            ))}
          </Select>
        </Form.Item>
      </Col>
    </Row>
    <Row gutter={16}>
      <Col span={12}>
        <Form.Item name="status" label="Status" initialValue="active">
          <Select placeholder="Select status">
            {statusOptions.map((option) => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name="hireDate" label="Hire Date">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Col>
    </Row>
    <Divider orientation="left">Compensation</Divider>
    <Row gutter={16}>
      <Col span={12}>
        <Form.Item name="salaryType" label="Salary Type" initialValue="salary">
          <Select>
            <Option value="salary">Salary</Option>
            <Option value="hourly">Hourly</Option>
            <Option value="commission">Commission</Option>
          </Select>
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item
          name="salaryAmount"
          label="Base Amount"
          initialValue={0}
          rules={[{ required: true, message: 'Enter a base amount' }]}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            formatter={(value) => `GHS ${value}`}
            parser={(value) => value.replace(/[GHS \s,]/g, '')}
          />
        </Form.Item>
      </Col>
    </Row>
    <Row gutter={16}>
      <Col span={12}>
        <Form.Item name="payFrequency" label="Pay Frequency" initialValue="monthly">
          <Select>
            <Option value="monthly">Monthly</Option>
            <Option value="biweekly">Biweekly</Option>
            <Option value="weekly">Weekly</Option>
            <Option value="daily">Daily</Option>
          </Select>
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name="bankName" label="Bank / Wallet" >
          <Select 
            placeholder="Select bank or mobile money" 
            showSearch
            onChange={handleBankChange}
          >
            {getMergedBankOptions().map((bank) => (
              <Option key={bank} value={bank}>{bank}</Option>
            ))}
            <Option value="__OTHER__">Other (specify)</Option>
          </Select>
        </Form.Item>
      </Col>
    </Row>
    <Row gutter={16}>
      <Col span={12}>
        {showBankOtherInput && (
          <Form.Item
            label="Enter Bank Name"
            style={{ marginTop: 8 }}
          >
            <Input.Group compact>
              <Input
                style={{ width: 'calc(100% - 80px)' }}
                placeholder="e.g., New Bank, Credit Union"
                value={form.getFieldValue('customBankName') || ''}
                onChange={(e) => form.setFieldValue('customBankName', e.target.value)}
                onPressEnter={() => handleSaveCustomBank(form.getFieldValue('customBankName'))}
              />
              <Button
                type="primary"
                style={{ width: 80 }}
                onClick={() => handleSaveCustomBank(form.getFieldValue('customBankName'))}
              >
                Save
              </Button>
            </Input.Group>
          </Form.Item>
        )}
      </Col>
      <Col span={12}>
        <Form.Item name="bankAccountName" label="Account Name">
          <Input placeholder="Account Name" />
        </Form.Item>
      </Col>
    </Row>
    <Row gutter={16}>
      <Col span={12}>
        <Form.Item name="bankAccountNumber" label="Account / Momo Number">
          <Input placeholder="Account or Mobile Money Number" />
        </Form.Item>
      </Col>
    </Row>
      </>
    )}

    {currentStep === 1 && (
      <>
    <Divider orientation="left">Emergency Contact</Divider>
    <Row gutter={16}>
      <Col span={12}>
        <Form.Item name={['emergencyContact', 'name']} label="Contact Name">
          <Input placeholder="Full Name" />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name={['emergencyContact', 'relationship']} label="Relationship">
          <Select 
            placeholder="Select relationship" 
            showSearch
            onChange={(value) => handleRelationshipChange(value, 'emergencyContact.relationship')}
          >
            {getMergedRelationshipOptions().map((rel) => (
              <Option key={rel} value={rel}>{rel}</Option>
            ))}
            <Option value="__OTHER__">Other (specify)</Option>
          </Select>
        </Form.Item>
        {showRelationshipOtherInputs['emergencyContact.relationship'] && (
          <Form.Item
            label="Enter Relationship"
            style={{ marginTop: 8 }}
          >
            <Input.Group compact>
              <Input
                style={{ width: 'calc(100% - 80px)' }}
                placeholder="e.g., Step-sister, In-law"
                value={relationshipOtherValues['emergencyContact.relationship'] || ''}
                onChange={(e) => setRelationshipOtherValues(prev => ({ ...prev, 'emergencyContact.relationship': e.target.value }))}
                onPressEnter={() => handleSaveCustomRelationship(relationshipOtherValues['emergencyContact.relationship'], 'emergencyContact.relationship')}
              />
              <Button
                type="primary"
                style={{ width: 80 }}
                onClick={() => handleSaveCustomRelationship(relationshipOtherValues['emergencyContact.relationship'], 'emergencyContact.relationship')}
              >
                Save
              </Button>
            </Input.Group>
          </Form.Item>
        )}
      </Col>
    </Row>
    <Row gutter={16}>
      <Col span={12}>
        <Form.Item name={['emergencyContact', 'phone']} label="Phone">
          <PhoneNumberInput placeholder="Enter contact phone" />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name={['emergencyContact', 'email']} label="Email">
          <Input placeholder="Contact Email" />
        </Form.Item>
      </Col>
    </Row>

    <Divider orientation="left">Next of Kin</Divider>
    <Row gutter={16}>
      <Col span={12}>
        <Form.Item name={['nextOfKin', 'name']} label="Name">
          <Input placeholder="Full Name" />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name={['nextOfKin', 'relationship']} label="Relationship">
          <Select 
            placeholder="Select relationship" 
            showSearch
            onChange={(value) => handleRelationshipChange(value, 'nextOfKin.relationship')}
          >
            {getMergedRelationshipOptions().map((rel) => (
              <Option key={rel} value={rel}>{rel}</Option>
            ))}
            <Option value="__OTHER__">Other (specify)</Option>
          </Select>
        </Form.Item>
        {showRelationshipOtherInputs['nextOfKin.relationship'] && (
          <Form.Item
            label="Enter Relationship"
            style={{ marginTop: 8 }}
          >
            <Input.Group compact>
              <Input
                style={{ width: 'calc(100% - 80px)' }}
                placeholder="e.g., Step-sister, In-law"
                value={relationshipOtherValues['nextOfKin.relationship'] || ''}
                onChange={(e) => setRelationshipOtherValues(prev => ({ ...prev, 'nextOfKin.relationship': e.target.value }))}
                onPressEnter={() => handleSaveCustomRelationship(relationshipOtherValues['nextOfKin.relationship'], 'nextOfKin.relationship')}
              />
              <Button
                type="primary"
                style={{ width: 80 }}
                onClick={() => handleSaveCustomRelationship(relationshipOtherValues['nextOfKin.relationship'], 'nextOfKin.relationship')}
              >
                Save
              </Button>
            </Input.Group>
          </Form.Item>
        )}
      </Col>
    </Row>
    <Row gutter={16}>
      <Col span={12}>
        <Form.Item name={['nextOfKin', 'phone']} label="Phone">
          <PhoneNumberInput placeholder="Enter phone number" />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name={['nextOfKin', 'email']} label="Email">
          <Input placeholder="Email" />
        </Form.Item>
      </Col>
    </Row>
    <Form.Item name="notes" label="Notes">
      <Input.TextArea rows={3} placeholder="Internal notes" />
    </Form.Item>
      </>
    )}
  </>
  );
};

const Employees = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    employmentType: 'all'
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10
  });
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [formStep, setFormStep] = useState(0);
  const [form] = Form.useForm();
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [documentUploading, setDocumentUploading] = useState(false);
  const [documentPreview, setDocumentPreview] = useState(null);
  const [documentPreviewVisible, setDocumentPreviewVisible] = useState(false);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState(null);
  const [documentPreviewLoading, setDocumentPreviewLoading] = useState(false);
  const [documentPreviewMimeType, setDocumentPreviewMimeType] = useState(null);

  const formSteps = [
    { key: 'basic', title: 'Employment Details' },
    { key: 'emergency', title: 'Emergency & Next of Kin' }
  ];

  const defaultFormValues = {
    employmentType: 'full_time',
    status: 'active',
    salaryType: 'salary',
    payFrequency: 'monthly'
  };

  const employeeQuery = useQuery({
    queryKey: ['employees', pagination.current, pagination.pageSize, filters],
    queryFn: () =>
      employeeService.getEmployees({
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters
      })
  });

  const resetFormState = () => {
    setFormStep(0);
    form.resetFields();
    form.setFieldsValue(defaultFormValues);
    setEditingEmployee(null);
  };

  const fetchEmployeeDetails = async (id) => {
    setDrawerLoading(true);
    try {
      const response = await employeeService.getEmployee(id);
      setViewingEmployee(response.data || response);
    } catch (error) {
      message.error('Failed to load employee details');
    } finally {
      setDrawerLoading(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: employeeService.createEmployee,
    onSuccess: () => {
      message.success('Employee created');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setModalVisible(false);
      resetFormState();
    },
    onError: (error) => {
      message.error(error?.response?.data?.message || 'Failed to create employee');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => employeeService.updateEmployee(id, payload),
    onSuccess: (_, variables) => {
      message.success('Employee updated');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      if (viewingEmployee?.id === variables.id) {
        fetchEmployeeDetails(variables.id);
      }
      setModalVisible(false);
      resetFormState();
    },
    onError: (error) => {
      message.error(error?.response?.data?.message || 'Failed to update employee');
    }
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, payload }) => employeeService.archiveEmployee(id, payload),
    onSuccess: (_, variables) => {
      message.success('Employee archived');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      if (viewingEmployee?.id === variables.id) {
        setDrawerVisible(false);
      }
    },
    onError: (error) => {
      message.error(error?.response?.data?.message || 'Failed to archive employee');
    }
  });

  const handleOpenCreate = () => {
    resetFormState();
    setModalVisible(true);
  };

  const handleOpenEdit = (record) => {
    setFormStep(0);
    form.resetFields();
    setEditingEmployee(record);
    form.setFieldsValue({
      ...record,
      hireDate: record.hireDate ? dayjs(record.hireDate) : null,
      endDate: record.endDate ? dayjs(record.endDate) : null
    });
    setModalVisible(true);
  };

  const handleSubmit = (values) => {
    const payload = {
      ...values,
      hireDate: values.hireDate ? values.hireDate.format('YYYY-MM-DD') : null,
      endDate: values.endDate ? values.endDate.format('YYYY-MM-DD') : null,
      emergencyContact: values.emergencyContact || {},
      nextOfKin: values.nextOfKin || {}
    };

    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleView = async (record) => {
    // Set viewing employee immediately with data from table row
    setViewingEmployee(record);
    // Open drawer immediately
    setDrawerVisible(true);
    // Load full details asynchronously
    setDrawerLoading(true);
    try {
      await fetchEmployeeDetails(record.id);
    } catch (error) {
      // Error handling is already in fetchEmployeeDetails
    }
    // Note: drawerLoading is set to false in fetchEmployeeDetails finally block
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    resetFormState();
  };

  const handleNextStep = async () => {
    try {
      await form.validateFields();
      setFormStep((prev) => Math.min(prev + 1, formSteps.length - 1));
    } catch (error) {
      // Validation errors are handled by the form
    }
  };

  const handlePrevStep = () => {
    setFormStep((prev) => Math.max(prev - 1, 0));
  };

  const handleUploadDocument = async ({ file }) => {
    if (!viewingEmployee) return;
    setDocumentUploading(true);
    try {
      const response = await employeeService.uploadDocument(viewingEmployee.id, file);
      const newDoc = response.data || response;
      setViewingEmployee((prev) => ({
        ...prev,
        documents: [newDoc, ...(prev.documents || [])]
      }));
      message.success('Document uploaded');
    } catch (error) {
      message.error(error?.response?.data?.message || 'Failed to upload document');
    } finally {
      setDocumentUploading(false);
    }
  };

  const handleOpenDocumentPreview = async (doc) => {
    revokePreviewUrl();
    setDocumentPreview(doc);
    setDocumentPreviewVisible(true);
    setDocumentPreviewLoading(true);

    try {
      const resolvedUrl = resolveFileUrl(doc.fileUrl);
      const token = localStorage.getItem('token');
      const response = await fetch(resolvedUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setDocumentPreviewUrl(objectUrl);
      setDocumentPreviewMimeType(blob.type || null);
    } catch (error) {
      console.error('Failed to load document preview', error);
      message.error('Unable to load document preview.');
    } finally {
      setDocumentPreviewLoading(false);
    }
  };

  const handleCloseDocumentPreview = () => {
    setDocumentPreviewVisible(false);
    revokePreviewUrl();
    setDocumentPreview(null);
  };

  const handleDeleteDocument = async (documentId) => {
    if (!viewingEmployee) return;
    try {
      await employeeService.deleteDocument(viewingEmployee.id, documentId);
      setViewingEmployee((prev) => ({
        ...prev,
        documents: (prev.documents || []).filter((doc) => doc.id !== documentId)
      }));
      message.success('Document removed');
    } catch (error) {
      message.error('Failed to delete document');
    }
  };

  const handleAddHistory = async (payload) => {
    if (!viewingEmployee) return;
    try {
      const response = await employeeService.addHistory(viewingEmployee.id, payload);
      const history = response.data || response;
      setViewingEmployee((prev) => ({
        ...prev,
        history: [history, ...(prev.history || [])]
      }));
      message.success('History entry added');
    } catch (error) {
      message.error('Failed to add history entry');
    }
  };

  const columns = useMemo(() => [
    {
      title: 'Name',
      dataIndex: 'firstName',
      key: 'name',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{`${record.firstName} ${record.lastName}`}</div>
          <div style={{ color: '#888', fontSize: 12 }}>{record.jobTitle || '—'}</div>
        </div>
      )
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: (value) => value || '—'
    },
    {
      title: 'Employment Type',
      dataIndex: 'employmentType',
      key: 'employmentType',
      render: (value) => value?.replace('_', ' ').toUpperCase()
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={statusColors[status] || 'default'}>{status?.replace('_', ' ').toUpperCase()}</Tag>
      )
    },
    {
      title: 'Hire Date',
      dataIndex: 'hireDate',
      key: 'hireDate',
      render: (date) => (date ? dayjs(date).format('MMM DD, YYYY') : '—')
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <ActionColumn
          record={record}
          onView={handleView}
          extraActions={[
            {
              label: 'Edit',
              onClick: () => handleOpenEdit(record),
              icon: <FileAddOutlined />
            },
            {
              label: 'Archive',
              onClick: () => archiveMutation.mutate({ id: record.id, payload: {} }),
              icon: <DeleteOutlined />,
              danger: true
            }
          ]}
        />
      )
    }
  ], [handleView, archiveMutation]);

  const employees = employeeQuery.data?.data || [];
  const total = employeeQuery.data?.count || 0;

  const organization = employeeQuery.data?.organization || {};

  const renderDocumentPreviewContent = () => {
    if (!documentPreview) {
      return null;
    }

    const originalPath = documentPreview.fileUrl || '';
    const mimeType = documentPreviewMimeType || '';
    const url = documentPreviewUrl;

    const isImage = mimeType.startsWith('image/') || /\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(originalPath);
    const isPdf = mimeType === 'application/pdf' || /\.pdf$/i.test(originalPath);

    if (documentPreviewLoading || !url) {
      return (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin />
        </div>
      );
    }

    if (isImage) {
      return (
        <div style={{ textAlign: 'center' }}>
          <Image
            src={url}
            alt={documentPreview.title || 'Document image'}
            style={{ maxHeight: '60vh', objectFit: 'contain' }}
            preview={false}
          />
        </div>
      );
    }

    if (isPdf) {
      return (
        <iframe
          title={documentPreview.title || 'Document PDF'}
          src={`${url}#toolbar=1`}
          style={{ width: '100%', height: '70vh', border: 'none' }}
        />
      );
    }

    return (
      <Space direction="vertical">
        <Text type="secondary">Preview not available. You can download the file instead.</Text>
      </Space>
    );
  };

  const revokePreviewUrl = () => {
    if (documentPreviewUrl && documentPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(documentPreviewUrl);
    }
    setDocumentPreviewUrl(null);
    setDocumentPreviewMimeType(null);
  };

  useEffect(() => {
    return () => {
      revokePreviewUrl();
    };
  }, []);

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>Employees</Title>
          <Text type="secondary">Manage your team, payroll readiness, and HR records.</Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<TeamOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['employees'] })}>
              Refresh
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
              New Employee
            </Button>
          </Space>
        </Col>
      </Row>

      <Card style={{ boxShadow: 'none', marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Input.Search
              placeholder="Search name, department, email"
              allowClear
              onSearch={(value) => {
                setPagination((prev) => ({ ...prev, current: 1 }));
                setFilters((prev) => ({ ...prev, search: value }));
              }}
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              value={filters.status}
              onChange={(value) => {
                setPagination((prev) => ({ ...prev, current: 1 }));
                setFilters((prev) => ({ ...prev, status: value }));
              }}
              style={{ width: '100%' }}
              placeholder="Status"
            >
              <Option value="all">All Statuses</Option>
              {statusOptions.map((option) => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              value={filters.employmentType}
              onChange={(value) => {
                setPagination((prev) => ({ ...prev, current: 1 }));
                setFilters((prev) => ({ ...prev, employmentType: value }));
              }}
              style={{ width: '100%' }}
              placeholder="Employment Type"
            >
              <Option value="all">All Types</Option>
              {employmentTypes.map((type) => (
                <Option key={type.value} value={type.value}>
                  {type.label}
                </Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={employees}
        loading={employeeQuery.isLoading}
        pagination={{
          ...pagination,
          total,
          showSizeChanger: true
        }}
        onChange={(pag) => setPagination(pag)}
      />

      <Modal
        title={editingEmployee ? 'Edit Employee' : 'New Employee'}
        open={modalVisible}
        onCancel={handleModalCancel}
        width={720}
        destroyOnHidden
        footer={[
          formStep > 0 && (
            <Button key="prev" onClick={handlePrevStep}>
              Previous
            </Button>
          ),
          formStep < formSteps.length - 1 && (
            <Button key="next" type="primary" onClick={handleNextStep}>
              Next
            </Button>
          ),
          formStep === formSteps.length - 1 && (
            <Button
              key="submit"
              type="primary"
              loading={createMutation.isLoading || updateMutation.isLoading}
              onClick={() => form.submit()}
            >
              {editingEmployee ? 'Save Changes' : 'Create Employee'}
            </Button>
          )
        ].filter(Boolean)}
      >
        <Steps
          size="small"
          current={formStep}
          items={formSteps.map((step) => ({ title: step.title }))}
          style={{ marginBottom: 24 }}
        />
        <Form
          layout="vertical"
          form={form}
          onFinish={handleSubmit}
        >
          <EmployeeForm currentStep={formStep} form={form} />
        </Form>
      </Modal>

      <Drawer
        title={
          viewingEmployee
            ? `${viewingEmployee.firstName} ${viewingEmployee.lastName}`
            : 'Employee'
        }
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setViewingEmployee(null);
          setDrawerLoading(false);
        }}
        width={900}
        destroyOnHidden
        extra={null}
      >
        {(() => {
          if (drawerLoading) {
            return (
              <div style={{ textAlign: 'center', padding: 48 }}>
                <Spin size="large" tip="Loading employee details..." />
              </div>
            );
          }
          if (!viewingEmployee) {
            return null;
          }
          return (
            <Tabs
            defaultActiveKey="overview"
            items={[
              {
                key: 'overview',
                label: 'Overview',
                children: (
                  <>
                    <Descriptions
                      bordered
                      column={1}
                      size="small"
                      styles={{
                        label: { width: '40%', flexBasis: '40%' },
                        content: { width: '60%', flexBasis: '60%' }
                      }}
                    >
                      <Descriptions.Item label="Name">
                        {viewingEmployee.firstName} {viewingEmployee.lastName}
                      </Descriptions.Item>
                      <Descriptions.Item label="Preferred Name">
                        {viewingEmployee.preferredName || '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Email">
                        <Space size="small">
                          <MailOutlined />
                          {viewingEmployee.email || '—'}
                        </Space>
                      </Descriptions.Item>
                      <Descriptions.Item label="Phone">
                        <Space size="small">
                          <PhoneOutlined />
                          {viewingEmployee.phone || '—'}
                        </Space>
                      </Descriptions.Item>
                      <Descriptions.Item label="Department">
                        {viewingEmployee.department || '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Job Title">
                        {viewingEmployee.jobTitle || '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Employment Type">
                        {viewingEmployee.employmentType?.replace('_', ' ').toUpperCase()}
                      </Descriptions.Item>
                      <Descriptions.Item label="Status">
                        <Tag color={statusColors[viewingEmployee.status] || 'default'}>
                          {viewingEmployee.status?.replace('_', ' ').toUpperCase()}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Hire Date">
                        {viewingEmployee.hireDate ? dayjs(viewingEmployee.hireDate).format('MMM DD, YYYY') : '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="End Date">
                        {viewingEmployee.endDate ? dayjs(viewingEmployee.endDate).format('MMM DD, YYYY') : '—'}
                      </Descriptions.Item>
                    </Descriptions>

                    <Divider orientation="left">Compensation</Divider>
                    <Descriptions
                      bordered
                      column={1}
                      size="small"
                      styles={{
                        label: { width: '40%', flexBasis: '40%' },
                        content: { width: '60%', flexBasis: '60%' }
                      }}
                    >
                      <Descriptions.Item label="Salary Type">
                        {viewingEmployee.salaryType?.toUpperCase()}
                      </Descriptions.Item>
                      <Descriptions.Item label="Base Amount">
                        GHS {Number(viewingEmployee.salaryAmount || 0).toFixed(2)}
                      </Descriptions.Item>
                      <Descriptions.Item label="Pay Frequency">
                        {viewingEmployee.payFrequency?.toUpperCase()}
                      </Descriptions.Item>
                      <Descriptions.Item label="Bank / Wallet">
                        {viewingEmployee.bankName || '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Account Name">
                        {viewingEmployee.bankAccountName || '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Account / Momo Number">
                        {viewingEmployee.bankAccountNumber || '—'}
                      </Descriptions.Item>
                    </Descriptions>

                    <Divider orientation="left">Emergency Contact</Divider>
                    <Descriptions
                      bordered
                      column={1}
                      size="small"
                      styles={{
                        label: { width: '40%', flexBasis: '40%' },
                        content: { width: '60%', flexBasis: '60%' }
                      }}
                    >
                      <Descriptions.Item label="Name">
                        {viewingEmployee.emergencyContact?.name || '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Relationship">
                        {viewingEmployee.emergencyContact?.relationship || '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Phone">
                        {viewingEmployee.emergencyContact?.phone || '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Email">
                        {viewingEmployee.emergencyContact?.email || '—'}
                      </Descriptions.Item>
                    </Descriptions>

                    <Divider orientation="left">Next of Kin</Divider>
                    <Descriptions
                      bordered
                      column={1}
                      size="small"
                      styles={{
                        label: { width: '40%', flexBasis: '40%' },
                        content: { width: '60%', flexBasis: '60%' }
                      }}
                    >
                      <Descriptions.Item label="Name">
                        {viewingEmployee.nextOfKin?.name || '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Relationship">
                        {viewingEmployee.nextOfKin?.relationship || '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Phone">
                        {viewingEmployee.nextOfKin?.phone || '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Email">
                        {viewingEmployee.nextOfKin?.email || '—'}
                      </Descriptions.Item>
                    </Descriptions>

                    {viewingEmployee.notes && (
                      <>
                        <Divider orientation="left">Notes</Divider>
                        <Card size="small" style={{ boxShadow: 'none' }}>
                          <Text>{viewingEmployee.notes}</Text>
                        </Card>
                      </>
                    )}
                  </>
                )
              },
              {
                key: 'documents',
                label: 'Documents',
                children: (
                  <>
                    <Upload
                      showUploadList={false}
                      customRequest={({ file }) => handleUploadDocument({ file })}
                    >
                      <Button icon={<UploadOutlined />} loading={documentUploading}>
                        Upload Document
                      </Button>
                    </Upload>
                    <Divider />
                    {(viewingEmployee.documents || []).length === 0 ? (
                      <Text type="secondary">No documents uploaded yet.</Text>
                    ) : (
                      <Row gutter={[16, 16]}>
                        {(viewingEmployee.documents || []).map((doc) => (
                          <Col span={12} key={doc.id}>
                            <Card size="small" style={{ boxShadow: 'none' }}>
                              <Space direction="vertical" size={4}>
                                <Space align="baseline">
                                  <Text strong>{doc.title || doc.type || 'Document'}</Text>
                                  <Tag color="purple">{doc.type || 'File'}</Tag>
                                </Space>
                                <Text type="secondary">
                                  Uploaded {doc.createdAt ? dayjs(doc.createdAt).format('MMM DD, YYYY') : '—'}
                                </Text>
                                <Space>
                                  <Button size="small" onClick={() => handleOpenDocumentPreview(doc)}>
                                    View
                                  </Button>
                                  <Popconfirm
                                    title="Delete document?"
                                    onConfirm={() => handleDeleteDocument(doc.id)}
                                    okText="Delete"
                                    okButtonProps={{ danger: true }}
                                  >
                                    <Button size="small" icon={<DeleteOutlined />} danger />
                                  </Popconfirm>
                                </Space>
                              </Space>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    )}
                  </>
                )
              },
              {
                key: 'history',
                label: 'History',
                children: (
                  <>
                    <Button
                      icon={<HistoryOutlined />}
                      style={{ marginBottom: 16 }}
                      onClick={() =>
                        handleAddHistory({
                          changeType: 'note',
                          notes: 'Manual entry',
                          effectiveDate: new Date()
                        })
                      }
                    >
                      Add History Note
                    </Button>
                    <Timeline
                      items={(viewingEmployee.history || []).map((item) => ({
                        color: item.changeType === 'termination' ? 'red' : 'blue',
                        dot: <HistoryOutlined />,
                        children: (
                          <div>
                            <Text strong>{item.changeType.toUpperCase()}</Text>
                            <div style={{ color: '#888' }}>
                              {dayjs(item.effectiveDate).format('MMM DD, YYYY')}
                            </div>
                            {item.notes && <div style={{ marginTop: 8 }}>{item.notes}</div>}
                          </div>
                        )
                      }))}
                    />
                  </>
                )
              },
              {
                key: 'payroll',
                label: 'Payroll',
                children: viewingEmployee.payrollEntries?.length ? (
                  viewingEmployee.payrollEntries.map((entry) => (
                    <Card key={entry.id} size="small" style={{ marginBottom: 12, boxShadow: 'none' }}>
                      <Space direction="vertical" size={2}>
                        <Text strong>
                          {entry.run?.periodStart
                            ? `${dayjs(entry.run.periodStart).format('MMM DD')} - ${dayjs(entry.run.periodEnd).format('MMM DD, YYYY')}`
                            : 'Payroll Entry'}
                        </Text>
                        <Text type="secondary">
                          Pay Date: {entry.run?.payDate ? dayjs(entry.run.payDate).format('MMM DD, YYYY') : '—'} • Status:{' '}
                          <Tag color={entry.run?.status === 'paid' ? 'green' : 'default'}>
                            {entry.run?.status?.toUpperCase() || '—'}
                          </Tag>
                        </Text>
                        <Text>
                          Gross: GHS {parseFloat(entry.grossPay || 0).toFixed(2)} • Net:{' '}
                          <Text strong>GHS {parseFloat(entry.netPay || 0).toFixed(2)}</Text>
                        </Text>
                      </Space>
                    </Card>
                  ))
                ) : (
                  <Text type="secondary">No payroll history yet.</Text>
                )
              }
            ]}
          />
          );
        })()}
      </Drawer>

      <Modal
        open={documentPreviewVisible}
        title={documentPreview?.title || documentPreview?.type || 'Document Preview'}
        width={900}
        onCancel={handleCloseDocumentPreview}
        destroyOnHidden
        footer={(() => {
          const downloadHref = documentPreview
            ? documentPreviewUrl || resolveFileUrl(documentPreview.fileUrl)
            : null;
          return [
            downloadHref && (
              <Button
                key="download"
                type="primary"
                href={downloadHref}
                download
              >
                Download
              </Button>
            ),
            <Button key="close" onClick={handleCloseDocumentPreview}>
              Close
            </Button>
          ].filter(Boolean);
        })()}
      >
        {renderDocumentPreviewContent()}
      </Modal>
    </div>
  );
};

export default Employees;


