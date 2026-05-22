import OverviewKpiCard from '../overview/OverviewKpiCard';
import MiniSparkline from '../overview/MiniSparkline';

/**
 * Row of KPI cards for Smart Report tabs.
 */
export default function SmartReportKpiRow({ items = [] }) {
  if (!items.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 md:gap-4">
      {items.map((item) => (
        <OverviewKpiCard
          key={item.label}
          label={item.label}
          value={item.value}
          valueFormatter={item.valueFormatter}
          change={item.change}
          comparisonLabel={item.comparisonLabel}
          sparklineData={item.sparklineData}
          SparklineChart={MiniSparkline}
          invertTrend={item.invertTrend}
          hideTrend={item.hideTrend}
          subLabel={item.subLabel}
          icon={item.icon}
          iconBgColor={item.iconBgColor}
          iconColor={item.iconColor}
        />
      ))}
    </div>
  );
}
