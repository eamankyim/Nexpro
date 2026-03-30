/**
 * POSPaymentModal Component
 * 
 * Payment processing modal with support for:
 * - Cash payments with change calculation
 * - MTN MoMo
 * - AirtelTigo Cash
 * - Telecel Cash
 * - Card payments
 * - Credit (invoice generation)
 * 
 * Optimized for African context with mobile money as primary payment method.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  Banknote, 
  Smartphone, 
  CreditCard, 
  FileText, 
  Check, 
  Copy,
  Loader2,
  AlertCircle,
  RefreshCw,
  User,
  UserPlus,
  ChefHat,
  Lock,
  Unlock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import POSNumpad from './POSNumpad';
import { CURRENCY } from '../../constants';
import { showSuccess, showError } from '../../utils/toast';
import { useResponsive } from '../../hooks/useResponsive';
import mobileMoneyService from '../../services/mobileMoneyService';

/**
 * Format currency value (handles string/number/object from API or form state)
 */
const formatCurrency = (amount) => {
  const num = typeof amount === 'number' && Number.isFinite(amount) ? amount : Number(amount);
  const value = Number.isFinite(num) ? num : 0;
  const decimals = typeof CURRENCY?.DECIMAL_PLACES === 'number' ? CURRENCY.DECIMAL_PLACES : 2;
  return `${CURRENCY?.SYMBOL ?? '₵'} ${value.toFixed(decimals)}`;
};

/**
 * Generate a random reference number
 */
const generateReference = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REF-${timestamp}-${random}`;
};

/**
 * Mobile Money provider logos/colors
 */
const MOBILE_MONEY_PROVIDERS = {
  mtn: {
    name: 'MTN Mobile Money',
    shortName: 'MTN MoMo',
    color: 'bg-yellow-400',
    textColor: 'text-yellow-900',
    borderColor: 'border-yellow-500',
    prefix: '+233' // Ghana
  },
  vodafone: {
    name: 'Vodafone Cash',
    shortName: 'Vodafone',
    color: 'bg-red-600',
    textColor: 'text-white',
    borderColor: 'border-red-700',
    prefix: '+233'
  },
  airtel: {
    name: 'AirtelTigo Cash',
    shortName: 'AirtelTigo',
    color: 'bg-red-500',
    textColor: 'text-white',
    borderColor: 'border-red-600',
    prefix: '+233'
  }
};

/**
 * Cash payment tab
 */
const CashPayment = ({ total, items, onConfirm, isProcessing, onEditItems }) => {
  const [amountTendered, setAmountTendered] = useState('');

  const parsedAmount = parseFloat(amountTendered) || 0;
  const change = Math.max(0, parsedAmount - total);
  const isValid = parsedAmount >= total;

  // Smart quick amounts: round up to common note denominations
  // e.g. ₵ 195.45 -> 200 (one 200), 250 (200+50), 300 (200+100), 500 (500 note)
  // Avoids arbitrary +10, +20 (why hand 200+10 when 200 suffices?)
  const quickAmounts = useMemo(() => {
    const denoms = [5, 10, 20, 50, 100, 200, 500];
    const amounts = new Set();
    denoms.forEach((d) => {
      const rounded = Math.ceil(total / d) * d;
      if (rounded >= total) amounts.add(rounded);
    });
    let sorted = [...amounts].sort((a, b) => a - b);
    const min = sorted[0] || Math.ceil(total / 10) * 10;
    // Fill to 4 with sensible note combinations (min+50, min+100, etc.)
    if (sorted.length < 4) {
      [50, 100, 200, 500].forEach((add) => {
        const next = min + add;
        if (next >= total) amounts.add(next);
      });
      sorted = [...amounts].sort((a, b) => a - b);
    }
    return sorted.slice(0, 4);
  }, [total]);

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-4 pb-24 sm:pb-6">
        {/* Cart preview */}
        {Array.isArray(items) && items.length > 0 && (
          <div className="p-3 rounded-lg border border-border bg-muted/60">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">
                Items in this sale
              </p>
              {onEditItems && (
                <button
                  type="button"
                  className="text-xs font-medium text-green-700 hover:text-green-800 underline-offset-2 hover:underline"
                  onClick={onEditItems}
                >
                  Edit items
                </button>
              )}
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between text-xs text-foreground"
                >
                  <span className="truncate max-w-[65%]">
                    {item.name || 'Item'}{' '}
                    <span className="text-muted-foreground">
                      × {Number(item.quantity) || 0}
                    </span>
                  </span>
                  <span className="font-medium">
                    {formatCurrency(
                      (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0) -
                        (Number(item.discount) || 0)
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Amount display */}
        <div className="text-center p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">Amount to Pay</p>
          <p className="text-3xl font-bold text-green-700">{formatCurrency(total)}</p>
        </div>

        {/* Quick amount buttons */}
        <div className="grid grid-cols-4 gap-2">
          {quickAmounts.map((amount) => (
            <Button
              key={amount}
              variant={parsedAmount === amount ? 'default' : 'outline'}
              className={parsedAmount === amount ? 'bg-green-700' : ''}
              onClick={() => setAmountTendered(amount.toString())}
            >
              {formatCurrency(amount)}
            </Button>
          ))}
        </div>

        {/* Amount input */}
        <div>
          <Label>Amount Tendered</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0"
            className="text-center text-2xl font-bold h-12 mt-2"
            value={amountTendered}
            onChange={(e) => setAmountTendered(e.target.value)}
          />
        </div>

        {/* Change display */}
        {parsedAmount > 0 && (
          <div className={`p-4 rounded-lg ${isValid ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex justify-between items-center">
              <span className={isValid ? 'text-green-700' : 'text-red-700'}>
                {isValid ? 'Change to Give' : 'Amount Short'}
              </span>
              <span className={`text-2xl font-bold ${isValid ? 'text-green-700' : 'text-red-700'}`}>
                {isValid 
                  ? formatCurrency(change)
                  : formatCurrency(total - parsedAmount)
                }
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Confirm button - floating at bottom on mobile */}
      <div className="mt-auto sticky bottom-0 left-0 right-0 -mx-1 px-1 pb-2 pt-2 bg-background border-t border-border sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:pt-4 sm:pb-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="w-full h-14 text-lg bg-green-700 hover:bg-green-800"
              disabled={!isValid}
              loading={isProcessing}
              onClick={() => onConfirm({
                paymentMethod: 'cash',
                amountPaid: parsedAmount,
                change
              })}
            >
              <>
                <Check className="h-5 w-5 mr-2" />
                Complete Sale
              </>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Confirm payment received</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

/**
 * Mobile Money payment tab
 * When in manual fallback (offline or Paystack unavailable), primary action is "Record payment".
 */
const MobileMoneyPayment = ({
  total,
  customer,
  onRequestMobileMoney,
  onConfirm,
  isProcessing,
  mobileMoneyState = 'idle',
  mobileMoneyError = '',
  mobileMoneyFallbackMode = null
}) => {
  const [provider, setProvider] = useState('mtn');
  const [phone, setPhone] = useState(customer?.phone || '');

  // Auto-detect provider from phone number (client-side, no API call)
  useEffect(() => {
    const trimmed = phone.trim();
    if (trimmed.length < 10) return;
    const detected = mobileMoneyService.detectProviderLocal(trimmed);
    if (detected === 'MTN') setProvider('mtn');
    else if (detected === 'AIRTEL') setProvider('airtel');
    else if (detected === 'VODAFONE') setProvider('vodafone');
  }, [phone]);

  // Basic validation
  const isPhoneValid = phone.trim().length >= 10;
  const isWaiting = mobileMoneyState === 'initiating' || mobileMoneyState === 'waiting';
  const isSuccess = mobileMoneyState === 'success';
  const isFallbackManual = mobileMoneyFallbackMode === 'manual';

  const logicalProvider =
    provider === 'mtn' ? 'MTN' : provider === 'airtel' ? 'AIRTEL' : 'VODAFONE';

  const handleRequest = () => {
    if (!onRequestMobileMoney) return;
    onRequestMobileMoney({ phone: phone.trim(), provider: logicalProvider });
  };

  const handleRecordPayment = () => {
    if (!onConfirm) return;
    onConfirm({
      paymentMethod: 'mobile_money',
      amountPaid: total,
      mobileMoneyPhone: phone.trim(),
      mobileMoneyProvider: logicalProvider
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-4 pb-24 sm:pb-6">
        {/* Amount display */}
        <div className="text-center p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">Amount to Pay</p>
          <p className="text-3xl font-bold text-green-700">{formatCurrency(total)}</p>
        </div>

        {/* Provider selection */}
        <div>
          <Label>Select Provider</Label>
          <div className="flex gap-2 mt-2">
            {Object.entries(MOBILE_MONEY_PROVIDERS).map(([key, config]) => (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className={`
                      h-14 flex-1 justify-center
                      ${provider === key
                        ? `${config.color} ${config.textColor} border-2 ${config.borderColor}`
                        : 'bg-card'
                      }
                    `}
                    onClick={() => setProvider(key)}
                    disabled={isWaiting || isProcessing}
                  >
                    <Smartphone className="h-5 w-5 mr-2" />
                    {config.shortName}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {key === 'mtn'
                    ? 'Customer pays with MTN MoMo'
                    : key === 'vodafone'
                      ? 'Vodafone Cash (automated collection coming soon)'
                      : 'Customer pays with AirtelTigo Money'}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Phone number: required for automated request; hidden in manual/offline mode */}
        {!isFallbackManual && (
          <div>
            <Label>Customer MoMo number</Label>
            <Input
              type="tel"
              placeholder="0XX XXX XXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-12 text-lg mt-2"
            />
          </div>
        )}

        {/* Automatic MoMo info or manual fallback */}
        {!isFallbackManual ? (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4 space-y-2">
              <h4 className="font-medium text-green-800">Request Mobile Money Payment</h4>
              <p className="text-sm text-green-700">
                Customer will receive a mobile money prompt on their phone to approve this
                payment. You&apos;ll see the result here automatically.
              </p>
              {mobileMoneyState !== 'idle' && (
                <div className="text-sm">
                  {mobileMoneyState === 'initiating' && (
                    <span className="text-green-700">Requesting payment…</span>
                  )}
                  {mobileMoneyState === 'waiting' && (
                    <span className="text-green-700">
                      Waiting for customer to approve on their phone…
                    </span>
                  )}
                  {isSuccess && (
                    <span className="text-green-700 font-medium">
                      Payment received. Completing sale…
                    </span>
                  )}
                  {mobileMoneyState === 'failed' && mobileMoneyError && (
                    <span className="text-red-600">{mobileMoneyError}</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="p-4">
                <h4 className="font-medium text-yellow-800 mb-2">Manual MoMo Instructions</h4>
                <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
                  <li>Customer dials *{provider === 'mtn' ? '170' : '110'}#</li>
                  <li>Select &quot;Send Money&quot; or &quot;Pay Bill&quot;</li>
                  <li>Enter amount: {formatCurrency(total)}</li>
                  <li>Confirm payment on their phone</li>
                </ol>
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground">After the customer has paid, confirm below to record the sale.</p>
            <Button
              className="w-full h-12 text-base bg-green-700 hover:bg-green-800"
              disabled={isProcessing}
              loading={isProcessing}
              onClick={handleRecordPayment}
            >
              <Check className="h-5 w-5 mr-2" />
              Confirm payment received
            </Button>
            {mobileMoneyError && (
              <p className="text-xs text-red-600">{mobileMoneyError}</p>
            )}
          </>
        )}
      </div>

      {/* Primary button: only for automated flow; manual mode uses "Confirm payment received" above */}
      {!isFallbackManual && (
        <div className="mt-auto sticky bottom-0 left-0 right-0 -mx-1 px-1 pb-2 pt-2 bg-background border-t border-border sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:pt-4 sm:pb-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="w-full h-14 text-lg bg-green-700 hover:bg-green-800"
                disabled={!isPhoneValid || isWaiting || isProcessing}
                loading={isProcessing || isWaiting}
                onClick={handleRequest}
              >
                <>
                  <Smartphone className="h-5 w-5 mr-2" />
                  {isWaiting ? 'Waiting for Approval…' : 'Request MoMo Payment'}
                </>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Send a mobile money payment request to the customer
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
};

/**
 * Card payment tab
 */
const CardPayment = ({ total, onConfirm, isProcessing }) => {
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-4 pb-24 sm:pb-6">
      {/* Amount display */}
      <div className="text-center p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">Amount to Pay</p>
        <p className="text-3xl font-bold text-green-700">{formatCurrency(total)}</p>
      </div>

      {/* Card payment instructions */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-6 text-center">
          <CreditCard className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h4 className="font-medium text-green-800 mb-2">Process Card Payment</h4>
          <p className="text-sm text-green-700">
            Use your card terminal to process this payment.
            Click confirm once the transaction is approved.
          </p>
        </CardContent>
      </Card>

      {/* Confirm payment */}
      <div 
        className={`
          p-4 rounded-lg border-2 cursor-pointer transition-all
          ${paymentConfirmed 
            ? 'bg-green-50 border-green-500' 
            : 'bg-muted border-border hover:border-green-400'
          }
        `}
        onClick={() => setPaymentConfirmed(!paymentConfirmed)}
      >
        <div className="flex items-center gap-3">
          <div className={`
            w-6 h-6 rounded-full border-2 flex items-center justify-center
            ${paymentConfirmed ? 'bg-green-500 border-green-500' : 'border-border'}
          `}>
            {paymentConfirmed && <Check className="h-4 w-4 text-white" />}
          </div>
          <span className={paymentConfirmed ? 'text-green-700 font-medium' : 'text-foreground'}>
            Card payment approved
          </span>
        </div>
      </div>

      </div>

      {/* Complete button - floating at bottom on mobile */}
      <div className="mt-auto sticky bottom-0 left-0 right-0 -mx-1 px-1 pb-2 pt-2 bg-background border-t border-border sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:pt-4 sm:pb-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="w-full h-14 text-lg bg-green-700 hover:bg-green-800"
              disabled={!paymentConfirmed}
              loading={isProcessing}
              onClick={() => onConfirm({
                paymentMethod: 'card',
                amountPaid: total
              })}
            >
              <>
                <Check className="h-5 w-5 mr-2" />
                Complete Sale
              </>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Confirm payment received</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

/**
 * Credit payment tab
 */
const CreditPayment = ({ total, customer, onConfirm, isProcessing }) => {
  const hasCustomer = !!customer;
  const totalNum = Number(total);
  const totalSafe = Number.isFinite(totalNum) ? totalNum : 0;
  const creditLimit = Number(customer?.creditLimit);
  const balance = Number(customer?.balance);
  const hasLimit = Number.isFinite(creditLimit) && creditLimit > 0;
  const creditAvailable = hasLimit ? (creditLimit - (Number.isFinite(balance) ? balance : 0)) : null;
  // No limit enforced: any customer can use credit (pay later). Limit is optional for those who use it.
  const canUseCredit = hasCustomer;

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-4 pb-24 sm:pb-6">
      {/* Amount display */}
      <div className="text-center p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">Amount to Credit</p>
        <p className="text-3xl font-bold text-green-700">{formatCurrency(totalSafe)}</p>
      </div>

      {!hasCustomer ? (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h4 className="font-medium text-yellow-800 mb-2">Customer Required</h4>
            <p className="text-sm text-yellow-600">
              Please select a customer to use credit payment.
              Go back and add a customer to the sale.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Customer info */}
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{customer.name}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground">Current Balance</span>
                <span className="font-medium text-orange-600">
                  {formatCurrency(Number.isFinite(balance) ? balance : 0)}
                </span>
              </div>
              {hasLimit && (
                <>
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground">Credit Limit</span>
                    <span className="font-medium">{formatCurrency(creditLimit)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Available Credit</span>
                    <span className="font-bold text-green-600">
                      {formatCurrency(creditAvailable)}
                    </span>
                  </div>
                </>
              )}
              {!hasLimit && (
                <>
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Credit</span>
                    <span className="font-medium text-green-600">Unlimited (pay later)</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Invoice notice */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-800">Invoice Will Be Generated</h4>
                  <p className="text-sm text-blue-600 mt-1">
                    An invoice will be automatically created for this credit sale
                    and added to the customer's balance.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      </div>

      {/* Complete button - floating at bottom on mobile */}
      <div className="mt-auto sticky bottom-0 left-0 right-0 -mx-1 px-1 pb-2 pt-2 bg-background border-t border-border sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:pt-4 sm:pb-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="w-full h-14 text-lg bg-green-700 hover:bg-green-800"
              disabled={!canUseCredit}
              loading={isProcessing}
              onClick={() => onConfirm({
                paymentMethod: 'credit',
                amountPaid: 0
              })}
            >
              <>
                <FileText className="h-5 w-5 mr-2" />
                Create Credit Sale
              </>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Confirm payment received</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

/**
 * Main POSPaymentModal component
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {function} props.onClose - Called to close the modal
 * @param {number} props.total - Total amount to pay
 * @param {Object} [props.taxSummary] - Optional { subtotal, discount, taxAmount, taxLabel } for breakdown
 * @param {Array} props.items - Cart items
 * @param {Object} [props.customer] - Selected customer
 * @param {Array<Object>} [props.customers] - List of existing customers for dropdown search
 * @param {function} [props.onRequestChangeCustomer] - Called when user wants to change customer (open full modal)
 * @param {function} [props.onSelectExistingCustomer] - Called when user selects an existing customer from dropdown
 * @param {function} props.onConfirmPayment - Called when payment is confirmed
 * @param {function} [props.onRequestMobileMoney] - Called to start Mobile Money payment flow
 * @param {string} [props.mobileMoneyState] - Mobile Money state: idle | initiating | waiting | success | failed
 * @param {string} [props.mobileMoneyError] - Latest Mobile Money error message
 * @param {string|null} [props.mobileMoneyFallbackMode] - null or 'manual' for manual MoMo flow
 * @param {boolean} props.isProcessing - Whether payment is being processed
 * @param {boolean} [props.isRestaurant] - If true, show Send to kitchen option
 * @param {boolean} [props.stayOpenAfterSale] - When true, modal stays open after each sale
 * @param {function} [props.onStayOpenAfterSaleChange] - Called when stay-open toggle changes
 */
const POSPaymentModal = ({
  isOpen,
  onClose,
  total,
  taxSummary = null,
  items,
  customer,
  onRequestChangeCustomer,
  onClearCustomer,
  customers = [],
  onSelectExistingCustomer,
  onConfirmPayment,
  onRequestMobileMoney,
  mobileMoneyState = 'idle',
  mobileMoneyError = '',
  mobileMoneyFallbackMode = null,
  isProcessing = false,
  isRestaurant = false,
  stayOpenAfterSale = false,
  onStayOpenAfterSaleChange
}) => {
  const [activeTab, setActiveTab] = useState('cash');
  const [sendToKitchen, setSendToKitchen] = useState(true);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const { isMobile } = useResponsive();

  const filteredCustomers = useMemo(() => {
    if (!Array.isArray(customers) || customers.length === 0) return [];
    const term = customerSearchTerm.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((c) => {
      const name = (c.name || '').toString().toLowerCase();
      const company = (c.company || '').toString().toLowerCase();
      const phone = (c.phone || '').toString().toLowerCase();
      const email = (c.email || '').toString().toLowerCase();
      return (
        name.includes(term) ||
        company.includes(term) ||
        phone.includes(term) ||
        email.includes(term)
      );
    });
  }, [customers, customerSearchTerm]);

  const handleConfirm = useCallback((details) => {
    onConfirmPayment({ ...details, sendToKitchen });
  }, [onConfirmPayment, sendToKitchen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:w-[var(--modal-w-md)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)] w-full max-w-none h-[100dvh] sm:h-auto m-0 sm:m-auto flex flex-col rounded-none border-0 top-0 left-0 translate-x-0 translate-y-0 sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              Payment
              <Badge variant="outline" className="ml-1 sm:ml-2 text-xs sm:text-sm py-1 px-2">
                {formatCurrency(total)}
              </Badge>
            </DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            Choose payment method and complete payment for {formatCurrency(total)}.
          </DialogDescription>
        </DialogHeader>

        {taxSummary && (Number(taxSummary.taxAmount) > 0 || Number(taxSummary.discount) > 0) && (
          <div className="px-4 sm:px-6 text-sm text-muted-foreground space-y-1 border-b border-border pb-3 -mt-1">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(taxSummary.subtotal)}</span>
            </div>
            {Number(taxSummary.discount) > 0 && (
              <div className="flex justify-between">
                <span>Discounts</span>
                <span>-{formatCurrency(taxSummary.discount)}</span>
              </div>
            )}
            {Number(taxSummary.taxAmount) > 0 && (
              <div className="flex justify-between">
                <span>{taxSummary.taxLabel || 'Tax'}</span>
                <span>{formatCurrency(taxSummary.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium text-foreground pt-1 border-t border-border">
              <span>Due</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        )}

        <DialogBody className="flex-1 min-h-0 overflow-y-auto">
        {onRequestChangeCustomer && (
          isMobile ? (
            <div className="mb-4">
              <Label className="text-xs text-muted-foreground">Customer</Label>
              <Select
                value={customer?.id ? String(customer.id) : '__walk_in__'}
                onValueChange={(value) => {
                  if (value === '__walk_in__') {
                    onClearCustomer?.();
                    return;
                  }
                  if (value === '__new__') {
                    onRequestChangeCustomer();
                    return;
                  }
                  const existing =
                    Array.isArray(customers) && customers.find((c) => String(c.id) === value);
                  if (existing && onSelectExistingCustomer) {
                    onSelectExistingCustomer(existing);
                  }
                }}
              >
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Search or select customer" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1.5">
                    <Input
                      placeholder="Search customers…"
                      value={customerSearchTerm}
                      onChange={(e) => setCustomerSearchTerm(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <SelectItem value="__walk_in__">Walk-in</SelectItem>
                  {filteredCustomers.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name || c.company || c.phone || 'Customer'}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__">Add new customer…</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 mb-4 rounded-lg border border-border bg-muted">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Customer:</span>
                <span className="font-medium">
                  {customer?.name || customer?.company || 'Walk-in'}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onRequestChangeCustomer}
                className="w-full sm:w-auto"
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Change
              </Button>
            </div>
          )
        )}
        {isRestaurant && (
          <div className="flex items-center justify-between p-3 mb-4 rounded-lg border border-border bg-muted/50">
            <div className="flex items-center gap-2 flex-1">
              <ChefHat className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="send-to-kitchen" className="text-sm font-medium cursor-pointer">
                  Send to kitchen
                </Label>
                <p className="text-xs text-muted-foreground">
                  {sendToKitchen ? 'Order will appear in kitchen' : 'Skip kitchen (e.g. water only)'}
                </p>
              </div>
            </div>
            <Switch
              id="send-to-kitchen"
              checked={sendToKitchen}
              onCheckedChange={setSendToKitchen}
            />
          </div>
        )}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {isMobile ? (
            <div className="mb-3">
              <Label className="text-xs text-muted-foreground">Payment method</Label>
              <Select
                value={activeTab}
                onValueChange={setActiveTab}
              >
                <SelectTrigger className="w-full mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mobile">Mobile Money</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <TabsList className="w-full mb-3 h-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value="cash"
                    className="flex flex-1 flex-col items-center justify-center gap-1 h-14 text-xs sm:text-sm"
                  >
                    <Banknote className="h-4 w-4" />
                    <span>Cash</span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>Customer paid with cash</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value="mobile"
                    className="flex flex-1 flex-col items-center justify-center gap-1 h-14 text-xs sm:text-sm"
                  >
                    <Smartphone className="h-4 w-4" />
                    <span>Mobile Money</span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>Customer paid with MTN MoMo, AirtelTigo Money, or Vodafone Cash</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value="card"
                    className="flex flex-1 flex-col items-center justify-center gap-1 h-14 text-xs sm:text-sm"
                  >
                    <CreditCard className="h-4 w-4" />
                    <span>Card</span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>Customer paid with card</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value="credit"
                    className="flex flex-1 flex-col items-center justify-center gap-1 h-14 text-xs sm:text-sm"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Credit</span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>Sell now, collect money later</TooltipContent>
              </Tooltip>
            </TabsList>
          )}

          <div className="mt-4">
            <TabsContent value="cash" className="m-0">
              <CashPayment
                total={total}
                items={items}
                onConfirm={handleConfirm}
                isProcessing={isProcessing}
                onEditItems={() => onClose(false)}
              />
            </TabsContent>

            <TabsContent value="mobile" className="m-0">
              <MobileMoneyPayment
                total={total}
                customer={customer}
                onRequestMobileMoney={onRequestMobileMoney}
                onConfirm={handleConfirm}
                isProcessing={isProcessing}
                mobileMoneyState={mobileMoneyState}
                mobileMoneyError={mobileMoneyError}
                mobileMoneyFallbackMode={mobileMoneyFallbackMode}
              />
            </TabsContent>

            <TabsContent value="card" className="m-0">
              <CardPayment
                total={total}
                onConfirm={handleConfirm}
                isProcessing={isProcessing}
              />
            </TabsContent>

            <TabsContent value="credit" className="m-0">
              <CreditPayment
                total={total}
                customer={customer}
                onConfirm={handleConfirm}
                isProcessing={isProcessing}
              />
            </TabsContent>
          </div>
        </Tabs>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export default POSPaymentModal;
