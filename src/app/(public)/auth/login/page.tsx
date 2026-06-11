'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { signInWithGoogle, signOut, getSession } from '@/lib/supabase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  KeyRound,
  Mail,
  Loader2,
  User,
  Phone,
  Calendar,
  LogOut,
} from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string | null;
}

export default function LoginPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  // Sign-in form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const supabase = createClient();

  function getNextParam(): string | undefined {
    const params = new URLSearchParams(window.location.search);
    return params.get('next') || undefined;
  }

  useEffect(() => {
    (async () => {
      const { session: s } = await getSession();
      setSession(s);

      if (s?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', s.user.id)
          .single();
        setProfile(data);
      }

      setLoading(false);
    })();
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    const { error } = await signOut();
    if (error) {
      toast.error('Failed to sign out');
    } else {
      setSession(null);
      setProfile(null);
      router.refresh();
    }
    setSigningOut(false);
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSigningIn) return;
    setIsSigningIn(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message === 'Invalid login credentials') {
          const res = await fetch(
            `/api/auth/check-email?email=${encodeURIComponent(email)}`,
          );
          const { exists } = await res.json();

          if (!exists) {
            toast.error(
              'This email is not registered. Sign up with Google above.',
              { duration: 6000 },
            );
          } else {
            toast.error('Wrong password. Please try again.');
          }
        } else {
          toast.error(error.message);
        }
        setIsSigningIn(false);
        return;
      }

      const userId = data.user?.id;
      if (!userId) {
        toast.error('Authentication failed');
        setIsSigningIn(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.role === 'admin') {
        toast.success('Logged in as administrator');
        router.push('/admin');
        router.refresh();
        return;
      }

      const { data: agent } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (agent) {
        toast.success('Welcome back, Agent!');
        router.push('/dashboard');
        router.refresh();
      } else {
        toast.success('Signed in successfully');
        router.push(getNextParam() || '/account');
        router.refresh();
      }
    } catch {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Authenticated: Show profile ─────────────────────────────────────
  if (session) {
    return (
      <div className="min-h-[80vh] bg-slate-50/50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
            <div className="bg-emerald-600 px-8 py-10 text-center">
              <div className="w-20 h-20 rounded-full bg-white/20 mx-auto flex items-center justify-center mb-4">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile?.full_name || 'Profile'}
                    className="w-20 h-20 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-10 w-10 text-white" />
                )}
              </div>
              <h1 className="text-2xl font-bold text-white">
                {profile?.full_name || 'Student'}
              </h1>
              <p className="text-emerald-100 text-sm mt-1">Student Account</p>
            </div>

            <div className="px-8 py-6 space-y-5">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-slate-400" />
                <span className="text-slate-700">
                  {profile?.email || session.user?.email}
                </span>
              </div>

              {profile?.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-700">{profile.phone}</span>
                </div>
              )}

              {profile?.created_at && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-500">
                    Member since{' '}
                    {new Date(profile.created_at).toLocaleDateString('en-KE', {
                      year: 'numeric',
                      month: 'long',
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="text-center">
            <Button
              variant="outline"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex items-center gap-2"
            >
              {signingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Unauthenticated: Show sign-in ────────────────────────────────────
  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-slate-50/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-8 sm:p-10 rounded-3xl border border-slate-100 shadow-xl">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Sign in
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Welcome back, or create an account to get started.
          </p>
        </div>

        {/* Google Sign-In — prominent */}
        <button
          onClick={() => signInWithGoogle(getNextParam() || '/account')}
          className="w-full flex items-center justify-center gap-3 h-13 py-3.5 border-2 border-slate-200 rounded-xl font-semibold text-slate-800 hover:bg-slate-50 hover:border-slate-300 transition-all text-sm"
        >
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span className="bg-white px-4">or</span>
          </div>
        </div>

        {/* Email / Password Form */}
        <form className="space-y-4" onSubmit={handleEmailSignIn}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="pl-10 h-12 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="pl-10 h-12 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 text-sm"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSigningIn}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 border-0"
          >
            {isSigningIn ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-slate-400">
          New here? Sign up with Google. Already have an account? Sign in with
          email above.
        </p>
        <p className="text-center text-xs text-slate-400">
          Agents and administrators use email sign-in.
        </p>
      </div>
    </div>
  );
}
