import { api } from './api';
import { buildScopedQueryString } from '@/utils/shopScope';

export const dashboardService = {
  getOverview: async (
    startDate?: string | null,
    endDate?: string | null,
    filterType?: string | null
  ) => {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (filterType) params.filterType = filterType;
    const query = await buildScopedQueryString(params);
    const res = await api.get(query ? `/dashboard/overview?${query}` : '/dashboard/overview');
    return res.data;
  },

  getJobStatusDistribution: async () => {
    const query = await buildScopedQueryString({});
    const res = await api.get(query ? `/dashboard/job-status-distribution?${query}` : '/dashboard/job-status-distribution');
    return res.data;
  },
};
