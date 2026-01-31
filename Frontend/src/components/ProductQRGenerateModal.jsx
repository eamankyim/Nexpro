/**
 * ProductQRGenerateModal – Generate QR from product, download PNG, or print label.
 * Uses qrcode.toDataURL and buildProductQRPayload.
 */

import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Package, Download, Printer, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import { buildProductQRPayload } from '../utils/productQR';

/**
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {Object} product - Product (name, sku, barcode, etc.)
 */
export default function ProductQRGenerateModal({ open, onClose, product }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !product?.name) {
      setDataUrl(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const payload = buildProductQRPayload(product);
    QRCode.toDataURL(payload, { width: 280, margin: 2 })
      .then((url) => {
        setDataUrl(url);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message || 'Failed to generate QR');
        setLoading(false);
      });
  }, [open, product]);

  const handleDownload = useCallback(() => {
    if (!dataUrl || !product?.name) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qr-${(product.name || 'product').replace(/[^a-z0-9_-]/gi, '-').toLowerCase()}.png`;
    a.click();
  }, [dataUrl, product?.name]);

  const handlePrintLabel = useCallback(() => {
    if (!dataUrl || !product) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const name = product.name || 'Product';
    const sku = product.sku ? `SKU: ${product.sku}` : '';
    w.document.write(`
      <!DOCTYPE html>
      <html>
        <head><title>Label - ${name}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 24px; margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
            .name { font-size: 18px; font-weight: 600; margin-bottom: 4px; text-align: center; }
            .sku { font-size: 12px; color: #666; margin-bottom: 12px; }
            img { display: block; }
          </style>
        </head>
        <body>
          <div class="name">${name.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          ${sku ? `<div class="sku">${sku.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
          <img src="${dataUrl}" alt="QR" width="200" height="200" />
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
      w.onafterprint = () => w.close();
    }, 300);
  }, [dataUrl, product]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:w-[var(--modal-w-sm)] sm:min-h-[var(--modal-min-h)] sm:max-h-[var(--modal-max-h)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Product QR code
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {product?.name && (
            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
              <p className="font-medium">{product.name}</p>
              {product.sku && <p className="text-sm text-gray-500">SKU: {product.sku}</p>}
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[#166534]" />
              <p className="text-sm text-gray-500 mt-2">Generating QR…</p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && dataUrl && (
            <div className="flex flex-col items-center">
              <img src={dataUrl} alt="QR code" className="rounded border border-gray-200" width={200} height={200} />
              <p className="text-sm text-gray-500 mt-2">Scan to fill product form or share details</p>
            </div>
          )}

          {!loading && dataUrl && (
            <div className="flex flex-wrap gap-2 justify-end">
              <SecondaryButton onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download PNG
              </SecondaryButton>
              <SecondaryButton onClick={handlePrintLabel}>
                <Printer className="h-4 w-4 mr-2" />
                Print label
              </SecondaryButton>
              <Button onClick={onClose}>Done</Button>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
