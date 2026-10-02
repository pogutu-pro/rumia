export function buildWhatsAppUrl(phone: string, message?: string): string {
  const clean = (phone || '').replace(/[^0-9]/g, '').replace(/^0/, '254');
  const url = `https://wa.me/${clean}`;
  return message ? `${url}?text=${encodeURIComponent(message)}` : url;
}

export function openWhatsApp(phone: string, message?: string): string {
  return buildWhatsAppUrl(phone, message);
}