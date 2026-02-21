/**
 * Product QR code utilities
 *
 * Parses QR payloads (JSON) from product QR codes into form-ready shape.
 */

const num = (v: any): number => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const str = (v: any): string => (v != null && String(v).trim() ? String(v).trim() : '');

const bool = (v: any): boolean => v === true || v === 'true' || v === 1 || v === '1';

/**
 * Parse product data from QR code JSON string.
 * @param text - Raw QR content (typically JSON)
 * @returns Object with success flag and data or error
 */
export function parseProductQRPayload(text: string): { success: boolean; data?: any; error?: string } {
  if (!text || typeof text !== 'string') {
    return { success: false, error: 'Empty or invalid QR content' };
  }

  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    return { success: false, error: 'QR content is not valid JSON' };
  }

  if (!raw || typeof raw !== 'object') {
    return { success: false, error: 'QR content must be a JSON object' };
  }

  const o = raw.product && typeof raw.product === 'object' ? raw.product : raw;

  const name = str(o.name);
  if (!name) {
    return { success: false, error: 'Product name is required in QR data' };
  }

  const metadata = o.metadata && typeof o.metadata === 'object' ? o.metadata : {};

  const data = {
    id: str(o.id),
    name,
    sku: str(o.sku),
    barcode: str(o.barcode),
    description: str(o.description),
    imageUrl: str(o.imageUrl ?? o.image_url),
    costPrice: num(o.costPrice ?? o.cost_price),
    sellingPrice: num(o.sellingPrice ?? o.selling_price),
    quantityOnHand: num(o.quantityOnHand ?? o.quantity_on_hand),
    reorderLevel: num(o.reorderLevel ?? o.reorder_level),
    reorderQuantity: num(o.reorderQuantity ?? o.reorder_quantity),
    unit: str(o.unit) || 'pcs',
    brand: str(o.brand),
    supplier: str(o.supplier),
    categoryName: str(o.category ?? o.categoryName ?? o.category_name),
  };

  return { success: true, data };
}

/**
 * Check if scanned data is a product QR code (JSON) or a regular barcode
 */
export function isProductQRCode(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && (parsed.name || parsed.product?.name);
  } catch {
    return false;
  }
}
