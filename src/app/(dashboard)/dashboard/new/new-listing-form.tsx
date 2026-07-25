'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DEKUT_AREAS,
  AREA_OPTIONS,
  DISTANCE_CATEGORY_OPTIONS,
} from '@/lib/constants/dekut-areas';
import { processAndUploadImage } from '@/lib/r2/upload';

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
import { Loader2, Plus, Trash2, UploadCloud, Youtube, GripVertical, Star, ChevronUp, ChevronDown } from 'lucide-react';

import { Zap, Droplets, Wifi } from 'lucide-react';
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
  occupancy: string;
  floor: string;
  size: string;
}

interface InitialListingData {
  id: string;
  title: string;
  description?: string | null;
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
  { value: 'bedsitter', label: 'Bedsitter' },
  { value: 'single_room', label: 'Single Room' },
  { value: 'double_room', label: 'Double Room' },
  { value: 'studio', label: 'Studio' },
] as const;

const OCCUPANCY_OPTIONS = [
  { value: 'alone', label: '1 person' },
  { value: 'sharing_2', label: 'Sharing (2 people)' },
  { value: 'sharing_3', label: 'Sharing (3 people)' },
] as const;

const FLOOR_OPTIONS = [
  { value: 'ground', label: 'Ground floor' },
  { value: 'upper', label: 'Upper floor' },
  { value: 'na', label: 'N/A' },
] as const;

const SIZE_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'smaller', label: 'Smaller' },
  { value: 'larger', label: 'Larger' },
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
  occupancy: string,
  floor: string,
  size: string,
): string {
  if (!category) return '';

  const categoryMap: Record<string, string> = {
    bedsitter: 'Bedsitter',
    single_room: 'Single Room',
    double_room: 'Double Room',
    studio: 'Studio',
  };

  const occupancyMap: Record<string, string> = {
    alone: '1 person',
    sharing_2: 'Sharing',
    sharing_3: 'Sharing',
  };

  let label = categoryMap[category] || category;

  const parts: string[] = [];
  if (floor && floor !== 'na') {
    parts.push(floor === 'ground' ? 'Ground floor' : 'Upper floor');
  }
  if (size && size !== 'standard') {
    parts.push(size === 'smaller' ? 'Smaller' : 'Larger');
  }
  if (occupancy) {
    parts.push(occupancyMap[occupancy] || occupancy);
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
      deposit: room.deposit && Number(room.deposit) > 0 ? String(room.deposit) : '',
      furnishing_items: room.furnishing_items || [],
      category: room.category || '',
      occupancy: room.occupancy || '',
      floor: room.floor || '',
      size: room.size || '',
    }));
  }

  return [{ room_type: 'Single Room', price: '7500', is_available: true, deposit: '', furnishing_items: [], category: '', occupancy: '', floor: '', size: '' }];
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
      <img
        src={img.url}
        alt={`Listing upload ${idx + 1}`}
        className="absolute inset-0 object-cover w-full h-full"
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

export function NewListingForm({
  agentId,
  agentWhatsapp,
  initialListing,
  mode = 'create',
}: NewListingFormProps) {
  const router = useRouter();
  const isEditing = mode === 'edit' && !!initialListing;

  const [title, setTitle] = useState(initialListing?.title || '');
  const [description, setDescription] = useState(
    initialListing?.description || '',
  );
  const [price, setPrice] = useState(String(initialListing?.price || ''));
  const [location, setLocation] = useState(initialListing?.location || '');
  const [youtubeId, setYoutubeId] = useState(initialListing?.youtube_id || '');
  const [isYoutubeShort, setIsYoutubeShort] = useState(!!initialListing?.is_youtube_shorts);
  const [roomType, setRoomType] = useState(
    initialListing?.room_type || 'Single',
  );
  const [amenities, setAmenities] = useState<string[]>(
    initialListing?.amenities || [],
  );
  const [whatsappNumber, setWhatsappNumber] = useState(agentWhatsapp || '');
  const [landlordPhone, setLandlordPhone] = useState(initialListing?.landlord_phone || '');
  const [images, setImages] = useState<UploadedImage[]>(() =>
    initialImages(initialListing),
  );

  // Location and area fields
  const [area, setArea] = useState(initialListing?.area || '');
  const [specificLocation, setSpecificLocation] = useState(
    initialListing?.specific_location || '',
  );

  // Pricing fields
  const [priceSingle, setPriceSingle] = useState(
    initialListing?.price_single &&
      Number(initialListing.price_single) > 0
      ? String(initialListing.price_single)
      : '',
  );
  const [priceSharing, setPriceSharing] = useState(
    initialListing?.price_sharing &&
      Number(initialListing.price_sharing) > 0
      ? String(initialListing.price_sharing)
      : '',
  );

  // Payment details
  const [mpesaDetails, setMpesaDetails] = useState(
    initialListing?.mpesa_details || '',
  );

  // Distance category for badge
  const [distanceCategory, setDistanceCategory] = useState(
    initialListing?.distance_category || '',
  );

  // New production-ready fields
  const [bathroomType, setBathroomType] = useState(
    initialListing?.bathroom_type || 'Shared',
  );
  const [distanceToCampus, setDistanceToCampus] = useState(
    initialListing?.distance_to_campus || '3 mins walk',
  );
  const [securityType, setSecurityType] = useState(
    initialListing?.security_type || '24/7 CCTV & Guards',
  );
  const [waterIncluded, setWaterIncluded] = useState(
    initialListing?.water_included ?? true,
  );
  const [electricityIncluded, setElectricityIncluded] = useState(
    initialListing?.electricity_included ?? true,
  );
  const [wifiIncluded, setWifiIncluded] = useState(
    initialListing?.wifi_included ?? true,
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
  const [proximityDescription, setProximityDescription] = useState(
    initialListing?.proximity_description || '',
  );

  // Dynamic list of room types
  const [roomTypes, setRoomTypes] = useState<FormRoomType[]>(() =>
    initialRoomTypes(initialListing),
  );

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDraft, setIsDraft] = useState(false);

  const toggleAmenity = (amenity: string) => {
    setAmenities((prev) =>
      prev.includes(amenity)
        ? prev.filter((a) => a !== amenity)
        : [...prev, amenity],
    );
  };

  const handleAreaChange = useCallback((selectedArea: string) => {
    setArea(selectedArea);
    // Automatically set coordinates based on selected area
    const areaCoordinates = DEKUT_AREAS[selectedArea];
    if (areaCoordinates) {
      setLatitude(areaCoordinates.latitude);
      setLongitude(areaCoordinates.longitude);
    }
  }, []);

  const addRoomTypeField = () => {
    setRoomTypes((prev) => [
      ...prev,
      { room_type: 'Double Room', price: '', is_available: true, deposit: '', furnishing_items: [], category: '', occupancy: '', floor: '', size: '' },
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

    for (const file of files) {
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
      } catch (error) {
        console.error('File upload error:', error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (uploadedCount > 0) {
      toast.success(`${uploadedCount} image${uploadedCount > 1 ? 's' : ''} uploaded successfully`);
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
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      return updated;
    });
  };

  const handleMoveDown = (index: number) => {
    setImages((prev) => {
      if (index >= prev.length - 1) return prev;
      const updated = [...prev];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
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

    // Single Occupancy price is required
    if (!priceSingle) {
      toast.error('Please enter the Single Occupancy price');
      return;
    }

    setIsSaving(true);
    setIsDraft(asDraft);

    try {
      const { createListingAction, updateListingAction } =
        await import('@/app/actions/listings');

      const payload = {
        listing_id: initialListing?.id,
        title,
        description,
        location,
        agent_id: agentId,
        agent_whatsapp: whatsappNumber,
        youtube_id: youtubeId,
        is_youtube_shorts: isYoutubeShort,
        is_active: !asDraft,
        room_type: roomType,
        amenities: amenities,
        bathroom_type: bathroomType,
        distance_to_campus: distanceToCampus,
        security_type: securityType,
        electricity_included: electricityIncluded,
        water_included: waterIncluded,
        wifi_included: wifiIncluded,
        gender: gender,
        proximity_description: proximityDescription,
        latitude,
        longitude,
        county: initialListing?.county || 'nyeri',
        area: area,
        specific_location: specificLocation,
        price_single: priceSingle || null,
        price_sharing: priceSharing || null,
        mpesa_details: mpesaDetails,
        distance_category: distanceCategory,
        landlord_phone: landlordPhone || null,
        images: images,
        roomTypes: roomTypes,
      };

      const result = isEditing
        ? await updateListingAction(payload)
        : await createListingAction(payload);

      if (!result.success) {
        throw new Error(result.error || 'Failed to insert listing');
      }

      toast.success(
        isEditing
          ? 'Listing updated successfully!'
          : 'Listing created successfully!',
      );
      router.push('/dashboard');
      router.refresh();
    } catch (error: any) {
      console.error('Error saving listing:', error);
      toast.error(error.message || 'Failed to save listing. Please try again.');
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-xs space-y-6">
        <h2 className="text-xl font-bold text-slate-900">
          Listing Information
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Title */}
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

          {/* Gender - moved to top, directly below title */}
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="gender">Accommodation Gender *</Label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value as any)}
              className="flex h-11 w-full items-center justify-between rounded-md border bg-slate-50 border-slate-200/80 px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 font-medium"
            >
              <option value="mixed">Mixed (All students)</option>
              <option value="female">Female Only (Ladies)</option>
              <option value="male">Male Only (Gents)</option>
            </select>
            <p className="text-[11px] text-slate-400 font-medium">
              Students filter by this first. Make it clear and prominent.
            </p>
          </div>

          {/* Area - replaces old location field */}
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="area">Hostel Area *</Label>
            <select
              id="area"
              required
              value={area}
              onChange={(e) => handleAreaChange(e.target.value)}
              className="flex h-11 w-full items-center justify-between rounded-md border bg-slate-50 border-slate-200/80 px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 font-medium"
            >
              <option value="">Select an area...</option>
              {AREA_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 font-medium">
              Choose the area your hostel is located in. This matches official
              DeKUT groupings.
            </p>
          </div>

          {/* Specific Location - optional text description */}
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="specificLocation">
              Specific Location (Optional)
            </Label>
            <Input
              id="specificLocation"
              type="text"
              maxLength={60}
              value={specificLocation}
              onChange={(e) => setSpecificLocation(e.target.value.slice(0, 60))}
              placeholder="e.g. opposite the petrol station, next to Arch Bishop Kirima"
              className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm"
            />
            <p className="text-[11px] text-slate-400 font-medium">
              A short human description to help students find your exact
              location (max 60 characters).
            </p>
          </div>

          {/* Room Type */}
          <div className="space-y-2">
            <Label htmlFor="roomType">Room Type *</Label>
            <select
              id="roomType"
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              className="flex h-11 w-full items-center justify-between rounded-md border bg-slate-50 border-slate-200/80 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-medium"
            >
              <option value="Single">1 person</option>
              <option value="Double">Sharing (2 people)</option>
              <option value="Self-Contained">Self-Contained</option>
            </select>
          </div>

          {/* Dual Pricing Fields */}
          <div className="sm:col-span-2 space-y-4 bg-emerald-50/30 p-4 rounded-xl border border-emerald-200/50">
            <Label className="font-bold text-slate-800">
              Pricing — Single Occupancy required
            </Label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Single Occupancy Price */}
              <div className="space-y-2">
                <Label htmlFor="priceSingle">
                  Single Occupancy — KES per month
                </Label>
                <Input
                  id="priceSingle"
                  type="number"
                  min={0}
                  value={priceSingle}
                  onChange={(e) => setPriceSingle(e.target.value)}
                  placeholder="e.g. 7500"
                  className="h-11 bg-white border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm"
                />
                <p className="text-[11px] text-slate-500 font-medium">
                  Price for a student taking a room alone.
                </p>
              </div>

              {/* Shared Occupancy Price */}
              <div className="space-y-2">
                <Label htmlFor="priceSharing">
                  Shared Occupancy — KES per person per month <span className="text-slate-400 font-normal">(Optional)</span>
                </Label>
                <Input
                  id="priceSharing"
                  type="number"
                  min={0}
                  value={priceSharing}
                  onChange={(e) => setPriceSharing(e.target.value)}
                  placeholder="e.g. 4500"
                  className="h-11 bg-white border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm"
                />
                <p className="text-[11px] text-slate-500 font-medium">
                  Price per person when a room is shared between two students.
                </p>
              </div>
            </div>
          </div>

          {/* M-Pesa Payment Details */}
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="mpesaDetails">
              M-Pesa Payment Details (Optional)
            </Label>
            <Input
              id="mpesaDetails"
              type="text"
              maxLength={100}
              value={mpesaDetails}
              onChange={(e) => setMpesaDetails(e.target.value.slice(0, 100))}
              placeholder="e.g. Paybill 247247, A/C 435800 or Till Number 9383225"
              className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm"
            />
            <p className="text-[11px] text-slate-400 font-medium">
              Enter the M-Pesa Paybill number, Account number, or Till Number
              that students use to pay rent. Display exactly as you type it.
            </p>
          </div>

          {/* Distance Category */}
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="distanceCategory">Distance from Campus</Label>
            <select
              id="distanceCategory"
              value={distanceCategory}
              onChange={(e) => setDistanceCategory(e.target.value)}
              className="flex h-11 w-full items-center justify-between rounded-md border bg-slate-50 border-slate-200/80 px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 font-medium"
            >
              <option value="">Select distance category...</option>
              {DISTANCE_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 font-medium">
              This drives a visible distance badge on listing cards and the
              listing page.
            </p>
          </div>

          {/* Agent WhatsApp */}
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="agentWhatsapp">Agent WhatsApp *</Label>
            <Input
              id="agentWhatsapp"
              type="tel"
              required
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="e.g. +254700000000"
              className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm"
            />
            <p className="text-[11px] text-slate-400 font-medium">
              This updates your agent profile and is the number students will
              contact on WhatsApp.
            </p>
          </div>

          {/* Landlord/Owner Phone */}
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="landlordPhone">Hostel Owner Phone</Label>
            <Input
              id="landlordPhone"
              type="tel"
              value={landlordPhone}
              onChange={(e) => setLandlordPhone(e.target.value)}
              placeholder="e.g. 0712 345 678"
              className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm"
            />
            <p className="text-[11px] text-slate-400 font-medium">
              The landlord or caretaker's direct phone number. When a student
              chooses "Hostel Owner" in the contact flow, they'll be connected
              directly to this number via WhatsApp. If left empty, the Hostel
              Owner option will use your agent number as fallback.
            </p>
          </div>

          {/* Amenities */}
          <div className="sm:col-span-2 space-y-3">
            <Label>Amenities</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                'WiFi',
                'Water',
                'Electricity',
                'Security',
                'Parking',
                'Study Area',
                'Laundry Area',
                'Kitchen',
              ].map((amenity) => (
                <div key={amenity} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`amenity-${amenity}`}
                    checked={amenities.includes(amenity)}
                    onChange={() => toggleAmenity(amenity)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                  />
                  <Label
                    htmlFor={`amenity-${amenity}`}
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {amenity}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Bathroom Type */}
          <div className="space-y-2">
            <Label htmlFor="bathroomType">Bathroom Type *</Label>
            <select
              id="bathroomType"
              value={bathroomType}
              onChange={(e) => setBathroomType(e.target.value)}
              className="flex h-11 w-full items-center justify-between rounded-md border bg-slate-50 border-slate-200/80 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-medium"
            >
              <option value="Shared">Shared</option>
              <option value="Private">Private</option>
            </select>
          </div>

          {/* Distance to Campus */}
          <div className="space-y-2">
            <Label htmlFor="distanceToCampus">Distance to Campus *</Label>
            <Input
              id="distanceToCampus"
              type="text"
              required
              value={distanceToCampus}
              onChange={(e) => setDistanceToCampus(e.target.value)}
              placeholder="e.g. 3 mins walk"
              className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm"
            />
          </div>

          {/* Security Type */}
          <div className="space-y-2">
            <Label htmlFor="securityType">Security Type *</Label>
            <Input
              id="securityType"
              type="text"
              required
              value={securityType}
              onChange={(e) => setSecurityType(e.target.value)}
              placeholder="e.g. 24/7 CCTV & Guards"
              className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm"
            />
          </div>

          {/* Utility Inclusions */}
          <div className="sm:col-span-2 space-y-3">
            <Label>Rent Inclusions</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="waterIncluded"
                  checked={waterIncluded}
                  onChange={(e) => setWaterIncluded(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                />
                <Label
                  htmlFor="waterIncluded"
                  className="text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Droplets className="h-4 w-4 text-blue-500" />
                  Water Included
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="electricityIncluded"
                  checked={electricityIncluded}
                  onChange={(e) => setElectricityIncluded(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                />
                <Label
                  htmlFor="electricityIncluded"
                  className="text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Zap className="h-4 w-4 text-amber-500" />
                  Electricity Included
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="wifiIncluded"
                  checked={wifiIncluded}
                  onChange={(e) => setWifiIncluded(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                />
                <Label
                  htmlFor="wifiIncluded"
                  className="text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Wifi className="h-4 w-4 text-emerald-500" />
                  WiFi Included
                </Label>
              </div>
            </div>
          </div>

          {/* Dynamic Room Types list */}
          <div className="sm:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-bold text-slate-800">
                Room Categories & Pricing
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRoomTypeField}
                className="h-9 px-3 rounded-lg border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Room Category
              </Button>
            </div>

            <div className="space-y-3">
              {roomTypes.map((rt, idx) => {
                const hasStructuredFields = !!(rt.category || rt.occupancy || rt.floor || rt.size);
                const label = hasStructuredFields
                  ? generateRoomTypeLabel(rt.category, rt.occupancy, rt.floor, rt.size)
                  : rt.room_type;
                const furnishingLabel = deriveFurnishingLevel(rt.furnishing_items);

                return (
                <div
                  key={idx}
                  className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/80 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-700">
                      Room Category {idx + 1}
                    </span>
                    {roomTypes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRoomTypeField(idx)}
                        className="p-2 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg transition-colors"
                        title="Remove category"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Auto-generated label preview */}
                  {label && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Label: </span>
                      <span className="text-sm font-semibold text-emerald-900">{label}</span>
                    </div>
                  )}

                  {/* Structured Dropdowns */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400 font-bold uppercase">Category *</Label>
                      <select
                        value={rt.category}
                        onChange={(e) => {
                          updateRoomTypeField(idx, 'category', e.target.value);
                          const newCat = e.target.value;
                          if (newCat) {
                            const genLabel = generateRoomTypeLabel(newCat, rt.occupancy, rt.floor, rt.size);
                            if (genLabel) updateRoomTypeField(idx, 'room_type', genLabel);
                          }
                        }}
                        className="flex h-10 w-full items-center justify-between rounded-md border bg-white border-slate-200 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Select...</option>
                        {CATEGORY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400 font-bold uppercase">Occupancy *</Label>
                      <select
                        value={rt.occupancy}
                        onChange={(e) => {
                          updateRoomTypeField(idx, 'occupancy', e.target.value);
                          const newOcc = e.target.value;
                          if (rt.category) {
                            const genLabel = generateRoomTypeLabel(rt.category, newOcc, rt.floor, rt.size);
                            if (genLabel) updateRoomTypeField(idx, 'room_type', genLabel);
                          }
                        }}
                        className="flex h-10 w-full items-center justify-between rounded-md border bg-white border-slate-200 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Select...</option>
                        {OCCUPANCY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400 font-bold uppercase">Floor (optional)</Label>
                      <select
                        value={rt.floor}
                        onChange={(e) => {
                          updateRoomTypeField(idx, 'floor', e.target.value);
                          if (rt.category) {
                            const genLabel = generateRoomTypeLabel(rt.category, rt.occupancy, e.target.value, rt.size);
                            if (genLabel) updateRoomTypeField(idx, 'room_type', genLabel);
                          }
                        }}
                        className="flex h-10 w-full items-center justify-between rounded-md border bg-white border-slate-200 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Select...</option>
                        {FLOOR_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400 font-bold uppercase">Size (optional)</Label>
                      <select
                        value={rt.size}
                        onChange={(e) => {
                          updateRoomTypeField(idx, 'size', e.target.value);
                          if (rt.category) {
                            const genLabel = generateRoomTypeLabel(rt.category, rt.occupancy, rt.floor, e.target.value);
                            if (genLabel) updateRoomTypeField(idx, 'room_type', genLabel);
                          }
                        }}
                        className="flex h-10 w-full items-center justify-between rounded-md border bg-white border-slate-200 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Select...</option>
                        {SIZE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Pricing: Rent + Deposit */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400 font-bold uppercase">Rent (KES) *</Label>
                      <Input
                        type="number"
                        required
                        value={rt.price}
                        onChange={(e) => updateRoomTypeField(idx, 'price', e.target.value)}
                        placeholder="7500"
                        className="h-10 bg-white border-slate-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400 font-bold uppercase">Deposit (KES) <span className="text-slate-300 font-normal">optional</span></Label>
                      <Input
                        type="number"
                        min={0}
                        value={rt.deposit}
                        onChange={(e) => updateRoomTypeField(idx, 'deposit', e.target.value)}
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
                          onChange={(e) => updateRoomTypeField(idx, 'is_available', e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                        />
                        <Label htmlFor={`avail-${idx}`} className="text-xs font-semibold text-slate-600 cursor-pointer">
                          Available
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Furnishing Checklist */}
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-400 font-bold uppercase">Furnishing <span className="text-slate-300 font-normal">(optional)</span></Label>
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
                                : rt.furnishing_items.filter((f: string) => f !== item);
                              updateRoomTypeField(idx, 'furnishing_items', newItems);
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
                      <p className="text-xs font-bold text-emerald-600 mt-1">{furnishingLabel}</p>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          {/* YouTube video ID */}
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="youtubeId" className="flex items-center gap-1">
              <Youtube className="h-4 w-4 text-red-600" />
              YouTube Video ID (Optional)
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
            <p className="text-[11px] text-slate-400 font-medium">
              Paste the entire YouTube video URL (e.g. youtube.com/watch?v=...)
              or just the 11-character code. We will automatically extract the
              ID to display the tour.
            </p>
            {youtubeId && youtubeId.length >= 10 && (
              <div className={`mt-3 ${isYoutubeShort ? 'aspect-[9/16] max-w-[200px]' : 'aspect-video max-w-sm'} rounded-xl overflow-hidden border border-slate-200 shadow-xs`}>
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${youtubeId}`}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="description">Listing Description</Label>
            <Textarea
              id="description"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe amenities, utilities, security features, distance to campus..."
              className="bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm resize-none"
            />
          </div>
        </div>
      </div>

      {/* Image Upload Box */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Property Photos</h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Upload images to showcase the room. Drag to reorder or click
            "Set as Cover" to choose the primary photo.
          </p>
        </div>

        {/* Upload Dropzone */}
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
            {isUploading
              ? 'Uploading files to storage...'
              : 'Click or drag photos here to upload'}
          </p>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            PNG, JPG, or WEBP formats up to 10MB each
          </p>
        </div>

        {/* Upload Loader */}
        {isUploading && (
          <div className="flex items-center justify-center gap-2 text-emerald-600 text-xs font-bold py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading to Cloudflare R2...
          </div>
        )}

        {/* Photo Previews */}
        {images.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 font-medium mb-3 flex items-center gap-1.5">
              <GripVertical className="h-3 w-3" />
              Drag images to reorder. The first image is the cover photo.
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
