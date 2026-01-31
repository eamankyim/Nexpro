import { memo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SecondaryButton } from '@/components/ui/secondary-button';
import { Calendar, Plus, Filter, X } from 'lucide-react';
import { DatePicker } from 'antd';
import { useResponsive } from '@/hooks/useResponsive';
import BottomSheet from './BottomSheet';
import { cn } from '@/lib/utils';

const { RangePicker } = DatePicker;

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
          <Button
            onClick={onAddClick}
            className="bg-[#166534] hover:bg-[#14532d] text-white min-h-[44px] flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>{addButtonLabel}</span>
          </Button>
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
                  <span className="ml-auto h-2 w-2 rounded-full bg-white"></span>
                )}
              </Button>
            ))}
            
            <div className="pt-2 border-t border-gray-200">
              <div className="text-sm font-medium text-gray-700 mb-3">Custom Date Range</div>
              <div className="w-full">
                <RangePicker
                  onChange={(dates) => {
                    onDateRangeChange(dates);
                    if (dates && dates[0] && dates[1]) {
                      setFilterSheetOpen(false);
                    }
                  }}
                  value={dateRange}
                  format="YYYY-MM-DD"
                  style={{ width: '100%' }}
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
  return (
    <div style={{ display: 'flex', gap: 0, marginBottom: 32, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
        <Button
          onClick={onTodayClick}
          style={{
            backgroundColor: activeFilter === 'today' ? '#166534' : 'white',
            color: activeFilter === 'today' ? 'white' : '#666',
            border: activeFilter === 'today' ? 'none' : '1px solid #e5e7eb',
            borderRadius: 0,
            borderTopLeftRadius: 8,
            borderBottomLeftRadius: 8,
            fontWeight: activeFilter === 'today' ? 600 : 400,
            padding: '8px 16px',
            height: 'auto',
            margin: 0,
            borderRight: 'none'
          }}
        >
          Today
        </Button>
        <Button
          onClick={onWeekClick}
          style={{
            backgroundColor: activeFilter === 'week' ? '#166534' : 'white',
            color: activeFilter === 'week' ? 'white' : '#666',
            border: activeFilter === 'week' ? 'none' : '1px solid #e5e7eb',
            borderRadius: 0,
            fontWeight: activeFilter === 'week' ? 600 : 400,
            padding: '8px 16px',
            height: 'auto',
            margin: 0,
            borderRight: 'none'
          }}
        >
          This week
        </Button>
        <Button
          onClick={onMonthClick}
          style={{
            backgroundColor: activeFilter === 'month' ? '#166534' : 'white',
            color: activeFilter === 'month' ? 'white' : '#666',
            border: activeFilter === 'month' ? 'none' : '1px solid #e5e7eb',
            borderRadius: 0,
            fontWeight: activeFilter === 'month' ? 600 : 400,
            padding: '8px 16px',
            height: 'auto',
            margin: 0,
            borderRight: 'none'
          }}
        >
          This month
        </Button>
        <Button
          onClick={onYearClick}
          style={{
            backgroundColor: activeFilter === 'year' ? '#166534' : 'white',
            color: activeFilter === 'year' ? 'white' : '#666',
            border: activeFilter === 'year' ? 'none' : '1px solid #e5e7eb',
            borderRadius: 0,
            borderTopRightRadius: 8,
            borderBottomRightRadius: 8,
            fontWeight: activeFilter === 'year' ? 600 : 400,
            padding: '8px 16px',
            height: 'auto',
            margin: 0
          }}
        >
          This year
        </Button>
        <div style={{ display: 'none' }}>
          <RangePicker
            onChange={onDateRangeChange}
            value={dateRange}
            format="YYYY-MM-DD"
          />
        </div>
        <Button
          icon={<Calendar className="h-4 w-4" />}
          onClick={() => {
            // Open date picker
            const rangePicker = document.querySelector('.ant-picker');
            if (rangePicker) {
              rangePicker.click();
            }
          }}
          style={{
            backgroundColor: 'white',
            color: '#666',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '8px 16px',
            height: 'auto',
            marginLeft: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          Select date
        </Button>
      </div>
      <Button
        icon={<Plus className="h-4 w-4" />}
        onClick={onAddClick}
        style={{
          backgroundColor: '#166534',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          padding: '8px 16px',
          height: 'auto',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
      >
        {addButtonLabel}
      </Button>
    </div>
  );
});

DateFilterButtons.displayName = 'DateFilterButtons';

export default DateFilterButtons;
