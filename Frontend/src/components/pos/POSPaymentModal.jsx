/**
 * POSPaymentModal — checkout / payment modal (matches POS payment mockup).
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Banknote,
  Smartphone,
  CreditCard,
  FileText,
  Check,
  AlertCircle,
  User,
  ChefHat,
  ShoppingBag,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { CURRENCY } from '../../constants';
import { formatAmount, parseDecimalInput } from '../../utils/formatNumber';
import { useResponsive } from '../../hooks/useResponsive';
import mobileMoneyService from '../../services/mobileMoneyService';

/** 1px card borders + consistent section spacing */
const SECTION_CARD = 'rounded-lg border border-[#e5e7eb] bg-card';
const SECTION_STACK = 'flex flex-col gap-6';

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'mobile', label: 'Mobile Money', icon: Smartphone },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'credit', label: 'Credit', icon: FileText },
];

const MOBILE_MONEY_PROVIDERS = {
  mtn: {
    name: 'MTN Mobile Money',
    shortName: 'MTN MoMo',
    color: 'bg-yellow-400',
    textColor: 'text-yellow-900',
    borderColor: 'border-yellow-500',
  },
  vodafone: {
    name: 'Vodafone Cash',
    shortName: 'Vodafone',
    color: 'bg-red-600',
    textColor: 'text-white',
    borderColor: 'border-red-700',
  },
  airtel: {
    name: 'AirtelTigo Cash',
    shortName: 'AirtelTigo',
    color: 'bg-red-500',
    textColor: 'text-white',
    borderColor: 'border-red-600',
  },
};

/**
 * Suggested tender amounts from common note denominations — all >= checkout total.
 * @param {number} total - Amount due at checkout
 * @returns {number[]}
 */
function buildQuickCashAmounts(total) {
  const due = Math.max(0, Number(total) || 0);
  const denoms = [5, 10, 20, 50, 100, 200, 500];
  const decimals = typeof CURRENCY?.DECIMAL_PLACES === 'number' ? CURRENCY.DECIMAL_PLACES : 2;
  const roundMoney = (value) => Math.round(value * 10 ** decimals) / 10 ** decimals;

  if (due === 0) return denoms.slice(0, 4);

  const amounts = new Set();

  denoms.forEach((denomination) => {
    const rounded = roundMoney(Math.ceil(due / denomination) * denomination);
    if (rounded >= due) amounts.add(rounded);
  });

  let sorted = [...amounts].sort((a, b) => a - b);
  const minimumCover = sorted[0] ?? roundMoney(Math.ceil(due));

  if (sorted.length < 4) {
    [5, 10, 20, 50, 100, 200, 500].forEach((increment) => {
      const next = roundMoney(minimumCover + increment);
      if (next >= due) amounts.add(next);
    });
    sorted = [...amounts].sort((a, b) => a - b);
  }

  denoms.forEach((denomination) => {
    if (denomination >= minimumCover) amounts.add(denomination);
  });

  const unique = [...new Set(
    [...amounts]
      .map(roundMoney)
      .filter((amount) => amount >= due - 0.001)
      .sort((a, b) => a - b)
  )];

  return unique.slice(0, 4);
}

/**
 * Summary cards: Amount Due + breakdown.
 */
function PaymentSummaryCards({ total, taxSummary }) {
  const subtotal = Number(taxSummary?.subtotal ?? total) || 0;
  const taxAmount = Number(taxSummary?.taxAmount ?? 0) || 0;
  const taxLabel = taxSummary?.taxLabel || (taxAmount > 0 ? 'Tax' : 'Tax (0%)');

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className={cn(SECTION_CARD, 'p-4')}>
        <p className="text-sm text-muted-foreground">Amount Due</p>
        <p className="text-2xl font-bold text-green-700 mt-1">{formatAmount(total)}</p>
      </div>
      <div className={cn(SECTION_CARD, 'p-4 space-y-2')}>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="text-foreground">{formatAmount(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{taxLabel}</span>
          <span className="text-foreground">{formatAmount(taxAmount)}</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between text-sm font-semibold text-foreground">
          <span>Total Due</span>
          <span>{formatAmount(total)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Customer row with change action.
 */
function PaymentCustomerRow({ customer, onChangeCustomer, onClearCustomer, isMobile, customers, customerSearchTerm, setCustomerSearchTerm, onSelectExistingCustomer, onRequestChangeCustomer }) {
  const customerName = customer?.name || customer?.company || 'Walk-in';

  if (isMobile && onRequestChangeCustomer) {
    return (
      <div className={cn(SECTION_CARD, 'p-3')}>
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
            const existing = Array.isArray(customers) && customers.find((c) => String(c.id) === value);
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
            {(customers || []).map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name || c.company || c.phone || 'Customer'}
              </SelectItem>
            ))}
            <SelectItem value="__new__">Add new customer…</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (!onChangeCustomer && !onRequestChangeCustomer) return null;

  return (
    <div className={cn('flex items-center justify-between gap-3', SECTION_CARD, 'p-3')}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <User className="h-5 w-5 text-blue-600" aria-hidden />
        </div>
        <p className="text-sm text-foreground truncate">
          Customer <span className="font-semibold">{customerName}</span>
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 border border-green-700 text-green-700 hover:bg-green-50 hover:text-green-800"
        onClick={onChangeCustomer || onRequestChangeCustomer}
      >
        + Change
      </Button>
    </div>
  );
}

/**
 * Payment method grid (Cash, Mobile Money, Card, Credit).
 */
function PaymentMethodGrid({ activeTab, onChange, isMobile }) {
  if (isMobile) {
    return (
      <div>
        <Label className="text-xs text-muted-foreground">Payment method</Label>
        <Select value={activeTab} onValueChange={onChange}>
          <SelectTrigger className="w-full mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_METHODS.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-3">
      {PAYMENT_METHODS.map((method) => {
        const Icon = method.icon;
        const isActive = activeTab === method.id;
        return (
          <button
            key={method.id}
            type="button"
            onClick={() => onChange(method.id)}
            className={cn(
              'flex flex-col items-center justify-center gap-2 rounded-lg border px-2 py-3 min-h-[72px] transition-colors',
              isActive
                ? 'border-green-700 bg-green-50 text-green-700'
                : 'border-[#e5e7eb] bg-card text-muted-foreground hover:border-green-300'
            )}
          >
            <Icon className={cn('h-5 w-5', isActive ? 'text-green-700' : 'text-muted-foreground')} aria-hidden />
            <span className="text-xs font-medium text-center leading-tight">{method.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Items in this sale (cash checkout).
 */
function SaleItemsSection({ items, onEditItems }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <div className={cn(SECTION_CARD, 'p-3')}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-9 w-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
            <ShoppingBag className="h-4 w-4 text-violet-600" aria-hidden />
          </div>
          <span className="text-sm font-medium text-foreground">Items in this sale</span>
        </div>
        {onEditItems && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800 shrink-0"
            onClick={onEditItems}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Edit items
          </button>
        )}
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between text-sm gap-2">
            <span className="text-foreground truncate">
              {item.name || 'Item'}{' '}
              <span className="text-muted-foreground">× {Number(item.quantity) || 0}</span>
            </span>
            <span className="font-medium text-foreground shrink-0">
              {formatAmount(
                (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0) - (Number(item.discount) || 0)
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Cash payment flow.
 */
const CashPayment = ({ total, items, onConfirm, isProcessing, onEditItems }) => {
  const [amountTendered, setAmountTendered] = useState('');

  useEffect(() => {
    setAmountTendered(total.toFixed(
      typeof CURRENCY?.DECIMAL_PLACES === 'number' ? CURRENCY.DECIMAL_PLACES : 2
    ));
  }, [total]);

  const parsedAmount = parseDecimalInput(amountTendered) || 0;
  const change = Math.max(0, parsedAmount - total);
  const isValid = parsedAmount >= total;

  const quickAmounts = useMemo(() => buildQuickCashAmounts(total), [total]);

  return (
    <div className={SECTION_STACK}>
      <SaleItemsSection items={items} onEditItems={onEditItems} />

      <div className="text-center">
        <p className="text-sm text-muted-foreground">Amount to Pay</p>
        <p className="text-3xl font-bold text-green-700 mt-1">{formatAmount(total)}</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {quickAmounts.map((amount) => (
          <Button
            key={amount}
            type="button"
            variant="outline"
            className={cn(
              'h-10 text-sm font-medium border border-[#e5e7eb]',
              Math.abs(parsedAmount - amount) < 0.005 && 'border-green-700 bg-green-50 text-green-700'
            )}
            onClick={() => setAmountTendered(amount.toFixed(
              typeof CURRENCY?.DECIMAL_PLACES === 'number' ? CURRENCY.DECIMAL_PLACES : 2
            ))}
          >
            {formatAmount(amount)}
          </Button>
        ))}
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Label className="text-sm text-muted-foreground">Amount Tendered</Label>
          <div className="relative mt-1.5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              {CURRENCY?.SYMBOL ?? '₵'}
            </span>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="Enter amount"
              className="h-11 pl-8 text-base border border-[#e5e7eb]"
              value={amountTendered}
              onChange={(e) => setAmountTendered(e.target.value)}
            />
          </div>
        </div>
        <div className="text-right shrink-0 pb-1">
          <p className="text-xs text-muted-foreground mb-1">Change</p>
          <p className={cn('text-xl font-bold', isValid || parsedAmount === 0 ? 'text-green-700' : 'text-red-600')}>
            {parsedAmount > 0 && !isValid
              ? formatAmount(total - parsedAmount)
              : formatAmount(change)}
          </p>
        </div>
      </div>

      <Button
        type="button"
        className="w-full h-12 text-base font-medium bg-green-700 hover:bg-green-800"
        disabled={!isValid}
        loading={isProcessing}
        onClick={() => onConfirm({
          paymentMethod: 'cash',
          amountPaid: parsedAmount,
          change,
        })}
      >
        <span className="inline-flex items-center gap-2">
          <span className="h-5 w-5 rounded-full border border-white/70 flex items-center justify-center">
            <Check className="h-3 w-3" aria-hidden />
          </span>
          Complete Sale
        </span>
      </Button>
    </div>
  );
};

/**
 * Mobile Money payment flow.
 */
const MobileMoneyPayment = ({
  total,
  customer,
  onRequestMobileMoney,
  onConfirm,
  isProcessing,
  mobileMoneyState = 'idle',
  mobileMoneyError = '',
  mobileMoneyFallbackMode = null,
}) => {
  const [provider, setProvider] = useState('mtn');
  const [phone, setPhone] = useState(customer?.phone || '');

  useEffect(() => {
    const trimmed = phone.trim();
    if (trimmed.length < 10) return;
    const detected = mobileMoneyService.detectProviderLocal(trimmed);
    if (detected === 'MTN') setProvider('mtn');
    else if (detected === 'AIRTEL') setProvider('airtel');
    else if (detected === 'VODAFONE') setProvider('vodafone');
  }, [phone]);

  const isPhoneValid = phone.trim().length >= 10;
  const isWaiting = mobileMoneyState === 'initiating' || mobileMoneyState === 'waiting';
  const isSuccess = mobileMoneyState === 'success';
  const isFallbackManual = mobileMoneyFallbackMode === 'manual';
  const logicalProvider = provider === 'mtn' ? 'MTN' : provider === 'airtel' ? 'AIRTEL' : 'VODAFONE';

  return (
    <div className={SECTION_STACK}>
      <div className="text-center py-2">
        <p className="text-sm text-muted-foreground">Amount to Pay</p>
        <p className="text-3xl font-bold text-green-700 mt-1">{formatAmount(total)}</p>
      </div>

      <div>
        <Label>Select Provider</Label>
        <div className="flex gap-2 mt-2">
          {Object.entries(MOBILE_MONEY_PROVIDERS).map(([key, config]) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              className={cn(
                'h-12 flex-1 justify-center',
                provider === key
                  ? `${config.color} ${config.textColor} border ${config.borderColor}`
                  : 'bg-card border border-[#e5e7eb]'
              )}
              onClick={() => setProvider(key)}
              disabled={isWaiting || isProcessing}
            >
              <Smartphone className="h-4 w-4 mr-2" aria-hidden />
              {config.shortName}
            </Button>
          ))}
        </div>
      </div>

      {!isFallbackManual && (
        <div>
          <Label>Customer MoMo number</Label>
          <Input
            type="tel"
            placeholder="0XX XXX XXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-11 text-base mt-1.5"
          />
        </div>
      )}

      {!isFallbackManual ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 space-y-2">
            <h4 className="font-medium text-green-800">Request Mobile Money Payment</h4>
            <p className="text-sm text-green-700">
              Customer will receive a mobile money prompt on their phone to approve this payment.
            </p>
            {mobileMoneyState !== 'idle' && (
              <div className="text-sm">
                {mobileMoneyState === 'initiating' && <span className="text-green-700">Requesting payment…</span>}
                {mobileMoneyState === 'waiting' && (
                  <span className="text-green-700">Waiting for customer to approve on their phone…</span>
                )}
                {isSuccess && <span className="text-green-700 font-medium">Payment received. Completing sale…</span>}
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
                <li>Enter amount: {formatAmount(total)}</li>
                <li>Confirm payment on their phone</li>
              </ol>
            </CardContent>
          </Card>
          <Button
            type="button"
            className="w-full h-12 bg-green-700 hover:bg-green-800"
            disabled={isProcessing}
            loading={isProcessing}
            onClick={() => onConfirm({
              paymentMethod: 'mobile_money',
              amountPaid: total,
              mobileMoneyPhone: phone.trim(),
              mobileMoneyProvider: logicalProvider,
            })}
          >
            <Check className="h-5 w-5 mr-2" aria-hidden />
            Confirm payment received
          </Button>
          {mobileMoneyError && <p className="text-xs text-red-600">{mobileMoneyError}</p>}
        </>
      )}

      {!isFallbackManual && (
        <Button
          type="button"
          className="w-full h-12 text-base font-medium bg-green-700 hover:bg-green-800"
          disabled={!isPhoneValid || isWaiting || isProcessing}
          loading={isProcessing || isWaiting}
          onClick={() => onRequestMobileMoney?.({ phone: phone.trim(), provider: logicalProvider })}
        >
          <Smartphone className="h-5 w-5 mr-2" aria-hidden />
          {isWaiting ? 'Waiting for Approval…' : 'Request MoMo Payment'}
        </Button>
      )}
    </div>
  );
};

/**
 * Card payment flow.
 */
const CardPayment = ({ total, onConfirm, isProcessing }) => {
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  return (
    <div className={SECTION_STACK}>
      <div className="text-center py-2">
        <p className="text-sm text-muted-foreground">Amount to Pay</p>
        <p className="text-3xl font-bold text-green-700 mt-1">{formatAmount(total)}</p>
      </div>

      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-6 text-center">
          <CreditCard className="h-14 w-14 text-green-600 mx-auto mb-3" aria-hidden />
          <h4 className="font-medium text-green-800 mb-2">Process Card Payment</h4>
          <p className="text-sm text-green-700">
            Use your card terminal to process this payment. Confirm once the transaction is approved.
          </p>
        </CardContent>
      </Card>

      <button
        type="button"
        className={cn(
          'w-full p-4 rounded-lg border text-left transition-colors',
          paymentConfirmed ? 'bg-green-50 border-green-600' : 'bg-card border-[#e5e7eb] hover:border-green-400'
        )}
        onClick={() => setPaymentConfirmed(!paymentConfirmed)}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-6 h-6 rounded-full border flex items-center justify-center shrink-0',
            paymentConfirmed ? 'bg-green-600 border-green-600' : 'border-[#e5e7eb]'
          )}>
            {paymentConfirmed && <Check className="h-4 w-4 text-white" aria-hidden />}
          </div>
          <span className={paymentConfirmed ? 'text-green-700 font-medium' : 'text-foreground'}>
            Card payment approved
          </span>
        </div>
      </button>

      <Button
        type="button"
        className="w-full h-12 text-base font-medium bg-green-700 hover:bg-green-800"
        disabled={!paymentConfirmed}
        loading={isProcessing}
        onClick={() => onConfirm({ paymentMethod: 'card', amountPaid: total })}
      >
        <span className="inline-flex items-center gap-2">
          <span className="h-5 w-5 rounded-full border border-white/70 flex items-center justify-center">
            <Check className="h-3 w-3" aria-hidden />
          </span>
          Complete Sale
        </span>
      </Button>
    </div>
  );
};

/**
 * Credit payment flow.
 */
const CreditPayment = ({ total, customer, onConfirm, isProcessing }) => {
  const hasCustomer = !!customer;
  const totalSafe = Number.isFinite(Number(total)) ? Number(total) : 0;
  const creditLimit = Number(customer?.creditLimit);
  const balance = Number(customer?.balance);
  const hasLimit = Number.isFinite(creditLimit) && creditLimit > 0;
  const creditAvailable = hasLimit ? creditLimit - (Number.isFinite(balance) ? balance : 0) : null;

  return (
    <div className={SECTION_STACK}>
      <div className="text-center py-2">
        <p className="text-sm text-muted-foreground">Amount to Credit</p>
        <p className="text-3xl font-bold text-green-700 mt-1">{formatAmount(totalSafe)}</p>
      </div>

      {!hasCustomer ? (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-3" aria-hidden />
            <h4 className="font-medium text-yellow-800 mb-2">Customer Required</h4>
            <p className="text-sm text-yellow-700">
              Select a customer above to use credit payment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border border-[#e5e7eb]">
            <CardContent className="p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{customer.name}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Balance</span>
                <span className="font-medium text-orange-600">{formatAmount(Number.isFinite(balance) ? balance : 0)}</span>
              </div>
              {hasLimit ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Credit Limit</span>
                    <span className="font-medium">{formatAmount(creditLimit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Available Credit</span>
                    <span className="font-bold text-green-600">{formatAmount(creditAvailable)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credit</span>
                  <span className="font-medium text-green-600">Unlimited (pay later)</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4 flex gap-3">
              <FileText className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" aria-hidden />
              <div>
                <h4 className="font-medium text-blue-800">Invoice Will Be Generated</h4>
                <p className="text-sm text-blue-700 mt-1">
                  An invoice will be created for this credit sale and added to the customer balance.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Button
        type="button"
        className="w-full h-12 text-base font-medium bg-green-700 hover:bg-green-800"
        disabled={!hasCustomer}
        loading={isProcessing}
        onClick={() => onConfirm({ paymentMethod: 'credit', amountPaid: 0 })}
      >
        <FileText className="h-5 w-5 mr-2" aria-hidden />
        Create Credit Sale
      </Button>
    </div>
  );
};

/**
 * Main POS payment modal.
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
      return name.includes(term) || company.includes(term) || phone.includes(term) || email.includes(term);
    });
  }, [customers, customerSearchTerm]);

  const handleConfirm = useCallback((details) => {
    onConfirmPayment({ ...details, sendToKitchen });
  }, [onConfirmPayment, sendToKitchen]);

  const handleEditItems = useCallback(() => {
    onClose(false);
  }, [onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:w-[var(--modal-w-xl)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)] w-full max-w-none h-[100dvh] sm:h-auto m-0 sm:m-auto flex flex-col rounded-none border-0 top-0 left-0 translate-x-0 translate-y-0 sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border">
        <DialogHeader className="pb-2 mb-2">
          <DialogTitle className="text-lg font-semibold text-foreground pr-10">Payment</DialogTitle>
          <DialogDescription className="sr-only">
            Choose payment method and complete payment for {formatAmount(total)}.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex-1 min-h-0 overflow-y-auto pb-4">
          <div className={SECTION_STACK}>
          <PaymentSummaryCards total={total} taxSummary={taxSummary} />

          <PaymentCustomerRow
            customer={customer}
            onChangeCustomer={onRequestChangeCustomer}
            onClearCustomer={onClearCustomer}
            isMobile={isMobile}
            customers={filteredCustomers}
            customerSearchTerm={customerSearchTerm}
            setCustomerSearchTerm={setCustomerSearchTerm}
            onSelectExistingCustomer={onSelectExistingCustomer}
            onRequestChangeCustomer={onRequestChangeCustomer}
          />

          <PaymentMethodGrid activeTab={activeTab} onChange={setActiveTab} isMobile={isMobile} />

          {isRestaurant && (
            <div className={cn('flex items-center justify-between', SECTION_CARD, 'bg-muted/50 p-3')}>
              <div className="flex items-center gap-2 flex-1">
                <ChefHat className="h-4 w-4 text-muted-foreground" aria-hidden />
                <div>
                  <Label htmlFor="send-to-kitchen" className="text-sm font-medium cursor-pointer">
                    Send to kitchen
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {sendToKitchen ? 'Order will appear in kitchen' : 'Skip kitchen (e.g. water only)'}
                  </p>
                </div>
              </div>
              <Switch id="send-to-kitchen" checked={sendToKitchen} onCheckedChange={setSendToKitchen} />
            </div>
          )}

          {activeTab === 'cash' && (
            <CashPayment
              total={total}
              items={items}
              onConfirm={handleConfirm}
              isProcessing={isProcessing}
              onEditItems={handleEditItems}
            />
          )}

          {activeTab === 'mobile' && (
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
          )}

          {activeTab === 'card' && (
            <CardPayment total={total} onConfirm={handleConfirm} isProcessing={isProcessing} />
          )}

          {activeTab === 'credit' && (
            <CreditPayment total={total} customer={customer} onConfirm={handleConfirm} isProcessing={isProcessing} />
          )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export default POSPaymentModal;
