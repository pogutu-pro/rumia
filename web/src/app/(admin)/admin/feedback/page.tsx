import { FeedbackTableClient } from './feedback-table-client';
import { feedbackApi } from '@/lib/api/feedback';

export const dynamic = 'force-dynamic';

export default async function FeedbackPage() {
  const { items } = await feedbackApi
    .listServer(1, 200)
    .catch(() => ({ items: [] as Awaited<ReturnType<typeof feedbackApi.listServer>>['items'] }));
  const feedback = items.map((f) => ({
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
