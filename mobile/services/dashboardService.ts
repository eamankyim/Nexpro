import { api } from './api';

export const dashboardService = {
  getOverview: async (
    startDate?: string | null,
    endDate?: string | null,
    filterType?: string | null
  ) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (filterType) params.append('filterType', filterType);
    const query = params.toString();
    const res = await api.get(query ? `/dashboard/overview?${query}` : '/dashboard/overview');
    // Backend returns: { success: true, data: {...} }
    // Mobile api returns full axios response, so res.data = { success: true, data: {...} }
    return res.data;
  },

  getJobStatusDistribution: async () => {
    const res = await api.get('/dashboard/job-status-distribution');
    return res.data;
  },
};
