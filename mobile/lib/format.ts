export function formatKES(amount: number): string {
  return `KES ${(amount ?? 0).toLocaleString()}`;
}

export function formatKESPerMonth(amount: number): string {
  return `KES ${(amount ?? 0).toLocaleString()}/mo`;
}

export function formatShortDate(value: string): string {
  return new Date(value).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatLongDate(value: string): string {
  return new Date(value + 'T00:00:00').toLocaleDateString('en-KE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatViewCount(value: number): string {
  return (value ?? 0).toLocaleString();
}