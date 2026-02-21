/**
 * Product QR code utilities
 *
 * Parses QR payloads (JSON) from product QR codes into form-ready shape.
 *
 * Expected QR format: JSON string. Required: "name". Optional: sku, barcode,
 * description, imageUrl, costPrice, sellingPrice, unit, brand, category/categoryName,
 * quantityOnHand, reorderLevel, reorderQuantity, expiryDate, batchNumber, etc.
 * Supports flat { name, sku, ... } or nested { product: { name, sku, ... } }.
 *
 * Example: {"name":"Widget","sku":"W-1","imageUrl":"https://...","costPrice":10,"sellingPrice":15,"unit":"pcs","category":"Electronics"}
 */

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const str = (v) => (v != null && String(v).trim() ? String(v).trim() : '');

const bool = (v) => v === true || v === 'true' || v === 1 || v === '1';

/**
 * Parse product data from QR code JSON string.
 * @param {string} text - Raw QR content (typically JSON)
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
export function parseProductQRPayload(text) {
  if (!text || typeof text !== 'string') {
    return { success: false, error: 'Empty or invalid QR content' };
  }

  let raw;
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
    hasVariants: bool(o.hasVariants ?? o.has_variants),
    isActive: o.isActive === undefined && o.is_active === undefined ? true : bool(o.isActive ?? o.is_active),
    categoryName: str(o.category ?? o.categoryName ?? o.category_name),
    // Metadata
    expiryDate: str(o.expiryDate ?? o.expiry_date ?? metadata.expiryDate ?? metadata.expiry_date),
    batchNumber: str(o.batchNumber ?? o.batch_number ?? metadata.batchNumber ?? metadata.batch_number),
    isPerishable: bool(o.isPerishable ?? o.is_perishable ?? metadata.isPerishable ?? metadata.is_perishable),
    serialNumber: str(o.serialNumber ?? o.serial_number ?? metadata.serialNumber ?? metadata.serial_number),
    warrantyPeriod: num(o.warrantyPeriod ?? o.warranty_period ?? metadata.warrantyPeriod ?? metadata.warranty_period),
    specifications: str(o.specifications ?? metadata.specifications),
    dimensions: str(o.dimensions ?? metadata.dimensions),
    weight: str(o.weight ?? metadata.weight),
    material: str(o.material ?? metadata.material),
    partNumber: str(o.partNumber ?? o.part_number ?? metadata.partNumber ?? metadata.part_number),
    compatibility: str(o.compatibility ?? metadata.compatibility),
    vehicleModels: str(o.vehicleModels ?? o.vehicle_models ?? metadata.vehicleModels ?? metadata.vehicle_models),
    isbn: str(o.isbn ?? metadata.isbn),
    author: str(o.author ?? metadata.author),
    publisher: str(o.publisher ?? metadata.publisher),
    assemblyRequired: bool(o.assemblyRequired ?? o.assembly_required ?? metadata.assemblyRequired ?? metadata.assembly_required),
  };

  return { success: true, data };
}

/** Max chars for fields in QR payload to avoid exceeding QR capacity (~400–700 chars safe). */
const MAX_NAME_LEN = 60;
const MAX_SKU_LEN = 40;
const MAX_BARCODE_LEN = 30;

/**
 * Build minimal JSON payload for product QR code.
 * Only includes id, name, sku, barcode to stay within QR capacity.
 * POS lookup uses id first, then barcode, sku, name. Long fields (description, imageUrl) are excluded.
 * @param {Object} product - Product from API (name required; sku, barcode, etc. optional)
 * @returns {string} JSON string (no whitespace) to encode as QR
 */
export function buildProductQRPayload(product) {
  if (!product || typeof product !== 'object') return '{}';
  const s = (v, max) => {
    const t = v != null && String(v).trim() ? String(v).trim() : '';
    return max ? t.slice(0, max) : t;
  };
  const payload = {
    id: product.id ? String(product.id) : '',
    name: s(product.name, MAX_NAME_LEN) || 'Product',
    sku: s(product.sku, MAX_SKU_LEN),
    barcode: s(product.barcode, MAX_BARCODE_LEN),
  };
  const filtered = {};
  Object.entries(payload).forEach(([k, v]) => {
    if (v !== '' && v !== null && v !== undefined) filtered[k] = v;
  });
  return JSON.stringify(filtered);
}
