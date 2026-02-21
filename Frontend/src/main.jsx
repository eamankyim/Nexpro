import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
import App from './App';
import { QUERY_CACHE } from './constants';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';

// Register service worker only in production (avoids caching/HMR issues in dev)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registered:', registration.scope);
        setInterval(() => registration.update(), 60 * 60 * 1000);
      })
      .catch((err) => console.error('[PWA] Service Worker registration failed:', err));
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: QUERY_CACHE.STALE_TIME_DEFAULT, // 2 minutes default (can be overridden per query)
      gcTime: QUERY_CACHE.CACHE_TIME, // 10 minutes (formerly cacheTime)
      retry: 1, // Reduce retries for faster failure feedback
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
    mutations: {
      retry: false, // Don't retry mutations
    },
  },
});

// Note: For optimal performance, use query-specific staleTime:
// - Dashboard data: QUERY_CACHE.STALE_TIME_VOLATILE (30s) - frequently changing
// - Reports: QUERY_CACHE.STALE_TIME_DEFAULT (2min) - moderate change
// - Reference data (categories, dropdowns): QUERY_CACHE.STALE_TIME_STABLE (5min) - rarely changes
// Example: useQuery(['dashboard'], fetchDashboard, { staleTime: QUERY_CACHE.STALE_TIME_VOLATILE })

// StrictMode disabled: React 18 double-mount breaks Radix Select/DropdownMenu/Popover (open state resets, so dropdowns appear not to open). Re-enable when Radix or React addresses this.
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
