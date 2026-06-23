'use client';

import { Separator } from '@/components/ui/separator';
import { GenderFilter } from './gender-filter';
import { AmenitiesFilter } from './amenities-filter';
import { RoomTypeFilter } from './room-type-filter';
import { PriceRangeFilter } from './price-range-filter';
import { LocationFilter } from './location-filter';
import type { FilterState } from '@/stores/filter-store';

interface FilterSidebarProps {
  filters: FilterState;
  onSetGenders: (v: string[]) => void;
  onSetAmenities: (v: string[]) => void;
  onSetRoomTypes: (v: string[]) => void;
  onSetPriceRange: (min: number | null, max: number | null) => void;
  onSetZones: (v: string[]) => void;
}

export function FilterSidebar({
  filters,
  onSetGenders,
  onSetAmenities,
  onSetRoomTypes,
  onSetPriceRange,
  onSetZones,
}: FilterSidebarProps) {
  return (
    <div className="space-y-6">
      <GenderFilter selected={filters.genders} onChange={onSetGenders} />
      <Separator />
      <AmenitiesFilter selected={filters.amenities} onChange={onSetAmenities} />
      <Separator />
      <RoomTypeFilter selected={filters.roomTypes} onChange={onSetRoomTypes} />
      <Separator />
      <PriceRangeFilter
        minPrice={filters.minPrice}
        maxPrice={filters.maxPrice}
        onChange={onSetPriceRange}
      />
      <Separator />
      <LocationFilter selected={filters.zones} onChange={onSetZones} />
    </div>
  );
}
