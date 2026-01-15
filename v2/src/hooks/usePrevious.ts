import { useEffect, useState } from 'react';

/**
 * Hook to track the previous value of a variable using state.
 * Returns undefined on first render, then the previous value on subsequent renders.
 * Uses state instead of refs to avoid accessing refs during render.
 */
export function usePrevious<T>(value: T): T | undefined {
  const [previous, setPrevious] = useState<T | undefined>(undefined);

  useEffect(() => {
    setPrevious(value);
  }, [value]);

  return previous;
}
