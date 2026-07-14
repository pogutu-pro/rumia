'use client';

import { useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ImageUpload } from '@/components/ui/image-upload';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils/cn';
import { processAndUploadImage } from '@/lib/r2/upload';
import { updateAgentProfileAction } from '@/app/actions/agents';
import { DEKUT_AREAS } from '@/lib/constants/dekut-areas';

const LANGUAGE_OPTIONS = [
  'English', 'Kiswahili', 'Kikuyu', 'Luo', 'Kalenjin', 'Luhya', 'Kamba', 'Meru', 'Embu',
];

const SERVICE_AREA_OPTIONS = Object.values(DEKUT_AREAS).map((a) => a.name);

interface AgentProfileFormProps {
  agent: Record<string, any>;
}

function ChipSelect({
  options,
  selected,
  onChange,
  label,
}: {
  options: string[];
  selected: string[];
  onChange: (value: string[]) => void;
  label: string;
}) {
  const toggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all',
              selected.includes(option)
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300',
            )}
            aria-pressed={selected.includes(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AgentProfileForm({ agent }: AgentProfileFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(agent.name || '');
  const [whatsapp, setWhatsapp] = useState(agent.whatsapp || '');
  const [bio, setBio] = useState(agent.bio || '');
  const [serviceAreas, setServiceAreas] = useState<string[]>(agent.service_areas || []);
  const [languages, setLanguages] = useState<string[]>(agent.languages || []);
  const [helpingSince, setHelpingSince] = useState<number>(() =>
    agent.helping_since || new Date(agent.created_at || Date.now()).getFullYear(),
  );
  const [instagram, setInstagram] = useState(agent.instagram || '');
  const [linkedin, setLinkedin] = useState(agent.linkedin || '');
  const [instagramPublic, setInstagramPublic] = useState(!!agent.instagram_public);
  const [linkedinPublic, setLinkedinPublic] = useState(!!agent.linkedin_public);
  const [portfolioUrl, setPortfolioUrl] = useState(agent.portfolio_url || '');

  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [existingProfilePhoto] = useState<string | null>(agent.profile_photo_url || null);
  const [existingCoverImage] = useState<string | null>(agent.cover_image_url || null);
  const [uploading, setUploading] = useState(false);

  const uploadFile = useCallback(async (file: File, purpose: 'listing' | 'agent'): Promise<string | null> => {
    try {
      const result = await processAndUploadImage(file, purpose);
      return result.url;
    } catch {
      toast.error(`Failed to upload ${purpose === 'agent' ? 'profile photo' : 'cover image'}`);
      return null;
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);

    let profilePhotoUrl = existingProfilePhoto;
    let coverImageUrl = existingCoverImage;

    if (profilePhotoFile) {
      const url = await uploadFile(profilePhotoFile, 'agent');
      if (url) profilePhotoUrl = url;
    }
    if (coverImageFile) {
      const url = await uploadFile(coverImageFile, 'agent');
      if (url) coverImageUrl = url;
    }

    setUploading(false);

    startTransition(async () => {
      const result = await updateAgentProfileAction({
        name,
        whatsapp,
        bio: bio || null,
        service_areas: serviceAreas,
        languages,
        helping_since: helpingSince,
        instagram: instagram || null,
        linkedin: linkedin || null,
        instagram_public: instagramPublic,
        linkedin_public: linkedinPublic,
        profile_photo_url: profilePhotoUrl,
        cover_image_url: coverImageUrl,
        portfolio_url: portfolioUrl || null,
      });

      if (result.success) {
        toast.success('Profile updated');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 2015 + 1 }, (_, i) => currentYear - i);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Photos */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Photos</h2>
        <div className="space-y-4">
          <ImageUpload
            onImageChange={setCoverImageFile}
            currentImageUrl={existingCoverImage}
            aspectRatio="16/9"
            label="Cover Image (optional)"
          />
          <ImageUpload
            onImageChange={setProfilePhotoFile}
            currentImageUrl={existingProfilePhoto}
            aspectRatio="1/1"
            label="Profile Photo"
          />
        </div>
      </div>

      {/* Basic Info */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Basic Info</h2>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Display Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp">WhatsApp Number</Label>
            <Input
              id="whatsapp"
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              required
              placeholder="+254 7XX XXX XXX"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio ({250 - bio.length} characters remaining)</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 250))}
              placeholder="Describe your experience helping students find hostels..."
              rows={3}
              maxLength={250}
            />
          </div>
        </div>
      </div>

      {/* Service Areas */}
      <ChipSelect
        label="Service Areas"
        options={SERVICE_AREA_OPTIONS}
        selected={serviceAreas}
        onChange={setServiceAreas}
      />

      {/* Languages */}
      <ChipSelect
        label="Languages Spoken"
        options={LANGUAGE_OPTIONS}
        selected={languages}
        onChange={setLanguages}
      />

      {/* Helping Since */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Helping Students Since</p>
        <div className="flex flex-wrap gap-2">
          {yearOptions.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => setHelpingSince(year)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all',
                helpingSince === year
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300',
              )}
              aria-pressed={helpingSince === year}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      {/* Social Links */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Social Links</h2>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="portfolio-url">Portfolio Website (optional)</Label>
            <Input
              id="portfolio-url"
              value={portfolioUrl}
              onChange={(e) => setPortfolioUrl(e.target.value)}
              placeholder="https://yoursite.com"
              type="url"
            />
            <p className="text-xs text-slate-400">
              Your personal website, portfolio, or LinkedIn profile
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="instagram">Instagram Username (optional)</Label>
            <Input
              id="instagram"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="username"
            />
            {instagram && (
              <div className="flex items-center gap-2 mt-1">
                <Switch
                  id="instagram-public"
                  checked={instagramPublic}
                  onCheckedChange={setInstagramPublic}
                />
                <Label htmlFor="instagram-public" className="text-xs text-slate-500">
                  Show on public profile
                </Label>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="linkedin">LinkedIn Username (optional)</Label>
            <Input
              id="linkedin"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              placeholder="username"
            />
            {linkedin && (
              <div className="flex items-center gap-2 mt-1">
                <Switch
                  id="linkedin-public"
                  checked={linkedinPublic}
                  onCheckedChange={setLinkedinPublic}
                />
                <Label htmlFor="linkedin-public" className="text-xs text-slate-500">
                  Show on public profile
                </Label>
              </div>
            )}
          </div>
        </div>
      </div>

      <Button type="submit" disabled={isPending || uploading} size="lg" className="w-full">
        {isPending || uploading ? 'Saving...' : 'Save Profile'}
      </Button>
    </form>
  );
}
