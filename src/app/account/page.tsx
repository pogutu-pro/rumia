'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { signInWithGoogle } from '@/lib/supabase/auth';
import { Heart, Loader2 } from 'lucide-react';
import { AccountHeader } from './account-header';
import { AccountTabs, type AccountTab } from './account-tabs';
import { AccountToursTab } from './account-tours-tab';
import { AccountSavedTab } from './account-saved-tab';
import { AccountFeedbackTab } from './account-feedback-tab';

const VALID_TABS = new Set<AccountTab>(['tours', 'saved', 'feedback']);

function getValidTab(value: string | null): AccountTab {
  if (value && VALID_TABS.has(value as AccountTab)) return value as AccountTab;
  return 'tours';
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: string | null;
}

export default function AccountPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = getValidTab(searchParams.get('tab'));

  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasAgent, setHasAgent] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) {
        setLoading(false);
        return;
      }

      const [profileRes, agentRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('agents').select('id').eq('user_id', user.id).maybeSingle(),
      ]);

      if (!cancelled) {
        setProfile({
          ...profileRes.data,
          email: profileRes.data?.email || user.email || '',
        } as Profile);
        setHasAgent(!!agentRes.data);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTabChange = useCallback(
    (tab: AccountTab) => {
      router.replace(`/account?tab=${tab}`, { scroll: false });
    },
    [router],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-8">
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
              <Heart className="h-8 w-8 text-slate-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Sign in to your account
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              View your tours, saved hostels, and manage your profile.
            </p>
          </div>

          <button
            onClick={() => signInWithGoogle('/account')}
            className="w-full flex items-center justify-center gap-3 h-12 border-2 border-slate-200 rounded-xl font-semibold text-slate-800 hover:bg-slate-50 hover:border-slate-300 transition-all text-sm"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <AccountHeader
        fullName={profile.full_name}
        email={profile.email}
        avatarUrl={profile.avatar_url}
        isAdmin={profile.role === 'admin'}
        hasAgent={hasAgent}
      />

      <AccountTabs
        active={activeTab}
        onChange={handleTabChange}
      />

      <div className="max-w-2xl mx-auto px-4 py-5 pb-24">
        {activeTab === 'tours' && <AccountToursTab />}
        {activeTab === 'saved' && <AccountSavedTab />}
        {activeTab === 'feedback' && <AccountFeedbackTab />}
      </div>
    </div>
  );
}
