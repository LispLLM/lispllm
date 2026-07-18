import { useCallback, useRef, useSyncExternalStore } from 'react';

export type EqualityFn<T> = (previous: T, next: T) => boolean;

/** Shallow equality for small selector result objects. */
export function shallowEqual<T extends Record<string, unknown>>(previous: T, next: T): boolean {
  if (Object.is(previous, next)) return true;
  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  if (previousKeys.length !== nextKeys.length) return false;
  return previousKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(next, key) && Object.is(previous[key], next[key]),
  );
}

/**
 * Subscribe to one derived store slice. Unchanged selections preserve their reference,
 * so unrelated store updates do not re-render the component.
 */
export function useExternalStoreSelector<State, Selection>(
  subscribe: (listener: () => void) => () => void,
  getState: () => State,
  selector: (state: State) => Selection,
  isEqual: EqualityFn<Selection> = Object.is,
): Selection {
  const selectorRef = useRef(selector);
  const equalityRef = useRef(isEqual);
  const selectionRef = useRef<{ initialized: true; value: Selection } | null>(null);
  selectorRef.current = selector;
  equalityRef.current = isEqual;

  const getSnapshot = useCallback(() => {
    const next = selectorRef.current(getState());
    const cached = selectionRef.current;
    if (cached && equalityRef.current(cached.value, next)) return cached.value;
    selectionRef.current = { initialized: true, value: next };
    return next;
  }, [getState]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
