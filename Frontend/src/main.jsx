import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
import App from './App';
import { QUERY_CACHE, APP_NAME } from './constants';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';

if (typeof window !== 'undefined') {
  window.APP_NAME = APP_NAME;
}

// PWA service worker is registered via PWAUpdatePrompt (prod only)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: QUERY_CACHE.STALE_TIME_DEFAULT,
      gcTime: QUERY_CACHE.CACHE_TIME,
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <App />
    <ToastContainer
      position="bottom-right"
      autoClose={5000}
      hideProgressBar={false}
      closeButton
      newestOnTop
      pauseOnHover
      theme="light"
      limit={4}
    />
  </QueryClientProvider>
);
