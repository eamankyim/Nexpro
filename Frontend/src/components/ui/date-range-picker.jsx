import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useResponsive } from '@/hooks/useResponsive';
import { cn } from '@/lib/utils';

/** Preset keys aligned with Reports overview date filters. */
export const DATE_RANGE_PRESET_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'thisWeek', label: 'This week' },
  { key: 'lastWeek', label: 'Last week' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'thisQuarter', label: 'This quarter' },
  { key: 'lastQuarter', label: 'Last quarter' },
  { key: 'thisYear', label: 'This year' },
  { key: 'lastYear', label: 'Last year' },
];

const CUSTOM_PRESET_KEY = 'custom';

/**
 * DateRangePicker - shadcn-based date range picker with optional preset shortcuts.
 * On viewports below 768px with presets, renders a Select dropdown; custom opens a bottom sheet.
 * @param {Object} range - { from: Date, to?: Date } or null
 * @param {Function} onSelect - (range) => void
 * @param {string} className - optional class names
 * @param {Array<{ key: string, label: string }>} [presets] - left-column preset tabs when popover opens
 * @param {string} [activePreset] - highlighted preset key (e.g. thisMonth, custom)
 * @param {Function} [onPresetSelect] - (presetKey) => void
 */
export function DateRangePicker({
  range,
  onSelect,
  className,
  presets,
  activePreset,
  onPresetSelect,
}) {
  const { isMobile } = useResponsive();
  const [open, setOpen] = React.useState(false);
  const [customSheetOpen, setCustomSheetOpen] = React.useState(false);
  const from = range?.from;
  const to = range?.to;

  const showPresets = Array.isArray(presets) && presets.length > 0;

  const displayText = React.useMemo(() => {
    if (from) {
      return to
        ? `${format(from, 'MMM d, yyyy')} - ${format(to, 'MMM d, yyyy')}`
        : format(from, 'MMM d, yyyy');
    }
    return 'Select date range';
  }, [from, to]);

  const mobileSelectValue = React.useMemo(() => {
    if (activePreset && activePreset !== CUSTOM_PRESET_KEY) {
      return activePreset;
    }
    return CUSTOM_PRESET_KEY;
  }, [activePreset]);

  const mobileSelectLabel = React.useMemo(() => {
    if (activePreset && activePreset !== CUSTOM_PRESET_KEY) {
      const preset = presets?.find((item) => item.key === activePreset);
      if (preset) return preset.label;
    }
    if (from && to) return displayText;
    return 'Custom range';
  }, [activePreset, presets, from, to, displayText]);

  const handleSelect = React.useCallback((newRange) => {
    onSelect?.(newRange);
    if (newRange?.from && newRange?.to) {
      setOpen(false);
      setCustomSheetOpen(false);
    }
  }, [onSelect]);

  const handlePresetClick = React.useCallback((presetKey) => {
    onPresetSelect?.(presetKey);
    setOpen(false);
  }, [onPresetSelect]);

  const handleMobilePresetChange = React.useCallback((value) => {
    if (value === CUSTOM_PRESET_KEY) {
      setCustomSheetOpen(true);
      return;
    }
    onPresetSelect?.(value);
  }, [onPresetSelect]);

  const openCustomPicker = React.useCallback(() => {
    if (isMobile && showPresets) {
      setCustomSheetOpen(true);
      return;
    }
    setOpen(true);
  }, [isMobile, showPresets]);

  if (isMobile && showPresets) {
    return (
      <>
        <Select value={mobileSelectValue} onValueChange={handleMobilePresetChange}>
          <SelectTrigger
            className={cn(
              'w-full border-border bg-card text-foreground',
              className
            )}
            aria-label="Select report period"
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <SelectValue>{mobileSelectLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {presets.map((preset) => (
              <SelectItem key={preset.key} value={preset.key}>
                {preset.label}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_PRESET_KEY}>Custom range</SelectItem>
          </SelectContent>
        </Select>

        <Sheet open={customSheetOpen} onOpenChange={setCustomSheetOpen}>
          <SheetContent side="bottom" className="rounded-t-xl px-4 pb-6 pt-4 max-h-[85vh] overflow-y-auto">
            <SheetHeader className="text-left pb-2">
              <SheetTitle>Custom date range</SheetTitle>
            </SheetHeader>
            <div className="flex justify-center">
              <Calendar
                mode="range"
                selected={range}
                onSelect={handleSelect}
                numberOfMonths={1}
                defaultMonth={from}
                initialFocus
              />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  if (isMobile) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          onClick={openCustomPicker}
          className={cn(
            'w-full justify-start text-left font-normal',
            !from && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" aria-hidden />
          {displayText}
        </Button>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="rounded-t-xl px-4 pb-6 pt-4 max-h-[85vh] overflow-y-auto">
            <SheetHeader className="text-left pb-2">
              <SheetTitle>Select date range</SheetTitle>
            </SheetHeader>
            <div className="flex justify-center">
              <Calendar
                mode="range"
                selected={range}
                onSelect={handleSelect}
                numberOfMonths={1}
                defaultMonth={from}
                initialFocus
              />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !from && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" aria-hidden />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className={cn('flex', showPresets ? 'flex-col sm:flex-row' : '')}>
          {showPresets && (
            <div className="flex sm:flex-col gap-0.5 border-b sm:border-b-0 sm:border-r border-border p-2 sm:min-w-[148px] sm:max-h-[320px] sm:overflow-y-auto">
              {presets.map((preset) => (
                <Button
                  key={preset.key}
                  type="button"
                  variant="ghost"
                  className={cn(
                    'h-9 justify-start px-3 text-sm font-normal rounded-md',
                    activePreset === preset.key
                      ? 'bg-primary/10 text-primary font-medium hover:bg-primary/15 hover:text-primary'
                      : 'text-foreground hover:bg-muted'
                  )}
                  onClick={() => handlePresetClick(preset.key)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          )}
          <div className="p-0">
            <Calendar
              mode="range"
              selected={range}
              onSelect={handleSelect}
              numberOfMonths={2}
              defaultMonth={from}
              initialFocus
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
