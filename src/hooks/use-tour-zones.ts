'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AREA_OPTIONS } from '@/lib/constants/dekut-areas';

export interface TourZoneOption {
  value: string;
  label: string;
  price: number;
}

interface CampusZoneRow {
  name: string;
  full_search_price: number;
}

/**
 * Fallback to the static DeKUT area list so the zone picker still renders
 * even if the database query fails or returns no rows (e.g. at build time).
 */
const FALLBACK_ZONES: TourZoneOption[] = AREA_OPTIONS.map((z) => ({
  value: z.value,
  label: z.label,
  price: z.price,
}));

/**
 * Loads the tour zones a campus manager has configured in `campus_zones`.
 * This is the single source of truth for which areas appear in the
 * "Book a Tour" zone picker (instead of the previously hardcoded list).
 */
export function useTourZones() {
  const [zones, setZones] = useState<TourZoneOption[]>(FALLBACK_ZONES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const supabase = createClient();
        const res = (await supabase
          .from('campus_zones')
          .select('name, full_search_price')
          .order('name', { ascending: true })) as {
          data: CampusZoneRow[] | null;
        };

        if (!cancelled && res.data && res.data.length > 0) {
          setZones(
            res.data.map((z) => ({
              value: z.name,
              label: z.name,
              price: z.full_search_price,
            })),
          );
        }
      } catch {
        // Keep the static fallback list.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { zones, loading };
}
