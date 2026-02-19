const GLOBAL_STATE_KEY = Symbol.for("rwsdk.state");

const globalState = globalThis as unknown as {
  [GLOBAL_STATE_KEY]: Record<string, any>;
};

if (!globalState[GLOBAL_STATE_KEY]) {
  globalState[GLOBAL_STATE_KEY] = {};
}

const state = globalState[GLOBAL_STATE_KEY];

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
