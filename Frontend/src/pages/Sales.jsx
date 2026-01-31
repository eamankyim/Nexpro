import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const POS = lazy(() => import('./POS'));
import { useDebounce } from '../hooks/useDebounce';
import { useResponsive } from '../hooks/useResponsive';
import { ShoppingCart, Filter, RefreshCw, Printer, Receipt, FileText, Loader2, X, CheckCircle, Clock, XCircle, Download } from 'lucide-react';
import { generatePDF } from '../utils/pdfUtils';
import saleService from '../services/saleService';
import customerService from '../services/customerService';
import invoiceService from '../services/invoiceService';
import settingsService from '../services/settingsService';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import ActionColumn from '../components/ActionColumn';
import DetailsDrawer from '../components/DetailsDrawer';
import DrawerSectionCard from '../components/DrawerSectionCard';
import PrintableReceipt from '../components/PrintableReceipt';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const Sales = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isMobile } = useResponsive();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ 
    status: 'all',
    customerId: 'all',
    paymentMethod: 'all',
    startDate: null,
    endDate: null
  });
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
  const { activeTenant } = useAuth();
  const businessType = activeTenant?.businessType || 'printing_press';
  const isShop = businessType === 'shop';

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
      setSales(data);
      if (response?.data?.pagination) {
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.totalPages * pagination.pageSize
        }));
      } else {
        setPagination(prev => ({ ...prev, total: data.length }));
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
      const response = await customerService.getAll({ limit: 1000 });
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
      setViewingSale(sale);
      return sale;
    } catch (error) {
      showError(error, 'Failed to load sale details');
      return null;
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

  const organization = organizationData?.data || {};

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

  const handleView = async (sale) => {
    setViewingSale(sale);
    setDrawerVisible(true);
    const details = await fetchSaleDetails(sale.id);
    if (details) {
      setViewingSale(details);
    }
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setViewingSale(null);
    setSaleActivities([]);
  };

  const handlePrintReceipt = async (sale) => {
    try {
      const response = await saleService.getSaleById(sale.id);
      const saleData = response?.data?.data || response?.data || response;
      setReceiptData(saleData);
      setPrintModalVisible(true);
    } catch (error) {
      showError(error, 'Failed to load receipt data');
    }
  };

  const handleViewInvoice = (sale) => {
    if (sale.invoiceId) {
      navigate(`/invoices?openInvoiceId=${sale.invoiceId}`);
    }
  };

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
      render: (_, record) => <span className="text-black font-medium">{record.saleNumber}</span>
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (_, record) => (
        <span className="text-black">
          {record.customer?.name || 'Walk-in Customer'}
        </span>
      )
    },
    {
      key: 'total',
      label: 'Total',
      render: (_, record) => (
        <span className="text-black font-medium">
          GHS {parseFloat(record.total || 0).toFixed(2)}
        </span>
      )
    },
    {
      key: 'paymentMethod',
      label: 'Payment Method',
      render: (_, record) => (
        <Badge variant="outline" className="text-black">
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
        <span className="text-black">
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
            record.paymentMethod !== 'credit' && record.status === 'completed' && {
              key: 'print-receipt',
              label: 'Print Receipt',
              variant: 'secondary',
              icon: <Printer className="h-4 w-4" />,
              onClick: () => handlePrintReceipt(record)
            },
            record.paymentMethod === 'credit' && record.invoiceId && {
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
  ], [handleView, handlePrintReceipt, handleViewInvoice]);

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
      value: `GHS ${parseFloat(viewingSale.subtotal || 0).toFixed(2)}`
    },
    {
      label: 'Discount',
      value: `GHS ${parseFloat(viewingSale.discount || 0).toFixed(2)}`
    },
    {
      label: 'Tax',
      value: `GHS ${parseFloat(viewingSale.tax || 0).toFixed(2)}`
    },
    {
      label: 'Total',
      value: (
        <strong className="text-lg text-primary">
          GHS {parseFloat(viewingSale.total || 0).toFixed(2)}
        </strong>
      )
    },
    {
      label: 'Amount Paid',
      value: `GHS ${parseFloat(viewingSale.amountPaid || 0).toFixed(2)}`
    },
    viewingSale.change > 0 && {
      label: 'Change',
      value: `GHS ${parseFloat(viewingSale.change || 0).toFixed(2)}`
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
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Sales</h1>
            <p className="text-gray-600 mt-1">Track and manage your sales transactions</p>
          </div>
        </div>

        <Card className="border border-gray-200">
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
                <ShoppingCart className="h-10 w-10 text-gray-400" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Not Available</h2>
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
          <Button variant="outline" onClick={() => setFilterDrawerOpen(true)} size={isMobile ? "icon" : "default"}>
            <Filter className="h-4 w-4" />
            {!isMobile && <span className="ml-2">Filter</span>}
          </Button>
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
            {!isMobile && <span className="ml-2">Refresh</span>}
          </Button>
          <Button onClick={() => setPosModalOpen(true)} size={isMobile ? "icon" : "default"}>
            <ShoppingCart className="h-4 w-4" />
            {!isMobile && <span className="ml-2">Point of Sale</span>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <DashboardStatsCard
          title="Total Sales"
          value={sales.length}
          icon={ShoppingCart}
          iconBgColor="rgba(22, 101, 52, 0.1)"
          iconColor="#166534"
        />
        <DashboardStatsCard
          title="Completed"
          value={sales.filter(s => s.status === 'completed').length}
          icon={CheckCircle}
          iconBgColor="rgba(132, 204, 22, 0.1)"
          iconColor="#84cc16"
        />
        <DashboardStatsCard
          title="Pending"
          value={sales.filter(s => s.status === 'pending').length}
          icon={Clock}
          iconBgColor="rgba(59, 130, 246, 0.1)"
          iconColor="#3b82f6"
        />
        <DashboardStatsCard
          title="Total Revenue"
          value={`GHS ${sales.reduce((sum, s) => sum + parseFloat(s.total || 0), 0).toFixed(2)}`}
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
        emptyIcon={<ShoppingCart className="h-12 w-12 text-muted-foreground" />}
        emptyDescription="No sales found"
        pageSize={pagination.pageSize}
        onPageChange={(newPagination) => {
          setPagination(newPagination);
        }}
        externalPagination={{
          current: pagination.current,
          total: pagination.total
        }}
      />

      <Dialog open={posModalOpen} onOpenChange={setPosModalOpen}>
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
        <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto">
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
        onPrint={viewingSale && viewingSale.paymentMethod !== 'credit' ? () => handlePrintReceipt(viewingSale) : null}
        extraActions={viewingSale ? [
          viewingSale.paymentMethod !== 'credit' && viewingSale.status === 'completed' && {
            key: 'print-receipt',
            label: 'Print Receipt',
            variant: 'default',
            icon: <Printer className="h-4 w-4" />,
            onClick: () => handlePrintReceipt(viewingSale)
          },
          viewingSale.paymentMethod === 'credit' && viewingSale.invoiceId && {
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
            content: loadingSaleDetails ? (
              <DetailSkeleton />
            ) : (
              <div className="space-y-6">
                <DrawerSectionCard title="Sale summary">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <div className="text-lg font-semibold text-gray-900">{viewingSale.saleNumber}</div>
                      <div className="text-muted-foreground text-sm">
                        {dayjs(viewingSale.createdAt).format('MMM DD, YYYY [at] h:mm A')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Total Amount</div>
                      <div className="text-2xl font-bold text-primary">
                        GHS {parseFloat(viewingSale.total || 0).toFixed(2)}
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
                    <div className="grid grid-cols-12 gap-2 pb-2 border-b border-gray-200 text-sm font-semibold text-gray-900">
                      <div className="col-span-6">Item</div>
                      <div className="col-span-2 text-right">Qty</div>
                      <div className="col-span-2 text-right">Unit price (GHS)</div>
                      <div className="col-span-2 text-right">Total (GHS)</div>
                    </div>
                    {viewingSale.items.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-12 gap-2 py-3 border-b border-gray-200/80 last:border-b-0 text-sm"
                      >
                        <div className="col-span-6">
                          <div className="font-medium text-gray-900">{item.name || item.product?.name || 'Product'}</div>
                          {item.sku && (
                            <div className="text-muted-foreground text-xs mt-0.5">SKU: {item.sku}</div>
                          )}
                        </div>
                        <div className="col-span-2 text-right text-gray-700">{item.quantity}</div>
                        <div className="col-span-2 text-right text-gray-700">{parseFloat(item.unitPrice || 0).toFixed(2)}</div>
                        <div className="col-span-2 text-right font-medium text-gray-900">{parseFloat(item.total || 0).toFixed(2)}</div>
                      </div>
                    ))}
                    <div className="pt-3 mt-2 border-t border-gray-200 space-y-1 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span className="text-gray-900 font-medium">GHS {parseFloat(viewingSale.subtotal || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Discount</span>
                        <span className="text-gray-900">-GHS {parseFloat(viewingSale.discount || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Tax</span>
                        <span className="text-gray-900">GHS {parseFloat(viewingSale.tax || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-base font-semibold text-gray-900 pt-2">
                        <span>Total</span>
                        <span>GHS {parseFloat(viewingSale.total || 0).toFixed(2)}</span>
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
                        <TimelineTitle className="text-black">
                          {activity.createdByUser 
                            ? `${activity.createdByUser.name} created sale ${viewingSale.saleNumber}`
                            : `Sale ${viewingSale.saleNumber} created`}
                        </TimelineTitle>
                        <TimelineTime className="text-black">
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
                      <TimelineTitle className="text-black">
                        {activityTypeLabels[activity.type] || activity.type.toUpperCase()} {activity.subject ? `- ${activity.subject}` : ''}
                      </TimelineTitle>
                      <TimelineTime className="text-black">
                        {dayjs(activity.createdAt).format('MMM DD, YYYY [at] h:mm A')}
                        {activity.createdByUser ? ` • ${activity.createdByUser.name}` : ''}
                      </TimelineTime>
                      {activity.notes && (
                        <TimelineDescription className="text-black">{activity.notes}</TimelineDescription>
                      )}
                      {activity.metadata?.oldStatus && activity.metadata?.newStatus && (
                        <TimelineDescription className="text-black">
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
        <DialogContent className="!inset-0 !translate-x-0 !translate-y-0 !max-w-none w-screen h-screen flex flex-col p-0 !rounded-none">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Receipt Preview</DialogTitle>
                <DialogDescription>
                  Review the receipt before downloading
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPrintModalVisible(false)}>
                  Close
                </Button>
                <Button 
                  onClick={async () => {
                    const element = document.querySelector('.printable-receipt');
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
          <div className="flex-1 overflow-y-auto bg-gray-100 p-4 md:p-8">
            <div className="max-w-[900px] mx-auto" id="receipt-pdf-content">
              {receiptData && (
                <PrintableReceipt 
                  key={receiptData.id || 'receipt'} 
                  sale={receiptData} 
                  organization={organization} 
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sales;
