/**
 * ReceiveStockModal – Receive stock into products via QR code, barcode scan, or search.
 * Flow: Scan product QR/barcode (or enter barcode or search) → confirm product → enter quantity received → add to stock.
 * Uses html5-qrcode for QR and barcode scanning.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SecondaryButton } from '@/components/ui/secondary-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Barcode, Camera, Loader2, Package, Search } from 'lucide-react';
import productService from '../services/productService';
import { parseProductQRPayload } from '../utils/productQR';
import { showSuccess, showError } from '../utils/toast';
import { numberInputValue } from '../utils/formUtils';

const SCANNER_ID = 'receive-stock-scanner';

/**
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {() => void} [onSuccess] – Called after adding stock (refresh list, etc.)
 */
export default function ReceiveStockModal({ open, onClose, onSuccess }) {
  const html5QrcodeRef = useRef(null);
  const [step, setStep] = useState('scan');
  const [product, setProduct] = useState(null);
  const [qtyReceived, setQtyReceived] = useState(1);
  const [loading, setLoading] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeLookupLoading, setBarcodeLookupLoading] = useState(false);

  const resetToScan = useCallback(() => {
    setStep('scan');
    setProduct(null);
    setQtyReceived(1);
    setScanError(null);
    setSearchQuery('');
    setSearchResults([]);
    setBarcodeInput('');
  }, []);

  useEffect(() => {
    if (!open) {
      resetToScan();
      return;
    }
    resetToScan();
  }, [open, resetToScan]);

  useEffect(() => {
    if (!open || step !== 'scan') return;

    let mounted = true;
    setCameraError(null);
    setIsStarting(true);

    const startScanner = async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        if (!mounted) return;

        const el = document.getElementById(SCANNER_ID);
        if (!el) {
          setCameraError('Scanner element not found');
          setIsStarting(false);
          return;
        }

        const html5Qrcode = new Html5Qrcode(SCANNER_ID, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
          ],
        });
        html5QrcodeRef.current = html5Qrcode;

        await html5Qrcode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 260, height: 260 },
            aspectRatio: 1.0,
          },
          async (decodedText) => {
            setScanError(null);
            const result = parseProductQRPayload(decodedText);
            let productResolved = null;
            if (result.success && result.data) {
              try {
                productResolved = await productService.resolveProductFromQRPayload(result.data);
              } catch (_) {}
            }
            if (!productResolved?.id) {
              try {
                const res = await productService.getProductByBarcode(decodedText.trim());
                productResolved = res?.data?.product ?? res?.product ?? res?.data ?? null;
              } catch (_) {}
            }
            if (!productResolved?.id) {
              setScanError(result.success ? 'Product not found for this QR code' : 'Product not found for this barcode');
              return;
            }
            if (navigator.vibrate) navigator.vibrate(100);
            setProduct(productResolved);
            setQtyReceived(1);
            setStep('confirm');
            if (html5QrcodeRef.current) {
              html5QrcodeRef.current.stop().catch(() => {});
              html5QrcodeRef.current = null;
            }
          },
          () => {}
        );

        setIsStarting(false);
      } catch (err) {
        if (!mounted) return;
        setCameraError(err?.message || 'Failed to access camera');
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
  }, [open, step]);

  const handleSearch = useCallback(async () => {
    const q = (searchQuery || '').trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setScanError(null);
    try {
      const res = await productService.getProducts({ search: q, limit: 20 });
      const body = res && typeof res === 'object' ? res : {};
      const list = Array.isArray(body.data) ? body.data : Array.isArray(body.products) ? body.products : [];
      setSearchResults(list);
    } catch (e) {
      showError(e, 'Search failed');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const handleBarcodeLookup = useCallback(async () => {
    const code = (barcodeInput || '').trim();
    if (!code) return;
    setBarcodeLookupLoading(true);
    setScanError(null);
    try {
      const res = await productService.getProductByBarcode(code);
      const p = res?.data?.product ?? res?.product ?? res?.data;
      if (p?.id) {
        if (navigator.vibrate) navigator.vibrate(100);
        setProduct(p);
        setQtyReceived(1);
        setStep('confirm');
        setBarcodeInput('');
      } else {
        setScanError('No product found for this barcode');
      }
    } catch (e) {
      setScanError('No product found for this barcode');
    } finally {
      setBarcodeLookupLoading(false);
    }
  }, [barcodeInput]);

  const selectProduct = useCallback((p) => {
    setProduct(p);
    setQtyReceived(1);
    setStep('confirm');
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  const handleAddToStock = useCallback(async () => {
    const qty = qtyReceived === '' ? 1 : Number(qtyReceived);
    if (!product?.id || !Number.isFinite(qty) || qty < 1) return;
    setLoading(true);
    try {
      await productService.adjustStock(product.id, qty, 'delta', 'Receive stock');
      const updated = parseFloat(product.quantityOnHand || 0) + qty;
      showSuccess(`Added ${qty} to ${product.name}. Stock now ${updated} ${product.unit || 'units'}.`);
      onSuccess?.();
      resetToScan();
      setStep('scan');
    } catch (e) {
      showError(e, 'Failed to add stock');
    } finally {
      setLoading(false);
    }
  }, [product, qtyReceived, onSuccess, resetToScan]);

  const handleAddAnother = useCallback(() => {
    resetToScan();
    setStep('scan');
  }, [resetToScan]);

  const handleDone = useCallback(() => {
    onClose();
  }, [onClose]);

  const displayQty = useMemo(() => {
    const n = parseFloat(product?.quantityOnHand);
    return Number.isFinite(n) ? n : 0;
  }, [product?.quantityOnHand]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:w-[var(--modal-w-sm)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {step === 'scan' ? 'Receive stock' : 'Confirm & add'}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
        {step === 'scan' && (
          <div className="space-y-4">
            {cameraError ? (
              <div className="p-4 bg-red-50 rounded-lg text-center border border-red-200">
                <p className="text-red-700 font-medium">Camera error</p>
                <p className="text-sm text-red-600 mt-1">{cameraError}</p>
              </div>
            ) : (
              <>
                <div className="relative w-full rounded-lg overflow-hidden min-h-[200px] bg-muted border border-border">
                  {isStarting && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-10">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-brand mx-auto" />
                        <p className="text-sm text-gray-600 mt-2">Starting camera...</p>
                      </div>
                    </div>
                  )}
                  <div id={SCANNER_ID} className="w-full min-h-[200px]" />
                </div>
                {scanError && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-center">
                    <p className="text-sm text-amber-800">{scanError}</p>
                  </div>
                )}
                <p className="text-sm text-gray-500 text-center">
                  Scan product QR code or barcode, or enter barcode / search below.
                </p>

                <div className="border-t border-gray-200 pt-4 space-y-3">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Barcode className="h-4 w-4" />
                      Enter barcode
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type or paste barcode number..."
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleBarcodeLookup())}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleBarcodeLookup}
                        loading={barcodeLookupLoading}
                        disabled={!barcodeInput.trim()}
                      >
                        Look up
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Search by name or SKU</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search product..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
                      />
                      <SecondaryButton type="button" size="icon" onClick={handleSearch} loading={searching}>
                        <Search className="h-4 w-4" />
                      </SecondaryButton>
                    </div>
                    {searchResults.length > 0 && (
                      <ul className="border border-gray-200 rounded-lg divide-y max-h-40 overflow-y-auto">
                        {searchResults.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                              onClick={() => selectProduct(p)}
                            >
                              <span className="font-medium">{p.name}</span>
                              {p.sku && <span className="text-gray-500 ml-2">({p.sku})</span>}
                              {p.barcode && <span className="text-gray-400 ml-2">· {p.barcode}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )}
            <div className="flex justify-end">
              <SecondaryButton onClick={onClose}>
                Cancel
              </SecondaryButton>
            </div>
          </div>
        )}

        {step === 'confirm' && product && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg border border-border bg-muted">
              <p className="font-medium">{product.name}</p>
              {product.sku && <p className="text-sm text-gray-500">SKU: {product.sku}</p>}
              {product.barcode && <p className="text-sm text-gray-500">Barcode: {product.barcode}</p>}
              {product.trackStock === false ? (
                <p className="text-sm mt-1 text-amber-700">
                  Made to order – stock is not tracked. Cannot receive stock.
                </p>
              ) : (
                <p className="text-sm mt-1">
                  Current stock: {displayQty.toLocaleString()} {product.unit || 'units'}
                </p>
              )}
            </div>
            {product.trackStock !== false && (
            <div className="space-y-2">
              <Label htmlFor="receive-qty">Quantity received</Label>
              <Input
                id="receive-qty"
                type="number"
                min={1}
                value={numberInputValue(qtyReceived)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || v === null) {
                    setQtyReceived('');
                    return;
                  }
                  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''), 10);
                  setQtyReceived(Number.isFinite(n) && n >= 1 ? n : '');
                }}
              />
            </div>
            )}
            <div className="flex flex-wrap gap-2 justify-end">
              <SecondaryButton onClick={handleAddAnother} disabled={loading}>
                Add another
              </SecondaryButton>
              <SecondaryButton onClick={handleDone} disabled={loading}>
                Done
              </SecondaryButton>
              {product.trackStock !== false && (
              <Button onClick={handleAddToStock} loading={loading}>
                Add to stock
              </Button>
              )}
            </div>
          </div>
        )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
