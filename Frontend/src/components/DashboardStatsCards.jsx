import { memo } from 'react';
import DashboardStatsCard from './DashboardStatsCard';
import { Currency, ShoppingCart, TrendingUp, Users } from 'lucide-react';
import { formatComparisonText } from '../utils/periodComparison';

const COMPARING_LABEL = 'Comparing...';

/**
 * DashboardStatsCards - Reusable row of dashboard statistics cards
 * @param {number} revenueValue - Revenue value
 * @param {number} expenseValue - Expense value
 * @param {number} profitValue - Profit value
 * @param {number} newCustomers - New customers count
 * @param {boolean} isShop - Whether business type is shop
 * @param {boolean} isPharmacy - Whether business type is pharmacy
 * @param {Object} comparisonData - Comparison data from previous period
 * @param {boolean} comparisonLoading - Whether comparison is still being computed
 * @param {string} activeFilter - Active filter type (today, thisWeek, etc.)
 */
const DashboardStatsCards = memo(({
  revenueValue = 0,
  expenseValue = 0,
  profitValue = 0,
  newCustomers = 0,
  isShop = false,
  isPharmacy = false,
  comparisonData = null,
  comparisonLoading = false,
  activeFilter = null
}) => {
  const comparingColor = '#666';
  const showComparing = comparisonLoading;

  const revenueFormatted = comparisonData?.revenue
    ? formatComparisonText(comparisonData.revenue, comparisonData.label, '₵ ')
    : null;
  const revenueComparison = showComparing ? COMPARING_LABEL : (revenueFormatted?.text ?? null);
  const revenueTrend = showComparing ? null : (revenueFormatted?.direction ?? null);
  const revenueComparisonColor = showComparing
    ? comparingColor
    : (comparisonData?.revenue
        ? (comparisonData.revenue.isPositive ? '#166534' : comparisonData.revenue.isNegative ? '#ef4444' : '#666')
        : '#166534');

  const expenseFormatted = comparisonData?.expenses
    ? formatComparisonText(comparisonData.expenses, comparisonData.label, '₵ ')
    : null;
  const expenseComparison = showComparing ? COMPARING_LABEL : (expenseFormatted?.text ?? null);
  const expenseTrend = showComparing ? null : (expenseFormatted?.direction ?? null);
  const expenseComparisonColor = showComparing
    ? comparingColor
    : (comparisonData?.expenses
        ? (comparisonData.expenses.isPositive ? '#ef4444' : comparisonData.expenses.isNegative ? '#166534' : '#666')
        : '#ef4444');

  const profitFormatted = comparisonData?.profit
    ? formatComparisonText(comparisonData.profit, comparisonData.label, '₵ ')
    : null;
  const profitComparison = showComparing ? COMPARING_LABEL : (profitFormatted?.text ?? null);
  const profitTrend = showComparing ? null : (profitFormatted?.direction ?? null);
  const profitComparisonColor = showComparing
    ? comparingColor
    : (comparisonData?.profit
        ? (comparisonData.profit.isPositive ? '#166534' : comparisonData.profit.isNegative ? '#ef4444' : '#666')
        : (profitValue < 0 ? '#ef4444' : '#166534'));

  const newCustomersFormatted = comparisonData?.newCustomers
    ? formatComparisonText(comparisonData.newCustomers, comparisonData.label, '')
    : null;
  const newCustomersComparison = showComparing ? COMPARING_LABEL : (newCustomersFormatted?.text ?? null);
  const newCustomersTrend = showComparing ? null : (newCustomersFormatted?.direction ?? null);
  const newCustomersComparisonColor = showComparing
    ? comparingColor
    : (comparisonData?.newCustomers
        ? (comparisonData.newCustomers.isPositive ? '#166534' : comparisonData.newCustomers.isNegative ? '#ef4444' : '#666')
        : '#666');

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-8"
      data-tour="dashboard-stats"
    >
      {/* Total Revenue Card */}
      <DashboardStatsCard
        tooltip={isShop || isPharmacy ? 'Total sales value for the selected period. Filter by Today, Week, or Month above.' : 'Total revenue (invoices paid) for the selected period.'}
        title={isShop || isPharmacy ? 'Total sales:' : 'Total revenue:'}
        value={revenueValue}
        valuePrefix="₵ "
        icon={isShop || isPharmacy ? ShoppingCart : Currency}
        iconBgColor="rgba(22, 101, 52, 0.1)"
        iconColor="#166534"
        comparisonText={revenueComparison}
        comparisonColor={revenueComparisonColor}
        trend={revenueTrend}
      />

      {/* Total Expenses Card */}
      <DashboardStatsCard
        tooltip="Total approved expenses. Track spending to manage your business cash flow."
        title="Total expense:"
        value={expenseValue}
        valuePrefix="₵ "
        icon={ShoppingCart}
        iconBgColor="rgba(249, 115, 22, 0.1)"
        iconColor="#f97316"
        comparisonText={expenseComparison}
        comparisonColor={expenseComparisonColor}
        trend={expenseTrend}
      />

      {/* Profit Made Card */}
      <DashboardStatsCard
        tooltip="Revenue minus expenses. Shows how much your business is making."
        title="Profit made:"
        value={profitValue}
        valuePrefix="₵ "
        icon={TrendingUp}
        iconBgColor="rgba(132, 204, 22, 0.1)"
        iconColor="#84cc16"
        comparisonText={profitComparison}
        comparisonColor={profitComparisonColor}
        trend={profitTrend}
      />

      {/* New Customers Card */}
      <DashboardStatsCard
        tooltip="New customers added in the selected period. Helps track growth."
        title="New customers:"
        value={newCustomers}
        icon={Users}
        iconBgColor="rgba(22, 101, 52, 0.1)"
        iconColor="#166534"
        comparisonText={newCustomersComparison}
        comparisonColor={newCustomersComparisonColor}
        trend={newCustomersTrend}
      />
    </div>
  );
});

DashboardStatsCards.displayName = 'DashboardStatsCards';

export default DashboardStatsCards;
