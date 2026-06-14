/**
 * Mobile app logger - use __DEV__ to only log in development
 */
const PREFIX = '[ABS]';

export const logger = {
  info: (tag: string, ...args: unknown[]) => {
    if (__DEV__) {
      console.log(`${PREFIX} [${tag}]`, ...args);
    }
  },

  warn: (tag: string, ...args: unknown[]) => {
    if (__DEV__) {
      console.warn(`${PREFIX} [${tag}]`, ...args);
    }
  },

  error: (tag: string, ...args: unknown[]) => {
    if (__DEV__) {
      // React Native attaches a call stack to console.error in development.
      // Use warn for app-handled failures so logs show the real API message.
      console.warn(`${PREFIX} [${tag}]`, ...args);
      return;
    }
    console.error(`${PREFIX} [${tag}]`, ...args);
  },

  debug: (tag: string, ...args: unknown[]) => {
    if (__DEV__) {
      console.debug(`${PREFIX} [${tag}]`, ...args);
    }
  },
};
