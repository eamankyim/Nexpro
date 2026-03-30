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
  const { user, activeTenantId } = useAuth();
  const queryClient = useQueryClient();
  const [runningTour, setRunningTour] = useState(null);
  const [tourStepIndex, setTourStepIndex] = useState(0);

  // Only fetch tour status when user is authenticated (avoids 401 loop when token expired)
  const isAuthenticated = !!user && !!activeTenantId;
  const { data: tourStatusData, isLoading: loadingTourStatus } = useQuery({
    queryKey: ['tours', 'status', activeTenantId],
    queryFn: () => tourService.getTourStatus(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // avoid 401 retries that can cause redirect/reload loops
    select: (data) => data?.data?.tours || {}
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tours', 'status', activeTenantId] });
    }
  });

  // Reset tour mutation
  const resetTourMutation = useMutation({
    mutationFn: (tourId) => tourService.resetTour(tourId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tours', 'status', activeTenantId] });
    }
  });

  /**
   * Check if a tour has been completed
   * @param {string} tourId - Tour identifier
   * @returns {boolean} True if tour is completed
   */
  const isTourCompleted = useCallback((tourId) => {
    if (!tourStatusData || !tourId) return false;
    return tourStatusData[tourId]?.completed === true;
  }, [tourStatusData]);

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
  const completeTour = useCallback(async (tourId, version = '1.0.0') => {
    try {
      await completeTourMutation.mutateAsync({ tourId, version });
      stopTour();
    } catch (error) {
      console.error('Failed to complete tour:', error);
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
