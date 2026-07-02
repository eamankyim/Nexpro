import { EMPTY_STATES } from '@/constants/microcopy';
import { getEmptyStateProps } from '@/components/ui/empty-state';

/**
 * Empty state props when a non-empty search query returns no matches.
 * @param {string} query - Active search query
 * @param {function} onClear - Clears search (and optionally filters)
 * @returns {Object} Props to spread into EmptyState
 */
export function getSearchNoResultsEmptyStateProps(query, onClear) {
  const trimmed = String(query || '').trim();
  const base = getEmptyStateProps(EMPTY_STATES.SEARCH_NO_RESULTS, {
    primary: onClear,
  });

  return {
    ...base,
    title: trimmed ? `No results found for "${trimmed}"` : base.title,
  };
}

/**
 * Returns true when any field contains the query (case-insensitive).
 * @param {string} query
 * @param {...*} fields
 * @returns {boolean}
 */
export function matchesSearchQuery(query, fields = []) {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) return true;
  return fields.some((field) => String(field ?? '').toLowerCase().includes(normalized));
}
