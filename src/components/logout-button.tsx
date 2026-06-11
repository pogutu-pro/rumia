'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  return (
    <button
      onClick={handleSignOut}
      className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors w-full rounded-xl px-3 py-2 hover:bg-red-50"
    >
      <LogOut className="h-4 w-4 shrink-0" />
      Logout
    </button>
  );
}
