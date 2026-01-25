import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
      proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // UI libraries
          'ui-vendor': ['antd', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
          // Charts
          'charts-vendor': ['recharts'],
          // Forms
          'forms-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          // Data fetching
          'query-vendor': ['@tanstack/react-query'],
          // Utilities
          'utils-vendor': ['dayjs', 'axios', 'html2pdf.js'],
          // Icons
          'icons-vendor': ['lucide-react', '@ant-design/icons'],
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Increase limit to 1MB per chunk
  },
});


