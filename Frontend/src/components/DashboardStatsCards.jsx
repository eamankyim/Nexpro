import { memo } from 'react';
import DashboardStatsCard from './DashboardStatsCard';
import { DollarSign, ShoppingCart, TrendingUp, Users } from 'lucide-react';
import { formatComparisonText } from '../utils/periodComparison';

/**
 * DashboardStatsCards - Reusable row of dashboard statistics cards
 * @param {number} revenueValue - Revenue value
 * @param {number} expenseValue - Expense value
 * @param {number} profitValue - Profit value
 * @param {number} newCustomers - New customers count
 * @param {boolean} isShop - Whether business type is shop
 * @param {boolean} isPharmacy - Whether business type is pharmacy
 * @param {Object} comparisonData - Comparison data from previous period
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
  activeFilter = null
}) => {
  // Use comparison data if available, otherwise use default mock values
  const revenueComparison = comparisonData?.revenue 
    ? formatComparisonText(comparisonData.revenue, comparisonData.label, 'GHS ')
    : null;
  const revenueComparisonColor = comparisonData?.revenue 
    ? (comparisonData.revenue.isPositive ? '#166534' : comparisonData.revenue.isNegative ? '#ef4444' : '#666')
    : '#166534';

  const expenseComparison = comparisonData?.expenses
    ? formatComparisonText(comparisonData.expenses, comparisonData.label, 'GHS ')
    : null;
  const expenseComparisonColor = comparisonData?.expenses
    ? (comparisonData.expenses.isPositive ? '#ef4444' : comparisonData.expenses.isNegative ? '#166534' : '#666')
    : '#ef4444';

  const profitComparison = comparisonData?.profit
    ? formatComparisonText(comparisonData.profit, comparisonData.label, 'GHS ')
    : null;
  const profitComparisonColor = comparisonData?.profit
    ? (comparisonData.profit.isPositive ? '#166534' : comparisonData.profit.isNegative ? '#ef4444' : '#666')
    : (profitValue < 0 ? '#ef4444' : '#166534');

  // New customers: use same period label as other cards (e.g. "vs last week") when we have comparisonData
  const periodLabel = comparisonData?.label || 'vs yesterday';
  const newCustomersDifference = Math.floor(newCustomers * 0.25);
  const isNoChange = newCustomersDifference === 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-8">
      {/* Total Revenue Card */}
      <DashboardStatsCard
        title={isShop || isPharmacy ? 'Total sales:' : 'Total revenue:'}
        value={revenueValue}
        valuePrefix="GHS "
        icon={isShop || isPharmacy ? ShoppingCart : DollarSign}
        iconBgColor="rgba(22, 101, 52, 0.1)"
        iconColor="#166534"
        comparisonText={revenueComparison}
        comparisonColor={revenueComparisonColor}
      />

      {/* Total Expenses Card */}
      <DashboardStatsCard
        title="Total expense:"
        value={expenseValue}
        valuePrefix="GHS "
        icon={ShoppingCart}
        iconBgColor="rgba(249, 115, 22, 0.1)"
        iconColor="#f97316"
        comparisonText={expenseComparison}
        comparisonColor={expenseComparisonColor}
      />

      {/* Profit Made Card */}
      <DashboardStatsCard
        title="Profit made:"
        value={profitValue}
        valuePrefix="GHS "
        icon={TrendingUp}
        iconBgColor="rgba(132, 204, 22, 0.1)"
        iconColor="#84cc16"
        comparisonText={profitComparison}
        comparisonColor={profitComparisonColor}
      />

      {/* New Customers Card */}
      <DashboardStatsCard
        title="New customers:"
        value={newCustomers}
        icon={Users}
        iconBgColor="rgba(22, 101, 52, 0.1)"
        iconColor="#166534"
        comparisonText={`${isNoChange ? '→' : '↑'} ${newCustomersDifference} ${periodLabel}`}
        comparisonColor={isNoChange ? '#666' : '#166534'}
      />
    </div>
  );
});

DashboardStatsCards.displayName = 'DashboardStatsCards';

export default DashboardStatsCards;
