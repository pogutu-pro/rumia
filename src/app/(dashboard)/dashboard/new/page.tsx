import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NewListingForm } from './new-listing-form';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0;

export default async function NewListingPage() {
  const supabase = await createClient();

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth/login');
  }

  // Find agent profile
  let { data: agent } = await supabase
    .from('agents')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  // If no agent, fall back or redirect
  if (!agent) {
    redirect('/dashboard');
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back Link */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Create New Listing
        </h1>
        <p className="text-slate-500 font-medium mt-1">
          Add a new campus room or hostel to the marketplace.
        </p>
      </div>

      {/* Form Component */}
      <NewListingForm agentId={agent.id} />
    </div>
  );
}
