/**
 * Online-only helpers for the web app.
 * Offline business operations are supported in the mobile app only.
 */

export const ONLINE_REQUIRED_MESSAGE =
  'Internet connection required. Use the mobile app for offline work.';

/**
 * @returns {boolean}
 */
export function isNavigatorOnline() {
  return typeof navigator === 'undefined' || navigator.onLine;
}

/**
 * Throws when the browser reports offline.
 * @throws {Error}
 */
export function requireOnline() {
  if (!isNavigatorOnline()) {
    throw new Error(ONLINE_REQUIRED_MESSAGE);
  }
}

/**
 * @param {(message: string) => void} showErrorFn
 * @returns {boolean} true if online
 */
export function guardOnline(showErrorFn) {
  if (isNavigatorOnline()) return true;
  showErrorFn(ONLINE_REQUIRED_MESSAGE);
  return false;
}
