import { buildHostelRequestWhatsAppMessage } from '@/lib/utils/hostel-request-message';

describe('buildHostelRequestWhatsAppMessage', () => {
  it('builds a complete professional message with every detail from the request', () => {
    const message = buildHostelRequestWhatsAppMessage({
      studentName: 'Jane Wanjiku',
      preferredZone: 'Boma',
      budgetRange: '3000_5000',
      gender: 'female',
      roomType: 'single',
      furnishing: 'furnished',
      stayPreference: 'sharing',
      moveInDate: '2026-09-15',
      phone: '+254712345678',
      additionalRequirements: 'Wi-Fi and parking',
      fee: 100,
    });

    expect(message).toContain('Hi Jane Wanjiku, thank you for your request');
    expect(message).toContain('Area/Zone: Boma');
    expect(message).toContain('Budget: KSh 3,000 to 5,000/month');
    expect(message).toContain('Gender: Female');
    expect(message).toContain('Room Type: Single room');
    expect(message).toContain('Stay Alone or Sharing: Sharing (cost share)');
    expect(message).toContain('Furnished: Furnished');
    expect(message).toContain('Move-in Date: 15 Sep 2026');
    expect(message).toContain('Phone: +254712345678');
    expect(message).toContain('Additional Requirements: Wi-Fi and parking');
    expect(message).toContain('The hostel-finding request fee is KSh 100');
    // No emojis — must read like a professional WhatsApp announcement.
    expect(message).not.toMatch(/[📍💰👤🛏️🪑📅📱📝]/);
  });

  it('reflects a manager-updated hostel-finding fee in the message', () => {
    const message = buildHostelRequestWhatsAppMessage({
      studentName: 'John Kamau',
      preferredZone: 'Town Center',
      budgetRange: '5000_7000',
      gender: 'male',
      roomType: 'bedsitter',
      furnishing: 'no_preference',
      moveInDate: null,
      phone: '0712345678',
      additionalRequirements: null,
      fee: 250,
    });

    expect(message).toContain('The hostel-finding request fee is KSh 250');
  });

  it('falls back gracefully when optional fields are missing', () => {
    const message = buildHostelRequestWhatsAppMessage({
      studentName: 'John Kamau',
      preferredZone: null,
      budgetRange: 'above_10000',
      gender: 'no_preference',
      roomType: 'no_preference',
      furnishing: 'unfurnished',
      moveInDate: null,
      phone: '0712345678',
      additionalRequirements: null,
    });

    expect(message).toContain('Area/Zone: Any area');
    expect(message).toContain('Budget: Above KSh 10,000/month');
    expect(message).toContain('Gender: No preference');
    expect(message).toContain('Room Type: No preference');
    expect(message).toContain('Stay Alone or Sharing: No preference');
    expect(message).toContain('Move-in Date: Flexible');
    expect(message).toContain('Additional Requirements: None');
    expect(message).not.toContain('undefined');
    expect(message).not.toContain('null');
  });
});
