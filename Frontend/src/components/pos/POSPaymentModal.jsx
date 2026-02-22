/**
 * POSPaymentModal Component
 * 
 * Payment processing modal with support for:
 * - Cash payments with change calculation
 * - MTN Mobile Money
 * - Airtel Money
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
  telecel: {
    name: 'Telecel Cash',
    shortName: 'Telecel',
    color: 'bg-red-600',
    textColor: 'text-white',
    borderColor: 'border-red-700',
    prefix: '+233'
  },
  airtel: {
    name: 'Airtel Money',
    shortName: 'Airtel',
    color: 'bg-red-500',
    textColor: 'text-white',
    borderColor: 'border-red-600',
    prefix: '+233'
  }
};

/**
 * Cash payment tab
 */
const CashPayment = ({ total, onConfirm, isProcessing }) => {
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
    <div className="space-y-4">
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

      {/* Amount input - type or use numpad */}
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

      {/* Numpad */}
      <POSNumpad
        value={amountTendered}
        onChange={setAmountTendered}
        allowDecimal={true}
        maxLength={10}
      />

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

      {/* Confirm button */}
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
  );
};

/**
 * Mobile Money payment tab
 */
const MobileMoneyPayment = ({ total, customer, onConfirm, isProcessing }) => {
  const [provider, setProvider] = useState('mtn');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [reference, setReference] = useState('');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  // Generate reference on mount
  useEffect(() => {
    setReference(generateReference());
  }, []);

  const providerConfig = MOBILE_MONEY_PROVIDERS[provider];
  const isPhoneValid = phone.length >= 10;

  const handleCopyReference = useCallback(() => {
    navigator.clipboard.writeText(reference);
    showSuccess('Reference copied to clipboard');
  }, [reference]);

  const handleRegenerateReference = useCallback(() => {
    setReference(generateReference());
    setPaymentConfirmed(false);
  }, []);

  return (
    <div className="space-y-4">
      {/* Amount display */}
      <div className="text-center p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">Amount to Pay</p>
        <p className="text-3xl font-bold text-green-700">{formatCurrency(total)}</p>
      </div>

      {/* Provider selection */}
      <div>
        <Label>Select Provider</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {Object.entries(MOBILE_MONEY_PROVIDERS).map(([key, config]) => (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className={`
                    h-14 justify-center
                    ${provider === key 
                      ? `${config.color} ${config.textColor} border-2 ${config.borderColor}` 
                      : 'bg-card'
                    }
                  `}
                  onClick={() => setProvider(key)}
                >
                  <Smartphone className="h-5 w-5 mr-2" />
                  {config.shortName}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {key === 'mtn' ? 'Customer paid with MTN Mobile Money' : 'Customer paid with Airtel Money'}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Phone number */}
      <div>
        <Label>Customer Phone Number</Label>
        <Input
          type="tel"
          placeholder="0XX XXX XXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="h-12 text-lg mt-2"
        />
      </div>

      {/* Reference number */}
      <div className="p-4 bg-blue-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-blue-700">Payment Reference</Label>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleCopyReference}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRegenerateReference}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-2xl font-mono font-bold text-blue-900 text-center">
          {reference}
        </p>
        <p className="text-xs text-blue-600 mt-2 text-center">
          Ask customer to use this reference when sending payment
        </p>
      </div>

      {/* Payment instructions */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-4">
          <h4 className="font-medium text-yellow-800 mb-2">Payment Instructions</h4>
          <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
            <li>Customer dials *{provider === 'mtn' ? '170' : '100'}#</li>
            <li>Select "Send Money" or "Pay Bill"</li>
            <li>Enter amount: {formatCurrency(total)}</li>
            <li>Enter reference: {reference}</li>
            <li>Confirm payment</li>
          </ol>
        </CardContent>
      </Card>

      {/* Confirm payment received */}
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
            I confirm payment has been received
          </span>
        </div>
      </div>

      {/* Complete button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="w-full h-14 text-lg bg-green-700 hover:bg-green-800"
            disabled={!isPhoneValid || !paymentConfirmed}
            loading={isProcessing}
            onClick={() => onConfirm({
              paymentMethod: 'mobile_money',
              amountPaid: total,
              mobileMoneyProvider: provider,
              mobileMoneyPhone: phone,
              mobileMoneyReference: reference
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
  );
};

/**
 * Card payment tab
 */
const CardPayment = ({ total, onConfirm, isProcessing }) => {
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  return (
    <div className="space-y-4">
      {/* Amount display */}
      <div className="text-center p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">Amount to Pay</p>
        <p className="text-3xl font-bold text-green-700">{formatCurrency(total)}</p>
      </div>

      {/* Card payment instructions */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-6 text-center">
          <CreditCard className="h-16 w-16 text-blue-500 mx-auto mb-4" />
          <h4 className="font-medium text-blue-800 mb-2">Process Card Payment</h4>
          <p className="text-sm text-blue-600">
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

      {/* Complete button */}
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
    <div className="space-y-4">
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

      {/* Complete button */}
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
  );
};

/**
 * Main POSPaymentModal component
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {function} props.onClose - Called to close the modal
 * @param {number} props.total - Total amount to pay
 * @param {Array} props.items - Cart items
 * @param {Object} [props.customer] - Selected customer
 * @param {function} [props.onRequestChangeCustomer] - Called when user wants to change customer
 * @param {function} props.onConfirmPayment - Called when payment is confirmed
 * @param {boolean} props.isProcessing - Whether payment is being processed
 * @param {boolean} [props.isRestaurant] - If true, show Send to kitchen option
 * @param {boolean} [props.stayOpenAfterSale] - When true, modal stays open after each sale
 * @param {function} [props.onStayOpenAfterSaleChange] - Called when stay-open toggle changes
 */
const POSPaymentModal = ({
  isOpen,
  onClose,
  total,
  items,
  customer,
  onRequestChangeCustomer,
  onConfirmPayment,
  isProcessing = false,
  isRestaurant = false,
  stayOpenAfterSale = false,
  onStayOpenAfterSaleChange
}) => {
  const [activeTab, setActiveTab] = useState('cash');
  const [sendToKitchen, setSendToKitchen] = useState(true);

  const handleConfirm = useCallback((details) => {
    onConfirmPayment({ ...details, sendToKitchen });
  }, [onConfirmPayment, sendToKitchen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:w-[var(--modal-w-md)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)]">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2">
              Payment
              <Badge variant="outline" className="ml-2">
                {formatCurrency(total)}
              </Badge>
            </DialogTitle>
            {onStayOpenAfterSaleChange && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="stay-open" className="text-xs text-muted-foreground cursor-pointer">
                      Stay open
                    </Label>
                    <Switch
                      id="stay-open"
                      checked={stayOpenAfterSale}
                      onCheckedChange={onStayOpenAfterSaleChange}
                    />
                    {stayOpenAfterSale ? (
                      <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
                    ) : (
                      <Unlock className="h-4 w-4 text-muted-foreground" aria-hidden />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {stayOpenAfterSale
                    ? 'Modal stays open after each sale (locked)'
                    : 'Modal closes after each sale'}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </DialogHeader>

        <DialogBody>
        {onRequestChangeCustomer && (
          <div className="flex items-center justify-between p-3 mb-4 rounded-lg border border-border bg-muted">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Customer:</span>
              <span className="font-medium">{customer?.name || (customer?.company || 'Walk-in')}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRequestChangeCustomer}
              className="shrink-0"
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Change
            </Button>
          </div>
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
          <TabsList className="grid grid-cols-4 w-full">
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="cash" className="flex items-center gap-1">
                  <Banknote className="h-4 w-4" />
                  <span className="hidden sm:inline">Cash</span>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>Customer paid with cash</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="mobile" className="flex items-center gap-1">
                  <Smartphone className="h-4 w-4" />
                  <span className="hidden sm:inline">Mobile</span>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>Customer paid with MTN Mobile Money or Airtel Money</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="card" className="flex items-center gap-1">
                  <CreditCard className="h-4 w-4" />
                  <span className="hidden sm:inline">Card</span>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>Customer paid with card</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="credit" className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Credit</span>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>Sell now, collect money later</TooltipContent>
            </Tooltip>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="cash" className="m-0">
              <CashPayment
                total={total}
                onConfirm={handleConfirm}
                isProcessing={isProcessing}
              />
            </TabsContent>

            <TabsContent value="mobile" className="m-0">
              <MobileMoneyPayment
                total={total}
                customer={customer}
                onConfirm={handleConfirm}
                isProcessing={isProcessing}
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
