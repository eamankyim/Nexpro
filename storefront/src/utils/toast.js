import { toast } from 'react-toastify';

export const showSuccess = (msg, duration = 3) => {
  toast.success(msg, {
    autoClose: duration > 0 ? duration * 1000 : 5000,
    hideProgressBar: false,
    closeButton: true,
  });
};

export const showError = (error, defaultMessage = 'Something went wrong. Please try again.', duration = 5) => {
  const message = typeof error === 'string'
    ? error
    : error?.response?.data?.message || error?.response?.data?.error || error?.message || defaultMessage;
  toast.error(message, {
    autoClose: duration > 0 ? duration * 1000 : 5000,
    hideProgressBar: false,
    closeButton: true,
  });
};
