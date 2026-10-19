import { buildWhatsAppUrl, cleanPhone, isValidKenyanPhone } from '../phone';

describe('cleanPhone', () => {
  it('normalises the usual Kenyan formats to +254', () => {
    expect(cleanPhone('0712 345 678')).toBe('+254712345678');
    expect(cleanPhone('712345678')).toBe('+254712345678');
    expect(cleanPhone('+254712345678')).toBe('+254712345678');
  });

  it('does not double the country code when the plus is missing', () => {
    expect(cleanPhone('254712345678')).toBe('+254712345678');
    expect(isValidKenyanPhone('254712345678')).toBe(true);
  });
});

describe('buildWhatsAppUrl', () => {
  it('encodes the message', () => {
    expect(buildWhatsAppUrl('0712345678', 'Hi there')).toBe('https://wa.me/+254712345678?text=Hi%20there');
  });
});
