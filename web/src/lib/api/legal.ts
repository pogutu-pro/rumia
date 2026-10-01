import { api } from './client';
import { serverApi } from './server';

export interface LegalDocumentData {
  id: string;
  type: string;
  content: string;
  draft_content?: string | null;
  status: string;
  effective_date?: string | null;
  published_at?: string | null;
  updated_at: string;
  updated_by?: string | null;
  updater_email?: string | null;
  created_at?: string;
}

export const legalApi = {
  getTerms: () => {
    return api.get<LegalDocumentData>('/legal/terms');
  },

  getTermsServer: () => {
    return serverApi.get<LegalDocumentData>('/legal/terms');
  },

  getPrivacy: () => {
    return api.get<LegalDocumentData>('/legal/privacy');
  },

  getPrivacyServer: () => {
    return serverApi.get<LegalDocumentData>('/legal/privacy');
  },

  getAdminDocsServer: () => {
    return serverApi.get<LegalDocumentData[]>('/legal/admin');
  },

  saveDraftServer: (docType: string, draftContent: string) => {
    return serverApi.patch<LegalDocumentData>(`/legal/${docType}/draft`, { draft_content: draftContent });
  },

  publishServer: (docType: string) => {
    return serverApi.post<LegalDocumentData>(`/legal/${docType}/publish`);
  },
};
