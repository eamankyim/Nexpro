import { message } from 'antd';

/**
 * Extracts a clear, user-friendly error message from an error object
 * @param {Error|Object} error - The error object from API or catch block
 * @param {string} defaultMessage - Default message if error extraction fails
 * @returns {string} - Clear error message for the user
 */
export const getErrorMessage = (error, defaultMessage = 'An error occurred. Please try again.') => {
  // If error is already a string, return it
  if (typeof error === 'string') {
    return error;
  }

  // Check for API response error (axios error structure)
  if (error?.response?.data) {
    const data = error.response.data;
    
    // Check for message in different possible locations
    if (data.message) {
      return data.message;
    }
    
    if (data.error) {
      return data.error;
    }
    
    // Check for validation errors
    if (data.errors && Array.isArray(data.errors)) {
      return data.errors.join(', ');
    }
    
    // Check for Sequelize validation errors
    if (data.errors && typeof data.errors === 'object') {
      const errorMessages = Object.values(data.errors)
        .map(err => (typeof err === 'string' ? err : err.message || err))
        .filter(Boolean);
      if (errorMessages.length > 0) {
        return errorMessages.join(', ');
      }
    }
    
    // Check for success: false with error message
    if (data.success === false && data.error) {
      return data.error;
    }
  }

  // Check for error message directly
  if (error?.message) {
    // Don't show technical error messages to users
    const technicalErrors = ['Network Error', 'Request failed', 'timeout'];
    if (technicalErrors.some(te => error.message.includes(te))) {
      return 'Unable to connect to server. Please check your internet connection and try again.';
    }
    return error.message;
  }

  // Check for error.error (some APIs use this)
  if (error?.error) {
    return error.error;
  }

  // Check for network errors
  if (error?.code === 'NETWORK_ERROR' || error?.message === 'Network Error') {
    return 'Unable to connect to server. Please check your internet connection.';
  }

  // Check for timeout errors
  if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  // Return default message
  return defaultMessage;
};

/**
 * Shows a success toast message
 * @param {string} msg - Success message
 * @param {number} duration - Duration in seconds (default: 3)
 */
export const showSuccess = (msg, duration = 3) => {
  message.success(msg, duration);
};

/**
 * Shows an error toast message with clear error extraction
 * @param {Error|string} error - Error object or error message
 * @param {string} defaultMessage - Default message if error extraction fails
 * @param {number} duration - Duration in seconds (default: 5)
 */
export const showError = (error, defaultMessage = 'An error occurred. Please try again.', duration = 5) => {
  const errorMessage = getErrorMessage(error, defaultMessage);
  message.error(errorMessage, duration);
};

/**
 * Shows a warning toast message
 * @param {string} msg - Warning message
 * @param {number} duration - Duration in seconds (default: 4)
 */
export const showWarning = (msg, duration = 4) => {
  message.warning(msg, duration);
};

/**
 * Shows an info toast message
 * @param {string} msg - Info message
 * @param {number} duration - Duration in seconds (default: 3)
 */
export const showInfo = (msg, duration = 3) => {
  message.info(msg, duration);
};

/**
 * Shows a loading toast message
 * @param {string} msg - Loading message
 * @param {number} duration - Duration in seconds (default: 0 = infinite)
 * @returns {Function} - Function to hide the loading message
 */
export const showLoading = (msg = 'Loading...', duration = 0) => {
  return message.loading(msg, duration);
};

/**
 * Handles API errors with appropriate user-friendly messages
 * @param {Error} error - The error from API call
 * @param {Object} options - Options for error handling
 * @param {string} options.defaultMessage - Default error message
 * @param {string} options.context - Context of the error (e.g., 'creating user', 'fetching data')
 * @param {boolean} options.logError - Whether to log error to console (default: true)
 */
export const handleApiError = (error, options = {}) => {
  const { defaultMessage, context, logError = true } = options;
  
  // Log error for debugging
  if (logError) {
    console.error('API Error:', error);
  }

  // Build context-aware default message
  let message = defaultMessage;
  if (context && !defaultMessage) {
    message = `Failed to ${context}. Please try again.`;
  } else if (!defaultMessage) {
    message = 'An error occurred. Please try again.';
  }

  // Show error toast
  showError(error, message);
};

export default {
  success: showSuccess,
  error: showError,
  warning: showWarning,
  info: showInfo,
  loading: showLoading,
  handleApiError,
  getErrorMessage,
};





