import { ThumbsDown, ThumbsUp, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * AI summary footer bar + helpful feedback.
 */
export default function SmartReportFooter({
  summary,
  onSeeMore,
  seeMoreLabel = 'See AI Insights →',
  feedback,
  onFeedback,
  className,
}) {
  return (
    <div className={cn('space-y-3 mt-8', className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="flex items-start gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm text-foreground">
            <span className="font-medium">AI Summary: </span>
            {summary}
          </p>
        </div>
        {onSeeMore && (
          <Button variant="link" className="h-auto p-0 text-primary shrink-0" onClick={onSeeMore}>
            {seeMoreLabel}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground border-t border-border pt-4">
        <p>This report is AI-generated using your business data for the selected period.</p>
        <div className="flex items-center gap-2">
          <span>Report helpful?</span>
          <Button
            type="button"
            variant={feedback === 'up' ? 'default' : 'outline'}
            size="icon"
            className="h-8 w-8"
            aria-label="Helpful"
            onClick={() => onFeedback?.('up')}
          >
            <ThumbsUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={feedback === 'down' ? 'default' : 'outline'}
            size="icon"
            className="h-8 w-8"
            aria-label="Not helpful"
            onClick={() => onFeedback?.('down')}
          >
            <ThumbsDown className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
