import {
  Droplets,
  Zap,
  Wifi,
  Flame,
  Fuel,
  Car,
  BookOpen,
  UtensilsCrossed,
  WashingMachine,
  Flower2,
  ShieldCheck,
  Cctv,
  Sofa,
  Home,
  type LucideIcon,
} from 'lucide-react-native';

export interface AmenityMeta {
  icon: LucideIcon;
  label: string;
  category: string;
}

export type AmenityCategory = {
  id: string;
  label: string;
  items: AmenityMeta[];
};

// Mirrors web/src/lib/utils/amenity-icons.tsx 1:1.
const AMENITY_MAP: Record<string, AmenityMeta> = {
  Water: { icon: Droplets, label: 'Water', category: 'Utilities' },
  Electricity: { icon: Zap, label: 'Electricity', category: 'Utilities' },
  WiFi: { icon: Wifi, label: 'WiFi', category: 'Utilities' },
  'Hot Water': { icon: Flame, label: 'Hot Water', category: 'Utilities' },
  'Cooking Gas': { icon: Fuel, label: 'Cooking Gas', category: 'Utilities' },
  Parking: { icon: Car, label: 'Parking', category: 'Building' },
  'Study Area': { icon: BookOpen, label: 'Study Area', category: 'Building' },
  Kitchen: { icon: UtensilsCrossed, label: 'Kitchen', category: 'Building' },
  Laundry: { icon: WashingMachine, label: 'Laundry', category: 'Building' },
  'Laundry Area': { icon: WashingMachine, label: 'Laundry Area', category: 'Building' },
  Balcony: { icon: Flower2, label: 'Balcony', category: 'Building' },
  Security: { icon: ShieldCheck, label: 'Security', category: 'Safety' },
  Guard: { icon: ShieldCheck, label: 'Guard', category: 'Safety' },
  CCTV: { icon: Cctv, label: 'CCTV', category: 'Safety' },
  Furnished: { icon: Sofa, label: 'Furnished', category: 'Room' },
};

const UTILITY_MAP: Record<string, AmenityMeta> = {
  Water: AMENITY_MAP['Water'],
  Electricity: AMENITY_MAP['Electricity'],
  WiFi: AMENITY_MAP['WiFi'],
  'Hot Water': AMENITY_MAP['Hot Water'],
  'Cooking Gas': AMENITY_MAP['Cooking Gas'],
  Security: AMENITY_MAP['Security'],
};

export function getAmenityMeta(name: string): AmenityMeta {
  return AMENITY_MAP[name] ?? { icon: Home, label: name, category: 'Other' };
}

export function getUtilityMeta(name: string): AmenityMeta {
  return UTILITY_MAP[name] ?? { icon: Home, label: name, category: 'Utilities' };
}

export function getAmenityCategories(amenities: string[]): AmenityCategory[] {
  const groups: Record<string, AmenityMeta[]> = {};
  for (const a of amenities) {
    const meta = getAmenityMeta(a);
    if (!groups[meta.category]) groups[meta.category] = [];
    groups[meta.category].push(meta);
  }
  const order = ['Safety', 'Building', 'Utilities', 'Room', 'Other'];
  return Object.entries(groups)
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .map(([id, items]) => ({ id, label: id, items }));
}

export function getUtilityCategories(utilities: string[]): AmenityCategory[] {
  return [
    {
      id: 'Utilities',
      label: 'Included in Rent',
      items: utilities.map(getUtilityMeta),
    },
  ];
}

export { AMENITY_MAP, UTILITY_MAP };