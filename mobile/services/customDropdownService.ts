import { api } from './api';

export type CustomDropdownOption = {
  value: string;
  label?: string;
};

export const customDropdownService = {
  getCustomOptions: async (dropdownType: string): Promise<CustomDropdownOption[]> => {
    const res = await api.get(`/custom-dropdowns/${dropdownType}`);
    const data = res.data?.data ?? res.data;
    return Array.isArray(data) ? data : [];
  },

  saveCustomOption: async (dropdownType: string, value: string, label?: string): Promise<CustomDropdownOption | null> => {
    const res = await api.post('/custom-dropdowns', {
      dropdownType,
      value,
      label: label || value,
    });
    return res.data?.data ?? res.data ?? null;
  },
};
