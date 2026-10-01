'use client';

import { useEffect, useState } from 'react';
import { campusesApi } from '@/lib/api/campuses';
import { zonesApi } from '@/lib/api/zones';

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
        const campuses = (await campusesApi.list('active')).sort((x, y) =>
          x.slug.localeCompare(y.slug),
        );
        if (cancelled || campuses.length === 0) return;

        const rows = await zonesApi.list();
        if (cancelled) return;
        const activeIds = new Set(campuses.map((c) => c.id));
        const zoneRows = rows.filter((z) => activeIds.has(z.campus_id));

        setSections(
          campuses
            .map((c) => ({
              campusId: c.id,
              campusSlug: c.slug,
              campusName: c.name,
              zones: zoneRows
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