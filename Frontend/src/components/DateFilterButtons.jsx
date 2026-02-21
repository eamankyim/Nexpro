import { memo, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Button } from '@/components/ui/button';
import { SecondaryButton } from '@/components/ui/secondary-button';
import { Plus, Filter } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useResponsive } from '@/hooks/useResponsive';
import BottomSheet from './BottomSheet';
import { cn } from '@/lib/utils';

/**
 * DateFilterButtons - Reusable date filter buttons component
 * @param {string} activeFilter - Currently active filter ('today', 'yesterday', 'week', 'month', 'quarter', 'year', or null)
 * @param {Function} onTodayClick - Handler for Today button
 * @param {Function} onYesterdayClick - Handler for Yesterday button (optional)
 * @param {Function} onWeekClick - Handler for This week button
 * @param {Function} onMonthClick - Handler for This month button
 * @param {Function} onQuarterClick - Handler for This quarter button (optional)
 * @param {Function} onYearClick - Handler for This year button
 * @param {Function} onDateRangeChange - Handler for date range picker
 * @param {Array} dateRange - Current date range value
 * @param {Function} onAddClick - Handler for Add button
 * @param {string} addButtonLabel - Label for the Add button (e.g., 'Add job' or 'Add sale')
 */
const DateFilterButtons = memo(({
  activeFilter,
  onTodayClick,
  onYesterdayClick,
  onWeekClick,
  onMonthClick,
  onQuarterClick,
  onYearClick,
  onDateRangeChange,
  dateRange,
  onAddClick,
  addButtonLabel = 'Add job'
}) => {
  const { isMobile } = useResponsive();
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

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

  const handleFilterClick = (filterFn) => {
    filterFn();
    if (isMobile) {
      setFilterSheetOpen(false);
    }
  };

  const filterButtons = [
    { label: 'Today', onClick: onTodayClick, active: activeFilter === 'today' },
    ...(onYesterdayClick ? [{ label: 'Yesterday', onClick: onYesterdayClick, active: activeFilter === 'yesterday' }] : []),
    { label: 'This week', onClick: onWeekClick, active: activeFilter === 'week' },
    { label: 'This month', onClick: onMonthClick, active: activeFilter === 'month' },
    ...(onQuarterClick ? [{ label: 'This quarter', onClick: onQuarterClick, active: activeFilter === 'quarter' }] : []),
    { label: 'This year', onClick: onYearClick, active: activeFilter === 'year' },
  ];

  // Mobile: Show filter button that opens bottom sheet
  if (isMobile) {
    return (
      <>
        <div className="flex items-center justify-between gap-2 mb-6">
          <Tooltip>
            <TooltipTrigger asChild>
              <SecondaryButton
                onClick={() => setFilterSheetOpen(true)}
                className="flex items-center gap-2 min-h-[44px]"
              >
                <Filter className="h-4 w-4" />
                <span>
                  {activeFilter 
                    ? filterButtons.find(b => b.active)?.label || 'Filter'
                    : 'Filter'}
                </span>
                {activeFilter && (
                  <span className="ml-1 h-2 w-2 rounded-full bg-[#166534]"></span>
                )}
              </SecondaryButton>
            </TooltipTrigger>
            <TooltipContent side="bottom">Filter dashboard by date range</TooltipContent>
          </Tooltip>
          {onAddClick && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onAddClick}
                  aria-label={addButtonLabel}
                  className="bg-[#166534] hover:bg-[#14532d] text-white min-h-[44px] flex items-center gap-2 shrink-0"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">{addButtonLabel}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {addButtonLabel === 'Add sale' ? 'Open Point of Sale to record a new sale' : 'Create a new job or order'}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <BottomSheet
          open={filterSheetOpen}
          onOpenChange={setFilterSheetOpen}
          title="Filter by Date"
        >
          <div className="space-y-3">
            {filterButtons.map((filter) => (
              <Button
                key={filter.label}
                variant={filter.active ? "default" : "outline"}
                onClick={() => handleFilterClick(filter.onClick)}
                className={cn(
                  "w-full justify-start min-h-[44px]",
                  filter.active && "bg-[#166534] hover:bg-[#14532d] text-white"
                )}
              >
                {filter.label}
                {filter.active && (
                  <span className="ml-auto h-2 w-2 rounded-full bg-primary-foreground"></span>
                )}
              </Button>
            ))}
            
            <div className="pt-2 border-t border-border">
              <div className="text-sm font-medium text-foreground mb-3">Custom Date Range</div>
              <div className="w-full">
                <DateRangePicker
                  range={rangeForPicker}
                  onSelect={(newRange) => {
                    handleRangeSelect(newRange);
                    if (newRange?.from && newRange?.to) {
                      setFilterSheetOpen(false);
                    }
                  }}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </BottomSheet>
      </>
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
