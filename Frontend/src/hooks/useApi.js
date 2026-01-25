import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Custom hook wrapper for React Query
 * Provides a consistent API for data fetching and mutations
 * 
 * @param {Object} options - Query options
 * @param {string|Array} options.queryKey - Query key
 * @param {Function} options.queryFn - Query function
 * @param {Object} options.options - Additional React Query options
 * @returns {Object} - React Query result
 * 
 * @example
 * const { data, isLoading, error } = useApi({
 *   queryKey: ['customers'],
 *   queryFn: () => customerService.getAll(),
 *   options: { enabled: !!tenantId }
 * });
 */
export const useApi = ({ queryKey, queryFn, options = {} }) => {
  return useQuery({
    queryKey,
    queryFn,
    ...options,
  });
};

/**
 * Custom hook for API mutations
 * 
 * @param {Object} options - Mutation options
 * @param {Function} options.mutationFn - Mutation function
 * @param {Object} options.options - Additional React Query mutation options
 * @returns {Object} - React Query mutation result
 * 
 * @example
 * const mutation = useApiMutation({
 *   mutationFn: (data) => customerService.create(data),
 *   options: {
 *     onSuccess: () => {
 *       queryClient.invalidateQueries(['customers']);
 *     }
 *   }
 * });
 */
export const useApiMutation = ({ mutationFn, options = {} }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    ...options,
  });
};

/**
 * Hook to invalidate queries
 * 
 * @returns {Function} - Function to invalidate queries
 */
export const useInvalidateQueries = () => {
  const queryClient = useQueryClient();

  return useCallback((queryKey) => {
    queryClient.invalidateQueries(queryKey);
  }, [queryClient]);
};

export default useApi;
