/**
 * Tour guide screenshots — lazy-loaded per step when the tour runs.
 */
const tourImageModules = import.meta.glob('../assets/tour/step-*.{webp,png,jpg,jpeg}', {
  eager: false,
  import: 'default',
});

const tourImageCache = new Map();

/**
 * @param {number} stepIndex
 * @returns {Promise<string|null>}
 */
export async function loadTourImageByIndex(stepIndex) {
  if (tourImageCache.has(stepIndex)) return tourImageCache.get(stepIndex);
  const webpKey = `../assets/tour/step-${stepIndex}.webp`;
  const pngKey = `../assets/tour/step-${stepIndex}.png`;
  const loader = tourImageModules[webpKey] || tourImageModules[pngKey];
  if (!loader) return null;
  const src = await loader();
  tourImageCache.set(stepIndex, src);
  return src;
}

/**
 * @param {number} stepIndex
 * @returns {string | null} Cached URL only (sync); use loadTourImageByIndex for first load.
 */
export const getTourImageByIndex = (stepIndex) => tourImageCache.get(stepIndex) ?? null;

/** Welcome / tour prompt — loaded when prompt opens */
export const loadTourWelcomeImage = () => loadTourImageByIndex(0);
