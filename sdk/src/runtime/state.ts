const state: Record<string, any> = {};

export function defineRwState<T>(key: string, initializer: () => T): T {
  if (!(key in state)) {
    state[key] = initializer();
  }
  return state[key] as T;
}

export function getRwState<T>(key: string): T | undefined {
  return state[key] as T | undefined;
}

export function setRwState<T>(key: string, value: T): void {
  state[key] = value;
}
