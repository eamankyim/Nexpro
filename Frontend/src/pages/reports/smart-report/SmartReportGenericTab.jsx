import AIQuickInsightsCard from '../overview/AIQuickInsightsCard';
import SmartReportSectionHeader from './SmartReportSectionHeader';

/**
 * AI Insights tab (full mockup pending).
 */
export default function SmartReportGenericTab({ snapshot, periodLabel }) {
  const points = snapshot.aiInsightPoints?.length
    ? snapshot.aiInsightPoints
    : [snapshot.executiveAiInsight, snapshot.aiSummary].filter(Boolean);

  return (
    <div className="space-y-6">
      <SmartReportSectionHeader
        title="AI Insights"
        description="AI-generated analysis of your business data."
        periodLabel={periodLabel}
      />
      <AIQuickInsightsCard insights={points} />
    </div>
  );
}
