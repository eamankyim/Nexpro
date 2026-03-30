/**
 * In production, silence routine console output from app code.
 * Keeps console.warn and console.error for operations and failures.
 * Call once at process startup after env validation (see server.js).
 *
 * @param {string} nodeEnv - Typically process.env.NODE_ENV via config
 */
function applySilenceIfProduction(nodeEnv) {
  if (nodeEnv !== 'production') return;
  const noop = () => {};
  // eslint-disable-next-line no-console
  console.log = noop;
  // eslint-disable-next-line no-console
  console.debug = noop;
  // eslint-disable-next-line no-console
  console.info = noop;
}

module.exports = { applySilenceIfProduction };
