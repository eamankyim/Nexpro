import { memo, useMemo } from 'react';
import dayjs from 'dayjs';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useResponsive } from '@/hooks/useResponsive';
import { cn } from '@/lib/utils';

/**
 * DateFilterButtons - Reusable date filter buttons component
 * @param {string} activeFilter - Currently active filter ('today', 'yesterday', 'week', 'month', 'quarter', 'year', or null)
 * @param {Function} onTodayClick - Handler for Today button
 * @param {Function} onWeekClick - Handler for This week button
 * @param {Function} onMonthClick - Handler for This month button
 * @param {Function} onYearClick - Handler for This year button
 * @param {Function} onDateRangeChange - Handler for date range picker
 * @param {Array} dateRange - Current date range value
 * @param {Function} onAddClick - Handler for Add button
 * @param {string} addButtonLabel - Label for the Add button (e.g., 'Add job' or 'Add sale')
 */
const DateFilterButtons = memo(({
  activeFilter,
  onTodayClick,
  onWeekClick,
  onMonthClick,
  onYearClick,
  onDateRangeChange,
  dateRange,
  onAddClick,
  addButtonLabel = 'Add job'
}) => {
  const { isMobile } = useResponsive();

  const rangeForPicker = useMemo(() => {
    if (!dateRange || !dateRange[0] || !dateRange[1]) return undefined;
    return { from: dateRange[0].toDate(), to: dateRange[1].toDate() };
  }, [dateRange]);

  const handleRangeSelect = (newRange) => {
    if (!newRange?.from) {
      onDateRangeChange?.(null);
      return;
    }
    const from = dayjs(newRange.from);
    const to = newRange.to ? dayjs(newRange.to) : from;
    onDateRangeChange?.([from, to]);
  };

  // Mobile: Show 3 equal-width date tabs
  if (isMobile) {
    const mobileTabClass = (key) =>
      cn(
        'flex-1 min-w-0 rounded-none px-0',
        activeFilter === key
          ? 'bg-primary text-primary-foreground font-semibold hover:bg-primary/90'
          : 'bg-background text-muted-foreground hover:bg-muted'
      );

    return (
      <div className="mb-6 space-y-3" data-tour="date-filters-mobile">
        <div className="flex w-full overflow-hidden rounded-lg border border-border divide-x divide-border">
          <Button
            type="button"
            onClick={onTodayClick}
            variant="ghost"
            className={mobileTabClass('today')}
          >
            Today
          </Button>
          <Button
            type="button"
            onClick={onWeekClick}
            variant="ghost"
            className={mobileTabClass('week')}
          >
            This week
          </Button>
          <Button
            type="button"
            onClick={onMonthClick}
            variant="ghost"
            className={mobileTabClass('month')}
          >
            This month
          </Button>
        </div>

        {onAddClick && (
          <Button
            type="button"
            onClick={onAddClick}
            aria-label={addButtonLabel}
            className="w-full bg-brand hover:bg-brand-dark text-white min-h-[44px] flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span className="whitespace-nowrap">{addButtonLabel}</span>
          </Button>
        )}
      </div>
    );
  }

  // Desktop: Show all buttons inline
  const filterBtnClass = (key) => cn(
    'px-4 py-2 h-auto font-normal rounded-none border-y border-l border-r-0 last:border-r last:rounded-r-lg first:rounded-l-lg',
    activeFilter === key ? 'bg-primary text-primary-foreground font-semibold border-primary' : 'bg-card text-muted-foreground border-border hover:bg-muted'
  );

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 mb-8"
      data-tour="date-filters"
    >
      <div className="flex items-center">
        <Button onClick={onTodayClick} variant="ghost" className={filterBtnClass('today')}>Today</Button>
        <Button onClick={onWeekClick} variant="ghost" className={filterBtnClass('week')}>This week</Button>
        <Button onClick={onMonthClick} variant="ghost" className={filterBtnClass('month')}>This month</Button>
        <Button onClick={onYearClick} variant="ghost" className={filterBtnClass('year')}>This year</Button>
        <DateRangePicker
          range={rangeForPicker}
          onSelect={handleRangeSelect}
          className="ml-2 w-auto min-w-[180px] bg-card text-muted-foreground border-border hover:bg-muted"
        />
      </div>
      {onAddClick && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={onAddClick} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              <Plus className="h-4 w-4" />
              {addButtonLabel}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {addButtonLabel === 'Add sale' ? 'Open Point of Sale to record a new sale' : 'Create a new job or order'}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
});

DateFilterButtons.displayName = 'DateFilterButtons';

export default DateFilterButtons;
