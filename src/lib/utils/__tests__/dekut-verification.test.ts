import {
  normalizePhone,
  normalizeName,
  parseOfficialRecord,
  matchOfficialRecordToListing,
  matchAgentToOfficialRecord,
  extractVerificationSignals,
  verifyListingAgainstOfficial,
  buildOfficialPhoneIndex,
  type OfficialDeKutRecord,
} from '../dekut-verification';
import officialRecordsData from '@/lib/data/dekut-official-records.json';

const ALL_RECORDS: OfficialDeKutRecord[] = officialRecordsData.map((r) =>
  parseOfficialRecord(r),
);

const PHONE_INDEX = buildOfficialPhoneIndex(ALL_RECORDS);

describe('dekut verification helpers', () => {
  it('normalizes Kenyan phone numbers to +254 format', () => {
    expect(normalizePhone('0703753641')).toBe('+254703753641');
    expect(normalizePhone('0712 345 678')).toBe('+254712345678');
    expect(normalizePhone('+254712345678')).toBe('+254712345678');
    expect(normalizePhone('0116891682')).toBe('+254116891682');
    expect(normalizePhone('0100492929')).toBe('+254100492929');
  });

  it('normalizes hostel names for matching while preserving display names', () => {
    expect(normalizeName('Urban Suites Hostel')).toBe('urban suites');
    expect(normalizeName('DE-LA-NOVA Apartment')).toBe('de la nova');
    expect(normalizeName('Mimshack Students Residence')).toBe(
      'mimshack students residence',
    );
    expect(normalizeName('Purple Gardens Hostel')).toBe('purple gardens');
  });

  describe('parseOfficialRecord', () => {
    it('parses multi-value phone and payment details', () => {
      const record = parseOfficialRecord({
        hostel_name: 'Kimathi Students Centre',
        contacts: '0100492929, 0707862475',
        payments: 'Paybill 452452 A/C 852880; Paybill 111999 A/C 38972',
      });

      expect(record.contacts).toEqual(['+254100492929', '+254707862475']);
      expect(record.payments).toEqual([
        'Paybill 452452 A/C 852880',
        'Paybill 111999 A/C 38972',
      ]);
    });

    it('preserves parenthetical notes like (Landlord) and (Landlady)', () => {
      const record = parseOfficialRecord({
        hostel_name: 'Mwalimu Hostel',
        contacts: '0728675316 (Landlord)',
        payments: 'Mpesa 0728675316, Francis Maina',
      });

      expect(record.contacts).toEqual(['+254728675316']);
      expect(record.contact_notes).toEqual(['Landlord']);
    });

    it('preserves notes for Ngamia record with non-standard formatting', () => {
      const record = parseOfficialRecord({
        hostel_name: 'Ngamia',
        contacts: '0729303782',
        payments: 'Agatha Njeri (Landlord), 0721527355',
      });

      expect(record.contacts).toEqual(['+254729303782']);
      expect(record.payments).toEqual([
        'Agatha Njeri (Landlord), 0721527355',
      ]);
    });

    it('parses zone when provided', () => {
      const record = parseOfficialRecord({
        hostel_name: 'Valley Creek Hostel',
        zone: 'EMBASSY',
        contacts: '0740671690',
        payments: 'Paybill 972901',
      });

      expect(record.zone).toBe('EMBASSY');
    });
  });

  describe('matchAgentToOfficialRecord', () => {
    it('returns verified for Elegant Hostel (0728543703) with shared contact flag', () => {
      const result = matchAgentToOfficialRecord('0728543703', ALL_RECORDS);
      expect(result).not.toBeNull();
      expect(result?.state).toBe('verified');
      expect(result?.sharedContactDetected).toBe(true);
      expect(result?.matchedHostels.length).toBeGreaterThan(1);
      expect(result?.matchedHostels).toContain('Elegant Hostel');
      expect(result?.matchedHostels).toContain('Stoneville Hostel');
      expect(result?.matchedHostels).toContain('Heaven on Earth');
      expect(result?.matchedHostels).toContain('Purple Gardens Hostel');
      expect(result?.matchedHostels).toContain('Mid-black');
      expect(result?.matchedHostels).toContain('Crystal Hostel');
      expect(result?.matchedHostels).toContain('Baru Hostel');
    });

    it('returns not-confirmed for a phone not in any official record', () => {
      const result = matchAgentToOfficialRecord('0700000000', ALL_RECORDS);
      expect(result).not.toBeNull();
      expect(result?.state).toBe('not-confirmed');
      expect(result?.matchedHostels).toEqual([]);
      expect(result?.sharedContactDetected).toBe(false);
    });

    it('returns null for empty input', () => {
      const result = matchAgentToOfficialRecord('', ALL_RECORDS);
      expect(result).toBeNull();
    });
  });

  describe('verification across zones', () => {
    it('ZONE MAIN: verifies Sunrise Hostel Block CD by phone', () => {
      const record = parseOfficialRecord({
        hostel_name: 'Sunrise Hostel Block CD',
        zone: 'MAIN',
        contacts: '0703753641',
        payments: 'Till: 9383225',
      });

      const result = verifyListingAgainstOfficial(
        {
          id: 'test-1',
          title: 'Sunrise Hostel Block CD',
          landlord_phone: '+254703753641',
        },
        [record],
        buildOfficialPhoneIndex([record]),
      );

      expect(result.verified).toBe(true);
      expect(result.match_type).toBe('phone');
      expect(result.matched_hostel).toBe('Sunrise Hostel Block CD');
      expect(result.matched_zone).toBe('MAIN');
    });

    it('ZONE NYERI VIEW: verifies Angies Hostel by phone', () => {
      const record = parseOfficialRecord({
        hostel_name: 'Angies Hostel',
        zone: 'NYERI VIEW & KAHAWA RIDGE',
        contacts: '0726451805',
        payments: 'Equity Acc. 0600291364006',
      });

      const result = verifyListingAgainstOfficial(
        {
          id: 'test-2',
          title: 'Angies Hostel',
          landlord_phone: '+254726451805',
        },
        [record],
        buildOfficialPhoneIndex([record]),
      );

      expect(result.verified).toBe(true);
      expect(result.match_type).toBe('phone');
      expect(result.matched_hostel).toBe('Angies Hostel');
      expect(result.matched_zone).toBe('NYERI VIEW & KAHAWA RIDGE');
    });

    it('ZONE EMBASSY: verifies Valley Creek Hostel by phone', () => {
      const record = parseOfficialRecord({
        hostel_name: 'Valley Creek Hostel',
        zone: 'EMBASSY',
        contacts: '0740671690',
        payments: 'Paybill 972901',
      });

      const result = verifyListingAgainstOfficial(
        {
          id: 'test-3',
          title: 'Valley Creek Hostel',
          landlord_phone: '+254740671690',
        },
        [record],
        buildOfficialPhoneIndex([record]),
      );

      expect(result.verified).toBe(true);
      expect(result.match_type).toBe('phone');
      expect(result.matched_hostel).toBe('Valley Creek Hostel');
      expect(result.matched_zone).toBe('EMBASSY');
    });

    it('ZONE NYARIBO: verifies New City by phone', () => {
      const record = parseOfficialRecord({
        hostel_name: 'New City',
        zone: 'NYARIBO',
        contacts: '0723212446',
        payments: '0723212446 (Landlord)',
      });

      const result = verifyListingAgainstOfficial(
        {
          id: 'test-4',
          title: 'New City',
          landlord_phone: '+254723212446',
        },
        [record],
        buildOfficialPhoneIndex([record]),
      );

      expect(result.verified).toBe(true);
      expect(result.match_type).toBe('phone');
      expect(result.matched_hostel).toBe('New City');
      expect(result.matched_zone).toBe('NYARIBO');
    });

    it('shared contact 0728543703 flags shared_contact_detected', () => {
      const result = verifyListingAgainstOfficial(
        {
          id: 'test-5',
          title: 'Elegant Hostel',
          landlord_phone: '+254728543703',
        },
        ALL_RECORDS,
        PHONE_INDEX,
      );

      expect(result.verified).toBe(true);
      expect(result.shared_contact_detected).toBe(true);
      expect(result.flags).toContain('shared_contact_detected');
    });

    it('hostel NOT on official list returns verified=false with neutral label', () => {
      const result = verifyListingAgainstOfficial(
        {
          id: 'test-6',
          title: 'Rumia Exclusive Hostel',
          landlord_phone: '+254700111222',
        },
        ALL_RECORDS,
        PHONE_INDEX,
      );

      expect(result.verified).toBe(false);
      expect(result.match_type).toBe('none');
      expect(result.matched_hostel).toBeNull();
      expect(result.official_record_no_listing).toBe(false);
      expect(result.flags).not.toContain('official_record_no_listing');
    });

    it('name-only match with similarity >= 0.85 auto-verifies', () => {
      const record = parseOfficialRecord({
        hostel_name: 'Elegant Hostel',
        zone: 'MAIN',
        contacts: '0728543703',
        payments: '0110166490057 Equity Bank',
      });

      const result = verifyListingAgainstOfficial(
        {
          id: 'test-7',
          title: 'Elegant Hostels',
        },
        [record],
        buildOfficialPhoneIndex([record]),
      );

      expect(result.verified).toBe(false);
      expect(result.match_type).toBe('name');
      expect(result.matched_hostel).toBe('Elegant Hostel');
      expect(result.manual_review_needed).toBe(true);
    });

    it('name-only match with low similarity flags manual_name_match_review', () => {
      const record = parseOfficialRecord({
        hostel_name: 'Sunrise Hostel Block CD',
        zone: 'MAIN',
        contacts: '0703753641',
        payments: 'Till: 9383225',
      });

      const result = verifyListingAgainstOfficial(
        {
          id: 'test-8',
          title: 'Sunrise Court',
          landlord_phone: null,
        },
        [record],
        buildOfficialPhoneIndex([record]),
      );

      expect(result.verified).toBe(false);
      expect(result.match_type).toBe('none');
      expect(result.manual_review_needed).toBe(false);
    });

    it('matches agent phone in addition to landlord phone', () => {
      const record = parseOfficialRecord({
        hostel_name: 'Maisha Hostels',
        zone: 'MAIN',
        contacts: '0745409929',
        payments: 'Paybill 400222',
      });

      const result = verifyListingAgainstOfficial(
        {
          id: 'test-9',
          title: 'Maisha Hostels',
          landlord_phone: null,
          agent_phone: '+254745409929',
        },
        [record],
        buildOfficialPhoneIndex([record]),
      );

      expect(result.verified).toBe(true);
      expect(result.match_type).toBe('phone');
    });
  });

  describe('official record completeness', () => {
    it('loads all 93 official records', () => {
      expect(ALL_RECORDS.length).toBe(93);
    });

    it('has records in all 4 zones', () => {
      const mainRecords = officialRecordsData.filter((r) => r.zone === 'MAIN');
      const nyeriRecords = officialRecordsData.filter(
        (r) => r.zone === 'NYERI VIEW & KAHAWA RIDGE',
      );
      const embassyRecords = officialRecordsData.filter(
        (r) => r.zone === 'EMBASSY',
      );
      const nyariboRecords = officialRecordsData.filter(
        (r) => r.zone === 'NYARIBO',
      );

      expect(mainRecords.length).toBeGreaterThan(0);
      expect(nyeriRecords.length).toBeGreaterThan(0);
      expect(embassyRecords.length).toBeGreaterThan(0);
      expect(nyariboRecords.length).toBeGreaterThan(0);
    });

    it('detects 0728543703 as shared across 7 hostels', () => {
      const hostels = PHONE_INDEX.get('+254728543703');
      expect(hostels).toBeDefined();
      expect(hostels?.length).toBe(7);
      expect(hostels).toContain('Elegant Hostel');
      expect(hostels).toContain('Stoneville Hostel');
      expect(hostels).toContain('Heaven on Earth');
      expect(hostels).toContain('Purple Gardens Hostel');
      expect(hostels).toContain('Mid-black');
      expect(hostels).toContain('Crystal Hostel');
      expect(hostels).toContain('Baru Hostel');
    });
  });

  it('extracts phone and payment signals from pasted verification details', () => {
    const signals = extractVerificationSignals(`
      Pay 6000 to:
      0728543703

      Paybill:
      247247
    `);

    expect(signals).toEqual([
      { kind: 'phone', value: '+254728543703' },
      { kind: 'payment', value: '247247' },
    ]);
  });
});
