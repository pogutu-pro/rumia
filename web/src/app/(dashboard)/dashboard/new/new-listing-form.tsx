'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DISTANCE_CATEGORY_OPTIONS } from '@/lib/constants/dekut-areas';
import {
  normalizeCampusAreaSelection,
  type CampusAreaOption,
} from '@/lib/utils/campus-zones';
import { processAndUploadImage } from '@/lib/r2/upload';
import { isValidKenyanPhone } from '@/lib/utils/phone';
import { cn } from '@/lib/utils/cn';
import { getAmenityMeta, getUtilityMeta } from '@/lib/utils/amenity-icons';

// Dynamically imported with ssr:false because @googlemaps/js-api-loader
// references `window` at module-evaluation time, which crashes Next.js SSR.
const GoogleLocationInput = dynamic(
  () =>
    import('@/components/ui/google-location-input').then(
      (mod) => mod.GoogleLocationInput,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-11 w-full rounded-md bg-slate-100 animate-pulse" />
    ),
  },
);
import { toast } from 'sonner';
import {
  Loader2,
  Plus,
  Trash2,
  UploadCloud,
  Youtube,
  GripVertical,
  Star,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  BedDouble,
  Building2,
} from 'lucide-react';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface NewListingFormProps {
  agentId: string | number;
  agentWhatsapp?: string | null;
  initialListing?: InitialListingData;
  mode?: 'create' | 'edit';
  campusId?: string | null;
  campusZones?: CampusAreaOption[];
  successRedirectPath?: string;
  customUpdateAction?: (formData: any) => Promise<{
    success: boolean;
    error?: string;
    listingId?: string;
    listingUrl?: string;
  }>;
}

interface UploadedImage {
  id: string;
  url: string;
  name: string;
  category: string;
  blurDataUrl?: string;
  width?: number;
  height?: number;
  format?: string;
  imageUploadId?: string;
}

interface FormRoomType {
  room_type: string;
  price: string;
  is_available: boolean;
  deposit: string;
  furnishing_items: string[];
  category: string;
  occupancy: number;
  floor: string;
  size: string;
}

interface InitialListingData {
  id: string;
  title: string;
  description?: string | null;
  property_type?: 'hostel' | 'apartment' | 'short_stay' | string | null;
  price: number | string;
  location: string;
  youtube_id?: string | null;
  is_youtube_shorts?: boolean;
  room_type?: string | null;
  amenities?: string[] | null;
  bathroom_type?: string | null;
  distance_to_campus?: string | null;
  security_type?: string | null;
  water_included?: boolean | null;
  electricity_included?: boolean | null;
  wifi_included?: boolean | null;
  hot_water_included?: boolean | null;
  cooking_gas_included?: boolean | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  gender?: 'mixed' | 'male' | 'female' | null;
  proximity_description?: string | null;
  is_active?: boolean | null;
  county?: string | null;
  area?: string | null;
  specific_location?: string | null;
  price_single?: number | string | null;
  price_sharing?: number | string | null;
  mpesa_details?: string | null;
  distance_category?: string | null;
  landlord_phone?: string | null;
  listing_images?: Array<{
    id?: string;
    r2_url: string;
    category?: string | null;
    display_order?: number | null;
    blur_data_url?: string | null;
    width?: number | null;
    height?: number | null;
    format?: string | null;
    image_upload_id?: string | null;
  }> | null;
  listing_room_types?: Array<{
    id?: string;
    room_type: string;
    price: number | string;
    is_available?: boolean | null;
    deposit?: number | string | null;
    furnishing_items?: string[] | null;
    category?: string | null;
    occupancy?: string | null;
    floor?: string | null;
    size?: string | null;
  }> | null;
}

function extractYoutubeId(urlOrId: string): string {
  if (!urlOrId) return '';
  const trimmed = urlOrId.trim();
  if (
    trimmed.length === 11 &&
    !trimmed.includes('/') &&
    !trimmed.includes('?')
  ) {
    return trimmed;
  }
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = trimmed.match(regExp);
  if (match && match[2].length === 11) {
    return match[2];
  }
  return trimmed;
}

function toNullableNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function initialImages(listing?: InitialListingData): UploadedImage[] {
  return [...(listing?.listing_images || [])]
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    .map((image, index) => ({
      id: image.id ? String(image.id) : `existing-${index}`,
      url: image.r2_url,
      name: `Existing image ${index + 1}`,
      category: image.category || 'Room',
      blurDataUrl: image.blur_data_url || undefined,
      width: image.width || undefined,
      height: image.height || undefined,
      format: image.format || undefined,
      imageUploadId: image.image_upload_id || undefined,
    }));
}

const CATEGORY_OPTIONS = [
  { value: 'single', label: 'Single Room' },
  { value: 'double', label: 'Double Room' },
  { value: 'bedsitter', label: 'Bedsitter' },
  { value: 'self_contained_bedsitter', label: 'Self-Contained Bedsitter' },
  { value: 'one_bedroom', label: '1 Bedroom' },
  { value: 'two_bedroom', label: '2 Bedroom' },
  { value: 'three_bedroom', label: '3 Bedroom' },
  { value: 'shared', label: 'Shared Room' },
  { value: 'other', label: 'Other' },
] as const;

const OCCUPANCY_OPTIONS = [
  { value: 1, label: '1 person (solo)' },
  { value: 2, label: '2 people sharing' },
  { value: 3, label: '3 people sharing' },
  { value: 4, label: '4 people sharing' },
  { value: 5, label: '5 people sharing' },
  { value: 6, label: '6 people sharing' },
] as const;

const UTILITIES = [
  'Water',
  'Electricity',
  'WiFi',
  'Hot Water',
  'Cooking Gas',
] as const;

const AMENITIES_LIST = [
  'Parking',
  'Study Area',
  'Kitchen',
  'Laundry Area',
  'Balcony',
  'Guard',
  'CCTV',
] as const;

const FURNISHING_ITEMS = [
  'Bed frame',
  'Mattress',
  'Wardrobe/closet',
  'Study desk & chair',
  'Curtains',
  'Cooking stove/burner',
  'WiFi router',
] as const;

function generateRoomTypeLabel(
  category: string,
  occupancy: number,
  floor: string,
  size: string,
): string {
  if (!category) return '';

  const categoryMap: Record<string, string> = {
    single: 'Single Room',
    double: 'Double Room',
    bedsitter: 'Bedsitter',
    self_contained_bedsitter: 'Self-Contained Bedsitter',
    one_bedroom: '1 Bedroom',
    two_bedroom: '2 Bedroom',
    three_bedroom: '3 Bedroom',
    shared: 'Shared Room',
    other: 'Other',
  };

  let label = categoryMap[category] || category;

  const parts: string[] = [];
  if (floor && floor !== 'na') {
    parts.push(floor === 'ground' ? 'Ground floor' : 'Upper floor');
  }
  if (size && size !== 'standard') {
    parts.push(size === 'smaller' ? 'Smaller' : 'Larger');
  }
  if (occupancy === 1 && category !== 'shared' && category !== 'single') {
    parts.push('1 person');
  } else if (occupancy && occupancy > 1) {
    parts.push(`${occupancy} people sharing`);
  }

  if (parts.length > 0) {
    label += ' - ' + parts.join(', ');
  }

  return label;
}

function deriveFurnishingLevel(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length <= 3) return 'Semi-furnished';
  return 'Furnished';
}

function initialRoomTypes(listing?: InitialListingData): FormRoomType[] {
  const existing = listing?.listing_room_types || [];

  if (existing.length > 0) {
    return existing.map((room) => ({
      room_type: room.room_type,
      price: String(room.price || ''),
      is_available: room.is_available ?? true,
      deposit:
        room.deposit && Number(room.deposit) > 0 ? String(room.deposit) : '',
      furnishing_items: room.furnishing_items || [],
      category: room.category || '',
      occupancy: Number(room.occupancy) || 1,
      floor: room.floor || '',
      size: room.size || '',
    }));
  }

  return [
    {
      room_type: 'Single Room',
      price: '',
      is_available: true,
      deposit: '',
      furnishing_items: [],
      category: '',
      occupancy: 1,
      floor: '',
      size: '',
    },
  ];
}

function SortableImageCard({
  img,
  idx,
  totalImages,
  onRemove,
  onSetCover,
  onMoveUp,
  onMoveDown,
  onCategoryChange,
}: {
  img: UploadedImage;
  idx: number;
  totalImages: number;
  onRemove: (idx: number) => void;
  onSetCover: (idx: number) => void;
  onMoveUp: (idx: number) => void;
  onMoveDown: (idx: number) => void;
  onCategoryChange: (idx: number, category: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: img.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative aspect-4/3 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs ${isDragging ? 'opacity-50 ring-2 ring-emerald-500' : ''}`}
    >
      <Image
        src={img.url}
        alt={`Listing upload ${idx + 1}`}
        fill
        sizes="200px"
        className="object-cover"
      />

      {/* Cover badge - top left */}
      <div className="absolute top-2 left-2 bg-slate-900/80 px-1.5 py-0.5 rounded text-[9px] font-bold text-white uppercase tracking-wider z-20">
        {idx === 0 ? 'Cover Photo' : `Image ${idx + 1}`}
      </div>

      {/* Delete button - top right, always visible */}
      <button
        type="button"
        onClick={() => onRemove(idx)}
        className="absolute top-2 right-2 p-1.5 bg-rose-600/90 hover:bg-rose-500 text-white rounded-lg transition-colors z-20"
        title="Delete photo"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {/* Bottom controls - always visible */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1 z-20">
        {/* Category dropdown */}
        <select
          value={img.category}
          onChange={(e) => onCategoryChange(idx, e.target.value)}
          className="flex-1 min-w-0 text-[10px] font-bold h-7 bg-white/90 backdrop-blur-xs border border-slate-200 rounded px-1.5 text-slate-800 shadow-xs focus:outline-none"
        >
          <option value="Room">Room</option>
          <option value="Bathroom">Bathroom</option>
          <option value="Exterior">Exterior</option>
          <option value="Study Area">Study Area</option>
          <option value="Laundry Area">Laundry Area</option>
          <option value="Kitchen">Kitchen</option>
        </select>

        {/* Set as Cover */}
        {idx !== 0 && (
          <button
            type="button"
            onClick={() => onSetCover(idx)}
            className="p-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-lg shrink-0 transition-colors"
            title="Set as cover photo"
          >
            <Star className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Move Up */}
        {idx > 0 && (
          <button
            type="button"
            onClick={() => onMoveUp(idx)}
            className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-white rounded-lg shrink-0 transition-colors"
            title="Move left"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Move Down */}
        {idx < totalImages - 1 && (
          <button
            type="button"
            onClick={() => onMoveDown(idx)}
            className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-white rounded-lg shrink-0 transition-colors"
            title="Move right"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-white rounded-lg shrink-0 cursor-grab active:cursor-grabbing transition-colors"
          title="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
) {
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next++;
        await fn(items[index], index);
      }
    },
  );
  await Promise.all(workers);
}

function friendlyUploadError(error: any): string {
  const message = error?.message || error?.name || '';
  const lower = message.toLowerCase();

  if (lower.includes('too small'))
    return 'Image is too small (minimum 100x100).';
  if (
    lower.includes('exceeds') ||
    lower.includes('too large') ||
    lower.includes('413')
  )
    return 'Image is too large. Try a smaller photo.';
  if (lower.includes('unsupported') || lower.includes('format'))
    return 'Unsupported image format.';
  if (lower.includes('unauthorized') || lower.includes('expired'))
    return 'Your session has expired. Please log in again.';
  if (lower.includes('could not be read') || lower.includes('unable to read'))
    return 'Could not read this image. Try a JPEG or PNG photo.';

  return message || 'Upload failed. Please try again.';
}

export function NewListingForm({
  agentId,
  agentWhatsapp,
  initialListing,
  mode = 'create',
  campusId,
  campusZones = [],
  customUpdateAction,
  successRedirectPath = '/dashboard',
}: NewListingFormProps) {
  const router = useRouter();
  const isEditing = mode === 'edit' && !!initialListing;

  const [title, setTitle] = useState(initialListing?.title || '');
  const [propertyType, setPropertyType] = useState<
    'hostel' | 'apartment' | 'short_stay'
  >(
    ['apartment', 'short_stay', 'hostel'].includes(
      initialListing?.property_type ?? '',
    )
      ? (initialListing?.property_type as 'hostel' | 'apartment' | 'short_stay')
      : 'hostel',
  );
  const [description, setDescription] = useState(
    initialListing?.description || '',
  );
  const [location, setLocation] = useState(initialListing?.location || '');
  const [youtubeId, setYoutubeId] = useState(initialListing?.youtube_id || '');
  const [isYoutubeShort, setIsYoutubeShort] = useState(
    !!initialListing?.is_youtube_shorts,
  );
  const [whatsappNumber, setWhatsappNumber] = useState(agentWhatsapp || '');
  const [landlordPhone, setLandlordPhone] = useState(
    initialListing?.landlord_phone || '',
  );
  const [whatsappError, setWhatsappError] = useState('');
  const [landlordPhoneError, setLandlordPhoneError] = useState('');
  const [images, setImages] = useState<UploadedImage[]>(() =>
    initialImages(initialListing),
  );
  const [area, setArea] = useState(initialListing?.area || '');
  const [availableAreas] = useState<CampusAreaOption[]>(campusZones);
  const [specificLocation, setSpecificLocation] = useState(
    initialListing?.specific_location || '',
  );
  const [mpesaDetails, setMpesaDetails] = useState(
    initialListing?.mpesa_details || '',
  );
  const [distanceCategory, setDistanceCategory] = useState(
    initialListing?.distance_category || '',
  );
  const [bathroomType, setBathroomType] = useState(
    initialListing?.bathroom_type || 'Shared',
  );
  const [distanceToCampus, setDistanceToCampus] = useState(
    initialListing?.distance_to_campus || '',
  );
  const [securityType, setSecurityType] = useState(
    initialListing?.security_type || '',
  );
  const [latitude, setLatitude] = useState<number | null>(() =>
    toNullableNumber(initialListing?.latitude),
  );
  const [longitude, setLongitude] = useState<number | null>(() =>
    toNullableNumber(initialListing?.longitude),
  );
  const [gender, setGender] = useState<'mixed' | 'male' | 'female'>(
    initialListing?.gender || 'mixed',
  );
  const [roomTypes, setRoomTypes] = useState<FormRoomType[]>(() =>
    initialRoomTypes(initialListing),
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDraft, setIsDraft] = useState(false);

  const [includedUtilities, setIncludedUtilities] = useState<string[]>(() => {
    const u: string[] = [];
    if (initialListing?.water_included) u.push('Water');
    if (initialListing?.electricity_included) u.push('Electricity');
    if (initialListing?.wifi_included) u.push('WiFi');
    if (initialListing?.hot_water_included) u.push('Hot Water');
    if (initialListing?.cooking_gas_included) u.push('Cooking Gas');
    return [...new Set(u)];
  });
  const [amenities, setAmenities] = useState<string[]>(() => {
    const raw = initialListing?.amenities || [];
    const UTILITY_NAMES = [
      'Water',
      'Electricity',
      'WiFi',
      'Hot Water',
      'Cooking Gas',
    ];
    return raw.filter((a: string) => !UTILITY_NAMES.includes(a));
  });

  const toggleAmenity = (amenity: string) => {
    setAmenities((prev) =>
      prev.includes(amenity)
        ? prev.filter((a) => a !== amenity)
        : [...prev, amenity],
    );
  };

  const toggleUtility = (util: string) => {
    setIncludedUtilities((prev) =>
      prev.includes(util) ? prev.filter((u) => u !== util) : [...prev, util],
    );
  };

  const handleAreaChange = useCallback(
    (selectedArea: string) => {
      const normalizedArea = normalizeCampusAreaSelection(
        selectedArea,
        availableAreas,
      );
      setArea(normalizedArea || '');

      if (normalizedArea) {
        const matchingZone = availableAreas.find(
          (zone) => zone.name === normalizedArea,
        );
        if (matchingZone?.name) {
          setLatitude(null);
          setLongitude(null);
        }
      }
    },
    [availableAreas],
  );

  const addRoomTypeField = () => {
    setRoomTypes((prev) => [
      ...prev,
      {
        room_type: 'Double Room',
        price: '',
        is_available: true,
        deposit: '',
        furnishing_items: [],
        category: '',
        occupancy: 2,
        floor: '',
        size: '',
      },
    ]);
  };

  const removeRoomTypeField = (index: number) => {
    setRoomTypes((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRoomTypeField = (
    index: number,
    key: keyof FormRoomType,
    value: any,
  ) => {
    setRoomTypes((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [key]: value } : item,
      ),
    );
  };

  const handleLocationChange = useCallback(
    (resolved: {
      address: string;
      latitude: number | null;
      longitude: number | null;
    }) => {
      setLocation(resolved.address);
      setLatitude(resolved.latitude);
      setLongitude(resolved.longitude);
    },
    [],
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);

    const files = Array.from(e.target.files);
    const newImages: UploadedImage[] = [...images];
    let uploadedCount = 0;
    let failedCount = 0;

    // Process up to 3 photos at a time to keep uploads fast on slow
    // mobile connections without overwhelming the server.
    await mapLimit(files, 3, async (file) => {
      try {
        const result = await processAndUploadImage(file, 'listing');

        newImages.push({
          id: crypto.randomUUID(),
          url: result.url,
          name: file.name,
          category: 'Room',
          blurDataUrl: result.blurUrl,
          width: result.width,
          height: result.height,
          format: result.format,
          imageUploadId: result.imageUploadId || undefined,
        });
        uploadedCount++;
      } catch (error: any) {
        failedCount++;
        console.error('File upload error:', file.name, error);
        toast.error(`${file.name}: ${friendlyUploadError(error)}`);
      }
    });

    if (uploadedCount > 0) {
      toast.success(
        `${uploadedCount} image${uploadedCount > 1 ? 's' : ''} uploaded successfully`,
      );
    }
    if (failedCount > 0) {
      toast.error(
        `${failedCount} photo${failedCount > 1 ? 's' : ''} failed. ${
          failedCount > 1
            ? 'Try again or pick smaller photos.'
            : 'Please check the message above and try again.'
        }`,
      );
    }

    setImages(newImages);
    setIsUploading(false);
    e.target.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setImages((prev) => {
        const oldIndex = prev.findIndex((img) => img.id === active.id);
        const newIndex = prev.findIndex((img) => img.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const handleSetCover = (index: number) => {
    setImages((prev) => {
      const updated = [...prev];
      const [target] = updated.splice(index, 1);
      updated.unshift(target);
      return updated;
    });
  };

  const handleCategoryChange = (index: number, category: string) => {
    setImages((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], category };
      return updated;
    });
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setImages((prev) => {
      const updated = [...prev];
      [updated[index - 1], updated[index]] = [
        updated[index],
        updated[index - 1],
      ];
      return updated;
    });
  };

  const handleMoveDown = (index: number) => {
    setImages((prev) => {
      if (index >= prev.length - 1) return prev;
      const updated = [...prev];
      [updated[index], updated[index + 1]] = [
        updated[index + 1],
        updated[index],
      ];
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent, asDraft: boolean = false) => {
    e.preventDefault();
    if (isSaving || isUploading) return;

    if (!title || !area || !whatsappNumber) {
      toast.error(
        'Please fill in all required fields: Title, Area, and WhatsApp number',
      );
      return;
    }

    if (!isValidKenyanPhone(whatsappNumber)) {
      toast.error(
        'Please enter a valid Kenyan WhatsApp number (e.g. 0712 345 678)',
      );
      return;
    }

    if (landlordPhone && !isValidKenyanPhone(landlordPhone)) {
      toast.error(
        'Please enter a valid Kenyan phone number for the Hostel Owner',
      );
      return;
    }

    const validRoomTypes = roomTypes.filter(
      (rt) => (rt.category || rt.room_type) && rt.price,
    );
    if (validRoomTypes.length === 0) {
      toast.error('Please add at least one room type with a price');
      return;
    }

    setIsSaving(true);
    setIsDraft(asDraft);

    try {
      const { createListingAction, updateListingAction } =
        await import('@/app/actions/listings');

      const firstRoom = validRoomTypes[0];

      let derivedPriceSingle: number | null = null;
      let derivedPriceSharing: number | null = null;

      for (const rt of validRoomTypes) {
        const p = Number(rt.price);
        if (!p || p <= 0) continue;

        const isSharing =
          rt.category === 'shared' ||
          Number(rt.occupancy) > 1 ||
          rt.room_type?.toLowerCase().includes('sharing') ||
          rt.room_type?.toLowerCase().includes('shared');

        if (isSharing) {
          if (derivedPriceSharing === null || p < derivedPriceSharing) {
            derivedPriceSharing = p;
          }
        } else {
          if (derivedPriceSingle === null || p < derivedPriceSingle) {
            derivedPriceSingle = p;
          }
        }
      }

      const mainListingPrice =
        derivedPriceSingle ??
        derivedPriceSharing ??
        (Number(firstRoom.price) || 0);

      const payload = {
        listing_id: initialListing?.id,
        title,
        property_type: propertyType,
        description,
        location,
        agent_id: agentId,
        agent_whatsapp: whatsappNumber,
        youtube_id: youtubeId,
        is_youtube_shorts: isYoutubeShort,
        is_active: !asDraft,
        room_type: firstRoom.room_type,
        price: mainListingPrice,
        amenities: amenities,
        bathroom_type: bathroomType,
        distance_to_campus: distanceToCampus,
        security_type: securityType,
        electricity_included: includedUtilities.includes('Electricity'),
        water_included: includedUtilities.includes('Water'),
        wifi_included: includedUtilities.includes('WiFi'),
        hot_water_included: includedUtilities.includes('Hot Water'),
        cooking_gas_included: includedUtilities.includes('Cooking Gas'),
        gender: gender,
        proximity_description: specificLocation || area,
        latitude,
        longitude,
        county: initialListing?.county || 'nyeri',
        area,
        specific_location: specificLocation,
        price_single: derivedPriceSingle,
        price_sharing: derivedPriceSharing,
        mpesa_details: mpesaDetails,
        distance_category: distanceCategory,
        landlord_phone: landlordPhone || null,
        images,
        roomTypes: validRoomTypes,
      };

      const result = isEditing
        ? customUpdateAction
          ? await customUpdateAction(payload)
          : await updateListingAction(payload)
        : await createListingAction(payload);

      if (!result.success) {
        throw new Error(result.error || 'Failed to insert listing');
      }

      const resultListingId =
        'listingId' in result ? result.listingId : undefined;
      if (isEditing) {
        posthog.capture('listing_updated', {
          listing_id: String(resultListingId ?? initialListing?.id ?? ''),
          area,
          is_draft: asDraft,
        });
        toast.success('Listing updated successfully!');
      } else {
        posthog.capture('listing_created', {
          listing_id: String(resultListingId ?? ''),
          area,
          is_draft: asDraft,
        });
        toast.success('Listing created successfully!');
      }
      router.push(successRedirectPath);
      router.refresh();
    } catch (error: any) {
      posthog.captureException(error);
      console.error('Error saving listing:', error);
      toast.error(error.message || 'Failed to save listing. Please try again.');
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* SECTION 1: Basics */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-xs space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Basic Information
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            What kind of property is this?
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="title">Listing Title *</Label>
            <Input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Spacious 1-Bedroom Hostel Near JKUAT"
              className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm"
            />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label>Property Type *</Label>
            <div
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              role="group"
              aria-label="Property type"
            >
              {[
                {
                  value: 'hostel' as const,
                  title: 'Hostel',
                  description: 'Long-stay student rooms billed monthly.',
                  Icon: BedDouble,
                },
                {
                  value: 'apartment' as const,
                  title: 'Apartment',
                  description: 'Self-contained monthly accommodation.',
                  Icon: Building2,
                },
              ].map(({ value, title, description, Icon }) => {
                const selected = propertyType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPropertyType(value)}
                    className={cn(
                      'flex min-h-[88px] items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
                      selected
                        ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                        selected
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-slate-500 ring-1 ring-slate-200',
                      )}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.9} />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-slate-900">
                        {title}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="gender">Who Can Stay? *</Label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value as any)}
              className="flex h-11 w-full items-center justify-between rounded-md border bg-slate-50 border-slate-200/80 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              <option value="mixed">Mixed (All students)</option>
              <option value="female">Female Only</option>
              <option value="male">Male Only</option>
            </select>
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="area">Hostel Area *</Label>
            <select
              id="area"
              required
              value={area}
              onChange={(e) => handleAreaChange(e.target.value)}
              className="flex h-11 w-full items-center justify-between rounded-md border bg-slate-50 border-slate-200/80 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              <option value="">
                {campusZones.length > 0
                  ? 'Select an area...'
                  : 'No areas configured yet'}
              </option>
              {campusZones.map((zone) => (
                <option key={zone.id || zone.name} value={zone.name}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="specificLocation">
              Specific Location{' '}
              <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Input
              id="specificLocation"
              type="text"
              maxLength={60}
              value={specificLocation}
              onChange={(e) => setSpecificLocation(e.target.value.slice(0, 60))}
              placeholder="e.g. opposite the petrol station"
              className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm"
            />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="description">
              Description{' '}
              <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Textarea
              id="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the hostel, nearby landmarks, what makes it special..."
              className="bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm resize-none"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: Photos */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Property Photos</h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Upload images to showcase the hostel. Drag to reorder.
          </p>
        </div>
        <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 rounded-2xl p-8 transition-colors flex flex-col items-center justify-center text-center cursor-pointer relative">
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            disabled={isUploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <UploadCloud className="h-10 w-10 text-slate-400 mb-3" />
          <p className="text-sm font-bold text-slate-700">
            {isUploading ? 'Uploading...' : 'Click or drag photos here'}
          </p>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            PNG, JPG, or WEBP up to 10MB each
          </p>
        </div>
        {isUploading && (
          <div className="flex items-center justify-center gap-2 text-emerald-600 text-xs font-bold py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading to Cloudflare R2...
          </div>
        )}
        {images.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 font-medium mb-3 flex items-center gap-1.5">
              <GripVertical className="h-3 w-3" />
              Drag to reorder. First image = cover photo.
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={images.map((img) => img.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                  {images.map((img, idx) => (
                    <SortableImageCard
                      key={img.id}
                      img={img}
                      idx={idx}
                      totalImages={images.length}
                      onRemove={handleRemoveImage}
                      onSetCover={handleSetCover}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                      onCategoryChange={handleCategoryChange}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>

      {/* SECTION 3: Room Types & Pricing */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Rooms & Pricing
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Add each room type with its price. At least one required.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRoomTypeField}
            className="h-9 px-3 rounded-lg border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Room
          </Button>
        </div>
        <div className="space-y-4">
          {roomTypes.map((rt, idx) => {
            const hasStructuredFields = !!(
              rt.category ||
              rt.occupancy ||
              rt.floor ||
              rt.size
            );
            const label = hasStructuredFields
              ? generateRoomTypeLabel(
                  rt.category,
                  rt.occupancy,
                  rt.floor,
                  rt.size,
                )
              : rt.room_type;
            const furnishingLabel = deriveFurnishingLevel(rt.furnishing_items);
            return (
              <div
                key={idx}
                className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/80 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-700">
                    Room {idx + 1}
                  </span>
                  {roomTypes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRoomTypeField(idx)}
                      className="p-2 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {label && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                      Label:{' '}
                    </span>
                    <span className="text-sm font-semibold text-emerald-900">
                      {label}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-400 font-bold uppercase">
                      Room Type *
                    </Label>
                    <select
                      value={rt.category}
                      onChange={(e) => {
                        const newCat = e.target.value;
                        const targetOcc =
                          newCat === 'shared' && Number(rt.occupancy) <= 1
                            ? 2
                            : rt.occupancy;
                        updateRoomTypeField(idx, 'category', newCat);
                        if (targetOcc !== rt.occupancy) {
                          updateRoomTypeField(idx, 'occupancy', targetOcc);
                        }
                        if (newCat) {
                          const genLabel = generateRoomTypeLabel(
                            newCat,
                            targetOcc,
                            rt.floor,
                            rt.size,
                          );
                          if (genLabel)
                            updateRoomTypeField(idx, 'room_type', genLabel);
                        }
                      }}
                      className="flex h-10 w-full items-center justify-between rounded-md border bg-white border-slate-200 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select...</option>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-400 font-bold uppercase">
                      Occupancy *
                    </Label>
                    <select
                      value={rt.occupancy}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        updateRoomTypeField(idx, 'occupancy', v);
                        if (rt.category) {
                          const genLabel = generateRoomTypeLabel(
                            rt.category,
                            v,
                            rt.floor,
                            rt.size,
                          );
                          if (genLabel)
                            updateRoomTypeField(idx, 'room_type', genLabel);
                        }
                      }}
                      className="flex h-10 w-full items-center justify-between rounded-md border bg-white border-slate-200 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {OCCUPANCY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-400 font-bold uppercase">
                      Floor
                    </Label>
                    <select
                      value={rt.floor}
                      onChange={(e) => {
                        updateRoomTypeField(idx, 'floor', e.target.value);
                        if (rt.category) {
                          const genLabel = generateRoomTypeLabel(
                            rt.category,
                            rt.occupancy,
                            e.target.value,
                            rt.size,
                          );
                          if (genLabel)
                            updateRoomTypeField(idx, 'room_type', genLabel);
                        }
                      }}
                      className="flex h-10 w-full items-center justify-between rounded-md border bg-white border-slate-200 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select...</option>
                      <option value="ground">Ground floor</option>
                      <option value="upper">Upper floor</option>
                      <option value="na">N/A</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-400 font-bold uppercase">
                      Size
                    </Label>
                    <select
                      value={rt.size}
                      onChange={(e) => {
                        updateRoomTypeField(idx, 'size', e.target.value);
                        if (rt.category) {
                          const genLabel = generateRoomTypeLabel(
                            rt.category,
                            rt.occupancy,
                            rt.floor,
                            e.target.value,
                          );
                          if (genLabel)
                            updateRoomTypeField(idx, 'room_type', genLabel);
                        }
                      }}
                      className="flex h-10 w-full items-center justify-between rounded-md border bg-white border-slate-200 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select...</option>
                      <option value="standard">Standard</option>
                      <option value="smaller">Smaller</option>
                      <option value="larger">Larger</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-400 font-bold uppercase">
                      Rent (KES/mo) *
                    </Label>
                    <Input
                      type="number"
                      required
                      value={rt.price}
                      onChange={(e) =>
                        updateRoomTypeField(idx, 'price', e.target.value)
                      }
                      placeholder="e.g. 7500"
                      className="h-10 bg-white border-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-400 font-bold uppercase">
                      Deposit (KES){' '}
                      <span className="text-slate-300 font-normal">
                        optional
                      </span>
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={rt.deposit}
                      onChange={(e) =>
                        updateRoomTypeField(idx, 'deposit', e.target.value)
                      }
                      placeholder="e.g. 3000"
                      className="h-10 bg-white border-slate-200"
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`avail-${idx}`}
                        checked={rt.is_available}
                        onChange={(e) =>
                          updateRoomTypeField(
                            idx,
                            'is_available',
                            e.target.checked,
                          )
                        }
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                      />
                      <Label
                        htmlFor={`avail-${idx}`}
                        className="text-xs font-semibold text-slate-600 cursor-pointer"
                      >
                        Available
                      </Label>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-400 font-bold uppercase">
                    Furnishing{' '}
                    <span className="text-slate-300 font-normal">
                      (optional)
                    </span>
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {FURNISHING_ITEMS.map((item) => (
                      <div key={item} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`furnishing-${idx}-${item}`}
                          checked={rt.furnishing_items.includes(item)}
                          onChange={(e) => {
                            const newItems = e.target.checked
                              ? [...rt.furnishing_items, item]
                              : rt.furnishing_items.filter(
                                  (f: string) => f !== item,
                                );
                            updateRoomTypeField(
                              idx,
                              'furnishing_items',
                              newItems,
                            );
                          }}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                        />
                        <Label
                          htmlFor={`furnishing-${idx}-${item}`}
                          className="text-xs font-medium leading-none cursor-pointer text-slate-600"
                        >
                          {item}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {furnishingLabel && (
                    <p className="text-xs font-bold text-emerald-600 mt-1">
                      {furnishingLabel}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 4: Property Details */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-xs space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Property Details</h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Details that help students find and choose your hostel.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="bathroomType">Bathroom Type *</Label>
            <select
              id="bathroomType"
              value={bathroomType}
              onChange={(e) => setBathroomType(e.target.value)}
              className="flex h-11 w-full items-center justify-between rounded-md border bg-slate-50 border-slate-200/80 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              <option value="Shared">Shared</option>
              <option value="Private">Private (en-suite)</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="distanceCategory">Distance from Campus *</Label>
            <select
              id="distanceCategory"
              value={distanceCategory}
              onChange={(e) => setDistanceCategory(e.target.value)}
              className="flex h-11 w-full items-center justify-between rounded-md border bg-slate-50 border-slate-200/80 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              <option value="">Select...</option>
              {DISTANCE_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="distanceToCampus">
              Distance Description{' '}
              <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Input
              id="distanceToCampus"
              type="text"
              value={distanceToCampus}
              onChange={(e) => setDistanceToCampus(e.target.value)}
              placeholder="e.g. 5 minutes walk from DeKUT gate"
              className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm"
            />
            <p className="text-[11px] text-slate-400 font-medium">
              Shown below the listing title. e.g. “Near Main Gate” or “10
              minutes walk from DeKUT”
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="securityType">Security</Label>
            <select
              id="securityType"
              value={securityType}
              onChange={(e) => setSecurityType(e.target.value)}
              className="flex h-11 w-full items-center justify-between rounded-md border bg-slate-50 border-slate-200/80 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              <option value="">Select...</option>
              <option value="24/7 CCTV & Guards">24/7 CCTV & Guards</option>
              <option value="Guard Only">Guard Only</option>
              <option value="CCTV Only">CCTV Only</option>
              <option value="Key Lock">Key Lock</option>
              <option value="None">No Security</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mpesaDetails">
              M-Pesa Details{' '}
              <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Input
              id="mpesaDetails"
              type="text"
              maxLength={100}
              value={mpesaDetails}
              onChange={(e) => setMpesaDetails(e.target.value.slice(0, 100))}
              placeholder="e.g. Paybill 247247, A/C 435800"
              className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm"
            />
          </div>
        </div>
      </div>

      {/* SECTION 5: Rent Inclusions */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-xs space-y-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Included in Rent</h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Check what is already covered by the rent price.
          </p>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {UTILITIES.map((util) => {
            const meta = getUtilityMeta(util);
            const Icon = meta.icon;
            const selected = includedUtilities.includes(util);
            return (
              <label
                key={util}
                htmlFor={`util-${util}`}
                className="group cursor-pointer"
              >
                <input
                  type="checkbox"
                  id={`util-${util}`}
                  checked={selected}
                  onChange={() => toggleUtility(util)}
                  className="sr-only"
                />
                <div
                  className={`flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 p-4 sm:p-5 transition-all duration-150 ${selected ? 'border-emerald-400 bg-emerald-50 shadow-md shadow-emerald-100/60' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${selected ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`text-xs font-bold leading-tight text-center ${selected ? 'text-emerald-700' : 'text-slate-600'}`}
                  >
                    {util}
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* SECTION 6: Amenities */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-xs space-y-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Amenities</h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Additional facilities available at this hostel.
          </p>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {AMENITIES_LIST.map((amenity) => {
            const meta = getAmenityMeta(amenity);
            const Icon = meta.icon;
            const selected = amenities.includes(amenity);
            return (
              <label
                key={amenity}
                htmlFor={`amenity-${amenity}`}
                className="group cursor-pointer"
              >
                <input
                  type="checkbox"
                  id={`amenity-${amenity}`}
                  checked={selected}
                  onChange={() => toggleAmenity(amenity)}
                  className="sr-only"
                />
                <div
                  className={`flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 p-4 sm:p-5 transition-all duration-150 ${selected ? 'border-emerald-400 bg-emerald-50 shadow-md shadow-emerald-100/60' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${selected ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`text-xs font-bold leading-tight text-center ${selected ? 'text-emerald-700' : 'text-slate-600'}`}
                  >
                    {amenity}
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* SECTION 7: Contact */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-xs space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Contact Information
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            How students reach you and the hostel owner.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="agentWhatsapp">Your WhatsApp *</Label>
            <Input
              id="agentWhatsapp"
              type="tel"
              required
              value={whatsappNumber}
              onChange={(e) => {
                const val = e.target.value;
                setWhatsappNumber(val);
                if (val.trim().length >= 9) {
                  setWhatsappError(
                    isValidKenyanPhone(val)
                      ? ''
                      : 'Please enter a valid Kenyan number (07xx or 01xx)',
                  );
                } else {
                  setWhatsappError('');
                }
              }}
              placeholder="e.g. 0712 345 678"
              className={cn(
                'h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm',
                whatsappError && 'border-rose-400 focus-visible:ring-rose-400',
              )}
            />
            {whatsappError && (
              <p className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {whatsappError}
              </p>
            )}
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="landlordPhone">
              Hostel Owner Phone{' '}
              <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Input
              id="landlordPhone"
              type="tel"
              value={landlordPhone}
              onChange={(e) => {
                const val = e.target.value;
                setLandlordPhone(val);
                if (val.trim().length >= 9) {
                  setLandlordPhoneError(
                    isValidKenyanPhone(val)
                      ? ''
                      : 'Please enter a valid Kenyan number',
                  );
                } else {
                  setLandlordPhoneError('');
                }
              }}
              placeholder="e.g. 0712 345 678"
              className={cn(
                'h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm',
                landlordPhoneError &&
                  'border-rose-400 focus-visible:ring-rose-400',
              )}
            />
            {landlordPhoneError && (
              <p className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {landlordPhoneError}
              </p>
            )}
            <p className="text-[11px] text-slate-400 font-medium">
              When a student chooses “Hostel Owner”, they contact this number
              directly. Falls back to your number if empty.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 8: YouTube */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Video Tour{' '}
            <span className="text-slate-400 font-normal text-base">
              (optional)
            </span>
          </h2>
        </div>
        <div className="space-y-2">
          <Label htmlFor="youtubeId" className="flex items-center gap-1">
            <Youtube className="h-4 w-4 text-red-600" />
            YouTube Link
          </Label>
          <Input
            id="youtubeId"
            type="text"
            value={youtubeId}
            onChange={(e) => {
              const raw = e.target.value;
              const id = extractYoutubeId(raw);
              setYoutubeId(id);
              setIsYoutubeShort(id.length >= 10 && /\/shorts\//i.test(raw));
            }}
            placeholder="Paste YouTube video link or 11-character ID"
            className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm"
          />
          {youtubeId && youtubeId.length >= 10 && (
            <div
              className={`mt-3 ${isYoutubeShort ? 'aspect-[9/16] max-w-[200px]' : 'aspect-video max-w-sm'} rounded-xl overflow-hidden border border-slate-200 shadow-xs`}
            >
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${youtubeId}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={isSaving || isUploading}
          onClick={(e) => handleSubmit(e, true)}
          className="rounded-xl font-bold h-11 border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          {isSaving && isDraft ? (
            <Loader2 className="h-4.5 w-4.5 animate-spin mr-1.5" />
          ) : null}
          Save Draft
        </Button>
        <Button
          type="submit"
          onClick={(e) => handleSubmit(e, false)}
          disabled={isSaving || isUploading}
          className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11 px-8 border-0 shadow-md shadow-emerald-600/10"
        >
          {isSaving && !isDraft ? (
            <>
              <Loader2 className="h-4.5 w-4.5 animate-spin mr-1.5" />
              Publishing...
            </>
          ) : isEditing ? (
            'Update Listing'
          ) : (
            'Publish Listing'
          )}
        </Button>
      </div>
    </form>
  );
}
