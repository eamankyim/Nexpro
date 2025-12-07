import api from './api';

const getCustomOptions = async (dropdownType) => {
  try {
    const response = await api.get(`/custom-dropdowns/${dropdownType}`);
    return response.data?.data || [];
  } catch (error) {
    console.error(`[CustomDropdown] Error fetching ${dropdownType}:`, error);
    return [];
  }
};

const saveCustomOption = async (dropdownType, value, label) => {
  try {
    const response = await api.post('/custom-dropdowns', {
      dropdownType,
      value,
      label
    });
    // Handle both response structures: { success: true, data: {...} } or direct { value, label }
    const result = response.data?.data || response.data;
    if (result && (result.value || result.label)) {
      return result;
    }
    console.warn('[CustomDropdown] Unexpected response structure:', response.data);
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
    return response.data?.data || {};
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

