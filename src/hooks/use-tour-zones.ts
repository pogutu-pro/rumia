'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface TourZoneOption {
  value: string;
  label: string;
  price: number;
  campusId: string;
  campusSlug: string;
  campusName: string;
}

export interface CampusTourSection {
  campusId: string;
  campusSlug: string;
  campusName: string;
  zones: TourZoneOption[];
}

interface CampusRowPick {
  id: string;
  slug: string;
  name: string;
}

interface CampusZoneRow {
  campus_id: string;
  name: string;
  full_search_price: number;
}

/**
 * Loads the tour zones campus managers have configured in `campus_zones`,
 * grouped into a section per campus so students can pick their own university.
 *
 * Only campuses with an ACTIVE status are shown. Amounts always come from
 * `campus_zones.full_search_price` — there is NO hardcoded price fallback, so
 * a student can never be quoted an amount a campus manager didn't set. When no
 * zones are configured the list stays empty and callers show an empty state.
 */
export function useTourZones() {
  const [sections, setSections] = useState<CampusTourSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const supabase = createClient();
        const campusRes = (await supabase
          .from('campuses')
          .select('id, slug, name')
          .eq('status', 'active')
          .order('slug', { ascending: true })) as {
          data: CampusRowPick[] | null;
        };

        const campuses = campusRes.data ?? [];
        if (cancelled || campuses.length === 0) return;

        const zoneRes = (await supabase
          .from('campus_zones')
          .select('campus_id, name, full_search_price')
          .in('campus_id', campuses.map((c) => c.id))
          .order('name', { ascending: true })) as {
          data: CampusZoneRow[] | null;
        };

        if (cancelled) return;
        const rows = zoneRes.data ?? [];

        setSections(
          campuses
            .map((c) => ({
              campusId: c.id,
              campusSlug: c.slug,
              campusName: c.name,
              zones: rows
                .filter((z) => z.campus_id === c.id)
                .map((z) => ({
                  value: z.name,
                  label: z.name,
                  price: z.full_search_price,
                  campusId: c.id,
                  campusSlug: c.slug,
                  campusName: c.name,
                })),
            }))
            .filter((s) => s.zones.length > 0),
        );
      } catch {
        // Leave empty so no unconfigured price leaks to users.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { sections, loading };
}