'use server';

import { feedbackApi } from '@/lib/api/feedback';

type ActionResult = { success: true } | { success: false; error: string };

export async function submitFeedbackAction(
  category: string,
  message: string,
): Promise<ActionResult> {
  try {
    await feedbackApi.submitServer({
      content: `[Category: ${category}] ${message}`,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || err.data?.detail || 'Failed to submit feedback.' };
  }
}
