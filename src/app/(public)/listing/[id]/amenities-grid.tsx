import { Check } from 'lucide-react';

interface AmenitiesGridProps {
  amenities?: string[];
}

export function AmenitiesGrid({ amenities = [] }: AmenitiesGridProps) {
  // Fallback default list if database doesn't have any yet
  const displayAmenities = amenities && amenities.length > 0 
    ? amenities 
    : ['Water', 'Electricity', 'WiFi', 'Security', 'Laundry', 'Parking', 'Study Area', 'Kitchen'];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Amenities</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {displayAmenities.map((amenity, index) => (
          <div key={index} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl hover:border-emerald-100 transition-colors shadow-2xs">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Check className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold text-slate-700">{amenity}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
