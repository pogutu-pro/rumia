'use client';

import { useState, useTransition } from 'react';
import {
  Building2,
  Save,
  Plus,
  Loader2,
  AlertCircle,
  Lock,
  Palette,
  Phone,
  Globe,
  MapPin,
  Edit2,
  Trash2,
  LogOut,
} from 'lucide-react';
import {
  updateCampusSettingsAction,
  createCampusAction,
} from '@/app/actions/campus-settings';
import {
  createZoneAction,
  updateZoneAction,
  deleteZoneAction,
} from '@/app/actions/zones';
import { ImageUpload } from '@/components/ui/image-upload';
import { processAndUploadImage } from '@/lib/r2/upload';
import { DISTANCE_CATEGORY_OPTIONS } from '@/lib/constants/dekut-areas';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { PushNotificationPrompt } from '@/components/pwa/PushNotificationPrompt';

interface SettingsClientProps {
  campuses: any[];
  isSuperAdmin: boolean;
  regions: any[];
  allZones?: any[];
}

export function SettingsClient({
  campuses,
  isSuperAdmin,
  regions,
  allZones = [],
}: SettingsClientProps) {
  const [selectedCampusId, setSelectedCampusId] = useState<string>(
    campuses[0]?.id || '',
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Hostel areas / zones — single source of truth from campus_zones.
  const [zones, setZones] = useState<any[]>(allZones);
  const campusZones = zones.filter((z) => z.campus_id === selectedCampusId);
  const [isZonePending, startZoneTransition] = useTransition();
  const [zoneModal, setZoneModal] = useState<any | null>(null);
  const [zoneForm, setZoneForm] = useState({
    name: '',
    full_search_price: 500,
    distance_category: 'walking-500m',
  });

  // Selected Campus
  const selectedCampus = campuses.find((c) => c.id === selectedCampusId);

  // Form State
  const [formData, setFormData] = useState({
    name: selectedCampus?.name || '',
    slug: selectedCampus?.slug || '',
    region_id: selectedCampus?.region_id || '',
    status: selectedCampus?.status || 'active',
    hero_headline: selectedCampus?.hero_headline || '',
    hero_subtext: selectedCampus?.hero_subtext || '',
    short_name: selectedCampus?.short_name || '',
    primary_color: selectedCampus?.primary_color || '#10B981',
    whatsapp_number: selectedCampus?.whatsapp_number || '',
    phone: selectedCampus?.phone || '',
    email: selectedCampus?.email || '',
    seo_title: selectedCampus?.seo_title || '',
    seo_description: selectedCampus?.seo_description || '',
    og_title: selectedCampus?.og_title || '',
    og_description: selectedCampus?.og_description || '',
    twitter_description: selectedCampus?.twitter_description || '',
    hero_image: selectedCampus?.hero_image || null,
  });

  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [newCampusImageFile, setNewCampusImageFile] = useState<File | null>(
    null,
  );
  const [loggingOut, setLoggingOut] = useState(false);

  // Create Campus Modal State
  const [isCreatingCampus, setIsCreatingCampus] = useState(false);
  const [newCampusForm, setNewCampusForm] = useState({
    name: '',
    slug: '',
    region_id: '',
  });

  const handleCampusChange = (id: string) => {
    setSelectedCampusId(id);
    const campus = campuses.find((c) => c.id === id);
    if (campus) {
      setFormData({
        name: campus.name || '',
        slug: campus.slug || '',
        region_id: campus.region_id || '',
        status: campus.status || 'active',
        hero_headline: campus.hero_headline || '',
        hero_subtext: campus.hero_subtext || '',
        short_name: campus.short_name || '',
        primary_color: campus.primary_color || '#10B981',
        whatsapp_number: campus.whatsapp_number || '',
        phone: campus.phone || '',
        email: campus.email || '',
        seo_title: campus.seo_title || '',
        seo_description: campus.seo_description || '',
        og_title: campus.og_title || '',
        og_description: campus.og_description || '',
        twitter_description: campus.twitter_description || '',
        hero_image: campus.hero_image || null,
      });
      setHeroImageFile(null);
    }
    setZoneModal(null);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSaveSettings = async () => {
    if (isSaving) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    // Zones are mandatory to complete campus settings.
    if (campusZones.length === 0) {
      const msg =
        'Add at least one hostel area (zone) below before completing campus settings. Agents select these areas when listing hostels.';
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }

    setIsSaving(true);
    try {
      const updateData: typeof formData = { ...formData };

      if (heroImageFile) {
        const result = await processAndUploadImage(heroImageFile, 'listing');
        updateData.hero_image = result.url;
        setFormData({ ...formData, hero_image: result.url });
      }

      const res = await updateCampusSettingsAction(
        selectedCampusId,
        updateData,
      );
      if (!res.success) {
        setErrorMsg(res.error);
        toast.error(res.error);
      } else {
        setSuccessMsg('Campus settings updated successfully.');
        toast.success('Campus settings updated successfully.');
        setHeroImageFile(null);
      }
    } catch (error: any) {
      const msg = error?.message || 'Failed to upload campus image';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCampus = async () => {
    if (isSaving) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSaving(true);
    try {
      const createData: {
        name: string;
        slug: string;
        region_id: string;
        hero_image?: string | null;
      } = {
        ...newCampusForm,
      };

      if (newCampusImageFile) {
        const result = await processAndUploadImage(
          newCampusImageFile,
          'listing',
        );
        createData.hero_image = result.url;
      }

      const res = await createCampusAction(createData);
      if (!res.success) {
        setErrorMsg(res.error);
      } else {
        setIsCreatingCampus(false);
        setNewCampusForm({ name: '', slug: '', region_id: '' });
        setNewCampusImageFile(null);
        setSuccessMsg(
          'Campus created successfully. Select it above to configure its settings.',
        );
      }
    } catch (error: any) {
      setErrorMsg(error?.message || 'Failed to upload campus image');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut({ scope: 'local' });
    toast.success('Signed out successfully');
    window.location.href = '/auth/login';
  };

  const handleSaveZone = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    startZoneTransition(async () => {
      if (zoneModal?.id) {
        const res = await updateZoneAction(
          zoneModal.id,
          zoneForm.name,
          zoneForm.full_search_price,
          zoneForm.distance_category,
        );
        if (!res.success) {
          setErrorMsg(res.error);
          return;
        }
        if (res.success && res.data) {
          const updated = res.data;
          setZones((prev) =>
            prev.map((z) => (z.id === updated.id ? updated : z)),
          );
        }
        setZoneModal(null);
        setSuccessMsg('Zone updated successfully.');
      } else {
        const res = await createZoneAction(
          selectedCampusId,
          zoneForm.name,
          zoneForm.full_search_price,
          zoneForm.distance_category,
        );
        if (!res.success) {
          setErrorMsg(res.error);
          return;
        }
        if (res.success && res.data) {
          const created = res.data;
          setZones((prev) => [...prev, created]);
        }
        setZoneModal(null);
        setSuccessMsg('Zone created successfully.');
      }
    });
  };

  const handleDeleteZone = (zoneId: string, zoneName: string) => {
    if (
      !confirm(
        `Delete "${zoneName}"? Zones still in use by hostels cannot be deleted.`,
      )
    ) {
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    startZoneTransition(async () => {
      const res = await deleteZoneAction(zoneId);
      if (!res.success) {
        setErrorMsg(res.error);
        return;
      }
      setZones((prev) => prev.filter((z) => z.id !== zoneId));
      setSuccessMsg('Zone deleted successfully.');
    });
  };

  const openAddZone = () => {
    setZoneModal({ isNew: true });
    setZoneForm({
      name: '',
      full_search_price: 500,
      distance_category: 'walking-500m',
    });
  };

  const openEditZone = (zone: any) => {
    setZoneModal(zone);
    setZoneForm({
      name: zone.name,
      full_search_price: zone.full_search_price,
      distance_category: zone.distance_category || 'walking-500m',
    });
  };

  if (!selectedCampus && campuses.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center text-sm text-slate-500 py-12 border border-dashed border-slate-200 rounded-2xl bg-white">
          No campuses found.
          {isSuperAdmin && (
            <div className="mt-4">
              <button
                onClick={() => setIsCreatingCampus(true)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl flex items-center gap-2 mx-auto"
              >
                <Plus className="w-4 h-4" /> Add Campus
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Campus Context Selector */}
      {(campuses.length > 1 || isSuperAdmin) && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Campus Context
            </label>
            <select
              value={selectedCampusId}
              onChange={(e) => handleCampusChange(e.target.value)}
              className="w-full sm:max-w-md p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 bg-white"
            >
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {isSuperAdmin && (
            <button
              onClick={() => setIsCreatingCampus(true)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl flex items-center gap-2 shrink-0 self-start sm:self-end"
            >
              <Plus className="w-4 h-4" /> Add Campus
            </button>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl">
          {successMsg}
        </div>
      )}

      {/* Notifications */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 mb-1">Notifications</h2>
          <p className="text-sm text-slate-500">
            Get alerted about new agent applications, hostel requests, and system events.
          </p>
        </div>
        <NotificationSettings />
      </div>

      <PushNotificationPrompt />

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: General Info (Admin Restricted) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-500" />
              General Information
            </h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              <Lock className="w-3 h-3 text-slate-400" /> Managed by
              administrator
            </span>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Campus Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                disabled={!isSuperAdmin}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm disabled:bg-slate-50 disabled:text-slate-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                URL Slug
              </label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value })
                }
                disabled={!isSuperAdmin}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm disabled:bg-slate-50 disabled:text-slate-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Assigned Region
              </label>
              <select
                value={formData.region_id}
                onChange={(e) =>
                  setFormData({ ...formData, region_id: e.target.value })
                }
                disabled={!isSuperAdmin}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm disabled:bg-slate-50 disabled:text-slate-500"
              >
                <option value="">No Region</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as any })
                }
                disabled={!isSuperAdmin}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm disabled:bg-slate-50 disabled:text-slate-500 font-medium"
              >
                <option value="active">Active</option>
                <option value="coming_soon">Coming Soon</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Campus Branding (Manager Editable) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Palette className="w-4 h-4 text-emerald-600" />
              Campus Branding
            </h2>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Hero Headline
              </label>
              <input
                type="text"
                value={formData.hero_headline}
                onChange={(e) =>
                  setFormData({ ...formData, hero_headline: e.target.value })
                }
                placeholder="e.g. Student Hostels Near DeKUT, Nyeri"
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Hero Subtext
              </label>
              <textarea
                rows={2}
                value={formData.hero_subtext}
                onChange={(e) =>
                  setFormData({ ...formData, hero_subtext: e.target.value })
                }
                placeholder="Brief description displayed under the hero title..."
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <ImageUpload
                label="Campus Picker Image"
                aspectRatio="16/9"
                currentImageUrl={formData.hero_image}
                onImageChange={(file) => {
                  setHeroImageFile(file);
                  setFormData({
                    ...formData,
                    hero_image: file ? formData.hero_image : null,
                  });
                }}
              />
              <p className="mt-2 text-xs text-slate-500">
                Upload an image used for the campus picker card and homepage
                hero section. This keeps campus branding centralized on one
                campus image field.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Short Name
                </label>
                <input
                  type="text"
                  value={formData.short_name}
                  onChange={(e) =>
                    setFormData({ ...formData, short_name: e.target.value })
                  }
                  placeholder="e.g. DeKUT"
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Primary Color (Hex)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        primary_color: e.target.value,
                      })
                    }
                    className="h-10 w-10 border border-slate-300 rounded-xl cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={formData.primary_color}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        primary_color: e.target.value,
                      })
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Contact Information */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-600" />
              Contact & Support Details
            </h2>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                WhatsApp Number
              </label>
              <input
                type="tel"
                value={formData.whatsapp_number}
                onChange={(e) =>
                  setFormData({ ...formData, whatsapp_number: e.target.value })
                }
                placeholder="e.g. +254114845619"
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Support Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="e.g. +254700000000"
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Support Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="e.g. support@rumia.co.ke"
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Section 4: SEO & Social Metadata */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-600" />
              SEO & Social Sharing Metadata
            </h2>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                SEO Title
              </label>
              <input
                type="text"
                value={formData.seo_title}
                onChange={(e) =>
                  setFormData({ ...formData, seo_title: e.target.value })
                }
                placeholder="e.g. Find Student Hostels Near DeKUT Nyeri"
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                SEO Description
              </label>
              <textarea
                rows={2}
                value={formData.seo_description}
                onChange={(e) =>
                  setFormData({ ...formData, seo_description: e.target.value })
                }
                placeholder="Meta description for search engines..."
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Open Graph Title
              </label>
              <input
                type="text"
                value={formData.og_title}
                onChange={(e) =>
                  setFormData({ ...formData, og_title: e.target.value })
                }
                placeholder="Title when shared on WhatsApp/Facebook..."
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Open Graph Description
              </label>
              <textarea
                rows={2}
                value={formData.og_description}
                onChange={(e) =>
                  setFormData({ ...formData, og_description: e.target.value })
                }
                placeholder="Description when shared on WhatsApp/Facebook..."
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Hostel Areas / Zones (Mandatory) */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                Hostel Areas / Zones
                <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  Required
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                These are the real-world hostel areas around{' '}
                {campuses.find((c) => c.id === selectedCampusId)?.name ||
                  'this campus'}
                . Agents must select one of these when listing a hostel.
              </p>
            </div>
            <button
              onClick={openAddZone}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" /> Add Zone
            </button>
          </div>

          {campusZones.length === 0 ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <div className="flex items-start gap-2 text-sm text-amber-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  No hostel areas configured yet. Add at least one zone to
                  complete campus settings and let agents list hostels.
                </span>
              </div>
              <button
                onClick={openAddZone}
                className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add First Zone
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {campusZones.map((zone) => (
                <div
                  key={zone.id}
                  className="p-4 border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-slate-300 rounded-2xl transition-all flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 text-sm truncate">
                        {zone.name}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
                        Active
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {zone.distance_category
                        ? `Distance: ${zone.distance_category}`
                        : 'Geographical Area'}
                    </div>
                    <div className="text-lg font-extrabold text-slate-900 mt-2">
                      KSh {Number(zone.full_search_price || 0).toLocaleString()}{' '}
                      <span className="text-[11px] font-medium text-slate-500">
                        / tour
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
                    <button
                      onClick={() => openEditZone(zone)}
                      className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteZone(zone.id, zone.name)}
                      disabled={isZonePending}
                      className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Save Button Bar */}
      <div className="flex justify-end pt-4">
        {campusZones.length === 0 && (
          <span className="flex items-center gap-1.5 mr-3 text-xs font-semibold text-amber-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            Add a hostel area to complete campus settings
          </span>
        )}
        <button
          onClick={handleSaveSettings}
          disabled={isSaving || campusZones.length === 0}
          className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Campus Settings
        </button>
      </div>

      {/* Zone Create / Edit Modal */}
      {zoneModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              {zoneModal.isNew ? 'Create Hostel Area' : 'Edit Hostel Area'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Zone / Area Name
                </label>
                <input
                  type="text"
                  value={zoneForm.name}
                  onChange={(e) =>
                    setZoneForm({ ...zoneForm, name: e.target.value })
                  }
                  placeholder="e.g. Near Gate A, Boma, Town Center"
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Distance Category
                </label>
                <select
                  value={zoneForm.distance_category}
                  onChange={(e) =>
                    setZoneForm({
                      ...zoneForm,
                      distance_category: e.target.value,
                    })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
                >
                  {DISTANCE_CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Full Search Tour Price (KSh)
                </label>
                <input
                  type="number"
                  value={zoneForm.full_search_price}
                  onChange={(e) =>
                    setZoneForm({
                      ...zoneForm,
                      full_search_price: Number(e.target.value),
                    })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4">
              <button
                onClick={() => setZoneModal(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveZone}
                disabled={isZonePending || !zoneForm.name.trim()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl disabled:opacity-50 flex items-center gap-2"
              >
                {isZonePending && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Save Zone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Campus Modal (Super Admin) */}
      {isCreatingCampus && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              Create New Campus
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Campus Name
                </label>
                <input
                  type="text"
                  value={newCampusForm.name}
                  onChange={(e) =>
                    setNewCampusForm({ ...newCampusForm, name: e.target.value })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Slug (URL)
                </label>
                <input
                  type="text"
                  value={newCampusForm.slug}
                  onChange={(e) =>
                    setNewCampusForm({
                      ...newCampusForm,
                      slug: e.target.value.toLowerCase(),
                    })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Region
                </label>
                <select
                  value={newCampusForm.region_id}
                  onChange={(e) =>
                    setNewCampusForm({
                      ...newCampusForm,
                      region_id: e.target.value,
                    })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
                >
                  <option value="">Select Region</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <ImageUpload
                label="Campus Picker Image"
                aspectRatio="16/9"
                currentImageUrl={null}
                onImageChange={(file) => {
                  setNewCampusImageFile(file);
                }}
              />
              <p className="mt-2 text-xs text-slate-500">
                Upload a campus image that will show in the campus picker card
                when this campus is created.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-4">
              <button
                onClick={() => setIsCreatingCampus(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCampus}
                disabled={
                  isSaving || !newCampusForm.name || !newCampusForm.slug
                }
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Create Campus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sign Out */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Account Session</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Sign out of your manager account on this device.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={loggingOut}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100/80 text-red-700 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          {loggingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          {loggingOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    </div>
  );
}
