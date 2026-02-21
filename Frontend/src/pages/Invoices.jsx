import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Currency, FileText, Clock, CheckCircle, Printer, Download, Loader2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import invoiceService from '../services/invoiceService';
import settingsService from '../services/settingsService';
import { useAuth } from '../context/AuthContext';
import ActionColumn from '../components/ActionColumn';
import DashboardTable from '../components/DashboardTable';
import ViewToggle from '../components/ViewToggle';
import DetailsDrawer from '../components/DetailsDrawer';
import MobileFormDialog from '../components/MobileFormDialog';
import PrintableInvoice from '../components/PrintableInvoice';
import StatusChip from '../components/StatusChip';
import DetailSkeleton from '../components/DetailSkeleton';
import { showSuccess, showError } from '../utils/toast';
import dayjs from 'dayjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DashboardStatsCard from '../components/DashboardStatsCard';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
import { STUDIO_LIKE_TYPES } from '../constants';

const paymentSchema = z.object({
  amount: z.number().min(0.01, 'Payment amount must be greater than 0'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  paymentDate: z.date(),
  referenceNumber: z.string().optional(),
});

const Invoices = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ status: '' });
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [stats, setStats] = useState(null);
  const { isManager, activeTenant } = useAuth();
  const businessType = activeTenant?.businessType || 'printing_press';
  const isPrintingPress = businessType === 'printing_press';
  const isStudioLike = STUDIO_LIKE_TYPES.includes(businessType);
  const [tableViewMode, setTableViewMode] = useState('table');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [markingAsPaid, setMarkingAsPaid] = useState(false);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);

  // Organization branding for printable invoices
  const { data: organizationData } = useQuery({
    queryKey: ['settings', 'organization'],
    queryFn: () => settingsService.getOrganization(),
    staleTime: 5 * 60 * 1000,
  });

  const organization = organizationData?.data || {};

  const paymentForm = useForm({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: 0,
      paymentMethod: 'cash',
      paymentDate: new Date(),
      referenceNumber: '',
    },
  });

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const cleanFilters = {};
      if (filters.status) cleanFilters.status = filters.status;

      const response = await invoiceService.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        ...cleanFilters,
      });
      setInvoices(response.data);
      setPagination(prev => ({ ...prev, total: response.count }));
    } catch (error) {
      showError(error, 'Failed to load invoices');
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

  useEffect(() => {
    if (location.state?.openInvoiceId && invoices.length > 0) {
      const invoiceToOpen = invoices.find(inv => inv.id === location.state.openInvoiceId);
      if (invoiceToOpen) {
        navigate(location.pathname, { replace: true, state: {} });
        handleView(invoiceToOpen);
      } else {
        const fetchSpecificInvoice = async () => {
          try {
            const response = await invoiceService.getById(location.state.openInvoiceId);
            if (response.data) {
              navigate(location.pathname, { replace: true, state: {} });
              handleView(response.data);
            }
          } catch (error) {
            console.error('Failed to load specific invoice:', error);
            navigate(location.pathname, { replace: true, state: {} });
          }
        };
        fetchSpecificInvoice();
      }
    }
  }, [location.state, invoices]);

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
      const html2pdf = (await import('html2pdf.js')).default;
      const invoiceElement = document.querySelector('.printable-invoice');
      
      if (!invoiceElement) {
        showError(null, 'Invoice not found');
        return;
      }
      
      const opt = {
        margin: 0,
        filename: `Invoice_${viewingInvoice.invoiceNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      await html2pdf()
        .set(opt)
        .from(invoiceElement)
        .save();
      
      showSuccess('PDF downloaded successfully!');
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      showError(error, 'Failed to generate PDF. Please try again.');
    }
  };

  const handleRecordPayment = (invoice) => {
    setViewingInvoice(invoice);
    paymentForm.reset({
      amount: parseFloat(invoice.balance),
      paymentMethod: 'cash',
      paymentDate: new Date(),
      referenceNumber: '',
    });
    setPaymentModalVisible(true);
  };

  const handleMarkAsPaid = async (invoice) => {
    try {
      setMarkingAsPaid(true);
      const response = await invoiceService.markAsPaid(invoice.id);
      const updatedInvoice = response?.data;

      if (updatedInvoice && viewingInvoice?.id === updatedInvoice.id) {
        setViewingInvoice(updatedInvoice);
      }

      showSuccess(response?.message || 'Invoice marked as paid');
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.error ||
        error?.message ||
        'Failed to mark invoice as paid';
      showError(error, errorMessage);
    } finally {
      setMarkingAsPaid(false);
    }
  };

  const onPaymentSubmit = async (values) => {
    try {
      await invoiceService.recordPayment(viewingInvoice.id, {
        ...values,
        paymentDate: dayjs(values.paymentDate).format('YYYY-MM-DD')
      });
      showSuccess('Payment recorded successfully');
      setPaymentModalVisible(false);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      showError(error, error.error || 'Failed to record payment');
    }
  };

  const handleSendInvoice = async (id) => {
    try {
      setSendingInvoice(true);
      await invoiceService.send(id);
      showSuccess('Invoice marked as sent');
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      showError(error, 'Failed to send invoice');
    } finally {
      setSendingInvoice(false);
    }
  };

  const handleCancelInvoice = async (id) => {
    try {
      await invoiceService.cancel(id);
      showSuccess('Invoice cancelled');
      setRefreshTrigger(prev => prev + 1);
      if (drawerVisible) handleCloseDrawer();
    } catch (error) {
      showError(error, 'Failed to cancel invoice');
    }
  };

  const handleDeleteInvoice = async (id) => {
    try {
      await invoiceService.delete(id);
      showSuccess('Draft invoice deleted');
      setInvoiceToDelete(null);
      setRefreshTrigger(prev => prev + 1);
      if (viewingInvoice?.id === id) handleCloseDrawer();
    } catch (error) {
      showError(error, 'Failed to delete invoice');
    }
  };

  const tableColumns = useMemo(() => [
    {
      key: 'invoiceNumber',
      label: 'Invoice #',
      render: (_, record) => record.invoiceNumber,
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (_, record) => (
        <div>
          <div>{record.customer?.name}</div>
          {record.customer?.company && (
            <div className="text-muted-foreground text-xs">{record.customer.company}</div>
          )}
        </div>
      ),
    },
    ...(isPrintingPress ? [{
      key: 'job',
      label: 'Job',
      render: (_, record) => record.job?.jobNumber || '-',
    }] : []),
    {
      key: 'invoiceDate',
      label: 'Invoice Date',
      render: (_, record) => dayjs(record.invoiceDate).format('MMM DD, YYYY'),
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      render: (_, record) => dayjs(record.dueDate).format('MMM DD, YYYY'),
    },
    {
      key: 'totalAmount',
      label: 'Total',
      render: (_, record) => `₵ ${parseFloat(record.totalAmount || 0).toFixed(2)}`,
    },
    {
      key: 'balance',
      label: 'Balance',
      render: (_, record) => {
        const balance = parseFloat(record.balance || 0);
        return (
          <span className={`font-bold ${balance > 0 ? 'text-orange-500' : 'text-green-500'}`}>
            ₵ {balance.toFixed(2)}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, record) => <StatusChip status={record.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
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
              key: 'send',
              label: 'Send',
              onClick: () => handleSendInvoice(record.id)
            }
          ].filter(Boolean)}
        />
      ),
    },
  ], [isPrintingPress, isManager, handleView, handleRecordPayment, handleMarkAsPaid, handleSendInvoice]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Invoices</h1>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardStatsCard
            tooltip="Total amount received from paid invoices"
            title="Total Revenue"
            value={parseFloat(stats.totalRevenue || 0).toFixed(2)}
            valuePrefix="₵ "
            prefix={<CheckCircle className="h-4 w-4 text-green-500 inline mr-1" />}
          />
          <DashboardStatsCard
            tooltip="Amount still owed by customers"
            title="Outstanding"
            value={parseFloat(stats.outstandingAmount || 0).toFixed(2)}
            valuePrefix="₵ "
            prefix={<Clock className="h-4 w-4 text-orange-500 inline mr-1" />}
          />
          <DashboardStatsCard
            tooltip="Invoices that have been fully paid"
            title="Paid Invoices"
            value={stats.paidInvoices || 0}
            prefix={<FileText className="h-4 w-4 text-green-500 inline mr-1" />}
          />
          <DashboardStatsCard
            tooltip="Invoices past due date"
            title="Overdue"
            value={stats.overdueInvoices || 0}
            prefix={<FileText className="h-4 w-4 text-red-500 inline mr-1" />}
          />
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <ViewToggle value={tableViewMode} onChange={setTableViewMode} />
          <Select
            value={filters.status}
            onValueChange={(value) => setFilters({ ...filters, status: value || '' })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DashboardTable
        data={invoices}
        columns={tableColumns}
        loading={loading}
        title={null}
        emptyIcon={<FileText className="h-12 w-12 text-muted-foreground" />}
        emptyDescription={
          isStudioLike
            ? "No invoices yet. Invoices are automatically created when you complete a job and generate an invoice from it."
            : "No invoices found. Create invoices from your sales or orders to track payments."
        }
        emptyAction={
          isStudioLike && (
            <Button onClick={() => navigate('/jobs')}>
              Go to Jobs
            </Button>
          )
        }
        pageSize={pagination.pageSize}
        externalPagination={{ current: pagination.current, total: pagination.total }}
        onPageChange={(newPagination) => setPagination(prev => ({ ...prev, ...newPagination }))}
        viewMode={tableViewMode}
        onViewModeChange={setTableViewMode}
      />

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
        deleteConfirmText={viewingInvoice?.status === 'draft' ? 'Are you sure you want to delete this draft invoice? This cannot be undone.' : 'Are you sure you want to cancel this invoice?'}
        onDelete={isManager && viewingInvoice?.status === 'draft' ? () => handleDeleteInvoice(viewingInvoice.id) : null}
        fields={viewingInvoice ? [
          { label: 'Invoice Number', value: viewingInvoice.invoiceNumber },
          { 
            label: 'Status', 
            value: viewingInvoice.status,
            render: (status) => (
              <StatusChip status={status} />
            )
          },
          { label: 'Customer', value: viewingInvoice.customer?.name },
          { label: 'Company', value: viewingInvoice.customer?.company || '-' },
          { label: 'Email', value: viewingInvoice.customer?.email || '-' },
          { label: 'Phone', value: viewingInvoice.customer?.phone || '-' },
          ...(isPrintingPress ? [
            { label: 'Job Number', value: viewingInvoice.job?.jobNumber },
            { label: 'Job Title', value: viewingInvoice.job?.title },
          ] : []),
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
                <div className="mt-2 space-y-2">
                  {items.map((item, idx) => (
                    <Card key={idx}>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-12 gap-4">
                          <div className="col-span-6">
                            <div className="font-semibold">{item.description || item.category}</div>
                            {item.paperSize && <div className="text-muted-foreground text-xs">Size: {item.paperSize}</div>}
                          </div>
                          <div className="col-span-2 text-right">
                            Qty: {item.quantity}
                          </div>
                          <div className="col-span-2 text-right">
                            ₵ {parseFloat(item.unitPrice || 0).toFixed(2)}
                          </div>
                          <div className="col-span-2 text-right">
                            <strong>₵ {parseFloat(item.total || 0).toFixed(2)}</strong>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              );
            }
          },
          { 
            label: 'Subtotal', 
            value: viewingInvoice.subtotal,
            render: (val) => `₵ ${parseFloat(val || 0).toFixed(2)}`
          },
          { 
            label: 'Tax', 
            value: viewingInvoice.taxAmount,
            render: (val) => `₵ ${parseFloat(val || 0).toFixed(2)} (${viewingInvoice.taxRate || 0}%)`
          },
          { 
            label: 'Discount', 
            value: viewingInvoice.discountAmount,
            render: (val) => {
              if (!val || val == 0) return '-';
              return `₵ ${parseFloat(val || 0).toFixed(2)} ${viewingInvoice.discountType === 'percentage' ? `(${viewingInvoice.discountValue}%)` : ''}`;
            }
          },
          { 
            label: 'Total Amount', 
            value: viewingInvoice.totalAmount,
            render: (val) => <strong className="text-lg text-primary">₵ {parseFloat(val || 0).toFixed(2)}</strong>
          },
          { 
            label: 'Amount Paid', 
            value: viewingInvoice.amountPaid,
            render: (val) => <span className="text-green-500">₵ {parseFloat(val || 0).toFixed(2)}</span>
          },
          { 
            label: 'Balance Due', 
            value: viewingInvoice.balance,
            render: (val) => <strong className={`text-lg ${val > 0 ? 'text-orange-500' : 'text-green-500'}`}>₵ {parseFloat(val || 0).toFixed(2)}</strong>
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

      <MobileFormDialog
        open={paymentModalVisible}
        onOpenChange={setPaymentModalVisible}
        title="Record Payment"
        description="Record a payment for this invoice"
        footer={
          viewingInvoice ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPaymentModalVisible(false)}
              >
                Cancel
              </Button>
              <Button form="payment-form" type="submit" disabled={paymentForm.formState.isSubmitting}>
                {paymentForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record Payment
              </Button>
            </>
          ) : null
        }
      >
        {viewingInvoice && (
          <>
            <Descriptions column={2} className="mb-6">
              <DescriptionItem label="Invoice">{viewingInvoice.invoiceNumber}</DescriptionItem>
              <DescriptionItem label="Customer">{viewingInvoice.customer?.name}</DescriptionItem>
              <DescriptionItem label="Total Amount">₵ {parseFloat(viewingInvoice.totalAmount).toFixed(2)}</DescriptionItem>
              <DescriptionItem label="Amount Paid">₵ {parseFloat(viewingInvoice.amountPaid || 0).toFixed(2)}</DescriptionItem>
              <DescriptionItem label="Balance Due" className="col-span-2">
                <strong className="text-lg text-orange-500">
                  ₵ {parseFloat(viewingInvoice.balance).toFixed(2)}
                </strong>
              </DescriptionItem>
            </Descriptions>

            <Form {...paymentForm}>
              <form id="payment-form" onSubmit={paymentForm.handleSubmit(onPaymentSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={paymentForm.control}
                    name="amount"
                    rules={[
                      {
                        validate: (value) => {
                          if (value > parseFloat(viewingInvoice.balance || 0)) {
                            return 'Amount exceeds balance due';
                          }
                          return true;
                        }
                      }
                    ]}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Amount</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₵ </span>
                            <Input
                              type="number"
                              min={0}
                              max={parseFloat(viewingInvoice.balance)}
                              step={0.01}
                              placeholder="0.00"
                              className="pl-8"
                              value={field.value === 0 ? '' : field.value}
                              onChange={(e) => {
                                const val = e.target.value;
                                field.onChange(val === '' ? 0 : parseFloat(val) || 0);
                              }}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={paymentForm.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="check">Check</SelectItem>
                            <SelectItem value="credit_card">Credit Card</SelectItem>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="momo">Mobile Money</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={paymentForm.control}
                    name="paymentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Date</FormLabel>
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
                  <FormField
                    control={paymentForm.control}
                    name="referenceNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reference Number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Transaction ref. number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </form>
            </Form>
          </>
        )}
      </MobileFormDialog>

      <Dialog open={printModalVisible} onOpenChange={setPrintModalVisible}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between w-full">
              <span>Print Invoice</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleDownloadInvoice}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  onClick={handlePrintInvoice}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          {viewingInvoice && (
            <PrintableInvoice
              invoice={viewingInvoice}
              organization={organization}
              onClose={() => {
                setPrintModalVisible(false);
                if (!drawerVisible) {
                  setViewingInvoice(null);
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!invoiceToDelete} onOpenChange={(open) => !open && setInvoiceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              {invoiceToDelete
                ? `Are you sure you want to delete draft invoice "${invoiceToDelete.invoiceNumber || invoiceToDelete.id}"? This cannot be undone.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => invoiceToDelete && handleDeleteInvoice(invoiceToDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Invoices;
