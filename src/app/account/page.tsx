import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { User, Mail, Phone, Calendar } from 'lucide-react';
import { FeedbackForm } from '@/components/feedback/feedback-form';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string | null;
}

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Compact welcome */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Hey{profile?.full_name ? ` ${profile.full_name.split(' ')[0]}` : ''} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            You&apos;re an early user of Rumia — your feedback directly shapes what we build. What&apos;s on your mind?
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Feedback form — hero */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-900">
                  Share your feedback
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  All fields optional — just tell us what you think.
                </p>
              </div>
              <FeedbackForm />
            </div>
          </div>

          {/* Profile card — sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="bg-emerald-600 px-6 py-8 text-center">
                <div className="w-16 h-16 rounded-full bg-white/20 mx-auto flex items-center justify-center mb-3">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile?.full_name || 'Profile'}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-8 w-8 text-white" />
                  )}
                </div>
                <h2 className="text-lg font-bold text-white">
                  {profile?.full_name || 'Student'}
                </h2>
                <p className="text-emerald-100 text-xs mt-0.5">Student Account</p>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="text-slate-600 truncate">
                    {profile?.email || user.email}
                  </span>
                </div>

                {profile?.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="text-slate-600">{profile.phone}</span>
                  </div>
                )}

                {profile?.created_at && (
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="text-slate-500">
                      Joined{' '}
                      {new Date(profile.created_at).toLocaleDateString('en-KE', {
                        year: 'numeric',
                        month: 'long',
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
