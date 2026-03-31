// Minimal store pattern (inspired by Claude Code's internal patterns)
// WHY: Lightweight state management without external dependencies

type Listener<T> = (state: T) => void;

export type Store<T> = {
  getState: () => T;
  setState: (updater: Partial<T> | ((prev: T) => Partial<T>)) => void;
  subscribe: (listener: Listener<T>) => () => void;
};

export function createStore<T extends Record<string, unknown>>(
  initialState: T,
): Store<T> {
  let state = { ...initialState };
  const listeners = new Set<Listener<T>>();

  function getState(): T {
    return state;
  }

  function setState(updater: Partial<T> | ((prev: T) => Partial<T>)): void {
    const partial = typeof updater === "function" ? updater(state) : updater;
    // WHY: Immutable update — always create a new reference
    state = { ...state, ...partial };
    listeners.forEach((listener) => listener(state));
  }

  function subscribe(listener: Listener<T>): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return { getState, setState, subscribe };
}
