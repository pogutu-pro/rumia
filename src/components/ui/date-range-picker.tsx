'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  date?: DateRange;
  setDate: (date: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  initialFocus?: boolean;
}

export function DateRangePicker({
  date,
  setDate,
  placeholder = 'Pick a date range',
  className,
  disabled,
  initialFocus,
  ...props
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Memoize the formatted label string for efficiency
  const formattedDateLabel = React.useMemo(() => {
    if (date?.from) {
      if (date.to) {
        return `${format(date.from, 'LLL dd, y')} – ${format(date.to, 'LLL dd, y')}`;
      }
      return format(date.from, 'LLL dd, y');
    }
    return null;
  }, [date]);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDate(undefined);
    setIsOpen(false);
  };

  return (
    <div className={cn('grid gap-2', className)} {...props}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          <Button
            id="date"
            variant="outline"
            className={cn(
              'justify-start text-left font-normal h-10 transition-shadow duration-200',
              !date && 'text-muted-foreground',
              disabled && 'cursor-not-allowed opacity-70',
            )}
            aria-haspopup="dialog"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formattedDateLabel ?? <span>{placeholder}</span>}

            {date?.from && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 ml-auto rounded-full text-muted-foreground hover:bg-muted"
                onClick={handleClear}
                aria-label="Clear date range"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-0 z-[60]" align="start">
          <Calendar
            initialFocus={initialFocus}
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={(newDate) => {
              setDate(newDate);
              if (newDate?.from && newDate?.to) {
                setIsOpen(false);
              }
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
