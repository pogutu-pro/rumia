import { serverApi } from './server';

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export const notificationsApi = {
  /** Server-only: save (or take over) a Web Push subscription for the signed-in user. */
  subscribePushServer: (data: PushSubscriptionInput) =>
    serverApi.post<{ id: string; message: string }>('/notifications/push/subscribe', data),

  /** Server-only: remove one of the signed-in user's Web Push subscriptions. */
  unsubscribePushServer: (endpoint: string) =>
    serverApi.delete<{ message: string }>('/notifications/push/unsubscribe', {
      body: JSON.stringify({ endpoint }),
    }),
};
