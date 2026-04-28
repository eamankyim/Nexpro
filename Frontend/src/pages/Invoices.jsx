import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Currency, FileText, Clock, CheckCircle, Printer, Download, Loader2, Share2, Copy, Archive, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import invoiceService from '../services/invoiceService';
import offlineQueueService from '../services/offlineQueueService';
import settingsService from '../services/settingsService';
import customerService from '../services/customerService';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
import { numberInputValue, handleNumberChange, numberOrEmptySchema } from '../utils/formUtils';

const paymentSchema = z.object({
  amount: numberOrEmptySchema(z).refine((v) => v >= 0.01, 'Payment amount must be greater than 0'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  paymentDate: z.date(),
  referenceNumber: z.string().optional(),
});

const markAsPaidSchema = z.object({
  paymentType: z.enum(['full', 'partial']),
  partialAmount: numberOrEmptySchema(z).optional(),
}).superRefine((values, ctx) => {
  if (values.paymentType === 'partial') {
    if (values.partialAmount == null || values.partialAmount < 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['partialAmount'],
        message: 'Part payment amount must be greater than 0',
      });
    }
  }
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
  const [markAsPaidModalVisible, setMarkAsPaidModalVisible] = useState(false);
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
  const [invoiceToCancel, setInvoiceToCancel] = useState(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [newInvoice, setNewInvoice] = useState({
    customerId: '',
    items: [{ description: '', quantity: 1, unitPrice: '', discountAmount: 0 }],
    dueDate: null,
    paymentTerms: 'Net 30',
    notes: '',
  });

  // Organization branding for printable invoices
  const { data: organizationData } = useQuery({
    queryKey: ['settings', 'organization'],
    queryFn: () => settingsService.getOrganization(),
    staleTime: 5 * 60 * 1000,
  });

  const organization = organizationData?.data?.data || organizationData?.data || {};

  const paymentForm = useForm({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: 0,
      paymentMethod: 'cash',
      paymentDate: new Date(),
      referenceNumber: '',
    },
  });

  const markAsPaidForm = useForm({
    resolver: zodResolver(markAsPaidSchema),
    defaultValues: {
      paymentType: 'full',
      partialAmount: 0,
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

  const loadCustomers = useCallback(async () => {
    try {
      const response = await customerService.getAll({ limit: 200 });
      setCustomers(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      showError(error, 'Failed to load customers');
    }
  }, []);

  const resetCreateInvoiceForm = useCallback(() => {
    setNewInvoice({
      customerId: '',
      items: [{ description: '', quantity: 1, unitPrice: '', discountAmount: '' }],
      dueDate: null,
      paymentTerms: 'Net 30',
      notes: '',
    });
  }, []);

  const handleOpenCreateModal = useCallback(async () => {
    if (customers.length === 0) {
      await loadCustomers();
    }
    resetCreateInvoiceForm();
    setCreateModalVisible(true);
  }, [customers.length, loadCustomers, resetCreateInvoiceForm]);

  const handleInvoiceItemChange = useCallback((index, field, value) => {
    setNewInvoice((prev) => {
      const nextItems = [...prev.items];
      nextItems[index] = { ...nextItems[index], [field]: value };
      return { ...prev, items: nextItems };
    });
  }, []);

  const handleAddInvoiceItem = useCallback(() => {
    setNewInvoice((prev) => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unitPrice: '', discountAmount: '' }],
    }));
  }, []);

  const handleRemoveInvoiceItem = useCallback((index) => {
    setNewInvoice((prev) => {
      if (prev.items.length <= 1) return prev;
      return {
        ...prev,
        items: prev.items.filter((_, i) => i !== index),
      };
    });
  }, []);

  const createInvoiceSubtotal = useMemo(
    () => (newInvoice.items || []).reduce((sum, item) => {
      const qty = parseFloat(item.quantity || 0);
      const unit = parseFloat(item.unitPrice || 0);
      return sum + (qty * unit);
    }, 0),
    [newInvoice.items]
  );

  const createInvoiceDiscountTotal = useMemo(
    () => (newInvoice.items || []).reduce((sum, item) => {
      const qty = parseFloat(item.quantity || 0);
      const unitDiscount = parseFloat(item.discountAmount || 0);
      return sum + (qty * unitDiscount);
    }, 0),
    [newInvoice.items]
  );

  const createInvoiceGrandTotal = useMemo(
    () => Math.max(0, createInvoiceSubtotal - createInvoiceDiscountTotal),
    [createInvoiceSubtotal, createInvoiceDiscountTotal]
  );

  const handleCreateInvoice = useCallback(async () => {
    if (!newInvoice.customerId) {
      showError(null, 'Select a customer');
      return;
    }

    const normalizedItems = (newInvoice.items || []).map((item) => {
      const quantity = parseFloat(item.quantity || 0);
      const unitPrice = parseFloat(item.unitPrice || 0);
      const unitDiscountAmount = parseFloat(item.discountAmount || 0);
      const lineDiscountAmount = quantity * unitDiscountAmount;
      const total = Math.max(0, (quantity * unitPrice) - lineDiscountAmount);
      return {
        description: String(item.description || '').trim(),
        quantity,
        unitPrice,
        discountAmount: unitDiscountAmount,
        discountScope: 'unit',
        total,
      };
    });

    if (normalizedItems.length === 0) {
      showError(null, 'Add at least one item');
      return;
    }

    const invalidItem = normalizedItems.find((item) => !item.description || item.quantity <= 0 || item.unitPrice < 0 || item.discountAmount < 0);
    if (invalidItem) {
      showError(null, 'Each item must have description, quantity > 0, and valid prices');
      return;
    }

    setCreatingInvoice(true);
    try {
      await invoiceService.create({
        customerId: newInvoice.customerId,
        items: normalizedItems,
        dueDate: newInvoice.dueDate || undefined,
        paymentTerms: newInvoice.paymentTerms || 'Net 30',
        notes: newInvoice.notes?.trim() || undefined,
      });
      showSuccess('Invoice created');
      setCreateModalVisible(false);
      setRefreshTrigger((prev) => prev + 1);
      resetCreateInvoiceForm();
    } catch (error) {
      showError(error, 'Failed to create invoice');
    } finally {
      setCreatingInvoice(false);
    }
  }, [newInvoice, resetCreateInvoiceForm]);

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

  const handleOpenMarkAsPaid = (invoice) => {
    setViewingInvoice(invoice);
    const balance = parseFloat(invoice?.balance || 0);
    markAsPaidForm.reset({
      paymentType: 'full',
      partialAmount: balance > 0 ? balance : 0,
    });
    setMarkAsPaidModalVisible(true);
  };

  const handleMarkAsPaid = async (values) => {
    if (!viewingInvoice) return;
    try {
      setMarkingAsPaid(true);
      let response;
      if (values.paymentType === 'partial') {
        const partialAmount = parseFloat(values.partialAmount || 0);
        const currentBalance = parseFloat(viewingInvoice.balance || 0);
        if (partialAmount > currentBalance) {
          showError(null, 'Part payment cannot be greater than the current balance');
          return;
        }
        response = await invoiceService.recordPayment(viewingInvoice.id, {
          amount: partialAmount,
          paymentMethod: 'cash',
          paymentDate: dayjs().format('YYYY-MM-DD'),
        });
      } else {
        response = await invoiceService.markAsPaid(viewingInvoice.id);
      }
      const updatedInvoice = response?.data;

      if (updatedInvoice && viewingInvoice?.id === updatedInvoice.id) {
        setViewingInvoice(updatedInvoice);
      }

      showSuccess(
        values.paymentType === 'partial'
          ? 'Part payment recorded successfully'
          : (response?.message || 'Invoice marked as paid')
      );
      setMarkAsPaidModalVisible(false);
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
      showSuccess('Invoice sent. Payment link is ready to share.');
      setRefreshTrigger(prev => prev + 1);
      if (viewingInvoice?.id === id) {
        const updated = await invoiceService.getById(id);
        const inv = updated?.data ?? updated;
        if (inv) setViewingInvoice(inv);
      }
    } catch (error) {
      showError(error, 'Failed to send invoice');
    } finally {
      setSendingInvoice(false);
    }
  };

  const paymentLink = useMemo(() => {
    if (!viewingInvoice?.paymentToken) return null;
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/pay-invoice/${viewingInvoice.paymentToken}`;
  }, [viewingInvoice?.paymentToken]);

  const handleCopyPaymentLink = useCallback(() => {
    if (!paymentLink) return;
    navigator.clipboard.writeText(paymentLink).then(() => showSuccess('Payment link copied to clipboard')).catch(() => showError('Could not copy link'));
  }, [paymentLink]);

  const invoiceDrawerPrimaryAction = useMemo(() => {
    if (!viewingInvoice) return null;
    return {
      label: 'View PDF',
      icon: <FileText className="h-4 w-4" />,
      onClick: () => handlePrint(viewingInvoice),
      disabled: false,
    };
  }, [viewingInvoice]);

  const invoiceDrawerMoreMenuItems = useMemo(() => {
    if (!viewingInvoice || !isManager) return [];
    const unpaid = viewingInvoice.status !== 'paid' && viewingInvoice.status !== 'cancelled';
    const items = [];
    if (unpaid) {
      items.push({
        key: 'share',
        label: sendingInvoice ? 'Sending...' : 'Share invoice',
        icon: <Share2 className="h-4 w-4" />,
        onClick: () => handleSendInvoice(viewingInvoice.id),
        disabled: sendingInvoice,
      });
    }
    if (paymentLink) {
      items.push({
        key: 'copyLink',
        label: 'Copy payment link',
        icon: <Copy className="h-4 w-4" />,
        onClick: handleCopyPaymentLink,
      });
    }
    if (unpaid) {
      items.push({
        key: 'markPaid',
        label: 'Mark as Paid',
        icon: <CheckCircle className="h-4 w-4" />,
        onClick: () => handleOpenMarkAsPaid(viewingInvoice),
        disabled: markingAsPaid,
      });
      items.push({
        key: 'cancel',
        label: 'Cancel Invoice',
        icon: <Archive className="h-4 w-4" />,
        onClick: () => setInvoiceToCancel(viewingInvoice),
        destructive: true,
      });
    }
    if (viewingInvoice.status === 'draft') {
      items.push({
        key: 'delete',
        label: 'Delete draft',
        icon: <Archive className="h-4 w-4" />,
        onClick: () => setInvoiceToDelete(viewingInvoice),
        destructive: true,
      });
    }
    return items;
  }, [viewingInvoice, isManager, paymentLink, sendingInvoice, markingAsPaid, handleSendInvoice, handleCopyPaymentLink]);

  const handleCancelInvoice = async (id) => {
    try {
      await invoiceService.cancel(id);
      setInvoiceToCancel(null);
      showSuccess('Invoice cancelled');
      setRefreshTrigger(prev => prev + 1);
      if (drawerVisible) handleCloseDrawer();
    } catch (error) {
      showError(error, 'Failed to cancel invoice');
    }
  };

  const handleDeleteInvoice = async (id) => {
    try {
      if (!navigator.onLine) {
        await offlineQueueService.queueAction(
          offlineQueueService.OFFLINE_ACTION_TYPES.INVOICE,
          'delete',
          { id }
        );
        showSuccess('Saved offline. Will sync when connected.');
      } else {
        await invoiceService.delete(id);
        showSuccess('Draft invoice deleted');
      }
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
      mobileDashboardPlacement: 'headerEnd',
      render: (_, record) => <StatusChip status={record.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, record) => (
        <ActionColumn onView={handleView} record={record} extraActions={[]} />
      ),
    },
  ], [isPrintingPress, handleView]);

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
            icon={CheckCircle}
            iconBgColor="rgba(34, 197, 94, 0.12)"
            iconColor="#16a34a"
          />
          <DashboardStatsCard
            tooltip="Amount still owed by customers"
            title="Outstanding"
            value={parseFloat(stats.outstandingAmount || 0).toFixed(2)}
            valuePrefix="₵ "
            icon={Clock}
            iconBgColor="rgba(249, 115, 22, 0.12)"
            iconColor="#ea580c"
          />
          <DashboardStatsCard
            tooltip="Invoices that have been fully paid"
            title="Paid Invoices"
            value={stats.paidInvoices || 0}
            icon={FileText}
            iconBgColor="rgba(34, 197, 94, 0.12)"
            iconColor="#16a34a"
          />
          <DashboardStatsCard
            tooltip="Invoices past due date"
            title="Overdue"
            value={stats.overdueInvoices || 0}
            icon={FileText}
            iconBgColor="rgba(239, 68, 68, 0.12)"
            iconColor="#dc2626"
          />
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-0 sm:justify-end sm:ml-auto">
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
          <Button onClick={handleOpenCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
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
        primaryAction={invoiceDrawerPrimaryAction}
        moreMenuItems={invoiceDrawerMoreMenuItems}
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
                <div className="mt-2 rounded-lg border border-border bg-muted/50 p-4 overflow-x-auto">
                  <table className="w-full text-sm min-w-[320px]">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="pb-2 pr-2 font-medium">Description</th>
                        <th className="pb-2 pr-2 text-right font-medium w-16">Qty</th>
                        <th className="pb-2 pr-2 text-right font-medium">Unit price</th>
                        <th className="pb-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={idx} className="border-b border-border last:border-b-0">
                          <td className="py-2 pr-2">
                            <div className="font-medium">{item.description || item.category}</div>
                            {item.paperSize && <div className="text-muted-foreground text-xs">Size: {item.paperSize}</div>}
                          </td>
                          <td className="py-2 pr-2 text-right">{item.quantity}</td>
                          <td className="py-2 pr-2 text-right">₵ {parseFloat(item.unitPrice || 0).toFixed(2)}</td>
                          <td className="py-2 text-right font-medium">₵ {parseFloat(item.total || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
        open={createModalVisible}
        onOpenChange={setCreateModalVisible}
        title="New Invoice"
        description="Create an invoice directly without linking a job."
        footer={(
          <>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] touch-manipulation"
              onClick={() => setCreateModalVisible(false)}
              disabled={creatingInvoice}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateInvoice} disabled={creatingInvoice}>
              {creatingInvoice && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Invoice
            </Button>
          </>
        )}
        className="w-full max-w-[calc(100vw-1rem)] sm:w-[var(--modal-w-2xl)]"
      >
        <div className="space-y-4">
          <div>
            <Label>Customer</Label>
            <Select
              value={newInvoice.customerId}
              onValueChange={(value) => setNewInvoice((prev) => ({ ...prev, customerId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}{customer.company ? ` - ${customer.company}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-3">
              <div className="pt-1 pb-1">
                <Separator className="mb-3" />
                <div className="text-sm font-medium text-muted-foreground">Invoice Items</div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Line Items</Label>
                <Button type="button" variant="outline" onClick={handleAddInvoiceItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
              {(newInvoice.items || []).map((item, index) => (
                <Card key={`new-invoice-item-${index}`}>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base">Item {index + 1}</CardTitle>
                    {newInvoice.items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveInvoiceItem(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label>Description</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => handleInvoiceItemChange(index, 'description', e.target.value)}
                        placeholder="Item description"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 md:gap-4">
                      <div>
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={numberInputValue(item.quantity)}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const raw = e.target.value;
                            handleInvoiceItemChange(index, 'quantity', raw === '' ? '' : Math.max(0, Number(raw)));
                          }}
                        />
                      </div>
                      <div>
                        <Label>Unit Price</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">GHS</span>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            className="pl-12"
                            value={numberInputValue(item.unitPrice)}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleInvoiceItemChange(index, 'unitPrice', e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Unit Discount (optional)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">GHS</span>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            className="pl-12"
                            value={numberInputValue(item.discountAmount)}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const raw = e.target.value;
                              handleInvoiceItemChange(index, 'discountAmount', raw === '' ? '' : Math.max(0, Number(raw)));
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-end justify-end">
                      <div className="text-sm text-muted-foreground">
                        Line Total: ₵ {Math.max(0, (parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0)) - (parseFloat(item.quantity || 0) * parseFloat(item.discountAmount || 0))).toFixed(2)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button type="button" variant="dashed" onClick={handleAddInvoiceItem} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
            <div>
              <Label>Due Date (optional)</Label>
              <DatePicker
                date={newInvoice.dueDate}
                onSelect={(date) => setNewInvoice((prev) => ({ ...prev, dueDate: date || null }))}
              />
            </div>
            <div>
              <Label>Payment Terms</Label>
              <Input
                value={newInvoice.paymentTerms}
                onChange={(e) => setNewInvoice((prev) => ({ ...prev, paymentTerms: e.target.value }))}
                placeholder="Net 30"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Notes (optional)</Label>
              <Input
                value={newInvoice.notes}
                onChange={(e) => setNewInvoice((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Any extra notes"
              />
            </div>
            <div className="sm:col-span-2 p-3 rounded-md border bg-muted/30 space-y-1">
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>₵ {createInvoiceSubtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span>Total Discount</span><span>-₵ {createInvoiceDiscountTotal.toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold"><span>Grand Total</span><span>₵ {createInvoiceGrandTotal.toFixed(2)}</span></div>
            </div>
          </div>
        </div>
      </MobileFormDialog>

      <MobileFormDialog
        open={markAsPaidModalVisible}
        onOpenChange={setMarkAsPaidModalVisible}
        title="Mark Invoice Payment"
        description="Choose full payment or record a part payment."
        footer={
          viewingInvoice ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] touch-manipulation"
                onClick={() => setMarkAsPaidModalVisible(false)}
              >
                Cancel
              </Button>
              <Button form="mark-as-paid-form" type="submit" disabled={markingAsPaid} className="min-h-[44px] touch-manipulation">
                {markingAsPaid && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </>
          ) : null
        }
        className="w-full max-w-[calc(100vw-1rem)] sm:max-w-md"
      >
        {viewingInvoice && (
          <Form {...markAsPaidForm}>
            <form id="mark-as-paid-form" onSubmit={markAsPaidForm.handleSubmit(handleMarkAsPaid)} className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                Balance Due: <strong>₵ {parseFloat(viewingInvoice.balance || 0).toFixed(2)}</strong>
              </div>

              <FormField
                control={markAsPaidForm.control}
                name="paymentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="full">Fully Paid</SelectItem>
                        <SelectItem value="partial">Partially Paid</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {markAsPaidForm.watch('paymentType') === 'partial' && (
                <FormField
                  control={markAsPaidForm.control}
                  name="partialAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Part Payment Amount</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₵ </span>
                          <Input
                            type="number"
                            min={0}
                            max={parseFloat(viewingInvoice.balance || 0)}
                            step={0.01}
                            className="pl-8"
                            value={numberInputValue(field.value)}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleNumberChange(e, field.onChange)}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </form>
          </Form>
        )}
      </MobileFormDialog>

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
                className="min-h-[44px] touch-manipulation"
                onClick={() => setPaymentModalVisible(false)}
              >
                Cancel
              </Button>
              <Button form="payment-form" type="submit" disabled={paymentForm.formState.isSubmitting} className="min-h-[44px] touch-manipulation">
                {paymentForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record Payment
              </Button>
            </>
          ) : null
        }
        className="w-full max-w-[calc(100vw-1rem)] sm:max-w-md"
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
                              className="pl-8"
                              value={numberInputValue(field.value)}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleNumberChange(e, field.onChange)}
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
                            <SelectItem value="momo">Mobile Money</SelectItem>
                            <SelectItem value="credit_card">Card</SelectItem>
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
                        <FormLabel>Reference Number (optional)</FormLabel>
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

      <AlertDialog open={!!invoiceToCancel} onOpenChange={(open) => !open && setInvoiceToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              {invoiceToCancel
                ? `Are you sure you want to cancel invoice "${invoiceToCancel.invoiceNumber || invoiceToCancel.id}"?`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => invoiceToCancel && handleCancelInvoice(invoiceToCancel.id)}
            >
              Cancel Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Invoices;
