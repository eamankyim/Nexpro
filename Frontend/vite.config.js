import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const projectRoot = path.resolve(__dirname);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.join(projectRoot, 'src'),
      // Force a single React instance (fixes "useState of null" / invalid hook in lazy chunks)
      'react': path.join(projectRoot, 'node_modules/react'),
      'react-dom': path.join(projectRoot, 'node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
  server: {
    port: 3000,
    host: true, // Listen on 0.0.0.0 so you can test on phone via LAN IP
    hmr: false, // Disable HMR to avoid WebSocket errors; full reload still works
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // UI libraries (Radix UI only - antd removed)
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-label',
            '@radix-ui/react-popover',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
          ],
          // Charts
          'charts-vendor': ['recharts'],
          // Forms
          'forms-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          // Data fetching
          'query-vendor': ['@tanstack/react-query', '@tanstack/react-table'],
          // Utilities
          'utils-vendor': ['dayjs', 'axios', 'html2pdf.js', 'date-fns'],
          // Icons (lucide-react only - @ant-design/icons removed)
          'icons-vendor': ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Increase limit to 1MB per chunk
  },
});


