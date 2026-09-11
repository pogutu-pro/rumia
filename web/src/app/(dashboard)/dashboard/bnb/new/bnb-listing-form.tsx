'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { toast } from 'sonner';
import {
  Loader2, Plus, Trash2, UploadCloud, GripVertical,
  Star, ChevronUp, ChevronDown, AlertCircle, ChevronRight,
} from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  rectSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils/cn';
import { processAndUploadImage } from '@/lib/r2/upload';
import { getAmenityMeta } from '@/lib/utils/amenity-icons';

const GoogleLocationInput = dynamic(
  () => import('@/components/ui/google-location-input').then((m) => m.GoogleLocationInput),
  { ssr: false, loading: () => <div className="h-11 w-full rounded-md bg-slate-100 animate-pulse" /> },
);

// ── Types ────────────────────────────────────────────────────────────────────

export interface BnbInitialData {
  id: string;
  title?: string;
  description?: string;
  price?: number;
  location?: string;
  county?: string;
  area?: string;
  specific_location?: string;
  latitude?: number | null;
  longitude?: number | null;
  amenities?: string[];
  is_active?: boolean;
  images?: Array<{
    id?: string; r2_url: string; category?: string | null;
    display_order?: number | null; blur_data_url?: string | null;
    width?: number | null; height?: number | null; format?: string | null;
  }>;
  bnb?: {
    listing_type?: string;
    max_guests?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    bed_config?: { type: string; qty: number }[];
    price_unit?: string;
    min_stay_nights?: number;
    max_stay_nights?: number | null;
    cleaning_fee?: number | null;
    security_deposit?: number | null;
    extra_guest_fee?: number | null;
    available_from?: string | null;
    available_until?: string | null;
    check_in_time?: string | null;
    check_out_time?: string | null;
    advance_notice_hours?: number | null;
    house_rules?: Record<string, unknown>;
    custom_rules?: string | null;
    guest_suitability?: string[];
    nearby_landmark?: string | null;
  };
}

interface UploadedImage {
  id: string; url: string; name: string; category: string;
  blurDataUrl?: string; width?: number; height?: number;
  format?: string;
}

interface BnbListingFormProps {
  mode?: 'create' | 'edit';
  initialData?: BnbInitialData;
  agentWhatsapp?: string | null;
  campusId?: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const LISTING_TYPES = [
  { value: 'entire_place', label: 'Entire place', desc: 'Guests have the whole place to themselves' },
  { value: 'private_room', label: 'Private room', desc: 'Guests have their own room, shared common areas' },
  { value: 'shared_space', label: 'Shared space', desc: 'Guests share the space with others' },
];

const PRICE_UNITS = [
  { value: 'night', label: 'Per night' },
  { value: 'week', label: 'Per week' },
  { value: 'month', label: 'Per month' },
];

const BED_TYPES = ['King', 'Queen', 'Double', 'Single', 'Bunk bed', 'Sofa bed', 'Floor mattress'];

const AMENITIES_BNB = [
  'WiFi', 'Parking', 'Kitchen', 'Air conditioning', 'TV', 'Washing machine',
  'Swimming pool', 'Gym', 'Balcony', 'Garden', 'CCTV', 'Guard', 'Study Area',
];

const GUEST_SUITABILITY_OPTIONS = [
  { value: 'students', label: 'Students' },
  { value: 'families', label: 'Families / Parents' },
  { value: 'tourists', label: 'Tourists' },
  { value: 'business', label: 'Business travelers' },
  { value: 'couples', label: 'Couples' },
  { value: 'groups', label: 'Groups' },
  { value: 'events', label: 'Event / Wedding guests' },
  { value: 'long_stays', label: 'Long stays' },
];

const STEPS = [
  { id: 'property', label: 'Property' },
  { id: 'photos', label: 'Photos' },
  { id: 'capacity', label: 'Capacity' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'availability', label: 'Availability' },
  { id: 'amenities', label: 'Amenities' },
  { id: 'rules', label: 'Rules' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) { const i = next++; await fn(items[i], i); }
    }),
  );
}

function friendlyError(err: any): string {
  const m = (err?.message || '').toLowerCase();
  if (m.includes('too small')) return 'Image is too small (min 100×100).';
  if (m.includes('too large') || m.includes('413')) return 'Image is too large.';
  if (m.includes('unsupported') || m.includes('format')) return 'Unsupported image format.';
  if (m.includes('expired') || m.includes('unauthorized')) return 'Session expired. Please log in again.';
  return err?.message || 'Upload failed.';
}

function initImages(data?: BnbInitialData): UploadedImage[] {
  return [...(data?.images || [])]
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((img, i) => ({
      id: img.id ?? `existing-${i}`,
      url: img.r2_url,
      name: `Image ${i + 1}`,
      category: img.category ?? 'Room',
      blurDataUrl: img.blur_data_url ?? undefined,
      width: img.width ?? undefined,
      height: img.height ?? undefined,
      format: img.format ?? undefined,
    }));
}

// ── SortableImageCard ────────────────────────────────────────────────────────

function SortableImageCard({
  img, idx, total, onRemove, onSetCover, onMoveUp, onMoveDown, onCategoryChange,
}: {
  img: UploadedImage; idx: number; total: number;
  onRemove: (i: number) => void; onSetCover: (i: number) => void;
  onMoveUp: (i: number) => void; onMoveDown: (i: number) => void;
  onCategoryChange: (i: number, cat: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: img.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : undefined }}
      className={cn(
        'relative aspect-4/3 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs',
        isDragging && 'opacity-50 ring-2 ring-emerald-500',
      )}
    >
      <Image src={img.url} alt={`Photo ${idx + 1}`} fill sizes="200px" className="object-cover" />

      <div className="absolute top-2 left-2 bg-slate-900/80 px-1.5 py-0.5 rounded text-[9px] font-bold text-white uppercase tracking-wider z-20">
        {idx === 0 ? 'Cover' : `#${idx + 1}`}
      </div>

      <button type="button" onClick={() => onRemove(idx)}
        className="absolute top-2 right-2 p-1.5 bg-rose-600/90 hover:bg-rose-500 text-white rounded-lg z-20">
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1 z-20">
        <select value={img.category} onChange={(e) => onCategoryChange(idx, e.target.value)}
          className="flex-1 min-w-0 text-[10px] font-bold h-7 bg-white/90 border border-slate-200 rounded px-1.5 text-slate-800 focus:outline-none">
          {['Room', 'Bathroom', 'Kitchen', 'Living area', 'Exterior', 'View', 'Other'].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {idx !== 0 && (
          <button type="button" onClick={() => onSetCover(idx)}
            className="p-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-lg shrink-0">
            <Star className="h-3.5 w-3.5" />
          </button>
        )}
        {idx > 0 && (
          <button type="button" onClick={() => onMoveUp(idx)}
            className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-white rounded-lg shrink-0">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
        )}
        {idx < total - 1 && (
          <button type="button" onClick={() => onMoveDown(idx)}
            className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-white rounded-lg shrink-0">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        )}
        <button type="button" {...attributes} {...listeners}
          className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-white rounded-lg shrink-0 cursor-grab active:cursor-grabbing">
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}


// ── StepNav ──────────────────────────────────────────────────────────────────

function StepNav({ current, onChange }: { current: number; onChange: (i: number) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1">
      {STEPS.map((step, i) => (
        <button key={step.id} type="button" onClick={() => onChange(i)}
          className={cn(
            'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors',
            i === current ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
          )}>
          {step.label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-xs space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 font-medium mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BnbListingForm({ mode = 'create', initialData, agentWhatsapp }: BnbListingFormProps) {
  const router = useRouter();
  const isEditing = mode === 'edit' && !!initialData;
  const bnb = initialData?.bnb;

  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [title, setTitle] = useState(initialData?.title ?? '');
  const [listingType, setListingType] = useState(bnb?.listing_type ?? 'entire_place');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [location, setLocation] = useState(initialData?.location ?? '');
  const [latitude, setLatitude] = useState<number | null>(initialData?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(initialData?.longitude ?? null);
  const [area, setArea] = useState(initialData?.area ?? '');
  const [specificLocation, setSpecificLocation] = useState(initialData?.specific_location ?? '');
  const [nearbyLandmark, setNearbyLandmark] = useState(bnb?.nearby_landmark ?? '');
  const [whatsapp, setWhatsapp] = useState(agentWhatsapp ?? '');
  const [images, setImages] = useState<UploadedImage[]>(() => initImages(initialData));
  const [maxGuests, setMaxGuests] = useState(String(bnb?.max_guests ?? ''));
  const [bedrooms, setBedrooms] = useState(String(bnb?.bedrooms ?? ''));
  const [bathrooms, setBathrooms] = useState(String(bnb?.bathrooms ?? ''));
  const [bedConfig, setBedConfig] = useState<{ type: string; qty: number }[]>(
    bnb?.bed_config?.length ? bnb.bed_config : [{ type: 'Double', qty: 1 }],
  );
  const [price, setPrice] = useState(String(initialData?.price ?? ''));
  const [priceUnit, setPriceUnit] = useState(bnb?.price_unit ?? 'night');
  const [minStay, setMinStay] = useState(String(bnb?.min_stay_nights ?? '1'));
  const [maxStay, setMaxStay] = useState(String(bnb?.max_stay_nights ?? ''));
  const [cleaningFee, setCleaningFee] = useState(String(bnb?.cleaning_fee ?? ''));
  const [securityDeposit, setSecurityDeposit] = useState(String(bnb?.security_deposit ?? ''));
  const [extraGuestFee, setExtraGuestFee] = useState(String(bnb?.extra_guest_fee ?? ''));
  const [availableFrom, setAvailableFrom] = useState(bnb?.available_from ?? '');
  const [availableUntil, setAvailableUntil] = useState(bnb?.available_until ?? '');
  const [checkInTime, setCheckInTime] = useState(bnb?.check_in_time ?? '');
  const [checkOutTime, setCheckOutTime] = useState(bnb?.check_out_time ?? '');
  const [advanceNotice, setAdvanceNotice] = useState(String(bnb?.advance_notice_hours ?? ''));
  const [amenities, setAmenities] = useState<string[]>(initialData?.amenities ?? []);
  const rules = bnb?.house_rules as Record<string, unknown> | undefined;
  const [smoking, setSmoking] = useState(Boolean(rules?.smoking));
  const [pets, setPets] = useState(Boolean(rules?.pets));
  const [parties, setParties] = useState(Boolean(rules?.parties));
  const [visitors, setVisitors] = useState(rules?.visitors !== false);
  const [children, setChildren] = useState(rules?.children !== false);
  const [quietHours, setQuietHours] = useState(String(rules?.quiet_hours ?? ''));
  const [customRules, setCustomRules] = useState(bnb?.custom_rules ?? '');
  const [guestSuitability, setGuestSuitability] = useState<string[]>(bnb?.guest_suitability ?? []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setImages((prev) => {
        const from = prev.findIndex((i) => i.id === active.id);
        const to = prev.findIndex((i) => i.id === over.id);
        return arrayMove(prev, from, to);
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setIsUploading(true);
    const files = Array.from(e.target.files);
    const next: UploadedImage[] = [...images];
    let ok = 0; let fail = 0;
    await mapLimit(files, 3, async (file) => {
      try {
        const r = await processAndUploadImage(file, 'listing');
        next.push({ id: crypto.randomUUID(), url: r.url, name: file.name, category: 'Room',
          blurDataUrl: r.blurUrl, width: r.width, height: r.height, format: r.format });
        ok++;
      } catch (err: any) { fail++; toast.error(`${file.name}: ${friendlyError(err)}`); }
    });
    if (ok) toast.success(`${ok} photo${ok > 1 ? 's' : ''} uploaded`);
    if (fail) toast.error(`${fail} photo${fail > 1 ? 's' : ''} failed`);
    setImages(next);
    setIsUploading(false);
    e.target.value = '';
  };

  const handleLocationChange = useCallback((r: { address: string; latitude: number | null; longitude: number | null }) => {
    setLocation(r.address); setLatitude(r.latitude); setLongitude(r.longitude);
  }, []);

  const handleSubmit = async (isActive: boolean) => {
    if (isSaving || isUploading) return;
    if (!title.trim()) { toast.error('Listing title is required'); setStep(0); return; }
    if (!price || Number(price) <= 0) { toast.error('Base price is required'); setStep(3); return; }
    setIsSaving(true);
    try {
      const { createBnbListingAction, updateBnbListingAction } = await import('@/app/actions/bnb');
      const payload = {
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        location: location.trim() || area || 'Kenya',
        county: initialData?.county ?? 'nyeri',
        area: area || undefined,
        specific_location: specificLocation || undefined,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        amenities,
        is_active: isActive,
        images: images.map((img, idx) => ({
          r2_url: img.url, display_order: idx, category: img.category,
          blur_data_url: img.blurDataUrl ?? null,
          width: img.width ?? null, height: img.height ?? null, format: img.format ?? null,
        })),
        agent_whatsapp: whatsapp || undefined,
        bnb: {
          listing_type: listingType,
          max_guests: toNum(maxGuests),
          bedrooms: toNum(bedrooms),
          bathrooms: toNum(bathrooms),
          bed_config: bedConfig,
          price_unit: priceUnit,
          min_stay_nights: Number(minStay) || 1,
          max_stay_nights: toNum(maxStay),
          cleaning_fee: toNum(cleaningFee),
          security_deposit: toNum(securityDeposit),
          extra_guest_fee: toNum(extraGuestFee),
          available_from: availableFrom || null,
          available_until: availableUntil || null,
          check_in_time: checkInTime || null,
          check_out_time: checkOutTime || null,
          advance_notice_hours: toNum(advanceNotice),
          house_rules: { smoking, pets, parties, visitors, children, quiet_hours: quietHours || null },
          custom_rules: customRules || null,
          guest_suitability: guestSuitability,
          nearby_landmark: nearbyLandmark || null,
        },
      };
      const result = isEditing
        ? await updateBnbListingAction(initialData!.id, payload)
        : await createBnbListingAction(payload);
      if (!result.success) throw new Error(result.error);
      toast.success(isEditing ? 'Listing updated!' : isActive ? 'Listing published!' : 'Draft saved!');
      router.push('/dashboard/bnb');
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save listing.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <StepNav current={step} onChange={setStep} />

      {step === 0 && (
        <Section title="Property details" subtitle="Tell guests about your place.">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="bnb-title">Listing title *</Label>
              <Input id="bnb-title" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Cosy studio near DeKUT campus"
                className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm" />
            </div>
            <div className="space-y-2">
              <Label>Listing type *</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {LISTING_TYPES.map((lt) => (
                  <label key={lt.value} className="cursor-pointer">
                    <input type="radio" name="listing_type" value={lt.value}
                      checked={listingType === lt.value} onChange={() => setListingType(lt.value)} className="sr-only" />
                    <div className={cn('rounded-2xl border-2 p-4 transition-all',
                      listingType === lt.value ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300')}>
                      <p className={cn('text-sm font-bold', listingType === lt.value ? 'text-emerald-800' : 'text-slate-800')}>{lt.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{lt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bnb-desc">Description</Label>
              <Textarea id="bnb-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your place — what makes it special, nearby attractions, who it's perfect for..."
                className="bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm resize-none" />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <GoogleLocationInput value={location} latitude={latitude} longitude={longitude}
                onChange={handleLocationChange} placeholder="Search for your property address" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bnb-area">Area / Zone</Label>
                <Input id="bnb-area" value={area} onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. Boma, Ngariama"
                  className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bnb-landmark">Nearby landmark</Label>
                <Input id="bnb-landmark" value={nearbyLandmark} onChange={(e) => setNearbyLandmark(e.target.value)}
                  placeholder="e.g. Opposite Equity Bank"
                  className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bnb-specific">Specific location detail</Label>
              <Input id="bnb-specific" value={specificLocation} onChange={(e) => setSpecificLocation(e.target.value)}
                placeholder="e.g. 2nd floor, blue gate"
                className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm" />
            </div>
          </div>
        </Section>
      )}

      {step === 1 && (
        <Section title="Photos" subtitle="Great photos get more bookings. First photo is the cover.">
          <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 rounded-2xl p-8 transition-colors flex flex-col items-center text-center cursor-pointer relative">
            <input type="file" multiple accept="image/*" onChange={handleFileChange}
              disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <UploadCloud className="h-10 w-10 text-slate-400 mb-3" />
            <p className="text-sm font-bold text-slate-700">{isUploading ? 'Uploading…' : 'Click or drag photos here'}</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">PNG, JPG or WEBP · up to 10 MB each</p>
          </div>
          {isUploading && (
            <div className="flex items-center justify-center gap-2 text-emerald-600 text-xs font-bold py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Uploading to Cloudflare R2…
            </div>
          )}
          {images.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 font-medium mb-3 flex items-center gap-1.5">
                <GripVertical className="h-3 w-3" /> Drag to reorder · first image = cover photo
              </p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={images.map((i) => i.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {images.map((img, idx) => (
                      <SortableImageCard key={img.id} img={img} idx={idx} total={images.length}
                        onRemove={(i) => setImages((p) => p.filter((_, x) => x !== i))}
                        onSetCover={(i) => setImages((p) => { const u = [...p]; const [t] = u.splice(i, 1); u.unshift(t); return u; })}
                        onMoveUp={(i) => setImages((p) => { if (i === 0) return p; const u = [...p]; [u[i-1], u[i]] = [u[i], u[i-1]]; return u; })}
                        onMoveDown={(i) => setImages((p) => { if (i >= p.length-1) return p; const u = [...p]; [u[i], u[i+1]] = [u[i+1], u[i]]; return u; })}
                        onCategoryChange={(i, cat) => setImages((p) => p.map((img, x) => x === i ? { ...img, category: cat } : img))}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </Section>
      )}

      {step === 2 && (
        <Section title="Capacity" subtitle="How many guests can stay, and what beds are available?">
          <div className="grid grid-cols-3 gap-4">
            {([['Max guests', maxGuests, setMaxGuests], ['Bedrooms', bedrooms, setBedrooms], ['Bathrooms', bathrooms, setBathrooms]] as const).map(([label, value, set]) => (
              <div key={label} className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</Label>
                <Input type="number" min={0} value={value} onChange={(e) => (set as any)(e.target.value)}
                  placeholder="0" className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm" />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold text-slate-700">Bed configuration</Label>
              <Button type="button" variant="outline" size="sm"
                onClick={() => setBedConfig((p) => [...p, { type: 'Single', qty: 1 }])}
                className="h-8 px-3 rounded-lg border-slate-200 text-xs font-bold">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add bed
              </Button>
            </div>
            <div className="space-y-2">
              {bedConfig.map((bed, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <select value={bed.type}
                    onChange={(e) => setBedConfig((p) => p.map((b, i) => i === idx ? { ...b, type: e.target.value } : b))}
                    className="flex-1 h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    {BED_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button"
                      onClick={() => setBedConfig((p) => p.map((b, i) => i === idx ? { ...b, qty: Math.max(1, b.qty - 1) } : b))}
                      className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm flex items-center justify-center">−</button>
                    <span className="w-5 text-center text-sm font-bold text-slate-800">{bed.qty}</span>
                    <button type="button"
                      onClick={() => setBedConfig((p) => p.map((b, i) => i === idx ? { ...b, qty: b.qty + 1 } : b))}
                      className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm flex items-center justify-center">+</button>
                  </div>
                  {bedConfig.length > 1 && (
                    <button type="button" onClick={() => setBedConfig((p) => p.filter((_, i) => i !== idx))}
                      className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {step === 3 && (
        <Section title="Pricing" subtitle="Set your base price and any additional fees.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="bnb-price">Base price (KES) *</Label>
              <Input id="bnb-price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 3500" className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bnb-price-unit">Price per</Label>
              <select id="bnb-price-unit" value={priceUnit} onChange={(e) => setPriceUnit(e.target.value)}
                className="flex h-11 w-full rounded-md border bg-slate-50 border-slate-200/80 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {PRICE_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bnb-min-stay">Minimum stay (nights)</Label>
              <Input id="bnb-min-stay" type="number" min={1} value={minStay} onChange={(e) => setMinStay(e.target.value)}
                placeholder="1" className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bnb-max-stay">Maximum stay (nights) <span className="text-slate-400 font-normal">optional</span></Label>
              <Input id="bnb-max-stay" type="number" min={1} value={maxStay} onChange={(e) => setMaxStay(e.target.value)}
                placeholder="No limit" className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bnb-cleaning">Cleaning fee (KES) <span className="text-slate-400 font-normal">optional</span></Label>
              <Input id="bnb-cleaning" type="number" min={0} value={cleaningFee} onChange={(e) => setCleaningFee(e.target.value)}
                placeholder="e.g. 500" className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bnb-deposit">Security deposit (KES) <span className="text-slate-400 font-normal">optional</span></Label>
              <Input id="bnb-deposit" type="number" min={0} value={securityDeposit} onChange={(e) => setSecurityDeposit(e.target.value)}
                placeholder="e.g. 2000" className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bnb-extra-guest">Extra guest fee / person (KES) <span className="text-slate-400 font-normal">optional</span></Label>
              <Input id="bnb-extra-guest" type="number" min={0} value={extraGuestFee} onChange={(e) => setExtraGuestFee(e.target.value)}
                placeholder="e.g. 300" className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm" />
            </div>
          </div>
        </Section>
      )}

      {step === 4 && (
        <Section title="Availability" subtitle="When is your place available and what are the check-in rules?">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="bnb-from">Available from <span className="text-slate-400 font-normal">optional</span></Label>
              <Input id="bnb-from" type="date" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)}
                className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bnb-until">Available until <span className="text-slate-400 font-normal">optional</span></Label>
              <Input id="bnb-until" type="date" value={availableUntil} onChange={(e) => setAvailableUntil(e.target.value)}
                className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bnb-checkin">Check-in time <span className="text-slate-400 font-normal">optional</span></Label>
              <Input id="bnb-checkin" type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)}
                className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bnb-checkout">Check-out time <span className="text-slate-400 font-normal">optional</span></Label>
              <Input id="bnb-checkout" type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)}
                className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bnb-notice">Advance notice required (hours) <span className="text-slate-400 font-normal">optional</span></Label>
              <Input id="bnb-notice" type="number" min={0} value={advanceNotice} onChange={(e) => setAdvanceNotice(e.target.value)}
                placeholder="e.g. 24" className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm" />
              <p className="text-[11px] text-slate-400 font-medium">How many hours before arrival guests must book.</p>
            </div>
          </div>
        </Section>
      )}

      {step === 5 && (
        <Section title="Amenities" subtitle="What does your place offer?">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {AMENITIES_BNB.map((amenity) => {
              const meta = getAmenityMeta(amenity);
              const Icon = meta.icon;
              const selected = amenities.includes(amenity);
              return (
                <label key={amenity} htmlFor={`bnb-amenity-${amenity}`} className="group cursor-pointer">
                  <input type="checkbox" id={`bnb-amenity-${amenity}`} checked={selected}
                    onChange={() => setAmenities((p) => selected ? p.filter((a) => a !== amenity) : [...p, amenity])}
                    className="sr-only" />
                  <div className={cn(
                    'flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 p-4 sm:p-5 transition-all duration-150',
                    selected ? 'border-emerald-400 bg-emerald-50 shadow-md shadow-emerald-100/60' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm',
                  )}>
                    <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
                      selected ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200')}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={cn('text-xs font-bold leading-tight text-center', selected ? 'text-emerald-700' : 'text-slate-600')}>
                      {amenity}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </Section>
      )}

      {step === 6 && (
        <Section title="House rules & guest suitability" subtitle="Set expectations for your guests.">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-slate-700">House rules</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                ['Smoking allowed', smoking, setSmoking],
                ['Pets allowed', pets, setPets],
                ['Parties / events allowed', parties, setParties],
                ['Visitors allowed', visitors, setVisitors],
                ['Children welcome', children, setChildren],
              ] as [string, boolean, (v: boolean) => void][]).map(([label, value, set]) => (
                <label key={label} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 cursor-pointer">
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                  <button type="button" onClick={() => set(!value)}
                    className={cn('relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors', value ? 'bg-emerald-500' : 'bg-slate-300')}>
                    <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform mt-0.5', value ? 'translate-x-4' : 'translate-x-0.5')} />
                  </button>
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bnb-quiet">Quiet hours <span className="text-slate-400 font-normal">optional</span></Label>
              <Input id="bnb-quiet" value={quietHours} onChange={(e) => setQuietHours(e.target.value)}
                placeholder="e.g. 22:00–07:00" className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bnb-custom-rules">Additional rules <span className="text-slate-400 font-normal">optional</span></Label>
              <Textarea id="bnb-custom-rules" rows={3} value={customRules} onChange={(e) => setCustomRules(e.target.value)}
                placeholder="Any other rules guests should know about..."
                className="bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm resize-none" />
            </div>
          </div>
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <p className="text-sm font-semibold text-slate-700">Best suited for</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {GUEST_SUITABILITY_OPTIONS.map(({ value, label }) => {
                const selected = guestSuitability.includes(value);
                return (
                  <label key={value} className="cursor-pointer">
                    <input type="checkbox" checked={selected}
                      onChange={() => setGuestSuitability((p) => selected ? p.filter((v) => v !== value) : [...p, value])}
                      className="sr-only" />
                    <div className={cn('rounded-xl border-2 px-3 py-2 text-xs font-semibold text-center transition-all',
                      selected ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')}>
                      {label}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <Label htmlFor="bnb-whatsapp">Your WhatsApp number</Label>
            <Input id="bnb-whatsapp" type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="e.g. 0712 345 678" className="h-11 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 font-medium text-sm" />
            <p className="text-[11px] text-slate-400 font-medium">Guests will contact you on this number.</p>
          </div>
        </Section>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <div>
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}
              className="rounded-xl font-bold h-11 border-slate-200 text-slate-600 hover:bg-slate-50">
              Back
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={() => setStep((s) => s + 1)}
              className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 px-6 border-0">
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" disabled={isSaving || isUploading}
                onClick={() => handleSubmit(false)}
                className="rounded-xl font-bold h-11 border-slate-200 text-slate-600 hover:bg-slate-50">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Save draft
              </Button>
              <Button type="button" disabled={isSaving || isUploading}
                onClick={() => handleSubmit(true)}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11 px-8 border-0 shadow-md shadow-emerald-600/10">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                {isEditing ? 'Update listing' : 'Publish listing'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
