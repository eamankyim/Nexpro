import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, DollarSign, FileText, Clock, CheckCircle, Printer, Download, Loader2, Filter, RefreshCw, Receipt, Share2 } from 'lucide-react';
import { generatePDF } from '../utils/pdfUtils';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDebounce } from '../hooks/useDebounce';
import { useResponsive } from '../hooks/useResponsive';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import invoiceService from '../services/invoiceService';
import customerService from '../services/customerService';
import settingsService from '../services/settingsService';
import { useAuth } from '../context/AuthContext';
import { useSmartSearch } from '../context/SmartSearchContext';
import { useQuery } from '@tanstack/react-query';
import ActionColumn from '../components/ActionColumn';
import DetailsDrawer from '../components/DetailsDrawer';
import DrawerSectionCard from '../components/DrawerSectionCard';
import PrintableInvoice from '../components/PrintableInvoice';
import StatusChip from '../components/StatusChip';
import TableSkeleton from '../components/TableSkeleton';
import DetailSkeleton from '../components/DetailSkeleton';
import DashboardTable from '../components/DashboardTable';
import DashboardStatsCard from '../components/DashboardStatsCard';
import WelcomeSection from '../components/WelcomeSection';
import { showSuccess, showError } from '../utils/toast';
import dayjs from 'dayjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { SEARCH_PLACEHOLDERS, DEBOUNCE_DELAYS } from '../constants';

const paymentSchema = z.object({
  amount: z.number().min(0.01, 'Payment amount must be greater than 0'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  paymentDate: z.date(),
  referenceNumber: z.string().optional(),
});

const Invoices = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { searchValue, setPageSearchConfig } = useSmartSearch();
  const debouncedSearch = useDebounce(searchValue, DEBOUNCE_DELAYS.SEARCH);
  const { isMobile } = useResponsive();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshingInvoices, setRefreshingInvoices] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({
    status: 'all',
    customerId: 'all',
  });
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [stats, setStats] = useState(null);
  const { isManager, activeTenant } = useAuth();
  const businessType = activeTenant?.businessType || 'printing_press';
  const isPrintingPress = businessType === 'printing_press';
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [markingAsPaid, setMarkingAsPaid] = useState(false);
  const [sendingInvoice, setSendingInvoice] = useState(false);

  const paymentForm = useForm({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: 0,
      paymentMethod: 'cash',
      paymentDate: new Date(),
      referenceNumber: '',
    },
  });

  // Fetch customers for filter
  const { data: customersData = [] } = useQuery({
    queryKey: ['customers', 'all'],
    queryFn: async () => {
      const response = await customerService.getAll({ limit: 1000 });
      return response.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch organization settings for invoice branding
  const { data: organizationData } = useQuery({
    queryKey: ['settings', 'organization'],
    queryFn: () => settingsService.getOrganization(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const organization = organizationData?.data || {};

  useEffect(() => {
    setPageSearchConfig({ scope: 'invoices', placeholder: SEARCH_PLACEHOLDERS.INVOICES });
    return () => setPageSearchConfig(null);
  }, [setPageSearchConfig]);

  // Pull-to-refresh hook
  const { isRefreshing, pullDistance, containerProps } = usePullToRefresh(
    () => {
      fetchInvoices(true);
      fetchStats();
    },
    { enabled: isMobile }
  );

  useEffect(() => {
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, [searchValue]);

  const fetchInvoices = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshingInvoices(true);
    } else {
      setLoading(true);
    }
    try {
      const params = {
        page: pagination.current,
        limit: 1000, // Fetch more for client-side filtering
      };

      if (filters.status !== 'all') {
        params.status = filters.status;
      }

      if (filters.customerId !== 'all') {
        params.customerId = filters.customerId;
      }

      if (debouncedSearch) {
        params.search = debouncedSearch;
      }

      const response = await invoiceService.getAll(params);
      setInvoices(response.data || []);
    } catch (error) {
      showError(error, 'Failed to load invoices');
      setInvoices([]);
    } finally {
      if (isRefresh) {
        setRefreshingInvoices(false);
      } else {
        setLoading(false);
      }
    }
  }, [filters, pagination.current, debouncedSearch]);

  // Apply client-side filtering
  const filteredInvoices = useMemo(() => {
    return invoices; // Backend already filters by status and customerId
  }, [invoices, filters]);

  // Paginate filtered invoices
  const paginatedInvoices = useMemo(() => {
    const start = (pagination.current - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return filteredInvoices.slice(start, end);
  }, [filteredInvoices, pagination.current, pagination.pageSize]);

  const invoicesCount = filteredInvoices.length;

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
  }, [fetchInvoices, fetchStats, refreshTrigger, filters]);

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

  const handlePrintInvoice = async () => {
    if (!viewingInvoice) return;
    
    const element = document.querySelector('.printable-invoice');
    if (element) {
      try {
        await generatePDF(element, {
          filename: `Invoice-${viewingInvoice.invoiceNumber}.pdf`,
          format: 'a4',
          orientation: 'portrait',
        });
        showSuccess('Invoice PDF downloaded successfully');
      } catch (error) {
        console.error('PDF generation error:', error);
        showError(null, 'Failed to generate PDF');
      }
    }
  };

  const handleDownloadInvoice = async () => {
    if (!viewingInvoice) return;
    
    const element = document.querySelector('.printable-invoice');
    if (!element) {
      showError(null, 'Invoice not found');
      return;
    }
    
    try {
      await generatePDF(element, {
        filename: `Invoice-${viewingInvoice.invoiceNumber}.pdf`,
        format: 'a4',
        orientation: 'portrait',
      });
      showSuccess('Invoice PDF downloaded successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      showError(error, 'Failed to generate PDF');
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


  // Calculate summary stats from invoices
  const calculatedStats = useMemo(() => {
    const totalRevenue = invoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + parseFloat(inv.amountPaid || 0), 0);
    
    const outstandingAmount = invoices
      .filter(inv => inv.status !== 'paid')
      .reduce((sum, inv) => sum + parseFloat(inv.balance || 0), 0);
    
    const paidInvoices = invoices.filter(inv => inv.status === 'paid').length;
    const overdueInvoices = invoices.filter(inv => inv.status === 'overdue').length;
    
    return {
      totals: {
        totalRevenue,
        outstandingAmount,
        paidInvoices,
        overdueInvoices
      }
    };
  }, [invoices]);

  // Table columns for DashboardTable
  const tableColumns = useMemo(() => [
    {
      key: 'invoiceNumber',
      label: 'Invoice #',
      render: (_, record) => <span className="font-medium text-black">{record?.invoiceNumber || '—'}</span>
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (_, record) => (
        <div>
          <div className="text-black">{record?.customer?.name || '—'}</div>
          {record?.customer?.company && (
            <div className="text-muted-foreground text-xs">{record.customer.company}</div>
          )}
        </div>
      )
    },
    ...(isPrintingPress ? [{
      key: 'job',
      label: 'Job',
      render: (_, record) => <span className="text-black">{record?.job?.jobNumber || '—'}</span>
    }] : []),
    {
      key: 'invoiceDate',
      label: 'Invoice Date',
      render: (_, record) => <span className="text-black">{record?.invoiceDate ? dayjs(record.invoiceDate).format('MMM DD, YYYY') : '—'}</span>
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      render: (_, record) => <span className="text-black">{record?.dueDate ? dayjs(record.dueDate).format('MMM DD, YYYY') : '—'}</span>
    },
    {
      key: 'totalAmount',
      label: 'Total',
      render: (_, record) => <span className="text-black font-medium">GHS {parseFloat(record?.totalAmount || 0).toFixed(2)}</span>
    },
    {
      key: 'balance',
      label: 'Balance',
      render: (_, record) => {
        const balance = parseFloat(record?.balance || 0);
        return (
          <span className={`font-bold ${balance > 0 ? 'text-orange-500' : 'text-green-500'}`}>
            GHS {balance.toFixed(2)}
          </span>
        );
      }
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, record) => <StatusChip status={record?.status} />
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
              key: 'recordPayment',
              label: 'Record Payment',
              variant: 'default',
              onClick: () => handleRecordPayment(record)
            },
            parseFloat(record.balance || 0) > 0 && record.status !== 'cancelled' && isManager && {
              key: 'markAsPaid',
              label: 'Mark as Paid',
              variant: 'secondary',
              onClick: () => handleMarkAsPaid(record)
            },
            record.status === 'draft' && isManager && {
              key: 'send',
              label: sendingInvoice ? 'Sending...' : 'Send',
              variant: 'secondary',
              icon: sendingInvoice ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined,
              onClick: () => handleSendInvoice(record.id),
              disabled: sendingInvoice
            }
          ].filter(Boolean)}
        />
      )
    }
  ], [isPrintingPress, isManager, handleView, handleRecordPayment, handleMarkAsPaid, handleSendInvoice]);

  const handleClearFilters = () => {
    setFilters({
      status: 'all',
      customerId: 'all'
    });
    setPagination({ ...pagination, current: 1 });
  };

  const hasActiveFilters = filters.status !== 'all' || filters.customerId !== 'all';

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <WelcomeSection
          welcomeMessage="Invoices"
          subText="Manage invoices, track payments, and monitor outstanding balances."
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setFilterDrawerOpen(true)} size={isMobile ? "icon" : "default"}>
            <Filter className="h-4 w-4" />
            {!isMobile && <span className="ml-2">Filter</span>}
          </Button>
          <Button 
            variant="outline" 
            onClick={async () => { 
              await fetchInvoices(true); 
              fetchStats(); 
            }}
            disabled={refreshingInvoices}
            size={isMobile ? "icon" : "default"}
          >
            {refreshingInvoices ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {!isMobile && <span className="ml-2">Refresh</span>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Revenue Card */}
        <DashboardStatsCard
          title="Total Revenue"
          value={calculatedStats?.totals?.totalRevenue || 0}
          icon={DollarSign}
          iconBgColor="rgba(132, 204, 22, 0.1)"
          iconColor="#84cc16"
        />

        {/* Outstanding Card */}
        <DashboardStatsCard
          title="Outstanding"
          value={calculatedStats?.totals?.outstandingAmount || 0}
          icon={Clock}
          iconBgColor="rgba(249, 115, 22, 0.1)"
          iconColor="#f97316"
        />

        {/* Paid Invoices Card */}
        <DashboardStatsCard
          title="Paid Invoices"
          value={calculatedStats?.totals?.paidInvoices || 0}
          icon={CheckCircle}
          iconBgColor="rgba(132, 204, 22, 0.1)"
          iconColor="#84cc16"
        />

        {/* Overdue Card */}
        <DashboardStatsCard
          title="Overdue"
          value={calculatedStats?.totals?.overdueInvoices || 0}
          icon={FileText}
          iconBgColor="rgba(239, 68, 68, 0.1)"
          iconColor="#ef4444"
        />
      </div>

      {/* Main Content Area with Pull-to-Refresh */}
      <div {...containerProps} className="relative">
        {/* Pull-to-refresh indicator */}
        {isMobile && pullDistance > 0 && (
          <div 
            className="absolute top-0 left-0 right-0 flex items-center justify-center z-10 transition-opacity"
            style={{
              height: `${Math.min(pullDistance, 80)}px`,
              opacity: Math.min(pullDistance / 80, 1),
            }}
          >
            {isRefreshing ? (
              <Loader2 className="h-6 w-6 animate-spin text-[#166534]" />
            ) : (
              <RefreshCw className="h-6 w-6 text-[#166534]" />
            )}
          </div>
        )}
        
        <DashboardTable
          data={paginatedInvoices}
          columns={tableColumns}
          loading={loading || (isMobile && isRefreshing)}
          title={null}
          emptyIcon={<Receipt className="h-12 w-12 text-muted-foreground" />}
          emptyDescription="No invoices found"
          pageSize={pagination.pageSize}
          onPageChange={(newPagination) => {
            setPagination(newPagination);
          }}
          externalPagination={{
            current: pagination.current,
            total: invoicesCount
          }}
        />
      </div>

      {/* Filter Drawer */}
      <Sheet open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
        <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto" style={{ top: 8, bottom: 8, right: 8, height: 'calc(100vh - 16px)', borderRadius: 8 }}>
          <SheetHeader className="pb-4 border-b">
            <SheetTitle>Filter Invoices</SheetTitle>
          </SheetHeader>
          <div className="space-y-6 mt-6">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({ ...filters, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Customer</Label>
              <Select
                value={filters.customerId}
                onValueChange={(value) => setFilters({ ...filters, customerId: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customersData.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <Button variant="outline" onClick={handleClearFilters} className="w-full">
                Clear Filters
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <DetailsDrawer
        open={drawerVisible}
        onClose={handleCloseDrawer}
        title="Invoice Details"
        width={720}
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
        deleteConfirmText="Are you sure you want to cancel this invoice?"
        tabs={viewingInvoice ? [
          {
            key: 'details',
            label: 'Details',
            content: (
              <div className="space-y-6">
                <DrawerSectionCard title="Invoice details">
                  <Descriptions column={1} className="space-y-0">
                    <DescriptionItem label="Invoice Number">{viewingInvoice.invoiceNumber}</DescriptionItem>
                    <DescriptionItem label="Status">
                      <StatusChip status={viewingInvoice.status} />
                    </DescriptionItem>
                    <DescriptionItem label="Customer">{viewingInvoice.customer?.name}</DescriptionItem>
                    <DescriptionItem label="Company">{viewingInvoice.customer?.company || '-'}</DescriptionItem>
                    <DescriptionItem label="Email">{viewingInvoice.customer?.email || '-'}</DescriptionItem>
                    <DescriptionItem label="Phone">{viewingInvoice.customer?.phone || '-'}</DescriptionItem>
                    {isPrintingPress && (
                      <>
                        <DescriptionItem label="Job Number">{viewingInvoice.job?.jobNumber || '-'}</DescriptionItem>
                        <DescriptionItem label="Job Title">{viewingInvoice.job?.title || '-'}</DescriptionItem>
                      </>
                    )}
                    <DescriptionItem label="Invoice Date">
                      {viewingInvoice.invoiceDate ? dayjs(viewingInvoice.invoiceDate).format('MMMM DD, YYYY') : '-'}
                    </DescriptionItem>
                    <DescriptionItem label="Due Date">
                      {viewingInvoice.dueDate ? dayjs(viewingInvoice.dueDate).format('MMMM DD, YYYY') : '-'}
                    </DescriptionItem>
                    <DescriptionItem label="Payment Terms">{viewingInvoice.paymentTerms || '-'}</DescriptionItem>
                  </Descriptions>
                </DrawerSectionCard>
                <DrawerSectionCard title="Amounts">
                  <Descriptions column={1} className="space-y-0">
                    <DescriptionItem label="Subtotal">
                      GHS {parseFloat(viewingInvoice.subtotal || 0).toFixed(2)}
                    </DescriptionItem>
                    <DescriptionItem label="Tax">
                      GHS {parseFloat(viewingInvoice.taxAmount || 0).toFixed(2)} ({viewingInvoice.taxRate || 0}%)
                    </DescriptionItem>
                    <DescriptionItem label="Discount">
                      {!viewingInvoice.discountAmount || viewingInvoice.discountAmount == 0
                        ? '-'
                        : `GHS ${parseFloat(viewingInvoice.discountAmount || 0).toFixed(2)} ${viewingInvoice.discountType === 'percentage' ? `(${viewingInvoice.discountValue}%)` : ''}`
                      }
                    </DescriptionItem>
                    <DescriptionItem label="Total Amount">
                      <strong className="text-lg text-primary">GHS {parseFloat(viewingInvoice.totalAmount || 0).toFixed(2)}</strong>
                    </DescriptionItem>
                    <DescriptionItem label="Amount Paid">
                      <span className="text-green-600">GHS {parseFloat(viewingInvoice.amountPaid || 0).toFixed(2)}</span>
                    </DescriptionItem>
                    <DescriptionItem label="Balance Due">
                      <strong className={`text-lg ${viewingInvoice.balance > 0 ? 'text-orange-500' : 'text-green-600'}`}>
                        GHS {parseFloat(viewingInvoice.balance || 0).toFixed(2)}
                      </strong>
                    </DescriptionItem>
                    <DescriptionItem label="Notes">{viewingInvoice.notes || '-'}</DescriptionItem>
                    <DescriptionItem label="Terms & Conditions">{viewingInvoice.termsAndConditions || '-'}</DescriptionItem>
                    <DescriptionItem label="Sent Date">
                      {viewingInvoice.sentDate ? dayjs(viewingInvoice.sentDate).format('MMMM DD, YYYY') : '-'}
                    </DescriptionItem>
                    <DescriptionItem label="Paid Date">
                      {viewingInvoice.paidDate ? dayjs(viewingInvoice.paidDate).format('MMMM DD, YYYY') : '-'}
                    </DescriptionItem>
                    <DescriptionItem label="Created At">
                      {viewingInvoice.createdAt ? dayjs(viewingInvoice.createdAt).format('MMMM DD, YYYY HH:mm') : '-'}
                    </DescriptionItem>
                  </Descriptions>
                </DrawerSectionCard>
              </div>
            )
          },
          {
            key: 'items',
            label: 'Items',
            content: (
              <DrawerSectionCard title="Itemized charges">
                {!viewingInvoice.items || viewingInvoice.items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No items found
                  </div>
                ) : (
                  <div className="space-y-0">
                    <div className="grid grid-cols-12 gap-2 pb-2 border-b border-gray-200 text-sm font-semibold text-gray-900">
                      <div className="col-span-6">Item description</div>
                      <div className="col-span-2 text-right">Quantity</div>
                      <div className="col-span-2 text-right">Unit price (GHS)</div>
                      <div className="col-span-2 text-right">Total (GHS)</div>
                    </div>
                    {viewingInvoice.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 py-3 border-b border-gray-200/80 last:border-b-0 text-sm"
                      >
                        <div className="col-span-6">
                          <div className="font-medium text-gray-900">{item.description || item.category || 'Item'}</div>
                          {item.paperSize && (
                            <div className="text-muted-foreground text-xs mt-0.5">Size: {item.paperSize}</div>
                          )}
                        </div>
                        <div className="col-span-2 text-right text-gray-700">{item.quantity || 0}</div>
                        <div className="col-span-2 text-right text-gray-700">{parseFloat(item.unitPrice || 0).toFixed(2)}</div>
                        <div className="col-span-2 text-right font-medium text-gray-900">{parseFloat(item.total || 0).toFixed(2)}</div>
                      </div>
                    ))}
                    <div className="pt-3 mt-2 border-t border-gray-200 space-y-1 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span className="text-gray-900 font-medium">GHS {parseFloat(viewingInvoice.subtotal || 0).toFixed(2)}</span>
                      </div>
                      {viewingInvoice.taxAmount != null && Number(viewingInvoice.taxAmount) !== 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Tax {viewingInvoice.taxRate || 0}%</span>
                          <span className="text-gray-900">GHS {parseFloat(viewingInvoice.taxAmount || 0).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-semibold text-gray-900 pt-2">
                        <span>Grand total</span>
                        <span>GHS {parseFloat(viewingInvoice.totalAmount || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </DrawerSectionCard>
            )
          }
        ] : null}
      />

      <Dialog open={paymentModalVisible} onOpenChange={setPaymentModalVisible}>
        <DialogContent className="sm:w-[var(--modal-w-lg)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)]">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>Record a payment for this invoice</DialogDescription>
          </DialogHeader>
          <DialogBody>
          {viewingInvoice && (
            <>
              <Descriptions column={2} className="mb-6">
                <DescriptionItem label="Invoice">{viewingInvoice.invoiceNumber}</DescriptionItem>
                <DescriptionItem label="Customer">{viewingInvoice.customer?.name}</DescriptionItem>
                <DescriptionItem label="Total Amount">GHS {parseFloat(viewingInvoice.totalAmount).toFixed(2)}</DescriptionItem>
                <DescriptionItem label="Amount Paid">GHS {parseFloat(viewingInvoice.amountPaid || 0).toFixed(2)}</DescriptionItem>
                <DescriptionItem label="Balance Due" className="col-span-2">
                  <strong className="text-lg text-orange-500">
                    GHS {parseFloat(viewingInvoice.balance).toFixed(2)}
                  </strong>
                </DescriptionItem>
              </Descriptions>

              <Form {...paymentForm}>
                <form onSubmit={paymentForm.handleSubmit(onPaymentSubmit)} className="space-y-4">
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
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">GHS</span>
                              <Input
                                type="number"
                                placeholder="0.00"
                                min={0}
                                max={parseFloat(viewingInvoice.balance)}
                                step={0.01}
                                value={field.value || ''}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value) || 0;
                                  field.onChange(value);
                                }}
                                className="pl-12"
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
                          <FormLabel>Reference Number (optional)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Transaction ref. number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPaymentModalVisible(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" loading={paymentForm.formState.isSubmitting}>
                      Record Payment
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </>
          )}
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={printModalVisible} onOpenChange={setPrintModalVisible}>
        <DialogContent className="!inset-0 !translate-x-0 !translate-y-0 !max-w-none w-screen h-screen flex flex-col p-0 !rounded-none">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0 no-print">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Invoice Preview</DialogTitle>
                <DialogDescription>
                  Review the invoice before printing or downloading
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (navigator.share && viewingInvoice) {
                      try {
                        await navigator.share({
                          title: `Invoice ${viewingInvoice.invoiceNumber}`,
                          text: `Invoice ${viewingInvoice.invoiceNumber} for ${viewingInvoice.customer?.name}`,
                          url: window.location.href
                        });
                      } catch (err) {
                        if (err.name !== 'AbortError') {
                          await navigator.clipboard.writeText(window.location.href);
                          showSuccess('Link copied to clipboard');
                        }
                      }
                    } else {
                      try {
                        await navigator.clipboard.writeText(window.location.href);
                        showSuccess('Link copied to clipboard');
                      } catch (err) {
                        showError(null, 'Failed to copy link');
                      }
                    }
                  }}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadInvoice}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  size="sm"
                  onClick={handlePrintInvoice}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto bg-gray-100 p-4 md:p-8 print-content-wrapper">
            <div className="max-w-[850px] mx-auto bg-white rounded-lg shadow-sm">
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
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Invoices;
