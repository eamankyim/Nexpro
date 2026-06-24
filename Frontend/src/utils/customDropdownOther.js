/** Sentinel value for dropdown "Other (specify)" options */
export const OTHER_DROPDOWN_VALUE = '__OTHER__';

/**
 * Resolve a dropdown field that may still be set to the "Other" sentinel.
 * @param {string|undefined|null} selectedValue - Current form value
 * @param {string|undefined|null} customText - Text typed in the "Other" input
 * @returns {string|null} Resolved value, or null if still unresolved
 */
export function resolveOtherDropdownValue(selectedValue, customText) {
  if (selectedValue !== OTHER_DROPDOWN_VALUE) {
    const trimmed = String(selectedValue ?? '').trim();
    return trimmed || null;
  }
  const trimmedCustom = String(customText ?? '').trim();
  return trimmedCustom || null;
}

/**
 * Replace __OTHER__ categories on line items using per-index custom text.
 * @param {Array<object>} items - Line items with a category field
 * @param {Record<number, string>} otherInputsByIndex - Custom text keyed by item index
 * @param {string} [categoryField='category'] - Field name holding the category
 * @returns {Array<object>} Items with resolved categories
 */
export function resolveOtherCategoryItems(items = [], otherInputsByIndex = {}, categoryField = 'category') {
  return (Array.isArray(items) ? items : []).map((item, idx) => {
    const current = item?.[categoryField];
    if (current !== OTHER_DROPDOWN_VALUE) return item;
    const resolved = resolveOtherDropdownValue(current, otherInputsByIndex[idx]);
    if (!resolved) return item;
    return { ...item, [categoryField]: resolved };
  });
}

/**
 * @param {Array<object>} items
 * @param {string} [categoryField='category']
 * @returns {boolean}
 */
export function hasUnresolvedOtherCategory(items = [], categoryField = 'category') {
  return (Array.isArray(items) ? items : []).some(
    (item) => item?.[categoryField] === OTHER_DROPDOWN_VALUE
  );
}

/**
 * Collect unique resolved category labels from line items (excluding sentinel).
 * @param {Array<object>} items
 * @param {string} [categoryField='category']
 * @returns {string[]}
 */
export function collectResolvedCategories(items = [], categoryField = 'category') {
  return [...new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => String(item?.[categoryField] ?? '').trim())
      .filter((value) => value && value !== OTHER_DROPDOWN_VALUE)
  )];
}
