import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { SEARCH_PLACEHOLDERS } from '@/constants/searchPlaceholders';

export type PageSearchConfig = {
  scope: string;
  placeholder: string;
  /** When false, header search is hidden (e.g. POS / scan). */
  enabled?: boolean;
};

type SmartSearchContextValue = {
  pageConfig: PageSearchConfig | null;
  placeholder: string;
  scope: string;
  searchEnabled: boolean;
  searchValue: string;
  setSearchValue: (value: string) => void;
  setPageSearchConfig: (config: PageSearchConfig | null) => void;
};

const SmartSearchContext = createContext<SmartSearchContextValue | null>(null);

/**
 * Context-aware header search (parity with web SmartSearchProvider).
 * Pages register scope + placeholder on focus; header renders one controlled input.
 */
export function SmartSearchProvider({ children }: { children: ReactNode }) {
  const [pageConfig, setPageConfigState] = useState<PageSearchConfig | null>(null);
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    setSearchValue('');
  }, [pageConfig?.scope]);

  const setPageSearchConfig = useCallback((config: PageSearchConfig | null) => {
    setPageConfigState(config);
  }, []);

  const value = useMemo<SmartSearchContextValue>(
    () => ({
      pageConfig,
      placeholder: pageConfig?.placeholder ?? SEARCH_PLACEHOLDERS.GLOBAL,
      scope: pageConfig?.scope ?? 'global',
      searchEnabled: pageConfig?.enabled !== false,
      searchValue,
      setSearchValue,
      setPageSearchConfig,
    }),
    [pageConfig, searchValue, setPageSearchConfig]
  );

  return <SmartSearchContext.Provider value={value}>{children}</SmartSearchContext.Provider>;
}

export function useSmartSearch(): SmartSearchContextValue {
  const ctx = useContext(SmartSearchContext);
  if (!ctx) {
    throw new Error('useSmartSearch must be used within SmartSearchProvider');
  }
  return ctx;
}
