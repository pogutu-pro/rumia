'use client';

import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useCompareStore, type CompareSelection } from '@/stores/compare-store';

/**
 * Add or remove a place from the comparison (the tray at the bottom and /compare), with the same messages wherever a
 * card offers Compare. Partial selections are fine: /compare fetches the full details of anything incomplete.
 */
export function useCompareToggle() {
  const hydrate = useCompareStore((s) => s.hydrateFromStorage);
  const selectedIds = useCompareStore((s) => s.selectedIds);
  const addSelection = useCompareStore((s) => s.addSelection);
  const removeSelection = useCompareStore((s) => s.removeSelection);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const isComparing = useCallback((id: string) => selectedIds.includes(id), [selectedIds]);

  const toggle = useCallback(
    (selection: CompareSelection) => {
      if (selectedIds.includes(selection.id)) {
        removeSelection(selection.id);
        toast.info(`${selection.title} removed from comparison`);
        return;
      }
      const result = addSelection(selection);
      if (result.ok) {
        toast.success(`${selection.title} added to comparison`, {
          description: selectedIds.length === 0 ? 'Select one more place to start comparing.' : undefined,
        });
      } else if (result.reason === 'max_reached') {
        toast.error('Maximum places reached', { description: 'Remove one first before adding another.' });
      }
    },
    [selectedIds, addSelection, removeSelection],
  );

  return { isComparing, toggle };
}
