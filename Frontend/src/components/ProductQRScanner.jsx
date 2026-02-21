/**
 * ProductQRScanner – Scan QR codes containing product JSON to populate the product form.
 * Uses html5-qrcode. Single-shot: one scan then close.
 */

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SecondaryButton } from '@/components/ui/secondary-button';
import { Camera, Loader2, AlertCircle } from 'lucide-react';
import { parseProductQRPayload } from '../utils/productQR';

/**
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {(data: object) => void} onProductData - Called with parsed product data on success
 */
export default function ProductQRScanner({ open, onClose, onProductData }) {
  const scannerRef = useRef(null);
  const html5QrcodeRef = useRef(null);
  const [error, setError] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [parseError, setParseError] = useState(null);

  useEffect(() => {
    if (!open) return;

    let mounted = true;
    setIsStarting(true);
    setError(null);
    setParseError(null);

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted) return;

        const el = document.getElementById('product-qr-scanner');
        if (!el) {
          setError('Scanner element not found');
          setIsStarting(false);
          return;
        }

        const html5Qrcode = new Html5Qrcode('product-qr-scanner');
        html5QrcodeRef.current = html5Qrcode;

        await html5Qrcode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 260, height: 260 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            const result = parseProductQRPayload(decodedText);
            if (!result.success) {
              setParseError(result.error || 'Invalid product QR');
              return;
            }
            try {
              if (navigator.vibrate) navigator.vibrate(100);
            } catch (_) {}
            onProductData(result.data);
            onClose();
          },
          () => {}
        );

        setIsStarting(false);
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || 'Failed to access camera');
        setIsStarting(false);
      }
    };

    startScanner();

    return () => {
      mounted = false;
      if (html5QrcodeRef.current) {
        html5QrcodeRef.current.stop().catch(() => {});
        html5QrcodeRef.current = null;
      }
    };
  }, [open, onClose, onProductData]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:w-[var(--modal-w-sm)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Scan product QR code
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
        <div className="space-y-4">
          {error ? (
            <div className="p-4 bg-red-50 rounded-lg text-center border border-red-200">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-700 font-medium">Camera error</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
              <p className="text-xs text-gray-500 mt-2">Grant camera access and try again.</p>
            </div>
          ) : (
            <>
              <div className="relative w-full rounded-lg overflow-hidden min-h-[260px] bg-muted border border-border">
                {isStarting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-10">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-[#166534] mx-auto" />
                      <p className="text-sm text-gray-600 mt-2">Starting camera...</p>
                    </div>
                  </div>
                )}
                <div id="product-qr-scanner" ref={scannerRef} className="w-full min-h-[260px]" />
              </div>
              {parseError && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-center">
                  <p className="text-sm text-amber-800">{parseError}</p>
                  <p className="text-xs text-amber-600 mt-1">Scan a valid product QR code.</p>
                </div>
              )}
              <p className="text-sm text-gray-500 text-center">
                Point your camera at the product QR code. Form will fill automatically.
              </p>
            </>
          )}
        </div>

        <div className="flex justify-center">
          <SecondaryButton onClick={onClose}>
            Cancel
          </SecondaryButton>
        </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
