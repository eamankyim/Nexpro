import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Run Paystack reconciliation when the app returns to the foreground (e.g. after hosted checkout).
 */
export function usePaystackReconciliation(
  enabled: boolean,
  reconcile: () => Promise<void>
) {
  const reconcileRef = useRef(reconcile);
  reconcileRef.current = reconcile;

  useEffect(() => {
    if (!enabled) return undefined;

    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState !== 'active') return;
      void reconcileRef.current();
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [enabled]);
}
