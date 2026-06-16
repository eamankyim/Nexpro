import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { SEARCH_PLACEHOLDERS } from '@/constants';

const SmartSearchContext = createContext(null);
const RECENT_SEARCH_STORAGE_KEY = 'abs:smart-search:recent';
const RECENT_SEARCH_LIMIT = 5;

const readRecentSearches = () => {
  if (typeof window === 'undefined') return {};

  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_SEARCH_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeRecentSearches = (value) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(RECENT_SEARCH_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Search history is a convenience feature; storage failures should not block search.
  }
};

/**
 * Provider for context-aware header search. Pages register on mount with
 * { scope, placeholder }; header renders a single controlled input.
 * searchValue is cleared when pageConfig scope changes (e.g. on navigation).
 */
export function SmartSearchProvider({ children }) {
  const [pageConfig, setPageConfigState] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const [recentSearches, setRecentSearches] = useState(() => readRecentSearches());

  useEffect(() => {
    setSearchValue('');
  }, [pageConfig?.scope]);

  const setPageSearchConfig = useCallback((config) => {
    setPageConfigState(config);
  }, []);

  const placeholder = pageConfig?.placeholder ?? SEARCH_PLACEHOLDERS.GLOBAL;
  const scope = pageConfig?.scope ?? 'global';
  const scopedRecentSearches = useMemo(() => {
    const values = recentSearches[scope];
    return Array.isArray(values) ? values : [];
  }, [recentSearches, scope]);

  const saveRecentSearch = useCallback((term, scopeOverride) => {
    const trimmedTerm = String(term || '').trim();
    const targetScope = scopeOverride || scope;

    if (!trimmedTerm || !targetScope) return;

    setRecentSearches((current) => {
      const existing = Array.isArray(current[targetScope]) ? current[targetScope] : [];
      const normalizedTerm = trimmedTerm.toLowerCase();
      const nextForScope = [
        trimmedTerm,
        ...existing.filter((item) => String(item).trim().toLowerCase() !== normalizedTerm),
      ].slice(0, RECENT_SEARCH_LIMIT);
      const next = { ...current, [targetScope]: nextForScope };
      writeRecentSearches(next);
      return next;
    });
  }, [scope]);

  const clearRecentSearches = useCallback((scopeOverride) => {
    const targetScope = scopeOverride || scope;
    setRecentSearches((current) => {
      if (!current[targetScope]) return current;

      const next = { ...current };
      delete next[targetScope];
      writeRecentSearches(next);
      return next;
    });
  }, [scope]);

  const value = useMemo(
    () => ({
      pageConfig,
      placeholder,
      scope,
      searchValue,
      setSearchValue,
      setPageSearchConfig,
      recentSearches: scopedRecentSearches,
      saveRecentSearch,
      clearRecentSearches,
    }),
    [
      pageConfig,
      placeholder,
      scope,
      searchValue,
      setPageSearchConfig,
      scopedRecentSearches,
      saveRecentSearch,
      clearRecentSearches,
    ]
  );

  return (
    <SmartSearchContext.Provider value={value}>
      {children}
    </SmartSearchContext.Provider>
  );
}

export function useSmartSearch() {
  const ctx = useContext(SmartSearchContext);
  if (!ctx) {
    throw new Error('useSmartSearch must be used within SmartSearchProvider');
  }
  return ctx;
}
