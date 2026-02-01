/**
 * POSScanMode Component
 * 
 * Full-screen mobile scanning interface for quick POS checkout.
 * Optimized for small African shops using phones as scanners.
 * 
 * Flow:
 * 1. Open camera -> scan multiple items
 * 2. Tap "Done" -> review cart + add customer
 * 3. Checkout -> auto-send receipt via SMS
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  X, 
  ShoppingCart, 
  User, 
  Phone,
  Check,
  ChevronUp,
  Minus,
  Plus,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Banknote,
  Smartphone,
  CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { parseProductQRPayload } from '../../utils/productQR';
import { QRCodeScanner } from './POSProductSearch';
import POSNumpad from './POSNumpad';
import { useResponsive } from '../../hooks/useResponsive';
import { useDebounce } from '../../hooks/useDebounce';
import { CURRENCY } from '../../constants';
import { showSuccess, showError } from '../../utils/toast';
import customerService from '../../services/customerService';

/**
 * Format currency value (handles string/number from API or form)
 */
const formatCurrency = (amount) => {
  const num = Number(amount);
  return `${CURRENCY.SYMBOL} ${(Number.isNaN(num) ? 0 : num).toFixed(CURRENCY.DECIMAL_PLACES)}`;
};

/**
 * Generate cart item ID
 */
const generateCartItemId = () => {
  return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Scan Mode Steps
 */
const STEPS = {
  SCANNING: 'scanning',
  REVIEW: 'review',
  PAYMENT: 'payment',
  SUCCESS: 'success'
};

/**
 * Payment Methods
 */
const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'mobile_money', label: 'MoMo', icon: Smartphone },
  { id: 'card', label: 'Card', icon: CreditCard }
];

/**
 * Cart Item Component for Review Screen
 */
const CartItemRow = ({ item, onUpdateQuantity, onRemove }) => {
  const { isMobile } = useResponsive();
  const itemTotal = item.unitPrice * item.quantity;

  return (
    <div className={`flex items-center ${isMobile ? 'gap-2 py-2' : 'gap-3 py-3'} border-b border-gray-100 last:border-0`}>
      <div className="flex-1 min-w-0">
        <p className={`font-medium text-gray-900 truncate ${isMobile ? 'text-xs' : 'text-sm'}`}>{item.name}</p>
        <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-500`}>
          {formatCurrency(item.unitPrice)} each
        </p>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className={`${isMobile ? 'h-9 w-9' : 'h-8 w-8'} border-gray-300 ${isMobile ? 'rounded-md' : 'rounded-lg'}`}
          onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
        >
          <Minus className={`${isMobile ? 'h-3 w-3' : 'h-3 w-3'}`} />
        </Button>
        <span className={`${isMobile ? 'w-7 text-xs' : 'w-8 text-sm'} text-center font-medium`}>{item.quantity}</span>
        <Button
          variant="outline"
          size="icon"
          className={`${isMobile ? 'h-9 w-9' : 'h-8 w-8'} border-gray-300 ${isMobile ? 'rounded-md' : 'rounded-lg'}`}
          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
        >
          <Plus className={`${isMobile ? 'h-3 w-3' : 'h-3 w-3'}`} />
        </Button>
      </div>

      <div className={`flex items-center ${isMobile ? 'gap-1.5' : 'gap-2'}`}>
        <span className={`font-semibold text-gray-900 ${isMobile ? 'text-xs w-16' : 'text-sm w-20'} text-right`}>
          {formatCurrency(itemTotal)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className={`${isMobile ? 'h-9 w-9' : 'h-8 w-8'} text-gray-400 hover:text-red-600`}
          onClick={() => onRemove(item.id)}
        >
          <Trash2 className={`${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
        </Button>
      </div>
    </div>
  );
};

/**
 * Main POSScanMode Component
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether scan mode is active
 * @param {function} props.onClose - Called to exit scan mode
 * @param {function} props.getProductByBarcode - (barcode) => Promise<product|null>
 * @param {function} props.resolveProductFromQRPayload - (qrData) => Promise<product|null>
 * @param {function} props.onProcessSale - Process sale function (saleData) => Promise<result>
 * @param {function} props.onFindOrCreateCustomer - Find or create customer (phone, name) => Promise<customer>
 * @param {function} props.onSendReceipt - Send receipt function (saleId, options) => Promise
 * @param {boolean} props.isOnline - Whether device is online
 */
const POSScanMode = ({
  isOpen,
  onClose,
  getProductByBarcode,
  resolveProductFromQRPayload,
  onProcessSale,
  onFindOrCreateCustomer,
  onSendReceipt,
  isOnline = true
}) => {
  const { isMobile } = useResponsive();
  // Step state
  const [currentStep, setCurrentStep] = useState(STEPS.SCANNING);
  
  // Cart state
  const [cart, setCart] = useState([]);
  const [lastScannedItem, setLastScannedItem] = useState(null);
  
  // Customer state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const debouncedCustomerSearch = useDebounce(customerSearchQuery, 400);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountTendered, setAmountTendered] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Result state
  const [completedSale, setCompletedSale] = useState(null);
  const [receiptSent, setReceiptSent] = useState(false);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(STEPS.SCANNING);
      setCart([]);
      setLastScannedItem(null);
      setCustomerName('');
      setCustomerPhone('');
      setSelectedCustomerId(null);
      setCustomerSearchQuery('');
      setCustomerSearchResults([]);
      setPaymentMethod('cash');
      setAmountTendered('');
      setCompletedSale(null);
      setReceiptSent(false);
    }
  }, [isOpen]);

  // Search customers when debounced query changes
  useEffect(() => {
    if (!debouncedCustomerSearch.trim()) {
      setCustomerSearchResults([]);
      setShowCustomerDropdown(false);
      return;
    }
    let cancelled = false;
    setCustomerSearching(true);
    customerService.getCustomers({ search: debouncedCustomerSearch.trim(), limit: 10 })
      .then((res) => {
        if (cancelled) return;
        const body = res?.data ?? res;
        const list = body?.data ?? (Array.isArray(body) ? body : []);
        setCustomerSearchResults(Array.isArray(list) ? list : []);
        setShowCustomerDropdown(true);
      })
      .catch(() => {
        if (!cancelled) setCustomerSearchResults([]);
      })
      .finally(() => {
        if (!cancelled) setCustomerSearching(false);
      });
    return () => { cancelled = true; };
  }, [debouncedCustomerSearch]);

  // Calculate totals
  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => 
      sum + (item.unitPrice * item.quantity), 0);
    return {
      subtotal,
      total: subtotal,
      itemCount: cart.reduce((sum, item) => sum + item.quantity, 0)
    };
  }, [cart]);

  const selectCustomer = useCallback((customer) => {
    setCustomerName(customer.name || '');
    setCustomerPhone(customer.phone || '');
    setSelectedCustomerId(customer.id);
    setCustomerSearchQuery('');
    setCustomerSearchResults([]);
    setShowCustomerDropdown(false);
  }, []);

  const clearCustomerSelection = useCallback(() => {
    setSelectedCustomerId(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerSearchQuery('');
    setCustomerSearchResults([]);
    setShowCustomerDropdown(false);
  }, []);

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

  // Handle barcode or QR scan: resolve product and add to cart
  const handleScan = useCallback(async (decodedText) => {
    const text = (decodedText || '').trim();
    const looksLikeQRJson = text.startsWith('{');

    let product = null;
    try {
      if (looksLikeQRJson) {
        const result = parseProductQRPayload(text);
        if (result.success) {
          product = await resolveProductFromQRPayload(result.data);
        }
      } else if (getProductByBarcode) {
        product = await getProductByBarcode(text);
      }
      if (product) {
        setCart(prev => {
          const existing = prev.find(item => item.productId === product.id && !item.productVariantId);
          if (existing) {
            return prev.map(item =>
              item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item
            );
          }
          return [...prev, {
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
        setLastScannedItem(product.name);
      }
    } catch (err) {
      console.warn('Scan resolve error:', err);
    }
  }, [getProductByBarcode, resolveProductFromQRPayload]);

  // Handle done scanning
  const handleDoneScanning = useCallback(() => {
    if (cart.length > 0) {
      setCurrentStep(STEPS.REVIEW);
    }
  }, [cart.length]);

  // Handle proceed to payment
  const handleProceedToPayment = useCallback(() => {
    setCurrentStep(STEPS.PAYMENT);
    setAmountTendered(totals.total.toString());
  }, [totals.total]);

  // Handle payment confirmation
  const handleConfirmPayment = useCallback(async () => {
    setIsProcessing(true);

    try {
      // Use selected customer, or find/create by phone & name
      let customerId = selectedCustomerId || null;
      if (!customerId && (customerPhone || customerName)) {
        try {
          const customer = await onFindOrCreateCustomer(customerPhone || '', customerName || '');
          customerId = customer?.id;
        } catch (err) {
          console.warn('Could not create customer:', err);
        }
      }

      // Prepare sale data
      const saleData = {
        items: cart.map(item => ({
          productId: item.productId,
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: 0,
          tax: 0
        })),
        customerId,
        paymentMethod,
        amountPaid: parseFloat(amountTendered) || totals.total,
        metadata: {
          scanMode: true,
          customerPhone,
          customerName
        }
      };

      // Process sale
      const result = await onProcessSale(saleData);

      if (result.success) {
        const saleObj = result.sale || {
          id: result.localId,
          saleNumber: `SALE-${result.localId || Date.now()}`,
          total: totals.total,
          items: cart
        };

        setCompletedSale(saleObj);
        setCurrentStep(STEPS.SUCCESS);

        // Auto-send receipt via SMS if phone provided
        if (customerPhone && saleObj.id && onSendReceipt) {
          try {
            await onSendReceipt(saleObj.id, {
              channels: ['sms'],
              phone: customerPhone
            });
            setReceiptSent(true);
          } catch (receiptErr) {
            console.warn('Failed to send receipt:', receiptErr);
            // Don't fail the sale if receipt fails
          }
        }

        if (result.isQueued) {
          showSuccess('Sale saved offline. Will sync when connected.');
        } else {
          showSuccess('Sale completed!');
        }
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      showError(error.message || 'Failed to process payment');
    } finally {
      setIsProcessing(false);
    }
  }, [
    cart,
    selectedCustomerId,
    customerPhone,
    customerName,
    paymentMethod,
    amountTendered,
    totals.total,
    onFindOrCreateCustomer,
    onProcessSale,
    onSendReceipt
  ]);

  // Handle new sale
  const handleNewSale = useCallback(() => {
    setCurrentStep(STEPS.SCANNING);
    setCart([]);
    setLastScannedItem(null);
    setCustomerName('');
    setCustomerPhone('');
    setSelectedCustomerId(null);
    setCustomerSearchQuery('');
    setCustomerSearchResults([]);
    setPaymentMethod('cash');
    setAmountTendered('');
    setCompletedSale(null);
    setReceiptSent(false);
  }, []);

  // Calculate change
  const parsedAmount = parseFloat(amountTendered) || 0;
  const change = Math.max(0, parsedAmount - totals.total);
  const isPaymentValid = parsedAmount >= totals.total;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className={`flex items-center justify-between ${isMobile ? 'px-3 py-2' : 'px-4 py-3'} border-b border-gray-200 bg-white`}>
        <Button
          variant="ghost"
          size="icon"
          onClick={currentStep === STEPS.SCANNING ? onClose : () => {
            if (currentStep === STEPS.REVIEW) setCurrentStep(STEPS.SCANNING);
            else if (currentStep === STEPS.PAYMENT) setCurrentStep(STEPS.REVIEW);
          }}
          className={isMobile ? 'h-11 w-11' : 'h-10 w-10'}
        >
          {currentStep === STEPS.SCANNING ? (
            <X className={`${isMobile ? 'h-5 w-5' : 'h-5 w-5'}`} />
          ) : (
            <ArrowLeft className={`${isMobile ? 'h-5 w-5' : 'h-5 w-5'}`} />
          )}
        </Button>
        
        <h1 className={`font-semibold ${isMobile ? 'text-base' : 'text-lg'}`}>
          {currentStep === STEPS.SCANNING && 'Scan Items'}
          {currentStep === STEPS.REVIEW && 'Review Order'}
          {currentStep === STEPS.PAYMENT && 'Payment'}
          {currentStep === STEPS.SUCCESS && 'Complete'}
        </h1>

        {currentStep !== STEPS.SUCCESS && totals.itemCount > 0 && (
          <Badge className={`${isMobile ? 'text-xs px-2 py-0.5' : ''} bg-green-600 text-white`}>
            {totals.itemCount} item{totals.itemCount !== 1 ? 's' : ''}
          </Badge>
        )}
        {currentStep === STEPS.SUCCESS && <div className={isMobile ? 'w-10' : 'w-10'} />}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* SCANNING STEP */}
        {currentStep === STEPS.SCANNING && (
          <QRCodeScanner
            isOpen={true}
            onClose={onClose}
            onScan={handleScan}
            continuousMode={true}
            scannedCount={totals.itemCount}
            lastScannedItem={lastScannedItem}
            onDone={handleDoneScanning}
          />
        )}

        {/* REVIEW STEP */}
        {currentStep === STEPS.REVIEW && (
          <div className="h-full flex flex-col">
            {/* Cart Items */}
            <ScrollArea className="flex-1" style={{ paddingLeft: isMobile ? '0.75rem' : '1rem', paddingRight: isMobile ? '0.75rem' : '1rem' }}>
              <div className={isMobile ? "py-3" : "py-4"}>
                <h3 className={`font-medium text-gray-700 ${isMobile ? 'mb-2 text-sm' : 'mb-3'}`}>
                  Items ({totals.itemCount})
                </h3>
                <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-500 mb-2`}>
                  Adjust quantity below if needed.
                </p>
                {cart.map(item => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    onUpdateQuantity={updateCartItemQuantity}
                    onRemove={removeCartItem}
                  />
                ))}
              </div>

              {/* Customer Section – select or enter; SMS receipt after sale */}
              <div className={`${isMobile ? 'py-3' : 'py-4'} border-t border-gray-100`}>
                <h3 className={`font-medium text-gray-700 ${isMobile ? 'mb-2 text-sm' : 'mb-3'} flex items-center gap-2`}>
                  <User className={`${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
                  Customer
                </h3>
                <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-500 mb-2`}>
                  Select or enter customer name and phone. Receipt will be sent via SMS after sale.
                </p>

                {selectedCustomerId ? (
                  <div className={`${isMobile ? 'p-2' : 'p-3'} bg-green-50 border border-green-200 ${isMobile ? 'rounded-md' : 'rounded-lg'} flex items-center justify-between`}>
                    <div>
                      <p className={`font-medium text-gray-900 ${isMobile ? 'text-sm' : ''}`}>{customerName || 'Customer'}</p>
                      <p className={`text-gray-600 ${isMobile ? 'text-xs' : 'text-sm'}`}>{customerPhone}</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={clearCustomerSelection} className="border-gray-300">
                      Change
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="relative mb-2">
                      <Label className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600`}>Search existing customer</Label>
                      <Input
                        placeholder="Search by name or phone"
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        onFocus={() => customerSearchResults.length > 0 && setShowCustomerDropdown(true)}
                        className={`${isMobile ? 'h-11 mt-1' : 'h-11 mt-1'} border-gray-300 ${isMobile ? 'rounded-md' : 'rounded-lg'}`}
                      />
                      {customerSearching && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 mt-1">
                          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        </div>
                      )}
                      {showCustomerDropdown && customerSearchResults.length > 0 && (
                        <ul className="absolute z-10 w-full mt-1 border border-gray-200 bg-white rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {customerSearchResults.map((c) => (
                            <li key={c.id}>
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex flex-col"
                                onClick={() => selectCustomer(c)}
                              >
                                <span className="font-medium text-gray-900">{c.name || 'No name'}</span>
                                {c.phone && <span className="text-gray-500 text-xs">{c.phone}</span>}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600 mb-1`}>Or enter new</p>
                    <div className={isMobile ? 'space-y-2' : 'space-y-3'}>
                      <div>
                        <Label className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600`}>Name</Label>
                        <Input
                          placeholder="Customer name"
                          value={customerName}
                          onChange={(e) => { setCustomerName(e.target.value); setSelectedCustomerId(null); }}
                          className={`${isMobile ? 'h-11 mt-1' : 'h-11 mt-1'} border-gray-300 ${isMobile ? 'rounded-md' : 'rounded-lg'}`}
                        />
                      </div>
                      <div>
                        <Label className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600`}>Phone Number</Label>
                        <div className="relative mt-1">
                          <Phone className={`absolute left-3 top-1/2 -translate-y-1/2 ${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-gray-400`} />
                          <Input
                            type="tel"
                            placeholder="0XX XXX XXXX"
                            value={customerPhone}
                            onChange={(e) => { setCustomerPhone(e.target.value); setSelectedCustomerId(null); }}
                            className={`${isMobile ? 'h-11 pl-9' : 'h-11 pl-10'} border-gray-300 ${isMobile ? 'rounded-md' : 'rounded-lg'}`}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Enter phone to send receipt via SMS after sale
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>

            {/* Bottom Checkout Section */}
            <div className={`${isMobile ? 'p-3' : 'p-4'} bg-gray-50 border-t border-gray-200`}>
              <div className={`flex justify-between items-center ${isMobile ? 'mb-3' : 'mb-4'}`}>
                <span className={`${isMobile ? 'text-sm' : ''} text-gray-600`}>Total</span>
                <span className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-green-700`}>
                  {formatCurrency(totals.total)}
                </span>
              </div>
              
              <Button
                className={`w-full ${isMobile ? 'h-12 text-base' : 'h-14 text-lg'} font-semibold bg-[#166534] hover:bg-[#14532d] ${isMobile ? 'rounded-md' : 'rounded-lg'}`}
                onClick={handleProceedToPayment}
              >
                Continue to Payment
              </Button>
            </div>
          </div>
        )}

        {/* PAYMENT STEP */}
        {currentStep === STEPS.PAYMENT && (
          <div className="h-full flex flex-col">
            <ScrollArea className="flex-1" style={{ paddingLeft: isMobile ? '0.75rem' : '1rem', paddingRight: isMobile ? '0.75rem' : '1rem' }}>
              <div className={`${isMobile ? 'py-3 space-y-4' : 'py-4 space-y-6'}`}>
                {/* Amount to Pay */}
                <div className={`text-center ${isMobile ? 'p-3' : 'p-4'} bg-gray-50 ${isMobile ? 'rounded-md' : 'rounded-lg'}`}>
                  <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600`}>Amount to Pay</p>
                  <p className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-green-700`}>
                    {formatCurrency(totals.total)}
                  </p>
                </div>

                {/* Payment Method Selection */}
                <div>
                  <Label className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600 ${isMobile ? 'mb-1.5' : 'mb-2'} block`}>Payment Method</Label>
                  <div className={`grid grid-cols-3 ${isMobile ? 'gap-1.5' : 'gap-2'}`}>
                    {PAYMENT_METHODS.map(method => (
                      <Button
                        key={method.id}
                        variant={paymentMethod === method.id ? 'default' : 'outline'}
                        className={`${isMobile ? 'h-12' : 'h-14'} flex-col gap-1 border-gray-300 ${
                          paymentMethod === method.id ? 'bg-[#166534] hover:bg-[#14532d]' : ''
                        } ${isMobile ? 'rounded-md' : 'rounded-lg'}`}
                        onClick={() => setPaymentMethod(method.id)}
                      >
                        <method.icon className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                        <span className={`${isMobile ? 'text-xs' : 'text-xs'}`}>{method.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Amount Tendered (for cash) */}
                {paymentMethod === 'cash' && (
                  <div>
                    <Label className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600 ${isMobile ? 'mb-1.5' : 'mb-2'} block`}>Amount Received</Label>
                    <div className={`text-center ${isMobile ? 'p-2' : 'p-3'} bg-white border border-gray-300 ${isMobile ? 'rounded-md mb-2' : 'rounded-lg mb-3'}`}>
                      <span className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>
                        {CURRENCY.SYMBOL} {amountTendered || '0'}
                      </span>
                    </div>
                    <POSNumpad
                      value={amountTendered}
                      onChange={setAmountTendered}
                      allowDecimal={true}
                      maxLength={10}
                    />
                    
                    {/* Change Display */}
                    {parsedAmount > 0 && (
                      <div className={`${isMobile ? 'mt-3 p-3' : 'mt-4 p-4'} ${isPaymentValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'} ${isMobile ? 'rounded-md' : 'rounded-lg'}`}>
                        <div className="flex justify-between items-center">
                          <span className={`${isMobile ? 'text-xs' : 'text-sm'} ${isPaymentValid ? 'text-green-700' : 'text-red-700'}`}>
                            {isPaymentValid ? 'Change to Give' : 'Amount Short'}
                          </span>
                          <span className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold ${isPaymentValid ? 'text-green-700' : 'text-red-700'}`}>
                            {isPaymentValid 
                              ? formatCurrency(change)
                              : formatCurrency(totals.total - parsedAmount)
                            }
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Mobile Money / Card - simple confirmation */}
                {paymentMethod !== 'cash' && (
                  <div className={`${isMobile ? 'p-3' : 'p-4'} bg-blue-50 border border-blue-200 ${isMobile ? 'rounded-md' : 'rounded-lg'} text-center`}>
                    <Smartphone className={`${isMobile ? 'h-8 w-8' : 'h-10 w-10'} text-blue-500 mx-auto mb-2`} />
                    <p className={`${isMobile ? 'text-sm' : 'text-base'} text-blue-700 font-medium`}>
                      {paymentMethod === 'mobile_money' 
                        ? 'Process mobile money payment' 
                        : 'Process card payment'
                      }
                    </p>
                    <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-blue-600 mt-1`}>
                      Click confirm once payment is received
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Confirm Payment Button */}
            <div className={`${isMobile ? 'p-3' : 'p-4'} bg-gray-50 border-t border-gray-200`}>
              <Button
                className={`w-full ${isMobile ? 'h-12 text-base' : 'h-14 text-lg'} font-semibold bg-[#166534] hover:bg-[#14532d] ${isMobile ? 'rounded-md' : 'rounded-lg'}`}
                disabled={paymentMethod === 'cash' && !isPaymentValid}
                loading={isProcessing}
                onClick={handleConfirmPayment}
              >
                <>
                  <Check className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} mr-2`} />
                  {isMobile ? `Complete - ${formatCurrency(totals.total)}` : `Complete Sale - ${formatCurrency(totals.total)}`}
                </>
              </Button>
            </div>
          </div>
        )}

        {/* SUCCESS STEP */}
        {currentStep === STEPS.SUCCESS && (
          <div className={`h-full flex flex-col items-center justify-center ${isMobile ? 'px-4' : 'px-6'}`}>
            <div className={`${isMobile ? 'w-16 h-16' : 'w-20 h-20'} bg-green-100 ${isMobile ? 'rounded-full' : 'rounded-full'} flex items-center justify-center ${isMobile ? 'mb-4' : 'mb-6'}`}>
              <CheckCircle className={`${isMobile ? 'h-10 w-10' : 'h-12 w-12'} text-green-600`} />
            </div>
            
            <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 ${isMobile ? 'mb-1' : 'mb-2'}`}>Sale Complete!</h2>
            
            {completedSale && (
              <p className={`${isMobile ? 'text-sm' : ''} text-gray-600 ${isMobile ? 'mb-1' : 'mb-2'}`}>
                Sale #{completedSale.saleNumber}
              </p>
            )}
            
            <p className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-green-700 ${isMobile ? 'mb-4' : 'mb-6'}`}>
              {formatCurrency(totals.total)}
            </p>

            {/* Receipt / SMS Status */}
            {customerPhone && (
              <div className={`${isMobile ? 'p-3' : 'p-4'} border ${isMobile ? 'rounded-md mb-4' : 'rounded-lg mb-6'} w-full max-w-sm ${
                receiptSent ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
              }`}>
                {receiptSent ? (
                  <div className={`flex items-center justify-center gap-2 ${isMobile ? 'text-sm' : ''} text-green-700`}>
                    <Check className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                    <span>Receipt sent via SMS to {customerPhone}</span>
                  </div>
                ) : (
                  <div className={`flex items-center justify-center gap-2 ${isMobile ? 'text-sm' : ''} text-gray-600`}>
                    <Loader2 className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} animate-spin`} />
                    <span>Sending receipt via SMS...</span>
                  </div>
                )}
              </div>
            )}
            {!customerPhone && (
              <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-500 mb-2`}>
                Add customer phone next time to receive receipt via SMS
              </p>
            )}

            {change > 0 && paymentMethod === 'cash' && (
              <div className={`${isMobile ? 'p-3' : 'p-4'} bg-orange-50 border border-orange-200 ${isMobile ? 'rounded-md mb-4' : 'rounded-lg mb-6'} w-full max-w-sm`}>
                <div className={`flex justify-between items-center ${isMobile ? 'text-sm' : ''} text-orange-700`}>
                  <span>Change to Give</span>
                  <span className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold`}>{formatCurrency(change)}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className={`flex ${isMobile ? 'gap-2' : 'gap-3'} w-full max-w-sm`}>
              <Button
                variant="outline"
                className={`flex-1 ${isMobile ? 'h-11' : 'h-12'} border-gray-300 ${isMobile ? 'rounded-md' : 'rounded-lg'}`}
                onClick={onClose}
              >
                View Sales
              </Button>
              <Button
                className={`flex-1 ${isMobile ? 'h-11' : 'h-12'} bg-[#166534] hover:bg-[#14532d] ${isMobile ? 'rounded-md' : 'rounded-lg'}`}
                onClick={handleNewSale}
              >
                New Sale
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default POSScanMode;
