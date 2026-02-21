import api from './api';

const tourService = {
  /**
   * Get tour completion status for current user/tenant
   * @returns {Promise<Object>} Tour status data
   */
  getTourStatus: async () => {
    const response = await api.get('/tours/status');
    return response?.data || response;
  },

  /**
   * Mark a tour as completed
   * @param {string} tourId - Tour identifier
   * @param {string} [version] - Optional tour version
   * @returns {Promise<Object>} Updated tour status
   */
  completeTour: async (tourId, version = null) => {
    const response = await api.post('/tours/complete', {
      tourId,
      ...(version && { version })
    });
    return response?.data || response;
  },

  /**
   * Reset a tour (mark as not completed)
   * @param {string} tourId - Tour identifier
   * @returns {Promise<Object>} Updated tour status
   */
  resetTour: async (tourId) => {
    const response = await api.post('/tours/reset', { tourId });
    return response?.data || response;
  }
};

export default tourService;
