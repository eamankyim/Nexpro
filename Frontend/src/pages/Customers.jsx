import { useState, useEffect } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Table, Tag, List, Space, Spin, Empty } from 'antd';
import { Plus, Search, Loader2 } from 'lucide-react';
import customerService from '../services/customerService';
import jobService from '../services/jobService';
import invoiceService from '../services/invoiceService';
import customDropdownService from '../services/customDropdownService';
import { useAuth } from '../context/AuthContext';
import ActionColumn from '../components/ActionColumn';
import DetailsDrawer from '../components/DetailsDrawer';
import PhoneNumberInput from '../components/PhoneNumberInput';
import StatusChip from '../components/StatusChip';
import TableSkeleton from '../components/TableSkeleton';
import DetailSkeleton from '../components/DetailSkeleton';
import { showSuccess, showError, showWarning, handleApiError } from '../utils/toast';
import dayjs from 'dayjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
}).refine((data) => {
  if (data.howDidYouHear === 'Referral') {
    return data.referralName && data.referralName.trim().length > 0;
  }
  return true;
}, {
  message: 'Referral name is required when Referral is selected',
  path: ['referralName'],
});

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchText, setSearchText] = useState('');
  const debouncedSearchText = useDebounce(searchText, 500);
  const { isManager, user, activeTenant } = useAuth();
  const businessType = activeTenant?.businessType || 'printing_press';
  const isPrintingPress = businessType === 'printing_press';
  const [showReferralName, setShowReferralName] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [customerJobs, setCustomerJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [customCustomerSources, setCustomCustomerSources] = useState([]);
  const [showCustomerSourceOtherInput, setShowCustomerSourceOtherInput] = useState(false);
  const [customerSourceOtherValue, setCustomerSourceOtherValue] = useState('');

  const form = useForm({
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

  const howDidYouHear = form.watch('howDidYouHear');

  useEffect(() => {
    fetchCustomers();
  }, [pagination.current, pagination.pageSize, debouncedSearchText]);

  useEffect(() => {
    const loadCustomOptions = async () => {
      try {
        const [sources, regions] = await Promise.all([
          customDropdownService.getCustomOptions('customer_source'),
          customDropdownService.getCustomOptions('region')
        ]);
        setCustomCustomerSources(sources || []);
      } catch (error) {
        console.error('Failed to load custom options:', error);
      }
    };
    loadCustomOptions();
  }, []);

  useEffect(() => {
    setShowReferralName(howDidYouHear === 'Referral');
    if (howDidYouHear !== 'Referral') {
      form.setValue('referralName', '');
    }
  }, [howDidYouHear, form]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await customerService.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        search: debouncedSearchText,
      });
      
      // Handle response structure (API interceptor returns response.data)
      if (response?.success !== false && response?.data) {
        setCustomers(Array.isArray(response.data) ? response.data : []);
        setPagination({ ...pagination, total: response.count || 0 });
      } else {
        // If response structure is unexpected, try to extract data
        setCustomers(Array.isArray(response) ? response : []);
        setPagination({ ...pagination, total: response?.count || 0 });
      }
    } catch (error) {
      handleApiError(error, { context: 'load customers' });
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingCustomer(null);
    form.reset({
      name: '',
      company: '',
      email: '',
      phone: '',
      address: '',
      howDidYouHear: '',
      referralName: '',
    });
    setShowReferralName(false);
    setShowCustomerSourceOtherInput(false);
    setCustomerSourceOtherValue('');
    setModalVisible(true);
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    form.reset(customer);
    setShowReferralName(customer.howDidYouHear === 'Referral');
    setModalVisible(true);
  };

  const handleHowDidYouHearChange = (value) => {
    // Don't set form value here - it's already set by field.onChange
    if (value === '__OTHER__') {
      setShowCustomerSourceOtherInput(true);
      setShowReferralName(false);
      form.setValue('referralName', '');
    } else {
      setShowCustomerSourceOtherInput(false);
      setShowReferralName(value === 'Referral');
      if (value !== 'Referral') {
        form.setValue('referralName', '');
      }
    }
  };

  const handleSaveCustomCustomerSource = async () => {
    if (!customerSourceOtherValue || !customerSourceOtherValue.trim()) {
      showWarning('Please enter a source name');
      return;
    }

    try {
      const saved = await customDropdownService.saveCustomOption('customer_source', customerSourceOtherValue.trim());
      if (saved && saved.value) {
        setCustomCustomerSources(prev => {
          if (prev.find(s => s.value === saved.value)) {
            return prev;
          }
          return [...prev, saved];
        });
        
        form.setValue('howDidYouHear', saved.value);
        setShowCustomerSourceOtherInput(false);
        setCustomerSourceOtherValue('');
        showSuccess(`"${saved.label || saved.value}" added to sources`);
      } else {
        showWarning('Saved option but received invalid response. Please try again.');
      }
    } catch (error) {
      handleApiError(error, { context: 'save custom source' });
    }
  };


  const handleView = async (customer) => {
    setViewingCustomer(customer);
    setDrawerVisible(true);
    
    if (isPrintingPress) {
      setLoadingJobs(true);
      try {
        const response = await jobService.getAll({
          customerId: customer.id,
          limit: 50
        });
        setCustomerJobs(response.data || []);
      } catch (error) {
        console.error('Failed to load customer jobs:', error);
        setCustomerJobs([]);
      } finally {
        setLoadingJobs(false);
      }
    } else {
      setCustomerJobs([]);
    }

    setLoadingInvoices(true);
    try {
      const response = await invoiceService.getAll({
        customerId: customer.id,
        limit: 50
      });
      setCustomerInvoices(response.data || []);
    } catch (error) {
      console.error('Failed to load customer invoices:', error);
      setCustomerInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setViewingCustomer(null);
    setCustomerJobs([]);
    setCustomerInvoices([]);
  };

  const handleDelete = async (id) => {
    try {
      await customerService.delete(id);
      showSuccess('Customer deleted successfully');
      fetchCustomers();
    } catch (error) {
      handleApiError(error, { context: 'delete customer' });
    }
  };

  const onSubmit = async (values) => {
    try {
      if (values.howDidYouHear === '__OTHER__') {
        if (!customerSourceOtherValue || !customerSourceOtherValue.trim()) {
          showError('Please enter and save a custom source before submitting');
          return;
        }
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
      
      let response;
      if (editingCustomer) {
        response = await customerService.update(editingCustomer.id, values);
      } else {
        response = await customerService.create(values);
      }
      
      // Check if response indicates success
      if (response && (response.success === true || response.data)) {
        showSuccess(editingCustomer ? 'Customer updated successfully' : 'Customer created successfully');
        setModalVisible(false);
        form.reset();
        fetchCustomers();
      } else if (response && response.success === false) {
        // Explicit failure response
        const errorMessage = response.error || response.message || 'Operation failed';
        showError(errorMessage);
      } else {
        // Unexpected response structure
        console.warn('Unexpected response structure:', response);
        showSuccess(editingCustomer ? 'Customer updated successfully' : 'Customer created successfully');
        setModalVisible(false);
        form.reset();
        fetchCustomers();
      }
    } catch (error) {
      // Only show error if it's a real error (not a false positive from interceptor)
      console.error('Customer operation error:', error);
      handleApiError(error, { context: editingCustomer ? 'update customer' : 'create customer' });
    }
  };

  const handleSearch = (value) => {
    setSearchText(value);
    setPagination({ ...pagination, current: 1 });
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Company',
      dataIndex: 'company',
      key: 'company',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: 'Source',
      dataIndex: 'howDidYouHear',
      key: 'howDidYouHear',
      render: (source) => {
        if (!source) return '-';
        const colors = {
          'Signboard': 'blue',
          'Referral': 'green',
          'Social Media': 'purple',
          'Market Outreach': 'orange'
        };
        return <Badge variant="outline">{source}</Badge>;
      }
    },
    {
      title: 'Balance',
      dataIndex: 'balance',
      key: 'balance',
      render: (balance) => `GHS ${parseFloat(balance || 0).toFixed(2)}`,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) => (
        <Badge variant={isActive ? 'default' : 'destructive'}>
          {isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => <ActionColumn onView={handleView} record={record} />,
    },
  ];

  const defaultSources = [
    { group: 'Social Media', items: ['Facebook', 'Instagram', 'Twitter', 'LinkedIn', 'TikTok', 'WhatsApp'] },
    { group: 'Online', items: ['Google Search', 'Website', 'Online Ad'] },
    { group: 'Physical', items: ['Signboard', 'Walk-in', 'Market Outreach', 'Flyer/Brochure'] },
    { group: 'Personal', items: ['Referral', 'Existing Customer'] },
    { group: 'Other', items: ['Radio', 'TV', 'Newspaper', 'Event/Trade Show'] },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold">Customers</h1>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
            placeholder="Search customers..."
              value={searchText}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 w-full sm:w-[250px]"
            />
          </div>
          {(isManager || user?.role === 'staff') && (
            <Button onClick={handleAdd} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <Card>
          <div className="p-4">
            <TableSkeleton rows={8} cols={6} />
          </div>
        </Card>
      ) : (
        <Table
          columns={columns}
          dataSource={customers}
          rowKey="id"
          pagination={pagination}
          onChange={(newPagination) => setPagination(newPagination)}
          scroll={{ x: 'max-content' }}
        />
      )}

      <Dialog open={modalVisible} onOpenChange={setModalVisible}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
            <DialogDescription>
              {editingCustomer ? 'Update customer information' : 'Add a new customer to your system'}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter customer name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter company name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="email@example.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <PhoneNumberInput {...field} placeholder="Enter phone number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} placeholder="Enter street address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="howDidYouHear" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>How did you hear about us?</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={(value) => {
                        field.onChange(value);
                        handleHowDidYouHearChange(value);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {defaultSources.map(group => (
                          <div key={group.group}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                              {group.group}
                            </div>
                            {group.items.map(item => (
                              <SelectItem key={item} value={item}>{item}</SelectItem>
                            ))}
                          </div>
                        ))}
                  {customCustomerSources.length > 0 && (
                          <div>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                              Custom Sources
                            </div>
                      {customCustomerSources.map(source => (
                              <SelectItem key={source.value} value={source.value}>
                                {source.label}
                              </SelectItem>
                            ))}
                          </div>
                        )}
                        <div>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            Other
                          </div>
                          <SelectItem value="__OTHER__">Other (specify)</SelectItem>
                        </div>
                      </SelectContent>
                </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {showCustomerSourceOtherInput && (
                <div className="flex gap-2">
                    <Input
                      placeholder="e.g., Billboard, Magazine Ad"
                      value={customerSourceOtherValue}
                      onChange={(e) => setCustomerSourceOtherValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveCustomCustomerSource();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button type="button" onClick={handleSaveCustomCustomerSource}>
                      Save
                    </Button>
                </div>
              )}

          {showReferralName && (
                <FormField
                  control={form.control}
                  name="referralName" 
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referral Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter referral name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setModalVisible(false);
                    setShowCustomerSourceOtherInput(false);
                    setCustomerSourceOtherValue('');
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingCustomer ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
        </Form>
        </DialogContent>
      </Dialog>

      <DetailsDrawer
        open={drawerVisible}
        onClose={handleCloseDrawer}
        title="Customer Details"
        width={800}
        onEdit={isManager && viewingCustomer ? () => {
          handleEdit(viewingCustomer);
          setDrawerVisible(false);
        } : null}
        onDelete={isManager && viewingCustomer ? () => {
          handleDelete(viewingCustomer.id);
          setDrawerVisible(false);
        } : null}
        deleteConfirmText="Are you sure you want to delete this customer?"
        tabs={viewingCustomer ? [
          {
            key: 'details',
            label: 'Details',
            content: (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Name</Label>
                    <p className="font-medium">{viewingCustomer.name || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Company</Label>
                    <p className="font-medium">{viewingCustomer.company || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{viewingCustomer.email || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium">{viewingCustomer.phone || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Address</Label>
                    <p className="font-medium">{viewingCustomer.address || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">City</Label>
                    <p className="font-medium">{viewingCustomer.city || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">How did you hear about us?</Label>
                    <p className="font-medium">
                  {viewingCustomer.howDidYouHear ? (
                        <Badge variant="outline">{viewingCustomer.howDidYouHear}</Badge>
                  ) : '-'}
                    </p>
                  </div>
                {viewingCustomer.howDidYouHear === 'Referral' && (
                    <div>
                      <Label className="text-muted-foreground">Referral Name</Label>
                      <p className="font-medium">{viewingCustomer.referralName || '-'}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-muted-foreground">Balance</Label>
                    <p className="font-medium">GHS {parseFloat(viewingCustomer.balance || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <p className="font-medium">
                      <Badge variant={viewingCustomer.isActive ? 'default' : 'destructive'}>
                    {viewingCustomer.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Created At</Label>
                    <p className="font-medium">
                  {viewingCustomer.createdAt ? new Date(viewingCustomer.createdAt).toLocaleString() : '-'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Last Updated</Label>
                    <p className="font-medium">
                  {viewingCustomer.updatedAt ? new Date(viewingCustomer.updatedAt).toLocaleString() : '-'}
                    </p>
                  </div>
                </div>
              </div>
            )
          },
          ...(isPrintingPress ? [{
            key: 'activities',
            label: 'Activities',
            content: (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Jobs ({customerJobs.length})</h3>
                {loadingJobs ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : customerJobs.length > 0 ? (
                  <div className="space-y-3">
                    {customerJobs.map((job) => (
                      <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-semibold">{job.jobNumber} - {job.title}</div>
                          <p className="text-sm text-muted-foreground mt-1">{job.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Due: {job.dueDate ? new Date(job.dueDate).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant="outline">
                            {job.status?.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <div className="font-bold">GHS {parseFloat(job.finalPrice || 0).toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty description="No jobs found for this customer" />
                )}
              </div>
            )
          }] : []),
          {
            key: 'invoices',
            label: 'Invoices',
            content: (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Invoices ({customerInvoices.length})</h3>
                {loadingInvoices ? (
                  <div className="py-12">
                    <TableSkeleton rows={3} cols={4} />
                  </div>
                ) : customerInvoices.length > 0 ? (
                  <div className="space-y-3">
                    {customerInvoices.map((invoice) => (
                      <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-semibold">{invoice.invoiceNumber}</div>
                          {isPrintingPress && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {invoice.job?.title || 'No job linked'}
                            </p>
                          )}
                          <div className="text-xs text-muted-foreground mt-1 space-y-1">
                            <p>Due: {invoice.dueDate ? dayjs(invoice.dueDate).format('MMM DD, YYYY') : 'N/A'}</p>
                            <p>Balance: GHS {parseFloat(invoice.balance || 0).toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <StatusChip status={invoice.status} />
                          <div className="text-right">
                            <div className="font-bold text-lg">GHS {parseFloat(invoice.totalAmount || 0).toFixed(2)}</div>
                            <div className="text-sm text-green-600">
                            Paid: GHS {parseFloat(invoice.amountPaid || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty description="No invoices found for this customer" />
                )}
              </div>
            )
          }
        ] : null}
      />
    </div>
  );
};

export default Customers;
