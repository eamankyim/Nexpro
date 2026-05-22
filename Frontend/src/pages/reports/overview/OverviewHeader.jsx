import { Download, Settings2 } from 'lucide-react';
import { DateRangePicker, DATE_RANGE_PRESET_OPTIONS } from '@/components/ui/date-range-picker';
import { Button } from '@/components/ui/button';
import { formatPeriodLabel } from '../../../utils/formatPeriodLabel';

/**
 * Reports Overview page header with date range and actions.
 */
export default function OverviewHeader({
  dateRange,
  onDateRangeSelect,
  onPresetSelect,
  activePreset,
  onCustomize,
  onDownload,
  downloading = false
}) {
  const pickerRange = dateRange?.[0] && dateRange?.[1]
    ? { from: dateRange[0].toDate(), to: dateRange[1].toDate() }
    : undefined;

  return (
    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Reports Overview</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Executive summary for {formatPeriodLabel(activePreset, dateRange)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker
          range={pickerRange}
          onSelect={onDateRangeSelect}
          presets={DATE_RANGE_PRESET_OPTIONS}
          activePreset={activePreset}
          onPresetSelect={onPresetSelect}
          className="w-auto min-w-[240px]"
        />
        <Button variant="outline" className="border-border bg-card" onClick={onCustomize}>
          <Settings2 className="mr-2 h-4 w-4 shrink-0" aria-hidden />
          Customize Dashboard
        </Button>
        <Button
          className="bg-brand hover:bg-brand-dark text-white"
          onClick={onDownload}
          disabled={downloading}
        >
          <Download className="mr-2 h-4 w-4 shrink-0" aria-hidden />
          {downloading ? 'Generating…' : 'Download Report'}
        </Button>
      </div>
    </div>
  );
}
