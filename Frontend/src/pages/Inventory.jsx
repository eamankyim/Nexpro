import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Table, InputNumber, Tag, Alert } from 'antd';
import {
  AppWindow,
  Plus,
  RefreshCw,
  Inbox,
  AlertTriangle,
  DollarSign,
  PlusCircle,
  Pencil,
  ArrowUp,
  ArrowDown,
  Loader2,
  Search
} from 'lucide-react';
import dayjs from 'dayjs';
import DetailsDrawer from '../components/DetailsDrawer';
import ActionColumn from '../components/ActionColumn';
import StatusChip from '../components/StatusChip';
import TableSkeleton from '../components/TableSkeleton';
import DetailSkeleton from '../components/DetailSkeleton';
import inventoryService from '../services/inventoryService';
import vendorService from '../services/vendorService';
import { useAuth } from '../context/AuthContext';
import { showSuccess, showError } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { StatisticCard } from '@/components/ui/statistic-card';
import { Timeline, TimelineItem, TimelineIndicator, TimelineContent, TimelineTitle, TimelineDescription, TimelineTime } from '@/components/ui/timeline';
import { Descriptions, DescriptionItem } from '@/components/ui/descriptions';
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

const sortCategories = (list = []) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name));

const stockStatus = (item) => {
  const quantity = parseFloat(item.quantityOnHand || 0);
  const reorder = parseFloat(item.reorderLevel || 0);

  if (quantity <= 0) {
    return { color: 'destructive', label: 'Out of stock' };
  }
  if (quantity <= reorder) {
    return { color: 'secondary', label: 'Low stock' };
  }
  return { color: 'default', label: 'In stock' };
};

const valueFormatter = (value) =>
  `GHS ${parseFloat(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const itemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  sku: z.string().optional(),
  categoryId: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  quantityOnHand: z.number().min(0, 'Quantity must be at least 0'),
  reorderLevel: z.number().min(0, 'Reorder level must be at least 0'),
  preferredVendorId: z.string().optional(),
  unitCost: z.number().min(0, 'Unit cost must be at least 0'),
  location: z.string().optional(),
  isActive: z.boolean().default(true),
  description: z.string().optional(),
});

const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional(),
});

const restockSchema = z.object({
  quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
  unitCost: z.number().min(0, 'Unit cost must be at least 0').optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

const adjustSchema = z.object({
  adjustmentMode: z.enum(['set', 'delta']),
  newQuantity: z.number().min(0, 'Quantity must be at least 0').optional(),
  quantityDelta: z.number().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.adjustmentMode === 'set') {
    return data.newQuantity !== undefined;
  }
  return data.quantityDelta !== undefined;
}, {
  message: 'Quantity is required',
  path: ['newQuantity'],
});

const Inventory = () => {
  const { activeTenant } = useAuth();
  const businessType = activeTenant?.businessType || 'printing_press';
  const isPrintingPress = businessType === 'printing_press';
  
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [categoryModalContext, setCategoryModalContext] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [restockModalVisible, setRestockModalVisible] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deactivateItemId, setDeactivateItemId] = useState(null);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    categoryId: 'all',
    status: 'active',
    lowStock: false
  });

  const itemForm = useForm({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: '',
      sku: '',
      categoryId: '',
      unit: 'pcs',
      quantityOnHand: 0,
      reorderLevel: 0,
      preferredVendorId: '',
      unitCost: 0,
      location: '',
      isActive: true,
      description: '',
    },
  });

  const categoryForm = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const restockForm = useForm({
    resolver: zodResolver(restockSchema),
    defaultValues: {
      quantity: 1,
      unitCost: 0,
      reference: '',
      notes: '',
    },
  });

  const adjustForm = useForm({
    resolver: zodResolver(adjustSchema),
    defaultValues: {
      adjustmentMode: 'set',
      newQuantity: 0,
      quantityDelta: 0,
      reason: '',
      notes: '',
    },
  });

  const adjustmentMode = adjustForm.watch('adjustmentMode');

  useEffect(() => {
    fetchCategories();
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchCategories = async () => {
    try {
      const response = await inventoryService.getCategories();
      const data = response?.data || [];
      setCategories(sortCategories(data));
    } catch (error) {
      console.error('Failed to load categories', error);
      showError(error, 'Failed to load categories');
    }
  };

  const fetchSummary = async () => {
    setSummaryLoading(true);
    try {
      const response = await inventoryService.getSummary();
      setSummary(response?.data || {});
    } catch (error) {
      console.error('Failed to load inventory summary', error);
      showError(error, 'Failed to load inventory summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await inventoryService.getItems({
        page: pagination.current,
        limit: pagination.pageSize,
        search: filters.search || undefined,
        categoryId: filters.categoryId !== 'all' ? filters.categoryId : undefined,
        status: filters.status !== 'all' ? filters.status : undefined,
        lowStock: filters.lowStock
      });

      const payload = response || {};
      const rows = Array.isArray(payload.data) ? payload.data : [];
      setItems(rows);
      setPagination((prev) => ({
        ...prev,
        total: payload.count || rows.length || 0
      }));
    } catch (error) {
      console.error('Failed to load inventory items', error);
      showError(error, 'Failed to load inventory items');
    } finally {
      setLoading(false);
    }
  };

  const loadVendors = async () => {
    try {
      const response = await vendorService.getVendors({ limit: 100 });
      setVendors(response?.data || []);
    } catch (error) {
      console.error('Failed to load vendors', error);
    }
  };

  const openCategoryModal = (context = null) => {
    categoryForm.reset();
    setCategoryModalContext(context);
    setCategoryModalVisible(true);
  };

  const onCategorySubmit = async (values) => {
    try {
      const payload = await inventoryService.createCategory(values);
      const newCategory = payload?.data || payload;
      if (!newCategory?.id) {
        throw new Error('Invalid category response');
      }
      setCategories((prev) => sortCategories([...prev, newCategory]));
      showSuccess('Category added successfully');
      setCategoryModalVisible(false);

      if (categoryModalContext === 'filter') {
        setFilters((prev) => ({ ...prev, categoryId: newCategory.id }));
        setPagination((prev) => ({ ...prev, current: 1 }));
      } else if (categoryModalContext === 'item') {
        itemForm.setValue('categoryId', newCategory.id);
      }

      setCategoryModalContext(null);
      fetchSummary();
    } catch (error) {
      console.error('Failed to create category', error);
      showError(error, error?.response?.data?.message || 'Failed to create category');
    }
  };

  const handleTableChange = (newPagination) => {
    setPagination((prev) => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize
    }));
  };

  const handleSearch = (value) => {
    setPagination((prev) => ({ ...prev, current: 1 }));
    setFilters((prev) => ({ ...prev, search: value }));
  };

  const handleCategoryChange = (value) => {
    setPagination((prev) => ({ ...prev, current: 1 }));
    setFilters((prev) => ({ ...prev, categoryId: value }));
  };

  const handleStatusChange = (value) => {
    setPagination((prev) => ({ ...prev, current: 1 }));
    setFilters((prev) => ({ ...prev, status: value }));
  };

  const handleLowStockToggle = (checked) => {
    setPagination((prev) => ({ ...prev, current: 1 }));
    setFilters((prev) => ({ ...prev, lowStock: checked }));
  };

  const handleViewItem = async (record) => {
    setViewingItem(record);
    setDrawerVisible(true);
    try {
      const response = await inventoryService.getById(record.id);
      const data = response?.data || response;
      setViewingItem(data);
    } catch (error) {
      console.error('Failed to fetch inventory item', error);
      showError(error, 'Failed to load inventory details');
    }
  };

  const openItemModal = async (item = null) => {
    if (!vendors.length) {
      await loadVendors();
    }

    setEditingItem(item);
    if (item) {
      itemForm.reset({
        name: item.name,
        sku: item.sku || '',
        categoryId: item.categoryId || '',
        unit: item.unit,
        quantityOnHand: parseFloat(item.quantityOnHand || 0),
        reorderLevel: parseFloat(item.reorderLevel || 0),
        preferredVendorId: item.preferredVendorId || '',
        unitCost: parseFloat(item.unitCost || 0),
        location: item.location || '',
        isActive: item.isActive,
        description: item.description || '',
      });
    } else {
      itemForm.reset({
        name: '',
        sku: '',
        categoryId: '',
        unit: 'pcs',
        quantityOnHand: 0,
        reorderLevel: 0,
        preferredVendorId: '',
        unitCost: 0,
        location: '',
        isActive: true,
        description: '',
      });
    }

    setItemModalVisible(true);
  };

  const onItemSubmit = async (values) => {
    try {
      if (editingItem) {
        await inventoryService.updateItem(editingItem.id, values);
        showSuccess('Inventory item updated successfully');
      } else {
        await inventoryService.createItem(values);
        showSuccess('Inventory item created successfully');
      }
      setItemModalVisible(false);
      fetchItems();
      fetchSummary();
    } catch (error) {
      console.error('Failed to save inventory item', error);
      showError(error, error?.response?.data?.message || 'Failed to save inventory item');
    }
  };

  const handleRestock = (record) => {
    restockForm.reset({
      quantity: 1,
      unitCost: parseFloat(record.unitCost || 0),
      reference: '',
      notes: '',
    });
    setEditingItem(record);
    setRestockModalVisible(true);
  };

  const onRestockSubmit = async (values) => {
    try {
      await inventoryService.restock(editingItem.id, values);
      showSuccess('Inventory restocked successfully');
      setRestockModalVisible(false);
      fetchItems();
      fetchSummary();
      if (drawerVisible) {
        handleViewItem(editingItem);
      }
    } catch (error) {
      console.error('Failed to restock inventory', error);
      showError(error, error?.response?.data?.message || 'Failed to restock inventory');
    }
  };

  const handleAdjust = (record) => {
    adjustForm.reset({
      adjustmentMode: 'set',
      newQuantity: parseFloat(record.quantityOnHand || 0),
      quantityDelta: 0,
      reason: '',
      notes: '',
    });
    setEditingItem(record);
    setAdjustModalVisible(true);
  };

  const onAdjustSubmit = async (values) => {
    try {
      const payload = values.adjustmentMode === 'delta'
        ? { quantityDelta: values.quantityDelta, reason: values.reason, notes: values.notes }
        : { newQuantity: values.newQuantity, reason: values.reason, notes: values.notes };

      await inventoryService.adjust(editingItem.id, payload);
      showSuccess('Inventory adjustment recorded');
      setAdjustModalVisible(false);
      fetchItems();
      fetchSummary();
      if (drawerVisible) {
        handleViewItem(editingItem);
      }
    } catch (error) {
      console.error('Failed to adjust inventory', error);
      showError(error, error?.response?.data?.message || 'Failed to adjust inventory');
    }
  };

  const handleToggleActive = async (record) => {
    if (record.isActive) {
      setDeactivateItemId(record.id);
      setDeactivateDialogOpen(true);
    } else {
      try {
        await inventoryService.updateItem(record.id, { isActive: true });
        showSuccess('Inventory item reactivated');
            fetchItems();
            fetchSummary();
          } catch (error) {
        console.error('Failed to activate inventory item', error);
        showError(error, error?.response?.data?.message || 'Failed to activate inventory item');
      }
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateItemId) return;
    try {
      await inventoryService.deleteItem(deactivateItemId);
      showSuccess('Inventory item deactivated');
        fetchItems();
        fetchSummary();
      setDeactivateDialogOpen(false);
      setDeactivateItemId(null);
      } catch (error) {
      console.error('Failed to deactivate inventory item', error);
      showError(error, error?.response?.data?.message || 'Failed to deactivate inventory item');
    }
  };

  const columns = useMemo(() => [
    {
      title: 'Item',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => {
        const status = stockStatus(record);
        // Map stock status labels to status values for StatusChip
        const statusValue = status.label.toLowerCase().replace(' ', '_');
        return (
          <div>
            <div className="font-semibold">{record.name}</div>
            <div className="text-muted-foreground text-sm">{record.sku || '—'}</div>
            <StatusChip status={statusValue} className="mt-1" />
          </div>
        );
      }
    },
    {
      title: 'Category',
      dataIndex: ['category', 'name'],
      key: 'category',
      render: (_, record) => record.category?.name || 'Uncategorized'
    },
    {
      title: 'Quantity',
      dataIndex: 'quantityOnHand',
      key: 'quantityOnHand',
      render: (value, record) => (
        <div>
          <div className="font-semibold">{parseFloat(value || 0).toFixed(2)} {record.unit}</div>
          <div className="text-muted-foreground text-xs">Reorder at {parseFloat(record.reorderLevel || 0).toFixed(2)}</div>
        </div>
      )
    },
    {
      title: 'Unit Cost',
      dataIndex: 'unitCost',
      key: 'unitCost',
      render: (value) => valueFormatter(value)
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      render: (value) => value || '—'
    },
    {
      title: 'Vendor',
      dataIndex: ['preferredVendor', 'name'],
      key: 'vendor',
      render: (_, record) => record.preferredVendor?.name || '—'
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 200,
      render: (_, record) => (
        <ActionColumn
          record={record}
          onView={handleViewItem}
          extraActions={[
            {
              label: 'Restock',
              icon: <PlusCircle className="h-4 w-4" />,
              onClick: () => handleRestock(record)
            },
            {
              label: 'Adjust',
              icon: <Pencil className="h-4 w-4" />,
              onClick: () => handleAdjust(record)
            },
            {
              label: record.isActive ? 'Deactivate' : 'Activate',
              danger: record.isActive,
              icon: record.isActive ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />,
              onClick: () => handleToggleActive(record)
            }
          ]}
        />
      )
    }
  ], []);

  const summaryCards = [
    {
      title: 'Total Items',
      value: summary?.totals?.totalItems || 0,
      prefix: <AppWindow className="h-4 w-4 text-primary" />
    },
    {
      title: 'Total Quantity',
      value: parseFloat(summary?.totals?.totalQuantity || 0).toFixed(2),
      prefix: <Inbox className="h-4 w-4 text-green-500" />
    },
    {
      title: 'Inventory Value',
      value: valueFormatter(summary?.totals?.inventoryValue || 0),
      prefix: <DollarSign className="h-4 w-4 text-yellow-500" />
    },
    {
      title: 'Low Stock Items',
      value: summary?.totals?.lowStockCount || 0,
      prefix: <AlertTriangle className="h-4 w-4 text-red-500" />
    }
  ];

  const drawerTabs = useMemo(() => {
    if (!viewingItem) return [];

    const movementItems = viewingItem.movements
      ?.sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
      .map((movement) => ({
        color: movement.type === 'purchase' ? 'green' : movement.type === 'usage' ? 'red' : '#166534',
        children: (
          <TimelineItem key={movement.id}>
            <TimelineIndicator className={movement.type === 'purchase' ? 'bg-green-500' : movement.type === 'usage' ? 'bg-red-500' : 'bg-[#166534]'} />
            <TimelineContent>
              <TimelineTitle>
              {movement.type.toUpperCase()} {movement.quantityDelta > 0 ? '+' : ''}{parseFloat(movement.quantityDelta).toFixed(2)} {viewingItem.unit}
              </TimelineTitle>
              <TimelineTime>
              {dayjs(movement.occurredAt).format('MMM DD, YYYY [at] hh:mm A')} • New Qty: {parseFloat(movement.newQuantity).toFixed(2)}
              </TimelineTime>
            {movement.reference && (
                <TimelineDescription>Reference: {movement.reference}</TimelineDescription>
            )}
            {movement.createdByUser && (
                <TimelineDescription>
                By: {movement.createdByUser.name} ({movement.createdByUser.email})
                </TimelineDescription>
            )}
            {movement.job && isPrintingPress && (
                <TimelineDescription>
                Job: {movement.job.jobNumber} — {movement.job.title}
                </TimelineDescription>
            )}
            {movement.notes && (
                <TimelineDescription className="italic">
                Notes: {movement.notes}
                </TimelineDescription>
            )}
            </TimelineContent>
          </TimelineItem>
        )
      }));

    return [
      {
        key: 'summary',
        label: 'Summary',
        content: (
          <div className="space-y-6">
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Quantity on Hand</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {parseFloat(viewingItem.quantityOnHand || 0).toFixed(2)} {viewingItem.unit}
                  </div>
                </CardContent>
                </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Reorder Level</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {parseFloat(viewingItem.reorderLevel || 0).toFixed(2)} {viewingItem.unit}
                  </div>
                </CardContent>
                </Card>
            </div>

            <Descriptions column={1}>
              <DescriptionItem label="SKU">{viewingItem.sku || '—'}</DescriptionItem>
              <DescriptionItem label="Category">{viewingItem.category?.name || 'Uncategorized'}</DescriptionItem>
              <DescriptionItem label="Preferred Vendor">
                {viewingItem.preferredVendor?.name || '—'}
              </DescriptionItem>
              <DescriptionItem label="Unit Cost">{valueFormatter(viewingItem.unitCost)}</DescriptionItem>
              <DescriptionItem label="Total Value">
                {valueFormatter(parseFloat(viewingItem.unitCost || 0) * parseFloat(viewingItem.quantityOnHand || 0))}
              </DescriptionItem>
              <DescriptionItem label="Location">{viewingItem.location || '—'}</DescriptionItem>
              <DescriptionItem label="Status">
                <Badge variant={viewingItem.isActive ? 'default' : 'destructive'}>
                  {viewingItem.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </DescriptionItem>
              <DescriptionItem label="Description">{viewingItem.description || '—'}</DescriptionItem>
            </Descriptions>
          </div>
        )
      },
      {
        key: 'movements',
        label: 'Movement History',
        content: movementItems?.length ? (
          <Timeline>
            {movementItems.map(item => item.children)}
          </Timeline>
        ) : (
          <Alert type="info" message="No movement history yet" />
        )
      }
    ];
  }, [viewingItem]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
          <h1 className="text-3xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">Track and manage materials, stock levels, and movements.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { fetchItems(); fetchSummary(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          <Button onClick={() => openItemModal()}>
            <Plus className="h-4 w-4 mr-2" />
              New Item
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <StatisticCard
            key={card.title}
                title={card.title}
                value={card.value}
                prefix={card.prefix}
            className={summaryLoading ? 'opacity-50' : ''}
          />
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
              placeholder="Search by name, SKU, description"
                value={filters.search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filters.categoryId} onValueChange={handleCategoryChange}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
                <Separator className="my-2" />
                  <Button
                  variant="ghost"
                  className="w-full justify-start"
                    onClick={() => openCategoryModal('filter')}
                  >
                  <Plus className="h-4 w-4 mr-2" />
                    Add category
                  </Button>
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch checked={filters.lowStock} onCheckedChange={handleLowStockToggle} />
              <Label>Show low stock only</Label>
            </div>
          </div>
        </CardContent>
      </Card>

        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={8} cols={7} />
          </div>
        ) : (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={items}
            pagination={pagination}
            onChange={handleTableChange}
            scroll={{ x: 1000 }}
          />
        )}

      <DetailsDrawer
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        title={viewingItem ? `${viewingItem.name} (${viewingItem.sku || 'No SKU'})` : 'Item details'}
        width={720}
        onEdit={viewingItem ? () => openItemModal(viewingItem) : null}
        onPrint={null}
        extraActions={
          viewingItem
            ? [
                {
                  key: 'restock',
                  label: 'Restock',
                  icon: <PlusCircle className="h-4 w-4" />,
                  onClick: () => handleRestock(viewingItem)
                },
                {
                  key: 'adjust',
                  label: 'Adjust',
                  icon: <Pencil className="h-4 w-4" />,
                  onClick: () => handleAdjust(viewingItem)
                }
              ]
            : []
        }
        showActions
        tabs={drawerTabs}
      />

      <Dialog open={itemModalVisible} onOpenChange={setItemModalVisible}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? `Edit ${editingItem.name}` : 'New Inventory Item'}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Update inventory item details' : 'Add a new item to your inventory'}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...itemForm}>
            <form onSubmit={itemForm.handleSubmit(onItemSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={itemForm.control}
                name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. A4 Paper Ream" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={itemForm.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Optional SKU" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={itemForm.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                          <Separator className="my-2" />
                      <Button
                            variant="ghost"
                            className="w-full justify-start"
                        onClick={() => openCategoryModal('item')}
                      >
                            <Plus className="h-4 w-4 mr-2" />
                        Add category
                      </Button>
                        </SelectContent>
                </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={itemForm.control}
                name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. pcs, box, roll" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={itemForm.control}
                name="quantityOnHand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity on Hand</FormLabel>
                      <FormControl>
                        <InputNumber
                          min={0}
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
                  control={itemForm.control}
                name="reorderLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reorder Level</FormLabel>
                      <FormControl>
                        <InputNumber
                          min={0}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={itemForm.control}
                name="unitCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Cost</FormLabel>
                      <FormControl>
                        <InputNumber
                          min={0}
                          style={{ width: '100%' }}
                          prefix="GHS"
                          step={0.01}
                          value={field.value}
                          onChange={(value) => field.onChange(value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={itemForm.control}
                  name="preferredVendorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Vendor</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vendor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                  {vendors.map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name || vendor.company || vendor.email}
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
                  control={itemForm.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Storage Location</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Shelf, warehouse, etc." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={itemForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Active</FormLabel>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={itemForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} placeholder="Optional description or specifications" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setItemModalVisible(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={itemForm.formState.isSubmitting}>
                  {itemForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingItem ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
        </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryModalVisible} onOpenChange={setCategoryModalVisible}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Inventory Category</DialogTitle>
            <DialogDescription>Create a new category for organizing inventory items</DialogDescription>
          </DialogHeader>
          
          <Form {...categoryForm}>
            <form onSubmit={categoryForm.handleSubmit(onCategorySubmit)} className="space-y-4">
              <FormField
                control={categoryForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Specialty Papers" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={categoryForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} placeholder="Optional description" />
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
          setCategoryModalVisible(false);
          setCategoryModalContext(null);
        }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={categoryForm.formState.isSubmitting}>
                  {categoryForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Category
                </Button>
              </DialogFooter>
            </form>
        </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={restockModalVisible} onOpenChange={setRestockModalVisible}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? `Restock ${editingItem.name}` : 'Restock'}</DialogTitle>
            <DialogDescription>Add inventory to this item</DialogDescription>
          </DialogHeader>
          
          <Form {...restockForm}>
            <form onSubmit={restockForm.handleSubmit(onRestockSubmit)} className="space-y-4">
              <FormField
                control={restockForm.control}
            name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity to add</FormLabel>
                    <FormControl>
                      <InputNumber
                        min={0.01}
                        step={0.01}
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
                control={restockForm.control}
                name="unitCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Cost</FormLabel>
                    <FormControl>
                      <InputNumber
                        min={0}
                        step={0.01}
                        style={{ width: '100%' }}
                        prefix="GHS"
                        value={field.value}
                        onChange={(value) => field.onChange(value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={restockForm.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Invoice number, supplier reference, etc." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={restockForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} placeholder="Optional notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRestockModalVisible(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={restockForm.formState.isSubmitting}>
                  {restockForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Restock
                </Button>
              </DialogFooter>
            </form>
        </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustModalVisible} onOpenChange={setAdjustModalVisible}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? `Adjust ${editingItem.name}` : 'Adjust Inventory'}</DialogTitle>
            <DialogDescription>Record an inventory adjustment</DialogDescription>
          </DialogHeader>
          
          <Form {...adjustForm}>
            <form onSubmit={adjustForm.handleSubmit(onAdjustSubmit)} className="space-y-4">
              <FormField
                control={adjustForm.control}
                name="adjustmentMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adjustment Mode</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="set">Set to specific quantity</SelectItem>
                        <SelectItem value="delta">Increase / Decrease by amount</SelectItem>
                      </SelectContent>
            </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {adjustmentMode === 'delta' ? (
                <FormField
                  control={adjustForm.control}
                    name="quantityDelta"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity Change</FormLabel>
                      <FormControl>
                    <InputNumber
                      style={{ width: '100%' }}
                      step={0.01}
                      placeholder="Use positive to add, negative to subtract"
                          value={field.value}
                          onChange={(value) => field.onChange(value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={adjustForm.control}
                  name="newQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Quantity</FormLabel>
                      <FormControl>
                        <InputNumber
                          min={0}
                          step={0.01}
                          style={{ width: '100%' }}
                          value={field.value}
                          onChange={(value) => field.onChange(value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={adjustForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Damage, audit correction, sample usage" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={adjustForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} placeholder="Optional additional details" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAdjustModalVisible(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={adjustForm.formState.isSubmitting}>
                  {adjustForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Record Adjustment
                </Button>
              </DialogFooter>
            </form>
        </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Inventory Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate this item? This action can be reversed later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} className="bg-destructive text-destructive-foreground">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Inventory;
