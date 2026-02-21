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
import { cn } from '@/lib/utils';

/**
 * DateRangePicker - shadcn-based date range picker
 * @param {Object} range - { from: Date, to?: Date } or null
 * @param {Function} onSelect - (range) => void
 * @param {string} className - optional class names
 */
export function DateRangePicker({ range, onSelect, className }) {
  const [open, setOpen] = React.useState(false);
  const from = range?.from;
  const to = range?.to;

  const handleSelect = (newRange) => {
    onSelect?.(newRange);
    if (newRange?.from && newRange?.to) {
      setOpen(false);
    }
  };

  const displayText = from
    ? to
      ? `${format(from, 'MMM d, yyyy')} - ${format(to, 'MMM d, yyyy')}`
      : format(from, 'MMM d, yyyy')
    : 'Select date range';

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
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={range}
          onSelect={handleSelect}
          numberOfMonths={2}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
