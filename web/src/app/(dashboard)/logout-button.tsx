'use client';

import { createClient } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import posthog from 'posthog-js';

export function LogoutButton() {
  const router = useRouter();
  const authClient = createClient();

  const handleSignOut = async () => {
    try {
      posthog.capture('user_signed_out');
      posthog.reset();
      const { error } = await authClient.auth.signOut({ scope: 'local' });
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
      className="text-ink-muted hover:text-white hover:bg-slate-800"
      title="Sign out"
    >
      <LogOut className="h-5 w-5" />
    </Button>
  );
}
