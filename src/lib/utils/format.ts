export function truncate(text: string, length: number = 100): string {
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
