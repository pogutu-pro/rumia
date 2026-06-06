'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { KeyRound, Mail, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
        setIsLoading(false);
        return;
      }

      const userId = data.user?.id;

      if (!userId) {
        toast.error('Authentication failed');
        setIsLoading(false);
        return;
      }

      // Check if user is Paul the admin (paul@rumia.co.ke or admin role)
      if (email.toLowerCase().includes('admin') || email.toLowerCase() === 'paul@rumia.co.ke') {
        toast.success('Logged in as administrator');
        // Set cookies/session if needed (Supabase browser client handles this automatically)
        router.push('/admin');
        router.refresh();
        return;
      }

      // Check if user is an agent in the agents table
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
        // Fallback for new agents or admin
        toast.success('Sign in successful');
        router.push('/dashboard');
        router.refresh();
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-slate-50/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-3xl border border-slate-100 shadow-xl">
        <div className="text-center">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Agent & Admin Portal</h2>
          <p className="mt-2 text-sm text-slate-500 font-medium">
            Sign in to manage listings, track leads, and view commissions.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-5" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@rumia.co.ke"
                  className="pl-11 h-12 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 text-sm font-medium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-5" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-11 h-12 bg-slate-50 border-slate-200/80 focus-visible:ring-emerald-500 text-sm font-medium"
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all duration-300 shadow-md shadow-emerald-600/10 flex items-center justify-center gap-2 border-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
