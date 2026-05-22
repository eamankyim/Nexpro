import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

const projectRoot = path.resolve(__dirname);

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: [
          '**/empty-states/**',
          '**/tour/**',
          '**/African focused woman*',
          '**/html2pdf*.js',
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: false,
      dev: false,
    }),
  ],
  resolve: {
    alias: {
      '@': path.join(projectRoot, 'src'),
      'react': path.join(projectRoot, 'node_modules/react'),
      'react-dom': path.join(projectRoot, 'node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'react-beautiful-dnd'],
  },
  server: {
    port: 3000,
    host: true,
    hmr: false,
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
    chunkSizeWarningLimit: 1000,
    minify: mode === 'production' ? 'terser' : 'esbuild',
    terserOptions:
      mode === 'production'
        ? {
            compress: {
              pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.trace'],
              passes: 2,
            },
          }
        : undefined,
  },
}));
