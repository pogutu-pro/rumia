import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { User, Mail, Phone, Calendar, HeartHandshake, MessageSquareText } from 'lucide-react';
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
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Welcome banner */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-3xl shadow-xl p-8 sm:p-10 text-white">
          <HeartHandshake className="h-10 w-10 text-emerald-100 mb-4" />
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Hey{profile?.full_name ? ` ${profile.full_name.split(' ')[0]}` : ''}, welcome to Rumia
          </h1>
          <p className="mt-3 text-emerald-100 text-base sm:text-lg max-w-xl leading-relaxed">
            Every student deserves a simpler way to find a place to live.
            We just launched and you&apos;re one of our first users — your feedback
            shapes what we build next.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile card — sidebar on desktop */}
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

          {/* Feedback card — main area */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                  <MessageSquareText className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    We&apos;re all ears
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                    Rumia is brand new and we&apos;re building it with students
                    like you. Found a bug? Missing a hostel? Want a feature?
                    Tell us — every message gets read.
                  </p>
                </div>
              </div>
              <FeedbackForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
