import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const projectRoot = path.resolve(__dirname);
const LOCAL_API_URL = 'http://127.0.0.1:5002';
const PRODUCTION_API_HOST = 'api.africanbusinesssuite.com';

const normalizeApiOrigin = (url = LOCAL_API_URL) => {
  const normalized = url.trim().replace(/\/$/, '').replace(/\/api\/?$/i, '') || LOCAL_API_URL;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const localhostLike = /^(localhost|127(?:\.\d{1,3}){3}|192\.168\.)/i.test(normalized);
  return `${localhostLike ? 'http' : 'https'}://${normalized}`;
};

const resolveDevProxyTargetFromEnv = (envUrl) => {
  if (!envUrl?.trim()) return LOCAL_API_URL;
  const normalized = normalizeApiOrigin(envUrl);
  try {
    if (new URL(normalized).hostname === PRODUCTION_API_HOST) {
      console.warn(
        `[vite] VITE_API_URL is production (${normalized}); dev proxy will probe local ports. ` +
          'Update storefront/.env if you intended a different API.'
      );
      return LOCAL_API_URL;
    }
  } catch {
    return LOCAL_API_URL;
  }
  return normalized;
};

/** Probe 5002, 5000, 5001, then 5003–5010 for ABS /health. */
function localBackendProxyPlugin(envUrl) {
  const initialTarget = resolveDevProxyTargetFromEnv(envUrl);
  return {
    name: 'local-backend-proxy',
    async configureServer(server) {
      let target = initialTarget;
      try {
        const { resolveLocalBackendUrl } = await import('./scripts/resolveLocalBackendUrl.mjs');
        target = await resolveLocalBackendUrl({ envUrl: envUrl?.trim() || undefined });
      } catch (err) {
        console.warn('[vite] Could not probe local backend; using', initialTarget, err?.message || err);
      }
      const applyTarget = (key) => {
        if (server.config.server?.proxy?.[key]) {
          server.config.server.proxy[key].target = target;
        }
      };
      applyTarget('/api');
      applyTarget('/uploads');
      console.log(`[vite] Dev proxy /api, /uploads → ${target}`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, '');
  const devApiTarget = resolveDevProxyTargetFromEnv(env.VITE_API_URL);

  return {
    plugins: [
      react(),
      ...(mode === 'development' ? [localBackendProxyPlugin(env.VITE_API_URL)] : []),
    ],
    resolve: {
      alias: {
        '@': path.join(projectRoot, 'src'),
      },
      dedupe: ['react', 'react-dom'],
    },
    server: {
      port: 3002,
      strictPort: true,
      host: true,
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
