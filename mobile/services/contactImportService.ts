import { api } from './api';
import { buildScopedQueryString } from '@/utils/shopScope';

export type ContactImportDestination = 'customers' | 'leads';

export type ContactImportItem = {
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  notes?: string;
  source?: string;
};

export type ContactImportResult = {
  success?: boolean;
  successCount?: number;
  skippedCount?: number;
  errorCount?: number;
  errors?: Array<{ row: number; message: string }>;
  skipped?: Array<{ row: number; message: string }>;
  message?: string;
};

export const contactImportService = {
  importFromContacts: async (
    destination: ContactImportDestination,
    contacts: ContactImportItem[]
  ): Promise<ContactImportResult> => {
    const query = await buildScopedQueryString({});
    const res = await api.post(query ? `/contacts/import?${query}` : '/contacts/import', {
      destination,
      contacts,
    });
    return (res.data as ContactImportResult) ?? res.data;
  },

  importFromFile: async (
    destination: ContactImportDestination,
    file: { uri: string; name: string; mimeType?: string | null }
  ): Promise<ContactImportResult> => {
    const query = await buildScopedQueryString({});
    const path = destination === 'leads' ? '/leads/import' : '/customers/import';
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name || 'contacts.csv',
      type: file.mimeType || 'text/csv',
    } as unknown as Blob);

    const res = await api.post(query ? `${path}?${query}` : path, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return (res.data as ContactImportResult) ?? res.data;
  },
};
