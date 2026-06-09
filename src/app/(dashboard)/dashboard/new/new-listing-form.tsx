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
import { Loader2, Plus, Trash2, UploadCloud, Youtube } from 'lucide-react';

import { Zap, Droplets, Wifi } from 'lucide-react';

interface NewListingFormProps {
  agentId: string | number;
  agentWhatsapp?: string | null;
  initialListing?: InitialListingData;
  mode?: 'create' | 'edit';
}

interface UploadedImage {
  id?: string;
  url: string;
  name: string;
  category: string; // Room, Bathroom, Exterior, Study Area, Laundry Area, Kitchen
}

interface FormRoomType {
  room_type: string;
  price: string;
  is_available: boolean;
}

interface InitialListingData {
  id: string;
  title: string;
  description?: string | null;
  price: number | string;
  location: string;
  youtube_id?: string | null;
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
  listing_images?: Array<{
    id?: string;
    r2_url: string;
    category?: string | null;
    display_order?: number | null;
  }> | null;
  listing_room_types?: Array<{
    id?: string;
    room_type: string;
    price: number | string;
    is_available?: boolean | null;
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
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
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
      id: image.id,
      url: image.r2_url,
      name: `Existing image ${index + 1}`,
      category: image.category || 'Room',
    }));
}

function initialRoomTypes(listing?: InitialListingData): FormRoomType[] {
  const existing = listing?.listing_room_types || [];

  if (existing.length > 0) {
    return existing.map((room) => ({
      room_type: room.room_type,
      price: String(room.price || ''),
      is_available: room.is_available ?? true,
    }));
  }

  return [{ room_type: 'Single Room', price: '7500', is_available: true }];
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
  const [roomType, setRoomType] = useState(
    initialListing?.room_type || 'Single',
  );
  const [amenities, setAmenities] = useState<string[]>(
    initialListing?.amenities || [],
  );
  const [whatsappNumber, setWhatsappNumber] = useState(agentWhatsapp || '');
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
    String(initialListing?.price_single || ''),
  );
  const [priceSharing, setPriceSharing] = useState(
    String(initialListing?.price_sharing || ''),
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
      { room_type: 'Double Room', price: '', is_available: true },
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

    for (const file of files) {
      try {
        // Fetch presigned URL from API
        const urlResponse = await fetch(
          `/api/upload-url?filename=${encodeURIComponent(file.name)}&filetype=${encodeURIComponent(file.type)}`,
        );

        if (!urlResponse.ok) {
          throw new Error('Failed to get signed upload URL');
        }

        const { uploadUrl, publicUrl } = await urlResponse.json();

        // Upload the file directly to R2 / Mock endpoint using PUT
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type,
          },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error('File upload to storage failed');
        }

        newImages.push({
          url: publicUrl,
          name: file.name,
          category: 'Room',
        });
        toast.success(`Uploaded: ${file.name}`);
      } catch (error) {
        console.error('File upload error:', error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setImages(newImages);
    setIsUploading(false);
    e.target.value = ''; // Reset file input
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
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

    // At least one price must be provided
    if (!priceSingle && !priceSharing) {
      toast.error(
        'Please enter at least one price: Single Occupancy or Shared Occupancy',
      );
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
              <option value="Single">Single</option>
              <option value="Double">Double</option>
              <option value="Self-Contained">Self-Contained</option>
            </select>
          </div>

          {/* Dual Pricing Fields */}
          <div className="sm:col-span-2 space-y-4 bg-emerald-50/30 p-4 rounded-xl border border-emerald-200/50">
            <Label className="font-bold text-slate-800">
              Pricing (at least one required)
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
                  Shared Occupancy — KES per person per month
                </Label>
                <Input
                  id="priceSharing"
                  type="number"
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
              {roomTypes.map((rt, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100/80"
                >
                  <div className="flex-1 w-full space-y-1">
                    <Label className="text-xs text-slate-400 font-bold uppercase">
                      Room Type Name
                    </Label>
                    <Input
                      type="text"
                      required
                      value={rt.room_type}
                      onChange={(e) =>
                        updateRoomTypeField(idx, 'room_type', e.target.value)
                      }
                      placeholder="e.g. Single Room, Self-Contained"
                      className="h-10 bg-white border-slate-200"
                    />
                  </div>
                  <div className="w-full sm:w-36 space-y-1">
                    <Label className="text-xs text-slate-400 font-bold uppercase">
                      Rent (KES)
                    </Label>
                    <Input
                      type="number"
                      required
                      value={rt.price}
                      onChange={(e) =>
                        updateRoomTypeField(idx, 'price', e.target.value)
                      }
                      placeholder="7500"
                      className="h-10 bg-white border-slate-200"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
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
                  {roomTypes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRoomTypeField(idx)}
                      className="p-2 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg transition-colors mt-5"
                      title="Remove category"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
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
              onChange={(e) => setYoutubeId(extractYoutubeId(e.target.value))}
              placeholder="Paste YouTube video link or 11-character ID"
              className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm"
            />
            <p className="text-[11px] text-slate-400 font-medium">
              Paste the entire YouTube video URL (e.g. youtube.com/watch?v=...)
              or just the 11-character code. We will automatically extract the
              ID to display the tour.
            </p>
            {youtubeId && youtubeId.length >= 10 && (
              <div className="mt-3 aspect-video max-w-sm rounded-xl overflow-hidden border border-slate-200 shadow-xs">
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
            Upload images to showcase the room. The first image will be the
            primary cover photo.
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
            {images.map((img, idx) => (
              <div
                key={idx}
                className="relative aspect-4/3 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group shadow-xs flex flex-col justify-between"
              >
                <img
                  src={img.url}
                  alt={`Listing upload ${idx + 1}`}
                  className="absolute inset-0 object-cover w-full h-full"
                />
                <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="p-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors"
                    title="Delete photo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Cover indicator */}
                <div className="absolute top-2 left-2 bg-slate-900/80 px-1.5 py-0.5 rounded text-[9px] font-bold text-white uppercase tracking-wider z-20">
                  {idx === 0 ? 'Cover Photo' : `Image ${idx + 1}`}
                </div>

                {/* Category Dropdown */}
                <div className="absolute bottom-2 left-2 right-2 z-20">
                  <select
                    value={img.category}
                    onChange={(e) => {
                      const updated = [...images];
                      updated[idx].category = e.target.value;
                      setImages(updated);
                    }}
                    className="w-full text-[10px] font-bold h-7 bg-white/90 backdrop-blur-xs border border-slate-200 rounded px-1.5 text-slate-800 shadow-xs focus:outline-none"
                  >
                    <option value="Room">Room</option>
                    <option value="Bathroom">Bathroom</option>
                    <option value="Exterior">Exterior</option>
                    <option value="Study Area">Study Area</option>
                    <option value="Laundry Area">Laundry Area</option>
                    <option value="Kitchen">Kitchen</option>
                  </select>
                </div>
              </div>
            ))}
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
