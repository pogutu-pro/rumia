'use client';

import * as React from 'react';
import { format, getYear, setYear, setMonth, startOfYear, addYears, subYears } from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DynamicDatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

type SelectionMode = 'day' | 'month' | 'year';

export function DynamicDatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  disabled,
  className,
}: DynamicDatePickerProps) {
  const safeValue = React.useMemo(() => {
    if (!value) return undefined;
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }, [value]);

  const [mode, setMode] = React.useState<SelectionMode>('day');
  const [isOpen, setIsOpen] = React.useState(false);
  const [viewDate, setViewDate] = React.useState<Date>(safeValue || new Date());

  // Reset mode to day when opening
  React.useEffect(() => {
    if (isOpen) {
      setMode('day');
      if (safeValue) setViewDate(safeValue);
    }
  }, [isOpen, safeValue]);

  const handleDaySelect = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    setViewDate(newDate);
    setMode('month');
  };

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(viewDate.getFullYear(), monthIndex, viewDate.getDate());
    setViewDate(newDate);
    setMode('year');
  };

  const handleYearSelect = (year: number) => {
    const newDate = new Date(year, viewDate.getMonth(), viewDate.getDate());
    setViewDate(newDate);
    onChange?.(newDate);
    setIsOpen(false);
  };

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  // Generate years grid (current view +/- 6 years)
  const startYear = Math.floor(getYear(viewDate) / 12) * 12;
  const years = Array.from({ length: 12 }, (_, i) => startYear + i);

  // Generate days 1-31
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const containerVariants = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  };

  const viewVariants = {
    initial: { opacity: 0, x: 10 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -10 },
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full h-14 justify-start text-left font-black border-2 border-input bg-background rounded-none uppercase tracking-widest transition-all hover:border-primary/50',
            !value && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-3 h-5 w-5 text-primary" />
          {safeValue ? format(safeValue, 'PPP') : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0 border-2 border-primary rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]" align="start">
        <div className="p-3 border-b-2 border-primary bg-primary/5">
          <Tabs value={mode} onValueChange={(v) => setMode(v as SelectionMode)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-white border-2 border-primary rounded-none h-10 p-0 overflow-hidden">
              <TabsTrigger 
                value="day" 
                className="rounded-none data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase text-[10px] tracking-widest border-r-2 border-primary last:border-r-0"
              >
                Day
              </TabsTrigger>
              <TabsTrigger 
                value="month" 
                className="rounded-none data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase text-[10px] tracking-widest border-r-2 border-primary last:border-r-0"
              >
                Month
              </TabsTrigger>
              <TabsTrigger 
                value="year" 
                className="rounded-none data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase text-[10px] tracking-widest"
              >
                Year
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="p-4 bg-white overflow-hidden min-h-[300px]">
          <AnimatePresence mode="wait">
            {mode === 'day' && (
              <motion.div
                key="day"
                variants={viewVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-center px-2 mb-4">
                  <span className="font-black uppercase tracking-widest text-sm text-primary">Step 1: Select Day</span>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {days.map((day) => {
                    const isSelected = safeValue?.getDate() === day && 
                                     safeValue?.getMonth() === viewDate.getMonth() &&
                                     safeValue?.getFullYear() === viewDate.getFullYear();
                    return (
                      <Button
                        key={day}
                        variant={isSelected ? 'default' : 'outline'}
                        className={cn(
                          "rounded-none border-2 font-black p-0 h-9 w-9 text-xs",
                          isSelected ? "border-primary" : "border-gray-50 hover:border-primary"
                        )}
                        onClick={() => handleDaySelect(day)}
                      >
                        {day}
                      </Button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {mode === 'month' && (
              <motion.div
                key="month"
                variants={viewVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-center px-2 mb-4">
                   <span className="font-black uppercase tracking-widest text-sm text-primary">Step 2: Select Month</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {months.map((month, index) => (
                    <Button
                      key={month}
                      variant={viewDate.getMonth() === index ? 'default' : 'outline'}
                      className={cn(
                        "rounded-none border-2 font-black uppercase tracking-tight text-xs h-12",
                        viewDate.getMonth() === index ? "border-primary" : "border-gray-100 hover:border-primary"
                      )}
                      onClick={() => handleMonthSelect(index)}
                    >
                      {month}
                    </Button>
                  ))}
                </div>
              </motion.div>
            )}

            {mode === 'year' && (
              <motion.div
                key="year"
                variants={viewVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-center px-2 mb-4">
                  <span className="font-black uppercase tracking-widest text-sm text-primary">Step 3: Select Year</span>
                </div>
                <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto p-1 custom-scrollbar">
                  {Array.from({ length: 81 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                    <Button
                      key={year}
                      variant={getYear(viewDate) === year ? 'default' : 'outline'}
                      className={cn(
                        "rounded-none border-2 font-black uppercase tracking-tight text-xs h-12",
                        getYear(viewDate) === year ? "border-primary" : "border-gray-100 hover:border-primary"
                      )}
                      onClick={() => handleYearSelect(year)}
                    >
                      {year}
                    </Button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </PopoverContent>
    </Popover>
  );
}
