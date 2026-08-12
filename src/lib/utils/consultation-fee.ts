export type CampusResource =
  | unknown[]
  | Record<string, unknown>
  | null
  | undefined;

/**
 * Read the campus consultation fee from an embedded `campuses` resource.
 *
 * PostgREST may embed the campus as a single object (a to-one FK from the
 * listing) or as an array depending on how it resolves the relationship, so
 * both shapes are handled. Returns null when the column is absent or not a
 * finite number so callers can fall back to their display default without
 * ever failing the surrounding query.
 */
export function readCampusConsultationFee(
  campuses: CampusResource,
): number | null {
  if (!campuses) return null;
  const row = Array.isArray(campuses) ? campuses[0] : campuses;
  if (!row || typeof row !== 'object') return null;
  const fee = (row as Record<string, unknown>).consultation_fee;
  return typeof fee === 'number' && Number.isFinite(fee) ? fee : null;
}