const { percentChange, roundMoney } = require('../profitFormulas');

/**
 * Checklist reasons for a sales decline (volume, AOV, top product, day-count normalize, etc.).
 * Pure function — easy to unit test. Does not call an LLM.
 *
 * @param {{
 *   current: {
 *     revenue: number,
 *     saleCount: number,
 *     aov: number,
 *     dayCount: number,
 *     revenuePerDay: number,
 *     profit?: number,
 *     expenses?: number,
 *   },
 *   prior: {
 *     revenue: number,
 *     saleCount: number,
 *     aov: number,
 *     dayCount: number,
 *     revenuePerDay: number,
 *     profit?: number,
 *     expenses?: number,
 *   },
 *   topProduct?: {
 *     priorName?: string,
 *     priorRevenue?: number,
 *     currentRevenue?: number,
 *   } | null,
 * }} input
 * @returns {{
 *   isDown: boolean,
 *   revenueChangePct: number,
 *   reasons: Array<{ code: string, label: string, detail: string, severity: 'high'|'medium'|'low'|'info' }>,
 * }}
 */
function buildSalesDropReasons(input = {}) {
  const current = input.current || {};
  const prior = input.prior || {};
  const topProduct = input.topProduct || null;

  const revenueChangePct = percentChange(current.revenue, prior.revenue);
  const isDown = (Number(current.revenue) || 0) < (Number(prior.revenue) || 0);
  const reasons = [];

  if (!isDown) {
    reasons.push({
      code: 'not_down',
      label: 'Sales are not down',
      detail:
        revenueChangePct > 0
          ? `Revenue is up ${Math.abs(revenueChangePct).toFixed(1)}% vs the prior period.`
          : 'Revenue is flat vs the prior period.',
      severity: 'info',
    });
    return { isDown: false, revenueChangePct, reasons };
  }

  const volumePct = percentChange(current.saleCount, prior.saleCount);
  const aovPct = percentChange(current.aov, prior.aov);
  const perDayPct = percentChange(current.revenuePerDay, prior.revenuePerDay);
  const dayDiff = (Number(current.dayCount) || 0) - (Number(prior.dayCount) || 0);

  // Day-count normalize: shorter period can look worse in totals only
  if (dayDiff < 0 && perDayPct > -5 && revenueChangePct < -5) {
    reasons.push({
      code: 'shorter_period',
      label: 'Fewer days in the current period',
      detail: `Current period has ${current.dayCount} day(s) vs ${prior.dayCount} before. Daily average revenue is ${perDayPct >= 0 ? 'stable or up' : `down ${Math.abs(perDayPct).toFixed(1)}%`} — totals alone may overstate the drop.`,
      severity: 'medium',
    });
  } else if (perDayPct <= -8) {
    reasons.push({
      code: 'lower_daily_pace',
      label: 'Lower daily sales pace',
      detail: `Revenue per day is down ${Math.abs(perDayPct).toFixed(1)}% (${formatMoney(current.revenuePerDay)}/day vs ${formatMoney(prior.revenuePerDay)}/day).`,
      severity: 'high',
    });
  }

  if (volumePct <= -8) {
    reasons.push({
      code: 'lower_volume',
      label: 'Fewer transactions',
      detail: `Sale/invoice count is down ${Math.abs(volumePct).toFixed(1)}% (${current.saleCount} vs ${prior.saleCount}).`,
      severity: 'high',
    });
  } else if (volumePct < 0) {
    reasons.push({
      code: 'slightly_lower_volume',
      label: 'Slightly fewer transactions',
      detail: `Transaction count slipped ${Math.abs(volumePct).toFixed(1)}% (${current.saleCount} vs ${prior.saleCount}).`,
      severity: 'medium',
    });
  }

  if (aovPct <= -8) {
    reasons.push({
      code: 'lower_aov',
      label: 'Lower average order value',
      detail: `Average order value is down ${Math.abs(aovPct).toFixed(1)}% (${formatMoney(current.aov)} vs ${formatMoney(prior.aov)}).`,
      severity: 'high',
    });
  } else if (aovPct < 0 && volumePct >= 0) {
    reasons.push({
      code: 'aov_drag',
      label: 'AOV is dragging totals',
      detail: `Volume held up, but average order value is down ${Math.abs(aovPct).toFixed(1)}%.`,
      severity: 'medium',
    });
  }

  if (topProduct?.priorName && Number(topProduct.priorRevenue) > 0) {
    const productPct = percentChange(topProduct.currentRevenue, topProduct.priorRevenue);
    if (productPct <= -10) {
      reasons.push({
        code: 'top_product_decline',
        label: 'Top product declined',
        detail: `"${topProduct.priorName}" revenue is down ${Math.abs(productPct).toFixed(1)}% (${formatMoney(topProduct.currentRevenue)} vs ${formatMoney(topProduct.priorRevenue)}).`,
        severity: 'high',
      });
    }
  }

  const expensePct = percentChange(current.expenses, prior.expenses);
  if (Number(current.expenses) > 0 && expensePct >= 10 && revenueChangePct < 0) {
    reasons.push({
      code: 'expenses_up_while_sales_down',
      label: 'Expenses rose while sales fell',
      detail: `Expenses are up ${expensePct.toFixed(1)}% while revenue declined — margin pressure may feel worse than the sales drop alone.`,
      severity: 'medium',
    });
  }

  if (reasons.length === 0) {
    reasons.push({
      code: 'general_decline',
      label: 'Overall revenue decline',
      detail: `Revenue is down ${Math.abs(revenueChangePct).toFixed(1)}% vs the prior period with no single dominant driver from volume, AOV, or top product.`,
      severity: 'medium',
    });
  }

  // Headline reason first by severity
  const severityRank = { high: 0, medium: 1, low: 2, info: 3 };
  reasons.sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9));

  return { isDown: true, revenueChangePct, reasons };
}

function formatMoney(n) {
  return `GHS ${roundMoney(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

module.exports = {
  buildSalesDropReasons,
};
