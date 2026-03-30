/**
 * POS (Point of Sale) Page
 *
 * Digital POS that runs on phone, tablet, and laptop. Full-featured checkout:
 * - Offline-first with product/customer cache and pending-sales queue
 * - Mobile money (direct MTN/AirtelTigo APIs; Paystack fallback), cash, card, credit
 * - Multi-channel receipts (Print, SMS, WhatsApp, Email)
 * - Responsive layout for phone, tablet, and desktop
 * - Scan Mode: full-screen barcode/QR scanning for quick checkout
 * - Works on low-end devices and slow networks
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { computeDocumentTax } from '../utils/taxCalculationClient';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { RefreshCw, Users, Loader2, Camera, CreditCard, UserPlus, Phone } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { SecondaryButton } from '@/components/ui/secondary-button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

// POS Components
import POSCart from '../components/pos/POSCart';
import POSProductSearch from '../components/pos/POSProductSearch';
import POSPaymentModal from '../components/pos/POSPaymentModal';
import POSReceiptModal from '../components/pos/POSReceiptModal';
import POSConnectionStatus from '../components/pos/POSConnectionStatus';
import POSScanMode from '../components/pos/POSScanMode';

// Hooks and Services
import { usePOSOffline } from '../hooks/usePOSOffline';
import { usePOSConfig } from '../hooks/usePOSConfig';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { useDebounce } from '../hooks/useDebounce';
import { useResponsive } from '../hooks/useResponsive';
import customerService from '../services/customerService';
import settingsService from '../services/settingsService';
import saleService from '../services/saleService';
import mobileMoneyService from '../services/mobileMoneyService';
import productService from '../services/productService';

// Utils
import { showSuccess, showError } from '../utils/toast';
import { normalizePhone, validatePhone } from '../utils/phoneUtils';
import { CURRENCY, DEBOUNCE_DELAYS, QUERY_CACHE } from '../constants';

/**
 * Format currency value
 */
const formatCurrency = (amount) => {
  return `${CURRENCY.SYMBOL} ${(amount || 0).toFixed(CURRENCY.DECIMAL_PLACES)}`;
};

/**
 * Generate cart item ID
 */
const generateCartItemId = () => {
  return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Customer selection dialog: search existing, walk-in, or quick-add (phone + name)
 */
const CustomerSelectDialog = ({ isOpen, onClose, onSelect, onFindOrCreate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickName, setQuickName] = useState('');
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddError, setQuickAddError] = useState(null);
  const debouncedSearch = useDebounce(searchQuery, DEBOUNCE_DELAYS.SEARCH);

  const { data: customersData, isLoading } = useQuery({
    queryKey: ['customers', 'pos', debouncedSearch],
    queryFn: () => customerService.getCustomers({
      search: debouncedSearch,
      limit: 20,
      isActive: true
    }),
    staleTime: QUERY_CACHE.STALE_TIME_DEFAULT,
    enabled: isOpen
  });

  const customers = Array.isArray(customersData?.data) ? customersData.data : (customersData?.data?.customers || customersData?.customers || []);

  const handleQuickAdd = useCallback(async () => {
    const phone = (quickPhone || '').trim();
    if (!phone) {
      setQuickAddError('Phone is required');
      return;
    }
    const { valid, error } = validatePhone(phone);
    if (!valid) {
      setQuickAddError(error || 'Invalid phone format');
      return;
    }
    setQuickAddError(null);
    setQuickAddLoading(true);
    try {
      const customer = await onFindOrCreate(phone, (quickName || '').trim());
      if (customer) {
        onSelect(customer);
        onClose();
      } else {
        setQuickAddError('Could not add customer');
      }
    } catch (err) {
      setQuickAddError(err?.message || 'Failed to add customer');
    } finally {
      setQuickAddLoading(false);
    }
  }, [quickPhone, quickName, onFindOrCreate, onSelect, onClose]);

  const resetQuickForm = useCallback(() => {
    setQuickPhone('');
    setQuickName('');
    setQuickAddError(null);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetQuickForm(); onClose(); }}>
      <DialogContent className="sm:w-[var(--modal-w-md)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Select Customer
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
        {/* Quick add customer: phone (required) + name */}
        <div className="p-3 bg-muted rounded-lg border border-border space-y-2">
          <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Quick add customer
          </p>
          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="text-xs text-gray-600">Phone (required)</label>
              <div className="relative mt-0.5">
                <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="tel"
                  placeholder="0XX XXX XXXX"
                  value={quickPhone}
                  onChange={(e) => { setQuickPhone(e.target.value); setQuickAddError(null); }}
                  className="h-10 pl-9"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-600">Name (optional)</label>
              <Input
                placeholder="Customer name"
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                className="h-10 mt-0.5"
              />
            </div>
            {quickAddError && (
              <p className="text-xs text-red-600">{quickAddError}</p>
            )}
            <Button
              onClick={handleQuickAdd}
              loading={quickAddLoading}
              disabled={!quickPhone.trim()}
              className="h-10 bg-brand hover:bg-brand-dark"
            >
              Add & use
            </Button>
          </div>
        </div>

        <p className="text-xs text-gray-500 py-3">Or search existing</p>
        <Input
          placeholder="Search customers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-12"
        />

        <ScrollArea className="max-h-64">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No customers found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer border border-transparent hover:border-border"
                  onClick={() => {
                    onSelect(customer);
                    onClose();
                  }}
                >
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-700 font-semibold">
                      {(customer.name || customer.company || '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{customer.name || customer.company || 'No name'}</p>
                    <p className="text-sm text-gray-500 truncate">{customer.phone || customer.email || ''}</p>
                  </div>
                  {customer.creditLimit > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Credit</p>
                      <p className="text-sm font-medium text-green-600">
                        {formatCurrency(customer.creditLimit - (customer.balance || 0))}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        </DialogBody>
        <DialogFooter>
          <SecondaryButton onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            variant="outline"
            onClick={() => {
              onSelect(null);
              onClose();
            }}
          >
            Walk-in Customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Main POS Page Component
 */
const POS = () => {
  const { activeTenant, activeTenantId, user, isManager } = useAuth();
  const businessType = activeTenant?.businessType || null;
  const shopType =
    activeTenant?.metadata?.businessSubType ||
    activeTenant?.metadata?.shopType ||
    null;
  const isShop = businessType === 'shop';
  const isRestaurant = shopType === 'restaurant';
  const tenantIdForProducts = activeTenantId || (typeof localStorage !== 'undefined' ? localStorage.getItem('activeTenantId') : null);

  const { posConfig } = usePOSConfig();

  // Offline support hook
  const {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncError,
    isProductsCached,
    searchProducts,
    getProductByBarcode,
    resolveProductFromQRPayload,
    refreshProductCache,
    syncProductsToCache,
    getCachedProducts,
    processSale,
    syncPendingSales,
    getQuickAddItems,
    addQuickItem,
    removeQuickAddItem
  } = usePOSOffline();

  // Cart state
  const [cart, setCart] = useState([]);
  const [cartDiscount, setCartDiscount] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [quickCustomerPhone, setQuickCustomerPhone] = useState('');

  // UI state
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentModalStayOpen, setPaymentModalStayOpen] = useState(() => {
    try {
      return localStorage.getItem('pos_payment_modal_stay_open') === 'true';
    } catch {
      return false;
    }
  });
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [customerForReceipt, setCustomerForReceipt] = useState(null);
  const [mobileMoneyState, setMobileMoneyState] = useState('idle'); // idle | initiating | waiting | success | failed
  const [mobileMoneyError, setMobileMoneyError] = useState('');
  const [mobileMoneyFallbackMode, setMobileMoneyFallbackMode] = useState(null); // null | 'manual'

  /** When offline, always show manual MoMo in payment modal (record payment, no Paystack request) */
  useEffect(() => {
    if (!isOnline) {
      setMobileMoneyFallbackMode('manual');
    } else {
      setMobileMoneyFallbackMode(null);
    }
  }, [isOnline]);

  /** When waiting for MoMo, WebSocket can push sale completed so we stop polling and show success immediately */
  const waitingMoMoSaleIdRef = useRef(null);
  const wsCompletedSaleIdRef = useRef(null);

  const handleSaleCreated = useCallback((data) => {
    if (waitingMoMoSaleIdRef.current && data?.sale?.id === waitingMoMoSaleIdRef.current && data?.sale?.status === 'completed') {
      wsCompletedSaleIdRef.current = data.sale.id;
    }
  }, []);
  const handleSaleUpdated = useCallback((data) => {
    if (waitingMoMoSaleIdRef.current && data?.sale?.id === waitingMoMoSaleIdRef.current && data?.sale?.status === 'completed') {
      wsCompletedSaleIdRef.current = data.sale.id;
    }
  }, []);

  useWebSocket({
    enabled: !!activeTenantId,
    onSaleCreated: handleSaleCreated,
    onSaleUpdated: handleSaleUpdated,
  });

  // Scan Mode state
  const [scanModeOpen, setScanModeOpen] = useState(false);
  const { isMobile: isMobileWidth } = useResponsive();
  const [isMobile, setIsMobile] = useState(isMobileWidth);

  const [fallbackProducts, setFallbackProducts] = useState([]);

  const { data: activeProductsFromQuery, refetch: refetchActiveProducts, isLoading: productsLoading } = useQuery({
    queryKey: ['products', 'active', tenantIdForProducts],
    queryFn: () => productService.getAllActiveProducts(),
    enabled: !!tenantIdForProducts,
    staleTime: QUERY_CACHE.STALE_TIME_DEFAULT,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
  const allProducts = useMemo(() => {
    const fromQuery = Array.isArray(activeProductsFromQuery) ? activeProductsFromQuery : [];
    if (fromQuery.length > 0) return fromQuery;
    return fallbackProducts;
  }, [activeProductsFromQuery, fallbackProducts]);

  const cartQuantityByProductId = useMemo(() => {
    const map = {};
    cart.forEach((item) => {
      if (item.productId) map[item.productId] = (map[item.productId] || 0) + (Number(item.quantity) || 0);
    });
    return map;
  }, [cart]);
  
  // Detect mobile based on viewport width with a light UA hint
  useEffect(() => {
    const uaIsMobile =
      typeof navigator !== 'undefined' &&
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
    setIsMobile(isMobileWidth || uaIsMobile);
  }, [isMobileWidth]);

  // Fetch organization settings
  const { data: orgSettingsData } = useQuery({
    queryKey: ['settings', 'organization'],
    queryFn: () => settingsService.getOrganizationSettings(),
    staleTime: QUERY_CACHE.STALE_TIME_STABLE
  });

  // Payment collection must be configured (bank or MoMo) before using POS so funds go to tenant
  const { data: paymentCollectionData, isLoading: paymentCollectionLoading } = useQuery({
    queryKey: ['settings', 'payment-collection', activeTenantId],
    queryFn: () => settingsService.getPaymentCollectionSettings(),
    staleTime: QUERY_CACHE.STALE_TIME_STABLE,
    enabled: !!activeTenantId && isShop
  });
  const paymentCollection = paymentCollectionData?.data ?? paymentCollectionData;
  const paymentCollectionConfigured = Boolean(
    paymentCollection?.configured === true ||
    paymentCollection?.settlement_type === 'momo' ||
    paymentCollection?.hasSubaccount === true
  );

  // Only require payment collection for POS when online-payment flows are enabled.
  const { data: notificationChannelsData } = useQuery({
    queryKey: ['settings', 'notification-channels'],
    queryFn: settingsService.getNotificationChannels,
    staleTime: QUERY_CACHE.STALE_TIME_STABLE,
    enabled: !!activeTenantId && isShop,
  });
  const { data: quoteWorkflowData } = useQuery({
    queryKey: ['settings', 'quote-workflow'],
    queryFn: settingsService.getQuoteWorkflow,
    staleTime: QUERY_CACHE.STALE_TIME_STABLE,
    enabled: !!activeTenantId && isShop,
  });
  const onlinePaymentRequired = Boolean(
    notificationChannelsData?.autoSendInvoiceToCustomer === true ||
    (quoteWorkflowData?.onAccept || 'record_only') === 'create_job_invoice_and_send'
  );

  // API returns { success, data: organization }; axios wraps as { data: { success, data: organization } }
  const organizationSettings = orgSettingsData?.data?.data || orgSettingsData?.data?.organization || orgSettingsData?.data || {};

  const posTaxConfig = useMemo(() => {
    const t = organizationSettings?.tax || {};
    return {
      enabled: t.enabled === true,
      defaultRatePercent: parseFloat(t.defaultRatePercent) || 0,
      pricesAreTaxInclusive: t.pricesAreTaxInclusive === true
    };
  }, [organizationSettings]);

  // Fetch customers list for cart dropdown (Select existing)
  const { data: customersData } = useQuery({
    queryKey: ['customers', 'pos-list', activeTenantId],
    queryFn: () => customerService.getCustomers({ limit: 200, isActive: true }),
    staleTime: QUERY_CACHE.STALE_TIME_DEFAULT,
    enabled: !!activeTenantId
  });
  const customersList = Array.isArray(customersData?.data) ? customersData.data : (customersData?.data?.customers || customersData?.customers || []);

  // Load fallback from offline cache; products come from React Query (no duplicate fetch on mount)
  useEffect(() => {
    const loadData = async () => {
      try {
        const products = await getCachedProducts();
        setFallbackProducts(products);
      } catch (error) {
        console.error('[POS] Failed to load POS data:', error);
      }
    };
    loadData();
  }, [getCachedProducts]);

  // Sync React Query product list to offline cache so one fetch serves both UI and offline
  useEffect(() => {
    const list = Array.isArray(activeProductsFromQuery) ? activeProductsFromQuery : [];
    if (list.length > 0) syncProductsToCache(list);
  }, [activeProductsFromQuery, syncProductsToCache]);

  const cartTotals = useMemo(() => {
    const lines = cart.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount || 0
    }));
    const computed = computeDocumentTax({
      lines,
      cartDiscount,
      config: posTaxConfig
    });
    const itemDiscounts = cart.reduce((sum, item) => sum + (item.discount || 0), 0);
    const taxLabel = organizationSettings?.tax?.displayLabel || 'Tax';
    return {
      subtotal: computed.subtotal,
      itemDiscounts,
      cartDiscount,
      totalDiscount: computed.discount,
      netBeforeTax: computed.netTaxable,
      taxAmount: computed.taxAmount,
      taxLabel,
      total: Math.max(0, computed.total),
      itemCount: cart.reduce((sum, item) => sum + item.quantity, 0)
    };
  }, [cart, cartDiscount, posTaxConfig, organizationSettings?.tax?.displayLabel]);

  // Add product to cart
  const addToCart = useCallback((product) => {
    setCart(prevCart => {
      // Check if product already in cart
      const existingIndex = prevCart.findIndex(item => 
        item.productId === product.id && !item.productVariantId
      );

      if (existingIndex >= 0) {
        // Increase quantity
        const newCart = [...prevCart];
        newCart[existingIndex] = {
          ...newCart[existingIndex],
          quantity: newCart[existingIndex].quantity + 1
        };
        return newCart;
      }

      // Add new item
      return [...prevCart, {
        id: generateCartItemId(),
        productId: product.id,
        productVariantId: null,
        name: product.name,
        sku: product.sku,
        unitPrice: product.sellingPrice,
        quantity: 1,
        discount: 0,
        tax: 0
      }];
    });
  }, []);

  const adjustProductQuantity = useCallback((productId, delta) => {
    if (!delta) return;
    setCart((prevCart) => {
      const index = prevCart.findIndex(
        (item) => item.productId === productId && !item.productVariantId
      );
      if (index === -1) {
        // If item not in cart yet and delta is positive, add one unit
        if (delta > 0) {
          const product = allProducts.find((p) => p.id === productId);
          if (!product) return prevCart;
          return [
            ...prevCart,
            {
              id: generateCartItemId(),
              productId: product.id,
              productVariantId: null,
              name: product.name,
              sku: product.sku,
              unitPrice: product.sellingPrice,
              quantity: 1,
              discount: 0,
              tax: 0,
            },
          ];
        }
        return prevCart;
      }
      const current = Number(prevCart[index].quantity) || 0;
      const next = current + delta;
      if (next <= 0) {
        return prevCart.filter((_, i) => i !== index);
      }
      const updated = [...prevCart];
      updated[index] = { ...updated[index], quantity: next };
      return updated;
    });
  }, [allProducts]);

  // Pre-add product when navigating from staff dashboard with state.addProductId
  const navigateRef = useNavigate();
  const location = useLocation();

  // When navigating from dashboard "Add sale" with openModal, open scan mode and clear state
  useEffect(() => {
    if (location.state?.openModal) {
      navigateRef(location.pathname, { replace: true, state: {} });
      setScanModeOpen(true);
    }
  }, [location.state?.openModal, location.pathname, navigateRef]);

  useEffect(() => {
    const addProductId = location.state?.addProductId;
    if (!addProductId) return;

    const apply = async () => {
      try {
        let product = null;
        const products = await getCachedProducts();
        product = products.find((p) => p.id === addProductId);
        if (!product) {
          const res = await productService.getProductById(addProductId);
          const data = res?.data?.data ?? res?.data ?? res;
          product = data?.id ? data : null;
        }
        if (product) {
          addToCart(product);
        }
      } catch (_) {
        // ignore
      }
      navigateRef('/pos', { replace: true, state: {} });
    };
    apply();
  }, [location.state?.addProductId, getCachedProducts, addToCart, navigateRef]);

  // Update cart item quantity
  const updateCartItemQuantity = useCallback((itemId, quantity) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== itemId));
    } else {
      setCart(prev => prev.map(item => 
        item.id === itemId ? { ...item, quantity } : item
      ));
    }
  }, []);

  // Remove cart item
  const removeCartItem = useCallback((itemId) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  }, []);

  // Update cart item discount
  const updateCartItemDiscount = useCallback((itemId, discount) => {
    setCart(prev => prev.map(item => 
      item.id === itemId ? { ...item, discount } : item
    ));
  }, []);

  // Clear cart
  const clearCart = useCallback(() => {
    setCart([]);
    setCartDiscount(0);
    setSelectedCustomer(null);
    setQuickCustomerName('');
    setQuickCustomerPhone('');
  }, []);

  // Handle find or create customer (for scan mode and quick-add in main POS). Normalizes phone (0XX / +233).
  // Declared before handleCheckout so it is not in temporal dead zone when handleCheckout's useCallback runs.
  const handleFindOrCreateCustomer = useCallback(async (phone, name) => {
    try {
      const normalized = normalizePhone(phone || '');
      if (!normalized) return null;
      const result = await customerService.findOrCreate(normalized, name || '');
      const body = result?.data ?? result;
      return body?.data ?? body ?? null;
    } catch (error) {
      console.error('Failed to find/create customer:', error);
      return null;
    }
  }, []);

  // Handle checkout: if quick-add phone/name filled but no selected customer, validate, find-or-create then open payment
  const handleCheckout = useCallback(async () => {
    if (cart.length === 0) {
      showError('Cart is empty');
      return;
    }
    if (!selectedCustomer && (quickCustomerPhone?.trim() || quickCustomerName?.trim())) {
      const phone = (quickCustomerPhone || '').trim();
      if (phone) {
        const { valid, error } = validatePhone(phone);
        if (!valid) {
          showError(error || 'Invalid phone format');
          return;
        }
        try {
          const customer = await handleFindOrCreateCustomer(phone, (quickCustomerName || '').trim());
          if (customer) {
            setSelectedCustomer(customer);
            setQuickCustomerName('');
            setQuickCustomerPhone('');
          }
        } catch (_) {
          // Proceed to payment without customer
        }
      }
    }
    setPaymentModalOpen(true);
  }, [cart, selectedCustomer, quickCustomerPhone, quickCustomerName, handleFindOrCreateCustomer]);

  // Handle payment confirmation
  const handleConfirmPayment = useCallback(async (paymentDetails) => {
    setIsProcessingPayment(true);

    try {
      // Prepare sale data
      const saleData = {
        items: cart.map(item => ({
          productId: item.productId,
          productVariantId: item.productVariantId,
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          tax: item.tax || 0
        })),
        customerId: selectedCustomer?.id || null,
        paymentMethod: paymentDetails.paymentMethod,
        amountPaid: paymentDetails.amountPaid,
        notes: paymentDetails.mobileMoneyReference 
          ? `Mobile Money Ref: ${paymentDetails.mobileMoneyReference}` 
          : null,
        cartDiscount,
        metadata: {
          mobileMoneyProvider: paymentDetails.mobileMoneyProvider,
          mobileMoneyPhone: paymentDetails.mobileMoneyPhone,
          mobileMoneyReference: paymentDetails.mobileMoneyReference,
          posTaxConfigSnapshot: posTaxConfig
        }
      };
      if (isRestaurant) {
        saleData.sendToKitchen = paymentDetails.sendToKitchen ?? true;
      }

      // Process sale (online or queue offline)
      const result = await processSale(saleData);

      if (result.success) {
        // Use backend sale (includes invoice, paymentMethod) when online; fallback for offline/queued
        const saleObj = result.sale || {
          id: result.localId,
          saleNumber: `OFFLINE-${result.localId ?? Date.now()}`,
          total: cartTotals.total,
          change: paymentDetails.change || 0,
          items: cart,
          paymentMethod: paymentDetails.paymentMethod,
          ...saleData
        };

        setCompletedSale(saleObj);
        // Always return user to main POS view after a successful sale
        setPaymentModalOpen(false);
        // Capture customer/phone for receipt before clearCart wipes them
        setCustomerForReceipt(
          selectedCustomer ||
          (quickCustomerPhone
            ? { phone: quickCustomerPhone, name: quickCustomerName || '', email: '' }
            : null)
        );
        // If auto_send and no SMS/WhatsApp/Email integrated, skip receipt modal - close immediately
        const receiptChannelsAvailable = posConfig?.receiptChannelsAvailable || {};
        const rawChannels = posConfig?.receipt?.channels || ['sms', 'print'];
        const integratedSendChannels = rawChannels.filter((c) => c !== 'print' && receiptChannelsAvailable[c]);
        const receiptMode = posConfig?.receipt?.mode || 'ask';
        const skipReceiptModal = receiptMode === 'auto_send' && integratedSendChannels.length === 0;
        setReceiptModalOpen(!skipReceiptModal);

        if (result.isQueued) {
          showSuccess('Sale saved offline. Will sync when connected.');
        } else if (isRestaurant && saleObj?.saleNumber && (paymentDetails.sendToKitchen ?? true)) {
          showSuccess(`Order placed! #${saleObj.saleNumber} has been sent to the kitchen.`);
        } else {
          showSuccess('Sale completed successfully!');
        }

        // Clear cart after successful sale
        clearCart();
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      showError(error.message || 'Failed to process payment');
    } finally {
      setIsProcessingPayment(false);
    }
  }, [cart, selectedCustomer, cartTotals, processSale, clearCart, isRestaurant, posConfig, cartDiscount, posTaxConfig]);

  // Handle Paystack Mobile Money payment request (POS)
  const handleRequestMobileMoneyPayment = useCallback(
    async ({ phone, provider }) => {
      const phoneNumber = (phone || '').trim();
      const logicalProvider = String(provider || 'MTN').toUpperCase();

      if (!phoneNumber) {
        showError('Customer MoMo number is required');
        return;
      }
      if (logicalProvider === 'VODAFONE') {
        showError(
          'Vodafone Cash automated collection is not available yet. Choose MTN or AirtelTigo, or use card, cash, or manual MoMo.'
        );
        setMobileMoneyState('failed');
        return;
      }
      if (!isOnline) {
        showError('You are offline. Use manual MoMo or cash.');
        setMobileMoneyFallbackMode('manual');
        return;
      }

      setIsProcessingPayment(true);
      setMobileMoneyError('');
      setMobileMoneyState('initiating');
      setMobileMoneyFallbackMode(null);

      const formattedMoMoPhone = mobileMoneyService.formatPhoneNumber(phoneNumber).replace(/^\+/, '');

      try {
        // 1. Create pending sale
        const saleData = {
          items: cart.map((item) => ({
            productId: item.productId,
            productVariantId: item.productVariantId,
            name: item.name,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            tax: item.tax || 0
          })),
          customerId: selectedCustomer?.id || null,
          paymentMethod: 'mobile_money',
          status: 'pending',
          amountPaid: 0,
          metadata: {
            mobileMoneyProvider: logicalProvider,
            mobileMoneyPhone: phoneNumber
          }
        };

        const result = await processSale(saleData);
        const createdSale = result?.sale;
        if (!result.success || !createdSale?.id) {
          showError('Failed to start mobile money payment. Please try again.');
          setMobileMoneyState('failed');
          return;
        }

        const saleId = createdSale.id;
        const totalAmount = parseFloat(createdSale.total || 0);

        setMobileMoneyState('initiating');

        // 2. Prefer direct operator MoMo APIs; fall back to Paystack MoMo if unavailable
        let directOk = false;
        try {
          const momoRes = await mobileMoneyService.initiatePayment({
            saleId,
            phoneNumber: formattedMoMoPhone,
            amount: totalAmount,
            currency: 'GHS',
            provider: logicalProvider
          });
          directOk = !!momoRes?.success;
          if (!directOk) {
            const errMsg = String(momoRes?.error || momoRes?.message || '').toLowerCase();
            const canTryPaystack =
              errMsg.includes('not configured') ||
              errMsg.includes('authenticate') ||
              errMsg.includes('failed to initiate') ||
              errMsg.includes('unavailable');
            if (!canTryPaystack) {
              const message = momoRes?.error || momoRes?.message || 'Failed to initiate mobile money payment';
              showError(message);
              setMobileMoneyError(message);
              setMobileMoneyState('failed');
              return;
            }
          }
        } catch (directErr) {
          directOk = false;
        }

        if (!directOk) {
          const paystackRes = await saleService.paystackMobileMoneyPay(saleId, {
            phoneNumber,
            provider: logicalProvider
          });

          if (!paystackRes?.success) {
            const message =
              paystackRes?.message ||
              paystackRes?.error ||
              'Failed to initiate mobile money payment';
            showError(message);
            setMobileMoneyError(message);
            setMobileMoneyState('failed');
            if (
              message.toLowerCase().includes('not configured') ||
              message.toLowerCase().includes('paystack')
            ) {
              setMobileMoneyFallbackMode('manual');
            }
            return;
          }
        }

        setMobileMoneyState('waiting');

        const maxAttempts = 30;
        const delayMs = 2000;
        let finalSale = null;
        waitingMoMoSaleIdRef.current = saleId;
        wsCompletedSaleIdRef.current = null;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          if (wsCompletedSaleIdRef.current === saleId) {
            // eslint-disable-next-line no-await-in-loop
            const res = await saleService.getSaleById(saleId);
            const body = res?.data ?? res;
            finalSale = body?.data ?? body ?? null;
            break;
          }

          if (directOk) {
            // eslint-disable-next-line no-await-in-loop
            const pollRes = await mobileMoneyService.pollSalePayment(saleId);
            const d = pollRes?.data ?? pollRes;
            if (d?.saleStatus === 'completed' || d?.paymentStatus === 'SUCCESSFUL') {
              // eslint-disable-next-line no-await-in-loop
              const res = await saleService.getSaleById(saleId);
              const body = res?.data ?? res;
              finalSale = body?.data ?? body ?? null;
              if (finalSale?.status === 'completed') break;
            }
          } else {
            // eslint-disable-next-line no-await-in-loop
            const res = await saleService.checkPaystackCharge(saleId);
            const body = res?.data ?? res;
            const sale = body?.data ?? body ?? null;
            if (sale && sale.status === 'completed' && sale.paymentMethod === 'mobile_money') {
              finalSale = sale;
              break;
            }
          }

          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        waitingMoMoSaleIdRef.current = null;
        wsCompletedSaleIdRef.current = null;

        if (!finalSale || finalSale.status !== 'completed') {
          const msg =
            'Payment not completed yet. Please confirm on customer phone or try again.';
          showError(msg);
          setMobileMoneyError(msg);
          setMobileMoneyState('failed');
          return;
        }

        setCompletedSale(finalSale);
        setPaymentModalOpen(false);
        setCustomerForReceipt(
          selectedCustomer ||
            (quickCustomerPhone
              ? { phone: quickCustomerPhone, name: quickCustomerName || '', email: '' }
              : null)
        );
        const receiptChannelsAvailable = posConfig?.receiptChannelsAvailable || {};
        const rawChannels = posConfig?.receipt?.channels || ['sms', 'print'];
        const integratedSendChannels = rawChannels.filter(
          (c) => c !== 'print' && receiptChannelsAvailable[c]
        );
        const receiptMode = posConfig?.receipt?.mode || 'ask';
        const skipReceiptModal =
          receiptMode === 'auto_send' && integratedSendChannels.length === 0;
        setReceiptModalOpen(!skipReceiptModal);

        showSuccess('Sale completed successfully!');
        clearCart();
        setMobileMoneyState('success');
      } catch (error) {
        console.error('[MoMo] Mobile money payment error:', {
          error,
          responseData: error?.response?.data,
          status: error?.response?.status,
          message: error?.message
        });
        const message = error?.response?.data?.message || error.message || 'Failed to process mobile money payment';
        showError(message);
        setMobileMoneyError(message);
        setMobileMoneyState('failed');
      } finally {
        waitingMoMoSaleIdRef.current = null;
        wsCompletedSaleIdRef.current = null;
        setIsProcessingPayment(false);
      }
    },
    [
      cart,
      selectedCustomer,
      isOnline,
      processSale,
      posConfig,
      quickCustomerName,
      quickCustomerPhone,
      clearCart
    ]
  );

  const handlePaymentModalStayOpenChange = useCallback((checked) => {
    setPaymentModalStayOpen(checked);
    try {
      localStorage.setItem('pos_payment_modal_stay_open', String(checked));
    } catch {
      /* ignore */
    }
  }, []);

  // Handle send receipt
  const handleSendReceipt = useCallback(async ({ saleId, channels, phone, email }) => {
    try {
      await saleService.sendReceipt(saleId, { channels, phone, email });
    } catch (error) {
      // If offline or API not available, show info message
      if (!isOnline) {
        showSuccess('Receipt will be sent when back online');
        return;
      }
      throw error;
    }
  }, [isOnline]);

  // Handle refresh products
  const handleRefreshProducts = useCallback(async () => {
    await refreshProductCache();
    await refetchActiveProducts();
    const products = await getCachedProducts();
    setFallbackProducts(products);
    showSuccess('Products refreshed');
  }, [refreshProductCache, refetchActiveProducts, getCachedProducts]);

  // Handle process sale for scan mode
  const handleProcessSaleForScanMode = useCallback(async (saleData) => {
    return await processSale(saleData);
  }, [processSale]);

  // Handle send receipt for scan mode
  const handleSendReceiptForScanMode = useCallback(async (saleId, options) => {
    try {
      await saleService.sendReceipt(saleId, options);
    } catch (error) {
      if (!isOnline) {
        // Receipt will be sent when back online
        return;
      }
      throw error;
    }
  }, [isOnline]);

  if (!isShop) {
    return (
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Point of Sale</h1>
            <p className="text-gray-600 mt-1">Quick checkout and sales processing</p>
          </div>
        </div>
        <Card className="border border-gray-200">
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                <CreditCard className="h-10 w-10 text-gray-400" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-foreground mb-2">Not Available</h2>
                <p className="text-gray-600 max-w-md">
                  POS is only available for shop business types.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!paymentCollectionLoading && onlinePaymentRequired && !paymentCollectionConfigured) {
    return (
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Point of Sale</h1>
            <p className="text-gray-600 mt-1">Quick checkout and sales processing</p>
          </div>
        </div>
        <Card className="border border-gray-200">
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                <CreditCard className="h-10 w-10 text-gray-400" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-foreground mb-2">Set up payment collection</h2>
                <p className="text-gray-600 max-w-md mb-4">
                  {isManager
                    ? 'Configure where to receive card and mobile money payments from customers before using POS. Your funds will go to your bank or MoMo account.'
                    : 'Payment collection must be configured before POS can take online payments. Ask a workspace manager or administrator to set this up in Settings.'}
                </p>
                {isManager ? (
                  <Button
                    onClick={() => navigateRef('/settings?tab=payments')}
                    className="bg-green-700 hover:bg-green-800"
                  >
                    Go to Settings
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-4rem)] pt-3 pl-3 sm:pt-4 sm:pl-4 md:pt-6 md:pl-6 bg-muted/50">
      {/* Header */}
      <div
        className={`mb-4 ${
          isMobile ? 'flex flex-col gap-3' : 'flex items-center justify-between gap-2'
        }`}
      >
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
            Point of Sale
          </h1>
          <p className="text-gray-600 text-xs sm:text-sm truncate">
            Quick checkout and sales processing
          </p>
        </div>

        {isMobile ? (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center justify-between gap-3 w-full">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setScanModeOpen(true)}
                    className="bg-green-700 hover:bg-green-800 h-12 px-4 text-base flex-1"
                  >
                    <Camera className="h-5 w-5 mr-2 flex-shrink-0" />
                    <span className="truncate">Scan</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open barcode scanner for quick add</TooltipContent>
              </Tooltip>

              <div className="flex-shrink-0">
                <POSConnectionStatus
                  isOnline={isOnline}
                  pendingCount={pendingCount}
                  isSyncing={isSyncing}
                  lastSyncError={lastSyncError}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <span className="text-xs text-muted-foreground">Stay open</span>
              <Switch
                id="stay-open-main-mobile"
                checked={paymentModalStayOpen}
                onCheckedChange={handlePaymentModalStayOpenChange}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mr-2">
              <span>Stay open</span>
              <Switch
                id="stay-open-main-desktop"
                checked={paymentModalStayOpen}
                onCheckedChange={handlePaymentModalStayOpenChange}
              />
            </div>

            {/* Start Scanning Button - desktop */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setScanModeOpen(true)}
                  className="bg-green-700 hover:bg-green-800 h-10"
                >
                  <Camera className="h-5 w-5 mr-2 flex-shrink-0" />
                  <span className="truncate">Start Scanning</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open barcode scanner for quick add</TooltipContent>
            </Tooltip>

            <POSConnectionStatus
              isOnline={isOnline}
              pendingCount={pendingCount}
              isSyncing={isSyncing}
              lastSyncError={lastSyncError}
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefreshProducts}
                  disabled={!isOnline || isSyncing}
                  className="hidden md:flex"
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh product list</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Main content - Split layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-0">
        {/* Left side - Product list (search + browse); click or scan adds to cart */}
        <div className="lg:col-span-3 flex flex-col min-h-0">
          <POSProductSearch
            onSearch={searchProducts}
            getProductByBarcode={getProductByBarcode}
            resolveProductFromQRPayload={resolveProductFromQRPayload}
            onSelectProduct={addToCart}
            isOnline={isOnline}
            allProducts={allProducts}
            productsLoading={productsLoading}
            cartQuantityByProductId={cartQuantityByProductId}
            fillHeight
            onAdjustProductQuantity={adjustProductQuantity}
          />
        </div>

        {/* Right side - Cart */}
        <div className="hidden lg:block lg:col-span-2 min-h-0 overflow-y-auto">
          <POSCart
            items={cart}
            totalsOverride={cartTotals}
            onUpdateQuantity={updateCartItemQuantity}
            onRemoveItem={removeCartItem}
            onUpdateItemDiscount={updateCartItemDiscount}
            customer={selectedCustomer}
            customers={customersList}
            onSelectCustomer={(customer) => {
              setSelectedCustomer(customer);
              setQuickCustomerName('');
              setQuickCustomerPhone('');
            }}
            onClearCustomer={() => {
              setSelectedCustomer(null);
              setQuickCustomerName('');
              setQuickCustomerPhone('');
            }}
            showQuickCustomerForm
            quickCustomerName={quickCustomerName}
            quickCustomerPhone={quickCustomerPhone}
            onQuickCustomerNameChange={setQuickCustomerName}
            onQuickCustomerPhoneChange={setQuickCustomerPhone}
            cartDiscount={cartDiscount}
            onUpdateCartDiscount={setCartDiscount}
            onCheckout={handleCheckout}
            onClearCart={clearCart}
          />
        </div>
      </div>

      {/* Customer selection dialog */}
      <CustomerSelectDialog
        isOpen={customerDialogOpen}
        onClose={() => setCustomerDialogOpen(false)}
        onSelect={(customer) => {
          setSelectedCustomer(customer);
          setQuickCustomerName('');
          setQuickCustomerPhone('');
        }}
        onFindOrCreate={handleFindOrCreateCustomer}
      />

      {/* Payment modal */}
      <POSPaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        total={cartTotals.total}
        taxSummary={{
          subtotal: cartTotals.subtotal,
          discount: cartTotals.totalDiscount,
          taxAmount: cartTotals.taxAmount,
          taxLabel: cartTotals.taxLabel
        }}
        items={cart}
        customer={selectedCustomer}
        customers={customersList}
        onRequestChangeCustomer={() => setCustomerDialogOpen(true)}
        onClearCustomer={() => {
          setSelectedCustomer(null);
          setQuickCustomerName('');
          setQuickCustomerPhone('');
        }}
        onSelectExistingCustomer={(customer) => {
          setSelectedCustomer(customer);
          setQuickCustomerName('');
          setQuickCustomerPhone('');
        }}
        onConfirmPayment={handleConfirmPayment}
        onRequestMobileMoney={handleRequestMobileMoneyPayment}
        mobileMoneyState={mobileMoneyState}
        mobileMoneyError={mobileMoneyError}
        mobileMoneyFallbackMode={mobileMoneyFallbackMode}
        isProcessing={isProcessingPayment}
        isRestaurant={isRestaurant}
        stayOpenAfterSale={paymentModalStayOpen}
        onStayOpenAfterSaleChange={handlePaymentModalStayOpenChange}
      />

      {/* Mobile cart bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-4 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              {cartTotals.itemCount} item{cartTotals.itemCount !== 1 ? 's' : ''}
            </span>
            <span className="text-lg font-semibold text-green-700">
              {formatCurrency(cartTotals.total)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-10"
              disabled={cart.length === 0}
              onClick={clearCart}
            >
              Clear
            </Button>
            <Button
              className="h-10 bg-green-700 hover:bg-green-800"
              disabled={cart.length === 0}
              onClick={handleCheckout}
            >
              Checkout
            </Button>
          </div>
        </div>
      </div>

      {/* Receipt modal */}
      <POSReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => {
          setReceiptModalOpen(false);
          setCompletedSale(null);
          setCustomerForReceipt(null);
        }}
        sale={completedSale}
        customer={customerForReceipt}
        organizationSettings={organizationSettings}
        onSendReceipt={handleSendReceipt}
      />

      {/* Mobile Scan Mode - Full screen scanning interface */}
      <POSScanMode
        isOpen={scanModeOpen}
        onClose={() => setScanModeOpen(false)}
        getProductByBarcode={getProductByBarcode}
        resolveProductFromQRPayload={resolveProductFromQRPayload}
        onProcessSale={handleProcessSaleForScanMode}
        onFindOrCreateCustomer={handleFindOrCreateCustomer}
        onSendReceipt={handleSendReceiptForScanMode}
        receiptChannelsAvailable={posConfig?.receiptChannelsAvailable || { sms: false, whatsapp: false, email: false }}
        isOnline={isOnline}
        isRestaurant={isRestaurant}
      />
    </div>
  );
};

export default POS;
