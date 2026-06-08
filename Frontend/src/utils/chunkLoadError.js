/**
 * Detect stale Vite/async chunk failures (common after deploy or PWA cache mismatch).
 */
export const isChunkLoadError = (error) => {
  const msg = String(error?.message || error || '');
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    (msg.includes('Loading chunk') && msg.includes('failed'))
  );
};

export const CHUNK_LOAD_REFRESH_MESSAGE =
  'A new version of the app is available. Refresh the page, then try again.';

const CHUNK_RELOAD_ATTEMPTED_KEY = 'chunk-reload-attempted';

/**
 * Clear the one-time auto-reload guard after a successful page load.
 */
export const clearChunkReloadAttempt = () => {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_ATTEMPTED_KEY);
  } catch {
    // sessionStorage may be unavailable
  }
};

/**
 * Reload the page to load fresh assets after a chunk load failure.
 */
export const reloadForChunkError = () => {
  window.location.reload();
};

/**
 * Walk error.cause chain for chunk-load failures.
 * @param {unknown} error
 * @returns {boolean}
 */
export const hasChunkLoadError = (error) => {
  let current = error;
  while (current) {
    if (isChunkLoadError(current)) return true;
    current = current?.cause;
  }
  return false;
};

/**
 * Import a module with one automatic reload on stale chunk errors (prod only).
 * @param {() => Promise<unknown>} importer
 * @param {{ autoReload?: boolean }} [options]
 * @returns {Promise<unknown>}
 */
export const importWithChunkRetry = async (importer, { autoReload = true } = {}) => {
  try {
    return await importer();
  } catch (error) {
    if (!isChunkLoadError(error)) {
      throw error;
    }

    const canAutoReload =
      autoReload &&
      import.meta.env.PROD &&
      typeof window !== 'undefined' &&
      sessionStorage.getItem(CHUNK_RELOAD_ATTEMPTED_KEY) !== '1';

    if (canAutoReload) {
      sessionStorage.setItem(CHUNK_RELOAD_ATTEMPTED_KEY, '1');
      window.location.reload();
      return new Promise(() => {});
    }

    const err = new Error(CHUNK_LOAD_REFRESH_MESSAGE);
    err.cause = error;
    throw err;
  }
};

let html2pdfLoader = null;

/**
 * Lazily load html2pdf with chunk-error retry (avoids brittle static chunk coupling).
 * @returns {Promise<import('html2pdf.js').default>}
 */
export const loadHtml2Pdf = async () => {
  if (!html2pdfLoader) {
    html2pdfLoader = importWithChunkRetry(() => import('html2pdf.js')).then((mod) => mod.default);
  }
  return html2pdfLoader;
};
