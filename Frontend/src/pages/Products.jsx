/**
 * Products Page
 * 
 * Product catalog management for shop business type.
 * Features: CRUD operations, variants, barcode support, offline caching,
 * shop type-specific fields, and quick-add templates.
 */

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Package,
  Plus,
  RefreshCw,
  AlertTriangle,
  DollarSign,
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
  ChevronDown,
  ChevronUp,
  X,
  Calendar,
  Hash,
  Layers,
  Tag,
  ImagePlus,
  ScanLine,
  PackagePlus,
  QrCode,
  Download,
} from 'lucide-react';
import dayjs from 'dayjs';
import { useDebounce } from '../hooks/useDebounce';
import { useResponsive } from '../hooks/useResponsive';
import DetailsDrawer from '../components/DetailsDrawer';
import DrawerSectionCard from '../components/DrawerSectionCard';
import ActionColumn from '../components/ActionColumn';
import StatusChip from '../components/StatusChip';
import TableSkeleton from '../components/TableSkeleton';
import DetailSkeleton from '../components/DetailSkeleton';
import DashboardTable from '../components/DashboardTable';
import DashboardStatsCard from '../components/DashboardStatsCard';
import WelcomeSection from '../components/WelcomeSection';
import productService from '../services/productService';
import vendorService from '../services/vendorService';
import { API_BASE_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSmartSearch } from '../context/SmartSearchContext';
import { showSuccess, showError } from '../utils/toast';
import ProductQRScanner from '../components/ProductQRScanner';
import ReceiveStockModal from '../components/ReceiveStockModal';
import ProductQRGenerateModal from '../components/ProductQRGenerateModal';
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
  FormDescription,
} from '@/components/ui/form';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  SEARCH_PLACEHOLDERS,
  DEBOUNCE_DELAYS,
  PRODUCT_UNITS,
  SHOP_TYPES,
  SHOP_TYPE_FIELDS,
  PRODUCT_FIELD_LABELS,
  SIZE_OPTIONS,
  COLOR_OPTIONS,
  WARRANTY_OPTIONS,
  calculateMargin,
  getMarginColor,
  getStockStatus,
} from '../constants';
import { PRODUCT_TEMPLATES, getTemplatesForShopType, getCategoriesFromTemplates } from '../constants/productTemplates';

// =============================================
// HELPER FUNCTIONS
// =============================================

const sortCategories = (list = []) =>
  [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

const valueFormatter = (value, currency = 'GHS') =>
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

const resolveProductImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('data:') || url.startsWith('http')) return url;
  if (API_BASE_URL) {
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${API_BASE_URL}${path}`;
  }
  return url;
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
  name: z.string().min(1, 'Variant name is required'),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  costPrice: z.union([z.number().min(0), z.literal('')]).transform((v) => (v === '' ? undefined : v)).optional(),
  sellingPrice: z.union([z.number().min(0), z.literal('')]).transform((v) => (v === '' ? undefined : v)).optional(),
  quantityOnHand: z.union([z.number().min(0), z.literal('')]).transform((v) => (v === '' ? 0 : v)),
  size: z.string().optional(),
  color: z.string().optional(),
});

// =============================================
// MAIN COMPONENT
// =============================================

const Products = () => {
  const { user, activeTenant, activeTenantId, isAdmin, isManager } = useAuth();
  const { isMobile } = useResponsive();
  const { setPageSearchConfig } = useSmartSearch();

  // Get shop type from tenant metadata
  const shopType = activeTenant?.metadata?.shopType || SHOP_TYPES.CONVENIENCE;
  const shopTypeFields = SHOP_TYPE_FIELDS[shopType] || [];
  const templates = getTemplatesForShopType(shopType);

  // =============================================
  // STATE
  // =============================================

  // Data state
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

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
  const [templateSectionOpen, setTemplateSectionOpen] = useState(false);
  const [variantFormOpen, setVariantFormOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [productImageUploading, setProductImageUploading] = useState(false);
  const productImageInputRef = useRef(null);
  const [vendors, setVendors] = useState([]);

  // Category creation state
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [receiveStockOpen, setReceiveStockOpen] = useState(false);
  const [qrGenerateOpen, setQrGenerateOpen] = useState(false);
  const [productForQR, setProductForQR] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);

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
      name: '',
      sku: '',
      barcode: '',
      costPrice: 0,
      sellingPrice: 0,
      quantityOnHand: 0,
      size: '',
      color: '',
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
          <div className="w-10 h-10 rounded border border-gray-200 bg-gray-50 overflow-hidden flex-shrink-0 flex items-center justify-center">
            {record.imageUrl ? (
              <img
                src={resolveProductImageUrl(record.imageUrl) || ''}
                alt=""
                className="w-full h-full object-cover"
              />
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
          onEdit={() => handleEditProduct(record)}
          onDelete={() => handleDeleteClick(record)}
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
        console.warn('[Products fetchCategories] API returned 0 categories. Check: tenant context, backend seeded product_categories for this tenant.');
      } else {
        console.log('[Products fetchCategories] Loaded', categoryList.length, 'categories');
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
        setCategories(prev => sortCategories([...prev, newCategory]));
        productService.cacheCategories([...categories, newCategory]);
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
  }, [newCategoryName, categories, formOpen, form]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      // Fetch all products for stats calculation
      const response = await productService.getProducts({ limit: 1000 });
      const body = response && typeof response === 'object' ? response : {};
      const allProducts = Array.isArray(body.data) ? body.data : (Array.isArray(body.products) ? body.products : []);

      const total = allProducts.length;
      const lowStock = allProducts.filter(p => {
        const qty = parseFloat(p.quantityOnHand || 0);
        const reorder = parseFloat(p.reorderLevel || 0);
        return qty > 0 && qty <= reorder;
      }).length;
      const outOfStock = allProducts.filter(p => parseFloat(p.quantityOnHand || 0) <= 0).length;
      const totalValue = allProducts.reduce((sum, p) => {
        return sum + (parseFloat(p.sellingPrice || 0) * parseFloat(p.quantityOnHand || 0));
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
    }
  }, [formOpen, activeTenantId, fetchCategories, fetchVendors]);

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

  const handleViewProduct = async (product) => {
    setSelectedProduct(product);
    setDrawerOpen(true);
    setDetailLoading(true);
    
    try {
      const response = await productService.getProductById(product.id);
      setSelectedProduct(response.data || response);
    } catch (error) {
      console.error('Failed to fetch product details:', error);
    } finally {
      setDetailLoading(false);
    }
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
      imageUrl: '',
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

  const handleExport = async (format = 'csv') => {
    setExportLoading(true);
    try {
      const response = await productService.exportProducts({ format });
      const blob = response?.data ?? response;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `products_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'csv'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showSuccess('Export downloaded');
    } catch (error) {
      showError(error, 'Failed to export products');
    } finally {
      setExportLoading(false);
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
        'isbn', 'author', 'publisher', 'assemblyRequired'
      ];
      
      const metadata = {};
      metadataFields.forEach(field => {
        if (values[field] !== undefined && values[field] !== '' && values[field] !== false && values[field] !== 0) {
          metadata[field] = values[field];
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

  const handleUseTemplate = (template) => {
    form.setValue('name', template.name);
    form.setValue('unit', template.unit);
    form.setValue('costPrice', template.suggestedCost || 0);
    form.setValue('sellingPrice', template.suggestedPrice || 0);
    
    if (template.hasWarranty) {
      form.setValue('warrantyPeriod', template.warrantyPeriod || 12);
    }
    if (template.hasVariants) {
      form.setValue('hasVariants', true);
    }
    
    setTemplateSectionOpen(false);
  };

  const handleProductImageSelect = useCallback(async (e) => {
    const file = e?.target?.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
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
    const message = encodeURIComponent(
      `🏷️ *${product.name}*\n\n` +
      `💰 Price: ${valueFormatter(product.sellingPrice)}\n` +
      `📦 Stock: ${product.quantityOnHand} ${product.unit}\n` +
      (product.sku ? `🔖 SKU: ${product.sku}\n` : '') +
      (product.description ? `\n${product.description}\n` : '') +
      `\n_Sent from ${activeTenant?.name || 'Our Store'}_`
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
    
    // Supermarket/Convenience fields
    if (shopTypeFields.includes('expiryDate')) {
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
    
    if (shopTypeFields.includes('batchNumber')) {
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
    
    if (shopTypeFields.includes('isPerishable')) {
      fields.push(
        <FormField
          key="isPerishable"
          control={form.control}
          name="isPerishable"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel>{PRODUCT_FIELD_LABELS.isPerishable}</FormLabel>
                <FormDescription>Mark if product can expire</FormDescription>
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
                <FormLabel>{PRODUCT_FIELD_LABELS.assemblyRequired}</FormLabel>
                <FormDescription>Product requires assembly</FormDescription>
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
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Products</h1>
            <p className="text-gray-600 mt-1">Manage your product catalog</p>
          </div>
        </div>
        <Card className="border border-gray-200">
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
                <Package className="h-10 w-10 text-gray-400" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Not Available</h2>
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
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size={isMobile ? 'icon' : 'default'}
            onClick={() => setIsFilterVisible(!isFilterVisible)}
          >
            <Filter className="h-4 w-4" />
            {!isMobile && <span className="ml-2">Filter</span>}
          </Button>
          <Button
            variant="outline"
            size={isMobile ? 'icon' : 'default'}
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4" />
            {!isMobile && <span className="ml-2">Refresh</span>}
          </Button>
          {(isAdmin || isManager) && (
            <Button
              variant="outline"
              size={isMobile ? 'icon' : 'default'}
              onClick={() => handleExport('csv')}
              disabled={exportLoading}
              title="Export products (admin/manager only)"
            >
              {exportLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {!isMobile && <span className="ml-2">Export</span>}
            </Button>
          )}
          <Button
            variant="outline"
            size={isMobile ? 'icon' : 'default'}
            onClick={() => {
              setEditingProduct(null);
              setQrScannerOpen(true);
            }}
            title="Scan product QR code to fill form"
          >
            <ScanLine className="h-4 w-4" />
            {!isMobile && <span className="ml-2">Scan QR</span>}
          </Button>
          <Button
            variant="outline"
            size={isMobile ? 'icon' : 'default'}
            onClick={() => setReceiveStockOpen(true)}
            title="Receive stock (scan QR or search)"
          >
            <PackagePlus className="h-4 w-4" />
            {!isMobile && <span className="ml-2">Receive stock</span>}
          </Button>
          <Button onClick={handleCreateProduct}>
            <Plus className="h-4 w-4" />
            {!isMobile && <span className="ml-2">Add Product</span>}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <DashboardStatsCard
          title="Total Products"
          value={statsLoading ? '...' : stats.total}
          icon={Package}
          iconBgColor="#e0f2fe"
          iconColor="#0284c7"
        />
        <DashboardStatsCard
          title="Low Stock"
          value={statsLoading ? '...' : stats.lowStock}
          icon={AlertTriangle}
          iconBgColor={stats.lowStock > 0 ? '#fef3c7' : '#e0f2fe'}
          iconColor={stats.lowStock > 0 ? '#d97706' : '#0284c7'}
        />
        <DashboardStatsCard
          title="Out of Stock"
          value={statsLoading ? '...' : stats.outOfStock}
          icon={Package}
          iconBgColor={stats.outOfStock > 0 ? '#fee2e2' : '#e0f2fe'}
          iconColor={stats.outOfStock > 0 ? '#dc2626' : '#0284c7'}
        />
        <DashboardStatsCard
          title="Total Value"
          value={statsLoading ? '...' : valueFormatter(stats.totalValue)}
          icon={DollarSign}
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

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton rows={5} columns={isMobile ? 4 : 7} />
          ) : (
            <DashboardTable
              data={products}
              columns={tableColumns}
              loading={loading}
              emptyIcon={<Package className="h-12 w-12 text-muted-foreground" />}
              emptyDescription="No products found"
              pageSize={pagination.pageSize}
              externalPagination={{ current: pagination.current, total: pagination.total }}
              onPageChange={handlePageChange}
            />
          )}
        </CardContent>
      </Card>

      {/* Product Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:w-[var(--modal-w-lg)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)]">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </DialogTitle>
            <DialogDescription>
              {editingProduct 
                ? 'Update product details below' 
                : 'Fill in the product details to add it to your catalog'}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
              {/* Quick Add Template Section (only for new products) */}
              {!editingProduct && templates.length > 0 && (
                <Collapsible open={templateSectionOpen} onOpenChange={setTemplateSectionOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        Quick Add from Template
                      </span>
                      {templateSectionOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                      {templates.slice(0, 12).map((template, index) => (
                        <Button
                          key={index}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="justify-start text-left h-auto py-2"
                          onClick={() => handleUseTemplate(template)}
                        >
                          <div className="truncate">
                            <div className="font-medium truncate">{template.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {valueFormatter(template.suggestedPrice)}
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

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
                        <div className="flex items-center gap-4">
                          <div className="w-20 h-20 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0">
                            {value ? (
                              <img
                                src={resolveProductImageUrl(value) || ''}
                                alt="Product"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="h-8 w-8 text-gray-400" />
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            <input
                              ref={productImageInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                handleProductImageSelect(e);
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={productImageUploading}
                              onClick={() => productImageInputRef.current?.click()}
                              className="flex items-center gap-2"
                            >
                              {productImageUploading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ImagePlus className="h-4 w-4" />
                              )}
                              {value ? 'Change image' : 'Add image'}
                            </Button>
                            {value && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={handleRemoveProductImage}
                              >
                                Remove
                              </Button>
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
                          <Input placeholder="Enter product name" {...field} />
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
                        <FormLabel>Barcode (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Scan or enter barcode" {...field} />
                        </FormControl>
                        <p className="text-xs text-gray-500 mt-1">
                          Scan barcode at POS. No barcode? Use Generate QR to print and attach.
                        </p>
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
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            {PRODUCT_UNITS.map((unit) => (
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
                        <FormLabel>Reorder Level</FormLabel>
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
                        <FormDescription>Alert when stock falls below this</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="reorderQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reorder Quantity</FormLabel>
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
                        <FormDescription>Suggested quantity to reorder</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
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
                          placeholder="Enter product description"
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
                        <FormLabel>Active</FormLabel>
                        <FormDescription>Product is available for sale</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
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
                <Button type="submit" loading={submitting}>
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
          </DialogBody>
        </DialogContent>
      </Dialog>

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
      <Dialog open={adjustStockOpen} onOpenChange={setAdjustStockOpen}>
        <DialogContent className="sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)]">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              Adjust stock for "{productToAdjust?.name}"
              <br />
              Current stock: {productToAdjust?.quantityOnHand} {productToAdjust?.unit}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
          <Form {...adjustForm}>
            <form onSubmit={adjustForm.handleSubmit(handleAdjustStockSubmit)} className="space-y-4">
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
                      <FormLabel>Quantity Change (use negative to subtract)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          value={numberInputValue(field.value)}
                          onChange={(e) => handleNumberChange(e, field.onChange)}
                        />
                      </FormControl>
                      <FormDescription>
                        Positive: add stock, Negative: remove stock
                      </FormDescription>
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

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAdjustStockOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={submitting}>
                  Adjust Stock
                </Button>
              </DialogFooter>
            </form>
          </Form>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Product Details Drawer */}
      <DetailsDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedProduct(null);
        }}
        title="Product Details"
        width={isMobile ? '100%' : 480}
      >
        {detailLoading ? (
          <DetailSkeleton />
        ) : selectedProduct ? (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {selectedProduct.imageUrl ? (
                  <img
                    src={resolveProductImageUrl(selectedProduct.imageUrl) || ''}
                    alt=""
                    className="w-full h-full object-cover"
                  />
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
                variant="outline"
                size="sm"
                onClick={() => {
                  setDrawerOpen(false);
                  handleEditProduct(selectedProduct);
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAdjustStockClick(selectedProduct)}
              >
                <Package className="h-4 w-4 mr-2" />
                Adjust Stock
              </Button>
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

            {selectedProduct.variants && selectedProduct.variants.length > 0 && (
              <DrawerSectionCard title={`Variants (${selectedProduct.variants.length})`}>
                <div className="space-y-2">
                  {selectedProduct.variants.map((variant) => (
                    <div key={variant.id} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-b-0">
                      <div>
                        <p className="font-medium text-gray-900">{variant.name}</p>
                        {variant.sku && (
                          <p className="text-xs text-muted-foreground">SKU: {variant.sku}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          {valueFormatter(variant.sellingPrice || selectedProduct.sellingPrice)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Stock: {variant.quantityOnHand}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
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
        ) : null}
      </DetailsDrawer>

      {/* Create Category Dialog */}
      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent className="sm:w-[var(--modal-w-sm)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)]">
          <DialogHeader>
            <DialogTitle>Create New Category</DialogTitle>
            <DialogDescription>
              Add a new category for organizing your products.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
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
          </DialogBody>
          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
