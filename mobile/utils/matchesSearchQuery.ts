/**
 * Client-side filter helper when API search is unavailable.
 */
export function matchesSearchQuery(
  query: string,
  fields: Array<string | number | null | undefined>
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((field) => String(field ?? '').toLowerCase().includes(q));
}
