'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import posthog from 'posthog-js';

export function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    try {
      posthog.capture('user_signed_out');
      posthog.reset();
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      toast.success('Logged out successfully');
      router.push('/auth/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to log out');
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleSignOut}
      className="text-slate-400 hover:text-white hover:bg-slate-800"
      title="Sign out"
    >
      <LogOut className="h-5 w-5" />
    </Button>
  );
}
