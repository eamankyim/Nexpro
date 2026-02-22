/**
 * POSCart Component
 * 
 * Shopping cart for the POS system.
 * Displays items, quantities, prices, discounts, and totals.
 * Optimized for touch input with large targets.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Minus, Plus, Trash2, User, UserPlus, Percent, ShoppingCart, Phone, X, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SecondaryButton } from '@/components/ui/secondary-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import POSNumpad from './POSNumpad';
import { usePOSConfig } from '../../hooks/usePOSConfig';
import { CURRENCY } from '../../constants';

/**
 * Format currency value (handles string decimals from API/cart)
 * @param {number|string} amount - Amount to format
 * @returns {string} - Formatted currency string
 */
const formatCurrency = (amount) => {
  const num = Number(amount);
  const value = Number.isFinite(num) ? num : 0;
  return `${CURRENCY.SYMBOL} ${value.toFixed(CURRENCY.DECIMAL_PLACES)}`;
};

/**
 * Cart item component
 */
const CartItem = ({ item, onUpdateQuantity, onRemove, onEditDiscount }) => {
  const unitPrice = Number(item.unitPrice);
  const quantity = Number(item.quantity) || 0;
  const discount = Number(item.discount) || 0;
  const itemTotal = (Number.isFinite(unitPrice) ? unitPrice : 0) * quantity - discount;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      {/* Item details */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{item.name}</p>
        <p className="text-sm text-muted-foreground">
          {formatCurrency(unitPrice)} × {quantity}
        </p>
        {discount > 0 && (
          <p className="text-sm text-green-600">
            Discount: -{formatCurrency(discount)}
          </p>
        )}
      </div>

      {/* Quantity controls */}
      <div className="flex items-center gap-1 relative z-10">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => onUpdateQuantity(item.id, Math.max(1, quantity - 1))}
            >
              <Minus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reduce by one</TooltipContent>
        </Tooltip>
        <span className="w-10 text-center font-semibold text-foreground min-w-[2.5rem]">{quantity}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => onUpdateQuantity(item.id, quantity + 1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add one more</TooltipContent>
        </Tooltip>
      </div>

      {/* Item total and actions */}
      <div className="flex flex-col items-end gap-1">
        <span className="font-semibold text-foreground">
          {formatCurrency(itemTotal)}
        </span>
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                onClick={() => onEditDiscount(item)}
              >
                <Percent className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Give discount on this item</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-red-600"
                onClick={() => onRemove(item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove this item from cart</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

/**
 * Main POSCart component
 * @param {Object} props
 * @param {Array} props.items - Cart items
 * @param {function} props.onUpdateQuantity - Called when item quantity changes
 * @param {function} props.onRemoveItem - Called when item is removed
 * @param {function} props.onUpdateItemDiscount - Called when item discount changes
 * @param {Object} [props.customer] - Selected customer
 * @param {Array} [props.customers] - List of customers for "Select existing" dropdown
 * @param {function} props.onSelectCustomer - Called when a customer is selected (from dropdown)
 * @param {function} props.onClearCustomer - Called to clear selected customer
 * @param {number} [props.cartDiscount] - Cart-level discount
 * @param {function} props.onUpdateCartDiscount - Called when cart discount changes
 * @param {function} props.onCheckout - Called when checkout is pressed
 * @param {function} props.onClearCart - Called to clear the cart
 * @param {boolean} [props.showQuickCustomerForm] - Show inline customer form instead of selection button
 * @param {string} [props.quickCustomerName] - Name for quick customer form
 * @param {function} [props.onQuickCustomerNameChange] - Called when quick customer name changes
 * @param {string} [props.quickCustomerPhone] - Phone for quick customer form
 * @param {function} [props.onQuickCustomerPhoneChange] - Called when quick customer phone changes
 */
const POSCart = ({
  items = [],
  onUpdateQuantity,
  onRemoveItem,
  onUpdateItemDiscount,
  customer,
  customers = [],
  onSelectCustomer,
  onClearCustomer,
  cartDiscount = 0,
  onUpdateCartDiscount,
  onCheckout,
  onClearCart,
  showQuickCustomerForm = false,
  quickCustomerName = '',
  onQuickCustomerNameChange,
  quickCustomerPhone = '',
  onQuickCustomerPhoneChange
}) => {
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [discountValue, setDiscountValue] = useState('');
  const [isCartDiscount, setIsCartDiscount] = useState(false);
  const [quickFormExpanded, setQuickFormExpanded] = useState(false);
  const [customerSelectValue, setCustomerSelectValue] = useState('');

  const { posConfig } = usePOSConfig();

  const customerValidation = useMemo(() => {
    const { phoneRequired, nameRequired } = posConfig.customer || {};
    const hasPhone = !!(customer?.phone || quickCustomerPhone);
    const hasName = !!(customer?.name || customer?.company || quickCustomerName);
    const phoneOk = !phoneRequired || hasPhone;
    const nameOk = !nameRequired || hasName;
    const canCheckout = phoneOk && nameOk;
    let message = null;
    if (!phoneOk) message = 'Phone number is required before checkout';
    else if (!nameOk) message = 'Customer name is required before checkout';
    return { canCheckout, message };
  }, [posConfig.customer, customer, quickCustomerPhone, quickCustomerName]);

  // Sync dropdown value with selected customer (e.g. after selecting from dialog)
  useEffect(() => {
    setCustomerSelectValue(customer?.id ?? '');
  }, [customer?.id]);

  // Calculate totals
  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => 
      sum + (item.unitPrice * item.quantity), 0);
    const itemDiscounts = items.reduce((sum, item) => 
      sum + (item.discount || 0), 0);
    const totalDiscount = itemDiscounts + cartDiscount;
    const total = subtotal - totalDiscount;
    
    return {
      subtotal,
      itemDiscounts,
      cartDiscount,
      totalDiscount,
      total: Math.max(0, total),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0)
    };
  }, [items, cartDiscount]);

  const handleEditItemDiscount = useCallback((item) => {
    setEditingItem(item);
    setDiscountValue((item.discount || 0).toString());
    setIsCartDiscount(false);
    setDiscountDialogOpen(true);
  }, []);

  const handleEditCartDiscount = useCallback(() => {
    setEditingItem(null);
    setDiscountValue(cartDiscount.toString());
    setIsCartDiscount(true);
    setDiscountDialogOpen(true);
  }, [cartDiscount]);

  const handleApplyDiscount = useCallback(() => {
    const discount = parseFloat(discountValue) || 0;
    
    if (isCartDiscount) {
      onUpdateCartDiscount(discount);
    } else if (editingItem) {
      onUpdateItemDiscount(editingItem.id, discount);
    }
    
    setDiscountDialogOpen(false);
    setEditingItem(null);
    setDiscountValue('');
  }, [discountValue, isCartDiscount, editingItem, onUpdateCartDiscount, onUpdateItemDiscount]);

  const isEmpty = items.length === 0;

  return (
    <Card className="min-h-full flex flex-col border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Cart
            {totals.itemCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {totals.itemCount} item{totals.itemCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
          {!isEmpty && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={onClearCart}
                >
                  Clear All
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove all items from cart</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Customer selection */}
        <div className="mt-3">
          {customer ? (
            <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 min-w-0">
                <User className="h-4 w-4 text-green-700 shrink-0" />
                <span className="text-sm font-medium text-green-800 truncate">
                  {customer.name || customer.company || 'No name'}
                </span>
                {customer.phone && (
                  <span className="text-xs text-green-600">
                    ({customer.phone})
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-green-700 hover:text-green-800"
                onClick={onClearCustomer}
              >
                Change
              </Button>
            </div>
          ) : showQuickCustomerForm ? (
            /* Add Customer (Optional) first, then Select existing */
            <div className="space-y-3">
              {/* Add Customer (Optional) - name + phone for walk-in / new at checkout */}
              <Collapsible open={quickFormExpanded} onOpenChange={setQuickFormExpanded}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between text-muted-foreground"
                      >
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      <span>
                        {quickCustomerPhone || quickCustomerName
                          ? `${quickCustomerName || 'Customer'} ${quickCustomerPhone ? `(${quickCustomerPhone})` : ''}`
                          : 'Add Customer (Optional)'
                        }
                      </span>
                    </div>
                    {quickFormExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                      </Button>
                    </CollapsibleTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Add buyer name and phone – for receipt</TooltipContent>
                </Tooltip>
                <CollapsibleContent className="mt-2 space-y-3 p-3 bg-muted rounded-lg border border-border">
                  <div>
                    <Label className="text-xs text-muted-foreground">Customer Name</Label>
                    <Input
                      placeholder="Enter name"
                      value={quickCustomerName}
                      onChange={(e) => onQuickCustomerNameChange?.(e.target.value)}
                      className="h-10 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Phone Number</Label>
                    <div className="relative mt-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="tel"
                        placeholder="0XX XXX XXXX"
                        value={quickCustomerPhone}
                        onChange={(e) => onQuickCustomerPhoneChange?.(e.target.value)}
                        className="h-10 pl-9"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter phone to auto-send receipt via SMS
                    </p>
                  </div>
                  {(quickCustomerPhone || quickCustomerName) && (
                    <div className="flex items-center gap-2 text-xs p-2 rounded text-green-700 bg-green-50">
                      <User className="h-3 w-3" />
                      <span>
                        {quickCustomerPhone
                          ? 'Customer will be created or linked by phone number at checkout'
                          : 'Walk-in customer (no receipt will be sent)'
                        }
                      </span>
                    </div>
                  )}
                  {(quickCustomerPhone || quickCustomerName) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="self-start"
                      onClick={() => {
                        onQuickCustomerNameChange?.('');
                        onQuickCustomerPhoneChange?.('');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </CollapsibleContent>
              </Collapsible>
              {/* Select existing customer - after Add Customer section (always visible) */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Label className="text-xs text-muted-foreground">Select existing customer</Label>
                    <Select
                  value={customers.length === 0 ? '__none__' : (customerSelectValue || '')}
                  onValueChange={(value) => {
                    if (value === '__none__' || !value) return;
                    setCustomerSelectValue(value);
                    const selected = customers.find((c) => c.id === value);
                    if (selected) onSelectCustomer?.(selected);
                  }}
                >
                  <SelectTrigger className="h-10 mt-1">
                    <SelectValue placeholder="Select existing customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        No customers yet
                      </SelectItem>
                    ) : (
                      customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name || c.company || 'No name'}
                          {c.phone ? ` (${c.phone})` : ''}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Choose a buyer you saved before</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-muted-foreground"
                  onClick={onSelectCustomer}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Customer (Optional)
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add buyer name and phone – for receipt</TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6">
            <ShoppingCart className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">Cart is empty</p>
            <p className="text-sm">Search or scan products to add</p>
          </div>
        ) : (
          <>
            {/* Items list */}
            <ScrollArea className="flex-1 px-4">
              {items.map((item) => (
                <CartItem
                  key={item.id}
                  item={item}
                  onUpdateQuantity={onUpdateQuantity}
                  onRemove={onRemoveItem}
                  onEditDiscount={handleEditItemDiscount}
                />
              ))}
            </ScrollArea>

            {/* Totals */}
            <div className="p-4 bg-muted border-t border-border">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                </div>
                
                {totals.itemDiscounts > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Item Discounts</span>
                    <span>-{formatCurrency(totals.itemDiscounts)}</span>
                  </div>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      className="flex justify-between text-sm cursor-pointer hover:bg-muted -mx-2 px-2 py-1 rounded"
                      onClick={handleEditCartDiscount}
                    >
                      <span className="text-muted-foreground flex items-center gap-1">
                        Cart Discount
                        <Percent className="h-3 w-3" />
                      </span>
                  <span className={cartDiscount > 0 ? 'text-green-600' : 'text-muted-foreground'}>
                    {cartDiscount > 0 ? `-${formatCurrency(cartDiscount)}` : 'Add'}
                  </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Give discount on whole cart</TooltipContent>
                </Tooltip>

                <Separator />
                
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-green-700">{formatCurrency(totals.total)}</span>
                </div>
              </div>

              {customerValidation.message && (
                <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {customerValidation.message}
                </div>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="w-full mt-4 h-14 text-lg font-semibold bg-green-700 hover:bg-green-800"
                    onClick={onCheckout}
                    disabled={isEmpty || !customerValidation.canCheckout}
                  >
                    Checkout - {formatCurrency(totals.total)}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Finish sale and take payment</TooltipContent>
              </Tooltip>
            </div>
          </>
        )}
      </CardContent>

      {/* Discount Dialog */}
      <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
        <DialogContent className="sm:w-[var(--modal-w-sm)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)]">
          <DialogHeader>
            <DialogTitle>
              {isCartDiscount ? 'Cart Discount' : `Discount for ${editingItem?.name}`}
            </DialogTitle>
          </DialogHeader>
          
          <DialogBody className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground">
                {CURRENCY.SYMBOL} {discountValue || '0'}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Enter discount amount
              </p>
            </div>
            
            <POSNumpad
              value={discountValue}
              onChange={setDiscountValue}
              allowDecimal={true}
              maxLength={8}
            />
          </DialogBody>
          <DialogFooter className="mt-4">
            <SecondaryButton onClick={() => setDiscountDialogOpen(false)}>
              Cancel
            </SecondaryButton>
            <Button onClick={handleApplyDiscount} className="bg-green-700 hover:bg-green-800">
              Apply Discount
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default POSCart;
