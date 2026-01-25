import { useState, useEffect, useMemo } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, XCircle, Loader2, Search, Trash2, MinusCircle, FileText, Clock, CheckCircle, User, Edit, PauseCircle, X, Upload, Paperclip, Download, DollarSign, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
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
import StatusChip from '../components/StatusChip';
import TableSkeleton from '../components/TableSkeleton';
import DetailSkeleton from '../components/DetailSkeleton';
import { showSuccess, showError, showWarning, showInfo } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Timeline, TimelineItem, TimelineIndicator, TimelineContent, TimelineTitle, TimelineDescription, TimelineTime } from '@/components/ui/timeline';
import { Descriptions, DescriptionItem } from '@/components/ui/descriptions';

const jobItemSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Item description is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0, 'Unit price must be at least 0'),
  discountAmount: z.number().min(0, 'Discount must be at least 0').default(0),
  paperSize: z.string().optional(),
  pricingMethod: z.string().optional(),
  itemHeight: z.number().optional(),
  itemWidth: z.number().optional(),
  itemUnit: z.string().optional(),
  pricePerSquareFoot: z.number().optional(),
  discountPercent: z.number().optional(),
  discountReason: z.string().optional(),
});

const jobSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  title: z.string().optional(),
  status: z.enum(['new', 'in_progress', 'completed', 'on_hold', 'cancelled']).default('new'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  startDate: z.union([z.date(), z.null(), z.undefined()]).optional(),
  dueDate: z.union([z.date(), z.null(), z.undefined()]).optional(),
  assignedTo: z.string().optional().nullable(),
  description: z.string().nullable().optional(),
  items: z.array(jobItemSchema).min(1, 'At least one item is required'),
});

const assignmentSchema = z.object({
  assignedTo: z.string().optional().nullable(),
});

const statusSchema = z.object({
  status: z.enum(['new', 'in_progress', 'completed', 'on_hold', 'cancelled']),
  statusComment: z.string().optional(),
});

const customerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  company: z.string().optional(),
  email: z.string().email('Please enter a valid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  howDidYouHear: z.string().min(1, 'Please select an option'),
  referralName: z.string().optional(),
});

const uploadMaxSizeMb = Number.parseFloat(import.meta.env.VITE_UPLOAD_MAX_SIZE_MB ?? '') || 20;

const Jobs = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ search: '', status: '' });
  const debouncedSearch = useDebounce(filters.search, 500);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingJob, setViewingJob] = useState(null);
  const [jobDetailsLoading, setJobDetailsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  
  const form = useForm({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      customerId: '',
      title: '',
      status: 'new',
      priority: 'medium',
      startDate: null,
      dueDate: null,
      assignedTo: null,
      description: '',
      items: [{ category: '', description: '', quantity: 1, unitPrice: 0, discountAmount: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });
  const [jobInvoices, setJobInvoices] = useState({});
  const [selectedJobType, setSelectedJobType] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedTemplates, setSelectedTemplates] = useState({});
  const [customJobType, setCustomJobType] = useState('');
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [jobBeingAssigned, setJobBeingAssigned] = useState(null);
  const assignmentForm = useForm({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      assignedTo: null,
    },
  });
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [jobBeingUpdated, setJobBeingUpdated] = useState(null);
  const statusForm = useForm({
    resolver: zodResolver(statusSchema),
    defaultValues: {
      status: 'new',
      statusComment: '',
    },
  });
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const customerForm = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      company: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      howDidYouHear: '',
      referralName: '',
    },
  });
  const [submittingJob, setSubmittingJob] = useState(false);
  const [submittingCustomer, setSubmittingCustomer] = useState(false);
  const [updatingAssignment, setUpdatingAssignment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [markingAsPaid, setMarkingAsPaid] = useState(false);
  const [showReferralName, setShowReferralName] = useState(false);
  const [categoryOtherInputs, setCategoryOtherInputs] = useState({}); // Track "Other" inputs per item index
  const [showCustomerSourceOtherInput, setShowCustomerSourceOtherInput] = useState(false);
  const [customerSourceOtherValue, setCustomerSourceOtherValue] = useState('');
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
    queryKey: ['jobs', pagination.current, pagination.pageSize, debouncedSearch || '', filters.status || ''],
    queryFn: async () => {
      try {
        const response = await jobService.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        search: debouncedSearch,
        status: filters.status,
        });
        console.log('Jobs API response:', response);
        // The API interceptor already returns response.data, so response is the actual data object
        return response;
      } catch (error) {
        console.error('Error in queryFn:', error);
        throw error;
      }
    },
    keepPreviousData: true,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const jobs = jobsQueryResult?.data || [];
  const jobsCount = jobsQueryResult?.count || 0;
  
  useEffect(() => {
    console.log('Jobs Query Result:', jobsQueryResult);
    console.log('Jobs array:', jobs);
    console.log('Jobs count:', jobsCount);
  }, [jobsQueryResult, jobs, jobsCount]);

  useEffect(() => {
    setPagination((prev) => (prev.total === jobsCount ? prev : { ...prev, total: jobsCount }));
  }, [jobsCount]);

  useEffect(() => {
    if (jobsError) {
      console.error('Failed to load jobs:', jobsError);
      showError('Failed to load jobs');
    }
  }, [jobsError]);

  // Use React Query for customers, templates, and team members with caching
  const { data: customersData = [], isLoading: customersLoading } = useQuery({
    queryKey: ['customers', 'all'],
    queryFn: async () => {
      const response = await customerService.getAll({ limit: 100 });
      return response.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  const { data: pricingTemplates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['pricingTemplates', 'active'],
    queryFn: async () => {
      const response = await pricingService.getAll({ limit: 100, isActive: 'true' });
      return response.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  const { data: teamMembers = [], isLoading: teamMembersLoading } = useQuery({
    queryKey: ['teamMembers', 'active'],
    queryFn: async () => {
      const response = await userService.getAll({ limit: 100, isActive: 'true' });
      return response.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  const { data: customCategories = [] } = useQuery({
    queryKey: ['customCategories'],
    queryFn: async () => {
      return await customDropdownService.getCustomOptions('job_category') || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  });

useEffect(() => {
  if (assignModalVisible && jobBeingAssigned) {
    assignmentForm.reset({
      assignedTo: jobBeingAssigned.assignedTo || null
    });
  }
}, [assignModalVisible, jobBeingAssigned, assignmentForm]);

useEffect(() => {
  if (statusModalVisible && jobBeingUpdated) {
    statusForm.reset({
      status: jobBeingUpdated.status,
      statusComment: ''
    });
  }
}, [statusModalVisible, jobBeingUpdated, statusForm]);



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
      showError('Failed to load job details');
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
        showError('No invoice found for this job. Please generate an invoice first.');
        return;
      }

      // Update invoice to paid status
      await invoiceService.update(invoice.id, {
        status: 'paid',
        amountPaid: invoice.totalAmount,
        paidDate: new Date().toISOString()
      });

      showSuccess(`Invoice ${invoice.invoiceNumber} marked as paid!`);
      
      // Refresh job invoices
      await checkJobInvoice(job.id);
      invalidateJobs();
      
      // Refresh drawer if viewing this job
      if (drawerVisible && viewingJob?.id === job.id) {
        await refreshJobDetails(job.id);
      }
    } catch (error) {
      showError(error.error || 'Failed to mark invoice as paid');
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
    setJobBeingAssigned(job);
    setAssignModalVisible(true);
  };

  const closeAssignModal = () => {
    setAssignModalVisible(false);
    setJobBeingAssigned(null);
    assignmentForm.reset();
  };

  const handleAssignmentSubmit = async (values) => {
    if (!jobBeingAssigned) {
      return;
    }

    const jobId = jobBeingAssigned.id;
    const { assignedTo } = values;

    try {
      setUpdatingAssignment(true);
      await jobService.update(jobId, { assignedTo: assignedTo || null });
      showSuccess(assignedTo ? 'Job assigned successfully' : 'Job assignment cleared');
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
      showError(error.error || 'Failed to update job assignment');
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
      showSuccess(`${file.name} uploaded successfully`);
      if (onSuccess) onSuccess('ok', file);
    } catch (error) {
      console.error('Failed to upload attachment:', error);
      const errMsg = error?.response?.data?.message || 'Failed to upload attachment';
      showError(errMsg);
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
      showSuccess('Attachment removed');
    } catch (error) {
      console.error('Failed to remove attachment:', error);
      const errMsg = error?.response?.data?.message || 'Failed to remove attachment';
      showError(errMsg);
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
    statusForm.reset();
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
      showSuccess('Job status updated successfully');
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
      showError(error.error || 'Failed to update job status');
    } finally {
      setUpdatingStatus(false);
    }
  };



  const handleAddJob = async () => {
    setEditingJobId(null);
    form.reset({
      customerId: '',
      title: '',
      status: 'new',
      priority: 'medium',
      startDate: null,
      dueDate: null,
      assignedTo: null,
      description: '',
      items: [{ category: '', description: '', quantity: 1, unitPrice: 0, discountAmount: 0 }],
    });
    setSelectedJobType(null);
    setSelectedCustomer(null);
    setSelectedTemplates({});
    setCustomJobType('');
    setCategoryOtherInputs({}); // Clear category "Other" inputs
    setModalVisible(true);
    
    // Prefetch data if not already cached (React Query handles caching automatically)
    queryClient.prefetchQuery({
      queryKey: ['customers', 'all'],
      queryFn: async () => {
        const response = await customerService.getAll({ limit: 100 });
        return response.data || [];
      },
    });
    queryClient.prefetchQuery({
      queryKey: ['pricingTemplates', 'active'],
      queryFn: async () => {
        const response = await pricingService.getAll({ limit: 100, isActive: 'true' });
        return response.data || [];
      },
    });
  };

  const handleEdit = async (job) => {
    try {
      setEditingJobId(job.id);
      
      // Fetch full job details with items (parallel with prefetching)
      const [jobDetailsResult] = await Promise.all([
        jobService.getById(job.id),
        // Prefetch customers and templates if not cached
        queryClient.prefetchQuery({
          queryKey: ['customers', 'all'],
          queryFn: async () => {
            const response = await customerService.getAll({ limit: 100 });
            return response.data || [];
          },
        }),
        queryClient.prefetchQuery({
          queryKey: ['pricingTemplates', 'active'],
          queryFn: async () => {
            const response = await pricingService.getAll({ limit: 100, isActive: 'true' });
            return response.data || [];
          },
        }),
      ]);
      
      const jobDetails = jobDetailsResult;
      const jobData = jobDetails.data || jobDetails;
      
      // Use cached data from React Query
      const customersList = customersData || [];
      const templatesList = pricingTemplates || [];
      
      // Set customer
      if (jobData.customerId) {
        const customer = customersList.find(c => c.id === jobData.customerId) || 
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
      
      // Format dates for form - convert to Date objects for DatePicker
      const formData = {
        ...jobData,
        customerId: jobData.customerId,
        startDate: jobData.startDate ? (dayjs(jobData.startDate).isValid() ? dayjs(jobData.startDate).toDate() : null) : null,
        dueDate: jobData.dueDate ? (dayjs(jobData.dueDate).isValid() ? dayjs(jobData.dueDate).toDate() : null) : null,
        assignedTo: jobData.assignedTo || null,
        description: jobData.description || '',
        items: (jobData.items || []).map(item => ({
          ...item,
          // Parse unitPrice if it's a string (handle formatted values like "GHS 50,00", "50,00", "50.00", etc.)
          unitPrice: typeof item.unitPrice === 'string' 
            ? parseFloat(item.unitPrice.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0
            : (typeof item.unitPrice === 'number' ? item.unitPrice : 0),
          // Ensure quantity is a number
          quantity: typeof item.quantity === 'string' ? parseFloat(item.quantity) || 1 : (typeof item.quantity === 'number' ? item.quantity : 1),
          // Ensure discountAmount is a number (handle formatted strings)
          discountAmount: typeof item.discountAmount === 'string' 
            ? parseFloat(item.discountAmount.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0
            : (typeof item.discountAmount === 'number' ? item.discountAmount : 0),
        }))
      };
      
        // Set form values
        form.reset(formData);
      
      // Set selected templates for items
      if (jobData.items && jobData.items.length > 0) {
        const templates = {};
        jobData.items.forEach((item, index) => {
          // Try to find matching template
          const matchingTemplate = templatesList.find(t => 
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
      showError('Failed to load job details');
      console.error('Error loading job:', error);
      setEditingJobId(null);
    }
  };


  // Load custom customer sources and regions on mount (categories already loaded via React Query)
  const { data: customCustomerSources = [] } = useQuery({
    queryKey: ['customCustomerSources'],
    queryFn: async () => {
      return await customDropdownService.getCustomOptions('customer_source') || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  });

  const { data: customRegions = [] } = useQuery({
    queryKey: ['customRegions'],
    queryFn: async () => {
      return await customDropdownService.getCustomOptions('region') || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  });

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
      showWarning('Please enter a category name');
      return;
    }

    try {
      const saved = await customDropdownService.saveCustomOption('job_category', customValue.trim());
      if (saved) {
        // Invalidate and refetch custom categories
        queryClient.invalidateQueries({ queryKey: ['customCategories'] });
        
        // Set the category value in the form
        const items = form.getValues('items') || [];
        items[itemIndex] = { ...items[itemIndex], category: saved.value };
        form.setValue('items', items);
        
        // Clear the "Other" input
        setCategoryOtherInputs(prev => {
          const newState = { ...prev };
          delete newState[itemIndex];
          return newState;
        });
        
        showSuccess(`"${saved.label}" added to categories`);
      }
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to save custom category');
    }
  };

  const handleAddNewCustomer = () => {
    customerForm.reset();
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
      customerForm.setValue('referralName', undefined);
    } else {
      setShowCustomerSourceOtherInput(false);
      setShowReferralName(value === 'Referral');
      if (value !== 'Referral') {
        customerForm.setValue('referralName', undefined);
      }
    }
  };

  // Save custom customer source
  const handleSaveCustomCustomerSource = async () => {
    if (!customerSourceOtherValue || !customerSourceOtherValue.trim()) {
      showWarning('Please enter a source name');
      return;
    }

    try {
      const saved = await customDropdownService.saveCustomOption('customer_source', customerSourceOtherValue.trim());
      if (saved) {
        // Invalidate and refetch custom customer sources
        queryClient.invalidateQueries({ queryKey: ['customCustomerSources'] });
        
        // Set the value in the form
        customerForm.setValue('howDidYouHear', saved.value);
        
        // Clear the "Other" input
        setShowCustomerSourceOtherInput(false);
        setCustomerSourceOtherValue('');
        
        showSuccess(`"${saved.label}" added to sources`);
      }
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to save custom source');
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
      showWarning('Please enter a region name');
      return;
    }

    try {
      const saved = await customDropdownService.saveCustomOption('region', regionOtherValue.trim());
      if (saved) {
        // Invalidate and refetch custom regions
        queryClient.invalidateQueries({ queryKey: ['customRegions'] });
        
        // Set the value in the form
        customerForm.setValue('state', saved.value);
        
        // Clear the "Other" input
        setShowRegionOtherInput(false);
        setRegionOtherValue('');
        
        showSuccess(`"${saved.label}" added to regions`);
      }
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to save custom region');
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
          showError('Please enter and save a custom source before submitting');
          setSubmittingCustomer(false);
          return;
        }
        // Save the custom source and update the form value
        const saved = await customDropdownService.saveCustomOption('customer_source', customerSourceOtherValue.trim());
        if (saved) {
          values.howDidYouHear = saved.value;
          // Invalidate and refetch custom customer sources
          queryClient.invalidateQueries({ queryKey: ['customCustomerSources'] });
        }
      }
      
      // If "Other" is selected for region, save the custom value first
      if (values.state === '__OTHER__') {
        if (!regionOtherValue || !regionOtherValue.trim()) {
          showError('Please enter and save a custom region before submitting');
          setSubmittingCustomer(false);
          return;
        }
        // Save the custom region and update the form value
        const saved = await customDropdownService.saveCustomOption('region', regionOtherValue.trim());
        if (saved) {
          values.state = saved.value;
          // Invalidate and refetch custom regions
          queryClient.invalidateQueries({ queryKey: ['customRegions'] });
        }
      }
      
      const response = await customerService.create(values);
      showSuccess('Customer created successfully');
      setCustomerModalVisible(false);
      customerForm.reset();
      
      // Refresh customers list
      await fetchCustomersAndTemplates();
      
      // Auto-select the newly created customer
      if (response?.data?.id) {
        form.setValue('customerId', response.data.id);
        handleCustomerChange(response.data.id);
      }
    } catch (error) {
      showError(error.error || 'Failed to create customer');
    } finally {
      setSubmittingCustomer(false);
    }
  };

  const handleCustomerChange = (customerId) => {
    const customer = customersData.find(c => c.id === customerId);
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
      form.setValue('customJobType', '');
    }
    
    // Apply default values
    form.setValue('priority', config.defaultValues.priority);
    form.setValue('status', config.defaultValues.status);
    
    // Auto-set due date for instant services (today)
    if (config.isInstant) {
      form.setValue('dueDate', dayjs().toDate());
      showInfo('Instant service - Due date set to today');
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

    form.setValue('title', title);
    form.setValue('description', description);
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
            showInfo(`${discountPercent}% discount applied for quantity ${quantity}!`);
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

    const items = form.getValues('items') || [];
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
      form.setValue('items', updatedItems);
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
      form.setValue('items', updatedItems);
    }
    
    // Smart auto-fill for job-level fields if first item
    if (itemIndex === 0 && items.length === 1) {
      const currentTitle = form.getFieldValue('title');
      const currentDescription = form.getFieldValue('description');
      
      // Only auto-fill if fields are empty
      if (!currentTitle || currentTitle.trim() === '') {
        form.setValue('title', template.name);
      }
      if (!currentDescription || currentDescription.trim() === '') {
        form.setValue('description', template.description || template.name);
      }
    }
    
    showSuccess(`Applied pricing template: ${template.name}`);
  };

  // Handle quantity change with real-time discount recalculation
  const handleQuantityChange = (itemIndex, newQuantity) => {
    const template = selectedTemplates[itemIndex];
    
    if (!template) {
      return; // No template selected, just use the quantity as-is
    }

    const items = form.getValues('items') || [];
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
    
    form.setValue('items', updatedItems);
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
        const customer = customersData.find(c => c.id === values.customerId);
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

      // Format dates and handle assignedTo
      const formatDate = (date) => {
        if (!date) return null;
        if (typeof date === 'string') return date;
        if (date instanceof Date) return dayjs(date).format('YYYY-MM-DD');
        if (dayjs.isDayjs(date)) return date.format('YYYY-MM-DD');
        return null;
      };

      // Validate required fields
      if (!values.customerId) {
        showError('Customer is required');
        setSubmittingJob(false);
        return;
      }

      // Ensure title exists (auto-generated if not provided)
      if (!values.title || values.title.trim() === '') {
        showError('Job title is required');
        setSubmittingJob(false);
        return;
      }

      // Clean assignedTo - convert "__NONE__" to null
      const cleanAssignedTo = values.assignedTo === "__NONE__" || !values.assignedTo ? null : values.assignedTo;

      // Clean and validate items - ensure required fields are present
      const cleanedItems = (values.items || []).map(item => ({
        ...item,
        quantity: parseFloat(item.quantity) || 1,
        unitPrice: parseFloat(item.unitPrice) || 0,
        discountAmount: parseFloat(item.discountAmount) || 0,
        discountPercent: parseFloat(item.discountPercent) || 0,
      })).filter(item => item.category && item.description); // Filter out invalid items

      if (cleanedItems.length === 0) {
        showError('At least one valid job item is required');
        setSubmittingJob(false);
        return;
      }

      // Build job data, only including valid fields
      const jobData = {
        customerId: values.customerId,
        title: values.title.trim(),
        description: values.description || null,
        status: values.status || 'new',
        priority: values.priority || 'medium',
        jobType: values.jobType || null,
        assignedTo: cleanAssignedTo,
        startDate: formatDate(values.startDate),
        dueDate: formatDate(values.dueDate),
        finalPrice: calculatedTotal || values.finalPrice || 0,
        items: cleanedItems,
      };

      // Log the data being sent for debugging
      console.log('Job data being sent:', JSON.stringify(jobData, null, 2));

      let response;
      if (editingJobId) {
        // Update existing job
        response = await jobService.update(editingJobId, jobData);
        showSuccess('Job updated successfully');
      } else {
        // Create new job
        response = await jobService.create(jobData);
        
        // Check if invoice was auto-generated
        if (response.invoice) {
          showSuccess(`Job created successfully! Invoice ${response.invoice.invoiceNumber} automatically generated.`);
          // Navigate to invoice after a short delay
          setTimeout(() => {
            navigate('/invoices', { state: { openInvoiceId: response.invoice.id } });
          }, 2000);
        } else {
          showSuccess('Job created successfully');
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
      console.error('Job creation/update error:', error);
      console.error('Error response data:', error?.response?.data);
      const errorMessage = error?.response?.data?.error || error?.response?.data?.message || error?.error || error?.message || 'Failed to create job';
      const validationErrors = error?.response?.data?.errors;
      
      // Check if it's a duplicate error - in this case, the job might have been created by another request
      const isDuplicateError = error?.response?.data?.error?.includes('duplicate') || 
                              error?.response?.data?.error?.includes('already exists') ||
                              error?.message?.includes('duplicate') ||
                              error?.message?.includes('already exists');
      
      if (isDuplicateError) {
        // If it's a duplicate error, it might mean another request succeeded
        // Refresh the jobs list to see if a job was created
        invalidateJobs();
        showError('Job creation failed due to duplicate job number. Please check if the job was created successfully.');
      } else if (validationErrors) {
        console.error('Validation errors:', validationErrors);
        showError(`${errorMessage}: ${JSON.stringify(validationErrors)}`);
      } else {
        showError(errorMessage);
      }
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

  // Pagination helpers
  const totalPages = Math.ceil(jobsCount / pagination.pageSize);
  const startIndex = (pagination.current - 1) * pagination.pageSize + 1;
  const endIndex = Math.min(pagination.current * pagination.pageSize, jobsCount);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: window.innerWidth < 768 ? '20px' : '24px' }}>Jobs</h1>
        <div className="flex flex-wrap gap-2" style={{ width: window.innerWidth < 768 ? '100%' : 'auto' }}>
          <div className="relative" style={{ width: window.innerWidth < 768 ? '100%' : 200 }}>
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              value={filters.search}
              onChange={(e) => {
                const value = e.target.value;
                setPagination((prev) => ({ ...prev, current: 1 }));
                setFilters((prev) => ({ ...prev, search: value }));
              }}
              className="pl-8"
              style={{ width: '100%' }}
            />
          </div>
          <Select
            value={filters.status || undefined}
            onValueChange={(value) => {
              setPagination((prev) => ({ ...prev, current: 1 }));
              setFilters((prev) => ({ ...prev, status: value || '' }));
            }}
          >
            <SelectTrigger style={{ width: window.innerWidth < 768 ? '100%' : 150 }}>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleAddJob} style={{ width: window.innerWidth < 768 ? '100%' : 'auto' }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Job
          </Button>
        </div>
      </div>

      {/* Jobs Table */}
      <Card className="shadow-none border-0 p-0">
        <div className="border rounded-t-md">
          {(isJobsLoading || isJobsFetching) ? (
            <div className="p-4">
              <TableSkeleton rows={8} cols={8} />
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              No jobs found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Job Number</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id} className="last:border-b-0">
                    <TableCell className="font-medium">{job.jobNumber}</TableCell>
                    <TableCell>{job.title || 'N/A'}</TableCell>
                    <TableCell>{job.customer?.name || 'N/A'}</TableCell>
                    <TableCell>
                      <StatusChip status={job.status} />
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={
                          priorityColors[job.priority] === 'red' ? 'bg-red-100 text-red-800' : 
                          priorityColors[job.priority] === 'orange' ? 'bg-orange-100 text-orange-800' : 
                          priorityColors[job.priority] === 'blue' ? 'bg-blue-100 text-blue-800' : 
                          ''
                        }
                      >
                        {job.priority?.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      GHS {parseFloat(job.finalPrice || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {job.dueDate ? dayjs(job.dueDate).format('MMM DD, YYYY') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <ActionColumn 
                        onView={handleView} 
                        record={job}
                        extraActions={[
                          {
                            label: 'Edit Job',
                            onClick: () => handleEdit(job),
                            icon: <Edit className="h-4 w-4" />
                          },
                          {
                            label: job.assignedUser ? 'Reassign Job' : 'Assign Job',
                            onClick: () => openAssignModal(job),
                            icon: <User className="h-4 w-4" />
                          },
                          {
                            label: 'Update Status',
                            onClick: () => openStatusModal(job),
                            icon: <Clock className="h-4 w-4" />
                          },
                          jobInvoices[job.id] && {
                            label: 'View Invoice',
                            onClick: () => navigate('/invoices', { state: { openInvoiceId: jobInvoices[job.id].id } }),
                            icon: <FileText className="h-4 w-4" />
                          },
                          jobInvoices[job.id] && jobInvoices[job.id].status !== 'paid' && {
                            label: 'Mark as Paid',
                            onClick: () => handleMarkAsPaid(job),
                            icon: <DollarSign className="h-4 w-4" />
                          }
                        ].filter(Boolean)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        
        {/* Pagination */}
        {jobsCount > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border border-t-0 rounded-b-md">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex} to {endIndex} of {jobsCount} jobs
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination(prev => ({ ...prev, current: prev.current - 1 }))}
                disabled={pagination.current === 1 || isJobsLoading}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="text-sm">
                Page {pagination.current} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination(prev => ({ ...prev, current: prev.current + 1 }))}
                disabled={pagination.current === totalPages || isJobsLoading}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <DetailsDrawer
        open={drawerVisible}
        onClose={handleCloseDrawer}
        title="Job Details"
        width={window.innerWidth < 768 ? '100%' : 700}
        showActions={false}
        extra={viewingJob && (
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => openAssignModal(viewingJob)}
            >
              <User className="h-4 w-4 mr-2" />
              {viewingJob.assignedUser ? 'Reassign' : 'Assign'}
            </Button>
            <Button 
              onClick={() => openStatusModal(viewingJob)}
            >
              <Clock className="h-4 w-4 mr-2" />
              Update Status
            </Button>
            {jobInvoices[viewingJob.id] && (
              <Button 
                onClick={() => navigate('/invoices', { state: { openInvoiceId: jobInvoices[viewingJob.id].id } })}
              >
                <FileText className="h-4 w-4 mr-2" />
                View Invoice
              </Button>
            )}
            {jobInvoices[viewingJob.id] && jobInvoices[viewingJob.id].status !== 'paid' && (
              <Button 
                onClick={() => handleMarkAsPaid(viewingJob)}
                disabled={markingAsPaid}
              >
                {markingAsPaid ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Marking...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-2" />
                Mark as Paid
                  </>
                )}
              </Button>
            )}
          </div>
        )}
        tabs={viewingJob ? [
          {
            key: 'details',
            label: 'Details',
            content: (
              jobDetailsLoading ? (
                <DetailSkeleton />
              ) : (
                <div className="space-y-4">
                  {/* Job Information Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">Job Information</h3>
                    <div className="border rounded-lg px-5 py-4">
                      <Descriptions column={1} className="space-y-2">
                      <DescriptionItem label="Job Number">
                  {viewingJob.jobNumber}
                      </DescriptionItem>
                      <DescriptionItem label="Title">
                  {viewingJob.title}
                      </DescriptionItem>
                      <DescriptionItem label="Customer">
                  {viewingJob.customer?.name}
                      </DescriptionItem>
                      <DescriptionItem label="Job Type">
                  {viewingJob.jobType || '-'}
                      </DescriptionItem>
                      <DescriptionItem label="Description">
                        {viewingJob.description || '-'}
                      </DescriptionItem>
                      <DescriptionItem label="Status">
                  <div className="flex items-center gap-2">
                          <StatusChip status={viewingJob.status} />
                          <Button variant="ghost" size="sm" onClick={() => openStatusModal(viewingJob)} className="text-[#166534] hover:text-[#166534]/80">
                      Update
                    </Button>
                  </div>
                      </DescriptionItem>
                      <DescriptionItem label="Priority">
                        <Badge 
                          variant="outline" 
                          className={
                            viewingJob.priority === 'urgent' ? 'bg-red-100 text-red-800 border-red-300' :
                            viewingJob.priority === 'high' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                            viewingJob.priority === 'medium' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                            ''
                          }
                        >
                    {viewingJob.priority?.toUpperCase()}
              </Badge>
                      </DescriptionItem>
                      </Descriptions>
                    </div>
                  </div>

                  {/* Assignment & Dates Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">Assignment & Dates</h3>
                    <div className="border rounded-lg px-5 py-4">
                      <Descriptions column={1} className="space-y-2">
                      <DescriptionItem label="Created By">
                  <div className="flex items-center gap-2">
                    {viewingJob.creator ? (
                      <>
                              <Badge variant="outline"><User className="h-3 w-3 mr-1" />{viewingJob.creator.name}</Badge>
                              <span className="text-sm text-muted-foreground">{viewingJob.creator.email}</span>
                      </>
                    ) : (
                      <Badge variant="outline">System</Badge>
                    )}
                  </div>
                      </DescriptionItem>
                      <DescriptionItem label="Assigned To">
                  <div className="flex items-center gap-2">
                    {viewingJob.assignedUser ? (
                      <>
                              <Badge variant="outline"><User className="h-3 w-3 mr-1" />
                          {viewingJob.assignedUser.name}
                        </Badge>
                              <span className="text-sm text-muted-foreground">{viewingJob.assignedUser.email}</span>
                      </>
                    ) : (
                      <Badge variant="outline">Unassigned</Badge>
                    )}
                          <Button variant="ghost" size="sm" onClick={() => openAssignModal(viewingJob)} className="text-[#166534] hover:text-[#166534]/80">
                      Manage
                    </Button>
                  </div>
                      </DescriptionItem>
                      <DescriptionItem label="Start Date">
                  {viewingJob.startDate ? dayjs(viewingJob.startDate).format('MMM DD, YYYY') : 'N/A'}
                      </DescriptionItem>
                      <DescriptionItem label="Due Date">
                  {viewingJob.dueDate ? dayjs(viewingJob.dueDate).format('MMM DD, YYYY') : 'N/A'}
                      </DescriptionItem>
                      <DescriptionItem label="Completion Date">
                  {viewingJob.completionDate ? dayjs(viewingJob.completionDate).format('MMM DD, YYYY') : 'N/A'}
                      </DescriptionItem>
                      <DescriptionItem label="Created At">
                        {viewingJob.createdAt ? new Date(viewingJob.createdAt).toLocaleString() : '-'}
                      </DescriptionItem>
                      </Descriptions>
                    </div>
                  </div>

                  {/* Financial & Additional Information Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">Financial & Additional Information</h3>
                    <div className="border rounded-lg px-5 py-4">
                      <Descriptions column={1} className="space-y-2">
                      <DescriptionItem label="Final Price">
                        <strong className="text-base" style={{ color: '#166534' }}>
                          GHS {parseFloat(viewingJob.finalPrice || 0).toFixed(2)}
                        </strong>
                      </DescriptionItem>
                      <DescriptionItem label="Invoice">
                  {(() => {
                    const invoice = jobInvoices[viewingJob.id];
                    if (!invoice) {
                      return (
                        <div className="flex flex-col gap-2">
                          <Button 
                            onClick={() => navigate('/invoices')}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            View Invoice
                          </Button>
                                <div className="text-xs text-muted-foreground">
                            Invoice automatically generated
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="flex flex-col gap-2">
                              <Badge 
                                variant="outline" 
                                className={
                                  invoice.status === 'paid' ? 'bg-green-100 text-green-800 border-green-300' :
                                  invoice.status === 'overdue' ? 'bg-red-100 text-red-800 border-red-300' :
                                  'bg-orange-100 text-orange-800 border-orange-300'
                                }
                              >
                          {invoice.invoiceNumber} - {invoice.status?.toUpperCase()}
                        </Badge>
                        <Button 
                          size="sm"
                          onClick={() => {
                            navigate('/invoices', { state: { openInvoiceId: invoice.id } });
                            handleCloseDrawer();
                          }}
                        >
                          View Invoice
                        </Button>
                      </div>
                    );
                  })()}
                      </DescriptionItem>
                      <DescriptionItem label="Notes">
                        {viewingJob.notes || '-'}
                      </DescriptionItem>
              </Descriptions>
                    </div>
                  </div>
                </div>
              )
            )
          },
          {
            key: 'services',
            label: 'Services',
            content: (
              jobDetailsLoading ? (
                <DetailSkeleton />
              ) : (
                <div>
                  {(!viewingJob.items || viewingJob.items.length === 0) ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#999' }}>
                    No services/items added to this job
                  </div>
                ) : (
                  <div className="space-y-3">
                    {viewingJob.items.map((item, idx) => (
                      <div key={idx} className="border rounded-lg p-4">
                        <div className="grid grid-cols-12 gap-4">
                          <div className="col-span-6">
                            <div className="mb-2">
                              <strong className="text-sm font-semibold">{item.category}</strong>
                            </div>
                            {item.paperSize && item.paperSize !== 'N/A' && (
                              <div className="text-xs text-muted-foreground mb-1">
                                Paper Size: {item.paperSize}
                              </div>
                            )}
                            {item.description && (
                              <div className="text-sm text-foreground">
                                {item.description}
                              </div>
                            )}
                          </div>
                          <div className="col-span-2 text-right">
                            <div className="text-xs text-muted-foreground mb-1">Quantity</div>
                            <div className="font-semibold text-sm">{item.quantity}</div>
                          </div>
                          <div className="col-span-2 text-right">
                            <div className="text-xs text-muted-foreground mb-1">Unit Price</div>
                            <div className="text-sm font-medium">GHS {parseFloat(item.unitPrice || 0).toFixed(2)}</div>
                          </div>
                          <div className="col-span-2 text-right">
                            <div className="text-xs text-muted-foreground mb-1">Total</div>
                            <div className="font-bold text-sm" style={{ color: '#166534' }}>
                              GHS {(parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0)).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="border rounded-lg p-4 flex justify-between items-center bg-muted/30">
                      <strong className="text-base font-semibold">Total:</strong>
                      <strong className="text-lg font-bold" style={{ color: '#166534' }}>
                        GHS {parseFloat(viewingJob.finalPrice || 0).toFixed(2)}
                      </strong>
                    </div>
                  </div>
                )}
              </div>
              )
            )
          },
          {
            key: 'attachments',
            label: 'Attachments',
            content: (
              <div className="py-4">
                <div className="flex flex-col gap-4 w-full">
                  <div>
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleAttachmentUpload({ file, onSuccess: () => {}, onError: () => {} });
                        }
                      }}
                      disabled={uploadingAttachment}
                    />
                    <label
                      htmlFor="file-upload"
                      onDrop={(e) => {
                        e.preventDefault();
                        if (uploadingAttachment) return;
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          handleAttachmentUpload({ file, onSuccess: () => {}, onError: () => {} });
                        }
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                      }}
                      className={`
                        flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer
                        ${uploadingAttachment ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50 transition-colors'}
                        border-gray-300 bg-white
                      `}
                    >
                      {uploadingAttachment ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#166534' }} />
                          <span className="text-sm text-muted-foreground">Uploading...</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 mb-2" style={{ color: '#166534' }} />
                          <div className="text-sm text-center">
                            <span style={{ color: '#166534' }} className="font-medium">Click to upload</span>
                            <span className="text-muted-foreground"> or drag and drop</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            PNG, JPG, WEBP, JPEG, PDF, DOC, DOCX, XLS, XLSX, ZIP (Max. {uploadMaxSizeMb}MB)
                          </div>
                        </>
                      )}
                    </label>
                  </div>

                  <TooltipProvider>
                    <div className="space-y-2">
                      {attachmentList.length === 0 ? (
                        <div className="text-sm text-gray-500 py-4 text-center">No attachments uploaded yet.</div>
                      ) : (
                        attachmentList.map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-md">
                            <div className="flex items-center gap-3 flex-1">
                              <Paperclip className="h-5 w-5 text-gray-500" />
                              <div className="flex-1">
                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline">
                                {item.originalName || item.filename}
                              </a>
                                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                <span>
                                  {item.uploadedAt ? dayjs(item.uploadedAt).format('MMM DD, YYYY HH:mm') : ''}
                                </span>
                                <span>{formatFileSize(item.size)}</span>
                                {item.uploadedBy?.name && (
                                    <span>by {item.uploadedBy.name}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => window.open(item.url, '_blank', 'noopener')}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Open file</TooltipContent>
                              </Tooltip>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost">
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove attachment?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to remove this attachment? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleAttachmentRemove(item)} className="bg-red-600 hover:bg-red-700">
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </TooltipProvider>
                </div>
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

                  // If no status history but job exists, create a "Job created" entry
                  const allActivities = [];
                  
                  // Add job creation activity if job exists
                  if (viewingJob?.createdAt && (historyEntries.length === 0 || dayjs(viewingJob.createdAt).isBefore(dayjs(historyEntries[0]?.createdAt)))) {
                    allActivities.push({
                      id: 'created',
                      type: 'created',
                      status: viewingJob.status || 'new',
                      createdAt: viewingJob.createdAt,
                      comment: 'Job created',
                      changedByUser: viewingJob.creator || null,
                      isCreated: true
                    });
                  }
                  
                  // Add all status history entries
                  allActivities.push(...historyEntries);
                  
                  // Sort all activities by date
                  allActivities.sort((a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf());

                  const timelineItems = allActivities.length ? allActivities.map((entry) => {
                    const color = statusColors[entry.status] || 'blue';
                    let icon = <Clock style={{ fontSize: '16px' }} />;
                    if (entry.status === 'completed') {
                      icon = <CheckCircle style={{ fontSize: '16px' }} />;
                    } else if (entry.status === 'on_hold') {
                      icon = <PauseCircle style={{ fontSize: '16px' }} />;
                    } else if (entry.status === 'cancelled') {
                      icon = <XCircle style={{ fontSize: '16px' }} />;
                    } else if (entry.isCreated) {
                      icon = <Plus style={{ fontSize: '16px' }} />;
                    }

                    return {
                      color,
                      dot: icon,
                      children: (
                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                            {entry.isCreated ? (
                              <>
                                Job created with status{' '}
                                <Badge variant="outline" className={color === 'green' ? 'bg-green-100 text-green-800' : color === 'blue' ? 'bg-blue-100 text-blue-800' : color === 'orange' ? 'bg-orange-100 text-orange-800' : color === 'red' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'} style={{ marginLeft: 4 }}>
                                  {entry.status.replace('_', ' ').toUpperCase()}
                                </Badge>
                              </>
                            ) : (
                              <>
                                Status changed to{' '}
                                <Badge variant="outline" className={color === 'green' ? 'bg-green-100 text-green-800' : color === 'blue' ? 'bg-blue-100 text-blue-800' : color === 'orange' ? 'bg-orange-100 text-orange-800' : color === 'red' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'} style={{ marginLeft: 4 }}>
                                  {entry.status.replace('_', ' ').toUpperCase()}
                                </Badge>
                              </>
                            )}
                          </div>
                          <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>
                            {dayjs(entry.createdAt).format('MMM DD, YYYY [at] h:mm A')}
                          </div>
                          <div style={{ color: '#888', fontSize: 12, marginBottom: entry.comment ? 8 : 0 }}>
                            {entry.isCreated ? (
                              <>Created by: {entry.changedByUser?.name || viewingJob?.creator?.name || 'System'}</>
                            ) : (
                              <>Updated by: {entry.changedByUser?.name || 'System'}</>
                            )}
                            {entry.changedByUser?.email ? ` (${entry.changedByUser.email})` : viewingJob?.creator?.email ? ` (${viewingJob.creator.email})` : ''}
                          </div>
                          {entry.comment && (
                            <Alert className="mt-2">
                              <AlertDescription>{entry.comment}</AlertDescription>
                            </Alert>
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

      <Dialog open={modalVisible} onOpenChange={(open) => {
        if (!open) {
          setModalVisible(false);
          setEditingJobId(null);
          setCategoryOtherInputs({}); // Clear category "Other" inputs
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingJobId ? "Edit Job" : "Add New Job"}</DialogTitle>
            <DialogDescription>
              {editingJobId ? "Update the job details below." : "Fill in the details to create a new job."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {!customerModalVisible && (
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                        handleCustomerChange(value);
                      }} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer first" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customersData.map(customer => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name} {customer.company ? `(${customer.company})` : ''}
                            </SelectItem>
                          ))}
                          <Separator className="my-2" />
                          <div className="px-2 py-1.5">
                      <Button
                              type="button"
                              variant="ghost"
                              className="w-full justify-start"
                        onClick={handleAddNewCustomer}
                      >
                              <Plus className="h-4 w-4 mr-2" />
                        Add New Customer
                      </Button>
                          </div>
                        </SelectContent>
                </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                )}
                <FormField
                  control={form.control}
                name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title (Auto-generated from items, editable)</FormLabel>
                      <FormControl>
                        <Input placeholder="Will auto-generate based on items added" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                <DatePicker 
                          date={field.value}
                          onDateChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                <DatePicker 
                          date={field.value}
                          onDateChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="assignedTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign To</FormLabel>
                    <Select onValueChange={(value) => field.onChange(value === "__NONE__" ? null : value)} value={field.value ? String(field.value) : "__NONE__"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select team member (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__NONE__">None</SelectItem>
                  {teamMembers.map(member => (
                          <SelectItem key={member.id} value={member.id}>
                      {member.name} {member.role ? `(${member.role})` : ''}
                          </SelectItem>
                  ))}
                      </SelectContent>
                </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="relative my-2" style={{ marginBottom: '8px' }}>
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-sm font-medium">Job Items / Services</span>
                </div>
              </div>

              <div className="space-y-4">
                {fields.map((field, index) => (
                  <Card key={field.id} className="p-4 bg-gray-50">
                    {pricingTemplates.length > 0 && (
                      <div className="mb-4">
                        <Label>Select Pricing Template (Optional)</Label>
                            <Select
                          onValueChange={(value) => handleTemplateSelect(value, index)}
                        >
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder="Select a pricing template to auto-fill" />
                          </SelectTrigger>
                          <SelectContent>
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
                                <SelectItem key={template.id} value={template.id}>
                                    {template.name} - {template.category}
                                    {priceLabel}
                                </SelectItem>
                                );
                              })}
                          </SelectContent>
                            </Select>
                      </div>
                    )}

                    {(() => {
                      const items = form.getValues('items') || [];
                      const currentItem = items[index] || {};
                      const hasTemplate = selectedTemplates[index];
                        
                        // Show category dropdown if no template selected (always visible, not just when empty)
                        if (!hasTemplate) {
                          return (
                          <FormField
                            control={form.control}
                            name={`items.${index}.category`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Category</FormLabel>
                                <Select onValueChange={(value) => {
                                  field.onChange(value);
                                  handleCategoryChange(value, index);
                                }} value={field.value || undefined}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <div className="px-2 py-1.5 text-sm font-semibold">Printing Services</div>
                                    <SelectItem value="Black & White Printing">Black & White Printing</SelectItem>
                                    <SelectItem value="Color Printing">Color Printing</SelectItem>
                                    <SelectItem value="Large Format Printing">Large Format Printing</SelectItem>
                                    <SelectItem value="Photocopying">Photocopying</SelectItem>
                                    <div className="px-2 py-1.5 text-sm font-semibold">Print Products</div>
                                    <SelectItem value="Business Cards">Business Cards</SelectItem>
                                    <SelectItem value="Brochures">Brochures</SelectItem>
                                    <SelectItem value="Flyers">Flyers</SelectItem>
                                    <SelectItem value="Posters">Posters</SelectItem>
                                    <SelectItem value="Banners">Banners</SelectItem>
                                    <SelectItem value="Booklets">Booklets</SelectItem>
                                    <div className="px-2 py-1.5 text-sm font-semibold">Finishing Services</div>
                                    <SelectItem value="Binding">Binding</SelectItem>
                                    <SelectItem value="Lamination">Lamination</SelectItem>
                                    <SelectItem value="Scanning">Scanning</SelectItem>
                                    <div className="px-2 py-1.5 text-sm font-semibold">Professional Services</div>
                                    <SelectItem value="Design Services">Design Services</SelectItem>
                                    {customCategories.length > 0 && (
                                      <>
                                        <div className="px-2 py-1.5 text-sm font-semibold">Custom Categories</div>
                                        {customCategories.map(cat => (
                                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                        ))}
                                      </>
                                    )}
                                    <div className="px-2 py-1.5 text-sm font-semibold">Other</div>
                                    <SelectItem value="__OTHER__">Other (specify)</SelectItem>
                                  </SelectContent>
                                  </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        );
                      } else {
                        // Category is hidden when template is selected
                        return (
                          <FormField
                            control={form.control}
                            name={`items.${index}.category`}
                            render={({ field }) => <input type="hidden" {...field} />}
                          />
                        );
                      }
                    })()}
                    {categoryOtherInputs[index] !== undefined && (
                      <div className="mt-2">
                        <Label>Enter Category Name</Label>
                        <div className="flex gap-2 mt-2">
                                      <Input
                            className="flex-1"
                                        placeholder="e.g., T-shirt Printing"
                            value={categoryOtherInputs[index] || ''}
                            onChange={(e) => setCategoryOtherInputs(prev => ({ ...prev, [index]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveCustomCategory(categoryOtherInputs[index], index)}
                                      />
                                      <Button
                            type="button"
                            onClick={() => handleSaveCustomCategory(categoryOtherInputs[index], index)}
                            className="w-20"
                                      >
                                        Save
                                      </Button>
                        </div>
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name={`items.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Item Description</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Full color, double-sided, glossy finish" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Hidden fields - populated by template */}
                    <FormField
                      control={form.control}
                      name={`items.${index}.paperSize`}
                      render={({ field }) => <input type="hidden" {...field} />}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.pricingMethod`}
                      render={({ field }) => <input type="hidden" {...field} />}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.itemHeight`}
                      render={({ field }) => <input type="hidden" {...field} />}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.itemWidth`}
                      render={({ field }) => <input type="hidden" {...field} />}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.itemUnit`}
                      render={({ field }) => <input type="hidden" {...field} />}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.pricePerSquareFoot`}
                      render={({ field }) => <input type="hidden" {...field} />}
                    />

                    {/* Only show the 4 essential fields + discount */}
                    <div className="grid grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                            placeholder="1"
                            min={1}
                                {...field}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 1;
                                  field.onChange(value);
                                  handleQuantityChange(index, value);
                                }}
                                value={field.value || 1}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.unitPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit Price</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">GHS</span>
                                <Input
                                  type="number"
                            placeholder="0.00"
                            min={0}
                                  step="0.01"
                                  className="pl-12"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  value={field.value || ''}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.discountAmount`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Discount</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">GHS</span>
                                <Input
                                  type="number"
                            placeholder="0.00"
                            min={0}
                                  step="0.01"
                                  className="pl-12"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  value={field.value || ''}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="space-y-2">
                        <Label>Total</Label>
                        <div className="h-10 px-3 py-2 border border-input rounded-md bg-background flex items-center text-sm font-semibold">
                          GHS {(() => {
                            const items = form.getValues('items') || [];
                            const currentItem = items[index] || {};
                            const qty = parseFloat(currentItem.quantity || 1);
                            const price = parseFloat(currentItem.unitPrice || 0);
                            const discountAmount = parseFloat(currentItem.discountAmount || 0);
                            const subtotal = qty * price;
                            const total = subtotal - discountAmount;
                            return total.toFixed(2);
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Hidden discount metadata fields - populated by template */}
                    <FormField
                      control={form.control}
                      name={`items.${index}.discountPercent`}
                      render={({ field }) => <input type="hidden" {...field} />}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.discountReason`}
                      render={({ field }) => <input type="hidden" {...field} />}
                    />

                    <Button 
                      type="button"
                      variant="outline"
                      className="w-full mt-2"
                      onClick={() => remove(index)}
                    >
                      <MinusCircle className="h-4 w-4 mr-2" />
                      Remove Item
                    </Button>
                  </Card>
                ))}
                  <Button 
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => append({ category: '', description: '', quantity: 1, unitPrice: 0, discountAmount: 0 })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                    Add Job Item
                  </Button>
              </div>

              {(() => {
                const items = form.getValues('items') || [];
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
                  <div className="bg-gray-50 border border-gray-200 rounded-md mb-4 overflow-hidden">
                    <div className="p-3">
                    <div className="flex justify-between mb-1 text-sm text-gray-600">
                      <span>Subtotal:</span>
                      <span className="font-medium">GHS {subtotal.toFixed(2)}</span>
                    </div>
                  {totalDiscount > 0 && (
                      <div className="flex justify-between mb-1 text-sm text-gray-600">
                        <span>Total Discount:</span>
                        <span className="font-medium">-GHS {totalDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    </div>
                    <Separator className="w-full" />
                    <div className="p-3 flex justify-between">
                      <span className="text-base font-bold">Grand Total:</span>
                      <span className="text-lg font-bold">GHS {total.toFixed(2)}</span>
                    </div>
                </div>
              );
              })()}

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Special Instructions (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                  rows={3} 
                  placeholder="Add any special instructions for this job (e.g., Rush order, call before delivery, customer will pick up)" 
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setModalVisible(false);
                  setEditingJobId(null);
                  setCategoryOtherInputs({});
                }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingJob}>
                  {submittingJob ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingJobId ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    editingJobId ? 'Update Job' : 'Create Job'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={assignModalVisible} onOpenChange={(open) => !open && closeAssignModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{jobBeingAssigned ? `Assign ${jobBeingAssigned.jobNumber}` : 'Assign Job'}</DialogTitle>
            <DialogDescription>
              Select a team member to assign this job to, or leave it unassigned.
            </DialogDescription>
          </DialogHeader>
          <Form {...assignmentForm}>
            <form onSubmit={assignmentForm.handleSubmit(handleAssignmentSubmit)} className="space-y-4">
              <FormField
                control={assignmentForm.control}
            name="assignedTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team Member</FormLabel>
                    <Select onValueChange={(value) => field.onChange(value === "__NONE__" ? null : value)} value={field.value ? String(field.value) : "__NONE__"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select team member" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__NONE__">None</SelectItem>
              {teamMembers.map(member => (
                          <SelectItem key={member.id} value={member.id}>
                  {member.name} {member.role ? `(${member.role})` : ''}
                          </SelectItem>
              ))}
                      </SelectContent>
            </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeAssignModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updatingAssignment}>
                  {updatingAssignment ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={statusModalVisible} onOpenChange={(open) => !open && closeStatusModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{jobBeingUpdated ? `Update Status - ${jobBeingUpdated.jobNumber}` : 'Update Status'}</DialogTitle>
            <DialogDescription>
              Update the status of this job and optionally add a comment.
            </DialogDescription>
          </DialogHeader>
          <Form {...statusForm}>
            <form onSubmit={statusForm.handleSubmit(handleStatusSubmit)} className="space-y-4">
              <FormField
                control={statusForm.control}
            name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
              {statusOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                  {option.label}
                          </SelectItem>
              ))}
                      </SelectContent>
            </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={statusForm.control}
            name="statusComment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comment</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Add an optional comment for this status update" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeStatusModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updatingStatus}>
                  {updatingStatus ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Status'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add New Customer Modal */}
      <Dialog open={customerModalVisible} onOpenChange={(open) => {
        if (!open) {
          setCustomerModalVisible(false);
          setShowCustomerSourceOtherInput(false);
          setCustomerSourceOtherValue('');
          setShowRegionOtherInput(false);
          setRegionOtherValue('');
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Enter the customer information below to add them to your system.
            </DialogDescription>
          </DialogHeader>
          <Form {...customerForm}>
            <form onSubmit={customerForm.handleSubmit(handleCustomerSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={customerForm.control}
                name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={customerForm.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter company name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={customerForm.control}
                name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Enter email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={customerForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <PhoneNumberInput placeholder="Enter phone number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={customerForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={customerForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Town</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Accra, Kumasi, Takoradi" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={customerForm.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Region</FormLabel>
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                        handleRegionChange(value);
                      }} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select region" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                  {getMergedRegionOptions().map((region) => (
                            <SelectItem key={region} value={region}>{region}</SelectItem>
                  ))}
                          <SelectItem value="__OTHER__">Other (specify)</SelectItem>
                        </SelectContent>
                </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {showRegionOtherInput && (
                <div className="flex gap-2">
                    <Input
                    className="flex-1"
                      placeholder="e.g., New Region, District"
                      value={regionOtherValue}
                      onChange={(e) => setRegionOtherValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveCustomRegion()}
                    />
                    <Button
                    type="button"
                      onClick={handleSaveCustomRegion}
                    className="w-20"
                    >
                      Save
                    </Button>
                </div>
              )}

              <FormField
                control={customerForm.control}
                name="howDidYouHear" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>How did you hear about us?</FormLabel>
                    <Select onValueChange={(value) => {
                      field.onChange(value);
                      handleHowDidYouHearChange(value);
                    }} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <div className="px-2 py-1.5 text-sm font-semibold">Social Media</div>
                        <SelectItem value="Facebook">Facebook</SelectItem>
                        <SelectItem value="Instagram">Instagram</SelectItem>
                        <SelectItem value="Twitter">Twitter</SelectItem>
                        <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                        <SelectItem value="TikTok">TikTok</SelectItem>
                        <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                        <div className="px-2 py-1.5 text-sm font-semibold">Online</div>
                        <SelectItem value="Google Search">Google Search</SelectItem>
                        <SelectItem value="Website">Website</SelectItem>
                        <SelectItem value="Online Ad">Online Ad</SelectItem>
                        <div className="px-2 py-1.5 text-sm font-semibold">Physical</div>
                        <SelectItem value="Signboard">Signboard</SelectItem>
                        <SelectItem value="Walk-in">Walk-in</SelectItem>
                        <SelectItem value="Market Outreach">Market Outreach</SelectItem>
                        <SelectItem value="Flyer/Brochure">Flyer/Brochure</SelectItem>
                        <div className="px-2 py-1.5 text-sm font-semibold">Personal</div>
                        <SelectItem value="Referral">Referral (Word of Mouth)</SelectItem>
                        <SelectItem value="Existing Customer">Existing Customer</SelectItem>
                        <div className="px-2 py-1.5 text-sm font-semibold">Other</div>
                        <SelectItem value="Radio">Radio</SelectItem>
                        <SelectItem value="TV">TV</SelectItem>
                        <SelectItem value="Newspaper">Newspaper</SelectItem>
                        <SelectItem value="Event/Trade Show">Event/Trade Show</SelectItem>
                  {customCustomerSources.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-sm font-semibold">Custom Sources</div>
                      {customCustomerSources.map(source => (
                              <SelectItem key={source.value} value={source.value}>{source.label}</SelectItem>
                            ))}
                          </>
                        )}
                        <div className="px-2 py-1.5 text-sm font-semibold">Other</div>
                        <SelectItem value="__OTHER__">Other (specify)</SelectItem>
                      </SelectContent>
                </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {showCustomerSourceOtherInput && (
                <div className="flex gap-2">
                    <Input
                    className="flex-1"
                      placeholder="e.g., Billboard, Magazine Ad"
                      value={customerSourceOtherValue}
                      onChange={(e) => setCustomerSourceOtherValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveCustomCustomerSource()}
                    />
                    <Button
                    type="button"
                      onClick={handleSaveCustomCustomerSource}
                    className="w-20"
                    >
                      Save
                    </Button>
                </div>
              )}

          {showReferralName && (
                <FormField
                  control={customerForm.control}
                  name="referralName" 
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referral Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter referral name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setCustomerModalVisible(false);
                  setShowCustomerSourceOtherInput(false);
                  setCustomerSourceOtherValue('');
                  setShowRegionOtherInput(false);
                  setRegionOtherValue('');
                }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingCustomer}>
                  {submittingCustomer ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Customer'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Jobs;


