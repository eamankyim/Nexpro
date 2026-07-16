const { formatCurrency, formatDecimal } = require('../../utils/formatNumber');
const { FALLBACK_SUGGESTED_QUESTIONS } = require('./intentCatalog');

/**
 * Templated answers from metrics (+ optional reasons). No LLM rephrase.
 * Tone: helpful colleague — natural lead sentence, then optional compact detail.
 */

function money(n) {
  return formatCurrency(n, 'GHS');
}

function pct(n) {
  const v = Number(n) || 0;
  const sign = v > 0 ? '+' : '';
  return `${sign}${formatDecimal(v, 1)}%`;
}

/**
 * Compact metric lines (secondary to the conversational lead).
 * @param {Object} period
 * @param {{ showCogs?: boolean }} [opts]
 * @returns {string}
 */
function renderCompactMetrics(period, { showCogs = false } = {}) {
  if (!period) return '';
  const lines = [
    `- Revenue: ${money(period.revenue)}`,
    `- Expenses: ${money(period.expenses)}${showCogs && period.isRetail ? ` (operating ${money(period.operatingExpenses)} + COGS ${money(period.cogs)})` : ''}`,
    `- Profit: ${money(period.profit)}`,
  ];
  if (period.saleCount != null) {
    lines.push(`- Transactions: ${period.saleCount} (avg ${money(period.aov)} each)`);
  }
  return lines.join('\n');
}

function templateSalesForPeriod(metrics) {
  const p = metrics.period;
  const label = p?.label || 'This period';
  if (!(p?.revenue > 0)) {
    return `No completed sales for **${label}** yet. Once sales come in, I'll summarize revenue and profit here.`;
  }
  const txnBit =
    p.saleCount != null
      ? ` across **${p.saleCount}** transaction${p.saleCount === 1 ? '' : 's'}`
      : '';
  return [
    `For **${label}** you've brought in **${money(p.revenue)}** in revenue${txnBit}, with **${money(p.profit)}** profit after expenses.`,
    '',
    'At a glance:',
    renderCompactMetrics(p, { showCogs: true }),
  ].join('\n');
}

function templateSalesToday(metrics) {
  return templateSalesForPeriod(metrics);
}

function templateSalesThisMonth(metrics) {
  return templateSalesForPeriod(metrics);
}

function describeChange(label, changePct) {
  const v = Number(changePct) || 0;
  if (Math.abs(v) < 0.5) return `${label} is about flat`;
  if (v > 0) return `${label} is up **${pct(v)}**`;
  return `${label} is down **${pct(v)}**`;
}

function templateSalesVsPrior(metrics) {
  const { current, prior, changes } = metrics;
  const rev = describeChange('Revenue', changes.revenuePct);
  const profit = describeChange('profit', changes.profitPct);

  return [
    `Comparing **${current.label || 'this period'}** to **${prior.label || 'the prior period'}**: ${rev}, and ${profit}.`,
    '',
    `**${current.label || 'Current'}** — revenue ${money(current.revenue)}, profit ${money(current.profit)}.`,
    `**${prior.label || 'Prior'}** — revenue ${money(prior.revenue)}, profit ${money(prior.profit)}.`,
    '',
    `Also: transactions ${pct(changes.saleCountPct)}, average order ${pct(changes.aovPct)}.`,
  ].join('\n');
}

/**
 * Plain-language sentence for a sales-drop reason (uses structured reason fields).
 * @param {{ code?: string, label?: string, detail?: string }} reason
 * @returns {string}
 */
function reasonInPlainLanguage(reason) {
  const code = reason?.code || '';
  const detail = reason?.detail || '';
  switch (code) {
    case 'lower_volume':
    case 'slightly_lower_volume':
      return detail || 'Fewer customers bought than in the prior period.';
    case 'lower_aov':
    case 'aov_drag':
      return detail || 'Customers spent less per order on average.';
    case 'top_product_decline':
      return detail || 'Your former top seller brought in less than before.';
    case 'shorter_period':
      return detail || 'This period has fewer days, so totals alone can look worse.';
    case 'lower_daily_pace':
      return detail || 'Sales per day are running slower than before.';
    case 'expenses_up_while_sales_down':
      return detail || 'Costs rose while sales fell, which squeezes profit harder.';
    case 'not_down':
      return detail || 'Sales are not down versus the prior period.';
    default:
      return detail || reason?.label || 'Revenue declined without a single clear driver.';
  }
}

function templateWhySalesDown(metrics, reasonsResult) {
  const { current, prior, changes } = metrics.compare || metrics;
  const reasons = reasonsResult?.reasons || [];
  const absPct = Math.abs(Number(changes.revenuePct) || 0).toFixed(1);

  const headline = reasonsResult?.isDown
    ? `Revenue is down about **${absPct}%** versus **${prior.label || 'the prior period'}** — here's what stands out from your data.`
    : `Good news: sales are **not** down versus **${prior.label || 'the prior period'}**.`;

  const reasonLines = reasons.map((r, i) => `${i + 1}. ${reasonInPlainLanguage(r)}`);

  const body = [
    headline,
    '',
    `This period: **${money(current.revenue)}** revenue and **${money(current.profit)}** profit.`,
    `Prior period: **${money(prior.revenue)}** revenue and **${money(prior.profit)}** profit.`,
  ];

  if (reasonLines.length > 0) {
    body.push('', reasonsResult?.isDown ? "What's driving it:" : 'Context:', ...reasonLines);
  }

  return body.join('\n');
}

function templateTopProducts(metrics) {
  if (!metrics.isRetail) {
    return 'Top product breakdown is available for shop and pharmacy workspaces. For this business type, try asking about sales or receivables instead.';
  }
  const products = metrics.products || [];
  if (products.length === 0) {
    return `I didn't find product sales for **${metrics.periodLabel}**. Once items sell, I'll rank them here.`;
  }
  const top = products[0];
  const lines = products.map(
    (p, i) => `${i + 1}. **${p.productName}** — ${money(p.totalRevenue)} (${formatDecimal(p.totalQuantity, 0)} units)`
  );
  return [
    `Your best seller for **${metrics.periodLabel}** is **${top.productName}** at **${money(top.totalRevenue)}**. Here's the full ranking:`,
    '',
    ...lines,
  ].join('\n');
}

function templateReceivables(metrics, { focusDebtors = false } = {}) {
  const outstanding = metrics.totalOutstanding || 0;
  const overdue = metrics.overdueOutstanding || 0;
  const count = metrics.outstandingInvoiceCount || 0;
  // Receivables are point-in-time outstanding, not filtered by the period chip range.
  const asOfNote =
    'As of today (open balances — not filtered by the period chip):';

  if (outstanding <= 0) {
    return focusDebtors
      ? `${asOfNote} nobody owes you right now — there are no open customer balances.`
      : `${asOfNote} you're all clear on receivables — nothing outstanding.`;
  }

  const lead = focusDebtors
    ? `${asOfNote} customers currently owe you **${money(outstanding)}** across **${count}** open invoice${count === 1 ? '' : 's'}.`
    : `${asOfNote} you have **${money(outstanding)}** outstanding across **${count}** invoice${count === 1 ? '' : 's'}.`;

  const lines = [lead];
  if (overdue > 0) {
    lines.push(
      `Of that, **${money(overdue)}** is overdue (${formatDecimal(metrics.overdueRatioPercent, 1)}% of outstanding) — worth following up soon.`
    );
  } else {
    lines.push('None of that looks overdue yet.');
  }

  const debtors = metrics.topDebtors || [];
  if (debtors.length > 0) {
    lines.push('', 'Largest balances:');
    debtors.slice(0, 5).forEach((d, i) => {
      lines.push(`${i + 1}. ${d.customerName} — ${money(d.outstanding)}`);
    });
  }
  return lines.join('\n');
}

function templateLowStock(metrics) {
  if (!metrics.isRetail) {
    return 'Stock alerts are available for shop and pharmacy workspaces.';
  }
  if (!metrics.lowStockCount) {
    return "Stock looks healthy — nothing is at or below reorder level right now.";
  }
  const n = metrics.lowStockCount;
  const lines = (metrics.products || []).map(
    (p) =>
      `- **${p.name}**: ${formatDecimal(p.quantityOnHand, 0)} ${p.unit || ''} left (reorder at ${formatDecimal(p.reorderLevel, 0)})`
  );
  return [
    `**${n}** product${n === 1 ? '' : 's'} ${n === 1 ? 'is' : 'are'} running low — restock soon to avoid missed sales:`,
    '',
    ...lines,
  ].join('\n');
}

function templatePerformanceSummary(metrics) {
  const { current, prior, changes, lowStockCount, receivables } = metrics;
  const revPct = Number(changes.revenuePct) || 0;
  const direction =
    revPct > 5 ? 'up' : revPct < -5 ? 'down' : 'steady';

  let lead;
  if (direction === 'up') {
    lead = `Here's a quick read on **${current.label || 'this period'}**: things are trending up — revenue is **${money(current.revenue)}** (${pct(revPct)} vs prior), with **${money(current.profit)}** profit.`;
  } else if (direction === 'down') {
    lead = `Here's a quick read on **${current.label || 'this period'}**: revenue needs attention — you're at **${money(current.revenue)}** (${pct(revPct)} vs prior), with **${money(current.profit)}** profit.`;
  } else {
    lead = `Here's a quick read on **${current.label || 'this period'}**: performance looks steady — revenue **${money(current.revenue)}** and profit **${money(current.profit)}** (${pct(revPct)} vs prior).`;
  }

  const lines = [lead];

  if (prior) {
    lines.push(`For context, the prior period brought in ${money(prior.revenue)} revenue.`);
  }
  if (receivables?.totalOutstanding > 0) {
    lines.push(
      `You still have **${money(receivables.totalOutstanding)}** in outstanding receivables to collect.`
    );
  }
  if (lowStockCount > 0) {
    lines.push(
      `Also, **${lowStockCount}** product${lowStockCount === 1 ? ' is' : 's are'} low on stock.`
    );
  }

  lines.push(
    '',
    'Snapshot:',
    `- Revenue: ${money(current.revenue)}`,
    `- Expenses: ${money(current.expenses)}`,
    `- Profit: ${money(current.profit)}`
  );
  if (current.saleCount != null) {
    lines.push(`- Transactions: ${current.saleCount}`);
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
