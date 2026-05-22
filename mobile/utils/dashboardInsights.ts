type ComparisonMetric = {
  percentage?: number;
  isPositive?: boolean;
  isNegative?: boolean;
  isNeutral?: boolean;
};

type BuildInsightParams = {
  revenue: number;
  expenses: number;
  profit: number;
  comparison?: {
    revenue?: ComparisonMetric;
    expenses?: ComparisonMetric;
    profit?: ComparisonMetric;
    newCustomers?: ComparisonMetric;
  };
  lowStockItems?: number;
  isShop?: boolean;
  isPharmacy?: boolean;
};

export type DashboardInsight = {
  title: string;
  body: string;
};

/**
 * Rule-based dashboard insight used when the AI assistant is still loading or unavailable.
 */
export function buildDashboardInsight(params: BuildInsightParams): DashboardInsight {
  const {
    revenue,
    expenses,
    profit,
    comparison = {},
    lowStockItems = 0,
    isShop,
    isPharmacy,
  } = params;

  const revenuePct = Math.abs(Number(comparison.revenue?.percentage ?? 0));
  const expensePct = Math.abs(Number(comparison.expenses?.percentage ?? 0));
  const profitPct = Math.abs(Number(comparison.profit?.percentage ?? 0));
  const customersPct = Math.abs(Number(comparison.newCustomers?.percentage ?? 0));

  if (comparison.revenue?.isPositive && revenuePct >= 10) {
    const driver = isShop || isPharmacy ? 'sales' : 'revenue';
    return {
      title: `${driver.charAt(0).toUpperCase() + driver.slice(1)} are trending up`,
      body: `Revenue is up ${revenuePct.toFixed(0)}% compared to the previous period. Keep momentum going.`,
    };
  }

  if (comparison.profit?.isPositive && profitPct >= 15) {
    return {
      title: 'Profit is growing strongly',
      body: `Profit rose ${profitPct.toFixed(0)}% vs the previous period while you stay on top of costs.`,
    };
  }

  if (comparison.expenses?.isPositive && expensePct >= 10 && expenses > 0) {
    return {
      title: 'Expenses increased this period',
      body: `Spending is up ${expensePct.toFixed(0)}%. Review your largest expense categories.`,
    };
  }

  if (comparison.newCustomers?.isPositive && customersPct >= 8) {
    return {
      title: 'More new customers this period',
      body: `New customers grew ${customersPct.toFixed(0)}%. Follow up while interest is high.`,
    };
  }

  if (lowStockItems > 0 && (isShop || isPharmacy)) {
    return {
      title: 'Stock needs attention',
      body: `${lowStockItems} product${lowStockItems === 1 ? ' is' : 's are'} low on stock. Restock bestsellers to avoid missed sales.`,
    };
  }

  if (profit < 0 && revenue > 0) {
    return {
      title: 'Costs are outpacing revenue',
      body: 'Expenses exceeded revenue for this period. Tighten spending or push higher-margin sales.',
    };
  }

  return {
    title: 'Your business is steady',
    body: 'Key metrics look stable for this period. Keep tracking revenue, expenses, and customer activity.',
  };
}
