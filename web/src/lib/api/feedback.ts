import { api } from './client';
import { serverApi } from './server';

export interface Feedback {
  id: string;
  listing_id?: string | null;
  content: string;
  user_email?: string | null;
  user_id?: string | null;
  created_at: string;
}

export interface FeedbackCreate {
  listing_id?: string | null;
  content: string;
  user_email?: string | null;
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
