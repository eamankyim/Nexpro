import { useCallback, useRef, useState } from 'react';

type ActionRunner = () => Promise<unknown> | unknown;

export function useExclusiveAction<ActionKey extends string>() {
  const [activeAction, setActiveAction] = useState<ActionKey | null>(null);
  const activeActionRef = useRef<ActionKey | null>(null);

  const runExclusiveAction = useCallback(async (action: ActionKey, runner: ActionRunner) => {
    if (activeActionRef.current) return false;

    activeActionRef.current = action;
    setActiveAction(action);

    try {
      await runner();
      return true;
    } finally {
      activeActionRef.current = null;
      setActiveAction(null);
    }
  }, []);

  const isActionActive = useCallback(
    (action: ActionKey) => activeAction === action,
    [activeAction]
  );

  return {
    activeAction,
    isAnyActionActive: activeAction !== null,
    isActionActive,
    runExclusiveAction,
  };
}
