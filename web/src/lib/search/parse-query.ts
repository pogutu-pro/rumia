export type TokenType =
  | 'price_max'
  | 'price_min'
  | 'price_exact'
  | 'price_range'
  | 'gender'
  | 'room_type'
  | 'amenity'
  | 'area'
  | 'proximity_gate'
  | 'sort_proximity'
  | 'free_text';

export interface TokenInfo {
  raw: string;
  type: TokenType;
  value: string | number | [number, number] | boolean;
}

export interface ParsedFilters {
  maxPrice?: number;
  minPrice?: number;
  exactPrice?: number;
  gender?: 'male' | 'female';
  roomType?: string;
  amenities: string[];
  area?: string;
  proximityGate?: 'A' | 'B';
  sortByProximity: boolean;
  freeText: string;
  tokens: TokenInfo[];
}

// ── Synonym / Keyword Maps ────────────────────────────────────────────────────

const PRICE_WORDS = ['cheap', 'affordable', 'budget', 'low cost', 'pocket friendly', 'economical'];
const GENDER_FEMALE = ['ladies', 'girls', 'female', 'women', 'lady'];
const GENDER_MALE = ['gents', 'boys', 'male', 'men', 'gent'];
const AREA_KEYWORDS: [string[], string][] = [
  [['near gate a', 'gate a', 'gateA'], 'Near Gate A'],
  [['near gate b', 'gate b', 'gateB'], 'Near Gate B'],
  [['boma'], 'Boma'],
  [['nyeri view'], 'Nyeri View'],
  [['kahawa ridge'], 'Kahawa Ridge'],
  [['embassy', 'embassy area'], 'Embassy Area'],
  [['nyaribo'], 'Nyaribo'],
];
export const ROOM_TYPES: [string[], string][] = [
  [['self contained', 'ensuite', 'self-contained', 'self contained bedsitter'], 'self_contained_bedsitter'],
  [['bedsitter', 'bed sitter'], 'bedsitter'],
  [['single room', 'single'], 'single'],
  [['double room', 'double'], 'double'],
  [['1 bedroom', '1br', 'one bedroom'], 'one_bedroom'],
  [['2 bedroom', '2br', 'two bedroom'], 'two_bedroom'],
  [['3 bedroom', '3br', 'three bedroom'], 'three_bedroom'],
  [['shared'], 'shared'],
];
const AMENITY_MAP: [string[], string][] = [
  [['wifi', 'internet', 'wi-fi', 'wify'], 'WiFi'],
  [['water'], 'Water'],
  [['electricity', 'power', 'stima'], 'Electricity'],
  [['hot water', 'shower', 'geyser'], 'Hot Water'],
  [['cooking gas', 'gas'], 'Cooking Gas'],
  [['parking', 'park'], 'Parking'],
  [['security', 'guard', 'cctv'], 'Security'],
  [['furnished', 'furniture'], 'Furnished'],
  [['washing', 'laundry'], 'Laundry Area'],
  [['kitchen'], 'Kitchen'],
  [['study', 'study area'], 'Study Area'],
  [['balcony'], 'Balcony'],
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripAll(str: string, patterns: string[]): string {
  let result = str;
  for (const p of patterns) {
    result = result.replace(new RegExp(escapeRegex(p), 'gi'), '');
  }
  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Parser ────────────────────────────────────────────────────────────────────

export function parseQuery(input: string): ParsedFilters {
  const lower = input.toLowerCase().trim();
  const filters: ParsedFilters = {
    amenities: [],
    sortByProximity: false,
    freeText: '',
    tokens: [],
  };
  let remaining = lower;

  // ── 1. Price word synonyms ("cheap", "affordable", "budget") ────────────────
  const matchedPriceWords = PRICE_WORDS.filter((w) => lower.includes(w));
  if (matchedPriceWords.length > 0) {
    filters.maxPrice = 5000;
    filters.tokens.push({ raw: matchedPriceWords[0], type: 'price_max', value: 5000 });
    remaining = stripAll(remaining, PRICE_WORDS);
  }

  // ── 2. Range queries: "between 3k and 6k", "3000 to 6000", "3000-6000" ─────
  const rangeMatch = remaining.match(
    /(?:between|ranging?\s+from)?\s*(\d{1,3}(?:\.\d+)?)\s*k?\s*(?:to|-|and)\s*(\d{1,3}(?:\.\d+)?)\s*k/,
  );
  if (rangeMatch) {
    let low = parseFloat(rangeMatch[1]);
    let high = parseFloat(rangeMatch[2]);
    const lowHasK = rangeMatch[0].includes('k');
    const highHasK = /k\s*(?:to|-|and)/.test(rangeMatch[0]);
    if (lowHasK && low < 1000) low *= 1000;
    if (highHasK && high < 1000) high *= 1000;
    if (!rangeMatch[0].match(/k/) && low < 1000 && high > 100) {
      low *= 1000;
      high *= 1000;
    }
    filters.minPrice = Math.round(low);
    filters.maxPrice = Math.round(high);
    filters.tokens.push({ raw: rangeMatch[0], type: 'price_range', value: [Math.round(low), Math.round(high)] });
    remaining = remaining.replace(rangeMatch[0], '');
  }

  // ── 3. "under / below / less than / max" price ──────────────────────────────
  if (!filters.maxPrice && !filters.minPrice) {
    const underMatch = remaining.match(
      /(?:under|below|less\s+than|max(?:imum)?|up\s+to|within)\s+(\d{1,3}(?:\.\d+)?)\s*k?(?:\s*(?:bob|kes|\/mo|per\s*month))?/,
    );
    if (underMatch) {
      let num = parseFloat(underMatch[1]);
      if (underMatch[0].includes('k') && num < 1000) num *= 1000;
      if (!underMatch[0].includes('k') && num < 100 && num > 0) num *= 1000;
      filters.maxPrice = Math.round(num);
      filters.tokens.push({ raw: underMatch[0], type: 'price_max', value: Math.round(num) });
      remaining = remaining.replace(underMatch[0], '');
    }
  }

  // ── 4. "over / above / more than / starting from" price ─────────────────────
  if (!filters.maxPrice && !filters.minPrice && !filters.exactPrice) {
    const overMatch = remaining.match(
      /(?:over|above|more\s+than|starting\s+(?:from|at)|min(?:imum)?)\s+(\d{1,3}(?:\.\d+)?)\s*k?(?:\s*(?:bob|kes|\/mo|per\s*month))?/,
    );
    if (overMatch) {
      let num = parseFloat(overMatch[1]);
      if (overMatch[0].includes('k') && num < 1000) num *= 1000;
      if (!overMatch[0].includes('k') && num < 100 && num > 0) num *= 1000;
      filters.minPrice = Math.round(num);
      filters.tokens.push({ raw: overMatch[0], type: 'price_min', value: Math.round(num) });
      remaining = remaining.replace(overMatch[0], '');
    }
  }

  // ── 5. "around / about / roughly" price ─────────────────────────────────────
  if (!filters.maxPrice && !filters.minPrice && !filters.exactPrice) {
    const aroundMatch = remaining.match(
      /(?:around|about|roughly|approximately|approx)\s+(\d{1,3}(?:\.\d+)?)\s*k?(?:\s*(?:bob|kes|\/mo|per\s*month))?/,
    );
    if (aroundMatch) {
      let num = parseFloat(aroundMatch[1]);
      if (aroundMatch[0].includes('k') && num < 1000) num *= 1000;
      if (!aroundMatch[0].includes('k') && num < 100 && num > 0) num *= 1000;
      const centered = Math.round(num);
      filters.minPrice = centered - 500;
      filters.maxPrice = centered + 500;
      filters.tokens.push({ raw: aroundMatch[0], type: 'price_range', value: [centered - 500, centered + 500] });
      remaining = remaining.replace(aroundMatch[0], '');
    }
  }

  // ── 6. Standalone "Nk" price (e.g., "5k", "10k") ───────────────────────────
  if (!filters.maxPrice && !filters.minPrice && !filters.exactPrice) {
    const kMatch = remaining.match(/\b(\d{1,3}(?:\.\d+)?)k\b/);
    if (kMatch) {
      const num = Math.round(parseFloat(kMatch[1]) * 1000);
      if (num >= 500 && num <= 100000) {
        filters.exactPrice = num;
        filters.tokens.push({ raw: kMatch[0], type: 'price_exact', value: num });
        remaining = remaining.replace(kMatch[0], '');
      }
    }
  }

  // ── 7. Standalone number with optional "bob/kes" (e.g., "5000", "5000 bob") ─
  if (!filters.maxPrice && !filters.minPrice && !filters.exactPrice) {
    const numMatch = remaining.match(/\b(\d{3,6})\b\s*(?:bob|kes)?(?:\s*(?:\/mo|per\s*month))?/);
    if (numMatch) {
      const num = parseInt(numMatch[1], 10);
      if (num >= 500 && num <= 100000) {
        filters.exactPrice = num;
        filters.tokens.push({ raw: numMatch[0], type: 'price_exact', value: num });
        remaining = remaining.replace(numMatch[0], '');
      }
    }
  }

  // ── 8. Gender ───────────────────────────────────────────────────────────────
  if (GENDER_FEMALE.some((w) => new RegExp(`\\b${escapeRegex(w)}\\b`).test(remaining))) {
    filters.gender = 'female';
    filters.tokens.push({ raw: GENDER_FEMALE.find((w) => remaining.includes(w))!, type: 'gender', value: 'female' });
    remaining = stripAll(remaining, GENDER_FEMALE);
  } else if (GENDER_MALE.some((w) => new RegExp(`\\b${escapeRegex(w)}\\b`).test(remaining))) {
    filters.gender = 'male';
    filters.tokens.push({ raw: GENDER_MALE.find((w) => remaining.includes(w))!, type: 'gender', value: 'male' });
    remaining = stripAll(remaining, GENDER_MALE);
  }

  // ── 9. Room type (longest match first to avoid partial matches) ─────────────
  const sortedRoomTypes = [...ROOM_TYPES].sort(
    (a, b) => Math.max(...b[0].map((p) => p.length)) - Math.max(...a[0].map((p) => p.length)),
  );
  for (const [patterns, value] of sortedRoomTypes) {
    const matched = patterns.find((p) => new RegExp(`\\b${escapeRegex(p)}\\b`).test(remaining));
    if (matched) {
      filters.roomType = value;
      filters.tokens.push({ raw: matched, type: 'room_type', value });
      remaining = stripAll(remaining, patterns);
      break;
    }
  }

  // ── 10. Amenities ───────────────────────────────────────────────────────────
  for (const [patterns, label] of AMENITY_MAP) {
    for (const p of patterns) {
      if (new RegExp(`\\b${escapeRegex(p)}\\b`).test(remaining)) {
        if (!filters.amenities.includes(label)) {
          filters.amenities.push(label);
          filters.tokens.push({ raw: p, type: 'amenity', value: label });
        }
        remaining = remaining.replace(new RegExp(`\\b${escapeRegex(p)}\\b`, 'g'), '');
      }
    }
  }

  // ── 11. Area keywords (longest match first) ─────────────────────────────────
  const sortedAreas = [...AREA_KEYWORDS].sort(
    (a, b) => Math.max(...b[0].map((p) => p.length)) - Math.max(...a[0].map((p) => p.length)),
  );
  for (const [patterns, areaName] of sortedAreas) {
    const matched = patterns.find((p) => remaining.includes(p));
    if (matched) {
      filters.area = areaName;
      filters.tokens.push({ raw: matched, type: 'area', value: areaName });
      remaining = stripAll(remaining, patterns);
      break;
    }
  }

  // ── 12. Proximity gate ──────────────────────────────────────────────────────
  if (/\bgate\s*a\b/.test(remaining)) {
    filters.proximityGate = 'A';
    filters.tokens.push({ raw: 'gate a', type: 'proximity_gate', value: 'A' });
    remaining = remaining.replace(/gate\s*a/g, '');
  } else if (/\bgate\s*b\b/.test(remaining)) {
    filters.proximityGate = 'B';
    filters.tokens.push({ raw: 'gate b', type: 'proximity_gate', value: 'B' });
    remaining = remaining.replace(/gate\s*b/g, '');
  }

  // ── 13. Sort by proximity ───────────────────────────────────────────────────
  if (/near\s+campus|close\s+to\s+campus|near\s+school|near\s+dekut|near\s+university/.test(remaining)) {
    filters.sortByProximity = true;
    filters.tokens.push({ raw: 'near campus', type: 'sort_proximity', value: true });
    remaining = remaining.replace(/near\s+campus|close\s+to\s+campus|near\s+school|near\s+dekut|near\s+university/g, '');
  }

  // ── 14. Remaining text becomes free text tokens ─────────────────────────────
  const words = remaining.replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean);
  for (const w of words) {
    filters.tokens.push({ raw: w, type: 'free_text', value: w });
  }
  filters.freeText = words.join(' ');

  return filters;
}
