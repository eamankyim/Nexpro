import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ToastContainer } from 'react-toastify';
import App from './App';
import { QUERY_CACHE, APP_NAME } from './constants';
import { queryPersister, shouldDehydrateQuery } from './utils/queryPersist';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';

if (typeof window !== 'undefined') {
  window.APP_NAME = APP_NAME;
}

// PWA service worker is registered via registerSW in PWAUpdatePrompt (prompt mode for "New version" UX)

const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000; // 24h for offline use

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: QUERY_CACHE.STALE_TIME_DEFAULT,
      gcTime: Math.max(QUERY_CACHE.CACHE_TIME, PERSIST_MAX_AGE),
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: false,
    },
  },
});

// Note: For optimal performance, use query-specific staleTime:
// - Dashboard data: QUERY_CACHE.STALE_TIME_VOLATILE (30s) - frequently changing
// - Reports: QUERY_CACHE.STALE_TIME_DEFAULT (2min) - moderate change
// - Reference data (categories, dropdowns): QUERY_CACHE.STALE_TIME_STABLE (5min) - rarely changes
// Example: useQuery(['dashboard'], fetchDashboard, { staleTime: QUERY_CACHE.STALE_TIME_VOLATILE })

// PersistQueryClientProvider restores cache from IndexedDB for offline; StrictMode disabled (Radix double-mount).
ReactDOM.createRoot(document.getElementById('root')).render(
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister: queryPersister,
      maxAge: PERSIST_MAX_AGE,
      dehydrateOptions: {
        shouldDehydrateQuery,
      },
    }}
  >
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
  </PersistQueryClientProvider>
);
