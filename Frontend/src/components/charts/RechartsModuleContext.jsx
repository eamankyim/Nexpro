import { createContext, useContext, useEffect, useState } from 'react';

const RechartsModuleContext = createContext(null);

/**
 * Loads recharts in a separate async chunk after first paint (Reports and similar heavy pages).
 */
export function RechartsModuleProvider({ children }) {
  const [module, setModule] = useState(null);

  useEffect(() => {
    let cancelled = false;
    import('recharts')
      .then((m) => {
        if (!cancelled) setModule(m);
      })
      .catch(() => {
        if (!cancelled) setModule(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <RechartsModuleContext.Provider value={module}>{children}</RechartsModuleContext.Provider>
  );
}

/**
 * @returns {import('recharts') | null} null until the dynamic import resolves
 */
export function useRechartsModule() {
  return useContext(RechartsModuleContext);
}
