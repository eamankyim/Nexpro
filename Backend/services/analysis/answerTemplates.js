const { formatCurrency, formatDecimal } = require('../../utils/formatNumber');
const { FALLBACK_SUGGESTED_QUESTIONS } = require('./intentCatalog');

/**
 * Templated answers from metrics (+ optional reasons). No LLM rephrase.
 */

function money(n) {
  return formatCurrency(n, 'GHS');
}

function pct(n) {
  const v = Number(n) || 0;
  const sign = v > 0 ? '+' : '';
  return `${sign}${formatDecimal(v, 1)}%`;
}

function renderPeriodBlock(period, { showCogs = false } = {}) {
  if (!period) return '';
  const lines = [
    `**${period.label || 'Period'}**`,
    `- Revenue: ${money(period.revenue)}`,
    `- Expenses: ${money(period.expenses)}${showCogs && period.isRetail ? ` (operating ${money(period.operatingExpenses)} + COGS ${money(period.cogs)})` : ''}`,
    `- Profit: ${money(period.profit)}`,
  ];
  if (period.saleCount != null) {
    lines.push(`- Transactions: ${period.saleCount} (AOV ${money(period.aov)})`);
  }
  return lines.join('\n');
}

function templateSalesToday(metrics) {
  const p = metrics.period;
  return [
    `### Today's sales`,
    '',
    renderPeriodBlock(p, { showCogs: true }),
    '',
    p.revenue > 0
      ? `You made **${money(p.revenue)}** in revenue today with **${money(p.profit)}** profit.`
      : 'No completed sales recorded for today yet.',
  ].join('\n');
}

function templateSalesThisMonth(metrics) {
  const p = metrics.period;
  return [
    `### This month's sales`,
    '',
    renderPeriodBlock(p, { showCogs: true }),
    '',
    `Month-to-date revenue is **${money(p.revenue)}** with profit of **${money(p.profit)}**.`,
  ].join('\n');
}

function templateSalesVsPrior(metrics) {
  const { current, prior, changes } = metrics;
  return [
    `### Sales vs prior period`,
    '',
    renderPeriodBlock(current, { showCogs: true }),
    '',
    renderPeriodBlock(prior, { showCogs: true }),
    '',
    `**Changes:** revenue ${pct(changes.revenuePct)}, profit ${pct(changes.profitPct)}, transactions ${pct(changes.saleCountPct)}, AOV ${pct(changes.aovPct)}.`,
  ].join('\n');
}

function templateWhySalesDown(metrics, reasonsResult) {
  const { current, prior, changes } = metrics.compare || metrics;
  const reasons = reasonsResult?.reasons || [];
  const headline = reasonsResult?.isDown
    ? `Revenue is **down ${Math.abs(changes.revenuePct).toFixed(1)}%** vs the prior period.`
    : 'Sales are not down vs the prior period.';

  const reasonLines = reasons.map((r, i) => `${i + 1}. **${r.label}** — ${r.detail}`);

  return [
    `### Why sales look down`,
    '',
    headline,
    '',
    renderPeriodBlock(current),
    '',
    renderPeriodBlock(prior),
    '',
    '**Likely drivers:**',
    ...reasonLines,
  ].join('\n');
}

function templateTopProducts(metrics) {
  if (!metrics.isRetail) {
    return '### Top products\n\nTop product breakdown is available for shop and pharmacy workspaces.';
  }
  const products = metrics.products || [];
  if (products.length === 0) {
    return `### Top products\n\nNo product sales found for **${metrics.periodLabel}**.`;
  }
  const lines = products.map(
    (p, i) => `${i + 1}. **${p.productName}** — ${money(p.totalRevenue)} (${formatDecimal(p.totalQuantity, 0)} units)`
  );
  return [`### Top products (${metrics.periodLabel})`, '', ...lines].join('\n');
}

function templateReceivables(metrics, { focusDebtors = false } = {}) {
  const lines = [
    focusDebtors ? '### Who owes you' : '### Receivables',
    '',
    `- Outstanding: **${money(metrics.totalOutstanding)}** across ${metrics.outstandingInvoiceCount} invoice(s)`,
    `- Overdue: **${money(metrics.overdueOutstanding)}** (${formatDecimal(metrics.overdueRatioPercent, 1)}% of outstanding)`,
  ];
  const debtors = metrics.topDebtors || [];
  if (debtors.length > 0) {
    lines.push('', '**Top balances:**');
    debtors.slice(0, 5).forEach((d, i) => {
      lines.push(`${i + 1}. ${d.customerName} — ${money(d.outstanding)}`);
    });
  } else {
    lines.push('', 'No open customer balances right now.');
  }
  return lines.join('\n');
}

function templateLowStock(metrics) {
  if (!metrics.isRetail) {
    return '### Low stock\n\nStock alerts are available for shop and pharmacy workspaces.';
  }
  if (!metrics.lowStockCount) {
    return '### Low stock\n\nNo products are at or below reorder level.';
  }
  const lines = (metrics.products || []).map(
    (p) => `- **${p.name}**: ${formatDecimal(p.quantityOnHand, 0)} ${p.unit || ''} (reorder at ${formatDecimal(p.reorderLevel, 0)})`
  );
  return [
    `### Low stock (${metrics.lowStockCount} item${metrics.lowStockCount === 1 ? '' : 's'})`,
    '',
    ...lines,
  ].join('\n');
}

function templatePerformanceSummary(metrics) {
  const { current, prior, changes, lowStockCount, receivables } = metrics;
  const direction =
    changes.revenuePct > 5 ? 'up' : changes.revenuePct < -5 ? 'down' : 'steady';
  const title =
    direction === 'up'
      ? 'Performance is trending up'
      : direction === 'down'
        ? 'Performance needs attention'
        : 'Performance looks steady';

  const lines = [
    `### ${title}`,
    '',
    `${current.label}: revenue **${money(current.revenue)}**, profit **${money(current.profit)}** (${pct(changes.revenuePct)} vs prior).`,
  ];
  if (receivables?.totalOutstanding > 0) {
    lines.push(`Outstanding receivables: ${money(receivables.totalOutstanding)}.`);
  }
  if (lowStockCount > 0) {
    lines.push(`${lowStockCount} product(s) are low on stock.`);
  }
  if (prior) {
    lines.push('', `Prior period revenue was ${money(prior.revenue)}.`);
  }
  return lines.join('\n');
}

function templateUnsupported(suggestedQuestions = FALLBACK_SUGGESTED_QUESTIONS) {
  const chips = suggestedQuestions.slice(0, 6).map((q) => `- ${q}`);
  return [
    "I can answer business questions from your live data, or help with ABS how-tos and drafts.",
    '',
    'Try one of these:',
    ...chips,
  ].join('\n');
}

/**
 * Build answer markdown for an intent.
 * @param {string} intent
 * @param {Object} metrics
 * @param {Object} [extra]
 * @returns {string}
 */
function buildAnswerMarkdown(intent, metrics, extra = {}) {
  switch (intent) {
    case 'sales_today':
      return templateSalesToday(metrics);
    case 'sales_this_month':
      return templateSalesThisMonth(metrics);
    case 'sales_vs_prior_period':
      return templateSalesVsPrior(metrics);
    case 'why_sales_down':
      return templateWhySalesDown(metrics, extra.reasonsResult);
    case 'top_products':
      return templateTopProducts(metrics);
    case 'receivables_summary':
      return templateReceivables(metrics);
    case 'who_owes_me':
      return templateReceivables(metrics, { focusDebtors: true });
    case 'low_stock':
      return templateLowStock(metrics);
    case 'performance_summary':
      return templatePerformanceSummary(metrics);
    default:
      return templateUnsupported(extra.suggestedQuestions);
  }
}

/**
 * Short title/body for dashboard AI Insight card.
 * @param {Object} metrics
 * @returns {{ title: string, body: string }}
 */
function buildDashboardInsightCard(metrics) {
  const { current, changes, lowStockCount, receivables } = metrics;
  const revPct = Number(changes?.revenuePct) || 0;

  if (revPct <= -10) {
    return {
      title: 'Revenue is lower',
      body: `Revenue is down ${Math.abs(revPct).toFixed(0)}% vs the prior period. Review volume and top products.`,
    };
  }
  if (revPct >= 10) {
    return {
      title: 'Revenue is trending up',
      body: `Revenue is up ${revPct.toFixed(0)}% vs the prior period. Keep momentum going.`,
    };
  }
  if ((receivables?.totalOutstanding || 0) > (current?.revenue || 0) * 0.2 && receivables.totalOutstanding > 0) {
    return {
      title: 'Collections need focus',
      body: `Outstanding balances of ${money(receivables.totalOutstanding)} may slow cash flow.`,
    };
  }
  if (lowStockCount > 0) {
    return {
      title: 'Stock needs attention',
      body: `${lowStockCount} product${lowStockCount === 1 ? ' is' : 's are'} low on stock. Restock bestsellers to avoid missed sales.`,
    };
  }
  if ((current?.profit || 0) < 0 && (current?.revenue || 0) > 0) {
    return {
      title: 'Costs are outpacing revenue',
      body: 'Expenses and COGS exceeded revenue for this period. Tighten spend or push higher-margin sales.',
    };
  }
  return {
    title: 'Your business is steady',
    body: 'Key metrics look stable for this period. Keep tracking revenue, profit, and collections.',
  };
}

module.exports = {
  buildAnswerMarkdown,
  buildDashboardInsightCard,
  templateUnsupported,
};
