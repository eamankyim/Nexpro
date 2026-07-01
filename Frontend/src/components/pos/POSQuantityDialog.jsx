/**
 * Dialog for entering cart item quantity directly in POS.
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { SecondaryButton } from '@/components/ui/secondary-button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import POSNumpad from './POSNumpad';
import { getMaxQuantityForCartItem, validateCartQuantityInput } from '../../utils/cartQuantity';

/**
 * @param {Object} props
 * @param {boolean} props.open
 * @param {function} props.onOpenChange
 * @param {{ id: string, name?: string, quantity?: number, trackStock?: boolean, quantityOnHand?: number | null } | null} props.item
 * @param {function} props.onApply - (itemId, quantity) => void; quantity 0 removes the line
 */
const POSQuantityDialog = ({ open, onOpenChange, item, onApply }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && item) {
      setValue(String(Number(item.quantity) || 1));
      setError('');
    }
  }, [open, item]);

  const maxQty = item ? getMaxQuantityForCartItem(item) : null;

  const handleValueChange = useCallback((nextValue) => {
    setValue(nextValue);
    setError('');
  }, []);

  const handleApply = useCallback(() => {
    if (!item) return;
    const result = validateCartQuantityInput(value, item);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    onApply(item.id, result.quantity);
    onOpenChange(false);
  }, [item, value, onApply, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:w-[var(--modal-w-sm)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)]">
        <DialogHeader>
          <DialogTitle>Quantity for {item?.name}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-foreground">{value || '0'}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {maxQty !== null ? `In stock: ${maxQty}` : 'Enter quantity (0 removes item)'}
            </p>
            {error ? (
              <p className="text-sm text-red-600 mt-2">{error}</p>
            ) : null}
          </div>

          <POSNumpad
            value={value}
            onChange={handleValueChange}
            allowDecimal={false}
            maxLength={6}
          />
        </DialogBody>

        <DialogFooter className="mt-4">
          <SecondaryButton onClick={() => onOpenChange(false)}>
            Cancel
          </SecondaryButton>
          <Button onClick={handleApply} className="bg-green-700 hover:bg-green-800">
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default POSQuantityDialog;
