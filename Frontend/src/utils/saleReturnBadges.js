/**
 * Derive display badges for a sale based on status + metadata.returnSummary from POS returns.
 * @param {object} sale
 * @returns {string[]} status keys for StatusChip (e.g. refunded, partial_return, exchanged)
 */
export function getSaleReturnBadgeStatuses(sale) {
  if (!sale) return [];
  const summary = sale.metadata?.returnSummary;
  const badges = [];

  if (sale.status === 'refunded') {
    badges.push('refunded');
  } else if (summary && !summary.fullyReturned && (summary.totalReturnedQty || 0) > 0) {
    badges.push('partial_return');
  }

  if (summary?.hasExchange) {
    badges.push('exchanged');
  }

  return badges;
}

/**
 * Whether a sale can open the return wizard (UI hint; server still validates).
 * @param {object} sale
 * @param {{ isManager?: boolean }} opts
 */
export function canStartSaleReturn(sale, { isManager = false } = {}) {
  if (!sale || !isManager) return false;
  if (sale.deletedAt) return false;
  if (['cancelled', 'pending', 'refunded'].includes(sale.status)) return false;
  return true;
}
