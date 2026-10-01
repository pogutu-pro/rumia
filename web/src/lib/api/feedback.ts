import { api } from './client';
import { serverApi } from './server';

export type FeedbackCategory = 'suggest_hostel' | 'feature_request' | 'report_problem' | 'general';

export interface Feedback {
  id: string;
  user_id: string;
  category: FeedbackCategory;
  message: string;
  user_email?: string | null;
  user_name?: string | null;
  created_at: string;
}

export interface FeedbackCreate {
  category: FeedbackCategory;
  message: string;
}

export const feedbackApi = {
  submit: (data: FeedbackCreate) => {
    return api.post<{ id: string; message: string }>('/feedback', data);
  },

  submitServer: (data: FeedbackCreate) => {
    return serverApi.post<{ id: string; message: string }>('/feedback', data);
  },

  listServer: (page = 1, limit = 20) => {
    return serverApi.get<{ items: Feedback[]; total: number }>(`/feedback?page=${page}&limit=${limit}`);
  },
};
