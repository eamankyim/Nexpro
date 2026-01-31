/**
 * POSReceiptModal Component
 * 
 * Receipt delivery options modal with support for:
 * - Print receipt
 * - SMS receipt
 * - WhatsApp receipt
 * - Email receipt
 * 
 * Optimized for African context with SMS as primary delivery method.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { 
  Printer, 
  MessageSquare, 
  Mail, 
  Check, 
  Loader2,
  Phone,
  AlertCircle,
  CheckCircle,
  Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import PrintableReceipt from '../PrintableReceipt';
import { CURRENCY } from '../../constants';
import { showSuccess, showError } from '../../utils/toast';
import { normalizePhone, validatePhone } from '../../utils/phoneUtils';

/**
 * Format currency value
 */
const formatCurrency = (amount) => {
  return `${CURRENCY.SYMBOL} ${(amount || 0).toFixed(CURRENCY.DECIMAL_PLACES)}`;
};

/**
 * Delivery option checkbox
 */
const DeliveryOption = ({ 
  id, 
  icon: Icon, 
  label, 
  description, 
  checked, 
  onChange, 
  disabled,
  status 
}) => {
  return (
    <div 
      className={`
        p-4 rounded-lg border-2 cursor-pointer transition-all
        ${checked 
          ? 'bg-green-50 border-green-500' 
          : 'bg-white border-gray-200 hover:border-green-300'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onClick={() => !disabled && onChange(!checked)}
    >
      <div className="flex items-start gap-3">
        <Checkbox 
          id={id} 
          checked={checked} 
          disabled={disabled}
          className="mt-0.5"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${checked ? 'text-green-600' : 'text-gray-500'}`} />
            <Label 
              htmlFor={id} 
              className={`font-medium cursor-pointer ${checked ? 'text-green-700' : 'text-gray-900'}`}
            >
              {label}
            </Label>
            {status === 'sent' && (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            {status === 'sending' && (
              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
            )}
            {status === 'failed' && (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
};

/**
 * Main POSReceiptModal component
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {function} props.onClose - Called to close the modal
 * @param {Object} props.sale - The completed sale object
 * @param {Object} [props.customer] - Customer object
 * @param {Object} props.organizationSettings - Organization settings for receipt
 * @param {function} props.onSendReceipt - Called to send receipt via selected channels
 */
const POSReceiptModal = ({
  isOpen,
  onClose,
  sale,
  customer,
  organizationSettings,
  onSendReceipt
}) => {
  const printRef = useRef(null);
  
  // Delivery options state
  const [deliveryOptions, setDeliveryOptions] = useState({
    print: false,
    sms: true, // Default to SMS for African context
    whatsapp: false,
    email: false
  });

  // Contact info state
  const [phone, setPhone] = useState(customer?.phone || '');
  const [email, setEmail] = useState(customer?.email || '');

  // Sending state
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState({
    print: null,
    sms: null,
    whatsapp: null,
    email: null
  });

  // Validation (phone: African formats 0XX / +233)
  const needsPhone = deliveryOptions.sms || deliveryOptions.whatsapp;
  const needsEmail = deliveryOptions.email;
  const phoneValidation = validatePhone(phone);
  const isPhoneValid = !needsPhone || (phone.trim() && phoneValidation.valid);
  const isEmailValid = !needsEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const hasSelectedOption = Object.values(deliveryOptions).some(v => v);
  const canSend = hasSelectedOption && isPhoneValid && isEmailValid;

  // Toggle delivery option
  const toggleOption = useCallback((option, value) => {
    setDeliveryOptions(prev => ({ ...prev, [option]: value }));
  }, []);

  // Handle print
  const handlePrint = useCallback(() => {
    if (printRef.current) {
      const printContent = printRef.current.innerHTML;
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Receipt - ${sale?.saleNumber || ''}</title>
            <style>
              body { font-family: 'Courier New', monospace; padding: 20px; }
              @media print {
                body { padding: 0; }
              }
            </style>
          </head>
          <body>${printContent}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }, [sale]);

  // Handle send receipt
  const handleSendReceipt = useCallback(async () => {
    setIsSending(true);
    const channels = [];
    const results = { ...sendStatus };

    try {
      // Handle print
      if (deliveryOptions.print) {
        setSendStatus(prev => ({ ...prev, print: 'sending' }));
        try {
          handlePrint();
          results.print = 'sent';
        } catch (err) {
          results.print = 'failed';
        }
      }

      // Prepare channels for API call
      if (deliveryOptions.sms) channels.push('sms');
      if (deliveryOptions.whatsapp) channels.push('whatsapp');
      if (deliveryOptions.email) channels.push('email');

      // Send via API
      if (channels.length > 0) {
        channels.forEach(ch => {
          setSendStatus(prev => ({ ...prev, [ch]: 'sending' }));
        });

        try {
          await onSendReceipt({
            saleId: sale.id,
            channels,
            phone: needsPhone ? (normalizePhone(phone) || phone) : undefined,
            email: needsEmail ? email : undefined
          });

          channels.forEach(ch => {
            results[ch] = 'sent';
          });

          showSuccess(`Receipt sent via ${channels.join(', ')}`);
        } catch (err) {
          channels.forEach(ch => {
            results[ch] = 'failed';
          });
          showError(`Failed to send receipt: ${err.message}`);
        }
      }

      setSendStatus(results);

      // Auto-close after success
      const allSent = Object.entries(results)
        .filter(([key, val]) => deliveryOptions[key])
        .every(([key, val]) => val === 'sent');

      if (allSent) {
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } finally {
      setIsSending(false);
    }
  }, [deliveryOptions, phone, email, sale, needsPhone, needsEmail, handlePrint, onSendReceipt, onClose, sendStatus]);

  // Skip receipt and close
  const handleSkip = useCallback(() => {
    onClose();
  }, [onClose]);

  // Receipt data for preview
  const receiptData = useMemo(() => {
    if (!sale) return null;
    return {
      ...sale,
      customer,
      organization: organizationSettings
    };
  }, [sale, customer, organizationSettings]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:w-[var(--modal-w-md)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Sale Complete!
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
        {/* Sale summary */}
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Sale Number</span>
              <span className="font-mono font-medium">{sale?.saleNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Amount</span>
              <span className="text-xl font-bold text-green-700">
                {formatCurrency(sale?.total)}
              </span>
            </div>
            {sale?.change > 0 && (
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-green-200">
                <span className="text-gray-600">Change Given</span>
                <span className="font-medium text-orange-600">
                  {formatCurrency(sale?.change)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Delivery options */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Send Receipt</h4>
          
          <DeliveryOption
            id="print"
            icon={Printer}
            label="Print Receipt"
            description="Print a physical receipt"
            checked={deliveryOptions.print}
            onChange={(v) => toggleOption('print', v)}
            status={sendStatus.print}
          />

          <DeliveryOption
            id="sms"
            icon={MessageSquare}
            label="SMS Receipt"
            description="Send receipt via SMS"
            checked={deliveryOptions.sms}
            onChange={(v) => toggleOption('sms', v)}
            status={sendStatus.sms}
          />

          <DeliveryOption
            id="whatsapp"
            icon={Phone}
            label="WhatsApp Receipt"
            description="Send receipt via WhatsApp"
            checked={deliveryOptions.whatsapp}
            onChange={(v) => toggleOption('whatsapp', v)}
            status={sendStatus.whatsapp}
          />

          <DeliveryOption
            id="email"
            icon={Mail}
            label="Email Receipt"
            description="Send receipt via email"
            checked={deliveryOptions.email}
            onChange={(v) => toggleOption('email', v)}
            status={sendStatus.email}
          />
        </div>

        {/* Contact inputs */}
        {needsPhone && (
          <div>
            <Label>Phone Number</Label>
            <Input
              type="tel"
              placeholder="0XX XXX XXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-12 mt-2"
            />
            {!isPhoneValid && phone.length > 0 && (
              <p className="text-sm text-red-500 mt-1">
                {phoneValidation.error || 'Please enter a valid phone (e.g. 0XX XXX XXXX or +233 XX XXX XXXX)'}
              </p>
            )}
          </div>
        )}

        {needsEmail && (
          <div>
            <Label>Email Address</Label>
            <Input
              type="email"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 mt-2"
            />
            {!isEmailValid && email.length > 0 && (
              <p className="text-sm text-red-500 mt-1">
                Please enter a valid email address
              </p>
            )}
          </div>
        )}

        {/* Hidden printable receipt */}
        <div className="hidden">
          <div ref={printRef}>
            {receiptData && (
              <PrintableReceipt
                sale={receiptData}
                organization={organizationSettings}
              />
            )}
          </div>
        </div>
        </DialogBody>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={isSending}
            className="w-full sm:w-auto"
          >
            Skip
          </Button>
          <Button
            onClick={handleSendReceipt}
            disabled={!canSend}
            loading={isSending}
            className="w-full sm:w-auto bg-green-700 hover:bg-green-800"
          >
            <>
              <Send className="h-4 w-4 mr-2" />
              Send Receipt
            </>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default POSReceiptModal;
