import { fetchPublicApi } from './config';

/** What the public may see of an agent (mirrors FastAPI `PublicAgent`). */
export interface PublicAgent {
  id: string;
  slug?: string | null;
  name: string;
  phone: string;
  whatsapp: string;
  bio?: string | null;
  profile_photo_url?: string | null;
  cover_image_url?: string | null;
  service_areas?: string[] | null;
  languages?: string[] | null;
  helping_since?: number | null;
  portfolio_url?: string | null;
  verified?: boolean | null;
  is_featured?: boolean | null;
  is_founder?: boolean | null;
  is_owner?: boolean | null;
  support_rank?: number | null;
  instagram?: string | null;
  linkedin?: string | null;
  instagram_public?: boolean | null;
  linkedin_public?: boolean | null;
  pochi_la_biashara_number?: string | null;
  expected_name?: string | null;
  campus_id?: string | null;
}

export interface VerifyCandidate {
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

export interface SitemapData {
  listings: { slug: string; county?: string | null; area?: string | null; updated_at?: string | null }[];
  agents: { slug: string; updated_at?: string | null }[];
}

type Revalidate = { revalidate?: number | false; tags?: string[] };

const opts = (next?: Revalidate): RequestInit => (next ? { next } : {});

/** Cookie-free reads of public data for Server Components / metadata (ISR-friendly). */
export const publicApi = {
  /** An active agent by slug or id; null when not found. */
  getAgent: (slugOrId: string, next?: Revalidate): Promise<PublicAgent | null> =>
    fetchPublicApi<PublicAgent>(`/public/agents/${encodeURIComponent(slugOrId)}`, opts(next)).catch(
      (e: Error & { status?: number }) => {
        if (e.status === 404) return null;
        throw e;
      },
    ),

  getSupportTeam: (next?: Revalidate) =>
    fetchPublicApi<PublicAgent[]>('/public/support-team', opts(next)),

  /** Listings matching ONE phone / payment detail / name typed into the Hakikisha checker (max 10). */
  lookupVerifyCandidates: (q: string) =>
    fetchPublicApi<VerifyCandidate[]>(`/public/verify-lookup?q=${encodeURIComponent(q)}`, { cache: 'no-store' }),

  getSitemap: (next?: Revalidate) => fetchPublicApi<SitemapData>('/public/sitemap', opts(next)),

  /** Configured tour price for a zone; null when unset/ambiguous. */
  getZoneTourPrice: async (zone: string, campusId?: string | null): Promise<number | null> => {
    const params = new URLSearchParams({ zone });
    if (campusId) params.set('campus_id', campusId);
    try {
      const { price } = await fetchPublicApi<{ price: number | null }>(`/zones/tour-price?${params}`);
      return price ?? null;
    } catch {
      return null;
    }
  },
};
