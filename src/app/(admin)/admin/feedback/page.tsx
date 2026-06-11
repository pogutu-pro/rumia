import { createClient } from '@/lib/supabase/server';
import { FeedbackTableClient } from './feedback-table-client';

export const dynamic = 'force-dynamic';

export default async function FeedbackPage() {
  const supabase = await createClient();

  const { data: feedbackRaw } = await (supabase as any)
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false });

  const feedback = (feedbackRaw ?? []).map((f: any) => ({
    id: f.id,
    user_id: f.user_id,
    user_email: f.user_email ?? null,
    user_name: f.user_name ?? null,
    category: f.category,
    message: f.message,
    created_at: f.created_at,
  }));

  return <FeedbackTableClient feedback={feedback} />;
}
