import { BedDouble, Bath, Wifi, Zap, MapPin, ShieldCheck, Flame, Fuel } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface QuickFactsProps {
  roomType?: string | null;
  bathroom?: string | null;
  internet?: boolean | null;
  electricity?: boolean | null;
  hotWater?: boolean;
  cookingGas?: boolean;
  distance?: string | null;
  security?: string | null;
}

interface Fact {
  icon: LucideIcon;
  label: string;
  value: string;
}

export function QuickFacts({
  roomType,
  bathroom,
  internet,
  electricity,
  hotWater = false,
  cookingGas = false,
  distance,
  security,
}: QuickFactsProps) {
  const facts: Fact[] = [];

  if (roomType) facts.push({ icon: BedDouble, label: 'Room Type', value: roomType });
  if (bathroom) facts.push({ icon: Bath, label: 'Bathroom', value: bathroom });
  if (internet != null) facts.push({ icon: Wifi, label: 'Internet', value: internet ? 'Available' : 'Not Included' });
  if (electricity != null) facts.push({ icon: Zap, label: 'Electricity', value: electricity ? 'Included' : 'Tokens' });
  if (hotWater) facts.push({ icon: Flame, label: 'Hot Water', value: 'Available' });
  if (cookingGas) facts.push({ icon: Fuel, label: 'Cooking Gas', value: 'Included' });
  if (distance) facts.push({ icon: MapPin, label: 'Distance', value: distance });
  if (security) facts.push({ icon: ShieldCheck, label: 'Security', value: security });

  if (facts.length === 0) return null;

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-6">
      {facts.map((fact) => {
        const Icon = fact.icon;
        return (
          <div key={fact.label} className="flex flex-col items-start gap-2">
            <Icon className="h-6 w-6 text-slate-800" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-medium text-slate-900">{fact.value}</p>
              <p className="text-xs text-slate-500">{fact.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
