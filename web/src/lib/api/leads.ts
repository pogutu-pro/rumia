import { getApiUrl } from './config';

export type LeadContactType = 'rumia_agent' | 'hostel_owner';

export interface LeadTrackInput {
  listing_id: string;
  contact_type: LeadContactType;
  name?: string | null;
  phone?: string | null;
  fee_accepted?: boolean;
}

export interface LeadTrackResult {
  recorded: boolean;
  contact_type: LeadContactType;
  agent: {
    name?: string | null;
    whatsapp?: string | null;
    phone?: string | null;
    pochi_la_biashara_number?: string | null;
    expected_name?: string | null;
  };
  listing: {
    title: string;
    price: number;
    room_type?: string | null;
    area?: string | null;
    slug?: string | null;
    county?: string | null;
    has_video: boolean;
    is_full: boolean;
    pays_commission: boolean;
    landlord_phone?: string | null;
  };
  consultation_fee?: number | null;
}

/** Error from the lead endpoint with its machine-readable code (e.g. FEE_REQUIRED). */
export class LeadTrackError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'LeadTrackError';
  }
}

export const leadsApi = {
  /**
   * Server-only. Records a contact click via FastAPI (public endpoint). The visitor's IP is
   * forwarded so the backend can dedupe and rate-limit per visitor, not per Next.js server.
   */
  trackServer: async (input: LeadTrackInput, clientIp: string): Promise<LeadTrackResult> => {
    const response = await fetch(getApiUrl('/leads/track'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': clientIp },
      body: JSON.stringify(input),
      cache: 'no-store',
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const detail = body?.detail ?? body?.error ?? {};
      throw new LeadTrackError(
        response.status,
        detail.code ?? 'ERROR',
        detail.message ?? 'Lead tracking failed',
      );
    }
    return response.json();
  },
};
