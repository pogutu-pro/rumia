'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { WishlistNotificationPreferences } from '@/components/settings/WishlistNotificationPreferences';
import { createClient } from '@/lib/supabase/client';
import { saveProfileCompletionAction } from '@/app/actions/profile';
import { User, Phone, Mail, GraduationCap, Loader2, Check, LogOut, AlertTriangle, X, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface AccountSettingsTabProps {
  profile: {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    home_campus_id?: string | null;
    home_campus_name?: string | null;
  };
  campuses?: Array<{ id: string; name: string }>;
  onProfileUpdate: (updated: {
    full_name: string;
    phone: string;
    home_campus_id?: string | null;
    home_campus_name?: string | null;
    home_campus_confirmed_at?: string | null;
  }) => void;
  onBackToOverview?: () => void;
}

export function AccountSettingsTab({
  profile,
  campuses = [],
  onProfileUpdate,
  onBackToOverview,
}: AccountSettingsTabProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [campusInput, setCampusInput] = useState<string>(() => {
    if (profile.home_campus_name) return profile.home_campus_name;
    if (profile.home_campus_id) {
      const matched = campuses.find((c) => c.id === profile.home_campus_id);
      if (matched) return matched.name;
    }
    return '';
  });
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sign out confirmation modal state
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) return;

    const campusValue = campusInput.trim();
    setSaving(true);
    const result = await saveProfileCompletionAction({
      full_name: fullName.trim(),
      phone: phone.trim(),
      campus_input: campusValue || undefined,
    });

    setSaving(false);
    if (result.success) {
      setSavedSuccess(true);
      onProfileUpdate({
        full_name: result.updated.full_name ?? fullName.trim(),
        phone: result.updated.phone ?? phone.trim(),
        ...(result.updated.home_campus_id !== undefined
          ? { home_campus_id: result.updated.home_campus_id }
          : {}),
        ...(result.updated.home_campus_name !== undefined
          ? { home_campus_name: result.updated.home_campus_name }
          : {}),
        ...(result.updated.home_campus_confirmed_at !== undefined
          ? { home_campus_confirmed_at: result.updated.home_campus_confirmed_at }
          : {}),
      });
      toast.success('Account profile updated');
      setTimeout(() => setSavedSuccess(false), 3000);
    } else {
      toast.error(result.error || 'Failed to update profile');
    }
  };

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut({ scope: 'local' });
    toast.success('Signed out successfully');
    router.push('/');
    router.refresh();
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Back to Overview Header */}
      <div className="flex items-center justify-between">
        {onBackToOverview ? (
          <button
            onClick={onBackToOverview}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Overview
          </button>
        ) : (
          <Link
            href="/account?tab=overview"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Overview
          </Link>
        )}
      </div>

      {/* 1. Account Profile Details */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-5">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Personal Information</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Update your contact details and home university for hostel tour bookings.
          </p>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0712 345 678"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">University / Campus</label>
            <div className="relative">
              <GraduationCap className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                list="settings-campus-list"
                value={campusInput}
                onChange={(e) => setCampusInput(e.target.value)}
                placeholder="Start typing or choose from the list"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
              <datalist id="settings-campus-list">
                {campuses.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Your home university, used to tailor listings and tours.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : savedSuccess ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : null}
              {saving ? 'Saving...' : savedSuccess ? 'Saved' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* 2. Notifications Preferences */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Notifications & Alerts</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage alerts for tour updates and price drops on hostels in your wishlist.
          </p>
        </div>

        <NotificationSettings />

        <WishlistNotificationPreferences email={profile.email} />
      </div>

      {/* 3. Log Out Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Account Session</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Sign out of your account on this device.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowLogoutModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100/80 text-red-700 text-xs font-semibold transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Log Out of Rumia
        </button>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <button
                onClick={() => setShowLogoutModal(false)}
                disabled={loggingOut}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900">Leave Rumia?</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to log out of your account? You will need to sign in again to access your wishlist and tour bookings.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowLogoutModal(false)}
                disabled={loggingOut}
                className="flex-1 h-9 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLogout}
                disabled={loggingOut}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition-colors disabled:opacity-50"
              >
                {loggingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {loggingOut ? 'Logging out...' : 'Log Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
