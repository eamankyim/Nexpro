import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import productService from '../services/productService';
import { getErrorMessage, showError, showSuccess } from '../utils/toast';

const EMPTY_VARIANT_VALUE = '__none__';

export default function StockTransferModal({
  open,
  onClose,
  onSuccess,
  initialProduct = null,
  selectedProducts = [],
  bulkMode = 'single', // single | selected | all
  sourceShopId = null,
  availableShops = [],
  activeShopId = null,
}) {
  const [sourceProduct, setSourceProduct] = useState(initialProduct);
  const [sourceProductId, setSourceProductId] = useState(initialProduct?.id || '');
  const [productQuery, setProductQuery] = useState('');
  const [productOptions, setProductOptions] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [destinationShopId, setDestinationShopId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [sourceVariantId, setSourceVariantId] = useState(EMPTY_VARIANT_VALUE);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    setSourceProduct(initialProduct || null);
    setSourceProductId(initialProduct?.id || '');
    setProductQuery('');
    setProductOptions([]);
    setDestinationShopId('');
    setQuantity('1');
    setReason('');
    setNotes('');
    setSourceVariantId(EMPTY_VARIANT_VALUE);
  }, [open, initialProduct]);

  const isBulkSelected = bulkMode === 'selected';
  const isBulkAll = bulkMode === 'all';
  const isBulkMode = isBulkSelected || isBulkAll;

  const fetchSourceProduct = useCallback(async (productId) => {
    if (!productId) return;
    try {
      const response = await productService.getProductById(productId);
      const product = response?.data || response;
      setSourceProduct(product || null);
    } catch (error) {
      showError(error, 'Failed to load product details');
    }
  }, []);

  const handleSearchProducts = useCallback(async () => {
    const query = productQuery.trim();
    if (!query) {
      setProductOptions([]);
      return;
    }
    setLoadingProducts(true);
    try {
      const response = await productService.getProducts({ search: query, limit: 20 });
      const list = Array.isArray(response?.data) ? response.data : [];
      setProductOptions(list);
    } catch (error) {
      showError(error, 'Failed to search products');
      setProductOptions([]);
    } finally {
      setLoadingProducts(false);
    }
  }, [productQuery]);

  const sourceVariants = useMemo(() => {
    if (isBulkMode) return [];
    if (!Array.isArray(sourceProduct?.variants)) return [];
    return sourceProduct.variants.filter((variant) => variant?.isActive !== false);
  }, [isBulkMode, sourceProduct]);

  const sourceStock = useMemo(() => {
    if (isBulkMode) return 0;
    if (!sourceProduct) return 0;
    if (sourceVariantId !== EMPTY_VARIANT_VALUE) {
      const variant = sourceVariants.find((v) => v.id === sourceVariantId);
      return Number.parseFloat(variant?.quantityOnHand || 0);
    }
    return Number.parseFloat(sourceProduct?.quantityOnHand || 0);
  }, [isBulkMode, sourceProduct, sourceVariantId, sourceVariants]);

  const destinationOptions = useMemo(() => {
    const resolvedSourceShopId = sourceShopId || sourceProduct?.shopId || activeShopId || null;
    return (availableShops || []).filter((shop) => shop.id !== resolvedSourceShopId);
  }, [availableShops, sourceShopId, sourceProduct?.shopId, activeShopId]);

  const handleSubmit = useCallback(async () => {
    if (!isBulkMode && !sourceProduct?.id) {
      showError('Select a source product first');
      return;
    }
    if (!destinationShopId) {
      showError('Select a destination shop');
      return;
    }

    const parsedQty = Number.parseFloat(quantity);
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      showError('Enter a valid quantity greater than zero');
      return;
    }
    if (!isBulkMode && parsedQty > sourceStock) {
      showError(`Transfer quantity cannot exceed source stock (${sourceStock})`);
      return;
    }

    setSubmitting(true);
    try {
      if (isBulkMode) {
        const resolvedSourceShopId = sourceShopId || sourceProduct?.shopId || activeShopId;
        const payload = {
          sourceShopId: resolvedSourceShopId,
          destinationShopId,
          quantity: parsedQty,
          mode: isBulkAll ? 'all' : 'selected',
          productIds: isBulkSelected ? selectedProducts.map((product) => product.id) : undefined,
          reason: reason.trim() || undefined,
          notes: notes.trim() || undefined,
        };

        const response = await productService.createBulkStockTransfer(payload);
        const summary = response?.data ?? response;
        showSuccess(
          `Bulk transfer complete: ${summary?.transferredCount || 0} transferred, ${summary?.skippedCount || 0} skipped`
        );
      } else {
        await productService.createStockTransfer({
          sourceShopId: sourceProduct.shopId || activeShopId,
          destinationShopId,
          sourceProductId: sourceProduct.id,
          sourceVariantId: sourceVariantId === EMPTY_VARIANT_VALUE ? undefined : sourceVariantId,
          quantity: parsedQty,
          reason: reason.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        showSuccess('Stock transferred successfully');
      }
      onSuccess?.();
      onClose?.();
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to transfer stock'));
    } finally {
      setSubmitting(false);
    }
  }, [
    sourceProduct,
    destinationShopId,
    quantity,
    sourceStock,
    sourceVariantId,
    reason,
    notes,
    activeShopId,
    sourceShopId,
    isBulkMode,
    isBulkAll,
    isBulkSelected,
    selectedProducts,
    onSuccess,
    onClose,
  ]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose?.()}>
      <DialogContent className="sm:w-[var(--modal-w-sm)]">
        <DialogHeader>
          <DialogTitle>{isBulkMode ? 'Bulk Transfer Stock' : 'Transfer Stock'}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            {!initialProduct?.id && !isBulkMode && (
              <div className="space-y-2">
                <Label>Source product</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search product name, SKU, or barcode"
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearchProducts())}
                  />
                  <Button type="button" variant="outline" onClick={handleSearchProducts} disabled={loadingProducts}>
                    {loadingProducts ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                  </Button>
                </div>
                {!!productOptions.length && (
                  <Select
                    value={sourceProductId}
                    onValueChange={(value) => {
                      setSourceProductId(value);
                      fetchSourceProduct(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source product" />
                    </SelectTrigger>
                    <SelectContent>
                      {productOptions.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} ({product.shop?.name || 'No shop'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {isBulkMode ? (
              <div className="rounded-md border p-3 text-sm space-y-1">
                <p className="font-medium">
                  {isBulkAll
                    ? 'All eligible products in source shop'
                    : `${selectedProducts.length} selected product(s)`}
                </p>
                <p className="text-muted-foreground">
                  Shared quantity will be applied per product. If stock is lower, available quantity is transferred.
                </p>
              </div>
            ) : sourceProduct?.id ? (
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">{sourceProduct.name}</p>
                <p className="text-muted-foreground">
                  Source shop: {sourceProduct.shop?.name || 'Current shop'}
                </p>
              </div>
            ) : null}

            {sourceVariants.length > 0 && !isBulkMode && (
              <div className="space-y-2">
                <Label>Variant (optional)</Label>
                <Select value={sourceVariantId} onValueChange={setSourceVariantId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose variant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY_VARIANT_VALUE}>No variant (base product)</SelectItem>
                    {sourceVariants.map((variant) => (
                      <SelectItem key={variant.id} value={variant.id}>
                        {variant.name} ({variant.quantityOnHand || 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Destination shop</Label>
              <Select value={destinationShopId} onValueChange={setDestinationShopId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination shop" />
                </SelectTrigger>
                <SelectContent>
                  {destinationOptions.map((shop) => (
                    <SelectItem key={shop.id} value={shop.id}>
                      {shop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {isBulkMode
                  ? 'Applied per product in this batch.'
                  : `Available in source: ${sourceStock} ${sourceProduct?.unit || 'pcs'}`}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Restock branch, demand balancing..."
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Extra details for audit trail"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                loading={submitting}
                disabled={(!sourceProduct?.id && !isBulkMode) || !destinationShopId}
              >
                {isBulkMode ? 'Transfer Bulk' : 'Transfer'}
              </Button>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
