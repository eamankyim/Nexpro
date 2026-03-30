/**
 * POSNumpad Component
 *
 * Numeric keypad for quantity and cash entry in the POS.
 * Usable on phone, tablet, or laptop.
 */

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Delete, Check } from 'lucide-react';

/**
 * Numeric keypad for POS input
 * @param {Object} props
 * @param {string} props.value - Current value
 * @param {function} props.onChange - Called when value changes
 * @param {function} [props.onConfirm] - Called when confirm is pressed
 * @param {boolean} [props.allowDecimal] - Allow decimal input (default true)
 * @param {number} [props.maxLength] - Maximum input length
 * @param {string} [props.className] - Additional CSS classes
 */
const POSNumpad = ({ 
  value = '', 
  onChange, 
  onConfirm,
  allowDecimal = true,
  maxLength = 10,
  className = ''
}) => {
  const handleKeyPress = useCallback((key) => {
    if (key === 'C') {
      onChange('');
      return;
    }
    
    if (key === 'DEL') {
      onChange(value.slice(0, -1));
      return;
    }
    
    if (key === '.' && !allowDecimal) return;
    if (key === '.' && value.includes('.')) return;
    if (value.length >= maxLength) return;
    
    // Prevent leading zeros (except for decimals)
    if (key === '0' && value === '0') return;
    if (value === '0' && key !== '.') {
      onChange(key);
      return;
    }
    
    onChange(value + key);
  }, [value, onChange, allowDecimal, maxLength]);

  const keys = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    [allowDecimal ? '.' : 'C', '0', 'DEL']
  ];

  return (
    <div className={`grid gap-2 ${className}`}>
      {keys.map((row, rowIndex) => (
        <div key={rowIndex} className="grid grid-cols-3 gap-2">
          {row.map((key) => (
            <Button
              key={key}
              variant={key === 'C' ? 'destructive' : key === 'DEL' ? 'outline' : 'secondary'}
              className="h-14 text-xl font-semibold"
              onClick={() => handleKeyPress(key)}
            >
              {key === 'DEL' ? <Delete className="h-5 w-5" /> : key}
            </Button>
          ))}
        </div>
      ))}
      
      {/* Clear and Confirm row */}
      <div className="grid grid-cols-2 gap-2 mt-2">
        <Button
          variant="outline"
          className="h-14 text-lg font-semibold"
          onClick={() => onChange('')}
        >
          Clear
        </Button>
        {onConfirm && (
          <Button
            variant="default"
            className="h-14 text-lg font-semibold bg-green-700 hover:bg-green-800"
            onClick={onConfirm}
          >
            <Check className="h-5 w-5 mr-2" />
            Confirm
          </Button>
        )}
      </div>
    </div>
  );
};

export default POSNumpad;
