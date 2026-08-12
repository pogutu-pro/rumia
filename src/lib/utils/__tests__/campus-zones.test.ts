import { normalizeCampusAreaSelection } from '@/lib/utils/campus-zones';

describe('normalizeCampusAreaSelection', () => {
  it('returns the canonical zone name when the selected area matches a campus zone', () => {
    const availableAreas = [{ name: 'Embassy Area' }, { name: 'Near Gate A' }];

    expect(normalizeCampusAreaSelection('near gate a', availableAreas)).toBe(
      'Near Gate A',
    );
  });

  it('returns null when the selected area is not configured for the campus', () => {
    const availableAreas = [{ name: 'Embassy Area' }];

    expect(normalizeCampusAreaSelection('Kahawa', availableAreas)).toBeNull();
  });
});
