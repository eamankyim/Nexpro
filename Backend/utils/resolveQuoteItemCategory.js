/**
 * Resolve job/line-item category from a quote item.
 * Studio quotes store category in metadata.category; retail quotes fall back to description.
 * @param {{ description?: string, metadata?: object }} item
 * @returns {string}
 */
function resolveQuoteItemCategory(item) {
  const metadata = item?.metadata && typeof item.metadata === 'object' ? item.metadata : {};
  const fromMetadata = String(metadata.category ?? '').trim();
  if (fromMetadata && fromMetadata !== '__OTHER__') {
    return fromMetadata;
  }
  return String(item?.description ?? '').trim();
}

module.exports = { resolveQuoteItemCategory };
