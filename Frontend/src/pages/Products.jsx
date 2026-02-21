/**
 * Products Page
 * 
 * Product catalog management for shop business type.
 * Features: CRUD operations, variants, barcode support, offline caching,
 * shop type-specific fields, and quick-add templates.
 */

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Package,
  Plus,
  RefreshCw,
  AlertTriangle,
  Currency,
  Pencil,
  Loader2,
  Filter,
  Copy,
  Trash2,
  Eye,
  Barcode,
  TrendingUp,
  TrendingDown,
  Share2,
  WifiOff,
  Wifi,
  X,
  Calendar,
  Hash,
  Tag,
  ImagePlus,
  UploadCloud,
  ScanLine,
  PackagePlus,
  QrCode,
  Info,
  Receipt,
} from 'lucide-react';
import dayjs from 'dayjs';
import { useDebounce } from '../hooks/useDebounce';
import { useResponsive } from '../hooks/useResponsive';
import DetailsDrawer from '../components/DetailsDrawer';
import MobileFormDialog from '../components/MobileFormDialog';
import DrawerSectionCard from '../components/DrawerSectionCard';
import ActionColumn from '../components/ActionColumn';
import StatusChip from '../components/StatusChip';
import TableSkeleton from '../components/TableSkeleton';
import DashboardTable from '../components/DashboardTable';
import DashboardStatsCard from '../components/DashboardStatsCard';
import WelcomeSection from '../components/WelcomeSection';
import productService from '../services/productService';
import vendorService from '../services/vendorService';
import PhoneNumberInput from '../components/PhoneNumberInput';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '../utils/fileUtils';
import { useAuth } from '../context/AuthContext';
import { useSmartSearch } from '../context/SmartSearchContext';
import { showSuccess, showError } from '../utils/toast';
import ProductQRScanner from '../components/ProductQRScanner';
import ReceiveStockModal from '../components/ReceiveStockModal';
import ProductQRGenerateModal from '../components/ProductQRGenerateModal';
import ViewToggle from '../components/ViewToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Descriptions, DescriptionItem } from '@/components/ui/descriptions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  SEARCH_PLACEHOLDERS,
  DEBOUNCE_DELAYS,
  PRODUCT_UNITS,
  RESTAURANT_UNITS,
  SHOP_TYPES,
  SHOP_TYPE_FIELDS,
  SHOP_TYPE_HIDDEN_FIELDS,
  SHOP_TYPE_PLACEHOLDERS,
  PRODUCT_FIELD_LABELS,
  SIZE_OPTIONS,
  COLOR_OPTIONS,
  WARRANTY_OPTIONS,
  ALLERGENS_OPTIONS,
  AGE_RANGE_OPTIONS,
  calculateMargin,
  getMarginColor,
  getStockStatus,
  getWorkspaceDisplayName,
} from '../constants';
// =============================================
// HELPER FUNCTIONS
// =============================================

const sortCategories = (list = []) =>
  [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

const valueFormatter = (value, currency = '₵') =>
  `${currency} ${parseFloat(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const marginFormatter = (costPrice, sellingPrice) => {
  const margin = calculateMargin(costPrice, sellingPrice);
  return `${margin.toFixed(1)}%`;
};

const handleNumberChange = (e, onChange) => {
  const raw = e.target.value;
  if (raw === '') {
    onChange('');
    return;
  }
  const n = parseFloat(raw);
  onChange(Number.isNaN(n) ? '' : n);
};

const numberInputValue = (v) => (v === '' ? '' : v);

const FormLabelWithInfo = ({ label, hint }) => (
  <div className="flex items-center gap-1.5">
    <FormLabel>{label}</FormLabel>
    {hint && (
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex text-muted-foreground hover:text-foreground focus:outline-none" aria-label="More info">
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <p>{hint}</p>
        </TooltipContent>
      </Tooltip>
    )}
  </div>
);

const resolveProductImageUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  return resolveImageUrl(url) || '';
};

/** Movement tab: shows sales history for a product */
const ProductMovementTab = ({ productId, unit = 'pcs', valueFormatter }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    setLoading(true);
    productService.getProductSales(productId, { limit: 50 })
      .then((res) => {
        if (cancelled) return;
        const data = res?.data ?? res;
        setItems(data.data || []);
        setTotal(data.count ?? 0);
      })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [productId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        <Receipt className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p>No sales recorded for this product yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Last {items.length} sale{items.length !== 1 ? 's' : ''} involving this product
      </p>
      <div className="space-y-2 max-h-[360px] overflow-y-auto">
        {items.map((item) => {
          const sale = item.sale;
          if (!sale) return null;
          return (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground truncate">
                  {sale.saleNumber || 'Sale'}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {dayjs(sale.createdAt).format('MMM D, YYYY HH:mm')}
                  {sale.customer?.name && ` · ${sale.customer.name}`}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-medium text-foreground">
                  -{parseFloat(item.quantity || 0).toLocaleString()} {unit}
                </div>
                <div className="text-xs text-muted-foreground">
                  {valueFormatter ? valueFormatter(item.total) : `${item.total}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =============================================
// FORM SCHEMAS
// =============================================

const numberOrEmpty = z.union([z.number().min(0), z.literal('')]).transform((v) => (v === '' ? 0 : v));

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  costPrice: numberOrEmpty,
  sellingPrice: numberOrEmpty,
  quantityOnHand: numberOrEmpty,
  reorderLevel: numberOrEmpty,
  reorderQuantity: numberOrEmpty,
  unit: z.string().min(1, 'Unit is required'),
  brand: z.string().optional(),
  supplier: z.string().optional(),
  hasVariants: z.boolean().default(false),
  isActive: z.boolean().default(true),
  trackStock: z.boolean().default(true),
  imageUrl: z.string().optional(),
  // Shop type specific fields stored in metadata
  expiryDate: z.string().optional(),
  batchNumber: z.string().optional(),
  isPerishable: z.boolean().optional(),
  serialNumber: z.string().optional(),
  warrantyPeriod: z.number().optional(),
  specifications: z.string().optional(),
  dimensions: z.string().optional(),
  weight: z.string().optional(),
  material: z.string().optional(),
  partNumber: z.string().optional(),
  compatibility: z.string().optional(),
  vehicleModels: z.string().optional(),
  isbn: z.string().optional(),
  author: z.string().optional(),
  publisher: z.string().optional(),
  assemblyRequired: z.boolean().optional(),
  // Restaurant
  allergens: z.string().optional(),
  // Clothing/Beauty
  sizes: z.string().optional(),
  colors: z.string().optional(),
  // Sports
  size: z.string().optional(),
  // Toys
  ageRange: z.string().optional(),
  batteryRequired: z.boolean().optional(),
});

const stockAdjustSchema = z.object({
  adjustmentMode: z.enum(['set', 'delta']),
  newQuantity: z.union([z.number().min(0), z.literal('')]).transform((v) => (v === '' ? undefined : v)).optional(),
  quantityDelta: z.union([z.number(), z.literal('')]).transform((v) => (v === '' ? undefined : v)).optional(),
  reason: z.string().optional(),
}).refine((data) => {
  if (data.adjustmentMode === 'set') {
    return data.newQuantity !== undefined && data.newQuantity !== '';
  }
  return data.quantityDelta !== undefined && data.quantityDelta !== '';
}, {
  message: 'Quantity is required',
  path: ['newQuantity'],
});

const variantSchema = z.object({
  name: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  costPrice: z.union([z.number().min(0), z.literal('')]).transform((v) => (v === '' ? undefined : v)).optional(),
  sellingPrice: z.union([z.number().min(0), z.literal('')]).transform((v) => (v === '' ? undefined : v)).optional(),
  quantityOnHand: z.union([z.number().min(0), z.literal('')]).transform((v) => (v === '' ? 0 : v)),
  size: z.string().min(1, 'Size is required'),
  color: z.string().optional(),
});

const quickVendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  company: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  phone: z.string().optional(),
});

// =============================================
// MAIN COMPONENT
// =============================================

const Products = () => {
  const { user, activeTenant, activeTenantId, isAdmin, isManager } = useAuth();
  const { isMobile } = useResponsive();
  const { setPageSearchConfig } = useSmartSearch();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get shop type from tenant metadata
  const shopType = activeTenant?.metadata?.shopType || SHOP_TYPES.CONVENIENCE;
  const shopTypeFields = SHOP_TYPE_FIELDS[shopType] || [];

  // Debug: log shop type and fields when they change (helps verify size/allergens show for restaurant)
  useEffect(() => {
    console.log('[Products] shopType=%s shopTypeFields=%o hasSize=%s activeTenant.metadata=%o', shopType, shopTypeFields, shopTypeFields.includes('size'), activeTenant?.metadata);
  }, [shopType, shopTypeFields, activeTenant?.metadata]);

  // Shop-type-specific unit options (restaurant gets extra units)
  const unitOptions = useMemo(() => {
    if (shopType === SHOP_TYPES.RESTAURANT) {
      return [...PRODUCT_UNITS, ...RESTAURANT_UNITS];
    }
    return PRODUCT_UNITS;
  }, [shopType]);

  // Shop-type-specific placeholders for form fields
  const placeholders = useMemo(() => {
    return SHOP_TYPE_PLACEHOLDERS[shopType] || SHOP_TYPE_PLACEHOLDERS.default;
  }, [shopType]);

  // Check if a field should be hidden for this shop type
  const isFieldHidden = useCallback((fieldName) => {
    const hidden = SHOP_TYPE_HIDDEN_FIELDS[shopType];
    return hidden && hidden.includes(fieldName);
  }, [shopType]);

  // =============================================
  // STATE
  // =============================================

  // Data state
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Pagination
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // Filters
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  // UI state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [adjustStockOpen, setAdjustStockOpen] = useState(false);
  const [productToAdjust, setProductToAdjust] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [variantFormOpen, setVariantFormOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [productImageUploading, setProductImageUploading] = useState(false);
  const [productImageDragging, setProductImageDragging] = useState(false);
  const productImageInputRef = useRef(null);
  const [vendors, setVendors] = useState([]);

  // Category creation state
  const [tableViewMode, setTableViewMode] = useState('table');
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [receiveStockOpen, setReceiveStockOpen] = useState(false);
  const [qrGenerateOpen, setQrGenerateOpen] = useState(false);
  const [productForQR, setProductForQR] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [vendorAddModalOpen, setVendorAddModalOpen] = useState(false);
  const [vendorSelectOpen, setVendorSelectOpen] = useState(false);
  const [vendorCategories, setVendorCategories] = useState([]);
  const [addingVendor, setAddingVendor] = useState(false);

  // Offline state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingChanges, setPendingChanges] = useState(0);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    lowStock: 0,
    outOfStock: 0,
    totalValue: 0,
  });

  // Debounced search
  const debouncedSearch = useDebounce(searchText, DEBOUNCE_DELAYS.SEARCH);

  // =============================================
  // FORMS
  // =============================================

  const form = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      sku: '',
      barcode: '',
      description: '',
      categoryId: '',
      costPrice: 0,
      sellingPrice: 0,
      quantityOnHand: 0,
      reorderLevel: 0,
      reorderQuantity: 0,
      unit: 'pcs',
      brand: '',
      supplier: '',
      hasVariants: false,
      isActive: true,
      imageUrl: '',
      expiryDate: '',
      batchNumber: '',
      isPerishable: false,
      serialNumber: '',
      warrantyPeriod: 0,
      specifications: '',
      dimensions: '',
      weight: '',
      material: '',
      partNumber: '',
      compatibility: '',
      vehicleModels: '',
      isbn: '',
      author: '',
      publisher: '',
      assemblyRequired: false,
      allergens: '',
      sizes: '',
      colors: '',
      size: '',
      ageRange: '',
      batteryRequired: false,
    },
  });

  const adjustForm = useForm({
    resolver: zodResolver(stockAdjustSchema),
    defaultValues: {
      adjustmentMode: 'set',
      newQuantity: 0,
      quantityDelta: 0,
      reason: '',
    },
  });

  const variantForm = useForm({
    resolver: zodResolver(variantSchema),
    defaultValues: {
      sku: '',
      barcode: '',
      costPrice: 0,
      sellingPrice: 0,
      quantityOnHand: 0,
      size: '',
      color: '',
    },
  });

  const vendorForm = useForm({
    resolver: zodResolver(quickVendorSchema),
    defaultValues: {
      name: '',
      company: '',
      category: '',
      phone: '',
    },
  });

  // Watch form values for margin calculation
  const watchCostPrice = form.watch('costPrice');
  const watchSellingPrice = form.watch('sellingPrice');
  const calculatedMargin = useMemo(
    () => calculateMargin(watchCostPrice, watchSellingPrice),
    [watchCostPrice, watchSellingPrice]
  );

  const handleOpenQRGenerate = useCallback((product) => {
    setProductForQR(product);
    setQrGenerateOpen(true);
  }, []);

  const handleOpenQRGenerateFromForm = useCallback(() => {
    if (editingProduct) {
      handleOpenQRGenerate(editingProduct);
      return;
    }
    const v = form.getValues();
    const cat = categories.find((c) => c.id === v.categoryId);
    handleOpenQRGenerate({
      name: v.name,
      sku: v.sku,
      barcode: v.barcode,
      description: v.description,
      imageUrl: v.imageUrl,
      costPrice: v.costPrice,
      sellingPrice: v.sellingPrice,
      quantityOnHand: v.quantityOnHand,
      reorderLevel: v.reorderLevel,
      reorderQuantity: v.reorderQuantity,
      unit: v.unit,
      brand: v.brand,
      supplier: v.supplier,
      categoryName: cat?.name,
    });
  }, [editingProduct, form, categories, handleOpenQRGenerate]);

  // =============================================
  // MEMOIZED VALUES
  // =============================================

  const tableColumns = useMemo(() => [
    {
      key: 'name',
      title: 'Product',
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded border border-border bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
            {record.imageUrl ? (
              <button
                type="button"
                onClick={() => setImagePreviewUrl(resolveProductImageUrl(record.imageUrl))}
                className="w-full h-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset"
              >
                <img
                  src={resolveProductImageUrl(record.imageUrl)}
                  alt={record.name || 'Product'}
                  className="w-full h-full object-cover"
                />
              </button>
            ) : (
              <Package className="h-5 w-5 text-gray-400" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-medium truncate">{record.name}</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {record.sku && <span>SKU: {record.sku}</span>}
              {record.barcode && <Barcode className="h-3 w-3" />}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      title: 'Category',
      render: (_, record) => (
        <Badge variant="outline">
          {record.category?.name || 'Uncategorized'}
        </Badge>
      ),
    },
    {
      key: 'quantityOnHand',
      title: 'Stock',
      render: (_, record) => {
        if (record.trackStock === false) {
          return <Badge variant="outline" className="text-muted-foreground">Made to order</Badge>;
        }
        const statusKey = getStockStatus(record.quantityOnHand, record.reorderLevel);
        return (
          <div className="flex items-center gap-2">
            <span>{parseFloat(record.quantityOnHand || 0).toLocaleString()} {record.unit}</span>
            <StatusChip status={statusKey} size="small" />
          </div>
        );
      },
    },
    {
      key: 'costPrice',
      title: 'Cost',
      render: (value) => valueFormatter(value),
      hidden: isMobile,
    },
    {
      key: 'sellingPrice',
      title: 'Price',
      render: (value) => valueFormatter(value),
    },
    {
      key: 'margin',
      title: 'Margin',
      render: (_, record) => {
        const margin = calculateMargin(record.costPrice, record.sellingPrice);
        const color = getMarginColor(margin);
        return (
          <Badge variant={color}>
            {margin.toFixed(1)}%
          </Badge>
        );
      },
      hidden: isMobile,
    },
    {
      key: 'isActive',
      title: 'Status',
      render: (value) => (
        <StatusChip status={value ? 'active_flag' : 'inactive_flag'} size="small" />
      ),
      hidden: isMobile,
    },
    {
      key: 'actions',
      title: '',
      render: (_, record) => (
        <ActionColumn
          onView={() => handleViewProduct(record)}
          record={record}
          extraActions={[
            {
              key: 'duplicate',
              label: 'Duplicate',
              icon: <Copy className="h-4 w-4" />,
              onClick: () => handleDuplicateProduct(record),
            },
            {
              key: 'share',
              label: 'Share via WhatsApp',
              icon: <Share2 className="h-4 w-4" />,
              onClick: () => handleWhatsAppShare(record),
            },
            {
              key: 'qr',
              label: 'Generate QR',
              icon: <QrCode className="h-4 w-4" />,
              onClick: () => handleOpenQRGenerate(record),
            },
          ]}
        />
      ),
    },
  ], [isMobile, handleOpenQRGenerate]);

  // =============================================
  // DATA FETCHING
  // =============================================

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        search: debouncedSearch,
        categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
      };

      // Add stock filter
      if (stockFilter === 'low') {
        params.lowStock = true;
      } else if (stockFilter === 'out') {
        params.outOfStock = true;
      }

      const response = await productService.getProducts(params);
      const body = response && typeof response === 'object' ? response : {};
      const list = body.data ?? body.products ?? [];

      setProducts(Array.isArray(list) ? list : []);
      setPagination(prev => ({
        ...prev,
        total: body?.count ?? body?.pagination?.total ?? 0,
      }));

      if (Array.isArray(list) && list.length) {
        productService.cacheProducts(list);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
      
      // Try to use cached data
      const cached = productService.getCachedProducts(true);
      if (cached) {
        setProducts(cached);
        showError(null, 'Using cached data - check your connection');
      } else {
        showError(error, 'Failed to load products');
      }
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, debouncedSearch, categoryFilter, stockFilter]);

  const fetchCategories = useCallback(async () => {
    try {
      console.log('[Products fetchCategories] Fetching product_categories from /products/categories');
      const response = await productService.getCategories();
      const data = response?.data ?? response;
      const categoryList = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.categories)
          ? data.categories
          : Array.isArray(data)
            ? data
            : [];
      if (categoryList.length === 0) {
        console.warn('[Products fetchCategories] API returned 0 product_categories. Check: tenant context, backend seeded product_categories for this tenant.');
      } else {
        console.log('[Products fetchCategories] Loaded', categoryList.length, 'product_categories (NOT inventory_categories):', categoryList.map(c => c.name));
      }
      setCategories(sortCategories(categoryList));
      productService.cacheCategories(categoryList);
    } catch (error) {
      const status = error?.response?.status;
      const message = error?.response?.data?.message ?? error?.message;
      console.error('[Products fetchCategories] Failed to load categories:', {
        status,
        message,
        fullError: error
      });
      const cached = productService.getCachedCategories();
      if (cached?.length) {
        console.log('[Products fetchCategories] Using', cached.length, 'cached categories');
        setCategories(sortCategories(cached));
      } else {
        console.warn('[Products fetchCategories] No cached categories; dropdown will be empty');
      }
    }
  }, []);

  const fetchVendors = useCallback(async () => {
    try {
      const response = await vendorService.getVendors({ limit: 500 });
      const data = response?.data ?? response;
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      setVendors(list);
    } catch (error) {
      console.error('[Products fetchVendors] Failed to load vendors:', error?.message);
      setVendors([]);
    }
  }, []);

  const fetchVendorCategories = useCallback(async () => {
    try {
      const cats = await vendorService.getCategories();
      setVendorCategories(Array.isArray(cats) ? cats : []);
    } catch (error) {
      console.error('[Products fetchVendorCategories] Failed:', error?.message);
      setVendorCategories([]);
    }
  }, []);

  // Create new category
  const handleCreateCategory = useCallback(async () => {
    if (!newCategoryName.trim()) {
      showError('Please enter a category name');
      return;
    }
    
    setCreatingCategory(true);
    try {
      const response = await productService.createCategory({ name: newCategoryName.trim() });
      const newCategory = response.data || response;
      
      if (newCategory?.id) {
        setCategories(prev => {
          const updated = sortCategories([...prev, newCategory]);
          productService.cacheCategories(updated);
          return updated;
        });
        showSuccess('Category created successfully');
        setCategoryModalOpen(false);
        setNewCategoryName('');
        
        // Auto-select the new category in the form if it's open
        if (formOpen) {
          form.setValue('categoryId', String(newCategory.id));
        }
      }
    } catch (error) {
      console.error('Failed to create category:', error);
      showError(error?.response?.data?.message || 'Failed to create category');
    } finally {
      setCreatingCategory(false);
    }
  }, [newCategoryName, formOpen, form]);

  const handleAddNewVendor = useCallback((e) => {
    if (e) e.preventDefault();
    setVendorSelectOpen(false);
    vendorForm.reset({ name: '', company: '', category: '', phone: '' });
    setVendorAddModalOpen(true);
  }, [vendorForm]);

  const handleAddVendorSubmit = useCallback(async (values) => {
    setAddingVendor(true);
    try {
      const response = await vendorService.create({
        name: values.name.trim(),
        company: values.company?.trim() || undefined,
        category: values.category,
        phone: values.phone?.trim() || undefined,
      });
      const newVendor = response?.data ?? response;
      const vendorName = newVendor?.name || newVendor?.company || values.name;
      await fetchVendors();
      form.setValue('supplier', vendorName);
      setVendorAddModalOpen(false);
      vendorForm.reset({ name: '', company: '', category: '', phone: '' });
      showSuccess('Vendor created successfully');
    } catch (error) {
      const msg = error?.response?.data?.error || error?.response?.data?.message || error?.message;
      showError(msg || 'Failed to create vendor');
    } finally {
      setAddingVendor(false);
    }
  }, [form, vendorForm, fetchVendors]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      // Fetch all products for stats calculation
      const response = await productService.getProducts({ limit: 100 });
      const body = response && typeof response === 'object' ? response : {};
      const allProducts = Array.isArray(body.data) ? body.data : (Array.isArray(body.products) ? body.products : []);

      const total = allProducts.length;
      const trackingProducts = allProducts.filter(p => p.trackStock !== false);
      const lowStock = trackingProducts.filter(p => {
        const qty = parseFloat(p.quantityOnHand || 0);
        const reorder = parseFloat(p.reorderLevel || 0);
        return qty > 0 && qty <= reorder;
      }).length;
      const outOfStock = trackingProducts.filter(p => parseFloat(p.quantityOnHand || 0) <= 0).length;
      const totalValue = allProducts.reduce((sum, p) => {
        return sum + (parseFloat(p.costPrice || 0) * parseFloat(p.quantityOnHand || 0));
      }, 0);

      setStats({ total, lowStock, outOfStock, totalValue });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // =============================================
  // EFFECTS
  // =============================================

  // Initial load
  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchStats();
  }, []);

  // Refetch categories and vendors when Add/Edit Product modal opens so dropdowns have options (tenant-scoped)
  useEffect(() => {
    if (formOpen && activeTenantId) {
      fetchCategories();
      fetchVendors();
      fetchVendorCategories();
    }
  }, [formOpen, activeTenantId, fetchCategories, fetchVendors, fetchVendorCategories]);

  // Clear vendor list when tenant changes so we don't show another tenant's vendors
  useEffect(() => {
    setVendors([]);
  }, [activeTenantId]);

  // Refetch on filter changes
  useEffect(() => {
    fetchProducts();
  }, [debouncedSearch, categoryFilter, stockFilter, pagination.current, pagination.pageSize]);

  // Set up smart search
  useEffect(() => {
    setPageSearchConfig({
      placeholder: SEARCH_PLACEHOLDERS.PRODUCTS,
      onSearch: setSearchText,
    });
    return () => setPageSearchConfig(null);
  }, [setPageSearchConfig]);

  // Open form when add=1 query param is present (e.g., from dashboard "Add Product" button)
  useEffect(() => {
    if (searchParams.get('add') === '1') {
      setFormOpen(true);
      setEditingProduct(null);
      form.reset();
      const next = new URLSearchParams(searchParams);
      next.delete('add');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, form]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Sync pending changes
      const pending = productService.getPendingChanges();
      if (pending.length > 0) {
        productService.syncPendingChanges().then(results => {
          if (results.synced > 0) {
            showSuccess(`Synced ${results.synced} pending changes`);
            fetchProducts();
            fetchStats();
          }
        });
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check pending changes
    setPendingChanges(productService.getPendingChanges().length);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // =============================================
  // HANDLERS
  // =============================================

  const handleViewProduct = (product) => {
    setSelectedProduct(product);
    setDrawerOpen(true);
    productService.getProductById(product.id)
      .then((response) => {
        const data = response?.data || response;
        setSelectedProduct((prev) => (prev?.id === product.id ? data : prev));
      })
      .catch((error) => console.error('Failed to fetch product details:', error));
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    
    // Reset form with product data
    form.reset({
      name: product.name || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      description: product.description || '',
      categoryId: product.categoryId ? String(product.categoryId) : '',
      costPrice: parseFloat(product.costPrice) || 0,
      sellingPrice: parseFloat(product.sellingPrice) || 0,
      quantityOnHand: parseFloat(product.quantityOnHand) || 0,
      reorderLevel: parseFloat(product.reorderLevel) || 0,
      reorderQuantity: parseFloat(product.reorderQuantity) || 0,
      unit: product.unit || 'pcs',
      brand: product.brand || '',
      supplier: product.supplier || '',
      hasVariants: product.hasVariants || false,
      isActive: product.isActive !== false,
      trackStock: product.trackStock !== false,
      imageUrl: product.imageUrl || '',
      // Metadata fields
      expiryDate: product.metadata?.expiryDate || '',
      batchNumber: product.metadata?.batchNumber || '',
      isPerishable: product.metadata?.isPerishable || false,
      serialNumber: product.metadata?.serialNumber || '',
      warrantyPeriod: product.metadata?.warrantyPeriod || 0,
      specifications: product.metadata?.specifications || '',
      dimensions: product.metadata?.dimensions || '',
      weight: product.metadata?.weight || '',
      material: product.metadata?.material || '',
      partNumber: product.metadata?.partNumber || '',
      compatibility: product.metadata?.compatibility || '',
      vehicleModels: product.metadata?.vehicleModels || '',
      isbn: product.metadata?.isbn || '',
      author: product.metadata?.author || '',
      publisher: product.metadata?.publisher || '',
      assemblyRequired: product.metadata?.assemblyRequired || false,
      allergens: product.metadata?.allergens || '',
      sizes: product.metadata?.sizes || '',
      colors: product.metadata?.colors || '',
      size: product.metadata?.size || '',
      ageRange: product.metadata?.ageRange || '',
      batteryRequired: product.metadata?.batteryRequired || false,
    });
    
    setFormOpen(true);
  };

  const handleCreateProduct = () => {
    setEditingProduct(null);
    form.reset({
      name: '',
      sku: '',
      barcode: '',
      description: '',
      categoryId: '',
      costPrice: 0,
      sellingPrice: 0,
      quantityOnHand: 0,
      reorderLevel: 0,
      reorderQuantity: 0,
      unit: 'pcs',
      brand: '',
      supplier: '',
      hasVariants: false,
      isActive: true,
      trackStock: true,
      imageUrl: '',
      expiryDate: '',
      batchNumber: '',
      isPerishable: false,
      serialNumber: '',
      warrantyPeriod: 0,
      specifications: '',
      dimensions: '',
      weight: '',
      material: '',
      partNumber: '',
      compatibility: '',
      vehicleModels: '',
      isbn: '',
      author: '',
      publisher: '',
      assemblyRequired: false,
      allergens: '',
      sizes: '',
      colors: '',
      size: '',
      ageRange: '',
      batteryRequired: false,
    });
    setFormOpen(true);
  };

  const handleProductDataFromQR = useCallback(
    (data) => {
      const categoryId =
        data.categoryName && categories.length
          ? (categories.find((c) => c.name && c.name.toLowerCase() === data.categoryName.toLowerCase())?.id || '')
          : '';
      setEditingProduct(null);
      form.reset({
        name: data.name || '',
        sku: data.sku || '',
        barcode: data.barcode || '',
        description: data.description || '',
        categoryId: categoryId || '',
        costPrice: data.costPrice ?? 0,
        sellingPrice: data.sellingPrice ?? 0,
        quantityOnHand: data.quantityOnHand ?? 0,
        reorderLevel: data.reorderLevel ?? 0,
        reorderQuantity: data.reorderQuantity ?? 0,
        unit: data.unit || 'pcs',
        brand: data.brand || '',
        supplier: data.supplier || '',
        hasVariants: data.hasVariants ?? false,
        isActive: data.isActive !== false,
        trackStock: data.trackStock ?? true,
        imageUrl: data.imageUrl || '',
        expiryDate: data.expiryDate || '',
        batchNumber: data.batchNumber || '',
        isPerishable: data.isPerishable ?? false,
        serialNumber: data.serialNumber || '',
        warrantyPeriod: data.warrantyPeriod ?? 0,
        specifications: data.specifications || '',
        dimensions: data.dimensions || '',
        weight: data.weight || '',
        material: data.material || '',
        partNumber: data.partNumber || '',
        compatibility: data.compatibility || '',
        vehicleModels: data.vehicleModels || '',
        isbn: data.isbn || '',
        author: data.author || '',
        publisher: data.publisher || '',
        assemblyRequired: data.assemblyRequired ?? false,
        allergens: data.allergens || '',
        sizes: data.sizes || '',
        colors: data.colors || '',
        size: data.size || '',
        ageRange: data.ageRange || '',
        batteryRequired: data.batteryRequired ?? false,
      });
      setFormOpen(true);
      setQrScannerOpen(false);
      showSuccess('Product details filled from QR code');
    },
    [categories, form]
  );

  const handleDeleteClick = (product) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;
    
    setSubmitting(true);
    try {
      await productService.deleteProduct(productToDelete.id);
      showSuccess('Product deleted successfully');
      setDeleteDialogOpen(false);
      setProductToDelete(null);
      fetchProducts();
      fetchStats();
    } catch (error) {
      showError(error, 'Failed to delete product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicateProduct = async (product) => {
    try {
      await productService.duplicateProduct(product.id);
      showSuccess('Product duplicated successfully');
      fetchProducts();
      fetchStats();
    } catch (error) {
      showError(error, 'Failed to duplicate product');
    }
  };

  const handleOpenVariantForm = useCallback((variant = null) => {
    if (variant) {
      // Editing existing variant
      variantForm.reset({
        sku: variant.sku || '',
        barcode: variant.barcode || '',
        costPrice: variant.costPrice ?? selectedProduct?.costPrice ?? 0,
        sellingPrice: variant.sellingPrice ?? selectedProduct?.sellingPrice ?? 0,
        quantityOnHand: variant.quantityOnHand ?? 0,
        size: variant.attributes?.size || '',
        color: variant.attributes?.color || '',
      });
      setEditingVariant(variant);
    } else {
      // Creating new variant
      variantForm.reset({
        sku: '',
        barcode: '',
        costPrice: selectedProduct?.costPrice ?? 0,
        sellingPrice: selectedProduct?.sellingPrice ?? 0,
        quantityOnHand: 0,
        size: '',
        color: '',
      });
      setEditingVariant(null);
    }
    setVariantFormOpen(true);
  }, [selectedProduct, variantForm]);

  const handleCloseVariantForm = useCallback(() => {
    setVariantFormOpen(false);
    setEditingVariant(null);
    variantForm.reset();
  }, [variantForm]);

  const handleVariantFormSubmit = async (values) => {
    if (!selectedProduct?.id) return;
    setSubmitting(true);
    try {
      // Use size value as name, or find the label from SIZE_OPTIONS
      const sizeOption = SIZE_OPTIONS.find(opt => opt.value === values.size);
      const variantName = sizeOption ? sizeOption.label : values.size || values.name || '';
      
      const payload = {
        name: variantName,
        sku: values.sku || undefined,
        barcode: values.barcode || undefined,
        costPrice: values.costPrice !== undefined && values.costPrice !== '' ? Number(values.costPrice) : undefined,
        sellingPrice: values.sellingPrice !== undefined && values.sellingPrice !== '' ? Number(values.sellingPrice) : undefined,
        quantityOnHand: Number(values.quantityOnHand) || 0,
        attributes: {},
      };
      if (values.size) payload.attributes.size = values.size;
      if (values.color) payload.attributes.color = values.color;

      if (editingVariant) {
        await productService.updateProductVariant(editingVariant.id, payload);
        showSuccess('Variant updated successfully');
      } else {
        await productService.createProductVariant(selectedProduct.id, payload);
        showSuccess('Variant added successfully');
      }

      handleCloseVariantForm();
      fetchProducts();
      fetchStats();
      productService.getProductById(selectedProduct.id).then((r) => {
        const data = r?.data?.data ?? r?.data ?? r;
        if (data?.id) setSelectedProduct(data);
      });
    } catch (error) {
      showError(error, editingVariant ? 'Failed to update variant' : 'Failed to add variant');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormSubmit = async (values) => {
    setSubmitting(true);
    try {
      // Extract metadata fields
      const metadataFields = [
        'expiryDate', 'batchNumber', 'isPerishable', 'serialNumber',
        'warrantyPeriod', 'specifications', 'dimensions', 'weight',
        'material', 'partNumber', 'compatibility', 'vehicleModels',
        'isbn', 'author', 'publisher', 'assemblyRequired',
        'allergens', 'sizes', 'colors', 'size', 'ageRange', 'batteryRequired',
      ];
      
      const metadata = {};
      metadataFields.forEach(field => {
        const val = values[field];
        if (val !== undefined && val !== '' && val !== false && val !== 0) {
          if (Array.isArray(val) && val.length === 0) return;
          metadata[field] = val;
        }
      });

      const payload = {
        name: values.name,
        sku: values.sku || undefined,
        barcode: values.barcode || undefined,
        description: values.description || undefined,
        categoryId: values.categoryId || undefined,
        costPrice: values.costPrice === '' ? 0 : (Number(values.costPrice) ?? 0),
        sellingPrice: values.sellingPrice === '' ? 0 : (Number(values.sellingPrice) ?? 0),
        quantityOnHand: values.quantityOnHand === '' ? 0 : (Number(values.quantityOnHand) ?? 0),
        reorderLevel: values.reorderLevel === '' ? 0 : (Number(values.reorderLevel) ?? 0),
        reorderQuantity: values.reorderQuantity === '' ? 0 : (Number(values.reorderQuantity) ?? 0),
        unit: values.unit,
        brand: values.brand || undefined,
        supplier: values.supplier || undefined,
        hasVariants: values.hasVariants,
        isActive: values.isActive,
        trackStock: values.trackStock,
        imageUrl: values.imageUrl || undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };

      if (editingProduct) {
        await productService.updateProduct(editingProduct.id, payload);
        showSuccess('Product updated successfully');
      } else {
        await productService.createProduct(payload);
        showSuccess('Product created successfully');
      }

      setFormOpen(false);
      setEditingProduct(null);
      fetchProducts();
      fetchStats();
    } catch (error) {
      showError(error, editingProduct ? 'Failed to update product' : 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProductImageSelect = useCallback(async (eOrFile) => {
    const file = eOrFile?.target?.files?.[0] ?? (eOrFile instanceof File ? eOrFile : null);
    if (!file || !file.type.startsWith('image/')) return;
    const maxSizeMB = 5;
    if (file.size > maxSizeMB * 1024 * 1024) {
      showError(`File size must be under ${maxSizeMB}MB`);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    form.setValue('imageUrl', objectUrl);
    setProductImageUploading(true);
    try {
      const res = await productService.uploadProductImage(file);
      const imageUrl = res?.data?.imageUrl ?? res?.imageUrl;
      if (imageUrl) {
        URL.revokeObjectURL(objectUrl);
        form.setValue('imageUrl', imageUrl);
        showSuccess('Image uploaded');
      } else {
        form.setValue('imageUrl', objectUrl);
        showError('Upload succeeded but no image URL returned');
      }
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      form.setValue('imageUrl', '');
      showError(err, 'Failed to upload image');
    } finally {
      setProductImageUploading(false);
      if (productImageInputRef.current) productImageInputRef.current.value = '';
    }
  }, [form]);

  const handleRemoveProductImage = useCallback(() => {
    form.setValue('imageUrl', '');
  }, [form]);

  const handleAdjustStockClick = (product) => {
    setProductToAdjust(product);
    adjustForm.reset({
      adjustmentMode: 'set',
      newQuantity: parseFloat(product.quantityOnHand) || 0,
      quantityDelta: 0,
      reason: '',
    });
    setAdjustStockOpen(true);
  };

  const handleAdjustStockSubmit = async (values) => {
    if (!productToAdjust) return;
    
    setSubmitting(true);
    try {
      const quantity = values.adjustmentMode === 'set' 
        ? values.newQuantity 
        : values.quantityDelta;
      
      await productService.adjustStock(
        productToAdjust.id,
        quantity,
        values.adjustmentMode,
        values.reason
      );
      
      showSuccess('Stock adjusted successfully');
      setAdjustStockOpen(false);
      setProductToAdjust(null);
      fetchProducts();
      fetchStats();
      
      // Refresh drawer if open
      if (selectedProduct?.id === productToAdjust.id) {
        const response = await productService.getProductById(productToAdjust.id);
        setSelectedProduct(response.data || response);
      }
    } catch (error) {
      showError(error, 'Failed to adjust stock');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWhatsAppShare = (product) => {
    const stockLine = product.trackStock === false
      ? `📦 Stock: Made to order\n`
      : `📦 Stock: ${product.quantityOnHand} ${product.unit}\n`;
    const message = encodeURIComponent(
      `🏷️ *${product.name}*\n\n` +
      `💰 Price: ${valueFormatter(product.sellingPrice)}\n` +
      stockLine +
      (product.sku ? `🔖 SKU: ${product.sku}\n` : '') +
      (product.description ? `\n${product.description}\n` : '') +
      `\n_Sent from ${getWorkspaceDisplayName(activeTenant?.name, null, 'Our Store')}_`
    );
    
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const handleRefresh = () => {
    productService.clearCache();
    fetchProducts();
    fetchCategories();
    fetchStats();
  };

  const handlePageChange = (newPagination) => {
    setPagination(prev => ({ ...prev, ...newPagination }));
  };

  // =============================================
  // RENDER HELPERS
  // =============================================

  const renderShopTypeFields = () => {
    const fields = [];
    const trackStock = form.watch('trackStock') !== false;

    // Supermarket/Convenience fields (hide expiry/batch/perishable when track stock is off - made to order)
    if (shopTypeFields.includes('expiryDate') && trackStock) {
      fields.push(
        <FormField
          key="expiryDate"
          control={form.control}
          name="expiryDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{PRODUCT_FIELD_LABELS.expiryDate}</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }
    
    if (shopTypeFields.includes('batchNumber') && trackStock) {
      fields.push(
        <FormField
          key="batchNumber"
          control={form.control}
          name="batchNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{PRODUCT_FIELD_LABELS.batchNumber}</FormLabel>
              <FormControl>
                <Input placeholder="Enter batch number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }
    
    if (shopTypeFields.includes('isPerishable') && trackStock) {
      fields.push(
        <FormField
          key="isPerishable"
          control={form.control}
          name="isPerishable"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabelWithInfo label={PRODUCT_FIELD_LABELS.isPerishable} hint="Mark if product can expire" />
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
      );
    }

    // Electronics fields
    if (shopTypeFields.includes('serialNumber')) {
      fields.push(
        <FormField
          key="serialNumber"
          control={form.control}
          name="serialNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{PRODUCT_FIELD_LABELS.serialNumber}</FormLabel>
              <FormControl>
                <Input placeholder="Enter serial number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }
    
    if (shopTypeFields.includes('warrantyPeriod')) {
      fields.push(
        <FormField
          key="warrantyPeriod"
          control={form.control}
          name="warrantyPeriod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{PRODUCT_FIELD_LABELS.warrantyPeriod}</FormLabel>
              <Select
                value={field.value?.toString() || '0'}
                onValueChange={(value) => field.onChange(parseInt(value))}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select warranty" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {WARRANTY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }
    
    if (shopTypeFields.includes('specifications')) {
      fields.push(
        <FormField
          key="specifications"
          control={form.control}
          name="specifications"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{PRODUCT_FIELD_LABELS.specifications}</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter product specifications" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }

    // Hardware/Furniture fields
    if (shopTypeFields.includes('dimensions')) {
      fields.push(
        <FormField
          key="dimensions"
          control={form.control}
          name="dimensions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{PRODUCT_FIELD_LABELS.dimensions}</FormLabel>
              <FormControl>
                <Input placeholder="e.g., 100cm x 50cm x 30cm" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }
    
    if (shopTypeFields.includes('weight')) {
      fields.push(
        <FormField
          key="weight"
          control={form.control}
          name="weight"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{PRODUCT_FIELD_LABELS.weight}</FormLabel>
              <FormControl>
                <Input placeholder="e.g., 5kg" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }
    
    if (shopTypeFields.includes('material')) {
      fields.push(
        <FormField
          key="material"
          control={form.control}
          name="material"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{PRODUCT_FIELD_LABELS.material}</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Wood, Metal, Plastic" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }
    
    if (shopTypeFields.includes('assemblyRequired')) {
      fields.push(
        <FormField
          key="assemblyRequired"
          control={form.control}
          name="assemblyRequired"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabelWithInfo label={PRODUCT_FIELD_LABELS.assemblyRequired} hint="Product requires assembly" />
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
      );
    }

    // Auto parts fields
    if (shopTypeFields.includes('partNumber')) {
      fields.push(
        <FormField
          key="partNumber"
          control={form.control}
          name="partNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{PRODUCT_FIELD_LABELS.partNumber}</FormLabel>
              <FormControl>
                <Input placeholder="Enter part number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }
    
    if (shopTypeFields.includes('compatibility')) {
      fields.push(
        <FormField
          key="compatibility"
          control={form.control}
          name="compatibility"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{PRODUCT_FIELD_LABELS.compatibility}</FormLabel>
              <FormControl>
                <Input placeholder="Compatible models/brands" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }
    
    if (shopTypeFields.includes('vehicleModels')) {
      fields.push(
        <FormField
          key="vehicleModels"
          control={form.control}
          name="vehicleModels"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{PRODUCT_FIELD_LABELS.vehicleModels}</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., Toyota Corolla 2015-2020, Honda Civic 2016+" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }

    // Bookstore fields
    if (shopTypeFields.includes('isbn')) {
      fields.push(
        <FormField
          key="isbn"
          control={form.control}
          name="isbn"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{PRODUCT_FIELD_LABELS.isbn}</FormLabel>
              <FormControl>
                <Input placeholder="Enter ISBN or code" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }
    
    if (shopTypeFields.includes('author')) {
      fields.push(
        <FormField
          key="author"
          control={form.control}
          name="author"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{PRODUCT_FIELD_LABELS.author}</FormLabel>
              <FormControl>
                <Input placeholder="Enter author name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }
    
    if (shopTypeFields.includes('publisher')) {
      fields.push(
        <FormField
          key="publisher"
          control={form.control}
          name="publisher"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{PRODUCT_FIELD_LABELS.publisher}</FormLabel>
              <FormControl>
                <Input placeholder="Enter publisher name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }

    // Restaurant: allergens
    if (shopTypeFields.includes('allergens')) {
      fields.push(
        <FormField
          key="allergens"
          control={form.control}
          name="allergens"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{PRODUCT_FIELD_LABELS.allergens}</FormLabel>
              <FormControl>
                <div className="grid w-full grid-cols-3 gap-x-4 gap-y-3">
                  {ALLERGENS_OPTIONS.map((opt) => {
                    const selected = (field.value || '').split(',').map((s) => s.trim()).filter(Boolean);
                    const checked = selected.includes(opt.value);
                    return (
                      <div key={opt.value} className="flex w-full items-center space-x-2">
                        <Checkbox
                          id={`allergen-${opt.value}`}
                          checked={checked}
                          onCheckedChange={(checked) => {
                            const next = checked
                              ? [...selected, opt.value]
                              : selected.filter((v) => v !== opt.value);
                            field.onChange(next.join(', '));
                          }}
                        />
                        <label
                          htmlFor={`allergen-${opt.value}`}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          {opt.label}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }

    // Clothing/Beauty: hasVariants, sizes, colors – hasVariants on its own full row
    if (shopTypeFields.includes('hasVariants')) {
      fields.push(
        <div key="hasVariants-wrapper" className="md:col-span-2">
          <FormField
            control={form.control}
            name="hasVariants"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabelWithInfo label={PRODUCT_FIELD_LABELS.hasVariants} hint="Product has size/color variants" />
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      );
    }

    if (shopTypeFields.includes('sizes') && form.watch('hasVariants')) {
      fields.push(
        <FormField
          key="sizes"
          control={form.control}
          name="sizes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{PRODUCT_FIELD_LABELS.sizes}</FormLabel>
              <FormControl>
                <div className="flex flex-wrap gap-3">
                  {SIZE_OPTIONS.map((opt) => {
                    const selected = (field.value || '').split(',').map((s) => s.trim()).filter(Boolean);
                    const checked = selected.includes(opt.value);
                    return (
                      <div key={opt.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`size-${opt.value}`}
                          checked={checked}
                          onCheckedChange={(checked) => {
                            const next = checked
                              ? [...selected, opt.value]
                              : selected.filter((v) => v !== opt.value);
                            field.onChange(next.join(', '));
                          }}
                        />
                        <label
                          htmlFor={`size-${opt.value}`}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          {opt.label}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }

    if (shopTypeFields.includes('colors') && form.watch('hasVariants')) {
      fields.push(
        <FormField
          key="colors"
          control={form.control}
          name="colors"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{PRODUCT_FIELD_LABELS.colors}</FormLabel>
              <FormControl>
                <div className="flex flex-wrap gap-3">
                  {COLOR_OPTIONS.map((opt) => {
                    const selected = (field.value || '').split(',').map((s) => s.trim()).filter(Boolean);
                    const checked = selected.includes(opt.value);
                    return (
                      <div key={opt.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`color-${opt.value}`}
                          checked={checked}
                          onCheckedChange={(checked) => {
                            const next = checked
                              ? [...selected, opt.value]
                              : selected.filter((v) => v !== opt.value);
                            field.onChange(next.join(', '));
                          }}
                        />
                        <label
                          htmlFor={`color-${opt.value}`}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          {opt.label}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }

    // Sports/Restaurant: size - only when hasVariants is true (or when shop type has no hasVariants e.g. Sports)
    if (shopTypeFields.includes('size') && (!shopTypeFields.includes('hasVariants') || form.watch('hasVariants'))) {
      fields.push(
        <FormField
          key="size"
          control={form.control}
          name="size"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{PRODUCT_FIELD_LABELS.size}</FormLabel>
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SIZE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }

    // Toys: ageRange, batteryRequired
    if (shopTypeFields.includes('ageRange')) {
      fields.push(
        <FormField
          key="ageRange"
          control={form.control}
          name="ageRange"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{PRODUCT_FIELD_LABELS.ageRange}</FormLabel>
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select age range" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {AGE_RANGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }

    if (shopTypeFields.includes('batteryRequired')) {
      fields.push(
        <FormField
          key="batteryRequired"
          control={form.control}
          name="batteryRequired"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabelWithInfo label={PRODUCT_FIELD_LABELS.batteryRequired} hint="Product requires batteries" />
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
      );
    }

    if (fields.length === 0) return null;

    return (
      <div className="space-y-4">
        <Separator />
        <h4 className="font-medium text-sm text-muted-foreground">
          Additional Information
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields}
        </div>
      </div>
    );
  };

  // =============================================
  // RENDER
  // =============================================

  const businessType = activeTenant?.businessType || null;
  const isShop = businessType === 'shop';
  if (!isShop) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Products</h1>
            <p className="text-gray-600 mt-1">Manage your product catalog</p>
          </div>
        </div>
        <Card className="border border-gray-200">
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                <Package className="h-10 w-10 text-gray-400" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-foreground mb-2">Not Available</h2>
                <p className="text-gray-600 max-w-md">
                  Product catalog is only available for shop business types.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Offline Indicator */}
      {!isOnline && (
        <Alert variant="warning" className="mb-4">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            You are offline. Changes will be synced when you reconnect.
            {pendingChanges > 0 && ` (${pendingChanges} pending)`}
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <WelcomeSection
          title="Products"
          subtitle="Manage your product catalog"
          icon={<Package className="h-6 w-6" />}
        />
        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle value={tableViewMode} onChange={setTableViewMode} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size={isMobile ? 'icon' : 'default'}
                onClick={() => setIsFilterVisible(!isFilterVisible)}
              >
                <Filter className="h-4 w-4" />
                {!isMobile && <span className="ml-2">Filter</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Filter products by category or stock level</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size={isMobile ? 'icon' : 'default'}
                onClick={handleRefresh}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh products list</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size={isMobile ? 'icon' : 'default'}
                onClick={() => {
                  setEditingProduct(null);
                  setQrScannerOpen(true);
                }}
              >
                <ScanLine className="h-4 w-4" />
                {!isMobile && <span className="ml-2">Scan QR</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Scan product QR code to quickly add or edit a product</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size={isMobile ? 'icon' : 'default'}
                onClick={() => setReceiveStockOpen(true)}
              >
                <PackagePlus className="h-4 w-4" />
                {!isMobile && <span className="ml-2">Receive stock</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Record new stock received (scan QR or search product)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleCreateProduct}>
                <Plus className="h-4 w-4" />
                {!isMobile && <span className="ml-2">Add Product</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add a new product to your catalog</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        <DashboardStatsCard
          tooltip="Total number of products in your catalog"
          title="Total Products"
          value={statsLoading ? '...' : stats.total}
          icon={Package}
          iconBgColor="#e0f2fe"
          iconColor="#0284c7"
        />
        <DashboardStatsCard
          tooltip="Products below reorder level – time to restock"
          title="Low Stock"
          value={statsLoading ? '...' : stats.lowStock}
          icon={AlertTriangle}
          iconBgColor={stats.lowStock > 0 ? '#fef3c7' : '#e0f2fe'}
          iconColor={stats.lowStock > 0 ? '#d97706' : '#0284c7'}
        />
        <DashboardStatsCard
          tooltip="Products with zero stock – cannot sell until restocked"
          title="Out of Stock"
          value={statsLoading ? '...' : stats.outOfStock}
          icon={Package}
          iconBgColor={stats.outOfStock > 0 ? '#fee2e2' : '#e0f2fe'}
          iconColor={stats.outOfStock > 0 ? '#dc2626' : '#0284c7'}
        />
        <DashboardStatsCard
          tooltip="Total value of all products at cost price"
          title="Total Value"
          value={statsLoading ? '...' : valueFormatter(stats.totalValue)}
          icon={Currency}
          iconBgColor="#dcfce7"
          iconColor="#166534"
        />
      </div>

      {/* Filters */}
      {isFilterVisible && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="mb-2 block">Search</Label>
                <Input
                  placeholder="Search products..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-2 block">Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">Stock Status</Label>
                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All stock levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All stock levels</SelectItem>
                    <SelectItem value="low">Low Stock</SelectItem>
                    <SelectItem value="out">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products Table - no Card container on mobile (standalone cards) */}
      {loading ? (
        <TableSkeleton rows={5} columns={isMobile ? 4 : 7} />
      ) : (
        isMobile ? (
          <DashboardTable
            data={products}
            columns={tableColumns}
            loading={loading}
            emptyIcon={<Package className="h-12 w-12 text-muted-foreground" />}
            emptyDescription="No products yet. Add your inventory to start selling."
            emptyAction={
              <Button onClick={handleCreateProduct}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Product
              </Button>
            }
            pageSize={pagination.pageSize}
            externalPagination={{ current: pagination.current, total: pagination.total }}
            onPageChange={handlePageChange}
            viewMode={tableViewMode}
            onViewModeChange={setTableViewMode}
          />
        ) : (
          <DashboardTable
            data={products}
            columns={tableColumns}
            loading={loading}
            title={null}
            emptyIcon={<Package className="h-12 w-12 text-muted-foreground" />}
            emptyDescription="No products yet. Add your inventory to start selling."
            emptyAction={
              <Button onClick={handleCreateProduct}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Product
              </Button>
            }
            pageSize={pagination.pageSize}
            externalPagination={{ current: pagination.current, total: pagination.total }}
            onPageChange={handlePageChange}
            viewMode={tableViewMode}
            onViewModeChange={setTableViewMode}
          />
        )
      )}

      {/* Product Form Dialog */}
      <MobileFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
        description={editingProduct ? 'Update product details below' : 'Fill in the product details to add it to your catalog'}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={handleOpenQRGenerateFromForm}
              title="Generate QR code for this product"
            >
              <QrCode className="h-4 w-4 mr-2" />
              Generate QR
            </Button>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="product-form" loading={submitting}>
              {editingProduct ? 'Update Product' : 'Create Product'}
            </Button>
          </>
        }
      >
          <TooltipProvider delayDuration={200}>
          <Form {...form}>
            <form id="product-form" onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
              {!editingProduct && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center gap-2"
                  onClick={() => setQrScannerOpen(true)}
                  title="Scan product QR code to fill form"
                >
                  <ScanLine className="h-4 w-4" />
                  Scan QR code to fill details
                </Button>
              )}

              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Basic Information</h4>
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field: { value } }) => (
                    <FormItem>
                      <FormLabel>Product image (optional)</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <input
                            ref={productImageInputRef}
                            type="file"
                            accept="image/png,image/jpg,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(e) => handleProductImageSelect(e)}
                          />
                          <div
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && !productImageUploading && productImageInputRef.current?.click()}
                            onClick={() => !productImageUploading && productImageInputRef.current?.click()}
                            onDrop={(e) => {
                              e.preventDefault();
                              setProductImageDragging(false);
                              if (!productImageUploading && e.dataTransfer.files?.[0]) {
                                handleProductImageSelect(e.dataTransfer.files[0]);
                              }
                            }}
                            onDragOver={(e) => { e.preventDefault(); !productImageUploading && setProductImageDragging(true); }}
                            onDragLeave={(e) => { e.preventDefault(); setProductImageDragging(false); }}
                            className={cn(
                              'flex flex-col items-center justify-center w-full min-h-[120px] py-8 px-4 rounded-lg border-2 border-dashed cursor-pointer transition-colors',
                              productImageDragging ? 'border-[#166534] bg-[#166534]/5' : 'border-border bg-card',
                              productImageUploading && 'opacity-70 cursor-not-allowed'
                            )}
                          >
                            {value ? (
                              <div className="relative w-full max-w-[200px] aspect-square mx-auto">
                                <img
                                  src={resolveProductImageUrl(value) || ''}
                                  alt="Product"
                                  className="w-full h-full object-cover rounded-lg"
                                />
                                {!productImageUploading && (
                                  <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      onClick={(e) => { e.stopPropagation(); productImageInputRef.current?.click(); }}
                                    >
                                      Change
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      onClick={(e) => { e.stopPropagation(); handleRemoveProductImage(); }}
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ) : productImageUploading ? (
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 className="h-10 w-10 animate-spin text-[#166534]" />
                                <span className="text-sm text-muted-foreground">Uploading...</span>
                              </div>
                            ) : (
                              <>
                                <UploadCloud className="h-10 w-10 mb-3 text-[#166534]" />
                                <div className="text-center">
                                  <p className="text-sm">
                                    <span className="font-medium text-[#166534]">Click to upload</span>
                                    <span className="text-muted-foreground"> or drag and drop</span>
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    PNG, JPG, WEBP, JPEG (Max. 5MB)
                                  </p>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Name *</FormLabel>
                        <FormControl>
                          <Input placeholder={placeholders.productName} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category (optional)</FormLabel>
                        <div className="flex gap-2">
                          <Select
                            value={field.value || undefined}
                            onValueChange={(v) => field.onChange(v && !String(v).startsWith('_cat_') ? v : '')}
                          >
                            <FormControl>
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categories.length === 0 ? (
                                <div className="py-4 px-3 text-center text-sm text-muted-foreground">
                                  No categories yet. Use + to add one.
                                </div>
                              ) : (
                                categories.map((cat) => {
                                  const idStr = cat.id != null && String(cat.id) !== '' ? String(cat.id) : `_cat_${cat.id ?? 'blank'}`;
                                  return (
                                    <SelectItem key={cat.id ?? idStr} value={idStr}>
                                      {cat.name}
                                    </SelectItem>
                                  );
                                })
                              )}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setCategoryModalOpen(true)}
                            title="Create new category"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Pricing */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Pricing</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="costPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cost Price *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            value={numberInputValue(field.value)}
                            onChange={(e) => handleNumberChange(e, field.onChange)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sellingPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Selling Price *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            value={numberInputValue(field.value)}
                            onChange={(e) => handleNumberChange(e, field.onChange)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div>
                    <Label className="mb-2 block">Profit Margin</Label>
                    <div className="h-10 flex items-center">
                      <Badge variant={getMarginColor(calculatedMargin)}>
                        {calculatedMargin.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Stock */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Stock Management</h4>
                <FormField
                  control={form.control}
                  name="trackStock"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabelWithInfo label="Track stock" hint="Turn off for made-to-order items (pizza, custom meals)" />
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {form.watch('trackStock') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sku"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SKU (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter SKU" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="barcode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabelWithInfo label="Barcode (optional)" hint="Scan barcode at POS. No barcode? Use Generate QR to print and attach." />
                        <FormControl>
                          <Input placeholder="Scan or enter barcode" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="brand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Brand (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter brand name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="quantityOnHand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity on Hand *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            value={numberInputValue(field.value)}
                            onChange={(e) => handleNumberChange(e, field.onChange)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit *</FormLabel>
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {unitOptions.map((unit) => (
                              <SelectItem key={unit.value} value={unit.value}>
                                {unit.label}
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
                    name="reorderLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabelWithInfo label="Reorder Level" hint="Alert when stock falls below this" />
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            value={numberInputValue(field.value)}
                            onChange={(e) => handleNumberChange(e, field.onChange)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="reorderQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabelWithInfo label="Reorder Quantity" hint="Suggested quantity to reorder" />
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            value={numberInputValue(field.value)}
                            onChange={(e) => handleNumberChange(e, field.onChange)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                      control={form.control}
                      name="supplier"
                      render={({ field }) => {
                        const supplierValue = field.value || '';
                        const vendorNames = vendors.map((v) => v.name || v.company).filter(Boolean);
                        const hasCustomSupplier = supplierValue && !vendorNames.includes(supplierValue);
                        const selectValue = supplierValue === '' ? '_none_' : supplierValue;
                        return (
                          <FormItem>
                            <FormLabel>Supplier/Vendor (optional)</FormLabel>
                            <Select
                              value={selectValue}
                              onValueChange={(v) => field.onChange(v === '_none_' ? '' : v)}
                              open={vendorSelectOpen}
                              onOpenChange={setVendorSelectOpen}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select supplier/vendor" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="_none_">None</SelectItem>
                                {hasCustomSupplier && (
                                  <SelectItem value={supplierValue}>{supplierValue}</SelectItem>
                                )}
                                {vendors.map((vendor) => {
                                  const name = (vendor.name || vendor.company || 'Unnamed').trim() || '_unnamed';
                                  return (
                                    <SelectItem key={vendor.id} value={name}>
                                      {vendor.name || vendor.company || 'Unnamed'}
                                    </SelectItem>
                                  );
                                })}
                                <SelectSeparator className="my-2" />
                                <div
                                  className="px-2 py-1.5"
                                  onPointerDown={(e) => e.preventDefault()}
                                >
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="w-full justify-start"
                                    onClick={handleAddNewVendor}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Vendor
                                  </Button>
                                </div>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                </div>
                )}
              </div>

              {/* Shop Type Specific Fields */}
              {renderShopTypeFields()}

              <Separator />

              {/* Additional Info */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={placeholders.description}
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabelWithInfo label="Active" hint="Product is available for sale" />
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
          </TooltipProvider>
      </MobileFormDialog>

      {/* Add Vendor Modal (from product form) */}
      <MobileFormDialog
        open={vendorAddModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setVendorAddModalOpen(false);
            vendorForm.reset({ name: '', company: '', category: '', phone: '' });
          }
        }}
        title="Add Vendor"
        description="Create a new vendor without closing the product form."
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setVendorAddModalOpen(false);
                vendorForm.reset({ name: '', company: '', category: '', phone: '' });
              }}
            >
              Cancel
            </Button>
            <Button form="quick-vendor-form" type="submit" loading={addingVendor}>
              Add Vendor
            </Button>
          </>
        }
      >
            <Form {...vendorForm}>
              <form
                id="quick-vendor-form"
                onSubmit={vendorForm.handleSubmit(handleAddVendorSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={vendorForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter vendor name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={vendorForm.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter company name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={vendorForm.control}
                  name="category"
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
                          {vendorCategories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={vendorForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone (optional)</FormLabel>
                      <FormControl>
                        <PhoneNumberInput {...field} placeholder="Enter phone number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
      </MobileFormDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{productToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              loading={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProductQRScanner
        open={qrScannerOpen}
        onClose={() => setQrScannerOpen(false)}
        onProductData={handleProductDataFromQR}
      />

      <ReceiveStockModal
        open={receiveStockOpen}
        onClose={() => setReceiveStockOpen(false)}
        onSuccess={() => {
          fetchProducts();
          fetchStats();
          if (selectedProduct) {
            productService.getProductById(selectedProduct.id).then((r) => {
              const p = r?.data ?? r;
              if (p?.id) setSelectedProduct(p);
            });
          }
        }}
      />

      <ProductQRGenerateModal
        open={qrGenerateOpen}
        onClose={() => {
          setQrGenerateOpen(false);
          setProductForQR(null);
        }}
        product={productForQR}
      />

      {/* Stock Adjustment Dialog */}
      <MobileFormDialog
        open={adjustStockOpen}
        onOpenChange={setAdjustStockOpen}
        title="Adjust Stock"
        description={`Adjust stock for "${productToAdjust?.name}". Current stock: ${productToAdjust?.quantityOnHand} ${productToAdjust?.unit}`}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setAdjustStockOpen(false)}>
              Cancel
            </Button>
            <Button form="adjust-stock-form" type="submit" loading={submitting}>
              Adjust Stock
            </Button>
          </>
        }
      >
          <TooltipProvider delayDuration={200}>
          <Form {...adjustForm}>
            <form id="adjust-stock-form" onSubmit={adjustForm.handleSubmit(handleAdjustStockSubmit)} className="space-y-4">
              <FormField
                control={adjustForm.control}
                name="adjustmentMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adjustment Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="set">Set exact quantity</SelectItem>
                        <SelectItem value="delta">Add/Subtract quantity</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {adjustForm.watch('adjustmentMode') === 'set' ? (
                <FormField
                  control={adjustForm.control}
                  name="newQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...field}
                          value={numberInputValue(field.value)}
                          onChange={(e) => handleNumberChange(e, field.onChange)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={adjustForm.control}
                  name="quantityDelta"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabelWithInfo label="Quantity Change (use negative to subtract)" hint="Positive: add stock, Negative: remove stock" />
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          value={numberInputValue(field.value)}
                          onChange={(e) => handleNumberChange(e, field.onChange)}
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
                    <FormLabel>Reason (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Physical count, Received shipment" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </form>
          </Form>
          </TooltipProvider>
      </MobileFormDialog>

      {/* Product Details Drawer */}
      <DetailsDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedProduct(null);
          handleCloseVariantForm();
        }}
        title="Product Details"
        width={isMobile ? '100%' : 480}
        tabs={selectedProduct ? [
          {
            key: 'details',
            label: 'Details',
            content: (
              <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-lg border border-border bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                {selectedProduct.imageUrl ? (
                  <button
                    type="button"
                    onClick={() => setImagePreviewUrl(resolveProductImageUrl(selectedProduct.imageUrl))}
                    className="w-full h-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset rounded-lg"
                  >
                    <img
                      src={resolveProductImageUrl(selectedProduct.imageUrl)}
                      alt={selectedProduct.name || 'Product'}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ) : (
                  <Package className="h-10 w-10 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold truncate">{selectedProduct.name}</h3>
                  <StatusChip
                    status={selectedProduct.isActive ? 'active_flag' : 'inactive_flag'}
                  />
                </div>
                {selectedProduct.sku && (
                  <p className="text-sm text-muted-foreground mt-0.5">SKU: {selectedProduct.sku}</p>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondaryStroke"
                size="sm"
                onClick={() => {
                  setDrawerOpen(false);
                  handleEditProduct(selectedProduct);
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
              {selectedProduct.trackStock !== false && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAdjustStockClick(selectedProduct)}
              >
                <Package className="h-4 w-4 mr-2" />
                Adjust Stock
              </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleWhatsAppShare(selectedProduct)}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>

            <DrawerSectionCard title="Product info">
              <Descriptions column={1} className="space-y-0">
                <DescriptionItem label="Category">
                  {selectedProduct.category?.name || 'Uncategorized'}
                </DescriptionItem>
                <DescriptionItem label="Brand">
                  {selectedProduct.brand || '-'}
                </DescriptionItem>
                <DescriptionItem label="Supplier/Vendor">
                  {selectedProduct.supplier || '-'}
                </DescriptionItem>
                <DescriptionItem label="Barcode">
                  {selectedProduct.barcode || '-'}
                </DescriptionItem>
              </Descriptions>
            </DrawerSectionCard>

            <DrawerSectionCard title="Pricing">
              <Descriptions column={1} className="space-y-0">
                <DescriptionItem label="Cost Price">
                  {valueFormatter(selectedProduct.costPrice)}
                </DescriptionItem>
                <DescriptionItem label="Selling Price">
                  {valueFormatter(selectedProduct.sellingPrice)}
                </DescriptionItem>
                <DescriptionItem label="Profit Margin">
                  <Badge variant={getMarginColor(calculateMargin(selectedProduct.costPrice, selectedProduct.sellingPrice))}>
                    {marginFormatter(selectedProduct.costPrice, selectedProduct.sellingPrice)}
                  </Badge>
                </DescriptionItem>
              </Descriptions>
            </DrawerSectionCard>

            <DrawerSectionCard title="Stock information">
              <Descriptions column={1} className="space-y-0">
                {selectedProduct.trackStock === false ? (
                  <DescriptionItem label="Stock">
                    <Badge variant="outline" className="text-muted-foreground">Made to order</Badge>
                  </DescriptionItem>
                ) : (
                  <>
                    <DescriptionItem label="Quantity on Hand">
                      <div className="flex items-center gap-2">
                        <span>{parseFloat(selectedProduct.quantityOnHand || 0).toLocaleString()} {selectedProduct.unit}</span>
                        <StatusChip
                          status={getStockStatus(selectedProduct.quantityOnHand, selectedProduct.reorderLevel)}
                          size="small"
                        />
                      </div>
                    </DescriptionItem>
                    <DescriptionItem label="Reorder Level">
                      {selectedProduct.reorderLevel} {selectedProduct.unit}
                    </DescriptionItem>
                    <DescriptionItem label="Reorder Quantity">
                      {selectedProduct.reorderQuantity} {selectedProduct.unit}
                    </DescriptionItem>
                    <DescriptionItem label="Stock Value">
                      {valueFormatter(parseFloat(selectedProduct.sellingPrice || 0) * parseFloat(selectedProduct.quantityOnHand || 0))}
                    </DescriptionItem>
                  </>
                )}
              </Descriptions>
            </DrawerSectionCard>

            {selectedProduct.metadata && Object.keys(selectedProduct.metadata).length > 0 && (
              <DrawerSectionCard title="Additional details">
                <Descriptions column={1} className="space-y-0">
                  {selectedProduct.metadata.expiryDate && (
                    <DescriptionItem label="Expiry Date">
                      {dayjs(selectedProduct.metadata.expiryDate).format('MMM DD, YYYY')}
                    </DescriptionItem>
                  )}
                  {selectedProduct.metadata.batchNumber && (
                    <DescriptionItem label="Batch Number">
                      {selectedProduct.metadata.batchNumber}
                    </DescriptionItem>
                  )}
                  {selectedProduct.metadata.serialNumber && (
                    <DescriptionItem label="Serial Number">
                      {selectedProduct.metadata.serialNumber}
                    </DescriptionItem>
                  )}
                  {selectedProduct.metadata.warrantyPeriod > 0 && (
                    <DescriptionItem label="Warranty">
                      {WARRANTY_OPTIONS.find(w => w.value === selectedProduct.metadata.warrantyPeriod)?.label || `${selectedProduct.metadata.warrantyPeriod} months`}
                    </DescriptionItem>
                  )}
                  {selectedProduct.metadata.dimensions && (
                    <DescriptionItem label="Dimensions">
                      {selectedProduct.metadata.dimensions}
                    </DescriptionItem>
                  )}
                  {selectedProduct.metadata.weight && (
                    <DescriptionItem label="Weight">
                      {selectedProduct.metadata.weight}
                    </DescriptionItem>
                  )}
                  {selectedProduct.metadata.material && (
                    <DescriptionItem label="Material">
                      {selectedProduct.metadata.material}
                    </DescriptionItem>
                  )}
                  {selectedProduct.metadata.partNumber && (
                    <DescriptionItem label="Part Number">
                      {selectedProduct.metadata.partNumber}
                    </DescriptionItem>
                  )}
                  {selectedProduct.metadata.isbn && (
                    <DescriptionItem label="ISBN/Code">
                      {selectedProduct.metadata.isbn}
                    </DescriptionItem>
                  )}
                  {selectedProduct.metadata.author && (
                    <DescriptionItem label="Author">
                      {selectedProduct.metadata.author}
                    </DescriptionItem>
                  )}
                </Descriptions>
              </DrawerSectionCard>
            )}

            {selectedProduct.description && (
              <DrawerSectionCard title="Description">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedProduct.description}
                </p>
              </DrawerSectionCard>
            )}

            {(shopTypeFields.includes('hasVariants') || (selectedProduct.variants && selectedProduct.variants.length > 0)) && (
              <DrawerSectionCard
                title={`Variants (${selectedProduct.variants?.length ?? 0})`}
                extra={
                  shopTypeFields.includes('hasVariants') ? (
                    <Button variant="outline" size="sm" onClick={handleOpenVariantForm}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Variant
                    </Button>
                  ) : null
                }
              >
                {selectedProduct.variants && selectedProduct.variants.length > 0 ? (
                  <div className="space-y-2">
                    {selectedProduct.variants.map((variant) => (
                      <div key={variant.id} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-b-0">
                        <div>
                          <p className="font-medium text-foreground">{variant.name}</p>
                          {variant.sku && (
                            <p className="text-xs text-muted-foreground">SKU: {variant.sku}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-foreground">
                            {valueFormatter(variant.sellingPrice || selectedProduct.sellingPrice)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Stock: {variant.quantityOnHand}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">
                    No variants yet. Add sizes (Small, Medium, Large) or other options.
                  </p>
                )}
              </DrawerSectionCard>
            )}

            <DrawerSectionCard title="Timestamps">
              <Descriptions column={1} className="space-y-0">
                <DescriptionItem label="Created">
                  {dayjs(selectedProduct.createdAt).format('MMM DD, YYYY HH:mm')}
                </DescriptionItem>
                <DescriptionItem label="Last Updated">
                  {dayjs(selectedProduct.updatedAt).format('MMM DD, YYYY HH:mm')}
                </DescriptionItem>
              </Descriptions>
            </DrawerSectionCard>
              </div>
            ),
          },
          {
            key: 'movement',
            label: 'Movement',
            content: (
              <ProductMovementTab
                productId={selectedProduct.id}
                unit={selectedProduct.unit || 'pcs'}
                valueFormatter={valueFormatter}
              />
            ),
          },
        ] : null}
      />

      {/* Add/Edit Variant Dialog */}
      <MobileFormDialog
        open={variantFormOpen}
        onOpenChange={(open) => !open && handleCloseVariantForm()}
        title={editingVariant ? 'Edit Variant' : 'Add Variant'}
        description={editingVariant ? 'Update variant details (e.g. Small, Medium, Large).' : `Add a variant to ${selectedProduct?.name || 'this product'}.`}
        footer={
          <>
            <Button variant="outline" onClick={handleCloseVariantForm}>
              Cancel
            </Button>
            <Button form="variant-form" type="submit" loading={submitting} disabled={submitting} className="bg-primary hover:bg-primary/90">
              {editingVariant ? 'Update Variant' : 'Add Variant'}
            </Button>
          </>
        }
      >
            <Form {...variantForm}>
              <form id="variant-form" onSubmit={variantForm.handleSubmit(handleVariantFormSubmit)} className="space-y-4">
                <FormField
                  control={variantForm.control}
                  name="size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Size</FormLabel>
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SIZE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    control={variantForm.control}
                    name="sellingPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Selling Price</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={variantForm.control}
                    name="costPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cost Price</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={variantForm.control}
                    name="quantityOnHand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stock</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={variantForm.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. PIZZA-SM" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
      </MobileFormDialog>

      {/* Create Category Dialog */}
      <MobileFormDialog
        open={categoryModalOpen}
        onOpenChange={setCategoryModalOpen}
        title="Create New Category"
        description="Add a new category for organizing your products."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setCategoryModalOpen(false);
                setNewCategoryName('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCategory}
              loading={creatingCategory}
              disabled={!newCategoryName.trim()}
              className="bg-green-700 hover:bg-green-800"
            >
              Create Category
            </Button>
          </>
        }
      >
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="categoryName">Category Name</Label>
              <Input
                id="categoryName"
                placeholder="e.g., Beverages, Snacks, Dairy..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !creatingCategory) {
                    e.preventDefault();
                    handleCreateCategory();
                  }
                }}
              />
            </div>
          </div>
      </MobileFormDialog>

      {/* Image preview modal */}
      <Dialog open={!!imagePreviewUrl} onOpenChange={(open) => !open && setImagePreviewUrl(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Image preview</DialogTitle>
          </DialogHeader>
          <DialogBody className="p-0">
            {imagePreviewUrl && (
              <img
                src={imagePreviewUrl}
                alt="Product preview"
                className="w-full h-auto max-h-[85vh] object-contain"
              />
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
