import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

const projectRoot = path.resolve(__dirname);
/** Default when probing fails — avoid :5000 (macOS AirPlay Receiver). */
const LOCAL_API_URL = 'http://127.0.0.1:5001';

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
    const host = new URL(normalized).hostname;
    if (host === PRODUCTION_API_HOST) {
      console.warn(
        `[vite] VITE_API_URL is production (${normalized}); dev proxy will probe local ports. ` +
          'Update Frontend/.env.local if you intended a different API.'
      );
      return LOCAL_API_URL;
    }
  } catch {
    return LOCAL_API_URL;
  }
  return normalized;
};

/** Probe 5001/5002/5000–5010 for ABS /health (macOS AirPlay often blocks :5000). */
function localBackendProxyPlugin(envUrl) {
  const initialTarget = resolveDevProxyTargetFromEnv(envUrl);
  return {
    name: 'local-backend-proxy',
    async configureServer(server) {
      let target = initialTarget;
      try {
        const { resolveLocalBackendUrl, probeBackendOrigin } = await import(
          './scripts/resolveLocalBackendUrl.mjs'
        );
        target = await resolveLocalBackendUrl({ envUrl: envUrl?.trim() || undefined });
        if (!(await probeBackendOrigin(target))) {
          console.warn(
            `[vite] Resolved backend ${target} failed /health; re-scanning local ports…`
          );
          target = await resolveLocalBackendUrl({});
        }
      } catch (err) {
        console.warn('[vite] Could not probe local backend; using', initialTarget, err?.message || err);
      }
      const applyTarget = (key) => {
        const proxyEntry = server.config.server?.proxy?.[key];
        if (!proxyEntry) return;
        proxyEntry.target = target;
        const priorConfigure = proxyEntry.configure;
        proxyEntry.configure = (proxy, options) => {
          priorConfigure?.(proxy, options);
          proxy.on('error', (err) => {
            console.warn(
              `[vite] Proxy error for ${key} → ${target}: ${err?.message || err}. ` +
                'Is the backend running? On macOS, use PORT=5001 if :5000 is AirPlay.'
            );
          });
        };
      };
      applyTarget('/api');
      applyTarget('/uploads');
      const healthy = await import('./scripts/resolveLocalBackendUrl.mjs').then((m) =>
        m.probeBackendOrigin(target)
      );
      if (!healthy) {
        console.warn(
          `[vite] Dev proxy /api, /uploads → ${target} (backend /health not reachable yet — start Backend, then restart Vite)`
        );
      } else {
        console.log(`[vite] Dev proxy /api, /uploads → ${target}`);
      }
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
