import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const POS = lazy(() => import('./POS'));
import { useDebounce } from '../hooks/useDebounce';
import { usePOSConfig } from '../hooks/usePOSConfig';
import { useResponsive } from '../hooks/useResponsive';
import { ShoppingCart, Filter, RefreshCw, Printer, Receipt, FileText, Loader2, X, CheckCircle, Clock, XCircle, Download, Plus, Package } from 'lucide-react';
import { generatePDF, openPrintDialog } from '../utils/pdfUtils';
import saleService from '../services/saleService';
import customerService from '../services/customerService';
import invoiceService from '../services/invoiceService';
import settingsService from '../services/settingsService';
import productService from '../services/productService';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import ActionColumn from '../components/ActionColumn';
import DetailsDrawer from '../components/DetailsDrawer';
import DrawerSectionCard from '../components/DrawerSectionCard';
import PrintableReceipt from '../components/PrintableReceipt';
import PrintableInvoice from '../components/PrintableInvoice';
import StatusChip from '../components/StatusChip';
import TableSkeleton from '../components/TableSkeleton';
import DashboardTable from '../components/DashboardTable';
import ViewToggle from '../components/ViewToggle';
import DashboardStatsCard from '../components/DashboardStatsCard';
import WelcomeSection from '../components/WelcomeSection';
import { showSuccess, showError } from '../utils/toast';
import { resolveImageUrl } from '../utils/fileUtils';
import dayjs from 'dayjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Descriptions, DescriptionItem } from '@/components/ui/descriptions';
import { Timeline, TimelineItem, TimelineIndicator, TimelineContent, TimelineTitle, TimelineDescription, TimelineTime } from '@/components/ui/timeline';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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

const Sales = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isMobile } = useResponsive();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [totalSalesCount, setTotalSalesCount] = useState(0);
  const [filters, setFilters] = useState({ 
    status: 'all',
    customerId: 'all',
    paymentMethod: 'all',
    startDate: null,
    endDate: null
  });
  const [tableViewMode, setTableViewMode] = useState('table');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingSale, setViewingSale] = useState(null);
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [saleActivities, setSaleActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [loadingSaleDetails, setLoadingSaleDetails] = useState(false);
  const [refreshingSales, setRefreshingSales] = useState(false);
  const [posModalOpen, setPosModalOpen] = useState(false);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState(null);
  const { activeTenant, activeTenantId } = useAuth();
  const businessType = activeTenant?.businessType || 'printing_press';
  const isShop = businessType === 'shop';
  const isRestaurant = isShop && activeTenant?.metadata?.shopType === 'restaurant';

  // Check if tenant has products (to show appropriate empty state)
  const { data: productsData } = useQuery({
    queryKey: ['products', 'active', activeTenantId],
    queryFn: () => productService.getAllActiveProducts(),
    enabled: !!activeTenantId,
    staleTime: 60 * 1000,
  });
  const hasProducts = useMemo(() => {
    const products = Array.isArray(productsData) ? productsData : (productsData?.products ?? []);
    return products.length > 0;
  }, [productsData]);

  // For restaurants: Pending = orders in kitchen (not completed); Completed = kitchen done or never sent
  const KITCHEN_PENDING_STATUSES = ['received', 'preparing', 'ready'];
  const completedCount = useMemo(() => {
    if (isRestaurant) {
      return sales.filter(s =>
        s.orderStatus === 'completed' ||
        (s.orderStatus == null && s.status === 'completed')
      ).length;
    }
    return sales.filter(s => s.status === 'completed').length;
  }, [sales, isRestaurant]);
  const pendingCount = useMemo(() => {
    if (isRestaurant) {
      return sales.filter(s => KITCHEN_PENDING_STATUSES.includes(s.orderStatus)).length;
    }
    return sales.filter(s => s.status === 'pending').length;
  }, [sales, isRestaurant]);

  const fetchSales = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshingSales(true);
    } else {
      setLoading(true);
    }
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
      };
      
      if (filters.status !== 'all') {
        params.status = filters.status;
      }
      
      if (filters.customerId !== 'all') {
        params.customerId = filters.customerId;
      }

      if (filters.startDate) {
        params.startDate = dayjs(filters.startDate).format('YYYY-MM-DD');
      }

      if (filters.endDate) {
        params.endDate = dayjs(filters.endDate).format('YYYY-MM-DD');
      }

      const response = await saleService.getSales(params);
      const data = response?.data?.data || response?.data || [];
      const count = response?.data?.count ?? data.length;
      setSales(data);
      setTotalSalesCount(count);
      if (response?.data?.pagination) {
        setPagination(prev => ({ ...prev, total: count }));
      } else {
        setPagination(prev => ({ ...prev, total: count }));
      }
    } catch (error) {
      showError(error, 'Failed to load sales');
      setSales([]);
    } finally {
      if (isRefresh) {
        setRefreshingSales(false);
      } else {
        setLoading(false);
      }
    }
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchCustomers = useCallback(async () => {
    try {
      const response = await customerService.getAll({ limit: 100 });
      setCustomers(response.data || []);
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  }, []);

  const fetchSaleDetails = useCallback(async (saleId) => {
    setLoadingSaleDetails(true);
    try {
      const response = await saleService.getSaleById(saleId);
      const sale = response?.data?.data || response?.data || response;
      setViewingSale((prev) => (prev?.id === saleId ? sale : prev));
    } catch (error) {
      showError(error, 'Failed to load sale details');
    } finally {
      setLoadingSaleDetails(false);
    }
  }, []);

  const fetchSaleActivities = useCallback(async (saleId) => {
    setLoadingActivities(true);
    try {
      const response = await saleService.getActivities(saleId);
      const activities = response?.data?.data || response?.data || [];
      setSaleActivities(activities);
    } catch (error) {
      console.error('Failed to load sale activities:', error);
      setSaleActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  }, []);

  // Fetch organization settings for receipt branding
  const { data: organizationData } = useQuery({
    queryKey: ['settings', 'organization'],
    queryFn: () => settingsService.getOrganization(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const organization = organizationData?.data?.data || organizationData?.data || {};
  const { posConfig } = usePOSConfig();
  const printConfig = posConfig.print || { format: 'a4' };

  useEffect(() => {
    if (!isShop) {
      return; // Only show for shop business type
    }
    fetchSales();
    fetchCustomers();
  }, [fetchSales, fetchCustomers, isShop]);

  useEffect(() => {
    if (viewingSale?.id) {
      fetchSaleActivities(viewingSale.id);
    }
  }, [viewingSale?.id, fetchSaleActivities]);

  useEffect(() => {
    if (searchParams.get('openPOS') === '1') {
      setPosModalOpen(true);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('openPOS');
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleView = (sale) => {
    setViewingSale(sale);
    setDrawerVisible(true);
    fetchSaleDetails(sale.id);
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setViewingSale(null);
    setSaleActivities([]);
  };

  const handlePrintReceipt = useCallback(async (sale) => {
    // Use already-loaded viewingSale when drawer is open (avoids redundant fetch)
    if (viewingSale?.id === sale.id && viewingSale.items && (!sale.invoiceId || viewingSale.invoice?.customer)) {
      setReceiptData(viewingSale);
      setPrintModalVisible(true);
      return;
    }
    setLoadingReceipt(true);
    try {
      const response = await saleService.getSaleById(sale.id);
      const saleData = response?.data?.data || response?.data || response;
      setReceiptData(saleData);
      setPrintModalVisible(true);
    } catch (error) {
      showError(error, 'Failed to load receipt data');
    } finally {
      setLoadingReceipt(false);
    }
  }, [viewingSale]);

  const handleViewInvoice = (sale) => {
    if (sale.invoiceId) {
      navigate(`/invoices?openInvoiceId=${sale.invoiceId}`);
    }
  };

  const handleDeleteSale = useCallback(async (id) => {
    try {
      await saleService.deleteSale(id);
      showSuccess('Sale deleted successfully');
      fetchSales();
      setSaleToDelete(null);
      if (viewingSale?.id === id) {
        setDrawerVisible(false);
        setViewingSale(null);
        setSaleActivities([]);
      }
    } catch (error) {
      showError(error, 'Failed to delete sale');
    }
  }, [viewingSale?.id, fetchSales]);

  const handleStatusUpdate = async (sale, newStatus) => {
    try {
      await saleService.updateSale(sale.id, { status: newStatus });
      showSuccess('Sale status updated successfully');
      fetchSales();
      if (viewingSale?.id === sale.id) {
        await fetchSaleDetails(sale.id);
      }
    } catch (error) {
      showError(error, 'Failed to update sale status');
    }
  };

  const paymentMethodLabels = {
    cash: 'Cash',
    card: 'Card',
    mobile_money: 'Mobile Money',
    bank_transfer: 'Bank Transfer',
    credit: 'Credit',
    other: 'Other'
  };

  const statusLabels = {
    pending: 'Pending',
    completed: 'Completed',
    cancelled: 'Cancelled',
    refunded: 'Refunded'
  };

  const tableColumns = useMemo(() => [
    {
      key: 'saleNumber',
      label: 'Sale Number',
      render: (_, record) => <span className="text-foreground font-medium">{record.saleNumber}</span>
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (_, record) => (
        <span className="text-foreground">
          {record.customer?.name || 'Walk-in Customer'}
        </span>
      )
    },
    {
      key: 'total',
      label: 'Total',
      render: (_, record) => (
        <span className="text-foreground font-medium">
          ₵ {parseFloat(record.total || 0).toFixed(2)}
        </span>
      )
    },
    {
      key: 'paymentMethod',
      label: 'Payment Method',
      render: (_, record) => (
        <Badge variant="outline" className="text-foreground">
          {paymentMethodLabels[record.paymentMethod] || record.paymentMethod}
        </Badge>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, record) => <StatusChip status={record.status} />
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (_, record) => (
        <span className="text-foreground">
          {dayjs(record.createdAt).format('MMM DD, YYYY')}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, record) => (
        <ActionColumn
          record={record}
          onView={handleView}
          extraActions={[
            record.invoiceId && {
              key: 'view-invoice',
              label: 'View Invoice',
              variant: 'secondary',
              icon: <FileText className="h-4 w-4" />,
              onClick: () => handleViewInvoice(record)
            }
          ].filter(Boolean)}
        />
      )
    }
  ], [handleView, handleViewInvoice]);

  const drawerFields = useMemo(() => viewingSale ? [
    { label: 'Sale Number', value: viewingSale.saleNumber },
    {
      label: 'Customer',
      value: viewingSale.customer ? (
        <div>
          <div className="font-medium">{viewingSale.customer.name}</div>
          {viewingSale.customer.company && (
            <div className="text-muted-foreground text-sm">{viewingSale.customer.company}</div>
          )}
          {viewingSale.customer.phone && (
            <div className="text-muted-foreground text-sm">{viewingSale.customer.phone}</div>
          )}
        </div>
      ) : 'Walk-in Customer'
    },
    {
      label: 'Status',
      value: <StatusChip status={viewingSale.status} />
    },
    {
      label: 'Payment Method',
      value: <Badge variant="outline">{paymentMethodLabels[viewingSale.paymentMethod] || viewingSale.paymentMethod}</Badge>
    },
    {
      label: 'Subtotal',
      value: `₵ ${parseFloat(viewingSale.subtotal || 0).toFixed(2)}`
    },
    {
      label: 'Discount',
      value: `₵ ${parseFloat(viewingSale.discount || 0).toFixed(2)}`
    },
    {
      label: 'Tax',
      value: `₵ ${parseFloat(viewingSale.tax || 0).toFixed(2)}`
    },
    {
      label: 'Total',
      value: (
        <strong className="text-lg text-primary">
          ₵ {parseFloat(viewingSale.total || 0).toFixed(2)}
        </strong>
      )
    },
    {
      label: 'Amount Paid',
      value: `₵ ${parseFloat(viewingSale.amountPaid || 0).toFixed(2)}`
    },
    viewingSale.change > 0 && {
      label: 'Change',
      value: `₵ ${parseFloat(viewingSale.change || 0).toFixed(2)}`
    },
    viewingSale.shop && {
      label: 'Shop',
      value: viewingSale.shop.name
    },
    viewingSale.seller && {
      label: 'Sold By',
      value: viewingSale.seller.name
    },
    {
      label: 'Date',
      value: dayjs(viewingSale.createdAt).format('MMM DD, YYYY [at] h:mm A')
    },
    viewingSale.invoiceId && {
      label: 'Invoice',
      value: (
        <Button
          variant="link"
          onClick={() => handleViewInvoice(viewingSale)}
          className="p-0 h-auto"
        >
          View Invoice
        </Button>
      )
    },
    viewingSale.notes && { label: 'Notes', value: viewingSale.notes }
  ].filter(Boolean) : [], [viewingSale, handleViewInvoice]);

  if (!isShop) {
    return (
      <div className="px-6 py-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Sales</h1>
            <p className="text-gray-600 mt-1">Track and manage your sales transactions</p>
          </div>
        </div>

        <Card className="border border-gray-200">
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                <ShoppingCart className="h-10 w-10 text-gray-400" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-foreground mb-2">Not Available</h2>
                <p className="text-gray-600 max-w-md">
                  Sales management is only available for shop business types.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <WelcomeSection
          welcomeMessage="Sales"
          subText="Track and manage your sales transactions."
        />
        <div className="flex items-center gap-2">
          <ViewToggle value={tableViewMode} onChange={setTableViewMode} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={() => setFilterDrawerOpen(true)} size={isMobile ? "icon" : "default"}>
                <Filter className="h-4 w-4" />
                {!isMobile && <span className="ml-2">Filter</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Filter sales by status, customer, or date</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                onClick={() => fetchSales(true)}
                disabled={refreshingSales}
                size={isMobile ? "icon" : "default"}
              >
                {refreshingSales ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reload sales list</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => setPosModalOpen(true)} size={isMobile ? "icon" : "default"}>
                <ShoppingCart className="h-4 w-4" />
                {!isMobile && <span className="ml-2">Point of Sale</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open Point of Sale to record a new sale or scan products</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <DashboardStatsCard
          tooltip="Total number of sales matching the current filters"
          title="Total Sales"
          value={totalSalesCount}
          icon={ShoppingCart}
          iconBgColor="rgba(22, 101, 52, 0.1)"
          iconColor="#166534"
        />
        <DashboardStatsCard
          tooltip={isRestaurant ? 'Orders completed (kitchen done or not sent to kitchen)' : 'Sales that have been paid and completed'}
          title="Completed"
          value={completedCount}
          icon={CheckCircle}
          iconBgColor="rgba(132, 204, 22, 0.1)"
          iconColor="#84cc16"
        />
        <DashboardStatsCard
          tooltip={isRestaurant ? 'Orders in kitchen (received, preparing, or ready)' : 'Sales awaiting payment'}
          title={isRestaurant ? 'Pending (in kitchen)' : 'Pending'}
          value={pendingCount}
          icon={Clock}
          iconBgColor="rgba(59, 130, 246, 0.1)"
          iconColor="#3b82f6"
        />
        <DashboardStatsCard
          tooltip="Total amount from all sales in the current view"
          title="Total Revenue"
          value={`₵ ${sales.reduce((sum, s) => sum + parseFloat(s.total || 0), 0).toFixed(2)}`}
          icon={Receipt}
          iconBgColor="rgba(22, 101, 52, 0.1)"
          iconColor="#166534"
        />
      </div>

      <DashboardTable
        data={sales}
        columns={tableColumns}
        loading={loading}
        title={null}
        emptyIcon={!hasProducts ? <Package className="h-12 w-12 text-muted-foreground" /> : <ShoppingCart className="h-12 w-12 text-muted-foreground" />}
        emptyDescription={!hasProducts ? "You haven't added any products yet. Add your products first before you can start selling." : "No sales found"}
        emptyAction={!hasProducts ? (
          <Button
            onClick={() => navigate('/products?add=1')}
            className="bg-[#166534] hover:bg-[#14532d] text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Product
          </Button>
        ) : undefined}
        pageSize={pagination.pageSize}
        onPageChange={(newPagination) => {
          setPagination(newPagination);
        }}
        externalPagination={{
          current: pagination.current,
          total: pagination.total
        }}
        viewMode={tableViewMode}
        onViewModeChange={setTableViewMode}
        getCardImage={(sale) => {
          const firstItemWithImage = sale?.items?.find(
            (i) => i?.product?.imageUrl
          );
          const url = firstItemWithImage?.product?.imageUrl;
          return url ? resolveImageUrl(url) : null;
        }}
      />

      <Dialog
        open={posModalOpen}
        onOpenChange={(open) => {
          setPosModalOpen(open);
          if (!open) fetchSales();
        }}
      >
        <DialogContent
          className="!left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !w-[98vw] !h-[98vh] !max-w-[98vw] !max-h-[98vh] !min-h-0 !p-0 !gap-0 overflow-hidden flex flex-col rounded-lg"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Point of Sale</DialogTitle>
          <DialogDescription className="sr-only">
            Quick checkout and sales processing
          </DialogDescription>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-10 w-10 animate-spin text-[#166534]" />
                </div>
              }
            >
              {posModalOpen && <POS />}
            </Suspense>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
        <SheetContent side="right" className="w-full sm:w-[400px] md:w-[540px] overflow-y-auto">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle>Filter Sales</SheetTitle>
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
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
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={filters.paymentMethod}
                onValueChange={(value) => setFilters({ ...filters, paymentMethod: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <DatePicker
                date={filters.startDate}
                onDateChange={(date) => setFilters({ ...filters, startDate: date })}
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <DatePicker
                date={filters.endDate}
                onDateChange={(date) => setFilters({ ...filters, endDate: date })}
              />
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setFilters({
                  status: 'all',
                  customerId: 'all',
                  paymentMethod: 'all',
                  startDate: null,
                  endDate: null
                });
              }}
            >
              Clear Filters
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <DetailsDrawer
        open={drawerVisible}
        onClose={handleCloseDrawer}
        title="Sale Details"
        width={720}
        onPrint={viewingSale && viewingSale.status === 'completed' && ((viewingSale.invoiceId && viewingSale.invoice?.status === 'paid') || (viewingSale.paymentMethod !== 'credit' && !viewingSale.invoiceId)) ? () => handlePrintReceipt(viewingSale) : null}
        printDisabled={loadingReceipt}
        onDelete={viewingSale ? () => handleDeleteSale(viewingSale.id) : null}
        deleteConfirmText="Are you sure you want to delete this sale? This action cannot be undone."
        extraActions={viewingSale ? [
          (viewingSale.status === 'completed' && ((viewingSale.invoiceId && viewingSale.invoice?.status === 'paid') || (viewingSale.paymentMethod !== 'credit' && !viewingSale.invoiceId))) && {
            key: 'print-receipt',
            label: loadingReceipt ? 'Loading...' : 'Print Receipt',
            variant: 'secondary',
            icon: loadingReceipt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />,
            onClick: () => handlePrintReceipt(viewingSale),
            disabled: loadingReceipt
          },
          viewingSale.invoiceId && {
            key: 'view-invoice',
            label: 'View Invoice',
            variant: 'default',
            icon: <FileText className="h-4 w-4" />,
            onClick: () => handleViewInvoice(viewingSale)
          }
        ].filter(Boolean) : []}
        tabs={viewingSale ? [
          {
            key: 'details',
            label: 'Summary',
            content: (
              <div className="space-y-6">
                <DrawerSectionCard title="Sale summary">
                  {(viewingSale.items || []).some((i) => i?.product?.imageUrl) && (
                    <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-gray-200">
                      {viewingSale.items
                        .filter((i) => i?.product?.imageUrl)
                        .map((item) => (
                          <div
                            key={item.id}
                            className="w-14 h-14 rounded-lg overflow-hidden border border-border bg-muted flex-shrink-0"
                          >
                            <img
                              src={resolveImageUrl(item.product.imageUrl)}
                              alt={item.name || item.product?.name || ''}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          </div>
                        ))}
                    </div>
                  )}
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <div className="text-lg font-semibold text-foreground">{viewingSale.saleNumber}</div>
                      <div className="text-muted-foreground text-sm">
                        {dayjs(viewingSale.createdAt).format('MMM DD, YYYY [at] h:mm A')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Total Amount</div>
                      <div className="text-2xl font-bold text-primary">
                        ₵ {parseFloat(viewingSale.total || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <Descriptions column={1} className="space-y-0">
                    {drawerFields.map((field) => (
                      <DescriptionItem key={field.label} label={field.label}>
                        {field.value || '—'}
                      </DescriptionItem>
                    ))}
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
                {(viewingSale.items || []).length ? (
                  <div className="space-y-0">
                    <div className="grid grid-cols-12 gap-2 pb-2 border-b border-gray-200 text-sm font-semibold text-foreground">
                      <div className="col-span-6">Item</div>
                      <div className="col-span-2 text-right">Qty</div>
                      <div className="col-span-2 text-right">Unit price (₵)</div>
                      <div className="col-span-2 text-right">Total (₵)</div>
                    </div>
                    {viewingSale.items.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-12 gap-2 py-3 border-b border-gray-200/80 last:border-b-0 text-sm items-center"
                      >
                        <div className="col-span-6 flex items-center gap-3">
                          {item?.product?.imageUrl ? (
                            <div className="w-12 h-12 rounded-lg overflow-hidden border border-border bg-muted flex-shrink-0">
                              <img
                                src={resolveImageUrl(item.product.imageUrl)}
                                alt={item.name || item.product?.name || ''}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-lg border border-border bg-muted flex-shrink-0 flex items-center justify-center">
                              <ShoppingCart className="h-5 w-5 text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-foreground">{item.name || item.product?.name || 'Product'}</div>
                            {item.sku && (
                              <div className="text-muted-foreground text-xs mt-0.5">SKU: {item.sku}</div>
                            )}
                          </div>
                        </div>
                        <div className="col-span-2 text-right text-gray-700">{item.quantity}</div>
                        <div className="col-span-2 text-right text-gray-700">{parseFloat(item.unitPrice || 0).toFixed(2)}</div>
                        <div className="col-span-2 text-right font-medium text-foreground">{parseFloat(item.total || 0).toFixed(2)}</div>
                      </div>
                    ))}
                    <div className="pt-3 mt-2 border-t border-gray-200 space-y-1 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span className="text-foreground font-medium">₵ {parseFloat(viewingSale.subtotal || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Discount</span>
                        <span className="text-foreground">-₵ {parseFloat(viewingSale.discount || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Tax</span>
                        <span className="text-foreground">₵ {parseFloat(viewingSale.tax || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-base font-semibold text-foreground pt-2">
                        <span>Total</span>
                        <span>₵ {parseFloat(viewingSale.total || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>No items found for this sale.</AlertDescription>
                  </Alert>
                )}
              </DrawerSectionCard>
            )
          },
          {
            key: 'activities',
            label: 'Activity',
            content: (() => {
              const activities = saleActivities || [];
              
              const creationActivity = viewingSale ? {
                id: 'creation',
                type: 'creation',
                createdAt: viewingSale.createdAt,
                createdByUser: viewingSale.seller || null
              } : null;
              
              const allActivities = creationActivity ? [creationActivity, ...activities] : activities;
              
              if (loadingActivities) {
                return (
                  <DrawerSectionCard title="Activity">
                    <div className="text-center py-8 text-muted-foreground text-sm">Loading activities...</div>
                  </DrawerSectionCard>
                );
              }
              
              if (allActivities.length === 0) {
                return (
                  <DrawerSectionCard title="Activity">
                    <Alert>
                      <AlertTitle>No activity logged yet.</AlertTitle>
                    </Alert>
                  </DrawerSectionCard>
                );
              }
              
              const timelineItems = allActivities.map((activity, index) => {
                const isLast = index === allActivities.length - 1;
                
                if (activity.type === 'creation') {
                  return (
                    <TimelineItem key={activity.id} isLast={isLast}>
                      <TimelineIndicator />
                      <TimelineContent>
                        <TimelineTitle className="text-foreground">
                          {activity.createdByUser 
                            ? `${activity.createdByUser.name} created sale ${viewingSale.saleNumber}`
                            : `Sale ${viewingSale.saleNumber} created`}
                        </TimelineTitle>
                        <TimelineTime className="text-foreground">
                          {dayjs(activity.createdAt).format('MMM DD, YYYY [at] h:mm A')}
                        </TimelineTime>
                      </TimelineContent>
                    </TimelineItem>
                  );
                }
                
                const activityTypeLabels = {
                  note: 'Note',
                  status_change: 'Status Changed',
                  payment: 'Payment',
                  refund: 'Refund'
                };
                
                return (
                  <TimelineItem key={activity.id} isLast={isLast}>
                    <TimelineIndicator />
                    <TimelineContent>
                      <TimelineTitle className="text-foreground">
                        {activityTypeLabels[activity.type] || activity.type.toUpperCase()} {activity.subject ? `- ${activity.subject}` : ''}
                      </TimelineTitle>
                      <TimelineTime className="text-foreground">
                        {dayjs(activity.createdAt).format('MMM DD, YYYY [at] h:mm A')}
                        {activity.createdByUser ? ` • ${activity.createdByUser.name}` : ''}
                      </TimelineTime>
                      {activity.notes && (
                        <TimelineDescription className="text-foreground">{activity.notes}</TimelineDescription>
                      )}
                      {activity.metadata?.oldStatus && activity.metadata?.newStatus && (
                        <TimelineDescription className="text-foreground">
                          Status: {activity.metadata.oldStatus} → {activity.metadata.newStatus}
                        </TimelineDescription>
                      )}
                    </TimelineContent>
                  </TimelineItem>
                );
              });
              
              return (
                <DrawerSectionCard title="Activity">
                  <Timeline>
                    {timelineItems}
                  </Timeline>
                </DrawerSectionCard>
              );
            })()
          }
        ] : []}
      />

      <Dialog open={printModalVisible} onOpenChange={setPrintModalVisible}>
        <DialogContent className="max-w-[95vw] sm:max-w-[920px] max-h-[90vh] flex flex-col p-0 rounded-2xl">
          <DialogHeader className="px-4 sm:px-6 py-4 border-b flex-shrink-0 text-left no-print">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
              <div>
                <DialogTitle>Receipt Preview</DialogTitle>
                <DialogDescription>
                  Review the receipt before downloading
                </DialogDescription>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-initial"
                  onClick={() => {
                    const wrapper = document.querySelector(
                      receiptData?.invoice ? '.printable-invoice' : '.printable-receipt'
                    )?.parentElement;
                    if (wrapper && receiptData) {
                      openPrintDialog(wrapper, `Receipt-${receiptData.saleNumber || 'receipt'}`);
                    }
                  }}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button 
                  className="flex-1 sm:flex-initial"
                  onClick={async () => {
                    const element = document.querySelector(
                      receiptData?.invoice ? '.printable-invoice' : '.printable-receipt'
                    );
                    if (element && receiptData) {
                      try {
                        await generatePDF(element, {
                          filename: `Receipt-${receiptData.saleNumber || 'receipt'}.pdf`,
                          format: 'a4',
                          orientation: 'portrait',
                        });
                        showSuccess('Receipt downloaded successfully');
                      } catch (error) {
                        console.error('PDF generation error:', error);
                        showError(null, 'Failed to generate PDF');
                      }
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overflow-x-hidden bg-muted/50 p-2 sm:p-4 md:p-8">
            <div className="max-w-full sm:max-w-[900px] mx-auto w-full" id="receipt-pdf-content">
              {receiptData && (
                receiptData.invoice ? (
                  <PrintableInvoice
                    key={receiptData.invoice.id || 'receipt'}
                    invoice={receiptData.invoice}
                    documentTitle="RECEIPT"
                    saleNumber={receiptData.saleNumber}
                    organization={organization}
                    printConfig={printConfig}
                  />
                ) : (
                  <PrintableReceipt
                    key={receiptData.id || 'receipt'}
                    sale={receiptData}
                    organization={organization}
                    printConfig={printConfig}
                  />
                )
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!saleToDelete} onOpenChange={(open) => !open && setSaleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sale?</AlertDialogTitle>
            <AlertDialogDescription>
              {saleToDelete
                ? `Are you sure you want to delete sale "${saleToDelete.saleNumber || saleToDelete.id}"? This action cannot be undone.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => saleToDelete && handleDeleteSale(saleToDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Sales;
