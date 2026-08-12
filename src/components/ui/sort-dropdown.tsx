'use client';

import * as React from 'react';
import { ListFilter, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils/cn';

export interface SortOption {
  value: string;
  label: string;
}

interface SortDropdownProps {
  options: SortOption[];
  currentSort: string;
  onSortChange: (sortValue: string) => void;
  label?: string;
}

export function SortDropdown({
  options,
  currentSort,
  onSortChange,
  label = 'Sort By',
}: SortDropdownProps) {
  const currentLabel =
    options.find((o) => o.value === currentSort)?.label || label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="space-x-2">
          <ListFilter className="h-4 w-4" />
          <span className="font-medium">{currentLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-semibold">{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onSortChange(option.value)}
            className={cn(
              'cursor-pointer flex items-center justify-between',
              currentSort === option.value &&
                'bg-accent text-accent-foreground font-medium',
            )}
          >
            <span>{option.label}</span>
            {currentSort === option.value && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
