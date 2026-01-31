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
  RefreshCw
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
import POSNumpad from './POSNumpad';
import { CURRENCY } from '../../constants';
import { showSuccess, showError } from '../../utils/toast';

/**
 * Format currency value
 */
const formatCurrency = (amount) => {
  return `${CURRENCY.SYMBOL} ${(amount || 0).toFixed(CURRENCY.DECIMAL_PLACES)}`;
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

  // Quick amount buttons
  const quickAmounts = useMemo(() => {
    const amounts = [];
    const baseAmount = Math.ceil(total / 10) * 10;
    amounts.push(baseAmount);
    amounts.push(baseAmount + 10);
    amounts.push(baseAmount + 20);
    amounts.push(baseAmount + 50);
    amounts.push(Math.ceil(total / 100) * 100);
    // Remove duplicates and sort
    return [...new Set(amounts)].sort((a, b) => a - b).slice(0, 4);
  }, [total]);

  return (
    <div className="space-y-4">
      {/* Amount display */}
      <div className="text-center p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">Amount to Pay</p>
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
        <div className="text-center mt-2 p-3 bg-white border rounded-lg">
          <span className="text-3xl font-bold">
            {CURRENCY.SYMBOL} {amountTendered || '0'}
          </span>
        </div>
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
      <div className="text-center p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">Amount to Pay</p>
        <p className="text-3xl font-bold text-green-700">{formatCurrency(total)}</p>
      </div>

      {/* Provider selection */}
      <div>
        <Label>Select Provider</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {Object.entries(MOBILE_MONEY_PROVIDERS).map(([key, config]) => (
            <Button
              key={key}
              variant="outline"
              className={`
                h-14 justify-center
                ${provider === key 
                  ? `${config.color} ${config.textColor} border-2 ${config.borderColor}` 
                  : 'bg-white'
                }
              `}
              onClick={() => setProvider(key)}
            >
              <Smartphone className="h-5 w-5 mr-2" />
              {config.shortName}
            </Button>
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
            : 'bg-gray-50 border-gray-200 hover:border-green-400'
          }
        `}
        onClick={() => setPaymentConfirmed(!paymentConfirmed)}
      >
        <div className="flex items-center gap-3">
          <div className={`
            w-6 h-6 rounded-full border-2 flex items-center justify-center
            ${paymentConfirmed ? 'bg-green-500 border-green-500' : 'border-gray-300'}
          `}>
            {paymentConfirmed && <Check className="h-4 w-4 text-white" />}
          </div>
          <span className={paymentConfirmed ? 'text-green-700 font-medium' : 'text-gray-700'}>
            I confirm payment has been received
          </span>
        </div>
      </div>

      {/* Complete button */}
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
      <div className="text-center p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">Amount to Pay</p>
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
            : 'bg-gray-50 border-gray-200 hover:border-green-400'
          }
        `}
        onClick={() => setPaymentConfirmed(!paymentConfirmed)}
      >
        <div className="flex items-center gap-3">
          <div className={`
            w-6 h-6 rounded-full border-2 flex items-center justify-center
            ${paymentConfirmed ? 'bg-green-500 border-green-500' : 'border-gray-300'}
          `}>
            {paymentConfirmed && <Check className="h-4 w-4 text-white" />}
          </div>
          <span className={paymentConfirmed ? 'text-green-700 font-medium' : 'text-gray-700'}>
            Card payment approved
          </span>
        </div>
      </div>

      {/* Complete button */}
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
    </div>
  );
};

/**
 * Credit payment tab
 */
const CreditPayment = ({ total, customer, onConfirm, isProcessing }) => {
  const hasCustomer = !!customer;
  const creditAvailable = customer?.creditLimit ? (customer.creditLimit - (customer.balance || 0)) : 0;
  const canUseCredit = hasCustomer && creditAvailable >= total;

  return (
    <div className="space-y-4">
      {/* Amount display */}
      <div className="text-center p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">Amount to Credit</p>
        <p className="text-3xl font-bold text-green-700">{formatCurrency(total)}</p>
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
          {/* Customer credit info */}
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-600">Customer</span>
                <span className="font-medium">{customer.name}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">Credit Limit</span>
                <span className="font-medium">{formatCurrency(customer.creditLimit || 0)}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">Current Balance</span>
                <span className="font-medium text-orange-600">
                  {formatCurrency(customer.balance || 0)}
                </span>
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Available Credit</span>
                <span className={`font-bold ${canUseCredit ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(creditAvailable)}
                </span>
              </div>
            </CardContent>
          </Card>

          {!canUseCredit && (
            <div className="p-4 bg-red-50 rounded-lg text-center">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-700 font-medium">Insufficient Credit</p>
              <p className="text-sm text-red-600 mt-1">
                Customer does not have enough available credit for this sale.
              </p>
            </div>
          )}

          {/* Invoice notice */}
          {canUseCredit && (
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
          )}
        </>
      )}

      {/* Complete button */}
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
 * @param {function} props.onConfirmPayment - Called when payment is confirmed
 * @param {boolean} props.isProcessing - Whether payment is being processed
 */
const POSPaymentModal = ({
  isOpen,
  onClose,
  total,
  items,
  customer,
  onConfirmPayment,
  isProcessing = false
}) => {
  const [activeTab, setActiveTab] = useState('cash');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:w-[var(--modal-w-md)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Payment
            <Badge variant="outline" className="ml-2">
              {formatCurrency(total)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="cash" className="flex items-center gap-1">
              <Banknote className="h-4 w-4" />
              <span className="hidden sm:inline">Cash</span>
            </TabsTrigger>
            <TabsTrigger value="mobile" className="flex items-center gap-1">
              <Smartphone className="h-4 w-4" />
              <span className="hidden sm:inline">Mobile</span>
            </TabsTrigger>
            <TabsTrigger value="card" className="flex items-center gap-1">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Card</span>
            </TabsTrigger>
            <TabsTrigger value="credit" className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Credit</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="cash" className="m-0">
              <CashPayment
                total={total}
                onConfirm={onConfirmPayment}
                isProcessing={isProcessing}
              />
            </TabsContent>

            <TabsContent value="mobile" className="m-0">
              <MobileMoneyPayment
                total={total}
                customer={customer}
                onConfirm={onConfirmPayment}
                isProcessing={isProcessing}
              />
            </TabsContent>

            <TabsContent value="card" className="m-0">
              <CardPayment
                total={total}
                onConfirm={onConfirmPayment}
                isProcessing={isProcessing}
              />
            </TabsContent>

            <TabsContent value="credit" className="m-0">
              <CreditPayment
                total={total}
                customer={customer}
                onConfirm={onConfirmPayment}
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
