import { api } from './api';

export type StudioLocationAccess = {
  locations?: Array<{ id: string; name: string; isDefault?: boolean }>;
  canAccessAll?: boolean;
  activeStudioLocationId?: string | null;
  defaultStudioLocationId?: string | null;
};

export const studioLocationService = {
  getAccess: async (): Promise<StudioLocationAccess> => {
    const res = await api.get('/studio-locations/access');
    return (res.data?.data ?? res.data) as StudioLocationAccess;
  },
};
