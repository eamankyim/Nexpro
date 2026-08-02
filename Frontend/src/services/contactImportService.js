import api from './api';
import { buildScopedQueryString } from '../utils/shopScope';

/**
 * Shared contact import (Customers or Leads) — file templates + JSON phone contacts.
 */
const contactImportService = {
  /**
   * Download CSV template for destination.
   * @param {'customers'|'leads'} destination
   * @returns {Promise<Blob>}
   */
  getImportTemplate: async (destination) => {
    const path = destination === 'leads' ? '/leads/import/template' : '/customers/import/template';
    const response = await api.get(path, { responseType: 'blob' });
    return response.data;
  },

  /**
   * Import contacts from CSV/Excel file into destination.
   * @param {'customers'|'leads'} destination
   * @param {File} file
   */
  importFromFile: async (destination, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const query = buildScopedQueryString();
    const path = destination === 'leads' ? '/leads/import' : '/customers/import';
    const response = await api.post(`${path}${query ? `?${query}` : ''}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response?.data ?? response;
  },

  /**
   * Import contacts from device/phone picker JSON payload.
   * @param {{ destination: 'customers'|'leads', contacts: Array<object> }} payload
   */
  importFromContacts: async (payload) => {
    const query = buildScopedQueryString();
    const response = await api.post(`/contacts/import${query ? `?${query}` : ''}`, payload);
    return response?.data ?? response;
  },
};

export default contactImportService;
