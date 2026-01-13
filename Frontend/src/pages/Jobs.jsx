import { useState, useEffect } from 'react';
import { Table, Button, Tag, Space, Input, Select, message, Modal, Form, InputNumber, DatePicker, Row, Col, Divider, Card, Alert, Descriptions, Timeline, Upload, List, Tooltip, Popconfirm, Spin } from 'antd';
import { PlusOutlined, SearchOutlined, DeleteOutlined, MinusCircleOutlined, FileTextOutlined, ClockCircleOutlined, CheckCircleOutlined, UserOutlined, EditOutlined, PauseCircleOutlined, CloseCircleOutlined, UploadOutlined, PaperClipOutlined, DownloadOutlined, DollarOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import jobService from '../services/jobService';
import customerService from '../services/customerService';
import invoiceService from '../services/invoiceService';
import pricingService from '../services/pricingService';
import userService from '../services/userService';
import customDropdownService from '../services/customDropdownService';
import dayjs from 'dayjs';
import ActionColumn from '../components/ActionColumn';
import DetailsDrawer from '../components/DetailsDrawer';
import PhoneNumberInput from '../components/PhoneNumberInput';

const { Option } = Select;
const { TextArea } = Input;
const uploadMaxSizeMb = Number.parseFloat(import.meta.env.VITE_UPLOAD_MAX_SIZE_MB ?? '') || 20;

const Jobs = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingJob, setViewingJob] = useState(null);
  const [jobDetailsLoading, setJobDetailsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [form] = Form.useForm();
  const [jobInvoices, setJobInvoices] = useState({});
  const [pricingTemplates, setPricingTemplates] = useState([]);
  const [selectedJobType, setSelectedJobType] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedTemplates, setSelectedTemplates] = useState({});
  const [customJobType, setCustomJobType] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [jobBeingAssigned, setJobBeingAssigned] = useState(null);
  const [assignmentForm] = Form.useForm();
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [jobBeingUpdated, setJobBeingUpdated] = useState(null);
  const [statusForm] = Form.useForm();
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [customerForm] = Form.useForm();
  const [submittingJob, setSubmittingJob] = useState(false);
  const [submittingCustomer, setSubmittingCustomer] = useState(false);
  const [updatingAssignment, setUpdatingAssignment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [markingAsPaid, setMarkingAsPaid] = useState(false);
  const [fetchingCustomers, setFetchingCustomers] = useState(false);
  const [showReferralName, setShowReferralName] = useState(false);
  const [customCategories, setCustomCategories] = useState([]);
  const [categoryOtherInputs, setCategoryOtherInputs] = useState({}); // Track "Other" inputs per item index
  const [customCustomerSources, setCustomCustomerSources] = useState([]);
  const [showCustomerSourceOtherInput, setShowCustomerSourceOtherInput] = useState(false);
  const [customerSourceOtherValue, setCustomerSourceOtherValue] = useState('');
  const [customRegions, setCustomRegions] = useState([]);
  const [showRegionOtherInput, setShowRegionOtherInput] = useState(false);
  const [regionOtherValue, setRegionOtherValue] = useState('');
  const [editingJobId, setEditingJobId] = useState(null);

  // Job type configurations
  const jobTypeConfig = {
    'Instant Service': {
      types: ['Photocopying', 'Scanning', 'Printing', 'Lamination', 'Binding'],
      hideFields: ['startDate', 'dueDate', 'priority'],
      defaultValues: { priority: 'urgent', status: 'in_progress' },
      titleFormat: (type, customer) => `${type} for ${customer?.name || 'Customer'}`,
      descriptionFormat: (type) => `Quick ${type.toLowerCase()} service`,
      isInstant: true
    },
    'Standard Printing': {
      types: ['Business Cards', 'Flyers', 'Brochures', 'Posters', 'Banners', 'Booklets'],
      hideFields: [],
      defaultValues: { priority: 'medium', status: 'new' },
      titleFormat: (type, customer) => `${type} - ${customer?.name || 'Customer'}`,
      descriptionFormat: (type, customer) => `${type} printing for ${customer?.company || customer?.name || 'customer'}`,
      isInstant: false
    },
    'Large Format': {
      types: ['Large Format Printing', 'Banners', 'Posters'],
      hideFields: [],
      defaultValues: { priority: 'medium', status: 'new' },
      titleFormat: (type, customer) => `${type} - ${customer?.name || 'Customer'}`,
      descriptionFormat: (type) => `Large format ${type.toLowerCase()} project`,
      isInstant: false
    },
    'Design & Custom': {
      types: ['Design & Print', 'Design Services', 'Custom Work', 'Other'],
      hideFields: [],
      defaultValues: { priority: 'high', status: 'new' },
      titleFormat: (type, customer) => `${type} for ${customer?.name || 'Customer'}`,
      descriptionFormat: (type, customer) => `Custom ${type.toLowerCase()} project for ${customer?.company || customer?.name || 'customer'}`,
      isInstant: false
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
  };

  const getJobTypeCategory = (jobType) => {
    for (const [category, config] of Object.entries(jobTypeConfig)) {
      if (config.types.includes(jobType)) {
        return config;
      }
    }
    return jobTypeConfig['Standard Printing']; // default
  };

  const {
    data: jobsQueryResult,
    isLoading: isJobsLoading,
    isFetching: isJobsFetching,
    error: jobsError,
  } = useQuery({
    queryKey: ['jobs', pagination.current, pagination.pageSize, filters.search || '', filters.status || ''],
    queryFn: () =>
      jobService.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        search: filters.search,
        status: filters.status,
      }),
    keepPreviousData: true,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const jobs = jobsQueryResult?.data || [];
  const jobsCount = jobsQueryResult?.count || 0;

  useEffect(() => {
    setPagination((prev) => (prev.total === jobsCount ? prev : { ...prev, total: jobsCount }));
  }, [jobsCount]);

  useEffect(() => {
    if (jobsError) {
      console.error('Failed to load jobs:', jobsError);
      message.error('Failed to load jobs');
    }
  }, [jobsError]);

  useEffect(() => {
    fetchTeamMembers();
  }, []);

useEffect(() => {
  if (assignModalVisible && jobBeingAssigned) {
    assignmentForm.setFieldsValue({
      assignedTo: jobBeingAssigned.assignedTo || null
    });
  }
}, [assignModalVisible, jobBeingAssigned, assignmentForm]);

useEffect(() => {
  if (statusModalVisible && jobBeingUpdated) {
    statusForm.setFieldsValue({
      status: jobBeingUpdated.status,
      statusComment: ''
    });
  }
}, [statusModalVisible, jobBeingUpdated, statusForm]);


  const fetchTeamMembers = async () => {
    try {
      const response = await userService.getAll({ limit: 100, isActive: 'true' });
      setTeamMembers(response.data || []);
    } catch (error) {
      console.error('Failed to load team members:', error);
    }
  };

  const refreshJobDetails = async (jobId) => {
    const response = await jobService.getById(jobId);
    const jobDetails = unwrapResponse(response);
    jobDetails.attachments = Array.isArray(jobDetails.attachments) ? jobDetails.attachments : [];
    await checkJobInvoice(jobId);
    setViewingJob(jobDetails);
    return jobDetails;
  };

  const handleView = async (job) => {
    // Set viewing job immediately with data from table row
    setViewingJob(job);
    // Open drawer immediately
    setDrawerVisible(true);
    // Load full details asynchronously
    setJobDetailsLoading(true);
    try {
      await refreshJobDetails(job.id);
    } catch (error) {
      message.error('Failed to load job details');
      // Keep the job data from table row if loading fails
    } finally {
      setJobDetailsLoading(false);
    }
  };

  // Check if coming from dashboard with openModal flag
  useEffect(() => {
    if (location.state?.openModal) {
      // Clear the state to prevent reopening on refresh
      navigate(location.pathname, { replace: true, state: {} });
      // Open the job modal after a short delay
      setTimeout(() => {
        handleAddJob();
      }, 100);
    }
  }, [location.state]);

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setViewingJob(null);
    setJobDetailsLoading(false);
  };

  const handleMarkAsPaid = async (job) => {
    try {
      setMarkingAsPaid(true);
      // Find the invoice for this job
      const invoice = jobInvoices[job.id];
      
      if (!invoice) {
        message.error('No invoice found for this job. Please generate an invoice first.');
        return;
      }

      // Update invoice to paid status
      await invoiceService.update(invoice.id, {
        status: 'paid',
        amountPaid: invoice.totalAmount,
        paidDate: new Date().toISOString()
      });

      message.success(`Invoice ${invoice.invoiceNumber} marked as paid!`);
      
      // Refresh job invoices
      await checkJobInvoice(job.id);
      invalidateJobs();
      
      // Refresh drawer if viewing this job
      if (drawerVisible && viewingJob?.id === job.id) {
        await refreshJobDetails(job.id);
      }
    } catch (error) {
      message.error(error.error || 'Failed to mark invoice as paid');
    } finally {
      setMarkingAsPaid(false);
    }
  };

  const checkJobInvoice = async (jobId) => {
    try {
      const response = await invoiceService.getAll({ jobId, limit: 1 });
      if (response.data && response.data.length > 0) {
        setJobInvoices(prev => ({ ...prev, [jobId]: response.data[0] }));
        return response.data[0];
      }
      return null;
    } catch (error) {
      console.error('Failed to check job invoice:', error);
      return null;
    }
  };

  const openAssignModal = (job) => {
    if (!teamMembers.length) {
      fetchTeamMembers();
    }
    setJobBeingAssigned(job);
    setAssignModalVisible(true);
  };

  const closeAssignModal = () => {
    setAssignModalVisible(false);
    setJobBeingAssigned(null);
    assignmentForm.resetFields();
  };

  const handleAssignmentSubmit = async ({ assignedTo }) => {
    if (!jobBeingAssigned) {
      return;
    }

    const jobId = jobBeingAssigned.id;

    try {
      setUpdatingAssignment(true);
      await jobService.update(jobId, { assignedTo: assignedTo || null });
      message.success(assignedTo ? 'Job assigned successfully' : 'Job assignment cleared');
      closeAssignModal();
      invalidateJobs();

      if (drawerVisible && viewingJob?.id === jobId) {
        try {
          await refreshJobDetails(jobId);
        } catch (error) {
          console.error('Failed to refresh job details:', error);
        }
      }
    } catch (error) {
      message.error(error.error || 'Failed to update job assignment');
    } finally {
      setUpdatingAssignment(false);
    }
  };

  const handleAttachmentUpload = async ({ file, onSuccess, onError }) => {
    if (!viewingJob) {
      onError && onError(new Error('No job selected'));
      return;
    }

    try {
      setUploadingAttachment(true);
      await jobService.uploadAttachment(viewingJob.id, file);
      await refreshJobDetails(viewingJob.id);
      message.success(`${file.name} uploaded successfully`);
      if (onSuccess) onSuccess('ok', file);
    } catch (error) {
      console.error('Failed to upload attachment:', error);
      const errMsg = error?.response?.data?.message || 'Failed to upload attachment';
      message.error(errMsg);
      if (onError) onError(error);
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleAttachmentRemove = async (attachment) => {
    if (!viewingJob) return;
    try {
      await jobService.deleteAttachment(viewingJob.id, attachment.id);
      await refreshJobDetails(viewingJob.id);
      message.success('Attachment removed');
    } catch (error) {
      console.error('Failed to remove attachment:', error);
      const errMsg = error?.response?.data?.message || 'Failed to remove attachment';
      message.error(errMsg);
    }
  };

  const attachmentList = Array.isArray(viewingJob?.attachments) ? viewingJob.attachments : [];

  const openStatusModal = (job) => {
    setJobBeingUpdated(job);
    setStatusModalVisible(true);
  };

  const closeStatusModal = () => {
    setStatusModalVisible(false);
    setJobBeingUpdated(null);
    statusForm.resetFields();
  };

  const handleStatusSubmit = async ({ status, statusComment }) => {
    if (!jobBeingUpdated) {
      return;
    }

    const jobId = jobBeingUpdated.id;

    try {
      setUpdatingStatus(true);
      await jobService.update(jobId, {
        status,
        statusComment: statusComment || undefined
      });
      message.success('Job status updated successfully');
      closeStatusModal();
      invalidateJobs();

      if (drawerVisible && viewingJob?.id === jobId) {
        try {
          await refreshJobDetails(jobId);
        } catch (error) {
          console.error('Failed to refresh job details:', error);
        }
      }
    } catch (error) {
      message.error(error.error || 'Failed to update job status');
    } finally {
      setUpdatingStatus(false);
    }
  };



  const handleAddJob = async () => {
    setEditingJobId(null);
    form.resetFields();
    setSelectedJobType(null);
    setSelectedCustomer(null);
    setSelectedTemplates({});
    setCustomJobType('');
    setCategoryOtherInputs({}); // Clear category "Other" inputs
    await fetchTeamMembers();
    setModalVisible(true);
    
    // Fetch customers and pricing templates
    await fetchCustomersAndTemplates();
  };

  const handleEdit = async (job) => {
    try {
      setEditingJobId(job.id);
      
      // Fetch full job details with items
      const jobDetails = await jobService.getById(job.id);
      const jobData = jobDetails.data || jobDetails;
      
      // Fetch customers and templates first and get the data directly
      const { customersData, templatesData } = await fetchCustomersAndTemplates();
      await fetchTeamMembers();
      
      // Set customer
      if (jobData.customerId) {
        const customer = customersData.find(c => c.id === jobData.customerId) || 
                        (jobDetails.data?.customer || jobData.customer);
        if (customer) {
          setSelectedCustomer(customer);
          handleCustomerChange(jobData.customerId);
        }
      }
      
      // Set job type
      if (jobData.jobType) {
        setSelectedJobType(jobData.jobType);
      }
      
      // Format dates for form
      const formData = {
        ...jobData,
        customerId: jobData.customerId,
        startDate: jobData.startDate ? dayjs(jobData.startDate) : null,
        dueDate: jobData.dueDate ? dayjs(jobData.dueDate) : null,
        assignedTo: jobData.assignedTo || null,
        items: jobData.items || []
      };
      
      // Set form values
      form.setFieldsValue(formData);
      
      // Set selected templates for items
      if (jobData.items && jobData.items.length > 0) {
        const templates = {};
        jobData.items.forEach((item, index) => {
          // Try to find matching template
          const matchingTemplate = templatesData.find(t => 
            t.category === item.category && 
            t.materialType === item.materialType
          );
          if (matchingTemplate) {
            templates[index] = matchingTemplate;
          }
        });
        setSelectedTemplates(templates);
      }
      
      setModalVisible(true);
    } catch (error) {
      message.error('Failed to load job details');
      console.error('Error loading job:', error);
      setEditingJobId(null);
    }
  };

  const fetchCustomersAndTemplates = async () => {
    setFetchingCustomers(true);
    try {
      const [customersResponse, templatesResponse, customCategoriesResponse] = await Promise.all([
        customerService.getAll({ limit: 100 }),
        pricingService.getAll({ limit: 100, isActive: 'true' }),
        customDropdownService.getCustomOptions('job_category')
      ]);
      const customersData = customersResponse.data || [];
      const templatesData = templatesResponse.data || [];
      setCustomers(customersData);
      setPricingTemplates(templatesData);
      setCustomCategories(customCategoriesResponse || []);
      return { customersData, templatesData };
    } catch (error) {
      message.error('Failed to load data');
      return { customersData: [], templatesData: [] };
    } finally {
      setFetchingCustomers(false);
    }
  };

  // Load custom categories, customer sources, and regions on mount
  useEffect(() => {
    const loadCustomOptions = async () => {
      try {
        const [categories, sources, regions] = await Promise.all([
          customDropdownService.getCustomOptions('job_category'),
          customDropdownService.getCustomOptions('customer_source'),
          customDropdownService.getCustomOptions('region')
        ]);
        setCustomCategories(categories || []);
        setCustomCustomerSources(sources || []);
        setCustomRegions(regions || []);
      } catch (error) {
        console.error('Failed to load custom options:', error);
      }
    };
    loadCustomOptions();
  }, []);

  // Handle category change (including "Other")
  const handleCategoryChange = async (value, itemIndex) => {
    if (value === '__OTHER__') {
      // Show input for custom category
      setCategoryOtherInputs(prev => ({ ...prev, [itemIndex]: '' }));
    } else {
      // Hide input if not "Other"
      setCategoryOtherInputs(prev => {
        const newState = { ...prev };
        delete newState[itemIndex];
        return newState;
      });
    }
  };

  // Save custom category
  const handleSaveCustomCategory = async (customValue, itemIndex) => {
    if (!customValue || !customValue.trim()) {
      message.warning('Please enter a category name');
      return;
    }

    try {
      const saved = await customDropdownService.saveCustomOption('job_category', customValue.trim());
      if (saved) {
        // Add to custom categories
        setCustomCategories(prev => {
          if (prev.find(c => c.value === saved.value)) {
            return prev;
          }
          return [...prev, saved];
        });
        
        // Set the category value in the form
        const items = form.getFieldValue('items') || [];
        items[itemIndex] = { ...items[itemIndex], category: saved.value };
        form.setFieldValue('items', items);
        
        // Clear the "Other" input
        setCategoryOtherInputs(prev => {
          const newState = { ...prev };
          delete newState[itemIndex];
          return newState;
        });
        
        message.success(`"${saved.label}" added to categories`);
      }
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to save custom category');
    }
  };

  const handleAddNewCustomer = () => {
    customerForm.resetFields();
    setShowReferralName(false);
    setShowCustomerSourceOtherInput(false);
    setCustomerSourceOtherValue('');
    setShowRegionOtherInput(false);
    setRegionOtherValue('');
    setCustomerModalVisible(true);
  };

  const handleHowDidYouHearChange = (value) => {
    if (value === '__OTHER__') {
      setShowCustomerSourceOtherInput(true);
      setShowReferralName(false);
      customerForm.setFieldsValue({ referralName: undefined });
    } else {
      setShowCustomerSourceOtherInput(false);
      setShowReferralName(value === 'Referral');
      if (value !== 'Referral') {
        customerForm.setFieldsValue({ referralName: undefined });
      }
    }
  };

  // Save custom customer source
  const handleSaveCustomCustomerSource = async () => {
    if (!customerSourceOtherValue || !customerSourceOtherValue.trim()) {
      message.warning('Please enter a source name');
      return;
    }

    try {
      const saved = await customDropdownService.saveCustomOption('customer_source', customerSourceOtherValue.trim());
      if (saved) {
        // Add to custom sources
        setCustomCustomerSources(prev => {
          if (prev.find(s => s.value === saved.value)) {
            return prev;
          }
          return [...prev, saved];
        });
        
        // Set the value in the form
        customerForm.setFieldValue('howDidYouHear', saved.value);
        
        // Clear the "Other" input
        setShowCustomerSourceOtherInput(false);
        setCustomerSourceOtherValue('');
        
        message.success(`"${saved.label}" added to sources`);
      }
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to save custom source');
    }
  };

  // Handle region change (including "Other")
  const handleRegionChange = (value) => {
    if (value === '__OTHER__') {
      setShowRegionOtherInput(true);
    } else {
      setShowRegionOtherInput(false);
    }
  };

  // Save custom region
  const handleSaveCustomRegion = async () => {
    if (!regionOtherValue || !regionOtherValue.trim()) {
      message.warning('Please enter a region name');
      return;
    }

    try {
      const saved = await customDropdownService.saveCustomOption('region', regionOtherValue.trim());
      if (saved) {
        // Add to custom regions
        setCustomRegions(prev => {
          if (prev.find(r => r.value === saved.value)) {
            return prev;
          }
          return [...prev, saved];
        });
        
        // Set the value in the form
        customerForm.setFieldValue('state', saved.value);
        
        // Clear the "Other" input
        setShowRegionOtherInput(false);
        setRegionOtherValue('');
        
        message.success(`"${saved.label}" added to regions`);
      }
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to save custom region');
    }
  };

  // Get merged region options
  const getMergedRegionOptions = () => {
    const defaultRegions = [
      'Greater Accra', 'Ashanti', 'Western', 'Western North', 'Central', 'Eastern',
      'Volta', 'Oti', 'Bono', 'Bono East', 'Ahafo', 'Northern', 'Savannah',
      'North East', 'Upper East', 'Upper West'
    ];
    const merged = [...defaultRegions];
    customRegions.forEach(region => {
      if (!merged.includes(region.value)) {
        merged.push(region.value);
      }
    });
    return merged;
  };

  const handleCustomerSubmit = async (values) => {
    try {
      setSubmittingCustomer(true);
      
      // If "Other" is selected for howDidYouHear, save the custom value first
      if (values.howDidYouHear === '__OTHER__') {
        if (!customerSourceOtherValue || !customerSourceOtherValue.trim()) {
          message.error('Please enter and save a custom source before submitting');
          setSubmittingCustomer(false);
          return;
        }
        // Save the custom source and update the form value
        const saved = await customDropdownService.saveCustomOption('customer_source', customerSourceOtherValue.trim());
        if (saved) {
          values.howDidYouHear = saved.value;
          setCustomCustomerSources(prev => {
            if (prev.find(s => s.value === saved.value)) {
              return prev;
            }
            return [...prev, saved];
          });
        }
      }
      
      // If "Other" is selected for region, save the custom value first
      if (values.state === '__OTHER__') {
        if (!regionOtherValue || !regionOtherValue.trim()) {
          message.error('Please enter and save a custom region before submitting');
          setSubmittingCustomer(false);
          return;
        }
        // Save the custom region and update the form value
        const saved = await customDropdownService.saveCustomOption('region', regionOtherValue.trim());
        if (saved) {
          values.state = saved.value;
          setCustomRegions(prev => {
            if (prev.find(r => r.value === saved.value)) {
              return prev;
            }
            return [...prev, saved];
          });
        }
      }
      
      const response = await customerService.create(values);
      message.success('Customer created successfully');
      setCustomerModalVisible(false);
      customerForm.resetFields();
      
      // Refresh customers list
      await fetchCustomersAndTemplates();
      
      // Auto-select the newly created customer
      if (response?.data?.id) {
        form.setFieldsValue({ customerId: response.data.id });
        handleCustomerChange(response.data.id);
      }
    } catch (error) {
      message.error(error.error || 'Failed to create customer');
    } finally {
      setSubmittingCustomer(false);
    }
  };

  const handleCustomerChange = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    setSelectedCustomer(customer);
    const baseJobType = selectedJobType === 'Other' ? 'Other' : selectedJobType;
    const labelOverride = selectedJobType === 'Other' ? customJobType : undefined;
    updateJobTitleAndDescription(baseJobType, customer, labelOverride);
  };

  const handleJobTypeChange = (jobType) => {
    setSelectedJobType(jobType);
    const config = getJobTypeCategory(jobType);
    
    if (jobType !== 'Other') {
      setCustomJobType('');
      form.setFieldsValue({ customJobType: undefined });
    }
    
    // Apply default values
    form.setFieldsValue({
      priority: config.defaultValues.priority,
      status: config.defaultValues.status
    });
    
    // Auto-set due date for instant services (today)
    if (config.isInstant) {
      form.setFieldValue('dueDate', dayjs());
      message.info('Instant service - Due date set to today');
    }
    
    const labelOverride = jobType === 'Other' ? customJobType : undefined;
    updateJobTitleAndDescription(jobType, selectedCustomer, labelOverride);
  };

  const handleCustomJobTypeChange = (event) => {
    const value = event.target.value;
    setCustomJobType(value);
    updateJobTitleAndDescription('Other', selectedCustomer, value);
  };

  const updateJobTitleAndDescription = (jobType, customer, customLabel) => {
    if (!jobType || !customer) return;

    const effectiveLabel = (customLabel && customLabel.trim().length > 0) ? customLabel.trim() : jobType;
    if (!effectiveLabel) return;

    const configKey = jobType === 'Other' ? 'Other' : jobType;
    const config = getJobTypeCategory(configKey);
    const title = config.titleFormat(effectiveLabel, customer);
    const description = config.descriptionFormat(effectiveLabel, customer);

    form.setFieldsValue({
      title,
      description
    });
  };

  const resolveTemplateUnitPrice = (template) => {
    if (!template) return 0;
    const parseMoney = (value) => {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const pricePerUnit = parseMoney(template.pricePerUnit);
    const basePrice = parseMoney(template.basePrice);
    const pricePerSquareFoot = parseMoney(template.pricePerSquareFoot);

    if (pricePerUnit > 0) return pricePerUnit;
    if (pricePerSquareFoot > 0) return pricePerSquareFoot;

    return basePrice;
  };

  // Helper function to calculate discount based on quantity
  const calculateDiscount = (template, quantity, unitPriceOverride) => {
    if (!template || !quantity) return { discountPercent: 0, discountAmount: 0 };

    const unitPrice = unitPriceOverride ?? resolveTemplateUnitPrice(template);
    const subtotal = unitPrice * quantity;

    // Apply discount tiers if available
    if (template.discountTiers && Array.isArray(template.discountTiers) && template.discountTiers.length > 0) {
      for (const tier of template.discountTiers) {
        const minQty = tier.minQuantity || 0;
        const maxQty = tier.maxQuantity || Infinity;
        
        if (quantity >= minQty && quantity <= maxQty) {
          const discountPercent = parseFloat(tier.discountPercent || 0);
          const discountAmount = (subtotal * discountPercent) / 100;
          
          if (discountPercent > 0) {
            message.info(`${discountPercent}% discount applied for quantity ${quantity}!`, 3);
          }
          
          return { discountPercent, discountAmount };
        }
      }
    }

    return { discountPercent: 0, discountAmount: 0 };
  };

  const handleTemplateSelect = (templateId, itemIndex) => {
    const template = pricingTemplates.find(t => t.id === templateId);
    
    if (!templateId || !template) {
      // Clear template selection for this item
      setSelectedTemplates(prev => {
        const updated = { ...prev };
        delete updated[itemIndex];
        return updated;
      });
      return;
    }

    // Store the selected template for this item
    setSelectedTemplates(prev => ({
      ...prev,
      [itemIndex]: template
    }));

    const items = form.getFieldValue('items') || [];
    const currentItem = items[itemIndex] || {};
    
    // Check if template uses square-foot pricing
    const isSquareFootPricing = template.pricingMethod === 'square_foot' || 
                                ['SAV (Self-Adhesive Vinyl)', 'Banner', 'One Way Vision'].includes(template.materialType);
    
    if (isSquareFootPricing) {
      // For square-foot pricing, set up dimensions fields
      const updatedItems = [...items];
      updatedItems[itemIndex] = {
        ...currentItem,
        category: template.category,
        materialType: template.materialType,
        materialSize: template.materialSize || 'Custom',
        description: template.description || currentItem.description,
        pricingMethod: 'square_foot',
        pricePerSquareFoot: parseFloat(template.pricePerSquareFoot || 0),
        itemHeight: currentItem.itemHeight,
        itemWidth: currentItem.itemWidth,
        itemUnit: currentItem.itemUnit || 'feet',
        quantity: 1, // Always 1 for square-foot pricing
        unitPrice: 0, // Will be calculated when dimensions are entered
        discountPercent: 0,
        discountAmount: 0
      };
      form.setFieldsValue({ items: updatedItems });
    } else {
      // Standard unit-based pricing
      const quantity = currentItem.quantity || 1;
      const unitPrice = resolveTemplateUnitPrice(template);
      const { discountPercent, discountAmount } = calculateDiscount(template, quantity, unitPrice);
      
      const updatedItems = [...items];
      updatedItems[itemIndex] = {
        ...currentItem,
        category: template.category,
        paperSize: template.paperSize || currentItem.paperSize,
        materialType: template.materialType,
        materialSize: template.materialSize,
        description: template.description || currentItem.description,
        quantity: quantity,
        unitPrice: unitPrice,
        pricingMethod: 'unit',
        discountPercent: discountPercent,
        discountAmount: discountAmount
      };
      form.setFieldsValue({ items: updatedItems });
    }
    
    // Smart auto-fill for job-level fields if first item
    if (itemIndex === 0 && items.length === 1) {
      const currentTitle = form.getFieldValue('title');
      const currentDescription = form.getFieldValue('description');
      
      // Only auto-fill if fields are empty
      if (!currentTitle || currentTitle.trim() === '') {
        form.setFieldValue('title', template.name);
      }
      if (!currentDescription || currentDescription.trim() === '') {
        form.setFieldValue('description', template.description || template.name);
      }
    }
    
    message.success(`Applied pricing template: ${template.name}`);
  };

  // Handle quantity change with real-time discount recalculation
  const handleQuantityChange = (itemIndex, newQuantity) => {
    const template = selectedTemplates[itemIndex];
    
    if (!template) {
      return; // No template selected, just use the quantity as-is
    }

    const items = form.getFieldValue('items') || [];
    const currentItem = items[itemIndex] || {};
    
    // Recalculate discount with new quantity (unit price stays same)
    const currentPrice = parseFloat(currentItem.unitPrice ?? resolveTemplateUnitPrice(template) ?? 0);
    const { discountPercent, discountAmount } = calculateDiscount(template, newQuantity, currentPrice);
    
    // Update the item with new quantity and recalculated discount
    const updatedItems = [...items];
    updatedItems[itemIndex] = {
      ...currentItem,
      quantity: newQuantity,
      discountPercent: discountPercent,
      discountAmount: discountAmount
    };
    
    form.setFieldsValue({ items: updatedItems });
  };

  const handleSubmit = async (values) => {
    try {
      setSubmittingJob(true);
      // Calculate total from items (with discounts)
      let calculatedTotal = 0;
      if (values.items && values.items.length > 0) {
        // Process items - calculate square-foot pricing if needed
        values.items = values.items.map(item => {
          // If square-foot pricing, ensure unitPrice is calculated
          if ((item.pricingMethod === 'square_foot' || item.itemHeight || item.itemWidth) && 
              item.itemHeight && item.itemWidth && item.pricePerSquareFoot) {
            const height = parseFloat(item.itemHeight);
            const width = parseFloat(item.itemWidth);
            const unit = item.itemUnit || 'feet';
            const pricePerSqft = parseFloat(item.pricePerSquareFoot);
            
            if (unit === 'feet') {
              item.unitPrice = height * width * pricePerSqft;
            } else if (unit === 'inches') {
              item.unitPrice = (height * width * pricePerSqft) / 144;
            }
            item.quantity = 1; // Always 1 for square-foot pricing
          }
          
          return item;
        });
        
        calculatedTotal = values.items.reduce((sum, item) => {
          const subtotal = parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0);
          const discount = parseFloat(item.discountAmount || 0);
          return sum + (subtotal - discount);
        }, 0);
      }

      // Auto-generate job title from items if not provided
      if (!values.title && values.items && values.items.length > 0) {
        const customer = customers.find(c => c.id === values.customerId);
        const customerName = customer?.name || customer?.company || 'Customer';
        const categories = values.items.map(item => item.category).filter(Boolean);
        const uniqueCategories = [...new Set(categories)];
        values.title = uniqueCategories.length > 0 
          ? `${uniqueCategories.join(', ')} for ${customerName}`
          : `Job for ${customerName}`;
      }

      // Set jobType to first item's category for compatibility
      if (values.items && values.items.length > 0) {
        values.jobType = values.items[0].category || 'Other';
      } else {
        values.jobType = 'Other';
      }

      // Format dates
      const jobData = {
        ...values,
        startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : null,
        dueDate: values.dueDate ? values.dueDate.format('YYYY-MM-DD') : null,
        finalPrice: calculatedTotal || values.finalPrice || 0,
      };

      let response;
      if (editingJobId) {
        // Update existing job
        response = await jobService.update(editingJobId, jobData);
        message.success('Job updated successfully');
      } else {
        // Create new job
        response = await jobService.create(jobData);
        
        // Check if invoice was auto-generated
        if (response.invoice) {
          message.success({
            content: `Job created successfully! Invoice ${response.invoice.invoiceNumber} automatically generated.`,
            duration: 5,
            onClick: () => navigate('/invoices', { state: { openInvoiceId: response.invoice.id } })
          });
        } else {
          message.success('Job created successfully');
        }
      }
      
      setModalVisible(false);
      setEditingJobId(null);
      setSelectedJobType(null);
      setSelectedCustomer(null);
      setSelectedTemplates({});
      setCustomJobType('');
      invalidateJobs();
    } catch (error) {
      message.error(error.error || 'Failed to create job');
    } finally {
      setSubmittingJob(false);
    }
  };

  const statusColors = {
    new: 'gold',
    in_progress: 'blue',
    on_hold: 'orange',
    cancelled: 'red',
    completed: 'green',
  };

  const statusOptions = [
    { value: 'new', label: 'New' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'on_hold', label: 'On Hold' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'completed', label: 'Completed' }
  ];

  const priorityColors = {
    low: 'default',
    medium: 'blue',
    high: 'orange',
    urgent: 'red',
  };

  const invalidateJobs = () => {
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
  };

  const unwrapResponse = (response) => (response && Object.prototype.hasOwnProperty.call(response, 'data') ? response.data : response);

  const columns = [
    { title: 'Job Number', dataIndex: 'jobNumber', key: 'jobNumber', width: 150 },
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { 
      title: 'Customer', 
      dataIndex: ['customer', 'name'], 
      key: 'customer',
      render: (name, record) => record.customer?.name || 'N/A'
    },
    {
      title: 'Assigned To',
      dataIndex: ['assignedUser', 'name'],
      key: 'assignedUser',
      render: (_, record) => (
        record.assignedUser
          ? record.assignedUser.name
          : <Tag color="default">Unassigned</Tag>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={statusColors[status]}>
          {status?.replace('_', ' ').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => (
        <Tag color={priorityColors[priority]}>
          {priority?.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Price',
      dataIndex: 'finalPrice',
      key: 'finalPrice',
      render: (price) => `GHS ${parseFloat(price || 0).toFixed(2)}`,
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (date) => date ? dayjs(date).format('MMM DD, YYYY') : 'N/A',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <ActionColumn 
          onView={handleView} 
          record={record}
          extraActions={[
            {
              label: 'Edit Job',
              onClick: () => handleEdit(record),
              icon: <EditOutlined />
            },
            {
              label: record.assignedUser ? 'Reassign Job' : 'Assign Job',
              onClick: () => openAssignModal(record),
              icon: <UserOutlined />
            },
            {
              label: 'Update Status',
              onClick: () => openStatusModal(record),
              icon: <ClockCircleOutlined />
            },
            jobInvoices[record.id] && {
              label: 'View Invoice',
              onClick: () => navigate('/invoices', { state: { openInvoiceId: jobInvoices[record.id].id } }),
              icon: <FileTextOutlined />
            },
            jobInvoices[record.id] && jobInvoices[record.id].status !== 'paid' && {
              label: 'Mark as Paid',
              onClick: () => handleMarkAsPaid(record),
              icon: <DollarOutlined />
            }
          ].filter(Boolean)}
        />
      ),
    },
  ];

  const tablePagination = { ...pagination, total: jobsCount };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: window.innerWidth < 768 ? '20px' : '24px' }}>Jobs</h1>
        <Space wrap style={{ width: window.innerWidth < 768 ? '100%' : 'auto' }}>
          <Input.Search
            placeholder="Search jobs..."
            allowClear
            onSearch={(value) => {
              setPagination((prev) => ({ ...prev, current: 1 }));
              setFilters((prev) => ({ ...prev, search: value }));
            }}
            style={{ width: window.innerWidth < 768 ? '100%' : 200 }}
            prefix={<SearchOutlined />}
          />
          <Select
            placeholder="Filter by status"
            allowClear
            style={{ width: window.innerWidth < 768 ? '100%' : 150 }}
            onChange={(value) => {
              setPagination((prev) => ({ ...prev, current: 1 }));
              setFilters((prev) => ({ ...prev, status: value || '' }));
            }}
          >
            <Option value="new">New</Option>
            <Option value="in_progress">In Progress</Option>
            <Option value="completed">Completed</Option>
            <Option value="on_hold">On Hold</Option>
            <Option value="cancelled">Cancelled</Option>
          </Select>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddJob} style={{ width: window.innerWidth < 768 ? '100%' : 'auto' }}>
            Add Job
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={jobs}
        rowKey="id"
        loading={isJobsLoading || isJobsFetching}
        pagination={tablePagination}
        onChange={(newPagination) =>
          setPagination((prev) => ({
            ...prev,
            current: newPagination.current ?? prev.current,
            pageSize: newPagination.pageSize ?? prev.pageSize,
          }))
        }
        scroll={{ x: 'max-content' }}
      />

      <DetailsDrawer
        open={drawerVisible}
        onClose={handleCloseDrawer}
        title="Job Details"
        width={window.innerWidth < 768 ? '100%' : 700}
        showActions={false}
        extra={viewingJob && (
          <Space wrap>
            <Button 
              icon={<UserOutlined />}
              onClick={() => openAssignModal(viewingJob)}
            >
              {viewingJob.assignedUser ? 'Reassign' : 'Assign'}
            </Button>
            <Button 
              icon={<ClockCircleOutlined />}
              onClick={() => openStatusModal(viewingJob)}
            >
              Update Status
            </Button>
            {jobInvoices[viewingJob.id] && (
              <Button 
                icon={<FileTextOutlined />}
                onClick={() => navigate('/invoices', { state: { openInvoiceId: jobInvoices[viewingJob.id].id } })}
              >
                View Invoice
              </Button>
            )}
            {jobInvoices[viewingJob.id] && jobInvoices[viewingJob.id].status !== 'paid' && (
              <Button 
                type="primary"
                icon={<DollarOutlined />}
                onClick={() => handleMarkAsPaid(viewingJob)}
                loading={markingAsPaid}
              >
                Mark as Paid
              </Button>
            )}
          </Space>
        )}
        tabs={viewingJob ? [
          {
            key: 'details',
            label: 'Details',
            content: (
              <Spin spinning={jobDetailsLoading} tip="Loading job details...">
                <Descriptions column={1} bordered>
                <Descriptions.Item label="Job Number">
                  {viewingJob.jobNumber}
                </Descriptions.Item>
                <Descriptions.Item label="Title">
                  {viewingJob.title}
                </Descriptions.Item>
                <Descriptions.Item label="Customer">
                  {viewingJob.customer?.name}
                </Descriptions.Item>
                <Descriptions.Item label="Job Type">
                  {viewingJob.jobType || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Description">
                  {viewingJob.description}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Space size="small">
                    <Tag color={statusColors[viewingJob.status]}>
                      {viewingJob.status?.replace('_', ' ').toUpperCase()}
                    </Tag>
                    <Button size="small" type="link" onClick={() => openStatusModal(viewingJob)}>
                      Update
                    </Button>
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="Priority">
                  <Tag color={priorityColors[viewingJob.priority]}>
                    {viewingJob.priority?.toUpperCase()}
              </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Created By">
                  <Space size="small">
                    {viewingJob.creator ? (
                      <>
                        <Tag icon={<UserOutlined />} color="geekblue">{viewingJob.creator.name}</Tag>
                        <span style={{ color: '#888' }}>{viewingJob.creator.email}</span>
                      </>
                    ) : (
                      <Tag color="default">System</Tag>
                    )}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="Assigned To">
                  <Space>
                    {viewingJob.assignedUser ? (
                      <>
                        <Tag icon={<UserOutlined />} color="blue">
                          {viewingJob.assignedUser.name}
                        </Tag>
                        <span style={{ color: '#888' }}>{viewingJob.assignedUser.email}</span>
                      </>
                    ) : (
                      <Tag color="default">Unassigned</Tag>
                    )}
                    <Button size="small" type="link" onClick={() => openAssignModal(viewingJob)}>
                      Manage
                    </Button>
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="Final Price">
                  <strong style={{ fontSize: 16, color: '#1890ff' }}>
                    GHS {parseFloat(viewingJob.finalPrice || 0).toFixed(2)}
                  </strong>
                </Descriptions.Item>
                <Descriptions.Item label="Start Date">
                  {viewingJob.startDate ? dayjs(viewingJob.startDate).format('MMM DD, YYYY') : 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Due Date">
                  {viewingJob.dueDate ? dayjs(viewingJob.dueDate).format('MMM DD, YYYY') : 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Completion Date">
                  {viewingJob.completionDate ? dayjs(viewingJob.completionDate).format('MMM DD, YYYY') : 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Notes">
                  {viewingJob.notes || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Invoice">
                  {(() => {
                    const invoice = jobInvoices[viewingJob.id];
                    if (!invoice) {
                      return (
                        <Space direction="vertical" size="small">
                          <Button 
                            type="primary" 
                            icon={<FileTextOutlined />}
                            onClick={() => navigate('/invoices')}
                          >
                            View Invoice
                          </Button>
                          <div style={{ fontSize: 12, color: '#999' }}>
                            Invoice automatically generated
                          </div>
                        </Space>
                      );
                    }
                    return (
                      <Space direction="vertical">
                        <Tag color={invoice.status === 'paid' ? 'green' : 'orange'}>
                          {invoice.invoiceNumber} - {invoice.status?.toUpperCase()}
                        </Tag>
                        <Button 
                          size="small"
                          onClick={() => {
                            navigate('/invoices', { state: { openInvoiceId: invoice.id } });
                            handleCloseDrawer();
                          }}
                        >
                          View Invoice
                        </Button>
                      </Space>
                    );
                  })()}
                </Descriptions.Item>
                <Descriptions.Item label="Created At">
                  {viewingJob.createdAt ? new Date(viewingJob.createdAt).toLocaleString() : '-'}
                </Descriptions.Item>
              </Descriptions>
              </Spin>
            )
          },
          {
            key: 'services',
            label: 'Services',
            content: (
              <Spin spinning={jobDetailsLoading} tip="Loading job details...">
                <div>
                  {(!viewingJob.items || viewingJob.items.length === 0) ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#999' }}>
                    No services/items added to this job
                  </div>
                ) : (
                  <div>
                    {viewingJob.items.map((item, idx) => (
                      <Card key={idx} size="small" style={{ marginBottom: 12 }}>
                        <Row gutter={16}>
                          <Col span={12}>
                            <div style={{ marginBottom: 8 }}>
                              <strong style={{ fontSize: 14 }}>{item.category}</strong>
                            </div>
                            {item.paperSize && item.paperSize !== 'N/A' && (
                              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
                                Paper Size: {item.paperSize}
                              </div>
                            )}
                            {item.description && (
                              <div style={{ fontSize: 12, color: '#666' }}>
                                {item.description}
                              </div>
                            )}
                          </Col>
                          <Col span={4} style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Quantity</div>
                            <div style={{ fontWeight: 'bold', fontSize: 14 }}>{item.quantity}</div>
                          </Col>
                          <Col span={4} style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Unit Price</div>
                            <div style={{ fontSize: 14 }}>GHS {parseFloat(item.unitPrice || 0).toFixed(2)}</div>
                          </Col>
                          <Col span={4} style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Total</div>
                            <div style={{ fontWeight: 'bold', color: '#1890ff', fontSize: 14 }}>
                              GHS {(parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0)).toFixed(2)}
                            </div>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                    <div style={{ 
                      marginTop: 16, 
                      padding: '12px 16px', 
                      background: '#f0f5ff', 
                      borderRadius: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <strong style={{ fontSize: 16 }}>Total:</strong>
                      <strong style={{ fontSize: 18, color: '#1890ff' }}>
                        GHS {parseFloat(viewingJob.finalPrice || 0).toFixed(2)}
                      </strong>
                    </div>
                  </div>
                )}
              </div>
              </Spin>
            )
          },
          {
            key: 'attachments',
            label: 'Attachments',
            content: (
              <div style={{ padding: '16px 0' }}>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <div>
                    <Upload
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt"
                      customRequest={handleAttachmentUpload}
                      multiple={false}
                      showUploadList={false}
                      disabled={uploadingAttachment}
                    >
                      <Button icon={<UploadOutlined />} loading={uploadingAttachment}>
                        {uploadingAttachment ? 'Uploading...' : 'Upload File'}
                      </Button>
                    </Upload>
                    <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
                      Supported types: images, PDF, Office documents, ZIP (max {uploadMaxSizeMb} MB).
                    </div>
                  </div>

                  <List
                    dataSource={attachmentList}
                    locale={{ emptyText: 'No attachments uploaded yet.' }}
                    renderItem={(item) => (
                      <List.Item
                        actions={[
                          <Tooltip title="Open file" key="open">
                            <Button
                              size="small"
                              icon={<DownloadOutlined />}
                              onClick={() => window.open(item.url, '_blank', 'noopener')}
                            />
                          </Tooltip>,
                          <Popconfirm
                            key="delete"
                            title="Remove attachment?"
                            okText="Remove"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => handleAttachmentRemove(item)}
                          >
                            <Button size="small" icon={<DeleteOutlined />} danger />
                          </Popconfirm>
                        ]}
                      >
                        <List.Item.Meta
                          avatar={<PaperClipOutlined style={{ fontSize: 18 }} />}
                          title={
                            <a href={item.url} target="_blank" rel="noopener noreferrer">
                              {item.originalName || item.filename}
                            </a>
                          }
                          description={
                            <Space size="middle">
                              <span>
                                {item.uploadedAt ? dayjs(item.uploadedAt).format('MMM DD, YYYY HH:mm') : ''}
                              </span>
                              <span>{formatFileSize(item.size)}</span>
                              {item.uploadedBy?.name && (
                                <span style={{ color: '#888' }}>by {item.uploadedBy.name}</span>
                              )}
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </Space>
              </div>
            )
          },
          {
            key: 'activities',
            label: 'Activities',
            content: (
              <div style={{ padding: '16px 0' }}>
                {(() => {
                  const historyEntries = (viewingJob?.statusHistory || [])
                    .slice()
                    .sort((a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf());

                  const timelineItems = historyEntries.length ? historyEntries.map((entry) => {
                    const color = statusColors[entry.status] || 'blue';
                    let icon = <ClockCircleOutlined style={{ fontSize: '16px' }} />;
                    if (entry.status === 'completed') {
                      icon = <CheckCircleOutlined style={{ fontSize: '16px' }} />;
                    } else if (entry.status === 'on_hold') {
                      icon = <PauseCircleOutlined style={{ fontSize: '16px' }} />;
                    } else if (entry.status === 'cancelled') {
                      icon = <CloseCircleOutlined style={{ fontSize: '16px' }} />;
                    }

                    return {
                      color,
                      dot: icon,
                      children: (
                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                            Status changed to{' '}
                            <Tag color={color} style={{ marginLeft: 4 }}>
                              {entry.status.replace('_', ' ').toUpperCase()}
                            </Tag>
                          </div>
                          <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>
                            {dayjs(entry.createdAt).format('MMM DD, YYYY [at] h:mm A')}
                          </div>
                          <div style={{ color: '#888', fontSize: 12, marginBottom: entry.comment ? 8 : 0 }}>
                            Updated by: {entry.changedByUser?.name || 'System'}
                            {entry.changedByUser?.email ? ` (${entry.changedByUser.email})` : ''}
                          </div>
                          {entry.comment && (
                            <Alert
                              type="info"
                              showIcon
                              message="Comment"
                              description={entry.comment}
                            />
                          )}
                        </div>
                      )
                    };
                  }) : [{
                    color: 'gray',
                    children: <div style={{ color: '#888' }}>No activity recorded yet.</div>
                  }];

                  return <Timeline items={timelineItems} />;
                })()}
              </div>
            )
          }
        ] : []}
      />

      <Modal
        title={editingJobId ? "Edit Job" : "Add New Job"}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingJobId(null);
          setCategoryOtherInputs({}); // Clear category "Other" inputs
        }}
        onOk={() => form.submit()}
        width={1000}
        okText={editingJobId ? "Update Job" : "Create Job"}
        confirmLoading={submittingJob}
        style={{ top: 20 }}
        bodyStyle={{
          maxHeight: '70vh',
          overflowY: 'auto'
        }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 24 }}
          initialValues={{
            status: 'new',
            priority: 'medium'
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
                  placeholder="Select customer first" 
                  size="large"
                  showSearch
                  filterOption={(input, option) =>
                    option.children.toLowerCase().includes(input.toLowerCase())
                  }
                  onChange={handleCustomerChange}
                  dropdownRender={(menu) => (
                    <>
                      {menu}
                      <Divider style={{ margin: '8px 0' }} />
                      <Button
                        type="link"
                        icon={<PlusOutlined />}
                        onClick={handleAddNewCustomer}
                        style={{ width: '100%', textAlign: 'left' }}
                      >
                        Add New Customer
                      </Button>
                    </>
                  )}
                >
                  {customers.map(customer => (
                    <Option key={customer.id} value={customer.id}>
                      {customer.name} {customer.company ? `(${customer.company})` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="title"
                label="Job Title (Auto-generated from items, editable)"
              >
                <Input placeholder="Will auto-generate based on items added" size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="status"
                label="Status"
                rules={[{ required: true, message: 'Please select status' }]}
              >
                <Select placeholder="Select status" size="large">
                  <Option value="new">New</Option>
                  <Option value="in_progress">In Progress</Option>
                  <Option value="completed">Completed</Option>
                  <Option value="on_hold">On Hold</Option>
                  <Option value="cancelled">Cancelled</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="priority"
                label="Priority"
                rules={[{ required: true, message: 'Please select priority' }]}
              >
                <Select placeholder="Select priority" size="large">
                  <Option value="low">Low</Option>
                  <Option value="medium">Medium</Option>
                  <Option value="high">High</Option>
                  <Option value="urgent">Urgent</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="startDate"
                label="Start Date"
              >
                <DatePicker 
                  style={{ width: '100%' }} 
                  size="large"
                  format="YYYY-MM-DD"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="dueDate"
                label="Due Date"
              >
                <DatePicker 
                  style={{ width: '100%' }} 
                  size="large"
                  format="YYYY-MM-DD"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="assignedTo"
                label="Assign To"
              >
                <Select
                  placeholder="Select team member (optional)"
                  allowClear
                  size="large"
                  showSearch
                  filterOption={(input, option) =>
                    (option?.children?.toString() || '').toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {teamMembers.map(member => (
                    <Option key={member.id} value={member.id}>
                      {member.name} {member.role ? `(${member.role})` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider>Job Items / Services</Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Card 
                    key={key} 
                    size="small" 
                    style={{ marginBottom: 16, background: '#fafafa' }}
                  >
                    {pricingTemplates.length > 0 && (
                      <Row gutter={16} style={{ marginBottom: 16 }}>
                        <Col span={24}>
                          <Form.Item label="Select Pricing Template (Optional)">
                            <Select
                              placeholder="Select a pricing template to auto-fill"
                              style={{ width: '100%' }}
                              size="large"
                              allowClear
                              showSearch
                              optionFilterProp="children"
                              onChange={(value) => handleTemplateSelect(value, name)}
                            >
                              {pricingTemplates.map(template => {
                                const resolvedPrice = resolveTemplateUnitPrice(template);
                                const hasUnitPricing = Number.isFinite(parseFloat(template.pricePerUnit)) && parseFloat(template.pricePerUnit) > 0;
                                const hasSquareFootPricing = Number.isFinite(parseFloat(template.pricePerSquareFoot)) && parseFloat(template.pricePerSquareFoot) > 0;
                                const priceLabel = (() => {
                                  if (resolvedPrice <= 0) return '';
                                  if (hasUnitPricing) return ` (GHS ${resolvedPrice.toFixed(2)}/unit)`;
                                  if (hasSquareFootPricing) return ` (GHS ${resolvedPrice.toFixed(2)}/sq ft)`;
                                  return ` (GHS ${resolvedPrice.toFixed(2)})`;
                                })();
                                return (
                                  <Option key={template.id} value={template.id}>
                                    {template.name} - {template.category}
                                    {priceLabel}
                                  </Option>
                                );
                              })}
                            </Select>
                          </Form.Item>
                        </Col>
                      </Row>
                    )}

                    <Form.Item shouldUpdate noStyle>
                      {({ getFieldValue }) => {
                        const items = getFieldValue('items') || [];
                        const currentItem = items[name] || {};
                        const hasTemplate = selectedTemplates[name];
                        
                        // Only show category dropdown if no template selected
                        if (!hasTemplate && !currentItem.category) {
                          return (
                            <Row gutter={16}>
                              <Col span={24}>
                                <Form.Item
                                  {...restField}
                                  name={[name, 'category']}
                                  label="Category"
                                  rules={[{ required: true, message: 'Please select category or use a pricing template' }]}
                                >
                                  <Select 
                                    placeholder="Select category" 
                                    size="large" 
                                    showSearch
                                    onChange={(value) => handleCategoryChange(value, name)}
                                  >
                                    <Select.OptGroup label="Printing Services">
                                      <Option value="Black & White Printing">Black & White Printing</Option>
                                      <Option value="Color Printing">Color Printing</Option>
                                      <Option value="Large Format Printing">Large Format Printing</Option>
                                      <Option value="Photocopying">Photocopying</Option>
                                    </Select.OptGroup>
                                    <Select.OptGroup label="Print Products">
                                      <Option value="Business Cards">Business Cards</Option>
                                      <Option value="Brochures">Brochures</Option>
                                      <Option value="Flyers">Flyers</Option>
                                      <Option value="Posters">Posters</Option>
                                      <Option value="Banners">Banners</Option>
                                      <Option value="Booklets">Booklets</Option>
                                    </Select.OptGroup>
                                    <Select.OptGroup label="Finishing Services">
                                      <Option value="Binding">Binding</Option>
                                      <Option value="Lamination">Lamination</Option>
                                      <Option value="Scanning">Scanning</Option>
                                    </Select.OptGroup>
                                    <Select.OptGroup label="Professional Services">
                                      <Option value="Design Services">Design Services</Option>
                                    </Select.OptGroup>
                                    {customCategories.length > 0 && (
                                      <Select.OptGroup label="Custom Categories">
                                        {customCategories.map(cat => (
                                          <Option key={cat.value} value={cat.value}>{cat.label}</Option>
                                        ))}
                                      </Select.OptGroup>
                                    )}
                                    <Select.OptGroup label="Other">
                                      <Option value="__OTHER__">Other (specify)</Option>
                                    </Select.OptGroup>
                                  </Select>
                                </Form.Item>
                                {categoryOtherInputs[name] !== undefined && (
                                  <Form.Item
                                    label="Enter Category Name"
                                    style={{ marginTop: 8 }}
                                  >
                                    <Input.Group compact>
                                      <Input
                                        style={{ width: 'calc(100% - 80px)' }}
                                        placeholder="e.g., T-shirt Printing"
                                        value={categoryOtherInputs[name] || ''}
                                        onChange={(e) => setCategoryOtherInputs(prev => ({ ...prev, [name]: e.target.value }))}
                                        onPressEnter={() => handleSaveCustomCategory(categoryOtherInputs[name], name)}
                                      />
                                      <Button
                                        type="primary"
                                        style={{ width: 80 }}
                                        onClick={() => handleSaveCustomCategory(categoryOtherInputs[name], name)}
                                      >
                                        Save
                                      </Button>
                                    </Input.Group>
                                  </Form.Item>
                                )}
                              </Col>
                            </Row>
                          );
                        } else {
                          // Category is hidden when template is selected
                          return (
                            <Form.Item {...restField} name={[name, 'category']} hidden>
                              <Input />
                            </Form.Item>
                          );
                        }
                      }}
                    </Form.Item>

                    <Row gutter={16}>
                      <Col span={24}>
                        <Form.Item
                          {...restField}
                          name={[name, 'description']}
                          label="Item Description"
                          rules={[{ required: true, message: 'Please enter item description' }]}
                        >
                          <Input 
                            placeholder="e.g., Full color, double-sided, glossy finish" 
                            size="large"
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    {/* Hidden fields - populated by template */}
                    <Form.Item {...restField} name={[name, 'paperSize']} hidden>
                      <Input />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'pricingMethod']} hidden>
                      <Input />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'itemHeight']} hidden>
                      <InputNumber />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'itemWidth']} hidden>
                      <InputNumber />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'itemUnit']} hidden>
                      <Input />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'pricePerSquareFoot']} hidden>
                      <InputNumber />
                    </Form.Item>

                    {/* Only show the 4 essential fields + discount */}
                    <Row gutter={16}>
                      <Col span={6}>
                        <Form.Item
                          {...restField}
                          name={[name, 'quantity']}
                          label="Quantity"
                          rules={[{ required: true, message: 'Required' }]}
                          initialValue={1}
                        >
                          <InputNumber
                            style={{ width: '100%' }}
                            placeholder="1"
                            min={1}
                            size="large"
                            onChange={(value) => handleQuantityChange(name, value)}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item
                          {...restField}
                          name={[name, 'unitPrice']}
                          label="Unit Price"
                          rules={[{ required: true, message: 'Required' }]}
                        >
                          <InputNumber
                            style={{ width: '100%' }}
                            placeholder="0.00"
                            prefix="GHS "
                            min={0}
                            precision={2}
                            size="large"
                          />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item
                          {...restField}
                          name={[name, 'discountAmount']}
                          label="Discount"
                        >
                          <InputNumber
                            style={{ width: '100%' }}
                            placeholder="0.00"
                            prefix="GHS "
                            min={0}
                            precision={2}
                            size="large"
                          />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item shouldUpdate noStyle>
                          {() => {
                            const items = form.getFieldValue('items') || [];
                            const currentItem = items[name] || {};
                            const qty = parseFloat(currentItem.quantity || 1);
                            const price = parseFloat(currentItem.unitPrice || 0);
                            const discountAmount = parseFloat(currentItem.discountAmount || 0);
                            const subtotal = qty * price;
                            const total = subtotal - discountAmount;
                            
                            return (
                              <Form.Item label="Total">
                                <div style={{ 
                                  padding: '8px 11px', 
                                  background: '#fff', 
                                  border: '1px solid #d9d9d9',
                                  borderRadius: 4,
                                  fontSize: 14,
                                  fontWeight: 600,
                                  color: '#000',
                                  height: 40,
                                  display: 'flex',
                                  alignItems: 'center'
                                }}>
                                  GHS {total.toFixed(2)}
                                </div>
                              </Form.Item>
                            );
                          }}
                        </Form.Item>
                      </Col>
                    </Row>

                    {/* Hidden discount metadata fields - populated by template */}
                    <Form.Item {...restField} name={[name, 'discountPercent']} hidden>
                      <InputNumber />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'discountReason']} hidden>
                      <Input />
                    </Form.Item>

                    <Button 
                      type="dashed" 
                      danger 
                      onClick={() => remove(name)} 
                      icon={<MinusCircleOutlined />}
                      block
                      style={{ marginTop: '8px' }}
                    >
                      Remove Item
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
                    Add Job Item
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Form.Item shouldUpdate noStyle>
            {() => {
              const items = form.getFieldValue('items') || [];
              const subtotal = items.reduce((sum, item) => {
                const qty = parseFloat(item?.quantity || 1);
                const price = parseFloat(item?.unitPrice || 0);
                return sum + (qty * price);
              }, 0);
              
              const totalDiscount = items.reduce((sum, item) => {
                const discount = parseFloat(item?.discountAmount || 0);
                return sum + discount;
              }, 0);
              
              const total = subtotal - totalDiscount;
              
              return (
                <div style={{
                  padding: '10px 12px',
                  background: '#f5f5f5',
                  border: '1px solid #d9d9d9',
                  borderRadius: 4,
                  marginBottom: 12
                }}>
                  <Row justify="space-between" style={{ marginBottom: 4 }}>
                    <Col style={{ fontSize: 14, color: '#666' }}>Subtotal:</Col>
                    <Col style={{ fontSize: 14, fontWeight: 500 }}>GHS {subtotal.toFixed(2)}</Col>
                  </Row>
                  {totalDiscount > 0 && (
                    <Row justify="space-between" style={{ marginBottom: 4 }}>
                      <Col style={{ fontSize: 14, color: '#666' }}>Total Discount:</Col>
                      <Col style={{ fontSize: 14, fontWeight: 500 }}>-GHS {totalDiscount.toFixed(2)}</Col>
                    </Row>
                  )}
                  <Divider style={{ margin: '6px 0', borderColor: '#d9d9d9' }} />
                  <Row justify="space-between">
                    <Col style={{ fontSize: 16, fontWeight: 'bold' }}>Grand Total:</Col>
                    <Col style={{ fontSize: 18, fontWeight: 'bold', color: '#000' }}>GHS {total.toFixed(2)}</Col>
                  </Row>
                </div>
              );
            }}
          </Form.Item>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="description" label="Special Instructions (Optional)">
                <TextArea 
                  rows={3} 
                  placeholder="Add any special instructions for this job (e.g., Rush order, call before delivery, customer will pick up)" 
                  size="large"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={jobBeingAssigned ? `Assign ${jobBeingAssigned.jobNumber}` : 'Assign Job'}
        open={assignModalVisible}
        onCancel={closeAssignModal}
        onOk={() => assignmentForm.submit()}
        okText="Save"
        confirmLoading={updatingAssignment}
        destroyOnClose
      >
        <Form form={assignmentForm} layout="vertical" onFinish={handleAssignmentSubmit}>
          <Form.Item
            name="assignedTo"
            label="Team Member"
          >
            <Select
              placeholder="Select team member"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.children?.toString() || '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {teamMembers.map(member => (
                <Option key={member.id} value={member.id}>
                  {member.name} {member.role ? `(${member.role})` : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={jobBeingUpdated ? `Update Status - ${jobBeingUpdated.jobNumber}` : 'Update Status'}
        open={statusModalVisible}
        onCancel={closeStatusModal}
        onOk={() => statusForm.submit()}
        okText="Update Status"
        confirmLoading={updatingStatus}
        destroyOnClose
      >
        <Form form={statusForm} layout="vertical" onFinish={handleStatusSubmit}>
          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: 'Please select a status' }]}
          >
            <Select placeholder="Select status">
              {statusOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="statusComment"
            label="Comment"
          >
            <TextArea rows={3} placeholder="Add an optional comment for this status update" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add New Customer Modal */}
      <Modal
        title="Add New Customer"
        open={customerModalVisible}
        onCancel={() => {
          setCustomerModalVisible(false);
          setShowCustomerSourceOtherInput(false);
          setCustomerSourceOtherValue('');
          setShowRegionOtherInput(false);
          setRegionOtherValue('');
        }}
        onOk={() => customerForm.submit()}
        width={800}
        okText="Create Customer"
        confirmLoading={submittingCustomer}
      >
        <Form
          form={customerForm}
          layout="vertical"
          onFinish={handleCustomerSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Customer Name"
                rules={[{ required: true, message: 'Please enter customer name' }]}
              >
                <Input placeholder="Enter name" size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="company" label="Company">
                <Input placeholder="Enter company name" size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[{ type: 'email', message: 'Please enter a valid email' }]}
              >
                <Input placeholder="Enter email" size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Phone">
                <PhoneNumberInput placeholder="Enter phone number" size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="address" label="Address">
                <Input placeholder="Enter address" size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="city" label="Town">
                <Input placeholder="e.g., Accra, Kumasi, Takoradi" size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="state" label="Region">
                <Select 
                  placeholder="Select region" 
                  size="large" 
                  showSearch
                  onChange={handleRegionChange}
                >
                  {getMergedRegionOptions().map((region) => (
                    <Select.Option key={region} value={region}>{region}</Select.Option>
                  ))}
                  <Select.Option value="__OTHER__">Other (specify)</Select.Option>
                </Select>
              </Form.Item>
              {showRegionOtherInput && (
                <Form.Item
                  label="Enter Region Name"
                  style={{ marginTop: 8 }}
                >
                  <Input.Group compact>
                    <Input
                      style={{ width: 'calc(100% - 80px)' }}
                      placeholder="e.g., New Region, District"
                      value={regionOtherValue}
                      onChange={(e) => setRegionOtherValue(e.target.value)}
                      onPressEnter={handleSaveCustomRegion}
                    />
                    <Button
                      type="primary"
                      style={{ width: 80 }}
                      onClick={handleSaveCustomRegion}
                    >
                      Save
                    </Button>
                  </Input.Group>
                </Form.Item>
              )}
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item 
                name="howDidYouHear" 
                label="How did you hear about us?"
                rules={[{ required: true, message: 'Please select an option' }]}
              >
                <Select 
                  placeholder="Select an option" 
                  size="large"
                  showSearch
                  onChange={handleHowDidYouHearChange}
                >
                  <Select.OptGroup label="Social Media">
                    <Select.Option value="Facebook">Facebook</Select.Option>
                    <Select.Option value="Instagram">Instagram</Select.Option>
                    <Select.Option value="Twitter">Twitter</Select.Option>
                    <Select.Option value="LinkedIn">LinkedIn</Select.Option>
                    <Select.Option value="TikTok">TikTok</Select.Option>
                    <Select.Option value="WhatsApp">WhatsApp</Select.Option>
                  </Select.OptGroup>
                  <Select.OptGroup label="Online">
                    <Select.Option value="Google Search">Google Search</Select.Option>
                    <Select.Option value="Website">Website</Select.Option>
                    <Select.Option value="Online Ad">Online Ad</Select.Option>
                  </Select.OptGroup>
                  <Select.OptGroup label="Physical">
                    <Select.Option value="Signboard">Signboard</Select.Option>
                    <Select.Option value="Walk-in">Walk-in</Select.Option>
                    <Select.Option value="Market Outreach">Market Outreach</Select.Option>
                    <Select.Option value="Flyer/Brochure">Flyer/Brochure</Select.Option>
                  </Select.OptGroup>
                  <Select.OptGroup label="Personal">
                    <Select.Option value="Referral">Referral (Word of Mouth)</Select.Option>
                    <Select.Option value="Existing Customer">Existing Customer</Select.Option>
                  </Select.OptGroup>
                  <Select.OptGroup label="Other">
                    <Select.Option value="Radio">Radio</Select.Option>
                    <Select.Option value="TV">TV</Select.Option>
                    <Select.Option value="Newspaper">Newspaper</Select.Option>
                    <Select.Option value="Event/Trade Show">Event/Trade Show</Select.Option>
                  </Select.OptGroup>
                  {customCustomerSources.length > 0 && (
                    <Select.OptGroup label="Custom Sources">
                      {customCustomerSources.map(source => (
                        <Select.Option key={source.value} value={source.value}>{source.label}</Select.Option>
                      ))}
                    </Select.OptGroup>
                  )}
                  <Select.OptGroup label="Other">
                    <Select.Option value="__OTHER__">Other (specify)</Select.Option>
                  </Select.OptGroup>
                </Select>
              </Form.Item>
              {showCustomerSourceOtherInput && (
                <Form.Item
                  label="Enter Source Name"
                  style={{ marginTop: 8 }}
                >
                  <Input.Group compact>
                    <Input
                      style={{ width: 'calc(100% - 80px)' }}
                      placeholder="e.g., Billboard, Magazine Ad"
                      value={customerSourceOtherValue}
                      onChange={(e) => setCustomerSourceOtherValue(e.target.value)}
                      onPressEnter={handleSaveCustomCustomerSource}
                    />
                    <Button
                      type="primary"
                      style={{ width: 80 }}
                      onClick={handleSaveCustomCustomerSource}
                    >
                      Save
                    </Button>
                  </Input.Group>
                </Form.Item>
              )}
            </Col>
          </Row>

          {showReferralName && (
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item 
                  name="referralName" 
                  label="Referral Name"
                  rules={[{ required: true, message: 'Please enter referral name' }]}
                >
                  <Input placeholder="Enter referral name" size="large" />
                </Form.Item>
              </Col>
            </Row>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default Jobs;


