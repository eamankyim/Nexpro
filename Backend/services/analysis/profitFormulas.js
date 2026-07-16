/**
 * Profit / revenue formula alignment for the owned analysis engine.
 *
 * Source of truth matches Dashboard overview + Reports overview (not the old
 * assistant simplified profit of revenue − operating expenses only).
 *
 * Retail (shop / pharmacy):
 *   grossProfit = revenue − cogs
 *   netProfit   = grossProfit − operatingExpenses
 *               = revenue − cogs − operatingExpenses
 *   totalExpenses (compat) = operatingExpenses + cogs
 *
 * Studio / non-retail:
 *   netProfit = revenue − operatingExpenses
 *   (no product COGS line)
 *
 * COGS = SUM(sale_items.quantity * COALESCE(variant.costPrice, product.costPrice, 0))
 * for completed sales, excluding products with trackStock === false
 * (same rule as dashboardController + getRetailCogsTotal).
 */

/**
 * @param {number|string|null|undefined} value
 * @returns {number}
 */
const roundMoney = (value) => Number(parseFloat(Number(value) || 0).toFixed(2));

/**
 * @param {string|null|undefined} businessType
 * @returns {boolean}
 */
const isRetailBusinessType = (businessType) =>
  businessType === 'shop' || businessType === 'pharmacy';

/**
 * Compute gross / net profit aligned with dashboard & overview reports.
 * @param {{ revenue?: number, operatingExpenses?: number, cogs?: number, isRetail?: boolean }} params
 * @returns {{ revenue: number, operatingExpenses: number, cogs: number, grossProfit: number, netProfit: number, totalExpenses: number }}
 */
function computeAlignedProfit({
  revenue = 0,
  operatingExpenses = 0,
  cogs = 0,
  isRetail = false,
} = {}) {
  const rev = roundMoney(revenue);
  const opex = roundMoney(operatingExpenses);
  const cost = isRetail ? roundMoney(cogs) : 0;
  const grossProfit = roundMoney(rev - cost);
  const netProfit = roundMoney(grossProfit - opex);
  return {
    revenue: rev,
    operatingExpenses: opex,
    cogs: cost,
    grossProfit,
    netProfit,
    totalExpenses: roundMoney(opex + cost),
  };
}

/**
 * Percent change from prior to current. Returns 0 when prior is 0.
 * @param {number} current
 * @param {number} prior
 * @returns {number}
 */
function percentChange(current, prior) {
  const c = Number(current) || 0;
  const p = Number(prior) || 0;
  if (p === 0) return c === 0 ? 0 : 100;
  return Number((((c - p) / Math.abs(p)) * 100).toFixed(2));
}

module.exports = {
  roundMoney,
  isRetailBusinessType,
  computeAlignedProfit,
  percentChange,
};
