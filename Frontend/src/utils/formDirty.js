/**
 * Shallow compare plain objects (one level) for form dirty checks.
 * @param {Record<string, unknown>|null|undefined} a
 * @param {Record<string, unknown>|null|undefined} b
 * @returns {boolean}
 */
export function shallowEqualObjects(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => a[key] === b[key]);
}
