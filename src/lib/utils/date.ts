import { format, parseISO } from 'date-fns';

export function formatDate(date: string | Date, pattern = 'PPP'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, pattern);
}

export function isDateInFuture(date: Date): boolean {
  return date > new Date();
}
