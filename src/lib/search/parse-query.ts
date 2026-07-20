export interface ParsedFilters {
  maxPrice?: number;
  exactPrice?: number;
  gender?: 'male' | 'female';
  roomType?: string;
  amenities: string[];
  area?: string;
  proximityGate?: 'A' | 'B';
  sortByProximity: boolean;
  freeText: string;
}

// ── Keyword Maps ─────────────────────────────────────────────────────────────

const PRICE_WORDS = ['cheap', 'affordable', 'budget'];
const GENDER_FEMALE = ['ladies', 'girls', 'female'];
const GENDER_MALE = ['gents', 'boys', 'male'];
const AREA_KEYWORDS: [string[], string][] = [
  [['near gate a', 'gate a'], 'Near Gate A'],
  [['near gate b', 'gate b'], 'Near Gate B'],
  [['boma'], 'Boma'],
  [['nyeri view'], 'Nyeri View'],
  [['kahawa ridge'], 'Kahawa Ridge'],
  [['embassy'], 'Embassy Area'],
  [['nyaribo'], 'Nyaribo'],
];
const ROOM_TYPES: [string[], string][] = [
  [['self contained', 'ensuite'], 'self_contained'],
  [['bedsitter', 'bed sitter'], 'bedsitter'],
  [['single room', 'single'], 'single'],
  [['double room', 'double'], 'double'],
  [['shared'], 'shared'],
];
const AMENITY_MAP: [string[], string][] = [
  [['wifi', 'internet'], 'WiFi'],
  [['water'], 'Water'],
  [['electricity', 'power'], 'Electricity'],
  [['parking'], 'Parking'],
  [['security', 'guard'], 'Security'],
  [['furnished'], 'Furnished'],
  [['washing', 'laundry'], 'Laundry Area'],
];

// ── Parser ───────────────────────────────────────────────────────────────────

export function parseQuery(input: string): ParsedFilters {
  const lower = input.toLowerCase();
  const filters: ParsedFilters = {
    amenities: [],
    sortByProximity: false,
    freeText: '',
  };
  let remaining = lower;

  if (PRICE_WORDS.some((w) => lower.includes(w))) {
    filters.maxPrice = 5000;
    PRICE_WORDS.forEach((w) => {
      remaining = remaining.replace(w, '');
    });
  }

  const underMatch = remaining.match(/(?:under|below)\s+(\d+\.?\d*)\s*k?/);
  if (underMatch) {
    const num = parseFloat(underMatch[1]);
    filters.maxPrice =
      underMatch[0].includes('k') && num < 1000 ? num * 1000 : num;
    remaining = remaining.replace(underMatch[0], '');
  }

  if (!filters.maxPrice) {
    const numMatch = remaining.match(/\b(\d{3,6})\b/);
    if (numMatch) {
      const num = parseInt(numMatch[1], 10);
      if (num >= 500 && num <= 100000) {
        filters.exactPrice = num;
        remaining = remaining.replace(numMatch[0], '');
      }
    }
  }

  if (GENDER_FEMALE.some((w) => lower.includes(w))) {
    filters.gender = 'female';
    GENDER_FEMALE.forEach((w) => {
      remaining = remaining.replace(w, '');
    });
  } else if (GENDER_MALE.some((w) => lower.includes(w))) {
    filters.gender = 'male';
    GENDER_MALE.forEach((w) => {
      remaining = remaining.replace(w, '');
    });
  }

  for (const [patterns, value] of ROOM_TYPES) {
    for (const p of patterns) {
      if (lower.includes(p)) {
        filters.roomType = value;
        remaining = remaining.replace(p, '');
        break;
      }
    }
    if (filters.roomType) break;
  }

  for (const [patterns, label] of AMENITY_MAP) {
    for (const p of patterns) {
      if (lower.includes(p)) {
        if (!filters.amenities.includes(label)) filters.amenities.push(label);
        remaining = remaining.replace(p, '');
      }
    }
  }

  for (const [patterns, areaName] of AREA_KEYWORDS) {
    for (const p of patterns) {
      if (lower.includes(p)) {
        filters.area = areaName;
        remaining = remaining.replace(p, '');
        break;
      }
    }
    if (filters.area) break;
  }

  if (lower.includes('gate a')) {
    filters.proximityGate = 'A';
    remaining = remaining.replace('gate a', '');
  } else if (lower.includes('gate b')) {
    filters.proximityGate = 'B';
    remaining = remaining.replace('gate b', '');
  }
  if (lower.includes('near campus') || lower.includes('close to campus')) {
    filters.sortByProximity = true;
    remaining = remaining.replace(/near campus|close to campus/g, '');
  }

  filters.freeText = remaining.replace(/\s+/g, ' ').trim();
  return filters;
}
