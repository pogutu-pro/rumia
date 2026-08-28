import { matchAgentToOfficialRecord } from '@/lib/utils/dekut-verification';
import officialRecordsData from '@/lib/data/dekut-official-records.json';
import { parseOfficialRecord } from '@/lib/utils/dekut-verification';

describe('matchAgentToOfficialRecord', () => {
  const records = officialRecordsData.map((record) =>
    parseOfficialRecord(record),
  );

  it('returns verified with shared contact flag for 0728543703', () => {
    const result = matchAgentToOfficialRecord('0728543703', records);
    expect(result).not.toBeNull();
    expect(result?.state).toBe('verified');
    expect(result?.sharedContactDetected).toBe(true);
    expect(result?.matchedHostels.length).toBe(7);
  });

  it('returns single verified for a unique contact like 0703753641', () => {
    const result = matchAgentToOfficialRecord('0703753641', records);
    expect(result).not.toBeNull();
    expect(result?.state).toBe('verified');
    expect(result?.sharedContactDetected).toBe(false);
    expect(result?.matchedHostels).toEqual(['Sunrise Hostel Block CD']);
  });

  it('returns verified for zone MAIN (0703753641)', () => {
    const result = matchAgentToOfficialRecord('0703753641', records);
    expect(result?.state).toBe('verified');
    expect(result?.matchedHostels).toContain('Sunrise Hostel Block CD');
  });

  it('returns verified for zone NYERI VIEW (0726451805)', () => {
    const result = matchAgentToOfficialRecord('0726451805', records);
    expect(result?.state).toBe('verified');
    expect(result?.matchedHostels).toContain('Angies Hostel');
  });

  it('returns verified for zone EMBASSY (0740671690)', () => {
    const result = matchAgentToOfficialRecord('0740671690', records);
    expect(result?.state).toBe('verified');
    expect(result?.matchedHostels).toContain('Valley Creek Hostel');
  });

  it('returns verified for zone NYARIBO (0723212446)', () => {
    const result = matchAgentToOfficialRecord('0723212446', records);
    expect(result?.state).toBe('verified');
    expect(result?.matchedHostels).toContain('New City');
  });

  it('returns not-confirmed for a phone not in any official record', () => {
    const result = matchAgentToOfficialRecord('0700000000', records);
    expect(result).not.toBeNull();
    expect(result?.state).toBe('not-confirmed');
  });

  it('returns null for empty input', () => {
    const result = matchAgentToOfficialRecord('', records);
    expect(result).toBeNull();
  });
});
