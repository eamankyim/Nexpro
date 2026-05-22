import { Calendar, Percent, Sparkles, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OVERVIEW_CARD_BORDER } from './overviewUtils';
import OverviewMetricIconBadge from './OverviewMetricIconBadge';

const INSIGHT_ICONS = [
  { icon: TrendingUp, bgColor: '#dcfce7', iconColor: '#166534' },
  { icon: Percent, bgColor: '#ffedd5', iconColor: '#c2410c' },
  { icon: Users, bgColor: '#dbeafe', iconColor: '#1d4ed8' },
  { icon: Calendar, bgColor: '#f3e8ff', iconColor: '#7e22ce' }
];

/**
 * Rule-based AI quick insights card for overview.
 */
export default function AIQuickInsightsCard({ insights = [], onViewAll }) {
  return (
    <Card style={OVERVIEW_CARD_BORDER} className="bg-card h-full">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-green-700" aria-hidden />
          AI Quick Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex flex-col">
        <ul className="space-y-3 flex-1">
          {insights.map((text, idx) => {
            const meta = INSIGHT_ICONS[idx % INSIGHT_ICONS.length];
            return (
              <li key={idx} className="flex gap-3 items-start">
                <OverviewMetricIconBadge
                  icon={meta.icon}
                  bgColor={meta.bgColor}
                  iconColor={meta.iconColor}
                  className="h-8 w-8"
                />
                <span className="text-sm text-muted-foreground leading-relaxed pt-1">{text}</span>
              </li>
            );
          })}
        </ul>
        {onViewAll && (
          <Button variant="outline" className="mt-4 w-full" onClick={onViewAll}>
            View All Insights
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
