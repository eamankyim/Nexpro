import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { SEARCH_PLACEHOLDERS } from '@/constants';

const SmartSearchContext = createContext(null);

/**
 * Provider for context-aware header search. Pages register on mount with
 * { scope, placeholder }; header renders a single controlled input.
 * searchValue is cleared when pageConfig scope changes (e.g. on navigation).
 */
export function SmartSearchProvider({ children }) {
  const [pageConfig, setPageConfigState] = useState(null);
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    setSearchValue('');
  }, [pageConfig?.scope]);

  const setPageSearchConfig = useCallback((config) => {
    setPageConfigState(config);
  }, []);

  const placeholder = pageConfig?.placeholder ?? SEARCH_PLACEHOLDERS.GLOBAL;
  const scope = pageConfig?.scope ?? 'global';

  const value = {
    pageConfig,
    placeholder,
    scope,
    searchValue,
    setSearchValue,
    setPageSearchConfig,
  };

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
