import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import tourService from '../services/tourService';
import { TOUR_IDS } from '../config/tours';

/**
 * Internal hook that owns the actual tour state and server interaction.
 * This will be used inside a React context provider so multiple components
 * (button, provider) share the same running tour state.
 */
export const useTourInternal = () => {
  const { user, activeTenantId, isSupportAccessActive } = useAuth();
  const queryClient = useQueryClient();
  const [runningTour, setRunningTour] = useState(null);
  const [tourStepIndex, setTourStepIndex] = useState(0);

  // Only fetch tour status when user is authenticated (avoids 401 loop when token expired).
  // Skip during platform-admin support access — no UserTenant membership for tours.
  const isAuthenticated = !!user && !!activeTenantId;
  const tourStatusQueryKey = ['tours', 'status', activeTenantId];
  const {
    data: tourStatusData,
    isLoading: loadingTourStatus,
    isSuccess: tourStatusLoaded,
  } = useQuery({
    queryKey: tourStatusQueryKey,
    queryFn: () => tourService.getTourStatus(),
    enabled: isAuthenticated && !isSupportAccessActive,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // avoid 401 retries that can cause redirect/reload loops
    select: (data) => data?.data?.tours || {}
  });

  /** False while status is still loading — avoids treating "unknown" as "not completed". */
  const isTourStatusReady = isAuthenticated && tourStatusLoaded;

  // Debug: log tour status and running tour state
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log('[useTour] status fetched:', {
      hasData: !!tourStatusData,
      keys: tourStatusData ? Object.keys(tourStatusData) : [],
      activeTenantId,
    });
  }, [tourStatusData, activeTenantId]);

  // Complete tour mutation
  const completeTourMutation = useMutation({
    mutationFn: ({ tourId, version }) => tourService.completeTour(tourId, version),
    onMutate: async ({ tourId, version, persistOnError }) => {
      await queryClient.cancelQueries({ queryKey: tourStatusQueryKey });
      const previous = queryClient.getQueryData(tourStatusQueryKey);
      queryClient.setQueryData(tourStatusQueryKey, (old) => {
        if (!old) return old;
        const tours = old?.data?.tours || {};
        return {
          ...old,
          data: {
            ...old.data,
            tours: {
              ...tours,
              [tourId]: {
                completed: true,
                completedAt: new Date().toISOString(),
                ...(version && { version }),
              },
            },
          },
        };
      });
      return { previous, persistOnError: !!persistOnError };
    },
    onError: (_err, _vars, context) => {
      if (context?.persistOnError) return;
      if (context?.previous) {
        queryClient.setQueryData(tourStatusQueryKey, context.previous);
      }
    },
    onSettled: (_data, _error, _vars, context) => {
      if (context?.persistOnError && _error) return;
      queryClient.invalidateQueries({ queryKey: tourStatusQueryKey });
    },
  });

  // Reset tour mutation
  const resetTourMutation = useMutation({
    mutationFn: (tourId) => tourService.resetTour(tourId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tourStatusQueryKey });
    },
  });

  /**
   * Check if a tour has been completed.
   * Returns false when status is not yet loaded (use isTourStatusReady to gate UI/effects).
   * @param {string} tourId - Tour identifier
   * @returns {boolean} True if tour is completed
   */
  const isTourCompleted = useCallback((tourId) => {
    if (!isTourStatusReady || !tourStatusData || !tourId) return false;
    return tourStatusData[tourId]?.completed === true;
  }, [tourStatusData, isTourStatusReady]);

  /**
   * Start a tour
   * @param {string} tourId - Tour identifier
   */
  const startTour = useCallback((tourId) => {
    if (import.meta.env.DEV) {
      console.log('[useTour] startTour called', { tourId });
    }
    setRunningTour(tourId);
    setTourStepIndex(0);
  }, []);

  /**
   * Stop the current tour
   */
  const stopTour = useCallback(() => {
    setRunningTour(null);
    setTourStepIndex(0);
  }, []);

  /**
   * Skip the current tour
   */
  const skipTour = useCallback(() => {
    stopTour();
  }, [stopTour]);

  /**
   * Complete a tour
   * @param {string} tourId - Tour identifier
   * @param {string} [version] - Optional tour version
   */
  const completeTour = useCallback(async (tourId, version = '1.0.0', options = {}) => {
    const { persistOnError = false } = options;
    try {
      await completeTourMutation.mutateAsync({ tourId, version, persistOnError });
      stopTour();
    } catch (error) {
      if (!persistOnError) {
        console.error('Failed to complete tour:', error);
      } else if (import.meta.env.DEV) {
        console.warn('[useTour] Silent tour complete failed (will not retry):', error?.response?.status || error?.message);
      }
    }
  }, [completeTourMutation, stopTour]);

  /**
   * Reset a completed tour
   * @param {string} tourId - Tour identifier
   */
  const resetTour = useCallback(async (tourId) => {
    try {
      await resetTourMutation.mutateAsync(tourId);
    } catch (error) {
      console.error('Failed to reset tour:', error);
    }
  }, [resetTourMutation]);

  /**
   * Get tour completion date
   * @param {string} tourId - Tour identifier
   * @returns {string|null} Completion date or null
   */
  const getTourCompletionDate = useCallback((tourId) => {
    if (!tourStatusData || !tourId) return null;
    return tourStatusData[tourId]?.completedAt || null;
  }, [tourStatusData]);

  return {
    // State
    runningTour,
    tourStepIndex,
    setTourStepIndex,
    loadingTourStatus,
    isTourStatusReady,
    tourStatus: tourStatusData || {},

    // Actions
    startTour,
    stopTour,
    skipTour,
    completeTour,
    resetTour,
    isTourCompleted,
    getTourCompletionDate
  };
};

// Context to share tour state across the app
export const TourContext = createContext(null);

/**
 * Public hook for consuming tour state.
 * Must be used within <TourProviderState>.
 */
export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourContext provider');
  }
  return context;
};

export default useTour;
