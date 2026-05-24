const { formatDecimal } = require('./formatNumber');

/**
 * Deterministic Smart Report analysis when AI output is missing or unparseable.
 * @param {Object} reportData
 * @param {Object} options
 * @returns {Object} Same shape as successful AI analysis
 */
function buildReportAnalysisFallback(reportData = {}, options = {}) {
  const revenue = Number(reportData.revenue) || 0;
  const expenses = Number(reportData.expenses) || 0;
  const profit = revenue - expenses;
  const profitMargin =
    Number(reportData.profitMargin) ||
    (revenue > 0 ? (profit / revenue) * 100 : 0);
  const revenueChange = Number(reportData.revenueChange) || 0;
  const expenseChange = Number(reportData.expenseChange) || 0;
  const outstanding = Number(reportData.outstandingPayments) || 0;
  const studioMetrics = reportData.studioMetrics || null;
  const { startDate, endDate, businessType = 'printing_press' } = options;
  const periodLabel =
    startDate && endDate ? `${startDate} to ${endDate}` : 'the selected period';

  const revenueTrend =
    revenueChange > 0
      ? `up ${revenueChange.toFixed(1)}%`
      : revenueChange < 0
        ? `down ${Math.abs(revenueChange).toFixed(1)}%`
        : 'flat';

  const expenseTrend =
    expenseChange > 0
      ? `up ${expenseChange.toFixed(1)}%`
      : expenseChange < 0
        ? `down ${Math.abs(expenseChange).toFixed(1)}%`
        : 'flat';

  const marginHealth =
    profitMargin >= 20
      ? 'strong'
      : profitMargin >= 10
        ? 'moderate'
        : profitMargin > 0
          ? 'thin'
          : 'under pressure';

  const keyFindings = [
    `Revenue for ${periodLabel} was GHS ${formatDecimal(revenue)} (${revenueTrend} vs prior period).`,
    `Expenses totaled GHS ${formatDecimal(expenses)} (${expenseTrend}); net profit was GHS ${formatDecimal(profit)}.`,
    `Profit margin is ${profitMargin.toFixed(1)}% (${marginHealth}).`
  ];

  if (outstanding > 0) {
    keyFindings.push(
      `Outstanding payments of GHS ${formatDecimal(outstanding)} may affect cash flow until collected.`
    );
  }

  const topItems = Array.isArray(reportData.topItems) ? reportData.topItems.slice(0, 3) : [];
  if (topItems.length > 0) {
    const names = topItems
      .map((item) => item.name || item.item || 'Item')
      .join(', ');
    keyFindings.push(`Top performers this period include: ${names}.`);
  }

  if (studioMetrics) {
    const bookedJobValue = Number(studioMetrics.bookedJobValue) || 0;
    const bookedNotCollected = Number(studioMetrics.bookedNotCollected) || 0;
    const jobCount = Number(studioMetrics.jobCount) || 0;
    keyFindings.push(
      `Studio operations recorded ${jobCount} job(s) with booked value of GHS ${formatDecimal(bookedJobValue)}; GHS ${formatDecimal(bookedNotCollected)} is booked but not collected.`
    );
  }

  const recommendations = [];
  if (profitMargin < 15 && revenue > 0) {
    recommendations.push({
      priority: 'High',
      action: 'Review expense categories with the largest increases',
      impact: 'Improve net margin without requiring immediate revenue growth',
      reasoning: `Margin is ${profitMargin.toFixed(1)}%, below a typical healthy range for ${businessType} operations.`
    });
  }
  if (outstanding > revenue * 0.1 && outstanding > 0) {
    recommendations.push({
      priority: 'Medium',
      action: 'Follow up on overdue invoices and outstanding balances',
      impact: 'Strengthen cash position and reduce collection risk',
      reasoning: `Outstanding payments (GHS ${formatDecimal(outstanding)}) are material relative to revenue.`
    });
  }
  if (studioMetrics && Number(studioMetrics.bookedNotCollected) > 0) {
    recommendations.push({
      priority: 'Medium',
      action: 'Convert booked job value into collected revenue',
      impact: 'Improve cash collections without needing new job volume',
      reasoning: `Booked but uncollected job value is GHS ${formatDecimal(Number(studioMetrics.bookedNotCollected) || 0)}.`
    });
  }
  if (revenueChange < -5) {
    recommendations.push({
      priority: 'High',
      action: 'Investigate revenue decline drivers (pricing, volume, seasonality)',
      impact: 'Stabilize or recover top-line performance',
      reasoning: `Revenue declined ${Math.abs(revenueChange).toFixed(1)}% compared with the prior period.`
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'Medium',
      action: 'Continue tracking revenue, expenses, and margin weekly',
      impact: 'Earlier detection of trends before they affect profitability',
      reasoning: 'Metrics are stable enough to focus on consistent monitoring.'
    });
  }

  const riskAssessment = [];
  if (profit <= 0 && revenue > 0) {
    riskAssessment.push({
      risk: 'Operating at a loss for the period',
      severity: 'High',
      mitigation: 'Reduce discretionary spend and prioritize higher-margin sales.'
    });
  }
  if (outstanding > 0) {
    riskAssessment.push({
      risk: 'Cash tied up in receivables',
      severity: outstanding > revenue * 0.2 ? 'High' : 'Medium',
      mitigation: 'Send payment reminders and tighten credit terms for slow payers.'
    });
  }

  const growthOpportunities = [];
  if (topItems.length > 0) {
    growthOpportunities.push({
      opportunity: 'Double down on top-performing lines',
      potentialImpact: 'Lift revenue with lower acquisition cost',
      actionSteps: [
        'Promote best sellers in POS and marketing',
        'Ensure stock or capacity for top items',
        'Bundle slower movers with top performers'
      ]
    });
  }
  if (revenueChange > 5) {
    growthOpportunities.push({
      opportunity: 'Scale what is already working',
      potentialImpact: 'Compound recent revenue momentum',
      actionSteps: [
        'Identify channels or staff driving the increase',
        'Reinvest a portion of gains into inventory or marketing',
        'Set a stretch target for the next period'
      ]
    });
  }

  return {
    keyFindings,
    performanceAnalysis:
      `For ${periodLabel}, the business recorded GHS ${formatDecimal(revenue)} in revenue and GHS ${formatDecimal(expenses)} in expenses, ` +
      `yielding net profit of GHS ${formatDecimal(profit)} (${profitMargin.toFixed(1)}% margin). Revenue was ${revenueTrend} and expenses were ${expenseTrend}. ` +
      `Use the financial, sales, and expense tabs in Smart Report for category-level detail.`,
    recommendations,
    riskAssessment,
    growthOpportunities,
    strategicSuggestions: [
      'Align weekly reviews with revenue, expense, and cash-flow tabs.',
      'Set one margin or collection goal for the next reporting period.',
      'Re-run AI analysis after updating period filters if trends shift.'
    ],
    aiParseFallback: true,
    aiUnavailableReason: 'AI response could not be parsed as valid JSON'
  };
}

module.exports = { buildReportAnalysisFallback };
