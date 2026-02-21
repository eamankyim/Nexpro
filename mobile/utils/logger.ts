/**
 * Mobile app logger - use __DEV__ to only log in development
 */
const PREFIX = '[ShopWISE]';

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
    console.error(`${PREFIX} [${tag}]`, ...args);
  },

  debug: (tag: string, ...args: unknown[]) => {
    if (__DEV__) {
      console.debug(`${PREFIX} [${tag}]`, ...args);
    }
  },
};
