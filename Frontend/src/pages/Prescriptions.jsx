import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ClipboardList, Plus, Search, MoreHorizontal, Eye, CheckCircle,
  RefreshCw, User, Calendar, AlertCircle, Printer
} from 'lucide-react';

import { useDebounce } from '../hooks/useDebounce';
import { useResponsive } from '../hooks/useResponsive';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
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
import DashboardTable from '../components/DashboardTable';
import DashboardStatsCard from '../components/DashboardStatsCard';
import TableSkeleton from '../components/TableSkeleton';
import DetailsDrawer from '../components/DetailsDrawer';
import DrawerSectionCard from '../components/DrawerSectionCard';
import { Descriptions, DescriptionItem } from '@/components/ui/descriptions';
import { showSuccess, showError } from '../utils/toast';
import api from '../services/api';
import { STATUS_CHIP_CLASSES, STATUS_CHIP_DEFAULT_CLASS } from '../constants';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: STATUS_CHIP_CLASSES.pending ?? STATUS_CHIP_DEFAULT_CLASS },
  in_progress: { label: 'In Progress', color: STATUS_CHIP_CLASSES.in_progress ?? STATUS_CHIP_DEFAULT_CLASS },
  filled: { label: 'Filled', color: STATUS_CHIP_CLASSES.filled ?? STATUS_CHIP_DEFAULT_CLASS },
  dispensed: { label: 'Dispensed', color: STATUS_CHIP_CLASSES.dispensed ?? STATUS_CHIP_DEFAULT_CLASS },
  cancelled: { label: 'Cancelled', color: STATUS_CHIP_CLASSES.cancelled ?? STATUS_CHIP_DEFAULT_CLASS },
};

const Prescriptions = () => {
  const { isMobile } = useResponsive();
  
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [prescriptionToDelete, setPrescriptionToDelete] = useState(null);
  
  const debouncedSearch = useDebounce(searchText, 500);
  
  const fetchPrescriptions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/prescriptions', {
        params: { 
          page: pagination.page, 
          limit: pagination.pageSize, 
          search: debouncedSearch,
          status: statusFilter === 'all' ? undefined : statusFilter,
        },
      });
      
      if (response.data.success) {
        setPrescriptions(response.data.data);
        setPagination(prev => ({ ...prev, total: response.data.count }));
      }
    } catch (error) {
      showError('Failed to fetch prescriptions');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, debouncedSearch, statusFilter]);
  
  useEffect(() => { fetchPrescriptions(); }, [fetchPrescriptions]);
  
  const stats = useMemo(() => {
    const total = prescriptions.length;
    const pending = prescriptions.filter(p => p.status === 'pending').length;
    const filled = prescriptions.filter(p => p.status === 'filled' || p.status === 'dispensed').length;
    const inProgress = prescriptions.filter(p => p.status === 'in_progress').length;
    return { total, pending, filled, inProgress };
  }, [prescriptions]);
  
  const handleViewDetails = (prescription) => {
    setSelectedPrescription(prescription);
    setIsDrawerOpen(true);
    api.get(`/prescriptions/${prescription.id}`)
      .then((response) => {
        if (response?.data?.success) {
          const data = response.data.data;
          setSelectedPrescription((prev) => (prev?.id === prescription.id ? data : prev));
        }
      })
      .catch(() => showError('Failed to load prescription details'));
  };
  
  const handleFillPrescription = async (prescription) => {
    try {
      await api.post(`/prescriptions/${prescription.id}/fill`);
      showSuccess('Prescription filled successfully');
      fetchPrescriptions();
    } catch (error) {
      showError(error.response?.data?.message || 'Failed to fill prescription');
    }
  };

  const handleDeletePrescription = useCallback(async (id) => {
    try {
      await api.delete(`/prescriptions/${id}`);
      showSuccess('Prescription deleted successfully');
      fetchPrescriptions();
      setPrescriptionToDelete(null);
      if (selectedPrescription?.id === id) {
        setIsDrawerOpen(false);
        setSelectedPrescription(null);
      }
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to delete prescription');
    }
  }, [selectedPrescription?.id]);

  const columns = useMemo(() => [
    {
      accessorKey: 'prescriptionNumber',
      header: 'Prescription #',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
            <ClipboardList className="h-4 w-4 text-indigo-700" />
          </div>
          <div className="font-medium">{row.original.prescriptionNumber || row.original.id?.slice(0, 8)}</div>
        </div>
      ),
    },
    {
      accessorKey: 'customer',
      header: 'Patient',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <User className="h-3 w-3 text-gray-400" />
          <span>{row.original.customer?.name || 'Walk-in'}</span>
        </div>
      ),
    },
    {
      accessorKey: 'prescriberName',
      header: 'Prescriber',
      cell: ({ row }) => row.original.prescriberName || '-',
    },
    {
      accessorKey: 'prescriptionDate',
      header: 'Date',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-gray-600">
          <Calendar className="h-3 w-3" />
          <span>{row.original.prescriptionDate ? new Date(row.original.prescriptionDate).toLocaleDateString() : '-'}</span>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const config = STATUS_CONFIG[row.original.status] || STATUS_CONFIG.pending;
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
            {config.label}
          </span>
        );
      },
    },
    {
      accessorKey: 'total',
      header: 'Total',
      cell: ({ row }) => (
        <span className="font-medium">₵ {parseFloat(row.original.total || 0).toFixed(2)}</span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleViewDetails(row.original)}>
              <Eye className="h-4 w-4 mr-2" />View
            </DropdownMenuItem>
            {row.original.status === 'pending' && (
              <DropdownMenuItem onClick={() => handleFillPrescription(row.original)}>
                <CheckCircle className="h-4 w-4 mr-2" />Fill
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], []);
  
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Prescriptions</h1>
          <p className="text-gray-600 mt-1">Manage and fill prescriptions</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button className="bg-brand hover:bg-brand-dark text-white">
              <Plus className="h-4 w-4 mr-2" />New Prescription
            </Button>
          </TooltipTrigger>
          <TooltipContent>Create a new prescription</TooltipContent>
        </Tooltip>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DashboardStatsCard tooltip="Total prescriptions" title="Total" value={stats.total} subtitle={`${stats.total} prescriptions`} icon={ClipboardList} iconBgColor="rgba(22, 101, 52, 0.1)" iconColor="#166534" />
        <DashboardStatsCard tooltip="Prescriptions awaiting processing" title="Pending" value={stats.pending} subtitle={`${stats.pending} awaiting`} icon={AlertCircle} iconBgColor="rgba(22, 101, 52, 0.1)" iconColor="#166534" />
        <DashboardStatsCard tooltip="Prescriptions being processed" title="In Progress" value={stats.inProgress} subtitle={`${stats.inProgress} processing`} icon={ClipboardList} iconBgColor="rgba(22, 101, 52, 0.1)" iconColor="#166534" />
        <DashboardStatsCard tooltip="Prescriptions that have been filled" title="Completed" value={stats.filled} subtitle={`${stats.filled} filled`} icon={CheckCircle} iconBgColor="rgba(22, 101, 52, 0.1)" iconColor="#166534" />
      </div>
      
      <Card className="border border-gray-200">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search prescriptions..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="pl-10" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                    <SelectItem key={value} value={value}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <SecondaryButton onClick={fetchPrescriptions} size={isMobile ? 'icon' : 'default'} className="text-brand border-brand hover:bg-brand-10">
                  <RefreshCw className="h-4 w-4" />
                </SecondaryButton>
              </TooltipTrigger>
              <TooltipContent>Refresh prescriptions list</TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>
      
      <Card className="border border-gray-200">
        <CardContent className="p-0">
          {loading ? <TableSkeleton columns={7} rows={5} /> : (
            <DashboardTable
              columns={columns}
              data={prescriptions}
              pagination={pagination}
              onPageChange={(p) => setPagination(prev => ({ ...prev, page: p }))}
              onPageSizeChange={(s) => setPagination(prev => ({ ...prev, pageSize: s, page: 1 }))}
              emptyMessage="No prescriptions found"
            />
          )}
        </CardContent>
      </Card>
      
      {/* Details Drawer */}
      <DetailsDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={`Prescription ${selectedPrescription?.prescriptionNumber || ''}`}
        width="md"
        onDelete={selectedPrescription ? () => handleDeletePrescription(selectedPrescription.id) : null}
        deleteConfirmText="Are you sure you want to delete this prescription? This action cannot be undone."
      >
        {selectedPrescription && (
          <div className="space-y-6">
            <DrawerSectionCard title="Prescription details">
              <Descriptions column={1} className="space-y-0">
                <DescriptionItem label="Number">{selectedPrescription.prescriptionNumber}</DescriptionItem>
                <DescriptionItem label="Date">{selectedPrescription.prescriptionDate ? new Date(selectedPrescription.prescriptionDate).toLocaleDateString() : '-'}</DescriptionItem>
                <DescriptionItem label="Patient">{selectedPrescription.customer?.name || 'Walk-in'}</DescriptionItem>
                <DescriptionItem label="Phone">{selectedPrescription.customer?.phone || '-'}</DescriptionItem>
                <DescriptionItem label="Prescriber">{selectedPrescription.prescriberName || '-'}</DescriptionItem>
                <DescriptionItem label="Status">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG[selectedPrescription.status]?.color}`}>
                    {STATUS_CONFIG[selectedPrescription.status]?.label}
                  </span>
                </DescriptionItem>
              </Descriptions>
            </DrawerSectionCard>
            {selectedPrescription.items?.length > 0 && (
              <DrawerSectionCard title="Items">
                <div className="border border-border/50 rounded-md divide-y divide-border/50">
                  {selectedPrescription.items.map((item, idx) => (
                    <div key={idx} className="p-3 flex justify-between items-center">
                      <div>
                        <div className="font-medium">{item.drugName || item.drug?.name}</div>
                        <div className="text-sm text-muted-foreground">{item.dosageInstructions || 'No instructions'}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">Qty: {item.quantity}</div>
                        <div className="text-sm text-muted-foreground">₵ {parseFloat(item.total || 0).toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </DrawerSectionCard>
            )}
            <DrawerSectionCard title="Summary">
              <Descriptions column={1} className="space-y-0">
                <DescriptionItem label="Subtotal">₵ {parseFloat(selectedPrescription.subtotal || 0).toFixed(2)}</DescriptionItem>
                <DescriptionItem label="Tax">₵ {parseFloat(selectedPrescription.tax || 0).toFixed(2)}</DescriptionItem>
                <DescriptionItem label="Total" className="font-bold">₵ {parseFloat(selectedPrescription.total || 0).toFixed(2)}</DescriptionItem>
              </Descriptions>
            </DrawerSectionCard>
            {selectedPrescription.notes && (
              <DrawerSectionCard title="Notes">
                <p className="text-sm text-muted-foreground">{selectedPrescription.notes}</p>
              </DrawerSectionCard>
            )}
          </div>
        )}
      </DetailsDrawer>

      <AlertDialog open={!!prescriptionToDelete} onOpenChange={(open) => !open && setPrescriptionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete prescription?</AlertDialogTitle>
            <AlertDialogDescription>
              {prescriptionToDelete
                ? `Are you sure you want to delete prescription "${prescriptionToDelete.prescriptionNumber || prescriptionToDelete.id}"? This action cannot be undone.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => prescriptionToDelete && handleDeletePrescription(prescriptionToDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Prescriptions;
