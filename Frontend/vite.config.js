import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

const projectRoot = path.resolve(__dirname);
const LOCAL_API_URL = 'http://localhost:5000';

const PRODUCTION_API_HOST = 'api.africanbusinesssuite.com';

const normalizeApiOrigin = (url = LOCAL_API_URL) => {
  const normalized = url.trim().replace(/\/$/, '').replace(/\/api\/?$/i, '') || LOCAL_API_URL;
  if (/^https?:\/\//i.test(normalized)) return normalized;

  const localhostLike = /^(localhost|127(?:\.\d{1,3}){3}|192\.168\.)/i.test(normalized);
  return `${localhostLike ? 'http' : 'https'}://${normalized}`;
};

const resolveDevProxyTarget = (envUrl) => {
  const normalized = normalizeApiOrigin(envUrl);
  try {
    const host = new URL(normalized).hostname;
    if (host === PRODUCTION_API_HOST) {
      console.warn(
        `[vite] VITE_API_URL is production (${normalized}); dev proxy will use ${LOCAL_API_URL}. ` +
          'Update Frontend/.env.local if you intended a different API.'
      );
      return LOCAL_API_URL;
    }
  } catch {
    return LOCAL_API_URL;
  }
  return normalized;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, '');
  const devApiTarget = resolveDevProxyTarget(env.VITE_API_URL);

  return {
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
      // Fail fast when 3000 is taken instead of silently moving to 3001 (avoids stale tabs on the wrong port).
      strictPort: true,
      host: true,
      hmr: false,
      proxy: {
        '/api': {
          target: devApiTarget,
          changeOrigin: true,
        },
        '/uploads': {
          target: devApiTarget,
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
  };
});
