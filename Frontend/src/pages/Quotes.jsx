import { useEffect, useState, useMemo, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Table, InputNumber } from 'antd';
import {
  Plus,
  Search,
  FileText,
  FilePlus,
  CheckCircle,
  Printer,
  Download,
  Loader2,
  X
} from 'lucide-react';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import quoteService from '../services/quoteService';
import customerService from '../services/customerService';
import ActionColumn from '../components/ActionColumn';
import DetailsDrawer from '../components/DetailsDrawer';
import PrintableInvoice from '../components/PrintableInvoice';
import StatusChip from '../components/StatusChip';
import TableSkeleton from '../components/TableSkeleton';
import DetailSkeleton from '../components/DetailSkeleton';
import { showSuccess, showError } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Descriptions, DescriptionItem } from '@/components/ui/descriptions';
import { DatePicker } from '@/components/ui/date-picker';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';


const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' }
];

const quoteItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0, 'Unit price must be at least 0'),
  discountAmount: z.number().min(0, 'Discount must be at least 0').default(0),
});

const quoteSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  title: z.string().min(1, 'Quote title is required'),
  description: z.string().optional(),
  status: z.enum(['draft', 'sent', 'accepted', 'declined', 'expired']).default('draft'),
  validUntil: z.date().optional().nullable(),
  notes: z.string().optional(),
  items: z.array(quoteItemSchema).min(1, 'At least one item is required'),
});

const Quotes = () => {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ search: '', status: 'all', customerId: null });
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingQuote, setViewingQuote] = useState(null);
  const [quoteModalVisible, setQuoteModalVisible] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [converting, setConverting] = useState(false);
  const navigate = useNavigate();
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [quotePrintable, setQuotePrintable] = useState(null);
  const [pendingDownload, setPendingDownload] = useState(false);
  const [deleteQuoteId, setDeleteQuoteId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      customerId: '',
      title: '',
      description: '',
      status: 'draft',
      validUntil: null,
      notes: '',
      items: [{ description: '', quantity: 1, unitPrice: 0, discountAmount: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

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

      const response = await quoteService.getAll(params);
      const quoteList = Array.isArray(response?.data) ? response.data : [];
      const totalCount = Number.isFinite(response?.count) ? response.count : quoteList.length;

      setQuotes(quoteList);
      setPagination((prev) => ({ ...prev, total: totalCount }));
    } catch (error) {
      console.error('Failed to load quotes:', error);
      showError(error, 'Failed to load quotes');
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
      showError(error, 'Failed to fetch quote details');
      return null;
    }
  };

  const handleView = async (quote) => {
    setViewingQuote(quote);
    setDrawerVisible(true);
    const details = await fetchQuoteDetails(quote.id);
    if (details) {
      setViewingQuote(details);
    }
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setViewingQuote(null);
  };

  const handleAddQuote = async () => {
    form.reset({
      customerId: '',
      title: '',
      description: '',
      status: 'draft',
      validUntil: null,
      notes: '',
      items: [{ description: '', quantity: 1, unitPrice: 0, discountAmount: 0 }],
    });
    setEditingQuote(null);
    setQuoteModalVisible(true);
    try {
      const customersResponse = await customerService.getAll({ limit: 100 });
      setCustomers(customersResponse.data || []);
    } catch (error) {
      console.error('Failed to load customers for new quote:', error);
      showError(error, 'Failed to load customers');
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
      showError(error, 'Failed to load customers');
    }

    form.reset({
      customerId: details.customerId,
      title: details.title,
      description: details.description || '',
      status: details.status,
      validUntil: details.validUntil ? new Date(details.validUntil) : null,
      notes: details.notes || '',
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
    setDeleteQuoteId(quote.id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteQuoteId) return;
    try {
      await quoteService.delete(deleteQuoteId);
      showSuccess('Quote deleted successfully');
      fetchQuotes();
      if (viewingQuote?.id === deleteQuoteId) {
        handleCloseDrawer();
      }
      setDeleteDialogOpen(false);
      setDeleteQuoteId(null);
    } catch (error) {
      showError(error, error.error || 'Failed to delete quote');
    }
  };

  const onSubmit = async (values) => {
    const payload = {
      customerId: values.customerId,
      title: values.title,
      description: values.description,
      status: values.status,
      validUntil: values.validUntil ? dayjs(values.validUntil).format('YYYY-MM-DD') : null,
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
        showSuccess('Quote updated successfully');
      } else {
        await quoteService.create(payload);
        showSuccess('Quote created successfully');
      }
      setQuoteModalVisible(false);
      form.reset();
      fetchQuotes();
    } catch (error) {
      console.error('Failed to save quote:', error);
      showError(error, error.error || 'Failed to save quote');
    }
  };

  const handleConvertToJob = async (quote) => {
    setConverting(true);
    try {
      const response = await quoteService.convertToJob(quote.id);
      const data = response?.data ?? response;
      const job = data?.data?.job ?? data?.job ?? data;
      showSuccess(`Quote converted to job ${job?.jobNumber || ''}`.trim());
      fetchQuotes();
      if (job) {
        navigate('/jobs');
      }
    } catch (error) {
      console.error('Failed to convert quote to job:', error);
      showError(error, error.error || 'Failed to convert quote to job');
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
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.querySelector('.printable-invoice');
      if (!element) {
        if (!silent) {
          showError(null, 'Preview the quote before downloading');
        }
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
        showSuccess('Quote downloaded successfully');
      }
    } catch (error) {
      console.error('Error generating quote PDF:', error);
      if (!silent) {
        showError(error, 'Failed to download quote');
      }
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
        <StatusChip status={status} />
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
      render: (amount) => `GHS ${parseFloat(amount || 0).toFixed(2)}`
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
              icon: <FilePlus className="h-4 w-4" />,
              disabled: converting
            },
            {
              label: 'Edit',
              onClick: () => handleEditQuote(record),
              icon: <FileText className="h-4 w-4" />
            },
            {
              label: 'Delete',
              onClick: () => handleDeleteQuote(record),
              icon: <CheckCircle className="h-4 w-4" />,
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
            <div className="text-muted-foreground text-sm">{viewingQuote.customer.company}</div>
          )}
        </div>
      )
    },
    {
      label: 'Status',
      value: (
        <StatusChip status={viewingQuote.status} />
      )
    },
    {
      label: 'Valid Until',
      value: viewingQuote.validUntil ? dayjs(viewingQuote.validUntil).format('MMM DD, YYYY') : '—'
    },
    {
      label: 'Total Amount',
      value: (
        <strong className="text-lg text-primary">
          GHS {parseFloat(viewingQuote.totalAmount || 0).toFixed(2)}
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold">Quotes</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search quotes..."
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              className="pl-10 w-[200px]"
            />
          </div>
          <Select
            value={filters.status}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value || 'all' }))}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {statusOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAddQuote}>
            <Plus className="h-4 w-4 mr-2" />
            New Quote
          </Button>
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
          dataSource={quotes}
          rowKey="id"
          pagination={pagination}
          onChange={(newPagination) => setPagination((prev) => ({ ...prev, ...newPagination }))}
        />
      )}

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
              <div className="space-y-4">
                <Card className="bg-primary/5">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-lg font-semibold">{viewingQuote.title}</div>
                        <div className="text-muted-foreground">{viewingQuote.quoteNumber}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Total Amount</div>
                        <div className="text-2xl font-bold text-primary">
                          GHS {parseFloat(viewingQuote.totalAmount || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Descriptions column={1}>
                  {drawerFields.map((field) => (
                    <DescriptionItem key={field.label} label={field.label}>
                      {field.value || '—'}
                    </DescriptionItem>
                  ))}
                </Descriptions>
              </div>
            )
          },
          {
            key: 'items',
            label: 'Line Items',
            content: (
              <div className="space-y-4">
                {(viewingQuote.items || []).length ? (
                  <div className="space-y-3">
                    {viewingQuote.items.map((item) => (
                      <Card key={item.id}>
                        <CardContent className="pt-6">
                          <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-6">
                              <div className="font-semibold">{item.description}</div>
                              {item.metadata && Object.keys(item.metadata || {}).length > 0 && (
                                <div className="text-muted-foreground text-xs mt-1">
                                  {JSON.stringify(item.metadata)}
                                </div>
                              )}
                            </div>
                            <div className="col-span-2 text-right">
                              <div className="text-muted-foreground text-sm">Qty</div>
                              <div>{item.quantity}</div>
                            </div>
                            <div className="col-span-2 text-right">
                              <div className="text-muted-foreground text-sm">Unit Price</div>
                              <div>GHS {parseFloat(item.unitPrice || 0).toFixed(2)}</div>
                            </div>
                            <div className="col-span-2 text-right">
                              <div className="text-muted-foreground text-sm">Total</div>
                              <div className="font-semibold">
                                GHS {parseFloat(item.total || 0).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    <Card>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="font-semibold">Subtotal</div>
                            <div className="font-semibold">Total Discount</div>
                            <div className="font-semibold">Grand Total</div>
                          </div>
                          <div className="text-right">
                            <div>GHS {parseFloat(viewingQuote.subtotal || 0).toFixed(2)}</div>
                            <div>-GHS {parseFloat(viewingQuote.discountTotal || 0).toFixed(2)}</div>
                            <div className="text-lg font-bold">
                              GHS {parseFloat(viewingQuote.totalAmount || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>No line items found for this quote.</AlertDescription>
                  </Alert>
                )}
              </div>
            )
          }
        ] : []}
      />

      <Dialog open={quoteModalVisible} onOpenChange={setQuoteModalVisible}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuote ? `Edit Quote (${editingQuote.quoteNumber})` : 'Create Quote'}</DialogTitle>
            <DialogDescription>
              {editingQuote ? 'Update quote details' : 'Create a new quote for a customer'}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name} {customer.company ? `(${customer.company})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {statusOptions.map((option) => (
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quote Title</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Quote title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="validUntil"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valid Until</FormLabel>
                      <FormControl>
                        <DatePicker
                          date={field.value}
                          onSelect={(date) => field.onChange(date)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} placeholder="Describe the work or specifications" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator>Quote Items</Separator>

              {fields.map((field, index) => (
                <Card key={field.id}>
                  <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <CardTitle className="text-base">Item {index + 1}</CardTitle>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Item description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity</FormLabel>
                            <FormControl>
                              <InputNumber
                                min={1}
                                style={{ width: '100%' }}
                                value={field.value}
                                onChange={(value) => field.onChange(value)}
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
                              <InputNumber
                                min={0}
                                prefix="GHS "
                                style={{ width: '100%' }}
                                value={field.value}
                                onChange={(value) => field.onChange(value)}
                              />
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
                              <InputNumber
                                min={0}
                                prefix="GHS "
                                style={{ width: '100%' }}
                                value={field.value}
                                onChange={(value) => field.onChange(value)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button
                type="button"
                variant="dashed"
                onClick={() => append({ description: '', quantity: 1, unitPrice: 0, discountAmount: 0 })}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} placeholder="Notes for internal reference" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setQuoteModalVisible(false);
                    setEditingQuote(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingQuote ? 'Update Quote' : 'Create Quote'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={printModalVisible} onOpenChange={setPrintModalVisible}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between w-full">
              <span>Quote Preview</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleDownloadQuote(quotePrintable)}
                  disabled={!quotePrintable}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  onClick={handlePrintQuote}
                  disabled={!quotePrintable}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          {quotePrintable && (
            <PrintableInvoice
              invoice={buildPrintableQuote(quotePrintable)}
              documentTitle="PROFORMA INVOICE"
              documentSubtitle={`Quote ${quotePrintable.quoteNumber}`}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quote</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this quote? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Quotes;
