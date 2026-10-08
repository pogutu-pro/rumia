import { PropertyCard } from '@/components/rumia/property-card';
import type { SearchCard } from '@/lib/api/rumia';

/** A reusable public-place grid (server-renderable; PropertyCard hydrates its own save/analytics). */
export function CardGrid({ cards }: { cards: SearchCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c, i) => (
        <PropertyCard key={c.listing_id ?? c.id} card={c} position={i} surface="place" />
      ))}
    </div>
  );
}