import api from './api';

/**
 * Normalize custom-dropdown API payloads.
 * `api` already unwraps axios `response.data`, so bodies look like `{ success, data }`.
 * @param {*} response
 * @param {*} fallback
 * @returns {*}
 */
const unwrapData = (response, fallback) => {
  if (response == null) return fallback;
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (response.data != null && typeof response.data === 'object' && !Array.isArray(response.data)) {
    // save / batch: data is an object
    return response.data;
  }
  if (response.data != null) return response.data;
  return fallback;
};

const getCustomOptions = async (dropdownType) => {
  try {
    const response = await api.get(`/custom-dropdowns/${dropdownType}`);
    const options = unwrapData(response, []);
    return Array.isArray(options) ? options : [];
  } catch (error) {
    console.error(`[CustomDropdown] Error fetching ${dropdownType}:`, error);
    return [];
  }
};

const saveCustomOption = async (dropdownType, value, label) => {
  try {
    const trimmed = String(value || '').trim();
    if (!trimmed) return null;

    const response = await api.post('/custom-dropdowns', {
      dropdownType,
      value: trimmed,
      label: (label && String(label).trim()) || trimmed,
    });
    const result = unwrapData(response, null);
    if (result && (result.value || result.label)) {
      return result;
    }
    console.warn('[CustomDropdown] Unexpected response structure:', response);
    return null;
  } catch (error) {
    console.error(`[CustomDropdown] Error saving ${dropdownType}:`, error);
    throw error;
  }
};

const getBatchCustomOptions = async (dropdownTypes) => {
  try {
    const response = await api.post('/custom-dropdowns/batch', {
      dropdownTypes
    });
    const grouped = unwrapData(response, {});
    return grouped && typeof grouped === 'object' && !Array.isArray(grouped) ? grouped : {};
  } catch (error) {
    console.error('[CustomDropdown] Error fetching batch:', error);
    return {};
  }
};

export default {
  getCustomOptions,
  saveCustomOption,
  getBatchCustomOptions
};
