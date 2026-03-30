import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';

const HINT_MODE_STORAGE_KEY = 'nexpro-hint-mode';

const HintModeContext = createContext(null);

/**
 * Hint Mode provider – controls whether tooltips show on hover.
 * When ON: tooltips appear after 300ms. When OFF: tooltips are disabled.
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components
 */
export const HintModeProvider = ({ children }) => {
  const [hintMode, setHintModeState] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(HINT_MODE_STORAGE_KEY);
    if (stored === null) return true;
    return stored !== 'false';
  });

  useEffect(() => {
    localStorage.setItem(HINT_MODE_STORAGE_KEY, String(hintMode));
  }, [hintMode]);

  const setHintMode = useMemo(
    () => (value) => setHintModeState(!!value),
    []
  );

  const toggleHintMode = useMemo(
    () => () => setHintModeState((prev) => !prev),
    []
  );

  const value = useMemo(
    () => ({ hintMode, setHintMode, toggleHintMode }),
    [hintMode, setHintMode, toggleHintMode]
  );

  const delayDuration = hintMode ? 300 : 999999;

  return (
    <HintModeContext.Provider value={value}>
      <TooltipProvider key={hintMode ? 'hint-on' : 'hint-off'} delayDuration={delayDuration}>
        {children}
      </TooltipProvider>
    </HintModeContext.Provider>
  );
};

/**
 * Hook to access hint mode context
 * @returns {{ hintMode: boolean, setHintMode: (value: boolean) => void, toggleHintMode: () => void }}
 */
export const useHintMode = () => {
  const context = useContext(HintModeContext);
  if (!context) {
    throw new Error('useHintMode must be used within HintModeProvider');
  }
  return context;
};
