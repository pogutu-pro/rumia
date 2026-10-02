export interface OfficialDeKutRecord {
  hostel_name: string;
  zone?: string;
  contacts: string[];
  payments: string[];
  contact_notes: string[];
}

export interface ListingMatchCandidate {
  id: string;
  title: string;
  county?: string | null;
  area?: string | null;
  slug?: string | null;
  landlord_phone?: string | null;
  agent_phone?: string | null;
  agent_whatsapp?: string | null;
  agent_verified?: boolean | null;
  verified?: boolean | null;
  mpesa_details?: string | null;
  specific_location?: string | null;
}

export interface ListingMatchResult {
  matched: boolean;
  requiresManualReview: boolean;
  matchReason: 'phone' | 'name' | 'manual' | null;
  normalizedName?: string;
  similarity?: number;
}

export interface VerificationSignal {
  kind: 'phone' | 'payment';
  value: string;
}

export interface VerificationOutcome {
  state: 'verified' | 'mismatch' | 'not-found';
  label: string;
  description: string;
  officialContact?: string;
  providedContact?: string;
  officialPayment?: string;
  providedPayment?: string;
  matchedHostel?: string;
}

export interface AgentVerificationResult {
  state: 'verified' | 'not-confirmed';
  matchedHostels: string[];
  officialContact?: string;
  agentPhone?: string;
  paymentDetails?: string;
  verifiedDate?: string;
  sharedContactDetected: boolean;
}

export interface ListingVerificationResult {
  verified: boolean;
  verified_source: string | null;
  verified_date: string | null;
  match_type: 'phone' | 'name' | 'manual' | 'none';
  match_confidence: number | null;
  matched_hostel: string | null;
  matched_zone: string | null;
  flags: string[];
  discrepancy_review_needed: boolean;
  shared_contact_detected: boolean;
  manual_review_needed: boolean;
  official_record_no_listing: boolean;
}

const NAME_SUFFIXES = ['hostel', 'hostels', 'apartment', 'apartments'];

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('254')) return `+${digits}`;
  if (digits.startsWith('0')) return `+254${digits.slice(1)}`;
  return `+254${digits}`;
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => !NAME_SUFFIXES.includes(token))
    .join(' ');
}

/**
 * Parse a raw official record into a structured OfficialDeKutRecord.
 * Preserves parenthetical notes like "(Landlord)" or "(Landlady)" as contact_notes.
 * Phone numbers are normalized; notes are kept separate for admin review.
 */
export function parseOfficialRecord(raw: {
  hostel_name: string;
  zone?: string;
  contacts?: string | null;
  payments?: string | null;
}): OfficialDeKutRecord {
  const rawContacts = (raw.contacts || '')
    .split(/[;,]/)
    .map((value) => value.trim())
    .filter(Boolean);

  const contacts: string[] = [];
  const contact_notes: string[] = [];

  for (const rawContact of rawContacts) {
    const noteMatch = rawContact.match(/\(([^)]+)\)/);
    if (noteMatch) {
      contact_notes.push(noteMatch[1]);
    }
    const phone = normalizePhone(rawContact);
    if (phone) {
      contacts.push(phone);
    }
  }

  const payments = (raw.payments || '')
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    hostel_name: raw.hostel_name,
    zone: raw.zone,
    contacts,
    payments,
    contact_notes,
  };
}

export function extractVerificationSignals(raw: string): VerificationSignal[] {
  const extracted: VerificationSignal[] = [];
  const seen = new Set<string>();

  const phoneMatches = raw.match(/\+?254\d{9}|0\d{9}|\b\d{9}\b/g) || [];
  phoneMatches.forEach((match) => {
    const normalized = normalizePhone(match);
    if (!normalized || seen.has(`phone:${normalized}`)) return;
    seen.add(`phone:${normalized}`);
    extracted.push({ kind: 'phone', value: normalized });
  });

  const cleanRaw = raw.trim();

  // If input is purely digits or digits with space/dashes of 4 to 8 length
  const digitsOnly = cleanRaw.replace(/\D/g, '');
  if (digitsOnly && digitsOnly.length >= 4 && digitsOnly.length <= 8) {
    const signature = `payment:${digitsOnly}`;
    if (!seen.has(signature)) {
      seen.add(signature);
      extracted.push({ kind: 'payment', value: digitsOnly });
    }
  }

  // Look for any 4-8 digit numbers or numbers near paybill/till/account/mpesa keywords
  const numMatches = cleanRaw.match(/\b\d{4,8}\b/g) || [];
  numMatches.forEach((num) => {
    // Avoid double adding if it's part of a 10-digit phone
    if (phoneMatches.some((p) => p.includes(num))) return;
    const signature = `payment:${num}`;
    if (!seen.has(signature)) {
      seen.add(signature);
      extracted.push({ kind: 'payment', value: num });
    }
  });

  return extracted;
}

export function buildVerificationOutcome(
  officialRecord: OfficialDeKutRecord,
  providedSignals: VerificationSignal[],
): VerificationOutcome {
  const providedContact = providedSignals.find(
    (signal) => signal.kind === 'phone',
  )?.value;
  const officialPayment = officialRecord.payments[0];
  const providedPayment = providedSignals.find(
    (signal) => signal.kind === 'payment',
  )?.value;

  const matchedContact = officialRecord.contacts.find(
    (contact) => providedContact && contact === providedContact,
  );

  if (matchedContact) {
    return {
      state: 'verified',
      label: 'Verified',
      description: `${officialRecord.hostel_name} is confirmed against DeKUT's official housing list dated 14 July 2026. The contact you were given matches our official record.`,
      officialContact: matchedContact,
      providedContact,
      officialPayment,
      providedPayment,
    };
  }

  if (providedContact && officialRecord.contacts.length > 0) {
    return {
      state: 'mismatch',
      label: 'Mismatch',
      description:
        'The contact you provided does not match the official record. Do not pay until you confirm directly with the hostel.',
      officialContact: officialRecord.contacts[0],
      providedContact,
      officialPayment,
      providedPayment,
    };
  }

  return {
    state: 'not-found',
    label: 'Not found',
    description:
      "This contact is not yet on DeKUT's official housing list or our records. This does not necessarily mean it is unsafe. For assistance contact DeKUT Students' Welfare.",
    officialContact: officialRecord.contacts[0] ?? undefined,
    providedPayment,
  };
}

export function matchOfficialRecordToListing(
  record: OfficialDeKutRecord,
  listing: ListingMatchCandidate,
): ListingMatchResult {
  const normalizedListingName = normalizeName(listing.title);
  const normalizedRecordName = normalizeName(record.hostel_name);

  const listingPhones = [
    listing.landlord_phone,
    listing.agent_phone,
    listing.agent_whatsapp,
  ]
    .filter(Boolean)
    .map((p) => normalizePhone(p as string));

  const phoneMatches = record.contacts.some((contact) =>
    listingPhones.some((lp) => lp && lp === contact),
  );

  if (phoneMatches) {
    return {
      matched: true,
      requiresManualReview: false,
      matchReason: 'phone',
      normalizedName: normalizedRecordName,
    };
  }

  const similarity = similarityScore(
    normalizedRecordName,
    normalizedListingName,
  );

  if (similarity >= 0.85) {
    return {
      matched: true,
      requiresManualReview: false,
      matchReason: 'name',
      normalizedName: normalizedRecordName,
      similarity,
    };
  }

  return {
    matched: false,
    requiresManualReview: true,
    matchReason: 'manual',
    normalizedName: normalizedRecordName,
    similarity,
  };
}

/**
 * Check an agent phone against all official records.
 * Returns ALL matching hostels (not just the first), and flags shared contacts.
 */
export function matchAgentToOfficialRecord(
  agentPhone: string,
  records: OfficialDeKutRecord[],
): AgentVerificationResult | null {
  if (!agentPhone) return null;

  const normalized = normalizePhone(agentPhone);
  if (!normalized) return null;

  const matchedHostels: string[] = [];
  let matchedRecord: OfficialDeKutRecord | null = null;

  for (const record of records) {
    if (record.contacts.some((c) => c === normalized)) {
      matchedHostels.push(record.hostel_name);
      if (!matchedRecord) {
        matchedRecord = record;
      }
    }
  }

  if (matchedHostels.length > 0) {
    return {
      state: 'verified',
      matchedHostels,
      officialContact: normalized,
      agentPhone: normalized,
      paymentDetails: matchedRecord?.payments[0],
      verifiedDate: '14 July 2026',
      sharedContactDetected: matchedHostels.length > 1,
    };
  }

  return {
    state: 'not-confirmed',
    matchedHostels: [],
    agentPhone: normalized,
    sharedContactDetected: false,
  };
}

/**
 * Build a phone index from official records for shared contact detection.
 * Returns a map from normalized phone → list of hostel names using it.
 */
export function buildOfficialPhoneIndex(
  records: OfficialDeKutRecord[],
): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const record of records) {
    for (const contact of record.contacts) {
      const bucket = index.get(contact) ?? [];
      bucket.push(record.hostel_name);
      index.set(contact, bucket);
    }
  }
  return index;
}

/**
 * Full verification of a Rumia listing against the official DeKUT dataset.
 * Returns verification result with flags for review/discrepancy.
 */
export function verifyListingAgainstOfficial(
  listing: ListingMatchCandidate,
  officialRecords: OfficialDeKutRecord[],
  officialPhoneIndex?: Map<string, string[]>,
): ListingVerificationResult {
  const phoneIndex =
    officialPhoneIndex ?? buildOfficialPhoneIndex(officialRecords);

  const listingPhones = [
    listing.landlord_phone,
    listing.agent_phone,
    listing.agent_whatsapp,
  ]
    .filter(Boolean)
    .map((p) => normalizePhone(p as string))
    .filter((p) => p);

  const flags: string[] = [];
  let bestMatch: {
    record: OfficialDeKutRecord;
    matchType: 'phone' | 'name';
    confidence: number;
  } | null = null;

  // Phone match takes priority
  for (const phone of listingPhones) {
    const hostelsForPhone = phoneIndex.get(phone);
    if (hostelsForPhone) {
      const record = officialRecords.find((r) =>
        r.contacts.includes(phone),
      );
      if (record) {
        if (hostelsForPhone.length > 1) {
          flags.push('shared_contact_detected');
        }
        if (!bestMatch || bestMatch.matchType !== 'phone') {
          bestMatch = {
            record,
            matchType: 'phone',
            confidence: 1.0,
          };
        }
      }
    }
  }

  // Name match if no phone match
  if (!bestMatch) {
    const normalizedListingName = normalizeName(listing.title);
    for (const record of officialRecords) {
      const normalizedRecordName = normalizeName(record.hostel_name);
      const similarity = similarityScore(
        normalizedRecordName,
        normalizedListingName,
      );

      if (similarity >= 0.85) {
        if (!bestMatch || similarity > bestMatch.confidence) {
          bestMatch = {
            record,
            matchType: 'name',
            confidence: similarity,
          };
        }
      } else if (similarity >= 0.5 && similarity < 0.85) {
        flags.push('manual_name_match_review');
      }
    }
  }

  if (bestMatch) {
    const verified = bestMatch.matchType === 'phone';
    const needsManualReview = bestMatch.matchType === 'name';

    return {
      verified,
      verified_source: verified
        ? 'DeKUT Official Housing List'
        : null,
      verified_date: verified ? '2026-07-14' : null,
      match_type: bestMatch.matchType,
      match_confidence: bestMatch.confidence,
      matched_hostel: bestMatch.record.hostel_name,
      matched_zone: bestMatch.record.zone ?? null,
      flags,
      discrepancy_review_needed: needsManualReview,
      shared_contact_detected: flags.includes('shared_contact_detected'),
      manual_review_needed: needsManualReview,
      official_record_no_listing: false,
    };
  }

  if (listing.verified || listing.agent_verified) {
    return {
      verified: true,
      verified_source: listing.agent_verified ? 'Verified Agent on Rumia' : 'Rumia Verified Listing',
      verified_date: '2026-07-14',
      match_type: 'manual',
      match_confidence: 1.0,
      matched_hostel: listing.title,
      matched_zone: listing.area ?? null,
      flags: [],
      discrepancy_review_needed: false,
      shared_contact_detected: false,
      manual_review_needed: false,
      official_record_no_listing: false,
    };
  }

  return {
    verified: false,
    verified_source: null,
    verified_date: null,
    match_type: 'none',
    match_confidence: null,
    matched_hostel: null,
    matched_zone: null,
    flags: [],
    discrepancy_review_needed: false,
    shared_contact_detected: false,
    manual_review_needed: false,
    official_record_no_listing: false,
  };
}

/**
 * Generate verification results for all official records against Rumia listings.
 * Returns which official records have no matching Rumia listing.
 */
export function generateOfficialRecordResults(
  officialRecords: OfficialDeKutRecord[],
  rumiaListings: ListingMatchCandidate[],
): {
  official_record_no_listing: OfficialDeKutRecord[];
  matched_count: number;
  shared_contact_groups: string[];
} {
  const phoneIndex = buildOfficialPhoneIndex(officialRecords);
  const unmatched: OfficialDeKutRecord[] = [];
  let matched = 0;

  for (const record of officialRecords) {
    let found = false;
    for (const listing of rumiaListings) {
      const result = verifyListingAgainstOfficial(
        listing,
        [record],
        phoneIndex,
      );
      if (result.matched_hostel) {
        found = true;
        break;
      }
    }
    if (!found) {
      unmatched.push(record);
    } else {
      matched++;
    }
  }

  const shared_contact_groups: string[] = [];
  for (const [phone, hostels] of phoneIndex) {
    if (hostels.length > 1) {
      shared_contact_groups.push(
        `${phone}: ${hostels.join(', ')}`,
      );
    }
  }

  return {
    official_record_no_listing: unmatched,
    matched_count: matched,
    shared_contact_groups,
  };
}

function similarityScore(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;

  const leftTokens = new Set(left.split(' '));
  const rightTokens = new Set(right.split(' '));
  const intersection = [...leftTokens].filter((token) =>
    rightTokens.has(token),
  ).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const tokenScore = union === 0 ? 0 : intersection / union;

  const maxLength = Math.max(left.length, right.length);
  const levenshtein = levenshteinDistance(left, right);
  const editScore = maxLength === 0 ? 0 : 1 - levenshtein / maxLength;

  return Math.max(tokenScore, editScore);
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const matrix = Array.from({ length: left.length + 1 }, () =>
    Array(right.length + 1).fill(0),
  );
  for (let i = 0; i <= left.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[left.length][right.length];
}
