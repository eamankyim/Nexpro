const pickTrimmed = (...values) => (
  values
    .map((value) => (value == null ? '' : String(value).trim()))
    .find(Boolean) || ''
);

/**
 * First active alternate barcode on a product or variant record.
 * @param {Object|null|undefined} record
 * @returns {string}
 */
const getAlternateBarcodeFromRecord = (record) => {
  if (!record || typeof record !== 'object') return '';

  const aliases = record.barcodeAliases;
  if (Array.isArray(aliases) && aliases.length > 0) {
    const alias = pickTrimmed(...aliases);
    if (alias) return alias;
  }

  const barcodes = record.barcodes;
  if (!Array.isArray(barcodes)) return '';

  const active = barcodes.find((entry) => entry && entry.isActive !== false && entry.barcode);
  return active?.barcode ? String(active.barcode).trim() : '';
};

/**
 * Resolve unit symbol for a document line item.
 * @param {Object} item
 * @param {{ product?: Object, variant?: Object, saleItem?: Object }} [context]
 * @returns {string}
 */
const getLineItemUnitSymbol = (item, context = {}) => {
  const { product, variant, saleItem } = context;
  const metadata = item?.metadata && typeof item.metadata === 'object' ? item.metadata : {};
  const saleMetadata = saleItem?.metadata && typeof saleItem.metadata === 'object'
    ? saleItem.metadata
    : {};
  const specifications = item?.specifications && typeof item.specifications === 'object'
    ? item.specifications
    : {};

  return pickTrimmed(
    item?.unitSymbol,
    item?.unit,
    metadata.unitSymbol,
    metadata.unit,
    saleMetadata.unitSymbol,
    saleMetadata.unit,
    specifications.unitSymbol,
    specifications.unit,
    specifications.itemUnit,
    item?.itemUnit,
    variant?.unit,
    product?.unit,
  );
};

/**
 * Resolve product code for invoice/quote/receipt line items.
 * Prefers explicit item metadata, then alternate barcodes, then sku/primary barcode.
 * @param {{ item?: Object, saleItem?: Object, product?: Object, variant?: Object }} context
 * @returns {string}
 */
const resolveDocumentLineItemProductCode = ({ item, saleItem, product, variant } = {}) => (
  pickTrimmed(
    item?.metadata?.productCode,
    item?.productCode,
    item?.code,
    item?.metadata?.barcode,
    item?.barcode,
    item?.sku,
    item?.metadata?.sku,
    saleItem?.metadata?.productCode,
    saleItem?.productCode,
    getAlternateBarcodeFromRecord(variant),
    getAlternateBarcodeFromRecord(product),
    variant?.barcode,
    product?.barcode,
    saleItem?.sku,
    variant?.sku,
    product?.sku,
  )
);

/**
 * Enrich stored document line items with product code, sku, unit, and catalog ids.
 * @param {Array<Object>} items
 * @param {{ productsById?: Map, variantsById?: Map, saleItems?: Array<Object> }} context
 * @returns {Array<Object>}
 */
const enrichDocumentLineItems = (items, context = {}) => {
  if (!Array.isArray(items) || items.length === 0) return items;

  const productsById = context.productsById instanceof Map ? context.productsById : new Map();
  const variantsById = context.variantsById instanceof Map ? context.variantsById : new Map();
  const saleItems = Array.isArray(context.saleItems) ? context.saleItems : [];

  return items.map((rawItem, index) => {
    const item = rawItem && typeof rawItem === 'object' ? { ...rawItem } : rawItem;
    if (!item || typeof item !== 'object') return item;

    const saleItem = saleItems[index] || {};
    const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : {};
    const productId = item.productId || metadata.productId || saleItem.productId || null;
    const productVariantId = item.productVariantId || metadata.productVariantId || saleItem.productVariantId || null;
    const product = productsById.get(productId) || saleItem.product || null;
    const variant = variantsById.get(productVariantId) || saleItem.variant || null;
    const productCode = resolveDocumentLineItemProductCode({ item, saleItem, product, variant });
    const sku = pickTrimmed(item.sku, metadata.sku, saleItem.sku, variant?.sku, product?.sku);
    const unit = getLineItemUnitSymbol(item, { product, variant, saleItem });

    return {
      ...item,
      ...(productId && !item.productId ? { productId } : {}),
      ...(productVariantId && !item.productVariantId ? { productVariantId } : {}),
      ...(sku && !item.sku ? { sku } : {}),
      ...(productCode ? { productCode } : {}),
      ...(unit && !item.unit ? { unit } : {}),
    };
  });
};

module.exports = {
  pickTrimmed,
  getAlternateBarcodeFromRecord,
  getLineItemUnitSymbol,
  resolveDocumentLineItemProductCode,
  enrichDocumentLineItems,
};
