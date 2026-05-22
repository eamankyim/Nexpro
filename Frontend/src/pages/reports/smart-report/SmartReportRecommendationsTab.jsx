import {
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Gauge,
  Lightbulb,
  Percent,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { OVERVIEW_CARD_BORDER, formatOverviewCurrency } from '../overview/overviewUtils';
import DonutBreakdownCard from './DonutBreakdownCard';
import SmartReportKpiRow from './SmartReportKpiRow';
import SmartReportSectionHeader from './SmartReportSectionHeader';
import { formatInteger } from '../../../utils/formatNumber';

const REC_ICONS = {
  'Increase Revenue': { icon: ShoppingCart, bg: '#dcfce7', color: '#166534' },
  'Reduce Costs': { icon: Percent, bg: '#dbeafe', color: '#1d4ed8' },
  'Improve Efficiency': { icon: Gauge, bg: '#f3e8ff', color: '#7c3aed' },
  'Optimize Cash Flow': { icon: TrendingUp, bg: '#ffedd5', color: '#c2410c' },
  default: { icon: Lightbulb, bg: '#f3f4f6', color: '#374151' },
};

/**
 * Recommendations tab — matches mockup.
 */
export default function SmartReportRecommendationsTab({ snapshot }) {
  const detail = snapshot.recommendationsDetail || {
    summary: { total: 0, highPriority: 0, potentialImpact: 0, effortLabel: 'Medium', progressPercent: 0, implementedCount: 0 },
    topRecommendations: snapshot.recommendations || [],
    byCategory: { slices: [], total: 0 },
    implementation: { slices: [], total: 0 },
    engineMeta: { dataPoints: 15, confidence: 75, confidenceLabel: 'Moderate' },
    aiSummary: snapshot.recommendationsAiSummary || '',
  };

  const { summary, topRecommendations, byCategory, implementation, engineMeta } = detail;

  const kpiItems = [
    {
      label: 'Total Recommendations',
      value: summary.total,
      change: 0,
      sparklineData: [summary.total],
      valueFormatter: (v) => formatInteger(v),
      subLabel: 'Across all areas',
      hideTrend: true,
      icon: Sparkles,
      iconBgColor: '#dcfce7',
      iconColor: '#166534',
    },
    {
      label: 'High Priority',
      value: summary.highPriority,
      change: 0,
      sparklineData: [summary.highPriority],
      valueFormatter: (v) => formatInteger(v),
      subLabel: 'Require immediate action',
      hideTrend: true,
      icon: ArrowUp,
      iconBgColor: '#dbeafe',
      iconColor: '#1d4ed8',
    },
    {
      label: 'Potential Impact',
      value: summary.potentialImpact,
      change: 0,
      sparklineData: [summary.potentialImpact],
      subLabel: 'Potential improvement',
      hideTrend: true,
      icon: TrendingUp,
      iconBgColor: '#fef9c3',
      iconColor: '#a16207',
    },
    {
      label: 'Effort Required',
      value: summary.effortLabel,
      change: 0,
      sparklineData: [0],
      valueFormatter: (v) => v,
      subLabel: 'Most recommendations',
      hideTrend: true,
      icon: Gauge,
      iconBgColor: '#f3e8ff',
      iconColor: '#7c3aed',
    },
    {
      label: 'Implementation Progress',
      value: summary.progressPercent,
      change: 0,
      sparklineData: [summary.progressPercent],
      valueFormatter: (v) => `${Number(v).toFixed(0)}%`,
      subLabel: `${summary.implementedCount} of ${summary.total} implemented`,
      hideTrend: true,
      icon: Users,
      iconBgColor: '#ccfbf1',
      iconColor: '#0f766e',
    },
  ];

  return (
    <div className="space-y-6">
      <SmartReportSectionHeader
        title="Recommendations"
        description="AI-powered actions to improve revenue, reduce costs, and optimize operations."
      />
      <SmartReportKpiRow items={kpiItems} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card style={OVERVIEW_CARD_BORDER} className="bg-card xl:col-span-2">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base font-semibold">Top Recommendations for You</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {topRecommendations.length > 0 ? (
              <>
                {topRecommendations.slice(0, 5).map((rec) => {
                  const iconMeta = REC_ICONS[rec.category] || REC_ICONS.default;
                  const Icon = iconMeta.icon;
                  return (
                    <div key={rec.id} className="border border-border rounded-lg p-4 flex gap-3">
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: iconMeta.bg }}
                      >
                        <Icon className="h-5 w-5" style={{ color: iconMeta.color }} aria-hidden />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                          <p className="font-semibold text-foreground">{rec.title}</p>
                          <Badge
                            className={cn(
                              'shrink-0 border',
                              rec.impactLevel === 'high'
                                ? 'bg-green-100 text-green-800 border-green-200'
                                : 'bg-orange-100 text-orange-800 border-orange-200'
                            )}
                          >
                            {rec.impactLevel === 'high' ? 'High Impact' : 'Medium Impact'}
                          </Badge>
                        </div>
                        {rec.description && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{rec.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {rec.impactValue > 0 && (
                            <span className="font-medium text-green-700">{formatOverviewCurrency(rec.impactValue)}</span>
                          )}
                          <span>Effort: {rec.effort}</span>
                        </div>
                        <Button variant="link" className="h-auto p-0 text-xs text-primary mt-2">
                          View Action Plan <ArrowRight className="h-3 w-3 ml-1 inline" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {topRecommendations.length > 5 && (
                  <Button variant="outline" className="w-full">
                    View All {topRecommendations.length} Recommendations
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </>
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No recommendations for this period yet. Generate a new report with AI analysis enabled.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <DonutBreakdownCard
            title="Recommendations by Category"
            slices={byCategory.slices}
            total={byCategory.total}
            centerLabel="Total"
            formatCenterValue={(v) => formatInteger(v)}
            emptyMessage="No category breakdown"
          />

          <DonutBreakdownCard
            title="Implementation Status"
            slices={implementation.slices}
            total={implementation.total}
            centerLabel="Total"
            formatCenterValue={(v) => formatInteger(v)}
            emptyMessage="No implementation data"
          />

          <Card style={OVERVIEW_CARD_BORDER} className="bg-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-base font-semibold">AI Recommendation Engine</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 text-sm text-muted-foreground space-y-2">
              <p>Recommendations are generated from your revenue, expense, inventory, and customer data for the selected period.</p>
              <div className="pt-2 space-y-1 text-xs">
                <p><span className="font-medium text-foreground">Data Analyzed:</span> {engineMeta.dataPoints}+ data points</p>
                <p><span className="font-medium text-foreground">AI Confidence:</span> {engineMeta.confidence}% {engineMeta.confidenceLabel}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
